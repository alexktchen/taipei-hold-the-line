/* 共享狀態轉接器（三種模式：claude.ai artifact／Supabase／本機）。
   - 在 claude.ai artifact 裡：用 db / user 能力，heroes/<uid> 每人一份（只有本人能寫），issues/<id>、policies/<id> 由編輯者新增；room 的 presence 算線上人數。
   - Supabase（靜態站）：匿名登入取得 uid；heroes 每人一列；online 頻道（presence）算線上人數並列出開著的打工房；房間本身在 js/room.js。
   - 其他地方（沒連上）：可以單人打工，但金蛋、戰績、花費都不記（金蛋只記在雲端）。
   這台裝置只存暱稱、職業、行政區（pi.hero.v1，回訪判斷用）；金蛋、打工戰績、花費、穿著一律以雲端那一列為準。
   打工戰績欄位：shifts（打了幾班）、eggs（搬了幾顆金蛋）、clears（三波全過幾次）、grade／grade_pts（打工職級）。要先跑 supabase/shifts.sql 加欄位。
   舊塔防的 rounds／kills／finals 欄位保留（歷史資料），這裡不讀也不寫。
   金蛋經濟欄位：donated（政治獻金）、built（蓋城市投入）、spent（衣服花掉）、outfit（穿著，帽子.背心.配件.套裝）、owned（買過的衣服）、gift（GM 發的，玩家改不了）；要先跑 supabase/economy.sql，沒跑的話不能花。
   錢包 = eggs + gift − donated − built − spent；打完一班用 hero_shift、花金蛋用 hero_spend（資料庫裡直接加減，錢包不夠就失敗，多台裝置同時玩也不會互相蓋掉）。
   逛城市的多人同框走全站 play 頻道（broadcast），只有在逛城市時才加入（playOn），打工房間不用它。
   打工現場走全站 live 頻道：正在打工的房主／單人送這班的摘要，逛城市的人收（liveOn 依用途計數，兩邊都不用了才離開）。
   介面：init(), onGlobal(fn), onLeaderboard(fn), hero(), saveHero(patch), recordShift(mine, clear, grade), econ(), buy(), unequip(), give(), listIssues(), addIssue(issue), listPolicies(), addPolicy(p), districtBoard(), setPresence(patch), playOn(on), send(msg), onNet(fn) */
