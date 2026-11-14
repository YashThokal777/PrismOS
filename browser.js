/* PrismOS Browser. Desktop app only (it needs Electron's <webview>); does nothing in a plain browser.
   One component drives the Browser app and every website app (YouTube, GitHub, ...):
   tabs in the title bar, address bar with suggestions, start page, find, zoom, right-click menu,
   downloads in the Island, permission prompts, full-screen video, and tabs that come back after a restart. */
(() => {
'use strict';
const N = window.prismNative; if (!N || !N.web) return;
const P = window.Prism, { $, $$, el, esc, icon, store, WM, debounce, clamp } = P;
const flash = o => P.island.flash(o);

Object.assign(P.icons, {
  star: '<path d="m12 3.5 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  dots: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  vol: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9.5 5 5M22 9.5l-5 5"/>',
  home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
  zoomin: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/>',
  zoomout: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/>',
});

/* ---------- addresses, search, history ---------- */
const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', q: 'https://duckduckgo.com/?q=' },
  google: { name: 'Google', q: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', q: 'https://www.bing.com/search?q=' },
  brave: { name: 'Brave Search', q: 'https://search.brave.com/search?q=' },
};
const engine = () => ENGINES[store.get('engine')] || ENGINES.duckduckgo;
const isUrl = u => /^https?:\/\//i.test(u) || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/.*)?$/i.test(u) || (!/\s/.test(u) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(u));
const fixUrl = u => {
  u = String(u || '').trim(); if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/.*)?$/i.test(u)) return 'http://' + u;
  if (isUrl(u)) return 'https://' + u;
  return engine().q + encodeURIComponent(u);
};
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const hue = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 360;
const ago = t => { const m = (Date.now() - t) / 6e4; return m < 1 ? 'now' : m < 60 ? `${m | 0}m` : m < 1440 ? `${(m / 60) | 0}h` : `${(m / 1440) | 0}d`; };

let hist = store.get('webHist', []);
const saveHist = debounce(() => store.set('webHist', hist.slice(0, 400)), 800);
const addHist = (url, title, fav) => {
  if (!/^https?:/i.test(url)) return;
  const i = hist.findIndex(h => h.url === url), old = i >= 0 ? hist.splice(i, 1)[0] : null;
  hist.unshift({ url, title: title || (old && old.title) || hostOf(url), fav: fav || (old && old.fav) || '', n: (old ? old.n : 0) + 1, t: Date.now() });
  saveHist();
};
const patchHist = (url, o) => { const h = hist.find(x => x.url === url); if (h) { Object.assign(h, o); saveHist(); } };
const favs = store.get('webFavs', {});   // host -> favicon URL, for the start page tiles
const saveFavs = debounce(() => store.set('webFavs', favs), 1000);

