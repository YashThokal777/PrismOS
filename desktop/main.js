// PrismOS desktop shell (Electron main process).
// It opens one full-screen window that loads the same PrismOS page as the browser version.
// preload.js gives that page real files, a real shell and real git; web windows are <webview> tags.
const { app, BrowserWindow, ipcMain, session, clipboard, shell } = require('electron');
const path = require('path'), fs = require('fs');

const windowed = process.argv.includes('--windowed') || process.env.PRISM_WINDOWED === '1';
const hidden = process.env.PRISM_HIDDEN === '1';   // used by automated tests
const WEB = 'persist:prism';                       // the one session every web window shares
let win = null, autoFull = false;

// Sites see an ordinary Chrome. The default user agent names Electron and this app, and Google and others
// answer that with robot checks or "this browser may not be secure".
app.userAgentFallback = app.userAgentFallback.replace(/ (Electron|prismos-desktop)\/\S+/g, '');

const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };

function create() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    show: !hidden, fullscreen: !windowed && !hidden, frame: windowed, autoHideMenuBar: true,
    backgroundColor: '#0c0e13', title: 'PrismOS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false, webviewTag: true, spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  // The shell page never navigates away from itself.
  win.webContents.on('will-navigate', (e, url) => { if (url !== win.webContents.getURL()) e.preventDefault(); });
  win.on('closed', () => { win = null; });
}

/* ---------- the web session: permissions and downloads ---------- */
const ALWAYS = new Set(['fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock']);
const ASK = new Set(['media', 'geolocation', 'notifications', 'clipboard-read', 'display-capture', 'midi', 'idle-detection']);
const granted = new Map();   // "origin|permission" -> true/false, for this run
const asks = new Map(); let askSeq = 0;
const downloads = new Map(); let dlSeq = 0;
const originOf = u => { try { return new URL(u).origin; } catch { return ''; } };
const unique = (dir, name) => {
  const ext = path.extname(name), base = path.basename(name, ext) || 'download';
  let p = path.join(dir, base + ext);
  for (let i = 1; fs.existsSync(p); i++) p = path.join(dir, `${base} (${i})${ext}`);
  return p;
};

function setupWeb() {
  const ses = session.fromPartition(WEB);
  ses.setUserAgent(app.userAgentFallback);
  // Same for the client-hint headers, which otherwise list only "Chromium" and get searches flagged as robots.
  const major = process.versions.chrome.split('.')[0];
  const brands = `"Chromium";v="${major}", "Google Chrome";v="${major}", "Not:A-Brand";v="8"`;
  ses.webRequest.onBeforeSendHeaders((d, cb) => {
    const h = d.requestHeaders;
    for (const k of Object.keys(h)) {
      const l = k.toLowerCase();
      if (l === 'sec-ch-ua') h[k] = brands;
      else if (l === 'sec-ch-ua-full-version-list') h[k] = brands.replace(/v="(\d+)"/g, (m, v) => (v === major ? `v="${process.versions.chrome}"` : `v="${v}.0.0.0"`));
    }
    cb({ requestHeaders: h });
  });
  ses.setPermissionRequestHandler((wc, perm, cb, details) => {
    if (ALWAYS.has(perm)) return cb(true);
    if (!ASK.has(perm)) return cb(false);
    const origin = originOf(details.requestingUrl || wc.getURL()), key = origin + '|' + perm;
    if (granted.has(key)) return cb(granted.get(key));
    const id = ++askSeq;
    const t = setTimeout(() => { if (asks.delete(id)) cb(false); }, 60000);
    asks.set(id, { cb, key, t });
    send('web:perm', { id, origin, perm, media: details.mediaTypes || [], wc: wc.id });
  });
  ses.setPermissionCheckHandler((wc, perm, origin) => ALWAYS.has(perm) || granted.get(originOf(origin) + '|' + perm) === true);
  ses.on('will-download', (e, item, wc) => {
    const id = ++dlSeq, dir = process.env.PRISM_DOWNLOADS || app.getPath('downloads');
    const p = unique(dir, item.getFilename());
    item.setSavePath(p);
    downloads.set(id, { item, path: p });
    const info = state => ({ id, name: path.basename(p), state, got: item.getReceivedBytes(), total: item.getTotalBytes() });
    send('web:dl', info('start'));
    let last = 0;
    item.on('updated', (ev, state) => { const now = Date.now(); if (now - last > 400) { last = now; send('web:dl', info(state === 'interrupted' ? 'interrupted' : 'progress')); } });
    item.once('done', (ev, state) => send('web:dl', info(state)));
  });
}

