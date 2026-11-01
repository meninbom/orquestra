const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  applyPreset,
  applyRichStyle,
  clearRichStyle,
  hasRichText,
  insertPasted,
  linkRuns,
  listMarkers,
  markState,
  normalizeRich,
  paragraphs,
  pasteRichFromHtml,
  remapRich,
  richToClipboardHtml,
  setBlocks,
  spansForRange,
  toggleRichProperty,
  validLink,
} = require("../.qa/rich-text.cjs");
const { layoutRichText, richArrowLabelLayout, richBlockHeight, richPlacement } = require("../.qa/rich-layout.cjs");
const { stateForItems, stateForRange } = require("../.qa/rich-selection.cjs");
const { findProjectMatches, replaceAllMatches, replaceMatch } = require("../.qa/project-search.cjs");
const { validBoard, sanitizeRichText, repairBoard } = require("../.qa/model.cjs");
const { sanitizePresenterState } = require("../.qa/presenter-protocol.cjs");

const base = { size: 28, bold: false, italic: false };
const item = (extra = {}) => ({
  id: "item-1", type: "text", x: 0, y: 0, w: 420, h: 160, text: "Olá mundo", color: "#e2e9e2",
  fill: "transparent", size: 28, step: 0, animation: "none", ...extra,
});
const board = (items) => ({ version: 1, title: "Projeto", scenes: [{ id: "s1", name: "Seção", description: "Descrição", duration: 5, items }] });
const measure = (text, font) => {
  const size = Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] || 16);
  return [...text].length * size * 0.55;
};

test("formatação por trecho mantém o texto simples intacto", () => {
  const rich = applyRichStyle("Olá mundo", undefined, 0, 3, { bold: true });
  assert.equal(rich.marks.length, 1);
  assert.deepEqual(rich.marks[0], { start: 0, end: 3, bold: true });
  const spans = spansForRange("Olá mundo", rich, 0, 9);
  assert.equal(spans.length, 2);
  assert.equal(spans[0].style.bold, true);
  assert.equal(spans[1].style.bold, undefined);
  assert.equal(markState("Olá mundo", rich, 0, 3, "bold", base), "on");
  assert.equal(markState("Olá mundo", rich, 0, 9, "bold", base), "mixed");
  assert.equal(markState("Olá mundo", rich, 4, 9, "bold", base), "off");
});

test("sublinhado, tachado, destaque, cor, fonte, tamanho e link convivem no mesmo trecho", () => {
  let rich = applyRichStyle("Orquestra", undefined, 0, 9, {
    underline: true, strike: true, highlight: "#f7e08a", color: "#8fe3b5", size: 36, fontFamily: "Georgia",
  });
  rich = applyRichStyle("Orquestra", rich, 0, 3, { link: "https://example.com/guia" });
  const spans = spansForRange("Orquestra", rich, 0, 9);
  assert.equal(spans.length, 2);
  assert.equal(spans[0].style.link, "https://example.com/guia");
  assert.equal(spans[0].style.highlight, "#f7e08a");
  assert.equal(spans[1].style.link, undefined);
  assert.deepEqual(linkRuns("Orquestra", rich).map((run) => run.url), ["https://example.com/guia"]);
  assert.equal(validLink("http://example.com"), false);
  assert.equal(validLink("https://user:pass@example.com"), false);
  assert.equal(validLink("javascript:alert(1)"), false);
  assert.equal(validLink("https://example.com"), true);
});

test("negrito alterna considerando o valor herdado do elemento", () => {
  const boldItem = item({ bold: true, text: "Texto" });
  const off = toggleRichProperty(boldItem.text, undefined, 0, 5, "bold", { size: 28, bold: true });
  assert.equal(markState(boldItem.text, off, 0, 5, "bold", { size: 28, bold: true }), "off");
  const back = toggleRichProperty(boldItem.text, off, 0, 5, "bold", { size: 28, bold: true });
  assert.equal(markState(boldItem.text, back, 0, 5, "bold", { size: 28, bold: true }), "on");
});

