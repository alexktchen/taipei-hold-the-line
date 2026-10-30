/* 草原小鎮（動森＋牧場物語風）：一整片連續的草地，13 個學期是排在格子上的大區塊（場景），彼此緊鄰。
   區塊之間：木圍欄，上下左右的中間各有一道門（像牧場物語走到畫面邊緣換場景）；有些邊界是一條小河，門的位置是木橋。
   小鎮外圍：野地與樹林，再遠是盆地的山。可走範圍由 nav.js 依區塊與門判斷；這裡只負責畫面、路網與門的位置。
   檔名沿用 islands.js（其他模組照舊 import），「島」在程式裡就是「區塊」。 */
import * as THREE from 'three';
import { mulberry } from './env.js';
import { CONFIG } from './config.js';
const W = CONFIG.world;
export const H = W.zone || 4.2;                       // 區塊半寬
export const SPACING = 2 * H, TOP = 0.65;
export const RING_H = H - 1.0, RING_R = RING_H;       // 區塊內的泥土步道環（方形）
export const INNER = RING_H - 0.4;                    // 建築可以放的範圍（半寬）
export const R = H * 1.25;                            // 其他模組拿來當「區塊半徑」的安全距離
export const ISLAND_K = 1, SIZE_K = W.sizeK || 1.5, MAP_K = W.mapK || 1.4;
export const GATE_HW = 0.45, BRIDGE_HW = 0.66, MARGIN = 0.3, RIVER_HW = 0.5, RIVER_M = 0.8;
export const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // 北 東 南 西
const SIDE = ['N', 'E', 'S', 'W'];
export const cellKey = (c, r) => c + ',' + r;
export function axialToWorld(col, row) { return new THREE.Vector3(col * SPACING, TOP, row * SPACING); } // 格子座標 → 世界座標
export function dirOf(dq, dr) { const l = Math.hypot(dq, dr) || 1; return [dq / l, dr / l]; }
export function insideLand(x, z, h, rc = 1.0) { const ax = Math.abs(x), az = Math.abs(z); if (ax > h || az > h) return false; const k = h - rc; if (ax > k && az > k) return (ax - k) ** 2 + (az - k) ** 2 <= rc * rc; return true; }
export const insideHex = (x, z, h) => insideLand(x, z, h, 1.0); // 舊名稱
export function sqR(a, h, rc) { const cx = Math.cos(a), cz = Math.sin(a); let lo = 0, hi = h * 1.5; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (insideLand(cx * m, cz * m, h, rc)) lo = m; else hi = m; } return lo; }
export function sides(h) { return [ { a: [-h, -h], b: [h, -h], n: [0, -1] }, { a: [h, -h], b: [h, h], n: [1, 0] }, { a: [h, h], b: [-h, h], n: [0, 1] }, { a: [-h, h], b: [-h, -h], n: [-1, 0] } ]; }
// 河：axis 'z' = 東西向的河，位在第 at 列與下一列之間（z = at × SPACING），從第 from 欄流到第 to 欄；axis 'x' = 南北向
const RIVERS = W.rivers || [];
export function riverBetween(c1, r1, c2, r2) { for (const rv of RIVERS) { if (rv.axis === 'z' && c1 === c2 && Math.abs((r1 + r2) / 2 - rv.at) < 0.01 && c1 > rv.from && c1 < rv.to) return true; if (rv.axis === 'x' && r1 === r2 && Math.abs((c1 + c2) / 2 - rv.at) < 0.01 && r1 > rv.from && r1 < rv.to) return true; } return false; }
// ── 貼圖 ──
const TONE = { granite: 0x86c25a, lawn: 0x8fc760, gravel: 0xd8b47e, street: 0x7fbb52, meadow: 0x98cc64, terracotta: 0xa6c95a, garden: 0x86c25a, forest: 0x6faa4c, rubber: 0x8fc760, boardwalk: 0xdcb582, ringtile: 0xe0bf8c, schoolyard: 0x7fbb52, softpad: 0x98cc64, courtyard: 0xd6ad78, wild: 0x6ea84a, field: 0x8cc35e };
function groundTexture(type) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const rnd = mulberry(type.length * 97 + 3);
  g.fillStyle = '#' + (TONE[type] || TONE.lawn).toString(16).padStart(6, '0'); g.fillRect(0, 0, 256, 256);
  const speck = (n, cols, rmin, rmax, a = 1) => { for (let i = 0; i < n; i++) { g.globalAlpha = a * (0.4 + rnd() * 0.6); g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, rmin + rnd() * (rmax - rmin), 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; };
  const tuft = (n, cols) => { for (let i = 0; i < n; i++) { const x = rnd() * 256, y = rnd() * 256; g.strokeStyle = cols[Math.floor(rnd() * cols.length)]; g.lineWidth = 1.4; g.globalAlpha = 0.55; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + k * 2.2, y - 4 - rnd() * 3); g.stroke(); } } g.globalAlpha = 1; };
  const dirt = ['gravel', 'boardwalk', 'courtyard', 'ringtile'].includes(type);
  if (dirt) { speck(2200, ['#c9995f', '#e0bd88', '#bb8b58', '#e8c995'], 0.5, 1.8, 0.7); speck(60, ['#a98a6a', '#8f7355'], 1.4, 3.0, 0.6); if (type === 'ringtile') speck(40, ['#f1e4c3', '#d9c6a3'], 2.5, 4.5, 0.5); }
  else { const deep = type === 'wild' || type === 'forest' ? ['#5e9a3e', '#7cb355', '#558f37', '#6aa646'] : ['#7fbd52', '#9fd06c', '#74b048', '#8cc35c']; speck(3000, deep, 0.4, 1.4, 0.55); speck(200, ['#6ea545', '#62983c'], 1.0, 2.2, 0.35); tuft(type === 'wild' ? 160 : 90, ['#5f9a3c', '#86c25a', '#4f8a32']);
    if (['meadow', 'garden', 'softpad', 'lawn', 'granite', 'field', 'wild'].includes(type)) speck(type === 'wild' ? 60 : 90, ['#f3e7a6', '#ffffff', '#f2c4b2', '#d9c6f0', '#f6d36a'], 0.9, 1.7, 0.9); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const MATS = { tex: new Map() };
const texOf = type => { if (!MATS.tex.has(type)) MATS.tex.set(type, groundTexture(type)); return MATS.tex.get(type); };
const matOf = (type, extra = {}) => new THREE.MeshStandardMaterial({ map: texOf(type), roughness: 0.96, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2, ...extra });
function polyShape(pts) { const s = new THREE.Shape(); pts.forEach(([x, z], k) => k ? s.lineTo(x, -z) : s.moveTo(x, -z)); s.closePath(); return s; }
function sqPts(h, rc, n = 72) { const out = []; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, r = sqR(a, h, rc); out.push([Math.cos(a) * r, Math.sin(a) * r]); } return out; }
function ringGeo(outer, inner) { const s = polyShape(outer); const h = new THREE.Path(); inner.forEach(([x, z], k) => k ? h.lineTo(x, -z) : h.moveTo(x, -z)); h.closePath(); s.holes.push(h); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; }
// 世界座標貼圖：所有地面接起來看不出接縫
function worldUV(geo, ox, oz, k = 2.2) { const uv = geo.attributes.uv, p = geo.attributes.position; for (let n = 0; n < p.count; n++) uv.setXY(n, (p.getX(n) + ox) / k, (p.getZ(n) + oz) / k); return geo; }
const plane = (w, d) => { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); return g; };
// ── 木圍欄：柱子＋兩條橫桿；gap＝中間留門的寬度（0＝不留）──
const WOOD = 0x8a6a4a, RAIL = 0xb48560;
function fenceLine(kit, ax, az, bx, bz, gap = 0, style = 'wood') { const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az); const n = Math.max(2, Math.round(len / 0.42));
  const segsOf = gap ? [[0, 0.5 - gap / 2 / len], [0.5 + gap / 2 / len, 1]] : [[0, 1]];
  for (const [t0, t1] of segsOf) { if (t1 - t0 < 0.01) continue; const m = Math.max(1, Math.round((t1 - t0) * n));
    for (let k = 0; k <= m; k++) { const t = t0 + (t1 - t0) * k / m, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (style === 'hedge') kit.part('leaf', [x, TOP + 0.13, z], [0.34, 0.26, 0.34], k % 2 ? 0x8db86f : 0x7fa862); else kit.hbox(x, TOP + 0.13, z, 0.06, 0.26, 0.06, WOOD); }
    if (style === 'hedge') continue; const tm = (t0 + t1) / 2, L = len * (t1 - t0), mx = ax + (bx - ax) * tm, mz = az + (bz - az) * tm;
    kit.hbox(mx, TOP + 0.2, mz, 0.035, 0.04, L, RAIL, null, [0, yaw, 0]); kit.hbox(mx, TOP + 0.1, mz, 0.035, 0.04, L, RAIL, null, [0, yaw, 0]); }
  if (gap) for (const sg of [-1, 1]) { const t = 0.5 + sg * gap / 2 / len, x = ax + (bx - ax) * t, z = az + (bz - az) * t; kit.hbox(x, TOP + 0.21, z, 0.1, 0.42, 0.1, 0x7a5a3e); kit.part('hip', [x, TOP + 0.46, z], [0.15, 0.08, 0.15], 0x6a4e36); kit.bulb(x, TOP + 0.36, z, 0.06); } }
