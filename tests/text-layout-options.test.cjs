const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { StaticScene } = require("../.qa/static-scene.cjs");
const { validBoard } = require("../.qa/model.cjs");
const { itemTextPlacement, wrapItemText, autoFitMode, autoHeightFor, fitFontSizeToHeight, arrowFontStack, arrowLabelLayout, defaultVerticalAlignment } = require("../.qa/textLayout.cjs");
const { arrowGeometry, itemBounds, pointAlongPath } = require("../.qa/selection.cjs");
const { styleProperties, applySavedStyle } = require("../.qa/styles.cjs");
const { sanitizePresenterState } = require("../.qa/presenter-protocol.cjs");

const item = (id, type, extra = {}) => ({
  id, type, x: 100, y: 80, w: 240, h: 120, text: "Texto de exemplo", color: "#8fe3b5", fill: "#14251d",
  size: 20, fontFamily: type === "arrow" ? "DM Sans" : "Caveat", step: 0, animation: "none", ...extra,
});
const scene = (items) => ({ id: "layout", name: "Layout", description: "", duration: 6, items });
const measure = (text, font) => [...text].length * Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] || 16) * 0.5;

test("text bounds preserve legacy defaults and expose padding and vertical alignment", () => {
  const legacy = item("legacy", "text", { w: 180, h: 100, size: 20 });
  const lines = ["Primeira linha", "Segunda linha"];
  const oldPlacement = itemTextPlacement(legacy, lines);
  assert.equal(oldPlacement.x, legacy.x + 16);
  assert.equal(oldPlacement.baseY, legacy.y + 30);
  const adjusted = { ...legacy, textPaddingX: 28, textPaddingY: 10, verticalAlign: "bottom", textAlign: "right" };
  const placement = itemTextPlacement(adjusted, lines);
  assert.equal(placement.x, adjusted.x + adjusted.w - 28);
  assert.ok(placement.baseY > oldPlacement.baseY);
  assert.deepEqual(wrapItemText({ ...adjusted, text: "a b c d e f g h i" }, measure, "Caveat, cursive").length > 0, true);
});

test("custom Y padding preserves default top alignment when no vertical alignment is explicit", () => {
  for (const type of ["text", "note", "agent"]) {
    const configured = item(`${type}-padded`, type, { verticalAlign: undefined, textPaddingY: 20, size: 20 });
    const placement = itemTextPlacement(configured, ["Uma linha", "Outra linha"]);
    assert.equal(defaultVerticalAlignment(configured), "top");
    assert.equal(placement.baseY, configured.y + configured.textPaddingY + configured.size * 0.8);
  }
});

test("auto-fit supports legacy grow, fixed sizing, and reducing font to fit height", () => {
  const legacyGrow = item("legacy-grow", "note", { autoHeight: true });
  assert.equal(autoFitMode(legacyGrow), "grow");
  assert.equal(autoFitMode(item("fixed", "rect")), "fixed");
  const content = item("content", "rect", { text: "Uma frase longa que deve ocupar mais de uma linha", w: 90, h: 48, size: 28, autoFit: "shrink" });
  const fittedSize = fitFontSizeToHeight(content, measure, "Caveat, cursive");
  assert.ok(fittedSize < content.size && fittedSize >= 10);
  const grown = { ...content, textPaddingY: 30 };
  assert.ok(autoHeightFor(grown, 3) > autoHeightFor(content, 3));
});