test("limpar formatação remove marcas sem tocar no texto", () => {
  const rich = applyRichStyle("Texto rico", undefined, 0, 5, { bold: true, color: "#ffffff" });
  assert.equal(clearRichStyle("Texto rico", rich, 0, 10).marks.length, 0);
});

test("normalização recorta offsets fora do texto e ignora marcas vazias", () => {
  const rich = normalizeRich("abc", { marks: [
    { start: -5, end: 2, bold: true },
    { start: 2, end: 99, italic: true },
    { start: 1, end: 1, underline: true },
  ], blocks: [] });
  assert.deepEqual(rich.marks, [
    { start: 0, end: 2, bold: true },
    { start: 2, end: 3, italic: true },
  ]);
  assert.equal(hasRichText(rich), true);
  assert.equal(hasRichText({ marks: [], blocks: [{}] }), false);
});

test("edição remapeia marcas antes e depois do trecho alterado", () => {
  const rich = applyRichStyle("abcdef", undefined, 3, 6, { bold: true });
  const grown = remapRich("abcdef", "abcXYZdef", rich);
  assert.deepEqual(grown.marks, [{ start: 6, end: 9, bold: true }]);
  const shrunk = remapRich("abcXYZdef", "abdef", grown);
  assert.deepEqual(shrunk.marks, [{ start: 2, end: 5, bold: true }]);
  const typed = remapRich("abcdef", "Xabcdef", rich);
  assert.deepEqual(typed.marks, [{ start: 4, end: 7, bold: true }]);
});

test("listas geram marcadores e numeração por sequência", () => {
  const text = "Um\nDois\nTrês\nFim";
  let rich = setBlocks(text, undefined, [0, 1, 2], { list: "ordered" });
  rich = setBlocks(text, rich, [3], { list: "bullet", indent: 1 });
  assert.deepEqual(listMarkers(text, rich), ["1.", "2.", "3.", "•"]);
  assert.equal(rich.blocks[3].indent, 1);
  const capped = setBlocks(text, rich, [3], { indent: 40 });
  assert.equal(capped.blocks[3].indent, 8);
  assert.equal(paragraphs(text).length, 4);
});

test("presets tipográficos aplicam tamanho e peso por parágrafo", () => {
  const text = "Título\nCorpo";
  const rich = applyPreset(text, undefined, 0, 2, "h1");
  assert.equal(rich.blocks[0].preset, "h1");
  assert.deepEqual(rich.marks.find((mark) => mark.start === 0), { start: 0, end: 6, size: 48, bold: true, italic: false });
  assert.equal(rich.blocks[1], undefined);
});

test("colagem sanitizada preserva listas, parágrafos e formatação permitida", () => {
  const html = `<meta charset="utf-8"><style>p{color:red}</style>
    <p>Primeiro <strong>parágrafo</strong> <em>com</em> <u>ênfase</u></p>
    <ul><li>Item <span style="color:#8fe3b5;font-weight:700">verde</span></li><li>Outro item</li></ul>
    <ol><li>Passo <s>antigo</s></li></ol>
    <h2>Título <a href="https://example.com">seguro</a></h2>
    <p>Link inseguro <a href="javascript:alert(1)">aqui</a></p>
    <script>alert('x')</script>`;
  const pasted = pasteRichFromHtml(html);
  assert.equal(pasted.text, "Primeiro parágrafo com ênfase\nItem verde\nOutro item\nPasso antigo\nTítulo seguro\nLink inseguro aqui");
  assert.equal(pasted.rich.blocks[1].list, "bullet");
  assert.equal(pasted.rich.blocks[2].list, "bullet");
  assert.equal(pasted.rich.blocks[3].list, "ordered");
  assert.equal(pasted.rich.blocks[4].preset, "h2");
  const green = pasted.rich.marks.find((mark) => mark.color === "#8fe3b5");
  assert.equal(green.bold, true);
  const link = pasted.rich.marks.find((mark) => mark.link);
  assert.equal(link.link, "https://example.com");
  assert.equal(pasted.rich.marks.some((mark) => String(mark.link || "").includes("javascript")), false);
});

