/* PrismOS core: settings, file system, window manager, dock, Island, command palette, shortcuts.
   No dependencies. Apps live in apps.js and register on Prism.apps. */
(() => {
'use strict';
const P = (window.Prism = { version: '1.0', apps: {} });

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b));
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('prism.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('prism.' + k, JSON.stringify(v)); } catch {} },
  clear() { try { Object.keys(localStorage).filter(k => k.startsWith('prism.')).forEach(k => localStorage.removeItem(k)); } catch {} },
};
const subs = {};
P.on = (e, f) => { (subs[e] ||= []).push(f); return () => { subs[e] = subs[e].filter(x => x !== f); }; };
P.emit = (e, d) => (subs[e] || []).slice().forEach(f => { try { f(d); } catch (err) { console.error(err); } });

/* ---------- icons ---------- */
const I = {
  prism: '<path d="M12 3 2.5 20h19z"/><path d="M12 3v17M12 11l9.5 9"/>',
  terminal: '<path d="m5 17 6-5-6-5"/><path d="M13 18h6"/>',
  code: '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  sparkles: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M19 15v5M16.5 17.5h5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>',
  braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2h5"/>',
  sliders: '<path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor"/>',
  pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  toggles: '<rect x="2" y="4" width="20" height="7" rx="3.5"/><rect x="2" y="13" width="20" height="7" rx="3.5"/><circle cx="6" cy="7.5" r="1.4"/><circle cx="18" cy="16.5" r="1.4"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  belloff: '<path d="M6 16V11a6 6 0 0 1 9-5.2M18 11v5l2 2H8"/><path d="M10 21h4M3 3l18 18"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7"/>',
  send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  left: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><path d="M5 6h5v12H5z" fill="currentColor" stroke="none"/>',
  right: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/><path d="M14 6h5v12h-5z" fill="currentColor" stroke="none"/>',
  max: '<rect x="4" y="5" width="16" height="14" rx="2"/>',
  branch: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10v1a4 4 0 0 1-4 4h-4a4 4 0 0 0-4 2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  clipboard: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  fwd: '<path d="M9 5l7 7-7 7"/>',
  reload: '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8"/><path d="M20 3v5h-5"/>',
  power: '<path d="M12 3v9"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;
const appIcon = id => { const a = P.apps[id]; return a ? `<span class="app-ic" style="--g1:${a.g[0]};--g2:${a.g[1]}">${a.glyph ? `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17.5" text-anchor="middle" font-size="16" font-weight="700" fill="currentColor">${esc(a.glyph)}</text></svg>` : icon(a.icon)}</span>` : ''; };

/* ---------- settings ---------- */
const WALLS = {
  aurora: ['#0d2b45', '#1fd1b2', '#5b6cff', '#ff7e6b'],
  dusk: ['#2a1242', '#ff5fa2', '#ff9a4d', '#5a4bff'],
  meadow: ['#0f3d2e', '#9be15d', '#00c2a8', '#f6d365'],
  glacier: ['#7fa9d6', '#e8f3ff', '#6aa6ff', '#b9a6ff'],
  ember: ['#3a0f12', '#ff6a3d', '#ffb347', '#c2255c'],
  graphite: ['#1b1e26', '#4a5568', '#2b3445', '#6b7a99'],
};
const ACCENTS = ['#2f6fed', '#7c5cff', '#e0457b', '#e8692a', '#1f9d55', '#0e9aa7'];
const S = Object.assign({ theme: 'auto', accent: ACCENTS[0], wall: 'aurora', blur: 28, magnify: true, motion: true, dnd: false, vol: 0.5, widgets: true }, store.get('settings', {}));
let osEl, desk, layer, dock, islEl, islIn;
const root = document.documentElement;
const VW = () => osEl.clientWidth, VH = () => osEl.clientHeight;
const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
function applySettings() {
  if (S.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = S.theme;
  root.style.setProperty('--accent', S.accent);
  root.style.setProperty('--blur', S.blur + 'px');
  const w = WALLS[S.wall] || WALLS.aurora;
  w.forEach((c, i) => osEl.style.setProperty('--w' + i, c));
  osEl.classList.toggle('still', !S.motion);
}
P.set = (k, v) => { S[k] = v; store.set('settings', S); applySettings(); P.emit('settings', k); };

/* ---------- virtual file system ---------- */
const FS = {
  files: {}, dirs: new Set(['/', '/home']),
  load() { const d = store.get('fs'); if (d && d.files && d.dirs) { this.files = d.files; this.dirs = new Set(d.dirs); } else this.seed(); },
  save() { store.set('fs', { files: this.files, dirs: [...this.dirs] }); P.emit('fs'); },
  norm(p, cwd = '/home') {
    if (!p) return cwd;
    if (p === '~' || p.startsWith('~/')) p = '/home' + p.slice(1);
    if (!p.startsWith('/')) p = cwd + '/' + p;
    const out = [];
    for (const s of p.split('/')) { if (!s || s === '.') continue; if (s === '..') out.pop(); else out.push(s); }
    return '/' + out.join('/');
  },
  isDir(p) { return this.dirs.has(p); },
  isFile(p) { return Object.prototype.hasOwnProperty.call(this.files, p); },
  exists(p) { return this.isDir(p) || this.isFile(p); },
  parent(p) { const i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); },
  name(p) { return p.slice(p.lastIndexOf('/') + 1); },
  ext(p) { const n = this.name(p), i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1).toLowerCase() : ''; },
  short(p) { return p === '/home' ? '~' : p.startsWith('/home/') ? '~' + p.slice(5) : p; },
  _mk(p) { let cur = ''; for (const s of p.split('/').filter(Boolean)) { cur += '/' + s; if (this.isFile(cur)) throw new Error(cur + ' is a file, not a folder'); this.dirs.add(cur); } },
  mkdir(p) { this._mk(p); this.save(); },
  write(p, content) { if (this.isDir(p)) throw new Error(p + ' is a folder'); this._mk(this.parent(p)); content = String(content); if (this.files[p] !== content) P.emit('fs:write', { path: p, old: this.isFile(p) ? this.files[p] : null }); this.files[p] = content; this.save(); },
  read(p) { if (!this.isFile(p)) throw new Error(this.isDir(p) ? p + ' is a folder' : 'No such file: ' + p); return this.files[p]; },
  ls(p) {
    const pre = p === '/' ? '/' : p + '/';
    const direct = x => x.startsWith(pre) && x.length > pre.length && !x.slice(pre.length).includes('/');
    return { dirs: [...this.dirs].filter(direct).sort(), files: Object.keys(this.files).filter(direct).sort() };
  },
  rm(p) {
    if (this.isFile(p)) delete this.files[p];
    else if (this.isDir(p)) {
      if (p === '/' || p === '/home') throw new Error('Cannot remove ' + p);
      for (const f of Object.keys(this.files)) if (f.startsWith(p + '/')) delete this.files[f];
      for (const d of [...this.dirs]) if (d === p || d.startsWith(p + '/')) this.dirs.delete(d);
    } else throw new Error('No such file or folder: ' + p);
    this.save();
  },
  mv(a, b) {
    if (this.exists(b)) throw new Error(b + ' already exists');
    if (this.isFile(a)) { this._mk(this.parent(b)); this.files[b] = this.files[a]; delete this.files[a]; }
    else if (this.isDir(a)) {
      this._mk(b);
      for (const f of Object.keys(this.files)) if (f.startsWith(a + '/')) { this.files[b + f.slice(a.length)] = this.files[f]; delete this.files[f]; }
      for (const d of [...this.dirs]) if (d === a || d.startsWith(a + '/')) { this.dirs.delete(d); this.dirs.add(b + d.slice(a.length)); }
    } else throw new Error('No such file or folder: ' + a);
    this.save();
  },
  bytes() { let n = 0; for (const k in this.files) n += k.length + this.files[k].length; return n; },
  seed() {
    this.files = {}; this.dirs = new Set(['/', '/home']);
    const w = (p, lines) => { this._mk(this.parent(p)); this.files[p] = lines.join('\n') + '\n'; };
    w('/home/welcome.md', [
      '# Welcome to PrismOS', '',
      'A glass desktop for people who build things. Everything here is a real file in your home folder.', '',
      '## Try this first', '',
      '- Press **Ctrl Space** and type anything: an app, a file, a sum, or a command.',
      '- Drag a window to a screen edge to snap it. Hover the green dot for layouts.',
      '- Open `projects/hello/main.js` and press **Ctrl Enter** to run it.',
      '- In Terminal, type `help`.', '',
      'Press **Ctrl /** any time for the full shortcut list.',
    ]);
    w('/home/projects/hello/main.js', [
      '// Press Ctrl+Enter to run. In Terminal: node projects/hello/main.js',
      "const stack = ['JavaScript', 'Rust', 'Python', 'Go'];", '',
      "const bar = n => '#'.repeat(n);", '',
      "console.log('Hello from PrismOS');",
      'for (const [i, name] of stack.entries()) {',
      "  console.log(String(i + 1).padStart(2), name.padEnd(12), bar(name.length));",
      '}',
      'console.log({ languages: stack.length, ok: true });',
    ]);
    w('/home/projects/hello/index.html', [
      '<!doctype html>', '<html>', '<head>', '  <meta charset="utf-8">', '  <link rel="stylesheet" href="style.css">', '</head>', '<body>',
      '  <main>', '    <h1>Hello, preview</h1>', '    <p>Edit this file, then press Ctrl+Enter.</p>', '    <button id="btn">Clicked 0 times</button>', '  </main>',
      '  <script src="app.js"></script>', '</body>', '</html>',
    ]);
    w('/home/projects/hello/style.css', [
      'body { margin: 0; min-height: 100vh; display: grid; place-items: center;', '  font-family: system-ui, sans-serif; background: #10131a; color: #f2f4f8; }',
      'main { text-align: center; }', 'h1 { font-size: 40px; margin: 0 0 8px; }', 'p { opacity: .7; }',
      'button { margin-top: 12px; padding: 10px 18px; border: 0; border-radius: 999px;', '  background: #2f6fed; color: #fff; font: inherit; cursor: pointer; }',
    ]);
    w('/home/projects/hello/app.js', [
      "const btn = document.getElementById('btn');", 'let n = 0;',
      "btn.addEventListener('click', () => {", '  n += 1;', "  btn.textContent = 'Clicked ' + n + (n === 1 ? ' time' : ' times');", '});',
    ]);
    w('/home/notes/ideas.md', ['Ideas', '', '- A CLI that turns a README into a landing page', '- Keyboard-only kanban board', '- Tiny synth you can live-code']);
    store.set('fs', { files: this.files, dirs: [...this.dirs] });
  },
};

/* ---------- syntax colouring + markdown ---------- */
const HL = {
  js: [/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|\b(\d[\d_]*(?:\.\d+)?)\b|\b(const|let|var|function|return|if|else|for|while|do|class|extends|new|import|from|export|default|async|await|try|catch|finally|throw|of|in|typeof|instanceof|switch|case|break|continue|this|null|undefined|true|false)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g, ['com', 'str', 'num', 'kw', 'fn']],
  html: [/(<!--[\s\S]*?-->)|(<\/?[A-Za-z][\w-]*|\/?>)|("[^"]*"|'[^']*')/g, ['com', 'tag', 'str']],
  css: [/(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|rem|em|%|ms|s|vh|vw|deg|fr)?)|([A-Za-z-]+)(?=\s*:)|([.#][\w-]+)/g, ['com', 'str', 'num', 'kw', 'fn']],
  md: [/(^#{1,6} .*$)|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)/gm, ['kw', 'str', 'fn']],
  json: [/("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b/g, ['fn', 'str', 'num', 'kw']],
};
const LANG = { js: 'js', mjs: 'js', ts: 'js', jsx: 'js', tsx: 'js', javascript: 'js', typescript: 'js', html: 'html', htm: 'html', css: 'css', md: 'md', markdown: 'md', json: 'json' };
P.hl = (code, lang) => {
  const d = HL[LANG[String(lang).toLowerCase()]];
  if (!d) return esc(code);
  const [re, names] = d; re.lastIndex = 0;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    if (!m[0]) { re.lastIndex++; continue; }
    const gi = names.findIndex((_, i) => m[i + 1] !== undefined);
    out += esc(code.slice(last, m.index)) + `<span class="t-${names[gi]}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(code.slice(last));
};
const inl = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
function prose(p) {
  let html = '', list = null, para = [];
  const flushP = () => { if (para.length) { html += `<p>${inl(para.join(' '))}</p>`; para = []; } };
  const flushL = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const ln of p.split('\n')) {
    let m;
    if (!ln.trim()) { flushP(); flushL(); }
    else if ((m = ln.match(/^(#{1,4})\s+(.*)/))) { flushP(); flushL(); const n = m[1].length + 2; html += `<h${n}>${inl(m[2])}</h${n}>`; }
    else if ((m = ln.match(/^\s*(?:[-*]|(\d+)[.)])\s+(.*)/))) { flushP(); const t = m[1] ? 'ol' : 'ul'; if (list !== t) { flushL(); html += `<${t}>`; list = t; } html += `<li>${inl(m[2])}</li>`; }
    else { flushL(); para.push(ln); }
  }
  flushP(); flushL();
  return html;
}
function codeBlock(p, actions) {
  const nl = p.indexOf('\n');
  const info = (nl < 0 ? p : p.slice(0, nl)).trim();
  const code = nl < 0 ? '' : p.slice(nl + 1).replace(/\n$/, '');
  const [lang = '', path = ''] = info.split(/\s+/);
  const abs = path.startsWith('/') ? path : '';
  return `<div class="cb" data-lang="${esc(lang)}" data-path="${esc(abs)}"><div class="cb-h"><span>${esc(abs || lang || 'code')}</span>${actions ? `<button data-cb="copy">Copy</button><button data-cb="save">${abs.startsWith('/home/apps/') ? 'Add to dock' : abs ? 'Save to Studio' : 'Save as…'}</button>` : ''}</div><pre>${P.hl(code, lang)}</pre></div>`;
}
P.md = (src, actions) => String(src).split('```').map((p, i) => (i % 2 ? codeBlock(p, actions) : prose(p))).join('');

/* ---------- run JavaScript in a worker ---------- */
function workerMain() {
  const fmt = v => {
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.name + ': ' + v.message;
    if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
    if (v === undefined) return 'undefined';
    try { const s = JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? x + 'n' : x), 2); return s === undefined ? String(v) : s; } catch (e) { return String(v); }
  };
  const send = (t, a) => postMessage({ t, s: a.map(fmt).join(' ') });
  console.log = console.info = console.debug = (...a) => send('log', a);
  console.warn = (...a) => send('warn', a);
  console.error = (...a) => send('err', a);
  console.table = d => send('log', [d]);
  self.onunhandledrejection = e => send('err', ['Uncaught (in promise) ' + fmt(e.reason)]);
  self.onmessage = async e => {
    const t0 = performance.now(); let ok = true;
    try { const AF = Object.getPrototypeOf(async function () {}).constructor; await new AF(e.data)(); }
    catch (err) { ok = false; send('err', [err && err.name ? err.name + ': ' + err.message : String(err)]); }
    postMessage({ t: 'done', ok, ms: Math.round((performance.now() - t0) * 10) / 10 });
  };
}
let lastWorker = null;
P.runJS = (code, { out, done } = {}) => {
  let finished = false, timer, w;
  const fin = r => { if (finished) return; finished = true; clearTimeout(timer); done && done(r); };
  if (lastWorker) { lastWorker.terminate(); lastWorker = null; }
  try {
    const url = URL.createObjectURL(new Blob(['(' + workerMain.toString() + ')()'], { type: 'text/javascript' }));
    w = lastWorker = new Worker(url);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    w.onmessage = e => { const m = e.data; if (m.t === 'done') { fin({ ok: m.ok, ms: m.ms }); setTimeout(() => w.terminate(), 8000); } else out && out(m.t, m.s); };
    w.onerror = e => { out && out('err', e.message || 'Script error'); fin({ ok: false, ms: 0 }); w.terminate(); };
    w.postMessage(code);
    timer = setTimeout(() => { w.terminate(); out && out('err', 'Stopped: still running after 6 seconds.'); fin({ ok: false, ms: 6000 }); }, 6000);
  } catch (err) {
    const t0 = performance.now(); let ok = true;
    const con = { log: (...a) => out && out('log', a.map(String).join(' ')) }; con.info = con.warn = con.error = con.log;
    try { new Function('console', code)(con); } catch (e2) { ok = false; out && out('err', e2.name + ': ' + e2.message); }
    fin({ ok, ms: Math.round(performance.now() - t0) });
  }
  return () => { if (w) w.terminate(); fin({ ok: false, ms: 0, stopped: true }); };
};

/* ---------- clipboard, dialogs, menus ---------- */
P.copy = async (text, label = 'Copied') => {
  try { await navigator.clipboard.writeText(text); }
  catch { const t = el('<textarea style="position:fixed;opacity:0"></textarea>'); t.value = text; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove(); }
  P.island.flash({ icon: 'copy', text: label, tone: 'ok', ms: 1600 });
};
function modal(inner) {
  $('#modal')?.remove();
  const m = el(`<div id="modal" class="panel"><form class="dlg glass">${inner}</form></div>`);
  layer.append(m);
  return m;
}
P.ask = ({ title, value = '', placeholder = '', ok = 'Create' }) => new Promise(res => {
  const m = modal(`<h2>${esc(title)}</h2><input class="inp" id="dlg-in" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false"><div class="dlg-btns"><button type="button" class="btn" data-x>Cancel</button><button class="btn pri">${esc(ok)}</button></div>`);
  const inp = $('#dlg-in', m), end = v => { m.remove(); res(v); };
  m.addEventListener('submit', e => { e.preventDefault(); end(inp.value.trim() || null); });
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-x]')) end(null); });
  m.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); end(null); } });
  inp.focus(); inp.select();
});
P.confirm = ({ title, text = '', ok = 'Delete' }) => new Promise(res => {
  const m = modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="dlg-btns"><button type="button" class="btn" data-x>Cancel</button><button class="btn pri" id="dlg-ok">${esc(ok)}</button></div>`);
  const end = v => { m.remove(); res(v); };
  m.addEventListener('submit', e => { e.preventDefault(); end(true); });
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-x]')) end(false); });
  m.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); end(false); } });
  $('#dlg-ok', m).focus();
});
const closeMenus = () => { const m = $$('.menu,.snap-pop', layer); m.forEach(x => x.remove()); return m.length > 0; };
P.menu = (x, y, items) => {
  closeMenus();
  const m = el(`<div class="menu glass" role="menu">${items.map((it, i) => it.sep ? '<hr>' : `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}>${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span>${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''}</button>`).join('')}</div>`);
  layer.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = clamp(x, 8, VW() - r.width - 8) + 'px';
  m.style.top = clamp(y, 40, VH() - r.height - 8) + 'px';
  m.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; closeMenus(); const it = items[+b.dataset.i]; it.run && it.run(); });
};

/* ---------- window manager ---------- */
const MB = 36, GAP = 8;
const compact = () => VW() < 720;
const work = () => compact() ? { x: 0, y: MB, w: VW(), h: VH() - MB - 78 } : { x: GAP, y: MB + GAP, w: VW() - GAP * 2, h: VH() - MB - GAP * 2 };
const ZONES = { left: [0, 0, .5, 1], right: [.5, 0, .5, 1], tl: [0, 0, .5, .5], tr: [.5, 0, .5, .5], bl: [0, .5, .5, .5], br: [.5, .5, .5, .5], max: [0, 0, 1, 1] };
function zoneRect(f) {
  const a = work(), h = GAP / 2;
  const l = f[0] > 0 ? h : 0, t = f[1] > 0 ? h : 0, r = f[0] + f[2] < .999 ? h : 0, b = f[1] + f[3] < .999 ? h : 0;
  return { x: Math.round(a.x + a.w * f[0] + l), y: Math.round(a.y + a.h * f[1] + t), w: Math.round(a.w * f[2] - l - r), h: Math.round(a.h * f[3] - t - b) };
}
const WM = { wins: new Map(), mru: [], z: 10, seq: 0, activeId: null, desk: 0, desks: 3 };
const place = w => { const s = w.node.style; s.left = w.x + 'px'; s.top = w.y + 'px'; s.width = w.w + 'px'; s.height = w.h + 'px'; };
const saveSession = debounce(() => store.set('session', [...WM.wins.values()].map(w => ({ app: w.app, x: w.x, y: w.y, w: w.w, h: w.h, state: w.state, frac: w.frac, restore: w.restore, min: w.min, desk: w.desk, z: +w.node.style.zIndex || 0 }))), 300);
function updateDock() {
  const half = dock.offsetWidth / 2 + 12, mid = VW() / 2;
  const hide = !compact() && [...WM.wins.values()].some(w => !w.min && w.desk === WM.desk && w.y + w.h > VH() - 84 && w.x < mid + half && w.x + w.w > mid - half);
  osEl.classList.toggle('dock-auto', hide);
}
function chrome() {
  P.dockRender();
  const w = WM.active();
  $('#app-name').textContent = w ? P.apps[w.app].name : 'Desktop';
  $$('.dock-it', dock).forEach(b => b.classList.toggle('on', !!WM.byApp(b.dataset.app)));
}
function changed() { updateDock(); chrome(); saveSession(); P.emit('wm'); }
function glide(w) {
  w.node.classList.add('glide'); place(w);
  clearTimeout(w._g); w._g = setTimeout(() => w.node.classList.remove('glide'), 340);
  changed();
}
function setFrac(w, frac, state) {
  if (w.state === 'normal') w.restore = { x: w.x, y: w.y, w: w.w, h: w.h };
  w.state = state; w.frac = frac; Object.assign(w, zoneRect(frac)); glide(w);
}
function focusNext(except) {
  const id = WM.mru.find(i => i !== except && WM.wins.has(i) && !WM.wins.get(i).min && WM.wins.get(i).desk === WM.desk);
  if (id) WM.focus(id); else { WM.activeId = null; chrome(); }
}
// Virtual desktops: every window lives on one desktop; only the current desktop's windows are shown.
function deskShow(n) {
  WM.desk = n; WM.activeId = null; store.set('desk', n);
  for (const o of WM.wins.values()) { o.node.classList.toggle('away', o.desk !== n); o.node.classList.remove('active'); }
  P.emit('desk');
}
const wrapDesk = n => ((n % WM.desks) + WM.desks) % WM.desks;
WM.setDesk = n => { n = wrapDesk(n); if (n === WM.desk) return; deskShow(n); focusNext(null); changed(); };
WM.moveTo = (id, n) => {
  const w = WM.wins.get(id); if (!w) return;
  w.desk = wrapDesk(n); w.node.classList.toggle('away', w.desk !== WM.desk); w.node.classList.remove('active');
  if (WM.activeId === id) focusNext(id);
  changed();
};
WM.active = () => { const w = WM.wins.get(WM.activeId); return w && !w.min && w.desk === WM.desk ? w : null; };
WM.byApp = app => [...WM.wins.values()].find(w => w.app === app);
WM.focus = id => {
  const w = WM.wins.get(id); if (!w) return;
  if (w.desk !== WM.desk) deskShow(w.desk);
  const was = WM.activeId === id && !w.min;
  if (w.min) { w.min = false; w.node.classList.remove('min'); }
  if (!was || +w.node.style.zIndex !== WM.z) w.node.style.zIndex = ++WM.z;
  WM.mru = [id, ...WM.mru.filter(x => x !== id)];
  for (const o of WM.wins.values()) o.node.classList.toggle('active', o === w);
  WM.activeId = id;
  if (!was) { const a = P.apps[w.app]; a.focus && a.focus(w); changed(); }
};
WM.minimize = id => {
  const w = WM.wins.get(id); if (!w || w.min) return;
  const it = $(`.dock-it[data-app="${w.app}"]`, dock), r = w.node.getBoundingClientRect();
  if (it) { const d = it.getBoundingClientRect(); w.node.style.setProperty('--mx', (d.left + d.width / 2 - r.left - r.width / 2) + 'px'); w.node.style.setProperty('--my', (d.top + d.height / 2 - r.top - r.height / 2) + 'px'); }
  w.min = true; w.node.classList.add('min'); w.node.classList.remove('active');
  focusNext(id); changed();
};
WM.close = id => {
  const w = WM.wins.get(id); if (!w) return;
  const a = P.apps[w.app];
  try { a.unmount && a.unmount(w); w.clean.forEach(f => f()); } catch (e) { console.error(e); }
  w.node.classList.add('closing');
  WM.wins.delete(id); WM.mru = WM.mru.filter(x => x !== id);
  setTimeout(() => w.node.remove(), 190);
  if (WM.activeId === id) focusNext(id);
  changed();
};
WM.restore = id => {
  const w = WM.wins.get(id); if (!w || w.state === 'normal') return;
  const a = work(), r = w.restore || { x: a.x + 60, y: a.y + 30, w: Math.min(760, a.w - 120), h: Math.min(500, a.h - 140) };
  Object.assign(w, r); w.state = 'normal'; w.frac = null; glide(w);
};
WM.toggleMax = id => { const w = WM.wins.get(id); if (!w) return; if (w.state === 'max') WM.restore(id); else setFrac(w, ZONES.max, 'max'); };
WM.snap = (id, zone) => { const w = WM.wins.get(id); if (!w) return; const f = typeof zone === 'string' ? ZONES[zone] : zone; setFrac(w, f, f[2] === 1 && f[3] === 1 ? 'max' : 'snap'); };
const zoneAt = (x, y) => {
  const W = VW(), H = VH(), e = 12;
  if (x <= e) return y < H * .25 ? 'tl' : y > H * .78 ? 'bl' : 'left';
  if (x >= W - e) return y < H * .25 ? 'tr' : y > H * .78 ? 'br' : 'right';
  return y <= MB + 2 ? 'max' : null;
};
function showGhost(zone) {
  const g = $('#ghost');
  if (!zone) return g.classList.remove('on');
  const r = zoneRect(ZONES[zone]);
  Object.assign(g.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  g.classList.add('on');
}
const LAYOUTS = [
  [[0, 0, .5, 1], [.5, 0, .5, 1]],
  [[0, 0, 2 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
  [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]],
  [[0, 0, 1, 1]],
];
function snapPop(w, btn) {
  closeMenus();
  const r = btn.getBoundingClientRect();
  const p = el(`<div class="snap-pop glass">${LAYOUTS.map((l, li) => `<div class="snap-lay">${l.map((f, fi) => `<button data-l="${li}" data-f="${fi}" aria-label="Snap layout" style="left:${f[0] * 100}%;top:${f[1] * 100}%;width:calc(${f[2] * 100}% - 2px);height:calc(${f[3] * 100}% - 2px)"></button>`).join('')}</div>`).join('')}</div>`);
  layer.append(p);
  p.style.left = clamp(r.left - 10, 8, VW() - p.offsetWidth - 8) + 'px'; p.style.top = (r.bottom + 8) + 'px';
  p.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; p.remove(); WM.snap(w.id, LAYOUTS[+b.dataset.l][+b.dataset.f]); });
  p.addEventListener('mouseleave', () => p.remove());
}
WM.open = (appId, args, geo) => {
  const app = P.apps[appId]; if (!app) return null;
  let w = WM.byApp(appId);
  if (w) { WM.focus(w.id); if (args && app.args) app.args(w, args); return w; }
  const id = 'w' + (++WM.seq), a = work(), n = WM.wins.size;
  const node = el(`<section class="win" aria-label="${esc(app.name)}" data-id="${id}" data-app="${appId}">
    <header class="win-bar"><div class="lights"><button class="lt lt-c" data-w="close" aria-label="Close window" title="Close (Alt+W)"></button><button class="lt lt-m" data-w="min" aria-label="Minimise window" title="Minimise (Alt+M)"></button><button class="lt lt-x" data-w="max" aria-label="Maximise window" title="Maximise (Alt+Up)"></button></div><div class="win-title"></div><div class="win-tools"></div></header>
    <div class="win-body"></div>${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(d => `<i class="rs rs-${d}" data-rs="${d}"></i>`).join('')}</section>`);
  const ww = Math.min(app.w || 720, a.w), hh = Math.min(app.h || 480, Math.max(240, a.h - 84));
  w = { id, app: appId, node, body: $('.win-body', node), tools: $('.win-tools', node), clean: [], min: false, state: 'normal', frac: null, restore: null, desk: WM.desk,
    x: Math.round(a.x + (a.w - ww) / 2 + ((n % 5) - 1) * 28), y: Math.round(a.y + Math.max(0, (a.h - 84 - hh) / 2) + (n % 5) * 24), w: ww, h: hh };
  if (geo) Object.assign(w, { x: geo.x, y: geo.y, w: geo.w, h: geo.h, state: geo.state || 'normal', frac: geo.frac || null, restore: geo.restore || null, desk: geo.desk == null ? WM.desk : clamp(geo.desk | 0, 0, WM.desks - 1) });
  if (w.frac) Object.assign(w, zoneRect(w.frac));
  w.x = clamp(w.x, 0, VW() - w.w); w.y = clamp(w.y, MB, VH() - 60);
  w.setTitle = t => { $('.win-title', node).textContent = t; };
  w.setTitle(app.name);
  WM.wins.set(id, w); desk.append(node); place(w);
  node.classList.toggle('away', w.desk !== WM.desk);

  node.addEventListener('pointerdown', () => WM.focus(id), true);
  $('.lights', node).addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (b) ({ close: WM.close, min: WM.minimize, max: WM.toggleMax })[b.dataset.w](id); });
  const mx = $('.lt-x', node); let hov;
  mx.addEventListener('mouseenter', () => { hov = setTimeout(() => snapPop(w, mx), 450); });
  mx.addEventListener('mouseleave', () => clearTimeout(hov));
  mx.addEventListener('click', () => clearTimeout(hov));

  const bar = $('.win-bar', node);
  bar.addEventListener('pointerdown', e => {
    if (e.button !== 0 || compact() || e.target.closest('button,input,select,a')) return;
    const sx = e.clientX, sy = e.clientY; let ox = sx - w.x, oy = sy - w.y, moved = false, zone = null;
    bar.setPointerCapture(e.pointerId);
    const mv = ev => {
      if (!moved) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        moved = true; node.classList.add('dragging');
        if (w.state !== 'normal') { const r = w.restore || { w: w.w, h: w.h }, ratio = (sx - w.x) / w.w; w.w = r.w; w.h = r.h; ox = r.w * ratio; w.state = 'normal'; w.frac = null; }
      }
      w.x = clamp(ev.clientX - ox, 90 - w.w, VW() - 90); w.y = clamp(ev.clientY - oy, MB, VH() - 44); place(w);
      zone = zoneAt(ev.clientX, ev.clientY); showGhost(zone);
    };
    const up = () => {
      bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
      node.classList.remove('dragging'); showGhost(null);
      if (moved && zone) WM.snap(id, zone); else if (moved) changed();
    };
    bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  });
  bar.addEventListener('dblclick', e => { if (!e.target.closest('button,input,select')) WM.toggleMax(id); });

  node.addEventListener('pointerdown', e => {
    const d = e.target.dataset && e.target.dataset.rs; if (!d || compact()) return;
    e.preventDefault(); const h = e.target; h.setPointerCapture(e.pointerId); node.classList.add('dragging');
    const s = { x: w.x, y: w.y, w: w.w, h: w.h, px: e.clientX, py: e.clientY };
    const mv = ev => {
      const dx = ev.clientX - s.px, dy = ev.clientY - s.py; let { x, y, w: nw, h: nh } = s;
      if (d.includes('e')) nw = Math.max(340, s.w + dx);
      if (d.includes('s')) nh = Math.max(220, s.h + dy);
      if (d.includes('w')) { nw = Math.max(340, s.w - dx); x = s.x + s.w - nw; }
      if (d.includes('n')) { nh = Math.max(220, s.h - dy); y = s.y + s.h - nh; if (y < MB) { nh -= MB - y; y = MB; } }
      Object.assign(w, { x, y, w: nw, h: nh, state: 'normal', frac: null }); place(w);
    };
    const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); node.classList.remove('dragging'); changed(); };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  });

  app.mount(w, args || {});
  WM.focus(id);
  return w;
};
P.openFile = path => WM.open('studio', { file: path });

/* ---------- dock ---------- */
const DOCK = ['terminal', 'studio', 'vibe', 'arena', 'files', 'notes', 'toolbox', 'focus', 'settings'];
P.pins = store.get('pins', []);
// The dock shows the built-in apps, then pinned apps and anything else that is running.
P.dockRender = force => {
  if (!dock) return;
  const base = DOCK.filter(id => P.apps[id]);
  const extra = [...P.pins, ...[...WM.wins.values()].map(w => w.app)].filter((id, i, a) => P.apps[id] && !base.includes(id) && a.indexOf(id) === i);
  const key = [...base, '|', ...extra].join();
  if (!force && dock.dataset.key === key) return;
  dock.dataset.key = key;
  const btn = id => `<button class="dock-it" data-app="${esc(id)}" data-name="${esc(P.apps[id].name)}" aria-label="${esc(P.apps[id].name)}">${appIcon(id)}</button>`;
  dock.innerHTML = base.map(btn).join('') + (extra.length ? '<i class="dock-sep"></i>' + extra.map(btn).join('') : '');
  $$('.dock-it', dock).forEach(b => b.classList.toggle('on', !!WM.byApp(b.dataset.app)));
};
function buildDock() {
  P.dockRender();
  dock.addEventListener('click', e => {
    const b = e.target.closest('.dock-it'); if (!b) return;
    const w = WM.byApp(b.dataset.app);
    if (!w) WM.open(b.dataset.app); else if (WM.activeId === w.id && !w.min) WM.minimize(w.id); else WM.focus(w.id);
  });
  let raf = 0;
  dock.addEventListener('mousemove', e => {
    if (!S.magnify || compact() || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      for (const it of $$('.dock-it', dock)) { const r = it.getBoundingClientRect(), d = e.clientX - (r.left + r.width / 2); it.style.setProperty('--s', (1 + .5 * Math.exp(-(d * d) / 9000)).toFixed(3)); }
    });
  });
  let peekT;
  dock.addEventListener('mouseleave', () => { $$('.dock-it', dock).forEach(it => it.style.removeProperty('--s')); peekT = setTimeout(() => dock.classList.remove('peek'), 500); });
  dock.addEventListener('mouseenter', () => clearTimeout(peekT));
  $('#dock-hot').addEventListener('mouseenter', () => { clearTimeout(peekT); dock.classList.add('peek'); });
}

/* ---------- Island ---------- */
const isl = { acts: new Map(), big: false, flash: null, ft: 0 };
function islRender() {
  const acts = [...isl.acts.values()].sort((a, b) => (b.prio || 0) - (a.prio || 0));
  let html, big = false;
  if (isl.flash) { const f = isl.flash; html = `<div class="isl-c tone-${f.tone || 'info'}">${icon(f.icon || 'bell')}<span>${esc(f.text)}</span>${f.sub ? `<em>${esc(f.sub)}</em>` : ''}</div>`; }
  else if (isl.big && acts.length) { big = true; html = `<div class="isl-x">${acts.map(a => `<div class="isl-card">${a.expanded()}</div>`).join('')}</div>`; }
  else if (acts.length) html = `<div class="isl-c">${acts.slice(0, 2).map(a => `<span class="isl-seg">${a.compact()}</span>`).join('<i class="isl-sep"></i>')}</div>`;
  else html = `<div class="isl-c isl-idle">${icon('search')}<span>Search</span><kbd>Ctrl Space</kbd>${P.idleInfo.map(f => f()).join('')}</div>`;
  if (html !== isl.html) { islIn.innerHTML = html; isl.html = html; }
  islEl.classList.toggle('big', big);
  islEl.setAttribute('aria-expanded', String(big));
  P.island.tick();
  islSize();
}
function islSize() { const r = islIn.firstElementChild; if (!r) return; islEl.style.width = r.offsetWidth + 'px'; islEl.style.height = r.offsetHeight + 'px'; }
P.idleInfo = [];   // functions returning extra HTML for the idle Island (git branch, streak)
P.keyHooks = [];   // functions (event) => true when they handled a key
P.palSources = []; // functions returning extra palette items
P.cmdExtra = [];   // functions returning extra palette commands
P.island = {
  set(id, act) { isl.acts.set(id, act); islRender(); },
  remove(id) { if (isl.acts.delete(id)) { if (!isl.acts.size) isl.big = false; islRender(); } },
  has: id => isl.acts.has(id),
  tick() { for (const a of isl.acts.values()) a.tick && a.tick(islEl); },
  flash(o) { if (S.dnd && !o.force) return; isl.flash = o; clearTimeout(isl.ft); isl.ft = setTimeout(() => { isl.flash = null; islRender(); }, o.ms || 2600); islRender(); },
  toggle(v) { isl.big = isl.acts.size ? (v === undefined ? !isl.big : v) : false; islRender(); },
  render: islRender,
};
function islClick(e) {
  const b = e.target.closest('[data-do]');
  if (b) { const [id, fn] = b.dataset.do.split('.'); const a = isl.acts.get(id); a && a.on && a.on[fn] && a.on[fn](b); return; }
  if (e.target.closest('input,select')) return;
  if (isl.flash) { const f = isl.flash; clearTimeout(isl.ft); isl.flash = null; islRender(); f.run && f.run(); return; }
  if (!isl.acts.size) return Palette.toggle();
  if (!isl.big) P.island.toggle(true); else if (!e.target.closest('.isl-card')) P.island.toggle(false);
}

/* ---------- command palette ---------- */
const Palette = { el: null, list: [], sel: 0 };
P.commands = () => {
  const act = f => () => { const w = WM.active(); if (w) f(w.id); };
  return [
    { t: 'Toggle dark mode', ic: 'moon', run: () => P.set('theme', isDark() ? 'light' : 'dark') },
    { t: 'Snap window left', ic: 'left', k: 'Alt ←', run: act(id => WM.snap(id, 'left')) },
    { t: 'Snap window right', ic: 'right', k: 'Alt →', run: act(id => WM.snap(id, 'right')) },
    { t: 'Maximise window', ic: 'max', k: 'Alt ↑', run: act(WM.toggleMax) },
    { t: 'Close window', ic: 'x', k: 'Alt W', run: act(WM.close) },
    { t: 'Show desktop', ic: 'max', k: 'Alt D', run: showDesktop },
    { t: 'New file', ic: 'plus', run: () => P.newFile() },
    { t: 'Start 25 minute focus', ic: 'timer', run: () => P.timer.start(25, 'Focus') },
    { t: 'Start 5 minute break', ic: 'timer', run: () => P.timer.start(5, 'Break') },
    { t: 'Play or pause ambient sound', ic: 'music', run: () => P.audio.toggle() },
    { t: 'Next wallpaper', ic: 'sun', run: () => { const k = Object.keys(WALLS); P.set('wall', k[(k.indexOf(S.wall) + 1) % k.length]); } },
    { t: 'Do Not Disturb', ic: 'belloff', run: () => P.set('dnd', !S.dnd) },
    { t: 'Keyboard shortcuts', ic: 'keyboard', k: 'Ctrl /', run: () => WM.open('shortcuts') },
    ...P.cmdExtra.flatMap(f => f()),
  ].map(c => ({ ...c, s: 'Command', ic: icon(c.ic) }));
};
const score = (q, t) => { t = t.toLowerCase(); const i = t.indexOf(q); if (i >= 0) return 100 - i + (i === 0 ? 20 : 0); let j = 0; for (const ch of t) if (ch === q[j]) j++; return j === q.length ? 10 : -1; };
function palItems(raw) {
  const q = raw.trim().toLowerCase();
  if (Palette.mode) return Palette.mode(q);
  const apps = Object.entries(P.apps).map(([id, a]) => ({ t: a.name, s: 'App', ic: appIcon(id), run: () => WM.open(id) }));
  if (!q) return [...apps.slice(0, 8), ...P.commands().slice(0, 3)];
  if (raw.trim().startsWith('>')) { const c = raw.trim().slice(1).trim(); return c ? [{ t: c, s: 'Run in Terminal', ic: icon('terminal'), run: () => P.termRun(c) }] : []; }
  if (raw.trim().startsWith('?')) { const c = raw.trim().slice(1).trim(); return c ? [{ t: c, s: 'Ask Vibe', ic: icon('sparkles'), run: () => P.askVibe(c) }] : []; }
  const out = [];
  if (/^[\d\s+\-*/().%]+$/.test(q) && /\d/.test(q) && /[+\-*/%]/.test(q)) {
    try { const v = Function('"use strict";return (' + q + ')')(); if (Number.isFinite(v)) out.push({ t: '= ' + (Math.round(v * 1e10) / 1e10), s: 'Enter copies the result', ic: icon('braces'), run: () => P.copy(String(Math.round(v * 1e10) / 1e10), 'Result copied') }); } catch {}
  }
  const files = Object.keys(FS.files).map(p => ({ t: FS.name(p), s: FS.short(p), ic: icon('file'), run: () => P.openFile(p) }));
  const ranked = [...apps, ...P.commands(), ...files, ...P.palSources.flatMap(f => f())].map(it => ({ it, sc: Math.max(score(q, it.t), it.s && it.s !== 'App' && it.s !== 'Command' ? score(q, it.s) - 30 : -1) })).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 8).map(x => x.it);
  out.push(...ranked);
  if (q.length > 2) out.push({ t: raw.trim(), s: 'Ask Vibe', ic: icon('sparkles'), run: () => P.askVibe(raw.trim()) });
  return out;
}
Palette.render = () => {
  const list = $('.pal-list', Palette.el); Palette.list = palItems($('#pal-q').value);
  Palette.sel = clamp(Palette.sel, 0, Palette.list.length - 1);
  list.innerHTML = Palette.list.map((it, i) => `<button class="pal-row${i === Palette.sel ? ' sel' : ''}" data-i="${i}" role="option"><span class="pal-ic">${it.ic}</span><span class="pal-t">${esc(it.t)}</span><span class="pal-s">${esc(it.s || '')}</span>${it.k ? `<kbd>${esc(it.k)}</kbd>` : ''}</button>`).join('') || '<div class="pal-empty">Nothing matches. Try an app name, a file, or a sum like 12*8.</div>';
  const s = $('.pal-row.sel', list); s && s.scrollIntoView({ block: 'nearest' });
};
Palette.run = i => { const it = Palette.list[i]; Palette.close(); it && it.run(); };
Palette.close = () => { Palette.mode = null; if (Palette.el) { Palette.el.remove(); Palette.el = null; return true; } return false; };
Palette.open = (q = '', mode = null, hint = 'Search apps, files and commands') => {
  closeOverlays();
  Palette.mode = mode;
  const p = Palette.el = el(`<div id="pal" class="glass panel" role="dialog" aria-label="Search and commands"><div class="pal-in">${icon('search')}<input id="pal-q" type="text" placeholder="${esc(hint)}" autocomplete="off" spellcheck="false" aria-label="Search"><kbd>Esc</kbd></div><div class="pal-list" role="listbox"></div><div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd>move</span><span><kbd>Enter</kbd>run</span><span><kbd>&gt;</kbd>terminal command</span><span><kbd>?</kbd>ask Vibe</span></div></div>`);
  layer.append(p);
  const inp = $('#pal-q', p); inp.value = q; Palette.sel = 0;
  inp.addEventListener('input', () => { Palette.sel = 0; Palette.render(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = Palette.list.length; if (n) { Palette.sel = (Palette.sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; Palette.render(); } }
    else if (e.key === 'Enter') { e.preventDefault(); Palette.run(Palette.sel); }
  });
  p.addEventListener('click', e => { const r = e.target.closest('.pal-row'); if (r) Palette.run(+r.dataset.i); });
  Palette.render(); inp.focus();
};
Palette.toggle = q => (Palette.el ? Palette.close() : Palette.open(q));
P.palette = Palette;

/* ---------- control centre, switcher, desktop ---------- */
P.swatches = kind => kind === 'wall'
  ? `<div class="sw-row">${Object.entries(WALLS).map(([k, c]) => `<button class="sw wall${S.wall === k ? ' on' : ''}" data-set="wall" data-val="${k}" aria-label="${k} wallpaper" title="${k}" style="background:linear-gradient(135deg,${c[1]},${c[2]} 55%,${c[3]})"></button>`).join('')}</div>`
  : `<div class="sw-row">${ACCENTS.map(c => `<button class="sw${S.accent === c ? ' on' : ''}" data-set="accent" data-val="${c}" aria-label="Accent ${c}" style="background:${c}"></button>`).join('')}</div>`;
function ccHTML() {
  return `<div class="cc-tiles">
    <button class="cc-tile${isDark() ? ' on' : ''}" data-cc="dark">${icon('moon')}Dark mode</button>
    <button class="cc-tile${S.dnd ? ' on' : ''}" data-cc="dnd">${icon('belloff')}Do Not Disturb</button>
    <button class="cc-tile${S.motion ? ' on' : ''}" data-cc="motion">${icon('wind')}Animations</button></div>
  <div class="cc-box"><label for="cc-vol">Sound volume</label><input id="cc-vol" type="range" min="0" max="1" step="0.01" value="${S.vol}" data-range="vol"></div>
  <div class="cc-box"><label for="cc-blur">Glass blur</label><input id="cc-blur" type="range" min="6" max="48" step="1" value="${S.blur}" data-range="blur"></div>
  <div class="cc-box"><label>Wallpaper</label>${P.swatches('wall')}</div>
  <div class="cc-box"><label>Accent</label>${P.swatches('accent')}</div>
  <div class="sw-row"><button class="btn" data-cc="settings">${icon('sliders')}Settings</button><button class="btn" data-cc="keys">${icon('keyboard')}Shortcuts</button><button class="btn" data-cc="lock">${icon('lock')}Lock</button></div>`;
}
function toggleCC() {
  const ex = $('#cc'); if (ex) return ex.remove();
  closeOverlays();
  const c = el(`<div id="cc" class="glass panel" role="dialog" aria-label="Control Centre">${ccHTML()}</div>`);
  layer.append(c);
  c.addEventListener('click', e => {
    const b = e.target.closest('[data-cc]'); if (!b) return;
    const k = b.dataset.cc;
    if (k === 'dark') P.set('theme', isDark() ? 'light' : 'dark');
    else if (k === 'dnd') P.set('dnd', !S.dnd);
    else if (k === 'motion') P.set('motion', !S.motion);
    else if (k === 'lock') { c.remove(); P.lock && P.lock(); }
    else { c.remove(); WM.open(k === 'keys' ? 'shortcuts' : 'settings'); }
  });
}
const Sw = { el: null, list: [], i: 0 };
function swStep(dir) {
  if (!Sw.el) {
    Sw.list = WM.mru.filter(id => WM.wins.has(id)); if (!Sw.list.length) return;
    Sw.i = 0; Sw.el = el('<div id="switcher" class="glass panel" role="listbox" aria-label="Switch windows"></div>'); layer.append(Sw.el);
  }
  const n = Sw.list.length; Sw.i = (Sw.i + dir + n) % n;
  Sw.el.innerHTML = Sw.list.map((id, i) => { const w = WM.wins.get(id); return `<div class="sw-it${i === Sw.i ? ' sel' : ''}" role="option">${appIcon(w.app)}<span>${esc(P.apps[w.app].name)}</span></div>`; }).join('');
}
function swCommit() { if (!Sw.el) return; Sw.el.remove(); Sw.el = null; WM.focus(Sw.list[Sw.i]); }
let hidden = null;
function showDesktop() {
  const open = [...WM.wins.values()].filter(w => !w.min && w.desk === WM.desk);
  if (open.length) { hidden = open.map(w => w.id); open.forEach(w => WM.minimize(w.id)); }
  else if (hidden) { hidden.forEach(id => WM.focus(id)); hidden = null; }
}
function closeOverlays() {
  let any = closeMenus();
  if (Palette.close()) any = true;
  const c = $('#cc'); if (c) { c.remove(); any = true; }
  if (isl.big) { P.island.toggle(false); any = true; }
  return any;
}
P.newFile = async () => {
  const name = await P.ask({ title: 'New file', value: 'projects/untitled.js', placeholder: 'projects/app/main.js' });
  if (!name) return;
  const p = FS.norm(name);
  try { if (!FS.exists(p)) FS.write(p, ''); P.openFile(p); } catch (e) { P.island.flash({ icon: 'x', text: e.message, tone: 'bad' }); }
};
function barMenu(btn, items) { const r = btn.getBoundingClientRect(); P.menu(r.left, r.bottom + 6, items); }
function tickClock() {
  const d = new Date();
  $('#clock').innerHTML = `<span class="clock-date">${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span class="num">${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>`;
}

/* ---------- keyboard ---------- */
function keys(e) {
  const code = e.code, ctrl = e.ctrlKey || e.metaKey, alt = e.altKey;
  for (const h of P.keyHooks) if (h(e)) { e.preventDefault(); return; }
  if (e.key === 'Escape') { if (Sw.el) { Sw.el.remove(); Sw.el = null; } else if (closeOverlays()) e.preventDefault(); return; }
  const go = f => { e.preventDefault(); f(); };
  if (ctrl && alt && code === 'KeyT') return go(() => WM.open('terminal'));
  if (ctrl && alt && (code === 'ArrowRight' || code === 'ArrowLeft')) return go(() => {
    const d = code === 'ArrowRight' ? 1 : -1, aw = WM.active();
    if (e.shiftKey && aw) { WM.moveTo(aw.id, aw.desk + d); WM.focus(aw.id); } else WM.setDesk(WM.desk + d);
  });
  if (ctrl && !alt) {
    if (code === 'Space' || code === 'KeyK') return go(() => Palette.toggle());
    if (code === 'Comma') return go(() => WM.open('settings'));
    if (code === 'Slash') return go(() => WM.open('shortcuts'));
    return;
  }
  if (!alt || ctrl) return;
  const w = WM.active();
  if (code === 'Backquote' || code === 'Tab') return go(() => swStep(e.shiftKey ? -1 : 1));
  if (code === 'KeyD') return go(showDesktop);
  if (code === 'KeyI') return go(() => P.island.toggle());
  if (/^Digit[1-9]$/.test(code)) return go(() => { const id = DOCK[+code.slice(5) - 1]; id && WM.open(id); });
  if (!w) return;
  if (code === 'ArrowLeft') go(() => WM.snap(w.id, 'left'));
  else if (code === 'ArrowRight') go(() => WM.snap(w.id, 'right'));
  else if (code === 'ArrowUp') go(() => WM.snap(w.id, 'max'));
  else if (code === 'ArrowDown') go(() => (w.state === 'normal' ? WM.minimize(w.id) : WM.restore(w.id)));
  else if (code === 'KeyW') go(() => WM.close(w.id));
  else if (code === 'KeyM') go(() => WM.minimize(w.id));
}

/* ---------- boot ---------- */
P.boot = () => {
  osEl = $('#os');
  osEl.innerHTML = `<div id="wall"><i></i><i></i><i></i></div><main id="desk"></main><div id="ghost"></div>
    <header id="bar"><div class="bar-l"><button id="logo" class="bar-btn" aria-label="PrismOS menu">${icon('prism')}</button><b id="app-name">Desktop</b><button class="bar-btn bar-menu" data-menu="window">Window</button><button class="bar-btn bar-menu" data-menu="help">Help</button></div>
    <div class="bar-r"><button id="cc-btn" class="bar-btn" aria-label="Control Centre">${icon('toggles')}</button><button id="clock" class="bar-btn" aria-label="Date and time"></button></div></header>
    <div id="island" role="button" tabindex="0" aria-label="Island: live activity and search"><div class="isl-in"></div></div>
    <div id="dock-hot"></div><nav id="dock" class="glass" aria-label="Dock"></nav><div id="layer"></div>
    <div id="boot"><div class="boot-in">${icon('prism')}<b>PrismOS</b><div class="boot-bar"><i></i></div></div></div>`;
  desk = $('#desk'); layer = $('#layer'); dock = $('#dock'); islEl = $('#island'); islIn = $('.isl-in');
  osEl.classList.toggle('compact', compact());
  FS.load(); applySettings(); buildDock(); islRender(); tickClock(); setInterval(tickClock, 10000);
  document.fonts && document.fonts.ready.then(islSize);

  islEl.addEventListener('click', islClick);
  islEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === islEl) { e.preventDefault(); islClick(e); } });
  islEl.addEventListener('input', e => { const r = e.target.closest('[data-range]'); if (r) P.set(r.dataset.range, +r.value); });
  document.addEventListener('keydown', keys, true);
  document.addEventListener('keyup', e => { if (e.key === 'Alt') swCommit(); }, true);
  window.addEventListener('blur', () => { if (Sw.el) { Sw.el.remove(); Sw.el = null; } });
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.menu,.snap-pop,.bar-menu,#logo')) closeMenus();
    if (Palette.el && !e.target.closest('#pal,#island')) Palette.close();
    if ($('#cc') && !e.target.closest('#cc,#cc-btn')) $('#cc').remove();
    if (isl.big && !e.target.closest('#island')) P.island.toggle(false);
  }, true);
  document.addEventListener('click', e => { const b = e.target.closest('[data-set]'); if (b) P.set(b.dataset.set, b.dataset.val); });
  layer.addEventListener('input', e => { const r = e.target.closest('[data-range]'); if (r) P.set(r.dataset.range, +r.value); });
  P.on('settings', k => { const c = $('#cc'); if (c && k !== 'vol' && k !== 'blur') c.innerHTML = ccHTML(); });

  $('#cc-btn').addEventListener('click', toggleCC);
  $('#clock').addEventListener('click', toggleCC);
  $('#logo').addEventListener('click', e => barMenu(e.currentTarget, [
    { label: 'About PrismOS', icon: 'prism', run: () => WM.open('settings') },
    { label: 'Settings', icon: 'sliders', kbd: 'Ctrl ,', run: () => WM.open('settings') },
    { label: 'Search and commands', icon: 'search', kbd: 'Ctrl Space', run: () => Palette.open() },
    { sep: true },
    { label: 'Show desktop', kbd: 'Alt D', run: showDesktop },
  ]));
  $$('.bar-menu').forEach(b => b.addEventListener('click', () => {
    const w = WM.active(), off = !w, on = f => () => f(w.id);
    barMenu(b, b.dataset.menu === 'window' ? [
      { label: 'Snap left', icon: 'left', kbd: 'Alt ←', disabled: off, run: on(id => WM.snap(id, 'left')) },
      { label: 'Snap right', icon: 'right', kbd: 'Alt →', disabled: off, run: on(id => WM.snap(id, 'right')) },
      { label: 'Maximise', icon: 'max', kbd: 'Alt ↑', disabled: off, run: on(id => WM.snap(id, 'max')) },
      { label: 'Minimise', kbd: 'Alt M', disabled: off, run: on(WM.minimize) },
      { sep: true },
      { label: 'Close', icon: 'x', kbd: 'Alt W', disabled: off, danger: true, run: on(WM.close) },
    ] : [
      { label: 'Keyboard shortcuts', icon: 'keyboard', kbd: 'Ctrl /', run: () => WM.open('shortcuts') },
      { label: 'Open welcome guide', icon: 'file', run: () => P.openFile('/home/welcome.md') },
    ]);
  }));
  desk.addEventListener('contextmenu', e => {
    if (e.target !== desk) return; e.preventDefault();
    P.menu(e.clientX, e.clientY, [
      { label: 'New file', icon: 'plus', run: () => P.newFile() },
      { label: 'Open Terminal', icon: 'terminal', kbd: 'Ctrl Alt T', run: () => WM.open('terminal') },
      { sep: true },
      { label: 'Next wallpaper', icon: 'sun', run: () => { const k = Object.keys(WALLS); P.set('wall', k[(k.indexOf(S.wall) + 1) % k.length]); } },
      { label: 'Settings', icon: 'sliders', run: () => WM.open('settings') },
    ]);
  });
  window.addEventListener('resize', debounce(() => {
    osEl.classList.toggle('compact', compact());
    for (const w of WM.wins.values()) { if (w.frac) Object.assign(w, zoneRect(w.frac)); else { w.w = Math.max(w.w, 340); w.h = Math.max(w.h, 220); w.x = clamp(w.x, 90 - w.w, VW() - 90); w.y = clamp(w.y, MB, VH() - 44); } place(w); }
    updateDock(); islSize();
  }, 80));

  P.emit('shell');
  // Wait for a real viewport before placing windows (the page can load in a hidden, zero-size pane).
  if (VW() < 200 || VH() < 200) {
    const ro = new ResizeObserver(() => { if (VW() >= 200 && VH() >= 200) { ro.disconnect(); osEl.classList.toggle('compact', compact()); openInitial(); } });
    ro.observe(osEl);
  } else openInitial();
  setTimeout(() => $('#boot').classList.add('done'), 750);
};
function openInitial() {
  const sess = (store.get('session') || []).filter(g => g && g.w >= 200 && g.h >= 150), d0 = clamp(store.get('desk', 0) | 0, 0, WM.desks - 1);
  if (sess.length) {
    sess.sort((a, b) => a.z - b.z).forEach(g => { if (!P.apps[g.app]) return; const w = WM.open(g.app, null, g); if (w && g.min) { w.min = true; w.node.classList.add('min'); w.node.classList.remove('active'); } });
    deskShow(d0); focusNext(null);
  } else if (!store.get('booted')) {
    const a = work(), H = a.h - 90;
    if (compact()) WM.open('studio', { file: '/home/projects/hello/main.js' });
    else {
      const tw = Math.min(520, Math.round(a.w * .38)), sw = Math.min(840, Math.round(a.w * .56));
      WM.open('terminal', null, { x: a.x + a.w - tw - 28, y: a.y + 110, w: tw, h: Math.min(360, H - 116) });
      WM.open('studio', { file: '/home/projects/hello/main.js' }, { x: a.x + 28, y: a.y + 14, w: sw, h: Math.min(540, H) });
    }
    setTimeout(() => P.island.flash({ icon: 'prism', text: 'Welcome to PrismOS', sub: 'Press Ctrl Space', ms: 4200, force: true }), 1100);
  }
  store.set('booted', 1);
  changed();
  P.emit('ready');
}

Object.assign(P, { $, $$, el, esc, clamp, debounce, store, icon, appIcon, S, FS, WM, WALLS, ACCENTS, isDark, compact, icons: I, closeOverlays, showDesktop, work, VW, VH });
})();
