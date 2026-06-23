import { app, BrowserWindow, ipcMain, desktopCapturer, session, protocol } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// ── Register custom protocol for serving bundled models/WASM from asar ──
//    In packaged mode the renderer loads from file:// and relative fetch()
//    calls to /models/… or /wasm/… won't resolve.  The app:// protocol
//    maps to the renderer dist folder (inside asar).
if (!VITE_DEV_SERVER_URL) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
  ])
}

let win: BrowserWindow | null

app.whenReady().then(() => {
  // ── COOP/COEP headers for SharedArrayBuffer (WASM multi-threading) ──
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Cross-Origin-Opener-Policy': ['same-origin'],
        'Cross-Origin-Embedder-Policy': ['credentialless'],
      },
    })
  })

  // ── Register app:// protocol handler (packaged mode only) ──
  //    Maps app:// URLs to the renderer dist directory so that
  //    fetch('/models/…') and fetch('/wasm/…') work from the asar.
  if (!VITE_DEV_SERVER_URL) {
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
      '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
      '.svg': 'image/svg+xml', '.png': 'image/png', '.onnx': 'application/octet-stream',
      '.txt': 'text/plain', '.vocab': 'application/octet-stream',
    }
    protocol.handle('app', (request) => {
      const url = new URL(request.url)
      // app://index.html/ → hostname='index.html', pathname='/'
      // app://index.html/assets/foo.css → hostname='index.html', pathname='/assets/foo.css'
      // app://models/x/config.json → hostname='models', pathname='/x/config.json'
      let filePath = path.join(RENDERER_DIST, url.pathname)
      // If resolved path is a directory, serve index.html from it
      try {
        if (fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html')
        }
      } catch { /* file doesn't exist yet, that's fine */ }
      try {
        // fs.readFileSync works transparently inside asar archives
        const data = fs.readFileSync(filePath)
        const ext = path.extname(filePath).toLowerCase()
        const contentType = mimeTypes[ext] ?? 'application/octet-stream'
        return new Response(data, {
          status: 200,
          headers: { 'Content-Type': contentType },
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        // Write debug info next to the exe so we can diagnose 404s
        try {
          const logPath = path.join(path.dirname(process.execPath), 'qv-protocol-debug.log')
          fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${request.url}\n  → filePath: ${filePath}\n  → RENDERER_DIST: ${RENDERER_DIST}\n  → error: ${msg}\n\n`)
        } catch { /* ignore logging errors */ }
        return new Response('Not found', { status: 404 })
      }
    })
  }
})

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    frame: false,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Disable web security — enables SharedArrayBuffer for WASM multi-threading
      webSecurity: false,
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // Load via app:// protocol so that relative fetch('/models/…') resolves
    // to the dist directory inside the asar archive.
    // Triple-slash (app:///) ensures no hostname — pathname is the full path.
    win.loadURL('app:///index.html')
  }
}

// ── Audio IPC handlers ───────────────────────────────────────
ipcMain.handle('audio:get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    fetchWindowIcons: false,
  })
  return sources.map((s) => ({ id: s.id, name: s.name }))
})

// ── Window control IPC handlers ──────────────────────────────
ipcMain.on('window:minimize', () => win?.minimize())
ipcMain.on('window:maximize', () => {
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})
ipcMain.on('window:close', () => win?.close())

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