test("colagem de texto simples preenche o conteúdo e mantém o destino", () => {
  const initial = applyRichStyle("abcd", undefined, 0, 2, { bold: true });
  const pasted = { text: "XY", rich: { marks: [], blocks: [] } };
  const next = insertPasted("abcd", initial, 4, 4, pasted);
  assert.equal(next.text, "abcdXY");
  assert.deepEqual(next.rich.marks, [{ start: 0, end: 2, bold: true }]);
});

test("copiar em HTML e colar de volta preserva o modelo", () => {
  const text = "Título\nItem";
  let rich = applyPreset(text, undefined, 0, 1, "h1");
  rich = setBlocks(text, rich, [1], { list: "bullet" });
  rich = applyRichStyle(text, rich, 8, 12, { italic: true, color: "#c3a4e7" });
  const html = richToClipboardHtml(text, rich);
  const back = pasteRichFromHtml(html);
  assert.equal(back.text, text);
  assert.equal(back.rich.blocks[0].preset, "h1");
  assert.equal(back.rich.blocks[1].list, "bullet");
  assert.equal(back.rich.marks.some((mark) => mark.italic && mark.color === "#c3a4e7"), true);
});

test("SVG/PDF estático renderiza rich text com trechos, listas e destaque", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { StaticScene } = require("../.qa/static-scene.cjs");
  const text = "Título\nItem com link";
  let rich = applyRichStyle(text, undefined, 0, 6, { bold: true, size: 40, color: "#8fe3b5" });
  rich = setBlocks(text, rich, [1], { list: "bullet" });
  rich = applyRichStyle(text, rich, 7, 20, { underline: true, link: "https://example.com" });
  const markup = renderToStaticMarkup(React.createElement(StaticScene, {
    scene: { id: "rich", name: "Rico", description: "", duration: 6, items: [item({ text, rich, w: 320, h: 160 })] },
    index: 0, light: false, images: {}, embeddedFonts: "", animated: false,
  }));
  assert.match(markup, /data-rich-text="true"/);
  assert.match(markup, /data-rich-bold="true"/);
  assert.match(markup, /data-rich-underline="true"/);
  assert.match(markup, /data-rich-link="https:\/\/example\.com"/);
  assert.match(markup, /•/);
  assert.match(markup, /font-family="&quot;Caveat&quot;, cursive"/);
  assert.doesNotMatch(markup, /<script/i);
});

test("espaços entre trechos não colapsam no layout rico", () => {
  const text = "Bloco um\nBloco dois";
  const rich = applyRichStyle(text, undefined, 0, 5, { bold: true });
  const layout = layoutRichText(item({ text, rich }), measure);
  assert.equal(layout.lines[0].text, "Bloco um");
  assert.equal(layout.lines[1].text, "Bloco dois");
  const first = layout.lines[0];
  const space = first.segments.find((segment) => segment.text === " ");
  assert.ok(space, "espaço é um segmento pintado");
  const words = first.segments.filter((segment) => segment.text !== " ");
  assert.ok(words[1].x > words[0].x + words[0].width - 0.5, "o segundo trecho começa depois do primeiro");
  assert.ok(Math.abs(first.width - first.segments.reduce((sum, segment) => sum + segment.width, 0)) < 1);
});

test("layout rico mede por trecho, mantém linhas e altura", () => {
  const text = "Curto\ne um texto bem mais longo para quebrar em várias linhas dentro do cartão";
  const rich = applyRichStyle(text, undefined, 0, 5, { size: 48, bold: true });
  const value = item({ text, rich });
  const layout = layoutRichText(value, measure);
  assert.ok(layout.lines.length > 2);
  assert.equal(layout.lines[0].size, 48);
  assert.ok(layout.lines[0].segments.some((segment) => segment.bold && segment.size === 48));
  assert.ok(richBlockHeight(layout) > 48);
  assert.ok(richPlacement(value, layout).baseY > value.y);
  assert.ok(layout.plainLines.every((line) => typeof line === "string"));
});

test("rótulo de seta rico respeita a largura máxima e o tamanho por trecho", () => {
  const text = "um rótulo consideravelmente longo para a seta";
  const rich = applyRichStyle(text, undefined, 0, 2, { size: 36, bold: true });
  const label = richArrowLabelLayout(item({ text, rich, type: "arrow" }), measure, '"DM Sans", sans-serif');
  assert.ok(label.lines.length >= 2);
  assert.ok(label.width <= 440);
  assert.equal(label.fontSize, 36);
});

