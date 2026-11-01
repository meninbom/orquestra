const test = require("node:test");
const assert = require("node:assert/strict");
const { penPath, appendPenSamples } = require("../.qa/pen-geometry.cjs");
const { validBoard, initialBoard } = require("../.qa/model.cjs");
const { itemBounds } = require("../.qa/selection.cjs");
const { StaticScene } = require("../.qa/static-scene.cjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ink = (extra = {}) => ({ id: "ink", type: "pen", x: 10, y: 20, w: 0, h: 0, text: "", color: "#8fe3b5", fill: "transparent", size: 26, step: 0, animation: "draw", points: [[0,0],[20,40],[50,0]], ...extra });
test("legacy ink retains polygon geometry; smooth strokes and isolated dots render", () => {
  assert.equal(penPath(ink()), "M 10 20 L 30 60 L 60 20");
  assert.equal(penPath(ink({ penSmooth: true })), "M 10 20 Q 30 60 45 40 L 60 20");
  assert.match(penPath(ink({ points: [[0,0]] })), /l 0.001 0$/);
  assert.equal(penPath(ink({ points: [] })), "");
});
test("zoom-aware sampling rejects jitter and keeps the exact final point without duplicates", () => {
  const points = [[0,0]];
  assert.deepEqual(appendPenSamples(points, [[0,0],[0.1,0.1],[1,0]], 1), [[0,0],[1,0]]);
  assert.deepEqual(appendPenSamples(points, [[0.1,0]], 1, true), [[0,0],[0.1,0]]);
  assert.deepEqual(appendPenSamples(points, [[1,0]], 0.1), points);
  assert.deepEqual(points, [[0,0]]);
});
test("thick ink bounds include round caps and export shares geometry and appearance", () => {
  const item = ink({ penWidth: 24, penOpacity: 0.35, penSmooth: true });
  assert.deepEqual(itemBounds(item, [item]), { x: -2, y: 8, w: 74, h: 64 });
  const scene = { ...initialBoard().scenes[0], items: [item] };
  const markup = renderToStaticMarkup(React.createElement(StaticScene, { scene, index: 0, light: false, images: {}, embeddedFonts: "" }));
  assert.ok(markup.includes('stroke-width="24"'));
  assert.ok(markup.includes('opacity="0.35"'));
  assert.ok(markup.includes(penPath(item)));
});
test("project validation accepts legacy ink and rejects invalid new brush values", () => {
  const board = initialBoard();
  const set = item => { board.scenes[0].items = [item]; return validBoard(board); };
  assert.ok(set(ink()));
  assert.ok(set(ink({ penWidth: 24, penOpacity: 0.1, penSmooth: true })));
  for (const invalid of [{ penWidth: 0 }, { penWidth: Infinity }, { penWidth: 25 }, { penOpacity: 0 }, { penOpacity: 1.1 }, { penSmooth: "yes" }]) assert.equal(set(ink(invalid)), false);
});
