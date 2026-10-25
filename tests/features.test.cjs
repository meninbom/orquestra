const test = require("node:test");
const assert = require("node:assert/strict");
const { initialBoard, validBoard, uid, colors } = require("../.qa/model.cjs");
const { initialLibrary, makeProject, validLibrary, validSavedStyle } = require("../desktop/library.cjs");
const { itemsInArea, rectangle, translateSelection, copySelection } = require("../.qa/selection.cjs");
const { editableSelection, groupItems, itemSelection, setItemLocked, ungroupItems } = require("../.qa/groups.cjs");
const { alignItems, distributeItems, snapPoint } = require("../.qa/arrangement.cjs");
const { styleProperties, applySavedStyle } = require("../.qa/styles.cjs");
const { builtInTemplates, saveSceneAsTemplate, insertTemplateScene } = require("../.qa/templates.cjs");
const { makeProjectVersion, validProjectVersion, versionsToPrune } = require("../.qa/versions.cjs");
const { wrapItemText } = require("../.qa/textLayout.cjs");
const { StaticScene } = require("../.qa/static-scene.cjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const item = (id, type, x, y, w, h, extra = {}) => ({
  id, type, x, y, w, h, text: "Texto", color: "#8fe3b5", textColor: "#e2e9e2", fill: "transparent", size: 24,
  step: 0, animation: "fade", ...extra,
});

test("alignment and distribution treat shape, text and media bounds as geometry", () => {
  const items = [item("shape", "rect", 10, 20, 100, 40), item("text", "text", 180, 80, 120, 35), item("media", "image", 440, 10, 80, 90)];
  const left = alignItems(items, ["shape", "text", "media"], "left");
  assert.deepEqual(left.map((entry) => entry.x), [10, 10, 10]);
  const centered = alignItems(items, ["shape", "text", "media"], "center-y");
  assert.deepEqual(centered.map((entry) => entry.y + entry.h / 2), [62.5, 62.5, 62.5]);
  const distributed = distributeItems(items, ["shape", "text", "media"], "horizontal");
  assert.equal(distributed[0].x, items[0].x);
  assert.equal(distributed[2].x, items[2].x);
  const gaps = [distributed[1].x - (distributed[0].x + distributed[0].w), distributed[2].x - (distributed[1].x + distributed[1].w)];
  assert.ok(Math.abs(gaps[0] - gaps[1]) < 0.001);
  assert.deepEqual(items.map((entry) => entry.x), [10, 180, 440]);
});

test("arranging a connector by itself detaches external endpoints and changes its rendered geometry", () => {
  const items = [
    item("from", "rect", 100, 100, 50, 50),
    item("to", "rect", 260, 100, 50, 50),
    item("edge", "arrow", 0, 0, 0, 0, { from: "from", to: "to" }),
    item("target", "rect", 0, 350, 80, 50),
  ];
  const arranged = alignItems(items, ["edge", "target"], "left");
  const edge = arranged.find((entry) => entry.id === "edge");
  assert.equal(edge.from, undefined);
  assert.equal(edge.to, undefined);
  assert.notDeepEqual([edge.x, edge.y, edge.w, edge.h], [0, 0, 0, 0]);
  assert.equal(arranged.find((entry) => entry.id === "target").x, 0);
});

test("snap tolerance scales with zoom; visible locked objects guide, hidden objects do not", () => {
  const items = [item("move", "rect", 100, 20, 20, 20), item("guide", "rect", 124, 20, 20, 20, { locked: true }), item("hidden", "rect", 124, 200, 20, 20, { hidden: true })];
  const atHalf = snapPoint(items, ["move"], 22, 0, 0.5, false, true);
  assert.equal(atHalf.dx, 24);
  assert.ok(atHalf.guides.some((guide) => guide.axis === "x" && guide.position === 124));
  const atHighZoom = snapPoint(items, ["move"], 22, 0, 4, false, true);
  assert.equal(atHighZoom.dx, 22);
  const grid = snapPoint(items, ["move"], 18, 0, 1, true, false, 20);
  assert.equal(grid.dx, 20);
});

