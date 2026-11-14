/* PrismOS apps and background services (focus timer, ambient sound, Vibe). Loaded after os.js. */
(() => {
'use strict';
const P = window.Prism;
const { $, $$, el, esc, debounce, store, icon, S, FS, WM } = P;
const flash = o => P.island.flash(o);
const fail = e => flash({ icon: 'x', text: e.message || String(e), tone: 'bad' });

/* ================= focus timer ================= */
const fmtT = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const timer = (P.timer = { total: 1500, left: 1500, running: false, end: 0, iv: 0, label: 'Focus' });
const focusAct = {
  prio: 2,
  compact: () => `<svg class="ring" viewBox="0 0 20 20"><circle class="ring-bg" cx="10" cy="10" r="8"/><circle class="ring-fg" data-t="ring" cx="10" cy="10" r="8" stroke-dasharray="50.27"/></svg><b class="num" data-t="time"></b>`,
  expanded: () => `<div class="isl-row"><div><small>${esc(timer.label)}${timer.running ? '' : ' · paused'}</small><strong class="num isl-big" data-t="time"></strong></div>
    <div class="isl-btns"><button data-do="focus.toggle" aria-label="${timer.running ? 'Pause timer' : 'Resume timer'}">${icon(timer.running ? 'pause' : 'play')}</button><button data-do="focus.add" aria-label="Add 5 minutes">+5</button><button data-do="focus.reset" aria-label="Stop timer">${icon('x')}</button></div></div><div class="isl-prog"><i data-t="prog"></i></div>`,
  tick: r => {
    const p = 1 - timer.left / timer.total;
    $$('[data-t="time"]', r).forEach(n => (n.textContent = fmtT(timer.left)));
    $$('[data-t="prog"]', r).forEach(n => (n.style.width = p * 100 + '%'));
    $$('[data-t="ring"]', r).forEach(n => (n.style.strokeDashoffset = 50.27 * p));
  },
  on: { toggle: () => (timer.running ? timer.pause() : timer.start()), add: () => { timer.left += 300; timer.total += 300; if (timer.running) timer.end += 300000; timer.sync(); }, reset: () => timer.reset() },
};
timer.sync = () => { P.island.set('focus', focusAct); P.emit('timer'); };
timer.start = (min, label) => {
  if (min) { timer.total = timer.left = Math.max(1, Math.round(min * 60)); timer.label = label || (min <= 15 ? 'Break' : 'Focus'); }
  if (timer.left <= 0) timer.left = timer.total;
  timer.end = Date.now() + timer.left * 1000; timer.running = true;
  clearInterval(timer.iv); timer.iv = setInterval(timer.tick, 500); timer.sync();
};
timer.pause = () => { timer.running = false; clearInterval(timer.iv); timer.sync(); };
timer.reset = () => { timer.running = false; clearInterval(timer.iv); timer.left = timer.total; P.island.remove('focus'); P.emit('timer'); };
timer.tick = () => {
  const left = Math.max(0, Math.round((timer.end - Date.now()) / 1000));
  if (left === timer.left) return;
  timer.left = left; P.island.tick(); P.emit('timer');
  if (left === 0) {
    const label = timer.label, mins = Math.round(timer.total / 60); timer.reset(); chime(); P.emit('timer:done', { label, mins });
    flash({ icon: 'timer', text: `${label} complete`, sub: label === 'Focus' ? 'Take a break' : 'Back to it', tone: 'ok', ms: 6000, force: true });
  }
};

/* ================= ambient sound ================= */
const SOUNDS = { drift: 'Drift', rain: 'Rain', deep: 'Deep' };
const audio = (P.audio = { ctx: null, master: null, bus: null, nodes: [], kind: store.get('sound', 'drift'), playing: false });
function actx() {
  if (!audio.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    audio.ctx = new AC(); audio.master = audio.ctx.createGain(); audio.master.gain.value = S.vol * 0.7; audio.master.connect(audio.ctx.destination);
  }
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
  return audio.ctx;
}
function noise(ctx, brown) {
  const n = ctx.sampleRate * 3, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let last = 0;
  for (let i = 0; i < n; i++) { const wh = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * wh) / 1.02; d[i] = last * 3.5; } else d[i] = wh; }
  const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; return s;
}
audio.halt = () => {
  const { ctx, bus, nodes } = audio;
  if (ctx && bus) {
    const t = ctx.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(0, t + 0.4);
    setTimeout(() => { nodes.forEach(n => { try { n.stop(); } catch {} }); bus.disconnect(); }, 500);
  }
  audio.bus = null; audio.nodes = [];
};
audio.play = kind => {
  const ctx = actx(); if (!ctx) return flash({ icon: 'x', text: 'Sound is not available in this browser', tone: 'bad' });
  audio.halt();
  if (kind && SOUNDS[kind]) { audio.kind = kind; store.set('sound', kind); }
  const bus = (audio.bus = ctx.createGain()), t = ctx.currentTime, nodes = (audio.nodes = []);
  bus.gain.setValueAtTime(0, t); bus.gain.linearRampToValueAtTime(1, t + 1.2); bus.connect(audio.master);
  const go = n => { nodes.push(n); n.start(); return n; };
  const filt = (type, f) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; return b; };
  const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
  if (audio.kind === 'rain') {
    go(noise(ctx)).connect(filt('highpass', 900)).connect(filt('lowpass', 6500)).connect(gain(0.2)).connect(bus);
    go(noise(ctx, true)).connect(filt('lowpass', 260)).connect(gain(0.5)).connect(bus);
  } else if (audio.kind === 'deep') {
    go(noise(ctx, true)).connect(filt('lowpass', 420)).connect(gain(0.9)).connect(bus);
    const o = ctx.createOscillator(); o.frequency.value = 55; go(o).connect(gain(0.06)).connect(bus);
  } else {
    const lp = filt('lowpass', 950); lp.connect(bus);
    [110, 164.81, 220, 261.63, 329.63].forEach((f, i) => {
      const g = gain(0.07); g.connect(lp);
      for (const det of [0, 6]) { const o = ctx.createOscillator(); o.type = det ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = det; go(o).connect(g); }
      const l = ctx.createOscillator(); l.frequency.value = 0.05 + i * 0.023; go(l).connect(gain(0.05)).connect(g.gain);
    });
  }
  audio.playing = true; audio.sync();
};
audio.stop = () => { audio.halt(); audio.playing = false; audio.sync(); };
audio.toggle = () => (audio.playing ? audio.stop() : audio.play());
const musicAct = {
  prio: 1,
  compact: () => `<span class="eq"><i></i><i></i><i></i><i></i></span><span>${SOUNDS[audio.kind]}</span>`,
  expanded: () => `<div class="isl-row"><div><small>Ambient sound</small><strong class="isl-big">${SOUNDS[audio.kind]}</strong></div><div class="isl-btns"><button data-do="music.stop" aria-label="Stop sound">${icon('pause')}</button></div></div>
    <div class="isl-btns">${Object.entries(SOUNDS).map(([k, n]) => `<button class="isl-chip${k === audio.kind ? ' on' : ''}" data-do="music.kind" data-k="${k}">${n}</button>`).join('')}</div>
    <input type="range" min="0" max="1" step="0.01" value="${S.vol}" data-range="vol" aria-label="Volume">`,
  on: { stop: () => audio.stop(), kind: b => audio.play(b.dataset.k) },
};
audio.sync = () => { if (audio.playing) P.island.set('music', musicAct); else P.island.remove('music'); P.emit('audio'); };
P.on('settings', k => { if (k === 'vol' && audio.master) audio.master.gain.value = S.vol * 0.7; });
function chime() {
  const ctx = actx(); if (!ctx) return;
  [660, 880].forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.22;
    o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(g).connect(audio.master); o.start(t); o.stop(t + 0.8);
  });
}

