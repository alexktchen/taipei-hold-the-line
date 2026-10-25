/* 打工的走路規則：能走的地方 = 島面（六角形，往內縮一點）＋橋；建築是圓形障礙物（撞到會沿邊滑開）。
   跨島找路：步道路網（每島 12 個環節點＋橋）先算好全部節點兩兩之間的「下一跳」，走的時候挑看得到的最遠節點直接走過去。 */
import { R, insideHex } from './islands.js';
export function createNav({ islands, centers, bridges, links, graph }) {
  const HEX = (R - 0.06) * 0.8660254, nodes = graph.nodes, N = nodes.length;
  const isl = islands.map(i => ({ id: i.id, c: centers.get(i.id) }));
  const segs = [...bridges.map(b => [b.pa, b.pb, 0.3]), ...links.map(l => [l.pa, l.pb, 0.36])].map(([a, b, w]) => { const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1; return { ax: a.x, az: a.z, dx, dz, L2: L * L, L, ux: dx / L, uz: dz / L, w }; }); // 橋的可走寬度比橋面寬一點，不用對得很準
  let statics = [], dyn = [], obst = [];
  const setObstacles = (s, d) => { if (s) statics = s; if (d) dyn = d; obst = [...statics, ...dyn]; gridDirty = true; };
  function islandAt(x, z) { for (const I of isl) if (insideHex(x - I.c.x, z - I.c.z, HEX)) return I.id; return null; }
  function onBridge(x, z) { for (const s of segs) { let t = ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.L2; if (t < -0.25 || t > 1.25) continue; t = Math.max(0, Math.min(1, t)); const px = s.ax + s.dx * t - x, pz = s.az + s.dz * t - z; if (px * px + pz * pz < s.w * s.w) return true; } return false; }
  const walkable = (x, z) => islandAt(x, z) !== null || onBridge(x, z);
  // 撞到建築：往外推到圓外（推出去的位置也要能走）
  function push(p, r) { for (let k = 0; k < 2; k++) for (const o of obst) { const dx = p.x - o[0], dz = p.z - o[1], rr = o[2] + r, d2 = dx * dx + dz * dz; if (d2 >= rr * rr || d2 < 1e-10) continue; const d = Math.sqrt(d2), f = (rr - d) / d, nx = p.x + dx * f, nz = p.z + dz * f; if (walkable(nx, nz)) { p.x = nx; p.z = nz; } } }
  // 移動：整段能走就走；不能走就試著偏一點角度（沿著島邊或橋邊滑），速度乘 cos
  const TRY = [0, 0.45, -0.45, 0.9, -0.9, 1.3, -1.3];
  // 靠近橋頭、而且大致朝著橋走：把方向往橋的中線帶，不用對得很準就能上橋
  function bridgeAssist(p, dx, dz) { const m = Math.hypot(dx, dz); if (m < 1e-6) return null;
    for (const s of segs) { const t = ((p.x - s.ax) * s.dx + (p.z - s.az) * s.dz) / s.L2; if (t < -0.7 / s.L || t > 1 + 0.7 / s.L) continue; const cx = s.ax + s.dx * Math.max(0, Math.min(1, t)), cz = s.az + s.dz * Math.max(0, Math.min(1, t)), lx = p.x - cx, lz = p.z - cz, d = Math.hypot(lx, lz); if (d > 1.0) continue;
      const along = (dx * s.ux + dz * s.uz) / m; if (Math.abs(along) < 0.4) continue; const latA = (lx * -s.uz + lz * s.ux); if (Math.abs(latA) < 0.03) return null; const sg = Math.sign(along), pull = Math.min(Math.abs(latA), 0.6) * Math.sign(latA);
      let nx = sg * s.ux * 0.8 + s.uz * pull, nz = sg * s.uz * 0.8 - s.ux * pull; const L = Math.hypot(nx, nz) || 1; return [nx / L * m, nz / L * m]; } return null; }
  function move(p, dx, dz, r = 0.14) { if (!dx && !dz) { push(p, r); return true; }
    if (!walkable(p.x, p.z)) { p.x += dx; p.z += dz; return true; } // 站在不能走的地方（例如被推出去）：先讓他走回來
    if (!walkable(p.x + dx * 3, p.z + dz * 3)) { const a = bridgeAssist(p, dx, dz); if (a) { dx = a[0]; dz = a[1]; } } // 前面快沒路了才幫忙導向橋
    // 照順序試：正前方、偏 25°、偏 50°、偏 75°；被建築推回來、幾乎沒前進就換下一個方向，最後挑走得最遠的
    const ox = p.x, oz = p.z, m = Math.hypot(dx, dz); let bx = ox, bz = oz, bd = -1;
    for (const a of TRY) { const c = Math.cos(a), s = Math.sin(a), mx = (dx * c - dz * s) * c, mz = (dx * s + dz * c) * c; if (!walkable(ox + mx, oz + mz)) continue; p.x = ox + mx; p.z = oz + mz; push(p, r); const d = Math.hypot(p.x - ox, p.z - oz); if (d > bd) { bd = d; bx = p.x; bz = p.z; } if (d >= m * 0.55) break; }
    p.x = bx; p.z = bz; if (bd < 0) push(p, r); return bd > 0; }
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
  // ── 格子導航圖（每格 0.12）：能走、而且離建築夠遠（膨脹 0.15）的格子才算空。A* 找路後拉直，用在點地板走路、NPC、卡住的敵人 ──
  const CELL = 0.12, INFL = 0.15; let gridDirty = true, gx0 = 0, gz0 = 0, GW = 0, GH = 0, free = null;
  function buildGrid() { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const I of isl) { x0 = Math.min(x0, I.c.x - R - 0.5); x1 = Math.max(x1, I.c.x + R + 0.5); z0 = Math.min(z0, I.c.z - R - 0.5); z1 = Math.max(z1, I.c.z + R + 0.5); }
    gx0 = x0; gz0 = z0; GW = Math.ceil((x1 - x0) / CELL) + 1; GH = Math.ceil((z1 - z0) / CELL) + 1; free = new Uint8Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) free[j * GW + i] = walkable(gx0 + i * CELL, gz0 + j * CELL) ? 1 : 0;
    for (const o of obst) { const rr = o[2] + INFL, i0 = Math.max(0, Math.floor((o[0] - rr - gx0) / CELL)), i1 = Math.min(GW - 1, Math.ceil((o[0] + rr - gx0) / CELL)), j0 = Math.max(0, Math.floor((o[1] - rr - gz0) / CELL)), j1 = Math.min(GH - 1, Math.ceil((o[1] + rr - gz0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if ((gx0 + i * CELL - o[0]) ** 2 + (gz0 + j * CELL - o[1]) ** 2 < rr * rr) free[j * GW + i] = 0; }
    gridDirty = false; }
  const cellOf = (x, z) => [Math.round((x - gx0) / CELL), Math.round((z - gz0) / CELL)];
  const isFree = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH && free[j * GW + i] === 1;
  function nearFree(i, j) { if (isFree(i, j)) return [i, j]; for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; if (isFree(i + di, j + dj)) return [i + di, j + dj]; } return null; }
  function gridLos(ax, az, bx, bz) { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / (CELL * 0.5)); for (let k = 1; k < n; k++) { const t = k / n; const [i, j] = cellOf(ax + (bx - ax) * t, az + (bz - az) * t); if (!isFree(i, j)) return false; } return true; }
  // 回傳從 (fx,fz) 到 (tx,tz) 的路線點（不含起點），找不到就回傳 null
  function gridPath(fx, fz, tx, tz, maxNodes = 20000) { if (gridDirty) buildGrid(); const s = nearFree(...cellOf(fx, fz)), g = nearFree(...cellOf(tx, tz)); if (!s || !g) return null;
    const S = s[1] * GW + s[0], T = g[1] * GW + g[0]; if (S === T) return [[tx, tz]];
    const gs = new Map([[S, 0]]), came = new Map(), open = [[0, S]], closed = new Set(); const hcost = c => { const i = c % GW, j = (c / GW) | 0, dx = Math.abs(i - g[0]), dz = Math.abs(j - g[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const pushH = (f, c) => { open.push([f, c]); let k = open.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (open[p][0] <= open[k][0]) break; [open[p], open[k]] = [open[k], open[p]]; k = p; } };
    const popH = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === k) break; [open[m], open[k]] = [open[k], open[m]]; k = m; } } return top; };
    let found = false, n = 0;
    while (open.length && n++ < maxNodes) { const [, c] = popH(); if (c === T) { found = true; break; } if (closed.has(c)) continue; closed.add(c); const i = c % GW, j = (c / GW) | 0, gc = gs.get(c);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (!isFree(ni, nj)) continue; if (di && dj && (!isFree(i + di, j) || !isFree(i, j + dj))) continue; const nc = nj * GW + ni, ng = gc + (di && dj ? 1.414 : 1); if (ng < (gs.get(nc) ?? Infinity)) { gs.set(nc, ng); came.set(nc, c); pushH(ng + hcost(nc), nc); } } }
    if (!found) return null; const cells = []; for (let c = T; c !== S && c != null; c = came.get(c)) cells.push(c); cells.reverse();
    const pts = cells.map(c => [gx0 + (c % GW) * CELL, gz0 + ((c / GW) | 0) * CELL]); pts[pts.length - 1] = [tx, tz];
    // 拉直：從目前位置往後找看得到的最遠點
    const out = []; let cx = fx, cz = fz, k = 0; while (k < pts.length) { let far = k; for (let m = pts.length - 1; m > k; m--) if (gridLos(cx, cz, pts[m][0], pts[m][1])) { far = m; break; } out.push(pts[far]); [cx, cz] = pts[far]; k = far + 1; }
    return out; }
  return { walkable, islandAt, move, push, los, waypoint, pathLen, nearestWalkable, setObstacles, nodeFor, gridPath, gridLos: (a, b, c, d) => { if (gridDirty) buildGrid(); return gridLos(a, b, c, d); }, get obstacles() { return obst; } };
}
