import { END_HOUR, HOUR_H, START_HOUR } from '../constants';
import { sectionTint } from '../utils';
import { courseBundles } from './sections';
import { findConflicts } from './conflict';

/* ================= drag targeting (times stay official) ================= */
export function pointerOverCalendar(e, el){
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
}
export function calendarMetrics(el){
  if (!el) return null;
  const days = Array.prototype.map.call(el.querySelectorAll('.cal-dayhead'), node => node.getBoundingClientRect());
  const firstHour = el.querySelector('.cal-time');
  if (!days.length || !firstHour) return null;
  const hourBox = firstHour.getBoundingClientRect();
  const rowH = hourBox.height || HOUR_H;
  return { days: days, rowH: rowH, originTop: hourBox.top };
}


export function pointerCell(e, el){
  const metrics = calendarMetrics(el);
  if (!metrics) return null;
  let day = 0;
  for (let i = 0; i < metrics.days.length; i++){
    const box = metrics.days[i];
    if (e.clientX >= box.left && e.clientX < box.right){ day = i + 1; break; }
  }
  if (!day) return null;
  const time = START_HOUR + (e.clientY - metrics.originTop) / metrics.rowH;
  if (time < START_HOUR || time > END_HOUR + 1) return null;
  return { day: day, time: time };
}
export function pointerCellClamped(e, el){
  const metrics = calendarMetrics(el);
  if (!metrics) return null;
  let day = 0;
  for (let i = 0; i < metrics.days.length; i++){
    if (e.clientX >= metrics.days[i].left) day = i + 1;
  }
  day = Math.max(1, Math.min(5, day));
  const time = START_HOUR + (e.clientY - metrics.originTop) / metrics.rowH;
  return { day: day, time: Math.max(START_HOUR, Math.min(END_HOUR + 1, time)) };
}
export function boxRanges(a, b){
  const out = [];
  const d1 = Math.min(a.day, b.day), d2 = Math.max(a.day, b.day);
  const t1 = Math.min(a.time, b.time), t2 = Math.max(a.time, b.time);
  if (t2 - t1 < 0.01) return out;
  for (let d = d1; d <= d2; d++) out.push({ day: d, start: t1, end: t2 });
  return out;
}

export function courseDragTargets(course, schedule){
  const others = (schedule || []).filter(en => en.course !== course.code);
  return courseBundles(course).map((bundle, i) => {
    const meetings = [];
    bundle.forEach(entry => (entry.meetings || []).forEach(m => meetings.push(Object.assign({ label: entry.label, component: entry.component }, m))));
    const conflicts = [];
    bundle.forEach(entry => findConflicts(entry.meetings, others).forEach(c => conflicts.push(c)));
    return {
      bundle: bundle,
      primary: bundle[0],
      label: bundle.map(e => e.label).join('+'),
      meetings: meetings,
      conflicts: conflicts,
      tint: sectionTint(i)
    };
  });
}
export function meetingsOverlap(a, b){
  return a.day === b.day && a.start < b.end && b.start < a.end;
}
export function layoutGhostOverlays(targets){
  const items = [];
  (targets || []).forEach((t, ti) => {
    (t.meetings || []).forEach((m, mi) => {
      items.push({ t: t, m: m, ti: ti, mi: mi, day: m.day, start: m.start, end: m.end, lane: 0, lanes: 1 });
    });
  });
  const byDay = {};
  items.forEach(it => { (byDay[it.day] || (byDay[it.day] = [])).push(it); });
  Object.keys(byDay).forEach(day => {
    const list = byDay[day];
    const seen = list.map(() => false);
    for (let i = 0; i < list.length; i++){
      if (seen[i]) continue;
      const stack = [i];
      seen[i] = true;
      const group = [];
      while (stack.length){
        const u = stack.pop();
        group.push(list[u]);
        for (let v = 0; v < list.length; v++){
          if (!seen[v] && meetingsOverlap(list[u], list[v])){ seen[v] = true; stack.push(v); }
        }
      }
      group.sort((a, b) => String(a.t.label).localeCompare(String(b.t.label), undefined, { numeric: true }) || a.start - b.start || a.ti - b.ti);
      group.forEach((it, idx) => { it.lane = idx; it.lanes = group.length; });
    }
  });
  return items;
}
export function ghostSliceBox(it, originTop, rowH){
  const lanes = Math.max(1, it.lanes || 1);
  const lane = it.lane || 0;
  return {
    top: originTop + (it.start - START_HOUR) * rowH + 4,
    height: Math.max(8, (it.end - it.start) * rowH - 8),
    leftPct: (lane / lanes) * 100,
    widthPct: 100 / lanes,
    lane: lane,
    lanes: lanes
  };
}
export function pickTarget(targets, e, el){
  const metrics = calendarMetrics(el);
  const cell = pointerCell(e, el);
  if (!metrics || !cell) return null;
  const dayBox = metrics.days[cell.day - 1];
  if (!dayBox || dayBox.width <= 0) return null;
  const xRatio = (e.clientX - dayBox.left) / dayBox.width;
  const hits = layoutGhostOverlays(targets).filter(it => {
    if (it.day !== cell.day) return false;
    const box = ghostSliceBox(it, metrics.originTop, metrics.rowH);
    if (e.clientY < box.top || e.clientY >= box.top + box.height) return false;
    const lane = Math.max(0, Math.min(box.lanes - 1, Math.floor(xRatio * box.lanes)));
    return lane === box.lane;
  });
  if (!hits.length) return null;
  hits.sort((a, b) => (a.t.conflicts.length ? 1 : 0) - (b.t.conflicts.length ? 1 : 0) || a.lanes - b.lanes);
  return hits[0].t;
}