// ── 河：水面＋兩岸的土坡與石頭（水面用 main.js 換成 env 的會動的水材質）──
function buildRiver(scene, kit, rv, rnd) { const S = SPACING; const along0 = rv.from * S, along1 = rv.to * S; const len = along1 - along0, mid = (along0 + along1) / 2, at = rv.at * S;
  const geo = rv.axis === 'z' ? plane(len, RIVER_HW * 2) : plane(RIVER_HW * 2, len); const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8fc9d6, roughness: 0.3 }));
  if (rv.axis === 'z') mesh.position.set(mid, TOP + 0.012, at); else mesh.position.set(at, TOP + 0.012, mid); mesh.receiveShadow = true; scene.add(mesh);
  for (const sg of [-1, 1]) { const off = sg * (RIVER_HW + 0.05); const n = Math.round(len / 0.5);
    if (rv.axis === 'z') kit.hbox(mid, TOP + 0.03, at + off, len, 0.06, 0.14, 0xc9a77c); else kit.hbox(at + off, TOP + 0.03, mid, 0.14, 0.06, len, 0xc9a77c);
    for (let k = 0; k < n; k++) { if (rnd() < 0.45) continue; const t = along0 + (k + rnd()) * len / n, o = off + sg * (0.05 + rnd() * 0.08); const [x, z] = rv.axis === 'z' ? [t, at + o] : [at + o, t];
      if (rnd() < 0.6) kit.part('ico', [x, TOP + 0.05, z], [0.14 + rnd() * 0.12, 0.08, 0.12 + rnd() * 0.08], [0xc9bba6, 0xb7a993, 0xd8ccba][k % 3]); else kit.part('leaf', [x, TOP + 0.08, z], [0.2, 0.16, 0.2], 0x8db86f); } }
  return mesh; }