window.PIStore = (function () {
  const LS_HERO = 'pi.hero.v1';
  const state = { db: null, user: null, uid: null, canWrite: null, canEdit: false, me: { name: '', avatarUrl: '', color: '' },
    hero: null, heroes: [], issuesRemote: [], policiesRemote: [], subs: { global: [], leaderboard: [], issues: [], policies: [], online: [], net: [], live: [] }, playCh: null, playSub: null, liveCh: null, liveSub: null, liveUsers: new Set(), onlineIds: null, mode: 'local', room: null, online: 1, onlineNames: [], onlinePeople: [], visitors: null, visitorsToday: null, sb: null, presenceCh: null, presence: {}, noShiftCols: false, noDistrict: false, noEconCols: false, noGift: false };
  const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
  // 本機只存身分（暱稱、職業、行政區）；舊版存在本機的金蛋與戰績只在第一次連上雲端時搬上去一次（migrateLegacy）
  const PROFILE = ['nick', 'cls', 'district'], pick = (h, keys) => h ? Object.fromEntries(keys.filter(k => h[k] != null).map(k => [k, h[k]])) : null;
  const loadLocalHero = () => safe(() => JSON.parse(localStorage.getItem(LS_HERO) || 'null'), null);
  const saveLocalHero = (h) => safe(() => localStorage.setItem(LS_HERO, JSON.stringify(pick(h, PROFILE))), null);
  const SHIFT = ['shifts', 'eggs', 'clears', 'grade', 'grade_pts'], ECON = ['donated', 'built', 'spent', 'outfit', 'owned', 'gift'];
  let legacy = null, writing = 0, writeSeq = 0;
  const n0 = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  function emit(ch) {
    if (ch === 'global') { const g = totals(); state.subs.global.forEach(fn => fn(g)); }
    if (ch === 'leaderboard') state.subs.leaderboard.forEach(fn => fn(leaderboard()));
    if (ch === 'issues') state.subs.issues.forEach(fn => fn(listIssues()));
    if (ch === 'policies') state.subs.policies.forEach(fn => fn(listPolicies()));
    if (ch === 'online') state.subs.online.forEach(fn => fn(state.online, state.onlineNames, state.onlinePeople));
  }
  // 排行榜與全體戰績用的名單：共享模式用所有人的（自己那列換成本機最新的），沒有共享欄位時只有自己
  function roster() { const me = state.hero && state.uid ? { ...state.hero, id: state.uid } : state.hero; if (state.mode === 'local' || state.noShiftCols) return me ? [me] : [];
    let list = state.heroes.map(h => me && h.id === me.id ? { ...h, ...me } : h); if (me && !list.some(h => h.id === me.id)) list = [...list, me]; return list; }
  function totals() { return roster().reduce((a, h) => ({ ...a, shifts: a.shifts + n0(h.shifts), eggs: a.eggs + n0(h.eggs), clears: a.clears + n0(h.clears), workers: a.workers + (n0(h.shifts) > 0 ? 1 : 0) }), { shifts: 0, eggs: 0, clears: 0, workers: 0, visitors: state.visitors, visitorsToday: state.visitorsToday, local: state.mode === 'local' || state.noShiftCols }); }
  function leaderboard() { return roster().filter(h => n0(h.shifts) > 0).sort((a, b) => n0(b.eggs) - n0(a.eggs) || n0(b.clears) - n0(a.clears)).slice(0, PI_CONFIG.ui.leaderboardMax); }
  // 12 區對抗：每位打工仔選一個行政區，該區分數 = 選這區的人搬進籃子的金蛋總數
  function districtBoard() {
    const rows = new Map(PI_CONFIG.islands.filter(i => !i.detached).map(i => [i.id, { id: i.id, name: i.name, eggs: 0, shifts: 0, workers: 0 }]));
    for (const h of roster()) { const r = rows.get(h.district); if (r && n0(h.shifts) > 0) { r.eggs += n0(h.eggs) + Math.min(n0(h.built), n0(h.eggs)); r.shifts += n0(h.shifts); r.workers += 1; } } // 蓋城市投入的金蛋再算一次
    return [...rows.values()].sort((a, b) => b.eggs - a.eggs || b.workers - a.workers || PI_CONFIG.islands.findIndex(i => i.id === a.id) - PI_CONFIG.islands.findIndex(i => i.id === b.id));
  }
  function listIssues() { const byId = new Map(PI_CONFIG.issues.map(i => [i.id, i])); for (const i of state.issuesRemote) byId.set(i.id, { ...byId.get(i.id), ...i }); return [...byId.values()].filter(i => !i.hidden); }
  function listPolicies() { const byId = new Map(PI_CONFIG.policies.map(i => [i.id, i])); for (const i of state.policiesRemote) byId.set(i.id, { ...byId.get(i.id), ...i }); return [...byId.values()].filter(i => !i.hidden); }
  async function init() {
    legacy = loadLocalHero(); state.hero = pick(legacy, PROFILE);
    const claude = window.claude;
    if (!claude || typeof claude.use !== 'function') { await initSupabase(); return finishInit(); }
    const [db, user, room] = await Promise.all([claude.use('db'), claude.use('user'), claude.use('room')]);
    if (room) { state.room = room; room.onPeers(ch => { const viewers = ch.peers.filter(p => p.kind === 'viewer'); state.onlinePeople = viewers.map((p, i) => peer(String(p.id || i), p.presence)); state.online = Math.max(1, viewers.length); state.onlineNames = state.onlinePeople.map(p => p.nick).filter(Boolean); emit('online'); }, err => console.warn('[store] room', err)); }
    state.db = db; state.user = user;
    if (user) { const me = await user.me(); state.uid = me.id; state.me = { name: me.name || '', avatarUrl: me.avatarUrl, color: me.color }; state.canEdit = me.canEdit; state.canWrite = await user.can('data.write'); }
    if (db) {
      state.mode = 'remote';
      db.collection('heroes').limit(PI_CONFIG.ui.heroesQueryLimit).onSnapshot(snap => {
        state.heroes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (state.uid) { const mine = state.heroes.find(h => h.id === state.uid); if (mine) { state.hero = { ...(state.hero || {}), ...mine }; saveLocalHero(state.hero); } }
        emit('global'); emit('leaderboard');
      }, err => { console.warn('[store] heroes', err); state.mode = 'local'; emit('global'); emit('leaderboard'); });
      db.collection('issues').limit(200).onSnapshot(snap => { state.issuesRemote = snap.docs.map(d => ({ id: d.id, ...d.data() })); emit('issues'); }, err => console.warn('[store] issues', err));
      db.collection('policies').limit(500).onSnapshot(snap => { state.policiesRemote = snap.docs.map(d => ({ id: d.id, ...d.data() })); emit('policies'); }, err => console.warn('[store] policies', err));
    }
    return finishInit();
  }
  // 在線名單的一筆：presence 是其他訪客送的，只取固定欄位並檢查型別；同一人開多個分頁算一個（key 是匿名 uid）
  // 房主還會帶 room（房號）、rh=1、rn（幾人）、rs（wait 等人／shift 打工中）、pub（快速配對找得到）
  const str = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, n) : '';
  const peer = (id, p) => { p = p || {}; const room = /^[A-Z0-9]{3,8}$/.test(p.room || '') ? p.room : null; return { id, nick: str(p.nick, 24), cls: typeof p.cls === 'string' && Object.hasOwn(PI_CONFIG.heroes, p.cls) ? p.cls : null,
    phase: p.phase === 'shift' ? 'shift' : p.phase === 'explore' ? 'explore' : p.phase === 'room' ? 'room' : 'lobby', away: p.away === true, room, host: !!room && p.rh === 1, rn: Math.max(1, Math.min(4, p.rn | 0)), rs: p.rs === 'shift' ? 'shift' : 'wait', pub: p.pub === 1 }; };
  // ── Supabase（靜態站用）──
  let refreshT = 0;
  const missingCol = (err, re) => err && re.test(err.message || '');
  async function refreshHeroes() { const B = window.PI_BACKEND; const base = 'id,nick,cls', cols = () => base + (state.noDistrict ? '' : ',district') + (state.noShiftCols ? '' : ',shifts,eggs,clears,grade,grade_pts') + (state.noShiftCols || state.noEconCols ? '' : ',donated,built,spent,outfit,owned') + (state.noShiftCols || state.noEconCols || state.noGift ? '' : ',gift');
    const seq = writeSeq; let { data, error } = await state.sb.from('heroes').select(cols()).limit(B.heroesLimit || 1000);
    for (let k = 0; k < 3 && error; k++) { if (missingCol(error, /district/)) { state.noDistrict = true; console.warn('[store] heroes 沒有 district 欄位，請執行 supabase/districts.sql'); } else if (missingCol(error, /gift/)) { state.noGift = true; console.warn('[store] heroes 沒有 gift 欄位，請重跑 supabase/economy.sql'); } else if (missingCol(error, /donated|built|spent|outfit|owned/)) { state.noEconCols = true; console.warn('[store] heroes 沒有金蛋經濟欄位，請執行 supabase/economy.sql'); } else if (missingCol(error, /shifts|eggs|clears|grade/)) { state.noShiftCols = true; console.warn('[store] heroes 沒有打工欄位，請執行 supabase/shifts.sql'); } else break; ({ data, error } = await state.sb.from('heroes').select(cols()).limit(B.heroesLimit || 1000)); }
    if (error) { console.warn('[store] heroes', error.message); return; }
    state.heroes = data || []; const mine = state.heroes.find(h => h.id === state.uid);
    if (mine) { const loc = state.hero || {}; // 金蛋與戰績以雲端為準；讀的途中自己剛寫過就不蓋（下一輪再讀）
      state.hero = { ...loc, nick: loc.nick || mine.nick, cls: loc.cls || mine.cls, district: mine.district || loc.district }; if (seq === writeSeq && !writing) applyMine(mine); saveLocalHero(state.hero); }
    if (legacy) await migrateLegacy(mine);
    emit('global'); emit('leaderboard'); }
  function applyMine(row) { if (!row) return; state.hero = { ...(state.hero || {}), ...pick(row, [...SHIFT, ...ECON]) }; const i = state.heroes.findIndex(h => h.id === state.uid); if (i >= 0) state.heroes[i] = { ...state.heroes[i], ...row }; }
  const spentOf = h => n0(h && h.donated) + n0(h && h.built) + n0(h && h.spent);
  // 舊版把金蛋與花費記在本機（沒跑 SQL 時）：第一次連上時，本機比雲端多的就搬上去一次，之後本機只留身分
  async function migrateLegacy(mine) { const L = legacy; legacy = null; saveLocalHero(state.hero); if (!L || !state.sb || state.noShiftCols) return; const up = {};
    if (n0(L.shifts) > n0(mine && mine.shifts)) Object.assign(up, pick(L, SHIFT));
    if (!state.noEconCols && spentOf(L) > spentOf(mine)) Object.assign(up, pick(L, ['donated', 'built', 'spent', 'outfit', 'owned']));
    if (!Object.keys(up).length) return; const before = state.hero; state.hero = { ...state.hero, ...up }; if (!await pushHero(true)) state.hero = before; }
  async function refreshVisitors() { const { data, error } = await state.sb.rpc('visitor_stats'); if (error || !data) return; const n = v => Number.isFinite(Number(v)) ? Number(v) : null; state.visitors = n(data.total); state.visitorsToday = n(data.today); emit('global'); }
  async function initSupabase() { const B = window.PI_BACKEND || {}; if (!B.supabaseUrl || !B.supabaseAnonKey) return false;
    try { const { createClient } = await import(B.supabaseJs); const sb = createClient(B.supabaseUrl, B.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
      let { data: { session } } = await sb.auth.getSession(); if (!session) { const r = await sb.auth.signInAnonymously(); if (r.error) throw r.error; session = r.data.session; }
      state.sb = sb; state.uid = session.user.id; state.mode = 'supabase'; state.canWrite = true; state.canEdit = false;
      await refreshHeroes(); refreshVisitors(); setInterval(refreshVisitors, (B.visitorsEvery || 300) * 1000); setInterval(() => { if (!document.hidden) refreshHeroes(); }, (B.heroesEvery || 60) * 1000);
      const [pol, iss] = await Promise.all([sb.from('policies').select('id,data'), sb.from('issues').select('id,data')]);
      state.policiesRemote = (pol.data || []).map(r => ({ ...(r.data || {}), id: r.id })); state.issuesRemote = (iss.data || []).map(r => ({ ...(r.data || {}), id: r.id })); emit('policies'); emit('issues');
      const ch = sb.channel('online', { config: { presence: { key: state.uid } } });
      ch.on('presence', { event: 'sync' }, () => { const ps = ch.presenceState(); state.onlineIds = Object.keys(ps); state.onlinePeople = Object.entries(ps).map(([id, a]) => peer(id, a[0])); state.online = Math.max(1, state.onlinePeople.length); state.onlineNames = state.onlinePeople.map(p => p.nick).filter(Boolean); emit('online'); });
      ch.subscribe(st => { if (st === 'SUBSCRIBED') { state.presenceCh = ch; ch.track(state.presence).catch(() => {}); } });
      return true; } catch (e) { console.warn('[store] supabase 連線失敗，改用本機模式', e); state.mode = 'local'; return false; } }
  function finishInit() { emit('global'); emit('leaderboard'); emit('issues'); emit('policies'); emit('online'); return state; }
  function setPresence(patch) { state.presence = { ...state.presence, ...patch }; for (const k of Object.keys(state.presence)) if (state.presence[k] == null) delete state.presence[k]; if (state.room) state.room.presence(patch).catch(e => console.warn('[store] presence', e && e.code)); if (state.presenceCh) state.presenceCh.track(state.presence).catch(() => {}); }
  function hero() { return state.hero; }
  // 改身分（暱稱、職業、行政區）：只寫這幾欄，金蛋與戰績的欄位不碰
  async function saveHero(patch) { state.hero = { ...(state.hero || {}), ...pick(patch, PROFILE) }; saveLocalHero(state.hero); await pushHero(); emit('global'); emit('leaderboard'); }
  // econ=true：連金蛋、戰績、花費一起寫（只有資料庫還沒有 hero_shift／hero_spend 時的退路與第一次搬舊資料用）
  async function pushHero(econ) { const h = state.hero; if (!h) return false;
    if (state.sb && state.uid) { const row = { id: state.uid, nick: String(h.nick || '').slice(0, 24), cls: h.cls || 'chief', last_at: new Date().toISOString() }; if (h.lastStage) row.last_issue = h.lastStage;
      if (!state.noDistrict) row.district = h.district || null; if (econ && !state.noShiftCols) Object.assign(row, { shifts: n0(h.shifts), eggs: n0(h.eggs), clears: n0(h.clears), grade: n0(h.grade), grade_pts: n0(h.grade_pts) });
      if (econ && !state.noShiftCols && !state.noEconCols) Object.assign(row, { donated: n0(h.donated), built: n0(h.built), spent: n0(h.spent), outfit: fitStr(h.outfit), owned: ownedList(h.owned).join(',') });
      writing++; writeSeq++; try {
      let { error } = await state.sb.from('heroes').upsert(row);
      if (missingCol(error, /district/)) { state.noDistrict = true; delete row.district; ({ error } = await state.sb.from('heroes').upsert(row)); }
      if (missingCol(error, /donated|built|spent|outfit|owned/)) { state.noEconCols = true; for (const k of ['donated', 'built', 'spent', 'outfit', 'owned']) delete row[k]; ({ error } = await state.sb.from('heroes').upsert(row)); }
      if (missingCol(error, /shifts|eggs|clears|grade/)) { state.noShiftCols = true; for (const k of ['donated', 'built', 'spent', 'outfit', 'owned']) delete row[k]; for (const k of ['shifts', 'eggs', 'clears', 'grade', 'grade_pts']) delete row[k]; ({ error } = await state.sb.from('heroes').upsert(row)); }
      if (error) { console.warn('[store] hero upsert', error.message); return false; } return true; } finally { writing--; } }
    if (!(state.db && state.uid)) return false;
    const body = { nick: String(h.nick || '').slice(0, 24), cls: h.cls || 'chief', district: h.district || null, shifts: n0(h.shifts), eggs: n0(h.eggs), clears: n0(h.clears), grade: n0(h.grade), grade_pts: n0(h.grade_pts), donated: n0(h.donated), built: n0(h.built), spent: n0(h.spent), outfit: fitStr(h.outfit), owned: ownedList(h.owned).join(','), lastAt: new Date().toISOString(), lastStage: h.lastStage || null };
    try { await state.db.doc('heroes/' + state.uid).set(body); return true; } catch (e) { console.warn('[store] write refused', e && e.code); state.canWrite = false; return false; } }
  // 打完一班（mine＝結算裡自己那一格，grade＝打完後的職級 { lv, pts }）：在資料庫裡直接加（hero_shift）；沒連上雲端就不記。回傳 { ok, why }：offline 沒連上、net 連線失敗
  const cloud = () => !!(state.uid && (state.sb || state.db));
  async function rpcRow(fn, args) { writing++; writeSeq++; try { const { data, error } = await state.sb.rpc(fn, args); if (!error) return { ok: true, row: Array.isArray(data) ? data[0] : data };
      return { ok: false, msg: error.message || '', missing: error.code === 'PGRST202' || error.code === '42883' || /Could not find the function|does not exist/i.test(error.message || '') }; }
    catch (e) { return { ok: false, msg: String(e && e.message || e) }; } finally { writing--; } }
  async function recordShift(mine, clear, grade, stage) { const gold = Math.max(0, Math.round(n0(mine && mine.gold))); if (!cloud()) return { ok: false, why: 'offline' };
    if (state.sb && !state.noShiftCols) { const args = { p_eggs: gold, p_clear: !!clear, p_grade: grade.lv, p_pts: grade.pts, p_stage: stage || null }; let r = await rpcRow('hero_shift', args);
      if (!r.ok && !r.missing) { await new Promise(res => setTimeout(res, 1500)); r = await rpcRow('hero_shift', args); } // 連線抖一下就再試一次
      if (r.ok && r.row) { applyMine(r.row); emit('global'); emit('leaderboard'); return { ok: true }; } if (!r.missing) { console.warn('[store] hero_shift', r.msg); return { ok: false, why: 'net' }; } }
    const h = state.hero || {}; state.hero = { ...h, shifts: n0(h.shifts) + 1, eggs: n0(h.eggs) + gold, clears: n0(h.clears) + (clear ? 1 : 0), grade: grade.lv, grade_pts: grade.pts, lastStage: stage || null }; // 資料庫還沒有 hero_shift：整列寫回
    const ok = await pushHero(true); if (!ok) state.hero = h; emit('global'); emit('leaderboard'); return ok ? { ok: true } : { ok: false, why: 'net' }; }
  // ── 金蛋經濟 ──
  const EC = () => PI_CONFIG.econ, CATS = ['hat', 'color', 'acc', 'suit'];
  const itemOf = (cat, id) => { const c = EC().outfits[cat]; return c && typeof id === 'string' && Object.hasOwn(c.items, id) ? c.items[id] : null; };
  // 穿著字串「帽子.背心.配件.套裝」，沒穿的寫 -；不認得的 id 一律當沒穿
  function fitObj(v) { const a = typeof v === 'string' ? v.split('.') : []; const o = {}; CATS.forEach((c, i) => { o[c] = itemOf(c, a[i]) ? a[i] : ''; }); return o; }
  function fitStr(v) { const o = typeof v === 'object' && v ? v : fitObj(v); return CATS.map(c => itemOf(c, o[c]) ? o[c] : '-').join('.'); }
  function ownedList(v) { return [...new Set((typeof v === 'string' ? v.split(',') : []).filter(k => { const [c, id] = k.split(':'); return itemOf(c, id); }))].slice(0, 40); }
  // 共享模式用所有人的（自己那列換成本機最新的）；沒有共享欄位時只有自己。別人的數字一律不超過他自己的金蛋
  function econRoster() { if (state.noShiftCols || state.noEconCols) return []; return roster(); }
  const capped = (h, k) => Math.min(n0(h[k]), n0(h.eggs));
  function wallet() { const h = state.hero || {}; return Math.max(0, n0(h.eggs) + n0(h.gift) - n0(h.donated) - n0(h.built) - n0(h.spent)); }
  // 金蛋能不能花：offline＝沒連上雲端；nocols＝雲端還沒跑 economy.sql
  const canSpend = () => !cloud() ? 'offline' : state.sb && (state.noShiftCols || state.noEconCols) ? 'nocols' : '';
  function econ() { const list = econRoster(); const built = list.reduce((a, h) => a + capped(h, 'built'), 0), donated = list.reduce((a, h) => a + capped(h, 'donated'), 0), h = state.hero || {};
    const board = k => list.filter(x => capped(x, k) > 0).sort((a, b) => capped(b, k) - capped(a, k)).slice(0, EC().donate.boardMax).map(x => ({ id: x.id, nick: str(x.nick, 24), cls: x.cls, n: capped(x, k) }));
    return { wallet: wallet(), eggs: n0(h.eggs), gift: n0(h.gift), myBuilt: n0(h.built), myDonated: n0(h.donated), outfit: fitStr(h.outfit), owned: ownedList(h.owned), built, donated, donors: board('donated'), builders: board('built'), blocked: canSpend() }; }
  // 花金蛋（kind＝spent／built／donated，n 可以是 0＝只換穿著）：雲端的 hero_spend 檢查錢包並一次寫好；資料庫還沒有這個函式時退回整列寫
  async function spend(kind, n, patch) { const no = canSpend(); if (no) return { ok: false, why: no }; if (n > wallet()) return { ok: false, why: 'poor' };
    if (state.sb) { const r = await rpcRow('hero_spend', { p_kind: kind, p_n: n, p_owned: patch.owned ?? null, p_outfit: patch.outfit ?? null });
      if (r.ok && r.row) { applyMine(r.row); emit('global'); return { ok: true }; } if (/poor/.test(r.msg || '')) { refreshHeroes(); return { ok: false, why: 'poor' }; } if (!r.missing) { console.warn('[store] hero_spend', r.msg); return { ok: false, why: 'net' }; } }
    const h = state.hero || {}; state.hero = { ...h, [kind]: n0(h[kind]) + n, ...patch }; const ok = await pushHero(true); if (!ok) state.hero = h; return ok ? { ok: true } : { ok: false, why: 'net' }; }
  // 換穿著：沒連上雲端時只換這次的畫面（不存）
  async function wear(fit) { const outfit = fitStr(fit); if (canSpend()) { state.hero = { ...(state.hero || {}), outfit }; return { ok: true, equip: true }; } const r = await spend('spent', 0, { outfit }); return r.ok ? { ok: true, equip: true } : r; }
  async function buy(cat, id) { const it = itemOf(cat, id); if (!it) return { ok: false, why: 'item' }; const h = state.hero || {}, own = ownedList(h.owned), key = cat + ':' + id, fit = fitObj(h.outfit); fit[cat] = id;
    if (own.includes(key) || it.price === 0) return wear(fit); // 買過的、免費的（萬聖節免費套裝）直接換上
    return spend('spent', it.price, { owned: [...own, key].join(','), outfit: fitStr(fit) }); }
  async function unequip(cat) { const fit = fitObj((state.hero || {}).outfit); fit[cat] = ''; return wear(fit); }
  async function give(kind, n) { n = Math.floor(n0(n)); if (!(kind === 'built' || kind === 'donated') || n <= 0) return { ok: false, why: 'amount' }; const r = await spend(kind, n, {}); return r.ok ? { ok: true, n } : r; }
  // ── 逛城市多人同框：play 頻道只在逛城市時加入；收到的訊息交給 exploreui 驗證 ──
  function playOn(on) { const sb = state.sb; if (!sb || !state.uid) return false;
    if (on) { if (state.playSub) return true; const ch = sb.channel('play', { config: { broadcast: { self: false } } }); state.playSub = ch;
      ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (payload && typeof payload === 'object') for (const fn of state.subs.net) fn(payload); });
      ch.subscribe(st => { if (st === 'SUBSCRIBED' && state.playSub === ch) state.playCh = ch; }); return true; }
    if (state.playSub) { sb.removeChannel(state.playSub); state.playSub = null; state.playCh = null; } return true; }
  function liveOn(who, on) { const sb = state.sb; if (!sb || !state.uid) return false; if (on) state.liveUsers.add(who); else state.liveUsers.delete(who);
    if (state.liveUsers.size && !state.liveSub) { const ch = sb.channel('live', { config: { broadcast: { self: false } } }); state.liveSub = ch;
      ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (payload && typeof payload === 'object') for (const fn of state.subs.live) fn(payload); });
      ch.subscribe(st => { if (st === 'SUBSCRIBED' && state.liveSub === ch) state.liveCh = ch; }); }
    else if (!state.liveUsers.size && state.liveSub) { sb.removeChannel(state.liveSub); state.liveSub = null; state.liveCh = null; } return true; }
  function liveSend(msg) { if (!state.liveCh || !state.uid) return false; state.liveCh.send({ type: 'broadcast', event: 'm', payload: { ...msg, id: state.uid } }).catch(() => {}); return true; }
  function send(msg) { if (!state.playCh || !state.uid) return false; state.playCh.send({ type: 'broadcast', event: 'm', payload: { ...msg, id: state.uid } }).catch(() => {}); return true; }
  async function addPolicy(policy) { if (!(state.db && state.canEdit)) throw new Error('只有編輯者可以新增政策'); await state.db.doc('policies/' + policy.id).set(policy); }
  async function addIssue(issue) { if (!(state.db && state.canEdit)) throw new Error('只有編輯者可以新增議題'); await state.db.doc('issues/' + issue.id).set(issue); }
  // 重新讀雲端（例如打開商店時看 GM 剛發的金蛋）；10 秒內讀過就不讀
  let lastRefresh = 0; function refresh(force) { if (!state.sb || (!force && performance.now() - lastRefresh < 10000)) return Promise.resolve(); lastRefresh = performance.now(); return refreshHeroes(); }
  return { init, hero, saveHero, recordShift, econ, wallet, buy, unequip, give, fitStr, refresh, playOn, send, onNet: fn => { state.subs.net.push(fn); }, liveOn, liveSend, onLive: fn => { state.subs.live.push(fn); }, listIssues, addIssue, listPolicies, addPolicy, totals, leaderboard, districtBoard,
    onPolicies: fn => { state.subs.policies.push(fn); fn(listPolicies()); },
    onOnline: fn => { state.subs.online.push(fn); fn(state.online, state.onlineNames, state.onlinePeople); }, setPresence,
    onGlobal: fn => { state.subs.global.push(fn); fn(totals()); },
    onLeaderboard: fn => { state.subs.leaderboard.push(fn); fn(leaderboard()); },
    onIssues: fn => { state.subs.issues.push(fn); fn(listIssues()); },
    get state() { return state; } };
})();
