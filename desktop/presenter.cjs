const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("node:path");
const { validLibrary } = require("./library.cjs");

const commands = new Set(["next", "previous", "stop"]);
const sceneKeys = ["id", "name", "description", "subtitle", "headingLayout", "items", "duration", "transition", "transitionMs"];
const itemKeys = ["id", "type", "x", "y", "w", "h", "text", "color", "textColor", "fill", "fillOpacity", "size", "fontFamily", "step", "animation", "animationMs", "arrowMotion", "arrowSeconds", "arrowStyle", "arrowLabelPosition", "arrowLabelFill", "icon", "assetId", "assetName", "assetMime", "url", "pdfPage", "mediaFit", "mediaLoop", "mediaAutoplay", "mediaMuted", "points", "from", "to", "fromPort", "toPort", "name", "groupId", "locked", "hidden", "bold", "italic", "textAlign", "verticalAlign", "textPaddingX", "textPaddingY", "lineHeight", "autoFit", "autoHeight"];
function validState(value) {
  try {
    if (!value || typeof value !== "object" || !value.scene || typeof value.scene !== "object" || Array.isArray(value.scene)) return false;
    const scene = value.scene;
    if (Object.hasOwn(scene, "presenterNotes") || !Array.isArray(scene.items)) return false;
    const pick = (object, keys) => Object.fromEntries(keys.filter((key) => Object.hasOwn(object, key)).map((key) => [key, object[key]]));
    const clean = pick(scene, sceneKeys);
    if (clean.headingLayout && typeof clean.headingLayout === "object" && !Array.isArray(clean.headingLayout)) {
      clean.headingLayout = Object.fromEntries(Object.entries(clean.headingLayout).filter(([key]) => ["name", "description", "subtitle"].includes(key)).map(([key, layout]) => [key, layout && typeof layout === "object" ? pick(layout, ["x", "y", "width", "fontSize", "align"]) : layout]));
    }
    clean.items = scene.items.map((item) => item && typeof item === "object" && !Array.isArray(item) ? pick(item, itemKeys) : item);
    const board = { version: 1, title: "Apresentação", scenes: [clean] };
    if (!validLibrary({ format: "orquestra-library", version: 1, activeId: "presenter", projects: [{ id: "presenter", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", board }] })) return false;
    if (!Number.isInteger(value.index) || value.index < 0 || value.index >= 200 || !Number.isInteger(value.step) || value.step < 0 || value.step > 20 || typeof value.light !== "boolean" || typeof value.playing !== "boolean") return false;
    if (Buffer.byteLength(JSON.stringify({ scene: clean, index: value.index, step: value.step, light: value.light, playing: value.playing })) > 8 * 1024 * 1024) return false;
    value.scene = clean;
    return true;
  } catch { return false; }
}

function validLaser(value) {
  if (value === null) return true;
  return !!value && typeof value === "object" && !Array.isArray(value) && Number.isFinite(value.x) && Number.isFinite(value.y) && Math.abs(value.x) <= 1e6 && Math.abs(value.y) <= 1e6;
}

function installPresenter({ mainWindow, assetPaths }) {
  let audience = null, latest = null, full = false, throttling = null;
  const holders = new Set();
  const send = () => { if (audience && !audience.isDestroyed() && latest) audience.webContents.send("presenter:state", latest); };
  const keepRendering = (holder = "audience") => {
    if (holders.has(holder)) return;
    holders.add(holder);
    if (throttling !== null || mainWindow.isDestroyed()) return;
    throttling = mainWindow.webContents.getBackgroundThrottling();
    mainWindow.webContents.setBackgroundThrottling(false);
  };
  const restoreRendering = (holder = "audience") => {
    holders.delete(holder);
    if (holders.size) return;
    if (throttling !== null && !mainWindow.isDestroyed()) mainWindow.webContents.setBackgroundThrottling(throttling);
    throttling = null;
  };
  const open = () => {
    if (audience && !audience.isDestroyed()) { audience.show(); send(); return { opened: true, displayCount: screen.getAllDisplays().length }; }
    keepRendering();
    const displays = screen.getAllDisplays();
    const mainBounds = mainWindow.getBounds();
    const mainDisplay = screen.getDisplayNearestPoint({ x: mainBounds.x + mainBounds.width / 2, y: mainBounds.y + mainBounds.height / 2 });
    const target = displays.find((d) => d.id !== mainDisplay.id) || mainDisplay;
    const area = target.workArea;
    const secondaryDisplay = target.id !== mainDisplay.id;
    audience = new BrowserWindow({ x: area.x, y: area.y, width: area.width, height: area.height, show: false, frame: !secondaryDisplay, title: "Orquestra — Público", backgroundColor: "#000000", webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    audience.setMenuBarVisibility(false);
    audience.setFullScreen(true);
    audience.webContents.setBackgroundThrottling(false);
    audience.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    audience.webContents.on("will-navigate", (e) => e.preventDefault());
    audience.on("closed", () => { audience = null; restoreRendering(); if (!mainWindow.isDestroyed()) mainWindow.webContents.send("presenter:audience-closed"); });
    audience.webContents.once("did-finish-load", () => { audience.show(); send(); });
    audience.loadFile(path.join(__dirname, "../dist/orquestra.html"), { hash: "audience" });
    return { opened: true, displayCount: displays.length };
  };
  const trustedFrame = (event, webContents) => event.sender === webContents && event.senderFrame === webContents.mainFrame;
  ipcMain.handle("presenter:open", (e) => { if (!trustedFrame(e, mainWindow.webContents)) throw new Error("Origem não permitida."); return open(); });
  ipcMain.handle("presenter:close", (e) => { if (!trustedFrame(e, mainWindow.webContents)) throw new Error("Origem não permitida."); audience?.close(); });
  ipcMain.handle("presenter:publish", (e, state) => { if (!trustedFrame(e, mainWindow.webContents) || !validState(state)) throw new Error("Estado de apresentação inválido ou fora do schema."); latest = { scene: state.scene, index: state.index, step: state.step, light: state.light, playing: state.playing }; send(); });
  ipcMain.on("presenter:laser", (e, point) => { if (!trustedFrame(e, mainWindow.webContents) || !validLaser(point) || !audience || audience.isDestroyed()) return; audience.webContents.send("presenter:laser", point); });
  ipcMain.handle("presenter:fullscreen", (e, value) => { if (!trustedFrame(e, mainWindow.webContents) || typeof value !== "boolean") throw new Error("Origem não permitida."); full = value; mainWindow.setFullScreen(value); return mainWindow.isFullScreen(); });
  ipcMain.handle("presenter:audience-fullscreen", (e, value) => { if (!audience || !trustedFrame(e, audience.webContents) || typeof value !== "boolean") throw new Error("Origem não permitida."); audience.setFullScreen(value); return audience.isFullScreen(); });
  mainWindow.on("enter-full-screen", () => { full = true; mainWindow.webContents.send("presenter:fullscreen", true); });
  mainWindow.on("leave-full-screen", () => { full = false; mainWindow.webContents.send("presenter:fullscreen", false); });
  ipcMain.on("presenter:ready", (e) => { if (!audience || !trustedFrame(e, audience.webContents)) return; send(); });
  ipcMain.on("presenter:command", (e, command) => { if (!audience || !trustedFrame(e, audience.webContents) || !commands.has(command)) return; mainWindow.webContents.send("presenter:command", command); });
  ipcMain.handle("asset:get", async (e, id) => {
    if (!trustedFrame(e, mainWindow.webContents) && (!audience || !trustedFrame(e, audience.webContents))) throw new Error("Origem não permitida.");
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Identificador inválido.");
    const paths = assetPaths(id);
    const meta = JSON.parse(await require("node:fs/promises").readFile(paths.meta, "utf8"));
    const data = await require("node:fs/promises").readFile(paths.file);
    if (!meta || meta.id !== id || typeof meta.name !== "string" || meta.name.length > 1000 || typeof meta.mime !== "string" || meta.mime.length > 150 || !Number.isSafeInteger(meta.size) || meta.size !== data.length || data.length > 100 * 1024 * 1024) throw new Error("Metadados ou tamanho da mídia inválidos.");
    return { id: meta.id, name: meta.name, mime: meta.mime, size: meta.size, data };
  });
  const close = () => audience?.close();
  mainWindow.once("closed", close);
  app.on("before-quit", close);
  return { close, rendering: { acquire: keepRendering, release: restoreRendering }, get audience() { return audience; }, get fullscreen() { return full; } };
}
module.exports = { installPresenter, validState, validLaser };
