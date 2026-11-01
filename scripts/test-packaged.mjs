import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import assert from "node:assert/strict";
import electron from "electron";

const sourceMode = process.env.ORQUESTRA_TEST_SOURCE === "1";
const mediaOnly = process.env.ORQUESTRA_TEST_MEDIA_CONTINUITY === "1";
const linkOnly = process.env.ORQUESTRA_TEST_LINK_ONLY === "1";
const pdfOnly = process.env.ORQUESTRA_TEST_PDF_ONLY === "1";
const needsMainInspector = linkOnly || !pdfOnly;
const executable = sourceMode
  ? electron
  : path.resolve(
      process.env.ORQUESTRA_TEST_EXE || "release/win-unpacked/Orquestra.exe",
    );
const profile = await mkdtemp(path.join(os.tmpdir(), "orquestra-packaged-"));
const probe = net.createServer();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
let inspectPort;
if (needsMainInspector) {
  const inspectProbe = net.createServer();
  await new Promise((r) => inspectProbe.listen(0, "127.0.0.1", r));
  inspectPort = inspectProbe.address().port;
  await new Promise((r) => inspectProbe.close(r));
}
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  executable,
  [
    ...(sourceMode ? ["."] : []),
    `--remote-debugging-port=${port}`,
    `--orquestra-test-data=${profile}`,
    ...(needsMainInspector ? [`--inspect=127.0.0.1:${inspectPort}`] : []),
  ],
  { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let ws,
  id = 0;
let mainWs,
  mainId = 0;
const pending = new Map();
const pendingMain = new Map();
const cdpEvents = [];
const cdp = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const key = ++id;
    const timer = setTimeout(() => {
      pending.delete(key);
      reject(new Error("CDP timeout: " + method));
    }, 30000);
    pending.set(key, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: key, method, params }));
  });
const run = async (expression) => {
  const result = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const mainCdp = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const key = ++mainId;
    const timer = setTimeout(() => {
      pendingMain.delete(key);
      reject(new Error("Main-process CDP timeout: " + method));
    }, 30000);
    pendingMain.set(key, { resolve, reject, timer });
    mainWs.send(JSON.stringify({ id: key, method, params }));
  });
