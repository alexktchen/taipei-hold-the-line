/* 車流模擬：每台車在一條 link 的某條車道上，跟前車用 IDM（智慧駕駛模型）決定加減速。
   車道最前面那台車要看：前方路口的號誌（紅燈、來不及停的黃燈以外都停在停止線）、小路接大路要讓、下一段路有沒有空間（不擋路口）。
   到路口時照道路等級與轉彎角度選下一段（直走最常、右轉次之、左轉再次，很少迴轉），走完這趟的距離就在路口消失；
   車子數量跟著時段（上下班尖峰）與交通量設定，從路口開出來補上。 */
import { pointAt } from './data.js';
const A = 1.4, B = 2.2, S0 = 2.2, T = 1.3, SQAB = 2 * Math.sqrt(A * B);
const ROUTE_W = [3, 2.5, 2, 1.6, 1.2, 0.22, 0.06], SPAWN_W = [1.3, 1.2, 1.4, 1.2, 0.9, 0.12, 0.03];
// 平日每小時的車量（尖峰＝1）
export const PROFILE = [0.16, 0.1, 0.07, 0.06, 0.08, 0.18, 0.45, 0.85, 1, 0.82, 0.66, 0.65, 0.7, 0.66, 0.63, 0.68, 0.8, 0.95, 1, 0.86, 0.66, 0.52, 0.4, 0.26];
const KINDS = [{ len: 4.6 }, { len: 4.6 }, { len: 11.5 }]; // 轎車、計程車、公車
const angleBetween = (L, M) => { const p = L.pts, n = p.length, q = M.pts; const a = Math.atan2(p[n - 1] - p[n - 3], p[n - 2] - p[n - 4]), b = Math.atan2(q[3] - q[1], q[2] - q[0]); let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function createSim(net, sig, opt = {}) {
  const V = new Set(), active = new Set(); let t = opt.t0 ?? 8 * 3600, volume = 1, base = opt.base || 8000, nextId = 1, spawnT = 0, statT = 0;
  let spawnCum = new Float64Array(0), spawnIds = [];
  const stats = { n: 0, moving: 0, stopped: 0, atRed: 0, avg: 0, target: 0, trips: 0 };
  function rebuildSpawn() { const ids = [], cum = []; let s = 0; for (const L of net.links) { if (L.lv < 0) continue; s += L.lanes * L.len * SPAWN_W[L.cls]; ids.push(L.id); cum.push(s); } spawnIds = ids; spawnCum = Float64Array.from(cum); }
  const pickSpawn = () => { const r = Math.random() * spawnCum[spawnCum.length - 1]; let lo = 0, hi = spawnCum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (spawnCum[m] < r) lo = m + 1; else hi = m; } return net.links[spawnIds[lo]]; };
  const hourOf = () => ((t / 3600) % 24 + 24) % 24;
  function demand() { const h = hourOf(), i = Math.floor(h), f = h - i; return Math.round(base * volume * (PROFILE[i] * (1 - f) + PROFILE[(i + 1) % 24] * f)); }
  // 到路口選下一段：直走權重最高，右轉次之（右駕），左轉再次，迴轉幾乎不會（死巷才迴轉）
  function chooseNext(L, v) { const outs = net.out[L.to]; if (!outs || !outs.length) return -1; let tot = 0; const w = [];
    for (const id of outs) { const M = net.links[id]; let x = 0; if (M.e !== L.e) { const d = angleBetween(L, M), ad = Math.abs(d); x = ROUTE_W[M.cls] * (ad < 0.5 ? 1 : ad < 2.2 ? (d > 0 ? 0.45 : 0.32) : 0.03); if (v.trip < 400 && M.cls >= 5) x *= 4; if (M.lv < 0) x *= 0.6; } w.push(x); tot += x; }
    if (tot <= 0) { const back = outs.find(id => net.links[id].e === L.e); return back ?? -1; }
    let r = Math.random() * tot; for (let i = 0; i < outs.length; i++) { r -= w[i]; if (r <= 0) return outs[i]; } return outs[outs.length - 1]; }
  const backSpace = (M, lane) => { const q = M.q[lane]; if (!q.length) return 1e9; const b = q[q.length - 1]; return b.s - b.len; };
  function bestLane(M, prefer) { let best = Math.min(prefer, M.lanes - 1), bs = backSpace(M, best); for (let i = 0; i < M.lanes; i++) { const s = backSpace(M, i); if (s > bs + 6) { bs = s; best = i; } } return best; }
  function place(v, L, lane, s) { v.L = L; v.lane = lane; v.s = s; v.seg = 0; v.passed = false; v.yw = 0; v.next = chooseNext(L, v); v.turn = v.next >= 0 ? Math.abs(angleBetween(L, net.links[v.next])) : 0; active.add(L); }
  function makeVehicle(L) { const r = Math.random(), kind = L.cls <= 3 && r < 0.05 ? 2 : r < 0.27 ? 1 : 0; return { id: nextId++, kind, len: KINDS[kind].len, v: 0, vf: 0.82 + Math.random() * 0.26, trip: 1500 + Math.random() * 7000, wait: 0, age: 0, col: Math.floor(Math.random() * 1e6) }; }
  // 從路口開出來：這條車道最後一台車離起點夠遠才放
  function spawnAt(L) { const lane = Math.floor(Math.random() * L.lanes); if (backSpace(L, lane) < 14) return false; const v = makeVehicle(L); v.v = L.vf * 0.5; place(v, L, lane, 0); L.q[lane].push(v); V.add(v); return true; }
  // 一開始把車撒在路上（依順序插進車道，前後至少留 12 公尺）
  function scatter(n) { for (let k = 0; k < n * 3 && V.size < n; k++) { const L = pickSpawn(), lane = Math.floor(Math.random() * L.lanes), s = Math.random() * L.len, q = L.q[lane]; let i = 0; while (i < q.length && q[i].s > s) i++;
      const ahead = q[i - 1], behind = q[i]; if ((ahead && ahead.s - ahead.len - s < 12) || (behind && s - (4.6 + behind.s) < 12)) continue; const v = makeVehicle(L); v.v = L.vf * (0.5 + Math.random() * 0.4); place(v, L, lane, s); q.splice(i, 0, v); V.add(v); } }
  function remove(v) { V.delete(v); stats.trips++; }
  // 車道最前面那台車的「前方障礙」：回傳 [間距, 障礙物速度]，沒有就 null
  function frontObstacle(v, L) { const dEnd = L.len - v.s, stopPos = L.len - L.stop;
    if (!v.passed && v.s > stopPos + 0.5) v.passed = true;
    if (L.ctrl >= 0 && !v.passed) { const st = sig.linkState(L, t); if (st === 'r' || (st === 'y' && v.v * v.v / (2 * B) < stopPos - v.s + 1)) { v.atRed = true; return [stopPos - v.s, 0]; } }
    if (L.yieldTo && !v.passed && dEnd < 30) { // 小路接大路：大路上 25 公尺內有車在動就等
      let conflict = false; if (v.yw < 8) for (const id of net.inn[L.to]) { const M = net.links[id]; if (M.cls >= L.cls || M.e === L.e) continue; for (const q of M.q) { const f = q[0]; if (f && M.len - f.s < 25 && f.v > 1) { conflict = true; break; } } if (conflict) break; }
      if (conflict) return [stopPos - v.s, 0]; }
    if (v.next < 0) return null; const M = net.links[v.next], lane = bestLane(M, v.lane), sp = backSpace(M, lane);
    if (sp < v.len + 3 && !v.passed) return [stopPos - v.s, 0]; // 下一段塞住了：不進路口
    if (sp > 200) return null; const b = M.q[lane][M.q[lane].length - 1]; return [dEnd + sp, b ? b.v : 0]; }
  function step(dt) { t += dt; stats.atRed = 0; sig.choose(t); // 時段到了換時制計畫
    for (const L of active) { let any = false; for (let li = 0; li < L.lanes; li++) { const q = L.q[li]; if (!q.length) continue; any = true;
        for (let i = 0; i < q.length; i++) { const v = q[i]; v.atRed = false; let v0 = L.vf * v.vf; const dEnd = L.len - v.s;
          if (i === 0 && dEnd < 30 && v.turn > 0.5) v0 = Math.min(v0, v.turn > 2.2 ? 3 : v.turn > 1.1 ? 6 : 9); // 轉彎前減速
          if (i === 0 && L.yieldTo && dEnd < 30) v0 = Math.min(v0, 6);
          let acc = A * (1 - Math.pow(v.v / Math.max(0.1, v0), 4)), ob = null;
          if (i > 0) { const f = q[i - 1]; ob = [f.s - f.len - v.s, f.v]; } else ob = frontObstacle(v, L);
          if (ob) { const gap = Math.max(0.1, ob[0]), ss = S0 + Math.max(0, v.v * T + v.v * (v.v - ob[1]) / SQAB); acc -= A * (ss / gap) * (ss / gap); }
          v.acc = Math.max(-9, acc); if (v.atRed) stats.atRed++; }
        for (const v of q) { const nv = v.v + v.acc * dt; if (nv < 0) { v.s += v.acc < 0 ? v.v * v.v / (-2 * v.acc) : 0; v.v = 0; } else { v.s += (v.v + nv) * dt / 2; v.v = nv; } v.age += dt; v.trip -= v.v * dt; // 這一步內停下來的，只走到停下的地方
          if (v.v < 0.2) v.wait += dt; else v.wait = 0; if (L.yieldTo && v.v < 0.2) v.yw += dt; L.sumV += v.v; L.nV++; } }
      if (!any) active.delete(L); }
    // 過了這段路的終點：接到下一段（或下車）
    for (const L of [...active]) for (let li = 0; li < L.lanes; li++) { const q = L.q[li];
      while (q.length && q[0].s >= L.len) { const v = q.shift(), over = v.s - L.len; if (v.next < 0 || v.trip <= 0 && Math.random() < 0.6) { remove(v); continue; }
        const M = net.links[v.next], lane = bestLane(M, li), mq = M.q[lane], b = mq[mq.length - 1]; let s = over; if (b) s = Math.min(s, b.s - b.len - 0.5); if (s < 0) s = 0;
        place(v, M, lane, s); mq.push(v); }
      // 卡太久（不是在等紅燈）就讓它離開，避免死結
      if (q.length && q[0].wait > 90 && !q[0].atRed) remove(q.shift()); }
    // 補車／減車
    spawnT += dt; if (spawnT >= 0.5) { spawnT = 0; const want = demand(); stats.target = want; let n = V.size;
      for (let k = 0; k < 60 && n < want; k++) if (spawnAt(pickSpawn())) n++;
      if (n > want * 1.03) { let drop = Math.min(80, n - want); for (const v of V) { if (drop-- <= 0) break; v.trip = Math.min(v.trip, 0); } } }
    statT += dt; if (statT >= 2) { statT = 0; let mv = 0, st = 0, sum = 0; for (const v of V) { sum += v.v; if (v.v < 0.5) st++; else mv++; } stats.n = V.size; stats.moving = mv; stats.stopped = st; stats.avg = V.size ? sum / V.size : 0;
      for (const L of net.links) if (L.nV) { const r = Math.min(1.2, L.sumV / L.nV / L.vf); L.ema = L.seen ? L.ema * 0.6 + r * 0.4 : r; L.seen = t; L.sumV = 0; L.nV = 0; L.colorDirty = true; } } }
  return { V, step, scatter, rebuildSpawn, stats, get t() { return t; }, set t(v) { t = v; }, get hour() { return hourOf(); }, setVolume(x) { volume = x; }, get volume() { return volume; }, setBase(n) { base = n; }, get base() { return base; }, demand }; }
