const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("orquestraDesktop", {
  putAsset: (value) => ipcRenderer.invoke("asset:put", value),
  getAsset: (id) => ipcRenderer.invoke("asset:get", id),
  openLink: (url) => ipcRenderer.invoke("link:open", url),
  loadLibrary: () => ipcRenderer.invoke("library:load"),
  saveLibrary: (value) => ipcRenderer.invoke("library:save", value),
  listVersions: (projectId) => ipcRenderer.invoke("versions:list", projectId),
  saveVersion: (version) => ipcRenderer.invoke("versions:save", version),
  deleteVersion: (projectId, versionId) =>
    ipcRenderer.invoke("versions:delete", projectId, versionId),
  exportBoardPdf: (title, pages) =>
    ipcRenderer.invoke("pdf:export-board", title, pages),
  saveFile: (name, data) => ipcRenderer.invoke("file:save", name, data),
  dataFolder: () => ipcRenderer.invoke("library:folder"),
  onRequestClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:request-close", listener);
    return () => ipcRenderer.removeListener("app:request-close", listener);
  },
  completeClose: () => ipcRenderer.invoke("app:complete-close"),
});
