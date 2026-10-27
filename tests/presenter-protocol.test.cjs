const test = require("node:test");
const assert = require("node:assert/strict");
const { validState, validLaser } = require("../desktop/presenter.cjs");

const state = { scene: { id: "s1", name: "Seção", description: "", duration: 6, items: [] }, index: 0, step: 0, light: false, playing: false };
test("aceita DTO público válido e recusa notas privadas", () => {
  assert.equal(validState(state), true);
  assert.equal(validState({ ...state, scene: { ...state.scene, presenterNotes: "segredo" } }), false);
});
test("laser viaja em canal próprio: aceita ponto finito ou null e recusa coordenadas inválidas", () => {
  assert.equal(validLaser(null), true);
  assert.equal(validLaser({ x: 10.5, y: -4 }), true);
  assert.equal(validLaser({ x: NaN, y: 1 }), false);
  assert.equal(validLaser({ x: 1, y: Infinity }), false);
  assert.equal(validLaser({ x: 2e6, y: 0 }), false);
  assert.equal(validLaser([1, 2]), false);
  assert.equal(validLaser(undefined), false);
});
test("recusa payloads inválidos, grandes e itens fora do schema mínimo", () => {
  assert.equal(validState({ ...state, step: -1 }), false);
  assert.equal(validState({ ...state, scene: { ...state.scene, items: ["not an item"] } }), false);
  assert.equal(validState({ ...state, scene: { ...state.scene, description: "x".repeat(8 * 1024 * 1024) } }), false);
});

test("preserva os 10.000 itens permitidos e remove propriedades extras do DTO", () => {
  const item = { id: "item-1", type: "rect", x: 0, y: 0, w: 40, h: 30, text: "ok", color: "#fff", fill: "transparent", size: 16, step: 0, animation: "fade", leaked: "private" };
  const withExtras = { ...state, leaked: "root", scene: { ...state.scene, leaked: "scene", items: Array.from({ length: 10000 }, (_, index) => ({ ...item, id: `item-${index}` })) } };
  assert.equal(validState(withExtras), true);
  assert.equal(withExtras.leaked, "root", "root extras are not copied into audience state");
  assert.equal(withExtras.scene.leaked, undefined, "scene extras are projected away");
  assert.equal(withExtras.scene.items[0].leaked, undefined, "item extras are projected away");
  assert.equal(validState({ ...state, scene: { ...state.scene, items: [{ ...item, x: NaN }] } }), false);
  assert.equal(validState({ ...state, scene: { ...state.scene, items: Array.from({ length: 10001 }, (_, index) => ({ ...item, id: `item-${index}` })) } }), false);
});
