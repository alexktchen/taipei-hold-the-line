/* 車流模擬：每台車在一條 link 的某條車道上，跟前車用 IDM（智慧駕駛模型）決定加減速。
   車道從 L.s0（路口的另一頭）到停止線（L.len − L.stop）；過了停止線就沿著一條貝茲曲線穿過路口，接到下一段的車道（曲線算在下一段車道座標的負值那一截）。
   車道最前面那台車要看：號誌（紅燈、來不及停的黃燈停在停止線）、小路接大路要讓、下一段車道有沒有空間（不擋路口）、事故佔住的車道。
   車道依下一個轉彎決定：左轉走最內側、右轉走最外側（機車也走外側），直行挑比較空的。
   到路口依道路等級與轉彎角度選下一段，一趟跑完在路口消失；車量跟著時段與交通量設定從路口開出來補。 */
import { connector } from './data.js';
const ROUTE_W = [3, 2.5, 2, 1.6, 1.2, 0.22, 0.06], SPAWN_W = [1.3, 1.2, 1.4, 1.2, 0.9, 0.12, 0.03];
// 平日每小時的車量（尖峰＝1）
export const PROFILE = [0.16, 0.1, 0.07, 0.06, 0.08, 0.18, 0.45, 0.85, 1, 0.82, 0.66, 0.65, 0.7, 0.66, 0.63, 0.68, 0.8, 0.95, 1, 0.86, 0.66, 0.52, 0.4, 0.26];
// 車種：轎車、計程車、公車、機車（台北的機車很多，都走外側車道、跟車比較近、起步快）
export const KINDS = [{ len: 4.6, a: 1.4, s0: 2.2, T: 1.3 }, { len: 4.6, a: 1.5, s0: 2.0, T: 1.2 }, { len: 11.5, a: 0.9, s0: 2.6, T: 1.6 }, { len: 2.0, a: 2.2, s0: 1.0, T: 0.9 }];
const B = 2.2;
const angleBetween = (L, M) => { const p = L.pts, n = p.length, q = M.pts; const a = Math.atan2(p[n - 1] - p[n - 3], p[n - 2] - p[n - 4]), b = Math.atan2(q[3] - q[1], q[2] - q[0]); let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function createSim(net, sig, opt = {}) {
  const V = new Set(), active = new Set(); let t = opt.t0 ?? 8 * 3600, volume = 1, base = opt.base || 8000, nextId = 1, spawnT = 0, statT = 0, rain = 0;
  let spawnCum = new Float64Array(0), spawnIds = []; const hooks = { cross: null, stop: null }; // 給診斷用：車子過停止線、在紅燈前停下
  const stats = { n: 0, moving: 0, stopped: 0, atRed: 0, avg: 0, target: 0, trips: 0, stuck: 0 };
  function rebuildSpawn() { const ids = [], cum = []; let s = 0; for (const L of net.links) { if (L.lv < 0 || L.len - L.s0 - L.stop < 15) continue; s += L.lanes * L.len * SPAWN_W[L.cls]; ids.push(L.id); cum.push(s); } spawnIds = ids; spawnCum = Float64Array.from(cum); }
  const pickSpawn = () => { const r = Math.random() * spawnCum[spawnCum.length - 1]; let lo = 0, hi = spawnCum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (spawnCum[m] < r) lo = m + 1; else hi = m; } return net.links[spawnIds[lo]]; };
  const hourOf = () => ((t / 3600) % 24 + 24) % 24;
  function demand() { const h = hourOf(), i = Math.floor(h), f = h - i; return Math.round(base * volume * (PROFILE[i] * (1 - f) + PROFILE[(i + 1) % 24] * f)); }
  // 到路口選下一段：直走權重最高，右轉次之（右駕），左轉再次，迴轉幾乎不會（死巷才迴轉）
  function chooseNext(L, v) { const outs = net.out[L.to]; if (!outs || !outs.length) return -1; let tot = 0; const w = [];
    for (const id of outs) { const M = net.links[id]; let x = 0; if (M.e !== L.e && !M.closed) { const d = angleBetween(L, M), ad = Math.abs(d); x = ROUTE_W[M.cls] * (ad < 0.5 ? 1 : ad < 2.2 ? (d > 0 ? 0.45 : 0.32) : 0.03); if (v.trip < 400 && M.cls >= 5) x *= 4; if (M.lv < 0) x *= 0.6; if (v.kind === 2 && M.cls >= 5) x *= 0.05; } w.push(x); tot += x; }
    if (tot <= 0) { const back = outs.find(id => net.links[id].e === L.e); return back ?? -1; }
    let r = Math.random() * tot; for (let i = 0; i < outs.length; i++) { r -= w[i]; if (r <= 0) return outs[i]; } return outs[outs.length - 1]; }
  const backTail = (M, lane) => { const q = M.q[lane]; if (!q.length) return 1e9; const b = q[q.length - 1]; return b.s - b.len; };
  // 依下一個轉彎選車道：左轉最內側（0）、右轉與機車最外側、直行挑後面比較空的
  function laneFor(M, next, v) { const n = M.lanes; if (n === 1) return 0; const d = next >= 0 ? angleBetween(M, net.links[next]) : 0;
    if (v.kind === 3) return n - 1; if (Math.abs(d) >= 2.6 || (d < -0.5)) return 0; if (d > 0.5) return n - 1;
    let best = Math.floor(Math.random() * n), bs = backTail(M, best); for (let i = 0; i < n; i++) { const s = backTail(M, i); if (s > bs + 8) { bs = s; best = i; } } return best; }
  // 插進車道（依位置排好：前面的 s 大）
  function insert(q, v) { let i = q.length; while (i > 0 && q[i - 1].s < v.s) i--; q.splice(i, 0, v); }
  function enter(v, M, lane, s, next) { v.L = M; v.lane = lane; v.s = s; v.seg = 0; v.passed = false; v.yw = 0; v.next = next; v.turn = next >= 0 ? Math.abs(angleBetween(M, net.links[next])) : 0; v.nLane = -1; v.redSeen = 0; v.blocked = 0; active.add(M); insert(M.q[lane], v); }
  function makeVehicle(L) { const r = Math.random(), kind = r < 0.3 ? 3 : L.cls <= 3 && r < 0.34 ? 2 : r < 0.52 ? 1 : 0, K = KINDS[kind];
    return { id: nextId++, kind, len: K.len, a: K.a, s0: K.s0, T: K.T, v: 0, vf: kind === 3 ? 0.9 + Math.random() * 0.25 : 0.82 + Math.random() * 0.26, trip: 1500 + Math.random() * 7000, wait: 0, age: 0, col: Math.floor(Math.random() * 1e6), conn: null }; }
  // 從路口開出來：這條車道最後一台車離起點夠遠才放
  function spawnAt(L) { const v = makeVehicle(L), next = chooseNext(L, v), lane = laneFor(L, next, v); if (backTail(L, lane) - L.s0 < 14) return false; v.v = L.vf * 0.4; enter(v, L, lane, L.s0, next); V.add(v); return true; }
  // 一開始把車撒在路上（前後至少留 12 公尺）
  function scatter(n) { for (let k = 0; k < n * 3 && V.size < n; k++) { const L = pickSpawn(), v = makeVehicle(L), next = chooseNext(L, v), lane = laneFor(L, next, v), lo = L.s0 + 5, hi = L.len - L.stop - 2; if (hi <= lo) continue; const s = lo + Math.random() * (hi - lo), q = L.q[lane];
      if (q.some(o => Math.abs(o.s - s) < 12)) continue; v.v = L.vf * (0.5 + Math.random() * 0.4); enter(v, L, lane, s, next); V.add(v); } }
  function remove(v) { const q = v.L.q[v.lane], i = q.indexOf(v); if (i >= 0) q.splice(i, 1); V.delete(v); stats.trips++; }
  // 車道最前面那台車的「前方障礙」：回傳 [間距, 障礙物速度]，沒有就 null
  function frontObstacle(v, L) { const stopPos = L.len - L.stop, dStop = stopPos - v.s;
    let flash = false; if (L.ctrl >= 0 && !v.passed) { const st = sig.linkState(L, t); if (st === 'f') flash = true; else if (st === 'r' || (st === 'y' && v.v * v.v / (2 * B) < dStop + 1)) { v.atRed = true; return [dStop, 0]; } }
    if ((L.yieldTo || flash) && !v.passed && dStop < 30) { /* 小路接大路要讓；號誌故障閃黃時，每個方向都要看別的方向有沒有車 */ let conflict = false; if (v.yw < 8) for (const id of net.inn[L.to]) { const M = net.links[id]; if ((flash ? M.cls > L.cls : M.cls >= L.cls) || M.e === L.e) continue; for (const q of M.q) { const f = q[0]; if (f && M.len - M.stop - f.s < 25 && f.v > 1) { conflict = true; break; } } if (conflict) break; }
      if (conflict) return [dStop, 0]; }
    if (v.next < 0) return null; const M = net.links[v.next]; if (v.nLane < 0) { v.nNext = chooseNext(M, v); v.nLane = laneFor(M, v.nNext, v); }
    const tail = backTail(M, v.nLane), entry = M.s0 - 12; // 接上去的位置大約在下一段起點前 12 公尺（路口曲線）
    if (tail - entry < v.len + 2 && !v.passed) { v.blocked += 1; return [dStop, 0]; } // 下一段塞住：不進路口
    if (tail > 1e8) return null; const b = M.q[v.nLane][M.q[v.nLane].length - 1]; return [dStop + (tail - entry), b ? b.v : 0]; }
  function step(dt) { t += dt; stats.atRed = 0; sig.choose(t); const rainK = 1 - 0.22 * rain, rainT = 0.35 * rain;
    for (const L of active) { let any = false; for (let li = 0; li < L.lanes; li++) { const q = L.q[li]; if (!q.length) continue; any = true;
        for (let i = 0; i < q.length; i++) { const v = q[i]; if (v.fixed) { v.acc = 0; continue; } v.atRed = false; let v0 = L.vf * v.vf * rainK; const dStop = L.len - L.stop - v.s;
          if (v.s < L.s0) v0 = Math.min(v0, v.turnIn || v0); // 還在路口曲線上：照轉彎速度
          if (i === 0 && dStop < 30 && v.turn > 0.5) v0 = Math.min(v0, v.turn > 2.2 ? 3 : v.turn > 1.1 ? 5.5 : 8.5); // 轉彎前減速
          if (i === 0 && L.yieldTo && dStop < 30) v0 = Math.min(v0, 6);
          let acc = v.a * (1 - Math.pow(v.v / Math.max(0.1, v0), 4)), ob = null;
          if (i > 0) { const f = q[i - 1]; ob = [f.s - f.len - v.s, f.v]; } else ob = frontObstacle(v, L);
          if (ob) { const gap = Math.max(0.1, ob[0]), ss = v.s0 + Math.max(0, v.v * (v.T + rainT) + v.v * (v.v - ob[1]) / (2 * Math.sqrt(v.a * B))); acc -= v.a * (ss / gap) * (ss / gap); }
          v.acc = Math.max(-9, acc); if (v.atRed) { stats.atRed++; if (v.v < 0.3 && !v.redSeen) { v.redSeen = 1; hooks.stop && hooks.stop(v, L, t); } } }
        for (const v of q) { if (v.fixed) continue; const nv = v.v + v.acc * dt; if (nv < 0) { v.s += v.acc < 0 ? v.v * v.v / (-2 * v.acc) : 0; v.v = 0; } else { v.s += (v.v + nv) * dt / 2; v.v = nv; } v.age += dt; v.trip -= v.v * dt; // 這一步內停下來的，只走到停下的地方
          if (v.v < 0.2) v.wait += dt; else v.wait = 0; if (L.yieldTo && v.v < 0.2) v.yw += dt; L.sumV += v.v; L.nV++; } }
      if (!any) active.delete(L); }
    // 過了停止線：沿著路口曲線接到下一段（或下車）
    for (const L of [...active]) for (let li = 0; li < L.lanes; li++) { const q = L.q[li];
      while (q.length && !q[0].fixed && q[0].s >= L.len - L.stop) { const v = q.shift(), over = v.s - (L.len - L.stop); hooks.cross && hooks.cross(v, L, t);
        if (v.next < 0 || (v.trip <= 0 && Math.random() < 0.6) || net.links[v.next].closed) { V.delete(v); stats.trips++; continue; }
        const M = net.links[v.next]; if (v.nLane < 0) { v.nNext = chooseNext(M, v); v.nLane = laneFor(M, v.nNext, v); } const c = connector(net, L, li, M, v.nLane);
        v.conn = c; v.connFrom = M.s0 - c.len; v.turnIn = v.turn > 2.2 ? 3 : v.turn > 1.1 ? 5.5 : v.turn > 0.5 ? 8.5 : 99; enter(v, M, v.nLane, v.connFrom + over, v.nNext); }
      // 卡太久（不是在等紅燈）就讓它離開，避免死結
      if (q.length && !q[0].fixed && q[0].wait > 90 && !q[0].atRed) { stats.stuck++; remove(q[0]); } }
    // 補車／減車
    spawnT += dt; if (spawnT >= 0.5) { spawnT = 0; const want = demand(); stats.target = want; let n = V.size;
      for (let k = 0; k < 60 && n < want; k++) if (spawnAt(pickSpawn())) n++;
      if (n > want * 1.03) { let drop = Math.min(80, n - want); for (const v of V) { if (drop-- <= 0) break; if (!v.fixed) v.trip = Math.min(v.trip, 0); } } }
    statT += dt; if (statT >= 2) { statT = 0; let mv = 0, st = 0, sum = 0; for (const v of V) { sum += v.v; if (v.v < 0.5) st++; else mv++; } stats.n = V.size; stats.moving = mv; stats.stopped = st; stats.avg = V.size ? sum / V.size : 0;
      for (const L of net.links) if (L.nV) { const r = Math.min(1.2, L.sumV / L.nV / L.vf); L.ema = L.seen ? L.ema * 0.6 + r * 0.4 : r; L.seen = t; L.sumV = 0; L.nV = 0; L.colorDirty = true; } } }
  // 事件：在某條車道某處放一台不會動的事故車（fixed），持續 secs 秒
  function blockLane(L, lane, s, secs) { const v = { id: nextId++, kind: 0, len: 6, a: 0, s0: 0, T: 0, v: 0, vf: 0, trip: 1e9, wait: 0, age: 9, col: 0, fixed: true, until: t + secs, crash: true, conn: null };
    v.L = L; v.lane = lane; v.s = s; v.seg = 0; v.next = -1; active.add(L); insert(L.q[lane], v); V.add(v); return v; }
  function clearFixed() { for (const v of [...V]) if (v.fixed && t > v.until) remove(v); }
  return { V, step, scatter, rebuildSpawn, stats, hooks, blockLane, clearFixed, remove, get t() { return t; }, set t(v) { t = v; }, get hour() { return hourOf(); }, setVolume(x) { volume = x; }, get volume() { return volume; }, setBase(n) { base = n; }, get base() { return base; }, demand,
    set rain(x) { rain = x; }, get rain() { return rain; }, spawnNear(x, z, r, n) { const near = net.links.filter(L => L.cls <= 5 && L.lv >= 0 && Math.hypot(L.pts[0] - x, L.pts[1] - z) < r); let k = 0; for (let i = 0; i < n * 4 && k < n && near.length; i++) if (spawnAt(near[Math.floor(Math.random() * near.length)])) k++; return k; } }; }