// 木橋（動森風）：寬寬的木板橋面、兩側粗木樑、方形木欄柱加圓帽、扶手，橋面微微拱起；兩端各一對大柱子（closed 時 main.js 在橋中間放關著的門）
export const BRIDGE_W = 1.5;
function buildBridge(kit, g) { const vertical = g.axis === 'z'; const L = RIVER_M * 2 + 0.5, W = BRIDGE_W, N = 14; // vertical＝南北向過河（河是東西向）
  const at = (t, side) => vertical ? [g.x + side, g.z + t * L] : [g.x + t * L, g.z + side], rise = t => Math.cos(t * Math.PI) * 0.09;
  for (let s = 0; s < N; s++) { const t = (s + 0.5) / N - 0.5, [x, z] = at(t, 0), tilt = -Math.sin(t * Math.PI) * 0.18, col = [0xc9a27c, 0xbf956c, 0xd1ab86][s % 3]; // 每片木板順著拱度斜一點
    if (vertical) kit.hbox(x, TOP + 0.05 + rise(t), z, W, 0.05, L / N - 0.015, col, null, [-tilt, 0, 0]); else kit.hbox(x, TOP + 0.05 + rise(t), z, L / N - 0.015, 0.05, W, col, null, [0, 0, tilt]); }
  for (const sd of [-1, 1]) { const off = sd * (W / 2 + 0.04);
    for (let s = 0; s < 6; s++) { const t0 = s / 6 - 0.5, t1 = (s + 1) / 6 - 0.5, tm = (t0 + t1) / 2, [x, z] = at(tm, off); kit.hbox(x, TOP + 0.04 + rise(tm), z, vertical ? 0.12 : L / 6 + 0.01, 0.12, vertical ? L / 6 + 0.01 : 0.12, 0x9a7454); kit.hbox(x, TOP + 0.33 + rise(tm), z, vertical ? 0.07 : L / 6 + 0.01, 0.06, vertical ? L / 6 + 0.01 : 0.07, 0xb48560); kit.hbox(x, TOP + 0.2 + rise(tm), z, vertical ? 0.04 : L / 6 + 0.01, 0.04, vertical ? L / 6 + 0.01 : 0.04, 0xb48560); }
    for (const t of [-0.5, -0.25, 0, 0.25, 0.5]) { const [x, z] = at(t, off), big = Math.abs(t) === 0.5; kit.hbox(x, TOP + 0.2 + rise(t) + (big ? 0.05 : 0), z, big ? 0.16 : 0.1, big ? 0.5 : 0.38, big ? 0.16 : 0.1, 0x8a6a4a); kit.cyl(x, TOP + 0.41 + rise(t) + (big ? 0.1 : 0), z, big ? 0.2 : 0.13, 0.05, 0x6a4e36); if (big) kit.part('sphere', [x, TOP + 0.47 + rise(t) + 0.1, z], [0.12, 0.08, 0.12], 0x6a4e36); } }
  for (const t of [-0.28, 0, 0.28]) for (const sd of [-1, 1]) { const [x, z] = at(t, sd * W * 0.36); kit.cyl(x, TOP - 0.12, z, 0.1, 0.24, 0x7a5a3e); } }
