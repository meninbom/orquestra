const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

async function loadRenderWindow() {
  const built = await esbuild.build({
    entryPoints: [path.join(__dirname, "../src/renderWindow.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
  });
  const module = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(module, module.exports);
  return module.exports;
}

test("render window follows the viewport in world coordinates and includes a safety margin", async () => {
  const { renderWindowBounds } = await loadRenderWindow();
  assert.deepEqual(renderWindowBounds({ x: -100, y: -50, z: 2 }, 800, 600, 100), {
    x: -50, y: -75, w: 600, h: 500,
  });
});

test("intersection includes touching edges and excludes distant items", async () => {
  const { intersectsRenderWindow } = await loadRenderWindow();
  const window = { x: 0, y: 0, w: 100, h: 100 };
  assert.equal(intersectsRenderWindow({ x: 100, y: 20, w: 30, h: 30 }, window), true);
  assert.equal(intersectsRenderWindow({ x: 101, y: 20, w: 30, h: 30 }, window), false);
});

test("large scene culling retains selected items, connectors, and all media", async () => {
  const { visibleRenderItemIds } = await loadRenderWindow();
  const window = { x: 0, y: 0, w: 100, h: 100 };
  const items = Array.from({ length: 151 }, (_, i) => ({
    id: `item-${i}`, type: "rect", x: 1000 + i * 150, y: 1000, w: 20, h: 20,
  }));
  items[0] = { ...items[0], x: 10, y: 10 };
  items[1] = { ...items[1], type: "video" };
  items[2] = { ...items[2], type: "arrow" };
  const visible = visibleRenderItemIds(items, window, ["item-3"], false);
  assert.equal(visible.has("item-0"), true);
  assert.equal(visible.has("item-1"), true);
  assert.equal(visible.has("item-2"), true);
  assert.equal(visible.has("item-3"), true);
  assert.equal(visible.has("item-4"), false);
  assert.equal(visibleRenderItemIds(items, window, [], true).size, 151);
});

test("main keeps media mounted and switches to full scene rendering for visual exports", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/main.tsx"), "utf8");
  assert.match(source, /exportAllItems/);
  assert.match(source, /\["image", "video", "audio", "file", "link"\]\.includes\(i\.type\)/);
  assert.match(source, /visibleRenderItemIds\(scene\.items, visibleWindow/);
  assert.match(source, /const renderedItems = useMemo\(\(\) => scene\.items\.map\(renderItem\)/);
  assert.match(source, /const MemoizedSceneItems = React\.memo/);
});
