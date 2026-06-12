"use strict";
const electron = require("electron");
const electronAPI = {
  // Window controls
  minimizeWindow: () => electron.ipcRenderer.send("window:minimize"),
  maximizeWindow: () => electron.ipcRenderer.send("window:maximize"),
  closeWindow: () => electron.ipcRenderer.send("window:close"),
  // Audio
  getDesktopSources: () => electron.ipcRenderer.invoke("audio:get-desktop-sources")
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