// ── 一個區塊的地面：區塊色塊、方形步道環、往每道門的小路、廣場 ──
function buildZone(scene, kit, i, c, gateSides, plazaZ) { const g0 = new THREE.ShapeGeometry(polyShape(sqPts(H - 0.04, 0.6))); g0.rotateX(-Math.PI / 2); worldUV(g0, c.x, c.z);
  const patch = new THREE.Mesh(g0, matOf(i.ground || 'lawn')); patch.position.set(c.x, TOP + 0.002, c.z); patch.receiveShadow = true; patch.userData = { island: i.id }; scene.add(patch);
  const pm = matOf('ringtile', { polygonOffsetFactor: -2, polygonOffsetUnits: -4 }); const add = (geo, x, z) => { worldUV(geo, x, z); const m = new THREE.Mesh(geo, pm); m.position.set(x, TOP + 0.006, z); m.receiveShadow = true; scene.add(m); return m; };
  add(ringGeo(sqPts(RING_H + 0.22, 0.7), sqPts(RING_H - 0.22, 0.5)), c.x, c.z);
  for (let k = 0; k < 4; k++) { const g = gateSides[k]; if (!g) continue; const [dx, dz] = NEIGHBORS[k], L = H - RING_H + 0.06, m = RING_H + L / 2 - 0.02, w = g.river ? 1.45 : 0.6; add(dx ? plane(L, w) : plane(w, L), c.x + dx * m, c.z + dz * m); }
  if (plazaZ != null) { const pg = new THREE.CircleGeometry(1.0, 28); pg.rotateX(-Math.PI / 2); add(pg, c.x, c.z + plazaZ); add(plane(0.6, RING_H - plazaZ - 0.9), c.x, c.z + (RING_H + plazaZ + 0.9) / 2); }
  // 步道環四角的木頭路燈
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const x = c.x + sx * (RING_H + 0.38), z = c.z + sz * (RING_H + 0.38); kit.cyl(x, TOP + 0.26, z, 0.035, 0.52, WOOD); kit.hbox(x, TOP + 0.55, z, 0.1, 0.11, 0.1, 0x6a4e36); kit.bulb(x, TOP + 0.55, z, 0.07); kit.part('hip', [x, TOP + 0.63, z], [0.15, 0.06, 0.15], 0x6a4e36); }
  return patch; }
// 野地（還沒開發的格子、小鎮外圍）：深一點的草、樹叢、野花、石頭
function wildDecor(kit, x0, z0, w, d, rnd, avoid, density = 1) { const n = Math.round(w * d * 0.22 * density); for (let k = 0; k < n; k++) { const x = x0 + rnd() * w, z = z0 + rnd() * d; if (avoid(x, z)) continue; const t = rnd();
    if (t < 0.55) kit.tree(x, z, 0.45 + rnd() * 0.4, k, rnd() < 0.55 ? 'conifer' : 'round'); else if (t < 0.7) kit.part('leaf', [x, TOP + 0.12, z], [0.32, 0.24, 0.32], [0x7fa862, 0x8db86f, 0x6f9a58][k % 3]);
    else if (t < 0.85) for (let j = 0; j < 3; j++) kit.part('sphere', [x + (j - 1) * 0.08, TOP + 0.05, z + (j % 2) * 0.06], [0.06, 0.06, 0.06], [0xf2a1a1, 0xfcea8b, 0xffffff, 0xd9c6f0][(k + j) % 4]);
    else kit.part('ico', [x, TOP + 0.05, z], [0.18, 0.1, 0.15], [0xc9bba6, 0xb7a993][k % 2]); } }
