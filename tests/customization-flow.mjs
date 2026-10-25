import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

export async function testCustomization({ cdp, run, waitFor }) {
  const frame = () => run("Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise(r=>setTimeout(r,80))])");
  const edit = async (selector, value) => {
    await run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing field: '+${JSON.stringify(selector)});const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(String(value))});el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`);
    await frame();
  };
  const click = async (selector) => {
    await run(`document.querySelector(${JSON.stringify(selector)}).click()`);
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
      if (count === 1) await delay(80);
    }
  };
  const key = async (key, code, virtual, modifiers = 0) => {
    for (const type of ["rawKeyDown", "keyUp"])
      await cdp("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: virtual, modifiers });
    await frame();
  };
  const count = () => run('document.querySelectorAll(".scene-content > [data-item]").length');

  await click(".projects-trigger");
  await waitFor(() => run('!!document.querySelector(".projects-modal")'), "project manager");
  await edit('[aria-label="Nome do novo projeto"]', "Personalização QA");
  await click(".create-project-button");
  await waitFor(() => run('document.querySelector(".document-title")?.value==="Personalização QA"'), "empty customization project");
  await delay(700);
  assert.equal(await count(), 0);
  await doubleClick(await screen(400, 300));
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "quick text editor");
  await edit(".canvas-edit", "Texto inicial");
  await key("Escape", "Escape", 27);
  await waitFor(() => run('!document.querySelector(".canvas-edit")'), "text editor closed");
  assert.equal(await count(), 1, "double-click creates exactly one text item");
  const textId = await run('document.querySelector(".scene-content > [data-item]").dataset.item');
  const textPoint = await run(`(()=>{const r=document.querySelector('[data-item="${textId}"] text').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await doubleClick(textPoint);
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "existing text can be edited again");
  await edit(".canvas-edit", "Texto revisado");
  await key("Escape", "Escape", 27);
  const reeditState = await run(`({text:document.querySelector('[data-item="${textId}"]').textContent,items:[...document.querySelectorAll('.scene-content > [data-item]')].map(el=>({id:el.dataset.item,text:el.textContent}))})`);
  assert.ok(reeditState.text.includes("Texto revisado"), JSON.stringify(reeditState));

  assert.equal(await count(), 1, "editing does not duplicate the item");
  await edit('[aria-label="Texto do elemento no painel Estilo"]', "Texto pelo painel");
  const availableFonts = await run(`[...document.querySelectorAll('[aria-label="Fonte do elemento"] option')].map(o=>o.value)`);
  assert.equal(availableFonts.length, 20, "twenty font options are available");
  assert.equal(new Set(availableFonts).size, 20);
  for (const family of availableFonts) {
    await edit('[aria-label="Fonte do elemento"]', family);
    assert.ok(await run(`document.querySelector('[data-item="${textId}"] text').getAttribute('font-family').includes(${JSON.stringify(family)})`), family + " is applied to the text");
  }
  await edit('[aria-label="Fonte do elemento"]', "Segoe Print");
  assert.ok(await run(`document.querySelector('[data-item="${textId}"] text').getAttribute('font-family').includes('Segoe Print')`));
  assert.ok(await run(`document.querySelector('[data-item="${textId}"]').textContent.includes('Texto pelo painel')`));

  const draw = async (tool, a, b, modifiers = 0) => {
    await click(`[aria-label="${tool}"]`);
    await mouse("mousePressed", await screen(...a), 1, modifiers);
    await mouse("mouseMoved", await screen(...b), 1, modifiers);
    await mouse("mouseReleased", await screen(...b), 1, modifiers);
    return run('document.querySelector(".scene-content > [data-selected=true]").dataset.item');
  };
  const rectangleId = await draw("Retângulo", [100, 450], [320, 570], 8);
  const shape = () => run(`(()=>{const r=document.querySelector('[data-item="${rectangleId}"] > rect[stroke]');return{w:Math.round(+r.getAttribute('width')),h:Math.round(+r.getAttribute('height')),fill:r.getAttribute('fill'),stroke:r.getAttribute('stroke'),opacity:+r.getAttribute('fill-opacity')}})()`);
  assert.equal((await shape()).w, (await shape()).h, "Shift draws a square");
  const resizePoint = await run("(()=>{const r=document.querySelector('[data-resize]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await mouse("mousePressed", resizePoint, 1, 8);
  await mouse("mouseMoved", { x: resizePoint.x + 36, y: resizePoint.y + 18 }, 1, 8);
  await mouse("mouseReleased", { x: resizePoint.x + 36, y: resizePoint.y + 18 }, 1, 8);
  assert.equal((await shape()).w, (await shape()).h, "Shift resize keeps square proportions");
  assert.ok((await shape()).w > 220);
  await key("z", "KeyZ", 90, 2);
  assert.equal((await shape()).w, 220, "one undo restores the resize");
  await mouse("mousePressed", await screen(200, 550));
  await mouse("mouseReleased", await screen(200, 550));
  await edit('[aria-label="Cor personalizada da borda"]', "#1256ab");
  await edit('[aria-label="Cor de preenchimento personalizada"]', "#f3aa22");
  await edit('[aria-label="Opacidade do preenchimento"]', "65");
  assert.deepEqual(await shape(), { w: 220, h: 220, fill: "#f3aa22", stroke: "#1256ab", opacity: 0.65 });
  const circleId = await draw("Elipse", [650, 550], [810, 640], 8);
  const circle = await run(`(()=>{const e=document.querySelector('[data-item="${circleId}"] ellipse');return{rx:+e.getAttribute('rx'),ry:+e.getAttribute('ry')}})()`);
  assert.equal(circle.rx, circle.ry, "Shift draws a circle");

  await click('[aria-label="Agente"]');
  await mouse("mousePressed", await screen(700, 300));
  await mouse("mouseReleased", await screen(700, 300));
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "agent text editor");
  await edit(".canvas-edit", "Agente QA\nSímbolo personalizado");
  await key("Escape", "Escape", 27);
  const agentId = await run('document.querySelector(".scene-content > [data-selected=true]").dataset.item');
  await edit('[aria-label="Símbolo dentro do cartão Agente"]', "brain");
  assert.ok(await run(`!!document.querySelector('[data-item="${agentId}"] .lucide-brain')`));
  const legacyTextColor = await run(`document.querySelector('[data-item="${agentId}"] > text').getAttribute('fill')`);
  await edit('[aria-label="Cor personalizada da borda"]', "#cc3322");
  assert.equal(await run(`document.querySelector('[data-item="${agentId}"] > text').getAttribute('fill')`), legacyTextColor, "border edit preserves legacy text color");
  await edit('[aria-label="Cor personalizada do texto"]', "#224488");
  await edit('[aria-label="Cor personalizada da borda"]', "#1a6f33");
  const agentColors = () => run(`({border:document.querySelector('[data-item="${agentId}"] > rect[stroke]').getAttribute('stroke'),text:document.querySelector('[data-item="${agentId}"] > text').getAttribute('fill')})`);
  assert.deepEqual(await agentColors(), { border: "#1a6f33", text: "#224488" }, "border and text colors are independent");
  assert.equal(await run('!!document.querySelector(".appearance-options")'), false, "element style has no board appearance controls");
  await click('[aria-label="Configurações do board"]');
  assert.ok(await run('!!document.querySelector(".board-settings-panel .appearance-options")'));
  assert.equal(await run('!!document.querySelector(\'[aria-label="Cor personalizada do texto"]\')'), false, "board settings has no element color controls");
  await run("[...document.querySelectorAll('.appearance-options button')].find(b=>b.textContent==='Claro').click()");
  await click('[aria-label="Destaque Azul"]');
  await edit('[aria-label="Fundo do canvas"]', "grid");
  assert.ok(await run('document.querySelector(".app").classList.contains("light") && document.querySelector(".app").classList.contains("accent-blue") && !!document.querySelector(".canvas-grid")'));
  await click(".save-button");
  await delay(350);
  await run("window.__customizationReload=true");
  await cdp("Page.reload");
  await waitFor(() => run('!window.__customizationReload && document.querySelector(".document-title")?.value==="Personalização QA"'), "customization reload");
  assert.ok(await run(`document.querySelector('[data-item="${textId}"] text').getAttribute('font-family').includes('Segoe Print')`));
  assert.deepEqual(await shape(), { w: 220, h: 220, fill: "#f3aa22", stroke: "#1256ab", opacity: 0.65 });
  assert.ok(await run(`!!document.querySelector('[data-item="${agentId}"] .lucide-brain')`));
  assert.deepEqual(await agentColors(), { border: "#1a6f33", text: "#224488" }, "independent colors persist");
  assert.ok(await run('document.querySelector(".app").classList.contains("light") && document.querySelector(".app").classList.contains("accent-blue") && !!document.querySelector(".canvas-grid")'));
  await click('[aria-label="Abrir configurações do board"]');
  assert.ok(await run('!!document.querySelector(".board-settings-panel")'), "header opens board settings");
  await delay(700);
  return { quickText: true, existingTextEditing: true, panelTextEditing: true, fonts: true, fontCount: availableFonts.length, shiftShapes: true, independentFill: true, independentTextColor: true, boardSettings: true, agentSymbol: true, appearance: true, persistence: true };
}
