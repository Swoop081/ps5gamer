'use strict';
/* ---------- storage ---------- */
const KEY = 'ps5g.v1', IMG = 'ps5g.img.';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { games: [] }; } catch (e) { return { games: [] }; } };
let db = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Storage full - export a backup'); } };
const getImg = (id, side) => localStorage.getItem(IMG + id + '.' + side) || '';
const setImg = (id, side, v) => { try { v ? localStorage.setItem(IMG + id + '.' + side, v) : localStorage.removeItem(IMG + id + '.' + side); } catch (e) { toast('Image too big for storage'); } };
const game = id => db.games.find(g => g.id === id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const app = $('#app');
let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2200); }
const STATUS = { playing: 'Playing', backlog: 'Backlog', finished: 'Finished' };
const hue = t => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const fallbackBg = t => `background:linear-gradient(145deg,hsl(${hue(t)},70%,38%),hsl(${(hue(t) + 50) % 360},70%,18%))`;
const coverUrl = (g, side) => getImg(g.id, side) || (side === 'f' ? g.frontUrl : g.backUrl) || '';
const progress = async g => { const gd = await getGuide(g.guide); if (!gd) return null; const n = gd.chapters.length; const d = gd.chapters.filter(c => g.done && g.done[c.id]).length; return { n, d, pct: n ? Math.round(d / n * 100) : 0 }; };

function resizeImage(file, max = 800) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.82)); }; im.src = r.result; };
    r.readAsDataURL(file);
  });
}

/* ---------- tiny markdown ---------- */
function inline(s) {
  return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|[\w./#-])[^)\s]*)\)/g, (m, t, u) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`);
}
function md(src) {
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of src.split('\n')) {
    const l = raw.trimEnd(); let m;
    if (!l.trim()) { close(); continue; }
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { close(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^\s*\d+\.\s+(.*)/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = l.match(/^>\s?(.*)/))) { close(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); }
    else { close(); out.push(`<p>${inline(l)}</p>`); }
  }
  close(); return out.join('');
}

/* ---------- guides from repo ---------- */
const cache = {};
async function fetchCached(url, json) {
  if (cache[url] !== undefined) return cache[url];
  try { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw 0; cache[url] = json ? await r.json() : await r.text(); }
  catch (e) { cache[url] = null; }
  return cache[url];
}
const guideIndex = async () => (await fetchCached('guides/index.json', true)) || [];
const getGuide = async s => s ? fetchCached(`guides/${s}/guide.json`, true) : null;

/* ---------- 3D case ---------- */
function caseHTML(g) {
  const f = coverUrl(g, 'f'), b = coverUrl(g, 'b') || f;
  const face = (u) => u ? `background-image:url('${esc(u)}')` : fallbackBg(g.title);
  const sp = `background:hsl(${hue(g.title)},65%,24%)`;
  return `<div class="views"><button class="chip" data-v="0">Front</button><button class="chip" data-v="90">Spine</button><button class="chip" data-v="180">Back</button></div>
  <div class="stage" id="stage"><div class="case" id="case">
    <div class="face f-front fallback" style="${face(f)}">${f ? '' : esc(g.title)}</div>
    <div class="face f-back fallback" style="${b ? face(b) : fallbackBg(g.title)}">${b ? '' : 'Back cover'}</div>
    <div class="face f-left" style="${sp};display:flex;align-items:center;justify-content:center"><span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;max-height:230px">${esc(g.title)}</span></div>
    <div class="face f-right" style="${sp}"></div><div class="face f-top" style="${sp}"></div><div class="face f-bot" style="${sp}"></div>
  </div></div><div class="hint">Drag to spin the case</div>`;
}
function wire3D() {
  const el = $('#case'), st = $('#stage'); if (!el) return;
  let ry = -28, rx = -8, down = false, lx = 0, target = null;
  const apply = () => el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  apply();
  st.addEventListener('pointerdown', e => { down = true; lx = e.clientX; target = null; st.setPointerCapture(e.pointerId); });
  st.addEventListener('pointermove', e => { if (!down) return; ry += (e.clientX - lx) * 0.7; lx = e.clientX; apply(); });
  const up = () => down = false; st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {
    const want = +b.dataset.v; let cur = ((ry % 360) + 360) % 360; let diff = want - cur; if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
    target = ry + diff; rx = -6;
    const step = () => { if (target === null) return; const d = target - ry; if (Math.abs(d) < 0.5) { ry = target; target = null; apply(); return; } ry += d * 0.15; apply(); requestAnimationFrame(step); };
    step();
  });
}

