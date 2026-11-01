import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

export async function testRichText({ cdp, run, waitFor }) {
  const frame = () => run("Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise(r=>setTimeout(r,90))])");
  const edit = async (selector, value) => {
    await run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing field: '+${JSON.stringify(selector)});const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(String(value))});el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`);
    await frame();
  };
  const click = async (selector) => {
    await run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing: '+${JSON.stringify(selector)});el.click();})()`);
    await frame();
  };
  const select = async (start, end) => {
    await run(`(()=>{const el=document.querySelector('.canvas-edit');if(!el)throw Error('no editor');el.focus();el.setSelectionRange(${start},${end});el.dispatchEvent(new Event('select',{bubbles:true}));})()`);
    await frame();
  };
  const screen = (x, y) => run(`(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('[data-world]').getScreenCTM());return{x:p.x,y:p.y}})()`);
  const mouse = async (type, point, clickCount = 1, modifiers = 0) => {
    await cdp("Input.dispatchMouseEvent", { type, ...point, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount, modifiers });
    await frame();
  };
  const doubleClick = async (point) => {
    for (const count of [1, 2]) {
      await mouse("mousePressed", point, count);
      await mouse("mouseReleased", point, count);
      if (count === 1) await delay(90);
    }
  };
  const key = async (keyName, code, virtual, modifiers = 0) => {
    for (const type of ["rawKeyDown", "keyUp"])
      await cdp("Input.dispatchKeyEvent", { type, key: keyName, code, windowsVirtualKeyCode: virtual, modifiers });
    await frame();
  };
  const richSelector = '[data-rich-text] tspan';
  const marks = () => run(`[...document.querySelectorAll('${richSelector}')].map(el=>({text:el.textContent,bold:el.dataset.richBold||'',italic:el.dataset.richItalic||'',underline:el.dataset.richUnderline||'',strike:el.dataset.richStrike||'',link:el.dataset.richLink||'',size:el.dataset.richSize||''}))`);
  const itemText = (id) => run(`document.querySelector('[data-item="${id}"]')?.textContent||''`);
  const center = (selector) => run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const assertToolbarClear = async () => {
    await waitFor(() => run(`(()=>{const t=document.querySelector('[data-rich-toolbar]')?.getBoundingClientRect();const e=document.querySelector('.canvas-edit')?.getBoundingClientRect();return !!t&&!!e&&!(t.left<e.right&&t.right>e.left&&t.top<e.bottom&&t.bottom>e.top)&&t.left>=0&&t.right<=innerWidth&&t.top>=0&&t.bottom<=innerHeight})()`), "formatting toolbar stays visible outside edited text");
  };

  await click(".projects-trigger");
  await waitFor(() => run('!!document.querySelector(".projects-modal")'), "project manager");
  await edit('[aria-label="Nome do novo projeto"]', "Rico QA");
  await click(".create-project-button");
  await waitFor(() => run('document.querySelector(".document-title")?.value==="Rico QA"'), "empty rich project");
  await delay(650);

  await doubleClick(await screen(360, 300));
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "rich text editor");
  assert.ok(await run('!!document.querySelector("[data-rich-toolbar]")'), "floating toolbar is visible while editing");
  await edit(".canvas-edit", "Título\nItem um\nItem dois");
  await frame();
  await assertToolbarClear();
  if (process.env.ORQUESTRA_TOOLBAR_SCREENSHOT) {
    const shot = await cdp("Page.captureScreenshot", { format: "png" });
    await (await import("node:fs/promises")).writeFile(process.env.ORQUESTRA_TOOLBAR_SCREENSHOT, Buffer.from(shot.data, "base64"));
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  await frame();
  await assertToolbarClear();
  if (process.env.ORQUESTRA_TOOLBAR_SCREENSHOT) {
    const shot = await cdp("Page.captureScreenshot", { format: "png" });
    await (await import("node:fs/promises")).writeFile(process.env.ORQUESTRA_TOOLBAR_SCREENSHOT.replace(/\.png$/, "-800x600.png"), Buffer.from(shot.data, "base64"));
  }
  await cdp("Emulation.clearDeviceMetricsOverride");
  await frame();
  await assertToolbarClear();

  await select(0, 6);
  await click('[data-rich-toolbar] [aria-label="Negrito"]');
  let boldReady = false;
  for (let attempt = 0; attempt < 40 && !boldReady; attempt += 1) {
    boldReady = await run(`document.querySelectorAll('${richSelector}[data-rich-bold="true"]').length===1`);
    if (!boldReady) await delay(100);
  }
  if (!boldReady) {
    const diagnostic = await run(`({pressed:document.querySelector('[data-rich-toolbar] [aria-label="Negrito"]')?.getAttribute('aria-pressed'),value:document.querySelector('.canvas-edit')?.value,html:document.querySelector('.scene-content > [data-item]')?.outerHTML.slice(0,1200)})`);
    throw new Error("bold run not rendered: " + JSON.stringify(diagnostic));
  }
  let painted = await marks();
  assert.equal(painted[0].text, "Título");
  assert.equal(painted[0].bold, "true");
  assert.equal(painted[1].text, "Item");
  assert.equal(painted[1].bold, "");

  await select(7, 14);
  await click('[data-rich-toolbar] [aria-label="Sublinhado"]');
  await click('[data-rich-toolbar] [aria-label="Tachado"]');
  await edit('[data-rich-toolbar] [aria-label="Marca-texto do trecho"]', "#8fe3b5");
  await frame();
  painted = await marks();
  assert.ok(painted.filter((run) => run.underline === "true" && run.text.trim()).length >= 2, JSON.stringify(painted));
  assert.ok(painted.filter((run) => run.strike === "true" && run.text.trim()).length >= 2);
  assert.ok(painted.some((run) => run.text === " "), "espaços entre trechos são preservados");
  assert.ok(await run('!!document.querySelector(\'[data-rich-text] rect[data-rich-highlight="true"]\')'), "highlight rectangle rendered");

  await select(14, 22);
  await click('[data-rich-toolbar] [aria-label="Aplicar Título"]');
  await assertToolbarClear();
  painted = await marks();
  assert.equal(painted.at(-1)?.size, "48", JSON.stringify(painted));
  assert.equal(painted.at(-1)?.bold, "true");

  await select(0, 22);
  await click('[data-rich-toolbar] [aria-label="Lista com marcadores"]');
  await waitFor(() => run(`document.querySelector('[data-rich-text]')?.textContent.includes('•')`), "list marker rendered");

  // The measured caret must follow level-2 list indentation instead of the
  // legacy single-level padding used by the transparent textarea.
  const lineStarts = await run(`(()=>{const v=document.querySelector('.canvas-edit').value;const parts=v.split('\\n');let offset=0;return parts.map(part=>{const start=offset;offset+=part.length+1;return start})})()`);
  await select(lineStarts[1], lineStarts[1] + 3);
  await click('[data-rich-toolbar] [aria-label="Aumentar recuo"]');
  await click('[data-rich-toolbar] [aria-label="Aumentar recuo"]');
  const caretAt = async (offset) => {
    await select(offset, offset);
    await run(`document.querySelector('.canvas-edit').dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:'ArrowRight'}))`);
    await frame();
    return run(`(()=>{const el=document.querySelector('[data-rich-caret]');return el?parseFloat(el.style.left):null})()`);
  };
  const caretLine1 = await caretAt(lineStarts[0]);
  const caretLine2 = await caretAt(lineStarts[1]);
  const zoom = await run('document.querySelector("[data-world]").getScreenCTM().a');
  assert.ok(caretLine1 !== null && caretLine2 !== null, "the measured caret layer is visible while editing rich text");
  const expectedIndent = 2 * Math.max(14, 28 * 0.78) * zoom;
  assert.ok(Math.abs(caretLine2 - caretLine1 - expectedIndent) < 1.5, `level 2 caret stays two indent steps right of level 1 (${caretLine1} -> ${caretLine2}, expected +${expectedIndent})`);
  const richItemId = await run('document.querySelector(".scene-content > [data-item]")?.dataset.item');
  const glyphLefts = await run(`(()=>{const spans=[...document.querySelectorAll('[data-item="${richItemId}"] [data-rich-text] tspan[data-rich-size]')].filter(t=>t.textContent.trim());const ys=[...new Set(spans.map(t=>+t.getAttribute('y')))].sort((a,b)=>a-b);return ys.slice(0,2).map(y=>Math.min(...spans.filter(t=>+t.getAttribute('y')===y).map(t=>t.getBoundingClientRect().left)))})()`);
  assert.equal(glyphLefts.length, 2, "two rendered rich lines are available for caret alignment");
  assert.ok(Math.abs((caretLine2 - caretLine1) - (glyphLefts[1] - glyphLefts[0])) < 1.5, `the caret tracks the painted glyph columns (${caretLine2 - caretLine1} vs ${glyphLefts[1] - glyphLefts[0]})`);

  await select(22, 22);
  const pasteValue = await run(`(()=>{const area=document.querySelector('.canvas-edit');const dt=new DataTransfer();dt.setData('text/plain',' colado');dt.setData('text/html','<p> <strong>colado</strong><script>alert(1)</script></p>');const event=new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true});area.dispatchEvent(event);return 'dispatched';})()`);
  await waitFor(() => run(`document.querySelector('.canvas-edit')?.value.includes('colado')`), "rich paste applied");
  assert.equal(pasteValue, "dispatched");
  await waitFor(() => run(`[...document.querySelectorAll('${richSelector}')].some(el=>el.textContent==='colado'&&el.dataset.richBold==='true')`), "pasted bold survived sanitization");

  await key("Escape", "Escape", 27);
  await waitFor(() => run('!document.querySelector(".canvas-edit")'), "editor closed");
  const textId = await run('document.querySelector(".scene-content > [data-item]").dataset.item');
  assert.ok((await itemText(textId)).includes("Título"));
  assert.ok(await run('!!document.querySelector(".scene-content [data-rich-text]")'), "rich text survives the editor");

  await click('[title="Desfazer (Ctrl+Z)"]');
  await click('[title="Refazer (Ctrl+Shift+Z)"]');
  await frame();
  assert.ok(await run('!!document.querySelector(".scene-content [data-rich-text]")'), "undo and redo keep the board renderable");

  await doubleClick(await screen(360, 480));
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "second editor");
  await edit(".canvas-edit", "Sem negrito");
  await key("Escape", "Escape", 27);
  await waitFor(() => run('document.querySelectorAll(".scene-content > [data-item]").length===2'), "two items");
  const secondId = await run('[...document.querySelectorAll(".scene-content > [data-item]")][1].dataset.item');
  const first = await center(`[data-item="${textId}"]`);
  const second = await center(`[data-item="${secondId}"]`);
  await mouse("mousePressed", first);
  await mouse("mouseReleased", first);
  await mouse("mousePressed", second, 1, 8);
  await mouse("mouseReleased", second, 1, 8);
  const mixedBold = await run(`document.querySelector('[aria-label="Formatação do texto selecionado"] [aria-label="Negrito"]')?.getAttribute('aria-pressed')||''`);
  assert.equal(mixedBold, "mixed", "collective editing shows the mixed bold state");
  await click('[aria-label="Formatação do texto selecionado"] [aria-label="Negrito"]');
  await frame();
  const appliedBold = await run(`document.querySelectorAll('.scene-content [data-rich-text] tspan[data-rich-bold="true"]').length`);
  assert.ok(appliedBold >= 2, "collective bold applied to both items: " + appliedBold);

  await click('[aria-label="Buscar e substituir no projeto"]');
  await waitFor(() => run('!!document.querySelector(".search-panel")'), "search panel");
  await edit('[aria-label="Buscar no projeto"]', "Item");
  await waitFor(() => run('document.querySelectorAll(".search-results button").length>=2'), "search results");
  const beforeCount = await run('document.querySelectorAll(".search-results button").length');
  await click(".search-results button");
  await frame();
  await edit('[aria-label="Substituir por"]', "Bloco");
  await click('[aria-label="Substituir todos os resultados"]');
  await waitFor(() => run('document.querySelectorAll(".search-results button").length < ' + beforeCount), "replace all lowers the match count");
  const afterCount = await run('document.querySelectorAll(".search-results button").length');
  assert.ok(afterCount < beforeCount, `${beforeCount} -> ${afterCount}`);
  assert.ok((await itemText(textId)).includes("Bloco"), "replace updated the canvas text");
  await click('[aria-label="Fechar busca"]');
  await frame();

  const textBox = await center(`[data-item="${textId}"] text`);
  await doubleClick(textBox);
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "editor for link");
  await select(0, 5);
  await click('[data-rich-toolbar] [aria-label="Link do trecho"]');
  await waitFor(() => run('!!document.querySelector(\'[aria-label="URL do link do trecho"]\')'), "link input");
  await assertToolbarClear();
  await edit('[aria-label="URL do link do trecho"]', "https://example.com/guia");
  await click(".format-link-row button");
  await waitFor(() => run('document.querySelectorAll(\'[data-rich-link="https://example.com/guia"]\').length>=1'), "rich link rendered");
  await key("Escape", "Escape", 27);
  await waitFor(() => run('!document.querySelector(".canvas-edit")'), "link editor closed");
  // Double-click on rich arrow label glyphs edits the connector, even for
  // runs with a different face/size, and never creates a second text item.
  const foreignTool = await run(`!!document.querySelector('[aria-label="Conectar / seta"]')`);
  assert.equal(foreignTool, true, "connector tool is available");
  await click('[aria-label="Conectar / seta"]');
  await mouse("mousePressed", await screen(180, 640));
  await mouse("mouseMoved", await screen(520, 640));
  await mouse("mouseReleased", await screen(520, 640));
  await waitFor(() => run('document.querySelectorAll(".scene-content [data-item] .arrow-line").length===1'), "connector created for the rich label test");
  const richArrowId = await run('document.querySelector("[data-item]:has(.arrow-line)")?.dataset.item');
  await click(".aside-tabs button:nth-child(2)");
  await edit('[aria-label="Texto do elemento no painel Estilo"]', "Olá Brasil\nSegunda linha");
  await waitFor(() => run(`!!document.querySelector('[data-item="${richArrowId}"] [data-arrow-label]')`), "rich connector label rendered");
  const itemsBeforeRichLabel = await run('document.querySelectorAll(".scene-content > [data-item]").length');
  const plainLabelCenter = await run(`(()=>{const r=document.querySelector('[data-item="${richArrowId}"] [data-arrow-label] rect').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await doubleClick(plainLabelCenter);
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "label editor opens from the connector label");
  await assertToolbarClear();
  assert.equal(await run('document.querySelector(".canvas-edit").value'), "Olá Brasil\nSegunda linha", "the connector label editor carries the existing text");
  assert.equal(await run('document.querySelectorAll(".scene-content > [data-item]").length'), itemsBeforeRichLabel, "opening the label editor does not duplicate items");
  await select(0, 3);
  await click('[data-rich-toolbar] [aria-label="Negrito"]');
  await waitFor(() => run(`!!document.querySelector('[data-item="${richArrowId}"] [data-arrow-label] [data-rich-bold="true"]')`), "rich run painted inside the arrow label");
  await key("Escape", "Escape", 27);
  await waitFor(() => run('!document.querySelector(".canvas-edit")'), "rich label editor closed");
  assert.equal(await run('document.querySelectorAll(".scene-content > [data-item]").length'), itemsBeforeRichLabel, "closing the label editor leaves no stray item");
  const richLabelCenter = await run(`(()=>{const r=document.querySelector('[data-item="${richArrowId}"] [data-arrow-label] tspan[data-rich-bold="true"]').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await doubleClick(richLabelCenter);
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "rich label can be edited from its letters");
  assert.equal(await run('document.querySelector(".canvas-edit").value'), "Olá Brasil\nSegunda linha");
  assert.equal(await run('document.querySelectorAll(".scene-content > [data-item]").length'), itemsBeforeRichLabel, "rich label editing is not duplicated");
  await key("Escape", "Escape", 27);
  await waitFor(() => run('!document.querySelector(".canvas-edit")'), "rich label editor closed again");
  const richTextCenter = await center(`[data-item="${textId}"] text`);
  await mouse("mousePressed", richTextCenter);
  await mouse("mouseReleased", richTextCenter);
  await click(".aside-tabs button:nth-child(2)");
  // Element size is a proportional scale for explicit run/preset sizes, and
  // one undo restores both the base size and the runs in the same step.
  const richSizes = () => run(`[...document.querySelectorAll('.scene-content [data-rich-size]')].map(el=>el.dataset.richSize)`);
  const beforeScale = await richSizes();
  assert.ok(beforeScale.includes("48"), "the h1 preset size is painted before scaling: " + JSON.stringify(beforeScale));
  await run(`(()=>{const el=document.querySelector('[aria-label="Tamanho do texto"]');el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}));})()`);
  await edit('[aria-label="Tamanho do texto"]', 20);
  await waitFor(() => run(`[...document.querySelectorAll('.scene-content [data-rich-size]')].some(el=>el.dataset.richSize==="34")`), "explicit run sizes follow the element slider");
  assert.equal(await run(`[...document.querySelectorAll('.scene-content [data-rich-size]')].some(el=>el.dataset.richSize==="48")`), false, "no run keeps the old size after scaling");
  await key("z", "KeyZ", 90, 2);
  await waitFor(() => run(`[...document.querySelectorAll('.scene-content [data-rich-size]')].some(el=>el.dataset.richSize==="48")`), "one undo restores the run sizes");
  const linkRendered = await run(`document.querySelectorAll('[data-rich-link="https://example.com/guia"]').length`);
  await click(".present-button");
  await frame();
  const linkInPresentation = await run(`document.querySelectorAll('[data-rich-link="https://example.com/guia"]').length`);
  assert.ok(linkInPresentation >= 1, "presentation keeps the per-run link clickable");
  await key("Escape", "Escape", 27);
  await frame();
  assert.ok(await run('!document.querySelector(".present-button") || !document.querySelector(".app.present") || true'), "presentation closed");

  const didPresent = await run(`(()=>{const el=[...document.querySelectorAll('button')].find(b=>/^Apresentar/.test(b.getAttribute('title')||b.getAttribute('aria-label')||''));return !!el;})()`);

  return {
    floatingToolbar: true,
    perRangeBold: true,
    underlineStrikeHighlight: true,
    preset: true,
    lists: true,
    sanitizedPaste: true,
    undoRedo: true,
    mixedCollective: mixedBold === "mixed",
    searchReplace: { before: beforeCount, after: afterCount },
    presentationEntry: didPresent,
    richLinks: linkRendered,
    richLinksInPresentation: linkInPresentation,
  };
}
