/* PrismOS extras: file history, dock apps, workspaces, desktops, clipboard history, snippets, widgets, lock screen, Vibe tools. */
(() => {
'use strict';
const P = window.Prism, { $, $$, el, esc, icon, store, FS, WM, S, debounce, clamp } = P;
const flash = o => P.island.flash(o);
const fail = e => flash({ icon: 'x', text: e.message || String(e), tone: 'bad' });
const dayKey = () => new Date().toLocaleDateString('en-CA');

/* ================= file history (time travel) ================= */
// Every save keeps the version it replaced. At most 25 versions per file, and one every 15 seconds while typing.
const hist = store.get('fhist', {});
const saveHist = debounce(() => {
  let total = 0; const all = [];
  for (const p in hist) for (const v of hist[p]) { total += v.c.length; all.push([v.t, p]); }
  if (total > 600000) {
    all.sort((a, b) => a[0] - b[0]);
    for (const [t, p] of all) { if (total <= 450000) break; const a = hist[p], i = a ? a.findIndex(v => v.t === t) : -1; if (i >= 0) { total -= a[i].c.length; a.splice(i, 1); if (!a.length) delete hist[p]; } }
  }
  store.set('fhist', hist);
}, 800);
P.on('fs:write', ({ path, old }) => {
  if (old == null) return;
  const a = (hist[path] ||= []), last = a[a.length - 1];
  if (last && (last.c === old || Date.now() - last.t < 15000)) return;
  a.push({ t: Date.now(), c: old }); if (a.length > 25) a.shift();
  saveHist();
});
P.fileHistory = path => hist[path] || [];
P.on('studio:mount', api => {
  const btn = el(`<button class="btn sm" title="Earlier versions of this file">${icon('history')}History</button>`);
  api.w.tools.prepend(btn);
  let sel = 0;
  const part = () => {
    const t = api.cur(), vs = t ? P.fileHistory(t.path) : [], v = vs[sel]; if (!v) return;
    $('#hist-when', api.panelBody).textContent = `${new Date(v.t).toLocaleString()} (${P.ago(v.t)})`;
    $('#hist-diff', api.panelBody).innerHTML = P.diffHTML(v.c, t.content);
  };
  btn.addEventListener('click', () => {
    const t = api.cur(); if (!t) return;
    const vs = P.fileHistory(t.path);
    if (!vs.length) return void api.showCustom('History', FS.name(t.path), '<p class="empty">No earlier versions yet. Every save keeps the version it replaced.</p>');
    sel = vs.length - 1;
    api.showCustom('History', `${FS.name(t.path)} · ${vs.length} earlier version${vs.length === 1 ? '' : 's'} · changes since then`,
      `<div class="hx"><input type="range" id="hist-range" min="0" max="${vs.length - 1}" step="1" value="${sel}" aria-label="Version"><span id="hist-when"></span><button class="btn sm pri" data-hx="restore">Restore this version</button></div><div id="hist-diff"></div>`);
    part();
  });
  api.panelBody.addEventListener('input', e => { if (e.target.id === 'hist-range') { sel = +e.target.value; part(); } });
  api.panelBody.addEventListener('click', e => {
    if (!e.target.closest('[data-hx="restore"]')) return;
    const t = api.cur(), v = t && P.fileHistory(t.path)[sel]; if (!v) return;
    try { if (t.dirty) api.save(true); FS.write(t.path, v.c); flash({ icon: 'history', text: 'Restored ' + FS.name(t.path), sub: P.ago(v.t), tone: 'ok' }); } catch (err) { fail(err); }
  });
});

/* ================= dock apps (mini apps) ================= */
// Any HTML file in /home/apps (or /home/apps/<name>/index.html) is an app. Pinned ones sit in the dock.
const SAMPLE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Stopwatch</title>
<style>
  body { margin: 0; height: 100vh; display: grid; place-content: center; justify-items: center; gap: 18px;
    font-family: system-ui, sans-serif; background: #11131a; color: #f2f4f8; }
  #t { font: 700 56px/1 ui-monospace, Consolas, monospace; font-variant-numeric: tabular-nums; }
  button { padding: 10px 20px; border: 0; border-radius: 999px; font: inherit; cursor: pointer; background: #2f6fed; color: #fff; }
  button + button { background: #2a2e3a; }
</style>
</head>
<body>
<div id="t">00:00.0</div>
<div><button id="go">Start</button> <button id="rs">Reset</button></div>
<script>
  let t0 = 0, acc = 0, iv = null;
  const el = document.getElementById('t'), go = document.getElementById('go');
  const show = () => {
    const s = (acc + (iv ? Date.now() - t0 : 0)) / 1000;
    el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + (s % 60).toFixed(1).padStart(4, '0');
  };
  go.onclick = () => {
    if (iv) { acc += Date.now() - t0; clearInterval(iv); iv = null; go.textContent = 'Start'; }
    else { t0 = Date.now(); iv = setInterval(show, 100); go.textContent = 'Pause'; }
    show();
  };
  document.getElementById('rs').onclick = () => { acc = 0; t0 = Date.now(); show(); };
</script>
</body>
</html>
`;
const miniId = p => 'mini:' + p;
const miniApp = (path, name) => {
  const hue = [...name].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;
  return {
    name, glyph: (name[0] || 'A').toUpperCase(), g: [`hsl(${hue} 75% 58%)`, `hsl(${(hue + 40) % 360} 70% 40%)`], w: 460, h: 540, mini: path,
    mount(w) {
      w.tools.innerHTML = `<button class="btn sm" data-m="edit" title="Edit this app's code in Studio">${icon('code')}Edit</button>`;
      w.body.innerHTML = `<iframe class="mini-frame" sandbox="allow-scripts allow-forms" title="${esc(name)}"></iframe>`;
      const f = $('iframe', w.body); let last = null;
      const load = () => { if (FS.isFile(path) && FS.files[path] !== last) { last = FS.files[path]; f.srcdoc = P.inlineAssets(last, FS.parent(path)); } };
      load();
      w.tools.addEventListener('click', e => { if (e.target.closest('[data-m="edit"]')) P.openFile(path); });
      w.clean.push(P.on('fs', load));
    },
  };
};
function miniScan() {
  const found = new Set();
  if (FS.isDir('/home/apps')) {
    const { dirs, files } = FS.ls('/home/apps');
    for (const f of files) if (/\.html?$/i.test(f)) found.add(f);
    for (const d of dirs) if (FS.isFile(d + '/index.html')) found.add(d + '/index.html');
  }
  let changed = false;
  for (const id of Object.keys(P.apps)) if (id.startsWith('mini:') && !found.has(id.slice(5))) { const w = WM.byApp(id); if (w) WM.close(w.id); delete P.apps[id]; changed = true; }
  for (const p of found) {
    const m = FS.files[p].match(/<title>([^<]{1,40})<\/title>/i);
    const name = (m && m[1].trim()) || FS.name(p.endsWith('/index.html') ? FS.parent(p) : p).replace(/\.html?$/i, '');
    if (!P.apps[miniId(p)] || P.apps[miniId(p)].name !== name) { P.apps[miniId(p)] = miniApp(p, name); changed = true; }
  }
  if (changed) P.dockRender(true);
}
const pin = (id, on) => { const i = P.pins.indexOf(id); if (on && i < 0) P.pins.push(id); else if (!on && i >= 0) P.pins.splice(i, 1); store.set('pins', P.pins); P.dockRender(true); };
P.pin = pin;
P.miniInstall = path => {
  miniScan();
  const id = miniId(path); if (!P.apps[id]) return fail(new Error('That file is not an app. Apps are HTML files in ~/apps.'));
  pin(id, true); WM.open(id);
  flash({ icon: 'check', text: `${P.apps[id].name} added to the dock`, tone: 'ok' });
};
P.cmdExtra.push(() => [{ t: 'Make a new dock app with Vibe', ic: 'sparkles', run: () => P.vibeDraft('Make a dock app that ') }]);

/* ================= workspaces ================= */
const spaces = store.get('spaces', {});
const snapshot = () => [...WM.wins.values()].map(w => ({ app: w.app, x: w.x, y: w.y, w: w.w, h: w.h, state: w.state, frac: w.frac, restore: w.restore, min: w.min, desk: w.desk, z: +w.node.style.zIndex || 0 }));
P.spaceSave = async () => {
  if (!WM.wins.size) return fail(new Error('Open some windows first, then save them as a workspace.'));
  const name = await P.ask({ title: 'Save these windows as a workspace', placeholder: 'e.g. Frontend', ok: 'Save' });
  if (!name) return;
  spaces[name] = { wins: snapshot(), studio: store.get('studio', null), desk: WM.desk, t: Date.now() };
  store.set('spaces', spaces);
  flash({ icon: 'layers', text: `Workspace "${name}" saved`, tone: 'ok' });
};
P.spaceOpen = name => {
  const s = spaces[name]; if (!s) return;
  [...WM.wins.values()].forEach(w => WM.close(w.id));
  if (s.studio) store.set('studio', s.studio);
  setTimeout(() => {
    [...s.wins].sort((a, b) => a.z - b.z).forEach(g => { if (!P.apps[g.app]) return; const w = WM.open(g.app, null, g); if (w && g.min) WM.minimize(w.id); });
    WM.setDesk(s.desk || 0);
    flash({ icon: 'layers', text: `Workspace "${name}"`, tone: 'info', ms: 1600 });
  }, 230);
};
P.cmdExtra.push(() => [{ t: 'Save windows as a workspace', ic: 'layers', run: P.spaceSave }, ...Object.keys(spaces).map(n => ({ t: `Open workspace: ${n}`, ic: 'layers', run: () => P.spaceOpen(n) }))]);
P.keyHooks.push(e => {
  if (!(e.ctrlKey && e.altKey) || !/^Digit[1-4]$/.test(e.code)) return false;
  const n = Object.keys(spaces)[+e.code.slice(5) - 1]; if (!n) return false;
  P.spaceOpen(n); return true;
});

/* ================= clipboard history ================= */
const clips = store.get('clips', []);
const addClip = t => {
  t = String(t || ''); if (!t.trim() || t.length > 20000) return;
  const i = clips.indexOf(t); if (i >= 0) clips.splice(i, 1);
  clips.unshift(t); clips.length = Math.min(clips.length, 25); store.set('clips', clips);
};
const selText = () => { const a = document.activeElement; return a && typeof a.selectionStart === 'number' && a.selectionEnd > a.selectionStart ? a.value.slice(a.selectionStart, a.selectionEnd) : String(getSelection()); };
document.addEventListener('copy', () => addClip(selText()));
document.addEventListener('cut', () => addClip(selText()));
const rawCopy = P.copy;
P.copy = (t, label) => { addClip(t); return rawCopy(t, label); };
P.clipboard = () => {
  const target = document.activeElement;
  P.palette.open('', q => clips.filter(c => !q || c.toLowerCase().includes(q)).slice(0, 12).map(c => ({
    t: c.replace(/\s+/g, ' ').slice(0, 70), s: `${c.length} characters`, ic: icon('clipboard'),
    run: () => {
      if (target && target.isConnected && typeof target.selectionStart === 'number' && !target.disabled && !target.readOnly) { target.focus(); if (document.execCommand('insertText', false, c)) return; }
      rawCopy(c, 'Copied again');
    },
  })), clips.length ? 'Paste from clipboard history' : 'Nothing copied yet. Copy something inside PrismOS first.');
};
P.keyHooks.push(e => (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyV' ? (P.clipboard(), true) : false));
P.cmdExtra.push(() => [{ t: 'Clipboard history', ic: 'clipboard', k: 'Ctrl Shift V', run: P.clipboard }]);

/* ================= snippets ================= */
const snips = store.get('snips', [
  { name: 'debounce', code: 'const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };' },
  { name: 'sleep', code: 'const sleep = ms => new Promise(r => setTimeout(r, ms));' },
]);
P.tools.snips = {
  name: 'Snippets', live: true,
  html: () => `<div class="tbx-row"><input class="inp" id="sn-name" placeholder="Name" aria-label="Snippet name"><button class="btn pri" data-t="add">Save snippet</button></div>
    <textarea class="inp" id="sn-code" spellcheck="false" placeholder="Paste or type code to keep" aria-label="Snippet code" style="flex:0 0 84px"></textarea><div class="tbx-msg"></div><div class="sn-list"></div>`,
  act(k, r, e) {
    const msg = $('.tbx-msg', r), row = e && e.target && e.target.closest && e.target.closest('[data-i]'), i = row ? +row.dataset.i : -1;
    if (k === 'input') return;
    if (k === 'add') {
      const name = $('#sn-name', r).value.trim(), code = $('#sn-code', r).value;
      if (!name || !code.trim()) { msg.className = 'tbx-msg bad'; msg.textContent = 'Give the snippet a name and some code.'; return; }
      snips.unshift({ name, code }); $('#sn-name', r).value = $('#sn-code', r).value = ''; msg.textContent = '';
    } else if (k === 'del' && i >= 0) snips.splice(i, 1);
    else if (k === 'ins' && i >= 0) {
      const ta = $('#studio-editor');
      if (ta && !ta.hidden) { WM.focus(ta.closest('.win').dataset.id); ta.focus(); document.execCommand('insertText', false, snips[i].code); flash({ icon: 'check', text: 'Inserted into Studio', tone: 'ok', ms: 1500 }); }
      else P.copy(snips[i].code, 'Copied. Open a file in Studio to insert.');
      return;
    }
    store.set('snips', snips);
    $('.sn-list', r).innerHTML = snips.map((s, n) => `<div class="sn-row" data-i="${n}"><b>${esc(s.name)}</b><code>${esc(s.code.replace(/\s+/g, ' ').slice(0, 80))}</code><button class="btn sm" data-copy="${esc(s.code)}">Copy</button><button class="btn sm" data-t="ins">Insert</button><button class="btn sm danger" data-t="del" aria-label="Delete ${esc(s.name)}">${icon('trash')}</button></div>`).join('') || '<p class="empty">No snippets yet.</p>';
  },
};
P.palSources.push(() => snips.map(s => ({ t: s.name, s: 'Snippet · Enter copies', ic: icon('code'), run: () => P.copy(s.code, 'Snippet copied') })));

/* ================= lock screen ================= */
let lockedAt = 0;
const unlock = () => { const l = $('#lock'); if (!l) return; l.classList.add('bye'); clearInterval(l._iv); setTimeout(() => l.remove(), 360); };
P.lock = () => {
  if ($('#lock')) return;
  P.closeOverlays();
  const l = el('<div id="lock" tabindex="0" role="dialog" aria-label="PrismOS is locked"><div class="lock-in"><div class="lock-time num"></div><div class="lock-date"></div><p>Click or press any key to unlock</p></div></div>');
  const tick = () => { const d = new Date(); $('.lock-time', l).textContent = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); $('.lock-date', l).textContent = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); };
  tick(); l._iv = setInterval(tick, 5000); lockedAt = Date.now();
  l.addEventListener('click', unlock);
  $('#os').append(l); l.focus();
};
P.keyHooks.unshift(e => {
  if ($('#lock')) { if (!e.repeat && Date.now() - lockedAt > 500 && !['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) unlock(); return true; }
  if (e.altKey && !e.ctrlKey && e.code === 'KeyL') { P.lock(); return true; }
  return false;
});
P.cmdExtra.push(() => [{ t: 'Lock screen', ic: 'lock', k: 'Alt L', run: P.lock }]);

/* ================= shell additions: desktops, Spaces menu, widgets, dock menu ================= */
const focusDays = store.get('focusDays', {});
P.on('timer:done', ({ label, mins }) => { if (label === 'Break' || label === 'Long break') return; focusDays[dayKey()] = (focusDays[dayKey()] || 0) + mins; store.set('focusDays', focusDays); P.emit('widgets'); });
P.on('shell', () => {
  const osEl = $('#os');
  // seed one sample dock app the first time
  if (!store.get('miniSeed')) {
    store.set('miniSeed', 1);
    try { if (!FS.exists('/home/apps/stopwatch.html')) FS.write('/home/apps/stopwatch.html', SAMPLE); if (!P.pins.includes(miniId('/home/apps/stopwatch.html'))) P.pins.push(miniId('/home/apps/stopwatch.html')); store.set('pins', P.pins); } catch {}
  }
  miniScan(); P.on('fs', debounce(miniScan, 200));

  // desktops indicator
  const desks = el('<div id="desks" role="group" aria-label="Desktops"></div>'); $('.bar-r').prepend(desks);
  let lastDesks = '';
  const drawDesks = () => {
    const h = Array.from({ length: WM.desks }, (_, i) => `<button class="${i === WM.desk ? 'on' : ''}${[...WM.wins.values()].some(w => w.desk === i) ? ' has' : ''}" data-desk="${i}" aria-label="Desktop ${i + 1}" aria-pressed="${i === WM.desk}" title="Desktop ${i + 1} (Ctrl+Alt+arrows)">${i + 1}</button>`).join('');
    if (h !== lastDesks) { desks.innerHTML = h; lastDesks = h; }
  };
  desks.addEventListener('click', e => { const b = e.target.closest('[data-desk]'); if (b) WM.setDesk(+b.dataset.desk); });
  P.on('desk', drawDesks); P.on('wm', drawDesks); drawDesks();

  // Spaces menu
  const sb = el('<button class="bar-btn bar-menu" id="spaces-btn">Spaces</button>'); $('.bar-l').append(sb);
  sb.addEventListener('click', () => {
    const r = sb.getBoundingClientRect(), names = Object.keys(spaces);
    P.menu(r.left, r.bottom + 6, [
      ...(names.length ? names.map((n, i) => ({ label: n, icon: 'layers', kbd: i < 4 ? `Ctrl Alt ${i + 1}` : '', run: () => P.spaceOpen(n) })) : [{ label: 'No saved workspaces yet', disabled: true }]),
      { sep: true },
      { label: 'Save current windows…', icon: 'plus', run: P.spaceSave },
      ...names.map(n => ({ label: `Delete ${n}`, danger: true, run: () => { delete spaces[n]; store.set('spaces', spaces); } })),
      { sep: true },
      { label: 'Move window to next desktop', kbd: 'Ctrl Alt Shift →', disabled: !WM.active(), run: () => { const w = WM.active(); if (w) { WM.moveTo(w.id, w.desk + 1); WM.focus(w.id); } } },
    ]);
  });

  // dock right-click menu
  $('#dock').addEventListener('contextmenu', e => {
    const b = e.target.closest('.dock-it'); if (!b) return;
    e.preventDefault();
    const id = b.dataset.app, app = P.apps[id], pinned = P.pins.includes(id), w = WM.byApp(id), builtIn = !app.mini && !app.web;
    P.menu(e.clientX, e.clientY - 8, [
      { label: w ? 'Show' : 'Open', run: () => WM.open(id) },
      ...(w ? [{ label: 'Close', run: () => WM.close(w.id) }] : []),
      ...(builtIn ? [] : [{ sep: true }, { label: pinned ? 'Remove from dock' : 'Keep in dock', run: () => pin(id, !pinned) }]),
      ...(app.mini ? [{ label: 'Edit code', icon: 'code', run: () => P.openFile(app.mini) }, { label: 'Delete app', icon: 'trash', danger: true, run: async () => { if (await P.confirm({ title: `Delete ${app.name}?`, text: 'The app file is removed. This cannot be undone.' })) { pin(id, false); try { FS.rm(app.mini); } catch (err) { fail(err); } } } }] : []),
    ]);
  });

  // desktop widgets
  const host = el('<div id="widgets"></div>'); $('#desk').append(host);
  let lastW = '';
  const drawW = () => {
    osEl.classList.toggle('no-widgets', !S.widgets);
    if (!S.widgets || !P.arena) return;
    const d = new Date(), dp = P.arena.daily(), mins = focusDays[dayKey()] || 0, done = P.arena.doneToday();
    const h = `<div class="wd glass"><div class="wd-time num">${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div><small>${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</small></div>
      <button class="wd glass" data-wd="arena"><small>Today's problem</small><b>${esc(dp.title)}</b><span class="wd-row"><small>${done ? `${done} solved today` : 'Not solved yet'}</small><small class="wd-row">${icon('flame')}${P.arena.streak()} day streak</small></span></button>
      <button class="wd glass" data-wd="focus"><small>Focus today</small><b>${mins} min</b><small>${P.timer.running ? `${P.timer.label} timer is running` : 'Click to start 25 minutes'}</small></button>`;
    if (h !== lastW) { host.innerHTML = h; lastW = h; }
  };
  host.addEventListener('click', e => {
    const b = e.target.closest('[data-wd]'); if (!b) return;
    if (b.dataset.wd === 'arena') WM.open('arena', { id: P.arena.daily().id });
    else if (!P.timer.running) P.timer.start(25, 'Focus'); else WM.open('focus');
  });
  ['arena', 'widgets', 'settings', 'timer'].forEach(ev => P.on(ev, debounce(drawW, 120)));
  setInterval(drawW, 15000); drawW();
});
// Clicking inside an embedded page (dock app, preview, web window) should bring its window to the front.
const frameFocus = () => setTimeout(() => { const a = document.activeElement; if (a && (a.tagName === 'IFRAME' || a.tagName === 'WEBVIEW')) { const n = a.closest('.win'); if (n) WM.focus(n.dataset.id); } }, 0);
window.addEventListener('blur', frameFocus); document.addEventListener('focusin', frameFocus);

/* ================= Vibe tools (let Vibe act) ================= */
P.vibeAgentRules = ' You can also act inside PrismOS through tools. When asked to build or change something, do it with the tools instead of only describing it: write files with write_file, run JavaScript with run_js and fix any error before you answer, then show the result with open. To make a dock app, write one self-contained HTML file to /home/apps/<short-name>.html and call install_app. Finish with a two or three sentence summary and do not paste files you already wrote.';
P.vibeTools = async sample => {
  let lim = null; try { lim = await sample.limits(); } catch {}
  if (!lim || !lim.tools) return null;
  const home = p => { const f = FS.norm(String(p || ''), '/home'); if (f !== '/home' && !f.startsWith('/home/')) throw new Error('Paths must be inside /home'); return f; };
  const str = d => ({ type: 'string', description: d }), obj = (props, required) => ({ type: 'object', properties: props, required });
  const ids = Object.keys(P.apps).filter(id => !id.includes(':')).join(', ');
  const tools = [
    { name: 'list_files', description: 'List what is inside a PrismOS folder. Returns an array of names; folders end with a slash.', inputSchema: obj({ dir: str('Folder path such as /home/projects') }, ['dir']),
      execute: ({ dir }) => { const d = home(dir); if (!FS.isDir(d)) throw new Error('No such folder: ' + d); const l = FS.ls(d); return [...l.dirs.map(x => FS.name(x) + '/'), ...l.files.map(x => FS.name(x))]; } },
    { name: 'read_file', description: 'Read a text file. Returns its content, cut at 12000 characters.', inputSchema: obj({ path: str('Absolute path under /home') }, ['path']),
      execute: ({ path }) => FS.read(home(path)).slice(0, 12000) },
    { name: 'write_file', description: 'Create or overwrite a text file with the complete content given. Returns "saved". The earlier version stays in the file history.', inputSchema: obj({ path: str('Absolute path under /home'), content: str('The whole file') }, ['path', 'content']),
      execute: ({ path, content }) => { const p = home(path); FS.write(p, content == null ? '' : String(content)); P.vibeStep('Wrote ' + FS.short(p)); return 'saved'; } },
    { name: 'run_js', description: 'Run a JavaScript file in a Web Worker (no DOM). Returns {ok, output}: output is everything the file printed, errors included.', inputSchema: obj({ path: str('Path of a .js file under /home') }, ['path']),
      execute: ({ path }) => new Promise((res, rej) => { let code; const p = home(path), lines = []; try { code = FS.read(p); } catch (e) { return rej(e); } P.runJS(code, { out: (k, s) => lines.push((k === 'err' ? 'ERROR: ' : '') + s), done: r => { P.vibeStep(`Ran ${FS.name(p)}: ${r.ok ? 'no errors' : 'failed'}`); res({ ok: r.ok, output: lines.join('\n').slice(0, 4000) }); } }); }) },
    { name: 'open', description: `Show something to the user: open an app by id (${ids}) or open a file path in the Studio editor. Returns "opened".`, inputSchema: obj({ target: str('An app id or an absolute file path') }, ['target']),
      execute: ({ target }) => { target = String(target); if (P.apps[target]) WM.open(target); else P.openFile(home(target)); P.vibeStep('Opened ' + target); return 'opened'; } },
    { name: 'install_app', description: 'Add an HTML app file from /home/apps/ to the dock and open it. Returns "installed".', inputSchema: obj({ path: str('Path such as /home/apps/timer.html') }, ['path']),
      execute: ({ path }) => { const p = home(path); if (!p.startsWith('/home/apps/') || !FS.isFile(p)) throw new Error('Write the app to /home/apps/<name>.html first'); P.miniInstall(p); P.vibeStep(`Added ${FS.name(p)} to the dock`); return 'installed'; } },
    { name: 'arrange_windows', description: 'Open two apps and tile them side by side. Returns "arranged".', inputSchema: obj({ left: str('App id for the left half'), right: str('App id for the right half') }, ['left', 'right']),
      execute: ({ left, right }) => { for (const [id, z] of [[left, 'left'], [right, 'right']]) { const w = P.apps[id] && WM.open(id); if (!w) throw new Error('Unknown app id: ' + id); WM.snap(w.id, z); } P.vibeStep(`Tiled ${left} and ${right}`); return 'arranged'; } },
    { name: 'set_appearance', description: `Change the look of PrismOS. theme is dark, light or auto. wallpaper is one of: ${Object.keys(P.WALLS).join(', ')}. Returns "done".`, inputSchema: obj({ theme: str('dark, light or auto'), wallpaper: str('A wallpaper name') }, []),
      execute: ({ theme, wallpaper }) => { if (['dark', 'light', 'auto'].includes(theme)) P.set('theme', theme); if (P.WALLS[wallpaper]) P.set('wall', wallpaper); P.vibeStep('Changed the appearance'); return 'done'; } },
  ];
  return tools.slice(0, lim.tools.maxCount || tools.length);
};
})();
