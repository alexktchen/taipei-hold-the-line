/* 走路規則（草原小鎮）：能走的地方 = 區塊內部（離圍欄、河岸留一點距離）＋開著的門（門口一條窄走廊，過河的是木橋）。
   鎖住的學期、還沒蓋好的新校區：門關著，走不過去。闖關時（setArena）只能在那個區塊裡走，四道門都關上。
   建築是圓形障礙物（撞到會沿邊滑開）。跨區塊找路：步道路網（每區塊 16 個環節點＋門）先算好兩兩之間的「下一跳」；點地板走路用格子 A*。 */
import { H, SPACING, GATE_HW, BRIDGE_HW, MARGIN, RIVER_M, NEIGHBORS, cellKey, riverBetween } from './islands.js';
export function createNav({ islands, centers, gates = [], graph, cells: worldCells }) {
  const nodes = graph.nodes, N = nodes.length;
  // 每個能走的區塊：四個邊各自的門與留邊距離（河岸留得比較多）
  let gridDirty = true; const zones = new Map(); // cellKey → { id, c, grid, sides: [{ gate, m }] × 4（北東南西）}
  const gateByKey = new Map(gates.map(g => [g.key, g]));
  function sidesOf(id, grid) { return NEIGHBORS.map(([dq, dr]) => { const og = [grid[0] + dq, grid[1] + dr]; const O = worldCells && worldCells.get(cellKey(...og)); const g = O ? gateByKey.get([id, O.id].sort().join('|')) : null; return { gate: g || null, m: riverBetween(grid[0], grid[1], og[0], og[1]) ? RIVER_M : MARGIN }; }); }
  function addZone(id, c, grid) { zones.set(cellKey(...grid), { id, c, grid, sides: sidesOf(id, grid) }); gridDirty = true; }
  for (const i of islands) addZone(i.id, centers.get(i.id), i.grid);
  const closed = new Set(); let arena = null;
  const gateOpen = g => !!g && !closed.has(g.key) && !(arena && (g.a === arena || g.b === arena));
  function setBridgeOpen(a, b, open) { const k = [a, b].sort().join('|'); const was = closed.has(k); if (open) closed.delete(k); else closed.add(k); if (was !== closed.has(k)) gridDirty = true; }
  function setArena(id) { if (arena === (id || null)) return; arena = id || null; gridDirty = true; }
  const zoneAt = (x, z) => zones.get(cellKey(Math.round(x / SPACING), Math.round(z / SPACING))) || null;
  function islandAt(x, z) { const Z = zoneAt(x, z); return Z ? Z.id : null; }
  function walkable(x, z) { const Z = zoneAt(x, z); if (!Z) return false; if (arena && Z.id !== arena) return false;
    const lx = x - Z.c.x, lz = z - Z.c.z, ax = Math.abs(lx), az = Math.abs(lz); const sx = Z.sides[lx > 0 ? 1 : 3], sz = Z.sides[lz > 0 ? 2 : 0];
    const inX = ax < H - sx.m, inZ = az < H - sz.m; if (inX && inZ) return true; if (!inX && !inZ) return false;
    const s = inX ? sz : sx, along = inX ? lx : lz; if (!gateOpen(s.gate)) return false; return Math.abs(along) < (s.gate.river ? BRIDGE_HW : GATE_HW); }
  // 走向開著的門：前面快沒路、門就在附近、而且大致朝著門走 → 把方向往門口帶，不用對得很準就能穿過去
  function gateAssist(p, dx, dz) { const m = Math.hypot(dx, dz); if (m < 1e-6) return null; let best = null, bd = 1.6;
    for (const g of gates) { if (!gateOpen(g)) continue; const vx = g.x - p.x, vz = g.z - p.z, d = Math.hypot(vx, vz); if (d > bd || d < 0.05) continue; if ((dx * vx + dz * vz) / (m * d) < 0.3) continue; bd = d; best = [vx / d, vz / d]; }
    if (!best) return null; const nx = dx / m * 0.3 + best[0] * 0.7, nz = dz / m * 0.3 + best[1] * 0.7, L = Math.hypot(nx, nz) || 1; return [nx / L * m, nz / L * m]; }
  // 離 (x, z) 最近的關著的門（d 格內）：{ a, b, far＝門的另一邊 }
  function closedBridgeNear(x, z, d = 1.3) { const here = islandAt(x, z); let best = null, bd = d; for (const g of gates) { if (gateOpen(g)) continue; const q = Math.hypot(g.x - x, g.z - z); if (q < bd) { bd = q; best = { a: g.a, b: g.b, far: g.a === here ? g.b : g.a, x: g.x, z: g.z, arena: !!arena }; } } return best; }
  let statics = [], dyn = [], obst = [];
  const setObstacles = (s, d) => { if (s) statics = s; if (d) dyn = d; obst = [...statics, ...dyn]; gridDirty = true; };
  // 新校區蓋好了：加進能走的區塊（門的開關由 main.js 的 refreshGates 決定）
  function addIsland(id, c, grid, obstacles = []) { addZone(id, c, grid); for (const Z of zones.values()) Z.sides = sidesOf(Z.id, Z.grid); statics = [...statics, ...obstacles]; obst = [...statics, ...dyn]; gridDirty = true; }
  // 撞到建築：往外推到圓外（推出去的位置也要能走）
  function push(p, r) { for (let k = 0; k < 2; k++) for (const o of obst) { const dx = p.x - o[0], dz = p.z - o[1], rr = o[2] + r, d2 = dx * dx + dz * dz; if (d2 >= rr * rr || d2 < 1e-10) continue; const d = Math.sqrt(d2), f = (rr - d) / d, nx = p.x + dx * f, nz = p.z + dz * f; if (walkable(nx, nz)) { p.x = nx; p.z = nz; } } }
  const TRY = [0, 0.45, -0.45, 0.9, -0.9, 1.3, -1.3];
  function move(p, dx, dz, r = 0.14) { if (!dx && !dz) { push(p, r); return true; }
    if (!walkable(p.x, p.z)) { const Z = zoneAt(p.x, p.z); if (Z && (!arena || Z.id === arena)) { const tx = Z.c.x - p.x, tz = Z.c.z - p.z, L = Math.hypot(tx, tz) || 1, m = Math.hypot(dx, dz); p.x += tx / L * m; p.z += tz / L * m; } else { p.x += dx; p.z += dz; } return true; } // 站在不能走的地方（例如門剛關上）：往區塊中間走回去
    if (!walkable(p.x + dx * 3, p.z + dz * 3)) { const a = gateAssist(p, dx, dz); if (a) { dx = a[0]; dz = a[1]; } }
    const ox = p.x, oz = p.z, m = Math.hypot(dx, dz); let bx = ox, bz = oz, bd = -1;
    for (const a of TRY) { const c = Math.cos(a), s = Math.sin(a), mx = (dx * c - dz * s) * c, mz = (dx * s + dz * c) * c; if (!walkable(ox + mx, oz + mz)) continue; p.x = ox + mx; p.z = oz + mz; push(p, r); const d = Math.hypot(p.x - ox, p.z - oz); if (d > bd) { bd = d; bx = p.x; bz = p.z; } if (d >= m * 0.55) break; }
    p.x = bx; p.z = bz; if (bd < 0) push(p, r); return bd > 0; }
  function los(ax, az, bx, bz) { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.2); for (let i = 1; i <= n; i++) { const t = i / n; if (!walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false; } return true; }
  // 下一跳表（Floyd–Warshall，載入時算一次；門關著的那幾條邊走不過去時，waypoint 會停在門口，改用格子 A*）
  const dist = new Float32Array(N * N).fill(Infinity), next = new Int16Array(N * N).fill(-1);
  for (let i = 0; i < N; i++) { dist[i * N + i] = 0; next[i * N + i] = i; for (const [j, w] of graph.adj[i]) { dist[i * N + j] = w; next[i * N + j] = j; } }
  for (let k = 0; k < N; k++) for (let i = 0; i < N; i++) { const ik = dist[i * N + k]; if (ik === Infinity) continue; for (let j = 0; j < N; j++) { const v = ik + dist[k * N + j]; if (v < dist[i * N + j]) { dist[i * N + j] = v; next[i * N + j] = next[i * N + k]; } } }
  function nodeFor(x, z) { const id = islandAt(x, z); let best = -1, bd = Infinity; for (let i = 0; i < N; i++) { if (id && nodes[i].island !== id) continue; const p = nodes[i].p, d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } return best; }
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
  // 離 (x, z) 最近、可以走、不在建築裡的點
  function nearestWalkable(x, z, r = 0.14) { const ok = (px, pz) => walkable(px, pz) && !obst.some(o => (px - o[0]) ** 2 + (pz - o[1]) ** 2 < (o[2] + r) ** 2);
    if (ok(x, z)) return [x, z];
    for (let rad = 0.15; rad < 8; rad += 0.15) for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2, px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad; if (ok(px, pz)) return [px, pz]; }
    const n = nodeFor(x, z); if (n < 0) return [x, z]; const p = nodes[n].p; return [p.x, p.z]; }
  // ── 格子導航圖（每格 0.12）：能走、而且離建築夠遠（膨脹 0.15）的格子才算空。A* 找路後拉直 ──
  const CELL = 0.12, INFL = 0.15; let gx0 = 0, gz0 = 0, GW = 0, GH = 0, free = null;
  function buildGrid() { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const Z of zones.values()) { x0 = Math.min(x0, Z.c.x - H - 0.3); x1 = Math.max(x1, Z.c.x + H + 0.3); z0 = Math.min(z0, Z.c.z - H - 0.3); z1 = Math.max(z1, Z.c.z + H + 0.3); }
    gx0 = x0; gz0 = z0; GW = Math.ceil((x1 - x0) / CELL) + 1; GH = Math.ceil((z1 - z0) / CELL) + 1; free = new Uint8Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) free[j * GW + i] = walkable(gx0 + i * CELL, gz0 + j * CELL) ? 1 : 0;
    for (const o of obst) { const rr = o[2] + INFL, i0 = Math.max(0, Math.floor((o[0] - rr - gx0) / CELL)), i1 = Math.min(GW - 1, Math.ceil((o[0] + rr - gx0) / CELL)), j0 = Math.max(0, Math.floor((o[1] - rr - gz0) / CELL)), j1 = Math.min(GH - 1, Math.ceil((o[1] + rr - gz0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if ((gx0 + i * CELL - o[0]) ** 2 + (gz0 + j * CELL - o[1]) ** 2 < rr * rr) free[j * GW + i] = 0; }
    gridDirty = false; }
  const cellOf = (x, z) => [Math.round((x - gx0) / CELL), Math.round((z - gz0) / CELL)];
  const isFree = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH && free[j * GW + i] === 1;
  function nearFree(i, j) { if (isFree(i, j)) return [i, j]; for (let r = 1; r < 14; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; if (isFree(i + di, j + dj)) return [i + di, j + dj]; } return null; }
  function gridLos(ax, az, bx, bz) { const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / (CELL * 0.5)); for (let k = 1; k < n; k++) { const t = k / n; const [i, j] = cellOf(ax + (bx - ax) * t, az + (bz - az) * t); if (!isFree(i, j)) return false; } return true; }
  function gridPath(fx, fz, tx, tz, maxNodes = 20000) { if (gridDirty) buildGrid(); const s = nearFree(...cellOf(fx, fz)), g = nearFree(...cellOf(tx, tz)); if (!s || !g) return null;
    const S = s[1] * GW + s[0], T = g[1] * GW + g[0]; if (S === T) return [[tx, tz]];
    const gs = new Map([[S, 0]]), came = new Map(), open = [[0, S]], closedSet = new Set(); const hcost = c => { const i = c % GW, j = (c / GW) | 0, dx = Math.abs(i - g[0]), dz = Math.abs(j - g[1]); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const pushH = (f, c) => { open.push([f, c]); let k = open.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (open[p][0] <= open[k][0]) break; [open[p], open[k]] = [open[k], open[p]]; k = p; } };
    const popH = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === k) break; [open[m], open[k]] = [open[k], open[m]]; k = m; } } return top; };
    let found = false, n = 0;
    while (open.length && n++ < maxNodes) { const [, c] = popH(); if (c === T) { found = true; break; } if (closedSet.has(c)) continue; closedSet.add(c); const i = c % GW, j = (c / GW) | 0, gc = gs.get(c);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (!isFree(ni, nj)) continue; if (di && dj && (!isFree(i + di, j) || !isFree(i, j + dj))) continue; const nc = nj * GW + ni, ng = gc + (di && dj ? 1.414 : 1); if (ng < (gs.get(nc) ?? Infinity)) { gs.set(nc, ng); came.set(nc, c); pushH(ng + hcost(nc), nc); } } }
    if (!found) return null; const cl = []; for (let c = T; c !== S && c != null; c = came.get(c)) cl.push(c); cl.reverse();
    const pts = cl.map(c => [gx0 + (c % GW) * CELL, gz0 + ((c / GW) | 0) * CELL]); pts[pts.length - 1] = [tx, tz];
    const out = []; let cx = fx, cz = fz, k = 0; while (k < pts.length) { let far = k; for (let m = pts.length - 1; m > k; m--) if (gridLos(cx, cz, pts[m][0], pts[m][1])) { far = m; break; } out.push(pts[far]); [cx, cz] = pts[far]; k = far + 1; }
    return out; }
  return { walkable, islandAt, addIsland, move, push, los, waypoint, pathLen, nearestWalkable, setObstacles, nodeFor, gridPath, setBridgeOpen, setArena, closedBridgeNear, get arena() { return arena; },
    gridLos: (a, b, c, d) => { if (gridDirty) buildGrid(); return gridLos(a, b, c, d); }, get obstacles() { return obst; } };
}