const mainRun = async (expression) => {
  const result = await mainCdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
async function waitFor(fn, label, timeoutMs = 12000) {
  for (let n = 0; n < Math.ceil(timeoutMs / 100); n++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    await delay(100);
  }
  throw new Error("Timeout: " + label);
}
try {
  const target = await waitFor(async () => {
    const list = await (
      await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    return list.find(
      (t) => t.type === "page" && t.url.endsWith("orquestra.html"),
    );
  }, "desktop debugger");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const task = pending.get(message.id);
    if (task) {
      pending.delete(message.id);
      clearTimeout(task.timer);
      message.error
        ? task.reject(new Error(JSON.stringify(message.error)))
        : task.resolve(message.result);
    } else if (message.method) {
      cdpEvents.push(message);
    }
  };
  await waitFor(
    () => run('!!document.querySelector(".projects-trigger")'),
    "packaged editor",
  );
  async function connectMainInspector() {
    const target = await waitFor(async () => {
      const list = await (await fetch(`http://127.0.0.1:${inspectPort}/json/list`)).json();
      return list.find((entry) => entry.type === "node" && entry.webSocketDebuggerUrl);
    }, "Electron main-process inspector");
    mainWs = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      mainWs.onopen = resolve;
      mainWs.onerror = reject;
    });
    mainWs.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const task = pendingMain.get(message.id);
      if (!task) return;
      pendingMain.delete(message.id);
      clearTimeout(task.timer);
      message.error
        ? task.reject(new Error(JSON.stringify(message.error)))
        : task.resolve(message.result);
    };
    return mainWs;
  }
  if (process.env.ORQUESTRA_TEST_AI === "1") {
    await connectMainInspector();
    const { testAiFlow } = await import("../tests/ai-flow.mjs");
    const evidence = await testAiFlow({ cdp, run, mainRun, waitFor, profile, cdpEvents });
    await mkdir(".qa", { recursive: true });
    await writeFile(".qa/ai-flow.json", JSON.stringify({ passed: true, executable, evidence }, null, 2));
    console.log(JSON.stringify({ passed: true, executable, ai: evidence }, null, 2));
  } else if (process.env.ORQUESTRA_TEST_OPERATOR === "1") {
    await connectMainInspector();
    const { testOperatorConsole } = await import("../tests/operator-flow.mjs");
    const evidence = await testOperatorConsole({ cdp, run, mainRun, waitFor, profile, cdpEvents });
    await mkdir(".qa", { recursive: true });
    await writeFile(".qa/operator-flow.json", JSON.stringify({ passed: true, executable, evidence }, null, 2));
    console.log(JSON.stringify({ passed: true, executable, operator: evidence }, null, 2));
  } else if (process.env.ORQUESTRA_TEST_PRESENTER === "1") {
    await connectMainInspector();
    const { testPresenterBridge } = await import("../tests/presenter-bridge-flow.mjs");
    const evidence = await testPresenterBridge({ cdp, run, mainRun, waitFor, profile, cdpEvents });
    await mkdir(".qa", { recursive: true });
    await writeFile(".qa/presenter-flow.json", JSON.stringify({ passed: true, executable, evidence }, null, 2));
    console.log(JSON.stringify({ passed: true, executable, presenter: evidence }, null, 2));
  } else if (mediaOnly) {
    const { testMediaContinuity } = await import("../tests/media-continuity-flow.mjs");
    const evidence = await testMediaContinuity({ cdp, run, waitFor, profile, cdpEvents });
    console.log(JSON.stringify({ passed: true, mediaContinuity: evidence }, null, 2));
  } else if (linkOnly) {
    await connectMainInspector();
    const { testLinkPreview } = await import("../tests/link-preview-flow.mjs");
    const evidence = await testLinkPreview({
      cdp,
      run,
      waitFor,
      profile,
      cdpEvents,
      mainRun,
      youtubePlayback: process.env.ORQUESTRA_TEST_YOUTUBE_PLAYBACK === "1",
    });
    await mkdir(".qa", { recursive: true });
    await writeFile(".qa/link-preview-flow.json", JSON.stringify({ passed: true, evidence }, null, 2));
    console.log(JSON.stringify({ passed: true, linkPreview: evidence }, null, 2));
  } else if (pdfOnly) {
    const { testPdfConnectionsFrames } = await import("../tests/acceptance-flow.mjs");
    const evidence = await testPdfConnectionsFrames({ cdp, run, waitFor, profile });
    await writeFile(".qa/pdf-connections-frames-flow.json", JSON.stringify({ passed: true, evidence }, null, 2));
    console.log(JSON.stringify({ passed: true, pdfConnectionsFrames: evidence }, null, 2));
  } else {
  await run("document.fonts.ready.then(()=>true)");
  const initial = await run(
    '({desktop:!!window.orquestraDesktop,node:typeof window.require,fonts:[...document.fonts].map(f=>f.status),title:document.title,projects:document.querySelector(".document-title").value})',
  );
  assert.equal(initial.desktop, true);
  assert.equal(initial.node, "undefined");
  assert.ok(
    initial.fonts.every((status) => status === "loaded"),
    "Packaged fonts must load",
  );
  await run(`document.querySelector('.projects-trigger').click()`);
  await waitFor(
    () => run('!!document.querySelector(".projects-modal")'),
    "packaged project manager",
  );
  await run(
    `(()=>{const input=document.querySelector('[aria-label="Nome do novo projeto"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Projeto Windows');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await delay(100);
  await run(`document.querySelector('.create-project-button').click()`);
  await waitFor(
    () =>
      run(
        `document.querySelector('.document-title').value==='Projeto Windows'`,
      ),
    "packaged creation",
  );
  // Exercise the actual packaged file chooser, media sidecars, playback and animation controls.
  await run(`document.querySelector('[aria-label="Inserir ícones"]').click()`);
  await waitFor(
    () => run('document.querySelectorAll(".icon-grid button").length>=100'),
    "icon library",
  );
  await run(
    `document.querySelector('[aria-label="Inserir ícone Robô agente"]').click()`,
  );
  await waitFor(
    () => run('!!document.querySelector("[data-item] svg.lucide-bot")'),
    "icon inserted",
  );
  await run(`document.querySelector('[aria-label="Inserir mídia"]').click()`);
  await waitFor(
    () => run('!!document.querySelector(".insert-modal input[type=file]")'),
    "media chooser",
  );
  await mkdir(".qa", { recursive: true });
  const wav = Buffer.alloc(44 + 16000);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  for (let n = 0; n < 8000; n++)
    wav.writeInt16LE(
      Math.round(Math.sin((n * 2 * Math.PI * 440) / 8000) * 4000),
      44 + n * 2,
    );
  await writeFile(".qa/native.wav", wav);
  const document = await cdp("DOM.getDocument");
  const input = await cdp("DOM.querySelector", {
    nodeId: document.root.nodeId,
    selector: ".insert-modal input[type=file]",
  });
  await cdp("DOM.setFileInputFiles", {
    nodeId: input.nodeId,
    files: [
      "desktop/icon.png",
      "tests/fixtures/sample.webm",
      ".qa/native.wav",
      "README.md",
    ].map((f) => path.resolve(f)),
  });
  await waitFor(
    () =>
      run(
        '!!document.querySelector("image[data-asset]") && document.querySelector("video")?.readyState>=2 && document.querySelector("audio")?.readyState>=2',
      ),
    "media loaded",
  );
  await run('document.querySelector("video").play()');
  await delay(400);
  assert.ok(
    await run('document.querySelector("video").currentTime>0'),
    "video advances",
  );
  await run(
    'document.querySelector("video").pause();document.querySelector("audio").play()',
  );
  await waitFor(
    () => run('document.querySelector("audio").currentTime>0'),
    "audio playback",
  );
  assert.ok(
    await run('document.querySelector("audio").currentTime>0'),
    "audio advances",
  );
  await run('document.querySelector("audio").pause()');
  const edit = async (selector, value) => {
    await run(
      `(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw Error("Campo ausente: "+${JSON.stringify(selector)});const proto=input instanceof HTMLSelectElement?HTMLSelectElement.prototype:input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`,
    );
    await delay(50);
  };
  const editCanvasHeading = async (field, value, expected) => {
    const label = {
      name: "Nome da seção no canvas",
      description: "Título da seção no canvas",
      subtitle: "Subtítulo da seção no canvas",
    }[field];
    const selector = `text.scene-heading-editable[aria-label=${JSON.stringify(label)}]`;
    const point = await run(
      `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`,
    );
    for (const clickCount of [1, 2]) {
      await cdp("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: point.x,
        y: point.y,
        button: "left",
        buttons: 1,
        clickCount,
      });
      await cdp("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: point.x,
        y: point.y,
        button: "left",
        buttons: 0,
        clickCount,
      });
      if (clickCount === 1) await delay(100);
    }
    const inputSelector = ".canvas-scene-edit";
    await waitFor(
      () => run(`!!document.querySelector(${JSON.stringify(inputSelector)})`),
      `${field} heading editor`,
    );
    await edit(inputSelector, value);
    await run(
      `document.querySelector(${JSON.stringify(inputSelector)}).dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`,
    );
    await waitFor(
      () =>
        run(
          `document.querySelector(${JSON.stringify(selector)}).textContent.includes(${JSON.stringify(expected)})`,
        ),
      `${field} heading update`,
    );
  };
  await editCanvasHeading(
    "name",
    "Seção editada no canvas",
    "SEÇÃO EDITADA NO CANVAS",
  );
  await editCanvasHeading(
    "description",
    "Título alterado pelo canvas",
    "Título alterado pelo canvas",
  );
  await run('document.querySelector(".aside-tabs button").click()');
  await delay(60);
  await edit(
    '.section-settings textarea[aria-label="Subtítulo da seção"]',
    "Subtítulo inicial da seção.",
  );
  await waitFor(
    () =>
      run(
        'document.querySelector(\'text[aria-label="Subtítulo da seção no canvas"]\')?.textContent.includes("Subtítulo inicial da seção.")',
      ),
    "subtitle from section panel",
  );
  await editCanvasHeading(
    "subtitle",
    "Subtítulo editado no canvas.",
    "Subtítulo editado no canvas.",
  );
  const arrange = async (selector, geometry) => {
    await run(
      `document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
    );
    await delay(60);
    for (const [key, value] of Object.entries(geometry))
      await edit(`[aria-label="Elemento ${key}"]`, value);
  };
  await arrange("[data-item]:has(image[data-asset])", {
    x: 100,
    y: 210,
    w: 230,
    h: 230,
  });
  await arrange("[data-item]:has(video)", { x: 420, y: 200, w: 480, h: 270 });
  await arrange("[data-item]:has(audio)", { x: 100, y: 545, w: 400, h: 100 });
  await arrange("[data-item]:has(.media-file)", {
    x: 580,
    y: 545,
    w: 340,
    h: 130,
  });
  await arrange("[data-item]:has(svg.lucide-bot)", {
    x: 970,
    y: 250,
    w: 100,
    h: 100,
  });
  await edit('[aria-label="Animação de entrada"]', "bounce");
  await run('document.querySelector(".preview-motion").click()');
  assert.ok(await run('!!document.querySelector("[data-item].bounce")'));
  await run('document.querySelector(".preview-motion").click()');
  await run('document.querySelector(".aside-tabs button").click()');
  await delay(60);
  await run('document.querySelector(".section-timing summary").click()');
  assert.ok(await run(`document.querySelector('[aria-label="Transição da seção"]').getBoundingClientRect().height>0`));
  await edit('[aria-label="Transição da seção"]', "slide");
  await run('document.querySelector(".section-timing summary").click()');
  await edit(
    '[aria-label="Título da seção"]',
    "Ícones, imagens, vídeo e áudio.",
  );
  await run('document.querySelector(".new-section").click()');
  await waitFor(() => run('!!document.querySelector(".section-template-dialog[open]")'), "new section template dialog");
  await run('document.querySelector(".template-create-button").click()');
  await delay(60);
  await run('document.querySelector(".scene-controls button").click()');
  await delay(60);
  assert.ok(
    await run(
      'document.querySelector(".scene-content").classList.contains("transition-slide")',
    ),
  );
  await run(`document.querySelector('[aria-label="Conectar / seta"]').click()`);
  await cdp("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: 700,
    y: 560,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: 950,
    y: 560,
    buttons: 1,
  });
  await cdp("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: 950,
    y: 560,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  await run(
    'document.querySelector(".aside-tabs button:nth-child(2)").click()',
  );
  await delay(60);
  await edit('[aria-label="Movimento da seta"]', "particles");
  await run('document.querySelector(".preview-motion").click()');
  assert.equal(
    await run('document.querySelectorAll(".arrow-particle").length'),
    3,
  );
  const reducedMotion = await run(
    'matchMedia("(prefers-reduced-motion: reduce)").matches',
  );
  if (!reducedMotion) {
    const before = await run(
      '(()=>{const m=document.querySelector(".arrow-particle").getCTM();return{x:m.e,y:m.f}})()',
    );
    await waitFor(async () => {
      const after = await run(
        '(()=>{const m=document.querySelector(".arrow-particle").getCTM();return{x:m.e,y:m.f}})()',
      );
      return Math.hypot(after.x - before.x, after.y - before.y) > 0.1;
    }, "particle moves along arrow");
  }
  await run('document.querySelector(".preview-motion").click()');
  await run(`document.querySelector('.save-button').click()`);
  const file = path.join(profile, "biblioteca.json");
  await waitFor(async () => {
    const l = JSON.parse(await readFile(file, "utf8"));
    return (
      l.projects.length === 2 &&
      l.projects.some((project) =>
        project.board.scenes.some(
          (savedScene) =>
            savedScene.subtitle === "Subtítulo editado no canvas.",
        ),
      )
    );
  }, "packaged save");
  const savedLibrary = JSON.parse(await readFile(file, "utf8"));
  assert.ok(
    savedLibrary.projects.some((project) =>
      project.board.scenes.some(
        (savedScene) => savedScene.subtitle === "Subtítulo editado no canvas.",
      ),
    ),
    "section subtitle persists to the packaged library",
  );
  await run("window.__beforeReload=true");
  await cdp("Page.reload");
  await waitFor(
    () =>
      run(
        `!window.__beforeReload && document.querySelector('.document-title')?.value==='Projeto Windows'`,
      ),
    "packaged reload",
  );
  await waitFor(
    () =>
      run(
        'document.querySelector("video")?.readyState>=2 && !!document.querySelector("image[data-asset]")',
      ),
    "media survives reload",
  );
  const mediaEvidence = {
    image: await run('document.querySelectorAll("image[data-asset]").length'),
    video: await run('document.querySelector("video").readyState'),
    audio: await run('document.querySelector("audio").readyState'),
    reload: true,
  };
  await delay(650);
  const { testSelection } = await import("../tests/selection-flow.mjs");
  const selectionEvidence = await testSelection({ cdp, run, waitFor });
  const { testFeatures } = await import("../tests/features-flow.mjs");
  const featureEvidence = await testFeatures({ cdp, run, waitFor, profile });
  const { testPdfConnectionsFrames } = await import("../tests/acceptance-flow.mjs");
  const pdfConnectionsFramesEvidence = await testPdfConnectionsFrames({ cdp, run, waitFor, profile });
  await connectMainInspector();
  const { testLinkPreview } = await import("../tests/link-preview-flow.mjs");
  const linkPreviewEvidence = await testLinkPreview({
    cdp,
    run,
    waitFor,
    profile,
    cdpEvents,
    mainRun,
    youtubePlayback: process.env.ORQUESTRA_TEST_YOUTUBE_PLAYBACK === "1",
  });
  await writeFile(".qa/link-preview-flow.json", JSON.stringify({ passed: true, evidence: linkPreviewEvidence }, null, 2));
  const boardShot = await cdp("Page.captureScreenshot", { format: "png" });
  await writeFile(
    ".qa/windows-media-board.png",
    Buffer.from(boardShot.data, "base64"),
  );
  await run(`document.querySelector('[aria-label="Inserir ícones"]').click()`);
  await waitFor(
    () => run('document.querySelectorAll(".icon-grid button").length>=100'),
    "icon screenshot",
  );
  await delay(300);
  const iconShot = await cdp("Page.captureScreenshot", { format: "png" });
  await writeFile(
    ".qa/windows-icon-library.png",
    Buffer.from(iconShot.data, "base64"),
  );
  await run(`document.querySelector('[title="Fechar inserção"]').click()`);
  await run(`document.querySelector('.projects-trigger').click()`);
  await delay(100);
  await run('document.querySelector(".project-options summary").click()');
  await edit('[aria-label="Transição entre projetos"]', "flip");
  await run(
    `document.querySelector('.project-row:first-child .project-open').click()`,
  );
  await delay(100);
  assert.ok(
    await run(
      'document.querySelector(".scene-content").classList.contains("transition-flip")',
    ),
  );
  await run(`document.querySelector('.projects-trigger').click()`);
  await delay(400);
  const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
  await mkdir(".qa", { recursive: true });
  await writeFile(
    ".qa/windows-projects.png",
    Buffer.from(screenshot.data, "base64"),
  );
  const disk = JSON.parse(await readFile(file, "utf8"));
  assert.equal(disk.projects.length, 6);
  await writeFile(
    ".qa/packaged-smoke.json",
    JSON.stringify(
      {
        passed: true,
        executable,
        initial,
        projects: disk.projects.length,
        persistence: true,
        media: mediaEvidence,
        selection: selectionEvidence,
        features: featureEvidence,
        pdfConnectionsFrames: pdfConnectionsFramesEvidence,
        linkPreview: linkPreviewEvidence,
        sectionHeadingEditing: true,
        sectionSubtitleEditing: true,
        sectionSubtitlePersistence: true,
        iconLibrary: 109,
        particles: true,
        transitions: true,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: true,
      executable,
      projects: disk.projects.length,
      persistence: true,
      media: mediaEvidence,
      pdfConnectionsFrames: pdfConnectionsFramesEvidence,
      linkPreview: linkPreviewEvidence,
      sectionHeadingEditing: true,
      sectionSubtitleEditing: true,
      sectionSubtitlePersistence: true,
    }),
  );
  }
  await run("window.close()").catch(() => {});
  await Promise.race([new Promise((r) => child.once("exit", r)), delay(5000)]);
} finally {
  ws?.close();
  mainWs?.close();
  if (child.exitCode === null) child.kill();
  await delay(500);
  if (
    path.dirname(path.resolve(profile)) !== path.resolve(os.tmpdir()) ||
    !path.basename(profile).startsWith("orquestra-packaged-")
  )
    throw new Error("Unexpected profile path");
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 6,
    retryDelay: 500,
  });
}
