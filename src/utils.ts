import { DAY_NAMES } from './constants';
import type { Meeting } from './types';

export function normCode(s: string): string { return String(s || '').toUpperCase().replace(/\s+/g, ''); }
export function toDec(hhmm: string): number {
  const p = String(hhmm || '').split(':').map(Number);
  if (p.length < 2 || isNaN(p[0]) || isNaN(p[1])) return NaN;
  return p[0] + p[1] / 60;
}
export function fmtDec(t: number): string {
  let h = Math.floor(t), m = Math.round((t - h) * 60);
  if (m === 60){ h += 1; m = 0; }
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function fmtRange(m: Meeting): string { return fmtDec(m.start) + '–' + fmtDec(m.end); }
export function cleanTeacher(n: string): string { return String(n || '').replace(/,\s*/g, ' ').replace(/\s+/g, ' ').trim(); }
export function cleanField(v: string): string { const s = String(v || '').trim(); return (s && s !== ' ') ? s : ''; }
export function hashHue(s: string): number { let h = 0; for (let i = 0; i < s.length; i++){ h = (h * 31 + s.charCodeAt(i)) >>> 0; } return h % 360; }
export function courseColor(code: string){
  const h = hashHue(code);
  return { bg: 'hsla(' + h + ',72%,92%,.92)', border: 'hsl(' + h + ',55%,45%)', text: 'hsl(' + h + ',48%,22%)' };
}
export function sectionTint(index: number){
  const h = Math.round((Number(index) * 137.508) % 360);
  return {
    h: h,
    bg: 'hsla(' + h + ',78%,52%,.20)',
    bgOn: 'hsla(' + h + ',82%,48%,.38)',
    border: 'hsl(' + h + ',72%,40%)',
    text: 'hsl(' + h + ',72%,26%)'
  };
}
export function truncate(s: string, n: number): string { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
export function summaryOf(meetings: Meeting[]): string {
  if (!meetings || !meetings.length) return 'TBA';
  const seen = new Set();
  const uniq = (meetings || []).filter(m => {
    const k = m.day + '|' + m.start + '|' + m.end;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const m = uniq[0];
  let s = DAY_NAMES[m.day] + ' ' + fmtRange(m);
  if (uniq.length > 1) s += ' · +' + (uniq.length - 1) + ' more';
  return s;
}
export let _uid = 0;
export const uid = (): string => 'id-' + (++_uid);