const zooms = store.get('webZoom', {});  // host -> zoom factor
const LEVELS = [0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

const ERRS = {
  '-105': 'The address could not be found. Check the spelling.',
  '-106': 'You are offline. Check your internet connection.',
  '-102': 'Nothing is running at this address. If it is your dev server, start it first.',
  '-118': 'The site took too long to answer.',
  '-109': 'The address could not be reached.',
  '-200': 'The site\'s security certificate is not valid.',
  '-201': 'The site\'s security certificate has expired or is not yet valid.',
  '-202': 'The site\'s security certificate is not trusted.',
};

/* ---------- website apps ---------- */
const sites = store.get('sites', [{ name: 'YouTube', url: 'https://www.youtube.com' }, { name: 'Spotify', url: 'https://open.spotify.com' }, { name: 'GitHub', url: 'https://github.com' }]);
const siteId = s => 'site:' + s.name;
const siteFor = url => { const h = hostOf(url); return h && sites.find(s => hostOf(s.url) === h); };
const closed = [];   // recently closed tabs, for Ctrl+Shift+T

/* ---------- one web window ---------- */
function mount(w, a, name, home) {
  let seq = 0;
  w.node.classList.add('webwin');
  w.tabs = []; w.cur = null;
  const strip = el(`<div class="web-tabs" role="tablist" aria-label="Tabs"><div class="wt-list"></div><button class="wt-new" aria-label="New tab" title="New tab (Ctrl+T)">${icon('plus')}</button></div>`);
  $('.win-bar', w.node).insertBefore(strip, $('.win-title', w.node));
  const list = $('.wt-list', strip);
  w.body.innerHTML = `<div class="web">
    <div class="web-bar">
      <button class="wb" data-wb="back" aria-label="Back" title="Back (Alt+Left)">${icon('back')}</button>
      <button class="wb" data-wb="fwd" aria-label="Forward" title="Forward (Alt+Right)">${icon('fwd')}</button>
      <button class="wb" data-wb="reload" aria-label="Reload" title="Reload (Ctrl+R)">${icon('reload')}</button>
      <div class="web-addr"><span class="wa-ic"></span><input class="wa-in" spellcheck="false" autocomplete="off" aria-label="Address or search">
        <button class="wa-zoom" hidden title="Reset zoom (Ctrl+0)"></button>
        <button class="wa-star" data-wb="star" aria-label="Add this site to the dock" title="Add this site to the dock">${icon('star')}</button>
        <div class="web-sug glass" hidden role="listbox"></div></div>
      <button class="wb" data-wb="dl" aria-label="Downloads" title="Downloads" hidden>${icon('download')}</button>
      <button class="wb" data-wb="menu" aria-label="Browser menu" title="Menu">${icon('dots')}</button>
    </div>
    <div class="web-prog"><i></i></div>
    <div class="web-stack">
      <div class="web-find glass" hidden><input aria-label="Find in page" placeholder="Find in page" spellcheck="false"><span class="wf-n"></span>
        <button data-wf="prev" aria-label="Previous match">${icon('up')}</button><button data-wf="next" aria-label="Next match" class="wf-dn">${icon('up')}</button><button data-wf="x" aria-label="Close find">${icon('x')}</button></div>
    </div></div>`;
  const B = $('.web', w.body), stack = $('.web-stack', B), inp = $('.wa-in', B), sugEl = $('.web-sug', B), prog = $('.web-prog', B);
  const findEl = $('.web-find', B), findIn = $('input', findEl), findN = $('.wf-n', findEl), zoomEl = $('.wa-zoom', B), star = $('.wa-star', B);
  const btn = k => $(`[data-wb="${k}"]`, B);
  const cur = () => w.cur;
  const idx = t => w.tabs.indexOf(t);
  const view = t => (t && t.view && t.ready ? t.view : null);

  const save = debounce(() => {
    if (w.gone) return;
    const tabs = w.tabs.map(t => ({ url: t.url || t.lazy || '', title: t.title })).filter(t => t.url);
    store.set('webTabs:' + w.app, { tabs, cur: Math.max(0, tabs.findIndex(t => t.url === (w.cur && (w.cur.url || w.cur.lazy)))) });
  }, 400);

  /* drawing */
  let drawQ = 0;
  const draw = () => { if (!drawQ) drawQ = requestAnimationFrame(() => { drawQ = 0; drawNow(); }); };
  function drawNow() {
    list.innerHTML = w.tabs.map(t => {
      const lead = t.loading ? '<i class="wt-spin"></i>' : t.fav ? `<img src="${esc(t.fav)}" alt="">` : icon(t.home ? 'home' : 'globe');
      const snd = t.audible || t.muted ? `<button class="wt-a" data-ta="${t.id}" aria-label="${t.muted ? 'Unmute' : 'Mute'} tab" title="${t.muted ? 'Unmute' : 'Mute'}">${icon(t.muted ? 'mute' : 'vol')}</button>` : '';
      return `<div class="wt${t === w.cur ? ' on' : ''}" role="tab" aria-selected="${t === w.cur}" data-t="${t.id}" title="${esc(t.title || '')}">${lead}<span>${esc(t.title || hostOf(t.url || t.lazy || '') || 'New tab')}</span>${snd}<button class="wt-x" data-tx="${t.id}" aria-label="Close tab" title="Close tab (Ctrl+W)">${icon('x')}</button></div>`;
    }).join('');
    $$('img', list).forEach(i => { i.onerror = () => i.replaceWith(el(icon('globe'))); });
    const t = w.cur; if (!t) return;
    w.setTitle(t.title || name);
    const v = view(t);
    btn('back').disabled = !(v && v.canGoBack());
    btn('fwd').disabled = !(v && v.canGoForward());
    btn('reload').innerHTML = icon(t.loading ? 'x' : 'reload');
    btn('reload').setAttribute('aria-label', t.loading ? 'Stop' : 'Reload');
    prog.classList.toggle('on', !!t.loading);
    if (document.activeElement !== inp) inp.value = t.home ? '' : (t.url || t.lazy || '').replace(/^https:\/\/(www\.)?/i, '');
    inp.placeholder = `Search ${engine().name} or type an address`;
    const u = t.url || '', secure = /^https:/i.test(u), local = /^http:\/\/(localhost|127\.|\[::1\])/i.test(u);
    const ic = $('.wa-ic', B); ic.innerHTML = icon(t.home || !u ? 'search' : secure ? 'lock' : 'globe');
    ic.className = 'wa-ic' + (u && !secure && !local ? ' warn' : '');
    ic.title = t.home || !u ? '' : secure ? 'Secure connection' : local ? 'Your computer' : 'Not secure: this page is not encrypted';
    const z = zooms[hostOf(u)] || 1;
    zoomEl.hidden = z === 1 || !u; zoomEl.textContent = Math.round(z * 100) + '%';
    star.hidden = !u; star.classList.toggle('on', !!siteFor(u));
    btn('dl').hidden = !dls.size;
  }

  /* tabs */
  function blank(at) {
    const t = { id: ++seq, url: '', title: '', fav: '', loading: false, view: null, ready: false, home: false, pane: el('<div class="web-pane"></div>') };
    stack.append(t.pane);
    w.tabs.splice(at == null ? w.tabs.length : clamp(at, 0, w.tabs.length), 0, t);
    return t;
  }
  function open(url, { at, focus = true } = {}) {
    const t = blank(at);
    if (url) go(t, url); else showHome(t);
    if (focus || !w.cur) select(t); else draw();
    save(); return t;
  }
  function select(t) {
    if (!t) return;
    w.cur = t;
    w.tabs.forEach(x => x.pane.classList.toggle('on', x === t));
    if (t.lazy) { const u = t.lazy; t.lazy = null; go(t, u); }
    hideFind(); hideSug(); drawNow(); save();
    if (t.home) setTimeout(() => { const i = $('.wh-search input', t.pane); i && i.focus(); }, 30);
    else if (t.view) setTimeout(() => { if (w.cur === t && document.activeElement !== inp) t.view.focus(); }, 30);
  }
  function close(t) {
    const i = idx(t); if (i < 0) return;
    if (t.url) { closed.push({ app: w.app, url: t.url }); if (closed.length > 25) closed.shift(); }
    if (w.tabs.length === 1) { w.tabs = []; w.cur = null; store.set('webTabs:' + w.app, { tabs: [], cur: 0 }); w.gone = true; WM.close(w.id); return; }
    w.tabs.splice(i, 1); t.pane.remove();
    if (t === w.cur) select(w.tabs[Math.min(i, w.tabs.length - 1)]); else draw();
    save();
  }
  function reopen() { for (let i = closed.length - 1; i >= 0; i--) if (closed[i].app === w.app) { const c = closed.splice(i, 1)[0]; return open(c.url, { at: idx(w.cur) + 1 }); } }
  w.addTab = (url, focus = true) => open(url, { at: idx(w.cur) + 1, focus });

  /* navigation */
  function go(t, u) {
    const full = fixUrl(u); if (!full) return showHome(t);
    t.home = false; t.url = full; t.err = null; t.title = t.title || hostOf(full);
    $$('.web-home,.web-err', t.pane).forEach(x => x.remove());
    if (t.view) t.view.src = full; else makeView(t, full);
    draw();
  }
  function makeView(t, src) {
    const v = document.createElement('webview');
    v.className = 'web-view'; v.setAttribute('partition', 'persist:prism'); v.setAttribute('allowpopups', ''); v.setAttribute('src', src);
    t.view = v; t.ready = false; t.pane.prepend(v);
    const on = (ev, f) => v.addEventListener(ev, e => { try { f(e); } catch (err) { console.error(err); } });
    on('dom-ready', () => { t.ready = true; applyZoom(t); if (t.muted) v.setAudioMuted(true); draw(); });
    on('did-start-loading', () => { t.loading = true; $$('.web-err', t.pane).forEach(x => x.remove()); draw(); });
    on('did-stop-loading', () => { t.loading = false; draw(); save(); });
    on('did-navigate', e => { t.url = e.url; t.fav = ''; addHist(e.url, '', favs[hostOf(e.url)]); applyZoom(t); draw(); save(); });
    on('did-navigate-in-page', e => { if (!e.isMainFrame) return; t.url = e.url; addHist(e.url, t.title, t.fav); draw(); save(); });
    on('page-title-updated', e => { t.title = e.title; patchHist(t.url, { title: e.title }); draw(); save(); });
    on('page-favicon-updated', e => {
      t.fav = (e.favicons || []).find(f => /^https?:/i.test(f)) || '';
      if (t.fav) { favs[hostOf(t.url)] = t.fav; saveFavs(); patchHist(t.url, { fav: t.fav }); }
      draw();
    });
    on('did-fail-load', e => { if (e.isMainFrame && e.errorCode !== -3) showErr(t, e); });
    on('render-process-gone', () => showErr(t, { errorCode: 0, errorDescription: 'This page stopped working.', validatedURL: t.url }));
    on('media-started-playing', () => { t.audible = true; draw(); });
    on('media-paused', () => { t.audible = false; draw(); });
    on('enter-html-full-screen', () => { w.node.classList.add('web-full'); $('#os').classList.add('web-full-on'); N.app('full-on'); });
    on('leave-html-full-screen', () => { w.node.classList.remove('web-full'); $('#os').classList.remove('web-full-on'); N.app('full-off'); });
    on('found-in-page', e => { const r = e.result; findN.textContent = r.matches ? `${r.activeMatchOrdinal} of ${r.matches}` : 'No matches'; });
    on('context-menu', e => ctxMenu(t, e.params));
  }
  function showErr(t, e) {
    t.loading = false; t.err = e;
    $$('.web-err', t.pane).forEach(x => x.remove());
    const why = ERRS[String(e.errorCode)] || e.errorDescription || 'Something went wrong.';
    const node = el(`<div class="web-err"><div class="we-in">${icon('globe')}<h2>Can't open this page</h2><p><b>${esc(hostOf(e.validatedURL || t.url) || 'This page')}</b></p><p>${esc(why)}</p><button class="btn pri" data-retry>Try again</button></div></div>`);
    $('[data-retry]', node).addEventListener('click', () => { node.remove(); const v = view(t); if (v) v.reload(); else go(t, t.url); });
    t.pane.append(node); draw();
  }
  function topSites() {
    const by = new Map();
    for (const h of hist) { const k = hostOf(h.url); if (!k) continue; const o = by.get(k) || { host: k, url: new URL(h.url).origin, n: 0 }; o.n += h.n || 1; by.set(k, o); }
    const out = [...by.values()].sort((a, b) => b.n - a.n).slice(0, 8);
    const pad = [['github.com', 'https://github.com'], ['stackoverflow.com', 'https://stackoverflow.com'], ['developer.mozilla.org', 'https://developer.mozilla.org'], ['npmjs.com', 'https://www.npmjs.com'],
      ['leetcode.com', 'https://leetcode.com'], ['youtube.com', 'https://www.youtube.com'], ['localhost:3000', 'http://localhost:3000'], ['news.ycombinator.com', 'https://news.ycombinator.com']];
    for (const [h, u] of pad) { if (out.length >= 8) break; if (!out.some(o => o.host === h.split(':')[0] || o.host === h)) out.push({ host: h, url: u }); }
    return out;
  }
  function showHome(t) {
    t.home = true; t.url = ''; t.title = 'New tab'; t.fav = ''; t.loading = false;
    if (t.view) { t.view.remove(); t.view = null; t.ready = false; }
    $$('.web-home,.web-err', t.pane).forEach(x => x.remove());
    const NAMES = { 'github.com': 'GitHub', 'stackoverflow.com': 'Stack Overflow', 'developer.mozilla.org': 'MDN', 'npmjs.com': 'npm', 'leetcode.com': 'LeetCode', 'youtube.com': 'YouTube', 'news.ycombinator.com': 'Hacker News', 'localhost:3000': 'localhost:3000' };
    const label = h => NAMES[h] || (h.split('.').slice(-2, -1)[0] || h).replace(/^./, c => c.toUpperCase());
    const tiles = topSites().map(s => { const f = favs[s.host]; return `<button class="wh-tile" data-go="${esc(s.url)}" title="${esc(s.url)}"><b style="${f ? '' : `background:hsl(${hue(s.host)} 62% 50%)`}">${f ? `<img src="${esc(f)}" alt="">` : esc(label(s.host)[0])}</b><span>${esc(label(s.host))}</span></button>`; }).join('');
    const recent = hist.slice(0, 6).map(h => `<button class="wh-row" data-go="${esc(h.url)}" title="${esc(h.url)}">${h.fav ? `<img src="${esc(h.fav)}" alt="">` : icon('globe')}<span>${esc(h.title || h.url)}</span><small>${esc(hostOf(h.url))} · ${ago(h.t)}</small></button>`).join('');
    const cur = store.get('engine') || 'duckduckgo';
    const node = el(`<div class="web-home"><div class="wh-in">
      <div class="wh-logo">${icon('prism')}<span>Where to?</span></div>
      <form class="wh-search"><span class="wh-ic">${icon('search')}</span><input aria-label="Search or type an address" placeholder="Search ${esc(engine().name)} or type an address" spellcheck="false" autocomplete="off">
        <select aria-label="Search engine">${Object.entries(ENGINES).map(([k, e]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select></form>
      <div class="wh-tiles">${tiles}</div>
      ${recent ? `<div class="wh-recent"><h3>Recent</h3>${recent}</div>` : ''}
    </div></div>`);
    $$('img', node).forEach(i => { i.onerror = () => i.remove(); });
    $('form', node).addEventListener('submit', e => { e.preventDefault(); const v = $('input', node).value.trim(); if (v) go(t, v); });
    $('select', node).addEventListener('change', e => { store.set('engine', e.target.value); $('input', node).placeholder = `Search ${engine().name} or type an address`; draw(); });
    node.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(t, b.dataset.go); });
    t.pane.append(node); draw();
  }

  /* zoom */
  function applyZoom(t) { const v = view(t); if (v) try { v.setZoomFactor(zooms[hostOf(t.url)] || 1); } catch {} }
  function zoom(d) {
    const t = w.cur, h = hostOf(t && t.url); if (!h) return;
    const z = zooms[h] || 1, i = LEVELS.reduce((b, x, j) => (Math.abs(x - z) < Math.abs(LEVELS[b] - z) ? j : b), 0);
    const nz = d === 0 ? 1 : LEVELS[clamp(i + d, 0, LEVELS.length - 1)];
    if (nz === 1) delete zooms[h]; else zooms[h] = nz;
    store.set('webZoom', zooms);
    for (const x of WM.wins.values()) (x.tabs || []).forEach(tb => { if (hostOf(tb.url) === h) x.applyZoom(tb); });
    draw();
  }
  w.applyZoom = applyZoom;

  /* find in page */
  function showFind() { if (!view(w.cur)) return; findEl.hidden = false; findIn.focus(); findIn.select(); if (findIn.value) find(); }
  function hideFind() { if (findEl.hidden) return; findEl.hidden = true; findN.textContent = ''; const v = view(w.cur); if (v) try { v.stopFindInPage('clearSelection'); } catch {} }
  function find(next, back) { const v = view(w.cur); if (!v) return; const q = findIn.value; if (!q) { findN.textContent = ''; v.stopFindInPage('clearSelection'); return; } v.findInPage(q, { findNext: !!next, forward: !back }); }
  findIn.addEventListener('input', () => find());
  findIn.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); find(true, e.shiftKey); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hideFind(); const v = view(w.cur); v && v.focus(); }
  });
  findEl.addEventListener('click', e => { const b = e.target.closest('[data-wf]'); if (!b) return; const k = b.dataset.wf; if (k === 'x') hideFind(); else find(true, k === 'prev'); });

  /* address bar and suggestions */
  let sugs = [], sugI = 0;
  function hideSug() { sugEl.hidden = true; sugs = []; }
  function suggest() {
    const raw = inp.value.trim(), q = raw.toLowerCase();
    if (!q) return hideSug();
    const first = isUrl(raw) ? { url: fixUrl(raw), t: raw, s: 'Go to address', ic: 'globe' } : { url: fixUrl(raw), t: raw, s: `Search ${engine().name}`, ic: 'search' };
    const tabs = [];
    for (const x of WM.wins.values()) (x.tabs || []).forEach(tb => { if (tb !== w.cur && tb.url && (tb.title + ' ' + tb.url).toLowerCase().includes(q)) tabs.push({ tab: tb, win: x, t: tb.title || tb.url, s: 'Switch to this tab', ic: 'layers' }); });
    const hs = hist.filter(h => (h.title + ' ' + h.url).toLowerCase().includes(q)).sort((a, b) => b.n - a.n || b.t - a.t).slice(0, 6).map(h => ({ url: h.url, t: h.title || h.url, s: h.url.replace(/^https?:\/\/(www\.)?/, ''), ic: 'history' }));
    sugs = [first, ...tabs.slice(0, 2), ...hs.filter(h => h.url !== first.url)]; sugI = 0;
    drawSug();
  }
  function drawSug() {
    sugEl.innerHTML = sugs.map((s, i) => `<button class="ws-row${i === sugI ? ' on' : ''}" data-si="${i}" role="option" tabindex="-1">${icon(s.ic)}<span>${esc(s.t)}</span><small>${esc(s.s)}</small></button>`).join('');
    sugEl.hidden = !sugs.length;
  }
  function pick(s) {
    hideSug(); inp.blur();
    if (s.tab) { WM.focus(s.win.id); s.win.selectTab(s.tab); return; }
    if (w.cur) go(w.cur, s.url); else open(s.url);
    setTimeout(() => w.cur && w.cur.view && w.cur.view.focus(), 50);
  }
  inp.addEventListener('input', suggest);
  inp.addEventListener('focus', () => { const t = w.cur; if (t && !t.home && t.url) inp.value = t.url; setTimeout(() => inp.select(), 0); });
  inp.addEventListener('blur', () => setTimeout(() => { hideSug(); draw(); }, 120));
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!sugs.length) return; e.preventDefault(); sugI = (sugI + (e.key === 'ArrowDown' ? 1 : -1) + sugs.length) % sugs.length; drawSug(); }
    else if (e.key === 'Enter') { e.preventDefault(); const v = inp.value.trim(); if (!v) return; pick(sugs.length ? sugs[sugI] : { url: fixUrl(v) }); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hideSug(); inp.value = w.cur && !w.cur.home ? w.cur.url : ''; inp.blur(); }
  });
  sugEl.addEventListener('pointerdown', e => { e.preventDefault(); const b = e.target.closest('[data-si]'); if (b) pick(sugs[+b.dataset.si]); });
  zoomEl.addEventListener('click', () => zoom(0));
  const focusAddr = () => { inp.focus(); inp.select(); };

  /* buttons and tab strip */
  strip.addEventListener('pointerdown', e => { if (e.target.closest('.wt,.wt-new')) e.stopPropagation(); });   // tabs are not a drag handle
  strip.addEventListener('click', e => {
    const x = e.target.closest('[data-tx]'), s = e.target.closest('[data-ta]'), tb = e.target.closest('[data-t]');
    const find = id => w.tabs.find(t => t.id === +id);
    if (x) return close(find(x.dataset.tx));
    if (s) { const t = find(s.dataset.ta); t.muted = !t.muted; const v = view(t); v && v.setAudioMuted(t.muted); return draw(); }
    if (tb) return select(find(tb.dataset.t));
    if (e.target.closest('.wt-new')) open('', { at: w.tabs.length });
  });
  strip.addEventListener('auxclick', e => { const tb = e.target.closest('[data-t]'); if (tb && e.button === 1) close(w.tabs.find(t => t.id === +tb.dataset.t)); });
  strip.addEventListener('dblclick', e => { if (e.target === strip || e.target === list) open('', { at: w.tabs.length }); });
  B.addEventListener('click', e => {
    const b = e.target.closest('[data-wb]'); if (!b) return;
    const k = b.dataset.wb, t = w.cur, v = view(t);
    if (k === 'back') v && v.canGoBack() && v.goBack();
    else if (k === 'fwd') v && v.canGoForward() && v.goForward();
    else if (k === 'reload') { if (t.loading && v) v.stop(); else if (v) v.reload(); else if (t.url) go(t, t.url); }
    else if (k === 'star') { const s = siteFor(t.url); if (s) WM.open(siteId(s)); else P.addSite(t.url); draw(); }
    else if (k === 'menu') menu(b);
    else if (k === 'dl') dlMenu(b);
  });
  w.selectTab = select;

  function menu(b) {
    const r = b.getBoundingClientRect(), cur = store.get('engine') || 'duckduckgo';
    P.menu(r.right - 250, r.bottom + 6, [
      { label: 'New tab', icon: 'plus', kbd: 'Ctrl T', run: () => open('', { at: w.tabs.length }) },
      { label: 'Reopen closed tab', icon: 'history', kbd: 'Ctrl Shift T', disabled: !closed.some(c => c.app === w.app), run: reopen },
      { sep: true },
      { label: 'Find in page', icon: 'search', kbd: 'Ctrl F', disabled: !view(w.cur), run: showFind },
      { label: 'Zoom in', icon: 'zoomin', kbd: 'Ctrl +', run: () => zoom(1) },
      { label: 'Zoom out', icon: 'zoomout', kbd: 'Ctrl −', run: () => zoom(-1) },
      { label: 'Actual size', icon: 'max', kbd: 'Ctrl 0', run: () => zoom(0) },
      { sep: true },
      ...Object.entries(ENGINES).map(([k, e]) => ({ label: `Search with ${e.name}`, icon: k === cur ? 'check' : '', run: () => { store.set('engine', k); draw(); } })),
      { sep: true },
      { label: 'Developer tools', icon: 'code', kbd: 'F12', disabled: !view(w.cur), run: () => view(w.cur).openDevTools() },
      { label: 'Clear browsing data…', icon: 'trash', danger: true, run: clearData },
    ]);
  }

  function ctxMenu(t, p) {
    const v = view(t); if (!v) return;
    const r = v.getBoundingClientRect(), it = [], sel = (p.selectionText || '').trim(), f = p.editFlags || {};
    const short = sel.length > 26 ? sel.slice(0, 26) + '…' : sel;
    if (p.linkURL && /^https?:/i.test(p.linkURL)) it.push(
      { label: 'Open link in new tab', icon: 'plus', run: () => open(p.linkURL, { at: idx(t) + 1, focus: false }) },
      { label: 'Copy link address', icon: 'copy', run: () => copy(p.linkURL, 'Link copied') },
      { label: 'Save link as file', icon: 'download', run: () => v.downloadURL(p.linkURL) }, { sep: true });
    if (p.mediaType === 'image' && /^https?:/i.test(p.srcURL || '')) it.push(
      { label: 'Open image in new tab', icon: 'plus', run: () => open(p.srcURL, { at: idx(t) + 1, focus: false }) },
      { label: 'Save image', icon: 'download', run: () => v.downloadURL(p.srcURL) },
      { label: 'Copy image address', icon: 'copy', run: () => copy(p.srcURL, 'Image address copied') }, { sep: true });
    if (p.isEditable) it.push(
      { label: 'Undo', kbd: 'Ctrl Z', disabled: !f.canUndo, run: () => v.undo() },
      { label: 'Redo', kbd: 'Ctrl Y', disabled: !f.canRedo, run: () => v.redo() }, { sep: true },
      { label: 'Cut', kbd: 'Ctrl X', disabled: !f.canCut, run: () => v.cut() },
      { label: 'Copy', icon: 'copy', kbd: 'Ctrl C', disabled: !f.canCopy, run: () => v.copy() },
      { label: 'Paste', icon: 'clipboard', kbd: 'Ctrl V', disabled: !f.canPaste, run: () => v.paste() },
      { label: 'Paste as plain text', kbd: 'Ctrl Shift V', disabled: !f.canPaste, run: () => v.pasteAndMatchStyle() },
      { label: 'Select all', kbd: 'Ctrl A', run: () => v.selectAll() }, { sep: true });
    else if (sel) it.push(
      { label: 'Copy', icon: 'copy', kbd: 'Ctrl C', run: () => v.copy() },
      { label: `Search ${engine().name} for “${short}”`, icon: 'search', run: () => open(engine().q + encodeURIComponent(sel), { at: idx(t) + 1 }) }, { sep: true });
    if (!it.length) it.push(
      { label: 'Back', icon: 'back', kbd: 'Alt ←', disabled: !v.canGoBack(), run: () => v.goBack() },
      { label: 'Forward', icon: 'fwd', kbd: 'Alt →', disabled: !v.canGoForward(), run: () => v.goForward() },
      { label: 'Reload', icon: 'reload', kbd: 'Ctrl R', run: () => v.reload() }, { sep: true },
      { label: 'Copy page address', icon: 'copy', run: () => copy(t.url, 'Address copied') },
      { label: siteFor(t.url) ? 'Open this site\'s app' : 'Add this site to the dock', icon: 'star', run: () => { const s = siteFor(t.url); if (s) WM.open(siteId(s)); else P.addSite(t.url); } },
      { label: 'Find in page', icon: 'search', kbd: 'Ctrl F', run: showFind }, { sep: true });
    it.push({ label: 'Inspect', icon: 'code', kbd: 'F12', run: () => v.inspectElement(Math.round(p.x), Math.round(p.y)) });
    P.menu(r.left + p.x, r.top + p.y, it);
  }

  /* keyboard: the same shortcuts as other browsers */
  w.webKey = k => {
    const t = w.cur, v = view(t), c = k.code;
    const did = f => { f(); return true; };
    if (k.ctrl && !k.alt) {
      if (c === 'KeyT') return did(() => (k.shift ? reopen() : open('', { at: w.tabs.length })));
      if (c === 'KeyW') return did(() => t && close(t));
      if (c === 'KeyL') return did(focusAddr);
      if (c === 'KeyR') return did(() => { if (v) k.shift ? v.reloadIgnoringCache() : v.reload(); });
      if (c === 'KeyF') return did(showFind);
      if (c === 'Equal' || c === 'NumpadAdd') return did(() => zoom(1));
      if (c === 'Minus' || c === 'NumpadSubtract') return did(() => zoom(-1));
      if (c === 'Digit0' || c === 'Numpad0') return did(() => zoom(0));
      if (c === 'Tab' || c === 'PageDown' || c === 'PageUp') return did(() => { const d = c === 'PageUp' || (c === 'Tab' && k.shift) ? -1 : 1; select(w.tabs[(idx(t) + d + w.tabs.length) % w.tabs.length]); });
      if (/^Digit[1-9]$/.test(c)) return did(() => { const n = +c.slice(5); select(n === 9 ? w.tabs[w.tabs.length - 1] : w.tabs[n - 1]); });
      return false;
    }
    if (!k.ctrl && !k.alt) {
      if (c === 'F5') return did(() => v && v.reload());
      if (c === 'F6') return did(focusAddr);
      if (c === 'F12') return did(() => v && (v.isDevToolsOpened() ? v.closeDevTools() : v.openDevTools()));
      return false;
    }
    if (k.alt && !k.ctrl && v && (c === 'ArrowLeft' || c === 'ArrowRight')) return did(() => (c === 'ArrowLeft' ? v.canGoBack() && v.goBack() : v.canGoForward() && v.goForward()));
    return false;
  };

  /* first tabs: restore the last session, then the address asked for */
  const saved = store.get('webTabs:' + w.app);
  if (saved && saved.tabs && saved.tabs.length) {
    saved.tabs.forEach(s => { const t = blank(); t.lazy = s.url; t.title = s.title; t.fav = favs[hostOf(s.url)] || ''; });
    if (a.url) open(a.url); else select(w.tabs[clamp(saved.cur | 0, 0, w.tabs.length - 1)]);
  } else open(a.url || home);
}

