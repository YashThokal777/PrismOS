/* PrismOS desktop bridge. Does nothing in a browser. Inside the desktop app (Electron) it swaps in the real thing:
   - the file system mirrors a real folder (~/PrismOS),
   - the Terminal sends commands to your real shell,
   - Git calls the git installed on your computer,
   - the Browser app and site apps (browser.js) are real web windows. */
(() => {
'use strict';
const N = window.prismNative; if (!N) return;
const P = window.Prism, { $, el, esc, icon, store, FS, WM, debounce } = P;
P.native = N;
const flash = o => P.island.flash(o);
const fail = e => flash({ icon: 'x', text: e.message || String(e), tone: 'bad', ms: 3600 });
// '/home/projects/x' -> 'projects/x' (path relative to the real home folder)
const rel = p => { if (p !== '/home' && !p.startsWith('/home/')) throw new Error('Only files inside your PrismOS folder can be used here'); return p.slice(6); };

/* ---------- real files ---------- */
const seed = FS.seed.bind(FS), W = FS.write.bind(FS), MK = FS.mkdir.bind(FS), RM = FS.rm.bind(FS), MV = FS.mv.bind(FS);
const loadDisk = () => {
  const t = N.readTree();
  FS.files = {}; FS.dirs = new Set(['/', '/home']);
  t.dirs.forEach(d => FS.dirs.add('/home/' + d));
  for (const k in t.files) FS.files['/home/' + k] = t.files[k];
};
FS.save = function () { P.emit('fs'); };
FS.load = function () {
  loadDisk();
  if (!Object.keys(FS.files).length && FS.dirs.size <= 2) { seed(); for (const p in FS.files) N.write(rel(p), FS.files[p]); }
};
FS.write = function (p, c) { if (FS.isDir(p)) throw new Error(p + ' is a folder'); N.write(rel(p), String(c)); W(p, c); };
FS.mkdir = function (p) { N.mkdir(rel(p)); MK(p); };
FS.rm = function (p) { if (!FS.exists(p)) throw new Error('No such file or folder: ' + p); if (p === '/home' || p === '/') throw new Error('Cannot remove the home folder'); N.rm(rel(p)); RM(p); };
FS.mv = function (a, b) { if (FS.exists(b)) throw new Error(b + ' already exists'); if (!FS.exists(a)) throw new Error('No such file or folder: ' + a); N.mv(rel(a), rel(b)); MV(a, b); };
FS.reload = () => { try { loadDisk(); P.emit('fs'); } catch (e) { fail(e); } };
window.addEventListener('focus', debounce(FS.reload, 400));

/* ---------- real shell ---------- */
P.termKeep = new Set(['help', 'cd', 'pwd', 'clear', 'open', 'code', 'apps', 'ask', 'focus', 'theme', 'wall', 'neofetch', 'history']);
delete P.termCmds.git;
P.termHelp.length = 0;
P.termHelp.push(['anything else', 'runs in your real shell: git, node, npm, python, ls, and so on']);
P.termFallback = ctx => new Promise(res => {
  const buf = { out: '', err: '' }; let done = false;
  // PowerShell pads every error with position and category lines; keep only the message itself.
  const noise = /^At line:\d+ char:\d+|^\s*\+ (\.\.\.|CategoryInfo|FullyQualifiedErrorId)|^\s*\+\s*~*\s*$/;
  const emit = (k, final) => {
    const parts = buf[k].split(/\r?\n/); buf[k] = final ? '' : parts.pop();
    parts.forEach(l => { if ((final && !l) || (k === 'err' && N.platform === 'win32' && noise.test(l))) return; ctx.out(l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''), k === 'err' ? 'c-yellow' : ''); });
  };
  const h = N.exec(ctx.raw, rel(ctx.cwd), (k, text) => { buf[k] += text; emit(k, false); }, code => {
    if (done) return; done = true;
    emit('out', true); emit('err', true);
    if (code) ctx.out(`exit code ${code}`, 'c-dim');
    FS.reload(); P.emit('git'); res();
  });
  ctx.setStop(() => h.kill());
});

/* ---------- real git ---------- */
const lf = s => String(s).replace(/\r\n/g, '\n');
const run = (root, args) => N.git(args, rel(root));
const g = (root, ...args) => { const r = run(root, args); if (r.code !== 0) throw new Error((r.err || r.out || 'git failed').trim().split('\n')[0]); return r.out; };
const rootMemo = new Map();
const clearMemo = () => rootMemo.clear();
P.on('fs', clearMemo); P.on('git', clearMemo);
P.git.b = {
  name: 'native',
  repos: () => [],
  rootOf(path) {
    const d = FS.isDir(path) ? path : FS.parent(path);
    if (d !== '/home' && !d.startsWith('/home/')) return null;
    if (rootMemo.has(d)) return rootMemo.get(d);
    let root = null;
    const r = N.git(['rev-parse', '--show-toplevel'], rel(d));
    if (r.code === 0) {
      const top = r.out.trim().replace(/\\/g, '/'), home = N.home.replace(/\\/g, '/'), a = top.toLowerCase(), b = home.toLowerCase();
      if (a === b) root = '/home'; else if (a.startsWith(b + '/')) root = '/home/' + top.slice(home.length + 1);
    }
    rootMemo.set(d, root); return root;
  },
  init(dir) { g(dir, 'init'); P.emit('git'); },
  status(root) {
    const lines = g(root, 'status', '--porcelain=v1', '-b', '--untracked-files=all').split('\n').filter(Boolean);
    let branch = 'main'; const staged = [], unstaged = [], untracked = [];
    for (const l of lines) {
      if (l.startsWith('## ')) { branch = l.slice(3).replace(/^No commits yet on /, '').split('...')[0]; continue; }
      const X = l[0], Y = l[1]; let p = l.slice(3);
      if (p.includes(' -> ')) p = p.split(' -> ')[1];
      p = p.replace(/^"|"$/g, '');
      if (X === '?') { untracked.push(p); continue; }
      if (X !== ' ') staged.push({ path: p, st: X === 'A' ? 'A' : X === 'D' ? 'D' : 'M' });
      if (Y !== ' ') unstaged.push({ path: p, st: Y === 'D' ? 'D' : 'M' });
    }
    return { branch, staged, unstaged, untracked, merging: false };
  },
  stage(root, path) { if (path == null) g(root, 'add', '-A'); else g(root, 'add', '--', path); P.emit('git'); },
  unstage(root, path) {
    const r = run(root, path == null ? ['reset', '-q'] : ['reset', '-q', '--', path]);
    if (r.code !== 0) { if (path == null) g(root, 'rm', '-r', '--cached', '-q', '.'); else g(root, 'rm', '--cached', '-q', '--', path); }
    P.emit('git');
  },
  commit(root, msg) { const n = this.status(root).staged.length; g(root, 'commit', '-m', msg); const id = g(root, 'rev-parse', 'HEAD').trim(); P.emit('git'); return { id, n }; },
  log(root, n = 30) {
    const r = run(root, ['log', '-n', String(n), '--pretty=format:%H%x09%ct%x09%s']);
    return r.code !== 0 ? [] : r.out.split('\n').filter(Boolean).map(l => { const [id, t, ...m] = l.split('\t'); return { id, t: +t * 1000, msg: m.join('\t') }; });
  },
  branches(root) {
    const head = (run(root, ['symbolic-ref', '--short', 'HEAD']).out || '').trim() || 'HEAD';
    const list = (run(root, ['branch', '--format=%(refname:short)']).out || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!list.includes(head)) list.unshift(head);
    return { head, list };
  },
  diff(root, path, staged) {
    const show = ref => { const r = run(root, ['show', ref + ':' + path]); return r.code === 0 ? lf(r.out) : ''; };
    const wf = FS.files[(root === '/' ? '' : root) + '/' + path];
    return staged ? { a: show('HEAD'), b: show('') } : { a: show(''), b: wf == null ? '' : lf(wf) };
  },
  branch(root, name) { g(root, 'branch', name); P.emit('git'); },
  checkout(root, name, create) { if (create) g(root, 'checkout', '-b', name); else g(root, 'checkout', name); FS.reload(); P.emit('git'); },
};

/* ---------- app controls ---------- */
P.cmdExtra.push(() => [
  { t: 'Toggle full screen', ic: 'max', k: 'F11', run: () => N.app('fullscreen') },
  { t: 'Quit PrismOS', ic: 'power', run: () => N.app('quit') },
]);
P.keyHooks.push(e => (e.code === 'F11' ? (N.app('fullscreen'), true) : false));
P.on('shell', () => {
  const b = el(`<button class="bar-btn" id="power-btn" aria-label="Power">${icon('power')}</button>`);
  $('.bar-r').append(b);
  b.addEventListener('click', () => { const r = b.getBoundingClientRect(); P.menu(r.right - 210, r.bottom + 6, [
    { label: 'Toggle full screen', icon: 'max', kbd: 'F11', run: () => N.app('fullscreen') },
    { label: 'Lock', icon: 'lock', kbd: 'Alt L', run: () => P.lock() },
    { label: 'Open home folder in Files', icon: 'folder', run: () => WM.open('files', { dir: '/home' }) },
    { sep: true },
    { label: 'Quit PrismOS', icon: 'power', danger: true, run: () => N.app('quit') },
  ]); });
});
})();
