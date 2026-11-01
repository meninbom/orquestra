const { test } = require("node:test");
const assert = require("node:assert/strict");
const { outlineToBoard } = require("../.qa/ai-layout.cjs");
const { validBoard } = require("../.qa/model.cjs");
const { arrowGeometry, pointAlongPath, translateSelection } = require("../.qa/selection.cjs");
const rich = require("./rich-fixture.cjs");

const layouts = ["flow", "map", "presentation"];
const isNode = (item) => !["arrow", "frame", "pen", "file"].includes(item.type);
const overlaps = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
const inside = (point, box, margin) => point.x > box.x + margin && point.x < box.x + box.w - margin && point.y > box.y + margin && point.y < box.y + box.h - margin;
/** Straight connectors come back as two endpoints, so each segment is sampled before checking for crossings. */
const dense = (points) => points.flatMap((p, i) => (i === 0 ? [p] : Array.from({ length: 16 }, (_, k) => ({ x: points[i - 1].x + ((p.x - points[i - 1].x) * (k + 1)) / 16, y: points[i - 1].y + ((p.y - points[i - 1].y) * (k + 1)) / 16 }))));
const build = (layout, simplified = false) => outlineToBoard(rich, layout, 6, undefined, true, simplified);
const label = (layout, simplified) => `${layout}${simplified ? " simplificado" : ""}`;

test("cada layout compõe o mesmo roteiro rico de forma distinta", () => {
  const signatures = layouts.map((layout) => JSON.stringify(build(layout).scenes[0].items.filter(isNode).map((n) => [n.x, n.y, n.w, n.size])));
  assert.equal(new Set(signatures).size, 3);
  assert.ok(build("flow").scenes[0].items.some((item) => item.type === "frame"), "fluxo mantém as fases");
  assert.equal(build("presentation").scenes[0].items.some((item) => item.type === "frame"), false, "apresentação não usa fases");
  assert.equal(build("map").scenes[0].items.some((item) => item.type === "frame"), false, "mapa não usa fases");
});

test("apresentação mantém as etapas do roteiro com texto maior", () => {
  const nodes = build("presentation").scenes[0].items.filter(isNode);
  assert.deepEqual(nodes.map(n => n.step), rich.sections[0].nodes.map(n => n.step));
  assert.ok(nodes.every(n => n.size >= 26));
});

test("mapa posiciona o objeto mais conectado entre as colunas", () => {
  const items = build("map").scenes[0].items, nodes = items.filter(isNode), arrows = items.filter(i => i.type === "arrow");
  const degree = id => arrows.filter(a => a.from === id || a.to === id).length;
  const hub = nodes.reduce((best, node) => degree(node.id) > degree(best.id) ? node : best);
  assert.ok(hub.x > Math.min(...nodes.map(n => n.x)) && hub.x < Math.max(...nodes.map(n => n.x)));
});

test("nenhum layout sobrepõe objetos, com ou sem modo simplificado", () => {
  for (const layout of layouts) for (const simplified of [false, true]) {
    const nodes = build(layout, simplified).scenes[0].items.filter(isNode);
    for (const [i, a] of nodes.entries()) for (const b of nodes.slice(i + 1)) assert.equal(overlaps(a, b), false, `${label(layout, simplified)}: ${a.text} x ${b.text}`);
  }
});

test("conectores não atravessam objetos não relacionados", () => {
  for (const layout of layouts) for (const simplified of [false, true]) {
    const items = build(layout, simplified).scenes[0].items, nodes = items.filter(isNode);
    for (const arrow of items.filter((i) => i.type === "arrow")) {
      const sampled = dense(arrowGeometry(arrow, items).points).slice(1, -1);
      assert.equal(sampled.some((p) => p.y < 240), false, `${label(layout, simplified)}: conector "${arrow.text || "sem rótulo"}" invade o título da seção`);
      for (const node of nodes) {
        if (node.id === arrow.from || node.id === arrow.to) continue;
        const crosses = sampled.some((p) => inside(p, node, 4));
        assert.equal(crosses, false, `${label(layout, simplified)}: conector "${arrow.text || "sem rótulo"}" atravessa "${node.text}"`);
      }
    }
  }
});

