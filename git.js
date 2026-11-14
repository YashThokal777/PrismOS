/* PrismOS Git.
   In the browser this is a small version-control engine of its own that speaks the everyday git commands
   (it is not byte-compatible with real .git folders). The desktop app swaps in a backend that calls real git.
   Both backends expose the same calls, so the Studio panel and the Island do not care which one is active. */
(() => {
'use strict';
const P = window.Prism, { $, $$, el, esc, icon, store, FS, debounce } = P;
const flash = o => P.island.flash(o);
const fail = e => flash({ icon: 'x', text: e.message || String(e), tone: 'bad', ms: 3600 });

/* ---------- hashing and diff ---------- */
const cyrb = (s, seed) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};
const hash = s => cyrb(s, 1) + cyrb(s, 2) + cyrb(s, 3).slice(0, 8);
function diffLines(a, b) {
  const A = a.split('\n'), B = b.split('\n'), out = [];
  let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let ea = A.length, eb = B.length; while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
  const X = A.slice(s, ea), Y = B.slice(s, eb), n = X.length, m = Y.length;
  for (let i = 0; i < s; i++) out.push({ t: ' ', s: A[i] });
  if (n * m > 4e6) { X.forEach(l => out.push({ t: '-', s: l })); Y.forEach(l => out.push({ t: '+', s: l })); }
  else {
    const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = X[i] === Y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) { if (X[i] === Y[j]) { out.push({ t: ' ', s: X[i] }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: '-', s: X[i++] }); else out.push({ t: '+', s: Y[j++] }); }
    while (i < n) out.push({ t: '-', s: X[i++] });
    while (j < m) out.push({ t: '+', s: Y[j++] });
  }
  for (let i = ea; i < A.length; i++) out.push({ t: ' ', s: A[i] });
  return out;
}
function trimDiff(d, ctx = 3) {
  const keep = new Uint8Array(d.length), out = [];
  d.forEach((l, i) => { if (l.t !== ' ') for (let k = Math.max(0, i - ctx); k <= Math.min(d.length - 1, i + ctx); k++) keep[k] = 1; });
  let gap = false;
  d.forEach((l, i) => { if (!keep[i]) { gap = true; return; } if (gap && out.length) out.push({ t: '@', s: '' }); gap = false; out.push(l); });
  return out;
}
P.diffLines = diffLines; P.trimDiff = trimDiff;
P.diffHTML = (a, b) => {
  const d = trimDiff(diffLines(a, b));
  return d.length ? `<div class="diff">${d.map(l => `<div class="${l.t === '+' ? 'da' : l.t === '-' ? 'dd' : l.t === '@' ? 'dg' : ''}">${l.t === '@' ? '···' : esc(l.t + ' ' + l.s)}</div>`).join('')}</div>` : '<p class="empty">No differences.</p>';
};
P.ago = t => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : Math.floor(s / 86400) + ' d ago'; };

