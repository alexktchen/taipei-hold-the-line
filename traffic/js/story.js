/* 看路網事件：事件列表（即時事件／時制體檢）、地圖上的事件標記、導播模式（像電影一樣自動切到最嚴重的新事件、慢慢繞著拍、下方字幕）、情境（事故、施工、活動散場、下大雨、號誌故障）。 */
import { KIND } from './diag.js';
const $ = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const VENUES = [['台北小巨蛋', 25.0518, 121.5497], ['台北大巨蛋', 25.0435, 121.5605], ['南港展覽館', 25.0565, 121.6178], ['台北 101', 25.0336, 121.5646], ['台北車站', 25.0478, 121.517]];
const fmtT = s => { s = ((s % 86400) + 86400) % 86400; return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`; };

export function createStory({ net, sim, sig, diag, meta, look, pick, controls, labelEl, project, pickedRoad }) {
  let tab = 'live', director = false, lastCut = -1e9, shown = new Map(), pins = new Map(), scenes = [], rainOn = false;
  // ── 事件列表 ──
  // 指標在列表上（或剛點下去）就先不重畫，免得按鈕在點的途中被換掉；內容沒變也不重畫
  let hover = false, holdUntil = 0, lastHtml = '', flt = { live: '', rules: '' };
  $('evPanel').addEventListener('pointerenter', () => { hover = true; }); $('evPanel').addEventListener('pointerleave', () => { hover = false; render(); }); $('evPanel').addEventListener('pointerdown', () => { holdUntil = performance.now() + 1500; });
  function render(force) { const box = $('evBody'); $('evCount').textContent = diag.events.length ? String(diag.events.length) : ''; if (!box || $('evPanel').hidden || (!force && (hover || performance.now() < holdUntil))) return; let html;
    const chips = (cnt, label) => { const ks = Object.keys(cnt); if (ks.length < 2) return ''; return `<div class="chips" role="group" aria-label="篩選">${[['', '全部', Object.values(cnt).reduce((a, b) => a + b, 0)], ...ks.map(k => [k, label(k), cnt[k]])].map(([k, nm, n]) => `<button type="button" data-flt="${k}" aria-pressed="${String((flt[tab] || '') === k)}">${esc(nm)} ${n}</button>`).join('')}</div>`; };
    if (tab === 'live') { const cnt = {}; for (const ev of diag.events) cnt[ev.kind] = (cnt[ev.kind] || 0) + 1; const f = flt.live, list = diag.events.filter(ev => !f || ev.kind === f).slice(0, 60);
      html = diag.events.length ? chips(cnt, k => KIND[k].icon + ' ' + KIND[k].name) + list.map(ev => `<button type="button" class="ev sev${ev.sev}" data-ev="${ev.id}"><span class="ic">${KIND[ev.kind].icon}</span><span class="tx"><b>${esc(ev.name)}</b><small>${fmtT(ev.t)}・${KIND[ev.kind].name}${ev.n > 1 ? `・第 ${ev.n} 次` : ''}</small><span>${esc(ev.text)}</span></span></button>`).join('') : '<p class="empty">還沒有事件。車多的時段（上班、下班）或加大交通量、下大雨、製造事故，比較容易看到號誌撐不住的地方。</p>'; }
    else { const R = diag.rules, RU = diag.RULE, cnt = {}; for (const r of R) for (const x of r.found) cnt[x.k] = (cnt[x.k] || 0) + 1; const f = flt.rules, list = R.filter(r => !f || r.found.some(x => x.k === f)), safe = R.filter(r => r.found.some(x => RU[x.k].safe)).length;
      html = R.length ? `<p class="lead">照交通工程常用準則檢查 ${fmtT(sim.t)} 這個時段臺北市公開的時制：${R.length} 個路口有可以再看看的地方，其中 ${safe} 個是安全類（黃燈、全紅、行人綠閃）。安全問題多、路比較大的排前面。路寬與速限是從地圖估的，請以現場為準。</p>` + chips(cnt, k => RU[k].name)
        + list.slice(0, 120).map(r => `<button type="button" class="ev sev${r.found.some(x => RU[x.k].safe) ? 2 : 1}" data-rule="${r.c.i}"><span class="ic">📋</span><span class="tx"><b>${esc(diag.nameOf(r.c))}</b>${r.found.map(x => `<span><i class="tag${RU[x.k].safe ? ' safe' : ''}">${RU[x.k].name}</i>${esc(x.t)}</span>`).join('')}</span></button>`).join('') + (list.length > 120 ? `<p class="empty">還有 ${list.length - 120} 個，用上面的篩選看特定種類。</p>` : '') : '<p class="empty">目前選到的時段沒有發現明顯不合理的時制（或時制資料還沒載入）。</p>'; }
    if (html !== lastHtml) { box.innerHTML = html; lastHtml = html; } $('evTabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab))); }
  function focusEvent(ev, cinematic) { look(ev.x, ev.z, cinematic ? 240 : 320, cinematic ? 0.95 : 0.85); if (ev.c) pick({ kind: 'sig', c: ev.c, ev }); }
  $('evBody').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.flt != null) { flt[tab] = b.dataset.flt; render(true); return; } stopDirector(); if (b.dataset.ev) { const ev = diag.events.find(x => x.id === +b.dataset.ev); if (ev) focusEvent(ev); } else if (b.dataset.rule) { const c = sig.list[+b.dataset.rule]; look(c.x, c.z, 320, 0.85); pick({ kind: 'sig', c }); } });
  $('evTabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (!b) return; tab = b.dataset.tab; if (tab === 'rules') diag.checkRules(); render(true); $('evBody').scrollTop = 0; });
  $('btnEvents').addEventListener('click', () => { const p = $('evPanel'); p.hidden = !p.hidden; $('btnEvents').setAttribute('aria-pressed', String(!p.hidden)); render(true); });
  $('evClose').addEventListener('click', () => { $('evPanel').hidden = true; $('btnEvents').setAttribute('aria-pressed', 'false'); });
  // ── 地圖上的事件標記（最近 10 分鐘的事件）──
  function updatePins() { const now = sim.t, want = new Set(); for (const ev of diag.events) { if (now - ev.last > 600 || want.size > 30) continue; want.add(ev.id);
      if (!pins.has(ev.id)) { const el = document.createElement('button'); el.type = 'button'; el.className = `pin sev${ev.sev}`; el.textContent = KIND[ev.kind].icon; el.title = `${ev.name}：${ev.text}`; el.addEventListener('click', () => { stopDirector(); focusEvent(ev); }); labelEl.appendChild(el); pins.set(ev.id, { el, ev }); } }
    for (const [id, p] of pins) if (!want.has(id)) { p.el.remove(); pins.delete(id); }
    for (const p of pins.values()) { const s = project(p.ev.x, p.ev.z); if (!s) { p.el.style.display = 'none'; continue; } p.el.style.display = ''; p.el.style.transform = `translate(${(s[0] - 15).toFixed(1)}px,${(s[1] - 38).toFixed(1)}px)`; } }
  // ── 導播：自動切到最值得看的新事件，下方字幕 ──
  function setDirector(on) { director = on; document.body.classList.toggle('director', on); $('btnDirector').setAttribute('aria-pressed', String(on)); controls.autoRotate = false; if (on) { lastCut = -1e9; cut(); } else $('caption').hidden = true; }
  function stopDirector() { if (director) setDirector(false); }
  function cut() { const now = sim.t; const cand = diag.events.filter(ev => now - ev.last < 240 && !(shown.get(ev.id) > now - 150)).sort((a, b) => b.sev - a.sev || b.last - a.last);
    const ev = cand[0]; if (!ev) { $('caption').hidden = false; $('capTitle').textContent = '導播待命中'; $('capText').textContent = '等路網出現值得看的事件（排隊回堵、一次綠燈過不完、綠燈空轉…）。可以加大交通量或用「情境」製造事件。'; return; }
    shown.set(ev.id, now); lastCut = performance.now(); focusEvent(ev, true); controls.autoRotate = true; controls.autoRotateSpeed = 0.35;
    $('caption').hidden = false; $('capTitle').textContent = `${fmtT(ev.t)}・${ev.name}・${KIND[ev.kind].icon} ${KIND[ev.kind].name}`; $('capText').textContent = `${ev.text}。${ev.tip ? '建議：' + ev.tip : ''}`; }
  $('btnDirector').addEventListener('click', () => setDirector(!director));
  diag.onEvent = ev => { if (director && ev.sev >= 2 && performance.now() - lastCut > 9000) cut(); };
  // ── 情境 ──
  const proj = (lat, lon) => [(lon - meta.origin.lon) * meta.kx, -(lat - meta.origin.lat) * meta.kz];
  function busyApproach(x, z, r) { let best = null, bn = -1; for (const c of sig.list) { if (Math.hypot(c.x - x, c.z - z) > r) continue; for (const L of c.appr) { if (L.cls > 3 || L.len - L.stop - L.s0 < 80) continue; const n = L.q.reduce((a, q) => a + q.length, 0) + L.lanes; if (n > bn) { bn = n; best = L; } } } return best; }
  function scenario(kind) { const tg = controls.target, now = sim.t; let L, s, msg = '';
    if (kind === 'crash' || kind === 'work') { const rd = pickedRoad(); L = rd ? net.links[rd.links.find(i => i >= 0)] : busyApproach(tg.x, tg.z, 1500); if (!L) { msg = '附近沒有適合的幹道'; return msg; }
      const lane = kind === 'crash' ? L.lanes - 1 : 0; s = Math.max(L.s0 + 10, L.len - L.stop - 45); const secs = kind === 'crash' ? 600 : 1800; sim.blockLane(L, lane, s, secs); if (kind === 'work') sim.blockLane(L, lane, s - 9, secs);
      const e = net.edges[L.e], nm = e.name >= 0 ? net.names[e.name] : '這條路', P = L.pts, k = Math.floor(P.length / 4) * 2;
      diag.emit('scene', null, `${nm} ${kind === 'crash' ? '發生事故，佔用外側車道 10 分鐘' : '道路施工，封閉內側車道 30 分鐘'}`, '看上游路口有沒有回堵、號誌綠燈夠不夠讓車輛繞道', { key: 'scene' + now, x: P[k], z: P[k + 1], name: nm, sev: 3 });
      look(P[k], P[k + 1], 260, 0.9); msg = `${nm}：${kind === 'crash' ? '事故' : '施工'}佔用一個車道`; }
    else if (kind.startsWith('venue')) { const [nm, lat, lon] = VENUES[+kind.slice(5)], [x, z] = proj(lat, lon); scenes.push({ x, z, left: 1600, nm }); diag.emit('scene', null, `${nm} 活動散場，10 分鐘內約 1,600 台車湧出`, '看附近號誌路口的排隊能不能在一個週期內消化', { key: 'scene' + now, x, z, name: nm, sev: 3 }); look(x, z, 700, 0.8); msg = `${nm} 散場人潮`; }
    else if (kind === 'rain') { rainOn = !rainOn; sim.rain = rainOn ? 1 : 0; document.body.classList.toggle('rain', rainOn); msg = rainOn ? '下大雨：車速變慢、跟車距離拉長，路口一次能過的車變少' : '雨停了'; if (rainOn) diag.emit('scene', null, '全市下大雨：車速約 −20%、跟車距離拉長', '看哪些路口開始一次綠燈過不完——那裡的綠燈本來就剛好、沒有餘裕', { key: 'rain' + now, x: tg.x, z: tg.z, name: '全市', sev: 2 }); }
    else if (kind === 'flash') { let best = null, bd = 1e9; for (const c of sig.list) { const d = Math.hypot(c.x - tg.x, c.z - tg.z); if (d < bd) { bd = d; best = c; } } if (!best) return '附近沒有號誌路口';
      best.flash = true; best.flashUntil = now + 300; /* 模擬時間 5 分鐘後恢復（tick 裡檢查） */ diag.emit('scene', best, '號誌故障，改成閃黃燈', '沒有號誌時大家互相讓，看看這個路口原本的時制是不是真的需要', { key: 'flash' + now, sev: 3 }); look(best.x, best.z, 260, 0.9); pick({ kind: 'sig', c: best }); msg = `${diag.nameOf(best)} 號誌閃黃`; }
    return msg; }
  function tick() { // 活動散場：每秒放一些車進來；號誌閃黃時間到恢復
    for (const sc of scenes) { if (sc.left <= 0) continue; const n = Math.min(sc.left, 3); sc.left -= n; sim.spawnNear(sc.x, sc.z, 600, n); } scenes = scenes.filter(s => s.left > 0);
    for (const c of sig.list) if (c.flash && c.flashUntil && sim.t > c.flashUntil) { c.flash = false; c.flashUntil = 0; }
    sim.clearFixed(); }
  $('scMenu').addEventListener('click', e => { const b = e.target.closest('button[data-sc]'); if (!b) return; const msg = scenario(b.dataset.sc); closeMenu(); if (msg) toast(msg); });
  const closeMenu = () => { $('scMenu').hidden = true; $('btnScene').setAttribute('aria-expanded', 'false'); };
  $('btnScene').addEventListener('click', () => { const m = $('scMenu'); m.hidden = !m.hidden; $('btnScene').setAttribute('aria-expanded', String(!m.hidden)); if (!m.hidden) m.querySelector('button').focus(); });
  document.addEventListener('pointerdown', e => { if (!$('scMenu').hidden && !e.target.closest('#scMenu,#btnScene')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('scMenu').hidden) { closeMenu(); $('btnScene').focus(); } });
  let toastT = 0; function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3500); }
  return { render, updatePins, tick, stopDirector, get director() { return director; }, cutIfIdle() { if (director && performance.now() - lastCut > 20000) cut(); }, toast }; }
