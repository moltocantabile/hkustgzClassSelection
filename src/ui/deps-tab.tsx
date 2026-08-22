import { parsePrereq, astString } from '../deps/parser';
import { cleanField, normCode } from '../utils';
import { DepGraph } from './deps-graph';

/* ================= dependency graph tab ================= */
export function DepsTab({ initialCode, courses, coursesById, catalogMap, names, onJump }){
  const [input, setInput] = React.useState(initialCode || '');
  const [code, setCode] = React.useState(normCode(initialCode || ''));
  const offered = new Set(courses.map(c => c.code));
  const course = code
    ? (coursesById[code] || (catalogMap[code] ? { code: code, name: catalogMap[code].crseTitle || '', prereq: cleanField(catalogMap[code].crsePrerequisite), coreq: cleanField(catalogMap[code].crseCorequisite) } : null))
    : null;
  const parse = React.useMemo(() => course ? parsePrereq(course.prereq) : null, [course]);
  function go(c){ setCode(normCode(c)); setInput(c); }
  return (
    <div>
      <div className="deps-controls">
        <input className="deps-input" list="deps-codes" value={input} spellCheck={false}
          placeholder="Course code, e.g. DSAA3073"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') go(input); }} />
        <datalist id="deps-codes">
          {courses.map(c => <option key={c.code} value={c.code} />)}
        </datalist>
        <button className="sbtn add" onClick={() => go(input)}>Load</button>
      </div>
      {!code ? (
        <div className="dep-canvas"><div className="dep-note">Enter a course code to see its prerequisite graph.</div></div>
      ) : !course ? (
        <div className="warn bad">Unknown course code "{code}" — not found in courses.json or data.json.</div>
      ) : (
        <div>
          <div className="deps-card">
            <div className="dc-title">{course.code}{course.name ? ' — ' + course.name : ''}</div>
            {offered.has(code) ? null : <div className="dc-sub">Catalog record only (not offered in the current term).</div>}
            {parse && parse.raw ? <div className="deps-raw">{parse.raw}</div> : null}
            {parse && parse.ok ? <div className="deps-summary">{astString(parse.node)}</div> : null}
            {parse && parse.approximate ? <div className="deps-ignored">⚠ Parsed approximately — the original text does not follow a strict boolean structure.</div> : null}
            {parse && parse.ignored.length ? <div className="deps-ignored">Non-course text ignored: {parse.ignored.join(' · ')}</div> : null}
            {course.coreq ? <div className="deps-card" style={{ marginTop: 8 }}><div className="dc-title">Corequisite</div><div className="deps-raw">{course.coreq}</div></div> : null}
          </div>
          {!parse || !parse.ok ? (
            <div className="dep-canvas"><div className="dep-note">
              {course.prereq
                ? 'This prerequisite is described in prose without parseable course codes.'
                : 'No prerequisite listed for this course.'}
            </div></div>
          ) : (
            <DepGraph key={'g' + code} courseCode={code} courseName={course.name} ast={parse.node} names={names} onJump={onJump} />
          )}
          <div className="deps-ignored" style={{ marginTop: 8 }}>Tip: click any course node to jump to its own dependency graph. Drag nodes / scroll to zoom.</div>
        </div>
      )}
    </div>
  );
}

