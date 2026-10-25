const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("orquestraDesktop", {
  putAsset: (value) => ipcRenderer.invoke("asset:put", value),
  getAsset: (id) => ipcRenderer.invoke("asset:get", id),
  openLink: (url) => ipcRenderer.invoke("link:open", url),
  loadLibrary: () => ipcRenderer.invoke("library:load"),
  saveLibrary: (value) => ipcRenderer.invoke("library:save", value),
  saveFile: (name, data) => ipcRenderer.invoke("file:save", name, data),
  dataFolder: () => ipcRenderer.invoke("library:folder"),
  onRequestClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("app:request-close", listener);
    return () => ipcRenderer.removeListener("app:request-close", listener);
  },
  completeClose: () => ipcRenderer.invoke("app:complete-close"),
});