test("agent wrapping measures every rendered row at its actual size and splits long words", () => {
  const calls = [];
  const wrappedItem = item("wrap", "agent", 0, 0, 150, 80, { size: 20, text: "AAAA BBBB CCCC DDDD\nEEEEEEEEEEEE" });
  const lines = wrapItemText(wrappedItem, (text, font) => {
    const size = Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1]);
    calls.push({ text, size });
    return [...text].length * size * 0.5;
  }, "sans-serif");
  assert.deepEqual(lines.slice(0, 4), ["AAAA", "BBBB", "CCCC", "DDDD"]);
  assert.ok(lines.slice(4).length > 1, "an overlong unbroken word wraps instead of overflowing");
  assert.ok(calls.some((call) => call.text === "BBBB CCCC" && Math.abs(call.size - 14.4) < 0.001), "the subtitle rows are measured with their rendered 72% font size");
});

test("static board renderer keeps centered text, named agent symbols, flags, custom arrow colors and formatting", () => {
  const scene = {
    id: "scene-static", name: "PDF QA", description: "Título", subtitle: "Subtítulo", duration: 6,
    items: [
      item("agent-static", "agent", 100, 200, 300, 110, { text: "Pesquisador\nResumo longo", textAlign: "center", color: "#ff0033", textColor: "#00ddaa", bold: true, italic: true, lineHeight: 1.5 }),
      item("rect-static", "rect", 500, 200, 140, 90, { text: "Marcador", color: colors[1] }),
      item("arrow-static", "arrow", 0, 0, 0, 0, { from: "agent-static", to: "rect-static", color: "#ff0033", arrowStyle: "dotted" }),
      item("text-static", "text", 700, 200, 200, 70, { text: "Centro", textAlign: "center", color: colors[2] }),
      item("hidden-static", "rect", 20, 20, 80, 50, { text: "Não exportar", hidden: true }),
    ],
  };
  const markup = renderToStaticMarkup(React.createElement(StaticScene, { scene, index: 0, light: false, images: {}, embeddedFonts: "" }));
  assert.match(markup, /<text x="275"[^>]*text-anchor="middle"[^>]*fill="#00ddaa"[^>]*font-weight="700"[^>]*font-style="italic"/);
  assert.match(markup, /<text x="800"[^>]*text-anchor="middle"/);
  assert.match(markup, /M0 32V0c13-7 18 8 31 0v21c-13 8-18-7-31 0/);
  assert.match(markup, /m20 20 10 10/);
  assert.match(markup, /stroke-dasharray="1 6"/);
  assert.match(markup, /id="arrow-23-66-66-30-30-33-33"/);
  assert.match(markup, /marker-end="url\(#arrow-23-66-66-30-30-33-33\)"/);
  assert.doesNotMatch(markup, /Não exportar/);
});

test("frame titles render above the border in static exports and connected arrows use shared geometry", () => {
  const frame = item("frame-title", "frame", 80, 140, 260, 180, {
    text: "Plano de ação", size: 18, color: "#4a99d2", textColor: "#efefef", bold: true,
  });
  const a = item("from-title", "rect", 400, 160, 100, 60);
  const b = item("to-title", "ellipse", 650, 160, 120, 80);
  const edge = item("edge-title", "arrow", 0, 0, 0, 0, {
    from: a.id, to: b.id, fromPort: "east", toPort: "west", color: "#ff0033",
  });
  const scene = {
    id: "scene-frame-title", name: "Exportação", description: "", duration: 6,
    items: [frame, a, b, edge],
  };
  const markup = renderToStaticMarkup(React.createElement(StaticScene, {
    scene, index: 0, light: false, images: {}, embeddedFonts: "",
  }));
  assert.match(markup, /data-frame-title="true"/);
  assert.match(markup, /Plano de ação/);
  assert.doesNotMatch(markup, /<text[^>]*x="210"[^>]*y="230"[^>]*>Plano de ação/);
  assert.match(markup, /M 500 190 C/);
  assert.match(markup, / 650 200/);
});

