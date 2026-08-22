// Layout for the dependency AST.

/* ================= graph layout for dependency AST ================= */
export function buildGraphData(courseCode, courseName, ast, names){
  const nodes = [], edges = [];
  let seq = 0;
  const addNode = (type, data, pos) => { const id = 'n' + (++seq); nodes.push({ id: id, type: type, data: data, position: pos }); return id; };
  const addEdge = (s, t) => edges.push({ id: 'e' + (++seq), source: s, target: t });

  const XS = 190, YS = 140, shiftY = 90;
  const astPos = new Map();
  const leaves = [];
  (function collect(n){
    if (n.children && n.children.length) n.children.forEach(collect);
    else leaves.push(n);
  })(ast);
  const depthOf = new Map();
  (function setDepth(n, d){ depthOf.set(n, d); if (n.children) n.children.forEach(c => setDepth(c, d + 1)); })(ast, 1);
  leaves.forEach((n, i) => astPos.set(n, { x: i * XS, y: depthOf.get(n) * YS + shiftY }));
  (function place(n){
    if (n.children && n.children.length){
      n.children.forEach(place);
      const xs = n.children.map(c => astPos.get(c).x);
      astPos.set(n, { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, y: depthOf.get(n) * YS + shiftY });
    }
  })(ast);

  const totalW = Math.max(1, leaves.length) * XS;
  const rootId = addNode('course', { label: courseCode, code: courseCode, name: courseName || '' }, { x: totalW / 2 - XS / 2, y: 0 });
  const idOf = new Map();
  (function build(n){
    if (idOf.has(n)) return idOf.get(n);
    let id;
    if (n.kind === 'code') id = addNode('course', { label: n.label || n.code, code: n.code, name: names[n.code] || '' }, astPos.get(n));
    else if (n.kind === 'note') id = addNode('note', { label: n.label, code: null }, astPos.get(n));
    else id = addNode('op', { label: n.kind.toUpperCase() }, astPos.get(n));
    idOf.set(n, id);
    if (n.children) n.children.forEach(ch => addEdge(id, build(ch)));
    return id;
  })(ast);
  return { nodes: nodes, edges: edges };
}


