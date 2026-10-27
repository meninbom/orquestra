import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { makeAcceptancePdf } from "./acceptance-flow.mjs";

export async function testPresenterBridge({ cdp, run, mainRun, waitFor, profile, cdpEvents }) {
  const api = await run('!!window.orquestraPresenter && !window.orquestraPresenter.isAudience');
  assert.equal(api, true, "editor exposes presenter API");
  await waitFor(() => run('window.orquestraDesktop.loadLibrary().then(l=>!!l?.projects?.length)'), "initial library save");
  const audience = (expression) => mainRun(`(async()=>{const E=process.mainModule.require('electron');const w=E.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('audience'));if(!w)throw Error('Audience missing');return w.webContents.executeJavaScript(${JSON.stringify(expression)},true)})()`);
  await run('window.__audienceClosed=0;window.__presenterCommand=null;window.orquestraPresenter.onAudienceClosed(()=>window.__audienceClosed++);window.orquestraPresenter.onCommand(c=>window.__presenterCommand=c);true');
  const opened = await run('window.orquestraPresenter.openAudience()');
  assert.equal(opened.opened, true);
  await waitFor(() => audience('!!window.orquestraPresenter?.isAudience'), "audience renderer", 25000).catch(async (error) => {
    console.log("Presenter window diagnostics:",await mainRun("Promise.all(process.mainModule.require('electron').BrowserWindow.getAllWindows().map(async w=>({url:w.webContents.getURL(),loading:w.webContents.isLoading(),state:await w.webContents.executeJavaScript('({audience:window.orquestraPresenter?.isAudience,text:document.querySelector(\"#root\")?.textContent.slice(0,600)})').catch(e=>String(e))})))"));
    throw error;
  });
  const displays = await mainRun("(()=>{const E=process.mainModule.require('electron');return E.BrowserWindow.getAllWindows().map(w=>({audience:w.webContents.getURL().includes('audience'),display:E.screen.getDisplayMatching(w.getBounds()).id}))})()");
  if (opened.displayCount > 1) assert.notEqual(displays.find(w=>w.audience).display, displays.find(w=>!w.audience).display, "audience placed on a different display");
  const scene = await run('window.orquestraDesktop.loadLibrary().then(l=>l.projects.find(p=>p.id===l.activeId).board.scenes[0])');
  delete scene.presenterNotes;
  scene.description = "Conteúdo público — teste de apresentador";
  const state = { scene, index: 0, step: 0, light: false, playing: false };
  await run(`window.orquestraPresenter.publish(${JSON.stringify(state)})`);
  await waitFor(() => audience('document.body.textContent.includes("Conteúdo público")'), "audience shows snapshot").catch(async (error) => {
    console.log("Audience diagnostics:", await audience('({text:document.body.textContent,html:document.querySelector("#root")?.innerHTML.slice(0,1000)})'));
    throw error;
  });
  assert.equal(await audience('!!document.querySelector(".document-title,.projects-trigger,.presenter-notes,textarea")'), false, "audience never mounts editor or private notes");
  const cannotWrite = await audience('(async()=>{if(!window.orquestraDesktop?.saveLibrary)return true;try{await window.orquestraDesktop.saveLibrary({});return false}catch{return true}})()');
  assert.equal(cannotWrite, true, "audience cannot write library");
  let privateRejected = false;
  try { await run(`window.orquestraPresenter.publish(${JSON.stringify({ ...state, scene: { ...scene, presenterNotes: "PRIVATE-NOTES-MUST-NOT-LEAK" } })})`); }
  catch { privateRejected = true; }
  assert.equal(await audience('document.body.textContent.includes("PRIVATE-NOTES-MUST-NOT-LEAK")'), false);
  await audience('window.orquestraPresenter.command("next");true');
  await waitFor(() => run('window.__presenterCommand==="next"'), "audience navigation command");
  await run('window.orquestraPresenter.setFullscreen(true)');
  await waitFor(() => mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('audience')).isFullScreen()"), "native fullscreen enabled");
  await run('window.orquestraPresenter.setFullscreen(false)');
  await waitFor(async () => !(await mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('audience')).isFullScreen()")), "native fullscreen restored");
  await run('window.orquestraPresenter.closeAudience()');
  await waitFor(() => run('window.__audienceClosed>0'), "audience close notification");
  await delay(100);
  assert.equal(await mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows().length"), 1);
  assert.deepEqual(cdpEvents.filter(event => event.method === "Runtime.exceptionThrown"), []);
  const ui = await testPresenterUI({ cdp, run, mainRun, waitFor, audience, profile });
  const media = await testAudienceMedia({ cdp, run, mainRun, waitFor, profile, audience });
  return { separateWindow: true, displayCount: opened.displayCount, displays, publicContent: true, privateNotesAbsent: true, privatePayloadRejected: privateRejected, audienceCannotWrite: true, navigationCommand: true, nativeFullscreen: true, closeNotification: true, ui, media };
}

async function testAudienceMedia({ cdp, run, mainRun, waitFor, profile, audience }) {
  const audioFile = path.join(profile, "presenter.mp3");
  const videoFile = path.join(profile, "presenter.mp4");
  const ffmpeg = promisify(execFile);
  await ffmpeg("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "20", "-c:a", "libmp3lame", "-q:a", "7", "-y", audioFile], { windowsHide: true });
  await ffmpeg("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=steelblue:s=160x90:r=15", "-t", "20", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", videoFile], { windowsHide: true });
  const media = [];
  for (const [name, mime, bytes, type, x, y, w, h] of [
    ["presenter.mp3", "audio/mpeg", await readFile(audioFile), "audio", 30, 200, 450, 110],
    ["presenter.mp4", "video/mp4", await readFile(videoFile), "video", 530, 200, 450, 250],
    ["presenter.pdf", "application/pdf", makeAcceptancePdf(), "file", 30, 350, 300, 400],
  ]) {
    const assetId = crypto.randomUUID();
    await run(`window.orquestraDesktop.putAsset({id:${JSON.stringify(assetId)},name:${JSON.stringify(name)},mime:${JSON.stringify(mime)},data:Uint8Array.from(atob(${JSON.stringify(bytes.toString("base64"))}),c=>c.charCodeAt(0))})`);
    media.push({ id: crypto.randomUUID(), type, x, y, w, h, text: name, color: "#ededed", fill: "transparent", size: 24, step: 0, animation: "none", assetId, assetName: name, assetMime: mime, mediaAutoplay: true, mediaMuted: true });
  }
  const library = await run('window.orquestraDesktop.loadLibrary()');
  const project = library.projects.find(p => p.id === library.activeId);
  if (process.env.ORQUESTRA_TEST_PRESENTER_YOUTUBE === "1") media.push({id:crypto.randomUUID(),type:"link",x:530,y:480,w:450,h:250,text:"YouTube público QA",color:"#ededed",fill:"transparent",size:24,step:0,animation:"none",url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ"});
  project.board.scenes = [{ ...project.board.scenes[0], name: "Mídia pública QA", presenterNotes: "MEDIA-PRIVATE-NOTE", items: media }];
  await run(`window.orquestraDesktop.saveLibrary(${JSON.stringify(library)})`);
  await run("window.__presenterReload=true");
  await cdp("Page.reload");
  await waitFor(() => run('!window.__presenterReload&&!!document.querySelector(".present-button")'), "media fixture reload");
  await run('document.querySelector(".present-button").click();true');
  await run('[...document.querySelectorAll(".presenter-panel button")].find(b=>b.textContent.includes("Abrir tela do público")).click();true');
  await waitFor(() => audience('document.querySelector("audio")?.readyState>=2&&document.querySelector("video")?.readyState>=2'), "audience decodes MP3 and MP4", 25000);
  await waitFor(() => audience('!!document.querySelector("[data-pdf-preview-page]")'), "PDF rendered in audience", 25000).catch(async (error) => { console.log("Audience PDF:", await audience('({text:document.querySelector("#root")?.textContent,images:[...document.querySelectorAll("image")].map(e=>({attrs:[...e.attributes].map(a=>[a.name,a.name==="href"?a.value.slice(0,45):a.value])}))})')); throw error; });
  await audience('window.__audienceMedia=[...document.querySelectorAll("audio,video")];Promise.all(window.__audienceMedia.map(e=>{e.muted=true;return e.play()})).then(()=>true)');
  const before = await audience('window.__audienceMedia.map(e=>e.currentTime)');
  const scene = project.board.scenes[0]; delete scene.presenterNotes;
  for (let n = 0; n < 6; n++) { await run(`window.orquestraPresenter.publish(${JSON.stringify({ scene, index: 0, step: 1, light: false, playing: false })})`); await run(`window.orquestraPresenter.laser({x:${100 + n},y:100})`); await delay(80); }
  await delay(1000);
  const after = await audience('window.__audienceMedia.map(e=>({time:e.currentTime,paused:e.paused,connected:e.isConnected}))');
  after.forEach((entry, index) => { assert.equal(entry.connected, true); assert.equal(entry.paused, false); assert.ok(entry.time>before[index]+0.5); });
  assert.equal(await run('document.querySelectorAll(".canvas audio,.canvas video,.canvas iframe.youtube-board-player").length'), 0, "console does not duplicate public players");
  const pdf = await audience('document.querySelector("[data-pdf-preview-page]").getBoundingClientRect().width');
  assert.ok(pdf > 0);
  let youtube = null;
  if (process.env.ORQUESTRA_TEST_PRESENTER_YOUTUBE === "1") {
    const playerState = () => mainRun(`(async()=>{const E=process.mainModule.require('electron'),w=E.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('audience'));for(const f of w.webContents.mainFrame.frames){if(f.url.includes('/embed/dQw4w9WgXcQ'))try{const v=await f.executeJavaScript('(()=>{const v=document.querySelector("video");if(!v)return null;v.muted=true;return {time:v.currentTime,paused:v.paused,ready:v.readyState,error:v.error?.code}})()');if(v)return v}catch{}}return null})()`);
    const initial = await waitFor(async()=>{const s=await playerState();return s?.ready>=2&&!s.paused&&s.time>0?s:null}, "real YouTube audience playback", 65000);
    await delay(1300);
    const later = await playerState();
    assert.ok(later.time>initial.time+0.5); assert.equal(later.paused,false);
    youtube = {initial,later,advancing:true};
  }
  await audience('window.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));true');
  await waitFor(async () => !(await mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('audience')).isFullScreen()")), "audience Escape leaves fullscreen");
  await run('[...document.querySelectorAll(".presenter-panel button")].find(b=>b.textContent.includes("Sair da apresentação")).click();true');
  await waitFor(() => mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows().length===1"), "media audience closed");
  return { mp3AndMp4Decoded: true, before, after, retainedDuringStepAndLaser: true, inlinePdf: true, noDuplicateConsolePlayers: true, audienceEscape: true, youtube };
}

async function testPresenterUI({ cdp, run, mainRun, waitFor, audience, profile }) {
  const click = async (selector) => { await run(`document.querySelector(${JSON.stringify(selector)}).click();true`); await delay(120); };
  const panelButton = async (text) => { await run(`[...document.querySelectorAll('.presenter-panel button')].find(b=>b.textContent.includes(${JSON.stringify(text)})).click();true`); await delay(120); };
  const library = await run('window.orquestraDesktop.loadLibrary()');
  const project = library.projects.find(p => p.id === library.activeId);
  const base = { id: crypto.randomUUID(), type: "rect", x: 100, y: 160, w: 250, h: 90, text: "Conteúdo público QA", color: "#ededed", fill: "transparent", size: 24, step: 0, animation: "none" };
  const first = { ...project.board.scenes[0], id: crypto.randomUUID(), name: "Seção QA um", presenterNotes: "", items: [base, { ...base, id: crypto.randomUUID(), x: 500, step: 2 }], duration: 6 };
  project.board.scenes = [first, { ...first, id: crypto.randomUUID(), name: "Seção QA dois", items: [{ ...base, id: crypto.randomUUID() }] }];
  await run(`window.orquestraDesktop.saveLibrary(${JSON.stringify(library)})`);
  await run("window.__presenterReload=true");
  await cdp("Page.reload");
  await waitFor(() => run('!window.__presenterReload&&!!document.querySelector(".presenter-notes-editor textarea")'), "notes editor");
  await run(`(()=>{const e=document.querySelector('.presenter-notes-editor textarea');e.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'PRIVATE-UI-NOTES-ONLY');e.dispatchEvent(new Event('input',{bubbles:true}));e.blur();return true})()`);
  await waitFor(() => run('window.orquestraDesktop.loadLibrary().then(l=>l.projects.find(p=>p.id===l.activeId).board.scenes[0].presenterNotes==="PRIVATE-UI-NOTES-ONLY")'), "notes autosave");
  await click(".present-button");
  await waitFor(() => run('!!document.querySelector(".presenter-panel")'), "presenter console");
  assert.equal(await run('!!document.querySelector(".presenter-notes p")'), false, "notes hidden in single-screen presentation");
  await click('[aria-label="Iniciar cronômetro"]');
  await delay(1250);
  const timeText = await run('document.querySelector(".presenter-clock span:nth-child(2)").textContent');
  assert.notEqual(timeText.trim(), "00:00");
  await click('[aria-label="Pausar cronômetro"]');
  const pausedTime = await run('document.querySelector(".presenter-clock span:nth-child(2)").textContent');
  await delay(1100);
  assert.equal(await run('document.querySelector(".presenter-clock span:nth-child(2)").textContent'), pausedTime);
  await click('[aria-label="Zerar cronômetro"]');
  assert.equal((await run('document.querySelector(".presenter-clock span:nth-child(2)").textContent')).trim(), "00:00");
  await panelButton("Abrir tela do público");
  await waitFor(() => audience('document.body.textContent.includes("Seção QA um")'), "UI publishes first scene");
  await panelButton("Mostrar notas privadas");
  assert.equal(await run('document.querySelector(".presenter-notes p").textContent'), "PRIVATE-UI-NOTES-ONLY");
  assert.equal(await audience('document.body.textContent.includes("PRIVATE-UI-NOTES-ONLY")'), false);
  await audience('window.__states=[];window.__lasers=[];window.orquestraPresenter.onState(s=>window.__states.push(s));window.orquestraPresenter.onLaser(p=>window.__lasers.push(p));true');
  await run(`(()=>{const e=document.querySelector('.presenter-panel select');e.value='1';e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  await waitFor(() => audience('document.body.textContent.includes("Seção QA dois")'), "section synchronized");
  await click('[aria-label="Anterior"]');
  await waitFor(() => run('document.querySelector(".presenter-current").textContent.includes("ETAPA 3/3")'), "previous returns to last step");
  await run(`[...document.querySelectorAll('.presenter-panel button')].find(b=>b.textContent.includes('Laser')).click();true`);
  const point = await run(`(()=>{const e=document.querySelector('.canvas'),r=e.getBoundingClientRect();return{x:r.x+100,y:r.y+150,visible:getComputedStyle(e).visibility,events:getComputedStyle(e).pointerEvents}})()`);
  assert.equal(point.visible, "visible");
  assert.notEqual(point.events, "none");
  for (let n = 0; n < 12; n++) { await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x + n * 4, y: point.y + n }); await delay(35); }
  assert.ok(await audience('window.__lasers.filter(Boolean).length>=2'), "laser streams during ongoing movement");
  assert.ok(await audience('(document.querySelector(".laser-trail path")?.getAttribute("d")||"").length>0'), "audience renders the laser trail");
  assert.equal(await audience('JSON.stringify(window.__states).includes("PRIVATE-UI-NOTES-ONLY")'), false, "notes never sent in snapshots");
  await click(".export-button");
  await run('[...document.querySelectorAll(".dropdown button")].find(b=>b.textContent.includes("(.svg)")).click();true');
  let exported;
  await waitFor(async()=>{try{exported=await readFile(path.join(profile,"exports",first.name+".svg"),"utf8");return exported.includes("</svg>")}catch{return false}},"export while laser active");
  assert.equal(exported.includes("data-editor-helper"),false,"laser excluded from SVG");
  assert.equal(exported.includes("PRIVATE-UI-NOTES-ONLY"),false,"private notes excluded from SVG");
  await writeFile(".qa/presenter-console.png", Buffer.from((await cdp("Page.captureScreenshot", { format: "png" })).data, "base64"));
  const publicImage = await mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('audience')).capturePage().then(image=>image.toPNG().toString('base64'))");
  await writeFile(".qa/presenter-audience.png", Buffer.from(publicImage, "base64"));
  await mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>!w.webContents.getURL().includes('audience')).setSize(800,600)");
  await delay(250);
  const compact = await run('(()=>{const p=document.querySelector(".presenter-panel").getBoundingClientRect();return {top:p.top,bottom:p.bottom,height:innerHeight,canvasHeight:document.querySelector(".canvas").clientHeight,overflow:document.documentElement.scrollWidth>innerWidth}})()');
  assert.ok(compact.top>=66&&compact.bottom<=compact.height&&compact.canvasHeight>100);assert.equal(compact.overflow,false);
  await writeFile(".qa/presenter-compact.png",Buffer.from((await cdp("Page.captureScreenshot",{format:"png"})).data,"base64"));
  await panelButton("Sair da apresentação");
  await waitFor(() => run('!document.querySelector(".presenter-panel")'), "return to editor");
  await waitFor(() => mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows().length===1"), "public window closed on stop");
  await click(".present-button");await panelButton("Tela cheia");
  await waitFor(()=>mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows()[0].isFullScreen()"),"UI fullscreen");
  for(const type of ["rawKeyDown","keyUp"])await cdp("Input.dispatchKeyEvent",{type,key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
  await waitFor(()=>run('!document.querySelector(".presenter-panel")'),"Esc exits presentation");
  await waitFor(async()=>!(await mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows()[0].isFullScreen()")),"Esc restores native window");
  await mainRun("process.mainModule.require('electron').BrowserWindow.getAllWindows()[0].setSize(1440,940)");
  return { notesEditedAndSaved: true, notesPrivate: true, stopwatchStartPauseReset: true, sectionSync: true, previousLastStep: true, laserWhileMoving: true, laserAndNotesAbsentFromSvg:true, stopClosesAudience: true, compact, fullscreenEscape:true };
}
