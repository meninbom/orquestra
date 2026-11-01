const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { StaticScene } = require("../.qa/static-scene.cjs");
const { applyPreset, applyRichStyle, scaleRichFontSizes, setBlocks } = require("../.qa/rich-text.cjs");
const { layoutRichText, richArrowLabelLayout, richPlacement } = require("../.qa/rich-layout.cjs");
const { richCaretAt, richLineStartX, richOffsetAt, richSelectionRects } = require("../.qa/rich-caret.cjs");
const { itemBounds, itemsInArea, selectionBounds } = require("../.qa/selection.cjs");
const { transformSelectionToBounds } = require("../.qa/selection-transform.cjs");
const { sceneRenderBounds } = require("../.qa/scene-bounds.cjs");
const { renderedItemTextColor, resolveItemTextColor } = require("../.qa/item-appearance.cjs");

const measure = (text, font) => {
  const size = Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] || 16);
  return [...text].length * size * 0.55;
};
const item = (extra = {}) => ({
  id: "item-1", type: "text", x: 40, y: 40, w: 420, h: 200, text: "Olá mundo", color: "#e2e9e2",
  fill: "transparent", size: 20, step: 0, animation: "none", ...extra,
});
const scene = (items) => ({ id: "fixes", name: "Correções", description: "", duration: 6, items });
const render = (items) => renderToStaticMarkup(React.createElement(StaticScene, {
  scene: scene(items), index: 0, light: false, images: {}, embeddedFonts: "", animated: false,
}));

test("caret follows rich list indentation beyond level 1 and per-run font sizes", () => {
  const text = "Primeiro\nSegundo trecho";
  let rich = setBlocks(text, undefined, [0, 1], { list: "bullet", indent: 2 });
  rich = applyRichStyle(text, rich, 9, 14, { size: 44 });
  const value = item({ text, rich, h: 260 });
  const layout = layoutRichText(value, measure);
  const baseY = richPlacement(value, layout).baseY;
  const first = layout.lines[0];
  const second = layout.lines[1];
  assert.ok(first.indent > 30, "level 2 plus a list marker moves the line in");
  assert.equal(richLineStartX(second), value.x + 16 + second.indent);

  const atLineStart = richCaretAt(layout, baseY, second.start, measure);
  assert.equal(atLineStart.x, richLineStartX(second), "caret starts exactly at the indented glyph edge");
  const firstStart = richCaretAt(layout, baseY, 0, measure);
  assert.equal(second.start - 0, 9);
  assert.ok(Math.abs(atLineStart.x - firstStart.x) < 0.001, "both level-2 paragraphs share the same indent");

  const runStart = richCaretAt(layout, baseY, 9, measure);
  const runEnd = richCaretAt(layout, baseY, 14, measure);
  assert.ok(runEnd.x - runStart.x > measure("Segun", "500 44px \"Caveat\", cursive") - 1, "the caret measures the 44 px runs instead of item.size");

  const oneLevel = item({ text, rich: setBlocks(text, undefined, [0, 1], { list: "bullet", indent: 1 }), h: 260 });
  const oneLayout = layoutRichText(oneLevel, measure);
  const oneCaret = richCaretAt(oneLayout, richPlacement(oneLevel, oneLayout).baseY, oneLayout.lines[1].start, measure);
  assert.ok(atLineStart.x - oneCaret.x > 15, "indent 2 is visibly farther right than indent 1");

  const roundTrip = richOffsetAt(layout, baseY, { x: runEnd.x + 1, y: runEnd.baseline }, measure);
  assert.equal(roundTrip, 14, "clicking on the caret boundary restores the same offset");
  const rects = richSelectionRects(layout, baseY, 9, 14, measure);
  assert.ok(rects.length >= 1 && rects[0].x >= richLineStartX(second) - 0.001, "rich selection starts at the measured glyph x");
});

