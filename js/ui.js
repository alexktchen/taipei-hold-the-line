/* 全版 UI：浮動面板（品牌、全體戰績、HUD、英雄、日誌）、大廳與結算。 */
import { CONFIG as C } from './config.js';
import { HOTLINE } from './hotline.js';
import { nextNews, genHotline } from './news.js';
import { ICONS, policyIcon } from './icons.js';
const RC = C.round, $ = id => document.getElementById(id);
export function createUI({ game, callbacks, overview, flyTo, placePolicies, islandOf, islandNear, setDistrictRanks, renderer, follow }) {
  const S = window.PIStore, G = game.G; const fmt = n => Number(n || 0).toLocaleString('zh-TW');
  const todayTPE = () => new Date().toLocaleDateString('en-CA', { timeZone: C.election.tz }); const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const eveDate = () => new Date((dayNum(C.election.date) - 1) * 86400000).toISOString().slice(0, 10); const isFinalNow = () => dayNum(todayTPE()) >= dayNum(eveDate()); const daysToEve = () => dayNum(eveDate()) - dayNum(todayTPE());
  // 議題輪替：大選前夜起一律總攻擊；平常從已開放的議題裡隨機挑，和上一波不同
  function rotation() { const today = todayTPE(); const open = issues.filter(i => i.id !== C.election.finalIssueId && (!i.startsAt || i.startsAt <= today)); return open.length ? open : issues.filter(i => i.id !== C.election.finalIssueId); }
  function pickNext(lastId) { if (isFinalNow()) return issues.find(i => i.id === C.election.finalIssueId) || issues[0]; const pool = rotation(); const cand = pool.length > 1 ? pool.filter(i => i.id !== lastId) : pool; return cand[Math.floor(Math.random() * cand.length)] || issues[0]; }
  function todaysIssue(list) { if (isFinalNow()) return list.find(i => i.id === C.election.finalIssueId) || list[0]; const today = todayTPE(); const open = list.filter(i => i.startsAt && i.startsAt <= today).sort((a, b) => a.startsAt < b.startsAt ? 1 : -1); return open[0] || list[0]; }
  let issues = [], policies = [], people = [], chosenIssue = null, nextTimer = 0, online = 1, onlineNames = [], chosenCls = 'chief', globals = { waves: 0, blocked: 0, heroes: 0 }; const districtName = id => (C.islands.find(i => i.id === id) || {}).name || '';
  const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  let clsPicked = false, districtPicked = false; const DISTRICTS = C.islands.filter(i => !i.detached);
  // 沒存過區的人先隨機給一區，大家一進來就算進 12 區對抗；可以自己換
  const randomDistrict = DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)].id;
  $('homeDistrict').innerHTML = DISTRICTS.map(i => `<option value="${i.id}">${i.name}</option>`).join(''); $('homeDistrict').value = randomDistrict;
  $('homeDistrict').addEventListener('change', () => { districtPicked = true; renderDistricts(); renderGoWho(); });
  function renderGoWho() { const h = S.hero() || {}, d = districtName(myDistrict()), random = !districtPicked && !h.district; $('goWho').textContent = `以${C.heroes[chosenCls].name}替${d}出戰${random ? '（區是隨機選的，可以換）' : ''}。`; }
  // 怎麼玩：數字都從 config 帶，改參數不用改文案
  const HOWTO = () => [
    ['選英雄、選你的區', `${Object.keys(C.heroes).length} 種職業各有專長。選一個行政區，你擋下的網軍都算進那一區，英雄也會從那座島出發。`],
    ['守住市政府', `一場約 ${Math.round(RC.seconds / 60)} 分鐘。網軍依當天議題從${Object.values(C.landings).map(l => l.name).join('、')}登陸，沿步道和橋走向信義區市政府；擠進門口滿意度就會掉。`],
    ['英雄怎麼打', `自動攻擊開著時，英雄自己找最前面的網軍開火。點島嶼＝走過去（${C.heroMode.manualSeconds} 秒內聽你的），點網軍＝重擊（傷害 ×${RC.focusDmgMul}）。`],
    ['大招', `「台北人站出來」：全地圖網軍扣 ${Math.round(RC.ultPct * 100)}% 血並減速，冷卻 ${RC.ultCooldown} 秒。按大招鈕或 Q。`],
    ['快捷鍵與手勢', '電腦：A 自動攻擊開關、空白鍵暫停、H 全景、F 跟隨鏡頭、Esc 關政策卡。手機：單指拖地圖、雙指縮放旋轉。'],
    ['居民與市長', `每區居民平常在步道散步，網軍一來就圍上去勸退。${C.mayor.name} NPC 依序巡迴每棟政策建築，回合中每講一次滿意度 +${C.mayor.approvalPerSpeech}%。`],
    ['政策建築', '每棟建築是一項政策，點了看摘要、細項、主責局處，還有市長幾站後到、相關議題哪天開打。'],
    ['議題輪替', `不用選，每波自動換議題，新議題依日期開放；大選前一晚（${eveDate()}）所有網軍一起來總攻擊。`],
    ['12 區對抗', '各區擋下的網軍加總排名，地圖上的區名後面會掛名次。拉同區的朋友一起守，把你的區推上第一。'],
    ['一起守', '其他線上玩家的英雄會出現在你的地圖上幫忙打。用表情列打招呼、點別人的英雄擊掌，大招大家都看得到。'],
    ['一定守得住', `第 ${RC.surgeAt} 秒起全民護城，${RC.wipeAt} 秒清場。二創惡搞，每一波都守得下來。`],
  ];
  $('howto').innerHTML = $('howtoHelp').innerHTML = HOWTO().map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('');
  // 遊戲中右上「?」隨時看怎麼玩
  const closeHelp = () => { $('helpOverlay').hidden = true; };
  $('btnHelp').addEventListener('click', () => { $('helpOverlay').hidden = false; }); $('btnHelpClose').addEventListener('click', closeHelp); $('helpOverlay').addEventListener('click', e => { if (e.target === $('helpOverlay')) closeHelp(); });
  // 12 區對抗：大廳排名、地圖區名掛名次
  const myDistrict = () => $('homeDistrict').value || null;
  // 回合中把自己這波已擋下的也先加進自己的區（左上排名即時跳動）；結算後由 recordRound 正式記進戰績
  let rankSig = '';
  function liveBoard() { const board = S.districtBoard(), mine = (G.phase === 'round' && G.hero && G.hero.district) || myDistrict(); if (G.phase === 'round' && G.kills) { const r = board.find(x => x.id === mine); if (r) r.kills += G.kills; board.sort((a, b) => b.kills - a.kills || b.heroes - a.heroes); } return { board, mine }; }
  function renderDistricts() { const { board, mine } = liveBoard(), top = Math.max(1, board[0] ? board[0].kills : 0);
    $('dboard').innerHTML = board.map((r, i) => `<li class="${r.id === mine ? 'mine' : ''}" data-id="${r.id}"><span class="rank">${r.kills ? i + 1 : '–'}</span><span class="who">${esc(r.name)}${r.id === mine ? ' <em>你的區</em>' : ''}</span><b>${fmt(r.kills)}</b><small>${r.heroes} 人</small><i style="width:${(r.kills / top * 100).toFixed(1)}%"></i></li>`).join('');
    // 左上 12 區對抗面板：展開列全部 12 區，收合只留第 1 名（標題列寫自己的區第幾、擋下幾隻）
    const mi = board.findIndex(r => r.id === mine); $('dpMine').innerHTML = mi >= 0 && board[mi].kills ? `你的區第 ${mi + 1}<em>・${fmt(board[mi].kills)}</em>` : '';
    $('dpList').innerHTML = board.map((r, i) => `<li class="${r.id === mine ? 'mine' : ''}"><span class="r">${r.kills ? i + 1 : '–'}</span><span class="n">${esc(r.name)}</span><b>${fmt(r.kills)}</b><i style="width:${(r.kills / top * 100).toFixed(1)}%"></i></li>`).join('');
    const sig = mine + '|' + board.map(r => r.id + (r.kills > 0 ? 1 : 0)).join(','); if (sig !== rankSig) { rankSig = sig; setDistrictRanks(board, mine); } }
  // 收合狀態記在裝置上；沒記過的話桌機預設展開、手機預設收合
  const setDpOpen = open => { $('dPanel').classList.toggle('open', open); $('dpHead').setAttribute('aria-expanded', String(open)); };
  setDpOpen((() => { try { const v = localStorage.getItem(C.ui.districtPanelKey); if (v) return v === 'open'; } catch (e) {} return !matchMedia('(max-width:900px)').matches; })());
  $('dpHead').addEventListener('click', () => { const open = !$('dPanel').classList.contains('open'); setDpOpen(open); try { localStorage.setItem(C.ui.districtPanelKey, open ? 'open' : 'closed'); } catch (e) {} });
  $('dboard').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (!li) return; $('homeDistrict').value = li.dataset.id; districtPicked = true; renderDistricts(); });
  function districtLine(res) { const id = res.hero.district; if (!id) return '這波沒有算進 12 區對抗：回大廳選一個行政區，下一波起就會替那區記分。'; const board = S.districtBoard(), i = board.findIndex(r => r.id === id), me = board[i], name = districtName(id);
    if (i === 0) { const gap = me.kills - (board[1] ? board[1].kills : 0); return `你替${name}擋下 ${fmt(res.kills)} 隻。${name}暫居 12 區第 1 名，領先第 2 名 ${fmt(gap)} 隻。`; }
    const up = board[i - 1]; return `你替${name}擋下 ${fmt(res.kills)} 隻。${name}目前第 ${i + 1} 名，再 ${fmt(up.kills - me.kills + 1)} 隻就超過${up.name}。`; }
  function renderLobby() { const h = S.hero() || {}; const me = S.state.me; if (!$('nick').value) $('nick').value = h.nick || me.name || ''; if (!clsPicked && h.cls) chosenCls = h.cls; if (!districtPicked && h.district && DISTRICTS.some(i => i.id === h.district)) $('homeDistrict').value = h.district; renderGoWho(); /* 已存的英雄只當預設值，使用者點選過就以點選為準 */
    $('classes').innerHTML = Object.entries(C.heroes).map(([id, H]) => `<button type="button" class="cls" data-id="${id}" aria-pressed="${id === chosenCls}"><span class="ic">${H.icon}</span><span><b>${H.name}</b><small>${H.desc}</small></span></button>`).join('');
    $('classes').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { chosenCls = b.dataset.id; clsPicked = true; renderLobby(); }));
    if (issues.length) { if (!chosenIssue || !issues.find(i => i.id === chosenIssue.id)) chosenIssue = pickNext(null);
    const rot = rotation(); const cur = chosenIssue;
    $('issues').innerHTML = `<div class="issue" aria-pressed="true" data-id="${esc(cur.id)}"><span class="tag">${esc(cur.tag)}</span><span><b>${esc(cur.title)}${cur.id === C.election.finalIssueId ? ' <em class="final">大選前夜</em>' : ' <em>下一波</em>'}</b><small>${esc(cur.desc || '')}</small></span></div>` + `<div class="rotation">${rot.filter(i => i.id !== cur.id).map(i => `<span>${esc(i.tag)}</span>`).join('')}</div>`; }
    const d = daysToEve(); $('countdown').textContent = d > 0 ? `距離大選前夜總攻擊還有 ${d} 天（${eveDate()}）` : d === 0 ? '今晚就是總攻擊之夜' : `總攻擊已於 ${eveDate()} 擋下，可隨時重演`;
    $('onlineList').innerHTML = online > 1 ? `<p><b>${fmt(online)}</b> 人在線・<b>${fmt(playingCount())}</b> 人正在守</p><ol class="plist">${sortedPeople().map(p => personRow(p, false)).join('')}</ol>` : '目前只有你，邀朋友一起來守。';
    $('lobbyStats').innerHTML = `<div><b>${fmt(online)}</b><span>人在線</span></div><div><b>${fmt(globals.waves)}</b><span>${C.site.waveWord}已阻擋</span></div><div><b>${fmt(globals.blocked)}</b><span>隻網軍被擋下</span></div><div><b>${fmt(globals.heroes)}</b><span>位英雄參戰</span></div>`.replace(/<div><b>[^<]*<\/b><span>位英雄參戰<\/span><\/div>$/, '');
    $('mine').textContent = h.rounds ? `你已經守了 ${h.rounds} 波、擊退 ${fmt(h.kills)} 隻。` : '你還沒出戰過。';
    $('modeNote').textContent = S.state.mode === 'supabase' ? '已連線：戰績與線上人數和所有人共享。' : S.state.mode === 'remote' ? (S.state.canWrite === false ? '目前只能瀏覽：你的戰績不會計入共享總數。' : '戰績會計入所有人的共享總數。') : '本機模式：沒有連到共享後端，戰績只存在這個瀏覽器。';
    $('adminBox').hidden = !(S.state.canEdit && S.state.mode === 'remote'); }
  function renderBoard(list) { $('board').innerHTML = list.length ? list.map((h, i) => `<li><span class="rank">${i + 1}</span><span class="who">${esc(h.nick || '匿名英雄')} <small>${C.heroes[h.cls] ? C.heroes[h.cls].icon : ''}</small></span><b>${fmt(h.kills)}</b><small>${h.rounds || 0} 波</small></li>`).join('') : '<li class="empty">還沒有人出戰。第一個就是你。</li>'; }
  function renderStrip() { $('gOnline').textContent = fmt(online); const playing = playingCount(); $('gPlaying').textContent = playing ? `・${fmt(playing)} 人在守` : ''; $('gWaves').textContent = fmt(globals.waves); $('gBlocked').textContent = fmt(globals.blocked); $('gHeroes').textContent = fmt(globals.heroes); const d = daysToEve(); $('gCountdown').textContent = d > 0 ? `總攻擊倒數 ${d} 天` : '總攻擊之夜'; }
  function renderHud() { const inRound = G.phase === 'round'; const left = Math.max(0, RC.seconds - G.t); $('timer').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`; $('approval').textContent = Math.max(0, Math.round(G.approval)); const bar = $('approvalBar'); bar.style.width = Math.max(0, G.approval) + '%'; bar.dataset.level = G.approval > 50 ? 'ok' : G.approval > 25 ? 'mid' : 'low';
    $('waveLabel').textContent = inRound ? `第 ${G.waveNo} 波・${G.issue.tag}${G.final ? '・總攻擊' : ''}` : '大廳'; $('enemies').textContent = inRound ? `${G.enemies.length} 隻在島上・${G.queue.length} 隻在路上・${G.residents.filter(r => r.state === 'engage' || r.state === 'fight').length} 位居民出動` : `${G.residents.length} 位居民在島上散步`; $('btnPause').disabled = !inRound; $('btnSpeed').disabled = !inRound; $('hudPanel').classList.toggle('round', inRound); }
  function renderHero() { const p = $('heroPanel'); if (!G.hero) { p.hidden = true; return; } const H = G.hero.cfg; p.hidden = false; $('heroName').textContent = `${H.icon} ${G.hero.nick || H.name}（${H.name}）`; $('focusCd').textContent = G.focusCd > 0 ? `重擊冷卻 ${G.focusCd.toFixed(1)} 秒` : (G.auto ? `點敵人：重擊 ×${RC.focusDmgMul}・點島嶼：移動` : `自由逛逛：點地圖走過去・點玩家擊掌・點敵人重擊`); const ab = $('btnAuto'); ab.setAttribute('aria-checked', String(G.auto)); $('autoSt').textContent = G.auto ? '開' : '關・自由逛逛'; const u = $('btnUlt'); u.disabled = G.ultCd > 0 || G.phase !== 'round'; const uh = G.ultCd > 0 ? `台北人站出來（${Math.ceil(G.ultCd)}s）` : `<span class="ic">${ICONS.cheer}</span> 台北人站出來<span class="kbd">（Q）</span>`; if (u.innerHTML !== uh) u.innerHTML = uh; }
  function renderLog(log) { $('log').innerHTML = log.map(l => `<li class="${l.cls}"><time>${l.t}</time><span>${esc(l.txt)}</span></li>`).join(''); }
  let bannerT = 0; function banner(txt, secs) { const b = $('banner'); b.textContent = txt; b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), secs * 1000); }
  let hintT = 0; function hint(txt, bad) { const h = $('hint'); h.textContent = txt || '點島嶼讓英雄走過去；點敵人重擊；拖曳旋轉、滾輪縮放。'; h.classList.toggle('bad', !!bad); clearTimeout(hintT); hintT = setTimeout(() => hint(''), bad ? 1500 : 4000); }
  // 打完一波不跳視窗：上方小提示寫戰果與區排名，autoNextSeconds 秒後直接開下一波；要換英雄按提示裡的「回大廳換英雄」
  let toastT = 0;
  async function onEnd(res) { await S.recordRound(res); globals = S.totals(); renderStrip(); renderDistricts();
    $('wtTitle').textContent = res.final ? `總攻擊擋下了！第 ${res.waveNo} 波` : `第 ${res.waveNo} 波已阻擋！`;
    $('wtText').textContent = `${res.tag} 擊退 ${fmt(res.kills)} 隻・滿意度 ${res.approval}%${res.leaked ? `・${res.leaked} 隻擠進門口` : ''}・大家已擋 ${fmt(globals.waves)} 波`; $('wtDistrict').textContent = districtLine(res);
    chosenIssue = pickNext(res.issueId); let deadline = Date.now() + C.round.autoNextSeconds * 1000; clearTimeout(toastT); $('waveToast').hidden = false;
    const tick = () => { const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000)); $('wtNext').textContent = `下一波 ${chosenIssue.tag} ${chosenIssue.title}・${left} 秒後開始`; return left; };
    tick(); clearInterval(nextTimer); nextTimer = setInterval(() => { if (document.hidden) { deadline += 250; return; } if (tick() <= 0) { clearInterval(nextTimer); startRound(); toastT = setTimeout(() => { $('waveToast').hidden = true; }, C.round.toastLinger * 1000); } }, 250); }
  // ── 政策卡：編號標題、摘要、為什麼、細項、主責局處、遊戲裡的狀態（市長巡迴、相關議題）、相關政策 ──
  let cardPol = null, cardIsl = null, cardTimer = 0; const tagOf = p => String(p.tag || '').replace(/^#/, ''); const md = s => s.split('-').slice(1).map(Number).join('/');
  function mayorLine(pol) { const M = G.mayor, st = game.mayorStops(), n = st.length, me = st.findIndex(x => x.pol.id === pol.id); if (!M || me < 0) return ''; const who = esc(C.mayor.name), bonus = `回合中每講一次滿意度 +${C.mayor.approvalPerSpeech}%`;
    if (M.state === 'speech' && M.current && M.current.pol.id === pol.id) return `${who}正在這裡宣傳，附近居民停下來揮手`;
    const ahead = (me - M.stop % n + n) % n; return ahead === 0 ? `${who}正在走過來；${bonus}` : `巡迴路線第 ${me + 1}／${n} 站，${who}還有 ${ahead} 站到這裡；${bonus}`; }
  function issueLine(pol) { const iss = pol.issue && issues.find(i => i.id === pol.issue); if (!iss) return ''; const t = `${esc(iss.tag)}「${esc(iss.title)}」`;
    if (G.phase === 'round' && G.issue && G.issue.id === iss.id) return `${t}這一波正在打，網軍就是衝著這項來的`;
    if (isFinalNow()) return `大選前夜總攻擊，${t}的網軍也會一起來`;
    if (iss.startsAt && iss.startsAt > todayTPE()) return `${t} ${md(iss.startsAt)} 開打，還有 ${dayNum(iss.startsAt) - dayNum(todayTPE())} 天`;
    return `${t}已開打，隨時可能輪到這一波`; }
  function related(pol, isl) { const others = policies.filter(p => p.id !== pol.id); const same = others.filter(p => tagOf(p) === tagOf(pol)); return [...same, ...others.filter(p => !same.includes(p) && islandOf(p.id) === isl)].slice(0, 4); }
  function renderCardGame() { if (!cardPol) return; const html = [['市長', mayorLine(cardPol)], ['議題', issueLine(cardPol)]].filter(r => r[1]).map(([k, v]) => `<li><span class="k">${k}</span><span>${v}</span></li>`).join(''); if ($('cardGame').innerHTML !== html) $('cardGame').innerHTML = html; $('cardGame').parentElement.hidden = !html; }
  function showCard(pol, islandId) { if (!pol) return; cardPol = pol; cardIsl = islandId; const c = $('card'); if (c.hidden) setCardFull(false); c.hidden = false; c.scrollTop = 0; const facts = pol.facts || [], ags = pol.agencies || [], iss = pol.issue && issues.find(i => i.id === pol.issue), no = policies.findIndex(p => p.id === pol.id) + 1;
    $('cardIcon').innerHTML = policyIcon(pol.tag); $('cardNo').textContent = `POLICY ${String(no).padStart(2, '0')}`; $('cardTag').textContent = pol.tag || '政策'; $('cardTitle').textContent = pol.title;
    $('cardSummary').textContent = pol.summary || ''; $('cardWhy').textContent = pol.why || ''; $('cardWhy').hidden = !pol.why;
    $('cardChips').innerHTML = [`<span class="chip c"><i></i>${esc(districtName(islandId))}${pol.district ? '' : '・隨機落島'}</span>`, facts.length && `<span class="chip">${facts.length} 個細項</span>`, ags.length && `<span class="chip">${ags.length} 個主責局處</span>`, iss && `<span class="chip y"><i></i>議題 ${esc(iss.tag)}</span>`].filter(Boolean).join('');
    $('cardFacts').innerHTML = facts.map(f => `<li>${esc(f)}</li>`).join(''); $('cardFacts').parentElement.hidden = !facts.length;
    $('cardAgencies').innerHTML = ags.map(a => `<span class="chip">${esc(a)}</span>`).join(''); $('cardAgSec').hidden = !ags.length;
    const rel = related(pol, islandId); $('cardRelated').innerHTML = rel.map(p => `<button type="button" class="chip" data-pol="${esc(p.id)}"><span>${policyIcon(p.tag)}</span>${esc(p.title)}</button>`).join(''); $('cardRelSec').hidden = !rel.length;
    $('cardStatus').textContent = pol.status || '二創惡搞遊戲・政策內容整理自公開資訊、僅供參考，以官方公告為準'; $('btnCardFly').onclick = () => flyTo(islandId);
    renderCardGame(); clearInterval(cardTimer); cardTimer = setInterval(() => { if ($('card').hidden) { clearInterval(cardTimer); return; } renderCardGame(); }, 1000); }
  const setCardFull = on => { $('card').classList.toggle('full', on); $('cardGrip').setAttribute('aria-expanded', String(on)); };
  const closeCard = () => { $('card').hidden = true; setCardFull(false); clearInterval(cardTimer); };
  $('btnCardClose').addEventListener('click', closeCard);
  // 手機抽屜：點把手展開／收合；往上滑展開，往下滑收合（已收合就關掉）
  let gripY = null; const grip = $('cardGrip');
  grip.addEventListener('pointerdown', e => { gripY = e.clientY; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointerup', e => { if (gripY == null) return; const dy = e.clientY - gripY, full = $('card').classList.contains('full'); gripY = null; if (dy > 40) { if (full) setCardFull(false); else closeCard(); } else if (dy < -40) setCardFull(true); else setCardFull(!full); });
  grip.addEventListener('click', e => { if (e.detail === 0) setCardFull(!$('card').classList.contains('full')); }); // 鍵盤
  $('cardRelated').addEventListener('click', e => { const b = e.target.closest('[data-pol]'); const p = b && policies.find(x => x.id === b.dataset.pol); if (!p) return; const isl = islandOf(p.id); showCard(p, isl); flyTo(isl); });
  // ── 後台：政策 / 議題（編輯者）──
  function fillPolicySelect() { const sel = $('pSel'); sel.innerHTML = '<option value="">＋ 新增政策</option>' + policies.map(p => `<option value="${esc(p.id)}">${esc(p.title)}（${esc(p.id)}）</option>`).join(''); const d = $('pDistrict'); d.innerHTML = '<option value="">不指定（隨機落島）</option>' + C.islands.map(i => `<option value="${i.id}">${i.name}</option>`).join(''); const mdl = $('pModel'); if (!mdl.children.length) mdl.innerHTML = ['housing','nursery','elderhome','busstop','dome','techcampus','school','smartpole','garden','crane','containers','theater','kiosk','station','crossing','nightmarket','hub','card','court','bigtree','levee'].map(k => `<option>${k}</option>`).join(''); }
  function fillIssueSelect() { const sel = $('iSel'); sel.innerHTML = '<option value="">＋ 新增議題</option>' + issues.map(i => `<option value="${esc(i.id)}">${esc(i.title)}（${esc(i.id)}）</option>`).join(''); const pi = $('pIssue'), cur = pi.value; pi.innerHTML = '<option value="">無</option>' + issues.map(i => `<option value="${esc(i.id)}">${esc(i.tag)} ${esc(i.title)}</option>`).join(''); pi.value = cur; }
  $('pSel').addEventListener('change', ev => { const f = $('policyForm'); const p = policies.find(x => x.id === ev.target.value); f.reset(); if (!p) return; f.pid.value = p.id; f.ptitle.value = p.title || ''; f.ptag.value = p.tag || ''; f.pModel.value = p.model || 'kiosk'; f.pDistrict.value = p.district || ''; f.psummary.value = p.summary || ''; f.pwhy.value = p.why || ''; f.pfacts.value = (p.facts || []).join('\n'); f.pagencies.value = (p.agencies || []).join(', '); f.pIssue.value = p.issue || ''; });
  $('iSel').addEventListener('change', ev => { const f = $('issueForm'); const i = issues.find(x => x.id === ev.target.value); f.reset(); if (!i) return; f.iid.value = i.id; f.title.value = i.title || ''; f.tag.value = i.tag || ''; f.startsAt.value = i.startsAt || ''; f.intensity.value = i.intensity || 1; f.boss.value = i.boss || ''; f.mix.value = Object.entries(i.mix || {}).map(([k, v]) => `${k}:${v}`).join(', '); f.chants.value = (i.chants || []).join(', '); f.desc.value = i.desc || ''; f.querySelectorAll('input[name=routes]').forEach(cb => { cb.checked = (i.routes || []).includes(cb.value); }); });
  $('policyForm').addEventListener('submit', async ev => { ev.preventDefault(); const f = ev.target; const pol = { id: f.pid.value.trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 32), title: f.ptitle.value.trim().slice(0, 20), tag: f.ptag.value.trim().slice(0, 16), model: f.pModel.value, district: f.pDistrict.value || null, summary: f.psummary.value.trim().slice(0, 120), why: f.pwhy.value.trim().slice(0, 60), facts: f.pfacts.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8), agencies: f.pagencies.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean).slice(0, 4), issue: f.pIssue.value || null };
    if (!pol.id || !pol.title) { $('pMsg').textContent = '需要代號與標題。'; return; } try { await S.addPolicy(pol); $('pMsg').textContent = `已儲存「${pol.title}」${pol.district ? '，放在' + districtName(pol.district) : '，隨機落島'}。`; f.reset(); } catch (e) { $('pMsg').textContent = '儲存失敗：' + (e.message || e.code || e); } });
  function heroFromForm() { const nick = $('nick').value.trim().slice(0, 24); return { nick: nick || C.heroes[chosenCls].name, cls: chosenCls, district: myDistrict() }; }
  async function startRound() { clearInterval(nextTimer); const hero = heroFromForm(); S.setPresence({ nick: hero.nick, cls: hero.cls, phase: 'round' }); await S.saveHero({ nick: hero.nick, cls: hero.cls, district: hero.district }); const final = isFinalNow() || chosenIssue.id === C.election.finalIssueId; const waveNo = (S.totals().waves || 0) + 1; $('lobby').hidden = true; game.startRound(chosenIssue, hero, waveNo, final); game.setAuto(loadAuto()); renderHero(); hint(''); overview(); }
  // ── 跟隨鏡頭 ──
  const FOLLOW_NAME = { mayor: () => C.mayor.name, hero: () => (G.hero && (G.hero.nick || G.hero.cfg.name)) || '我的英雄', enemy: () => '最前線的敵人' };
  function renderFollow() { const k = follow.kind; $('followBar').hidden = !k; $('btnFollow').setAttribute('aria-pressed', String(!!k)); if (!k) return;
    let txt = `跟隨中：${FOLLOW_NAME[k]()}`; if (k === 'mayor' && G.mayor) { const M = G.mayor; txt += M.state === 'speech' && M.current ? `・正在宣傳「${M.current.pol.title}」` : M.current ? '・前往下一個政策' : '・出發巡迴'; }
    if (k === 'enemy') { let best = null; for (const e of G.enemies) if (!e.dead && (!best || e.prog / e.route.total > best.prog / best.route.total)) best = e; if (best) txt += `・${C.animals[best.type].name}`; }
    $('followText').textContent = txt; $('btnFollowHero').disabled = !G.hero; $('btnFollowEnemy').disabled = !G.enemies.length; for (const [id, kk] of [['btnFollowMayor', 'mayor'], ['btnFollowHero', 'hero'], ['btnFollowEnemy', 'enemy']]) $(id).setAttribute('aria-pressed', String(k === kk)); }
  const doFollow = kind => { if (!follow.start(kind)) { hint(kind === 'enemy' ? '現在沒有敵人' : '還沒有可以跟隨的對象', true); return; } $('card').hidden = true; renderFollow(); };
  $('btnFollow').addEventListener('click', () => { if (follow.kind) { follow.stop(); renderFollow(); } else doFollow('mayor'); });
  $('btnFollowMayor').addEventListener('click', () => doFollow('mayor')); $('btnCardMayor').addEventListener('click', () => doFollow('mayor')); $('btnFollowHero').addEventListener('click', () => doFollow('hero')); $('btnFollowEnemy').addEventListener('click', () => doFollow('enemy'));
  $('btnUnfollow').addEventListener('click', () => { follow.stop(); renderFollow(); });
  Object.assign(callbacks, { follow: () => renderFollow() });
  Object.assign(callbacks, { hud: renderHud, log: renderLog, banner, hint, end: onEnd, hero: renderHero, card: showCard });
  // ── 多人同框：送自己的英雄位置、收別人的英雄、表情與擊掌 ──
  const MP = C.multi, EM = new Map([...MP.emotes, MP.five].map(e => [e.k, e])); let lastSent = null, lastSentAt = 0, lastEmoteAt = 0; const rxAt = new Map(), rxEmoteAt = new Map();
  const myId = () => S.state.uid;
  function sendPos() { const H = G.hero; if (!H) return; const now = Date.now(); const inRound = G.phase === 'round'; const every = Math.min(MP.sendMax, Math.max(MP.sendEvery, online * MP.sendPerPlayer)) * 1000;
    const moved = !lastSent || Math.hypot(H.pos.x - lastSent.x, H.pos.z - lastSent.z) > 0.08 || lastSent.r !== inRound; if (now - lastSentAt < every || (!moved && now - lastSentAt < MP.heartbeat * 1000)) return;
    lastSent = { x: H.pos.x, z: H.pos.z, r: inRound }; lastSentAt = now; S.send({ t: 'p', n: H.nick || H.cfg.name, c: H.cls, x: Math.round(H.pos.x * 100) / 100, z: Math.round(H.pos.z * 100) / 100, r: inRound ? 1 : 0, f: H.pose === 'fight' ? 1 : 0, a: G.auto ? 1 : 0 }); }
  setInterval(() => { if (!document.hidden) sendPos(); game.pruneRemotes(S.state.onlineIds ? new Set(S.state.onlineIds) : null, performance.now()); }, 250);
  const sayBye = () => { lastSent = null; S.send({ t: 'bye' }); };
  addEventListener('pagehide', sayBye);
  // 收到的一切都是其他訪客送的：驗證型別、範圍、長度，限制頻率，名字只畫在畫布上不進 HTML
  const okNum = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 40;
  S.onNet(m => { if (!m || typeof m.id !== 'string' || m.id.length > 64 || m.id === myId()) return; const now = performance.now();
    if (m.t === 'p') { if ((now - (rxAt.get(m.id) || 0)) < MP.rxMinGap * 1000) return; rxAt.set(m.id, now); if (!Object.hasOwn(C.heroes, m.c) || !okNum(m.x) || !okNum(m.z)) return;
      const nick = (typeof m.n === 'string' ? m.n : '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24) || C.heroes[m.c].name; game.upsertRemote({ id: m.id, n: nick, c: m.c, x: m.x, z: m.z, r: !!m.r, f: !!m.f, a: m.a !== 0 }); return; }
    if (m.t === 'bye') { game.removeRemote(m.id); return; }
    if ((now - (rxEmoteAt.get(m.id) || 0)) < 800) return; rxEmoteAt.set(m.id, now);
    if (m.t === 'e') { const em = typeof m.k === 'string' && EM.get(m.k); if (!em) return; const nick = game.remoteEmote(m.id, em); if (!nick) return;
      if (em.k === 'five' && m.to === myId()) { banner(`${nick} 跟你擊掌 🙌`, 2.5); game.myEmote(MP.five); } else if (em.k === 'help') hint(`${nick}：這邊需要支援！`); return; }
    if (m.t === 'u') { const nick = game.remoteUlt(m.id); if (nick) banner(`🙌 ${nick} 喊「台北人站出來」！`, 2.5); } });
  // ── 在線名單：人數＝開著頁面的人（同一人多分頁算一個）；正在守＝在回合中且分頁在前景。點「人在線」看所有人，點守城中的人鏡頭飛過去 ──
  // 這幾個是 function 宣告（會提升）：大廳可能在這段執行前就先畫在線名單
  function statusOf(p) { return p.away ? 'away' : p.phase; }
  function playingCount() { return people.filter(p => statusOf(p) === 'round').length; }
  function sortedPeople() { const me = S.state.uid, order = { round: 0, lobby: 1, away: 2 }; return [...people].sort((a, b) => (b.id === me) - (a.id === me) || order[statusOf(a)] - order[statusOf(b)] || a.nick.localeCompare(b.nick, 'zh-Hant')); }
  function personRow(p, clickable) { const me = p.id === S.state.uid, H = p.cls && C.heroes[p.cls], st = statusOf(p), go = clickable && !me && game.remotes.has(p.id), label = { round: '守城中', lobby: '在大廳', away: '暫離' }[st];
    return `<li class="${st}${me ? ' me' : ''}${go ? ' fly' : ''}"${go ? ` data-pid="${esc(p.id)}" tabindex="0" role="button"` : ''}><i></i><span class="pn">${esc(p.nick || '匿名英雄')}${me ? ' <em>你</em>' : ''}</span><small>${H ? H.icon + ' ' : ''}${label}${clickable && st === 'round' && !me && !go ? '・還沒收到位置' : ''}</small></li>`; }
  // 每秒會重畫一次：內容沒變就不動 DOM，不然點到一半元素被換掉，點擊會失效
  function renderPlayers() { $('plTitle').textContent = `${fmt(online)} 人在線・${fmt(playingCount())} 人正在守`; const html = sortedPeople().map(p => personRow(p, true)).join('') || '<li class="empty">目前只有你</li>'; if ($('plList').dataset.html !== html) { $('plList').innerHTML = html; $('plList').dataset.html = html; } }
  const setPlayers = open => { $('playersPanel').hidden = !open; $('btnOnline').setAttribute('aria-expanded', String(open)); if (open) renderPlayers(); };
  $('btnOnline').addEventListener('click', () => setPlayers($('playersPanel').hidden)); $('btnPlClose').addEventListener('click', () => setPlayers(false));
  const goPlayer = el => { if (!el) return; const w = game.remotes.get(el.dataset.pid); if (!w) { hint('他剛離開地圖', true); renderPlayers(); return; } flyTo(islandNear(w.pos)); setPlayers(false); hint(`飛到 ${w.nick} 那邊`); };
  $('plList').addEventListener('click', e => goPlayer(e.target.closest('li[data-pid]'))); $('plList').addEventListener('keydown', e => { if (e.key === 'Enter') goPlayer(e.target.closest('li[data-pid]')); });
  // 分頁切到背景就標成暫離（背景分頁不送位置，別人的地圖上 25 秒後會看不到）；回到前景馬上補送一次位置
  document.addEventListener('visibilitychange', () => { S.setPresence({ away: document.hidden }); if (!document.hidden) { lastSent = null; sendPos(); } });
  function emote(k) { const em = EM.get(k); const now = Date.now(); if (!em || now - lastEmoteAt < MP.emoteCooldown * 1000) return; if (!game.myEmote(em)) { hint('出戰後才能跟其他玩家打招呼', true); return; } lastEmoteAt = now; S.send({ t: 'e', k }); }
  $('emotes').innerHTML = MP.emotes.map(e => `<button type="button" data-k="${esc(e.k)}" title="說：${esc(e.say)}" aria-label="${esc(e.say)}">${ICONS[e.k] || esc(e.icon)}</button>`).join('');
  for (const el of document.querySelectorAll('[data-ic]')) el.innerHTML = ICONS[el.dataset.ic] || '';
  $('emotes').addEventListener('click', ev => { const b = ev.target.closest('button[data-k]'); if (b) emote(b.dataset.k); });
  callbacks.remote = (id, w) => { if (!w) return; const now = Date.now(); if (now - lastEmoteAt < MP.emoteCooldown * 1000) return; lastEmoteAt = now; if (G.hero) game.myEmote(MP.five); S.send({ t: 'e', k: 'five', to: id }); hint(`你跟 ${w.nick} 擊掌 🙌`); };
  // 英雄面板變高時（表情列），右側熱線卡讓出空間，不疊在一起
  if (window.ResizeObserver) new ResizeObserver(() => { const h = $('heroPanel').hidden ? 0 : $('heroPanel').offsetHeight; document.documentElement.style.setProperty('--hero-h', h + 'px'); }).observe($('heroPanel'));
  // 自動攻擊開關（記在這台裝置上）
  const loadAuto = () => { try { return localStorage.getItem(C.heroMode.storageKey) !== '0'; } catch (e) { return true; } };
  function toggleAuto() { const on = !G.auto; game.setAuto(on); try { localStorage.setItem(C.heroMode.storageKey, on ? '1' : '0'); } catch (e) { /* 無痕或封鎖儲存：只影響下次預設值 */ } lastSent = null; hint(on ? '自動攻擊開：英雄會自己找最前線的網軍' : '自動攻擊關：點地圖帶英雄到處逛，點其他玩家的英雄可以擊掌'); }
  $('btnAuto').addEventListener('click', toggleAuto);
  function doUlt() { const before = G.ultCd; game.ultimate(); if (G.ultCd > before) S.send({ t: 'u' }); }
  $('btnGo').addEventListener('click', startRound);
  $('btnLobby').addEventListener('click', () => { clearInterval(nextTimer); clearTimeout(toastT); S.setPresence({ phase: 'lobby' }); $('waveToast').hidden = true; sayBye(); game.backToLobby(); renderLobby(); $('lobby').hidden = false; renderHero(); });
  $('btnPause').addEventListener('click', () => { G.paused = !G.paused; $('btnPause').textContent = G.paused ? '繼續' : '暫停'; $('btnPause').setAttribute('aria-pressed', String(G.paused)); });
  $('btnSpeed').addEventListener('click', () => { G.speed = G.speed === 1 ? 2 : 1; $('btnSpeed').setAttribute('aria-pressed', String(G.speed === 2)); });
  $('btnUlt').addEventListener('click', doUlt); $('btnHome').addEventListener('click', () => { overview(); renderFollow(); });
  const fsBtn = $('btnFull'); if (!document.fullscreenEnabled) fsBtn.hidden = true; fsBtn.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => { hint('這個環境不允許全螢幕', true); }); }); document.addEventListener('fullscreenchange', () => { fsBtn.textContent = document.fullscreenElement ? '⤡ 離開全螢幕' : '⤢ 全螢幕'; });
  $('btnLogToggle').addEventListener('click', () => { const p = $('logPanel'); p.classList.toggle('open'); });
  $('issueForm').addEventListener('submit', async ev => { ev.preventDefault(); const f = ev.target; const mix = {}; for (const t of f.mix.value.split(',')) { const [k, v] = t.split(':').map(s => s.trim()); if (C.animals[k]) mix[k] = Number(v) || 1; }
    const issue = { id: f.iid.value.trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 32), title: f.title.value.trim().slice(0, 20), tag: f.tag.value.trim().slice(0, 16), startsAt: f.startsAt.value || null, intensity: Number(f.intensity.value) || 1, routes: [...f.querySelectorAll('input[name=routes]:checked')].map(i => i.value), boss: f.boss.value || null, mix: Object.keys(mix).length ? mix : { bird: 1 }, chants: f.chants.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 12), desc: f.desc.value.trim().slice(0, 60) };
    if (!issue.id || !issue.title || !issue.routes.length) { $('issueMsg').textContent = '需要代號、標題、至少一條路線。'; return; } try { await S.addIssue(issue); $('issueMsg').textContent = `已儲存「${issue.title}」。`; f.reset(); } catch (e) { $('issueMsg').textContent = '新增失敗：' + (e.message || e.code || e); } });
  document.addEventListener('keydown', ev => { if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA') return; if (ev.key === ' ' && G.phase === 'round') { ev.preventDefault(); $('btnPause').click(); } else if (ev.key.toLowerCase() === 'q') doUlt(); else if (ev.key.toLowerCase() === 'a' && G.hero) toggleAuto(); else if (ev.key.toLowerCase() === 'h') { overview(); renderFollow(); } else if (ev.key.toLowerCase() === 'f') $('btnFollow').click(); else if (ev.key === 'Escape') { closeCard(); closeHelp(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.phase === 'round' && !G.paused) $('btnPause').click(); });
  $('siteName').textContent = C.site.name; $('siteSub').textContent = C.site.sub; $('siteTag').textContent = C.site.tag; $('parodyTitle').textContent = C.site.parody; $('parodyLong').textContent = C.site.parodyLong; $('disclaimer').textContent = C.site.disclaimer + ' ' + C.site.credit; $('parodyBadge').textContent = '二創惡搞';
  S.onGlobal(g => { globals = g; renderStrip(); if (!$('lobby').hidden) renderLobby(); }); S.onLeaderboard(list => { renderBoard(list); renderDistricts(); }); S.onIssues(list => { issues = list; fillIssueSelect(); if (!$('lobby').hidden) renderLobby(); }); S.onPolicies(list => { policies = list; fillPolicySelect(); placePolicies(list); });
  S.onOnline((n, names, list) => { online = n; onlineNames = names; people = list || []; renderStrip(); if (!$('lobby').hidden) renderLobby(); if (!$('playersPanel').hidden) renderPlayers(); });
  S.init().then(() => { const h = S.hero(); S.setPresence({ nick: (h && h.nick) || '', phase: 'lobby', away: document.hidden }); renderLobby(); }); renderHud(); renderHero(); hint('');
  // ── 市民熱線（右側卡片輪播）與城市快訊（底部跑馬燈）──
  const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  let hlQueue = [], hlDone = 0, hlTimer = 0, hlPaused = false;
  function pickHotline() { if (!hlQueue.length) hlQueue = shuffle(HOTLINE); return Math.random() < C.ticker.hotlineGenShare ? genHotline() : hlQueue.shift(); }
  let hlItems = [], hlBusy = null;
  const hlTrack = document.createElement('div'); hlTrack.className = 'hl-track'; $('hlBody').appendChild(hlTrack); $('hotline').style.setProperty('--hl-ms', C.ticker.hotlineSlideMs + 'ms');
  const HL_SEP = 17; // .hl-item 的 padding-bottom 8 + 虛線 1 + margin-bottom 8
  const hlCard = ([dist, who, ask, fix]) => { const d = document.createElement('div'); d.className = 'hl-item'; d.innerHTML = `<div class="hl-who"><span class="hl-dist">${esc(dist)}</span>${esc(who)}<span class="hl-stamp">已解決</span></div><p class="hl-ask">「${esc(ask)}」</p><div class="hl-fix"><b>🎙 市長</b>${esc(fix)}</div>`; return d; };
  // 可見高度＝第一則頂到最後一則內容底（不含最後一則的分隔線）
  const hlSpan = (from) => { const kids = [...hlTrack.children].slice(from); if (!kids.length) return 0; const a = kids[0], b = kids[kids.length - 1]; return b.offsetTop + b.offsetHeight - (HL_SEP - 8) - a.offsetTop; };
  function hlSettle() { if (!hlBusy) return; clearTimeout(hlBusy); hlBusy = null;
    while (hlTrack.children.length > C.ticker.hotlineRows) hlTrack.firstElementChild.remove();
    hlTrack.style.transition = 'none'; hlTrack.style.transform = ''; [...hlTrack.children].forEach(el => el.classList.remove('out', 'enter'));
    void hlTrack.offsetHeight; hlTrack.style.transition = ''; }
  function nextHotline(instant = false) { hlSettle();
    let it = pickHotline(); for (let k = 0; k < 8 && hlItems.some(x => x[2] === it[2] || x[3] === it[3]); k++) it = pickHotline();
    hlItems.push(it); hlItems = hlItems.slice(-C.ticker.hotlineRows); hlDone++;
    $('hlCount').textContent = `今日已解決 ${fmt(1287 + hlDone)} 件`;
    const card = hlCard(it); const body = $('hlBody');
    const full = hlTrack.children.length >= C.ticker.hotlineRows;
    const still = instant || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!full || still) { hlTrack.appendChild(card); while (hlTrack.children.length > C.ticker.hotlineRows) hlTrack.firstElementChild.remove(); body.style.height = hlSpan(0) + 'px'; return; }
    // 新的一則從底部進來，整排往上推一格，最上面那則淡出後移除
    card.classList.add('enter'); hlTrack.appendChild(card);
    const first = hlTrack.firstElementChild; const shift = hlTrack.children[1].offsetTop - first.offsetTop;
    const h = hlSpan(1);
    requestAnimationFrame(() => { hlTrack.style.transform = `translateY(${-shift}px)`; body.style.height = h + 'px'; first.classList.add('out'); card.classList.remove('enter'); });
    hlBusy = setTimeout(hlSettle, C.ticker.hotlineSlideMs + 60); }
  function scheduleHotline() { clearInterval(hlTimer); hlTimer = setInterval(() => { if (!hlPaused && !document.hidden) nextHotline(); }, C.ticker.hotlineSeconds * 1000); }
  $('hotline').addEventListener('mouseenter', () => { hlPaused = true; }); $('hotline').addEventListener('mouseleave', () => { hlPaused = false; });
  $('hlNext').addEventListener('click', () => { nextHotline(); scheduleHotline(); });
  for (let i = 0; i < C.ticker.hotlineRows; i++) nextHotline(true); scheduleHotline();
  const hlFit = () => { if (!hlBusy) $('hlBody').style.height = hlSpan(0) + 'px'; };
  addEventListener('resize', hlFit); document.fonts?.ready.then(hlFit);
  let tkCount = 0; const narrowView = () => window.matchMedia('(max-width:900px)').matches;
  const tkLabel = document.querySelector('#ticker .tk-label');
  function nextTicker() { tkCount++; let txt, html = null; const mixHot = narrowView() || tkCount % C.ticker.mixHotlineEvery === 0;
    if (mixHot && tkCount % 2 === 0) { const [dist, who, ask, fix] = pickHotline(); html = `<span class="tk-dist">${esc(dist)}</span>${esc(who)}：<b class="tk-ask">「${esc(ask)}」</b><span class="tk-arrow">→</span><span class="tk-fix">🎙 市長　${esc(fix)}</span><span class="tk-ok">已解決</span>`; }
    else { const n = nextNews(C.ticker.weights); txt = `${n.icon} ${n.text}`; }
    const el = $('tkText'); const track = el.parentElement; el.style.animation = 'none'; if (html) el.innerHTML = html; else el.textContent = txt; $('ticker').classList.toggle('hot', !!html); tkLabel.textContent = html ? '📞 1999 熱線' : '城市快訊'; void el.offsetWidth;
    const dist2 = track.clientWidth + el.scrollWidth; const dur = Math.max(6, dist2 / C.ticker.pxPerSec);
    el.style.setProperty('--from', track.clientWidth + 'px'); el.style.setProperty('--to', -el.scrollWidth + 'px'); el.style.animation = `tk ${dur}s linear 1`; }
  $('tkText').addEventListener('animationend', nextTicker); requestAnimationFrame(nextTicker);
  $('nick').addEventListener('input', () => S.setPresence({ nick: $('nick').value.trim().slice(0, 24) }));
  let distTick = 0;
  return { tick() { renderHud(); renderHero(); if (follow.kind) renderFollow(); if (++distTick % 5) return; if (G.phase === 'round') renderDistricts(); if (!$('playersPanel').hidden) renderPlayers(); } };
}
