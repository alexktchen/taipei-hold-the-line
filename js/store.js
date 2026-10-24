/* 共享狀態轉接器（三種模式：claude.ai artifact／Supabase／本機）。
   - 在 claude.ai artifact 裡：用 db / user 能力，heroes/<uid> 每人一份（只有本人能寫），issues/<id>、policies/<id> 由編輯者新增；room 的 presence 算線上人數。
   - 其他地方（本機、拆出去的靜態站）：退回 localStorage，只記本機。拆站時把 remote 部分換成 Supabase/Firebase 即可，介面不變。
   介面：init(), onGlobal(fn), onLeaderboard(fn), hero(), saveHero(patch), recordRound(result), listIssues(), addIssue(issue), identity */
window.PIStore = (function () {
  const LS_HERO = 'pi.hero.v1';
  const state = { db: null, user: null, uid: null, canWrite: null, canEdit: false, me: { name: '', avatarUrl: '', color: '' },
    hero: null, heroes: [], issuesRemote: [], policiesRemote: [], subs: { global: [], leaderboard: [], issues: [], policies: [], online: [], net: [] }, playCh: null, onlineIds: null, mode: 'local', room: null, online: 1, onlineNames: [], onlinePeople: [], sb: null, presenceCh: null, presence: {} };
  const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
  const loadLocalHero = () => safe(() => JSON.parse(localStorage.getItem(LS_HERO) || 'null'), null);
  const saveLocalHero = (h) => safe(() => localStorage.setItem(LS_HERO, JSON.stringify(h)), null);
  function emit(ch) {
    if (ch === 'global') { const g = totals(); state.subs.global.forEach(fn => fn(g)); }
    if (ch === 'leaderboard') state.subs.leaderboard.forEach(fn => fn(leaderboard()));
    if (ch === 'issues') state.subs.issues.forEach(fn => fn(listIssues()));
    if (ch === 'policies') state.subs.policies.forEach(fn => fn(listPolicies()));
    if (ch === 'online') state.subs.online.forEach(fn => fn(state.online, state.onlineNames, state.onlinePeople));
  }
  function totals() {
    const list = state.mode !== 'local' ? state.heroes : (state.hero ? [state.hero] : []);
    return list.reduce((a, h) => ({ waves: a.waves + (h.rounds || 0), blocked: a.blocked + (h.kills || 0), heroes: a.heroes + 1, finals: a.finals + (h.finals || 0) }), { waves: 0, blocked: 0, heroes: 0, finals: 0 });
  }
  function leaderboard() {
    const list = state.mode !== 'local' ? state.heroes : (state.hero ? [state.hero] : []);
    return [...list].sort((a, b) => (b.kills || 0) - (a.kills || 0)).slice(0, PI_CONFIG.ui.leaderboardMax);
  }
  // 12 區對抗：每位英雄選一個行政區，該區分數 = 選這區的英雄擋下的總數（換區會把自己的戰績一起帶過去）
  function districtBoard() {
    // 自己那列用本機最新的（剛打完的這波還沒從伺服器刷回來）
    const me = state.hero && state.uid ? { ...state.hero, id: state.uid } : state.hero; let list = state.mode !== 'local' ? state.heroes.map(h => me && h.id === me.id ? { ...h, ...me } : h) : (me ? [me] : []);
    if (me && state.mode !== 'local' && !list.some(h => h.id === me.id)) list = [...list, me];
    const rows = new Map(PI_CONFIG.islands.filter(i => !i.detached).map(i => [i.id, { id: i.id, name: i.name, kills: 0, rounds: 0, heroes: 0 }]));
    for (const h of list) { const r = rows.get(h.district); if (r) { r.kills += h.kills || 0; r.rounds += h.rounds || 0; r.heroes += 1; } }
    return [...rows.values()].sort((a, b) => b.kills - a.kills || b.heroes - a.heroes || PI_CONFIG.islands.findIndex(i => i.id === a.id) - PI_CONFIG.islands.findIndex(i => i.id === b.id));
  }
  function listIssues() {
    const byId = new Map(PI_CONFIG.issues.map(i => [i.id, i]));
    for (const i of state.issuesRemote) byId.set(i.id, { ...byId.get(i.id), ...i });
    return [...byId.values()].filter(i => !i.hidden);
  }
  function listPolicies() {
    const byId = new Map(PI_CONFIG.policies.map(i => [i.id, i]));
    for (const i of state.policiesRemote) byId.set(i.id, { ...byId.get(i.id), ...i });
    return [...byId.values()].filter(i => !i.hidden);
  }
  async function init() {
    state.hero = loadLocalHero();
    const claude = window.claude;
    if (!claude || typeof claude.use !== 'function') { await initSupabase(); return finishInit(); }
    const [db, user, room] = await Promise.all([claude.use('db'), claude.use('user'), claude.use('room')]);
    if (room) { state.room = room; room.onPeers(ch => { const viewers = ch.peers.filter(p => p.kind === 'viewer'); state.onlinePeople = viewers.map((p, i) => peer(String(p.id || i), p.presence)); state.online = Math.max(1, viewers.length); state.onlineNames = state.onlinePeople.map(p => p.nick).filter(Boolean); emit('online'); }, err => console.warn('[store] room', err)); }
    state.db = db; state.user = user;
    if (user) {
      const me = await user.me();
      state.uid = me.id; state.me = { name: me.name || '', avatarUrl: me.avatarUrl, color: me.color };
      state.canEdit = me.canEdit; state.canWrite = await user.can('data.write');
    }
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
  const peer = (id, p) => { p = p || {}; return { id, nick: typeof p.nick === 'string' ? p.nick.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24) : '', cls: typeof p.cls === 'string' && Object.hasOwn(PI_CONFIG.heroes, p.cls) ? p.cls : null, phase: p.phase === 'round' ? 'round' : 'lobby', away: p.away === true }; };
  // ── Supabase（靜態站用）：匿名登入取得每位訪客的 uid；heroes 每人一列；presence 頻道算線上人數 ──
  let refreshT = 0;
  // heroes.district 欄位要先跑 supabase/districts.sql；還沒加的話自動退回不含 district 的讀寫，戰績照存
  const noDistrictCol = err => err && /district/.test(err.message || '');
  async function refreshHeroes() { const B = window.PI_BACKEND; const cols = 'id,nick,cls,rounds,kills,finals'; let { data, error } = await state.sb.from('heroes').select(state.noDistrict ? cols : cols + ',district').limit(B.heroesLimit || 1000);
    if (noDistrictCol(error)) { state.noDistrict = true; console.warn('[store] heroes 沒有 district 欄位，請執行 supabase/districts.sql'); ({ data, error } = await state.sb.from('heroes').select(cols).limit(B.heroesLimit || 1000)); }
    if (error) { console.warn('[store] heroes', error.message); return; }
    if (state.noDistrict && state.hero) for (const h of data || []) if (h.id === state.uid) h.district = state.hero.district;
    state.heroes = data || []; const mine = state.heroes.find(h => h.id === state.uid); if (mine) { if (!mine.district && state.hero && state.hero.district) mine.district = state.hero.district; state.hero = { ...(state.hero || {}), ...mine }; saveLocalHero(state.hero); } emit('global'); emit('leaderboard'); }
  async function initSupabase() { const B = window.PI_BACKEND || {}; if (!B.supabaseUrl || !B.supabaseAnonKey) return false;
    try { const { createClient } = await import(B.supabaseJs); const sb = createClient(B.supabaseUrl, B.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
      let { data: { session } } = await sb.auth.getSession(); if (!session) { const r = await sb.auth.signInAnonymously(); if (r.error) throw r.error; session = r.data.session; }
      state.sb = sb; state.uid = session.user.id; state.mode = 'supabase'; state.canWrite = true; state.canEdit = false;
      await refreshHeroes(); sb.channel('heroes-db').on('postgres_changes', { event: '*', schema: 'public', table: 'heroes' }, () => { clearTimeout(refreshT); refreshT = setTimeout(refreshHeroes, 1500); }).subscribe();
      const [pol, iss] = await Promise.all([sb.from('policies').select('id,data'), sb.from('issues').select('id,data')]);
      state.policiesRemote = (pol.data || []).map(r => ({ ...(r.data || {}), id: r.id })); state.issuesRemote = (iss.data || []).map(r => ({ ...(r.data || {}), id: r.id })); emit('policies'); emit('issues');
      const ch = sb.channel('online', { config: { presence: { key: state.uid } } });
      ch.on('presence', { event: 'sync' }, () => { const ps = ch.presenceState(); state.onlineIds = Object.keys(ps); state.onlinePeople = Object.entries(ps).map(([id, a]) => peer(id, a[0])); state.online = Math.max(1, state.onlinePeople.length); state.onlineNames = state.onlinePeople.map(p => p.nick).filter(Boolean); emit('online'); });
      ch.subscribe(st => { if (st === 'SUBSCRIBED') { state.presenceCh = ch; ch.track(state.presence).catch(() => {}); } });
      // 多人同框：英雄位置、表情、大招走 broadcast（不寫資料庫、不保留），收到的內容一律當不可信資料，由 UI 驗證
      const play = sb.channel('play', { config: { broadcast: { self: false } } });
      play.on('broadcast', { event: 'm' }, ({ payload }) => { for (const fn of state.subs.net) fn(payload); });
      play.subscribe(st => { if (st === 'SUBSCRIBED') state.playCh = play; });
      return true; } catch (e) { console.warn('[store] supabase 連線失敗，改用本機模式', e); state.mode = 'local'; return false; } }
  function finishInit() { emit('global'); emit('leaderboard'); emit('issues'); emit('policies'); emit('online'); return state; }
  function setPresence(patch) { state.presence = { ...state.presence, ...patch }; if (state.room) state.room.presence(patch).catch(e => console.warn('[store] presence', e && e.code)); if (state.presenceCh) state.presenceCh.track(state.presence).catch(() => {}); }
  function send(msg) { if (!state.playCh || !state.uid) return false; state.playCh.send({ type: 'broadcast', event: 'm', payload: { ...msg, id: state.uid } }).catch(() => {}); return true; }
  function hero() { return state.hero; }
  async function saveHero(patch) {
    state.hero = { ...(state.hero || { rounds: 0, kills: 0, finals: 0 }), ...patch };
    saveLocalHero(state.hero);
    await pushHero();
    emit('global'); emit('leaderboard');
  }
  async function pushHero() {
    if (state.sb && state.uid && state.hero) { const h = state.hero; const row = { id: state.uid, nick: String(h.nick || '').slice(0, 24), cls: h.cls || 'chief', rounds: h.rounds || 0, kills: h.kills || 0, finals: h.finals || 0, last_issue: h.lastIssue || null, last_at: new Date().toISOString() };
      let { error } = await state.sb.from('heroes').upsert(state.noDistrict ? row : { ...row, district: h.district || null });
      if (noDistrictCol(error)) { state.noDistrict = true; ({ error } = await state.sb.from('heroes').upsert(row)); }
      if (error) { console.warn('[store] hero upsert', error.message); return false; } return true; }
    if (!(state.db && state.uid && state.hero)) return false;
    const body = { nick: String(state.hero.nick || '').slice(0, 24), cls: state.hero.cls || 'chief', district: state.hero.district || null, rounds: state.hero.rounds || 0, kills: state.hero.kills || 0, finals: state.hero.finals || 0, lastAt: new Date().toISOString(), lastIssue: state.hero.lastIssue || null };
    try { await state.db.doc('heroes/' + state.uid).set(body); return true; }
    catch (e) { console.warn('[store] write refused', e && e.code); state.canWrite = false; return false; }
  }
  async function recordRound(r) {
    const h = state.hero || { rounds: 0, kills: 0, finals: 0 };
    await saveHero({ rounds: (h.rounds || 0) + 1, kills: (h.kills || 0) + r.kills, finals: (h.finals || 0) + (r.final ? 1 : 0), lastIssue: r.issueId });
  }
  async function addPolicy(policy) {
    if (!(state.db && state.canEdit)) throw new Error('只有編輯者可以新增政策');
    await state.db.doc('policies/' + policy.id).set(policy);
  }
  async function addIssue(issue) {
    if (!(state.db && state.canEdit)) throw new Error('只有編輯者可以新增議題');
    await state.db.doc('issues/' + issue.id).set(issue);
  }
  return { init, hero, saveHero, recordRound, listIssues, addIssue, listPolicies, addPolicy, totals, leaderboard, districtBoard,
    onPolicies: fn => { state.subs.policies.push(fn); fn(listPolicies()); },
    onOnline: fn => { state.subs.online.push(fn); fn(state.online, state.onlineNames, state.onlinePeople); }, setPresence, send,
    onNet: fn => { state.subs.net.push(fn); },
    onGlobal: fn => { state.subs.global.push(fn); fn(totals()); },
    onLeaderboard: fn => { state.subs.leaderboard.push(fn); fn(leaderboard()); },
    onIssues: fn => { state.subs.issues.push(fn); fn(listIssues()); },
    get state() { return state; } };
})();
