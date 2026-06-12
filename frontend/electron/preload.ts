import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose typed API to the Renderer process ---------
const electronAPI = {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Audio
  getDesktopSources: (): Promise<Array<{ id: string; name: string }>> =>
    ipcRenderer.invoke('audio:get-desktop-sources'),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