test("scaling a rich element multiplies explicit run and preset sizes coherently", () => {
  const text = "Título\nCorpo";
  let rich = applyPreset(text, undefined, 0, 2, "h1");
  rich = applyRichStyle(text, rich, 7, 12, { size: 30 });
  const scaled = scaleRichFontSizes(rich, 0.5);
  assert.equal(rich.marks.find((mark) => mark.start === 0)?.size, 48);
  assert.equal(scaled.marks.find((mark) => mark.start === 0)?.size, 24);
  assert.equal(rich.marks.find((mark) => mark.size === 30).size, 30);
  assert.equal(scaled.marks.find((mark) => mark.size === 15).size, 15);
  assert.equal(scaled.blocks[0].preset, "h1", "the preset label survives so it can be reapplied");
  assert.equal(scaleRichFontSizes(rich, 4).marks[0].size, 192);
  assert.equal(scaleRichFontSizes(rich, 100).marks[0].size, 400, "scaled sizes respect the schema ceiling");

  const a = item({ id: "a", x: 100, y: 100, w: 300, h: 200, text, rich });
  const b = item({ id: "b", x: 460, y: 100, w: 300, h: 200, text: "Outro", size: 24 });
  const bounds = selectionBounds([a, b], ["a", "b"]);
  const resized = transformSelectionToBounds([a, b], ["a", "b"], bounds, { x: bounds.x, y: bounds.y, w: bounds.w * 1.5, h: bounds.h * 1.5 }, { measureText: measure });
  const scaledA = resized.find((entry) => entry.id === "a");
  assert.equal(scaledA.size, 30);
  assert.equal(scaledA.rich.marks.find((mark) => mark.start === 0).size, 72, "collective proportional resize scales explicit runs");
  const markup = render([scaledA]);
  assert.match(markup, /data-rich-size="72"/, "the export paints the scaled run size");
});

test("rich frame titles drive bounds, hit-testing, selection and export framing", () => {
  const text = "Título\nrico";
  let rich = applyRichStyle(text, undefined, 0, 6, { size: 90 });
  const frame = item({ id: "frame", type: "frame", x: 100, y: 80, w: 320, h: 220, text, rich, size: 20 });
  const bounds = itemBounds(frame, [frame]);
  assert.ok(bounds.y < frame.y - 100, "the rich title height replaces the legacy single-size height");
  assert.deepEqual(itemsInArea([frame], { x: frame.x + 8, y: frame.y - 60, w: 60, h: 20 }), ["frame"], "the real title band is selectable");
  const selected = selectionBounds([frame], ["frame"]);
  assert.deepEqual(selected, bounds, "selection uses the same rich title bounds");

  const header = sceneRenderBounds(scene([frame]), 0);
  assert.ok(header.y <= bounds.y - 29, "export viewBox includes the rich title above the frame");
  const markup = render([frame]);
  assert.match(markup, /data-frame-title="true"[\s\S]*?data-rich-size="90"/);
});

test("rich arrow labels use their tallest run for hit bounds and are painted at the arrow point", () => {
  const text = "Olá Brasil\nSegunda linha";
  const rich = applyRichStyle(text, undefined, 0, 3, { size: 60 });
  const arrow = item({ id: "edge", type: "arrow", x: 10, y: 200, w: 300, h: 0, text, rich, size: 20 });
  const label = richArrowLabelLayout(arrow, measure, '"DM Sans", sans-serif');
  assert.equal(label.lines.length, 2, "explicit line breaks survive rich label layout");
  assert.equal(label.fontSize, 60);
  const bounds = itemBounds(arrow, [arrow]);
  assert.ok(bounds.y <= 116, `label top ${bounds.y} uses the 60 px first line`);
  const markup = render([arrow]);
  assert.match(markup, /data-arrow-label="true"/);
  assert.match(markup, /translate\(160[.\d]* 0\)/, "the rich label group is translated to the arrow point");
  assert.match(markup, /data-rich-size="60"/);
  assert.match(markup, /Segunda/);
  assert.match(markup, />linha</);
});

test("freezing the visible text color keeps default-adapted and explicit colors on both themes", () => {
  const adaptedDark = item({ type: "rect", textColor: undefined, color: "#e2e9e2", fill: "#e2e9e2" });
  const adaptedLight = item({ type: "rect", textColor: undefined, color: "#e2e9e2", fill: "transparent" });
  assert.equal(renderedItemTextColor(adaptedDark, false), "#14251d");
  assert.equal(renderedItemTextColor(adaptedLight, true), "#273f35");
  for (const [entry, light, expected] of [
    [adaptedDark, false, "#14251d"],
    [adaptedLight, true, "#273f35"],
    [item({ textColor: "#ff3366", color: "#e2e9e2", fill: "#14251d" }), false, "#ff3366"],
    [item({ textColor: "#ff3366", color: "#e2e9e2", fill: "transparent" }), true, "#ff3366"],
    [item({ type: "arrow", textColor: undefined, color: "#8fe3b5" }), true, "#ffffff"],
  ]) {
    const frozen = renderedItemTextColor(entry, light);
    assert.equal(frozen, expected);
    const recolored = { ...entry, color: "#ee9b91", textColor: frozen };
    assert.equal(resolveItemTextColor(recolored, light), frozen, "changing the border never changes the visible text color");
  }
});