/* ---------- local backend ---------- */
let db = store.get('git', null);
const fresh = db === null; if (fresh) db = {};
const persist = () => { store.set('git', db); P.emit('git'); };
const abs = (root, r) => (root === '/' ? '' : root) + '/' + r;
const working = root => { const pre = root === '/' ? '/' : root + '/', o = {}; for (const p in FS.files) if (p.startsWith(pre)) o[p.slice(pre.length)] = FS.files[p]; return o; };
const headId = r => r.branches[r.head] || null;
const tree = (r, id) => (id && r.commits[id] ? r.commits[id].tree : {});
const put = (r, c) => { const h = hash(c); r.blobs[h] = c; return h; };
const union = (...os) => [...new Set(os.flatMap(o => Object.keys(o)))];
function setTree(root, r, T) {
  for (const p in r.index) if (!(p in T)) delete FS.files[abs(root, p)];
  for (const p in T) { FS._mk(FS.parent(abs(root, p))); FS.files[abs(root, p)] = r.blobs[T[p]]; }
  r.index = { ...T }; FS.save();
}
const local = {
  name: 'local',
  repos: () => Object.keys(db).sort(),
  rootOf(path) { let d = FS.isDir(path) ? path : FS.parent(path); for (;;) { if (db[d]) return d; if (d === '/') return null; d = FS.parent(d); } },
  init(dir) { if (db[dir]) throw new Error('This folder is already a repository'); db[dir] = { head: 'main', branches: { main: null }, commits: {}, blobs: {}, index: {}, merging: null }; persist(); },
  status(root) {
    const r = db[root], H = tree(r, headId(r)), I = r.index, W = working(root), staged = [], unstaged = [], untracked = [];
    for (const p of union(H, I)) { if (!(p in I)) staged.push({ path: p, st: 'D' }); else if (!(p in H)) staged.push({ path: p, st: 'A' }); else if (H[p] !== I[p]) staged.push({ path: p, st: 'M' }); }
    for (const p in I) { if (!(p in W)) unstaged.push({ path: p, st: 'D' }); else if (hash(W[p]) !== I[p]) unstaged.push({ path: p, st: 'M' }); }
    for (const p in W) if (!(p in I)) untracked.push(p);
    const by = (a, b) => a.path.localeCompare(b.path);
    return { branch: r.head, staged: staged.sort(by), unstaged: unstaged.sort(by), untracked: untracked.sort(), merging: !!r.merging };
  },
  stage(root, path) {
    const r = db[root], W = working(root), all = union(W, r.index);
    const ps = path == null ? all : all.filter(p => p === path || p.startsWith(path + '/'));
    if (!ps.length) throw new Error(`'${path}' did not match any files`);
    ps.forEach(p => { if (p in W) r.index[p] = put(r, W[p]); else delete r.index[p]; });
    persist();
  },
  unstage(root, path) {
    const r = db[root], H = tree(r, headId(r));
    (path == null ? union(H, r.index) : union(H, r.index).filter(p => p === path || p.startsWith(path + '/'))).forEach(p => { if (p in H) r.index[p] = H[p]; else delete r.index[p]; });
    persist();
  },
  commit(root, msg) {
    const r = db[root], s = this.status(root);
    if (!s.staged.length && !r.merging) throw new Error('nothing staged to commit');
    const c = { tree: { ...r.index }, parent: headId(r), parent2: r.merging || null, msg, t: Date.now() }, id = hash(JSON.stringify(c));
    r.commits[id] = c; r.branches[r.head] = id; r.merging = null; persist();
    return { id, n: s.staged.length };
  },
  log(root, n = 30) { const r = db[root], out = []; let id = headId(r); while (id && out.length < n) { const c = r.commits[id]; out.push({ id, msg: c.msg, t: c.t }); id = c.parent; } return out; },
  branches(root) { const r = db[root]; return { head: r.head, list: Object.keys(r.branches).sort() }; },
  diff(root, path, staged) {
    const r = db[root], H = tree(r, headId(r)), I = r.index, W = working(root), blob = (T, p) => (p in T ? r.blobs[T[p]] : '');
    return staged ? { a: blob(H, path), b: blob(I, path) } : { a: blob(I, path), b: path in W ? W[path] : '' };
  },
  branch(root, name) { const r = db[root]; if (r.branches[name] !== undefined) throw new Error(`a branch named '${name}' already exists`); r.branches[name] = headId(r); persist(); },
  deleteBranch(root, name) { const r = db[root]; if (name === r.head) throw new Error('cannot delete the branch you are on'); if (r.branches[name] === undefined) throw new Error(`no branch named '${name}'`); delete r.branches[name]; persist(); },
  checkout(root, name, create) {
    const r = db[root];
    if (create) { this.branch(root, name); r.head = name; persist(); return; }
    if (r.branches[name] === undefined) throw new Error(`no branch named '${name}'`);
    if (name === r.head) return;
    const s = this.status(root); if (s.staged.length || s.unstaged.length) throw new Error('commit or restore your changes before switching branches');
    setTree(root, r, tree(r, r.branches[name])); r.head = name; persist();
  },
  merge(root, name) {
    const r = db[root];
    if (r.branches[name] === undefined) throw new Error(`no branch named '${name}'`);
    const ours = headId(r), theirs = r.branches[name];
    if (!theirs) throw new Error(`branch '${name}' has no commits`);
    const s = this.status(root); if (s.staged.length || s.unstaged.length) throw new Error('commit or restore your changes before merging');
    const anc = id => { const seen = new Set(), q = [id]; while (q.length) { const x = q.pop(); if (!x || seen.has(x)) continue; seen.add(x); q.push(r.commits[x].parent, r.commits[x].parent2); } return seen; };
    const A = anc(ours), B = anc(theirs);
    if (A.has(theirs)) return { msg: 'Already up to date.' };
    if (!ours || B.has(ours)) { setTree(root, r, tree(r, theirs)); r.branches[r.head] = theirs; persist(); return { msg: `Fast-forward to ${theirs.slice(0, 7)}` }; }
    let base = null, bt = -1; for (const id of A) if (B.has(id) && r.commits[id].t > bt) { base = id; bt = r.commits[id].t; }
    const Bt = tree(r, base), O = tree(r, ours), T = tree(r, theirs), out = {}, conflicts = [];
    for (const p of union(Bt, O, T)) {
      const b = Bt[p], o = O[p], t = T[p]; let v;
      if (o === t) v = o; else if (o === b) v = t; else if (t === b) v = o;
      else { conflicts.push(p); v = put(r, `<<<<<<< ${r.head}\n${o ? r.blobs[o] : ''}=======\n${t ? r.blobs[t] : ''}>>>>>>> ${name}\n`); }
      if (v !== undefined) out[p] = v;
    }
    setTree(root, r, out); r.merging = theirs;
    if (conflicts.length) { conflicts.forEach(p => { if (O[p]) r.index[p] = O[p]; else delete r.index[p]; }); persist(); return { msg: `Merge conflict in ${conflicts.join(', ')}. Fix the files, then git add and git commit.`, conflicts }; }
    const c = this.commit(root, `Merge branch '${name}' into ${r.head}`);
    return { msg: `Merged '${name}' (${c.id.slice(0, 7)})` };
  },
  restore(root, path) {
    const r = db[root], ps = Object.keys(r.index).filter(p => path == null || p === path || p.startsWith(path + '/'));
    if (!ps.length) throw new Error(`'${path}' did not match any tracked files`);
    ps.forEach(p => FS.write(abs(root, p), r.blobs[r.index[p]]));
    P.emit('git');
  },
};
P.git = { b: local, local };

