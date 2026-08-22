import { findConflicts } from './conflict';
import type { Course, Entry, Section } from '../types';

export const COMP_ORDER = ['LEC', 'TUT', 'LAB', 'SEM', 'IND', 'PRJ'];
export function isWildcardAssoc(n: number): boolean { return n == null || n === 0 || n === 9999; }
export function groupSections(sections: Section[]){
  const map = {};
  for (const sec of (sections || [])){
    const k = sec.component || sec.type || 'OTH';
    (map[k] = map[k] || []).push(sec);
  }
  return Object.keys(map).sort((a, b) => {
    const ia = COMP_ORDER.indexOf(a), ib = COMP_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  }).map(k => ({ component: k, name: map[k][0].componentName || k, sections: map[k] }));
}
export function sectionSummary(course: Course): string {
  return groupSections(course.sections).map(g => {
    const labels = g.sections.map(x => x.label);
    const shown = labels.length > 6 ? labels.slice(0, 4).join('/') + '/…/' + labels[labels.length - 1] : labels.join('/');
    return g.component + ' ' + shown;
  }).join(' · ');
}
export function parallelClassCount(course: Course): number {
  const groups = groupSections(course.sections || []);
  if (!groups.length) return 0;
  return Math.max.apply(null, groups.map(g => g.sections.length));
}
export function companionSections(course: Course, section: Section): Section[] {
  if (!course || !section || isWildcardAssoc(section.associatedClass)) return [];
  const extra = [];
  for (const g of groupSections(course.sections)){
    if (g.component === section.component) continue;
    const match = g.sections.filter(x => x.associatedClass === section.associatedClass && x.meetings.length);
    if (match.length === 1) extra.push(match[0]);
  }
  return extra;
}
export function makeEntry(courseCode: string, section: Section): Entry {
  return { course: courseCode, section: section.id, label: section.label, meetings: section.meetings, component: section.component, associatedClass: section.associatedClass };
}
export function formatCredits(n: number): string {
  const x = Number(n);
  if (!isFinite(x)) return '0';
  const r = Math.round(x * 100) / 100;
  return String(r);
}
export function scheduleCreditSummary(schedule: Entry[], coursesById: Record<string, Course>){
  const map = {};
  for (const en of (schedule || [])){
    if (!en || !en.course || map[en.course] != null) continue;
    const c = coursesById && coursesById[en.course];
    map[en.course] = { credits: c ? (Number(c.credits) || 0) : 0, klms: !!(c && c.klms) };
  }
  const rows = Object.keys(map).sort().map(code => ({ code: code, credits: map[code].credits, klms: map[code].klms }));
  const total = rows.reduce((s, r) => s + r.credits, 0);
  const sum = list => list.reduce((s, r) => s + r.credits, 0);
  const sisRows = rows.filter(r => !r.klms);
  const klmsRows = rows.filter(r => r.klms);
  return {
    total: total,
    courses: rows.length,
    rows: rows,
    sis: { total: sum(sisRows), courses: sisRows.length, rows: sisRows },
    klms: { total: sum(klmsRows), courses: klmsRows.length, rows: klmsRows }
  };
}
export function upsertSectionChoice(prev: Entry[], course: Course, section: Section): Entry[] {
  const bundle = [section].concat(companionSections(course, section));
  let next = prev.filter(en => !(en.course === course.code && bundle.some(s => s.component === en.component)));
  for (const s of bundle){
    if (s.meetings && s.meetings.length) next.push(makeEntry(course.code, s));
  }
  return next;
}
export function cartesian(arrays: Section[][]): Section[][] {
  return arrays.reduce((acc, arr) => {
    const out = [];
    for (const a of acc) for (const b of arr) out.push(a.concat([b]));
    return out;
  }, [[]]);
}
export function courseBundles(course: Course): Entry[][] {
  const groups = groupSections((course.sections || []).filter(s => s.meetings.length));
  const required = groups.filter(g => g.sections.some(s => !s.optional));
  const use = required.length ? required : groups;
  if (!use.length) return [];
  const needsMatch = !!(course.associateMsg) || use.some(g => g.sections.filter(s => !isWildcardAssoc(s.associatedClass)).length > 1);
  let combos;
  if (needsMatch){
    const ids = new Set();
    use.forEach(g => g.sections.forEach(s => { if (!isWildcardAssoc(s.associatedClass)) ids.add(s.associatedClass); }));
    if (!ids.size) combos = cartesian(use.map(g => g.sections));
    else {
      combos = [];
      for (const id of ids){
        const picks = [];
        let ok = true;
        for (const g of use){
          const exact = g.sections.filter(s => s.associatedClass === id);
          const any = g.sections.filter(s => isWildcardAssoc(s.associatedClass));
          const opts = exact.length ? exact : any;
          if (!opts.length){ ok = false; break; }
          picks.push(opts);
        }
        if (ok) combos = combos.concat(cartesian(picks));
      }
    }
  } else {
    combos = cartesian(use.map(g => g.sections));
  }
  const out = [];
  for (const secs of combos){
    const entries = secs.map(sec => makeEntry(course.code, sec));
    let bad = false;
    for (let i = 0; i < entries.length; i++){
      if (findConflicts(entries[i].meetings, entries.filter((_, j) => j !== i)).length){ bad = true; break; }
    }
    if (!bad) out.push(entries);
  }
  return out;
}