test("arrow labels wrap on measured width, follow path distance, and stay in export bounds", () => {
  const arrow = item("edge", "arrow", {
    x: 10, y: 20, w: 300, h: 20, text: "A long measured label\nwith an explicit second line",
    arrowLabelPosition: 0.25, arrowLabelFill: "#334455", textColor: "#ff3366", bold: true, italic: true,
  });
  const layout = arrowLabelLayout(arrow, measure, '"DM Sans", sans-serif');
  assert.equal(layout.lines.length, 2);
  assert.ok(layout.width > measure("A long measured label", layout.font));
  const geometry = arrowGeometry(arrow, [arrow]);
  const point = pointAlongPath(geometry.points, 0.25);
  assert.ok(point);
  const bounds = itemBounds(arrow, [arrow]);
  assert.ok(bounds.x <= point.x - layout.width / 2);
  assert.ok(bounds.y < point.y, "the label's multiline text is included above the arrow path");
  const markup = renderToStaticMarkup(React.createElement(StaticScene, {
    scene: scene([arrow]), index: 0, light: false, images: {}, embeddedFonts: "",
  }));
  assert.match(markup, /data-arrow-label="true"/);
  assert.match(markup, /fill="#334455"/);
  assert.match(markup, /fill="#ff3366"[^>]*font-size="20"[^>]*font-family="&quot;DM Sans&quot;, sans-serif"[^>]*font-weight="700"[^>]*font-style="italic"/);
  assert.match(markup, /<tspan[^>]*>A long measured label<\/tspan><tspan[^>]*>with an explicit second line<\/tspan>/);
});

test("empty arrow labels render no label background or text and do not add label bounds", () => {
  const arrow = item("empty-edge", "arrow", {
    x: 120, y: 160, w: 300, h: 0, text: "", size: 88, arrowLabelPosition: 0.5,
    arrowLabelFill: "#ff00ff",
  });
  const whitespaceArrow = { ...arrow, id: "whitespace-edge", text: "  " };
  assert.deepEqual(arrowLabelLayout(arrow, measure, arrowFontStack(arrow)).lines, []);
  assert.deepEqual(arrowLabelLayout(whitespaceArrow, measure, arrowFontStack(whitespaceArrow)).lines, []);
  const markup = renderToStaticMarkup(React.createElement(StaticScene, {
    scene: scene([arrow, whitespaceArrow]), index: 0, light: false, images: {}, embeddedFonts: "",
  }));
  assert.doesNotMatch(markup, /data-arrow-label="true"/);
  assert.doesNotMatch(markup, /fill="#ff00ff"/);
});

test("arrow font stacks preserve selected families and default to DM Sans", () => {
  assert.equal(arrowFontStack(item("georgia", "arrow", { fontFamily: "Georgia" })), "Georgia, serif");
  assert.equal(arrowFontStack(item("caveat", "arrow", { fontFamily: "Caveat" })), '"Caveat", cursive');
  assert.equal(arrowFontStack(item("default-font", "arrow", { fontFamily: undefined })), '"DM Sans", sans-serif');
});

test("new text settings validate, persist in JSON and presenter projection, and round-trip as styles", () => {
  const configured = item("configured", "arrow", {
    verticalAlign: "bottom", textPaddingX: 24, textPaddingY: 12, autoFit: "shrink",
    arrowLabelPosition: 0.8, arrowLabelFill: "#223344",
  });
  const board = { version: 1, title: "Compatível", scenes: [scene([configured])] };
  assert.equal(validBoard(board), true);
  assert.equal(validBoard({ ...board, scenes: [scene([{ ...configured, textPaddingX: 201 }])] }), false);
  assert.equal(validBoard({ ...board, scenes: [scene([{ ...configured, arrowLabelPosition: 1.1 }])] }), false);
  const decoded = JSON.parse(JSON.stringify(board)).scenes[0].items[0];
  assert.equal(decoded.arrowLabelFill, "#223344");
  const projected = sanitizePresenterState({ scene: scene([configured]), index: 0, step: 0, light: false, playing: false });
  assert.equal(projected.scene.items[0].verticalAlign, "bottom");
  assert.equal(projected.scene.items[0].autoFit, "shrink");
  assert.equal(projected.scene.items[0].arrowLabelPosition, 0.8);
  assert.equal(projected.scene.items[0].arrowLabelFill, "#223344");
  assert.equal(projected.scene.items[0].textPaddingX, 24);
  assert.equal(projected.scene.items[0].textPaddingY, 12);
  const style = { id: "style", name: "Seta", properties: styleProperties(configured) };
  const target = applySavedStyle(item("target", "arrow", { text: "Outro texto" }), style);
  assert.equal(target.text, "Outro texto");
  assert.equal(target.arrowLabelFill, "#223344");
  assert.equal(target.textPaddingX, 24);
  assert.equal(target.autoFit, "shrink");
});
