const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { StaticScene } = require("../.qa/static-scene.cjs");

const base = { x: 20, y: 40, w: 180, h: 80, text: "Item", color: "#8fe3b5", fill: "transparent", size: 20, step: 0, animation: "fade" };
const items = [
  { ...base, id: "rect", type: "rect" },
  { ...base, id: "text", type: "text" },
  { ...base, id: "pen", type: "pen", points: [[0, 0], [60, 30]] },
  { ...base, id: "icon", type: "icon" },
  { ...base, id: "arrow", type: "arrow", from: "rect", to: "text" },
  { ...base, id: "image", type: "image", assetId: "missing", assetName: "foto.png" },
  { ...base, id: "video", type: "video", assetName: "clip.mp4" },
  { ...base, id: "audio", type: "audio", assetName: "som.mp3" },
  { ...base, id: "file", type: "file", assetName: "doc.pdf" },
  { ...base, id: "link", type: "link", url: "https://example.com" },
  { ...base, id: "youtube", type: "link", url: "https://youtu.be/dQw4w9WgXcQ" },
];

test("every drawn item in the public render is tagged with data-item so the audience can animate it", () => {
  const markup = renderToStaticMarkup(React.createElement(StaticScene, {
    scene: { id: "anim", name: "Animação", description: "", duration: 6, items },
    index: 0, light: false, images: {}, embeddedFonts: "",
  }));
  for (const item of items) assert.match(markup, new RegExp(`data-item="${item.id}"`), `item ${item.id} tagged`);
});

test("arrow motion reaches the public render only when the scene is animated", () => {
  const arrows = [
    { ...base, id: "rect", type: "rect" },
    { ...base, id: "text", type: "text", x: 300 },
    { ...base, id: "flow", type: "arrow", from: "rect", to: "text", arrowMotion: "particles" },
  ];
  const scene = { id: "arrows", name: "Setas", description: "", duration: 6, items: arrows };
  const animated = renderToStaticMarkup(React.createElement(StaticScene, { scene, index: 0, light: false, images: {}, embeddedFonts: "", animated: true }));
  assert.match(animated, /class="arrow-line arrow-motion-particles"/);
  assert.equal((animated.match(/<animateMotion/g) || []).length, 3, "three particles travel the arrow");
  const exported = renderToStaticMarkup(React.createElement(StaticScene, { scene, index: 0, light: false, images: {}, embeddedFonts: "" }));
  assert.match(exported, /class="arrow-line arrow-motion-none"/);
  assert.equal(exported.includes("<animateMotion"), false, "exports stay static");
});

test("pen strokes and icons keep their data-item wrapper around the drawing primitive", () => {
  const markup = renderToStaticMarkup(React.createElement(StaticScene, {
    scene: { id: "anim", name: "Animação", description: "", duration: 6, items },
    index: 0, light: false, images: {}, embeddedFonts: "",
  }));
  assert.match(markup, /<g data-item="pen"><polyline/);
});