const webApp = (name, home, extra = {}) => Object.assign({
  name, icon: 'globe', g: ['#6ad1ff', '#2f6fed'], w: 1180, h: 760, web: true,
  args(w, a) { if (a.url) w.addTab(a.url); },
  mount(w, a) { mount(w, a, name, home); },
  unmount(w) { if (w.node.classList.contains('web-full')) { $('#os').classList.remove('web-full-on'); N.app('full-off'); } },
}, extra);

P.apps.browser = webApp('Browser', '');
const addSiteApp = s => { const h = hue(s.name); P.apps[siteId(s)] = webApp(s.name, s.url, { glyph: s.name[0].toUpperCase(), g: [`hsl(${h} 70% 55%)`, `hsl(${(h + 30) % 360} 65% 36%)`] }); };
sites.forEach(addSiteApp);
if (!store.get('nativePins')) {
  store.set('nativePins', 1);
  ['browser', ...sites.map(siteId)].forEach(id => { if (!P.pins.includes(id)) P.pins.push(id); });
  store.set('pins', P.pins);
}
P.addSite = async url => {
  if (typeof url !== 'string') url = await P.ask({ title: 'Add a website as an app', placeholder: 'example.com', ok: 'Add' });
  if (!url) return;
  let host; try { host = new URL(fixUrl(url)).hostname.replace(/^www\./, ''); } catch { return flash({ icon: 'x', text: 'That does not look like a web address.', tone: 'bad' }); }
  const name = host.split('.')[0].replace(/^./, c => c.toUpperCase()), s = { name, url: new URL(fixUrl(url)).origin };
  if (P.apps[siteId(s)]) return void WM.open(siteId(s));
  sites.push(s); store.set('sites', sites); addSiteApp(s); P.pin(siteId(s), true);
  flash({ icon: 'check', text: `${name} is now in the dock`, tone: 'ok' });
};

