const { app, BrowserWindow, dialog } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");
let pdfPath;
dialog.showSaveDialog = async () => ({ canceled: false, filePath: pdfPath });
require("../desktop/main.cjs");
app.removeAllListeners("window-all-closed");
app.on("window-all-closed", () => {});
const errors = [];
const output = process.env.ORQUESTRA_SMOKE_OUTPUT;
async function waitFor(fn, description) {
  for (let n = 0; n < 100; n++) {
    if (await fn()) return;
    await delay(100);
  }
  throw new Error("Timeout: " + description);
}
app.whenReady().then(async () => {
  try {
    await waitFor(() => BrowserWindow.getAllWindows().length > 0, "window");
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.on("console-message", (event) => {
      if (event.level === "error") errors.push(event.message);
    });
    win.webContents.on("render-process-gone", (_event, details) =>
      errors.push(details.reason),
    );
    const run = (script) => win.webContents.executeJavaScript(script, true);
    await waitFor(async () => {
      try {
        return await run('!!document.querySelector(".projects-trigger")');
      } catch {
        return false;
      }
    }, "editor");
    await run("document.fonts.ready.then(()=>true)");
    const initial = await run(
      '({desktop:!!window.orquestraDesktop,node:typeof window.require,title:document.title,items:document.querySelectorAll(".scene-content > [data-item]").length,fonts:[...document.fonts].map(f=>f.status)})',
    );
    assert.equal(initial.desktop, true);
    assert.equal(initial.node, "undefined");
    assert.equal(initial.items, 12);
    assert.ok(initial.fonts.every((status) => status === "loaded"));
    pdfPath = path.join(app.getPath("userData"), "board-acceptance.pdf");
    await run(`document.querySelector('.projects-trigger').click()`);
    await waitFor(
      () => run('!!document.querySelector(".projects-modal")'),
      "project manager",
    );
    await run(
      `(()=>{const input=document.querySelector('[aria-label="Nome do novo projeto"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Desktop persistido');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await delay(100);
    await run(`document.querySelector('.create-project-button').click()`);
    await waitFor(
      () =>
        run(
          `document.querySelector('.document-title').value==='Desktop persistido'`,
        ),
      "create project",
    );
    await run(`document.querySelector('.save-button').click()`);
    const file = path.join(app.getPath("userData"), "biblioteca.json");
    await waitFor(async () => {
      try {
        return (
          JSON.parse(await fs.readFile(file, "utf8")).projects.length === 2
        );
      } catch {
        return false;
      }
    }, "disk save");
    const disk = JSON.parse(await fs.readFile(file, "utf8"));
    assert.equal(
      disk.projects.find((p) => p.id === disk.activeId).board.title,
      "Desktop persistido",
    );
    await run("window.__beforeReload=true");
    win.webContents.reload();
    await waitFor(
      () =>
        run(
          `!window.__beforeReload && document.querySelector('.document-title')?.value==='Desktop persistido'`,
        ),
      "reload from disk",
    );
    assert.equal(await run("!!window.orquestraDesktop"), true);
    win.webContents.debugger.attach("1.3");
    const cdp = (method, params = {}) => win.webContents.debugger.sendCommand(method, params);
    const runCdp = async (expression) => {
      const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const { testFeatures } = await import("./features-flow.mjs");
    const featureEvidence = await testFeatures({ cdp, run: runCdp, waitFor, profile: app.getPath("userData") });
    const expectedPageTitles = await runCdp(`window.orquestraDesktop.loadLibrary().then(value=>value.projects.find(project=>project.id===value.activeId).board.scenes.map(scene=>scene.name))`);
    const exportTitle = await run('document.querySelector(".document-title").value');
    const exportFileName = exportTitle.replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").trim().slice(0, 100) || "Orquestra";
    pdfPath = path.join(app.getPath("userData"), "exports", exportFileName + ".pdf");
    await run("document.querySelector('.export-button').click()");
    await waitFor(() => run('!![...document.querySelectorAll(".dropdown button")].find(button=>button.textContent.includes("Exportar board inteiro"))'), "board PDF action is available");
    await run('([...document.querySelectorAll(".dropdown button")].find(button=>button.textContent.includes("Exportar board inteiro"))?.click())');
    await waitFor(async () => {
      try { return (await fs.readFile(pdfPath)).subarray(0, 4).toString() === "%PDF"; }
      catch { return false; }
    }, "real board PDF is written by the Electron export flow");
    const pdf = await fs.readFile(pdfPath);
    const pageObjects = (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    assert.equal(pageObjects, expectedPageTitles.length, "PDF pages correspond to the active board sections");
    const pdfEvidence = { file: ".qa/board-acceptance.pdf", bytes: pdf.length, pageTitles: expectedPageTitles };
    await fs.mkdir(path.resolve(".qa"), { recursive: true });
    await fs.copyFile(pdfPath, path.resolve(".qa/board-acceptance.pdf"));
    // Close immediately after an edit: the close handshake must flush the latest project.
    await run(
      `(()=>{const input=document.querySelector('.document-title');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Última edição antes de fechar');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await delay(30);
    const closed = new Promise((resolve) => win.once("closed", resolve));
    win.close();
    await closed;
    const final = JSON.parse(await fs.readFile(file, "utf8"));
    assert.equal(
      final.projects.find((p) => p.id === final.activeId).board.title,
      "Última edição antes de fechar",
    );
    assert.equal(errors.length, 0, errors.join("\n"));
    await fs.writeFile(
      output,
      JSON.stringify(
        {
          passed: true,
          initial,
          projects: final.projects.length,
          closeFlush: true,
          reloadFromDisk: true,
          pdf: { ...pdfEvidence, signature: pdf.subarray(0, 4).toString(), pageObjects: (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length },
          errors,
        },
        null,
        2,
      ),
    );
    app.exit(0);
  } catch (error) {
    await fs.writeFile(
      output,
      JSON.stringify({ passed: false, error: error.stack, errors }, null, 2),
    );
    app.exit(1);
  }
});
