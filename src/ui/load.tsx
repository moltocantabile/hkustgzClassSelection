import { buildCatalog } from '../data/catalog';
import { mergeCourses, normalizeCourses, normalizeKlmsCourses } from '../data/normalizer';

/* ================= load screens ================= */
export function LoadScreen(){
  return (
    <div className="screen"><div className="screen-card">
      <div className="spinner"></div>
      <h2>Loading course data…</h2>
      <p>Loading from the course data API (fallback: courses.json / data.json in the same folder).</p>
    </div></div>
  );
}
export function ManualLoad({ onData }){
  const [files, setFiles] = React.useState({ courses: null, catalog: null, klms: null });
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const fileName = { courses: 'courses.json', catalog: 'data.json', klms: 'courses_klms.json' };
  function readFile(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => { try { resolve(JSON.parse(r.result as string)); } catch (ex){ reject(ex); } };
      r.onerror = () => reject(new Error('read failed'));
      r.readAsText(file);
    });
  }
  async function onPick(key, e){
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setErr('');
    try{
      const data = await readFile(f);
      setFiles(prev => ({ ...prev, [key]: data }));
    }catch(ex){
      setErr((fileName[key] || key) + ' is not valid JSON: ' + ex.message);
    }
  }
  async function load(){
    if (!files.courses || !files.catalog){ setErr('Please select courses.json and data.json. courses_klms.json is optional.'); return; }
    setBusy(true);
    try{
      const catalogMap = buildCatalog(files.catalog);
      const sis = normalizeCourses(files.courses, catalogMap);
      if (!sis.length) throw new Error('no courses could be parsed');
      const kl = files.klms ? normalizeKlmsCourses(files.klms, catalogMap) : [];
      onData({
        courses: mergeCourses(sis, kl),
        catalogMap: catalogMap,
        rawCourses: files.courses,
        rawCatalog: files.catalog,
        rawKlms: files.klms || []
      });
    }catch(ex){
      setErr('Could not parse data: ' + ex.message);
      setBusy(false);
    }
  }
  return (
    <div className="screen"><div className="screen-card">
      <h2>📚 HKUST SIS Course Planner</h2>
      <p>Could not auto-load JSON from this folder. Select <code>courses.json</code> and <code>data.json</code> below; <code>courses_klms.json</code> (PE / general education) is optional.</p>
      <div className="file-row">
        <label>courses.json</label>
        <input type="file" accept=".json,application/json" onChange={(e) => onPick('courses', e)} />
        <span className="fstate">{files.courses ? '✓ loaded' : ''}</span>
      </div>
      <div className="file-row">
        <label>courses_klms.json <span style={{ fontWeight: 400, color: '#5a6580' }}>(optional)</span></label>
        <input type="file" accept=".json,application/json" onChange={(e) => onPick('klms', e)} />
        <span className="fstate">{files.klms ? '✓ loaded' : ''}</span>
      </div>
      <div className="file-row">
        <label>data.json</label>
        <input type="file" accept=".json,application/json" onChange={(e) => onPick('catalog', e)} />
        <span className="fstate">{files.catalog ? '✓ loaded' : ''}</span>
      </div>
      {err ? <div className="warn bad" style={{ textAlign: 'left' }}>{err}</div> : null}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
        <button className="hbtn primary" onClick={load} disabled={busy}>{busy ? 'Loading…' : 'Load data'}</button>
        <button className="hbtn" onClick={() => window.location.reload()}>Try auto-load again</button>
      </div>
    </div></div>
  );
}