test("simplificado conserva nós, rótulos, relações e etapas, reduzindo adornos", () => {
  const normal = build("flow").scenes[0].items, simple = build("flow", true).scenes[0].items;
  const nodes = simple.filter(isNode), arrows = simple.filter(i => i.type === "arrow");
  assert.equal(nodes.length, rich.sections[0].nodes.length);
  assert.equal(arrows.length, rich.sections[0].edges.length);
  assert.deepEqual(arrows.map(a => a.text), rich.sections[0].edges.map(e => e.label));
  assert.deepEqual(nodes.map(n => n.step), rich.sections[0].nodes.map(n => n.step));
  const byId = new Map(nodes.map((n, i) => [n.id, rich.sections[0].nodes[i].id]));
  assert.deepEqual(arrows.map(a => [byId.get(a.from), byId.get(a.to)]), rich.sections[0].edges.map(e => [e.from,e.to]));
  assert.ok(validBoard(build("flow", true)));
  assert.equal(simple.some(i => i.type === "frame" || i.type === "agent"), false);
  assert.ok(simple.every(i => i.animation === "none" && (!i.arrowMotion || i.arrowMotion === "none")));
  assert.ok(normal.some(i => i.type === "frame"));
});

test("textos extensos e referências PDF sobrevivem aos três layouts", () => {
  const data = structuredClone(rich); data.sections[0].nodes[0].text = 'Conteúdo extenso '.repeat(17).trim(); data.sections[0].pages = [3];
  for (const layout of layouts) {
    const scene = outlineToBoard(data, layout, 6, {id:'12345678-1234-1234-1234-123456789abc',name:'fonte.pdf',pages:[3]}, false).scenes[0];
    assert.ok(scene.items.some(i => i.text === data.sections[0].nodes[0].text));
    assert.ok(scene.items.some(i => i.type === 'file' && i.pdfPage === 3));
    assert.ok(scene.items.every(i => i.animation === 'none' && (!i.arrowMotion || i.arrowMotion === 'none')));
    assert.equal(scene.transition, 'cut');
  }
});


test("fluxo de 18 nós mantém conteúdo e evita nós não relacionados nos três layouts", () => {
  const data = structuredClone(rich), section = data.sections[0];
  section.groups = [];
  section.nodes = Array.from({length:18}, (_, i) => ({id:`n${i}`, text:`Etapa ${i}`, role:"action", group:"", emphasis:"normal", icon:"", step:i, animation:"none"}));
  section.edges = section.nodes.slice(1).map((node, i) => ({from:section.nodes[i].id,to:node.id,label:"",motion:"none"}));
  for (const layout of layouts) {
    const items = outlineToBoard(data, layout).scenes[0].items, nodes = items.filter(isNode);
    assert.equal(nodes.length, 18); assert.equal(items.filter(i=>i.type === "arrow").length, 17);
    for (const arrow of items.filter(i => i.type === "arrow")) for (const node of nodes.filter(n => n.id !== arrow.from && n.id !== arrow.to))
      assert.equal(dense(arrowGeometry(arrow,items).points).some(p => inside(p,node,4)), false, `${layout}: ${node.text}`);
  }
});


test("rótulos da fixture não cobrem cartões e portas sobrevivem ao movimento", () => {
  for (const layout of layouts) {
    const items = build(layout).scenes[0].items, nodes = items.filter(isNode);
    for (const arrow of items.filter(i => i.type === "arrow")) {
      if (arrow.text) {
        const p = pointAlongPath(arrowGeometry(arrow, items).points, arrow.arrowLabelPosition), width = arrow.text.length * 10;
        for (const n of nodes) assert.equal(p.x + width/2 > n.x && p.x - width/2 < n.x+n.w && p.y-22 < n.y+n.h && p.y+2 > n.y, false, `${layout}: ${arrow.text} / ${n.text}`);
      }
      const moved = translateSelection(items, [arrow.from], 30, 50), after = moved.find(i => i.id === arrow.id);
      assert.equal(after.fromPort, arrow.fromPort); assert.equal(after.toPort, arrow.toPort);
      assert.equal(after.arrowLabelPosition, arrow.arrowLabelPosition);
      assert.equal(after.from, arrow.from); assert.equal(after.to, arrow.to);
    }
  }
});


test("rótulos da fixture não se sobrepõem", () => {
  for (const layout of layouts) {
    const items = build(layout).scenes[0].items, boxes = [];
    for (const arrow of items.filter(i => i.type === "arrow" && i.text)) {
      const p = pointAlongPath(arrowGeometry(arrow,items).points, arrow.arrowLabelPosition), w = Math.max(20,arrow.text.length * 10);
      const box = {x:p.x-w/2,y:p.y-22,w,h:24};
      for (const prior of boxes) assert.equal(overlaps(box,prior),false,`${layout}: ${arrow.text}`);
      boxes.push(box);
    }
  }
});
