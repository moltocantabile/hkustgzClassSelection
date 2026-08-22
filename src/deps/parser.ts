import { CODE_RE } from '../constants';
import { normCode } from '../utils';
import type { AstNode, PrereqResult } from '../types';

/* ================= dependency parser (real tokenizer, no includes()) ================= */
export function extractCodes(text: string){
  const out = [], seen = new Set();
  const m = String(text || '').matchAll(CODE_RE);
  for (const hit of m){
    const c = normCode(hit[0]);
    if (c && !seen.has(c)){ seen.add(c); out.push({ code: c, raw: hit[0].replace(/\s+/g, ' ') }); }
  }
  return out;
}
export function tokenize(text: string){
  let s = String(text || '').toUpperCase();
  s = s.replace(/\bAND\b/g, ' AND ').replace(/\bOR\b/g, ' OR ');
  s = s.replace(/[;,]/g, ' AND ');
  s = s.replace(/\([A-Z]\)/g, ' AND ');
  s = s.replace(/\s+/g, ' ').trim();
  const toks = [];
  const re = /\(|\)|AND|OR|[A-Z]{2,5}\s?\d{3,4}[A-Za-z]?|[A-Za-z][A-Za-z0-9&+#.'\/-]*/g;
  let m;
  while ((m = re.exec(s))){
    const t = m[0].trim();
    if (!t) continue;
    if (t === 'AND' || t === 'OR' || t === '(' || t === ')') toks.push(t);
    else if (/[A-Z]{2,5}\s?\d{3,4}[A-Za-z]?/.test(t)) toks.push({ code: t });
    else toks.push({ text: t });
  }
  return toks;
}
export function sanitizeTokens(toks: any[]){
  const ignored = toks.filter(t => t && t.text).map(t => t.text);
  const t2 = toks.filter(t => !(t && t.text));
  let changed = true;
  while (changed){
    changed = false;
    for (let i = 0; i < t2.length; i++){
      if (t2[i] !== '(') continue;
      let depth = 0, matched = -1;
      for (let j = i; j < t2.length; j++){
        if (t2[j] === '(') depth++;
        else if (t2[j] === ')'){ depth--; if (depth === 0){ matched = j; break; } }
      }
      if (matched >= 0){
        const inner = t2.slice(i + 1, matched);
        const meaningful = inner.some(t => (t && t.code) || t === 'AND' || t === 'OR');
        if (!meaningful){ t2.splice(i, matched - i + 1); changed = true; break; }
      }
    }
  }
  let bal = 0;
  for (const t of t2){ if (t === '(') bal++; else if (t === ')') bal--; }
  if (bal !== 0){
    for (let i = t2.length - 1; i >= 0; i--){ if (t2[i] === '(' || t2[i] === ')') t2.splice(i, 1); }
  }
  while (t2.length && (t2[0] === 'AND' || t2[0] === 'OR')) t2.shift();
  while (t2.length && (t2[t2.length - 1] === 'AND' || t2[t2.length - 1] === 'OR')) t2.pop();
  for (let i = t2.length - 1; i > 0; i--){
    if ((t2[i] === 'AND' || t2[i] === 'OR') && (t2[i - 1] === 'AND' || t2[i - 1] === 'OR')){
      if (t2[i] === 'OR') t2[i - 1] = 'OR';
      t2.splice(i, 1);
    }
  }
  return { toks: t2, ignored: ignored };
}
export class DepParser {
  t: any[];
  i: number;
  bad: boolean;
  constructor(t){ this.t = t; this.i = 0; this.bad = false; }
  peek(){ return this.t[this.i]; }
  next(){ return this.t[this.i++]; }
  parseOr(){
    const parts = [];
    const first = this.parseAnd();
    if (!first){ this.bad = true; return null; }
    parts.push(first);
    while (this.peek() === 'OR'){
      this.next();
      const p = this.parseAnd();
      if (!p){ this.bad = true; return null; }
      parts.push(p);
    }
    return parts.length === 1 ? parts[0] : { kind: 'or', children: parts };
  }
  parseAnd(){
    const parts = [];
    const first = this.parseUnary();
    if (!first){ this.bad = true; return null; }
    parts.push(first);
    while (this.peek() === 'AND'){
      this.next();
      const p = this.parseUnary();
      if (!p){ this.bad = true; return null; }
      parts.push(p);
    }
    while (this.peek() && typeof this.peek() === 'object'){
      const p = this.parseUnary();
      if (!p){ this.bad = true; return null; }
      parts.push(p);
    }
    return parts.length === 1 ? parts[0] : { kind: 'and', children: parts };
  }
  parseUnary(){
    const t = this.peek();
    if (t === '('){
      this.next();
      const n = this.parseOr();
      if (this.peek() === ')') this.next();
      else this.bad = true;
      return n;
    }
    if (t && typeof t === 'object' && t.code){
      this.next();
      return { kind: 'code', code: normCode(t.code), label: t.code.replace(/\s+/g, ' ') };
    }
    this.bad = true;
    return null;
  }
}
export function astHasCode(n: AstNode | null): boolean {
  if (!n) return false;
  if (n.kind === 'code') return true;
  if (n.kind === 'note') return false;
  return !!(n.children && n.children.some(astHasCode));
}
export function parsePrereq(text: string): PrereqResult {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, node: null, raw: '', approximate: false, ignored: [] };
  const tk = tokenize(raw);
  const cleaned = sanitizeTokens(tk);
  const codes = extractCodes(raw);
  if (!cleaned.toks.length){
    if (codes.length === 1) return { ok: true, node: { kind: 'code', code: codes[0].code, label: codes[0].raw }, raw: raw, approximate: false, ignored: cleaned.ignored };
    return { ok: false, node: null, raw: raw, approximate: false, ignored: cleaned.ignored };
  }
  const p = new DepParser(cleaned.toks);
  const root = p.parseOr();
  const leftover = p.t.slice(p.i);
  if (!root || p.bad || leftover.length){
    if (codes.length === 1) return { ok: true, node: { kind: 'code', code: codes[0].code, label: codes[0].raw }, raw: raw, approximate: false, ignored: cleaned.ignored };
    if (codes.length > 1){
      const op = /\bOR\b/i.test(raw) ? 'or' : 'and';
      return { ok: true, node: { kind: op, children: codes.map(c => ({ kind: 'code', code: c.code, label: c.raw })) }, raw: raw, approximate: true, ignored: cleaned.ignored };
    }
    return { ok: false, node: null, raw: raw, approximate: false, ignored: cleaned.ignored };
  }
  if (!astHasCode(root)) return { ok: false, node: null, raw: raw, approximate: false, ignored: cleaned.ignored };
  return { ok: true, node: root, raw: raw, approximate: false, ignored: cleaned.ignored };
}
export function astString(n: AstNode | null): string {
  if (!n) return '';
  if (n.kind === 'code') return n.label || n.code;
  if (n.kind === 'note') return '"' + n.label + '"';
  const inner = n.children.map(astString);
  if (inner.length === 1) return inner[0];
  return '(' + inner.join(' ' + n.kind.toUpperCase() + ' ') + ')';
}