// ── 整個小鎮 ──
// islands：C.islands（每個有 grid:[欄,列]）；campus：蓋校園的新校區（{ id, grid, link }，蓋好前是野地，跟 link 之間有一道關著的門）
export function buildIslands(scene, islands, kit, colors, campus = [], makeKit = null) {
  const centers = new Map(), cells = new Map(), views = new Map(); const rnd = mulberry(91);
  for (const i of islands) { const w = axialToWorld(...i.grid); centers.set(i.id, w); cells.set(cellKey(...i.grid), { id: i.id, grid: i.grid, c: w, zone: true, isl: i }); }
  for (const p of campus) { const w = axialToWorld(...p.grid); cells.set(cellKey(...p.grid), { id: p.id, grid: p.grid, c: w, zone: false, campus: p }); }
  const isZone = k => { const z = cells.get(k); return z && z.zone; };
  // 門：相鄰兩個區塊之間（上下左右）＋新校區與它要接的區塊之間
  const gates = [], neighbors = new Map(), gateOf = new Map();
  const mkGate = (A, B, k) => { const [dq, dr] = NEIGHBORS[k]; const x = (A.c.x + B.c.x) / 2, z = (A.c.z + B.c.z) / 2; const river = riverBetween(A.grid[0], A.grid[1], B.grid[0], B.grid[1]);
    const g = { a: A.id, b: B.id, x, z, axis: dr ? 'z' : 'x', river, campus: !A.zone || !B.zone, key: [A.id, B.id].sort().join('|'),
      pa: new THREE.Vector3(A.c.x + dq * RING_H, TOP, A.c.z + dr * RING_H), pb: new THREE.Vector3(B.c.x - dq * RING_H, TOP, B.c.z - dr * RING_H) }; gates.push(g); gateOf.set(g.key, g); return g; };
  for (const Z of cells.values()) { if (!Z.zone) continue; const nb = []; for (let k = 0; k < 4; k++) { const [dq, dr] = NEIGHBORS[k]; const O = cells.get(cellKey(Z.grid[0] + dq, Z.grid[1] + dr));
      const ok = O && (O.zone || (O.campus && O.campus.link === Z.id)); nb.push({ id: O && O.zone ? O.id : null, dq, dr, side: SIDE[k] });
      if (ok && (!O.zone || Z.id < O.id)) mkGate(Z, O, k); } neighbors.set(Z.id, nb); }
  const gateSidesOf = Z => NEIGHBORS.map(([dq, dr]) => { const O = cells.get(cellKey(Z.grid[0] + dq, Z.grid[1] + dr)); return (O && gateOf.get([Z.id, O.id].sort().join('|'))) || null; });
  // 大地：一整片草地（往外延伸到遠山腳下）
  const all = [...cells.values()]; const cx0 = Math.min(...all.map(z => z.c.x)), cx1 = Math.max(...all.map(z => z.c.x)), cz0 = Math.min(...all.map(z => z.c.z)), cz1 = Math.max(...all.map(z => z.c.z)); const mx = (cx0 + cx1) / 2, mz = (cz0 + cz1) / 2;
  const gg = plane(180, 180); worldUV(gg, mx, mz); const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: texOf('wild'), roughness: 1 })); ground.position.set(mx, TOP, mz); ground.receiveShadow = true; scene.add(ground);
  // 各區塊
  for (const Z of cells.values()) { if (!Z.zone) continue; const i = Z.isl; const top = buildZone(scene, kit, i, Z.c, gateSidesOf(Z), i.plaza ? CONFIG.plaza.basketZ : null); views.set(i.id, { top, cliff: top, outline: new THREE.Object3D(), center: Z.c }); }
  // 圍欄：每條區塊邊界畫一次（兩邊都是區塊、或一邊是區塊一邊是野地）；有門的留缺口；河的那條不畫圍欄
  const done = new Set();
  for (const Z of cells.values()) { if (!Z.zone) continue; for (let k = 0; k < 4; k++) { const [dq, dr] = NEIGHBORS[k]; const ok2 = cellKey(Z.grid[0] + dq, Z.grid[1] + dr); const ek = [cellKey(...Z.grid), ok2].sort().join('#'); if (done.has(ek)) continue; done.add(ek);
      const O = cells.get(ok2); const river = O && riverBetween(Z.grid[0], Z.grid[1], O.grid[0], O.grid[1]) || (!O && riverBetween(Z.grid[0], Z.grid[1], Z.grid[0] + dq, Z.grid[1] + dr)); if (river) continue;
      const g = O && gateOf.get([Z.id, O.id].sort().join('|')); const s = sides(H)[k]; const outer = !O || !O.zone;
      fenceLine(kit, Z.c.x + s.a[0], Z.c.z + s.a[1], Z.c.x + s.b[0], Z.c.z + s.b[1], g ? 1.0 : 0); if (outer && !g) fenceLine(kit, Z.c.x + s.a[0] + dq * 0.4, Z.c.z + s.a[1] + dr * 0.4, Z.c.x + s.b[0] + dq * 0.4, Z.c.z + s.b[1] + dr * 0.4, 0, 'hedge'); } }
  // 河與木橋
  const rivers = RIVERS.map(rv => buildRiver(scene, kit, rv, rnd)); for (const g of gates) if (g.river) buildBridge(kit, g);
  // 野地：格子範圍內沒用到的格子、和小鎮外圍一圈；新校區的格子另外放進自己的 kit（蓋好時拿掉）
  const inZone = (x, z) => { const k = cellKey(Math.round(x / SPACING), Math.round(z / SPACING)); const Z = cells.get(k); return Z && (Z.zone || Z.campus); };
  const nearRiver = (x, z) => RIVERS.some(rv => rv.axis === 'z' ? Math.abs(z - rv.at * SPACING) < RIVER_HW + 0.5 : Math.abs(x - rv.at * SPACING) < RIVER_HW + 0.5);
  const pad = 9; wildDecor(kit, cx0 - H - pad, cz0 - H - pad, cx1 - cx0 + 2 * (H + pad), cz1 - cz0 + 2 * (H + pad), rnd, (x, z) => inZone(x, z) || nearRiver(x, z) || [...cells.values()].some(Z => Math.abs(x - Z.c.x) < H + 0.7 && Math.abs(z - Z.c.z) < H + 0.7 && Z.zone), 1.3);
  const wildKits = new Map();
  for (const Z of cells.values()) { if (!Z.campus || !makeKit) continue; const k = makeKit(); const pr = mulberry(Z.id.length * 31); wildDecor(k, Z.c.x - H + 0.6, Z.c.z - H + 0.6, 2 * H - 1.2, 2 * H - 1.2, pr, (x, z) => nearRiver(x, z), 0.7); wildKits.set(Z.id, k); } // main.js 負責 build／蓋好時 dispose
  return { centers, neighbors, views, bridges: gates, gates, tops: [ground], links: [], rivers, cells, wildKits, ground };
}
// 蓋好的新校區：區塊地面、步道、圍欄（不跟其他區塊共用的邊）
export function buildCampusZone(scene, kit, p, c, world) { const Z = world.cells.get(cellKey(...p.grid)); const gs = NEIGHBORS.map(([dq, dr]) => { const O = world.cells.get(cellKey(p.grid[0] + dq, p.grid[1] + dr)); return !!(O && world.gates.some(g => g.campus && ((g.a === p.id && g.b === O.id) || (g.b === p.id && g.a === O.id)))); });
  const top = buildZone(scene, kit, { id: p.id, ground: p.ground }, c, gs, null);
  for (let k = 0; k < 4; k++) { const [dq, dr] = NEIGHBORS[k]; const O = world.cells.get(cellKey(p.grid[0] + dq, p.grid[1] + dr)); if (O && O.zone) continue; if (riverBetween(p.grid[0], p.grid[1], p.grid[0] + dq, p.grid[1] + dr)) continue; const s = sides(H)[k]; fenceLine(kit, c.x + s.a[0], c.z + s.a[1], c.x + s.b[0], c.z + s.b[1], 0); }
  if (Z) Z.zone = true; return { top }; }
