/* PrismOS Arena: algorithm practice that adapts to you.
   It tracks every attempt, schedules reviews (missed problems come back tomorrow, solved ones after 3, 7, 21 and 60 days)
   and always recommends the most useful next problem: an overdue review first, otherwise your weakest topic. */
(() => {
'use strict';
const P = window.Prism, { $, $$, esc, icon, store, FS, WM, debounce } = P;
const flash = o => P.island.flash(o);
const PROBS = globalThis.PRISM_PROBLEMS.map(([id, title, topic, diff, fn, params, desc, h1, h2, ref, tests, cmp]) => ({ id, title, topic, diff, fn, params, desc, hints: [h1, h2], ref, tests, cmp: cmp || '' }));
const TOPICS = [...new Set(PROBS.map(p => p.topic))];
const DIFF = ['', 'Easy', 'Medium', 'Hard'], STATUS = { new: 'Not started', tried: 'Not solved yet', due: 'Due for review', solved: 'Solved' };
const DAY = 864e5, dayKey = d => d.toLocaleDateString('en-CA'), today = () => dayKey(new Date());

/* ---------- reusable code editor (same look as Studio) ---------- */
P.codeEditor = (host, { id = '', lang = 'js', onInput, onRun } = {}) => {
  host.innerHTML = `<div class="ed"><pre class="ed-hl" aria-hidden="true"></pre><div class="ed-ln" aria-hidden="true"></div><textarea class="ed-ta" ${id ? `id="${id}"` : ''} wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Code editor"></textarea></div>`;
  const ta = $('.ed-ta', host), hl = $('.ed-hl', host), ln = $('.ed-ln', host);
  const sync = () => { hl.scrollTop = ln.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; };
  const paint = () => {
    hl.innerHTML = P.hl(ta.value, lang) + '\n\n';
    const n = ta.value.split('\n').length;
    if (+ln.dataset.n !== n) { ln.dataset.n = n; ln.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n') + '\n\n'; }
    sync();
  };
  const ins = s => { if (!document.execCommand('insertText', false, s)) { ta.setRangeText(s, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); } };
  ta.addEventListener('input', () => { paint(); onInput && onInput(); });
  ta.addEventListener('scroll', sync);
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun && onRun(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Tab') { e.preventDefault(); ins('  '); }
    else if (e.key === 'Enter' && !e.shiftKey) {
      const before = ta.value.slice(0, ta.selectionStart), ind = before.slice(before.lastIndexOf('\n') + 1).match(/^[ \t]*/)[0];
      e.preventDefault(); ins('\n' + ind + (/[{[(]\s*$/.test(before) ? '  ' : ''));
    }
  });
  return { el: ta, get value() { return ta.value; }, set(v) { ta.value = v; ln.dataset.n = ''; paint(); ta.scrollTop = 0; sync(); }, focus: () => ta.focus() };
};

/* ---------- progress and scheduling ---------- */
const st = Object.assign({ p: {}, days: {}, daily: null, told: '' }, store.get('arena', {}));
const save = () => { store.set('arena', st); P.emit('arena'); };
const rec = id => (st.p[id] ||= { tries: 0, fails: 0, solved: 0, last: 0, due: 0, hinted: 0 });
const isSolved = p => !!(st.p[p.id] && st.p[p.id].solved);
const status = p => { const r = st.p[p.id]; if (!r || !r.tries) return 'new'; if (r.due <= Date.now()) return 'due'; return r.solved ? 'solved' : 'tried'; };
const mastery = topic => {
  const ps = PROBS.filter(p => p.topic === topic); let s = 0;
  for (const p of ps) { const r = st.p[p.id]; if (r && r.solved) s += Math.max(0.5, 1 - r.fails * 0.1) * (r.due <= Date.now() ? 0.7 : 1); }
  return s / ps.length;
};
function next() {
  const now = Date.now();
  const due = PROBS.filter(p => { const r = st.p[p.id]; return r && r.tries && r.due <= now; }).sort((a, b) => st.p[a.id].due - st.p[b.id].due);
  if (due.length) return { p: due[0], why: isSolved(due[0]) ? 'Due for review, so it sticks.' : 'You missed this one. Try it again.' };
  const open = TOPICS.filter(t => PROBS.some(p => p.topic === t && !isSolved(p) && !(st.p[p.id] && st.p[p.id].tries)));
  if (open.length) {
    const t = open.sort((a, b) => mastery(a) - mastery(b) || TOPICS.indexOf(a) - TOPICS.indexOf(b))[0];
    const p = PROBS.filter(x => x.topic === t && !isSolved(x) && !(st.p[x.id] && st.p[x.id].tries)).sort((a, b) => a.diff - b.diff)[0];
    return { p, why: Object.keys(st.p).length ? `${t} is your weakest topic (${Math.round(mastery(t) * 100)}%).` : 'A good place to start.' };
  }
  const soon = [...PROBS].sort((a, b) => rec(a.id).due - rec(b.id).due)[0];
  return { p: soon, why: 'Everything has been attempted. This is your next review.' };
}
function record(p, pass) {
  const r = rec(p.id); r.tries++; r.last = Date.now();
  if (pass) {
    r.solved++;
    const days = r.hinted >= 3 ? 1 : [3, 7, 21, 60][Math.min(r.solved - 1, 3)];
    r.due = Date.now() + days * DAY; r.hinted = 0;
    st.days[today()] = (st.days[today()] || 0) + 1;
  } else { r.fails++; r.due = Date.now() + DAY; }
  save();
}
const streak = () => {
  let n = 0; const d = new Date();
  if (!st.days[today()]) d.setDate(d.getDate() - 1);
  while (st.days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
};
const daily = () => {
  if (!st.daily || st.daily.date !== today() || !PROBS.some(p => p.id === st.daily.id)) { st.daily = { date: today(), id: next().p.id }; store.set('arena', st); }
  return PROBS.find(p => p.id === st.daily.id);
};
P.arena = { PROBS, TOPICS, daily, streak, next, mastery, solved: () => PROBS.filter(isSolved).length, doneToday: () => st.days[today()] || 0 };

/* ---------- test runner ---------- */
const NORM = {
  '': 'v => JSON.stringify(v)',
  set: 'v => { try { return JSON.stringify([...v].sort()); } catch (e) { return JSON.stringify(v); } }',
  set2: 'v => { try { return JSON.stringify(v.map(x => [...x].sort((a, b) => a - b)).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1))); } catch (e) { return JSON.stringify(v); } }',
};
const harness = (p, code) => [
  'const __T = ' + JSON.stringify(p.tests) + ';',
  'const __load = (src, name) => { try { return new Function(src + "\\n;return typeof " + name + " === \\"function\\" ? " + name + " : null;")(); } catch (e) { return { __err: e.name + ": " + e.message }; } };',
  'const __u = __load(' + JSON.stringify(code) + ', ' + JSON.stringify(p.fn) + ');',
  'const __r = __load(' + JSON.stringify(p.ref) + ', ' + JSON.stringify(p.fn) + ');',
  'const __n = ' + NORM[p.cmp] + ';',
  'const __c = v => JSON.parse(JSON.stringify(v));',
  'const __res = [];',
  'if (!__u || __u.__err) __res.push({ fatal: __u ? __u.__err : "Define a function named ' + p.fn + '." });',
  'else for (const a of __T) { const exp = __r(...__c(a)); let got, err = null; const t0 = performance.now(); try { got = __u(...__c(a)); } catch (e) { err = e.name + ": " + e.message; } __res.push({ ok: !err && __n(got) === __n(exp), got: err ? null : (got === undefined ? "undefined" : got), exp, err, ms: performance.now() - t0 }); }',
  'console.log("__ARENA__" + JSON.stringify(__res));',
].join('\n');
P.arena.harness = harness;

/* ---------- the app ---------- */
P.apps.arena = {
  name: 'Arena', icon: 'target', g: ['#ffb14a', '#e8452a'], w: 960, h: 620,
  args(w, a) { if (a.id) w.pick(a.id); },
  focus: w => { const t = $('.ed-ta', w.body); t && t.focus(); },
  mount(w, a) {
    w.body.innerHTML = `<div class="arena"><aside class="ar-side"></aside><section class="ar-main"><div class="ar-head"></div><div class="ar-desc prose"></div><div class="ar-ed"></div>
      <div class="ar-bar"><button class="btn pri" data-r="run" title="Run tests (Ctrl+Enter)">${icon('play')}Run tests</button><button class="btn" data-r="hint">Hint</button><button class="btn" data-r="reset">Reset code</button><button class="btn" data-r="vibe">${icon('sparkles')}Review with Vibe</button></div>
      <div class="ar-out" aria-live="polite"></div></section></div>`;
    const b = w.body, side = $('.ar-side', b), out = $('.ar-out', b), hintBtn = $('[data-r="hint"]', b);
    let cur = null, hintN = 0, busy = false;
    const file = p => `/home/arena/${p.id}.js`, starter = p => `function ${p.fn}(${p.params}) {\n  \n}\n`;
    const saveCode = () => { if (!cur) return; try { if (FS.files[file(cur)] !== ed.value) FS.write(file(cur), ed.value); } catch {} };
    const ed = P.codeEditor($('.ar-ed', b), { id: 'arena-editor', onRun: () => run(), onInput: debounce(saveCode, 700) });
    const drawSide = () => {
      const n = next(), top = side.scrollTop;
      side.innerHTML = `<div class="ar-next"><small>Next up</small><b>${esc(n.p.title)}</b><small>${esc(n.why)}</small><button class="btn pri sm" data-pid="${n.p.id}">${icon('play')}Solve</button></div>
        <div class="ar-stats"><div class="ar-stat"><b>${streak()}</b><small>day streak</small></div><div class="ar-stat"><b>${P.arena.solved()}/${PROBS.length}</b><small>solved</small></div></div>
        <div class="ar-h">Topic strength</div>${TOPICS.map(t => { const m = Math.round(mastery(t) * 100); return `<div class="ar-top"><span>${esc(t)}</span><i style="--p:${m}%"></i><small>${m}%</small></div>`; }).join('')}
        ${TOPICS.map(t => `<div class="ar-h">${esc(t)}</div>${PROBS.filter(p => p.topic === t).map(p => `<button class="ar-p${cur && cur.id === p.id ? ' on' : ''}" data-pid="${p.id}"><i class="ar-dot ${status(p)}" title="${STATUS[status(p)]}"></i><span>${esc(p.title)}</span><em class="tag d${p.diff}">${DIFF[p.diff]}</em></button>`).join('')}`).join('')}`;
      side.scrollTop = top;
    };
    const drawHead = () => {
      const r = st.p[cur.id], s = status(cur);
      $('.ar-head', b).innerHTML = `<h2>${esc(cur.title)}</h2><em class="tag d${cur.diff}">${DIFF[cur.diff]}</em><em class="tag">${esc(cur.topic)}</em><em class="tag">${STATUS[s]}${r && r.due > Date.now() ? ` · review in ${Math.max(1, Math.round((r.due - Date.now()) / DAY))} d` : ''}</em>`;
    };
    const setHint = () => { hintBtn.textContent = ['Hint', 'Bigger hint', 'Show solution', 'Solution shown'][hintN]; hintBtn.disabled = hintN > 2; };
    const pick = id => {
      saveCode();
      cur = PROBS.find(p => p.id === id) || PROBS[0]; hintN = 0; out.innerHTML = ''; setHint();
      drawHead(); $('.ar-desc', b).innerHTML = P.md(cur.desc);
      ed.set(FS.isFile(file(cur)) ? FS.files[file(cur)] : starter(cur));
      w.setTitle(`${cur.title} · Arena`); store.set('arena.cur', cur.id); drawSide();
    };
    w.pick = pick;
    const show = (p, res, logs) => {
      const logHTML = logs.length ? `<div class="ar-hint"><b>Console</b><pre>${esc(logs.slice(0, 40).join('\n'))}</pre></div>` : '';
      if (!res) { record(p, false); out.innerHTML = '<div class="ar-banner no">Time limit exceeded. The tests did not finish in 6 seconds, so look for an endless loop.</div>' + logHTML; }
      else if (res[0] && res[0].fatal) out.innerHTML = `<div class="ar-banner no">${esc(res[0].fatal)}</div>` + logHTML;
      else {
        const pass = res.every(r => r.ok), n = res.filter(r => r.ok).length;
        record(p, pass);
        const days = Math.max(1, Math.round((st.p[p.id].due - Date.now()) / DAY));
        out.innerHTML = `<div class="ar-banner ${pass ? 'ok' : 'no'}">${pass ? `${icon('check')}<span>All ${res.length} tests passed. It comes back for review in ${days} day${days === 1 ? '' : 's'}.</span><button class="btn sm" data-r="next">Next problem</button>` : `<span>${n} of ${res.length} tests passed. It comes back for review tomorrow.</span>`}</div>`
          + res.map((t, i) => (t.ok ? `<div class="ar-t ok">${icon('check')}<span>Test ${i + 1} passed</span></div>`
            : `<div class="ar-t no">${icon('x')}<pre>Test ${i + 1}\ninput:    ${esc(JSON.stringify(p.tests[i]).slice(1, -1))}\nexpected: ${esc(JSON.stringify(t.exp))}\n${t.err ? 'error:    ' + esc(t.err) : 'got:      ' + esc(JSON.stringify(t.got))}</pre></div>`)).join('') + logHTML;
        if (pass) flash({ icon: 'check', text: `${p.title} solved`, sub: `${streak()} day streak`, tone: 'ok' });
      }
      if (cur === p) drawHead();
      drawSide();
    };
    const run = () => {
      if (!cur || busy) return;
      busy = true; saveCode(); const p = cur, logs = []; let res = null;
      out.innerHTML = '<div class="ar-hint">Running tests…</div>';
      P.runJS(harness(p, ed.value), {
        out: (k, s) => { if (s.startsWith('__ARENA__')) { try { res = JSON.parse(s.slice(9)); } catch {} } else logs.push(s); },
        done: () => { busy = false; if (w.node.isConnected) show(p, res, logs); },
      });
    };
    const hint = () => {
      if (!cur || hintN > 2) return;
      const r = rec(cur.id); r.hinted = Math.max(r.hinted, hintN + 1); save();
      const body = hintN < 2 ? `<b>Hint ${hintN + 1}</b><p>${esc(cur.hints[hintN])}</p>`
        : `<b>Solution</b>${P.md('```js\n' + cur.ref + '\n```')}<p>Type it out yourself and run the tests. It will come back tomorrow so you can do it unaided.</p>`;
      out.insertAdjacentHTML('afterbegin', `<div class="ar-hint">${body}</div>`); out.scrollTop = 0;
      hintN++; setHint();
    };
    b.addEventListener('click', e => {
      const id = e.target.closest('[data-pid]'), r = e.target.closest('[data-r]');
      if (id) { pick(id.dataset.pid); ed.focus(); return; }
      if (!r) return;
      const k = r.dataset.r;
      if (k === 'run') run();
      else if (k === 'hint') hint();
      else if (k === 'reset') { ed.set(starter(cur)); saveCode(); out.innerHTML = ''; }
      else if (k === 'next') { pick(next().p.id); ed.focus(); }
      else if (k === 'vibe') P.askVibe(`Review my solution to this problem. Do not rewrite it for me. Tell me whether it is correct, its time and space complexity, and one thing to improve.\n\nProblem: ${cur.title}\n${cur.desc}\n\nMy code:\n\`\`\`js\n${ed.value}\n\`\`\``);
    });
    w.clean.push(saveCode);
    const first = a.id || store.get('arena.cur', null);
    pick(PROBS.some(p => p.id === first) ? first : daily().id);
  },
};

/* ---------- Island, palette, daily nudge ---------- */
P.idleInfo.push(() => { const s = streak(); return s ? `<i class="isl-sep"></i>${icon('flame')}<span>${s}</span>` : ''; });
P.on('arena', () => P.island.render());
P.palSources.push(() => PROBS.map(p => ({ t: p.title, s: `Arena · ${p.topic}`, ic: icon('target'), run: () => WM.open('arena', { id: p.id }) })));
P.cmdExtra.push(() => [{ t: "Solve today's problem", ic: 'target', run: () => WM.open('arena', { id: daily().id }) }]);
P.on('ready', () => {
  if (st.told === today()) return;
  setTimeout(() => {
    const p = daily(); st.told = today(); store.set('arena', st);
    flash({ icon: 'target', text: `Today's problem: ${p.title}`, sub: 'Click to solve', ms: 6000, run: () => WM.open('arena', { id: p.id }) });
  }, 6500);
});
})();
