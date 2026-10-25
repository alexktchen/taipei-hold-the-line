/* 共享狀態轉接器（三種模式：claude.ai artifact／Supabase／本機）。
   - 在 claude.ai artifact 裡：用 db / user 能力，heroes/<uid> 每人一份（只有本人能寫），issues/<id>、policies/<id> 由編輯者新增；room 的 presence 算線上人數。
   - Supabase（靜態站）：匿名登入取得 uid；heroes 每人一列；online 頻道（presence）算線上人數並列出開著的打工房；房間本身在 js/room.js。
   - 其他地方（本機）：退回 localStorage，只記本機。
   打工戰績欄位：shifts（打了幾班）、eggs（搬了幾顆金蛋）、clears（三波全過幾次）、grade／grade_pts（打工職級）。要先跑 supabase/shifts.sql 加欄位；沒跑的話只記在這台裝置，排行榜只看得到自己。
   介面：init(), onGlobal(fn), onLeaderboard(fn), hero(), saveHero(patch), recordShift(mine, clear, grade), listIssues(), addIssue(issue), listPolicies(), addPolicy(p), districtBoard(), setPresence(patch) */
window.PIStore = (function () {
  const LS_HERO = 'pi.hero.v1';
  const state = { db: null, user: null, uid: null, canWrite: null, canEdit: false, me: { name: '', avatarUrl: '', color: '' },
    hero: null, heroes: [], issuesRemote: [], policiesRemote: [], subs: { global: [], leaderboard: [], issues: [], policies: [], online: [] }, onlineIds: null, mode: 'local', room: null, online: 1, onlineNames: [], onlinePeople: [], visitors: null, visitorsToday: null, sb: null, presenceCh: null, presence: {}, noShiftCols: false, noDistrict: false };
  const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
  const loadLocalHero = () => safe(() => JSON.parse(localStorage.getItem(LS_HERO) || 'null'), null);
  const saveLocalHero = (h) => safe(() => localStorage.setItem(LS_HERO, JSON.stringify(h)), null);
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
    for (const h of roster()) { const r = rows.get(h.district); if (r && n0(h.shifts) > 0) { r.eggs += n0(h.eggs); r.shifts += n0(h.shifts); r.workers += 1; } }
    return [...rows.values()].sort((a, b) => b.eggs - a.eggs || b.workers - a.workers || PI_CONFIG.islands.findIndex(i => i.id === a.id) - PI_CONFIG.islands.findIndex(i => i.id === b.id));
  }
  function listIssues() { const byId = new Map(PI_CONFIG.issues.map(i => [i.id, i])); for (const i of state.issuesRemote) byId.set(i.id, { ...byId.get(i.id), ...i }); return [...byId.values()].filter(i => !i.hidden); }
  function listPolicies() { const byId = new Map(PI_CONFIG.policies.map(i => [i.id, i])); for (const i of state.policiesRemote) byId.set(i.id, { ...byId.get(i.id), ...i }); return [...byId.values()].filter(i => !i.hidden); }
  async function init() {
    state.hero = loadLocalHero();
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
    phase: p.phase === 'shift' || p.phase === 'round' ? 'shift' : p.phase === 'room' ? 'room' : 'lobby', away: p.away === true, room, host: !!room && p.rh === 1, rn: Math.max(1, Math.min(4, p.rn | 0)), rs: p.rs === 'shift' ? 'shift' : 'wait', pub: p.pub === 1 }; };
  // ── Supabase（靜態站用）──
  let refreshT = 0;
  const missingCol = (err, re) => err && re.test(err.message || '');
  async function refreshHeroes() { const B = window.PI_BACKEND; const base = 'id,nick,cls', cols = () => base + (state.noDistrict ? '' : ',district') + (state.noShiftCols ? '' : ',shifts,eggs,clears,grade,grade_pts');
    let { data, error } = await state.sb.from('heroes').select(cols()).limit(B.heroesLimit || 1000);
    for (let k = 0; k < 2 && error; k++) { if (missingCol(error, /district/)) { state.noDistrict = true; console.warn('[store] heroes 沒有 district 欄位，請執行 supabase/districts.sql'); } else if (missingCol(error, /shifts|eggs|clears|grade/)) { state.noShiftCols = true; console.warn('[store] heroes 沒有打工欄位，請執行 supabase/shifts.sql'); } else break; ({ data, error } = await state.sb.from('heroes').select(cols()).limit(B.heroesLimit || 1000)); }
    if (error) { console.warn('[store] heroes', error.message); return; }
    state.heroes = data || []; const mine = state.heroes.find(h => h.id === state.uid);
    if (mine && !state.noShiftCols) { const loc = state.hero || {}; const keep = { district: mine.district || loc.district }; // 本機比較新（剛打完還沒寫回）就保留本機的
      state.hero = n0(loc.shifts) > n0(mine.shifts) ? { ...mine, ...loc, ...keep } : { ...loc, ...mine, ...keep }; saveLocalHero(state.hero); }
    emit('global'); emit('leaderboard'); }
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
  async function saveHero(patch) { state.hero = { ...(state.hero || { shifts: 0, eggs: 0, clears: 0 }), ...patch }; saveLocalHero(state.hero); await pushHero(); emit('global'); emit('leaderboard'); }
  async function pushHero() { const h = state.hero; if (!h) return false;
    if (state.sb && state.uid) { const row = { id: state.uid, nick: String(h.nick || '').slice(0, 24), cls: h.cls || 'chief', last_issue: h.lastStage || null, last_at: new Date().toISOString() };
      if (!state.noDistrict) row.district = h.district || null; if (!state.noShiftCols) Object.assign(row, { shifts: n0(h.shifts), eggs: n0(h.eggs), clears: n0(h.clears), grade: n0(h.grade), grade_pts: n0(h.grade_pts) });
      let { error } = await state.sb.from('heroes').upsert(row);
      if (missingCol(error, /district/)) { state.noDistrict = true; delete row.district; ({ error } = await state.sb.from('heroes').upsert(row)); }
      if (missingCol(error, /shifts|eggs|clears|grade/)) { state.noShiftCols = true; for (const k of ['shifts', 'eggs', 'clears', 'grade', 'grade_pts']) delete row[k]; ({ error } = await state.sb.from('heroes').upsert(row)); }
      if (error) { console.warn('[store] hero upsert', error.message); return false; } return true; }
    if (!(state.db && state.uid)) return false;
    const body = { nick: String(h.nick || '').slice(0, 24), cls: h.cls || 'chief', district: h.district || null, shifts: n0(h.shifts), eggs: n0(h.eggs), clears: n0(h.clears), grade: n0(h.grade), grade_pts: n0(h.grade_pts), lastAt: new Date().toISOString(), lastStage: h.lastStage || null };
    try { await state.db.doc('heroes/' + state.uid).set(body); return true; } catch (e) { console.warn('[store] write refused', e && e.code); state.canWrite = false; return false; } }
  // 打完一班：mine = 結算裡自己那一格（金蛋數等），grade = 打完後的職級 { lv, pts }
  async function recordShift(mine, clear, grade, stage) { const h = state.hero || {}; await saveHero({ shifts: n0(h.shifts) + 1, eggs: n0(h.eggs) + n0(mine && mine.gold), clears: n0(h.clears) + (clear ? 1 : 0), grade: grade.lv, grade_pts: grade.pts, lastStage: stage || null }); }
  async function addPolicy(policy) { if (!(state.db && state.canEdit)) throw new Error('只有編輯者可以新增政策'); await state.db.doc('policies/' + policy.id).set(policy); }
  async function addIssue(issue) { if (!(state.db && state.canEdit)) throw new Error('只有編輯者可以新增議題'); await state.db.doc('issues/' + issue.id).set(issue); }
  return { init, hero, saveHero, recordShift, listIssues, addIssue, listPolicies, addPolicy, totals, leaderboard, districtBoard,
    onPolicies: fn => { state.subs.policies.push(fn); fn(listPolicies()); },
    onOnline: fn => { state.subs.online.push(fn); fn(state.online, state.onlineNames, state.onlinePeople); }, setPresence,
    onGlobal: fn => { state.subs.global.push(fn); fn(totals()); },
    onLeaderboard: fn => { state.subs.leaderboard.push(fn); fn(leaderboard()); },
    onIssues: fn => { state.subs.issues.push(fn); fn(listIssues()); },
    get state() { return state; } };
})();
