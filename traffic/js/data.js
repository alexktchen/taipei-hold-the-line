/* 讀 traffic/data/ 的資料，整理成執行時的道路圖。
   座標：公尺，x 向東、z 向南（地圖北方朝 -z）。檔案裡存公寸整數。
   道路圖：nodes（節點座標）、edges（一段路，含折線）、links（有方向的一段路，車道、速限、長度；車子在 link 上跑）。
   等級 cls：0 快速道路、1 快速公路、2 主要幹道、3 次要幹道、4 三級路、5 巷弄、6 巷道（service=alley）。 */
export const LANE_W = 3.2; // 每條車道寬（公尺）
export const CLS_NAME = ['快速道路', '快速公路', '主要幹道', '次要幹道', '一般道路', '巷弄', '巷道'];
const D = 0.1;

export async function fetchJSON(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); }

export function createNet() { return { nx: [], nz: [], ny: [], edges: [], links: [], out: [], inn: [], names: [], deg: [] }; }

// 把一個道路檔（主要或巷弄）接進道路圖；回傳新加的 edge 範圍
export function addNet(net, raw) {
  const base = raw.nodeBase, nodes = raw.nodes;
  for (let i = 0; i < nodes.length; i += 2) { const k = base + i / 2; net.nx[k] = nodes[i] * D; net.nz[k] = nodes[i + 1] * D; net.ny[k] = 0; net.out[k] = net.out[k] || []; net.inn[k] = net.inn[k] || []; net.deg[k] = net.deg[k] || 0; }
  if (raw.names) net.names = raw.names;
  const e0 = net.edges.length;
  for (const [a, b, cls, f, r, sp, name, lv, mid] of raw.edges) {
    const pts = [net.nx[a], net.nz[a]]; for (let i = 0; i < mid.length; i += 2) pts.push(net.nx[a] + mid[i] * D, net.nz[a] + mid[i + 1] * D); pts.push(net.nx[b], net.nz[b]);
    const P = Float32Array.from(pts), cum = new Float32Array(P.length / 2); for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(P[i * 2] - P[i * 2 - 2], P[i * 2 + 1] - P[i * 2 - 1]);
    const e = { id: net.edges.length, a, b, cls, f, r, sp, name, lv, pts: P, cum, len: Math.max(1, cum[cum.length - 1]), links: [-1, -1] };
    net.edges.push(e); net.deg[a]++; net.deg[b]++;
    if (f > 0) e.links[0] = addLink(net, e, 1, f); if (r > 0) e.links[1] = addLink(net, e, -1, r); }
  return [e0, net.edges.length]; }
function addLink(net, e, dir, lanes) {
  const from = dir > 0 ? e.a : e.b, to = dir > 0 ? e.b : e.a;
  let pts = e.pts; if (dir < 0) { const n = pts.length / 2, q = new Float32Array(pts.length); for (let i = 0; i < n; i++) { q[i * 2] = pts[(n - 1 - i) * 2]; q[i * 2 + 1] = pts[(n - 1 - i) * 2 + 1]; } pts = q; }
  const cum = new Float32Array(pts.length / 2); for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
  const twoWay = e.f > 0 && e.r > 0;
  const L = { id: net.links.length, e: e.id, dir, from, to, lanes, cls: e.cls, lv: e.lv, vf: e.sp / 3.6, len: Math.max(1, cum[cum.length - 1]), pts, cum,
    off0: twoWay ? 0.5 * LANE_W : (0.5 - lanes / 2) * LANE_W, // 第 0 條車道中心離道路中線多遠（往行進方向右邊為正）
    q: Array.from({ length: lanes }, () => []), ctrl: -1, axis: 0, stop: 0, yieldTo: 0, sumV: 0, nV: 0, ema: 1, seen: 0, colorDirty: true };
  net.links.push(L); net.out[from].push(L.id); net.inn[to].push(L.id); return L.id; }

// 節點高度：所有相接的路都是高架才抬高（匝道的另一端在地面，中間依距離內插）
export const LEVEL_H = 7;
export function nodeHeights(net) { for (let k = 0; k < net.nx.length; k++) net.ny[k] = 0; const hi = new Map();
  for (const e of net.edges) for (const n of [e.a, e.b]) { const h = e.lv > 0 ? e.lv * LEVEL_H : 0; const c = hi.get(n); hi.set(n, c == null ? h : Math.min(c, h)); }
  for (const [n, h] of hi) net.ny[n] = h; }
// 折線上某點的高度：兩端照節點高度，中間是這條路的高度，靠近端點 40 公尺內慢慢接上
export function heightAt(net, e, d) { const h = e.lv > 0 ? e.lv * LEVEL_H : 0; const ha = net.ny[e.a], hb = net.ny[e.b]; if (ha === h && hb === h) return h; const ramp = Math.min(40, e.len / 2);
  if (d < ramp) return ha + (h - ha) * (d / ramp); if (d > e.len - ramp) return hb + (h - hb) * ((e.len - d) / ramp); return h; }

// 折線上距離 s 的位置與方向（seg 是上一次找到的段，往後找比較快）
export function pointAt(pts, cum, s, out, segHint = 0) {
  const n = cum.length; let i = Math.min(Math.max(segHint, 0), n - 2); if (cum[i] > s) i = 0; while (i < n - 2 && cum[i + 1] < s) i++;
  const L = cum[i + 1] - cum[i] || 1, t = Math.min(1, Math.max(0, (s - cum[i]) / L)); const x0 = pts[i * 2], z0 = pts[i * 2 + 1], x1 = pts[i * 2 + 2], z1 = pts[i * 2 + 3];
  out.x = x0 + (x1 - x0) * t; out.z = z0 + (z1 - z0) * t; out.dx = (x1 - x0) / L; out.dz = (z1 - z0) / L; out.seg = i; return out; }

