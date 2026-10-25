/* 逛城市的畫面：下方工具列（時間、名牌、暫停時鐘、鳥瞰、政策清單、打工現場、去打工）、右下動作（走到地點旁出現的「進去」鈕、打招呼、衣櫃／蓋城市／獻金）、
   打工場現況（左上小卡＋面板：現在輪到的打工場、多久後換場、總攻擊倒數、魔王圖鑑）與 live 頻道收到的別人正在打的班（場、波次、金蛋、魔王、隊員；可以看一眼或走過去）、
   金蛋商店面板（shop.js）、政策清單（搜尋、依行政區或主題分組，點了開政策卡並走過去）、第一次進來的三步說明、play 頻道的多人同框收發。 */
import { CONFIG as C } from './config.js';
import { ICONS } from './icons.js';
const X = C.explore, MP = X.multi, $ = id => document.getElementById(id);
export function createExploreUI({ explore, S, shop, callbacks, shared }) {
  const G = explore.G; const { esc, hint, banner } = shared;
  const active = () => G.on;
  // ── 開始／回大廳 ──
  // 進城市時先問一聲現在誰在打工（lq），打工的人下一秒就回報，不用等心跳
  async function start() { const p = shared.profile(); await shared.enter(); S.setPresence({ nick: p.nick, cls: p.cls, phase: 'explore' }); S.saveHero({ nick: p.nick, cls: p.cls, district: p.district });
    explore.start(p); S.playOn(true); S.liveOn('x', true); setTimeout(() => S.liveSend({ t: 'lq' }), 900); lastSent = null; setOn(true); shared.follow.start('xme', true); shared.followed(); shop.sync(); renderClock(); nowSid = ''; renderStage(); if (!guide()) hint('WASD／搖桿或點地板走路；走到服飾店、工地、市長旁邊會出現按鈕'); }
  function leave() { if (!active()) return; sayBye(); S.playOn(false); S.liveOn('x', false); lives.clear(); liveChanged(); closePanels(); setBird(false); explore.stop(); setOn(false); S.setPresence({ phase: 'lobby' }); }
  function setOn(on) { document.body.classList.toggle('exploring', on); $('xbar').hidden = !on; $('xAct').hidden = !on; $('xStage').hidden = !on; if (on) document.documentElement.style.setProperty('--brand-h', (document.querySelector('.brand') || {}).offsetHeight + 'px'); $('joy').hidden = !on || !shared.touch; if (!on) $('xPrompt').hidden = true; }
  // ── 走到地點旁邊：出現「進去」的按鈕（E）──
  const PROMPT = { boutique: () => ['👕', '進服飾店'], site: n => ['🚧', `投金蛋蓋${n.name}`], mayor: () => ['🎙', '找市長捐獻金'] }, TAB = { boutique: 'fit', site: 'city', mayor: 'donate' };
  callbacks.near = n => { if (n && PROMPT[n.kind]) { const [ic, t] = PROMPT[n.kind](n); $('btnXPrompt').innerHTML = `<span class="pi">${ic}</span><b>${esc(t)}</b><span class="kbd">E</span>`; $('xPrompt').hidden = false; } else $('xPrompt').hidden = true; if (!$('shopPanel').hidden) shop.render(); };
  const enterSpot = () => { if (G.near) openShop(TAB[G.near.kind]); };
  $('btnXPrompt').addEventListener('click', enterSpot);
  // ── 金蛋商店面板與政策清單（一次開一個）──
  function openShop(tab) { S.refresh().then(() => { if (!$('shopPanel').hidden) shop.render(); }); $('xlist').hidden = true; $('livePanel').hidden = true; $('xbList').setAttribute('aria-pressed', 'false'); $('xbLive').setAttribute('aria-pressed', 'false'); shop.setTab(tab); $('shopPanel').hidden = false; markAct(); document.body.classList.add('list-open'); }
  function closePanels() { $('shopPanel').hidden = true; $('xlist').hidden = true; $('livePanel').hidden = true; $('xbList').setAttribute('aria-pressed', 'false'); $('xbLive').setAttribute('aria-pressed', 'false'); markAct(); document.body.classList.remove('list-open'); }
  function markAct() { const open = !$('shopPanel').hidden; for (const [id, t] of [['btnXFit', 'fit'], ['btnXCity', 'city'], ['btnXDonate', 'donate']]) $(id).setAttribute('aria-pressed', String(open && shop.tab === t)); }
  for (const [id, t] of [['btnXFit', 'fit'], ['btnXCity', 'city'], ['btnXDonate', 'donate']]) $(id).addEventListener('click', () => { if (!$('shopPanel').hidden && shop.tab === t) closePanels(); else openShop(t); });
  $('btnShopClose').addEventListener('click', closePanels); $('shopTabs').addEventListener('click', () => setTimeout(markAct));
  // 「帶我去」：手機上先收起面板，看得到自己走過去
  function goTo(kind) { const ok = explore.goTo(kind); if (ok && matchMedia('(max-width:900px)').matches) closePanels(); return ok; }
  // ── 工具列：時間、名牌、暫停時鐘、鳥瞰、清單、回大廳 ──
  const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  function renderClock() { $('xbClock').textContent = hhmm(G.clock); }
  $('xbTimes').innerHTML = X.times.map(t => `<button type="button" class="xb" data-min="${t.min}"><span class="i">${t.icon}</span>${esc(t.label)}</button>`).join('');
  $('xbTimes').addEventListener('click', e => { const b = e.target.closest('button[data-min]'); if (!b) return; explore.setClock(+b.dataset.min); $('xbar').classList.remove('times-open'); $('xbClockBtn').setAttribute('aria-expanded', 'false'); renderClock(); });
  $('xbClockBtn').addEventListener('click', () => { const open = !$('xbar').classList.contains('times-open'); $('xbar').classList.toggle('times-open', open); $('xbClockBtn').setAttribute('aria-expanded', String(open)); });
  $('xbLabels').addEventListener('click', () => { const on = $('xbLabels').getAttribute('aria-pressed') !== 'true'; $('xbLabels').setAttribute('aria-pressed', String(on)); document.body.classList.toggle('no-plates', !on); });
  $('xbPause').addEventListener('click', () => { G.clockOn = !G.clockOn; $('xbPause').setAttribute('aria-pressed', String(!G.clockOn)); $('xbPause').querySelector('.i').textContent = G.clockOn ? '⏸️' : '▶️'; hint(G.clockOn ? '時間繼續走' : '時間停住了'); });
  let bird = false; function setBird(on) { bird = !!on; $('xbBird').setAttribute('aria-pressed', String(bird)); shared.bird(bird); shared.followed(); }
  $('xbBird').addEventListener('click', () => setBird(!bird));
  $('xbList').addEventListener('click', () => { if (!$('xlist').hidden) { closePanels(); return; } $('shopPanel').hidden = true; $('livePanel').hidden = true; $('xbLive').setAttribute('aria-pressed', 'false'); markAct(); $('xlist').hidden = false; $('xbList').setAttribute('aria-pressed', 'true'); document.body.classList.add('list-open'); renderList(); });
  $('xlClose').addEventListener('click', closePanels); $('xbWork').addEventListener('click', () => shared.goWork());
  // ── 政策清單：依行政區或政策主題分組，可搜尋；點一項開政策卡、自己走過去 ──
  let listTab = 'district';
  function renderList() { const q = $('xlSearch').value.trim().toLowerCase(), pols = shared.policies(), groups = new Map();
    pols.forEach((p, i) => { const isl = shared.islandOf(p.id), dn = shared.districtName(isl), hay = `${p.title} ${p.tag || ''} ${dn} ${p.summary || ''}`.toLowerCase(); if (q && !hay.includes(q)) return;
      const key = listTab === 'district' ? dn || '其他' : String(p.tag || '#其他'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push({ p, i, isl, dn }); });
    $('xlBody').innerHTML = groups.size ? [...groups].map(([k, list]) => `<details open><summary><span class="n">${list.length}</span>${esc(k)}</summary><ol>${list.map(({ p, i, dn }) => `<li><button type="button" class="it" data-pol="${esc(p.id)}"><span class="no">${i + 1}</span>${esc(p.title)}<small>${esc(listTab === 'district' ? p.tag || '' : dn)}</small></button></li>`).join('')}</ol></details>`).join('') : '<p class="empty">找不到符合的政策。</p>'; }
  $('xlSearch').addEventListener('input', renderList);
  document.querySelectorAll('#xlist .xl-tabs button').forEach(b => b.addEventListener('click', () => { listTab = b.dataset.tab; document.querySelectorAll('#xlist .xl-tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b))); renderList(); }));
  $('xlBody').addEventListener('click', e => { const b = e.target.closest('button[data-pol]'); if (!b) return; const p = shared.policies().find(x => x.id === b.dataset.pol); if (!p) return; const isl = shared.islandOf(p.id), at = shared.policyPos(p.id);
    if (at && active()) { explore.moveTo(at.x, at.z); if (bird) setBird(false); } if (matchMedia('(max-width:900px)').matches) closePanels(); shared.card(p, isl); hint(`走去看「${p.title}」`); });
  // ── 打工現場：別人正在打的班（房主或單人每幾秒送一次摘要；expire 秒沒更新就拿掉）──
  const LV = X.live, lives = new Map(), STAGES = new Map(C.stages.map(s => [s.id, s])), PH = ['intro', 'wave', 'inter'], BOSSES = new Set(C.bossTypes);
  const int = (v, a, b) => Math.max(a, Math.min(b, Math.round(Number(v) || 0))), clean = v => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24) : '';
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  S.onLive(m => { if (!m || typeof m.id !== 'string' || m.id.length > 64 || !active()) return;
    if (m.t === 'le') { const L = lives.get(m.id); if (L && m.r === 1) hint(`🎉 ${L.nk || '一隊打工仔'}在${STAGES.get(L.st).name}三波全過，收工了！`); if (lives.delete(m.id)) liveChanged(); return; }
    if (m.t !== 'ls' || !STAGES.has(m.st) || !PH.includes(m.ph)) return; const prev = lives.get(m.id);
    if (!prev && lives.size >= LV.maxShifts) return;
    const L = { st: m.st, ph: m.ph, w: int(m.w, 0, 3), tl: int(m.tl, 0, 300), g: int(m.g, 0, 999), q: int(m.q, 0, 999), sp: ['fog', 'rush'].includes(m.sp) ? m.sp : '', hz: int(m.hz, 0, 300), e: int(m.e, 0, 300), nk: clean(m.nk),
      b: [...new Set((Array.isArray(m.b) ? m.b : []).filter(t => BOSSES.has(t)))].slice(0, 5), p: (Array.isArray(m.p) ? m.p : []).slice(0, 4).filter(x => Array.isArray(x) && Object.hasOwn(C.heroes, x[0])).map(x => [x[0], x[1] ? 1 : 0, x[2] ? 1 : 0]), at: performance.now() };
    lives.set(m.id, L); if (!prev || prev.st !== L.st || prev.b.join() !== L.b.join()) liveChanged(); else renderLive(); });
  function groups() { const g = new Map(); for (const L of lives.values()) { const x = g.get(L.st) || { n: 0, bosses: [] }; x.n++; for (const b of L.b) if (!x.bosses.includes(b)) x.bosses.push(b); g.set(L.st, x); } return g; }
  function liveChanged() { const g = groups(); explore.setLive(g); shared.liveSigns(g, nowSid); renderLive(); if (active()) renderStage(); }
  // 左上小卡：現在的打工場、多久後換場、總攻擊倒數（每秒更新；換場時地圖上的牌子也跟著換）
  let nowSid = '', chip = '';
  function renderStage() { const I = shared.stageInfo(), n = groups().get(I.now.id);
    if (I.now.id !== nowSid) { nowSid = I.now.id; liveChanged(); }
    const t = `${I.now.name}|${I.now.islands.length}|${I.left}|${I.next.name}|${I.eveShort}|${n ? n.n : 0}`; if (t === chip) return; chip = t;
    $('xsName').textContent = I.now.name; $('xsLive').textContent = n ? `🔴 ${n.n} 隊在打` : ''; $('xsRot').textContent = `${I.left} 後換成${I.next.name}`; $('xsEve').textContent = I.eveShort; }
  setInterval(() => { if (!active()) return; const now = performance.now(); let gone = false; for (const [id, L] of [...lives]) if (now - L.at > LV.expire * 1000) { lives.delete(id); gone = true; } if (gone) liveChanged(); else if (!$('livePanel').hidden) renderLive(); }, 1000);
  const PHT = { intro: () => '準備開工', wave: L => `第 ${L.w}／${C.shift.waves} 波・剩 ${mmss(Math.max(0, L.tl - (performance.now() - L.at) / 1000))}`, inter: L => `第 ${L.w} 波過關・休息中` }, SPT = { fog: '🌫 起大霧', rush: '🌙 暴走夜' };
  // 面板：最上面是現在的打工場（看一眼／走過去／去這裡打工），中間是正在打的班，最下面是魔王圖鑑（場上有的標出來）
  function renderLive() { $('xbLiveN').textContent = lives.size ? String(lives.size) : ''; if ($('livePanel').hidden) return;
    const I = shared.stageInfo(), onField = new Set([...lives.values()].flatMap(L => L.b));
    const now = `<section class="live-now"><div class="ln-k">🥚 現在的打工場</div><div class="ln-name"><b>${esc(I.now.name)}</b><small>${I.now.islands.length} 座島${I.where ? `・${esc(I.where)}` : ''}</small></div>
      <p class="ln-rot">⏱ <b>${esc(I.left)}</b> 後換成<b>${esc(I.next.name)}</b></p><p class="ln-eve">${esc(I.eve)}</p>
      <div class="lc-btns"><button type="button" class="go2" data-look="${esc(I.now.id)}">📷 看一眼</button><button type="button" class="go2" data-walk="${esc(I.now.id)}">👣 走過去</button><button type="button" class="go2 go-there" data-gowork="1">🥚 去打工</button></div></section>`;
    const dex = `<h3 class="lv-h">魔王圖鑑</h3><ul class="bosses">${C.bossTypes.map(k => { const A = C.animals[k]; return `<li class="${onField.has(k) ? 'on' : ''}"><b>${esc(A.name)}${onField.has(k) ? '<em>🔴 場上</em>' : ''}</b><span>${esc(A.desc)}</span></li>`; }).join('')}</ul>`;
    const head = `<h3 class="lv-h">正在打的班${lives.size ? `<span>${lives.size}</span>` : ''}</h3>`;
    if (!lives.size) { $('liveBody').innerHTML = `${now}${head}<p class="empty">${S.state.sb ? '現在沒有人在打工。打工的人會把這一班的進度（波次、金蛋、魔王、隊員）送到這裡。' : '要連上共享後端才看得到別人打工。'}</p>${dex}`; return; }
    const list = [...lives.values()].sort((a, b) => b.w - a.w || a.st.localeCompare(b.st));
    $('liveBody').innerHTML = now + head + list.map(L => { const st = STAGES.get(L.st), humans = L.p.filter(x => !x[1]).length, pct = L.q ? Math.min(100, L.g / L.q * 100) : 0;
      return `<section class="live-card"><div class="lc-head"><b>${esc(st.name)}</b><span class="ph ${L.ph}">${esc(PHT[L.ph](L))}</span></div>
        ${L.ph === 'wave' ? `<div class="lc-egg${L.q && L.g >= L.q ? ' done' : ''}"><span class="egg" aria-hidden="true"></span><b>${L.g}</b><small>／${L.q}</small><span class="bar"><i style="width:${pct.toFixed(0)}%"></i></span>${L.sp ? `<em>${SPT[L.sp]}</em>` : ''}</div>` : ''}
        <p class="lc-boss">${L.b.length ? `魔王：<b>${L.b.map(t => esc(C.animals[t].name)).join('、')}</b>` : '現在沒有魔王'}・雜魚 ${Math.max(0, L.e - L.b.length)} 隻</p>
        <p class="lc-team"><span class="icons">${L.p.map(([c, npc, down]) => `<span class="${down ? 'down' : ''}${npc ? ' npc' : ''}" title="${esc(C.heroes[c].name)}${npc ? '（NPC）' : ''}${down ? '・倒下' : ''}">${C.heroes[c].icon}</span>`).join('')}</span>${esc(L.nk || '打工仔')}的隊・${humans} 人${4 - humans > 0 ? `＋${4 - humans} NPC` : ''}・危險度 ${L.hz}%</p>
        <div class="lc-btns"><button type="button" class="go2" data-look="${esc(L.st)}">📷 看一眼</button><button type="button" class="go2" data-walk="${esc(L.st)}">👣 走過去</button></div></section>`; }).join('') + dex; }
  function toggleLive() { if (!$('livePanel').hidden) { closePanels(); return; } $('shopPanel').hidden = true; $('xlist').hidden = true; $('xbList').setAttribute('aria-pressed', 'false'); markAct(); $('livePanel').hidden = false; $('xbLive').setAttribute('aria-pressed', 'true'); document.body.classList.add('list-open'); $('liveBody').scrollTop = 0; renderLive(); }
  $('xbLive').addEventListener('click', toggleLive); $('xStage').addEventListener('click', toggleLive);
  $('liveClose').addEventListener('click', closePanels);
  $('liveBody').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.gowork) { shared.goWork(); return; }
    const sid = b.dataset.look || b.dataset.walk; if (!sid) return; const narrowNow = matchMedia('(max-width:900px)').matches;
    if (b.dataset.look) { setBird(false); shared.lookStage(sid); if (narrowNow) closePanels(); hint('按「跟著我」回到自己身邊'); }
    else { const c = shared.stageCenter(sid); if (c) { if (bird) setBird(false); explore.moveTo(c.x, c.z); shared.follow.start('xme', false); shared.followed(); if (narrowNow) closePanels(); hint(`往${STAGES.get(sid).name}走`); } } });
  // ── 第一次進來的三步說明 ──
  function guide() { try { if (localStorage.getItem(X.guideKey)) return false; } catch (e) { return false; }
    $('guideTitle').textContent = '逛城市怎麼玩'; $('guideSteps').innerHTML = [
      ['走路', '電腦用 WASD 或方向鍵，手機用左下搖桿，也可以直接點地板；跨島會自己找橋。'],
      ['花金蛋', '走到「👕 服飾店」買衣服、走到「🚧 工地」投金蛋蓋城市、走到市長旁邊捐政治獻金；右下的按鈕可以「帶我去」。金蛋要靠打工賺。'],
      ['和大家一起逛', '其他正在逛的人也在這張地圖上，穿著他們買的衣服。按表情打招呼，點別人可以擊掌。下方「🔴 打工現場」看得到別人正在打的班和魔王；「🥚 去打工」穿過雲層到打工場。'],
    ].map(([t, d]) => `<li><span><b>${esc(t)}</b>${esc(d)}</span></li>`).join(''); $('guide').hidden = false; return true; }
  $('guideOk').addEventListener('click', () => { $('guide').hidden = true; try { localStorage.setItem(X.guideKey, '1'); } catch (e) { /* 無痕 */ } });
  // ── 多人同框：送自己的位置與穿著、收別人的、表情與擊掌（訊息類型 xp／xe／xb）──
  const EM = new Map([...X.emotes, X.five].map(e => [e.k, e])); let lastSent = null, lastSentAt = 0, lastEmoteAt = 0; const rxAt = new Map(), rxEmoteAt = new Map();
  const r2 = v => Math.round(v * 100) / 100, myId = () => S.state.uid;
  function sendPos() { const me = G.me; if (!active() || !me) return; const now = Date.now(), every = Math.min(MP.sendMax, Math.max(MP.sendEvery, shared.online() * MP.sendPerPlayer)) * 1000;
    const moved = !lastSent || Math.hypot(me.pos.x - lastSent.x, me.pos.z - lastSent.z) > 0.05 || lastSent.o !== me.fit || lastSent.c !== me.cls;
    if ((moved && now - lastSentAt < every) || (!moved && now - lastSentAt < MP.heartbeat * 1000)) return;
    lastSent = { x: me.pos.x, z: me.pos.z, o: me.fit, c: me.cls }; lastSentAt = now; S.send({ t: 'xp', n: me.nick, c: me.cls, o: me.fit || '', x: r2(me.pos.x), z: r2(me.pos.z), y: r2(me.yaw) }); }
  setInterval(() => { if (!document.hidden) sendPos(); if (active()) explore.pruneRemotes(S.state.onlineIds ? new Set(S.state.onlineIds) : null, performance.now()); }, 200);
  const sayBye = () => { lastSent = null; S.send({ t: 'xb' }); };
  addEventListener('pagehide', () => { if (active()) sayBye(); });
  // 收到的一切都是其他訪客送的：驗證型別、範圍、長度，限制頻率，名字只畫在名牌上（textContent）
  const okNum = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 40;
  S.onNet(m => { if (!m || typeof m.id !== 'string' || m.id.length > 64 || m.id === myId() || !active()) return; const now = performance.now();
    if (m.t === 'xp') { if (now - (rxAt.get(m.id) || 0) < MP.rxMinGap * 1000) return; rxAt.set(m.id, now); if (!Object.hasOwn(C.heroes, m.c) || !okNum(m.x) || !okNum(m.z)) return;
      const nick = (typeof m.n === 'string' ? m.n : '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24) || C.heroes[m.c].name, fit = typeof m.o === 'string' && /^[a-z0-9.-]{0,60}$/.test(m.o) ? m.o : '';
      explore.upsertRemote({ id: m.id, n: nick, c: m.c, o: fit, x: m.x, z: m.z, y: okNum(m.y) ? m.y : null }); return; }
    if (m.t === 'xb') { explore.removeRemote(m.id); return; }
    if (m.t !== 'xe' || now - (rxEmoteAt.get(m.id) || 0) < 800) return; rxEmoteAt.set(m.id, now);
    const em = typeof m.k === 'string' && EM.get(m.k); if (!em) return; const nick = explore.remoteEmote(m.id, em); if (nick && em.k === 'five' && m.to === myId()) { banner(`${nick} 跟你擊掌 🙌`, 2.5); explore.myEmote(X.five); } });
  function emote(k) { const em = EM.get(k), now = Date.now(); if (!em || now - lastEmoteAt < MP.emoteCooldown * 1000 || !explore.myEmote(em)) return; lastEmoteAt = now; S.send({ t: 'xe', k }); }
  $('xEmotes').innerHTML = X.emotes.map((e, i) => `<button type="button" data-k="${esc(e.k)}" title="說：${esc(e.say)}（${i + 1}）" aria-label="${esc(e.say)}">${ICONS[e.k] || `<span class="em">${esc(e.icon)}</span>`}<span>${esc(e.say)}</span></button>`).join('');
  $('xEmotes').addEventListener('click', ev => { const b = ev.target.closest('button[data-k]'); if (b) emote(b.dataset.k); });
  callbacks.remote = (id, w) => { if (!w) return; const now = Date.now(); if (now - lastEmoteAt < MP.emoteCooldown * 1000) return; lastEmoteAt = now; explore.myEmote(X.five); S.send({ t: 'xe', k: 'five', to: id }); hint(`你跟 ${w.nick} 擊掌 🙌`); };
  // 換了衣服或職業：角色原地換裝，馬上通知大家
  function refit() { if (!active()) return; const p = shared.profile(); if (G.me && G.me.fit === p.fit && G.me.cls === p.cls) return; explore.refit(p); lastSent = null; }
  // ── 鍵盤：E 進去、1～4 打招呼、B 鳥瞰、L 清單、Esc 關面板 ──
  document.addEventListener('keydown', ev => { if (!active() || /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return; const k = ev.key.toLowerCase();
    if (k === 'e' || ev.key === 'Enter') { ev.preventDefault(); enterSpot(); } else if (ev.key === 'Escape') closePanels(); else if (k === 'b') setBird(!bird); else if (k === 'l') $('xbList').click(); else if (k >= '1' && k <= String(X.emotes.length)) emote(X.emotes[+k - 1].k); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastSent = null; sendPos(); } });
  return { start, leave, active, goTo, refit, closePanels, renderLive, tick() { if (!active()) return; renderClock(); renderStage(); } };
}
