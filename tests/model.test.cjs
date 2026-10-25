const test = require("node:test");
const assert = require("node:assert/strict");
const { initialBoard, validBoard } = require("../.qa/model.cjs");

test("legacy boards remain valid without optional appearance settings", () => {
  const board = JSON.parse(JSON.stringify(initialBoard()));
  for (const scene of board.scenes)
    for (const item of scene.items) {
      delete item.fontFamily;
      delete item.fillOpacity;
    }
  assert.equal(validBoard(board), true);
});

test("custom fill opacity, color, and safe font choices survive board JSON", () => {
  const board = initialBoard();
  const item = board.scenes[0].items.find((entry) => entry.type === "agent");
  item.fill = "#375c91";
  item.fillOpacity = 0.42;
  item.fontFamily = "Segoe Print";
  item.textColor = "#f2a123";

  const restored = JSON.parse(JSON.stringify(board));
  assert.equal(validBoard(restored), true);
  assert.equal(restored.scenes[0].items.find((entry) => entry.id === item.id).textColor, "#f2a123");
  assert.equal(restored.scenes[0].items.find((entry) => entry.id === item.id).fill, "#375c91");
  assert.equal(restored.scenes[0].items.find((entry) => entry.id === item.id).fillOpacity, 0.42);
  assert.equal(restored.scenes[0].items.find((entry) => entry.id === item.id).fontFamily, "Segoe Print");

  restored.scenes[0].items.find((entry) => entry.id === item.id).fillOpacity = 1.1;
  assert.equal(validBoard(restored), false);
});