/* ---------- views ---------- */
let filter = 'all';
async function viewHome() {
  const list = db.games.filter(g => filter === 'all' || g.status === filter).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const chips = ['all', 'playing', 'backlog', 'finished'].map(s => `<button class="chip ${filter === s ? 'on' : ''}" data-f="${s}">${s === 'all' ? 'All' : STATUS[s]}</button>`).join('');
  const cards = await Promise.all(list.map(async g => {
    const f = coverUrl(g, 'f'); const p = await progress(g);
    return `<a class="gcard" href="#/game/${g.id}"><div class="img fallback" style="${f ? `background-image:url('${esc(f)}')` : fallbackBg(g.title)}">${f ? '' : esc(g.title)}<span class="badge">${STATUS[g.status]}</span></div>
    <div class="meta"><div class="t">${esc(g.title)}</div><div class="s">${g.rating ? '★'.repeat(g.rating) : (g.hours ? g.hours + ' hrs' : '&nbsp;')}</div>${p ? `<div class="bar"><i style="width:${p.pct}%"></i></div>` : ''}</div></a>`;
  }));
  app.innerHTML = `<div class="chips">${chips}</div>` + (list.length ? `<div class="grid">${cards.join('')}</div>` : `<div class="empty">No games here yet.<br>Tap + to add your first one.</div>`);
  app.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filter = b.dataset.f; viewHome(); });
}

async function viewGame(id) {
  const g = game(id); if (!g) return location.hash = '#/';
  const gd = await getGuide(g.guide); const p = await progress(g);
  const stars = [1, 2, 3, 4, 5].map(n => `<span data-s="${n}" class="${(g.rating || 0) >= n ? 'on' : ''}">★</span>`).join('');
  app.innerHTML = `<h1>${esc(g.title)}</h1>${caseHTML(g)}
  <div class="row" style="margin-top:10px">${Object.keys(STATUS).map(s => `<button class="btn sm ${g.status === s ? '' : 'alt'}" data-st="${s}">${STATUS[s]}</button>`).join('')}</div>
  <div class="panel"><h2 style="margin-top:0">Review</h2>
    ${g.status === 'finished' ? '' : '<div class="stat" style="margin-bottom:8px">You can review any time, or mark it Finished first.</div>'}
    <div class="stars" id="stars">${stars}</div>
    <label>Hours played</label><input id="hrs" type="number" inputmode="decimal" min="0" value="${esc(g.hours || '')}">
    <label>Your thoughts</label><textarea id="rev" placeholder="Story, gameplay, would you recommend it?">${esc(g.review || '')}</textarea>
    <div class="row" style="margin-top:12px"><button class="btn" id="saveRev">Save review</button></div></div>
  <div class="panel"><h2 style="margin-top:0">Guide ${p ? `<span class="stat">· ${p.d}/${p.n} chapters (${p.pct}%)</span>` : ''}</h2>
    ${gd ? `<div class="bar" style="margin:0 0 6px"><i style="width:${p.pct}%"></i></div>` + gd.chapters.map(c => { const d = g.done && g.done[c.id]; return `<div class="chap ${d ? 'done' : ''}"><div class="chk ${d ? 'on' : ''}" data-c="${esc(c.id)}">✓</div><a href="#/game/${g.id}/ch/${esc(c.id)}">${esc(c.title)}</a></div>`; }).join('')
      : `<div class="stat">${g.guide ? 'Guide not found in the repo.' : 'No guide linked. Edit the game to pick one (guides live in the ps5gamer repo).'}</div>`}
    ${g.guide ? `<div class="row" style="margin-top:12px"><a class="btn alt" style="text-align:center;text-decoration:none" href="#/game/${g.id}/tips">Hints, tips &amp; cheats</a></div>` : ''}</div>
  <div class="row"><a class="btn alt" style="text-align:center;text-decoration:none" href="#/edit/${g.id}">Edit game</a><button class="btn danger" id="del">Delete</button></div>`;
  wire3D();
  app.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { g.status = b.dataset.st; if (g.status === 'finished' && !g.finished) g.finished = new Date().toISOString().slice(0, 10); g.updated = Date.now(); save(); viewGame(id); });
  app.querySelectorAll('#stars span').forEach(s => s.onclick = () => { g.rating = g.rating === +s.dataset.s ? 0 : +s.dataset.s; app.querySelectorAll('#stars span').forEach(x => x.classList.toggle('on', (g.rating || 0) >= +x.dataset.s)); save(); });
  $('#saveRev').onclick = () => { g.review = $('#rev').value; g.hours = $('#hrs').value; g.updated = Date.now(); save(); toast('Review saved'); };
  app.querySelectorAll('[data-c]').forEach(c => c.onclick = () => { g.done = g.done || {}; g.done[c.dataset.c] = !g.done[c.dataset.c]; save(); viewGame(id); });
  $('#del').onclick = () => { if (confirm('Delete this game?')) { setImg(id, 'f'); setImg(id, 'b'); db.games = db.games.filter(x => x.id !== id); save(); location.hash = '#/'; } };
}