/* ================= Terminal ================= */
const HELP = [
  ['ls [path]', 'list a folder'], ['cd <folder>', 'change folder'], ['pwd', 'print the current folder'], ['cat <file>', 'print a file'],
  ['mkdir <folder>', 'make a folder'], ['touch <file>', 'make an empty file'], ['rm [-r] <path>', 'delete a file or folder'], ['mv <from> <to>', 'move or rename'], ['cp <from> <to>', 'copy a file'],
  ['echo <text> [> file]', 'print text, or write it to a file'], ['node <file.js>', 'run a JavaScript file'], ['code <file>', 'open a file in Studio'], ['open <app|path>', 'open an app, file or folder'],
  ['apps', 'list app names'], ['ask <question>', 'ask Vibe'], ['focus <min> | stop', 'start or stop the focus timer'], ['theme dark|light|auto', 'switch theme'], ['wall [name]', 'list or set wallpapers'],
  ['neofetch', 'system summary'], ['history', 'recent commands'], ['clear', 'clear the screen (Ctrl+L)'],
];
P.termCmds = {};   // extra commands: name -> (args, out, ctx)
P.termHelp = [];   // extra help rows
// P.termFallback(ctx) runs anything the shell does not know (the desktop app sends it to the real shell);
// P.termKeep, when set, is the set of built-ins that stay built-in there.
P.apps.terminal = {
  name: 'Terminal', icon: 'terminal', g: ['#4a5162', '#14161d'], w: 680, h: 420,
  focus: w => { const i = $('.term-in', w.body); i && i.focus(); },
  mount(w) {
    w.body.innerHTML = `<div class="term"><div class="term-out"></div><div class="term-line"><span class="term-ps"></span><input class="term-in" id="term-in" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Terminal input"></div></div>`;
    const term = $('.term', w.body), outEl = $('.term-out', term), inp = $('.term-in', term), ps = $('.term-ps', term);
    let cwd = '/home', hist = store.get('hist', []), hi = hist.length, stop = null, busy = false;
    const line = (html, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; outEl.append(d); term.scrollTop = term.scrollHeight; };
    const out = (s, cls) => String(s).split('\n').forEach(l => line(esc(l), cls));
    const prompt = () => `<span class="c-green">dev@prism</span> <span class="c-blue">${esc(FS.short(cwd))}</span> <span class="c-dim">$</span>`;
    const setPs = () => { ps.innerHTML = prompt(); };
    const need = (a, usage) => { if (!a.length) throw new Error('usage: ' + usage); };
    const neofetch = () => {
      const art = ['       /\\', '      /  \\', '     / /\\ \\', '    / /  \\ \\', '   / /____\\ \\', '  /__________\\'];
      const info = [['dev@prism', ''], ['OS', 'PrismOS ' + P.version], ['Shell', 'psh'], ['Display', `${innerWidth} x ${innerHeight}`], ['Theme', `${P.isDark() ? 'Dark' : 'Light'}, ${S.wall}`], ['CPU', `${navigator.hardwareConcurrency || '?'} threads`], ['Files', `${Object.keys(FS.files).length} in ~`]];
      for (let i = 0; i < Math.max(art.length, info.length); i++) { const [k, v] = info[i] || ['', '']; line(`<span class="c-blue">${esc((art[i] || '').padEnd(17))}</span><span class="c-green">${esc(k)}</span>${v ? ' ' + esc(v) : ''}`); }
    };
    const C = {
      help: (a, o) => [...HELP, ...P.termHelp].forEach(([c, d]) => o(c.padEnd(24) + d)),
      ls: (a, o) => {
        const p = FS.norm(a[0] || '.', cwd);
        if (FS.isFile(p)) return o(FS.name(p));
        if (!FS.isDir(p)) throw new Error('no such folder: ' + a[0]);
        const { dirs, files } = FS.ls(p);
        if (o !== out) return [...dirs, ...files].forEach(x => o(FS.name(x)));
        if (dirs.length + files.length) line([...dirs.map(d => `<span class="c-blue">${esc(FS.name(d))}/</span>`), ...files.map(f => esc(FS.name(f)))].join('   '));
      },
      cd: a => { const p = FS.norm(a[0] || '~', cwd); if (!FS.isDir(p)) throw new Error('no such folder: ' + a[0]); cwd = p; setPs(); },
      pwd: (a, o) => o(cwd),
      cat: (a, o) => { need(a, 'cat <file>'); o(FS.read(FS.norm(a[0], cwd)).replace(/\n$/, '')); },
      mkdir: a => { need(a, 'mkdir <folder>'); FS.mkdir(FS.norm(a[0], cwd)); },
      touch: a => { need(a, 'touch <file>'); const p = FS.norm(a[0], cwd); if (!FS.exists(p)) FS.write(p, ''); },
      rm: a => { const t = a.filter(x => !x.startsWith('-')); need(t, 'rm [-r] <path>'); const p = FS.norm(t[0], cwd); if (FS.isDir(p) && !a.some(x => /^-r/.test(x))) throw new Error(t[0] + ' is a folder. Use rm -r'); FS.rm(p); },
      mv: a => { if (a.length < 2) throw new Error('usage: mv <from> <to>'); const s = FS.norm(a[0], cwd); let b = FS.norm(a[1], cwd); if (FS.isDir(b)) b += '/' + FS.name(s); FS.mv(s, b); },
      cp: a => { if (a.length < 2) throw new Error('usage: cp <from> <to>'); const s = FS.norm(a[0], cwd); let b = FS.norm(a[1], cwd); if (FS.isDir(b)) b += '/' + FS.name(s); FS.write(b, FS.read(s)); },
      echo: (a, o) => o(a.join(' ')),
      clear: () => { outEl.innerHTML = ''; },
      node: (a, o) => {
        need(a, 'node <file.js>');
        const p = FS.norm(a[0], cwd), code = FS.read(p);
        return new Promise(res => {
          stop = P.runJS(code, {
            out: (t, s) => o(s, t === 'err' ? 'c-red' : t === 'warn' ? 'c-yellow' : ''),
            done: r => { stop = null; if (!r.stopped) flash({ icon: r.ok ? 'check' : 'x', text: `${FS.name(p)} ${r.ok ? 'finished' : 'failed'}`, sub: r.ok ? r.ms + ' ms' : '', tone: r.ok ? 'ok' : 'bad', ms: 2000 }); res(); },
          });
        });
      },
      code: a => { need(a, 'code <file>'); const p = FS.norm(a[0], cwd); if (!FS.exists(p)) FS.write(p, ''); P.openFile(p); },
      open: a => {
        need(a, 'open <app or path>');
        if (P.apps[a[0]]) return void WM.open(a[0]);
        const p = FS.norm(a[0], cwd);
        if (FS.isFile(p)) P.openFile(p); else if (FS.isDir(p)) WM.open('files', { dir: p }); else throw new Error('no app, file or folder called ' + a[0]);
      },
      apps: (a, o) => o(Object.keys(P.apps).join('  ')),
      ask: a => { need(a, 'ask <question>'); P.askVibe(a.join(' ')); },
      focus: (a, o) => { if (a[0] === 'stop') return timer.reset(); const m = parseFloat(a[0] || '25'); if (!(m > 0)) throw new Error('usage: focus <minutes> | focus stop'); timer.start(m); o(`Timer started: ${m} min`); },
      theme: a => { if (!['dark', 'light', 'auto'].includes(a[0])) throw new Error('usage: theme dark|light|auto'); P.set('theme', a[0]); },
      wall: (a, o) => { if (!P.WALLS[a[0]]) return o('Wallpapers: ' + Object.keys(P.WALLS).join(', ')); P.set('wall', a[0]); },
      neofetch, date: (a, o) => o(new Date().toString()), whoami: (a, o) => o('dev'),
      history: (a, o) => hist.forEach((h, i) => o(String(i + 1).padStart(3) + '  ' + h)),
    };
    C.run = C.node;
    async function exec(raw) {
      let toks = (raw.trim().match(/"[^"]*"|'[^']*'|\S+/g) || []).map(t => (/^(".*"|'.*')$/.test(t) ? t.slice(1, -1) : t));
      if (!toks.length) return;
      const ctx = { cwd, out, line, raw: raw.trim(), setStop: f => { stop = f; } };
      const known = n => ((P.termKeep && !P.termKeep.has(n)) ? null : C[n] || (P.termCmds[n] && ((a, o) => P.termCmds[n](a, o, ctx))));
      if (!known(toks[0])) {
        if (!P.termFallback) return out(`${toks[0]}: command not found. Type help for the list.`, 'c-red');
        try { await P.termFallback(ctx); } catch (e) { out(e.message, 'c-red'); }
        stop = null; return;
      }
      let redir = null; const ri = toks.findIndex(t => t === '>' || t === '>>');
      if (ri > 0) { redir = { path: toks[ri + 1], append: toks[ri] === '>>' }; toks = toks.slice(0, ri); if (!redir.path) return out('Add a file name after >', 'c-red'); }
      const [name, ...args] = toks, cmd = known(name);
      const buf = [], o = redir ? s => buf.push(String(s)) : out;
      try {
        await cmd(args, o);
        if (redir) { const p = FS.norm(redir.path, cwd); FS.write(p, (redir.append && FS.isFile(p) ? FS.read(p) : '') + buf.join('\n') + '\n'); }
      } catch (e) { out(`${name}: ${e.message}`, 'c-red'); }
    }
    const complete = () => {
      const parts = inp.value.split(/\s+/), last = parts[parts.length - 1]; let cands;
      if (parts.length === 1) cands = [...Object.keys(C), ...Object.keys(P.termCmds)].filter(c => c.startsWith(last)).map(c => c + ' ');
      else {
        const i = last.lastIndexOf('/'), dp = i >= 0 ? last.slice(0, i + 1) : '', pre = last.slice(i + 1), d = FS.norm(dp || '.', cwd);
        if (!FS.isDir(d)) return;
        const { dirs, files } = FS.ls(d);
        cands = [...dirs.map(x => FS.name(x) + '/'), ...files.map(x => FS.name(x) + ' ')].filter(n => n.startsWith(pre)).map(n => dp + n);
      }
      if (!cands.length) return;
      let pre = cands[0]; for (const c of cands) while (!c.startsWith(pre)) pre = pre.slice(0, -1);
      if (pre.length > last.length) { parts[parts.length - 1] = pre; inp.value = parts.join(' '); }
      else if (cands.length > 1) out(cands.map(c => c.trim()).join('   '), 'c-dim');
    };
    const submit = async v => {
      line(prompt() + ' ' + esc(v));
      if (v.trim()) { hist.push(v); hist = hist.slice(-200); store.set('hist', hist); }
      hi = hist.length; busy = true; await exec(v); busy = false; term.scrollTop = term.scrollHeight;
    };
    w.run = submit;
    inp.addEventListener('keydown', e => {
      const k = e.key;
      if (e.ctrlKey && k.toLowerCase() === 'c' && stop) { e.preventDefault(); stop(); out('^C', 'c-dim'); }
      else if (e.ctrlKey && k.toLowerCase() === 'l') { e.preventDefault(); outEl.innerHTML = ''; }
      else if (k === 'Enter') { if (busy) return; const v = inp.value; inp.value = ''; submit(v); }
      else if (k === 'ArrowUp') { e.preventDefault(); if (hi > 0) inp.value = hist[--hi]; }
      else if (k === 'ArrowDown') { e.preventDefault(); hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; }
      else if (k === 'Tab' && !e.altKey) { e.preventDefault(); complete(); }
    });
    term.addEventListener('mouseup', () => { if (!String(getSelection())) inp.focus(); });
    setPs(); neofetch(); out('Type help to see what the shell can do.', 'c-dim');
  },
};
P.termRun = cmd => { const w = WM.open('terminal'); w && w.run && w.run(cmd); };

/* ================= Studio ================= */
const studio = { tabs: [], cur: -1, win: null, closed: new Set(), open: null };
P.studio = { current: () => (studio.win && studio.tabs[studio.cur]) || null };
function inlineAssets(html, dir) {
  return html
    .replace(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (m, href) => { const p = FS.norm(href, dir); return FS.isFile(p) ? `<style>${FS.read(p)}</style>` : m; })
    .replace(/<script\b([^>]*?)\ssrc=["']([^"']+)["']([^>]*)><\/script>/gi, (m, a, src, b) => { const p = FS.norm(src, dir); return FS.isFile(p) ? `<script${a}${b}>${FS.read(p).replace(/<\/script/gi, '<\\/script')}</script>` : m; });
}
P.inlineAssets = inlineAssets;
P.apps.studio = {
  name: 'Studio', icon: 'code', g: ['#5b8cff', '#2a3fd6'], w: 860, h: 560,
  focus: w => { const t = $('.ed-ta', w.body); t && !t.hidden && t.focus(); },
  args(w, a) { if (a.file) studio.open(a.file); },
  unmount() { const tabs = studio.tabs; studio.win = null; studio.tabs = []; studio.cur = -1; tabs.forEach(t => { if (t.dirty && FS.isFile(t.path)) { try { FS.write(t.path, t.content); } catch {} } }); },
  mount(w, a) {
    studio.win = w;
    w.tools.innerHTML = `<button class="btn sm" data-a="vibe" title="Ask Vibe about this file">${icon('sparkles')}Vibe</button><button class="btn sm pri" data-a="run" title="Run (Ctrl+Enter)">${icon('play')}Run</button>`;
    w.body.innerHTML = `<div class="studio"><aside class="st-side"><div class="st-side-h"><span>Files</span><button class="btn sm" data-a="new" aria-label="New file">${icon('plus')}</button></div><div class="st-tree"></div></aside>
      <div class="st-main"><div class="st-tabs" role="tablist"></div>
      <div class="ed"><pre class="ed-hl" aria-hidden="true"></pre><div class="ed-ln" aria-hidden="true"></div><textarea class="ed-ta" id="studio-editor" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Code editor"></textarea>
        <div class="ed-empty"><b>No file open</b><span>Pick a file on the left, or make a new one.</span><button class="btn pri" data-a="new">${icon('plus')}New file</button></div></div>
      <div class="st-panel" hidden><div class="st-panel-h"><b class="st-pt">Output</b><span class="st-status"></span><button class="btn sm" data-a="hide" aria-label="Close panel">${icon('x')}</button></div>
        <div class="st-out"></div><iframe class="st-prev" sandbox="allow-scripts" title="Live preview" hidden></iframe><div class="st-md prose" hidden></div><div class="st-x" hidden></div></div></div></div>`;
    const b = w.body, tree = $('.st-tree', b), tabsEl = $('.st-tabs', b), ta = $('.ed-ta', b), hl = $('.ed-hl', b), ln = $('.ed-ln', b), empty = $('.ed-empty', b);
    const panel = $('.st-panel', b), outEl = $('.st-out', b), prev = $('.st-prev', b), mdEl = $('.st-md', b), xEl = $('.st-x', b), status = $('.st-status', b), pt = $('.st-pt', b);
    const cur = () => studio.tabs[studio.cur] || null;
    // Extensions (Git, file history) show their own content in the bottom panel through this.
    const showCustom = (title, st, html) => { panel.hidden = false; outEl.hidden = prev.hidden = mdEl.hidden = true; xEl.hidden = false; pt.textContent = title; status.textContent = st; xEl.innerHTML = html; return xEl; };
    const persist = () => store.set('studio', { paths: studio.tabs.map(t => t.path), cur: studio.cur });
    const sync = () => { hl.scrollTop = ln.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; };
    const paint = () => {
      const t = cur(); if (!t) return;
      hl.innerHTML = P.hl(t.content, FS.ext(t.path)) + '\n\n';
      const n = t.content.split('\n').length;
      if (+ln.dataset.n !== n) { ln.dataset.n = n; ln.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n') + '\n\n'; }
      sync();
    };
    const tabsDraw = () => { tabsEl.innerHTML = studio.tabs.map((t, i) => `<div class="st-tab${i === studio.cur ? ' on' : ''}" data-i="${i}" role="tab" tabindex="0" aria-selected="${i === studio.cur}" title="${esc(FS.short(t.path))}">${esc(FS.name(t.path))}${t.dirty ? '<i title="Unsaved changes"></i>' : ''}<b data-x="${i}" aria-label="Close tab">×</b></div>`).join(''); };
    const treeDraw = () => {
      const t = cur();
      const rec = (dir, depth) => {
        const { dirs, files } = FS.ls(dir), pad = `style="padding-left:${6 + depth * 12}px"`;
        return dirs.map(d => `<button class="tr" data-dir="${esc(d)}" ${pad}>${icon('folder')}<span>${esc(FS.name(d))}</span></button>${studio.closed.has(d) ? '' : rec(d, depth + 1)}`).join('')
          + files.map(f => `<button class="tr${t && t.path === f ? ' on' : ''}" data-file="${esc(f)}" ${pad}>${icon('file')}<span>${esc(FS.name(f))}</span></button>`).join('');
      };
      tree.innerHTML = rec('/home', 0) || '<p class="empty">No files yet.</p>';
    };
    const show = () => {
      const t = cur();
      empty.hidden = !!t; ta.hidden = hl.hidden = ln.hidden = !t;
      if (t) { ta.value = t.content; ln.dataset.n = ''; paint(); }
      w.setTitle(t ? `${FS.name(t.path)} · Studio` : 'Studio');
      tabsDraw(); treeDraw(); persist(); P.emit('studio:tab');
    };
    const open = path => {
      if (!FS.isFile(path)) return fail(new Error('No such file: ' + FS.short(path)));
      let i = studio.tabs.findIndex(t => t.path === path);
      if (i < 0) { studio.tabs.push({ path, content: FS.read(path), dirty: false }); i = studio.tabs.length - 1; }
      studio.cur = i; show(); ta.scrollTop = 0; sync();
    };
    studio.open = open;
    const save = quiet => {
      const t = cur(); if (!t) return;
      try { FS.write(t.path, t.content); } catch (e) { return fail(e); }
      t.dirty = false; tabsDraw();
      if (!quiet) flash({ icon: 'check', text: 'Saved ' + FS.name(t.path), tone: 'ok', ms: 1500 });
    };
    const closeTab = i => { const t = studio.tabs[i]; if (t.dirty) { try { FS.write(t.path, t.content); } catch {} } studio.tabs.splice(i, 1); studio.cur = Math.min(studio.cur > i ? studio.cur - 1 : studio.cur, studio.tabs.length - 1); show(); };
    const add = (s, c) => { const d = document.createElement('div'); d.className = c || ''; d.textContent = s; outEl.append(d); outEl.scrollTop = outEl.scrollHeight; };
    const run = () => {
      const t = cur(); if (!t) return;
      if (t.dirty) save(true);
      const ext = FS.ext(t.path), name = FS.name(t.path);
      panel.hidden = false; outEl.hidden = prev.hidden = mdEl.hidden = xEl.hidden = true; status.textContent = name; pt.textContent = 'Preview';
      if (ext === 'html' || ext === 'htm') { prev.hidden = false; prev.srcdoc = inlineAssets(t.content, FS.parent(t.path)); }
      else if (ext === 'md') { mdEl.hidden = false; mdEl.innerHTML = P.md(t.content); }
      else {
        pt.textContent = 'Output'; outEl.hidden = false; outEl.innerHTML = '';
        if (ext === 'js' || ext === 'mjs') {
          status.textContent = `Running ${name}…`;
          P.runJS(t.content, {
            out: (k, s) => add(s, k === 'err' ? 'o-err' : k === 'warn' ? 'o-warn' : ''),
            done: r => {
              if (!studio.win || r.stopped) return;
              status.textContent = r.ok ? `${name} finished in ${r.ms} ms` : `${name} failed`;
              if (!outEl.children.length) add('No output. Use console.log to print something.', 'o-dim');
              flash({ icon: r.ok ? 'check' : 'x', text: `${name} ${r.ok ? 'finished' : 'failed'}`, sub: r.ok ? r.ms + ' ms' : '', tone: r.ok ? 'ok' : 'bad', ms: 2000 });
            },
          });
        } else if (ext === 'json') { try { JSON.parse(t.content); add('Valid JSON.'); } catch (e) { add(e.message, 'o-err'); } }
        else add(`Nothing to run for ${ext ? '.' + ext : 'this'} files. Studio runs JavaScript, HTML, Markdown and JSON.`, 'o-dim');
      }
    };
    const ins = s => { if (!document.execCommand('insertText', false, s)) { ta.setRangeText(s, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } };
    ta.addEventListener('input', () => { const t = cur(); if (!t) return; t.content = ta.value; if (!t.dirty) { t.dirty = true; tabsDraw(); } paint(); });
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Tab') { e.preventDefault(); ins('  '); }
      else if (e.key === 'Enter' && !e.shiftKey) {
        const before = ta.value.slice(0, ta.selectionStart), ind = before.slice(before.lastIndexOf('\n') + 1).match(/^[ \t]*/)[0];
        e.preventDefault(); ins('\n' + ind + (/[{[(]\s*$/.test(before) ? '  ' : ''));
      }
    });
    w.node.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key.toLowerCase() === 's') { e.preventDefault(); save(); } else if (e.key === 'Enter') { e.preventDefault(); run(); }
    });
    tabsEl.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x) return closeTab(+x.dataset.x); const t = e.target.closest('.st-tab'); if (t) { studio.cur = +t.dataset.i; show(); ta.focus(); } });
    tree.addEventListener('click', e => {
      const d = e.target.closest('[data-dir]'), f = e.target.closest('[data-file]');
      if (d) { const p = d.dataset.dir; studio.closed.has(p) ? studio.closed.delete(p) : studio.closed.add(p); treeDraw(); }
      else if (f) { open(f.dataset.file); ta.focus(); }
    });
    tree.addEventListener('contextmenu', e => { const r = e.target.closest('.tr'); if (!r) return; e.preventDefault(); P.fileMenu(e.clientX, e.clientY, r.dataset.file || r.dataset.dir); });
    w.node.addEventListener('click', e => {
      const a2 = e.target.closest('[data-a]'); if (!a2) return;
      const k = a2.dataset.a;
      if (k === 'run') run(); else if (k === 'new') P.newFile(); else if (k === 'hide') panel.hidden = true; else if (k === 'vibe') P.askVibe();
    });
    w.clean.push(P.on('fs', () => {
      const before = cur(), was = before && before.content;
      studio.tabs = studio.tabs.filter(t => FS.isFile(t.path));
      studio.tabs.forEach(t => { if (!t.dirty) t.content = FS.files[t.path]; });
      let i = studio.tabs.indexOf(before); if (i < 0) i = Math.min(studio.cur, studio.tabs.length - 1);
      studio.cur = i; const now = cur();
      if (now !== before || (now && now.content !== was)) show(); else treeDraw();
    }));
    const saved = store.get('studio', null);
    if (saved && Array.isArray(saved.paths)) { studio.tabs = saved.paths.filter(p => FS.isFile(p)).map(p => ({ path: p, content: FS.read(p), dirty: false })); studio.cur = Math.min(saved.cur, studio.tabs.length - 1); }
    else if (FS.isFile('/home/welcome.md')) studio.tabs = [{ path: '/home/welcome.md', content: FS.read('/home/welcome.md'), dirty: false }];
    if (studio.cur < 0 && studio.tabs.length) studio.cur = 0;
    P.emit('studio:mount', { w, cur, open, save, showCustom, tree, side: $('.st-side', b), panelBody: xEl });
    show();
    if (a.file) open(a.file);
  },
};
P.fileMenu = (x, y, path) => P.menu(x, y, [
  ...(FS.isFile(path) ? [{ label: 'Open in Studio', icon: 'code', run: () => P.openFile(path) }] : [{ label: 'Open in Files', icon: 'folder', run: () => WM.open('files', { dir: path }) }]),
  { label: 'Copy path', icon: 'copy', run: () => P.copy(path, 'Path copied') },
  { label: 'Rename', run: async () => { const n = await P.ask({ title: 'Rename', value: FS.name(path), ok: 'Rename' }); if (n && n !== FS.name(path)) { try { FS.mv(path, FS.norm(n, FS.parent(path))); } catch (e) { fail(e); } } } },
  { sep: true },
  { label: 'Delete', icon: 'trash', danger: true, run: async () => { if (await P.confirm({ title: `Delete ${FS.name(path)}?`, text: FS.isDir(path) ? 'The folder and everything in it will be removed. This cannot be undone.' : 'This cannot be undone.' })) { try { FS.rm(path); } catch (e) { fail(e); } } } },
]);

