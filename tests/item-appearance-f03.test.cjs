const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { StaticScene } = require("../.qa/static-scene.cjs");
const { builtInTemplates } = require("../.qa/templates.cjs");

const item = (id, type, extra = {}) => ({
  id, type, x: 20, y: 40, w: 180, h: 80, text: `Legível-${id}`, color: "#8fe3b5",
  textColor: "#e2e9e2", fill: "#14251d", size: 20, step: 0, animation: "none", ...extra,
});
const render = (items, light) => renderToStaticMarkup(React.createElement(StaticScene, {
  scene: { id: "f03", name: "F03", description: "", duration: 6, items },
  index: 0, light, images: {}, embeddedFonts: "",
}));
const luminance = (hex) => {
  const rgb = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const textFill = (markup, id) => {
  const start = markup.indexOf(`data-item="${id}"`);
  assert.notEqual(start, -1, `rendered item ${id}`);
  return markup.slice(start).match(/<text[^>]*fill="(#[\da-f]{6})"/i)?.[1];
};

test("F03: built-in process template keeps light text over dark fills in both themes", () => {
  for (const light of [false, true]) {
    const markup = render([item("process", "rect")], light);
    assert.equal(textFill(markup, "process"), "#e2e9e2");
    assert.ok(ratio("#e2e9e2", "#14251d") > 10);
  }
});

test("F03: every built-in template renders its default text with readable contrast in both themes", () => {
  for (const template of builtInTemplates()) {
    for (const light of [false, true]) {
      const nodes = template.scene.items.filter((entry) => entry.type !== "arrow");
      const markup = render(nodes, light);
      for (const entry of nodes) {
        const foreground = textFill(markup, entry.id);
        assert.ok(foreground, `${template.name}/${entry.id} has rendered text`);
        assert.ok(ratio(foreground, entry.fill) >= 4.5, `${template.name}/${entry.id} contrast ${ratio(foreground, entry.fill).toFixed(2)}:1`);
      }
    }
  }
});

test("F03: palette defaults adapt on transparent canvas and honor note opacity", () => {
  const markup = render([
    item("transparent", "text", { textColor: undefined, color: "#e2e9e2", fill: "transparent" }),
    item("note", "note", { textColor: undefined, color: "#e2e9e2", fill: "#14251d", fillOpacity: 0.9 }),
  ], true);
  assert.equal(textFill(markup, "transparent"), "#273f35");
  assert.equal(textFill(markup, "note"), "#e2e9e2");
  assert.ok(ratio("#273f35", "#f4f7f3") > 8);
});

test("F03: legacy items without textColor resolve from their default color", () => {
  const legacy = item("legacy", "text", { textColor: undefined, color: "#e2e9e2", fill: "transparent" });
  assert.equal(textFill(render([legacy], true), "legacy"), "#273f35");
});

test("F03: explicit custom text colors and frame titles are rendered consistently", () => {
  const custom = item("custom", "agent", { textColor: "#00ddaa", fill: "#14251d" });
  const frame = item("frame", "frame", { text: "Título", textColor: "#00ddaa" });
  const markup = render([custom, frame], true);
  assert.equal(textFill(markup, "custom"), "#00ddaa");
  assert.match(markup, /data-frame-title="true"[\s\S]*?fill="#00ddaa"/);
});

test("F03: an explicitly chosen palette text color is preserved on a light surface", () => {
  const chosen = item("chosen-palette", "text", { textColor: "#e2e9e2", fill: "transparent" });
  assert.equal(textFill(render([chosen], true), "chosen-palette"), "#e2e9e2");
});