/* ---------- events from the desktop app ---------- */
const owner = id => {
  for (const w of WM.wins.values()) for (const t of w.tabs || []) { try { if (t.view && t.ready && t.view.getWebContentsId() === id) return { w, t }; } catch {} }
  return null;
};
// A page had keyboard focus: browser shortcuts act on its window, the rest go to PrismOS as if typed there.
N.web.on('web:key', k => {
  const o = owner(k.wc);
  if (o && k.type === 'keyDown' && o.w.webKey(k)) return;
  document.dispatchEvent(new KeyboardEvent(k.type === 'keyUp' ? 'keyup' : 'keydown', { key: k.key, code: k.code, ctrlKey: k.ctrl, altKey: k.alt, shiftKey: k.shift, bubbles: true, cancelable: true }));
});
P.keyHooks.push(e => {
  const w = WM.active();
  if (!w || !w.webKey || e.type !== 'keydown' || !e.isTrusted) return false;
  return w.webKey({ code: e.code, key: e.key, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, shift: e.shiftKey });
});
N.web.on('web:newtab', d => { const o = owner(d.wc); if (o) o.w.addTab(d.url, !d.bg); else WM.open('browser', { url: d.url }); });

const PERM = { media: 'use your camera and microphone', geolocation: 'know your location', notifications: 'show notifications', 'clipboard-read': 'read your clipboard', 'display-capture': 'see your screen', midi: 'use MIDI devices', 'idle-detection': 'know when you are away' };
let permQ = Promise.resolve();
N.web.on('web:perm', r => { permQ = permQ.then(async () => {
  const saved = store.get('webPerms', {}), key = r.origin + '|' + r.perm;
  if (key in saved) return N.web.permReply(r.id, saved[key], true);
  let what = PERM[r.perm] || r.perm;
  if (r.perm === 'media' && r.media.length === 1) what = r.media[0] === 'video' ? 'use your camera' : 'use your microphone';
  const ok = await P.confirm({ title: `${hostOf(r.origin) || 'A site'} wants to ${what}`, text: 'Your answer is remembered for this site. Clear browsing data to forget it.', ok: 'Allow' });
  saved[key] = ok; store.set('webPerms', saved);
  N.web.permReply(r.id, ok, true);
}); });

