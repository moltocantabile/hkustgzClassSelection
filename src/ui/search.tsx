import { DAY_NAMES } from '../constants';
import { findConflicts } from '../schedule/conflict';
import { groupSections, isWildcardAssoc, parallelClassCount, sectionSummary } from '../schedule/sections';
import { fmtRange, truncate } from '../utils';
import { PlusIcon, TrashIcon } from './icons';

/* ================= search & detail ================= */
export function searchCourses(courses, q){
  const query = String(q || '').trim().toLowerCase();
  if (!query) return courses;
  const scored = [];
  for (const c of courses){
    const code = c.code.toLowerCase(), name = c.name.toLowerCase();
    const short = c.shortDesc.toLowerCase(), desc = c.desc.toLowerCase();
    const labels = c.sections.map(s => (s.label || '').toLowerCase()).join(' ');
    let score = 0;
    if (code === query) score = 100;
    else if (code.startsWith(query)) score = 80;
    else if (code.includes(query)) score = 60;
    if (name.includes(query)) score = Math.max(score, 50);
    if (short.includes(query) || desc.includes(query)) score = Math.max(score, 30);
    if (labels.includes(query)) score = Math.max(score, 40);
    if (score) scored.push({ c: c, score: score });
  }
  scored.sort((a, b) => b.score - a.score || a.c.code.localeCompare(b.c.code));
  return scored.map(s => s.c);
}
export const EMPTY_FILTERS = { subject: '', credits: '', career: '', days: [], slot: '', instructor: '', noConflict: false, available: false, hasParallel: false, hasLab: false, hasTut: false, hasPrereq: false };
export function subjectOf(c){ return c.subject || ((c.code || '').match(/^[A-Z]+/) || [''])[0]; }
export function careerOf(c){ return String((c && c.career) || '').toUpperCase(); }
export function careerLabel(code){
  const k = String(code || '').toUpperCase();
  if (k === 'UGRD' || k === 'UG') return 'UG';
  if (k === 'TPG') return 'TPG';
  if (k === 'RPG') return 'RPG';
  if (k === 'PG') return 'PG';
  return k || '—';
}
export function careerMatches(c, selected){
  if (!selected) return true;
  const k = careerOf(c);
  if (selected === 'UG' || selected === 'UGRD') return k === 'UGRD';
  if (selected === 'PG') return k === 'TPG' || k === 'RPG';
  return k === selected;
}
export function meetingInSlot(m, slot){
  if (!slot) return true;
  if (slot === 'am') return m.end <= 12;
  if (slot === 'pm') return m.start < 18 && m.end > 12;
  if (slot === 'eve') return m.start >= 18;
  return true;
}
export function sectionMatchesFilters(s, f, schedule){
  const meetings = (s && s.meetings) || [];
  if (f.days && f.days.length){
    if (!meetings.some(m => f.days.indexOf(m.day) >= 0)) return false;
  }
  if (f.slot && !meetings.some(m => meetingInSlot(m, f.slot))) return false;
  if (f.instructor){
    const q = String(f.instructor).trim().toLowerCase();
    if (q && !meetings.some(m => String(m.teacher || '').toLowerCase().indexOf(q) >= 0)) return false;
  }
  if (f.available && !(s.capacity > 0 && s.enrolled < s.capacity)) return false;
  if (f.noConflict && schedule && schedule.length && findConflicts(meetings, schedule).length) return false;
  return true;
}
export function courseDays(c){
  const d = {};
  (c.sections || []).forEach(s => (s.meetings || []).forEach(m => { d[m.day] = true; }));
  return d;
}
export function courseHasParallel(c){
  return parallelClassCount(c) > 1;
}
export function filtersActive(f){
  return !!(f.subject || f.credits !== '' || f.career || (f.days && f.days.length) || f.slot || (f.instructor && String(f.instructor).trim()) || f.noConflict || f.available || f.hasParallel || f.hasLab || f.hasTut || f.hasPrereq);
}
export function applyFilters(courses, f, schedule){
  if (!filtersActive(f)) return courses;
  return courses.filter(c => {
    if (f.subject && subjectOf(c) !== f.subject) return false;
    if (f.credits !== '' && Number(c.credits) !== Number(f.credits)) return false;
    if (f.career && !careerMatches(c, f.career)) return false;
    if (f.hasParallel && !courseHasParallel(c)) return false;
    if (f.hasLab && !(c.sections || []).some(s => s.component === 'LAB')) return false;
    if (f.hasTut && !(c.sections || []).some(s => s.component === 'TUT')) return false;
    if (f.hasPrereq && !c.prereq) return false;
    const timed = (f.days && f.days.length) || f.slot || (f.instructor && String(f.instructor).trim()) || f.available || f.noConflict;
    if (timed){
      const secs = (c.sections || []).filter(s => s.meetings && s.meetings.length && sectionMatchesFilters(s, f, schedule));
      if (!secs.length) return false;
    }
    return true;
  });
}
export function FilterBar({ courses, filters, setFilters }){
  const subjects = React.useMemo(() => {
    const s = {};
    courses.forEach(c => { const k = subjectOf(c); if (k) s[k] = (s[k] || 0) + 1; });
    return Object.keys(s).sort().map(k => ({ k: k, n: s[k] }));
  }, [courses]);
  const creditOpts = React.useMemo(() => {
    const s = {};
    courses.forEach(c => { s[String(c.credits)] = true; });
    return Object.keys(s).sort((a, b) => Number(a) - Number(b));
  }, [courses]);
  function toggleDay(d){
    setFilters(prev => {
      const has = prev.days.indexOf(d) >= 0;
      return Object.assign({}, prev, { days: has ? prev.days.filter(x => x !== d) : prev.days.concat([d]).sort() });
    });
  }
  function toggleFlag(key){
    setFilters(prev => Object.assign({}, prev, { [key]: !prev[key] }));
  }
  const active = filtersActive(filters);
  return (
    <div className="filters">
      <div className="filter-row">
        <select value={filters.subject} onChange={(e) => setFilters(prev => Object.assign({}, prev, { subject: e.target.value }))}>
          <option value="">All subjects</option>
          {subjects.map(s => <option key={s.k} value={s.k}>{s.k} ({s.n})</option>)}
        </select>
        <select value={filters.credits} onChange={(e) => setFilters(prev => Object.assign({}, prev, { credits: e.target.value }))}>
          <option value="">All credits</option>
          {creditOpts.map(cr => <option key={cr} value={cr}>{cr} cr</option>)}
        </select>
      </div>
      <div className="filter-row">
        <input value={filters.instructor || ''} placeholder="Instructor, e.g. Liu"
          onChange={(e) => setFilters(prev => Object.assign({}, prev, { instructor: e.target.value }))} />
      </div>
      <div className="filter-chips">
        {[['UG','UG'],['PG','PG'],['TPG','TPG'],['RPG','RPG']].map(pair => (
          <button key={pair[0]} className={'fchip' + (filters.career === pair[0] ? ' on' : '')}
            onClick={() => setFilters(prev => Object.assign({}, prev, { career: prev.career === pair[0] ? '' : pair[0] }))}>{pair[1]}</button>
        ))}
        {[[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri']].map(pair => (
          <button key={pair[0]} className={'fchip' + (filters.days.indexOf(pair[0]) >= 0 ? ' on' : '')} onClick={() => toggleDay(pair[0])}>{pair[1]}</button>
        ))}
        {[['am','Morning'],['pm','Afternoon'],['eve','Evening']].map(pair => (
          <button key={pair[0]} className={'fchip' + (filters.slot === pair[0] ? ' on' : '')}
            onClick={() => setFilters(prev => Object.assign({}, prev, { slot: prev.slot === pair[0] ? '' : pair[0] }))}>{pair[1]}</button>
        ))}
        <button className={'fchip' + (filters.noConflict ? ' on' : '')} onClick={() => toggleFlag('noConflict')}>Fits timetable</button>
        <button className={'fchip' + (filters.available ? ' on' : '')} onClick={() => toggleFlag('available')}>Has seats</button>
        <button className={'fchip' + (filters.hasParallel ? ' on' : '')} onClick={() => toggleFlag('hasParallel')}>Sections</button>
        <button className={'fchip' + (filters.hasTut ? ' on' : '')} onClick={() => toggleFlag('hasTut')}>Tutorial</button>
        <button className={'fchip' + (filters.hasLab ? ' on' : '')} onClick={() => toggleFlag('hasLab')}>Lab</button>
        <button className={'fchip' + (filters.hasPrereq ? ' on' : '')} onClick={() => toggleFlag('hasPrereq')}>Has prereq</button>
      </div>
      <div className="filter-meta">
        <span className="filter-count">{active ? 'Filters on' : 'Filter by UG/PG, subject, day, time'}</span>
        <button className="filter-clear" disabled={!active} onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
      </div>
    </div>
  );
}
export function CourseCard({ c, onClick, crossDrag, onDragCourse }){
  const nPar = parallelClassCount(c);
  const canDrag = !!(crossDrag && onDragCourse && (c.sections || []).some(sec => sec.meetings && sec.meetings.length));
  return (
    <div className="course-card" onClick={onClick}
      draggable={canDrag}
      onDragStart={(e) => { if (canDrag){ e.stopPropagation(); onDragCourse(e, c); } }}>
      <div className="cc-top">
        <span className="cc-code">{c.code}</span>
        <span className="cc-career">{careerLabel(c.career)}</span>
        <span className="cc-credits">{c.credits} cr</span>
      </div>
      <div className="cc-name">{c.name}</div>
      <div className="cc-secs">
        {sectionSummary(c) || 'No sections'}
        {nPar > 1 ? <span className="cc-par">{nPar} sections</span> : null}
      </div>
      <div className="cc-meta">{c.sections.length} section{c.sections.length === 1 ? '' : 's'}{c.isMulti ? ' · multi-component' : ''}{c.prereq ? ' · has prerequisite' : ''}</div>
    </div>
  );
}
export function TeacherChip({ inst }){
  const [box, setBox] = React.useState(null);
  const name = inst.name || 'Instructor';
  function show(e){
    const r = e.currentTarget.getBoundingClientRect();
    const width = 250;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const estH = 118;
    const top = (r.bottom + 8 + estH > window.innerHeight)
      ? Math.max(8, r.top - estH - 8)
      : r.bottom + 8;
    setBox({ left: left, top: top });
  }
  return (
    <span className="tchr" onMouseEnter={show} onMouseLeave={() => setBox(null)}>
      <span className="tchr-name">{name}</span>
      {box ? (
        <span className="tchr-pop" style={{ left: box.left, top: box.top }}>
          <div className="tp-name">{name}</div>
          {inst.role ? <div className="tp-role">{inst.role}</div> : null}
          {inst.email ? <div className="tp-row"><span className="tp-k">Email</span><span>{inst.email}</span></div> : null}
          {inst.account ? <div className="tp-row"><span className="tp-k">Account</span><span>{inst.account}</span></div> : null}
          {!inst.role && !inst.email && !inst.account ? <div className="tp-empty">No extra profile on file.</div> : null}
        </span>
      ) : null}
    </span>
  );
}
export function TeacherList({ meeting }){
  const list = meeting.instructors && meeting.instructors.length
    ? meeting.instructors
    : (meeting.teacher ? meeting.teacher.split('; ').filter(Boolean).map(name => ({ name: name })) : []);
  if (!list.length) return null;
  return (
    <span className="mtg-tag">· {list.map((inst, i) => (
      <React.Fragment key={i}>{i ? '; ' : null}<TeacherChip inst={inst} /></React.Fragment>
    ))}</span>
  );
}
export function SectionCard({ course, s, scheduledIds, conflictSections, onAdd, onRemove, onDragStartSec }){
  const has = scheduledIds.has(s.id);
  const conf = conflictSections.has(s.id);
  return (
    <div className={'sec-card' + (has ? ' in-sched' : '') + (conf ? ' conf' : '')}
      draggable={s.meetings.length > 0}
      onDragStart={(e) => {
        const t = e.target as HTMLElement;
        if (t && t.closest && t.closest('button')){ e.preventDefault(); return; }
        if (s.meetings.length){ onDragStartSec(e, course, s); }
      }}>
      <div className="sec-head">
        <span className="sec-label">{s.label || '—'}</span>
        {s.componentName ? <span className="sec-type">{s.componentName}</span> : null}
        {!isWildcardAssoc(s.associatedClass) ? <span className="sec-assoc">pair #{s.associatedClass}</span> : null}
        {has ? <span className="sec-badge in">in schedule</span> : null}
        {conf ? <span className="sec-badge conf">conflict</span> : null}
        {!s.meetings.length ? <span className="sec-badge conf">TBA</span> : null}
      </div>
      {s.meetings.map((m, i) => (
        <div className="mtg-row" key={i}>
          <span className="mtg-day">{DAY_NAMES[m.day]}</span>
          <span>{fmtRange(m)}</span>
          {m.room ? <span className="mtg-tag">· {m.room}</span> : null}
          {m.startDate && m.endDate ? <span className="mtg-tag" title={'Weeks: ' + m.startDate + ' – ' + m.endDate}>· {m.startDate.slice(5) + '–' + m.endDate.slice(5)}</span> : null}
          <TeacherList meeting={m} />
        </div>
      ))}
      <div className="sec-actions">
        {has
          ? <button className="sbtn rm icon" title="Remove from timetable" aria-label="Remove from timetable" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(s.id); }}><TrashIcon /></button>
          : <button className="sbtn add icon" disabled={!s.meetings.length} title="Add this class" aria-label="Add this class" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onAdd(course, s); }}><PlusIcon /></button>}
        {s.meetings.length ? <span className="mtg-tag" style={{ alignSelf: 'center' }}>⋮⋮ drag to place</span> : null}
        {s.capacity ? <span className="mtg-tag" style={{ marginLeft: 'auto', alignSelf: 'center' }}>{s.enrolled}/{s.capacity}</span> : null}
      </div>
    </div>
  );
}
export function CourseDetail({ course, scheduledIds, conflictSections, onAdd, onRemove, onOpenDeps, onBack, onDragStartSec, filters, schedule }){
  const sectionFilterOn = !!(filters && ((filters.days && filters.days.length) || filters.slot || (filters.instructor && String(filters.instructor).trim()) || filters.available || filters.noConflict));
  const groups = groupSections(course.sections).map(g => {
    const visible = sectionFilterOn ? g.sections.filter(s => sectionMatchesFilters(s, filters, schedule)) : g.sections;
    return Object.assign({}, g, { visible: visible });
  });
  return (
    <div className="detail">
      <div className="detail-head">
        <button className="detail-back" onClick={onBack}>← Back to results</button>
        <div className="detail-title">
          <span className="detail-code">{course.code}</span>
          <span className="detail-credits">{careerLabel(course.career)} · {course.credits} credits</span>
        </div>
        <div className="detail-name">{course.name}</div>
        {course.desc ? <div className="detail-desc">{course.desc}</div> : null}
        <div className="detail-chips">
          {course.prereq ? <span className="chip prereq" onClick={() => onOpenDeps(course.code)} title="Open dependency graph">Prerequisite: {truncate(course.prereq.replace(/\s+/g, ' '), 60)} →</span> : null}
          {course.coreq ? <span className="chip coreq">Corequisite: {course.coreq}</span> : null}
          {course.equiv ? <span className="chip equiv">Equivalent: {course.equiv}</span> : null}
          {course.associateMsg ? <span className="chip">{course.associateMsg}</span> : null}
        </div>
      </div>
      <div className="detail-body">
        {!course.sections.length ? <div className="no-sections">No scheduled sections found for this term.</div> : null}
        {groups.map(g => (
          <div className="comp-group" key={g.component}>
            <div className="comp-head">
              <span className="comp-title">{g.name}</span>
              <span className="comp-note">
                {g.sections.length > 1
                  ? (sectionFilterOn ? g.visible.length + '/' + g.sections.length + ' sections · ' : g.sections.length + ' sections · pick one · ') + g.visible.map(x => x.label).join(' / ')
                  : (g.visible[0] ? g.visible[0].label : (g.sections[0] ? g.sections[0].label : ''))}
              </span>
            </div>
            {g.visible.map(sec => (
              <SectionCard key={sec.id} course={course} s={sec} scheduledIds={scheduledIds}
                conflictSections={conflictSections} onAdd={onAdd} onRemove={onRemove} onDragStartSec={onDragStartSec} />
            ))}
            {sectionFilterOn && !g.visible.length ? (
              <div className="no-sections">No {g.name.toLowerCase()} matches the current filters.</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
