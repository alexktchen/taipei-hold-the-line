/* 守城模式的畫面：大廳守城分頁（下一波議題、出戰、守城榜）、回合中的上方狀態列與英雄按鈕、波間提示（自動開下一波）、多人同框（位置、表情、擊掌、大招）。
   守城不賺金蛋（金蛋只有打工賺）；戰績記在 rounds／kills／finals。 */
import { CONFIG as C } from './config.js';
import { ICONS } from './icons.js';
const TC = C.td, RC = TC.round, MP = TC.multi, $ = id => document.getElementById(id);
export function createTDUI({ td, S, callbacks, shared }) {
  const G = td.G; const { esc, fmt, hint, banner, renderLog, isFinalNow, todayTPE, eveDate, districtName } = shared;
  // ── 議題輪替：大選前夜起一律總攻擊；平常從已開放的議題裡隨機挑，和上一波不同 ──
  const issues = () => shared.issues().filter(i => i && i.routes && i.routes.length);
  function rotation() { const today = todayTPE(), list = issues(); const open = list.filter(i => i.id !== C.election.finalIssueId && (!i.startsAt || i.startsAt <= today)); return open.length ? open : list.filter(i => i.id !== C.election.finalIssueId); }
  function pickNext(lastId) { const list = issues(); if (isFinalNow()) return list.find(i => i.id === C.election.finalIssueId) || list[0]; const pool = rotation(); const cand = pool.length > 1 ? pool.filter(i => i.id !== lastId) : pool; return cand[Math.floor(Math.random() * cand.length)] || list[0]; }
  let chosen = null, nextTimer = 0, toastT = 0;
  const active = () => G.phase === 'round' || G.phase === 'result';
  // ── 大廳的守城分頁 ──
  function renderLobby() { const list = issues(); if (list.length && (!chosen || !list.some(i => i.id === chosen.id))) chosen = pickNext(null);
    if (chosen) { const rot = rotation(); $('tdIssue').innerHTML = `<div class="issue" aria-pressed="true"><span class="tag">${esc(chosen.tag)}</span><span><b>${esc(chosen.title)}${chosen.id === C.election.finalIssueId ? ' <em class="final">大選前夜</em>' : ' <em>下一波</em>'}</b><small>${esc(chosen.desc || '')}</small></span></div><div class="rotation">${rot.filter(i => i.id !== chosen.id).map(i => `<span>${esc(i.tag)}</span>`).join('')}</div>`; }
    const t = S.tdTotals(), h = S.hero() || {};
    $('tdStats').innerHTML = `<div><b>${fmt(t.waves)}</b><span>波已阻擋</span></div><div><b>${fmt(t.blocked)}</b><span>隻網軍被擋下</span></div><div><b>${fmt(t.heroes)}</b><span>位英雄參戰</span></div>`;
    $('tdMine').textContent = h.rounds ? `你已經守了 ${fmt(h.rounds)} 波、擊退 ${fmt(h.kills)} 隻。` : '你還沒守過城。';
    renderBoard(); }
  function renderBoard() { const list = S.tdLeaderboard(); $('tdBoard').innerHTML = list.length ? list.map((h, i) => `<li><span class="rank">${i + 1}</span><span class="who">${esc(h.nick || '匿名英雄')} <small>${C.heroes[h.cls] ? C.heroes[h.cls].icon : ''}</small></span><b>${fmt(h.kills)}</b><small>${h.rounds || 0} 波</small></li>`).join('') : '<li class="empty">還沒有人守過城。第一個就是你。</li>'; }
  // ── 回合中的畫面 ──
  const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
  function renderHud() { if (!active()) return; const left = Math.max(0, RC.seconds - G.t), ap = Math.max(0, Math.round(G.approval));
    $('tdWave').textContent = G.issue ? `第 ${G.waveNo} 波・${G.issue.tag}${G.final ? '・總攻擊' : ''}` : ''; $('tdTime').textContent = mmss(left); $('tdTime').classList.toggle('late', G.phase === 'round' && left < 20);
    $('tdAppr').textContent = ap; $('tdApprBar').style.width = ap + '%'; $('tdApprBox').dataset.level = ap > 50 ? 'ok' : ap > 25 ? 'mid' : 'low';
    const fighting = G.residents.filter(r => r.state === 'engage' || r.state === 'fight').length; $('tdEnemies').textContent = `${G.enemies.length} 隻在島上・${G.queue.length} 隻在路上・${fighting} 位居民出動`; }
  function renderHero() { if (!G.hero) return; const H = G.hero.cfg;
    $('focusCd').textContent = G.focusCd > 0 ? `重擊冷卻 ${G.focusCd.toFixed(1)} 秒` : G.auto ? `點敵人：重擊 ×${RC.focusDmgMul}・點島嶼：走過去` : '自由逛逛：點地圖走過去・點玩家擊掌・點敵人重擊';
    $('btnAuto').setAttribute('aria-checked', String(G.auto)); $('autoSt').textContent = G.auto ? '開' : '關'; $('tdHeroName').textContent = `${H.icon} ${G.hero.nick || H.name}`;
    const u = $('btnUlt'); u.disabled = G.ultCd > 0 || G.phase !== 'round'; $('ultCd').textContent = G.ultCd > 0 ? `${Math.ceil(G.ultCd)} 秒` : '全地圖'; }
  // ── 開打、守住、回大廳 ──
  async function start() { clearInterval(nextTimer); const hero = shared.profile(); if (!chosen) chosen = pickNext(null); if (!chosen) { hint('還沒有議題可以守', true); return; }
    await shared.enter(); S.setPresence({ nick: hero.nick, cls: hero.cls, phase: 'td' }); await S.saveHero({ nick: hero.nick, cls: hero.cls, district: hero.district });
    const final = isFinalNow() || chosen.id === C.election.finalIssueId; const waveNo = (S.tdTotals().waves || 0) + 1;
    td.startRound(chosen, hero, waveNo, final); td.setAuto(loadAuto()); S.playOn(true); lastSent = null; setOn(true); renderHero(); renderHud(); hint(''); }
  function setOn(on) { document.body.classList.toggle('in-td', on); $('tdHud').hidden = !on; $('tdBar').hidden = !on; $('btnPause').hidden = !on; $('btnSpeed').hidden = !on; $('btnQuit').hidden = !on;
    G.paused = false; $('btnPause').textContent = '暫停'; $('btnPause').setAttribute('aria-pressed', 'false'); $('btnSpeed').setAttribute('aria-pressed', 'false'); }
  function districtLine(res) { const id = res.hero.district; if (!id) return '這波沒有選行政區。'; const name = districtName(id); return `你替${name}擋下 ${fmt(res.kills)} 隻網軍。金蛋要靠打工賺，搬進籃子才算進 12 區對抗。`; }
  async function onEnd(res) { await S.recordRound(res); shared.refresh();
    $('wtTitle').textContent = res.final ? `總攻擊擋下了！第 ${res.waveNo} 波` : `第 ${res.waveNo} 波已阻擋！`;
    $('wtText').textContent = `${res.tag} 擊退 ${fmt(res.kills)} 隻・滿意度 ${res.approval}%${res.leaked ? `・${res.leaked} 隻擠進門口` : ''}・大家已擋 ${fmt(S.tdTotals().waves)} 波`; $('wtDistrict').textContent = districtLine(res);
    chosen = pickNext(res.issueId); let deadline = Date.now() + RC.autoNextSeconds * 1000; clearTimeout(toastT); $('waveToast').hidden = false;
    const tick = () => { const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); $('wtNext').textContent = chosen ? `下一波 ${chosen.tag} ${chosen.title}・${left} 秒後開始` : ''; return left; };
    tick(); clearInterval(nextTimer); nextTimer = setInterval(() => { if (G.phase !== 'result') { clearInterval(nextTimer); return; } if (document.hidden) { deadline += 250; return; } if (tick() <= 0) { clearInterval(nextTimer); start(); toastT = setTimeout(() => { $('waveToast').hidden = true; }, RC.toastLinger * 1000); } }, 250); }
  function toLobby() { if (!active()) return; clearInterval(nextTimer); clearTimeout(toastT); $('waveToast').hidden = true; sayBye(); S.playOn(false); td.clearRemotes(); td.backToLobby(); setOn(false); S.setPresence({ phase: 'lobby' }); shared.exit(); }
  // ── 暫停、2×、自動攻擊、大招 ──
  function togglePause() { if (G.phase !== 'round') return; G.paused = !G.paused; $('btnPause').textContent = G.paused ? '繼續' : '暫停'; $('btnPause').setAttribute('aria-pressed', String(G.paused)); }
  $('btnSpeed').addEventListener('click', () => { if (G.phase !== 'round') return; G.speed = G.speed === 1 ? 2 : 1; $('btnSpeed').setAttribute('aria-pressed', String(G.speed === 2)); });
  const loadAuto = () => { try { return localStorage.getItem(TC.heroMode.storageKey) !== '0'; } catch (e) { return true; } };
  function toggleAuto() { if (!G.hero) return; const on = !G.auto; td.setAuto(on); try { localStorage.setItem(TC.heroMode.storageKey, on ? '1' : '0'); } catch (e) { /* 無痕或封鎖儲存：只影響下次預設值 */ } lastSent = null; hint(on ? '自動攻擊開：英雄會自己找最前線的網軍' : '自動攻擊關：點地圖帶英雄到處逛，點其他玩家的英雄可以擊掌'); }
  function doUlt() { if (td.ultimate()) S.send({ t: 'u' }); }
  $('btnAuto').addEventListener('click', toggleAuto); $('btnUlt').addEventListener('click', doUlt); $('btnLobby').addEventListener('click', toLobby);
  // ── 多人同框：送自己的英雄位置、收別人的英雄、表情與擊掌 ──
  const EM = new Map([...MP.emotes, MP.five].map(e => [e.k, e])); let lastSent = null, lastSentAt = 0, lastEmoteAt = 0; const rxAt = new Map(), rxEmoteAt = new Map();
  const myId = () => S.state.uid;
  function sendPos() { const H = G.hero; if (!H) return; const now = Date.now(); const inRound = G.phase === 'round'; const every = Math.min(MP.sendMax, Math.max(MP.sendEvery, shared.online() * MP.sendPerPlayer)) * 1000;
    const moved = !lastSent || Math.hypot(H.pos.x - lastSent.x, H.pos.z - lastSent.z) > 0.08 || lastSent.r !== inRound; if (now - lastSentAt < every || (!moved && now - lastSentAt < MP.heartbeat * 1000)) return;
    lastSent = { x: H.pos.x, z: H.pos.z, r: inRound }; lastSentAt = now; S.send({ t: 'p', n: H.nick || H.cfg.name, c: H.cls, x: Math.round(H.pos.x * 100) / 100, z: Math.round(H.pos.z * 100) / 100, r: inRound ? 1 : 0, f: H.pose === 'fight' ? 1 : 0, a: G.auto ? 1 : 0 }); }
  setInterval(() => { if (!document.hidden) sendPos(); td.pruneRemotes(S.state.onlineIds ? new Set(S.state.onlineIds) : null, performance.now()); }, 250);
  const sayBye = () => { lastSent = null; S.send({ t: 'bye' }); };
  addEventListener('pagehide', sayBye);
  // 收到的一切都是其他訪客送的：驗證型別、範圍、長度，限制頻率，名字只畫在畫布上不進 HTML
  const okNum = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 40;
  S.onNet(m => { if (!m || typeof m.id !== 'string' || m.id.length > 64 || m.id === myId() || !active()) return; const now = performance.now();
    if (m.t === 'p') { if ((now - (rxAt.get(m.id) || 0)) < MP.rxMinGap * 1000) return; rxAt.set(m.id, now); if (!Object.hasOwn(TC.heroes, m.c) || !okNum(m.x) || !okNum(m.z)) return;
      const nick = (typeof m.n === 'string' ? m.n : '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24) || TC.heroes[m.c].name; td.upsertRemote({ id: m.id, n: nick, c: m.c, x: m.x, z: m.z, r: !!m.r, f: !!m.f, a: m.a !== 0 }); return; }
    if (m.t === 'bye') { td.removeRemote(m.id); return; }
    if ((now - (rxEmoteAt.get(m.id) || 0)) < 800) return; rxEmoteAt.set(m.id, now);
    if (m.t === 'e') { const em = typeof m.k === 'string' && EM.get(m.k); if (!em) return; const nick = td.remoteEmote(m.id, em); if (!nick) return;
      if (em.k === 'five' && m.to === myId()) { banner(`${nick} 跟你擊掌 🙌`, 2.5); td.myEmote(MP.five); } else if (em.k === 'help') hint(`${nick}：這邊需要支援！`); return; }
    if (m.t === 'u') { const nick = td.remoteUlt(m.id); if (nick) banner(`🙌 ${nick} 喊「台北人站出來」！`, 2.5); } });
  function emote(k) { const em = EM.get(k); const now = Date.now(); if (!em || now - lastEmoteAt < MP.emoteCooldown * 1000) return; if (!td.myEmote(em)) return; lastEmoteAt = now; S.send({ t: 'e', k }); }
  $('tdEmotes').innerHTML = MP.emotes.map((e, i) => `<button type="button" data-k="${esc(e.k)}" title="說：${esc(e.say)}（${i + 1}）" aria-label="${esc(e.say)}">${ICONS[e.k] || `<span class="em">${esc(e.icon)}</span>`}</button>`).join('');
  $('tdEmotes').addEventListener('click', ev => { const b = ev.target.closest('button[data-k]'); if (b) emote(b.dataset.k); });
  // 點別人的英雄：擊掌
  const tdcb = { remote: (id, w) => { if (!w) return; const now = Date.now(); if (now - lastEmoteAt < MP.emoteCooldown * 1000) return; lastEmoteAt = now; if (G.hero) td.myEmote(MP.five); S.send({ t: 'e', k: 'five', to: id }); hint(`你跟 ${w.nick} 擊掌 🙌`); },
    hud: renderHud, hero: renderHero, log: renderLog, banner, hint, end: onEnd };
  Object.assign(callbacks, tdcb);
  // ── 鍵盤：Q 大招、A 自動攻擊、空白鍵暫停、1～6 打招呼 ──
  document.addEventListener('keydown', ev => { if (!active() || /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return; const k = ev.key.toLowerCase();
    if (k === 'q') doUlt(); else if (k === 'a') toggleAuto(); else if (ev.key === ' ') { ev.preventDefault(); togglePause(); } else if (k >= '1' && k <= String(MP.emotes.length)) emote(MP.emotes[+k - 1].k); });
  // 切到背景就暫停（回合中）；回到前景馬上補送一次位置
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.phase === 'round' && !G.paused) togglePause(); if (!document.hidden) { lastSent = null; sendPos(); } });
  return { renderLobby, renderBoard, start, toLobby, togglePause, active, tick() { if (!active()) return; renderHud(); renderHero(); } };
}