/* downloads: progress in the Island, finished files one click away */
const dls = new Map();
const fmt = b => (b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
const active = () => [...dls.values()].filter(d => d.state === 'start' || d.state === 'progress');
const pct = d => (d.total ? Math.round((d.got / d.total) * 100) : 0);
const dlAct = {
  prio: 2,
  compact: () => { const a = active(); return `${icon('download')}<span>${a.length > 1 ? `${a.length} downloads` : esc(a[0].name.slice(0, 22))}</span><span class="num">${a[0].total ? pct(a[0]) + '%' : fmt(a[0].got)}</span>`; },
  expanded: () => active().map(d => `<div class="isl-row"><div style="min-width:0"><small>Downloading</small><strong class="isl-big" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.name)}</strong><small>${fmt(d.got)}${d.total ? ' of ' + fmt(d.total) : ''}</small></div><div class="isl-btns"><button data-do="dl.cancel" data-k="${d.id}" aria-label="Cancel download">${icon('x')}</button></div></div><div class="isl-prog"><i style="width:${pct(d)}%"></i></div>`).join(''),
  on: { cancel: b => N.web.download(b.dataset.k, 'cancel') },
};
const dlSync = debounce(() => { if (active().length) P.island.set('dl', dlAct); else P.island.remove('dl'); for (const w of WM.wins.values()) if (w.webKey) { const b = $('[data-wb="dl"]', w.body); if (b) b.hidden = !dls.size; } }, 100);
N.web.on('web:dl', d => {
  dls.set(d.id, d);
  if (d.state === 'start') flash({ icon: 'download', text: `Downloading ${d.name}`, ms: 2200, force: true });
  else if (d.state === 'completed') flash({ icon: 'check', text: `Downloaded ${d.name}`, sub: 'Click to show it in its folder', tone: 'ok', ms: 6000, force: true, run: () => N.web.download(d.id, 'show') });
  else if (d.state === 'interrupted' || d.state === 'cancelled') flash({ icon: 'x', text: `${d.name} did not download`, tone: 'bad', ms: 3600 });
  dlSync();
});
function dlMenu(b) {
  const r = b.getBoundingClientRect(), list = [...dls.values()].reverse().slice(0, 8);
  P.menu(r.right - 280, r.bottom + 6, list.map(d => d.state === 'completed'
    ? { label: d.name, icon: 'check', kbd: 'Show', run: () => N.web.download(d.id, 'show') }
    : d.state === 'start' || d.state === 'progress' ? { label: `${d.name} · ${pct(d)}%`, icon: 'download', kbd: 'Cancel', run: () => N.web.download(d.id, 'cancel') }
    : { label: `${d.name} · failed`, icon: 'x', disabled: true }));
}

async function clearData() {
  const ok = await P.confirm({ title: 'Clear browsing data?', text: 'Signs you out of every site and removes history, cookies, cached files and site permissions. Your open tabs stay.', ok: 'Clear' });
  if (!ok) return;
  await N.web.clear();
  hist = []; store.set('webHist', []); store.set('webPerms', {});
  for (const k in favs) delete favs[k]; store.set('webFavs', {});
  flash({ icon: 'check', text: 'Browsing data cleared', tone: 'ok' });
}
const copy = (text, label) => { N.copy(text); flash({ icon: 'copy', text: label || 'Copied', ms: 1600 }); };

/* palette: open tabs and history */
P.palSources.push(() => {
  const out = [];
  for (const w of WM.wins.values()) (w.tabs || []).forEach(t => { if (t.url) out.push({ t: t.title || t.url, s: 'Open tab · ' + hostOf(t.url), ic: icon('layers'), run: () => { WM.focus(w.id); w.selectTab(t); } }); });
  hist.slice(0, 40).forEach(h => out.push({ t: h.title || h.url, s: 'History · ' + hostOf(h.url), ic: icon('history'), run: () => WM.open('browser', { url: h.url }) }));
  return out;
});
P.cmdExtra.push(() => [
  { t: 'New browser tab', ic: 'globe', run: () => { const w = WM.byApp('browser'); if (w) { WM.focus(w.id); w.addTab(''); } else WM.open('browser'); } },
  { t: 'Add a website as an app', ic: 'globe', run: () => P.addSite() },
]);
// Links inside PrismOS open in the Browser.
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="http"]'); if (a) { e.preventDefault(); WM.open('browser', { url: a.href }); } }, true);
})();
