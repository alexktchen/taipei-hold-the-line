/* 一起闖關的房間（Supabase Realtime）。最多 4 人；房主的瀏覽器跑模擬，其他人只送位置與指令、收快照。
   頻道：shift-<房號>：成員名單（presence，key = 匿名 uid）＋房主廣播（快照、開始闖關、結算）。
         shift-<房號>-u-<uid 前 8 碼>：每位房客一條，只有房主和那位房客在裡面，房客的位置只送給房主，訊息量跟人數成正比。
   快速配對：房主把房號、人數、狀態放進全站的 online presence（store.setPresence），其他人從那裡挑還有空位、還在等人的公開房。
   收到的一切都是其他訪客送的：這裡只轉交，內容由 ui.js／game.js 驗證。 */
export function createRoom({ S, C, on }) {
  const NC = C.net; const R = { code: null, host: false, pub: false, st: 'wait', members: [], ids: [], hostId: null, ch: null, up: null, ups: new Map(), profile: {}, joinedAt: 0, hostSeen: 0, closing: false };
  const uid = () => S.state.uid, short = id => String(id).replace(/-/g, '').slice(0, 8);
  const ok = () => !!(S.state.sb && S.state.uid);
  const newCode = () => { const taken = new Set(S.state.onlinePeople.map(p => p.room).filter(Boolean)); for (let k = 0; k < 20; k++) { let c = ''; for (let i = 0; i < NC.codeLen; i++) c += NC.codeChars[Math.floor(Math.random() * NC.codeChars.length)]; if (!taken.has(c)) return c; } return 'R' + Date.now().toString(36).slice(-NC.codeLen + 1).toUpperCase(); };
  const clean = (v, n) => typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').trim().slice(0, n) : '';
  // 成員名單：依加入時間排序，前 roomMax 位是正式成員
  function readMembers() { const ps = R.ch.presenceState(); const list = []; for (const [id, arr] of Object.entries(ps)) { const p = arr[0] || {}; if (typeof id !== 'string' || id.length > 64) continue;
      list.push({ id, nick: clean(p.nick, 24), cls: typeof p.cls === 'string' && Object.hasOwn(C.heroes, p.cls) ? p.cls : 'chief', district: typeof p.district === 'string' ? p.district.slice(0, 16) : null, fit: clean(p.fit, 60), grade: Math.max(0, Math.min(C.grades.names.length - 1, p.grade | 0)), pts: Math.max(0, Math.min(C.grades.topPtsCap, p.pts | 0)), t: Number.isFinite(p.t) ? p.t : Date.now(), host: p.host === 1, v: p.v | 0 }); }
    list.sort((a, b) => (b.host - a.host) || a.t - b.t || (a.id < b.id ? -1 : 1)); return list; }
  function track() { if (R.ch) R.ch.track({ ...R.profile, t: R.joinedAt, host: R.host ? 1 : 0, v: NC.protocol }).catch(() => {}); }
  function setProfile(p) { R.profile = { nick: clean(p.nick, 24), cls: p.cls, district: p.district || null, grade: p.grade | 0, pts: p.pts | 0, fit: clean(p.fit, 60) }; track(); }
  function globalPresence() { if (!R.code) { S.setPresence({ room: null, rh: null, rn: null, rs: null, pub: null }); return; } S.setPresence(R.host ? { phase: R.st === 'shift' ? 'shift' : 'room', room: R.code, rh: 1, rn: Math.min(NC.roomMax, R.members.length), rs: R.st, pub: R.pub ? 1 : 0 } : { phase: R.st === 'shift' ? 'shift' : 'room', room: R.code, rh: null, rn: null, rs: null, pub: null }); }
  function subscribeMain(code) { return new Promise(resolve => { const ch = S.state.sb.channel('shift-' + code, { config: { broadcast: { self: false }, presence: { key: uid() } } }); R.ch = ch;
    ch.on('presence', { event: 'sync' }, onSync);
    ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (!payload || typeof payload !== 'object' || R.host) return; if (payload.to && payload.to !== uid()) return; R.hostSeen = Date.now(); on.down && on.down(payload); });
    let done = false; ch.subscribe(st => { if (st === 'SUBSCRIBED') { track(); if (!done) { done = true; resolve(true); } } else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !done) { done = true; resolve(false); } }); }); }
  // 房主：成員變動時幫每位房客開一條收位置的頻道，超過人數的請他離開
  function onSync() { const list = readMembers(); const before = R.ids.join(',');
    if (R.host) { R.members = list.filter(m => !m.host || m.id === uid()).slice(0, NC.roomMax); for (const m of list.slice(NC.roomMax)) if (m.id !== uid()) sendDown({ t: 'full', to: m.id });
      const want = new Set(R.members.filter(m => m.id !== uid()).map(m => m.id));
      for (const id of want) if (!R.ups.has(id)) { const up = S.state.sb.channel(`shift-${R.code}-u-${short(id)}`, { config: { broadcast: { self: false } } }); up.on('broadcast', { event: 'm' }, ({ payload }) => { if (payload && typeof payload === 'object') on.up && on.up(id, payload); }); up.subscribe(); R.ups.set(id, up); }
      for (const [id, up] of [...R.ups]) if (!want.has(id)) { S.state.sb.removeChannel(up); R.ups.delete(id); on.left && on.left(id); }
      R.ids = R.members.map(m => m.id); if (R.ids.join(',') !== before) sendState(); globalPresence(); }
    else { R.members = list.slice(0, NC.roomMax); R.ids = R.members.map(m => m.id); const h = list.find(m => m.host); if (h) { R.hostId = h.id; R.hostSeen = Date.now(); } }
    on.roster && on.roster(R.members); }
  function sendState(extra) { if (!R.host || !R.ch) return; sendDown({ t: 'r', st: R.st, ids: R.ids, host: uid(), pub: R.pub ? 1 : 0, ...(extra || {}) }); }
  function sendDown(msg) { if (!R.host || !R.ch) return false; R.ch.send({ type: 'broadcast', event: 'm', payload: msg }).catch(() => {}); return true; }
  function sendUp(msg) { if (R.host || !R.up) return false; R.up.send({ type: 'broadcast', event: 'm', payload: msg }).catch(() => {}); return true; }
  let beat = 0;
  async function create(pub) { if (!ok()) return { ok: false, reason: 'offline' }; await leave(); R.code = newCode(); R.host = true; R.pub = !!pub; R.st = 'wait'; R.joinedAt = Date.now(); R.hostId = uid(); R.closing = false;
    if (!await subscribeMain(R.code)) { await leave(); return { ok: false, reason: 'net' }; }
    beat = setInterval(() => { if (R.host && R.st === 'wait') sendState(); }, NC.waitBeat * 1000); globalPresence(); return { ok: true, code: R.code }; }
  // 加入：等房主的狀態訊息確認有收我（或說滿了）；hostGrace 秒內沒看到房主就放棄
  function join(code) { code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (!ok()) return Promise.resolve({ ok: false, reason: 'offline' }); if (code.length < 3) return Promise.resolve({ ok: false, reason: 'code' });
    return (async () => { await leave(); R.code = code; R.host = false; R.st = 'wait'; R.joinedAt = Date.now(); R.closing = false; R.hostSeen = 0;
      const up = S.state.sb.channel(`shift-${code}-u-${short(uid())}`, { config: { broadcast: { self: false } } }); up.subscribe(); R.up = up;
      const res = await new Promise(async resolve => { const timer = setTimeout(() => resolve({ ok: false, reason: 'nohost' }), NC.hostGrace * 1000); const prev = on.down;
        on.down = msg => { if (msg.t === 'full') { clearTimeout(timer); on.down = prev; resolve({ ok: false, reason: 'full' }); return; } if (msg.t === 'r' && Array.isArray(msg.ids)) { if (msg.ids.includes(uid())) { clearTimeout(timer); on.down = prev; R.st = msg.st === 'shift' ? 'shift' : 'wait'; resolve({ ok: true, code }); prev && prev(msg); return; } } prev && prev(msg); };
        if (!await subscribeMain(code)) { clearTimeout(timer); on.down = prev; resolve({ ok: false, reason: 'net' }); } });
      if (!res.ok) { await leave(); return res; } globalPresence();
      beat = setInterval(() => { if (!R.code || R.host) return; const hostHere = R.members.some(m => m.host); if (!hostHere && Date.now() - R.hostSeen > NC.hostGrace * 1000) close('hostleft'); }, 1000);
      return res; })(); }
  // 快速配對：挑還在等人、有空位的公開房（人多的優先），都沒有就自己開一間公開房
  async function quick() { const mine = uid(); const rooms = S.state.onlinePeople.filter(p => p.host && p.room && p.pub && p.rs === 'wait' && p.rn < NC.roomMax && p.id !== mine).sort((a, b) => b.rn - a.rn);
    for (const r of rooms.slice(0, 3)) { const res = await join(r.room); if (res.ok) return res; } return create(true); }
  function close(reason) { if (R.closing) return; R.closing = true; const code = R.code; leave().then(() => on.closed && on.closed(reason, code)); }
  async function leave() { clearInterval(beat); beat = 0; const sb = S.state.sb; if (R.host && R.ch) { sendDown({ t: 'bye' }); await new Promise(r => setTimeout(r, 60)); }
    if (sb) { for (const up of R.ups.values()) sb.removeChannel(up); if (R.up) sb.removeChannel(R.up); if (R.ch) { try { await R.ch.untrack(); } catch (e) { /* 已斷線 */ } sb.removeChannel(R.ch); } }
    const had = !!R.code; Object.assign(R, { code: null, host: false, pub: false, st: 'wait', members: [], ids: [], hostId: null, ch: null, up: null, hostSeen: 0 }); R.ups = new Map(); if (had) globalPresence(); }
  function setStage(st) { R.st = st; if (R.host) { sendState(); globalPresence(); } else globalPresence(); }
  addEventListener('pagehide', () => { if (R.code) leave(); });
  return { R, create, join, quick, leave, close, sendDown, sendUp, sendState, setProfile, setStage, get code() { return R.code; }, get isHost() { return R.host; }, get members() { return R.members; }, available: ok };
}
