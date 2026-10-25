/* 打工的走路規則：能走的地方 = 島面（六角形，往內縮一點）＋橋；建築是圓形障礙物（撞到會沿邊滑開）。
   跨島找路：步道路網（每島 12 個環節點＋橋）先算好全部節點兩兩之間的「下一跳」，走的時候挑看得到的最遠節點直接走過去。 */
import { R, insideHex } from './islands.js';
export function createNav({ islands, centers, bridges, links, graph }) {
  const HEX = (R - 0.1) * 0.8660254, nodes = graph.nodes, N = nodes.length;
  const isl = islands.map(i => ({ id: i.id, c: centers.get(i.id) }));
  const segs = [...bridges.map(b => [b.pa, b.pb, 0.19]), ...links.map(l => [l.pa, l.pb, 0.25])].map(([a, b, w]) => { const dx = b.x - a.x, dz = b.z - a.z; return { ax: a.x, az: a.z, dx, dz, L2: dx * dx + dz * dz || 1, w }; });
  let statics = [], dyn = [], obst = [];
  const setObstacles = (s, d) => { if (s) statics = s; if (d) dyn = d; obst = [...statics, ...dyn]; };
  function islandAt(x, z) { for (const I of isl) if (insideHex(x - I.c.x, z - I.c.z, HEX)) return I.id; return null; }
  function onBridge(x, z) { for (const s of segs) { let t = ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.L2; if (t < -0.15 || t > 1.15) continue; t = Math.max(0, Math.min(1, t)); const px = s.ax + s.dx * t - x, pz = s.az + s.dz * t - z; if (px * px + pz * pz < s.w * s.w) return true; } return false; }
  const walkable = (x, z) => islandAt(x, z) !== null || onBridge(x, z);
  // 撞到建築：往外推到圓外（推出去的位置也要能走）
  function push(p, r) { for (let k = 0; k < 2; k++) for (const o of obst) { const dx = p.x - o[0], dz = p.z - o[1], rr = o[2] + r, d2 = dx * dx + dz * dz; if (d2 >= rr * rr || d2 < 1e-10) continue; const d = Math.sqrt(d2), f = (rr - d) / d, nx = p.x + dx * f, nz = p.z + dz * f; if (walkable(nx, nz)) { p.x = nx; p.z = nz; } } }
  // 移動：整段能走就走；不能走就試著偏一點角度（沿著島邊或橋邊滑），速度乘 cos
  const TRY = [0, 0.45, -0.45, 0.9, -0.9, 1.3, -1.3];
  function move(p, dx, dz, r = 0.14) { if (!dx && !dz) { push(p, r); return true; }
    if (!walkable(p.x, p.z)) { p.x += dx; p.z += dz; return true; } // 站在不能走的地方（例如被推出去）：先讓他走回來
    for (const a of TRY) { const c = Math.cos(a), s = Math.sin(a), mx = (dx * c - dz * s) * c, mz = (dx * s + dz * c) * c; if (walkable(p.x + mx, p.z + mz)) { p.x += mx; p.z += mz; push(p, r); return true; } }
    push(p, r); return false; }
  function los(ax, az, bx, bz) { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.2); for (let i = 1; i <= n; i++) { const t = i / n; if (!walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false; } return true; }
  // 下一跳表（Floyd–Warshall，156 個節點，載入時算一次）
  const dist = new Float32Array(N * N).fill(Infinity), next = new Int16Array(N * N).fill(-1);
  for (let i = 0; i < N; i++) { dist[i * N + i] = 0; next[i * N + i] = i; for (const [j, w] of graph.adj[i]) { dist[i * N + j] = w; next[i * N + j] = j; } }
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) { const ik = dist[i * N + k]; if (ik === Infinity) continue; for (let j = 0; j < N; j++) { const v = ik + dist[k * N + j]; if (v < dist[i * N + j]) { dist[i * N + j] = v; next[i * N + j] = next[i * N + k]; } } }
  function nodeFor(x, z) { const id = islandAt(x, z); let best = -1, bd = Infinity; for (let i = 0; i < N; i++) { if (id && nodes[i].island !== id) continue; const p = nodes[i].p, d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } return best; }
  // 走向 (tx, tz) 下一步要往哪裡：看得到就直走；看不到就沿下一跳鏈挑看得到的最遠節點。ringOnly = 卡住時改成一個節點一個節點走（步道上沒有建築）
  function waypoint(fx, fz, tx, tz, ringOnly = false) {
    if (!ringOnly && los(fx, fz, tx, tz)) return [tx, tz];
    const a = nodeFor(fx, fz), b = nodeFor(tx, tz); if (a < 0 || b < 0) return [tx, tz];
    if (a === b) { const p = nodes[a].p; return Math.hypot(p.x - fx, p.z - fz) < 0.2 ? [tx, tz] : [p.x, p.z]; }
    let best = a, cur = a;
    for (let k = 0; k < (ringOnly ? 1 : 6) && cur !== b; k++) { cur = next[cur * N + b]; if (cur < 0) break; const p = nodes[cur].p; if (ringOnly || los(fx, fz, p.x, p.z)) best = cur; else break; }
    const ap = nodes[a].p; if (best === a && Math.hypot(ap.x - fx, ap.z - fz) < 0.2) { const n = next[a * N + b]; if (n >= 0) best = n; }
    if (best === b && los(fx, fz, tx, tz)) return [tx, tz];
    const p = nodes[best].p; return [p.x, p.z]; }
  const pathLen = (fx, fz, tx, tz) => { if (los(fx, fz, tx, tz)) return Math.hypot(tx - fx, tz - fz); const a = nodeFor(fx, fz), b = nodeFor(tx, tz); if (a < 0 || b < 0) return Infinity; const pa = nodes[a].p, pb = nodes[b].p; return Math.hypot(pa.x - fx, pa.z - fz) + dist[a * N + b] + Math.hypot(tx - pb.x, tz - pb.z); };
  // 離 (x, z) 最近、可以走、不在建築裡的點（金蛋掉在水上或建築裡時用）
  function nearestWalkable(x, z, r = 0.14) { const ok = (px, pz) => walkable(px, pz) && !obst.some(o => (px - o[0]) ** 2 + (pz - o[1]) ** 2 < (o[2] + r) ** 2);
    if (ok(x, z)) return [x, z];
    for (let rad = 0.15; rad < 6; rad += 0.15) for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad; if (ok(px, pz)) return [px, pz]; }
    const p = nodes[nodeFor(x, z)].p; return [p.x, p.z]; }
  return { walkable, islandAt, move, push, los, waypoint, pathLen, nearestWalkable, setObstacles, nodeFor, get obstacles() { return obst; } };
}
