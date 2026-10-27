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
const isAudience = location.hash === "#audience";
contextBridge.exposeInMainWorld("orquestraPresenter", {
  isAudience,
  openAudience: () => ipcRenderer.invoke("presenter:open"),
  closeAudience: () => ipcRenderer.invoke("presenter:close"),
  publish: (state) => ipcRenderer.invoke("presenter:publish", state),
  laser: (point) => { if (!isAudience) ipcRenderer.send("presenter:laser", point); },
  onLaser: (callback) => {
    const listener = (_event, point) => callback(point); ipcRenderer.on("presenter:laser", listener);
    return () => ipcRenderer.removeListener("presenter:laser", listener);
  },
  onState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("presenter:state", listener);
    if (isAudience) ipcRenderer.send("presenter:ready");
    return () => ipcRenderer.removeListener("presenter:state", listener);
  },
  onAudienceClosed: (callback) => {
    const listener = () => callback(); ipcRenderer.on("presenter:audience-closed", listener);
    return () => ipcRenderer.removeListener("presenter:audience-closed", listener);
  },
  setFullscreen: (value) => ipcRenderer.invoke("presenter:fullscreen", value),
  setAudienceFullscreen: (value) => isAudience && ipcRenderer.invoke("presenter:audience-fullscreen", value),
  onFullscreen: (callback) => {
    const listener = (_event, value) => callback(value); ipcRenderer.on("presenter:fullscreen", listener);
    return () => ipcRenderer.removeListener("presenter:fullscreen", listener);
  },
  onCommand: (callback) => {
    const listener = (_event, command) => callback(command); ipcRenderer.on("presenter:command", listener);
    return () => ipcRenderer.removeListener("presenter:command", listener);
  },
  command: (command) => { if (isAudience && ["next", "previous", "stop"].includes(command)) ipcRenderer.send("presenter:command", command); },
});