async function viewChapter(id, cid) {
  const g = game(id), gd = g && await getGuide(g.guide); if (!gd) return location.hash = '#/game/' + id;
  const i = gd.chapters.findIndex(c => c.id === cid); const c = gd.chapters[i]; if (!c) return location.hash = '#/game/' + id;
  const text = await fetchCached(`guides/${g.guide}/${c.file}`, false);
  const done = g.done && g.done[cid];
  const prev = gd.chapters[i - 1], next = gd.chapters[i + 1];
  app.innerHTML = `<a href="#/game/${id}" class="stat">← ${esc(g.title)}</a><h1>${esc(c.title)}</h1>
  <div class="md">${text ? md(text) : '<p class="stat">Chapter file not found in the repo yet.</p>'}</div>
  <div class="row" style="margin-top:20px"><button class="btn ${done ? 'alt' : 'ok'}" id="mark">${done ? 'Completed ✓ (tap to undo)' : 'Mark chapter complete'}</button></div>
  <div class="row" style="margin-top:10px">${prev ? `<a class="btn alt" style="text-align:center;text-decoration:none" href="#/game/${id}/ch/${esc(prev.id)}">← Prev</a>` : '<span></span>'}${next ? `<a class="btn alt" style="text-align:center;text-decoration:none" href="#/game/${id}/ch/${esc(next.id)}">Next →</a>` : '<span></span>'}</div>`;
  $('#mark').onclick = () => { g.done = g.done || {}; g.done[cid] = !done; save(); if (!done && next) location.hash = `#/game/${id}/ch/${next.id}`; else viewChapter(id, cid); };
  window.scrollTo(0, 0);
}

async function viewTips(id) {
  let title = 'General tips', url = 'tips/general.md', back = '#/';
  if (id) { const g = game(id); if (!g) return location.hash = '#/'; title = g.title + ' · tips & cheats'; url = `guides/${g.guide}/tips.md`; back = '#/game/' + id; }
  const text = await fetchCached(url, false);
  app.innerHTML = `<a href="${back}" class="stat">← Back</a><h1>${esc(title)}</h1><div class="md">${text ? md(text) : '<p class="stat">Nothing here yet. Add a tips.md to the repo.</p>'}</div>`;
  if (!id) { const idx = await guideIndex(); const extra = idx.map(x => `<a class="chip" href="guides/${esc(x.slug)}/tips.md" target="_blank">${esc(x.title)}</a>`).join(' '); if (extra) app.innerHTML += `<h2>Per-game tips</h2><div class="stat">Open a game from your library to read its tips in-app.</div>`; }
}