test("connector ports remain optional for legacy boards and reject invalid or non-arrow fields", () => {
  const board = initialBoard();
  const scene = board.scenes[0];
  const arrow = item("edge-port", "arrow", 20, 20, 100, 50, {
    fromPort: "east", toPort: "north",
  });
  assert.equal(validBoard({ ...board, scenes: [{ ...scene, items: [arrow] }] }), true);
  assert.equal(validBoard({ ...board, scenes: [{ ...scene, items: [item("legacy-edge", "arrow", 20, 20, 100, 50)] }] }), true);
  assert.equal(validBoard({ ...board, scenes: [{ ...scene, items: [item("bad-port", "arrow", 20, 20, 100, 50, { fromPort: "center" })] }] }), false);
  assert.equal(validBoard({ ...board, scenes: [{ ...scene, items: [item("wrong-port-type", "rect", 20, 20, 100, 50, { fromPort: "east" })] }] }), false);
});

test("persistent groups select and copy as a unit, remap item/group/connector IDs, and respect locks", () => {
  const source = [
    item("a", "rect", 20, 30, 80, 50),
    item("b", "image", 250, 40, 90, 70, { assetId: uid(), assetName: "foto.png", assetMime: "image/png" }),
    item("edge", "arrow", 0, 0, 0, 0, { from: "a", to: "b" }),
    item("solo", "text", 500, 50, 80, 35),
  ];
  const grouped = groupItems(source, ["a", "b"]);
  assert.equal(grouped[0].groupId, grouped[1].groupId);
  assert.deepEqual(itemSelection(grouped, "a"), ["a", "b"]);
  assert.equal(validBoard({ ...initialBoard(), scenes: [{ ...initialBoard().scenes[0], items: grouped }] }), true);
  const copies = copySelection(grouped, ["a"]);
  assert.equal(copies.length, 3, "both members and their internal connector are copied");
  assert.notEqual(copies[0].id, "a");
  assert.equal(copies[0].groupId, copies[1].groupId);
  assert.notEqual(copies[0].groupId, grouped[0].groupId);
  const copiedEdge = copies.find((entry) => entry.type === "arrow");
  assert.deepEqual([copiedEdge.from, copiedEdge.to], [copies[0].id, copies[1].id]);
  const locked = setItemLocked(grouped, ["a"], true);
  assert.equal(locked[0].locked, true);
  assert.equal(locked[1].locked, true);
  assert.deepEqual(editableSelection(locked, ["a"]), []);
  assert.deepEqual(translateSelection(locked, ["a"], 100, 100).slice(0, 2), locked.slice(0, 2));
  assert.deepEqual(copySelection(locked, ["b"]), []);
  assert.deepEqual(groupItems(locked, ["a", "solo"]), locked, "grouping cannot pull a locked object through a mixed selection");
  assert.deepEqual(ungroupItems(locked, ["a"]), locked);
  const unlocked = setItemLocked(locked, ["a"], false);
  assert.ok(ungroupItems(unlocked, ["a"]).slice(0, 2).every((entry) => !entry.groupId));
  const hiddenGroup = grouped.map((entry) => entry.id === "b" ? { ...entry, hidden: true } : entry);
  assert.deepEqual(editableSelection(hiddenGroup, ["a"]), [], "a hidden group member blocks edits through its visible peer");
  assert.deepEqual(itemSelection(hiddenGroup, "a"), ["a"], "hidden members stay out of canvas selection");
  assert.deepEqual(copySelection(hiddenGroup, ["a"]), []);
});

test("hidden items are absent from area selection, and board-level optional fields validate legacy data", () => {
  const legacy = initialBoard();
  assert.equal(validBoard(legacy), true);
  const items = [item("shown", "rect", 0, 0, 30, 30), item("hidden", "rect", 50, 0, 30, 30, { hidden: true })];
  assert.deepEqual(itemsInArea(items, rectangle({ x: -1, y: -1 }, { x: 100, y: 40 })), ["shown"]);
  assert.equal(validBoard({ ...legacy, settings: { snapToGrid: true, gridSize: 24, alignmentGuides: false } }), true);
  assert.equal(validBoard({ ...legacy, settings: { gridSize: 0 } }), false);
  assert.equal(validBoard({ ...legacy, scenes: [{ ...legacy.scenes[0], items: [item("x", "rect", 0, 0, 20, 20, { bold: "yes" })] }] }), false);
});