/* ================= Vibe (AI) ================= */
const RULES = 'You are Vibe, the coding assistant built into PrismOS, a browser-based desktop for developers. Keep answers short and practical. '
  + 'PrismOS can run two kinds of files: plain JavaScript (it runs in a Web Worker: print with console.log; there is no DOM, no require and no npm) and self-contained HTML pages shown in a live preview (a page may link sibling .css and .js files by relative path). '
  + 'When you write a file, put it in a fenced code block whose opening line is the language followed by an absolute path under /home/projects/, for example: ```js /home/projects/demo/main.js. Use one block per file and always give the complete file, because the user saves a block into the editor with one click. '
  + 'To make an app for the PrismOS dock, write one self-contained HTML file (inline CSS and JS, with a <title>) at /home/apps/<short-name>.html; the user adds it to the dock with one click.';
const VIBE_ERR = {
  rate_limited: 'Claude is busy or your usage limit was reached. Try again in a little while.', session_expired: 'Your Claude session expired. Sign in again, then retry.',
  refused: 'Claude declined that request. Try rephrasing it.', empty_completion: 'Claude returned nothing. Try asking for less at a time.', prompt_too_large: 'That was too much text. Untick the open file or start a new chat.',
  upstream_error: 'The connection to Claude dropped. Send your message again.',
};
const GONE = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'];
const vibe = (P.vibe = { turns: [], busy: false, ctl: null, draft: '', err: '', sample: undefined, tier: store.get('tier', 'default'), ctx: true, win: null, act: true, noTools: false, steps: [] });
const stepsHTML = st => st.map(x => `<div class="vb-step">${icon('check')}<span>${esc(x)}</span></div>`).join('');
// Tools call this to show what Vibe just did.
P.vibeStep = text => {
  vibe.steps.push(String(text));
  const s = vibe.win && $('#vb-steps', vibe.win.body);
  if (s) { s.innerHTML = stepsHTML(vibe.steps); const log = s.closest('.vb-log'); log.scrollTop = log.scrollHeight; }
};
const aiReady = (window.claude && typeof window.claude.use === 'function' ? Promise.resolve().then(() => window.claude.use('sample')) : Promise.resolve(null))
  .catch(() => null).then(s => { vibe.sample = typeof s === 'function' ? s : null; vibeDraw(); });
