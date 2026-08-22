import { DAY_LABELS, DAY_NAMES, END_HOUR, HOUR_H, START_HOUR, TIME_COL } from '../constants';
import { findConflicts, conflictCount } from '../schedule/conflict';
import { boxRanges, ghostSliceBox, layoutGhostOverlays, meetingsOverlap, pickTarget, pointerCellClamped, pointerOverCalendar } from '../schedule/drag';
import { formatCredits, scheduleCreditSummary } from '../schedule/sections';
import { courseColor, fmtDec, fmtRange, sectionTint } from '../utils';
import { CloseIcon, DownloadIcon } from './icons';

/* ================= timetable ================= */
export function CalBlockTip({ tip }){
  if (!tip) return null;
  const en = tip.en, m = tip.m, course = tip.course, conf = tip.conf || [];
  const teachers = (m.instructors && m.instructors.length)
    ? m.instructors.map(i => i.name).filter(Boolean).join('; ')
    : (m.teacher || '');
  return (
    <div className="cal-pop" style={{ left: tip.left, top: tip.top }}>
      <div className="cp-code">{en.course} {en.label}</div>
      <div className="cp-name">{course && course.name ? course.name : (en.component || 'Section')}</div>
      {course ? <div className="cp-row"><span className="cp-k">Credits</span><span>{course.credits}</span></div> : null}
      <div className="cp-row"><span className="cp-k">When</span><span>{DAY_NAMES[m.day]} {fmtRange(m)}</span></div>
      <div className="cp-row"><span className="cp-k">Room</span><span>{m.room || 'TBA'}</span></div>
      {teachers ? <div className="cp-row"><span className="cp-k">Instructor</span><span>{teachers}</span></div> : null}
      {conf.length ? <div className="cp-bad">Conflicts: {conf.map(c => c.type + ' with ' + c.other).join('; ')}</div> : null}
    </div>
  );
}
export function roundRectPath(ctx, x, y, w, h, r){
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function ellipsizeText(ctx, text, maxW){
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
export function exportTimetableImage(schedule, coursesById){
  const entries = (schedule || []).filter(en => en && en.course && Array.isArray(en.meetings) && en.meetings.length);
  if (!entries.length) return false;
  const S = 2;
  const TIME_COL = 70, DAY_W = 230, HEADER = 48;
  const FOOTER = 26;
  const LINE_H = 13.5;
  const items = [];
  const seen = new Set();
  entries.forEach(en => {
    for (const m of (en.meetings || [])){
      const key = en.section + '|' + m.day + '|' + m.start + '|' + m.end;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ en: en, m: m, course: coursesById && coursesById[en.course] });
    }
  });
  let maxLines = 3, minDur = Infinity;
  items.forEach(it => {
    const m = it.m, en = it.en, course = it.course;
    let n = 3;
    if (course && course.name) n++;
    if (m.teacher || (m.instructors || []).some(i => i && i.name)) n++;
    if (course && Number(course.credits)) n++;
    if (m.startDate && m.endDate) n++;
    if (n > maxLines) maxLines = n;
    const d = m.end - m.start;
    if (d > 0 && d < minDur) minDur = d;
  });
  const HOUR_H = Math.min(340, Math.max(64, Math.ceil((maxLines * LINE_H + 16) / (minDur === Infinity ? 1 : minDur))));
  const W = TIME_COL + DAY_W * 5;
  const H = HEADER + (END_HOUR - START_HOUR + 1) * HOUR_H + FOOTER;
  const GRID_BOTTOM = HEADER + (END_HOUR - START_HOUR + 1) * HOUR_H;
  const canvas = document.createElement('canvas');
  canvas.width = W * S; canvas.height = H * S;
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);
  const FONT_UI = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f6f8fb';
  ctx.fillRect(0, 0, W, HEADER);
  ctx.fillRect(0, 0, TIME_COL, H);

  ctx.strokeStyle = '#e8edf4';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++){
    const x = TIME_COL + DAY_W * i;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GRID_BOTTOM); ctx.stroke();
  }
  ctx.fillStyle = '#7c8aa0';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = '500 10.5px ' + FONT_MONO;
  for (let h = START_HOUR; h <= END_HOUR; h++){
    const y = HEADER + (h - START_HOUR) * HOUR_H;
    ctx.fillText(String(h).padStart(2, '0') + ':00', TIME_COL - 8, y - 2);
    ctx.beginPath(); ctx.moveTo(TIME_COL, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(TIME_COL, GRID_BOTTOM); ctx.lineTo(W, GRID_BOTTOM); ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 13px ' + FONT_UI;
  DAY_LABELS.forEach((d, i) => ctx.fillText(d, TIME_COL + DAY_W * i + DAY_W / 2, HEADER / 2 + 1));

  const creditSum = scheduleCreditSummary(entries, coursesById);
  const footLeft = formatCredits(creditSum.total) + ' cr · ' + creditSum.courses + ' course' + (creditSum.courses === 1 ? '' : 's') + (creditSum.klms.courses ? ' · KLMS ' + formatCredits(creditSum.klms.total) + ' cr' : '');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, GRID_BOTTOM, W, FOOTER);
  ctx.fillStyle = '#7c8aa0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '600 11px ' + FONT_UI;
  ctx.fillText(footLeft, TIME_COL + 8, GRID_BOTTOM + FOOTER / 2 + 1);
  ctx.textAlign = 'right';
  ctx.fillText('HKUST SIS Course Planner · ' + new Date().toISOString().slice(0, 10), W - 12, GRID_BOTTOM + FOOTER / 2 + 1);

  const byDay = {};
  items.forEach(it => { (byDay[it.m.day] || (byDay[it.m.day] = [])).push(it); });
  Object.keys(byDay).forEach(d => {
    const list = byDay[d];
    const used = list.map(() => false);
    for (let i = 0; i < list.length; i++){
      if (used[i]) continue;
      const stack = [i]; used[i] = true; const group = [];
      while (stack.length){
        const u = stack.pop(); group.push(list[u]);
        for (let v = 0; v < list.length; v++){
          if (!used[v] && meetingsOverlap(list[u].m, list[v].m)){ used[v] = true; stack.push(v); }
        }
      }
      group.sort((a, b) => String(a.en.course).localeCompare(String(b.en.course)) || a.m.start - b.m.start);
      group.forEach((it, idx) => { it.lane = idx; it.lanes = group.length; });
    }
  });

  items.forEach(it => {
    const m = it.m, en = it.en, course = it.course;
    const lanes = Math.max(1, it.lanes || 1);
    const lane = it.lane || 0;
    const slotW = DAY_W / lanes;
    const x = TIME_COL + (m.day - 1) * DAY_W + lane * slotW + 2;
    const y = HEADER + (m.start - START_HOUR) * HOUR_H + 3;
    const bh = (m.end - m.start) * HOUR_H - 6;
    if (bh < 14) return;
    const col = courseColor(en.course);
    roundRectPath(ctx, x, y, slotW - 4, bh, 8);
    ctx.fillStyle = col.bg; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = col.border; ctx.stroke();
    ctx.save();
    roundRectPath(ctx, x, y, slotW - 4, bh, 8);
    ctx.clip();
    ctx.fillStyle = col.border;
    ctx.fillRect(x, y, 4, bh);
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, x + 6, y + 4, slotW - 16, bh - 8, 6);
    ctx.clip();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const tx = x + 12;
    let lineY = y + 7;
    const teacher = m.teacher || (m.instructors || []).map(i => i.name).filter(Boolean).join('; ');
    const lines = [];
    lines.push({ text: en.course + ' ' + (en.label || ''), font: '800 12.5px ' + FONT_MONO, color: col.text });
    if (course && course.name) lines.push({ text: course.name, font: '700 11px ' + FONT_UI, color: '#334155' });
    lines.push({ text: fmtDec(m.start) + ' – ' + fmtDec(m.end), font: '700 11px ' + FONT_UI, color: '#334155' });
    lines.push({ text: m.room || 'TBA', font: '500 10.5px ' + FONT_UI, color: '#475569' });
    if (teacher) lines.push({ text: teacher, font: '500 10.5px ' + FONT_UI, color: '#475569' });
    if (course && Number(course.credits)) lines.push({ text: formatCredits(course.credits) + ' cr', font: '700 10.5px ' + FONT_UI, color: '#1d4ed8' });
    if (m.startDate && m.endDate) lines.push({ text: m.startDate.slice(5) + '–' + m.endDate.slice(5), font: '600 10px ' + FONT_UI, color: '#9a5b13' });
    const maxW = slotW - 26;
    for (const ln of lines){
      ctx.font = ln.font;
      ctx.fillStyle = ln.color;
      ctx.fillText(ellipsizeText(ctx, ln.text, maxW), tx, lineY);
      lineY += LINE_H;
    }
    ctx.restore();
  });

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'timetable-' + new Date().toISOString().slice(0, 10) + '.png';
  a.click();
  return true;
}
export function Timetable({ schedule, coursesById, drag, hover, gridRef, onDragOver, onDragLeave, onDrop, onRemoveEntry, crossDrag, onToggleCrossDrag, onDragBlock, blockedPeriods, onAddBlocked, onRemoveBlocked, containsSlots, onRemoveContains, onSetContains, onSwitchSection }){
  const rows = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) rows.push(h);
  const [tip, setTip] = React.useState(null);
  const [sel, setSel] = React.useState(null);
  const [ctxMenu, setCtxMenu] = React.useState(null);
  const selRef = React.useRef(null);
  const ctxRef = React.useRef(null);
  const rightSelAtRef = React.useRef(0);
  const creditSum = React.useMemo(() => scheduleCreditSummary(schedule, coursesById), [schedule, coursesById]);
  const creditTitle = [
    creditSum.sis.rows.length ? 'SIS / courses.json:\n' + creditSum.sis.rows.map(r => r.code + ' · ' + formatCredits(r.credits) + ' cr').join('\n') : '',
    creditSum.klms.rows.length ? 'KLMS / courses_klms.json:\n' + creditSum.klms.rows.map(r => r.code + ' · ' + formatCredits(r.credits) + ' cr').join('\n') : ''
  ].filter(Boolean).join('\n\n') || 'No courses in timetable';
  const conflictMap = React.useMemo(() => {
    const m = new Map();
    schedule.forEach((en, i) => m.set(en.section, findConflicts(en.meetings, schedule.filter((e, j) => j !== i))));
    return m;
  }, [schedule]);
  const displayMeetings = React.useMemo(() => {
    const map = new Map();
    schedule.forEach((en, ei) => {
      const seen = new Map();
      for (const m of (en.meetings || [])){
        const k = m.day + '|' + m.start + '|' + m.end;
        const prev = seen.get(k);
        if (prev){
          if (m.startDate && (!prev.startDate || m.startDate < prev.startDate)) prev.startDate = m.startDate;
          if (m.endDate && (!prev.endDate || m.endDate > prev.endDate)) prev.endDate = m.endDate;
          for (const i of (m.instructors || [])){
            if (!prev.instructors.some(x => x.name === i.name)) prev.instructors.push(i);
          }
          prev.teacher = prev.instructors.map(x => x.name).join('; ');
        } else {
          seen.set(k, Object.assign({}, m, { instructors: (m.instructors || []).slice() }));
        }
      }
      map.set(en.section, Array.from(seen.values()));
    });
    return map;
  }, [schedule]);
  const laneInfo = React.useMemo(() => {
    const items = [];
    schedule.forEach((en, ei) => {
      (displayMeetings.get(en.section) || []).forEach((m, mi) => items.push({ en: en, m: m, ei: ei, mi: mi }));
    });
    const byDay = {};
    items.forEach(it => { (byDay[it.m.day] || (byDay[it.m.day] = [])).push(it); });
    const map = {};
    Object.keys(byDay).forEach(d => {
      const list = byDay[d];
      const used = list.map(() => false);
      for (let i = 0; i < list.length; i++){
        if (used[i]) continue;
        const stack = [i]; used[i] = true; const group = [];
        while (stack.length){
          const u = stack.pop(); group.push(list[u]);
          for (let v = 0; v < list.length; v++){
            if (!used[v] && meetingsOverlap(list[u].m, list[v].m)){ used[v] = true; stack.push(v); }
          }
        }
        group.sort((a, b) => String(a.en.course).localeCompare(String(b.en.course)) || String(a.en.section).localeCompare(String(b.en.section)) || a.m.start - b.m.start || a.ei - b.ei || a.mi - b.mi);
        group.forEach((it, idx) => { it.lane = idx; it.lanes = group.length; });
      }
    });
    items.forEach(it => { map[it.en.section + '|' + it.m.day + '|' + it.m.start + '|' + it.m.end] = { lane: it.lane, lanes: it.lanes }; });
    return map;
  }, [schedule, displayMeetings]);
  let hint = crossDrag
    ? 'Cross-section drag on — drop onto any official section time · Right-click a class to switch section · Left-drag empty grid = block time · Right-drag = filter plans'
    : 'Drag a section onto the grid — it stays at its official class time · Right-click a class to switch section · Left-drag empty grid = block time · Right-drag = filter plans';
  let hintBad = false;
  if (drag){
    const hasBlocked = !!(hover && hover.conflicts && hover.conflicts.some(c => c.type === 'blocked'));
    if (hover && hover.active){
      if (hover.conflicts && hover.conflicts.length){ hint = hover.active.label + ' · ' + (hasBlocked ? 'overlaps a blocked period' : hover.conflicts.length + ' conflict(s)') + ' — release still switches to this section'; hintBad = true; }
      else hint = hover.active.label + ' · no conflicts — release to use this section';
    } else if (hover && hover.meetings){
      if (hover.conflicts && hover.conflicts.some(c => c.type === 'duplicate')) { hint = 'Already in the timetable'; hintBad = true; }
      else if (hover.conflicts && hover.conflicts.length){ hint = (hasBlocked ? 'Overlaps a blocked period' : hover.conflicts.length + ' conflict(s)') + ' — releasing will still add it'; hintBad = true; }
      else hint = 'Official time · no conflicts — release to add';
    } else hint = drag.mode === 'cross' ? 'Hover an outlined section time to switch' : 'Move over the grid to preview official meeting times…';
  }
  function showTip(e, en, m, conf){
    if (drag || selRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const width = 280;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const top = (r.bottom + 8 + 170 > window.innerHeight) ? Math.max(8, r.top - 178) : r.bottom + 8;
    setTip({ left: left, top: top, en: en, m: m, course: coursesById[en.course], conf: conf });
  }
  function startBoxSelect(e){
    const el = gridRef.current;
    if (!el || !pointerOverCalendar(e, el)) return;
    const cell = pointerCellClamped(e, el);
    if (!cell) return;
    const kind = e.button === 2 ? 'contains' : 'block';
    const ref: any = { kind: kind, start: cell, cur: cell, moved: false, sx: e.clientX, sy: e.clientY, el: el };
    selRef.current = ref;
    setSel({ kind: kind, ranges: [] });
    function onMove(ev){
      const s = selRef.current;
      if (!s) return;
      if (!s.moved && Math.abs(ev.clientX - s.sx) + Math.abs(ev.clientY - s.sy) < 5) return;
      const c = pointerCellClamped(ev, s.el);
      if (!c) return;
      s.moved = true;
      s.cur = c;
      setSel({ kind: s.kind, ranges: boxRanges(s.start, c) });
    }
    function onUp(){
      const s = selRef.current;
      selRef.current = null;
      setSel(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (!s || !s.moved) return;
      const ranges = boxRanges(s.start, s.cur);
      if (!ranges.length) return;
      if (s.kind === 'contains') rightSelAtRef.current = Date.now();
      if (s.kind === 'block') onAddBlocked(ranges);
      else onSetContains(ranges);
    }
    ref.onMove = onMove;
    ref.onUp = onUp;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
  function cancelBoxSelect(){
    const s = selRef.current;
    if (!s) return;
    selRef.current = null;
    setSel(null);
    document.removeEventListener('mousemove', s.onMove);
    document.removeEventListener('mouseup', s.onUp);
  }
  function openCtx(e, en, m){
    e.preventDefault();
    e.stopPropagation();
    if (drag) return;
    if (Date.now() - rightSelAtRef.current < 400) return;
    setTip(null);
    const course = coursesById[en.course];
    if (!course) return;
    const day = m.day;
    const alts = (course.sections || []).filter(s => s.id !== en.section && (s.meetings || []).some(mt => mt.day === day && mt.start < m.end && m.start < mt.end));
    const w = 340, maxH = Math.min(520, window.innerHeight - 16), hh = Math.min(96 + alts.length * 56, maxH);
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - w - 8));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - hh - 8));
    setCtxMenu({ x: x, y: y, en: en, m: m, alts: alts });
  }
  React.useEffect(() => {
    function onKey(e){
      if (e.key === 'Escape'){ cancelBoxSelect(); setCtxMenu(null); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  React.useEffect(() => {
    if (!ctxMenu) return;
    function onDoc(e){
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [ctxMenu]);
  React.useEffect(() => {
    if (tip && !schedule.some(en => en.section === tip.en.section)) setTip(null);
  }, [schedule, tip]);
  const ghosts = drag && drag.mode === 'cross' ? (drag.targets || []) : [];
  return (
    <div className="cal-wrap">
      <div className="cal-head">
        <div className="cal-title">Timetable</div>
        <div className="cal-credits" title={creditTitle}>
          {formatCredits(creditSum.sis.total)} cr
          {creditSum.klms.courses ? <small>+ {formatCredits(creditSum.klms.total)} cr KLMS</small> : null}
          <small>{creditSum.courses} course{creditSum.courses === 1 ? '' : 's'}</small>
        </div>
        <button className="cal-export" type="button" onClick={() => exportTimetableImage(schedule, coursesById)} disabled={!schedule.length} title="Download the timetable as a PNG image with full course details" aria-label="Export timetable image"><DownloadIcon size={15} /></button>
        <label className="xdrag" title="Drag a course from search or the grid onto any of its official section times">
          <input type="checkbox" checked={!!crossDrag} onChange={(e) => onToggleCrossDrag(e.target.checked)} />
          Enable cross-section dragging
        </label>
        <div className={'cal-hint' + (hintBad ? ' bad' : '')}>{hint}</div>
        <div className="cal-legend">
          <span className="lg"><i style={{ background: 'hsla(210,78%,52%,.25)', border: '2px dashed hsl(210,72%,40%)' }}></i>section colors</span>
          <span className="lg"><i style={{ background: 'repeating-linear-gradient(135deg, hsla(210,78%,52%,.2) 0 6px, hsla(0,82%,52%,.2) 6px 12px)', border: '2px dashed #e02424' }}></i>conflict</span>
          <span className="lg"><i style={{ background: 'repeating-linear-gradient(135deg, rgba(220,38,38,.10) 0 6px, rgba(220,38,38,.22) 6px 12px)', border: '1.5px dashed #b91c1c' }}></i>blocked</span>
          <span className="lg"><i style={{ background: 'repeating-linear-gradient(135deg, rgba(36,86,230,.08) 0 6px, rgba(36,86,230,.16) 6px 12px)', border: '1.5px dashed #1d4ed8' }}></i>filter</span>
        </div>
      </div>
      <div className={'cal' + (sel ? ' cal-selecting' : '')} ref={gridRef}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        onMouseDown={(e) => {
          if (drag) return;
          if (e.button !== 0 && e.button !== 2) return;
          const t = e.target as HTMLElement;
          if (t && t.closest && t.closest('.cal-block, .cal-blocked, .cal-contains, .cal-ghost, .cal-preview, .cal-dayhead, .cal-time, .cal-corner, button')) return;
          e.preventDefault();
          startBoxSelect(e);
        }}
        onContextMenu={(e) => { e.preventDefault(); }}>
        <div className="cal-corner"></div>
        {DAY_LABELS.map((d, i) => <div key={d} className="cal-dayhead" style={{ gridRow: 1, gridColumn: i + 2 }}>{d}</div>)}
        {rows.map(h => (
          <React.Fragment key={h}>
            <div className="cal-time" style={{ gridRow: h - START_HOUR + 2, gridColumn: 1 }}>{String(h).padStart(2, '0')}:00</div>
            <div className="cal-line" style={{ gridRow: h - START_HOUR + 2, gridColumn: '2 / -1' }}></div>
          </React.Fragment>
        ))}
        {DAY_LABELS.map((d, i) => (
          <div key={'col' + d} className={'cal-col' + (drag && hover && hover.meetings && hover.meetings.some(m => m.day === i + 1) ? ' cal-col-hover' : '')} style={{ gridRow: '2 / -1', gridColumn: i + 2 }}></div>
        ))}
        {(blockedPeriods || []).map(b => (
          <div key={b.id} className="cal-blocked"
            title={'Blocked ' + DAY_NAMES[b.day] + ' ' + fmtDec(b.start) + '–' + fmtDec(b.end) + ' — click to remove'}
            onClick={() => onRemoveBlocked(b.id)}
            style={{ gridColumn: b.day + 1, top: (b.start - START_HOUR) * HOUR_H + 4, height: Math.max(10, (b.end - b.start) * HOUR_H - 8) }}>
            <span>blocked</span>
          </div>
        ))}
        {(containsSlots || []).map(c => (
          <div key={c.id} className="cal-contains"
            title={'Filter: plans must include classes ' + DAY_NAMES[c.day] + ' ' + fmtDec(c.start) + '–' + fmtDec(c.end) + ' — click to remove'}
            onClick={() => onRemoveContains(c.id)}
            style={{ gridColumn: c.day + 1, top: (c.start - START_HOUR) * HOUR_H + 4, height: Math.max(10, (c.end - c.start) * HOUR_H - 8) }}>
            <span>filter</span>
          </div>
        ))}
        {schedule.map(en => (displayMeetings.get(en.section) || en.meetings).map(m => {
          const col = courseColor(en.course);
          const conf = conflictMap.get(en.section) || [];
          const dim = !!(drag && drag.course === en.course);
          const lm = laneInfo[en.section + '|' + m.day + '|' + m.start + '|' + m.end] || { lane: 0, lanes: 1 };
          const lanes = Math.max(1, lm.lanes || 1);
          const lane = Math.min(Math.max(0, lm.lane || 0), lanes - 1);
          return (
            <div key={en.section + '-' + m.day + '-' + m.start}
              className={'cal-block' + (conf.length ? ' cal-block-conf' : '') + (crossDrag ? ' movable' : '') + (dim ? ' dim' : '')}
              draggable={!!crossDrag}
              onMouseDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => openCtx(e, en, m)}
              onDragStart={(e) => {
                const t2 = e.target as HTMLElement;
                if (t2 && t2.closest && t2.closest('button')){ e.preventDefault(); return; }
                setTip(null); if (onDragBlock) onDragBlock(e, en);
              }}
              onMouseEnter={(e) => showTip(e, en, m, conf)}
              onMouseLeave={() => setTip(null)}
              style={{ gridColumn: m.day + 1, top: (m.start - START_HOUR) * HOUR_H + 4, height: (m.end - m.start) * HOUR_H - 8, left: 'calc(' + (lane / lanes) * 100 + '% + 2px)', width: 'calc(' + 100 / lanes + '% - 4px)', margin: 0, background: col.bg, borderLeftColor: col.border }}>
              <div className="cal-block-code" style={{ color: col.text }}>{en.course} <span className="cal-block-sec">{en.label}</span></div>
              <div className="cal-block-room">{m.room || 'TBA'}</div>
              {conf.length ? <div className="cal-block-warn">⚠</div> : null}
              <button className="cal-block-x" title="Remove from timetable" aria-label="Remove from timetable" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTip(null); onRemoveEntry(en.section); }}><CloseIcon size={10} /></button>
            </div>
          );
        }))}
        {layoutGhostOverlays(ghosts).map(it => {
          const t = it.t, m = it.m;
          const active = !!(hover && hover.active && hover.active.label === t.label);
          const bad = t.conflicts.length > 0;
          const tint = t.tint || sectionTint(it.ti);
          const fill = bad
            ? 'repeating-linear-gradient(135deg, ' + tint.bg + ' 0 7px, hsla(0,82%,52%,.20) 7px 14px)'
            : (active ? tint.bgOn : tint.bg);
          const box = ghostSliceBox(it, 0, HOUR_H);
          return (
            <div key={'g' + it.ti + '-' + it.mi + '-' + m.day + '-' + m.start}
              className={'cal-ghost' + (active ? ' on' : '')}
              style={{ gridColumn: m.day + 1, top: box.top, height: box.height, left: 'calc(' + box.leftPct + '% + 2px)', width: 'calc(' + box.widthPct + '% - 4px)', background: fill, borderColor: bad ? '#e02424' : tint.border, color: tint.text }}>
              {t.label}{bad ? ' ⚠' : ''}
            </div>
          );
        })}
        {drag && drag.mode !== 'cross' && hover && hover.meetings ? hover.meetings.map((m, i) => {
          const bad = hover.conflicts.length > 0;
          return (
            <div key={'prev' + i} className={'cal-preview' + (bad ? ' cal-preview-bad' : '')}
              style={{ gridColumn: m.day + 1, top: (m.start - START_HOUR) * HOUR_H + 4, height: (m.end - m.start) * HOUR_H - 8 }}>
              {drag.label + (bad ? ' ⚠' + conflictCount(hover.conflicts) : '')}
            </div>
          );
        }) : null}
        {sel && sel.ranges.length ? sel.ranges.map((r, i) => (
          <div key={'sel' + i} className={'cal-sel ' + (sel.kind === 'block' ? 'block' : 'contains')}
            style={{ gridColumn: r.day + 1, top: (r.start - START_HOUR) * HOUR_H + 4, height: Math.max(10, (r.end - r.start) * HOUR_H - 8) }}>
            {sel.kind === 'block' ? 'BLOCKED' : 'FILTER'}
          </div>
        )) : null}
      </div>
      {!drag ? <CalBlockTip tip={tip} /> : null}
      {ctxMenu ? (
        <div className="cal-ctx" ref={ctxRef} style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <div className="cal-ctx-head">
            {ctxMenu.en.course} {ctxMenu.en.label} · {DAY_NAMES[ctxMenu.m.day]} {fmtRange(ctxMenu.m)}<br />Other sections at the same time
          </div>
          {ctxMenu.alts.length ? ctxMenu.alts.map(alt => {
            const same = (alt.meetings || []).filter(mt => mt.day === ctxMenu.m.day && mt.start < ctxMenu.m.end && ctxMenu.m.start < mt.end);
            return (
              <button key={alt.id} className="cal-ctx-item" onClick={() => { onSwitchSection(ctxMenu.en.course, alt); setCtxMenu(null); }}>
                <b>{alt.label}</b>
                <span>{(alt.componentName ? alt.componentName + ' · ' : '') + same.map(mt => DAY_NAMES[mt.day] + ' ' + fmtRange(mt) + (mt.room ? ' · ' + mt.room : '')).join(' / ')}{alt.meetings.length > same.length ? ' · +' + (alt.meetings.length - same.length) + ' more' : ''}</span>
              </button>
            );
          }) : <div className="cal-ctx-none">No other section of this course meets at this time.</div>}
        </div>
      ) : null}
    </div>
  );
}
