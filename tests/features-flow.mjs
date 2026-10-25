import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export async function testFeatures({ cdp, run, waitFor, profile }) {
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  await run("Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise(r=>setTimeout(r,120))])");
  const compactViewport = await run(`(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,toolbar:!!document.querySelector('.toolbar'),canvas:!!document.querySelector('[aria-label="Canvas do whiteboard"]'),labels:[...document.querySelectorAll('.toolbar button[aria-label]')].map(button=>button.getAttribute('aria-label'))}))()`);
  assert.deepEqual([compactViewport.width, compactViewport.height], [800, 600]);
  assert.ok(compactViewport.documentWidth <= 800, `minimum viewport must not overflow horizontally: ${JSON.stringify(compactViewport)}`);
  for (const label of ["Selecionar", "Borracha", "Inserir mídia"]) assert.ok(compactViewport.labels.includes(label), `${label} remains an accessible toolbar control at 800x600`);
  await mkdir(".qa", { recursive: true });
  const compactShot = await cdp("Page.captureScreenshot", { format: "png" });
  await writeFile(".qa/board-800x600.png", Buffer.from(compactShot.data, "base64"));
  await cdp("Emulation.clearDeviceMetricsOverride");
  await run("Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise(r=>setTimeout(r,120))])");
  await run(`window.__qaIntervals=[];window.__qaOriginalSetInterval=window.setInterval.bind(window);window.setInterval=(callback,ms,...args)=>{if(ms===30000)window.__qaIntervals.push(callback);return window.__qaOriginalSetInterval(callback,ms,...args)};window.__qaOriginalDateNow=Date.now;window.__qaFakeNow=window.__qaOriginalDateNow();Date.now=()=>window.__qaFakeNow`);
  const frame = () => run("Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise(r=>setTimeout(r,80))])");
  const click = async (selector) => { await run(`document.querySelector(${JSON.stringify(selector)})?.click()`); await frame(); };
  const edit = async (selector, value) => {
    await run(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(String(value))});el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`);
    await frame();
  };
  const key = async (key, code, virtual, modifiers = 0) => {
    for (const type of ["rawKeyDown", "keyUp"]) await cdp("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: virtual, modifiers });
    await frame();
  };
  const screen = (x, y) => run(`(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('[data-world]').getScreenCTM());return{x:p.x,y:p.y}})()`);
  const mouse = async (type, point, modifiers = 0, clickCount = 1) => { await cdp("Input.dispatchMouseEvent", { type, ...point, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount, modifiers }); await frame(); };
  const centerOf = (selector) => run(`(()=>{const r=document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect();if(!r)throw Error('Missing '+${JSON.stringify(selector)});return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  const clickItem = async (id) => {
    const point = await run(`(()=>{const r=document.querySelector('[data-item="${id}"]').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await mouse("mousePressed", point);
    await mouse("mouseReleased", point);
  };
  const draw = async (tool, a, b) => {
    await click(`[aria-label="${tool}"]`);
    await mouse("mousePressed", await screen(...a));
    await mouse("mouseMoved", await screen(...b));
    await mouse("mouseReleased", await screen(...b));
  };
  const library = () => run("window.orquestraDesktop.loadLibrary()");
  const near = (actual, expected, epsilon = 0.05) => Number.isFinite(actual) && Math.abs(actual - expected) <= epsilon;
  const itemCount = () => run('document.querySelectorAll(".scene-content > [data-item]").length');
  const projectId = async (title) => (await library()).projects.find((project) => project.board.title === title)?.id;
  const activeScene = async () => {
    const saved = await library();
    const project = saved.projects.find((entry) => entry.id === saved.activeId);
    const index = (await run('parseInt(document.querySelector(".scene-controls span")?.textContent.trim()||"1",10)') || 1) - 1;
    return { project, scene: project.board.scenes[index] || project.board.scenes[0] };
  };
  const pointAt = (x, y) => run(`(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('[data-world]').getScreenCTM());return{x:p.x,y:p.y}})()`);
  const setFile = async (selector, files) => {
    const document = await cdp("DOM.getDocument");
    const input = await cdp("DOM.querySelector", { nodeId: document.root.nodeId, selector });
    assert.ok(input.nodeId, `file input ${selector} exists`);
    await cdp("DOM.setFileInputFiles", { nodeId: input.nodeId, files: files.map((file) => path.resolve(file)) });
  };
  const dragBy = async (id, dx, dy, modifiers = 0, inspectGuide = false) => {
    const { scene } = await activeScene();
    const item = scene.items.find((entry) => entry.id === id);
    assert.ok(item, `drag item ${id} exists`);
    const zoom = await run("document.querySelector('[data-world]').getScreenCTM().a");
    const origin = await pointAt(item.x + item.w / 2, item.y + item.h / 2);
    await run(`(()=>{if(window.__qaPointerTraceInstalled)return;window.__qaPointerTraceInstalled=true;window.__qaPointerTrace=[];for(const type of ['pointerdown','pointermove','pointerup'])window.addEventListener(type,event=>window.__qaPointerTrace.push({type,x:event.clientX,y:event.clientY,target:event.target.closest?.('[data-item]')?.getAttribute('data-item')}),true)})()`);
    await run("window.__qaPointerTrace=[]");
    await mouse("mousePressed", origin, modifiers);
    const downState = await run(`({selected:[...document.querySelectorAll('[data-selected=true]')].map(el=>el.dataset.item),tool:document.querySelector('.toolbar button.active')?.getAttribute('aria-label'),matrix:document.querySelector('[data-world]').getScreenCTM().a,editing:!!document.querySelector('.canvas-edit')})`);
    await mouse("mouseMoved", { x: origin.x + dx * zoom, y: origin.y + dy * zoom }, modifiers);
    const guides = inspectGuide ? await run('!!document.querySelector("[data-alignment-guide]")') : false;
    await mouse("mouseReleased", { x: origin.x + dx * zoom, y: origin.y + dy * zoom }, modifiers);
    return { zoom, guides, origin, downState, trace: await run("window.__qaPointerTrace") };
  };

  await click(".projects-trigger");
  await waitFor(() => run('!!document.querySelector(".projects-modal")'), "project manager");
  await edit('[aria-label="Nome do novo projeto"]', "Board features QA");
  await click(".create-project-button");
  await waitFor(() => run('document.querySelector(".document-title")?.value==="Board features QA"'), "empty project");
  await click(".save-button");
  await waitFor(() => projectId("Board features QA"), "project written to desktop library");
  const qaProjectId = await projectId("Board features QA");
  assert.ok(qaProjectId);
  await delay(550);
  assert.equal(await itemCount(), 0);

  // Semantic section headings remain selectable and independently transformable
  // without becoming board items; panel values and real canvas gestures persist.
  const headingStart = (await activeScene()).scene;
  const titleCenter = await centerOf('[data-scene-heading="description"]');
  await mouse("mousePressed", titleCenter);
  await mouse("mouseReleased", titleCenter);
  assert.equal(await run('!!document.querySelector("[data-scene-heading-selection=description]")'), true);
  assert.equal(await itemCount(), 0, "selecting a semantic heading does not create a text item");
  await run(`document.querySelector(${JSON.stringify('[aria-label="Cabeçalho x"]')}).focus()`);
  await edit('[aria-label="Cabeçalho x"]', 260);
  await waitFor(async () => (await activeScene()).scene.headingLayout?.description?.x === 260, "section heading X control persists");
  await click(".history button:first-child");
  await waitFor(async () => !(await activeScene()).scene.headingLayout, "undo restores the legacy default heading layout");
  await click(".history button:nth-child(2)");
  await waitFor(async () => (await activeScene()).scene.headingLayout?.description?.x === 260, "redo restores the heading panel change");
  const movedHeadingBefore = (await activeScene()).scene.headingLayout.description;
  const movedHeadingPoint = await centerOf('[data-scene-heading="description"]');
  const headingZoom = await run("document.querySelector('[data-world]').getScreenCTM().a");
  await mouse("mousePressed", movedHeadingPoint);
  await mouse("mouseMoved", { x: movedHeadingPoint.x + 24, y: movedHeadingPoint.y + 12 });
  await mouse("mouseReleased", { x: movedHeadingPoint.x + 24, y: movedHeadingPoint.y + 12 });
  try {
    await waitFor(async () => (await activeScene()).scene.headingLayout?.description?.x > movedHeadingBefore.x, "semantic heading moves with a real canvas drag");
  } catch (error) {
    const diagnostics = {
      before: movedHeadingBefore,
      after: (await activeScene()).scene.headingLayout,
      pointer: movedHeadingPoint,
      zoom: headingZoom,
      heading: await run(`(()=>{const e=document.querySelector('[data-scene-heading="description"]');return e&&{box:e.getBoundingClientRect().toJSON(),selected:!!document.querySelector('[data-scene-heading-selection="description"]'),editor:!!document.querySelector('.canvas-scene-edit'),active:document.activeElement?.getAttribute('aria-label')}})()`),
      gestures: await run('({tool:document.querySelector(".toolbar .active")?.getAttribute("aria-label"),world:document.querySelector("[data-world]")?.getAttribute("transform")})'),
    };
    await writeFile(".qa/section-heading-move-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    throw new Error(`${error.message}; heading diagnostics: ${JSON.stringify(diagnostics)}`);
  }
  const movedHeading = (await activeScene()).scene.headingLayout.description;
  assert.ok(Math.abs(movedHeading.x - movedHeadingBefore.x - 24 / headingZoom) < 2, "heading movement uses world coordinates at the current zoom");
  const headingResizePoint = await centerOf('[data-scene-heading-resize="description"]');
  await mouse("mousePressed", headingResizePoint);
  await mouse("mouseMoved", { x: headingResizePoint.x + 18, y: headingResizePoint.y + 3 });
  await mouse("mouseReleased", { x: headingResizePoint.x + 18, y: headingResizePoint.y + 3 });
  await waitFor(async () => (await activeScene()).scene.headingLayout?.description?.width > movedHeading.width, "heading resize handle updates width and font");
  assert.ok((await activeScene()).scene.headingLayout.description.fontSize > movedHeading.fontSize);
  const resizedHeading = (await activeScene()).scene.headingLayout.description;
  await click(".history button:first-child");
  await waitFor(async () => (await activeScene()).scene.headingLayout?.description?.width === movedHeading.width, "heading resize is a single undo step");
  await click(".history button:nth-child(2)");
  await waitFor(async () => (await activeScene()).scene.headingLayout?.description?.width === resizedHeading.width, "heading resize redo restores the layout");
  const editedHeadingPoint = await centerOf('[data-scene-heading="description"]');
  await mouse("mousePressed", editedHeadingPoint, 0, 1);
  await mouse("mouseReleased", editedHeadingPoint, 0, 1);
  await delay(100);
  await mouse("mousePressed", editedHeadingPoint, 0, 2);
  await mouse("mouseReleased", editedHeadingPoint, 0, 2);
  await waitFor(() => run('!!document.querySelector(".canvas-scene-edit-description")'), "double-click edits the semantic heading");
  await edit(".canvas-scene-edit-description", "Título com acentuação editado");
  await key("Enter", "Enter", 13);
  await waitFor(async () => (await activeScene()).scene.description === "Título com acentuação editado", "semantic title text edits without a duplicate element");
  assert.equal(await itemCount(), 0);

  const namePoint = await centerOf('[data-scene-heading="name"]');
  await mouse("mousePressed", namePoint);
  await mouse("mouseReleased", namePoint);
  const nameBeforeMove = (await activeScene()).scene.headingLayout?.name || { x: 40, y: 20, width: 420, fontSize: 12 };
  const nameMovePoint = await centerOf('[data-scene-heading="name"]');
  await mouse("mousePressed", nameMovePoint);
  await mouse("mouseMoved", { x: nameMovePoint.x + 16, y: nameMovePoint.y + 8 });
  await mouse("mouseReleased", { x: nameMovePoint.x + 16, y: nameMovePoint.y + 8 });
  await waitFor(async () => (await activeScene()).scene.headingLayout?.name?.x > nameBeforeMove.x, "section name moves from its own canvas field");
  const nameMoved = (await activeScene()).scene.headingLayout.name;
  const nameHandle = await centerOf('[data-scene-heading-resize="name"]');
  await mouse("mousePressed", nameHandle);
  await mouse("mouseMoved", { x: nameHandle.x + 14, y: nameHandle.y + 2 });
  await mouse("mouseReleased", { x: nameHandle.x + 14, y: nameHandle.y + 2 });
  await waitFor(async () => (await activeScene()).scene.headingLayout?.name?.width > nameMoved.width, "section name has an independent resize handle");
  assert.ok((await activeScene()).scene.headingLayout.name.fontSize > nameMoved.fontSize);
  const nameEditPoint = await centerOf('[data-scene-heading="name"]');
  await mouse("mousePressed", nameEditPoint, 0, 1);
  await mouse("mouseReleased", nameEditPoint, 0, 1);
  await delay(100);
  await mouse("mousePressed", nameEditPoint, 0, 2);
  await mouse("mouseReleased", nameEditPoint, 0, 2);
  await waitFor(() => run('!!document.querySelector(".canvas-scene-edit-name")'), "double-click edits the section name field");
  await edit(".canvas-scene-edit-name", "Nome semântico editado");
  await key("Enter", "Enter", 13);
  await waitFor(async () => (await activeScene()).scene.name === "Nome semântico editado", "section name text changes without adding an item");
  await click('[aria-label="Restaurar posição e tamanho de name"]');
  await waitFor(async () => !(await activeScene()).scene.headingLayout?.name, "per-field layout reset restores the name default");
  await click(".history button:first-child");
  await waitFor(async () => !!(await activeScene()).scene.headingLayout?.name, "undo restores the name layout");
  await click(".history button:nth-child(2)");
  await waitFor(async () => !(await activeScene()).scene.headingLayout?.name, "redo restores the name reset");

  await edit('[aria-label="Campo do cabeçalho"]', "subtitle");
  assert.equal(await run('!!document.querySelector("[data-scene-heading=subtitle]")'), false, "an empty new-section subtitle stays absent from the canvas");
  await run(`document.querySelector(${JSON.stringify('[aria-label="Cabeçalho y"]')}).focus()`);
  await edit('[aria-label="Cabeçalho y"]', 190);
  await waitFor(async () => (await activeScene()).scene.headingLayout?.subtitle?.y === 190, "the hidden empty subtitle remains recoverable from the section panel");
  await run(`document.querySelector(${JSON.stringify('aside .section-settings [aria-label="Subtítulo da seção"]')}).focus()`);
  await edit('aside .section-settings [aria-label="Subtítulo da seção"]', "Subtítulo semântico para o teste");
  await waitFor(async () => (await activeScene()).scene.subtitle === "Subtítulo semântico para o teste", "the empty subtitle can be restored through the section panel");
  const subtitlePoint = await centerOf('[data-scene-heading="subtitle"]');
  await mouse("mousePressed", subtitlePoint);
  await mouse("mouseReleased", subtitlePoint);
  const subtitleBefore = (await activeScene()).scene.headingLayout.subtitle;
  const subtitleMovePoint = await centerOf('[data-scene-heading="subtitle"]');
  await mouse("mousePressed", subtitleMovePoint);
  await mouse("mouseMoved", { x: subtitleMovePoint.x + 14, y: subtitleMovePoint.y + 8 });
  await mouse("mouseReleased", { x: subtitleMovePoint.x + 14, y: subtitleMovePoint.y + 8 });
  await waitFor(async () => (await activeScene()).scene.headingLayout?.subtitle?.x > subtitleBefore.x, "visible subtitle moves as a semantic canvas field");
  const subtitleMoved = (await activeScene()).scene.headingLayout.subtitle;
  const subtitleHandle = await centerOf('[data-scene-heading-resize="subtitle"]');
  await mouse("mousePressed", subtitleHandle);
  await mouse("mouseMoved", { x: subtitleHandle.x + 12, y: subtitleHandle.y + 2 });
  await mouse("mouseReleased", { x: subtitleHandle.x + 12, y: subtitleHandle.y + 2 });
  await waitFor(async () => (await activeScene()).scene.headingLayout?.subtitle?.width > subtitleMoved.width, "visible subtitle resizes independently");
  const subtitleEditPoint = await centerOf('[data-scene-heading="subtitle"]');
  await mouse("mousePressed", subtitleEditPoint, 0, 1);
  await mouse("mouseReleased", subtitleEditPoint, 0, 1);
  await delay(100);
  await mouse("mousePressed", subtitleEditPoint, 0, 2);
  await mouse("mouseReleased", subtitleEditPoint, 0, 2);
  await waitFor(() => run('!!document.querySelector(".canvas-scene-edit-subtitle")'), "double-click edits the subtitle field");
  await edit(".canvas-scene-edit-subtitle", "Subtítulo revisado no canvas");
  await key("Enter", "Enter", 13);
  await waitFor(async () => (await activeScene()).scene.subtitle === "Subtítulo revisado no canvas", "subtitle text edits without creating an element");
  await run(`document.querySelector(${JSON.stringify('aside .section-settings [aria-label="Subtítulo da seção"]')}).focus()`);
  await edit('aside .section-settings [aria-label="Subtítulo da seção"]', "");
  await waitFor(async () => (await activeScene()).scene.subtitle === "", "the subtitle remains empty when cleared");
  await waitFor(() => run('!document.querySelector("[data-scene-heading=subtitle]")'), "an empty subtitle is removed from the canvas");
  await writeFile(".qa/section-heading-layout.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
  assert.equal(headingStart.subtitle, "", "new project starts with a deliberately empty subtitle");

  // Arrange mixed board objects with a distribution operation, then align them.
  await draw("Retângulo", [100, 220], [180, 300]);
  await draw("Retângulo", [350, 240], [430, 320]);
  await draw("Retângulo", [650, 380], [730, 460]);
  assert.equal(await itemCount(), 3);
  await delay(550);
  const initialScene = (await activeScene()).scene;
  const initialRects = initialScene.items.filter((item) => item.type === "rect").sort((a, b) => a.x - b.x);
  assert.equal(initialRects.length, 3);
  const [leftRect, middleRect, rightRect] = initialRects;
  await click('[aria-label="Configurações do board"]');
  if (!(await run('document.querySelector("[aria-label=\\"Encaixar na grade\\"]").checked'))) await click('[aria-label="Encaixar na grade"]');
  if (!(await run('document.querySelector("[aria-label=\\"Mostrar guias de alinhamento\\"]").checked'))) await click('[aria-label="Mostrar guias de alinhamento"]');
  await click('button[title="Restaurar zoom 100%"]');
  for (let n = 0; n < 4; n++) await click('button[title="Diminuir zoom"]');
  const lowDrag = await dragBy(middleRect.id, 13, 0);
  assert.ok(lowDrag.zoom > 0.45 && lowDrag.zoom < 0.55, `low zoom was ${lowDrag.zoom}`);
  try {
    await waitFor(async () => near((await activeScene()).scene.items.find((item) => item.id === middleRect.id)?.x, middleRect.x + 10), "grid snap at low zoom");
  } catch (error) {
    const diagnostic = { ...lowDrag, itemBefore: middleRect, itemAfter: (await activeScene()).scene.items.find((item) => item.id === middleRect.id) };
    throw new Error(`${error.message}; ${JSON.stringify(diagnostic)}`);
  }
  await click('button[title="Restaurar zoom 100%"]');
  for (let n = 0; n < 4; n++) await click('button[title="Aumentar zoom"]');
  const highDrag = await dragBy(middleRect.id, 19, 0);
  assert.ok(highDrag.zoom > 1.9 && highDrag.zoom < 2.2, `high zoom was ${highDrag.zoom}`);
  await waitFor(async () => near((await activeScene()).scene.items.find((item) => item.id === middleRect.id)?.x, middleRect.x + 30), "grid snap at high zoom");
  const altDrag = await dragBy(middleRect.id, 19, 0, 1);
  assert.ok(altDrag.zoom > 1.9);
  await waitFor(async () => near((await activeScene()).scene.items.find((item) => item.id === middleRect.id)?.x, middleRect.x + 49), "Alt suspends snap at high zoom");
  const guideTargetX = middleRect.x + 49 + middleRect.w;
  const guideDrag = await dragBy(rightRect.id, guideTargetX - rightRect.x, 0, 0, true);
  const guideState = await activeScene();
  assert.ok(guideDrag.guides, `the real canvas shows an alignment guide while dragging at high zoom: ${JSON.stringify({ guideDrag, settings: guideState.project.board.settings, middle: guideState.scene.items.find((item) => item.id === middleRect.id), right: guideState.scene.items.find((item) => item.id === rightRect.id) })}`);
  await waitFor(async () => near((await activeScene()).scene.items.find((item) => item.id === rightRect.id)?.x, guideTargetX), "alignment guide snap at high zoom");
  await click('button[title="Restaurar zoom 100%"]');
  await key("a", "KeyA", 65, 2);
  assert.equal(await run('document.querySelectorAll("[data-selection-resize]").length'), 8, "a multi-selection exposes corner and edge transform handles");
  const multiBefore = (await activeScene()).scene.items.filter((item) => [leftRect.id, middleRect.id, rightRect.id].includes(item.id));
  const southeast = await centerOf('[data-selection-resize="se"]');
  await mouse("mousePressed", southeast);
  await mouse("mouseMoved", { x: southeast.x + 35, y: southeast.y + 24 });
  await mouse("mouseReleased", { x: southeast.x + 35, y: southeast.y + 24 });
  await waitFor(async () => (await activeScene()).scene.items.find((item) => item.id === leftRect.id)?.w > multiBefore.find((item) => item.id === leftRect.id).w, "collective corner handle resizes real canvas objects");
  const multiResized = (await activeScene()).scene.items.filter((item) => [leftRect.id, middleRect.id, rightRect.id].includes(item.id));
  assert.ok(multiResized.every((item) => [item.x, item.y, item.w, item.h, item.size].every(Number.isFinite)));
  await click(".history button:first-child");
  await waitFor(async () => (await activeScene()).scene.items.filter((item) => [leftRect.id, middleRect.id, rightRect.id].includes(item.id)).every((item) => {
    const original = multiBefore.find((entry) => entry.id === item.id);
    return item.x === original.x && item.y === original.y && item.w === original.w && item.h === original.h;
  }), "collective resize is one undo step");
  await click(".history button:nth-child(2)");
  await waitFor(async () => (await activeScene()).scene.items.find((item) => item.id === leftRect.id)?.w === multiResized.find((item) => item.id === leftRect.id).w, "collective resize redo restores the transform");
  await key("a", "KeyA", 65, 2);
  const cancelHandle = await centerOf('[data-selection-resize="nw"]');
  await mouse("mousePressed", cancelHandle);
  await mouse("mouseMoved", { x: cancelHandle.x - 25, y: cancelHandle.y - 15 });
  await key("Escape", "Escape", 27);
  await mouse("mouseReleased", { x: cancelHandle.x - 25, y: cancelHandle.y - 15 });
  await waitFor(async () => (await activeScene()).scene.items.filter((item) => [leftRect.id, middleRect.id, rightRect.id].includes(item.id)).every((item) => {
    const expected = multiResized.find((entry) => entry.id === item.id);
    return item.x === expected.x && item.y === expected.y && item.w === expected.w && item.h === expected.h;
  }), "Escape cancels a collective resize without committing geometry");
  await writeFile(".qa/selection-resize-multiple.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await key("a", "KeyA", 65, 2);
  await click(".aside-tabs button:nth-child(2)");
  const rectBounds = () => run('[...document.querySelectorAll(".scene-content > [data-item]")].map(g=>{const r=g.querySelector("rect[stroke]");return{x:+r.getAttribute("x"),w:+r.getAttribute("width")}}).sort((a,b)=>a.x-b.x)');
  const beforeDistribution = await rectBounds();
  await click('.distribute-grid button:first-child');
  const distributed = await rectBounds();
  assert.equal(distributed[0].x, beforeDistribution[0].x);
  assert.equal(distributed.at(-1).x, beforeDistribution.at(-1).x);
  const gaps = [distributed[1].x - distributed[0].x - distributed[0].w, distributed[2].x - distributed[1].x - distributed[1].w];
  assert.ok(Math.abs(gaps[0] - gaps[1]) < 1, JSON.stringify({ beforeDistribution, distributed, gaps, selected: await run('[...document.querySelectorAll("[data-item][data-selected=true]")].map(item=>item.dataset.item)'), disabled: await run('document.querySelector(".distribute-grid button:first-child")?.disabled') }));
  await click('[aria-label="Alinhar esquerda"]');
  const aligned = (await rectBounds()).map((item) => item.x);
  assert.ok(Math.max(...aligned) - Math.min(...aligned) < 1, `alignment acts on the selected bounds: ${JSON.stringify(aligned)}`);

  await key("g", "KeyG", 71, 2);
  await waitFor(async () => {
    const project = (await library()).projects.find((entry) => entry.board.title === "Board features QA");
    return project?.board.scenes[0].items.length === 3 && project.board.scenes[0].items.every((item) => item.groupId);
  }, "group saved to desktop library");
  let saved = await library();
  let currentProject = saved.projects.find((project) => project.board.title === "Board features QA");
  const originalItems = currentProject.board.scenes[0].items;
  assert.equal(new Set(originalItems.map((item) => item.groupId)).size, 1);
  assert.ok(originalItems.every((item) => item.groupId));
  assert.equal(await itemCount(), 3);

  // Layer visibility and lock controls remain available for recovery.
  await click('[aria-label="Camadas"]');
  const firstLock = await run('document.querySelector(".layer-row button[aria-label^=\\"Bloquear \\"]")?.getAttribute("aria-label")');
  assert.ok(firstLock);
  await click(`[aria-label=${JSON.stringify(firstLock)}]`);
  await waitFor(async () => (await activeScene()).scene.items.every((item) => item.locked), "all members of the group are locked in the saved project");
  const lockedSnapshot = (await activeScene()).scene.items.map((item) => ({ id: item.id, x: item.x, y: item.y, color: item.color, text: item.text, groupId: item.groupId, locked: item.locked }));
  await key("Delete", "Delete", 46);
  assert.equal(await itemCount(), 3, "locked groups cannot be deleted from keyboard shortcuts");
  await key("d", "KeyD", 68, 2);
  await key("ArrowRight", "ArrowRight", 39);
  await key("g", "KeyG", 71, 10);
  await click(".aside-tabs button:nth-child(2)");
  await edit('[aria-label="Cor personalizada da borda"]', "#ff00ff");
  assert.equal(await run("document.querySelectorAll('[data-resize]').length"), 0, "a locked group exposes no resize handle");
  assert.equal(await run("document.querySelectorAll('[data-selection-resize]').length"), 0, "a locked group exposes no collective resize handles");
  await run(`document.querySelector('[data-item]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`);
  assert.equal(await run('!!document.querySelector(".canvas-edit")'), false, "double-click cannot enter edit mode for a locked member");
  await click('[aria-label="Borracha"]');
  await clickItem((await activeScene()).scene.items[0].id);
  await delay(600);
  await waitFor(async () => {
    const items = (await activeScene()).scene.items;
    return items.length === lockedSnapshot.length && items.every((item) => {
      const prior = lockedSnapshot.find((entry) => entry.id === item.id);
      return prior && item.x === prior.x && item.y === prior.y && item.color === prior.color && item.text === prior.text && item.groupId === prior.groupId && item.locked === prior.locked;
    });
  }, "locked edit, move, copy, grouping, style and eraser routes preserve the group");
  assert.equal(await itemCount(), 3);
  await click('[aria-label="Camadas"]');
  await click('[aria-label^="Desbloquear "]');
  await click('[aria-label^="Ocultar "]');
  assert.equal(await itemCount(), 0, "hidden elements are not rendered in the canvas");
  await click('[aria-label^="Mostrar "]');
  assert.equal(await itemCount(), 3, "hidden groups can be recovered from Layers");
  await run(`(()=>{const strong=document.querySelector(".layer-label strong");strong.dispatchEvent(new MouseEvent("dblclick",{bubbles:true}));})()`);
  await edit('[aria-label="Nome da camada"]', "Camada QA");
  await key("Enter", "Enter", 13);
  await waitFor(() => run('document.querySelector(".layer-list").textContent.includes("Camada QA")'), "layer rename");

  // Text formatting and auto-height apply to the actual item model and DOM.
  await click(".aside-tabs button:nth-child(2)");
  await click('[aria-label="Texto"]');
  await mouse("mousePressed", await screen(760, 420));
  await mouse("mouseReleased", await screen(760, 420));
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "text editing");
  await edit(".canvas-edit", "Texto com acentuação e uma frase longa para testar o ajuste automático de altura\nSegunda linha de conteúdo");
  await key("Escape", "Escape", 27);
  await waitFor(() => run('!document.querySelector(".canvas-edit")'), "text editor closed");
  const textId = await run('document.querySelector(".scene-content > [data-selected=true]")?.dataset.item');
  assert.ok(textId);
  await click('[aria-label="Negrito"]');
  await click('[aria-label="Itálico"]');
  await click('[aria-label="Alinhar texto à centro"]');
  await edit('[aria-label="Espaçamento entre linhas"]', "1.6");
  assert.ok(await run(`(()=>{const text=document.querySelector('[data-item="${textId}"] > text');return text.getAttribute("font-weight")==="700"&&text.getAttribute("font-style")==="italic"&&text.getAttribute("text-anchor")==="middle"})()`));
  await click('[aria-label="Ajustar altura automaticamente"]');
  await click('[aria-label="Ajustar altura automaticamente"]');
  await delay(550);
  const textGeometry = (await library()).projects.find((project) => project.id === qaProjectId).board.scenes[0].items.find((item) => item.id === textId);
  assert.equal(textGeometry.autoHeight, true);
  assert.ok(textGeometry.h > 60, `auto-height should grow long text (${textGeometry.h})`);

  // Save a named appearance and prove applying it does not overwrite content or geometry.
  await clickItem(textId);
  assert.equal(await run('document.querySelector(".save-style-button").disabled'), false, "selected text can save an appearance");
  await click(".save-style-button");
  await edit(".action-dialog input", "Texto QA");
  await click(".action-dialog .primary-action");
  await waitFor(async () => (await library()).projects.find((project) => project.id === qaProjectId)?.styles?.some((style) => style.name === "Texto QA"), "saved style persistence");
  saved = await library();
  currentProject = saved.projects.find((project) => project.id === qaProjectId);
  assert.equal(currentProject.styles[0].name, "Texto QA");
  await click('[aria-label="Texto"]');
  await mouse("mousePressed", await screen(760, 550));
  await mouse("mouseReleased", await screen(760, 550));
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "second text editor");
  await edit(".canvas-edit", "Conteúdo que deve permanecer");
  await key("Escape", "Escape", 27);
  const secondTextId = await run('document.querySelector(".scene-content > [data-selected=true]")?.dataset.item');
  assert.ok(secondTextId);
  await clickItem(secondTextId);
  await waitFor(async () => (await library()).projects.find((project) => project.id === qaProjectId)?.board.scenes[0].items.some((item) => item.id === secondTextId), "second text saved");
  const secondItemBefore = (await library()).projects.find((project) => project.id === qaProjectId).board.scenes[0].items.find((item) => item.id === secondTextId);
  const secondBefore = { text: secondItemBefore.text, x: secondItemBefore.x, y: secondItemBefore.y, w: secondItemBefore.w, h: secondItemBefore.h };
  await click('[title="Aplicar estilo Texto QA"]');
  await waitFor(async () => (await library()).projects.find((project) => project.id === qaProjectId)?.board.scenes[0].items.some((item) => item.id === secondTextId && item.text === secondBefore.text), "style application persistence");
  const secondItemAfter = (await library()).projects.find((project) => project.id === qaProjectId).board.scenes[0].items.find((item) => item.id === secondTextId);
  const secondAfter = { text: secondItemAfter.text, x: secondItemAfter.x, y: secondItemAfter.y, w: secondItemAfter.w, h: secondItemAfter.h };
  assert.deepEqual(secondAfter, secondBefore);

  // Layer buttons change the actual paint order, and saved style deletion is confirmed in the UI.
  await click('[aria-label="Camadas"]');
  const orderBefore = (await activeScene()).scene.items.map((item) => item.id);
  const textLayerIndex = await run(`[...document.querySelectorAll(".layer-row")].findIndex(row=>row.dataset.layer===${JSON.stringify(textId)})`);
  assert.equal(textLayerIndex, 1, "the first text layer sits directly below the most recently created text");
  await click(`[data-layer=${JSON.stringify(textId)}] button[aria-label^="Subir "]`);
  await waitFor(async () => (await activeScene()).scene.items.at(-1)?.id === textId, "layer control moves the selected text above its neighbor");
  const orderAfter = (await activeScene()).scene.items.map((item) => item.id);
  assert.notDeepEqual(orderAfter, orderBefore);
  assert.equal(orderAfter.at(-1), textId);
  await click(".aside-tabs button:nth-child(2)");
  await click('[aria-label="Excluir estilo Texto QA"]');
  await waitFor(() => run('!!document.querySelector(".action-dialog[role=alertdialog]")'), "style delete confirmation opens");
  await click(".action-dialog footer button:first-child");
  assert.ok((await library()).projects.find((project) => project.id === qaProjectId)?.styles?.some((style) => style.name === "Texto QA"), "cancel keeps the style");
  await click('[aria-label="Excluir estilo Texto QA"]');
  await click(".action-dialog .danger-action");
  await waitFor(async () => !(await library()).projects.find((project) => project.id === qaProjectId)?.styles?.some((style) => style.name === "Texto QA"), "confirmed style deletion persists");

  // The connector references two grouped objects and keeps a custom marker color in the export.
  const connectedScene = (await activeScene()).scene;
  const nodes = connectedScene.items.filter((item) => item.groupId === connectedScene.items.find((entry) => entry.groupId)?.groupId);
  assert.ok(nodes.length >= 2);
  await draw("Conectar / seta", [nodes[0].x + nodes[0].w / 2, nodes[0].y + nodes[0].h / 2], [nodes[1].x + nodes[1].w / 2, nodes[1].y + nodes[1].h / 2]);
  await waitFor(() => run('document.querySelectorAll("[data-item] .arrow-line").length===1'), "connected arrow appears");
  const arrowId = await run('document.querySelector("[data-item]:has(.arrow-line)")?.dataset.item');
  await click(".aside-tabs button:nth-child(2)");
  await edit('[aria-label="Cor personalizada da borda"]', "#ff0044");
  await waitFor(async () => (await activeScene()).scene.items.find((item) => item.id === arrowId)?.color === "#ff0044", "custom connector color persists");
  await click('[aria-label="Camadas"]');
  await click(`[data-layer=${JSON.stringify(arrowId)}] button[aria-label^="Bloquear "]`);
  await waitFor(async () => (await activeScene()).scene.items.find((item) => item.id === arrowId)?.locked, "connector lock persists");
  await clickItem(nodes[0].id);
  await key("Delete", "Delete", 46);
  await delay(550);
  const protectedScene = (await activeScene()).scene;
  assert.ok(nodes.every((node) => protectedScene.items.some((item) => item.id === node.id)), "a locked external connector protects the entire grouped endpoint");
  assert.ok(protectedScene.items.some((item) => item.id === arrowId && item.locked), "locked connector remains bound");
  await click(`[data-layer=${JSON.stringify(arrowId)}] button[aria-label^="Desbloquear "]`);

  // One hidden text object and one real image exercise the static media representation.
  await click(".aside-tabs button:nth-child(2)");
  await click('[aria-label="Texto"]');
  await mouse("mousePressed", await screen(940, 450));
  await mouse("mouseReleased", await screen(940, 450));
  await waitFor(() => run('!!document.querySelector(".canvas-edit")'), "hidden PDF marker text editor");
  await edit(".canvas-edit", "HIDDEN_FROM_PDF");
  await key("Escape", "Escape", 27);
  const hiddenTextId = await run('document.querySelector(".scene-content > [data-selected=true]")?.dataset.item');
  assert.ok(hiddenTextId);
  await click('[aria-label="Camadas"]');
  await click(`[data-layer=${JSON.stringify(hiddenTextId)}] button[aria-label^="Ocultar "]`);
  await waitFor(async () => (await activeScene()).scene.items.find((item) => item.id === hiddenTextId)?.hidden, "hidden text persists");
  await click('[aria-label="Inserir mídia"]');
  await waitFor(() => run('!!document.querySelector(".insert-modal input[type=file]")'), "media importer opens");
  await setFile(".insert-modal input[type=file]", ["desktop/icon.png"]);
  await waitFor(() => run('!!document.querySelector("image[data-asset]")'), "real image media is inserted");
  const imageId = await run('document.querySelector("[data-item]:has(image[data-asset])")?.dataset.item');
  await clickItem(imageId);
  await click(".aside-tabs button:nth-child(2)");
  for (const [key, value] of Object.entries({ x: 850, y: 490, w: 170, h: 110 })) await edit(`[aria-label="Elemento ${key}"]`, value);
  await waitFor(async () => (await activeScene()).scene.items.find((item) => item.id === imageId)?.w === 170, "image bounds persist for PDF rendering");
  const imageAssetId = (await activeScene()).scene.items.find((item) => item.id === imageId).assetId;

  await click(".aside-tabs button:first-child");
  await edit('[aria-label="Nome da seção"]', "PDF - Base");
  await waitFor(async () => (await activeScene()).scene.name === "PDF - Base", "PDF section order marker persists");

  // Save one custom template and insert it twice; IDs and connectors are independent.
  await click(".aside-tabs button:first-child");
  await click(".section-templates .template-actions button:nth-child(2)");
  await edit(".action-dialog input", "Modelo QA");
  await click(".action-dialog .primary-action");
  let templateSelect = await run('document.querySelector("[aria-label=\\"Modelo de seção\\"]").value');
  assert.ok(templateSelect);
  await click('[aria-label="Modelo de seção"]');
  const templateOption = await run('[...document.querySelectorAll("[aria-label=\\"Modelo de seção\\"] option")].find(option=>option.textContent==="Modelo QA")?.value');
  assert.ok(templateOption);
  await edit('[aria-label="Modelo de seção"]', templateOption);
  await click(".section-templates .template-actions button:first-child");
  await waitFor(async () => (await library()).projects.find((project) => project.id === qaProjectId).board.scenes.length === 2, "first template insertion");
  await click(".section-templates .template-actions button:first-child");
  await waitFor(async () => (await library()).projects.find((project) => project.id === qaProjectId).board.scenes.length === 3, "second template insertion");
  saved = await library();
  currentProject = saved.projects.find((project) => project.id === qaProjectId);
  const insertedA = currentProject.board.scenes.at(-2);
  const insertedB = currentProject.board.scenes.at(-1);
  assert.equal(insertedA.items.length, insertedB.items.length);
  assert.ok(insertedA.items.every((item, index) => item.id !== insertedB.items[index].id));
  assert.ok(insertedA.items.filter((item) => item.groupId).every((item, _, group) => group.every((peer) => peer.groupId === item.groupId)));

  // Editing one inserted template instance leaves the other instance and saved model unchanged.
  await click(".aside-tabs button:first-child");
  await click(".section-row:nth-child(2)");
  await edit('[aria-label="Nome da seção"]', "PDF - Cópia A");
  await waitFor(async () => (await activeScene()).scene.name === "PDF - Cópia A", "first template instance edited");
  saved = await library();
  currentProject = saved.projects.find((project) => project.id === qaProjectId);
  assert.equal(currentProject.board.scenes.at(-1).name, insertedB.name);
  assert.equal(saved.templates.find((template) => template.name === "Modelo QA").scene.name, "PDF - Base");
  await click(".section-row:nth-child(3)");
  await edit('[aria-label="Nome da seção"]', "PDF - Cópia B");
  await waitFor(async () => (await activeScene()).scene.name === "PDF - Cópia B", "second template instance edited independently");

  // Import an exported library through Project Manager and prove the UI appends remapped projects.
  await click(".projects-trigger");
  await waitFor(() => run('!!document.querySelector(".projects-modal")'), "library import UI opens");
  saved = await library();
  const projectCountBeforeImport = saved.projects.length;
  const importPath = path.resolve(".qa/board-library-import.json");
  await writeFile(importPath, JSON.stringify(saved));
  await run(`([...document.querySelectorAll(".projects-footer button")].find(button=>button.textContent.includes("Importar projetos"))?.click())`);
  await setFile(".projects-modal input[type=file]", [importPath]);
  await waitFor(() => run('!document.querySelector(".projects-modal")'), "library backup import completes in the UI");
  await waitFor(async () => (await library()).projects.length > projectCountBeforeImport, "import appends projects without replacing current work");
  assert.equal((await library()).projects.some((project) => project.id === qaProjectId), true);
  await click(".projects-trigger");
  await waitFor(() => run('!!document.querySelector(".projects-modal")'), "return to the original project after backup import");
  await click(`[data-project=${JSON.stringify(qaProjectId)}] .project-open`);
  await waitFor(async () => (await library()).activeId === qaProjectId, "original project remains intact and can be reopened after import");

  // Freeze only Date.now in the renderer and invoke the real interval callback around the 5-minute boundary.
  await waitFor(() => run("window.__qaIntervals.length > 0"), "automatic version interval registered for the QA project");
  const clockBase = await run("Date.now()");
  const versionsBeforeAuto = await run(`window.orquestraDesktop.listVersions(${JSON.stringify(qaProjectId)})`);
  assert.equal(versionsBeforeAuto.length, 0);
  await edit(".document-title", "Board features QA automático");
  await waitFor(async () => (await library()).projects.find((project) => project.id === qaProjectId)?.board.title === "Board features QA automático", "changed project title persisted before automatic snapshot");
  await run(`window.__qaFakeNow=${clockBase}+5*60*1000-1;window.__qaIntervals.at(-1)()`);
  assert.equal((await run(`window.orquestraDesktop.listVersions(${JSON.stringify(qaProjectId)})`)).length, 0, "the automatic snapshot respects the 5-minute minimum");
  await run(`window.__qaFakeNow+=2;window.__qaIntervals.at(-1)()`);
  await waitFor(async () => (await run(`window.orquestraDesktop.listVersions(${JSON.stringify(qaProjectId)})`)).some((version) => version.source === "automatic"), "automatic snapshot saved through the real desktop store");
  const automatic = (await run(`window.orquestraDesktop.listVersions(${JSON.stringify(qaProjectId)})`)).find((version) => version.source === "automatic");
  assert.equal(automatic.project.board.title, "Board features QA automático");
  assert.equal(automatic.name, "Salvamento automático");
  if (profile) {
    const persisted = JSON.parse(await readFile(path.join(profile, "versions", qaProjectId, `${automatic.id}.json`), "utf8"));
    assert.equal(persisted.project.board.title, "Board features QA automático", "the automatic version exists as a real snapshot file");
  }
  await run("Date.now=window.__qaOriginalDateNow");

  // Manual snapshots survive edits; restoring creates a safety snapshot first.
  await edit(".document-title", "Board features QA");
  await waitFor(async () => (await library()).projects.find((project) => project.id === qaProjectId)?.board.title === "Board features QA", "project title reset for manual restore test");
  await click(".projects-trigger");
  await waitFor(() => run('!!document.querySelector(".projects-modal")'), "project history entry");
  const title = "Board features QA";
  await click(`[aria-label=${JSON.stringify(`Histórico de versões de ${title}`)}]`);
  await waitFor(() => run('!!document.querySelector(".version-modal")'), "version manager");
  await edit('[aria-label="Nome da versão"]', "Antes da alteração");
  await click(".version-create button");
  await waitFor(() => run('document.querySelector(".version-list").textContent.includes("Antes da alteração")'), "manual version saved");
  await click('[aria-label="Fechar histórico"]');
  await run(`(()=>{const row=[...document.querySelectorAll(".project-row")].find(entry=>entry.textContent.includes("Board features QA"));if(!row)throw Error("QA project row missing");row.querySelector(".project-open").click()})()`);
  await frame();
  await edit(".document-title", "Board features QA alterado");
  await delay(650);
  await click(".projects-trigger");
  await waitFor(() => run('!!document.querySelector(".projects-modal")'), "reopen project manager");
  await click('[aria-label="Histórico de versões de Board features QA alterado"]');
  await waitFor(() => run('!!document.querySelector(".version-modal")'), "reopen version manager");
  await edit('[aria-label="Nome da versão"]', "Depois da alteração");
  await click(".version-create button");
  await waitFor(() => run('document.querySelector(".version-list").textContent.includes("Depois da alteração")'), "second manual version saved");
  const beforeRow = await run('!![...document.querySelectorAll(".version-row")].find(row=>row.textContent.includes("Antes da alteração"))?.querySelector("button")');
  assert.equal(beforeRow, true);
  await run(`(()=>{const row=[...document.querySelectorAll(".version-row")].find(entry=>entry.textContent.includes("Antes da alteração"));const button=row?.querySelector("button");if(!button)throw Error("Version restore action missing");button.click();return true})()`);
  await frame();
  await click(".version-confirm .danger-action");
  await waitFor(() => run('!document.querySelector(".version-modal")'), "restore completes");
  await waitFor(() => run('document.querySelector(".document-title")?.value==="Board features QA"'), "original title restored");
  await click(".projects-trigger");
  await waitFor(() => run('!!document.querySelector(".projects-modal")'), "verify restored snapshots");
  await click('[aria-label="Histórico de versões de Board features QA"]');
  await waitFor(() => run('document.querySelector(".version-list").textContent.includes("Segurança antes da restauração")'), "safety version exists");
  const versions = await run(`window.orquestraDesktop.listVersions(${JSON.stringify(qaProjectId)})`);
  assert.ok(versions.some((version) => version.source === "manual"));
  assert.ok(versions.some((version) => version.source === "restore-safety"));

  // A missing media sidecar prevents restore before the safety snapshot or current project can change.
  if (profile && imageAssetId) {
    const mediaFile = path.join(profile, "media", `${imageAssetId}.bin`);
    const mediaBytes = await readFile(mediaFile);
    const versionsBeforeMissingMedia = await run(`window.orquestraDesktop.listVersions(${JSON.stringify(qaProjectId)})`);
    await unlink(mediaFile);
    try {
      await run(`(()=>{const row=[...document.querySelectorAll(".version-row")].find(entry=>entry.textContent.includes("Antes da alteração"));row?.querySelector("button")?.click()})()`);
      await click(".version-confirm .danger-action");
      await waitFor(() => run('document.querySelector(".version-error")?.textContent.includes("não está neste dispositivo")'), "restore reports missing media without replacing the current project");
      assert.equal((await library()).projects.find((project) => project.id === qaProjectId)?.board.title, "Board features QA", "the current project remains unchanged after missing-media restore fails");
      const versionsAfterMissingMedia = await run(`window.orquestraDesktop.listVersions(${JSON.stringify(qaProjectId)})`);
      assert.equal(versionsAfterMissingMedia.length, versionsBeforeMissingMedia.length, "failed restore does not create a safety version");
    } finally {
      await writeFile(mediaFile, mediaBytes);
    }
  }

  await click('[aria-label="Fechar histórico"]');
  await click('[title="Fechar projetos"]');
  await click(".save-button");
  await delay(550);
  await run("window.__featuresReload=true");
  await cdp("Page.reload");
  await waitFor(() => run('!window.__featuresReload&&document.querySelector(".document-title")?.value==="Board features QA"'), "feature persistence after reload");
  saved = await library();
  currentProject = saved.projects.find((project) => project.board.title === "Board features QA");
  assert.ok(currentProject);
  assert.ok(currentProject.board.scenes[0].items.filter((item) => item.groupId).length === 3);
  const persistedHeadings = currentProject.board.scenes[0];
  assert.equal(persistedHeadings.description, "Título com acentuação editado");
  assert.ok(persistedHeadings.headingLayout.description.x > 260 && persistedHeadings.headingLayout.description.width > 720);
  assert.equal(persistedHeadings.subtitle, "");
  assert.equal(persistedHeadings.headingLayout.subtitle.y, subtitleMoved.y, "empty subtitle layout survives project reload");
  assert.equal(currentProject.styles?.some((style) => style.name === "Texto QA"), false);
  assert.equal(saved.templates.some((template) => template.name === "Modelo QA"), true);
  return { viewport800x600: true, horizontalOverflow: false, alignment: true, distribution: true, snapAtZooms: [lowDrag.zoom, highDrag.zoom], altSuspension: true, alignmentGuideSnap: true, persistentGroups: true, lockedDeleteBlocked: true, lockedEditMoveCopyResizeEraserBlocked: true, lockedConnectorProtection: true, layerVisibility: true, layerRename: true, layerReorder: true, textFormatting: true, autoHeight: textGeometry.h, reusableStyle: true, confirmedStyleDeletion: true, templateCloneCount: 2, templateInstanceIsolation: true, backupImportUi: true, automaticVersion: automatic.id, manualAndSafetyVersions: true, missingMediaRestoreBlocked: !!profile, restoreAfterReload: true, pdfAssetId: imageAssetId, hiddenPdfMarkerId: hiddenTextId, customArrowId: arrowId };
}