const vibeAct = {
  prio: 3,
  compact: () => `${icon('sparkles', 'pulse')}<span>Vibe is writing</span>`,
  expanded: () => `<div class="isl-row"><div><small>Vibe</small><strong>Writing a reply…</strong></div><div class="isl-btns"><button data-do="vibe.stop" aria-label="Stop Vibe">${icon('stop')}</button><button data-do="vibe.show">Open</button></div></div>`,
  on: { stop: () => vibe.ctl && vibe.ctl.abort(), show: () => { P.island.toggle(false); WM.open('vibe'); } },
};
function vibeDraw() {
  const w = vibe.win; if (!w) return;
  const log = $('.vb-log', w.body), off = vibe.sample === null;
  let h = '';
  if (!vibe.turns.length && !vibe.busy) h = `<div class="vb-hello"><div style="width:52px;height:52px">${P.appIcon('vibe')}</div><h2>What are we building?</h2><p>Describe it and Vibe writes the files. Save any code block straight into Studio.</p>
    <div class="vb-sugs">${['Build a pomodoro timer page in one HTML file', 'Write a script that prints the first 20 primes', 'Explain the file I have open, line by line'].map(s => `<button data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
  else h = vibe.turns.map(t => (t.role === 'user' ? `<div class="vb-msg me">${esc(t.content)}</div>` : `<div class="vb-msg ai prose">${t.steps && t.steps.length ? `<div class="vb-steps">${stepsHTML(t.steps)}</div>` : ''}${P.md(t.content, true)}</div>`)).join('');
  if (vibe.busy) h += `<div class="vb-msg ai prose"><div class="vb-steps" id="vb-steps">${stepsHTML(vibe.steps)}</div><div id="vb-draft">${vibe.draft ? P.md(vibe.draft, true) : '<span class="dots" aria-label="Thinking"><i></i><i></i><i></i></span>'}</div></div>`;
  if (vibe.sample === undefined) h += '<div class="vb-note">Connecting to Claude…</div>';
  else if (off) h += '<div class="vb-note">Vibe runs on Claude, which is only reachable when PrismOS is opened from its claude.ai link. Every other app works here.</div>';
  if (vibe.err) h += `<div class="vb-note">${esc(vibe.err)}</div>`;
  log.innerHTML = h; log.scrollTop = log.scrollHeight;
  const btn = $('#vb-send', w.body), ta = $('#vb-in', w.body);
  btn.innerHTML = icon(vibe.busy ? 'stop' : 'send'); btn.setAttribute('aria-label', vibe.busy ? 'Stop' : 'Send'); btn.disabled = off && !vibe.busy; ta.disabled = off;
  const al = $('#vb-act-l', w.body); if (al) al.hidden = !vibe.sample || vibe.noTools || !P.vibeTools;
}
async function vibeSend(text) {
  text = String(text || '').trim();
  if (!text || vibe.busy || !vibe.sample) return;
  vibe.turns.push({ role: 'user', content: text }); vibe.busy = true; vibe.draft = ''; vibe.err = ''; vibe.steps = []; vibe.ctl = new AbortController();
  vibeDraw(); P.island.set('vibe', vibeAct);
  const t = P.studio.current();
  const ctx = vibe.ctx && t ? `\n\nThe file open in Studio right now is ${t.path}:\n\`\`\`\n${t.content.slice(0, 8000)}\n\`\`\`` : '';
  try {
    // With "Let Vibe act" on, Claude gets page tools (write files, run code, open apps). Not every view supports them.
    let tools = null;
    if (vibe.act && !vibe.noTools && P.vibeTools) { tools = await P.vibeTools(vibe.sample).catch(() => null); if (!tools || !tools.length) { tools = null; vibe.noTools = true; } }
    const r = await vibe.sample([{ role: 'user', content: RULES + (tools ? P.vibeAgentRules : '') + ctx }, ...vibe.turns.slice(-10).map(m => ({ role: m.role, content: m.content }))], {
      cache: false, signal: vibe.ctl.signal, modelTier: vibe.tier, ...(tools ? { tools } : {}),
      onText: ({ text: tx }) => { vibe.draft = tx; const d = vibe.win && $('#vb-draft', vibe.win.body); if (d) { const log = d.closest('.vb-log'), stick = log.scrollHeight - log.scrollTop - log.clientHeight < 80; d.innerHTML = P.md(tx, true); if (stick) log.scrollTop = log.scrollHeight; } },
    });
    vibe.turns.push({ role: 'assistant', content: r.text, steps: vibe.steps.slice() });
    if (r.truncated) vibe.err = 'That answer was cut short. Ask for less at a time.';
    if (!vibe.win || WM.activeId !== vibe.win.id) flash({ icon: 'sparkles', text: 'Vibe replied', tone: 'info' });
  } catch (e) {
    const code = (e && e.code) || 'upstream_error';
    if ((e && e.text) || vibe.steps.length) vibe.turns.push({ role: 'assistant', content: (e && e.text) || 'Stopped before finishing.', steps: vibe.steps.slice() });
    if (GONE.includes(code)) vibe.sample = null;
    else if (code === 'tools_unavailable') { vibe.noTools = true; vibe.err = 'Vibe cannot act in this view. Send your message again and it will answer without tools.'; }
    else if (code !== 'cancelled') vibe.err = VIBE_ERR[code] || VIBE_ERR.upstream_error;
  } finally { vibe.busy = false; vibe.draft = ''; P.island.remove('vibe'); vibeDraw(); }
}
P.askVibe = async q => {
  const w = WM.open('vibe'); if (!w) return;
  const ta = $('#vb-in', w.body);
  if (!q) return void ta.focus();
  await aiReady;
  if (vibe.sample) vibeSend(q); else { ta.value = q; vibeDraw(); }
};
P.vibeDraft = text => { const w = WM.open('vibe'); if (!w) return; const ta = $('#vb-in', w.body); ta.value = text; if (!ta.disabled) ta.focus(); };
P.apps.vibe = {
  name: 'Vibe', icon: 'sparkles', g: ['#ff7ab8', '#8b5cf6'], w: 460, h: 580,
  focus: w => { const t = $('#vb-in', w.body); t && !t.disabled && t.focus(); },
  unmount() { vibe.win = null; },
  mount(w) {
    vibe.win = w;
    w.body.innerHTML = `<div class="vibe"><div class="vb-top"><label><input type="checkbox" id="vb-ctx" ${vibe.ctx ? 'checked' : ''}>Include the open Studio file</label><label id="vb-act-l" hidden><input type="checkbox" id="vb-act" ${vibe.act ? 'checked' : ''}>Let Vibe act</label><span class="grow"></span>
      <select class="inp" id="vb-tier" aria-label="Answer depth"><option value="quick">Quick</option><option value="default">Balanced</option><option value="complex">Deep</option></select><button class="btn sm" data-a="new">New chat</button></div>
      <div class="vb-log" aria-live="polite"></div>
      <form class="vb-form"><textarea class="inp" id="vb-in" rows="2" placeholder="Ask for code, a fix, or an explanation" aria-label="Message Vibe"></textarea><button class="btn pri" id="vb-send" aria-label="Send"></button></form></div>`;
    const b = w.body, ta = $('#vb-in', b);
    $('#vb-tier', b).value = vibe.tier;
    $('#vb-tier', b).addEventListener('change', e => { vibe.tier = e.target.value; store.set('tier', vibe.tier); });
    $('#vb-ctx', b).addEventListener('change', e => { vibe.ctx = e.target.checked; });
    $('#vb-act', b).addEventListener('change', e => { vibe.act = e.target.checked; });
    const go = () => { if (vibe.busy) return vibe.ctl && vibe.ctl.abort(); const v = ta.value; if (!v.trim() || !vibe.sample) return; ta.value = ''; vibeSend(v); };
    $('.vb-form', b).addEventListener('submit', e => { e.preventDefault(); go(); });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); go(); } });
    b.addEventListener('click', async e => {
      const sug = e.target.closest('[data-sug]'), cb = e.target.closest('[data-cb]');
      if (sug) { ta.value = sug.dataset.sug; ta.focus(); }
      else if (e.target.closest('[data-a="new"]')) { if (vibe.busy && vibe.ctl) vibe.ctl.abort(); vibe.turns = []; vibe.err = ''; vibeDraw(); }
      else if (cb) {
        const box = cb.closest('.cb'), code = $('pre', box).textContent;
        if (cb.dataset.cb === 'copy') return P.copy(code, 'Code copied');
        const lang = box.dataset.lang || 'txt', ext = { javascript: 'js', typescript: 'ts', markdown: 'md' }[lang] || lang;
        const path = box.dataset.path || FS.norm((await P.ask({ title: 'Save code as', value: `projects/vibe/untitled.${ext}`, ok: 'Save' })) || '', '/home');
        if (!path || path === '/home') return;
        try {
          FS.write(path, code + '\n');
          if (path.startsWith('/home/apps/') && P.miniInstall) P.miniInstall(path);
          else { P.openFile(path); flash({ icon: 'check', text: 'Saved ' + FS.name(path), sub: 'Opened in Studio', tone: 'ok' }); }
        } catch (err) { fail(err); }
      }
    });
    vibeDraw();
  },
};

