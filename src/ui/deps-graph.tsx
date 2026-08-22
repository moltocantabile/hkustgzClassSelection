import { buildGraphData } from '../deps/graph';
import { courseColor, truncate } from '../utils';

const RF = (window as any).ReactFlow || null;

/* ================= React Flow components ================= */
export function RFCourseNode({ data }){
  const col = data.code ? courseColor(data.code) : { bg: '#eef2ff', border: '#6366f1', text: '#3730a3' };
  return (
    <div className="rf-node rf-course" style={{ background: col.bg, borderColor: col.border, color: col.text }}
      title={(data.name || '') + '\nClick to jump to this course'}>
      <div className="rf-node-code">{data.label}</div>
      {data.name ? <div className="rf-node-name">{data.name}</div> : null}
      {RF ? <RF.Handle type="target" position={RF.Position.Top} /> : null}
      {RF ? <RF.Handle type="source" position={RF.Position.Bottom} /> : null}
    </div>
  );
}
export function RFOpNode({ data }){
  return <div className="rf-node rf-op">{data.label}</div>;
}
export function RFNoteNode({ data }){
  return <div className="rf-node rf-note" title={data.label}>{data.label}</div>;
}
export const NODE_TYPES = { course: RFCourseNode, op: RFOpNode, note: RFNoteNode };

export function DepGraph({ courseCode, courseName, ast, names, onJump }){
  const data = React.useMemo(() => buildGraphData(courseCode, courseName, ast, names), [courseCode, courseName, ast, names]);
  const [nodes, setNodes] = React.useState(data.nodes);
  const [edges] = React.useState(data.edges);
  React.useEffect(() => { setNodes(data.nodes); }, [data]);
  if (!RF){
    return <SimpleSvgTree data={data} onJump={onJump} />;
  }
  return (
    <div className="dep-canvas">
      <RF.ReactFlow
        key={courseCode}
        nodes={nodes} edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={(changes) => setNodes(ns => RF.applyNodeChanges(changes, ns))}
        onNodeClick={(ev, nd) => { if (nd.type === 'course' && nd.data.code) onJump(nd.data.code); }}
        fitView fitViewOptions={{ padding: 0.2 }}
        nodesConnectable={false}
        minZoom={0.15} maxZoom={2.5}
        proOptions={{ hideAttribution: false }}
      >
        <RF.Background gap={18} size={1} color="#e5e9f0" />
        <RF.Controls showInteractive={false} />
        <RF.MiniMap pannable zoomable nodeColor={(n) => n.type === 'course' ? courseColor(n.data.code || 'X').border : '#111827'} />
      </RF.ReactFlow>
    </div>
  );
}

export function SimpleSvgTree({ data, onJump }){
  const [view, setView] = React.useState({ x: 0, y: 0, k: 1 });
  const dragRef = React.useRef(null);
  const onPointerDown = (e) => { dragRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    setView(v => ({ ...v, x: dragRef.current.vx + e.clientX - dragRef.current.sx, y: dragRef.current.vy + e.clientY - dragRef.current.sy }));
  };
  const onPointerUp = () => { dragRef.current = null; };
  const onWheel = (e) => {
    e.preventDefault();
    setView(v => ({ ...v, k: Math.min(2.5, Math.max(0.3, v.k * (e.deltaY < 0 ? 1.12 : 0.89))) }));
  };
  if (!data.nodes.length){
    return <div className="dep-canvas"><div className="dep-note">Nothing to draw.</div></div>;
  }
  const xs = data.nodes.map(n => n.position.x), ys = data.nodes.map(n => n.position.y);
  const minX = Math.min.apply(null, xs) - 80, maxX = Math.max.apply(null, xs) + 220;
  const minY = Math.min.apply(null, ys) - 60, maxY = Math.max.apply(null, ys) + 110;
  const W = maxX - minX, H = maxY - minY;
  return (
    <div className="dep-canvas">
      <svg className="svg-tree" viewBox={minX + ' ' + minY + ' ' + W + ' ' + H}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onWheel={onWheel}
        style={{ cursor: 'grab' }}>
        <g transform={'translate(' + view.x + ' ' + view.y + ') scale(' + view.k + ')'}>
          {data.edges.map(e => {
            const s = data.nodes.find(n => n.id === e.source), t = data.nodes.find(n => n.id === e.target);
            if (!s || !t) return null;
            const x1 = s.position.x + 90, y1 = s.position.y + (s.type === 'course' ? 36 : 22);
            const x2 = t.position.x + 90, y2 = t.position.y;
            return <line key={e.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />;
          })}
          {data.nodes.map(n => {
            if (n.type === 'op'){
              return (
                <g key={n.id} transform={'translate(' + n.position.x + ' ' + n.position.y + ')'}>
                  <rect width="64" height="26" rx="13" fill="#111827" />
                  <text x="32" y="17" fontSize="11" fontWeight="800" fill="#fff" textAnchor="middle">{n.data.label}</text>
                </g>
              );
            }
            if (n.type === 'note'){
              return (
                <g key={n.id} transform={'translate(' + n.position.x + ' ' + n.position.y + ')'}>
                  <rect width="150" height="28" rx="8" fill="#fff8e8" stroke="#e9c46a" />
                  <text x="8" y="18" fontSize="10.5" fill="#7c5a10">{truncate(n.data.label, 20)}</text>
                </g>
              );
            }
            const col = courseColor(n.data.code || 'X');
            return (
              <g key={n.id} transform={'translate(' + n.position.x + ' ' + n.position.y + ')'} style={{ cursor: 'pointer' }}
                onClick={() => { if (n.data.code) onJump(n.data.code); }}>
                <rect width="180" height="42" rx="9" fill={col.bg} stroke={col.border} strokeWidth="1.3" />
                <text x="10" y="18" fontSize="12" fontWeight="800" fill={col.text}>{n.data.label}</text>
                {n.data.name ? <text x="10" y="32" fontSize="9.5" fill={col.text} opacity="0.85">{truncate(n.data.name, 24)}</text> : null}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="svg-zoom">
        <button onClick={() => setView(v => ({ ...v, k: Math.min(2.5, v.k * 1.15) }))} title="Zoom in">+</button>
        <button onClick={() => setView(v => ({ ...v, k: Math.max(0.3, v.k * 0.87) }))} title="Zoom out">−</button>
        <button onClick={() => setView({ x: 0, y: 0, k: 1 })} title="Reset">reset</button>
      </div>
    </div>
  );
}

