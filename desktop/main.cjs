const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { LibraryStore } = require("./storage.cjs");
const { VersionStore } = require("./versions.cjs");
const { validPdfPages, exportBoardPdfToFile } = require("./pdf.cjs");
const { installYoutubePreviewReferer } = require("./youtube-preview.cjs");
const { installPresenter } = require("./presenter.cjs");

app.setName("Orquestra");
const testPath = process.argv.find((arg) =>
  arg.startsWith("--orquestra-test-data="),
);
if (testPath)
  app.setPath("userData", path.resolve(testPath.split("=").slice(1).join("=")));
let mainWindow,
  store,
  versionStore,
  closeApproved = false,
  requestingClose = false;
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    store = new LibraryStore(app.getPath("userData"));
    versionStore = new VersionStore(app.getPath("userData"));
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 940,
      minWidth: 800,
      minHeight: 600,
      title: "Orquestra",
      titleBarStyle: "hidden",
      titleBarOverlay: { color: "#00000000", symbolColor: "#808080", height: 66 },
      backgroundColor: "#000000",
      show: false,
      icon: path.join(__dirname, "icon.ico"),
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // Isolated UI tests use animation frames even when their window is hidden.
        backgroundThrottling: !testPath,
      },
    });
    Menu.setApplicationMenu(null);
    const trusted = (event) => {
      if (
        event.sender !== mainWindow.webContents ||
        event.senderFrame !== mainWindow.webContents.mainFrame
      )
        throw new Error("Origem não permitida.");
    };
    ipcMain.handle("library:load", (event) => {
      trusted(event);
      return store.load();
    });
    const assetPaths = (id) => {
      if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id))
        throw new Error("Identificador inválido.");
      const dir = path.join(store.directory, "media");
      return {
        dir,
        file: path.join(dir, id + ".bin"),
        meta: path.join(dir, id + ".json"),
      };
    };
    ipcMain.handle("asset:put", async (event, value) => {
      trusted(event);
      if (
        !value ||
        typeof value.name !== "string" ||
        value.name.length > 1000 ||
        typeof value.mime !== "string" ||
        value.mime.length > 150 ||
        !(value.data instanceof Uint8Array) ||
        value.data.length > 100 * 1024 * 1024
      )
        throw new Error("Mídia inválida ou maior que 100 MB.");
      const { dir, file, meta } = assetPaths(value.id);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file, value.data, { flag: "wx" });
      await fs.writeFile(
        meta,
        JSON.stringify({
          id: value.id,
          name: value.name,
          mime: value.mime,
          size: value.data.length,
        }),
        { flag: "wx" },
      );
    });
    ipcMain.handle("link:open", async (event, value) => {
      trusted(event);
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("Somente links HTTPS são permitidos.");
      await shell.openExternal(url.href);
    });
    ipcMain.handle("library:save", (event, value) => {
      trusted(event);
      return store.save(value);
    });
    ipcMain.handle("versions:list", (event, projectId) => {
      trusted(event);
      return versionStore.list(projectId);
    });
    ipcMain.handle("versions:save", (event, value) => {
      trusted(event);
      return versionStore.save(value);
    });
    ipcMain.handle("versions:delete", (event, projectId, versionId) => {
      trusted(event);
      return versionStore.delete(projectId, versionId);
    });
    ipcMain.handle("pdf:export-board", async (event, title, pages) => {
      trusted(event);
      if (
        typeof title !== "string" ||
        title.length > 200 ||
        !validPdfPages(pages)
      )
        throw new Error("Conteúdo do PDF inválido ou grande demais.");
      const fileName = (title || "Orquestra")
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
        .trim()
        .slice(0, 100) || "Orquestra";
      if (testPath) {
        const directory = path.join(store.directory, "exports");
        await fs.mkdir(directory, { recursive: true });
        await exportBoardPdfToFile(BrowserWindow, pages, path.join(directory, fileName + ".pdf"));
        return true;
      }
      const choice = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(app.getPath("documents"), fileName + ".pdf"),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (choice.canceled || !choice.filePath) return false;
      await exportBoardPdfToFile(BrowserWindow, pages, choice.filePath);
      return true;
    });
    ipcMain.handle("library:folder", async (event) => {
      trusted(event);
      await fs.mkdir(store.directory, { recursive: true });
      await shell.openPath(store.directory);
    });
    ipcMain.handle("file:save", async (event, name, data) => {
      trusted(event);
      if (
        typeof name !== "string" ||
        !(data instanceof Uint8Array) ||
        data.length > 512 * 1024 * 1024
      )
        throw new Error("Arquivo inválido.");
      const extension = path.extname(name).slice(1).toLowerCase();
      if (
        ![
          "json",
          "svg",
          "png",
          "jpg",
          "jpeg",
          "webp",
          "gif",
          "avif",
          "bmp",
          "mp4",
          "webm",
          "ogv",
          "mov",
          "mp3",
          "wav",
          "ogg",
          "m4a",
          "flac",
          "pdf",
          "txt",
          "md",
          "csv",
          "docx",
          "xlsx",
          "pptx",
          "zip",
        ].includes(extension)
      )
        throw new Error("Formato não permitido.");
      if (testPath) {
        const directory = path.join(store.directory, "exports");
        await fs.mkdir(directory, { recursive: true });
        await fs.writeFile(path.join(directory, path.basename(name)), data);
        return true;
      }
      const choice = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(app.getPath("documents"), path.basename(name)),
        filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
      });
      if (choice.canceled || !choice.filePath) return false;
      await fs.writeFile(choice.filePath, data);
      return true;
    });
    ipcMain.handle("app:complete-close", async (event) => {
      trusted(event);
      if (!requestingClose) return;
      await Promise.all([store.queue, versionStore.queue]);
      closeApproved = true;
      mainWindow.close();
    });
    mainWindow.on("close", (event) => {
      if (closeApproved || mainWindow.webContents.isLoading()) return;
      event.preventDefault();
      requestingClose = true;
      mainWindow.webContents.send("app:request-close");
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    mainWindow.webContents.on("will-navigate", (event) =>
      event.preventDefault(),
    );
    mainWindow.webContents.session.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    const presenter = installPresenter({ mainWindow, assetPaths });
    installYoutubePreviewReferer(mainWindow.webContents.session, () => [mainWindow, presenter.audience]);
    mainWindow.once("ready-to-show", () => mainWindow.show());
    mainWindow.loadFile(path.join(__dirname, "../dist/orquestra.html"));
  });
  app.on("window-all-closed", () => app.quit());
}