ipcMain.on('web:perm-reply', (e, { id, allow, remember }) => {
  if (!win || e.sender !== win.webContents) return;
  const a = asks.get(id); if (!a) return;
  asks.delete(id); clearTimeout(a.t);
  if (remember) granted.set(a.key, !!allow);
  a.cb(!!allow);
});
ipcMain.on('web:dl-do', (e, { id, what }) => {
  if (!win || e.sender !== win.webContents) return;
  const d = downloads.get(+id); if (!d) return;
  if (what === 'show') shell.showItemInFolder(d.path);
  else if (what === 'open') shell.openPath(d.path);
  else if (what === 'cancel') d.item.cancel();
});
ipcMain.handle('web:clear', async e => {
  if (!win || e.sender !== win.webContents) return false;
  const ses = session.fromPartition(WEB);
  await ses.clearCache(); await ses.clearStorageData(); granted.clear();
  return true;
});

/* ---------- web windows ---------- */
// Keys a page must not swallow: browser shortcuts and the PrismOS ones. They are passed to the shell page.
function passKey(i) {
  if (i.type === 'keyUp') return i.key === 'Alt';
  if (i.type !== 'keyDown') return false;
  const c = i.code, ctrl = i.control || i.meta, alt = i.alt;
  if (/^F(5|6|11|12)$/.test(c)) return true;
  if (ctrl && alt) return /^(KeyT|ArrowLeft|ArrowRight|Digit[1-4])$/.test(c);
  if (ctrl) return /^(Key[TWLRF]|Equal|Minus|Digit\d|Numpad(Add|Subtract|0)|Tab|PageUp|PageDown|Space)$/.test(c);
  if (alt) return /^(Arrow(Left|Right|Up|Down)|Backquote|Digit[1-9]|Key[DILWM])$/.test(c);
  return false;
}

app.on('web-contents-created', (event, wc) => {
  // Lock down every web window: no preload, no Node, only http(s).
  wc.on('will-attach-webview', (e, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false; prefs.contextIsolation = true; prefs.sandbox = true;
    if (!/^https?:/i.test(params.src || '') || (params.partition && params.partition !== WEB)) e.preventDefault();
  });
  const guest = wc.getType() === 'webview';
  if (guest) {
    wc.on('before-input-event', (e, i) => {
      if (!passKey(i)) return;
      e.preventDefault();
      send('web:key', { wc: wc.id, type: i.type, key: i.key, code: i.code, ctrl: i.control || i.meta, alt: i.alt, shift: i.shift });
    });
  }
  wc.setWindowOpenHandler(({ url, disposition }) => {
    if (!/^https?:/i.test(url)) return { action: 'deny' };
    // A sized pop-up (usually "Sign in with ..."): a real small window, so it can talk back to the page that opened it.
    if (disposition === 'new-window') return {
      action: 'allow',
      overrideBrowserWindowOptions: { width: 520, height: 700, parent: win || undefined, autoHideMenuBar: true, backgroundColor: '#ffffff',
        webPreferences: { partition: WEB, sandbox: true, contextIsolation: true, nodeIntegration: false } },
    };
    if (guest) send('web:newtab', { wc: wc.id, url, bg: disposition === 'background-tab' });
    else wc.loadURL(url);
    return { action: 'deny' };
  });
});

ipcMain.on('prism:app', (e, cmd) => {
  if (!win || e.sender !== win.webContents) return;
  if (cmd === 'quit') app.quit();
  else if (cmd === 'fullscreen') { autoFull = false; win.setFullScreen(!win.isFullScreen()); }
  else if (cmd === 'reload') win.reload();
  // A video asked for full screen: fill the monitor, and give it back afterwards.
  else if (cmd === 'full-on') { if (!win.isFullScreen()) { autoFull = true; win.setFullScreen(true); } }
  else if (cmd === 'full-off') { if (autoFull) { autoFull = false; win.setFullScreen(false); } }
});
ipcMain.on('prism:copy', (e, text) => { if (win && e.sender === win.webContents) clipboard.writeText(String(text)); });

app.whenReady().then(() => { setupWeb(); create(); });
app.on('window-all-closed', () => app.quit());
