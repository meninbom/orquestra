const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateAiOutline, outlineToBoard } = require("../.qa/ai-layout.cjs");
const { validBoard } = require("../.qa/model.cjs");

const outline = () => ({ title: "Tema", sections: [{ title: "Etapa", summary: "Resumo", points: ["Primeiro", "Segundo", "Terceiro"], pages: [] }] });
test("layouts nativos possuem conectores válidos e não expõem notas privadas", () => {
  for (const kind of ["flow", "map", "presentation"]) {
    const board = outlineToBoard(outline(), kind);
    assert.equal(validBoard(board), true);
    const section = board.scenes[0];
    assert.equal(section.presenterNotes, undefined);
    const nodes = new Set(section.items.filter((item) => item.type !== "arrow").map((item) => item.id));
    for (const arrow of section.items.filter((item) => item.type === "arrow")) {
      assert.ok(nodes.has(arrow.from)); assert.ok(nodes.has(arrow.to));
    }
  }
});
test("rejeita formato arbitrário, limites e páginas não selecionadas", () => {
  const candidate = outline(); candidate.sections[0].pages = [3];
  assert.throws(() => validateAiOutline(candidate, [1, 2]));
  assert.throws(() => validateAiOutline({ ...outline(), command: "echo" }));
  assert.throws(() => validateAiOutline({ ...outline(), sections: Array(13).fill(outline().sections[0]) }));
  assert.throws(() => validateAiOutline({ ...outline(), sections: [{ ...outline().sections[0], points: ["x".repeat(181)] }] }));
});
test("referência PDF aponta para asset e página autorizada", () => {
  const value = outline(); value.sections[0].pages = [2];
  const source = { id: "12345678-1234-1234-1234-123456789abc", name: "origem.pdf", pages: [2] };
  const board = outlineToBoard(value, "presentation", 8, source);
  const reference = board.scenes[0].items.find((item) => item.type === "file");
  assert.equal(reference.assetId, source.id); assert.equal(reference.pdfPage, 2);
  assert.equal(validBoard(board), true);
});

test("fluxo rico valida ciclos, referências, etapas e produz objetos editáveis sem sobreposição", () => {
  const rich = require('./rich-fixture.cjs');
  const board = outlineToBoard(rich, 'flow'); assert.ok(validBoard(board));
  const items = board.scenes[0].items, nodes = items.filter(x => !['frame','arrow'].includes(x.type)), arrows = items.filter(x => x.type === 'arrow');
  assert.equal(arrows.length, 6); assert.ok(arrows.some(x => x.text === 'Não' && x.fromPort && x.toPort));
  assert.ok(arrows.some(x => x.arrowMotion === 'pulse')); assert.ok(new Set(nodes.map(x => x.step)).size >= 5); assert.equal(items.filter(x => x.type === 'frame').length, 2);
  for (const [i,a] of nodes.entries()) for (const b of nodes.slice(i+1)) assert.ok(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y);
  const noMotion = outlineToBoard(rich, 'flow', 6, undefined, false); assert.ok(noMotion.scenes[0].items.every(x => x.animation === 'none' && (!x.arrowMotion || x.arrowMotion === 'none')));
  for (const mutate of [x => x.sections[0].nodes[1].id = x.sections[0].nodes[0].id, x => x.sections[0].edges[0].to = 'missing', x => x.sections[0].nodes[0].step = 21, x => x.sections[0].nodes[0].icon = 'invalid']) { const bad = structuredClone(rich); mutate(bad); assert.throws(() => validateAiOutline(bad)); }
});
