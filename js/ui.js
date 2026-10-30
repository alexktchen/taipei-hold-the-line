/* 全版 UI：兩個世界——校園（逛校園，exploreui.js）與闖關場（大廳：開始闖關、快速配對、房間），用雲切換（main.js 的 warp）；開始闖關中的 HUD／同學名單／動作鈕／手機搖桿、結算與闖關等級、課程卡、信箱與快訊。逛校園的畫面在 exploreui.js、金蛋商店在 shop.js。 */
import { CONFIG as C } from './config.js';
import { HOTLINE } from './hotline.js';
import { nextNews, genHotline } from './news.js';
import { ICONS, policyIcon } from './icons.js';
import { createRoom } from './room.js';
import { createExploreUI } from './exploreui.js';
import { createShop } from './shop.js';
import { createQuizUI, dailyTally, topicsForGrade } from './quiz.js';
const SH = C.shift, GR = C.grades, $ = id => document.getElementById(id);
export function createUI({ game, explore, xCallbacks, placeCity, bird, policyPos, warp, frameStage, liveSigns, progress, refreshGates, islName, stageCenter, callbacks, overview, stageView, flyTo, placePolicies, islandOf, setDistrictRanks, renderer, follow, input }) {
  const S = window.PIStore, G = game.G; const fmt = n => Number(n || 0).toLocaleString('zh-TW');
  const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  const num = v => typeof v === 'number' && Number.isFinite(v), clamp = (v, a, b) => Math.max(a, Math.min(b, v)), clean = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, n) : '';
  const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const todayTPE = () => new Date().toLocaleDateString('en-CA', { timeZone: C.exam.tz }); const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const eveDate = () => new Date((dayNum(C.exam.date) - 1) * 86400000).toISOString().slice(0, 10); const isFinalNow = () => dayNum(todayTPE()) >= dayNum(eveDate()); const daysToEve = () => dayNum(eveDate()) - dayNum(todayTPE());
  // ── 闖關場輪替：每 rotateHours 小時換一個場，大家同時間看到同一個 ──
  const rotMs = C.rotateHours * 3600e3, stageAt = t => C.stages[Math.floor(t / rotMs) % C.stages.length], stageNow = () => stageAt(Date.now()), stageNext = () => stageAt(Date.now() + rotMs);
  const hms = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
  // ── 闖關等級：點數 0～100，過關 +20、失敗依波次扣；等級越高危險度越高 ──
  const TOP_LV = GR.names.length - 1;
  function myGrade() { const h = S.hero() || {}; return { lv: clamp(h.grade | 0, 0, TOP_LV), pts: clamp(h.grade_pts | 0, 0, GR.topPtsCap) }; }
  function hazardOf(lv, pts) { if (lv >= TOP_LV) return Math.min(GR.topHazardMax, GR.hazard[TOP_LV] + pts / GR.topPtsCap * (GR.topHazardMax - GR.hazard[TOP_LV])); return GR.hazard[lv] + Math.min(100, pts) / 100 * GR.hazardPerPts; }
  function gradeAfter(g, res) { let { lv, pts } = g; const d = res.clear ? GR.clear : lv < GR.failSafeBelow ? 0 : (GR.fail[clamp((res.waveNo | 0) - 1, 0, 2)] || 0); pts += d; let promoted = false, demoted = false;
    if (lv < TOP_LV && pts >= 100) { lv++; pts = GR.promoteTo; promoted = true; } else if (pts < 0) { if (lv > 0) { lv--; pts = GR.demoteTo; demoted = true; } else pts = 0; } if (lv >= TOP_LV) pts = Math.min(GR.topPtsCap, pts); return { lv, pts, d, promoted, demoted }; }
  const gradeMax = lv => lv >= TOP_LV ? GR.topPtsCap : 100;
  let issues = [], policies = [], people = [], online = 1, chosenCls = 'chief', globals = { shifts: 0, eggs: 0, workers: 0 }; const districtName = id => (C.islands.find(i => i.id === id) || {}).name || '';
  let clsPicked = false, districtPicked = false; const DISTRICTS = C.islands.filter(i => !i.detached);
  // 沒存過區的人先隨機給一區，大家一進來就算進學期對抗；可以自己換
  const randomDistrict = DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)].id;
  $('homeDistrict').innerHTML = DISTRICTS.map(i => `<option value="${i.id}">${i.name}</option>`).join(''); $('homeDistrict').value = randomDistrict;
  const myDistrict = () => $('homeDistrict').value || null, nickVal = () => $('nick').value.trim().slice(0, 24) || C.heroes[chosenCls].name;
  const myFit = () => S.econ().outfit;
  const boostTiers = () => { const d = S.econ().donated; return C.econ.donate.tiers.filter(t => d >= t.at).length; }; // 捐書全校加成：解鎖了幾階
  const myProfile = () => { const g = myGrade(); return { nick: nickVal(), cls: chosenCls, district: myDistrict(), grade: g.lv, pts: g.pts, fit: myFit() }; };
  function profileChanged() { renderGoWho(); if (room.code) room.setProfile(myProfile()); S.setPresence({ nick: nickVal(), cls: chosenCls }); syncHome(); }
  // 自己選的學期一開始就解鎖；橋頭的鎖跟著更新
  let homeSynced = ''; function syncHome() { const d = myDistrict(); if (!d || d === homeSynced) return; homeSynced = d; progress.setHome(d); refreshGates(); renderDistricts(); }
  $('homeDistrict').addEventListener('change', () => { districtPicked = true; renderDistricts(); profileChanged(); });
  function renderGoWho() { const h = S.hero() || {}, random = !districtPicked && !h.district; $('goWho').textContent = `以${C.heroes[chosenCls].name}替${districtName(myDistrict())}闖關${random ? '（學期是隨機選的，可以換）' : ''}。`; }
  // ── 玩法分頁：闖關（4 人一隊搬金蛋）／闖關（原本的舊版，大家同框）；選過的記在裝置上 ──
  // ── 兩個世界：city＝逛校園、work＝闖關場（大廳與開始闖關）──
  // 來過的人（這台裝置存過名字或角色）重新整理後不跳大廳，直接從雲端降落到自己的學期；第一次來才看到大廳（警語、取名字、選角色）；拿邀請連結進來的直接到闖關場
  const WORLD_KEY = C.explore.worldKey, RETURNING = (() => { try { const h = JSON.parse(localStorage.getItem('pi.hero.v1') || 'null'); return !!(h && (h.nick || h.cls)); } catch (e) { return false; } })();
  let world = RETURNING && !new URLSearchParams(location.search).get('room') ? 'city' : 'work';
  const setWorld = w => { world = w; try { localStorage.setItem(WORLD_KEY, w); } catch (e) { /* 無痕 */ } renderHowto(); };
  // 怎麼玩：數字都從 config 帶，改參數不用改文案
  const HOWTO = () => [
    ['選角色、選你的學期', `${Object.keys(C.heroes).length} 種角色各有武器和一招特殊技（一關 ${SH.specials} 次）。搬進籃子的金蛋都算進你選的學期。`],
    ['怎麼走', '電腦用 WASD 或方向鍵（跟著鏡頭方向走），手機用左下角搖桿；也可以直接點地面走過去。每個學期是一個用木圍欄圍起來的區塊，走到上下左右的門（過河的是木橋）就換到隔壁的區塊。'],
    ['自動攻擊', '武器會自動打射程內的敵人。點敵人＝鎖定它，射程內就優先打（打魔王很好用）。'],
    ['金蛋', `魔王倒下會掉 ${SH.egg.perBoss} 顆金蛋，走過去就撿起來（一次一顆、搬著會變慢），走進金蛋籃的黃圈就算一顆。按 E 或空白鍵可以把蛋丟出去，離籃子 ${SH.egg.throwAim} 格內丟會直接進籃。`],
    ['解題', `按 R 或右下的「解題」會出一題（依你選的學期出題），答對這一波金蛋 +${C.quiz.bonusEggs}、血補滿；答錯要等 ${C.quiz.cooldown} 秒，每關最多 ${C.quiz.perShift} 題。`],
    ['配額', `每波 ${SH.waveSeconds} 秒，時間到時搬滿配額才過關；${SH.waves} 波都過就下課。`],
    ['倒下與救人', '血條歸零會倒下（搬著的蛋會掉在地上）。隊友走到旁邊站一下就能救起來；四個人全倒，這關就結束。'],
    ['魔王', `${C.bossTypes.length} 種魔王招式都不一樣：看到地上的紅圈、紅線就閃開。招式寫在大廳的魔王圖鑑。`],
    ['特殊波', '有時候會起大霧（看不遠，金星蛙被打會一直掉蛋），或是搗蛋夜（搗蛋鼠追著被盯上的人跑，打金星鼠拿金蛋）。'],
    ['一起闖關', `快速配對或開房間拿房號邀朋友，一房最多 ${C.net.roomMax} 人，人不夠由 NPC 同學補。房主的電腦跑整關，房主離開這關就中止。`],
    ['闖關等級', `過關 +${GR.clear} 點，滿 100 升一級（${GR.names.join('→')}）。等級越高危險度越高：配額變多、魔王來得更快更硬。`],
    ['快捷鍵', 'Q 特殊技、E／空白鍵丟蛋、1 2 3 快速訊號、H 闖關場全景、F 鏡頭跟著自己、P 暫停（只有單人）、Esc 關卡片。'],
  ];
  const XC = C.explore, HOWTO_X = () => [
    ['選角色、選你的學期', `角色決定你的角色長相；角色從你選的學期出發。一開始只有幼兒園、一年級上和你的學期開著，其他學期要在相鄰的場景答對 ${C.unlock.need} 題才會解鎖（橋頭有 🔒 的牌子寫著還差幾題）。`],
    ['怎麼走', '電腦用 WASD 或方向鍵（跟著鏡頭方向走），手機用左下角搖桿；也可以直接點地板走過去。每個學期是一個場景，走到上下左右邊緣的木橋就換到隔壁的場景。'],
    ['買衣服', `走進地圖上標「👕 服飾店」的店（共 ${XC.boutiques.length} 間）買帽子、背心、配件；買過的隨時能換，闖關時也會穿著，其他玩家看得到。`],
    ['解題任務', `點課程建築打開課程卡，先看學習重點再按「解題任務」；答對每題 +${C.quiz.reward} 顆金蛋（每個單元每天 ${C.quiz.dailyCap} 題有獎勵，之後只是練習）。`],
    ['蓋校園', `全站一起投金蛋，依序蓋 ${C.econ.city.length} 棟建設；走到「🚧 工地」旁邊投。蓋好的建築換掉那個區塊裡的小房子，每個人的地圖上都看得到，投入的金蛋也算進你學期的學期對抗。`],
    ['捐書', '走到校長旁邊捐，校長會回你一句；全站累計解鎖全校加成（闖關更好過、晚上放煙火）。金蛋不是錢，這也不是真的捐款。'],
    ['帶我去', '右下的衣櫃、蓋校園、捐書按鈕會開面板；不在地點旁邊時按「帶我去」自動走過去。'],
    ['一起逛', '其他正在逛的人也在同一張地圖上。表情列打招呼（1～4）、點別人擊掌。'],
    ['工具列', '下方可以換時段（清晨、白天、黃昏、夜晚）、開關名牌、停住時間、鳥瞰全校、打開課程清單（點一項就走過去）。快捷鍵：E 進去、B 鳥瞰、L 清單、F 跟著自己、H 全景。'],
  ];
  const LEAD = { shift: '闖關場是一個學期的區塊，金蛋籃在區塊前方的廣場上；開始闖關時四道門會關上。小怪會從圍欄外一波波翻進來，打倒魔王會掉金蛋，搬進籃子湊滿配額才算過關，三波都過就下課。隨時按 R 解題，答對直接加金蛋。進場後點右上角的「?」也能隨時看。', explore: '帶著你的角色在草原小鎮散步：點課程建築看學習重點、按「解題任務」答題賺金蛋，走進服飾店買衣服、到工地投金蛋蓋校園、找校長捐書。其他正在逛的人也在同一張地圖上。' };
  const li = list => list.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('');
  function renderHowto() { $('howto').innerHTML = li(HOWTO()); $('howtoLead').textContent = LEAD.shift; $('howtoHelp').innerHTML = li(world === 'city' ? HOWTO_X() : HOWTO()); $('helpTitle').textContent = world === 'city' ? '逛校園怎麼玩' : '闖關怎麼玩'; }
  renderHowto();
  $('bossList').innerHTML = C.bossTypes.map(k => C.animals[k]).map(A => `<li><b>${esc(A.name)}</b><span>${esc(A.desc)}</span></li>`).join('');
  const closeHelp = () => { $('helpOverlay').hidden = true; };
  $('btnHelp').addEventListener('click', () => { $('helpOverlay').hidden = false; }); $('btnHelpClose').addEventListener('click', closeHelp); $('helpOverlay').addEventListener('click', e => { if (e.target === $('helpOverlay')) closeHelp(); });
  // ── 學期對抗：大廳排名、左上面板、地圖區名掛名次（分數＝金蛋）──
  let rankSig = '';
  function renderDistricts() { const board = S.districtBoard(), mine = myDistrict(), top = Math.max(1, board[0] ? board[0].eggs : 0);
    $('dboard').innerHTML = board.map((r, i) => `<li class="${r.id === mine ? 'mine' : ''}" data-id="${r.id}"><span class="rank">${r.eggs ? i + 1 : '–'}</span><span class="who">${progress.isUnlocked(r.id) ? '' : '🔒 '}${esc(r.name)}${r.id === mine ? ' <em>你的學期</em>' : ''}</span><b>${fmt(r.eggs)}</b><small>${r.workers} 人</small><i style="width:${(r.eggs / top * 100).toFixed(1)}%"></i></li>`).join('');
    const mi = board.findIndex(r => r.id === mine); $('dpMine').innerHTML = mi >= 0 && board[mi].eggs ? `你的學期第 ${mi + 1}<em>・${fmt(board[mi].eggs)} 顆</em>` : '';
    $('dpList').innerHTML = board.map((r, i) => `<li class="${r.id === mine ? 'mine' : ''}${progress.isUnlocked(r.id) ? '' : ' locked'}"><span class="r">${r.eggs ? i + 1 : '–'}</span><span class="n">${progress.isUnlocked(r.id) ? '' : '🔒 '}${esc(r.name)}</span><b>${fmt(r.eggs)}</b><i style="width:${(r.eggs / top * 100).toFixed(1)}%"></i></li>`).join('');
    const sig = mine + '|' + board.map(r => r.id + (r.eggs > 0 ? 1 : 0)).join(','); if (sig !== rankSig) { rankSig = sig; setDistrictRanks(board.map(r => ({ ...r, kills: r.eggs })), mine); } }
  const setDpOpen = open => { $('dPanel').classList.toggle('open', open); $('dpHead').setAttribute('aria-expanded', String(open)); };
  setDpOpen((() => { try { const v = localStorage.getItem(C.ui.districtPanelKey); if (v) return v === 'open'; } catch (e) {} return !matchMedia('(max-width:900px)').matches; })());
  $('dpHead').addEventListener('click', () => { const open = !$('dPanel').classList.contains('open'); setDpOpen(open); try { localStorage.setItem(C.ui.districtPanelKey, open ? 'open' : 'closed'); } catch (e) {} });
  $('dboard').addEventListener('click', e => { const li = e.target.closest('li[data-id]'); if (!li) return; $('homeDistrict').value = li.dataset.id; districtPicked = true; renderDistricts(); profileChanged(); });
  function districtLine(eggs, id) { if (!id) return ''; const board = S.districtBoard(), i = board.findIndex(r => r.id === id), me = board[i], name = districtName(id); if (!me) return ''; if (!me.eggs) return `${name}還沒有金蛋入籃，搬一顆就能上學期對抗榜。`;
    if (i === 0) return `你替${name}搬了 ${fmt(eggs)} 顆金蛋。${name}暫居 12 區第 1 名，領先第 2 名 ${fmt(me.eggs - (board[1] ? board[1].eggs : 0))} 顆。`;
    const up = board[i - 1]; return `你替${name}搬了 ${fmt(eggs)} 顆金蛋。${name}目前第 ${i + 1} 名，再 ${fmt(up.eggs - me.eggs + 1)} 顆就超過${up.name}。`; }
  // ── 大廳 ──
  function renderGrade() { const g = myGrade(), max = gradeMax(g.lv); $('gradeCard').innerHTML = `<div class="gl"><span class="k">闖關等級</span><b>${esc(GR.names[g.lv])}</b><span class="pts">${g.pts}／${max}</span></div><span class="bar"><i style="width:${Math.min(100, g.pts / max * 100).toFixed(1)}%"></i></span><small>危險度 ${Math.round((hazardOf(g.lv, g.pts) + (isFinalNow() ? C.exam.hazardBonus : 0)) * 100)}%・過關 +${GR.clear}${g.lv >= GR.failSafeBelow ? '、沒過會扣點' : '、現在沒過也不扣點'}</small>`; }
  function renderStageLine() { const now = stageNow(), nx = stageNext(); $('stageLine').innerHTML = `現在的闖關場：<b>${esc(now.name)}</b><span>・${hms(rotMs - Date.now() % rotMs)} 後換成${esc(nx.name)}</span>`;
    $('countdown').textContent = eveLine(); }
  function eveLine() { const d = daysToEve(); return d > 0 ? `距離期末大考還有 ${d} 天（${eveDate()}，那天起每一波都是期末大考、危險度 +${Math.round(C.exam.hazardBonus * 100)}%）` : d === 0 ? '今晚就是期末大考前夜：每一波都是期末大考' : `期末大考週：每一波都是期末大考`; }
  // 給校園用的闖關場現況（現在的場、多久後換場、期末大考倒數）
  const stageInfo = () => { const now = stageNow(), d = daysToEve(); return { now, next: stageNext(), left: hms(rotMs - Date.now() % rotMs), eve: eveLine(), eveShort: d > 0 ? `期末大考倒數 ${d} 天` : d === 0 ? '今晚期末大考前夜' : '期末大考週', where: now.islands.map(districtName).filter(Boolean).join('、') }; };
  function renderLobby() { const h = S.hero() || {}; const me = S.state.me;  if (!$('nick').value) $('nick').value = h.nick || me.name || ''; if (!clsPicked && h.cls && C.heroes[h.cls]) chosenCls = h.cls; if (!districtPicked && h.district && DISTRICTS.some(i => i.id === h.district)) $('homeDistrict').value = h.district; renderGoWho(); /* 已存的角色只當預設值，使用者點選過就以點選為準 */
    $('classes').innerHTML = Object.entries(C.heroes).map(([id, H]) => `<button type="button" class="cls" data-id="${id}" aria-pressed="${id === chosenCls}"><span class="ic">${H.icon}</span><span><b>${H.name}<em>${esc(H.weapon)}</em></b><small>${esc(H.desc)}</small><small class="sp">特殊技「${esc(H.special.name)}」：${esc(H.special.desc)}</small></span></button>`).join('');
    renderGrade(); renderStageLine();
    $('onlineList').innerHTML = online > 1 ? `<p><b>${fmt(online)}</b> 人在線・<b>${fmt(playingCount())}</b> 人正在闖關</p><ol class="plist">${sortedPeople().map(p => personRow(p)).join('')}</ol>` : '目前只有你，邀朋友一起來闖關。';
    $('lobbyStats').innerHTML = `<div><b>${fmt(online)}</b><span>人在線</span></div><div><b>${fmt(globals.shifts)}</b><span>關完成</span></div><div><b>${fmt(globals.eggs)}</b><span>顆金蛋入籃</span></div>` + (globals.visitors != null ? `<div class="vis"><b>${fmt(globals.visitors)}</b><span>人來過${globals.visitorsToday ? `・今天新來 ${fmt(globals.visitorsToday)}` : ''}</span></div>` : '');
    syncHome();
    $('mine').textContent = h.shifts ? `你已經打了 ${h.shifts} 關、搬了 ${fmt(h.eggs)} 顆金蛋${h.clears ? `、${h.clears} 關三波全過` : ''}，錢包還有 ${fmt(S.econ().wallet)} 顆（到逛校園花）。` : '你還沒打過工。';
    $('modeNote').textContent = S.state.mode === 'supabase' ? (S.state.noShiftCols ? '已連線：可以一起闖關；雲端的闖關戰績欄位還沒建好，這段時間闖關不會記金蛋。' : '已連線：可以一起闖關，金蛋和戰績記在雲端。') : S.state.mode === 'remote' ? '這個環境只能單人開始闖關；戰績會計入共享總數。' : '沒有連上雲端：只能單人開始闖關，金蛋和戰績都不會記錄（金蛋只記在雲端）。';
    const multi = room.available(); for (const id of ['btnQuick', 'btnCreate', 'btnJoin']) $(id).disabled = !multi; $('joinCode').disabled = !multi;
    $('adminBox').hidden = !(S.state.canEdit && S.state.mode === 'remote'); renderRoom(); }
  $('classes').addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (!b) return; chosenCls = b.dataset.id; clsPicked = true; $('classes').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.id === chosenCls))); profileChanged(); });
  function renderBoard(list) { $('board').innerHTML = list.length ? list.map((h, i) => `<li><span class="rank">${i + 1}</span><span class="who">${esc(h.nick || '匿名小學生')} <small>${C.heroes[h.cls] ? C.heroes[h.cls].icon : ''}${GR.names[h.grade | 0] ? ' ' + GR.names[h.grade | 0] : ''}</small></span><b>${fmt(h.eggs)}</b><small>${h.shifts || 0} 關</small></li>`).join('') : '<li class="empty">還沒有人打過工。第一個就是你。</li>'; }
  function renderStrip() { $('gVisitorsBox').hidden = globals.visitors == null; $('gVisitors').textContent = fmt(globals.visitors); $('gOnline').textContent = fmt(online); const playing = playingCount(); $('gPlaying').textContent = playing ? `・${fmt(playing)} 人在闖關` : ''; $('gShifts').textContent = fmt(globals.shifts); $('gEggs').textContent = fmt(globals.eggs); $('gWorkers').textContent = fmt(globals.workers); const d = daysToEve(); $('gCountdown').textContent = d > 0 ? `期末大考倒數 ${d} 天` : '期末大考之夜'; }
  function renderLog(log) { $('log').innerHTML = log.map(l => `<li class="${l.cls}"><time>${esc(l.t)}</time><span>${esc(l.txt)}</span></li>`).join(''); }
  let bannerT = 0; function banner(txt, secs) { const b = $('banner'); b.textContent = txt; b.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), secs * 1000); }
  let hintT = 0; function hint(txt, bad) { const h = $('hint'); h.textContent = txt || (xOn() ? 'WASD／搖桿或點地板走路・E 進去・B 鳥瞰・L 課程清單' : G.phase === 'lobby' ? '拖曳旋轉、滾輪縮放；點課程建築看課程卡。' : 'WASD／搖桿走路・點敵人鎖定・Q 特殊技・E 丟蛋'); h.classList.toggle('bad', !!bad); clearTimeout(hintT); hintT = setTimeout(() => hint(''), bad ? 2500 : 4500); }
  // ── 金蛋商店（shop.js）與逛校園（exploreui.js）：共用這裡的小工具 ──
  const xOn = () => explore.G.on;
  const shop = createShop({ S, esc, fmt, hint, banner, placeCity, shout: t => game.shout(t), islandName: districtName, near: () => explore.G.near, goTo: k => xui.goTo(k),
    who: { get: () => ({ nick: nickVal(), cls: chosenCls, district: myDistrict() }), districts: () => DISTRICTS, goHome: () => { explore.respawn({ district: myDistrict() }); follow.start('xme', false); renderFollowBtn(); hint(`回到${districtName(myDistrict())}`); },
      setDistrict: id => { if (!DISTRICTS.some(d => d.id === id)) return; $('homeDistrict').value = id; districtPicked = true; renderDistricts(); profileChanged(); S.saveHero({ district: id }); }, setCls: id => { if (!C.heroes[id]) return; chosenCls = id; clsPicked = true; profileChanged(); }, setNick: v => { $('nick').value = String(v || '').trim().slice(0, 24); profileChanged(); } },
    onChange: () => { globals = S.totals(); renderStrip(); renderDistricts(); if (room.code) room.setProfile(myProfile()); xui.refit(); } });
  callbacks.mayorExtra = m => { if (G.phase === 'lobby') shop.onSpeech(m, callbacks.say); };
  const xui = createExploreUI({ explore, S, shop, callbacks: xCallbacks, shared: { esc, fmt, hint, banner, districtName, progress, islName, online: () => online, touch: matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0,
    profile: () => ({ nick: nickVal(), cls: chosenCls, district: myDistrict(), fit: myFit() }), follow, bird, followed: () => renderFollowBtn(), policyPos, policies: () => policies, islandOf, card: (p, isl) => showCard(p, isl),
    enter: async () => { if (room.code) { await room.leave(); dropRoomParam(); } $('lobby').hidden = true; $('resultBox').hidden = true; closeCard(); input.clear(); renderFollowBtn(); },
    goWork: () => goWork(), liveSigns, stageCenter, stageInfo, lookStage: sid => frameStage(sid, false) } });
  // ── 換世界：雲湧進來、鏡頭拉遠，切換後雲散開、鏡頭推近 ──
  function showLobby(later) { renderLobby(); if (!later) $('lobby').hidden = false; frameStage(stageNow().id, true); renderFollowBtn(); hint(''); }
  // 降落在闖關場之後，大廳才從下面滑上來
  function lobbyIn() { const L = $('lobby'); L.hidden = false; L.classList.remove('enter'); void L.offsetWidth; L.classList.add('enter'); }
  function goCity(covered, sky) { if (G.phase !== 'lobby' && G.phase !== 'result') return Promise.resolve(false);
    stopAuto(); return warp(sky ? '🏙 歡迎回來' : '🏙 飛回校園', async () => { if (G.phase === 'result') { $('resultBox').hidden = true; game.backToLobby(); } $('lobby').hidden = true; setWorld('city'); await xui.start(); }, { covered, sky }); }
  function goWork() { if (!xOn()) return Promise.resolve(false); return warp('🥚 飛往闖關場', async () => { xui.leave(); setWorld('work'); input.clear(); showLobby(true); }).then(ok => { if (ok) lobbyIn(); return ok; }); }
  $('btnToCity').addEventListener('click', () => goCity()); $('btnResCity').addEventListener('click', () => goCity());
  // ── 課程卡：編號標題、摘要、為什麼、細項、關鍵字、遊戲裡的狀態（校長巡迴、相關挑戰）、相關單元 ──
  let cardPol = null, cardIsl = null, cardTimer = 0; const tagOf = p => String(p.tag || '').replace(/^#/, ''); const md = s => s.split('-').slice(1).map(Number).join('/');
  function mayorLine(pol) { const M = G.mayor, st = game.mayorStops(), n = st.length, me = st.findIndex(x => x.pol.id === pol.id); if (!M || me < 0) return ''; const who = esc(C.mayor.name);
    if (G.phase !== 'lobby') return `${who}正在金蛋籃旁邊廣播，下課後會回來巡迴`;
    if (M.state === 'speech' && M.current && M.current.pol.id === pol.id) return `${who}正在這裡宣傳，附近同學停下來揮手`;
    const ahead = (me - M.stop % n + n) % n; return ahead === 0 ? `${who}正在走過來` : `巡迴路線第 ${me + 1}／${n} 站，${who}還有 ${ahead} 站到這裡`; }
  function issueLine(pol) { const iss = pol.issue && issues.find(i => i.id === pol.issue); if (!iss) return ''; const t = `${esc(iss.tag)}「${esc(iss.title)}」`;
    if (G.phase === 'wave' && G.issue && G.issue.id === iss.id) return `${t}就是這一波的挑戰，小怪頭上喊的就是這個`;
    if (isFinalNow()) return '期末大考週：每一波都是期末大考，所有挑戰的小怪一起來';
    if (iss.startsAt && iss.startsAt > todayTPE()) return `${t} ${md(iss.startsAt)} 開放，還有 ${dayNum(iss.startsAt) - dayNum(todayTPE())} 天`;
    return `${t}已開放，闖關時可能輪到這個挑戰的小怪`; }
  function related(pol, isl) { const others = policies.filter(p => p.id !== pol.id); const same = others.filter(p => tagOf(p) === tagOf(pol)); return [...same, ...others.filter(p => !same.includes(p) && islandOf(p.id) === isl)].slice(0, 4); }
  function renderCardGame() { if (!cardPol) return; const html = [['校長', mayorLine(cardPol)], ['挑戰', issueLine(cardPol)]].filter(r => r[1]).map(([k, v]) => `<li><span class="k">${k}</span><span>${v}</span></li>`).join(''); if ($('cardGame').innerHTML !== html) $('cardGame').innerHTML = html; $('cardGame').parentElement.hidden = !html; }
  function showCard(pol, islandId) { if (!pol) return; cardPol = pol; cardIsl = islandId; const c = $('card'); if (c.hidden) setCardFull(false); c.hidden = false; c.scrollTop = 0; const facts = pol.facts || [], ags = pol.agencies || [], iss = pol.issue && issues.find(i => i.id === pol.issue), no = policies.findIndex(p => p.id === pol.id) + 1;
    $('cardIcon').innerHTML = policyIcon(pol.tag); $('cardNo').textContent = `LESSON ${String(no).padStart(2, '0')}`; $('cardTag').textContent = pol.tag || '課程'; $('cardTitle').textContent = pol.title;
    $('cardSummary').textContent = pol.summary || ''; $('cardWhy').textContent = pol.why || ''; $('cardWhy').hidden = !pol.why;
    $('cardChips').innerHTML = [`<span class="chip c"><i></i>${esc(districtName(islandId))}${pol.district ? '' : '・隨機落島'}</span>`, facts.length && `<span class="chip">${facts.length} 個學習重點</span>`, ags.length && `<span class="chip">${ags.length} 個關鍵字</span>`, iss && `<span class="chip y"><i></i>挑戰 ${esc(iss.tag)}</span>`, solvedToday(pol.id) && `<span class="chip y">✅ 今天答對 ${solvedToday(pol.id)} 題</span>`].filter(Boolean).join('');
    $('cardFacts').innerHTML = facts.map(f => `<li>${esc(f)}</li>`).join(''); $('cardFacts').parentElement.hidden = !facts.length;
    $('cardAgencies').innerHTML = ags.map(a => `<span class="chip">${esc(a)}</span>`).join(''); $('cardAgSec').hidden = !ags.length;
    const rel = related(pol, islandId); $('cardRelated').innerHTML = rel.map(p => `<button type="button" class="chip" data-pol="${esc(p.id)}"><span>${policyIcon(p.tag)}</span>${esc(p.title)}</button>`).join(''); $('cardRelSec').hidden = !rel.length;
    $('cardStatus').textContent = pol.status || '教學遊戲・學習重點整理自國小常見課程，僅供練習參考，以學校課本為準'; $('btnCardFly').onclick = () => flyTo(islandId); $('btnCardQuiz').onclick = () => lessonQuiz(pol);
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
  // ── 後台：課程 / 挑戰（只有 claude.ai artifact 的編輯者看得到；靜態站的後台在 /admin/）──
  function fillPolicySelect() { const sel = $('pSel'); sel.innerHTML = '<option value="">＋ 新增課程</option>' + policies.map(p => `<option value="${esc(p.id)}">${esc(p.title)}（${esc(p.id)}）</option>`).join(''); const d = $('pDistrict'); d.innerHTML = '<option value="">不指定（隨機落島）</option>' + C.islands.map(i => `<option value="${i.id}">${i.name}</option>`).join(''); const mdl = $('pModel'); if (!mdl.children.length) mdl.innerHTML = ['housing','nursery','elderhome','busstop','dome','techcampus','school','smartpole','garden','crane','containers','theater','kiosk','station','crossing','nightmarket','hub','card','court','bigtree','levee'].map(k => `<option>${k}</option>`).join(''); }
  function fillIssueSelect() { const sel = $('iSel'); sel.innerHTML = '<option value="">＋ 新增挑戰</option>' + issues.map(i => `<option value="${esc(i.id)}">${esc(i.title)}（${esc(i.id)}）</option>`).join(''); const pi = $('pIssue'), cur = pi.value; pi.innerHTML = '<option value="">無</option>' + issues.map(i => `<option value="${esc(i.id)}">${esc(i.tag)} ${esc(i.title)}</option>`).join(''); pi.value = cur; }
  $('pSel').addEventListener('change', ev => { const f = $('policyForm'); const p = policies.find(x => x.id === ev.target.value); f.reset(); if (!p) return; f.pid.value = p.id; f.ptitle.value = p.title || ''; f.ptag.value = p.tag || ''; f.pModel.value = p.model || 'kiosk'; f.pDistrict.value = p.district || ''; f.psummary.value = p.summary || ''; f.pwhy.value = p.why || ''; f.pfacts.value = (p.facts || []).join('\n'); f.pagencies.value = (p.agencies || []).join(', '); f.pIssue.value = p.issue || ''; });
  $('iSel').addEventListener('change', ev => { const f = $('issueForm'); const i = issues.find(x => x.id === ev.target.value); f.reset(); if (!i) return; f.iid.value = i.id; f.title.value = i.title || ''; f.tag.value = i.tag || ''; f.startsAt.value = i.startsAt || ''; f.intensity.value = i.intensity || 1; f.boss.value = i.boss || ''; f.mix.value = Object.entries(i.mix || {}).map(([k, v]) => `${k}:${v}`).join(', '); f.chants.value = (i.chants || []).join(', '); f.desc.value = i.desc || ''; f.querySelectorAll('input[name=routes]').forEach(cb => { cb.checked = (i.routes || []).includes(cb.value); }); });
  $('policyForm').addEventListener('submit', async ev => { ev.preventDefault(); const f = ev.target; const pol = { id: f.pid.value.trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 32), title: f.ptitle.value.trim().slice(0, 20), tag: f.ptag.value.trim().slice(0, 16), model: f.pModel.value, district: f.pDistrict.value || null, summary: f.psummary.value.trim().slice(0, 120), why: f.pwhy.value.trim().slice(0, 60), facts: f.pfacts.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8), agencies: f.pagencies.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean).slice(0, 4), issue: f.pIssue.value || null };
    if (!pol.id || !pol.title) { $('pMsg').textContent = '需要代號與標題。'; return; } try { await S.addPolicy(pol); $('pMsg').textContent = `已儲存「${pol.title}」${pol.district ? '，放在' + districtName(pol.district) : '，隨機落島'}。`; f.reset(); } catch (e) { $('pMsg').textContent = '儲存失敗：' + (e.message || e.code || e); } });
  $('issueForm').addEventListener('submit', async ev => { ev.preventDefault(); const f = ev.target; const mix = {}; for (const t of f.mix.value.split(',')) { const [k, v] = t.split(':').map(s => s.trim()); if (C.lesserTypes.includes(k)) mix[k] = Number(v) || 1; }
    const issue = { id: f.iid.value.trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 32), title: f.title.value.trim().slice(0, 20), tag: f.tag.value.trim().slice(0, 16), startsAt: f.startsAt.value || null, intensity: Math.max(0.5, Math.min(2, Number(f.intensity.value) || 1)), routes: [], boss: null, mix: Object.keys(mix).length ? mix : { bird: 1 }, chants: f.chants.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 12), desc: f.desc.value.trim().slice(0, 60) };
    if (!issue.id || !issue.title) { $('issueMsg').textContent = '需要代號與標題。'; return; } try { await S.addIssue(issue); $('issueMsg').textContent = `已儲存「${issue.title}」。`; f.reset(); } catch (e) { $('issueMsg').textContent = '新增失敗：' + (e.message || e.code || e); } });
  // ═══════════════ 房間（一起闖關）═══════════════
  const myUid = () => S.state.uid;
  const room = createRoom({ S, C, on: { roster: onRoster, down: onDown, up: onUp, left: onLeft, closed: onClosed } });
  let wireCfg = null, autoT = 0;
  const REASON = { full: '房間滿了，換一間試試', nohost: '找不到這個房間（房號打錯，或房主已經離開）', net: '連不上房間，稍後再試', offline: '多人需要連上共享後端；目前只能單人開始闖關', code: '房號是 4 個英數字', hostleft: '房主離開了，房間關閉' };
  function renderRoom() { const inRoom = !!room.code; $('quickActions').hidden = inRoom; $('roomSec').hidden = !inRoom; if (!inRoom) return; const R = room.R, mine = myUid();
    $('roomCode').textContent = room.code; $('roomPub').textContent = room.isHost ? (R.pub ? '公開房・快速配對找得到' : '私人房・拿到房號才進得來') : '';
    const rows = []; for (let i = 0; i < C.net.roomMax; i++) { const m = R.members[i]; if (!m) { rows.push(`<li class="empty"><span class="ic">🙋</span><span>空位（開始闖關時由 NPC 同學補上）</span></li>`); continue; } const H = C.heroes[m.id === mine ? chosenCls : m.cls] || C.heroes.chief, g = m.id === mine ? myGrade().lv : m.grade, nick = m.id === mine ? nickVal() : m.nick;
      rows.push(`<li class="${m.id === mine ? 'me' : ''}"><span class="ic">${H.icon}</span><span class="nm">${esc(nick || H.name)}${m.host ? ' <em class="host">房主</em>' : ''}${m.id === mine ? ' <em>你</em>' : ''}</span><small>${esc(H.name)}・${esc(GR.names[g] || '')}</small></li>`); }
    $('roomList').innerHTML = rows.join('');
    $('roomNote').textContent = room.isHost ? (R.st === 'shift' ? '闖關中。' : `人到齊就按開始闖關；${C.net.roomMax} 人到齊 ${C.net.autoStartFull} 秒後自動開始闖關。房主的電腦負責跑整關，中途離開這關會中止。`) : R.st === 'shift' ? '這關已經在闖關了，下一關就輪到你（可以先在旁邊看）。' : '等房主開始闖關⋯';
    $('btnStart').hidden = !room.isHost; }
  const gotGo = new Set(); // 這關已經拿到開始闖關設定的人
  function onRoster(members) { renderRoom(); if (!room.isHost) return;
    // 闖關中有人進來：原本就在這關（斷線又回來）就把那一格還給他，不然先在旁邊看；兩種都把這關的設定給他
    if (G.role === 'host' && G.phase !== 'lobby' && G.phase !== 'result' && wireCfg) for (const m of members) { if (m.id === myUid() || gotGo.has(m.id)) continue; const slot = G.players.findIndex(P => P.id === m.id); if (slot >= 0) game.fromNpc(slot); gotGo.add(m.id); room.sendDown({ t: 'go', cfg: wireCfg, to: m.id }); }
    clearTimeout(autoT); if (members.length >= C.net.roomMax && room.R.st === 'wait' && G.phase === 'lobby') { hint(`${C.net.roomMax} 人到齊，${C.net.autoStartFull} 秒後開始闖關`); autoT = setTimeout(() => { if (room.isHost && room.R.st === 'wait' && G.phase === 'lobby' && room.members.length >= 2) startRoomShift(); }, C.net.autoStartFull * 1000); } }
  function onDown(m) { if (!m || typeof m !== 'object') return;
    if (m.t === 'r') { room.R.st = m.st === 'shift' ? 'shift' : 'wait'; renderRoom(); return; }
    if (m.t === 'go') { onGo(m.cfg); return; }
    if (m.t === 's') { if (G.role === 'client') game.applySnapshot(m); return; }
    if (m.t === 'end') { if (G.role === 'client') game.applyResult(cleanResult(m.res)); return; }
    if (m.t === 'bye') { room.close('hostleft'); return; }
    if (m.t === 'full') room.close('full'); }
  function onUp(id, m) { if (G.role !== 'host') return; const slot = G.players.findIndex(P => P.id === id && !P.npc); if (slot >= 0) game.remoteInput(slot, m); }
  function onLeft(id) { gotGo.delete(id); if (G.role !== 'host' || G.phase === 'lobby') return; const slot = G.players.findIndex(P => P.id === id && !P.npc); if (slot >= 0) { const nick = G.players[slot].nick; game.toNpc(slot); hint(`${nick} 離開了，改由 NPC 代打`); } }
  function onClosed(reason) { if (G.role === 'client' && G.phase !== 'lobby' && G.phase !== 'result') game.abort('host'); hint(REASON[reason] || '已離開房間', reason !== 'left'); dropRoomParam(); renderRoom(); setPhasePresence(); }
  const dropRoomParam = () => { try { const u = new URL(location.href); if (u.searchParams.has('room')) { u.searchParams.delete('room'); history.replaceState(null, '', u); } } catch (e) { /* 舊瀏覽器 */ } };
  async function roomAction(fn, okMsg) { if (!room.available()) { hint(REASON.offline, true); return; } await S.saveHero({ nick: nickVal(), cls: chosenCls, district: myDistrict() }); room.setProfile(myProfile()); for (const id of ['btnQuick', 'btnCreate', 'btnJoin']) $(id).disabled = true; hint('連線中⋯');
    const res = await fn(); for (const id of ['btnQuick', 'btnCreate', 'btnJoin']) $(id).disabled = false; if (!res.ok) { hint(REASON[res.reason] || '連不上房間', true); renderRoom(); return; } room.setProfile(myProfile()); hint(okMsg(res)); renderRoom(); }
  $('btnQuick').addEventListener('click', () => roomAction(() => room.quick(), r => room.isHost ? `開了公開房 ${r.code}，等其他人進來（也可以直接開始闖關）` : `加入房間 ${r.code}`));
  $('btnCreate').addEventListener('click', () => roomAction(() => room.create(false), r => `房號 ${r.code}：複製邀請連結傳給朋友`));
  $('btnJoin').addEventListener('click', () => { const code = $('joinCode').value; roomAction(() => room.join(code), r => `加入房間 ${r.code}`); });
  $('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
  $('btnLeaveRoom').addEventListener('click', async () => { await room.leave(); dropRoomParam(); renderRoom(); setPhasePresence(); hint('已離開房間'); });
  $('btnInvite').addEventListener('click', async () => { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('room', room.code); try { await navigator.clipboard.writeText(u.toString()); hint('邀請連結已複製'); } catch (e) { hint(`邀請連結：${u}`); } });
  $('btnStart').addEventListener('click', () => startRoomShift());
  // ═══════════════ 開始闖關 ═══════════════
  function pickIssues(n) { if (isFinalNow()) { const f = issues.find(i => i.id === C.exam.finalIssueId); if (f) return Array(n).fill(f); } const today = todayTPE(); const open = issues.filter(i => i.id !== C.exam.finalIssueId && (!i.startsAt || i.startsAt <= today)); const pool = open.length ? open : issues.filter(i => i.id !== C.exam.finalIssueId); const out = []; let bag = []; for (let k = 0; k < n; k++) { if (!bag.length) bag = shuffle(pool); out.push(bag.pop() || issues[0]); } return out; }
  function buildCfg(humans) { const iss = pickIssues(SH.waves), waves = iss.map((is, k) => ({ special: Math.random() < (k ? SH.specialChance : SH.specialFirst) ? (Math.random() < 0.5 ? 'fog' : 'rush') : '', issue: is ? is.id : '' }));
    const hz = humans.reduce((a, h) => a + hazardOf(h.grade | 0, h.pts | 0), 0) / humans.length + (isFinalNow() ? C.exam.hazardBonus : 0);
    const roster = humans.slice(0, C.net.roomMax).map((h, i) => ({ slot: i, id: h.id, nick: h.nick || C.heroes[h.cls].name, cls: h.cls, district: h.district || null, npc: false, grade: h.grade | 0, fit: typeof h.fit === 'string' ? h.fit.slice(0, 60) : '' }));
    const names = shuffle(C.npc.names), classes = Object.keys(C.heroes); while (roster.length < 4) { const used = new Set(roster.map(r => r.cls)), free = classes.filter(c => !used.has(c)), pool = free.length ? free : classes; roster.push({ slot: roster.length, id: 'npc' + roster.length, nick: names[roster.length % names.length], cls: pool[Math.floor(Math.random() * pool.length)], district: null, npc: true, grade: 0 }); }
    return { v: C.net.protocol, stage: stageNow().id, hazard: clamp(hz, 0.2, 2.3), waves, roster, issues: iss, boost: boostTiers() }; }
  async function startSolo() { if (room.code) await room.leave(); await S.saveHero({ nick: nickVal(), cls: chosenCls, district: myDistrict() }); const cfg = buildCfg([{ id: myUid() || 'me', ...myProfile() }]); cfg.mySlot = 0; begin(cfg, 'solo'); }
  async function startRoomShift() { if (!room.isHost || G.phase !== 'lobby' && G.phase !== 'result') return; clearTimeout(autoT); await S.saveHero({ nick: nickVal(), cls: chosenCls, district: myDistrict() });
    const humans = room.members.map(m => m.id === myUid() ? { id: m.id, ...myProfile() } : m); const cfg = buildCfg(humans); wireCfg = { v: cfg.v, stage: cfg.stage, hazard: cfg.hazard, waves: cfg.waves, roster: cfg.roster, boost: cfg.boost };
    room.setStage('shift'); room.sendDown({ t: 'go', cfg: wireCfg }); gotGo.clear(); for (const r of cfg.roster) if (!r.npc) gotGo.add(r.id); cfg.mySlot = cfg.roster.findIndex(r => r.id === myUid()); begin(cfg, 'host'); }
  function cleanCfg(cfg) { if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.roster) || !Array.isArray(cfg.waves)) return null;
    const roster = cfg.roster.slice(0, 4).map((r, i) => ({ slot: i, id: clean(r && r.id, 64), nick: clean(r && r.nick, 24) || '同學', cls: r && Object.hasOwn(C.heroes, r.cls) ? r.cls : 'chief', district: r && DISTRICTS.some(d => d.id === r.district) ? r.district : null, npc: !!(r && r.npc), grade: clamp((r && r.grade) | 0, 0, TOP_LV), fit: clean(r && r.fit, 60) }));
    const waves = cfg.waves.slice(0, SH.waves).map(w => ({ special: w && ['fog', 'rush'].includes(w.special) ? w.special : '', issue: clean(w && w.issue, 32) })); while (waves.length < SH.waves) waves.push({ special: '', issue: '' });
    return { v: cfg.v | 0, stage: C.stages.some(s => s.id === cfg.stage) ? cfg.stage : C.stages[0].id, hazard: num(cfg.hazard) ? clamp(cfg.hazard, 0.2, 2.3) : 0.5, roster, waves, boost: clamp(cfg.boost | 0, 0, C.econ.donate.tiers.length) }; }
  function onGo(raw) { if (G.role === 'client' && G.phase !== 'lobby' && G.phase !== 'result') return; const c = cleanCfg(raw); if (!c) return; if (c.v !== C.net.protocol) { hint('房主的遊戲版本和你不同，請重新整理頁面再加入', true); return; } c.mySlot = c.roster.findIndex(r => r.id === myUid() && !r.npc); c.issues = c.waves.map(w => issues.find(i => i.id === w.issue) || issues[0]); room.R.st = 'shift'; begin(c, 'client'); if (c.mySlot < 0) hint('這關已經開始闖關，你先在旁邊看，下一關就輪到你'); }
  function cleanResult(r) { if (!r || typeof r !== 'object') return null; const n = v => num(v) ? Math.max(0, Math.round(v)) : 0;
    return { clear: !!r.clear, why: ['clear', 'timeup', 'wipe', 'host', 'quit'].includes(r.why) ? r.why : 'timeup', stage: C.stages.some(s => s.id === r.stage) ? r.stage : (G.stage || C.stages[0]).id, hazard: num(r.hazard) ? clamp(r.hazard, 0, 3) : G.hazard, waves: SH.waves, waveNo: clamp(n(r.waveNo), 0, SH.waves), cleared: clamp(n(r.cleared), 0, SH.waves),
      golds: (Array.isArray(r.golds) ? r.golds : []).slice(0, SH.waves).map(n), quotas: (Array.isArray(r.quotas) ? r.quotas : []).slice(0, SH.waves).map(n),
      players: (Array.isArray(r.players) ? r.players : []).slice(0, 4).map((p, i) => ({ slot: i, id: clean(p && p.id, 64), nick: clean(p && p.nick, 30) || '同學', cls: p && Object.hasOwn(C.heroes, p.cls) ? p.cls : 'chief', npc: !!(p && p.npc), district: p && DISTRICTS.some(d => d.id === p.district) ? p.district : null, gold: n(p && p.gold), power: n(p && p.power), rescues: n(p && p.rescues), downs: n(p && p.downs) })) }; }
  function begin(cfg, role) { $('lobby').hidden = true; $('resultBox').hidden = true; closeCard(); clearTimeout(resultT); input.clear(); game.startShift(cfg, role); }
  function setPhasePresence() { if (room.code) { room.setStage(G.phase !== 'lobby' && G.phase !== 'result' ? 'shift' : 'wait'); return; } S.setPresence({ phase: G.phase !== 'lobby' && G.phase !== 'result' ? 'shift' : 'lobby', nick: nickVal(), cls: chosenCls }); }
  function onShift(kind) { const inShift = kind === 'start'; document.body.classList.toggle('in-shift', inShift); $('shiftHud').hidden = !inShift; $('teamPanel').hidden = !inShift; $('actionBar').hidden = !inShift; $('joy').hidden = !inShift || !touch || G.me < 0;
    $('btnPause').hidden = !(inShift && G.role === 'solo'); $('btnQuit').hidden = !inShift; G.paused = false; $('btnPause').textContent = '暫停'; $('btnPause').setAttribute('aria-pressed', 'false');
    if (inShift) { if (!follow.start('hero', true)) stageView(); renderSpecial(); renderTeam(); renderShift(); hint(''); } else { follow.stop(); frameStage(stageNow().id, false); }
    renderFollowBtn(); setPhasePresence(); }
  // ═══════════════ 開始闖關中的畫面：上方這一波、左邊同學、右下動作 ═══════════════
  const SPN = { fog: '🌫 起大霧', rush: '🌙 搗蛋夜' };
  function renderShift() { if (G.phase === 'lobby') return; const wave = G.phase === 'wave', w = Math.max(1, G.waveNo);
    $('shWave').textContent = G.phase === 'intro' ? '準備' : String(G.phase === 'inter' ? G.waveNo + 1 : w); $('shWaves').textContent = G.phase === 'intro' ? '開始闖關' : `／${SH.waves} 波${G.phase === 'inter' ? '・休息' : ''}`;
    $('shTime').textContent = mmss(wave ? G.timeLeft : G.t); $('shTime').classList.toggle('late', wave && G.timeLeft < 15);
    const q = G.quota || 0; $('shGold').textContent = G.gold; $('shQuota').textContent = wave || G.phase === 'result' ? q : '–'; $('shBar').style.width = q ? Math.min(100, G.gold / q * 100) + '%' : '0%'; $('shEggBox').classList.toggle('done', q > 0 && G.gold >= q);
    const sp = SPN[G.special]; $('shSpecial').hidden = !sp; if (sp) $('shSpecial').textContent = sp; }
  let teamSig = '';
  function renderTeam() { if (G.phase === 'lobby') return; const html = G.players.map(P => { const H = P.cfg, st = P.down ? '倒下' : P.carry ? '搬蛋中' : '', hp = Math.round(Math.max(0, P.down ? P.revive / SH.player.reviveTime : P.hp / SH.player.hp) * 100);
      return `<li class="${P.local ? 'me ' : ''}${P.down ? 'down ' : ''}${P.carry ? 'carry' : ''}" title="${esc(P.nick)}${P.npc ? '（NPC）' : P.local ? '（你）' : ''}・${esc(H.name)}${st ? '・' + st : ''}"><span class="badge" style="background:#${H.color.toString(16).padStart(6, '0')}">${H.icon}</span><span class="nm">${esc(P.nick)}${P.npc ? ' <small>NPC</small>' : P.local ? ' <small>你</small>' : ''}</span><b class="g" title="搬進籃子的金蛋">${P.gold}</b><span class="hp"><i style="width:${hp}%"></i></span><span class="st">${st}</span><span class="spd" title="特殊技剩幾次">${'●'.repeat(P.sp)}${'○'.repeat(Math.max(0, SH.specials - P.sp))}</span></li>`; }).join('');
    if (html !== teamSig) { teamSig = html; $('teamList').innerHTML = html; } renderSpecial(); }
  function renderSpecial() { const P = game.me(); if (!P) { $('actionBar').classList.add('spectate'); return; } $('actionBar').classList.remove('spectate'); const S2 = P.cfg.special; $('spName').textContent = S2.name; $('spDots').textContent = '●'.repeat(P.sp) + '○'.repeat(Math.max(0, SH.specials - P.sp)); $('btnSpecial').disabled = P.down || P.sp <= 0 || G.phase !== 'wave'; $('btnSpecial').title = S2.desc; $('btnThrow').disabled = !P.carry || P.down; $('btnThrow').classList.toggle('ready', P.carry && !P.down); }
  function doSpecial() { const m = game.useSpecial(); if (m) room.sendUp(m); renderSpecial(); }
  function doThrow() { const m = game.throwEgg(); if (m) room.sendUp(m); renderSpecial(); }
  let emoteAt = 0; function doEmote(k) { const now = Date.now(); if (now - emoteAt < C.emoteCooldown * 1000) return; emoteAt = now; const m = game.emote(k); if (m) room.sendUp(m); }
  $('btnSpecial').addEventListener('click', doSpecial); $('btnThrow').addEventListener('click', doThrow);
  // ── 解題（闖關中）：按 R 或右下「解題」出一題（依自己的學期出題）；答對這一波金蛋 +bonusEggs、血補滿；答錯等 cooldown 秒；每關最多 perShift 題。單人時出題中暫停 ──
  const quiz = createQuizUI(); const gradeOfDistrict = id => { const isl = DISTRICTS.find(i => i.id === id); return isl && Number.isFinite(isl.grade) ? isl.grade : 3; }; const pickTopic = g => { const list = topicsForGrade(g); return list[Math.floor(Math.random() * list.length)]; };
  function renderQuizBtn() { const P = game.me(), b = $('btnQuiz'); if (!P) return; const left = Math.max(0, C.quiz.perShift - (P.quizN || 0)), cd = Math.ceil(Math.max(0, P.quizT || 0)); b.disabled = G.phase !== 'wave' || P.down || !left || cd > 0 || quiz.open; $('quizLeft').textContent = cd > 0 ? `${cd} 秒後` : left ? `剩 ${left} 題` : '用完了'; }
  async function doQuiz() { const P = game.me(); if (!P || P.down || G.phase !== 'wave' || (P.quizT || 0) > 0 || (P.quizN || 0) >= C.quiz.perShift || quiz.open) return; const wasPaused = G.paused; if (G.role === 'solo') G.paused = true; const g = gradeOfDistrict(myDistrict()), isl = DISTRICTS.find(i => i.id === myDistrict());
    const ok = await quiz.ask({ grade: g, topic: pickTopic(g), mode: 'shift', title: `${isl ? isl.name : ''}解題`, reward: `答對：這一波金蛋 +${C.quiz.bonusEggs}、血補滿` }); if (G.role === 'solo') G.paused = wasPaused; renderQuizBtn();
    if (ok === null) return; if (ok) { const m = game.quizBonus(); if (m) room.sendUp(m); progress.add(G.stage ? G.stage.basket : myDistrict()); renderDistricts(); } else { const P2 = game.me(); if (P2) P2.quizT = C.quiz.cooldown; banner(`❌ 答錯了，${C.quiz.cooldown} 秒後可以再試`, 2); } renderQuizBtn(); }
  $('btnQuiz').addEventListener('click', doQuiz); setInterval(() => { if (G.phase !== 'lobby') renderQuizBtn(); }, 500);
  // ── 解題任務（課程卡）：答對每題 +reward 顆金蛋記進雲端（每個單元每天 dailyCap 題有獎勵，之後只是練習）──
  const solvedToday = id => dailyTally('lesson:' + id).count;
  async function lessonQuiz(pol) { if (quiz.open) return; const t = dailyTally('lesson:' + pol.id), capped = t.count >= C.quiz.dailyCap, g = Number.isFinite(pol.grade) ? pol.grade : gradeOfDistrict(islandOf(pol.id));
    const ok = await quiz.ask({ topic: pol.quiz, grade: g, mode: 'lesson', title: pol.title, eyebrow: `QUIZ・${districtName(islandOf(pol.id)) || '解題任務'}`, reward: capped ? `今天這個單元的獎勵拿完了（${C.quiz.dailyCap} 題），再答只是練習` : `答對 +${C.quiz.reward} 顆金蛋（今天還有 ${C.quiz.dailyCap - t.count} 題有獎勵）` });
    if (ok === null) return; if (!ok) { game.shout(C.mayor.lines.quizNo); return; }
    const n = t.add(); const newly = progress.add(islandOf(pol.id)); renderDistricts(); if (n > C.quiz.dailyCap) banner(newly.length ? `🎉 答對了！🔓 解鎖了${newly.map(islName).join('、')}` : '🎉 答對了！（今天這個單元的獎勵已拿完，這題算練習）', 2.5);
    else { const r = await S.recordQuiz(C.quiz.reward, pol.id); banner(r.ok ? `🎉 答對了！金蛋 +${C.quiz.reward}` : r.why === 'offline' ? '🎉 答對了！（沒連上雲端，金蛋沒有記錄）' : r.why === 'nocols' ? '🎉 答對了！（雲端還沒開解題帳本，金蛋沒有記錄）' : '🎉 答對了！（連線不穩，金蛋沒存到）', 3); if (r.ok) game.shout(C.mayor.lines.quizOk.replace('{n}', C.quiz.reward)); }
    if (cardPol && cardPol.id === pol.id && !$('card').hidden) showCard(pol, cardIsl); shop.sync(); }
  $('emotes').innerHTML = C.emotes.map((e, i) => `<button type="button" data-k="${esc(e.k)}" title="${esc(e.say)}（${i + 1}）" aria-label="${esc(e.say)}">${ICONS[e.k] || esc(e.icon)}<span>${esc(e.say)}</span></button>`).join('');
  $('emotes').addEventListener('click', ev => { const b = ev.target.closest('button[data-k]'); if (b) doEmote(b.dataset.k); });
  for (const el of document.querySelectorAll('[data-ic]')) el.innerHTML = ICONS[el.dataset.ic] || '';
  // 手機搖桿：左下角按住拖，往上＝往鏡頭前方走
  const touch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0; let joyId = null;
  const joy = $('joy'), knob = $('joyKnob');
  function joyMove(e) { const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = C.controls.joyR; let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const L = Math.hypot(dx, dy); if (L > 1) { dx /= L; dy /= L; } knob.style.transform = `translate(${dx * R}px,${dy * R}px)`; const dead = L < C.controls.joyDead; input.stick.x = dead ? 0 : dx; input.stick.y = dead ? 0 : -dy; }
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joy.classList.add('on'); joyMove(e); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; input.stick.x = input.stick.y = 0; knob.style.transform = ''; joy.classList.remove('on'); }; joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
  const hurtFx = $('hurtFx'); callbacks.hurt = () => { hurtFx.classList.remove('on'); void hurtFx.offsetWidth; hurtFx.classList.add('on'); };
  // ═══════════════ 結算 ═══════════════
  let resultT = 0, lastRes = null;
  const WHY = { clear: '下課！三波全過', timeup: '配額不夠，這關下課', wipe: '全員倒下，這關下課', host: '房主離線，這關中止', quit: '提早下課' };
  async function onEnd(res) { if (!res) return; lastRes = res; const role = G.role;
    if (role === 'host') { room.sendDown(game.makeSnapshot()); room.sendDown({ t: 'end', res }); room.setStage('wait'); }
    const mine = res.players[G.me]; const counted = mine && !mine.npc && res.why !== 'host' && res.why !== 'quit' && G.me >= 0; let g0 = myGrade(), g1 = null, pay = 0, saved = null;
    if (counted) { g1 = gradeAfter(g0, res); const P2 = C.pay; pay = Math.round((res.cleared * P2.wave + mine.gold * P2.egg + mine.power * P2.kill + mine.rescues * P2.rescue + (res.clear ? P2.clearBonus : 0)) * (0.5 + res.hazard)); saved = await S.recordShift(mine, res.clear, { lv: g1.lv, pts: g1.pts }, res.stage); }
    globals = S.totals(); renderStrip(); renderDistricts(); setPhasePresence();
    clearTimeout(resultT); resultT = setTimeout(() => showResult(res, mine, g0, g1, pay, saved), SH.resultLinger * 1000); }
  function showResult(res, mine, g0, g1, pay, saved) { const st = C.stages.find(s => s.id === res.stage) || C.stages[0];
    $('resTitle').textContent = res.clear ? `🎉 ${WHY.clear}` : res.why === 'timeup' || res.why === 'wipe' ? `第 ${res.waveNo} 波：${WHY[res.why]}` : res.why === 'quit' && G.role === 'client' && G.me >= 0 && res.players[G.me] && !res.players[G.me].npc ? '房主提早下課' : WHY[res.why] || WHY.timeup;
    $('resWhy').textContent = `${st.name}・危險度 ${Math.round(res.hazard * 100)}%・過了 ${res.cleared}／${res.waves} 波`;
    $('resWaves').innerHTML = Array.from({ length: res.waves }, (_, k) => { const g = res.golds[k], q = res.quotas[k], ok = g != null && q != null && g >= q && (k < res.cleared); return `<li class="${g == null ? '' : ok ? 'ok' : 'bad'}"><span>第 ${k + 1} 波</span><b>${g ?? '–'}<small>／${q ?? '–'}</small></b></li>`; }).join('');
    $('resTeam').innerHTML = res.players.map((p, i) => `<tr class="${i === G.me ? 'me' : ''}"><td><span>${(C.heroes[p.cls] || C.heroes.chief).icon}</span> ${esc(p.nick)}${p.npc ? ' <small>NPC</small>' : i === G.me ? ' <small>你</small>' : ''}</td><td><b>${p.gold}</b></td><td>${p.power}</td><td>${p.rescues}</td><td>${p.downs}</td></tr>`).join('');
    if (g1) { const max = gradeMax(g1.lv); $('resMe').innerHTML = `<div class="pay"><span>闖關點數</span><b>+${fmt(pay)}</b></div><div class="gr"><span>闖關等級</span><b>${esc(GR.names[g1.lv])}</b> <span>${g1.promoted ? `升級！${esc(GR.names[g0.lv])} → ${esc(GR.names[g1.lv])}` : g1.demoted ? `降級：${esc(GR.names[g0.lv])} → ${esc(GR.names[g1.lv])}` : `${g0.pts} → ${g1.pts}／${max}`}（${g1.d >= 0 ? '+' : ''}${g1.d}）</span><span class="bar"><i style="width:${Math.min(100, g1.pts / max * 100).toFixed(1)}%"></i></span></div>`; }
    else $('resMe').innerHTML = `<div class="gr"><span>${G.me < 0 ? '這關你在旁邊看，沒有算進戰績。' : '這關沒有算進戰績，闖關等級不變。'}</span></div>`;
    $('resDistrict').textContent = mine && !mine.npc && g1 ? (saved && !saved.ok ? (saved.why === 'offline' ? '⚠ 沒連上雲端，這關的金蛋沒有記錄（金蛋只記在雲端）。' : '⚠ 連線不穩，這關的金蛋沒存到雲端。') : districtLine(mine.gold, myDistrict())) : '';
    const client = G.role === 'client'; $('btnAgain').disabled = client; $('btnAgain').textContent = client ? '等房主開下一關⋯' : room.code ? '同一房再闖一關' : '再闖一關';
    $('resultBox').hidden = false; if (G.role === 'solo') startAuto(); }
  // 單人打完：結算看幾秒就自動飛回校園（不用再選）；按「留在闖關場」、再闖一關或回大廳就取消。房間裡大家可能要再打，不自動
  let cityT = 0, autoEnd = 0;
  function startAuto() { stopAuto(); const sec = SH.autoCity || 0; if (!sec) return; autoEnd = performance.now() + sec * 1000; $('resAuto').hidden = false; $('resAutoBar').style.transition = 'none'; $('resAutoBar').style.width = '0%'; void $('resAutoBar').offsetWidth; $('resAutoBar').style.transition = `width ${sec}s linear`; $('resAutoBar').style.width = '100%';
    const tick = () => { const left = Math.ceil((autoEnd - performance.now()) / 1000); $('resAutoN').textContent = String(Math.max(0, left)); if (left <= 0) { cityT = 0; $('resAuto').hidden = true; goCity(); return; } cityT = setTimeout(tick, 200); }; tick(); }
  function stopAuto() { clearTimeout(cityT); cityT = 0; $('resAuto').hidden = true; }
  $('btnResStay').addEventListener('click', stopAuto);
  $('btnAgain').addEventListener('click', () => { stopAuto(); if (G.role === 'client') return; if (room.code && room.isHost) startRoomShift(); else startSolo(); });
  $('btnResLobby').addEventListener('click', () => { stopAuto(); $('resultBox').hidden = true; game.backToLobby(); showLobby(); });
  $('btnQuit').addEventListener('click', async () => { if (xOn()) { xui.leave(); return; } if (G.phase === 'lobby') return; if (G.phase !== 'result' && !confirm(G.role === 'host' ? '你是房主，下課的話這關所有人都會結束。確定嗎？' : '確定要提早下課嗎？這關不會算進戰績。')) return;
    if (G.phase === 'result') { $('btnResLobby').click(); return; } if (G.role === 'client') { await room.leave(); game.abort('quit'); renderRoom(); } else game.abort('quit'); });
  // ═══════════════ 鏡頭按鈕 ═══════════════
  function renderFollowBtn() { const k = follow.kind; $('btnFollow').setAttribute('aria-pressed', String(!!k)); $('followLbl').textContent = xOn() ? '跟著我' : G.phase === 'lobby' ? '跟隨校長' : '跟著我'; }
  $('btnFollow').addEventListener('click', () => { if (follow.kind) follow.stop(); else if (!follow.start(xOn() ? 'xme' : G.phase === 'lobby' ? 'mayor' : 'hero', G.phase !== 'lobby' || xOn())) hint('沒有可以跟隨的對象', true); renderFollowBtn(); });
  $('btnHome').addEventListener('click', () => { if (G.phase === 'lobby') overview(); else if (follow.kind) stageView(); else follow.start('hero', true) || stageView(); renderFollowBtn(); });
  Object.assign(callbacks, { follow: () => renderFollowBtn(), hud: renderShift, log: renderLog, banner, hint, end: onEnd, team: renderTeam, shift: onShift, card: showCard });
  $('btnCardMayor').addEventListener('click', () => { if (follow.start('mayor')) { closeCard(); renderFollowBtn(); } });
  // ═══════════════ 暫停（只有單人）、背景分頁 ═══════════════
  function togglePause() { if (G.role !== 'solo' || G.phase === 'lobby') return; G.paused = !G.paused; $('btnPause').textContent = G.paused ? '繼續' : '暫停'; $('btnPause').setAttribute('aria-pressed', String(G.paused)); if (G.paused) banner('⏸ 暫停中（P 繼續）', 2); }
  $('btnPause').addEventListener('click', togglePause);
  // 房主切到背景時畫面不會更新，這裡用計時器繼續跑模擬、送快照（瀏覽器會把背景計時器放慢到約每秒一次）
  let hiddenAt = 0; document.addEventListener('visibilitychange', () => { S.setPresence({ away: document.hidden }); hiddenAt = performance.now(); if (document.hidden && G.role === 'solo' && G.phase !== 'lobby' && G.phase !== 'result' && !G.paused) togglePause(); });
  setInterval(() => { if (!document.hidden || G.role !== 'host' || G.phase === 'lobby') return; const now = performance.now(), dt = Math.min(1.2, (now - hiddenAt) / 1000); hiddenAt = now; const sub = Math.ceil(dt / 0.025); for (let i = 0; i < sub; i++) game.step(dt / sub); }, 250);
  // 房主每秒 snapHz 次送快照；房客每秒 upHz 次送自己的位置（沒動時每 heartbeat 秒一次）
  setInterval(() => { if (G.role === 'host' && room.isHost && G.phase !== 'lobby' && G.phase !== 'result') room.sendDown(game.makeSnapshot()); }, 1000 / C.net.snapHz);
  let lastUp = null, lastUpAt = 0;
  setInterval(() => { if (G.role !== 'client' || !room.code || G.phase === 'lobby' || G.phase === 'result') return; const m = game.myInput(); if (!m) return; const now = Date.now(); const moved = !lastUp || Math.hypot(m.x - lastUp.x, m.z - lastUp.z) > 0.03 || Math.abs(m.y - lastUp.y) > 0.25 || m.f !== lastUp.f; if (!moved && now - lastUpAt < C.net.heartbeat * 1000) return; lastUp = m; lastUpAt = now; room.sendUp(m); }, 1000 / C.net.upHz);
  // ═══════════════ 闖關現場：單人或房主把這一關的摘要送給正在逛校園的人（live 頻道）═══════════════
  // 換波、金蛋、魔王、有人倒下時才送（最快 send 秒一次），沒變化時 heartbeat 秒一次；下課送 le（r=1 三波全過）
  const LV = C.explore.live; let liveSig = '', liveAt = 0, liveUp = false;
  function liveMsg() { const alive = G.enemies.filter(e => !e.dead); return { t: 'ls', st: G.stage.id, ph: G.phase, w: G.waveNo, tl: Math.round(G.phase === 'wave' ? G.timeLeft : G.t), g: G.gold, q: G.quota, sp: G.special || '', hz: Math.round(G.hazard * 100),
    b: [...new Set(alive.filter(e => e.A && e.A.boss).map(e => e.type))].slice(0, 5), e: alive.length, p: G.players.map(P => [P.cls, P.npc ? 1 : 0, P.down ? 1 : 0]), nk: (G.players.find(P => !P.npc) || {}).nick || '' }; }
  setInterval(() => { const running = (G.role === 'solo' || G.role === 'host') && ['intro', 'wave', 'inter'].includes(G.phase) && G.stage;
    if (!running) { if (liveUp) { S.liveSend({ t: 'le', r: G.result && G.result.clear ? 1 : 0 }); liveUp = false; setTimeout(() => { if (!liveUp) S.liveOn('h', false); }, 800); } return; }
    if (!liveUp) { liveUp = S.liveOn('h', true); liveSig = ''; liveAt = 0; if (!liveUp) return; }
    const m = liveMsg(), sig = [m.ph, m.w, m.g, m.q, m.sp, m.b.join(','), m.p.map(p => p[2]).join('')].join('|'), now = Date.now();
    if ((sig !== liveSig && now - liveAt > LV.send * 1000) || now - liveAt > LV.heartbeat * 1000) { if (S.liveSend(m)) { liveSig = sig; liveAt = now; } } }, 1000);
  S.onLive(m => { if (m && m.t === 'lq' && liveUp) liveAt = 0; }); // 有人剛進校園：下一秒就送一次
  // ═══════════════ 在線名單 ═══════════════
  const STATUS = { shift: '闖關中', explore: '逛校園中', room: '在房間等', lobby: '在大廳', away: '暫離' };
  function statusOf(p) { return p.away ? 'away' : p.phase; }
  function playingCount() { return people.filter(p => statusOf(p) === 'shift' || statusOf(p) === 'explore').length; }
  function sortedPeople() { const me = myUid(), order = { shift: 0, explore: 0, room: 1, lobby: 2, away: 3 }; return [...people].sort((a, b) => (b.id === me) - (a.id === me) || order[statusOf(a)] - order[statusOf(b)] || a.nick.localeCompare(b.nick, 'zh-Hant')); }
  function personRow(p) { const me = p.id === myUid(), H = p.cls && C.heroes[p.cls], st = statusOf(p), canJoin = !me && p.host && p.pub && p.rs === 'wait' && p.rn < C.net.roomMax && p.room !== room.code && room.available() && G.phase === 'lobby';
    return `<li class="${st}${me ? ' me' : ''}"><i></i><span class="pn">${esc(p.nick || '匿名小學生')}${me ? ' <em>你</em>' : ''}</span><small>${H ? H.icon + ' ' : ''}${STATUS[st]}${p.host ? `・房 ${esc(p.room)} ${p.rn}/${C.net.roomMax}` : ''}</small>${canJoin ? `<button type="button" class="pj" data-room="${esc(p.room)}">加入</button>` : ''}</li>`; }
  function renderPlayers() { $('plTitle').textContent = `${fmt(online)} 人在線・${fmt(playingCount())} 人在闖關${globals.visitors != null ? `・累計 ${fmt(globals.visitors)} 人來過` : ''}`; const html = sortedPeople().map(p => personRow(p)).join('') || '<li class="empty">目前只有你</li>'; if ($('plList').dataset.html !== html) { $('plList').innerHTML = html; $('plList').dataset.html = html; } }
  const setPlayers = open => { $('playersPanel').hidden = !open; $('btnOnline').setAttribute('aria-expanded', String(open)); if (open) renderPlayers(); };
  $('btnOnline').addEventListener('click', () => setPlayers($('playersPanel').hidden)); $('btnPlClose').addEventListener('click', () => setPlayers(false));
  const joinFromList = async e => { const b = e.target.closest('button[data-room]'); if (!b) return; setPlayers(false); if (xOn()) await goWork(); $('lobby').hidden = false; roomAction(() => room.join(b.dataset.room), r => `加入房間 ${r.code}`); };
  $('plList').addEventListener('click', joinFromList); $('onlineList').addEventListener('click', joinFromList);
  // ═══════════════ 快捷鍵 ═══════════════
  document.addEventListener('keydown', ev => { if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return; const k = ev.key.toLowerCase();
    if (ev.key === 'Escape') { closeCard(); closeHelp(); quiz.close(); return; }
    if (G.phase === 'lobby') { if (k === 'h') overview(); else if (k === 'f') $('btnFollow').click(); return; }
    if (k === 'q') { ev.preventDefault(); doSpecial(); } else if (k === 'r') { ev.preventDefault(); doQuiz(); } else if (k === 'e' || ev.key === ' ') { ev.preventDefault(); doThrow(); } else if (k >= '1' && k <= String(C.emotes.length)) doEmote(C.emotes[+k - 1].k); else if (k === 'h') $('btnHome').click(); else if (k === 'f') { follow.start('hero', false); renderFollowBtn(); } else if (k === 'p') togglePause(); });
  const fsBtn = $('btnFull'); if (!document.fullscreenEnabled) fsBtn.hidden = true; fsBtn.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => { hint('這個環境不允許全螢幕', true); }); }); document.addEventListener('fullscreenchange', () => { fsBtn.textContent = document.fullscreenElement ? '⤡ 離開全螢幕' : '⤢ 全螢幕'; });
  $('btnLogToggle').addEventListener('click', () => { $('logPanel').classList.toggle('open'); });
  $('btnSolo').addEventListener('click', startSolo);
  $('nick').addEventListener('input', profileChanged);
  $('siteName').textContent = C.site.name; $('siteSub').textContent = C.site.sub; $('siteProj').textContent = C.site.proj; $('siteTag').textContent = C.site.tag; $('siteTribute').hidden = $('lobbyTribute').hidden = true; $('parodyTitle').textContent = C.site.parody; $('parodyLong').textContent = C.site.parodyLong; $('disclaimer').textContent = C.site.disclaimer + ' ' + C.site.credit; $('parodyBadge').textContent = C.site.badge;
  S.onGlobal(g => { globals = g; renderStrip(); if (!$('lobby').hidden) renderLobby(); }); S.onLeaderboard(list => { renderBoard(list); renderDistricts(); shop.sync(); if (xOn() && !$('shopPanel').hidden) shop.render(); }); S.onIssues(list => { issues = list; fillIssueSelect(); }); S.onPolicies(list => { policies = list; fillPolicySelect(); placePolicies(list); });
  S.onOnline((n, names, list) => { online = n; people = list || []; renderStrip(); if (!$('lobby').hidden) renderLobby(); if (!$('playersPanel').hidden) renderPlayers(); });
  // 上次在校園：先用雲蓋住畫面（不先閃一下大廳），載入完直接散開到校園
  if (world === 'city') { $('lobby').hidden = true; const cw = $('cloudwipe'); cw.hidden = false; cw.className = 'cloudwipe cover'; $('cwText').textContent = '🏙 歡迎回來'; } else if (!RETURNING) $('firstNote').hidden = false;
  S.init().then(() => { const h = S.hero(); S.setPresence({ nick: (h && h.nick) || '', cls: (h && h.cls) || null, phase: 'lobby', away: document.hidden }); renderLobby();
    if (world === 'city') { goCity(true, true); return; } showLobby();
    const code = new URLSearchParams(location.search).get('room'); if (code && room.available()) roomAction(() => room.join(code), r => `加入房間 ${r.code}`); else if (code) hint(REASON.offline, true); });
  renderFollowBtn(); hint('');
  // ── 校園信箱（右側卡片輪播）與校園快訊（底部跑馬燈）──
  let hlQueue = [], hlDone = 0, hlTimer = 0, hlPaused = false;
  function pickHotline() { if (!hlQueue.length) hlQueue = shuffle(HOTLINE); return Math.random() < C.ticker.hotlineGenShare ? genHotline() : hlQueue.shift(); }
  let hlItems = [], hlBusy = null;
  const hlTrack = document.createElement('div'); hlTrack.className = 'hl-track'; $('hlBody').appendChild(hlTrack); $('hotline').style.setProperty('--hl-ms', C.ticker.hotlineSlideMs + 'ms');
  const HL_SEP = 17; // .hl-item 的 padding-bottom 8 + 虛線 1 + margin-bottom 8
  const hlCard = ([dist, who, ask, fix]) => { const d = document.createElement('div'); d.className = 'hl-item'; d.innerHTML = `<div class="hl-who"><span class="hl-dist">${esc(dist)}</span>${esc(who)}<span class="hl-stamp">已解決</span></div><p class="hl-ask">「${esc(ask)}」</p><div class="hl-fix"><b>🎙 校長</b>${esc(fix)}</div>`; return d; };
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
    if (mixHot && tkCount % 2 === 0) { const [dist, who, ask, fix] = pickHotline(); html = `<span class="tk-dist">${esc(dist)}</span>${esc(who)}：<b class="tk-ask">「${esc(ask)}」</b><span class="tk-arrow">→</span><span class="tk-fix">🎙 校長　${esc(fix)}</span><span class="tk-ok">已解決</span>`; }
    else { const n = nextNews(C.ticker.weights); txt = `${n.icon} ${n.text}`; }
    const el = $('tkText'); const track = el.parentElement; el.style.animation = 'none'; if (html) el.innerHTML = html; else el.textContent = txt; $('ticker').classList.toggle('hot', !!html); tkLabel.textContent = html ? '📮 校園信箱' : '校園快訊'; void el.offsetWidth;
    const dist2 = track.clientWidth + el.scrollWidth; const dur = Math.max(6, dist2 / C.ticker.pxPerSec);
    el.style.setProperty('--from', track.clientWidth + 'px'); el.style.setProperty('--to', -el.scrollWidth + 'px'); el.style.animation = `tk ${dur}s linear 1`; }
  $('tkText').addEventListener('animationend', nextTicker); requestAnimationFrame(nextTicker);
  let distTick = 0;
  return { tick() { renderShift(); xui.tick(); if (G.phase !== 'lobby') renderTeam(); if (++distTick % 5) return; if (!$('lobby').hidden) renderStageLine(); if (!$('playersPanel').hidden) renderPlayers(); }, room, xui, shop };
}
