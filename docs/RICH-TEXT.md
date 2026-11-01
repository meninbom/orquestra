# Rich text no Orquestra (1.9.4)

Formatação por trecho dentro do mesmo elemento de texto, com modelo seguro e
compatível com os quadros em texto simples da 1.9.3.

## Modelo

`Item.rich?: RichText` é opcional. Quando está ausente, o item continua
renderizando exatamente pelo caminho legado (`<text>` direto no `<g>` do item),
o que preserva o DOM, o layout e os testes da 1.9.3.

```ts
type RichMark = {
  start: number; end: number;      // offsets de caractere em Item.text
  bold?: boolean; italic?: boolean; // ausente = herda o item
  underline?: boolean; strike?: boolean;
  color?: string; highlight?: string; // #rrggbb
  size?: number;                    // px absolutos (8..400)
  fontFamily?: FontFamily;
  link?: string;                    // somente https:
};

type RichBlockStyle = {
  list?: "none" | "bullet" | "ordered";
  indent?: number;                  // 0..8
  align?: "left" | "center" | "right";
  preset?: "body" | "lead" | "h1" | "h2" | "h3" | "quote";
};

type RichText = { marks: RichMark[]; blocks: RichBlockStyle[] };
```

Regras:

- `Item.text` continua sendo a fonte da verdade em texto simples. Nada de HTML
  no documento persistido.
- `marks` são normalizadas para intervalos ordenados e sem sobreposição; a
  normalização corta offsets fora do texto e descarta marcas vazias.
- `blocks` é indexado por parágrafo (`\n`), então listas, recuo e alinhamento
  são por parágrafo.
- Links só sobrevivem à validação quando são `https:` sem credenciais.

## Operações (`src/richText.ts`)

| Função | Uso |
| --- | --- |
| `normalizeRich` | saneia e funde marcas |
| `spansForRange` / `styleAt` | resolve o estilo efetivo por caractere |
| `applyRichStyle` | aplica/limpa propriedades em um intervalo |
| `toggleRichProperty` | alterna negrito/itálico/sublinhado/tachado |
| `markState` | `on`, `off` ou `mixed` para estados coletivos |
| `setBlocks` / `listMarkers` | listas, recuo e numeração |
| `applyPreset` | presets tipográficos por parágrafo |
| `remapRich` | reancora marcas após edição (prefixo/sufixo comum) |
| `insertPasted` | insere conteúdo rico preservando o destino |
| `pasteRichFromHtml` | parser HTML restrito (sem DOM, sem script) |
| `richToClipboardHtml` | serializa para copiar com formatação |
| `linkRuns` | trechos com link, usados na apresentação |

## Layout e renderização

- `src/richLayout.ts` mede cada trecho com sua própria fonte/tamanho, quebra
  linhas com recuo de lista e produz `RichLine[]` com segmentos posicionados.
- `src/RichTextVisual.tsx` desenha `<text>`/`<tspan>` + `<rect>` de marca-texto
  + linhas de sublinhado/tachado. É o mesmo componente no canvas, no SVG
  exportado, no PDF (`StaticScene`), na tela do público e no rótulo de seta.
- `src/itemTextMetrics.ts` decide entre o caminho legado e o rico, mantendo
  `wrapItemText`, `itemTextPlacement` e `autoFit` intactos para itens simples.

## Edição

- O editor do canvas continua sendo um `<textarea class="canvas-edit">`
  transparente (contrato preservado para testes e IME). A barra flutuante
  aplica formatação ao trecho selecionado; sem seleção, aplica ao elemento.
- Atalhos no editor: `Ctrl+B`, `Ctrl+I`, `Ctrl+U`, `Ctrl+Shift+S` (tachado),
  `Tab`/`Shift+Tab` (recuo), `Ctrl+Shift+7/8/9` (lista numerada/marcadores/
  remover), `Ctrl+Alt+1/2/3` (título/subtítulo/tópico).
- Barra lateral: mesmos controles para seleção coletiva, com estados `mixed`
  (`aria-pressed="mixed"` e borda tracejada). Negrito/itálico/alinhamento no
  painel continuam sendo propriedades do elemento (para não converter quadros
  antigos em ricos); sublinhado, tachado, cor, destaque, fonte, tamanho, listas,
  recuo, link e presets atuam por trecho/bloco.
- Colar: HTML do clipboard é sanitizado (whitelist de tags e de propriedades
  CSS; listas e parágrafos preservados). `Shift+Ctrl+V` mantém colagem simples.
  Copiar um item rico grava também `text/html`.

## Busca e substituição

`Ctrl+F` (ou o botão na barra de histórico) abre `SearchReplace`, que varre
todas as seções do projeto: texto dos itens, nome da camada, nome do arquivo,
URL e os três campos de título da seção. Navegação com Enter/Shift+Enter,
substituir atual e substituir todos; substituições em texto remapeiam as marcas
e o texto substituído herda o estilo do trecho original.

## Segurança e durabilidade

- `validBoard` valida `rich` (limites, cores, tamanhos, fontes e links https).
- `repairBoard`/`repairLibrary` recuperam quadros cujo único defeito é formatação
  rica inválida, em vez de rejeitar o arquivo inteiro na importação/carregamento.
- `sanitizePresenterState` projeta apenas campos conhecidos de `marks`/`blocks`
  para a tela do público.
- Links por trecho são clicáveis na apresentação e na tela do público via
  `openLink` (validação https no renderer e no processo principal).

## Testes

```bash
npm test                                # inclui tests/rich-text.test.cjs
npm run build
node scripts/test-rich-text.mjs         # QA Electron isolado (perfil temporário)
```

O fluxo 1.9.3 (`tests/features-flow.mjs`) foi executado em modo fonte por um
runner temporário com perfil isolado, sem empacotar; ele cobre formatação,
auto-ajuste, padding, alinhamento vertical, rótulos de seta, grupos, camadas,
modelos, versões e importação.

Cobertura nova: formatação por trecho, estados mistos, listas/recuo, presets,
colagem sanitizada, ida-e-volta de clipboard, remapeamento em edição, layout
rico, rótulo de seta, validação/reparo, projeção do apresentador, busca e
substituição.

## Limitações conhecidas

- O recuo de listas de segundo nível desloca o cursor do editor transparente em
  relação ao texto renderizado (o texto final fica correto; o padding do editor
  compensa apenas o primeiro nível).
- Presets gravam tamanho absoluto no trecho; alterar "Tamanho do texto" do
  elemento não reescala trechos com tamanho explícito.
- `tests/customization-flow.mjs` tem uma falha anterior a este trabalho
  (reproduzida no commit HEAD 2b71f4b): após editar a cor da borda,
  `updateBorderColor` congela `itemTextColor(i)` (cor crua) e
  `resolveItemTextColor` passa a devolver essa cor sem o ajuste de contraste,
  então o texto de um cartão Agente muda de `#e2e9e2` para a cor da borda.
  Ambas as funções estão no HEAD e não foram tocadas aqui.