/* ================= Files ================= */
P.apps.files = {
  name: 'Files', icon: 'folder', g: ['#58b4ff', '#1e63e9'], w: 620, h: 430,
  args(w, a) { if (a.dir) w.go(a.dir); },
  mount(w, a) {
    let cwd = a.dir && FS.isDir(a.dir) ? a.dir : '/home';
    w.body.innerHTML = `<div class="files"><div class="fl-bar"><button class="btn sm" data-a="up" aria-label="Go up a folder">${icon('up')}</button><div class="fl-crumbs"></div><button class="btn sm" data-a="file">${icon('plus')}File</button><button class="btn sm" data-a="dir">${icon('plus')}Folder</button></div><div class="fl-list"></div><div class="fl-foot"></div></div>`;
    const b = w.body, list = $('.fl-list', b);
    const kb = n => (n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB');
    const draw = () => {
      if (!FS.isDir(cwd)) cwd = '/home';
      const { dirs, files } = FS.ls(cwd), segs = cwd.split('/').filter(Boolean);
      $('.fl-crumbs', b).innerHTML = segs.map((s, i) => `${i ? '<i>/</i>' : ''}<button data-go="/${segs.slice(0, i + 1).join('/')}">${esc(i === 0 && s === 'home' ? 'Home' : s)}</button>`).join('') || '<button data-go="/">/</button>';
      list.innerHTML = [...dirs.map(d => `<div class="fl-row" data-p="${esc(d)}" tabindex="0">${icon('folder')}<span>${esc(FS.name(d))}</span><small>Folder</small><button data-more aria-label="More actions">⋯</button></div>`),
        ...files.map(f => `<div class="fl-row" data-p="${esc(f)}" tabindex="0">${icon('file')}<span>${esc(FS.name(f))}</span><small>${kb(FS.files[f].length)}</small><button data-more aria-label="More actions">⋯</button></div>`)].join('') || '<p class="empty">This folder is empty. Add a file or folder above.</p>';
      $('.fl-foot', b).textContent = `${dirs.length} folders, ${files.length} files · ${kb(FS.bytes())} used in total`;
      $('[data-a="up"]', b).disabled = cwd === '/';
      w.setTitle(cwd === '/home' ? 'Files' : `${FS.name(cwd) || '/'} · Files`);
    };
    w.go = d => { if (FS.isDir(d)) { cwd = d; draw(); } };
    const openRow = p => (FS.isDir(p) ? w.go(p) : P.openFile(p));
    b.addEventListener('click', async e => {
      const row = e.target.closest('.fl-row'), go = e.target.closest('[data-go]'), a2 = e.target.closest('[data-a]');
      if (e.target.closest('[data-more]')) { const r = e.target.getBoundingClientRect(); return P.fileMenu(r.left, r.bottom + 4, row.dataset.p); }
      if (row) return openRow(row.dataset.p);
      if (go) return w.go(go.dataset.go);
      if (!a2) return;
      if (a2.dataset.a === 'up') return w.go(FS.parent(cwd));
      const isDir = a2.dataset.a === 'dir', name = await P.ask({ title: isDir ? 'New folder' : 'New file', placeholder: isDir ? 'folder-name' : 'notes.md' });
      if (!name) return;
      try { const p = FS.norm(name, cwd); if (FS.exists(p)) throw new Error(name + ' already exists'); isDir ? FS.mkdir(p) : FS.write(p, ''); } catch (err) { fail(err); }
    });
    list.addEventListener('keydown', e => { const row = e.target.closest('.fl-row'); if (row && e.key === 'Enter') openRow(row.dataset.p); });
    list.addEventListener('contextmenu', e => { const row = e.target.closest('.fl-row'); if (row) { e.preventDefault(); P.fileMenu(e.clientX, e.clientY, row.dataset.p); } });
    w.clean.push(P.on('fs', draw));
    draw();
  },
};

/* ================= Notes ================= */
P.apps.notes = {
  name: 'Notes', icon: 'note', g: ['#ffd95e', '#f59f0b'], w: 620, h: 430,
  focus: w => { const t = $('#note-text', w.body); t && !t.disabled && t.focus(); },
  mount(w) {
    const DIR = '/home/notes'; let cur = null;
    w.body.innerHTML = `<div class="notes"><div class="nt-side"><button class="btn" data-a="new">${icon('plus')}New note</button><div class="nt-list"></div></div>
      <div class="nt-main"><textarea id="note-text" placeholder="Start typing. Notes save as you go." aria-label="Note text"></textarea><div class="nt-bar"><span class="nt-info"></span><button class="btn sm danger" data-a="del">${icon('trash')}Delete</button></div></div></div>`;
    const b = w.body, ta = $('#note-text', b), listEl = $('.nt-list', b);
    const notes = () => (FS.isDir(DIR) ? FS.ls(DIR).files : []);
    const drawList = () => {
      listEl.innerHTML = notes().map(p => { const ls = FS.files[p].split('\n').filter(l => l.trim()); return `<button class="nt-it${p === cur ? ' on' : ''}" data-p="${esc(p)}"><b>${esc((ls[0] || 'Empty note').replace(/^#+\s*/, ''))}</b><small>${esc(ls[1] || FS.name(p))}</small></button>`; }).join('');
      $('.nt-info', b).textContent = cur ? `${FS.short(cur)} · ${ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0} words` : 'No note selected';
      $('[data-a="del"]', b).disabled = ta.disabled = !cur;
    };
    const pick = p => { cur = p && FS.isFile(p) ? p : notes()[0] || null; ta.value = cur ? FS.files[cur] : ''; drawList(); };
    const save = debounce(() => { if (cur && FS.isFile(cur) && FS.files[cur] !== ta.value) FS.write(cur, ta.value); }, 350);
    ta.addEventListener('input', save);
    b.addEventListener('click', async e => {
      const it = e.target.closest('.nt-it'), a2 = e.target.closest('[data-a]');
      if (it) return pick(it.dataset.p);
      if (!a2) return;
      if (a2.dataset.a === 'new') { let n = 1; while (FS.exists(`${DIR}/note-${n}.md`)) n++; const p = `${DIR}/note-${n}.md`; FS.write(p, ''); pick(p); ta.focus(); }
      else if (cur && await P.confirm({ title: 'Delete this note?', text: 'This cannot be undone.' })) { const p = cur; cur = null; FS.rm(p); pick(null); }
    });
    w.clean.push(P.on('fs', () => { if (cur && !FS.isFile(cur)) pick(null); else { if (cur && document.activeElement !== ta) ta.value = FS.files[cur]; drawList(); } }));
    pick(null);
  },
};

/* ================= Toolbox ================= */
const hexToRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return /^[0-9a-f]{6}$/i.test(h) ? [n >> 16, (n >> 8) & 255, n & 255] : null; };
const rgbToHsl = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0; if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = Math.round(h * 60); if (h < 0) h += 360; } return [h, Math.round(s * 100), Math.round(l * 100)]; };
const TOOLS = {
  json: { name: 'JSON', html: () => `<textarea class="inp" id="tb-json" spellcheck="false" aria-label="JSON input">{"name":"PrismOS","apps":["Terminal","Studio","Vibe"],"version":1}</textarea><div class="tbx-row"><button class="btn pri" data-t="fmt">Format</button><button class="btn" data-t="min">Minify</button><button class="btn" data-t="copy">${icon('copy')}Copy</button><span class="tbx-msg"></span></div>`,
    act(k, r) { const ta = $('#tb-json', r), msg = $('.tbx-msg', r); if (k === 'copy') return P.copy(ta.value); try { const v = JSON.parse(ta.value); ta.value = JSON.stringify(v, null, k === 'fmt' ? 2 : 0); msg.className = 'tbx-msg ok'; msg.textContent = 'Valid JSON'; } catch (e) { msg.className = 'tbx-msg bad'; msg.textContent = e.message; } } },
  base64: { name: 'Base64', html: () => `<textarea class="inp" id="tb-b64-in" spellcheck="false" aria-label="Text to convert">Hello, PrismOS</textarea><div class="tbx-row"><button class="btn pri" data-t="enc">Encode</button><button class="btn" data-t="dec">Decode</button><button class="btn" data-t="copy">${icon('copy')}Copy result</button><span class="tbx-msg"></span></div><textarea class="inp" id="tb-b64-out" readonly aria-label="Result"></textarea>`,
    act(k, r) { const i = $('#tb-b64-in', r), o = $('#tb-b64-out', r), msg = $('.tbx-msg', r); msg.textContent = ''; if (k === 'copy') return P.copy(o.value); try { o.value = k === 'enc' ? btoa(String.fromCharCode(...new TextEncoder().encode(i.value))) : new TextDecoder().decode(Uint8Array.from(atob(i.value.trim()), c => c.charCodeAt(0))); } catch { msg.className = 'tbx-msg bad'; msg.textContent = 'That is not valid Base64.'; } } },
  regex: { name: 'Regex', html: () => `<div class="tbx-row"><input class="inp" id="tb-rx" value="\\b\\w+@\\w+\\.\\w+\\b" spellcheck="false" aria-label="Pattern"><input class="inp" id="tb-rxf" value="g" style="flex:0 0 64px" aria-label="Flags"></div><textarea class="inp" id="tb-rxt" spellcheck="false" aria-label="Text to test">Write to dev@prism.os or team@example.com for access.</textarea><div class="tbx-msg"></div><div class="rx-out"></div>`,
    act(k, r) { const msg = $('.tbx-msg', r), o = $('.rx-out', r), text = $('#tb-rxt', r).value; try { let f = $('#tb-rxf', r).value; if (!f.includes('g')) f += 'g'; const re = new RegExp($('#tb-rx', r).value, f); let n = 0, last = 0, h = '', m; while ((m = re.exec(text))) { if (!m[0]) { re.lastIndex++; continue; } h += esc(text.slice(last, m.index)) + `<mark>${esc(m[0])}</mark>`; last = m.index + m[0].length; n++; } o.innerHTML = h + esc(text.slice(last)); msg.className = 'tbx-msg'; msg.textContent = `${n} ${n === 1 ? 'match' : 'matches'}`; } catch (e) { msg.className = 'tbx-msg bad'; msg.textContent = e.message; o.textContent = text; } }, live: true },
  ids: { name: 'IDs & time', html: () => `<div class="kv"></div><div class="tbx-row"><button class="btn pri" data-t="new">Generate again</button></div>`,
    act(k, r) { const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join(''); const now = new Date(); const rows = [['UUID', crypto.randomUUID ? crypto.randomUUID() : hex(16)], ['Hex token', hex(16)], ['Unix seconds', String(Math.floor(now / 1000))], ['Unix ms', String(+now)], ['ISO 8601', now.toISOString()]]; $('.kv', r).innerHTML = rows.map(([a, v]) => `<span>${a}</span><code>${esc(v)}</code><button class="btn sm" data-copy="${esc(v)}">${icon('copy')}Copy</button>`).join(''); }, live: true },
  color: { name: 'Colour', html: () => `<div class="tbx-row"><input type="color" id="tb-col" value="${S.accent}" aria-label="Pick a colour" style="width:44px;height:30px;padding:0;border:0;background:none"><input class="inp" id="tb-hex" value="${S.accent}" spellcheck="false" aria-label="Hex colour"></div><div class="swatch"></div><div class="kv"></div><div class="tbx-msg"></div>`,
    act(k, r, e) { const hexEl = $('#tb-hex', r), colEl = $('#tb-col', r), msg = $('.tbx-msg', r); if (e && e.target === colEl) hexEl.value = colEl.value; const rgb = hexToRgb(hexEl.value.trim()); if (!rgb) { msg.className = 'tbx-msg bad'; msg.textContent = 'Enter a hex colour like #2f6fed.'; return; } msg.textContent = ''; const hex = '#' + rgb.map(x => x.toString(16).padStart(2, '0')).join(''), hsl = rgbToHsl(rgb); colEl.value = hex; $('.swatch', r).style.background = hex; const rows = [['HEX', hex], ['RGB', `rgb(${rgb.join(', ')})`], ['HSL', `hsl(${hsl[0]} ${hsl[1]}% ${hsl[2]}%)`]]; $('.kv', r).innerHTML = rows.map(([a, v]) => `<span>${a}</span><code>${v}</code><button class="btn sm" data-copy="${v}">${icon('copy')}Copy</button>`).join(''); }, live: true },
};
P.tools = TOOLS;
P.apps.toolbox = {
  name: 'Toolbox', icon: 'braces', g: ['#3ddc97', '#0e9aa7'], w: 560, h: 440,
  mount(w) {
    let tab = store.get('tool', 'json'); if (!TOOLS[tab]) tab = 'json';
    w.body.innerHTML = `<div class="tbx"><div class="tbx-tabs"><div class="seg" role="tablist">${Object.entries(TOOLS).map(([k, t]) => `<button data-tab="${k}" role="tab">${t.name}</button>`).join('')}</div></div><div class="tbx-body"></div></div>`;
    const body = $('.tbx-body', w.body);
    const draw = () => { $$('[data-tab]', w.body).forEach(x => x.classList.toggle('on', x.dataset.tab === tab)); body.innerHTML = TOOLS[tab].html(); if (TOOLS[tab].live) TOOLS[tab].act('init', body); };
    w.body.addEventListener('click', e => {
      const tb = e.target.closest('[data-tab]'), t = e.target.closest('[data-t]'), c = e.target.closest('[data-copy]');
      if (tb) { tab = tb.dataset.tab; store.set('tool', tab); draw(); } else if (c) P.copy(c.dataset.copy); else if (t) TOOLS[tab].act(t.dataset.t, body, e);
    });
    body.addEventListener('input', e => { if (TOOLS[tab].live && tab !== 'ids') TOOLS[tab].act('input', body, e); });
    draw();
  },
};

