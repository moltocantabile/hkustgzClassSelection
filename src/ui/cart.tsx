import { formatCredits, scheduleCreditSummary } from '../schedule/sections';
import { summaryOf } from '../utils';

/* ================= app shell ================= */
export function Toasts({ items }){
  return (
    <div className="toasts">
      {items.map(t => <div className="toast" key={t.id}>{t.msg}</div>)}
    </div>
  );
}
export function CartIcon(){
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="20" r="1.3" fill="currentColor" stroke="none"></circle>
      <circle cx="18" cy="20" r="1.3" fill="currentColor" stroke="none"></circle>
      <path d="M3 4h2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.7a1.6 1.6 0 0 0 1.6-1.3L21 8H7"></path>
    </svg>
  );
}
export function groupCart(schedule, coursesById){
  const map = {};
  (schedule || []).forEach(en => {
    if (!en || !en.course) return;
    if (!map[en.course]){
      const c = coursesById && coursesById[en.course];
      map[en.course] = { code: en.course, name: c ? c.name : '', credits: c ? (Number(c.credits) || 0) : 0, klms: !!(c && c.klms), entries: [] };
    }
    map[en.course].entries.push(en);
  });
  return Object.keys(map).sort().map(k => map[k]);
}
export function CartFab({ schedule, coursesById, open, onToggle, onClose, onOpenCourse, onRemoveSection, onRemoveCourse }){
  const wrapRef = React.useRef(null);
  const [cartTab, setCartTab] = React.useState('sis');
  const groups = React.useMemo(() => groupCart(schedule, coursesById), [schedule, coursesById]);
  const creditSum = React.useMemo(() => scheduleCreditSummary(schedule, coursesById), [schedule, coursesById]);
  const sisGroups = React.useMemo(() => groups.filter(g => !g.klms), [groups]);
  const klmsGroups = React.useMemo(() => groups.filter(g => g.klms), [groups]);
  const activeGroups = cartTab === 'klms' ? klmsGroups : sisGroups;
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  return (
    <div className="cart-wrap" ref={wrapRef}>
      {open ? (
        <div className="cart-panel">
          <div className="cart-head">
            <h3>Selected courses</h3>
            <span className="cart-cr">{formatCredits(creditSum.total)} cr</span>
            <button className="cart-close" onClick={onClose} title="Close">✕</button>
          </div>
          <div className="cart-tabs">
            <button type="button" className={cartTab === 'sis' ? 'on' : ''} onClick={() => setCartTab('sis')}>
              Courses · {sisGroups.length} · {formatCredits(creditSum.sis.total)} cr
            </button>
            <button type="button" className={cartTab === 'klms' ? 'on' : ''} onClick={() => setCartTab('klms')}>
              KLMS · {klmsGroups.length} · {formatCredits(creditSum.klms.total)} cr
            </button>
          </div>
          <div className="cart-list">
            {!activeGroups.length ? <div className="cart-empty">{cartTab === 'klms' ? 'No KLMS courses in the timetable yet.' : 'No courses in the timetable yet.'}</div> : null}
            {activeGroups.map(g => (
              <div className="cart-item" key={g.code}>
                <div className="cart-item-top">
                  <button className="cart-item-code" onClick={() => onOpenCourse(g.code)}>{g.code}</button>
                  <span className="cart-item-cr">{formatCredits(g.credits)} cr</span>
                  <button className="cart-item-rm" onClick={() => onRemoveCourse(g.code)}>Remove</button>
                </div>
                {g.name ? <div className="cart-item-name">{g.name}</div> : null}
                {g.entries.map(en => (
                  <div className="cart-sec" key={en.section}>
                    <b>{en.label}</b>
                    <span>{summaryOf(en.meetings)}</span>
                    <button className="cart-x" title="Remove section" onClick={() => onRemoveSection(en.section)}>✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <button className="cart-fab" onClick={onToggle} title="View selected courses" aria-label="Selected courses">
        <CartIcon />
        {groups.length ? <span className="cart-badge">{groups.length}</span> : null}
      </button>
    </div>
  );
}
