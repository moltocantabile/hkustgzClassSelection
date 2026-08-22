import { normCode } from '../utils';

/* ================= catalog (data.json) ================= */
export function buildCatalog(raw: any[]){
  const map = {};
  for (const d of (raw || [])){
    const code = normCode(d.crseCode);
    if (!code) continue;
    const score = ['crsePrerequisite', 'crseCorequisite', 'crseDescr', 'crseTitle', 'equivCourseCode']
      .filter(k => { const v = d[k]; return v && String(v).trim() && String(v).trim() !== ' '; }).length;
    const cur = map[code];
    if (!cur || score > cur._score){ map[code] = Object.assign({}, d, {_score: score}); }
  }
  return map;
}