export const buildExtraIsland = buildCampusZone; // 舊名稱
// 步道環上的 16 個點：每邊 4 個（角、−0.5、中點、+0.5），順時針 北→東→南→西；k % 4 === 2 是邊中點（門從這裡出去）
export function ringPoints(c) { const out = []; for (const s of sides(RING_H)) for (const t of [-1, -0.5, 0, 0.5]) { const x = (s.a[0] + s.b[0]) / 2 + (s.b[0] - s.a[0]) / 2 * t, z = (s.a[1] + s.b[1]) / 2 + (s.b[1] - s.a[1]) / 2 * t; out.push(new THREE.Vector3(c.x + x, TOP + 0.03, c.z + z)); } return out; }
export function nearestRingPair(ca, cb) { let best = null; for (const a of ringPoints(ca)) for (const b of ringPoints(cb)) { const d = a.distanceTo(b); if (!best || d < best.d) best = { pa: a, pb: b, d }; } return best; }
// 行人路網：每個區塊 16 個環節點，門連接兩邊的邊中點
export function buildGraph(islands, centers, neighbors, links = [], gates = []) {
  const nodes = [], adj = [], ringIndex = new Map();
  const add = (p, island, mid) => { nodes.push({ p, island, mid }); adj.push([]); return nodes.length - 1; };
  const link = (a, b) => { if (a == null || b == null) return; const d = nodes[a].p.distanceTo(nodes[b].p); adj[a].push([b, d]); adj[b].push([a, d]); };
  for (const i of islands) { const c = centers.get(i.id), ids = ringPoints(c).map((p, k) => add(p, i.id, k % 4 === 2)); for (let k = 0; k < ids.length; k++) link(ids[k], ids[(k + 1) % ids.length]); ringIndex.set(i.id, ids); }
  function nodeNear(id, p) { let best = null, bd = 1e9; for (const n of ringIndex.get(id) || []) { const d = nodes[n].p.distanceToSquared(p); if (d < bd) { bd = d; best = n; } } return best; }
  for (const g of gates) if (ringIndex.has(g.a) && ringIndex.has(g.b)) link(nodeNear(g.a, g.pa), nodeNear(g.b, g.pb));
  const midFor = (id, dq, dr) => { const c = centers.get(id); return nodeNear(id, new THREE.Vector3(c.x + dq * RING_H, TOP, c.z + dr * RING_H)); };
  function shortest(a, b) { const dist = new Array(nodes.length).fill(Infinity), prev = new Array(nodes.length).fill(-1), done = new Array(nodes.length).fill(false); dist[a] = 0;
    for (;;) { let u = -1, best = Infinity; for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; } if (u < 0 || u === b) break; done[u] = true; for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; } }
    const path = []; for (let v = b; v >= 0; v = prev[v]) path.unshift(v); return path[0] === a ? path : [a]; }
  function nearestNode(p) { let best = 0, bd = 1e9; for (let i = 0; i < nodes.length; i++) { const d = nodes[i].p.distanceToSquared(p); if (d < bd) { bd = d; best = i; } } return best; }
  return { nodes, adj, ringIndex, shortest, nodeNear, nearestNode, midFor };
}
export function makeRoute(pts) { const lens = [0]; for (let k = 1; k < pts.length; k++) lens.push(lens[k - 1] + pts[k].distanceTo(pts[k - 1])); return { pts, lens, total: lens[lens.length - 1] }; }
export function sampleRoute(route, s) { if (route.total < 0.001) return { p: route.pts[0].clone(), dir: new THREE.Vector3(0, 0, 1) }; let k = 1; while (k < route.lens.length - 1 && route.lens[k] < s) k++; const a = route.pts[k - 1], b = route.pts[k], seg = route.lens[k] - route.lens[k - 1] || 1; const t = Math.min(1, Math.max(0, (s - route.lens[k - 1]) / seg)); return { p: a.clone().lerp(b, t), dir: new THREE.Vector3().subVectors(b, a).setY(0).normalize() }; }
// 區塊內的建築槽位（區塊中心為原點）：地標在後方中間、廣場在前方中間；前 3 格給課程建築，後 5 格放小房子
const SLOTS = [[-2.1, 0.7], [2.1, 0.7], [-2.1, -0.75], [2.1, -0.75], [-2.1, 2.15], [2.1, 2.15], [-2.1, -2.2], [2.1, -2.2]];
export function slotLayout(n) { return { size: 1.15, slots: SLOTS.slice(0, n).map(([x, z]) => [x * INNER / 2.6, z * INNER / 2.6]), heroZ: -1.45 }; }