/* ---------- git command for the built-in terminal ---------- */
function cli(a, o, ctx) {
  const B = P.git.b, sub = a[0], args = a.slice(1), cwd = ctx.cwd, flags = args.filter(x => x.startsWith('-')), rest = args.filter(x => !x.startsWith('-'));
  if (!sub || sub === 'help') return o('usage: git init | status | add | commit -m | log | diff | branch | checkout | switch | merge | restore | reset');
  if (sub === 'init') { B.init(cwd); return o(`Initialised an empty repository in ${FS.short(cwd)}`); }
  if (['clone', 'push', 'pull', 'fetch', 'remote'].includes(sub)) return o('GitHub sync needs network access, which the browser version does not have. It works in the PrismOS desktop app, where git is the real thing.', 'c-yellow');
  const root = B.rootOf(cwd); if (!root) throw new Error('not a repository. Run git init first.');
  const rel = p => { const full = FS.norm(p, cwd); if (full === root) return null; if (!full.startsWith(root + '/')) throw new Error(p + ' is outside the repository'); return full.slice(root.length + 1); };
  const word = { M: 'modified:', A: 'new file:', D: 'deleted: ' };
  if (sub === 'status') {
    const s = B.status(root); o(`On branch ${s.branch}${s.merging ? ' (merge in progress)' : ''}`);
    if (s.staged.length) { o('Changes to be committed:'); s.staged.forEach(x => o(`  ${word[x.st]}  ${x.path}`, 'c-green')); }
    if (s.unstaged.length) { o('Changes not staged for commit:'); s.unstaged.forEach(x => o(`  ${word[x.st]}  ${x.path}`, 'c-red')); }
    if (s.untracked.length) { o('Untracked files:'); s.untracked.forEach(p => o('  ' + p, 'c-red')); }
    if (!s.staged.length && !s.unstaged.length && !s.untracked.length) o('nothing to commit, working tree clean');
  } else if (sub === 'add') {
    if (!rest.length && !flags.includes('-A')) throw new Error('usage: git add <path> | git add .');
    if (flags.includes('-A')) B.stage(root, null); else rest.forEach(p => B.stage(root, rel(p)));
  } else if (sub === 'commit') {
    const mi = args.findIndex(x => x === '-m' || x === '-am'), msg = mi >= 0 ? args[mi + 1] : null;
    if (!msg) throw new Error('usage: git commit -m "message"');
    if (args.includes('-am') || args.includes('-a')) B.status(root).unstaged.forEach(x => B.stage(root, x.path));
    const c = B.commit(root, msg); o(`[${B.branches(root).head} ${c.id.slice(0, 7)}] ${msg}`); o(` ${c.n} file${c.n === 1 ? '' : 's'} changed`);
  } else if (sub === 'log') {
    const l = B.log(root, 30); if (!l.length) return o('No commits yet.');
    l.forEach(c => ctx.line(`<span class="c-yellow">${c.id.slice(0, 7)}</span> ${esc(c.msg)} <span class="c-dim">(${P.ago(c.t)})</span>`));
  } else if (sub === 'diff') {
    const staged = flags.includes('--staged') || flags.includes('--cached'), s = B.status(root), only = rest[0] ? rel(rest[0]) : null;
    const list = (staged ? s.staged : s.unstaged).filter(x => only == null || x.path === only || x.path.startsWith(only + '/'));
    if (!list.length) return o('No changes.');
    list.forEach(x => { const d = B.diff(root, x.path, staged); o(`diff -- ${x.path}`, 'c-blue'); trimDiff(diffLines(d.a, d.b)).forEach(l => o(l.t === '@' ? '···' : l.t + ' ' + l.s, l.t === '+' ? 'c-green' : l.t === '-' ? 'c-red' : 'c-dim')); });
  } else if (sub === 'branch') {
    if (flags.includes('-d') || flags.includes('-D')) { B.deleteBranch(root, rest[0]); return o(`Deleted branch ${rest[0]}`); }
    if (rest[0]) return B.branch(root, rest[0]);
    const b = B.branches(root); b.list.forEach(n => o((n === b.head ? '* ' : '  ') + n, n === b.head ? 'c-green' : ''));
  } else if (sub === 'checkout' || sub === 'switch') {
    if (!rest[0]) throw new Error(`usage: git ${sub} <branch>`);
    if (flags.includes('-b') || flags.includes('-c')) { B.checkout(root, rest[0], true); return o(`Switched to a new branch '${rest[0]}'`); }
    if (sub === 'checkout' && !B.branches(root).list.includes(rest[0])) { B.restore(root, rel(rest[0])); return o(`Restored ${rest[0]}`); }
    B.checkout(root, rest[0]); o(`Switched to branch '${rest[0]}'`);
  } else if (sub === 'merge') {
    if (!rest[0]) throw new Error('usage: git merge <branch>');
    const m = B.merge(root, rest[0]); o(m.msg, m.conflicts ? 'c-yellow' : '');
  } else if (sub === 'restore') {
    if (!rest[0]) throw new Error('usage: git restore [--staged] <path>');
    if (flags.includes('--staged')) B.unstage(root, rel(rest[0])); else B.restore(root, rel(rest[0]));
  } else if (sub === 'reset') {
    B.unstage(root, rest[0] ? rel(rest[0]) : null);
    if (flags.includes('--hard')) B.restore(root, null);
  } else throw new Error(`'${sub}' is not a git command PrismOS knows. Try git help.`);
}
P.termCmds.git = cli;
P.termHelp.push(['git <command>', 'version control: init, status, add, commit, log, diff, branch, merge']);