/* ================= Focus ================= */
P.apps.focus = {
  name: 'Focus', icon: 'timer', g: ['#ff8a5c', '#e0457b'], w: 380, h: 500,
  mount(w) {
    w.body.innerHTML = `<div class="focus"><span class="fc-label"></span><div class="fc-time num"></div><div class="fc-prog"><i></i></div>
      <div class="fc-row"><button class="btn pri" data-f="toggle"></button><button class="btn" data-f="reset">Reset</button></div>
      <div class="fc-row">${[[25, 'Focus'], [50, 'Deep work'], [5, 'Break'], [15, 'Long break']].map(([m, l]) => `<button class="btn sm" data-min="${m}" data-label="${l}">${m} min ${l.toLowerCase()}</button>`).join('')}</div>
      <div class="fc-sound"><div class="fc-row" style="justify-content:space-between"><b>Ambient sound</b><button class="btn sm" data-f="sound"></button></div>
        <div class="seg">${Object.entries(SOUNDS).map(([k, n]) => `<button data-kind="${k}">${n}</button>`).join('')}</div>
        <input type="range" min="0" max="1" step="0.01" value="${S.vol}" data-range="vol" id="fc-vol" aria-label="Volume"></div></div>`;
    const b = w.body;
    const draw = () => {
      $('.fc-label', b).textContent = timer.label + (timer.running ? '' : timer.left < timer.total ? ' · paused' : ' · ready');
      $('.fc-time', b).textContent = fmtT(timer.left);
      $('.fc-prog i', b).style.width = (1 - timer.left / timer.total) * 100 + '%';
      $('[data-f="toggle"]', b).innerHTML = icon(timer.running ? 'pause' : 'play') + (timer.running ? 'Pause' : timer.left < timer.total ? 'Resume' : 'Start');
      $('[data-f="sound"]', b).innerHTML = icon(audio.playing ? 'pause' : 'play') + (audio.playing ? 'Stop' : 'Play');
      $$('[data-kind]', b).forEach(x => x.classList.toggle('on', x.dataset.kind === audio.kind));
    };
    b.addEventListener('click', e => {
      const f = e.target.closest('[data-f]'), m = e.target.closest('[data-min]'), k = e.target.closest('[data-kind]');
      if (m) timer.start(+m.dataset.min, m.dataset.label);
      else if (k) { if (audio.playing) audio.play(k.dataset.kind); else { audio.kind = k.dataset.kind; store.set('sound', audio.kind); draw(); } }
      else if (f) ({ toggle: () => (timer.running ? timer.pause() : timer.start()), reset: () => timer.reset(), sound: () => audio.toggle() })[f.dataset.f]();
    });
    b.addEventListener('input', e => { const r = e.target.closest('[data-range]'); if (r) P.set('vol', +r.value); });
    w.clean.push(P.on('timer', draw), P.on('audio', draw));
    draw();
  },
};

