const test = require("node:test");
const assert = require("node:assert/strict");
const { textToolbarPlacement } = require("../.qa/text-toolbar-placement.cjs");

test("formatting toolbar stays outside the editor near every canvas edge and at different sizes", () => {
  for (const canvas of [{ left: 0, top: 66, width: 1180, height: 750 }, { left: 0, top: 66, width: 540, height: 530 }]) {
    for (const anchor of [
      { left: 100, top: 90, width: 300, height: 90 },
      { left: 100, top: 300, width: 300, height: 90 },
      { left: canvas.width - 100, top: 500, width: 90, height: 90 },
      { left: 8, top: 74, width: canvas.width - 16, height: canvas.height - 16 },
    ]) {
      const width = Math.min(380, canvas.width - 16);
      const height = 210; // multi-row toolbar, unlike the old fixed 60px estimate
      const result = textToolbarPlacement(anchor, canvas, { width, height });
      const h = Math.min(height, result.maxHeight);
      assert.ok(result.left >= canvas.left && result.left + width <= canvas.left + canvas.width);
      const overlaps = result.left < anchor.left + anchor.width && result.left + width > anchor.left && result.top < anchor.top + anchor.height && result.top + h > anchor.top;
      assert.equal(overlaps, false, JSON.stringify({ canvas, anchor, result }));
      assert.ok(h >= 32);
    }
  }
});

test("toolbar repositions when its link editor increases its actual height", () => {
  const anchor = { left: 100, top: 280, width: 320, height: 90 };
  const canvas = { left: 0, top: 66, width: 800, height: 600 };
  assert.equal(textToolbarPlacement(anchor, canvas, { width: 400, height: 120 }).side, "above");
  assert.equal(textToolbarPlacement(anchor, canvas, { width: 400, height: 250 }).side, "below");
});
