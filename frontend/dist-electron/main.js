import { protocol as u, app as i, session as w, ipcMain as c, desktopCapturer as P, BrowserWindow as h } from "electron";
import { fileURLToPath as v } from "node:url";
import t from "node:path";
import m from "node:fs";
const f = t.dirname(v(import.meta.url));
process.env.APP_ROOT = t.join(f, "..");
const a = process.env.VITE_DEV_SERVER_URL, x = t.join(process.env.APP_ROOT, "dist-electron"), d = t.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = a ? t.join(process.env.APP_ROOT, "public") : d;
a || u.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: !0, secure: !0, supportFetchAPI: !0, corsEnabled: !0 }
  }
]);
let e;
i.whenReady().then(() => {
  if (w.defaultSession.webRequest.onHeadersReceived((r, o) => {
    o({
      responseHeaders: {
        ...r.responseHeaders,
        "Cross-Origin-Opener-Policy": ["same-origin"],
        "Cross-Origin-Embedder-Policy": ["credentialless"]
      }
    });
  }), !a) {
    const r = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".mjs": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".wasm": "application/wasm",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".onnx": "application/octet-stream",
      ".txt": "text/plain",
      ".vocab": "application/octet-stream"
    };
    u.handle("app", (o) => {
      const R = new URL(o.url);
      let s = t.join(d, R.pathname);
      try {
        m.statSync(s).isDirectory() && (s = t.join(s, "index.html"));
      } catch {
      }
      try {
        const n = m.readFileSync(s), p = t.extname(s).toLowerCase(), l = r[p] ?? "application/octet-stream";
        return new Response(n, {
          status: 200,
          headers: { "Content-Type": l }
        });
      } catch (n) {
        const p = n instanceof Error ? n.message : String(n);
        try {
          const l = t.join(t.dirname(process.execPath), "qv-protocol-debug.log");
          m.appendFileSync(l, `[${(/* @__PURE__ */ new Date()).toISOString()}] ${o.url}
  → filePath: ${s}
  → RENDERER_DIST: ${d}
  → error: ${p}

`);
        } catch {
        }
        return new Response("Not found", { status: 404 });
      }
    });
  }
});
function g() {
  e = new h({
    icon: t.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    frame: !1,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: t.join(f, "preload.mjs"),
      // Disable web security — enables SharedArrayBuffer for WASM multi-threading
      webSecurity: !1
    }
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), a ? e.loadURL(a) : e.loadURL("app:///index.html");
}
c.handle("audio:get-desktop-sources", async () => (await P.getSources({
  types: ["screen"],
  fetchWindowIcons: !1
})).map((o) => ({ id: o.id, name: o.name })));
c.on("window:minimize", () => e == null ? void 0 : e.minimize());
c.on("window:maximize", () => {
  e != null && e.isMaximized() ? e.unmaximize() : e == null || e.maximize();
});
c.on("window:close", () => e == null ? void 0 : e.close());
i.on("window-all-closed", () => {
  process.platform !== "darwin" && (i.quit(), e = null);
});
i.on("activate", () => {
  h.getAllWindows().length === 0 && g();
});
i.whenReady().then(g);
export {
  x as MAIN_DIST,
  d as RENDERER_DIST,
  a as VITE_DEV_SERVER_URL
};