/* ================= Settings ================= */
P.apps.settings = {
  name: 'Settings', icon: 'sliders', g: ['#9aa3b5', '#5b6477'], w: 520, h: 560,
  mount(w) {
    const tog = (k, title, sub) => `<div class="set-row"><div>${title}<small>${sub}</small></div><button class="tog" role="switch" aria-checked="${!!S[k]}" aria-label="${title}" data-tog="${k}"></button></div>`;
    const draw = () => {
      const st = w.body.firstElementChild ? w.body.firstElementChild.scrollTop : 0;
      w.body.innerHTML = `<div class="sets"><div class="about">${icon('prism')}<div><b>PrismOS ${P.version}</b><div style="color:var(--fg2)">A glass desktop for people who build things. It runs in your browser.</div></div></div>
        <h3>Appearance</h3><div class="set-card">
          <div class="set-row"><div>Theme<small>Auto follows your device</small></div><div class="seg">${['auto', 'light', 'dark'].map(t => `<button class="${S.theme === t ? 'on' : ''}" data-set="theme" data-val="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div></div>
          <div class="set-row"><div>Accent</div>${P.swatches('accent')}</div>
          <div class="set-row"><div>Wallpaper</div>${P.swatches('wall')}</div>
          <div class="set-row"><div><label for="set-blur">Glass blur</label><small>Lower values are lighter on older machines</small></div><input id="set-blur" type="range" min="6" max="48" step="1" value="${S.blur}" data-range="blur"></div></div>
        <h3>Behaviour</h3><div class="set-card">
          ${tog('magnify', 'Dock magnification', 'Icons grow as the pointer passes')}
          ${tog('motion', 'Animations', 'Window, Island and wallpaper motion')}
          ${tog('dnd', 'Do Not Disturb', 'Hide Island notifications')}
          ${tog('widgets', 'Desktop widgets', 'Clock, today\'s problem and focus time on the desktop')}</div>
        <h3>Storage</h3><div class="set-card">
          <div class="set-row"><div>Your files<small>${Object.keys(FS.files).length} files, ${(FS.bytes() / 1024).toFixed(1)} KB, ${P.native ? 'stored on this computer in ' + esc(P.native.home) : 'kept in this browser only'}</small></div><button class="btn" data-s="files">${icon('folder')}Open Files</button></div>
          <div class="set-row"><div>Reset PrismOS<small>${P.native ? 'Resets settings, layout and progress. Files on disk are kept.' : 'Deletes your files and settings on this device'}</small></div><button class="btn danger" data-s="reset">Reset</button></div></div></div>`;
      w.body.firstElementChild.scrollTop = st;
    };
    w.body.addEventListener('click', async e => {
      const t = e.target.closest('[data-tog]'), s = e.target.closest('[data-s]');
      if (t) P.set(t.dataset.tog, !S[t.dataset.tog]);
      else if (s && s.dataset.s === 'files') WM.open('files');
      else if (s && await P.confirm({ title: 'Reset PrismOS?', text: P.native ? 'Settings, window layout, Arena progress and file history will be cleared. Files in your PrismOS folder are kept.' : 'All files, notes and settings stored in this browser will be deleted. This cannot be undone.', ok: 'Reset everything' })) { store.clear(); try { store.set = () => {}; location.reload(); } catch {} }
    });
    w.body.addEventListener('input', e => { const r = e.target.closest('[data-range]'); if (r) P.set(r.dataset.range, +r.value); });
    w.clean.push(P.on('settings', k => { if (k !== 'blur' && k !== 'vol') draw(); }), P.on('fs', draw));
    draw();
  },
};

/* ================= Shortcuts ================= */
const KEYS = [
  ['System', [['Search apps, files, commands', 'Ctrl Space'], ['Same, alternative', 'Ctrl K'], ['Open Terminal', 'Ctrl Alt T'], ['Open dock app 1 to 9', 'Alt 1…9'], ['Settings', 'Ctrl ,'], ['This list', 'Ctrl /'], ['Expand the Island', 'Alt I'], ['Clipboard history', 'Ctrl Shift V'], ['Lock the screen', 'Alt L'], ['Open workspace 1 to 4', 'Ctrl Alt 1…4'], ['Close a menu or panel', 'Esc']]],
  ['Desktops', [['Next / previous desktop', 'Ctrl Alt → ←'], ['Move window to next desktop', 'Ctrl Alt Shift →']]],
  ['Windows', [['Switch window (hold Alt)', 'Alt `'], ['Snap left / right', 'Alt ← →'], ['Maximise', 'Alt ↑'], ['Restore, then minimise', 'Alt ↓'], ['Minimise', 'Alt M'], ['Close', 'Alt W'], ['Show desktop', 'Alt D'], ['Snap layouts', 'Hover green dot']]],
  ['Studio', [['Run the file', 'Ctrl Enter'], ['Save', 'Ctrl S'], ['Indent', 'Tab']]],
  ['Terminal', [['Complete a name', 'Tab'], ['Previous commands', '↑ ↓'], ['Clear the screen', 'Ctrl L'], ['Stop a running script', 'Ctrl C']]],
];
P.apps.shortcuts = {
  name: 'Shortcuts', icon: 'keyboard', g: ['#7c8cff', '#4338ca'], w: 640, h: 520,
  mount(w) {
    w.body.innerHTML = `<div class="keys">${KEYS.map(([h, rows]) => `<h3>${h}</h3><div class="key-grid">${rows.map(([a, k]) => `<div class="key-row"><span>${a}</span><span>${k.includes('dot') ? `<kbd>${k}</kbd>` : k.split(' ').map(x => `<kbd>${x}</kbd>`).join('')}</span></div>`).join('')}</div>`).join('')}
      <p style="color:var(--fg2);margin:16px 0 0">PrismOS uses Alt where Windows uses the Windows key, because a browser cannot capture that key. Alt Tab also works when the browser lets it through.</p></div>`;
  },
};
})();