test("saved styles contain appearance only and apply compatible fields without changing content or geometry", () => {
  const source = item("source", "rect", 1, 2, 100, 70, { bold: true, italic: true, textAlign: "right", lineHeight: 1.4, fillOpacity: 0.6 });
  const style = { id: uid(), name: "Destaque", properties: styleProperties(source) };
  const library = initialLibrary();
  library.projects[0].styles = [style];
  assert.equal(validLibrary(library), true);
  assert.equal(validSavedStyle(style), true);
  const target = item("target", "text", 40, 60, 240, 90, { text: "Manter este conteúdo" });
  const applied = applySavedStyle(target, style);
  assert.equal(applied.text, target.text);
  assert.deepEqual([applied.x, applied.y, applied.w, applied.h, applied.id], [40, 60, 240, 90, "target"]);
  assert.equal(applied.color, source.color);
  assert.equal(applied.textColor, source.textColor);
  const arrow = applySavedStyle(item("arrow", "arrow", 0, 0, 0, 0), style);
  assert.equal(arrow.text, "Texto");
  assert.equal(arrow.arrowStyle, undefined, "non-arrow style does not invent an arrow pattern");
});

test("four built-in section templates and saved custom templates clone identity and connector links safely", () => {
  const builtIns = builtInTemplates();
  assert.deepEqual(builtIns.map((entry) => entry.name), ["Fluxo de processo", "Organograma", "Mapa de ideias", "Apresentação simples"]);
  const original = builtIns[0].scene;
  original.headingLayout = { description: { x: -120, y: 240, width: 650, fontSize: 42, align: "left" } };
  const saved = saveSceneAsTemplate(original, "Fluxo reutilizável");
  const first = insertTemplateScene(saved, "Projeto", 1);
  const second = insertTemplateScene(saved, "Projeto", 2);
  assert.notEqual(first.id, second.id);
  assert.deepEqual(first.headingLayout, saved.scene.headingLayout, "optional semantic heading layout survives template cloning");
  first.headingLayout.description.x = 999;
  assert.equal(second.headingLayout.description.x, -120, "template heading layout does not alias across inserted copies");
  first.headingLayout.description.x = -120;
  assert.ok(first.items.every((entry, index) => entry.id !== second.items[index].id));
  for (const scene of [first, second]) {
    const ids = new Set(scene.items.map((entry) => entry.id));
    for (const entry of scene.items) {
      if (entry.from) assert.ok(ids.has(entry.from));
      if (entry.to) assert.ok(ids.has(entry.to));
    }
  }
  first.items[0].text = "Alterado somente nesta cópia";
  assert.notEqual(second.items[0].text, first.items[0].text);
  assert.notEqual(saved.scene.items[0].text, first.items[0].text);
  const project = makeProject("Templates");
  project.board.scenes.push(first);
  assert.equal(validLibrary({ format: "orquestra-library", version: 1, activeId: project.id, projects: [project], templates: [saved] }), true);
});

test("version snapshots validate and retention keeps at most 30 per project after the new version is saved", () => {
  const project = makeProject("Histórico");
  const versions = Array.from({ length: 30 }, (_, index) => {
    const value = makeProjectVersion({ ...project, updatedAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString() }, "manual", `Versão ${index + 1}`);
    value.createdAt = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
    return value;
  });
  const next = makeProjectVersion(project, "automatic", "Automática");
  next.createdAt = new Date(Date.UTC(2026, 1, 1)).toISOString();
  assert.equal(validProjectVersion(next), true);
  assert.equal(versionsToPrune(versions, next).length, 1);
  assert.ok(versionsToPrune(versions, next).includes(versions[0].id));
  assert.equal(validProjectVersion({ ...next, source: "unknown" }), false);
});
