import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { inflateSync } from "node:zlib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export function makeAcceptancePdf() {
  const streams = [
    "q 0.89 0.95 0.91 rg 58 555 496 174 re f Q\n0.17 0.49 0.33 RG 3 w 58 555 496 174 re S\nBT /F1 27 Tf 78 680 Td (Página 1 - ação, conexão e São Paulo) Tj ET\nBT /F1 15 Tf 78 625 Td (PDF local para validar o leitor offline.) Tj ET\n0.17 0.49 0.33 RG 7 w 78 585 m 510 585 l S\n",
    "q 0.91 0.92 0.99 rg 58 535 496 194 re f Q\n0.35 0.36 0.67 RG 3 w 58 535 496 194 re S\nBT /F1 27 Tf 78 680 Td (Página 2 - revisão e conteúdo) Tj ET\nBT /F1 15 Tf 78 625 Td (Acentos: revisão, órgão, útil.) Tj ET\n0.35 0.36 0.67 RG 6 w 78 585 m 510 585 l S\n",
    "q 0.99 0.93 0.87 rg 58 515 496 214 re f Q\n0.72 0.36 0.18 RG 3 w 58 515 496 214 re S\nBT /F1 27 Tf 78 680 Td (Página 3 - exportação completa) Tj ET\nBT /F1 15 Tf 78 625 Td (Fim do documento de teste.) Tj ET\n0.72 0.36 0.18 RG 6 w 78 585 m 510 585 l S\n",
  ];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 4 0 R /Annots [10 0 R] >>",
    `<< /Length ${Buffer.byteLength(streams[0], "latin1")} >>\nstream\n${streams[0]}endstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 6 0 R >>",
    `<< /Length ${Buffer.byteLength(streams[1], "latin1")} >>\nstream\n${streams[1]}endstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents 8 0 R >>",
    `<< /Length ${Buffer.byteLength(streams[2], "latin1")} >>\nstream\n${streams[2]}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Annot /Subtype /Link /Rect [70 665 530 725] /Border [0 0 0] /A << /S /URI /URI (https://example.test/nao-navegar) >> >>",
  ];
  const chunks = [Buffer.from("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((body, index) => {
    offsets.push(length);
    const object = Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, "latin1");
    chunks.push(object);
    length += object.length;
  });
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}

function decodePng(buffer) {
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "export is a real PNG file");
  let width, height, bitDepth, colorType;
  const imageData = [];
  for (let offset = 8; offset < buffer.length;) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") imageData.push(data);
    else if (type === "IEND") break;
    offset += length + 12;
  }
  assert.equal(bitDepth, 8, "PNG uses 8-bit channels supported by the export contract test");
  const channels = ({ 2: 3, 6: 4 })[colorType];
  assert.ok(channels, `PNG uses RGB/RGBA channels, got ${colorType}`);
  const stride = width * channels;
  const packed = inflateSync(Buffer.concat(imageData));
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = packed[rowStart];
    for (let x = 0; x < stride; x++) {
      const raw = packed[rowStart + x + 1];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const above = y ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : paeth(left, above, upperLeft);
      pixels[y * stride + x] = (raw + predictor) & 255;
    }
  }
  return { width, height, channels, stride, pixels };
}

const PASSWORD_PADDING = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41, 0x64, 0x00, 0x4e, 0x56,
  0xff, 0xfa, 0x01, 0x08, 0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function md5(...parts) {
  const hash = createHash("md5");
  for (const part of parts) hash.update(part);
  return hash.digest();
}

function rc4(key, input) {
  const state = Uint8Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + state[i] + key[i % key.length]) & 255;
    [state[i], state[j]] = [state[j], state[i]];
  }
  let i = 0;
  j = 0;
  const output = Buffer.alloc(input.length);
  for (let offset = 0; offset < input.length; offset++) {
    i = (i + 1) & 255;
    j = (j + state[i]) & 255;
    [state[i], state[j]] = [state[j], state[i]];
    output[offset] = input[offset] ^ state[(state[i] + state[j]) & 255];
  }
  return output;
}

function makePasswordPdf(password = "qa-secret") {
  const padded = (value) =>
    Buffer.concat([Buffer.from(value, "latin1"), PASSWORD_PADDING]).subarray(0, 32);
  const fileId = Buffer.from("5f3a67c8d90e1425364758697a8b9cad", "hex");
  const userPassword = padded(password);
  const ownerKey = md5(padded("qa-owner")).subarray(0, 5);
  const ownerEntry = rc4(ownerKey, userPassword);
  const permissions = Buffer.alloc(4);
  permissions.writeInt32LE(-4, 0);
  const fileKey = md5(userPassword, ownerEntry, permissions, fileId).subarray(0, 5);
  const userEntry = rc4(fileKey, PASSWORD_PADDING);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    `<< /Filter /Standard /V 1 /R 2 /O <${ownerEntry.toString("hex")}> /U <${userEntry.toString("hex")}> /P -4 >>`,
  ];
  const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((body, index) => {
    offsets.push(length);
    const object = Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, "latin1");
    chunks.push(object);
    length += object.length;
  });
  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 4 0 R /ID [<${fileId.toString("hex")}><${fileId.toString("hex")}>] >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}

export async function testPdfConnectionsFrames({ cdp, run, waitFor, profile }) {
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
  await run(`window.__acceptanceErrors=[];window.addEventListener('error',e=>window.__acceptanceErrors.push(String(e.message||e.error)));window.addEventListener('unhandledrejection',e=>window.__acceptanceErrors.push(String(e.reason)));`);
  const frame = () => run("Promise.race([new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),new Promise(r=>setTimeout(r,100))])");
  const click = async (selector) => { await run(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Missing '+${JSON.stringify(selector)});element.click()})()`); await frame(); };
  const edit = async (selector, value) => {
    await run(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw Error('Missing '+${JSON.stringify(selector)});const proto=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})()`);
    await frame();
  };
  const mouse = async (type, point, modifiers = 0, clickCount = 1) => {
    await cdp("Input.dispatchMouseEvent", { type, ...point, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount, modifiers });
    await frame();
  };
  const clickItem = async (itemId, modifiers = 0, clickCount = 1) => {
    const point = await centerOfItem(itemId);
    await mouse("mousePressed", point, modifiers, clickCount);
    await mouse("mouseReleased", point, modifiers, clickCount);
  };
  const selectLayer = async (itemId) => {
    await click('button[aria-label="Camadas"]');
    await click(`[data-layer="${itemId}"] .layer-select`);
    await click(".aside-tabs button:nth-child(2)");
    await waitFor(() => run(`document.querySelector('.selection-bar span')?.textContent.includes('1 selecionado')`), `select layer ${itemId}`);
  };
  const centerOf = (selector) => run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  const clickByPointer = async (selector) => {
    const point = await centerOf(selector);
    await mouse("mousePressed", point);
    await mouse("mouseReleased", point);
  };
  const scene = () => run(`(()=>{const library=window.orquestraDesktop.loadLibrary();return library.then(value=>{const project=value.projects.find(entry=>entry.id===value.activeId);const index=(parseInt(document.querySelector('.scene-controls span')?.textContent.trim()||'1',10)||1)-1;return project.board.scenes[index]})})()`);
  const centerOfItem = async (itemId) => {
    return run(`(()=>{const group=document.querySelector('[data-item="${itemId}"]');if(!group)throw Error('Missing scene item ${itemId}');const shape=group.querySelector('rect:not([data-resize]),ellipse,image,foreignObject,path,text')||group;const r=shape.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  };
  const draw = async (tool, a, b) => {
    await click(`[aria-label=${JSON.stringify(tool)}]`);
    await mouse("mousePressed", a);
    await mouse("mouseMoved", b);
    await mouse("mouseReleased", b);
  };
  const download = path.resolve(".qa/acceptance-multipage.pdf");
  await mkdir(".qa", { recursive: true });
  const fixture = makeAcceptancePdf();
  await writeFile(download, fixture);
  await click(".new-section");
  await waitFor(() => run('!!document.querySelector(".section-template-dialog[open]")'), "choose a new section model");
  await click(".template-create-button");
  await waitFor(async () => (await scene()).items.length === 0, "new empty section for acceptance flow");
  await click('button[title="Restaurar zoom 100%"]');
  const canvas = await run(`(()=>{const r=document.querySelector('.canvas').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}})()`);
  const a = { x: canvas.x + canvas.width * 0.25, y: canvas.y + canvas.height * 0.48 };
  const b = { x: canvas.x + canvas.width * 0.20 + 72, y: canvas.y + canvas.height * 0.48 + 58 };
  const c = { x: canvas.x + canvas.width * 0.46, y: canvas.y + canvas.height * 0.48 };
  const d = { x: canvas.x + canvas.width * 0.57 + 72, y: canvas.y + canvas.height * 0.48 + 58 };
  const e = { x: canvas.x + canvas.width * 0.70, y: canvas.y + canvas.height * 0.48 };
  const f = { x: canvas.x + canvas.width * 0.87 + 64, y: canvas.y + canvas.height * 0.48 + 58 };
  const frameA = { x: canvas.x + canvas.width * 0.14, y: canvas.y + canvas.height * 0.31 };
  const frameB = { x: canvas.x + canvas.width * 0.94, y: canvas.y + canvas.height * 0.77 };
  await draw("Moldura", frameA, frameB);
  await draw("Retângulo", a, b);
  await draw("Retângulo", c, d);
  await draw("Elipse", e, f);
  await click(".save-button");
  await delay(450);
  try {
    await waitFor(async () => (await scene()).items.filter((item) => ["frame", "rect", "ellipse"].includes(item.type)).length === 4, "frame and connector targets created");
  } catch (error) {
    const diagnostics = {
      scene: await scene(),
      canvasItems: await run(`[...document.querySelectorAll("[data-item]")].map((element)=>({id:element.dataset.item,selected:element.dataset.selected||null,type:element.querySelector("[data-frame-title]")?"frame-title":element.querySelector("rect")?.getAttribute("class")||null}))`),
      tool: await run('document.querySelector(".toolbar .active")?.getAttribute("aria-label")'),
      sceneControls: await run('document.querySelector(".scene-controls span")?.textContent'),
      canvasBounds: canvas,
    };
    await writeFile(".qa/pdf-connections-frames-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    console.error("Acceptance draw diagnostics", JSON.stringify(diagnostics));
    throw error;
  }
  // The preceding feature flow can leave the shared application view panned.
  // Fit this new fixture section, then restore 100% zoom so the connector
  // endpoints start inside the viewport before the 48%/207% gesture checks.
  await click('button[title="Enquadrar seção (0)"]');
  await click('button[title="Restaurar zoom 100%"]');
  let current = await scene();
  const frameItem = current.items.find((item) => item.type === "frame");
  const [source, target, third] = current.items.filter((item) => ["rect", "ellipse"].includes(item.type));
  assert.ok(frameItem && source && target && third);

  // The visible frame caption opens the explicit style field and is undoable.
  const frameTitlePoint = await centerOf(`[data-item="${frameItem.id}"] [data-frame-title] text`);
  for (const clickCount of [1, 2]) {
    await mouse("mousePressed", frameTitlePoint, 0, clickCount);
    await mouse("mouseReleased", frameTitlePoint, 0, clickCount);
    if (clickCount === 1) await delay(100);
  }
  await waitFor(() => run('document.activeElement?.getAttribute("aria-label")==="Editar título do frame"'), "frame title double-click editor");
  await edit('[aria-label="Editar título do frame"]', "Quadro de validação");
  await run(`document.querySelector('[aria-label="Editar título do frame"]').blur()`);
  await waitFor(async () => (await scene()).items.find((item) => item.id === frameItem.id)?.text === "Quadro de validação", "frame title panel edit");
  assert.equal(await run(`document.querySelectorAll('[data-item="${frameItem.id}"] [data-frame-title]').length`), 1);
  await click(".history button:first-child");
  await waitFor(async () => (await scene()).items.find((item) => item.id === frameItem.id)?.text === "Novo frame", "undo frame title edit");
  await click(".history button:nth-child(2)");
  await waitFor(async () => (await scene()).items.find((item) => item.id === frameItem.id)?.text === "Quadro de validação", "redo frame title edit");
  await click('button[aria-label="Camadas"]');
  await click(`[data-layer="${frameItem.id}"] .layer-select`);
  await click(".aside-tabs button:nth-child(2)");
  await waitFor(() => run('!!document.querySelector(\'[aria-label="Título do frame"]\')'), "select frame after title undo and redo");
  await edit('[aria-label="Título do frame"]', "");
  await waitFor(async () => (await scene()).items.find((item) => item.id === frameItem.id)?.text === "", "empty frame title hides caption");
  await edit('[aria-label="Título do frame"]', "Quadro de validação");
  await click(".save-button");
  await delay(450);
  await writeFile(".qa/frame-title-800x600.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));

  // Selection bar and section controls must share the real canvas center in
  // the requested compact viewport with one and multiple items selected.
  await selectLayer(source.id);
  const layout = async (label) => {
    const value = await run(`(()=>{const canvas=document.querySelector('.canvas').getBoundingClientRect(),bar=document.querySelector('.selection-bar').getBoundingClientRect(),controls=document.querySelector('.scene-controls').getBoundingClientRect();return{canvas:{left:canvas.left,right:canvas.right,center:canvas.left+canvas.width/2},bar:{left:bar.left,right:bar.right,center:bar.left+bar.width/2,bottom:bar.bottom},controls:{center:controls.left+controls.width/2,top:controls.top},width:innerWidth,height:innerHeight}})()`);
    assert.ok(Math.abs(value.bar.center - value.controls.center) <= 2, `${label}: selection center is within 2 px of section controls ${JSON.stringify(value)}`);
    assert.ok(value.bar.left >= value.canvas.left - 1 && value.bar.right <= value.canvas.right + 1, `${label}: selection bar remains in canvas bounds`);
    assert.ok(value.bar.bottom < value.controls.top, `${label}: selection bar does not cover section controls`);
    return value;
  };
  const openSingle = await layout("single selection, sidebar open");
  await writeFile(".qa/selection-bar-800x600-open-single.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await click('button[title="Recolher painel"]');
  const closedSingle = await layout("single selection, sidebar closed");
  await writeFile(".qa/selection-bar-800x600-closed-single.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await run('document.activeElement?.blur();document.body.focus()');
  await cdp("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
  await frame();
  const selectedCount = await run('document.querySelector(".selection-bar span").textContent');
  assert.match(selectedCount, /4 selecionados/, `Ctrl+A selects frame and all three connector targets, currently ${selectedCount}`);
  const closedMultiple = await layout("multiple selection, sidebar closed");
  await writeFile(".qa/selection-bar-800x600-closed-multiple.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await click(".open-sidebar");
  const openMultiple = await layout("multiple selection, sidebar open");
  await writeFile(".qa/selection-bar-800x600-open-multiple.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));

  // Use the four visible ports at 50% zoom, verify target-port feedback, and
  // cancel another preview with Escape without creating an item.
  await selectLayer(source.id);
  await click('button[title="Restaurar zoom 100%"]');
  for (let n = 0; n < 4; n++) await click('button[title="Diminuir zoom"]');
  const sourcePort = await centerOf(`[data-item="${source.id}"] [data-connection-port="east"]`);
  const targetCenter = await centerOfItem(target.id);
  await mouse("mousePressed", sourcePort);
  await mouse("mouseMoved", targetCenter);
  try {
    await waitFor(() => run('!!document.querySelector("[data-connection-target-port]")'), "connection preview highlights a destination port at 50% zoom");
  } catch (error) {
    const diagnostics = {
      sourcePort, targetCenter,
      source: await run(`(()=>{const e=document.querySelector('[data-item="${source.id}"]');const r=e.getBoundingClientRect();return{rect:{x:r.x,y:r.y,w:r.width,h:r.height},ports:[...e.querySelectorAll('[data-connection-port]')].map(p=>({port:p.dataset.connectionPort,r:p.getBoundingClientRect().toJSON()}))}})()`),
      targetCenter,
      scene: await scene(),
      activeTool: await run('document.querySelector(".toolbar .active")?.getAttribute("aria-label")'),
      previews: await run('({connector:!!document.querySelector("[data-connector-preview]"),target:!!document.querySelector("[data-connection-target]"),selected:[...document.querySelectorAll("[data-item][data-selected=true]")].map(e=>e.dataset.item)})'),
    };
    await writeFile(".qa/connector-preview-50-percent-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    console.error("Connector preview diagnostics", JSON.stringify(diagnostics));
    throw error;
  }
  await writeFile(".qa/connector-preview-50-percent.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await mouse("mouseReleased", targetCenter);
  try {
    await waitFor(async () => (await scene()).items.some((item) => item.type === "arrow" && item.from === source.id && item.to === target.id), "port drag connects two nodes");
  } catch (error) {
    console.error("Connector create diagnostics", JSON.stringify({ source, target, scene: await scene(), previews: await run('({gesture:!!document.querySelector("[data-connector-preview]"),target:!!document.querySelector("[data-connection-target]"),selected:[...document.querySelectorAll("[data-item][data-selected=true]")].map(e=>e.dataset.item)})') }));
    await writeFile(".qa/connector-create-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    throw error;
  }
  current = await scene();
  let arrow = current.items.find((item) => item.type === "arrow");
  assert.equal(arrow.fromPort, "east");
  assert.equal(arrow.toPort, "west");
  // Clicking an endpoint enters the same exact-port mode as dragging, shows
  // every eligible destination together, and commits exactly one history step.
  await selectLayer(arrow.id);
  const arrowBeforeClickMode = { from: arrow.from, fromPort: arrow.fromPort, to: arrow.to, toPort: arrow.toPort };
  const fromEndpoint = await centerOf(`[data-item="${arrow.id}"] [data-connector-endpoint="from"]`);
  await mouse("mousePressed", fromEndpoint);
  await mouse("mouseReleased", fromEndpoint);
  await waitFor(() => run('document.querySelectorAll("[data-connection-port]").length>=12'), "clicking the source endpoint reveals all eligible ports");
  assert.equal(await run(`document.querySelectorAll('[data-item="${target.id}"] [data-connection-port]').length`), 0, "the opposite endpoint's node is excluded from destinations");
  await writeFile(".qa/connector-all-ports-click-mode.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
  const chosenPort = await centerOf(`[data-item="${third.id}"] [data-connection-port="south"]`);
  await mouse("mousePressed", chosenPort);
  await mouse("mouseReleased", chosenPort);
  await waitFor(async () => {
    const savedArrow = (await scene()).items.find((item) => item.id === arrow.id);
    return savedArrow?.from === third.id && savedArrow.fromPort === "south";
  }, "click-to-click reconnect uses the exact selected port");
  await click(".history button:first-child");
  await waitFor(async () => {
    const savedArrow = (await scene()).items.find((item) => item.id === arrow.id);
    return savedArrow?.from === arrowBeforeClickMode.from && savedArrow.fromPort === arrowBeforeClickMode.fromPort;
  }, "click-to-click reconnection is one undo step");
  await click(".history button:nth-child(2)");
  await waitFor(async () => (await scene()).items.find((item) => item.id === arrow.id)?.fromPort === "south", "click-to-click reconnection redo");
  await click(".history button:first-child");
  await waitFor(async () => (await scene()).items.find((item) => item.id === arrow.id)?.fromPort === arrowBeforeClickMode.fromPort, "restore the original connector before the remaining acceptance flow");
  await click(".export-button");
  await click(".dropdown button:nth-child(2)");
  const svgPath = path.join(profile, "exports", "Nova seção.svg");
  await waitFor(async () => {
    try { return (await readFile(svgPath)).length > 0; } catch { return false; }
  }, "real SVG section export");
  const svgBytes = await readFile(svgPath);
  const svgMarkup = svgBytes.toString("utf8");
  assert.match(svgMarkup, /data-frame-title="true"/);
  assert.match(svgMarkup, /Quadro de validação/);
  assert.match(svgMarkup, /marker-end=/);
  await writeFile(".qa/acceptance-section.svg", svgMarkup, "utf8");
  await click(".export-button");
  await click(".dropdown button:nth-child(4)");
  const boardTitle = await run('document.querySelector(".document-title").value');
  const safeBoardTitle = boardTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim().slice(0, 100) || "Orquestra";
  const boardPdfPath = path.join(profile, "exports", `${safeBoardTitle}.pdf`);
  try {
    await waitFor(async () => {
      try { return (await readFile(boardPdfPath)).length > 0; } catch { return false; }
    }, "real board PDF export", 30000);
  } catch (error) {
    console.error("PDF export diagnostics", JSON.stringify({ expectedPath: boardPdfPath, status: await run('document.querySelector(".toast,.notification")?.textContent'), title: await run('document.querySelector(".document-title").value') }));
    throw error;
  }
  const boardPdfBytes = await readFile(boardPdfPath);
  assert.equal(boardPdfBytes.subarray(0, 5).toString("ascii"), "%PDF-");
  await writeFile(".qa/acceptance-board.pdf", boardPdfBytes);
  const exportedDocument = await pdfjs.getDocument({ data: new Uint8Array(boardPdfBytes) }).promise;
  const expectedPdfPages = await run('Number(document.querySelector(".scene-controls span").textContent.match(/\\/\\s*(\\d+)/)?.[1])');
  assert.equal(exportedDocument.numPages, expectedPdfPages, "the real board PDF contains one page per section");
  const exportedPdfText = await (await exportedDocument.getPage(exportedDocument.numPages)).getTextContent();
  assert.ok(exportedPdfText.items.some((entry) => "str" in entry && entry.str.includes("Quadro de validação")), "the exported PDF retains the frame title on its actual rendered page");
  // The source endpoint follows a real move and resize at the same low zoom.
  await selectLayer(source.id);
  const sourceBefore = (await scene()).items.find((item) => item.id === source.id);
  const sourceCenter = await centerOfItem(source.id);
  await mouse("mousePressed", sourceCenter, 1);
  await mouse("mouseMoved", { x: sourceCenter.x - 12, y: sourceCenter.y + 10 }, 1);
  await mouse("mouseReleased", { x: sourceCenter.x - 12, y: sourceCenter.y + 10 }, 1);
  await waitFor(async () => (await scene()).items.find((item) => item.id === source.id)?.x !== sourceBefore.x, "move connected source at 48% zoom");
  const sourceMoved = (await scene()).items.find((item) => item.id === source.id);
  const sourceResize = await centerOf(`[data-item="${source.id}"] [data-resize]`);
  await mouse("mousePressed", sourceResize);
  await mouse("mouseMoved", { x: sourceResize.x + 12, y: sourceResize.y + 10 });
  await mouse("mouseReleased", { x: sourceResize.x + 12, y: sourceResize.y + 10 });
  await waitFor(async () => {
    const changed = (await scene()).items.find((item) => item.id === source.id);
    return changed?.w > sourceMoved.w && changed?.h > sourceMoved.h;
  }, "resize connected source at 48% zoom");
  current = await scene();
  arrow = current.items.find((item) => item.id === arrow.id);
  assert.equal(arrow.from, source.id, "moving and resizing the source preserves its connector binding");
  assert.equal(arrow.fromPort, "east");
  const beforeCancel = current.items.length;
  await selectLayer(source.id);
  const sourcePortForCancel = await centerOf(`[data-item="${source.id}"] [data-connection-port="north"]`);
  await mouse("mousePressed", sourcePortForCancel);
  await mouse("mouseMoved", { x: canvas.x + canvas.width * 0.44, y: canvas.y + canvas.height * 0.17 });
  await cdp("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await mouse("mouseReleased", { x: canvas.x + canvas.width * 0.44, y: canvas.y + canvas.height * 0.17 });
  await frame();
  assert.equal((await scene()).items.length, beforeCancel, "Escape removes connector preview without a stored item");

  // Reconnect at 200%, then disconnect and undo/redo the actual endpoint edit.
  await click('button[title="Restaurar zoom 100%"]');
  for (let n = 0; n < 4; n++) await click('button[title="Aumentar zoom"]');
  await selectLayer(arrow.id);
  // At 200%, both the endpoint and destination must be inside the viewport.
  // CDP cannot perform a meaningful mouse gesture beyond the client window.
  await click('[aria-label="Mover canvas"]');
  const connectionPanStart = { x: canvas.x + canvas.width - 70, y: canvas.y + canvas.height - 72 };
  const reconnectTargetPoint = () => run(`(()=>{const r=document.querySelector('[data-item="${third.id}"] ellipse').getBoundingClientRect();return{x:r.left+Math.min(24,r.width/4),y:r.top+r.height/2}})()`);
  for (let attempt = 0; attempt < 8; attempt++) {
    const end = await centerOf(`[data-item="${arrow.id}"] [data-connector-endpoint="to"]`);
    const destination = await reconnectTargetPoint();
    if ([end, destination].every(point => point.x > canvas.x + 85 && point.x < canvas.x + canvas.width - 35 && point.y > canvas.y + 30 && point.y < canvas.y + canvas.height - 85)) break;
    const dx = canvas.x + (85 + canvas.width - 35) / 2 - (end.x + destination.x) / 2;
    const dy = canvas.y + canvas.height * 0.45 - (end.y + destination.y) / 2;
    const panEnd = { x: connectionPanStart.x + Math.max(-220, Math.min(220, dx)), y: connectionPanStart.y + Math.max(-220, Math.min(220, dy)) };
    await mouse("mousePressed", connectionPanStart);
    await mouse("mouseMoved", panEnd);
    await mouse("mouseReleased", panEnd);
  }
  await click('[aria-label="Selecionar"]');
  await selectLayer(arrow.id);
  let endpoint = await centerOf(`[data-item="${arrow.id}"] [data-connector-endpoint="to"]`);
  const thirdCenter = await reconnectTargetPoint();
  await mouse("mousePressed", endpoint);
  await mouse("mouseMoved", thirdCenter);
  try {
    await waitFor(() => run('!!document.querySelector("[data-connection-target-port]")'), "endpoint drag previews the target port at 200% zoom");
  } catch (error) {
    console.error("Connector reconnect diagnostics", JSON.stringify({
      endpoint,
      thirdCenter,
      scene: await scene(),
      targetBounds: await run(`(()=>{const item=document.querySelector('[data-item="${third.id}"]');const node=item?.querySelector('ellipse,rect:not([data-resize])');return{viewport:document.querySelector('.canvas')?.getBoundingClientRect().toJSON(),canvas:document.querySelector('.canvas')?.outerHTML.slice(0,120),item:node?.getBoundingClientRect().toJSON(),hit:document.elementFromPoint(${thirdCenter.x},${thirdCenter.y})?.outerHTML?.slice(0,350)}})()`),
      previewState: await run(`({zoom:document.querySelector('.canvas')?.getAttribute('viewBox'),gesture:!!document.querySelector('[data-connector-preview]'),target:!!document.querySelector('[data-connection-target]'),targetPort:!!document.querySelector('[data-connection-target-port]'),selected:[...document.querySelectorAll('[data-item][data-selected=true]')].map(item=>item.dataset.item),tool:document.querySelector('.toolbar .active')?.getAttribute('aria-label')})`),
    }));
    await writeFile(".qa/connector-reconnect-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    throw error;
  }
  await mouse("mouseReleased", thirdCenter);
  await waitFor(async () => (await scene()).items.find((item) => item.id === arrow.id)?.to === third.id, "selected arrow endpoint reconnects");
  await click(".history button:first-child");
  await waitFor(async () => (await scene()).items.find((item) => item.id === arrow.id)?.to === target.id, "endpoint reconnect undo");
  await click(".history button:nth-child(2)");
  await waitFor(async () => (await scene()).items.find((item) => item.id === arrow.id)?.to === third.id, "endpoint reconnect redo");
  arrow = (await scene()).items.find((item) => item.id === arrow.id);
  // Move and resize the connected target on the canvas; the endpoint remains
  // bound and follows the edited bounds through undo and redo.
  const targetBefore = (await scene()).items.find((item) => item.id === third.id);
  await selectLayer(third.id);
  // At 200% the rightmost shape extends behind the sidebar; pan the board left
  // through the hand tool so a real drag stays inside the canvas viewport.
  await click('[aria-label="Mover canvas"]');
  const panStart = { x: canvas.x + canvas.width - 70, y: canvas.y + canvas.height - 72 };
  let targetScreenCenter = await centerOfItem(third.id);
  for (let attempt = 0; attempt < 8; attempt++) {
    const delta = canvas.x + canvas.width / 2 - targetScreenCenter.x;
    if (Math.abs(delta) < 25) break;
    const panEnd = { x: panStart.x + Math.sign(delta) * Math.min(220, Math.abs(delta)), y: panStart.y };
    await mouse("mousePressed", panStart);
    await mouse("mouseMoved", panEnd);
    await mouse("mouseReleased", panEnd);
    targetScreenCenter = await centerOfItem(third.id);
  }
  assert.ok(targetScreenCenter.x > canvas.x + 25 && targetScreenCenter.x < canvas.x + canvas.width - 25, "pan places the connected target fully inside the canvas");
  await click('[aria-label="Selecionar"]');
  let center = await centerOfItem(third.id);
  await mouse("mousePressed", center, 1);
  await mouse("mouseMoved", { x: center.x - 18, y: center.y + 12 }, 1);
  await mouse("mouseReleased", { x: center.x - 18, y: center.y + 12 }, 1);
  try {
    await waitFor(async () => (await scene()).items.find((item) => item.id === third.id)?.x !== targetBefore.x, "drag selected connected node");
  } catch (error) {
    console.error("Connected node move diagnostics", JSON.stringify({ center, targetBefore, current: (await scene()).items.find((item) => item.id === third.id), selected: await run('[...document.querySelectorAll("[data-item][data-selected=true]")].map(element=>element.dataset.item)'), hit: await run(`document.elementFromPoint(${center.x - 9},${center.y + 6})?.outerHTML?.slice(0,400)`) }));
    await writeFile(".qa/connected-node-move-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    throw error;
  }
  const targetMoved = (await scene()).items.find((item) => item.id === third.id);
  assert.notEqual(targetMoved.x, targetBefore.x, "moving a connected node changes its stored coordinates");
  assert.equal((await scene()).items.find((item) => item.id === arrow.id)?.to, third.id, "the bound endpoint remains connected while its target moves");
  const resize = await centerOf(`[data-item="${third.id}"] [data-resize]`);
  await mouse("mousePressed", resize);
  await mouse("mouseMoved", { x: resize.x + 24, y: resize.y + 18 });
  await mouse("mouseReleased", { x: resize.x + 24, y: resize.y + 18 });
  await waitFor(async () => {
    const current = (await scene()).items.find((item) => item.id === third.id);
    return current?.w > targetMoved.w && current?.h > targetMoved.h;
  }, "resize connected target");
  const targetResized = (await scene()).items.find((item) => item.id === third.id);
  assert.ok(targetResized.w > targetMoved.w && targetResized.h > targetMoved.h, "resizing a connected node preserves its connector binding");
  assert.equal((await scene()).items.find((item) => item.id === arrow.id)?.to, third.id);
  await click(".history button:first-child");
  try {
    await waitFor(async () => (await scene()).items.find((item) => item.id === third.id)?.w === targetMoved.w, "undo connected target resize");
  } catch (error) {
    console.error("Connected target undo diagnostics", JSON.stringify({ targetMoved, targetResized, current: (await scene()).items.find((item) => item.id === third.id), history: await run('[...document.querySelectorAll(".history button")].map(button=>({disabled:button.disabled,title:button.title}))'), selected: await run('[...document.querySelectorAll("[data-item][data-selected=true]")].map(element=>element.dataset.item)') }));
    await writeFile(".qa/connected-target-undo-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    throw error;
  }
  await click(".history button:nth-child(2)");
  await waitFor(async () => (await scene()).items.find((item) => item.id === third.id)?.w === targetResized.w, "redo connected target resize");
  await click(".history button:first-child");
  await click(".history button:first-child");
  await waitFor(async () => (await scene()).items.find((item) => item.id === third.id)?.x === targetBefore.x, "undo and redo connected target movement");
  await click(".history button:nth-child(2)");
  await click(".history button:nth-child(2)");
  await waitFor(async () => (await scene()).items.find((item) => item.id === third.id)?.x === targetMoved.x && (await scene()).items.find((item) => item.id === third.id)?.w === targetResized.w, "redo connected target movement and resize");

  // Disconnect only after proving bound movement and resizing.
  await selectLayer(arrow.id);
  endpoint = await centerOf(`[data-item="${arrow.id}"] [data-connector-endpoint="to"]`);
  const blank = { x: canvas.x + canvas.width * 0.43, y: canvas.y + canvas.height * 0.17 };
  await mouse("mousePressed", endpoint);
  await mouse("mouseMoved", blank);
  await mouse("mouseReleased", blank);
  await waitFor(async () => (await scene()).items.find((item) => item.id === arrow.id)?.to === undefined, "endpoint drag into the open canvas disconnects it");
  current = await scene();
  const detached = current.items.find((item) => item.id === arrow.id);
  assert.ok([detached.x, detached.y, detached.w, detached.h].every(Number.isFinite), "disconnected endpoint has valid free coordinates");
  await click(".history button:first-child");
  await waitFor(async () => (await scene()).items.find((item) => item.id === arrow.id)?.to === third.id, "disconnect undo restores endpoint binding");
  await click(".history button:nth-child(2)");
  await waitFor(async () => (await scene()).items.find((item) => item.id === arrow.id)?.to === undefined, "disconnect redo restores free endpoint");

  // Import an actual three-page local PDF, verify pages/controls/security, and
  // ensure the stored original bytes survive preview and reload unchanged.
  await click('[aria-label="Inserir mídia"]');
  await waitFor(() => run('!!document.querySelector(".insert-modal input[type=file]")'), "media import chooser");
  const tree = await cdp("DOM.getDocument");
  const input = await cdp("DOM.querySelector", { nodeId: tree.root.nodeId, selector: ".insert-modal input[type=file]" });
  await cdp("DOM.setFileInputFiles", { nodeId: input.nodeId, files: [download] });
  await waitFor(async () => (await scene()).items.some((item) => item.type === "file" && item.assetName === "acceptance-multipage.pdf"), "three-page PDF stored as a local attachment");
  await waitFor(() => run('!document.querySelector(".insert-modal")'), "media chooser closes after import");
  current = await scene();
  const pdf = current.items.find((item) => item.type === "file" && item.assetName === "acceptance-multipage.pdf");
  assert.equal(pdf.assetMime, "application/pdf");
  const diskBytes = await readFile(path.join(profile, "media", `${pdf.assetId}.bin`));
  assert.deepEqual(diskBytes, fixture, "the saved original PDF bytes are unchanged");
  const openPdfButton = `[aria-label="Visualizar PDF acceptance-multipage.pdf"]`;
  await click(openPdfButton);
  await waitFor(() => run('document.querySelector(".pdf-viewer")?.textContent.includes("3 páginas")'), "PDF.js loads the local document and page count");
  try {
    await waitFor(() => run(`document.querySelector('[data-pdf-page="1"] canvas')?.dataset.rendered==="true"`), "first PDF page rendered locally");
  } catch (error) {
    console.error("PDF render diagnostics", JSON.stringify(await run(`({status:document.querySelector('.pdf-status')?.textContent,error:document.querySelector('.pdf-error')?.textContent,canvas:document.querySelector('[data-pdf-page="1"] canvas')?.outerHTML,page:document.querySelector('[data-pdf-page="1"]')?.outerHTML?.slice(0,900),scroller:document.querySelector('.pdf-viewer-scroller')?.getBoundingClientRect().toJSON()})`)));
    await writeFile(".qa/pdf-render-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    throw error;
  }
  const firstPage = await run(`(()=>{const c=document.querySelector('[data-pdf-page="1"] canvas');const ctx=c?.getContext('2d');if(!c||!ctx)return null;const d=ctx.getImageData(Math.floor(c.width*.15),Math.floor(c.height*.2),1,1).data;return{width:c.width,height:c.height,pixel:[...d]}})()`);
  assert.ok(firstPage && firstPage.width > 300 && firstPage.height > 300, "the first PDF page is rasterized to a visible canvas");
  assert.deepEqual(await run('document.querySelectorAll(".pdf-viewer a").length'), 0, "PDF link annotations do not become active navigation");
  assert.ok(await run('!document.querySelector(".pdf-viewer").textContent.includes("example.test")'), "external PDF link is not exposed as a navigation action");
  await click('[aria-label="Ajustar à página"]');
  await click('[aria-label="Aumentar zoom do PDF"]');
  await click('[aria-label="Próxima página"]');
  await waitFor(() => run(`document.querySelector('[data-pdf-page="2"] canvas')?.dataset.rendered==="true"`), "second page loads progressively after navigation");
  const pageTwo = await run('document.querySelector(".pdf-viewer-toolbar input")?.value');
  assert.equal(pageTwo, "2");
  await click('[aria-label="Próxima página"]');
  await waitFor(() => run(`document.querySelector('[data-pdf-page="3"] canvas')?.dataset.rendered==="true"`), "third page loads progressively after navigation");
  await waitFor(() => run(`(()=>{const scroller=document.querySelector('.pdf-viewer-scroller').getBoundingClientRect();const page=document.querySelector('[data-pdf-page="3"]').getBoundingClientRect();return page.top>=scroller.top-30&&page.top<scroller.bottom&&document.querySelector('.pdf-viewer-toolbar input').value==='3'})()`), "third PDF page scrolls into the viewer");
  await writeFile(".qa/pdf-viewer-page-3.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await clickByPointer('[aria-label="Tela cheia"]');
  try {
    await waitFor(() => run('document.fullscreenElement?.classList.contains("pdf-viewer")||document.querySelector(".pdf-viewer-backdrop")?.classList.contains("pdf-viewer-fullscreen")'), "PDF reader enters fullscreen");
  } catch (error) {
    console.error("PDF fullscreen diagnostics", JSON.stringify(await run(`({enabled:document.fullscreenEnabled,element:document.fullscreenElement?.className,viewer:document.querySelector('.pdf-viewer')?.className,error:document.querySelector('.pdf-error')?.textContent,button:document.querySelector('[aria-label="Tela cheia"]')?.outerHTML})`)));
    await writeFile(".qa/pdf-fullscreen-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    throw error;
  }
  await writeFile(".qa/pdf-viewer-fullscreen.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await clickByPointer('[aria-label="Sair da tela cheia"]');
  await waitFor(() => run('!document.fullscreenElement&&!document.querySelector(".pdf-viewer-backdrop")?.classList.contains("pdf-viewer-fullscreen")'), "PDF reader exits fullscreen");
  await cdp("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor(() => run('!document.querySelector(".pdf-viewer")'), "Escape closes PDF viewer");
  await clickItem(pdf.id, 0, 2);
  await waitFor(() => run('!!document.querySelector(".pdf-viewer")'), "double-clicking PDF card reopens preview directly");
  await click('[aria-label="Fechar PDF"]');
  await waitFor(() => run('!document.querySelector(".pdf-viewer")'), "PDF reader closes from toolbar");
  await click(".save-button");
  await delay(450);
  const runtimeErrorsBeforeReload = await run("window.__acceptanceErrors || []");
  assert.deepEqual(runtimeErrorsBeforeReload, [], `no browser runtime errors during the active PDF/connector flow: ${JSON.stringify(runtimeErrorsBeforeReload)}`);
  await run("window.__acceptanceReload=true");
  await cdp("Page.reload");
  try {
    await waitFor(() => run('!window.__acceptanceReload&&!!document.querySelector(".document-title")'), "editor reloads after local PDF preview");
  } catch (error) {
    console.error("PDF reload diagnostics", JSON.stringify(await run('({url:location.href,state:document.readyState,title:document.title,reload:window.__acceptanceReload,editor:!!document.querySelector(".document-title"),viewer:!!document.querySelector(".pdf-viewer"),body:document.body.innerText.slice(0,300)})')));
    await writeFile(".qa/pdf-reload-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    throw error;
  }
  const savedLibrary = await run("window.orquestraDesktop.loadLibrary()");
  const savedProject = savedLibrary.projects.find((project) => project.id === savedLibrary.activeId);
  const savedItems = savedProject.board.scenes.flatMap((savedScene) => savedScene.items);
  const pdfSceneIndex = savedProject.board.scenes.findIndex((savedScene) =>
    savedScene.items.some((item) => item.id === pdf.id),
  );
  assert.ok(pdfSceneIndex >= 0, "the persisted PDF is associated with a project section");
  assert.equal(savedItems.find((item) => item.id === frameItem.id)?.text, "Quadro de validação", "frame title persists after reload");
  const persistedPdf = savedItems.find((item) => item.assetId === pdf.assetId);
  assert.ok(persistedPdf, "local PDF remains attached after reload");
  assert.deepEqual(await readFile(path.join(profile, "media", `${pdf.assetId}.bin`)), fixture, "original bytes still match after reopening and reload");
  await run(`window.__acceptanceErrors=[];window.addEventListener('error',e=>window.__acceptanceErrors.push(String(e.message||e.error)));window.addEventListener('unhandledrejection',e=>window.__acceptanceErrors.push(String(e.reason)));`);
  await delay(250);
  const runtimeErrorsAfterReload = await run("window.__acceptanceErrors || []");
  const runtimeErrors = [...runtimeErrorsBeforeReload, ...runtimeErrorsAfterReload];
  assert.deepEqual(runtimeErrors, [], `no browser runtime errors during PDF/connector flow: ${JSON.stringify(runtimeErrors)}`);

  // Exercise the reader's user-facing failure states against the same isolated
  // Electron profile. Restore the valid fixture after simulating a missing sidecar.
  // Reload can reopen a different section; select the exact section persisted
  // with the PDF rather than assuming the active tab survived the reload.
  await click(".aside-tabs button:first-child");
  await click(`.section-list .section-row:nth-child(${pdfSceneIndex + 1})`);
  await waitFor(() => run(`!!document.querySelector(${JSON.stringify(openPdfButton)})`), "return to the section containing the PDF fixture");
  const missingPdfPath = path.join(profile, "media", `${pdf.assetId}.bin`);
  await unlink(missingPdfPath);
  await click(openPdfButton);
  await waitFor(
    () => run('document.querySelector(".pdf-error")?.textContent.includes("não foi encontrado")'),
    "missing PDF asset shows the recovery message in the UI",
  );
  await click('[aria-label="Fechar PDF"]');
  await waitFor(() => run('!document.querySelector(".pdf-viewer")'), "missing PDF viewer closes");
  await writeFile(missingPdfPath, fixture);
  assert.deepEqual(await readFile(missingPdfPath), fixture, "the original PDF bytes are restored after the missing-file case");

  const importPdfFromPath = async (filename, label) => {
    await click('[aria-label="Inserir mídia"]');
    await waitFor(() => run('!!document.querySelector(".insert-modal input[type=file]")'), `${label} import dialog opens`);
    const document = await cdp("DOM.getDocument");
    const input = await cdp("DOM.querySelector", {
      nodeId: document.root.nodeId,
      selector: ".insert-modal input[type=file]",
    });
    await cdp("DOM.setFileInputFiles", {
      nodeId: input.nodeId,
      files: [filename],
    });
    await waitFor(async () => (await scene()).items.some((item) => item.type === "file" && item.assetName === path.basename(filename)), `${label} is stored as a PDF attachment`);
    await waitFor(() => run('!document.querySelector(".insert-modal")'), `${label} import finishes`);
    return (await scene()).items.find((item) => item.type === "file" && item.assetName === path.basename(filename));
  };

  const corruptPath = path.resolve(".qa/acceptance-corrupt.pdf");
  await writeFile(corruptPath, Buffer.from("this file is not a PDF document\n", "utf8"));
  const corruptPdf = await importPdfFromPath(corruptPath, "corrupt PDF");
  await click(`[aria-label="Visualizar PDF ${corruptPdf.assetName}"]`);
  await waitFor(
    () => run('document.querySelector(".pdf-error")?.textContent.includes("inválido ou corrompido")'),
    "corrupt PDF shows a useful UI error while keeping the attachment",
  );
  await click('[aria-label="Fechar PDF"]');
  await waitFor(() => run('!document.querySelector(".pdf-viewer")'), "corrupt PDF viewer closes");

  const passwordPath = path.resolve(".qa/acceptance-password.pdf");
  await writeFile(passwordPath, makePasswordPdf());
  const passwordPdf = await importPdfFromPath(passwordPath, "password protected PDF");
  await click(`[aria-label="Visualizar PDF ${passwordPdf.assetName}"]`);
  await waitFor(() => run('!!document.querySelector("[aria-label=\\"Senha do PDF\\"]")'), "password protected PDF prompts in the UI");
  await edit('[aria-label="Senha do PDF"]', "incorrect-password");
  await click(".pdf-password button");
  await waitFor(
    () => run('document.querySelector(".pdf-password label")?.textContent.includes("Senha incorreta")'),
    "incorrect password produces a specific UI message",
  );
  await edit('[aria-label="Senha do PDF"]', "qa-secret");
  await click(".pdf-password button");
  await waitFor(
    () => run('document.querySelector(".pdf-status")?.textContent==="Arquivo original preservado"&&!!document.querySelector(".pdf-viewer")'),
    "the correct PDF password opens the document successfully",
  );
  assert.equal(await run('document.querySelectorAll(".pdf-pages").length'), 1, "the password-protected PDF renders a page container");
  await click('[aria-label="Fechar PDF"]');
  await waitFor(() => run('!document.querySelector(".pdf-viewer")'), "password PDF viewer closes");

  // Persist an isolated export fixture with an actual image asset and semantic
  // headings outside the original canvas. Then exercise the real UI exporter
  // while each editor-only overlay is active.
  await click(".save-button");
  await delay(350);
  const exportLibrary = await run("window.orquestraDesktop.loadLibrary()");
  const exportProject = exportLibrary.projects.find((project) => project.id === exportLibrary.activeId);
  const exportSceneIndex = 0;
  const exportScene = exportProject.board.scenes[exportSceneIndex];
  assert.ok(exportScene, "the export fixture targets the section persisted by the real Electron app");
  const iconBytes = await readFile("desktop/icon.png");
  const iconAssetId = randomUUID();
  await run(`window.orquestraDesktop.putAsset({id:${JSON.stringify(iconAssetId)},name:"export-contract-icon.png",mime:"image/png",size:${iconBytes.length},data:Uint8Array.from(atob(${JSON.stringify(iconBytes.toString("base64"))}),c=>c.charCodeAt(0))})`);
  const imageId = randomUUID();
  const fromId = randomUUID(), toId = randomUUID(), exportArrowId = randomUUID();
  exportScene.name = "Export bounds contract";
  exportScene.description = "Título longo para exportação real com quebra de linha, conteúdo semântico preservado e limites verificados além do canvas padrão. Este texto continua por várias linhas para testar o recorte no SVG, PNG e PDF.";
  exportScene.subtitle = "Subtítulo de exportação visível e preservado além da área original.";
  exportScene.headingLayout = {
    name: { x: 1450, y: -150, width: 850, fontSize: 50, align: "left" },
    description: { x: 80, y: 90, width: 1200, fontSize: 72, align: "left" },
    subtitle: { x: -360, y: 1210, width: 2500, fontSize: 60, align: "center" },
  };
  exportScene.items.push({
    id: imageId, type: "image", x: -400, y: 1480, w: 200, h: 160,
    text: "Imagem de prova de exportação", color: "#8fe3b5", fill: "transparent", size: 24,
    step: 0, animation: "fade", assetId: iconAssetId, assetName: "export-contract-icon.png",
    assetMime: "image/png", mediaFit: "contain",
  });
  exportScene.items.push(
    { id: fromId, type: "rect", x: 100, y: 180, w: 120, h: 80, text: "Export source", color: "#8fe3b5", fill: "transparent", size: 24, step: 0, animation: "fade" },
    { id: toId, type: "rect", x: 380, y: 180, w: 120, h: 80, text: "Export target", color: "#85b9e2", fill: "transparent", size: 24, step: 0, animation: "fade" },
    { id: exportArrowId, type: "arrow", x: 220, y: 220, w: 160, h: 0, text: "", color: "#8fe3b5", fill: "transparent", size: 24, step: 0, animation: "fade", from: fromId, to: toId, fromPort: "east", toPort: "west" },
  );
  await run(`window.orquestraDesktop.saveLibrary(${JSON.stringify(exportLibrary)})`);
  await run("window.__exportFixtureReload = true");
  await cdp("Page.reload");
  await waitFor(() => run('!window.__exportFixtureReload && !!document.querySelector(".document-title") && !document.querySelector(".pdf-viewer")'), "editor reloads the real SVG/PNG/PDF export fixture");
  await waitFor(() => run(`window.orquestraDesktop.loadLibrary().then(l=>l.projects.find(p=>p.id===l.activeId).board.scenes[${exportSceneIndex}].items.some(i=>i.id===${JSON.stringify(imageId)}))`), "real image asset fixture survives reload");
  await waitFor(async () => (await scene()).id === exportScene.id, "default active section is the export fixture after reload");
  await waitFor(() => run(`!!document.querySelector('[data-item="${imageId}"] image[data-asset]')`), "real image is painted inside the fitted section");
  // Earlier acceptance steps leave the shared view panned; frame this fixture
  // section so every relocated heading is reachable in the 800x600 viewport.
  await click('button[title="Enquadrar seção (0)"]');
  await waitFor(() => run(`(()=>{const e=document.querySelector('[data-scene-heading="description"]');if(!e)return false;const r=e.getBoundingClientRect();return r.width>40&&r.height>8&&r.left>0&&r.top>0&&r.right<innerWidth&&r.bottom<innerHeight})()`), "wrapped heading is framed inside the real canvas viewport before selection");

  const exportPath = (extension) => path.join(profile, "exports", `${exportScene.name}.${extension}`);
  const exportSection = async (format) => {
    const filename = format === "board-pdf"
      ? path.join(profile, "exports", `${(await run('document.querySelector(".document-title").value')).replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim().slice(0, 100) || "Orquestra"}.pdf`)
      : exportPath(format);
    await unlink(filename).catch(() => {});
    await click(".export-button");
    await click(`.dropdown button:nth-child(${format === "svg" ? 2 : format === "png" ? 3 : 4})`);
    await waitFor(async () => {
      try { return (await readFile(filename)).length > 0; } catch { return false; }
    }, `real ${format} export with active editor controls`, 30000);
    return readFile(filename);
  };
  const assertNoEditorOverlays = (markup, label) => {
    for (const helper of [
      "data-selection=", "data-selection-transform=", "data-selection-resize=", "data-alignment-guide=",
      "data-scene-heading-selection=", "data-scene-heading-resize=", "data-connection-ports=",
      "data-connection-port=", "data-connection-target=", "data-connection-target-port=",
      "data-connector-preview=", "data-connector-endpoint=", "data-connector-handles=",
    ]) assert.equal(markup.includes(helper), false, `${label} excludes ${helper}`);
  };
  const assertExpandedViewBox = (markup, label) => {
    const viewBox = markup.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
    assert.ok(viewBox && viewBox.length === 4, `${label} contains a finite SVG frame`);
    const [x, y, width, height] = viewBox;
    assert.ok([x, y, width, height].every(Number.isFinite), `${label} viewBox contains only finite bounds`);
    assert.ok(x <= -400 && y <= -150 && x + width > 2400 && y + height > 1600, `${label} viewBox covers the real image, relocated headers, and subtitle ornament`);
    const subtitleLayout = exportScene.headingLayout.subtitle;
    const underlineRight = subtitleLayout.x + 810 * subtitleLayout.width / 720;
    assert.ok(x + width > underlineRight + 20, `${label} viewBox includes the subtitle underline beyond the configured width`);
  };
  await selectLayer(fromId);
  await clickItem(toId, 2);
  try {
    await waitFor(() => run('!!document.querySelector("[data-selection-transform]") && document.querySelectorAll("[data-selection-resize]").length===8'), "real collective-selection frame and all eight handles are active before SVG/PNG export");
  } catch (error) {
    console.error("Collective export selection diagnostics", JSON.stringify(await run(`({selected:[...document.querySelectorAll('[data-item][data-selected=true]')].map(e=>e.dataset.item),handles:document.querySelectorAll('[data-selection-resize]').length,frame:!!document.querySelector('[data-selection-transform]'),items:[${JSON.stringify(fromId)},${JSON.stringify(toId)}].map(id=>{const e=document.querySelector('[data-item="'+id+'"]');return{id,rect:e?.getBoundingClientRect().toJSON()}}),viewport:{w:innerWidth,h:innerHeight},scene:document.querySelector('.scene-controls span')?.textContent,tool:document.querySelector('.toolbar .active')?.getAttribute('aria-label'),side:!!document.querySelector('.aside-tabs')})`)));
    await writeFile(".qa/export-collective-selection-debug.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
    throw error;
  }
  const collectiveSvg = (await exportSection("svg")).toString("utf8");
  assertNoEditorOverlays(collectiveSvg, "SVG with collective selection active");
  assertExpandedViewBox(collectiveSvg, "live SVG");
  assert.ok(collectiveSvg.includes(`data-item="${imageId}"`) && collectiveSvg.includes("data:image/png;base64,"), "live SVG preserves the actual embedded image and its content while dropping transform handles");
  assert.ok(collectiveSvg.toLocaleUpperCase().includes("EXPORT BOUNDS") && collectiveSvg.includes("CONTRACT") && collectiveSvg.includes("Título longo"), "live SVG preserves semantic section headings and item content across rendered line breaks");
  await writeFile(".qa/export-active-collective.svg", collectiveSvg, "utf8");

  const pngBytes = await exportSection("png");
  const decodedPng = decodePng(pngBytes);
  assert.deepEqual([decodedPng.width, decodedPng.height], [1440, 1000], "real PNG export keeps the requested raster dimensions");
  const backgroundOffset = 0;
  const background = [...decodedPng.pixels.subarray(backgroundOffset, backgroundOffset + decodedPng.channels)];
  let painted = 0;
  for (let y = 0; y < decodedPng.height; y += 2) for (let x = 0; x < decodedPng.width; x += 2) {
    const offset = y * decodedPng.stride + x * decodedPng.channels;
    if (Math.abs(decodedPng.pixels[offset] - background[0]) + Math.abs(decodedPng.pixels[offset + 1] - background[1]) + Math.abs(decodedPng.pixels[offset + 2] - background[2]) > 35) painted++;
  }
  assert.ok(painted > 10000, `real PNG contains rendered content, image and headings rather than only its background (${painted} sampled painted pixels)`);
  await writeFile(".qa/export-active-collective.png", pngBytes);

  const headingPoint = await run(`(()=>{const e=document.querySelector('[data-scene-heading="description"]');if(!e)return null;const r=e.getBoundingClientRect();for(let y=r.top+3;y<r.bottom-2;y+=4)for(let x=r.left+3;x<r.right-2;x+=4){const hit=document.elementFromPoint(x,y);if(hit&&hit.closest('[data-scene-heading="description"]'))return{x,y,rect:r.toJSON(),viewport:{w:innerWidth,h:innerHeight}}}return{rect:r.toJSON(),blocked:document.elementFromPoint(r.left+6,r.top+6)?.outerHTML?.slice(0,140)||null,viewport:{w:innerWidth,h:innerHeight}}})()`);
  assert.ok(headingPoint && Number.isFinite(headingPoint.x) && headingPoint.x > 0 && headingPoint.x < 800 && headingPoint.y > 0 && headingPoint.y < 600, `the semantic heading has an unobstructed glyph hit point after fit: ${JSON.stringify(headingPoint)}`);
  await mouse("mousePressed", headingPoint);
  await mouse("mouseReleased", headingPoint);
  await waitFor(() => run('!!document.querySelector("[data-scene-heading-selection=description]") && !!document.querySelector("[data-scene-heading-resize=description]")'), "real semantic heading selection and resize handle are active before SVG export");
  const headingSvg = (await exportSection("svg")).toString("utf8");
  assertNoEditorOverlays(headingSvg, "SVG with a semantic heading selected");
  assertExpandedViewBox(headingSvg, "heading-selected live SVG");
  assert.ok(headingSvg.includes('data-scene-heading="description"') && headingSvg.includes("Título longo"), "heading text is preserved while only its selection box/resize handle are removed");

  await selectLayer(exportArrowId);
  const exportEndpoint = await centerOf(`[data-item="${exportArrowId}"] [data-connector-endpoint="from"]`);
  await mouse("mousePressed", exportEndpoint);
  await mouse("mouseReleased", exportEndpoint);
  await waitFor(() => run('document.querySelectorAll("[data-connection-port]").length>=4'), "real endpoint-edit mode exposes candidate ports before export");
  const endpointSvg = (await exportSection("svg")).toString("utf8");
  assertNoEditorOverlays(endpointSvg, "SVG with endpoint mode and candidate ports active");
  assert.ok(endpointSvg.includes("marker-end=") && endpointSvg.includes("data:image/png;base64,"), "endpoint-mode SVG keeps the actual connector and image content");
  assertExpandedViewBox(endpointSvg, "endpoint-mode live SVG");
  await writeFile(".qa/export-active-endpoint.svg", endpointSvg, "utf8");

  const pdfBytes = await exportSection("board-pdf");
  assert.equal(pdfBytes.subarray(0, 5).toString("ascii"), "%PDF-", "real board export is a PDF document");
  const exportPdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const exportPage = await exportPdf.getPage(exportSceneIndex + 1);
  const exportText = (await exportPage.getTextContent()).items.filter((entry) => "str" in entry).map((entry) => entry.str).join(" ");
  await writeFile(".qa/export-expanded-board.pdf", pdfBytes);
  const normalizedExportText = exportText.toLocaleUpperCase();
  assert.ok(normalizedExportText.includes("E X P O R T B O U N D S") && normalizedExportText.includes("C O N T R A C T"), `the actual PDF page retains the DM Sans section name placed outside the legacy canvas: ${exportText}`);
  assert.ok(exportText.includes("Títu") && exportText.includes("Sub"), `the actual PDF page retains the handwriting heading/subtitle starts (their subset font cannot expose every glyph to text extraction): ${exportText}`);
  const exportOperatorList = await exportPage.getOperatorList();
  const operationNames = Object.fromEntries(Object.entries(pdfjs.OPS).map(([name, value]) => [value, name]));
  const pathBounds = exportOperatorList.argsArray
    .map((args, index) => ({ name: operationNames[exportOperatorList.fnArray[index]], args }))
    .filter((entry) => entry.name === "constructPath")
    .map((entry) => ({ points: entry.args[1]?.[0], bounds: entry.args[2] }));
  const liveViewBox = collectiveSvg.match(/viewBox="([^"]+)"/)?.[1].split(/\s+/).map(Number);
  assert.ok(liveViewBox && pathBounds.some(({ bounds }) => bounds && Math.abs(bounds[0] - liveViewBox[0]) < 0.02 && Math.abs(bounds[1] - liveViewBox[1]) < 0.02 && Math.abs(bounds[2] - (liveViewBox[0] + liveViewBox[2])) < 0.02 && Math.abs(bounds[3] - (liveViewBox[1] + liveViewBox[3])) < 0.02), "the real PDF embeds the full live SVG frame instead of the legacy crop");
  const underlinePoint = pathBounds.find(({ bounds }) => bounds && bounds[2] > 2400 && bounds[3] > 1000 && bounds[3] < 1300);
  assert.ok(underlinePoint, "the real PDF contains the off-canvas subtitle underline vector");
  assert.ok(exportOperatorList.fnArray.includes(pdfjs.OPS.paintImageXObject), "the real PDF paints the embedded test image");
  assert.ok(exportOperatorList.fnArray.length > 100, "the actual PDF page contains rendered vector/image operators, including the off-canvas ornament and image");

  await cdp("Emulation.clearDeviceMetricsOverride");
  await frame();
  return {
    viewport: { width: 800, height: 600 },
    selectionCenters: { openSingle, closedSingle, openMultiple, closedMultiple },
    connectorGestureZooms: [0.48, 2.07],
    connectorPreviewTargetPort: true,
    connectorClickToClickExactPortAndSingleUndo: true,
    connectorCreatedReconnectedDisconnected: true,
    sourceMoveResize: true,
    connectorMoveResize: true,
    frameTitleEditedClearedUndoRedoPersisted: true,
    staticSvgAndBoardPdfExport: true,
    pdfPages: 3,
    pdfLocalWorker: true,
    pdfProgressiveRender: true,
    pdfFullscreenAndEscape: true,
    pdfLinkActionsDisabled: true,
    pdfOriginalBytesPreserved: true,
    pdfMissingAssetRecoveryMessage: true,
    pdfCorruptFileRecoveryMessage: true,
    pdfPasswordPromptWrongPasswordAndCorrectPassword: true,
    exportHelpersRemovedWithCollectiveHeadingAndEndpointSelections: true,
    exportImageAndSemanticContentPreserved: true,
    liveSvgPngPdfShareExpandedHeaderAndOrnamentBounds: true,
    pngDecodedPaintedPixels: painted,
    runtimeErrors,
  };
}