/* ---------- Island: branch and number of changes ---------- */
let sumCache = null;
const summary = () => {
  if (sumCache) return sumCache;
  try {
    const t = P.studio.current(), B = P.git.b, root = (t && B.rootOf(t.path)) || (B.repos ? B.repos()[0] : null);
    if (!root) return (sumCache = { none: true });
    const s = B.status(root);
    return (sumCache = { branch: s.branch, n: s.staged.length + s.unstaged.length + s.untracked.length });
  } catch { return (sumCache = { none: true }); }
};
P.idleInfo.push(() => { const s = summary(); return s.none ? '' : `<i class="isl-sep"></i>${icon('branch')}<span>${esc(s.branch)}</span>${s.n ? `<b class="isl-n">${s.n}</b>` : ''}`; });
const bump = debounce(() => { sumCache = null; P.island.render(); }, 250);
P.on('git', bump); P.on('fs', bump); P.on('studio:tab', bump);

/* ---------- Studio: source control panel ---------- */
P.on('studio:mount', api => {
  const side = api.side, head = $('.st-side-h', side), treeEl = api.tree;
  $('span', head).outerHTML = '<div class="seg"><button data-sv="files" class="on">Files</button><button data-sv="git">Git</button></div>';
  const gitEl = el('<div class="st-git" hidden></div>'); side.append(gitEl);
  let view = 'files', msg = '';
  const B = () => P.git.b;
  const rootNow = () => { const t = api.cur(); return (t && B().rootOf(t.path)) || (B().repos ? B().repos()[0] : null) || null; };
  const draw = () => {
    if (view !== 'git') return;
    const root = rootNow(), t = api.cur();
    if (!root) { const dir = t ? FS.parent(t.path) : '/home/projects'; gitEl.innerHTML = `<p class="empty">No repository here yet.</p><button class="btn pri" data-g="init" data-dir="${esc(dir)}">${icon('branch')}Start one in ${esc(FS.short(dir))}</button>`; return; }
    let s, br, log;
    try { s = B().status(root); br = B().branches(root); log = B().log(root, 8); } catch (e) { gitEl.innerHTML = `<p class="empty">${esc(e.message)}</p>`; return; }
    const changes = [...s.unstaged, ...s.untracked.map(p => ({ path: p, st: 'U' }))];
    const row = (x, staged) => `<div class="g-row" data-p="${esc(x.path)}" data-st="${staged ? 1 : 0}" title="${esc(x.path)}"><b class="st-${x.st}">${x.st}</b><span>${esc(FS.name('/' + x.path))}</span><button data-g="${staged ? 'unstage' : 'stage'}" aria-label="${staged ? 'Unstage' : 'Stage'} ${esc(x.path)}">${staged ? '−' : '+'}</button></div>`;
    gitEl.innerHTML = `<div class="g-head">${icon('branch')}<select class="inp" data-g="branch" id="git-branch" aria-label="Branch">${br.list.map(b => `<option${b === br.head ? ' selected' : ''}>${esc(b)}</option>`).join('')}<option value="+new">New branch…</option></select></div>
      <small class="g-root">${esc(FS.short(root))}${s.merging ? ' · merge in progress' : ''}</small>
      <textarea class="inp g-msg" id="git-msg" rows="2" placeholder="Commit message">${esc(msg)}</textarea>
      <button class="btn pri" data-g="commit" ${s.staged.length || changes.length || s.merging ? '' : 'disabled'}>${icon('check')}Commit${s.staged.length ? ` ${s.staged.length} staged` : changes.length ? ' all changes' : ''}</button>
      ${s.staged.length ? `<div class="g-sec"><span>Staged</span><button data-g="unstage-all">Unstage all</button></div>${s.staged.map(x => row(x, true)).join('')}` : ''}
      <div class="g-sec"><span>Changes</span>${changes.length ? '<button data-g="stage-all">Stage all</button>' : ''}</div>${changes.map(x => row(x, false)).join('') || '<small class="g-root">Nothing changed since the last commit</small>'}
      <div class="g-sec"><span>History</span></div>${log.map(c => `<div class="g-log"><span title="${esc(c.msg)}">${esc(c.msg)}</span><small>${esc(c.id.slice(0, 7))} · ${P.ago(c.t)}</small></div>`).join('') || '<small class="g-root">No commits yet</small>'}`;
  };
  head.addEventListener('click', e => {
    const b = e.target.closest('[data-sv]'); if (!b) return;
    view = b.dataset.sv; $$('[data-sv]', head).forEach(x => x.classList.toggle('on', x === b));
    treeEl.hidden = view === 'git'; gitEl.hidden = view !== 'git'; draw();
  });
  gitEl.addEventListener('input', e => { if (e.target.id === 'git-msg') msg = e.target.value; });
  gitEl.addEventListener('change', async e => {
    if (e.target.dataset.g !== 'branch') return;
    const root = rootNow();
    try {
      if (e.target.value === '+new') { const n = await P.ask({ title: 'New branch', placeholder: 'feature/name', ok: 'Create' }); if (n) B().checkout(root, n.replace(/\s+/g, '-'), true); }
      else B().checkout(root, e.target.value);
    } catch (err) { fail(err); }
    draw();
  });
  gitEl.addEventListener('click', e => {
    const g = e.target.closest('[data-g]'), row = e.target.closest('.g-row'), root = rootNow();
    try {
      if (g && g.dataset.g !== 'branch') {
        const k = g.dataset.g;
        if (k === 'init') { B().init(g.dataset.dir); flash({ icon: 'branch', text: 'Repository created', tone: 'ok' }); }
        else if (k === 'stage') B().stage(root, row.dataset.p);
        else if (k === 'unstage') B().unstage(root, row.dataset.p);
        else if (k === 'stage-all') B().stage(root, null);
        else if (k === 'unstage-all') B().unstage(root, null);
        else if (k === 'commit') {
          if (!msg.trim()) { $('#git-msg', gitEl).focus(); return flash({ icon: 'x', text: 'Write a commit message first', tone: 'bad' }); }
          if (!B().status(root).staged.length) B().stage(root, null);
          const c = B().commit(root, msg.trim()); msg = '';
          flash({ icon: 'branch', text: 'Committed ' + c.id.slice(0, 7), tone: 'ok' });
        }
        draw(); return;
      }
      if (row) { const st = row.dataset.st === '1', d = B().diff(root, row.dataset.p, st); api.showCustom('Diff', row.dataset.p + (st ? ' · staged' : ''), P.diffHTML(d.a, d.b)); }
    } catch (err) { fail(err); draw(); }
  });
  api.w.clean.push(P.on('git', draw), P.on('fs', debounce(draw, 150)), P.on('studio:tab', draw));
});

/* First run: make the sample project a repository so the panel has something to show. */
P.on('shell', () => {
  if (P.git.b !== local || !fresh) return;
  const r = '/home/projects/hello';
  if (FS.isDir(r)) { local.init(r); local.stage(r, null); local.commit(r, 'Initial commit'); } else persist();
});
})();
