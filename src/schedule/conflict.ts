// Time / room / instructor conflict detection.
import type { Conflict, Entry, Meeting, TimeRange } from '../types';

/* ================= conflict engine ================= */
export function dateRangesDisjoint(a: Meeting, b: Meeting): boolean {
  if (!a || !b || !a.startDate || !a.endDate || !b.startDate || !b.endDate) return false;
  return a.endDate < b.startDate || b.endDate < a.startDate;
}
export function findConflicts(meetings: Meeting[], entries: Entry[]): Conflict[] {
  const res = [];
  for (const en of (entries || [])){
    for (const m1 of (meetings || [])){
      for (const m2 of (en.meetings || [])){
        if (m1.day !== m2.day) continue;
        if (!(m1.start < m2.end && m2.start < m1.end)) continue;
        if (dateRangesDisjoint(m1, m2)) continue;
        const other = en.course + ' ' + (en.label || '');
        res.push({ type: 'time', other: other });
        if (m1.room && m2.room && m1.room === m2.room) res.push({ type: 'room', other: other, room: m1.room });
        if (m1.teacher && m2.teacher && m1.teacher === m2.teacher) res.push({ type: 'instructor', other: other, teacher: m1.teacher });
      }
    }
  }
  return res;
}
export function conflictCount(conflicts: Conflict[]): number {
  return new Set(conflicts.map(c => c.type)).size;
}


export function meetingInRanges(m: Meeting, ranges: TimeRange[]): boolean {
  return (ranges || []).some(r => r && r.day === m.day && m.start < r.end && r.start < m.end);
}
export function meetingContains(m: Meeting, day: number, time: number): boolean {
  return m.day === day && m.start <= time && time < m.end;
}