// 空間格子：用來點選、放建築
export function edgeGrid(net, cell = 150) { const g = new Map(); const key = (cx, cz) => cx * 100003 + cz;
  const add = (e) => { const P = e.pts; for (let i = 0; i + 3 < P.length; i += 2) { const x0 = Math.min(P[i], P[i + 2]), x1 = Math.max(P[i], P[i + 2]), z0 = Math.min(P[i + 1], P[i + 3]), z1 = Math.max(P[i + 1], P[i + 3]);
      for (let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++) for (let cz = Math.floor(z0 / cell); cz <= Math.floor(z1 / cell); cz++) { const k = key(cx, cz); let a = g.get(k); if (!a) g.set(k, a = []); if (a[a.length - 1] !== e.id) a.push(e.id); } } };
  return { cell, add, near(x, z, r) { const out = new Set(); for (let cx = Math.floor((x - r) / cell); cx <= Math.floor((x + r) / cell); cx++) for (let cz = Math.floor((z - r) / cell); cz <= Math.floor((z + r) / cell); cz++) for (const id of g.get(key(cx, cz)) || []) out.add(id); return out; } }; }
// 點到折線的距離
export function distToEdge(e, x, z) { const P = e.pts; let best = 1e9, bs = 0; for (let i = 0; i + 3 < P.length; i += 2) { const ax = P[i], az = P[i + 1], bx = P[i + 2], bz = P[i + 3], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; let t = ((x - ax) * dx + (z - az) * dz) / L2; t = Math.max(0, Math.min(1, t)); const d = Math.hypot(ax + dx * t - x, az + dz * t - z); if (d < best) { best = d; bs = e.cum[i / 2] + t * Math.sqrt(L2); } } return [best, bs]; }
export const halfWidth = e => (e.f > 0 && e.r > 0 ? Math.max(e.f, e.r) : (e.f + e.r) / 2) * LANE_W;

// 路口的退縮：路口越寬，停止線離路口中心越遠。deg≥3 的節點才是路口（deg 2 只是一條路的折點，不退縮）。
// L.stop＝終點那頭停止線離節點多遠，L.s0＝起點那頭車道從離節點多遠開始（中間是路口，車子走曲線過去）。
export function setbacks(net) { const half = new Map();
  for (const e of net.edges) { const hw = halfWidth(e); for (const n of [e.a, e.b]) { const a = half.get(n) || []; a.push([e.id, hw]); half.set(n, a); } }
  const cross = (n, eid) => { let m = 0; for (const [id, hw] of half.get(n) || []) if (id !== eid) m = Math.max(m, hw); return m; };
  for (const L of net.links) { const dTo = net.deg[L.to], dFrom = net.deg[L.from], room = L.len * 0.35;
    L.stop = dTo >= 3 ? Math.min(room, cross(L.to, L.e) + 2.2) : 0; L.s0 = dFrom >= 3 ? Math.min(room, cross(L.from, L.e) + 0.8) : 0; } }
// 某條車道上距離 s 的位置（含高度與行進方向）
const _p = { x: 0, z: 0, dx: 1, dz: 0, seg: 0 };
export function lanePoint(net, L, lane, s, out) { pointAt(L.pts, L.cum, Math.max(0, Math.min(L.len, s)), _p, out.seg || 0); const lat = L.off0 + lane * LANE_W, e = net.edges[L.e];
  out.x = _p.x - _p.dz * lat; out.z = _p.z + _p.dx * lat; out.dx = _p.dx; out.dz = _p.dz; out.seg = _p.seg; out.y = heightAt(net, e, L.dir > 0 ? s : L.len - s); return out; }
// 過路口的曲線：從 L 的停止線（那條車道）到 M 的起點（那條車道），三次貝茲曲線；回傳取樣表（距離→位置）
export function connector(net, L, laneL, M, laneM) { const a = lanePoint(net, L, laneL, L.len - L.stop, { seg: 0 }), b = lanePoint(net, M, laneM, M.s0, { seg: 0 }); const d = Math.hypot(b.x - a.x, b.z - a.z), k = d * 0.42;
  const P = [a.x, a.z, a.x + a.dx * k, a.z + a.dz * k, b.x - b.dx * k, b.z - b.dz * k, b.x, b.z], N = 10, xs = new Float32Array(N + 1), zs = new Float32Array(N + 1), cum = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { const t = i / N, u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t; xs[i] = w0 * P[0] + w1 * P[2] + w2 * P[4] + w3 * P[6]; zs[i] = w0 * P[1] + w1 * P[3] + w2 * P[5] + w3 * P[7]; if (i) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]); }
  return { xs, zs, cum, len: Math.max(0.5, cum[N]), y0: a.y, y1: b.y }; }
export function connPoint(c, d, out) { const N = c.cum.length - 1; let i = 0; while (i < N - 1 && c.cum[i + 1] < d) i++; const L = c.cum[i + 1] - c.cum[i] || 1, t = Math.max(0, Math.min(1, (d - c.cum[i]) / L));
  out.x = c.xs[i] + (c.xs[i + 1] - c.xs[i]) * t; out.z = c.zs[i] + (c.zs[i + 1] - c.zs[i]) * t; out.dx = (c.xs[i + 1] - c.xs[i]) / L; out.dz = (c.zs[i + 1] - c.zs[i]) / L; out.y = c.y0 + (c.y1 - c.y0) * (d / c.len); return out; }
