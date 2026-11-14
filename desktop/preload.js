// PrismOS desktop bridge (Electron preload). Exposes a small, fixed API to the PrismOS page as window.prismNative.
// Everything is confined to one home folder (~/PrismOS, or PRISM_HOME): the page cannot name paths outside it.
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');

let HOME = path.resolve(process.env.PRISM_HOME || path.join(os.homedir(), 'PrismOS'));
fs.mkdirSync(HOME, { recursive: true });
HOME = fs.realpathSync.native(HOME);   // the long, canonical form, so it matches what git reports
const SKIP = new Set(['node_modules', '.git', '.cache', 'dist', 'build', '.next', 'target', '__pycache__', '.venv']);
const win = process.platform === 'win32';

// rel is a forward-slash path relative to HOME ('' is HOME itself).
const real = rel => {
  const p = path.resolve(HOME, String(rel || '').split('/').join(path.sep));
  if (p !== HOME && !p.startsWith(HOME + path.sep)) throw new Error('Path is outside the PrismOS home folder');
  return p;
};

// Reads the text files under HOME. Skips dependency and build folders, binary files and anything over 400 KB.
function readTree() {
  const files = {}, dirs = []; let count = 0, total = 0;
  const walk = (dir, rel, depth) => {
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (count > 6000 || total > 16e6) return;
      const r = rel ? rel + '/' + e.name : e.name, full = path.join(dir, e.name);
      if (e.isDirectory()) { if (SKIP.has(e.name) || depth > 12) continue; dirs.push(r); walk(full, r, depth + 1); }
      else if (e.isFile()) {
        try {
          const size = fs.statSync(full).size; if (size > 400000) continue;
          const buf = fs.readFileSync(full); if (buf.subarray(0, 2000).includes(0)) continue;
          files[r] = buf.toString('utf8'); count++; total += size;
        } catch {}
      }
    }
  };
  walk(HOME, '', 0);
  return { files, dirs };
}

contextBridge.exposeInMainWorld('prismNative', {
  home: HOME, platform: process.platform,
  readTree,
  write(rel, content) { const p = real(rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, String(content), 'utf8'); },
  mkdir(rel) { fs.mkdirSync(real(rel), { recursive: true }); },
  rm(rel) { const p = real(rel); if (p === HOME) throw new Error('Cannot remove the home folder'); fs.rmSync(p, { recursive: true, force: true }); },
  mv(a, b) { const to = real(b); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(real(a), to); },
  // Runs one command line in the real shell (PowerShell on Windows, your login shell elsewhere).
  exec(cmd, rel, onData, onDone) {
    const cwd = real(rel);
    const child = win
      ? cp.spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-Command', "$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.Encoding]::UTF8;" + String(cmd)], { cwd, windowsHide: true })
      : cp.spawn(process.env.SHELL || '/bin/bash', ['-lc', String(cmd)], { cwd });
    child.stdout.on('data', d => onData('out', d.toString('utf8')));
    child.stderr.on('data', d => onData('err', d.toString('utf8')));
    child.on('error', e => { onData('err', e.message); onDone(-1); });
    child.on('close', code => onDone(code == null ? -1 : code));
    return { kill() { try { if (win) cp.spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }); else child.kill('SIGTERM'); } catch {} } };
  },
  git(args, rel) {
    const r = cp.spawnSync('git', args.map(String), { cwd: real(rel), encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    return { code: r.error ? -1 : r.status, out: r.stdout || '', err: r.error ? 'git is not installed or not on the PATH' : r.stderr || '' };
  },
  app: cmd => ipcRenderer.send('prism:app', String(cmd)),
  copy: text => ipcRenderer.send('prism:copy', String(text)),
  // Web windows: events from the main process (keys, new tabs, permission asks, downloads) and the replies.
  web: {
    on(ch, cb) { if (['web:key', 'web:newtab', 'web:perm', 'web:dl'].includes(ch)) ipcRenderer.on(ch, (e, d) => cb(d)); },
    permReply: (id, allow, remember) => ipcRenderer.send('web:perm-reply', { id: +id, allow: !!allow, remember: !!remember }),
    download: (id, what) => ipcRenderer.send('web:dl-do', { id: +id, what: String(what) }),
    clear: () => ipcRenderer.invoke('web:clear'),
  },
});