async function viewForm(id) {
  const g = id ? game(id) : { title: '', status: 'playing', guide: '', frontUrl: '', backUrl: '' };
  if (id && !g) return location.hash = '#/';
  const idx = await guideIndex(); const pend = { f: undefined, b: undefined };
  const pv = (s) => { const u = pend[s] !== undefined ? pend[s] : (id ? coverUrl(g, s) : ''); return u ? `background-image:url('${esc(u)}')` : ''; };
  app.innerHTML = `<h1>${id ? 'Edit game' : 'Add game'}</h1>
  <label>Title</label><input id="t" value="${esc(g.title)}" list="gl" placeholder="e.g. God of War Ragnarök" autocomplete="off">
  <datalist id="gl">${idx.map(x => `<option value="${esc(x.title)}">`).join('')}</datalist>
  <label>Status</label><select id="st">${Object.keys(STATUS).map(s => `<option value="${s}" ${g.status === s ? 'selected' : ''}>${STATUS[s]}</option>`).join('')}</select>
  <label>Guide from repo</label><select id="gd"><option value="">None</option>${idx.map(x => `<option value="${esc(x.slug)}" ${g.guide === x.slug ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select>
  <div class="panel"><label style="margin-top:0">Front cover</label><span class="preview" id="pf" style="${pv('f')}"></span>
    <input type="file" accept="image/*" id="ff"><a class="stat" id="findf" href="#" target="_blank" rel="noopener">Find front cover images ↗</a><input id="fu" placeholder="…or paste an image URL" value="${esc(g.frontUrl || '')}"></div>
  <div class="panel"><label style="margin-top:0">Back cover</label><span class="preview" id="pb" style="${pv('b')}"></span>
    <input type="file" accept="image/*" id="bf"><a class="stat" id="findb" href="#" target="_blank" rel="noopener">Find back cover images ↗</a><input id="bu" placeholder="…or paste an image URL" value="${esc(g.backUrl || '')}"></div>
  <div class="stat">Tip: use the Find links, long-press an image, Save to Photos, then pick it here. Or paste an image URL.</div>
  <div class="row" style="margin-top:16px"><button class="btn" id="go">${id ? 'Save' : 'Add to library'}</button></div>`;
  const pick = (inp, side, prev) => $(inp).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { pend[side] = await resizeImage(f); $(prev).style.backgroundImage = `url('${pend[side]}')`; } catch (x) { toast('Could not read image'); } };
  const q = side => 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent($('#t').value.trim() + ' PS5 ' + side + ' cover');
  $('#findf').onclick = e => { $('#findf').href = q('front'); }; $('#findb').onclick = e => { $('#findb').href = q('back'); };
  pick('#ff', 'f', '#pf'); pick('#bf', 'b', '#pb');
  $('#t').onchange = () => { const m = idx.find(x => x.title.toLowerCase() === $('#t').value.trim().toLowerCase()); if (m && !$('#gd').value) $('#gd').value = m.slug; };
  $('#go').onclick = () => {
    const title = $('#t').value.trim(); if (!title) return toast('Enter a title');
    const o = g; o.title = title; o.status = $('#st').value; o.guide = $('#gd').value; o.frontUrl = $('#fu').value.trim(); o.backUrl = $('#bu').value.trim(); o.updated = Date.now();
    if (!id) { o.id = uid(); o.added = new Date().toISOString().slice(0, 10); o.done = {}; db.games.push(o); }
    if (o.status === 'finished' && !o.finished) o.finished = new Date().toISOString().slice(0, 10);
    if (pend.f) setImg(o.id, 'f', pend.f); if (pend.b) setImg(o.id, 'b', pend.b);
    save(); location.hash = '#/game/' + o.id;
  };
}

function viewSettings() {
  const total = db.games.length, fin = db.games.filter(g => g.status === 'finished').length, play = db.games.filter(g => g.status === 'playing').length;
  app.innerHTML = `<h1>Backup</h1><div class="panel"><div>${total} games · ${play} playing · ${fin} finished</div></div>
  <div class="panel"><div class="stat" style="margin-bottom:10px">Your data lives only on this phone. Export a backup now and then (saves to Files), and import it if you ever switch phones or clear Safari data.</div>
  <div class="row"><button class="btn" id="exp">Export backup</button></div>
  <label>Import backup</label><input type="file" accept="application/json" id="imp"></div>`;
  $('#exp').onclick = () => {
    const dump = { v: 1, db, imgs: {} }; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(IMG)) dump.imgs[k] = localStorage.getItem(k); }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(dump)], { type: 'application/json' })); a.download = `ps5gamer-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  $('#imp').onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.db || !Array.isArray(d.db.games)) throw 0; if (!confirm('Replace everything on this phone with the backup?')) return; db = d.db; save(); Object.entries(d.imgs || {}).forEach(([k, v]) => { if (k.startsWith(IMG)) try { localStorage.setItem(k, v); } catch (x) {} }); toast('Imported'); location.hash = '#/'; } catch (x) { toast('Not a valid backup'); } };
}

/* ---------- router ---------- */
async function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/'); const [a, b, c, d] = h;
  document.querySelectorAll('nav a').forEach(n => n.classList.toggle('on', n.dataset.r === (a || 'home')));
  if (!a) return viewHome();
  if (a === 'game' && c === 'ch') return viewChapter(b, d);
  if (a === 'game' && c === 'tips') return viewTips(b);
  if (a === 'game') return viewGame(b);
  if (a === 'add') return viewForm();
  if (a === 'edit') return viewForm(b);
  if (a === 'tips') return viewTips();
  if (a === 'settings') return viewSettings();
  location.hash = '#/';
}
window.addEventListener('hashchange', () => { window.scrollTo(0, 0); route(); });
(async () => {
  if (!localStorage.getItem('ps5g.seeded') && db.games.length === 0) {
    const seed = await fetchCached('seed.json', true);
    if (seed) { const today = new Date().toISOString().slice(0, 10); seed.forEach((g, i) => db.games.push({ ...g, added: today, done: {}, updated: Date.now() - i, frontUrl: '', backUrl: '' })); save(); }
    localStorage.setItem('ps5g.seeded', '1');
  }
  // patch seed covers onto existing seeded games that have none yet
  const seed2 = await fetchCached('seed.json', true);
  if (seed2) { let ch = false; seed2.forEach(sg => { const g = game(sg.id); if (g && sg.frontUrl && !g.frontUrl && !getImg(g.id, 'f')) { g.frontUrl = sg.frontUrl; ch = true; } }); if (ch) save(); }
  route();
})();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