test("estados mistos agregam seleção coletiva", () => {
  const a = item({ id: "a", text: "Negrito", rich: { marks: [{ start: 0, end: 7, bold: true }], blocks: [] } });
  const b = item({ id: "b", text: "Simples" });
  const state = stateForItems([a, b]);
  assert.equal(state.bold, "mixed");
  assert.equal(state.size, 28);
  const single = stateForRange(a, 0, 7);
  assert.equal(single.bold, "on");
  assert.equal(single.color, "#e2e9e2");
});

test("validação aceita rich text seguro e repara documentos antigos", () => {
  const rich = applyRichStyle("Texto", undefined, 0, 2, { bold: true, link: "https://example.com" });
  const valid = board([item({ text: "Texto", rich })]);
  assert.equal(validBoard(valid), true);
  assert.equal(validBoard(board([item({ text: "Texto", rich: { marks: [{ start: 0, end: 99, bold: true }], blocks: [] } })])), false);
  assert.equal(validBoard(board([item({ text: "Texto", rich: { marks: [{ start: 0, end: 2, link: "http://x" }], blocks: [] } })])), false);
  const repaired = repairBoard({
    version: 1, title: "Antigo", scenes: [{ id: "s1", name: "N", description: "D", duration: 5,
      items: [{ ...item(), rich: { marks: [{ start: 0, end: 99, bold: true }], blocks: [{ list: "bullet" }] } }] }],
  });
  assert.equal(validBoard(repaired), true);
  assert.deepEqual(repaired.scenes[0].items[0].rich.marks, [{ start: 0, end: 9, bold: true }]);
  assert.equal(sanitizeRichText("abc", { marks: [{ start: 0, end: 2 }], blocks: [] }), undefined);
});

test("projeção do apresentador preserva o rich text e remove chaves desconhecidas", () => {
  const rich = applyRichStyle("Texto", undefined, 0, 2, { bold: true, highlight: "#f7e08a" });
  rich.marks[0].evil = "x";
  const state = sanitizePresenterState({
    scene: { id: "s1", name: "Seção", description: "D", duration: 5,
      items: [item({ text: "Texto", rich })] },
    index: 0, step: 0, light: false, playing: false,
  });
  assert.ok(state);
  assert.equal(state.scene.items[0].rich.marks[0].bold, true);
  assert.equal(state.scene.items[0].rich.marks[0].evil, undefined);
});

test("busca no projeto encontra e substitui preservando formatação", () => {
  const rich = applyRichStyle("Orquestra de agentes", undefined, 0, 9, { bold: true, color: "#8fe3b5" });
  const project = board([item({ text: "Orquestra de agentes", rich }), { ...item({ id: "n" }), type: "note", text: "Nota sobre a orquestra" }]);
  const matches = findProjectMatches(project, "orquestra", { caseSensitive: false });
  assert.equal(matches.filter((match) => match.field === "text").length, 2);
  const replaced = replaceMatch(project, matches[0], "Equipe");
  assert.equal(replaced.scenes[0].items[0].text, "Equipe de agentes");
  assert.deepEqual(replaced.scenes[0].items[0].rich.marks, [{ start: 0, end: 6, bold: true, color: "#8fe3b5" }]);
  const all = replaceAllMatches(project, matches.filter((match) => match.field === "text"), "Grupo");
  assert.equal(all.scenes[0].items[0].text, "Grupo de agentes");
  assert.equal(all.scenes[0].items[1].text, "Nota sobre a Grupo");
  assert.equal(findProjectMatches(project, "ORQUESTRA", { caseSensitive: false }).length >= 2, true);
  assert.equal(findProjectMatches(project, "ORQUESTRA", { caseSensitive: true }).length, 0);
  assert.equal(findProjectMatches(project, "orquestra", { wholeWord: true }).some((match) => match.match.toLowerCase() === "orquestra"), true);
  assert.equal(findProjectMatches(project, "orquest", { wholeWord: true }).length, 0);
});
