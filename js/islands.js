/* 闖關島（動森＋牧場物語風）：圓潤的海岸線、草地島面、泥土步道環、沙岩崖壁、沙灘與淺灘、木橋、行人路網。步道環與可走範圍仍是六邊形（導航用），海岸線永遠包住它。 */
import * as THREE from 'three';
import { WATER_Y, mulberry } from './env.js';
import { CONFIG } from './config.js';
// 島的大小與間距（config.world：島放大 islandK 倍、整張地圖攤開 mapK 倍，島與島之間的水道約 0.9）；環境、鏡頭、海上裝飾跟著 mapK 放大
export const ISLAND_K = CONFIG.world.islandK, MAP_K = CONFIG.world.mapK;
export const R = 2.02 * ISLAND_K, SPACING = 2.28 * MAP_K, TOP = 0.65, RING_R = 1.8 * ISLAND_K, INNER = 1.4 * ISLAND_K;
const SQ3 = Math.sqrt(3);
export const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
export function axialToWorld(q, r) { return new THREE.Vector3(SQ3 * SPACING * (q + r / 2) - 2, TOP, 1.5 * SPACING * r - 10.26); }
export function dirOf(dq, dr) { const x = SQ3 * (dq + dr / 2), z = 1.5 * dr, l = Math.hypot(x, z); return [x / l, z / l]; }
export function hexVertex(cx, cz, r, k) { const a = Math.PI / 2 + (k * Math.PI) / 3; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; }
export function insideHex(x, z, ri) { const ax = Math.abs(x), az = Math.abs(z); return ax <= ri && ax * 0.5 + az * 0.8660254 <= ri; }
// 島面：全部是草地（動森／牧場物語風），依島的類型換一點色調；gravel／boardwalk／courtyard 是泥土田地
const TONE = { granite: 0xa9c98a, lawn: 0xb3cf8e, gravel: 0xc9a27c, street: 0x9cc27a, meadow: 0xb9d492, terracotta: 0xc3cf86, garden: 0xa9c98a, forest: 0x86ad6a, rubber: 0xb3cf8e, boardwalk: 0xcfa985, ringtile: 0xd6b58d, schoolyard: 0x9cc27a, softpad: 0xb9d492, courtyard: 0xcaa57f, dirt: 0xd6b58d };
const SHALLOW = { default: 0x9fd9d8 };
const CLIFF = [0x7fa060, 0xf0e0bd, 0xe2cba0, 0xd0b183, 0xbf9a6c]; // 由上到下：草皮邊、沙岩層
const SAND = 0xf2e5c6, SAND_WET = 0xe4d2a9;
function groundTexture(type) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const rnd = mulberry(type.length * 97 + 3);
  g.fillStyle = '#' + (TONE[type] || TONE.lawn).toString(16).padStart(6, '0'); g.fillRect(0, 0, 256, 256);
  const speck = (n, cols, rmin, rmax, a = 1) => { for (let i = 0; i < n; i++) { g.globalAlpha = a * (0.4 + rnd() * 0.6); g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, rmin + rnd() * (rmax - rmin), 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; };
  const dirt = type === 'gravel' || type === 'boardwalk' || type === 'courtyard' || type === 'ringtile' || type === 'dirt';
  if (dirt) { speck(2200, ['#c49a6e', '#dcbf98', '#b8906a', '#e3cba6'], 0.5, 1.8, 0.7); speck(60, ['#a98a6a', '#8f7355'], 1.4, 3.0, 0.6); if (type === 'ringtile' || type === 'dirt') speck(40, ['#f1e4c3', '#d9c6a3'], 2.5, 4.5, 0.5); }
  else { const deep = type === 'forest' ? ['#7a9a60', '#95b37a', '#6e8c58'] : type === 'terracotta' ? ['#b5c47a', '#d3dc98', '#a8b870'] : ['#a2bb84', '#c1d49e', '#95ae79', '#b0c78e']; speck(3200, deep, 0.4, 1.4, 0.55);
    speck(220, ['#8fae70', '#7f9f62'], 1.0, 2.2, 0.35); // 草叢深色斑
    if (['meadow', 'garden', 'softpad', 'lawn', 'granite'].includes(type)) speck(90, ['#f3e7a6', '#ffffff', '#f2c4b2', '#d9c6f0', '#f6d36a'], 0.9, 1.7, 0.9); // 小花
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
// 海岸線：圓角六邊形（永遠包住步道環與可走的範圍）加一點起伏，看起來像動森的島
const SEG = 84;
export function shoreR(a, seed = 0) { const ph = ((a - Math.PI / 3) % (Math.PI / 3) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6; const ri = R * 0.8660254; const hex = ri / Math.cos(ph), round = ri / Math.pow(Math.cos(ph), 0.45);
  return Math.min(hex + 0.12, round) + 0.04 + Math.sin(a * 3 + seed) * 0.04 + Math.sin(a * 7 + seed * 1.7) * 0.025 + Math.sin(a * 11 + seed * 0.4) * 0.012; }
function shorePts(seed, extra = 0, wobble = 0) { const out = []; for (let k = 0; k < SEG; k++) { const a = (k / SEG) * Math.PI * 2; const r = shoreR(a, seed) + extra + Math.sin(a * 5 + seed * 2.3) * wobble; out.push([Math.cos(a) * r, Math.sin(a) * r]); } return out; }
function polyShape(pts) { const s = new THREE.Shape(); pts.forEach(([x, z], k) => k ? s.lineTo(x, -z) : s.moveTo(x, -z)); s.closePath(); return s; }
function ringGeo(outer, inner) { const s = polyShape(outer); const h = new THREE.Path(); inner.forEach(([x, z], k) => k ? h.lineTo(x, -z) : h.moveTo(x, -z)); h.closePath(); s.holes.push(h); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; }
// 島側：沿海岸線往下的崖壁，上面一圈草皮邊，往下是一層層沙岩，到水下漸漸變成水色；越往下略縮進去
function cliffGeometry(cx, cz, seed, yTop, yBot) {
  const segV = 8, posA = [], colA = [], idx = []; const water = new THREE.Color(0x8fc9cf); const pts = shorePts(seed); const layer = t => new THREE.Color(t < 0.08 ? CLIFF[0] : t < 0.3 ? CLIFF[1] : t < 0.5 ? CLIFF[2] : t < 0.7 ? CLIFF[3] : CLIFF[4]);
  for (let k = 0; k <= SEG; k++) { const [px, pz] = pts[k % SEG]; for (let v = 0; v <= segV; v++) { const t = v / segV, y = yTop + (yBot - yTop) * t, sh = 1 - t * 0.06; posA.push(cx + px * sh, y, cz + pz * sh); const c = layer(t).lerp(water, Math.max(0, (y - (WATER_Y + 0.1)) < 0 ? Math.min(1, (WATER_Y + 0.1 - y) * 1.8) : 0)); colA.push(c.r, c.g, c.b); } }
  for (let k = 0; k < SEG; k++) for (let v = 0; v < segV; v++) { const a = k * (segV + 1) + v, b = a + segV + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(posA, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function hexRing(rOut, rIn) { const s = new THREE.Shape(), h = new THREE.Path(); for (let k = 0; k < 6; k++) { const [x, z] = hexVertex(0, 0, rOut, k); k ? s.lineTo(x, -z) : s.moveTo(x, -z); const [x2, z2] = hexVertex(0, 0, rIn, k); k ? h.lineTo(x2, -z2) : h.moveTo(x2, -z2); } s.closePath(); h.closePath(); s.holes.push(h); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; }

// 共用材質（第一次用到才建；之後新蓋的島也共用）
const MATS = { top: new Map() };
function mats() { if (!MATS.cliff) { MATS.cliff = new THREE.MeshLambertMaterial({ vertexColors: true }); MATS.ringTex = groundTexture('ringtile'); MATS.sand = new THREE.MeshStandardMaterial({ color: SAND, roughness: 1 }); MATS.sandWet = new THREE.MeshStandardMaterial({ color: SAND_WET, roughness: 1 }); MATS.shallow = new THREE.MeshBasicMaterial({ color: SHALLOW.default, transparent: true, opacity: 0.5, depthWrite: false }); MATS.foam = new THREE.MeshBasicMaterial({ color: 0xf6fbfa, transparent: true, opacity: 0.6, depthWrite: false }); } return MATS; }
const topMat = ground => { if (!MATS.top.has(ground)) MATS.top.set(ground, new THREE.MeshStandardMaterial({ map: groundTexture(ground), roughness: 0.95 })); return MATS.top.get(ground); };
const seedOf = i => (i.number || 1) * 1.37;
// 一座島：草地島面、泥土步道環、崖壁、沙灘、淺灘與浪花、岸邊的小石頭與草叢、木頭路燈（小零件放進 kit）
function buildIsland(scene, i, c, kit) { const M = mats(); const seed = seedOf(i);
  const topGeo = new THREE.ShapeGeometry(polyShape(shorePts(seed, 0.02))); topGeo.rotateX(-Math.PI / 2); const uv = topGeo.attributes.uv, p = topGeo.attributes.position; for (let n = 0; n < p.count; n++) uv.setXY(n, (p.getX(n) + c.x) / 2.2, (p.getZ(n) + c.z) / 2.2);
  const top = new THREE.Mesh(topGeo, topMat(i.ground)); top.position.set(c.x, TOP, c.z); top.receiveShadow = true; top.userData = { island: i.id }; scene.add(top);
  const rm = new THREE.MeshStandardMaterial({ map: M.ringTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const ring = new THREE.Mesh(hexRing(RING_R + 0.15, RING_R - 0.15), rm); ring.position.set(c.x, TOP + 0.012, c.z); ring.receiveShadow = true; scene.add(ring);
  const cliff = new THREE.Mesh(cliffGeometry(c.x, c.z, seed, TOP + 0.02, WATER_Y - 0.5), M.cliff); cliff.castShadow = true; cliff.receiveShadow = true; cliff.userData = { island: i.id }; scene.add(cliff);
  // 沙灘：崖腳一圈沙，靠水那一邊顏色深一點（濕沙），再外面是淺灘和一圈浪花
  const beach = new THREE.Mesh(ringGeo(shorePts(seed, 0.24, 0.03), shorePts(seed, -0.08)), M.sand); beach.position.set(c.x, WATER_Y + 0.02, c.z); beach.receiveShadow = true; scene.add(beach);
  const wet = new THREE.Mesh(ringGeo(shorePts(seed, 0.3, 0.035), shorePts(seed, 0.2, 0.03)), M.sandWet); wet.position.set(c.x, WATER_Y + 0.016, c.z); scene.add(wet);
  const shallow = new THREE.Mesh(ringGeo(shorePts(seed, 0.75, 0.08), shorePts(seed, 0.29, 0.035)), M.shallow); shallow.position.set(c.x, WATER_Y + 0.008, c.z); scene.add(shallow);
  const foam = new THREE.Mesh(ringGeo(shorePts(seed, 0.38, 0.04), shorePts(seed, 0.31, 0.035)), M.foam); foam.position.set(c.x, WATER_Y + 0.012, c.z); scene.add(foam);
  // 岸邊：幾顆小石頭、草叢、貝殼、椰子樹（沙灘上）
  { const rnd = mulberry(Math.round(seed * 100)); for (let k = 0; k < 14; k++) { const a = rnd() * Math.PI * 2; const r = shoreR(a, seed); const kind = k % 4;
      if (kind === 0) kit.part('ico', [c.x + Math.cos(a) * (r + 0.08 + rnd() * 0.1), WATER_Y + 0.05, c.z + Math.sin(a) * (r + 0.08 + rnd() * 0.1)], [0.12 + rnd() * 0.1, 0.07, 0.1 + rnd() * 0.08], [0xc9bba6, 0xb7a993, 0xd8ccba][k % 3]);
      else if (kind === 1) kit.part('leaf', [c.x + Math.cos(a) * (r - 0.16), TOP + 0.05, c.z + Math.sin(a) * (r - 0.16)], [0.16, 0.12, 0.16], [0x8db86f, 0x9cc27a][k % 2]);
      else if (kind === 2) kit.part('sphere', [c.x + Math.cos(a) * (r + 0.1 + rnd() * 0.1), WATER_Y + 0.035, c.z + Math.sin(a) * (r + 0.1 + rnd() * 0.1)], [0.05, 0.03, 0.05], [0xfff8f4, 0xf2a1a1, 0xf6d36a][k % 3]);
      else if (k % 8 === 3) kit.tree(c.x + Math.cos(a) * (r + 0.12), c.z + Math.sin(a) * (r + 0.12), 0.3, k + Math.round(seed * 10), 'palm', WATER_Y + 0.02); } }
  // 步道環上的木頭路燈：木柱＋小燈籠
  for (let k = 0; k < 6; k++) { const [vx, vz] = hexVertex(c.x, c.z, RING_R + 0.18, k); kit.cyl(vx, TOP + 0.22, vz, 0.03, 0.44, 0x8a6a4a); kit.hbox(vx, TOP + 0.47, vz, 0.09, 0.1, 0.09, 0x6a4e36); kit.bulb(vx, TOP + 0.47, vz, 0.065); kit.part('hip', [vx, TOP + 0.54, vz], [0.13, 0.05, 0.13], 0x6a4e36); }
  return { top, cliff }; }
// 步道環上的 12 個點（頂點＋邊中點）
export function ringPoints(c) { const out = []; for (let k = 0; k < 6; k++) { const [vx, vz] = hexVertex(c.x, c.z, RING_R, k), [wx, wz] = hexVertex(c.x, c.z, RING_R, k + 1); out.push(new THREE.Vector3(vx, TOP + 0.03, vz), new THREE.Vector3((vx + wx) / 2, TOP + 0.03, (vz + wz) / 2)); } return out; }
// 兩座島步道環上最近的一對點
export function nearestRingPair(ca, cb) { let best = null; for (const a of ringPoints(ca)) for (const b of ringPoints(cb)) { const d = a.distanceTo(b); if (!best || d < best.d) best = { pa: a, pb: b, d }; } return best; }
// 陸橋：有拱架、橋墩、欄杆、燈的人行陸橋
function buildLink(kit, pa, pb, colors) { const len = pa.distanceTo(pb), dir = pb.clone().sub(pa).normalize(), yaw = Math.atan2(dir.x, dir.z), side = new THREE.Vector3(dir.z, 0, -dir.x); const N = Math.max(8, Math.round(len / 0.22));
  for (let s2 = 0; s2 < N; s2++) { const t = (s2 + 0.5) / N, q = pa.clone().lerp(pb, t); kit.hbox(q.x, TOP + 0.04, q.z, 0.46, 0.04, len / N + 0.005, s2 % 2 ? 0xc9a27c : 0xb48560, null, [0, yaw, 0]); }
  kit.hbox((pa.x + pb.x) / 2, TOP + 0.0, (pa.z + pb.z) / 2, 0.5, 0.06, len, 0x9a7454, null, [0, yaw, 0]);
  for (const sgn of [-1, 1]) { const o = side.clone().multiplyScalar(0.24 * sgn); const M = Math.round(len / 0.3);
    for (let k = 0; k <= M; k++) { const q = pa.clone().lerp(pb, k / M).add(o); kit.hbox(q.x, TOP + 0.13, q.z, 0.03, 0.18, 0.03, 0x8a6a4a); }
    const mid = pa.clone().lerp(pb, 0.5).add(o); kit.hbox(mid.x, TOP + 0.22, mid.z, 0.03, 0.03, len, 0xb48560, null, [0, yaw, 0]);
    // 拱架：一節節方塊沿拋物線排起來，吊索垂到橋面
    const A = 14, H = Math.min(1.1, 0.25 + len * 0.18); let prev = null;
    for (let k = 0; k <= A; k++) { const t = k / A; const q = pa.clone().lerp(pb, t).add(o); q.y = TOP + 0.22 + Math.sin(t * Math.PI) * H; if (prev) { const m2 = prev.clone().lerp(q, 0.5), seg = q.distanceTo(prev); const pitch = Math.atan2(q.y - prev.y, Math.hypot(q.x - prev.x, q.z - prev.z)); kit.part('box', [m2.x, m2.y, m2.z], [0.06, 0.06, seg + 0.01], 0x9a7454, [-pitch, yaw, 0]); }
      if (k > 0 && k < A && k % 2 === 0) { kit.hbox(q.x, (q.y + TOP + 0.22) / 2, q.z, 0.014, q.y - TOP - 0.22, 0.014, 0xc9a27c); }
      if (k % 4 === 2) kit.bulb(q.x, q.y + 0.05, q.z, 0.05, 0xfff0c2); prev = q; } }
  for (let k = 1; k < 4; k++) { const q = pa.clone().lerp(pb, k / 4); kit.cyl(q.x, (TOP - 0.02 + WATER_Y - 0.4) / 2, q.z, 0.14, TOP - 0.02 - (WATER_Y - 0.4), 0x8a6a4a); kit.cyl(q.x, WATER_Y + 0.02, q.z, 0.3, 0.04, 0xf6fbfa); }
  for (const end of [pa, pb]) { kit.cyl(end.x + side.x * 0.3, TOP + 0.3, end.z + side.z * 0.3, 0.05, 0.6, 0x8a6a4a); kit.cyl(end.x - side.x * 0.3, TOP + 0.3, end.z - side.z * 0.3, 0.05, 0.6, 0x8a6a4a); } }
// 新蓋的島（蓋校園的填海造島）：島本身＋一座陸橋接到指定的島
export function buildExtraIsland(scene, isl, c, linkC, kit, colors) { const v = buildIsland(scene, isl, c, kit); const { pa, pb } = nearestRingPair(c, linkC); buildLink(kit, pa, pb, colors); return { ...v, pa, pb }; }
export function buildIslands(scene, islands, kit, colors) {
  const centers = new Map(), axialMap = new Map(), views = new Map(), tops = [];
  for (const i of islands) { const w = axialToWorld(...i.axial); if (i.offset) { w.x += i.offset[0] * MAP_K; w.z += i.offset[1] * MAP_K; } centers.set(i.id, w); if (!i.detached) axialMap.set(i.axial.join(','), i.id); }
  const neighbors = new Map();
  for (const i of islands) {
    const c = centers.get(i.id); const { top, cliff } = buildIsland(scene, i, c, kit); tops.push(top, cliff);
    const pts = Array.from({ length: 7 }, (_, k) => { const [x, z] = hexVertex(c.x, c.z, R + 0.01, k); return new THREE.Vector3(x, TOP + 0.07, z); });
    const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: colors.accent })); outline.visible = false; scene.add(outline);
    const nb = []; for (const [dq, dr] of NEIGHBORS) { const id = i.detached ? null : axialMap.get([i.axial[0] + dq, i.axial[1] + dr].join(',')); nb.push({ id: id || null, dq, dr }); } neighbors.set(i.id, nb);
    views.set(i.id, { top, cliff, outline, center: c });
  }
  // 橋
  const bridges = [], seen = new Set();
  for (const [id, nb] of neighbors) for (const n of nb) { if (!n.id) continue; const key = [id, n.id].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
    const a = centers.get(id), b = centers.get(n.id); const [dx, dz] = dirOf(n.dq, n.dr); const ri = RING_R * 0.8660254;
    const pa = new THREE.Vector3(a.x + dx * ri, TOP, a.z + dz * ri), pb = new THREE.Vector3(b.x - dx * ri, TOP, b.z - dz * ri); bridges.push({ a: id, b: n.id, pa, pb });
    const len = pa.distanceTo(pb), yaw = Math.atan2(dx, dz), mid = pa.clone().lerp(pb, 0.5), arch = 0.08; const deck = [0xc9a27c, 0xb48560];
    for (let s = 0; s <= 8; s++) { const t = s / 8, pnt = pa.clone().lerp(pb, t); kit.hbox(pnt.x, TOP + 0.03 + Math.sin(t * Math.PI) * arch, pnt.z, 0.3, 0.035, len / 9 + 0.01, s % 2 ? deck[0] : deck[1], null, [Math.cos(t * Math.PI) * -arch * 2, yaw, 0]); }
    for (const side of [-1, 1]) { const ox = Math.cos(yaw) * 0.15 * side, oz = -Math.sin(yaw) * 0.15 * side; for (let s = 0; s <= 4; s++) { const t = s / 4, pnt = pa.clone().lerp(pb, t); kit.hbox(pnt.x + ox, TOP + 0.13 + Math.sin(t * Math.PI) * arch, pnt.z + oz, 0.03, 0.16, 0.03, 0x8a6a4a); } kit.hbox(mid.x + ox, TOP + 0.21 + arch * 0.66, mid.z + oz, 0.025, 0.025, len, 0xb48560, null, [0, yaw, 0]); }
  }
  // 陸橋：獨立島與指定的島之間，取兩島步道環上最近的一對節點
  const links = [];
  for (const i of islands) { if (!i.link || !centers.has(i.link)) continue; const { pa, pb } = nearestRingPair(centers.get(i.id), centers.get(i.link)); links.push({ a: i.id, b: i.link, pa, pb }); buildLink(kit, pa, pb, colors); }
  return { centers, neighbors, views, bridges, tops, links };
}
// 行人路網：每島 12 個環節點（頂點 + 邊中點），橋連接邊中點。
export function buildGraph(islands, centers, neighbors, links = []) {
  const nodes = [], adj = [], ringIndex = new Map();
  const add = (p, island) => { nodes.push({ p, island }); adj.push([]); return nodes.length - 1; };
  const link = (a, b) => { const d = nodes[a].p.distanceTo(nodes[b].p); adj[a].push([b, d]); adj[b].push([a, d]); };
  for (const i of islands) { const c = centers.get(i.id), ids = []; for (let k = 0; k < 6; k++) { const [vx, vz] = hexVertex(c.x, c.z, RING_R, k), [wx, wz] = hexVertex(c.x, c.z, RING_R, k + 1); ids.push(add(new THREE.Vector3(vx, TOP + 0.03, vz), i.id)); ids.push(add(new THREE.Vector3((vx + wx) / 2, TOP + 0.03, (vz + wz) / 2), i.id)); } for (let k = 0; k < 12; k++) link(ids[k], ids[(k + 1) % 12]); ringIndex.set(i.id, ids); }
  const midFor = (id, dq, dr) => { const c = centers.get(id), [dx, dz] = dirOf(dq, dr), ids = ringIndex.get(id); let best = null, bd = 1e9; for (let k = 1; k < 12; k += 2) { const p = nodes[ids[k]].p, d = (p.x - c.x - dx * 2) ** 2 + (p.z - c.z - dz * 2) ** 2; if (d < bd) { bd = d; best = ids[k]; } } return best; };
  for (const [id, nb] of neighbors) for (const n of nb) if (n.id && id < n.id) link(midFor(id, n.dq, n.dr), midFor(n.id, -n.dq, -n.dr));
  for (const L of links) link(nodeNear(L.a, L.pa), nodeNear(L.b, L.pb));
  function shortest(a, b) { const dist = new Array(nodes.length).fill(Infinity), prev = new Array(nodes.length).fill(-1), done = new Array(nodes.length).fill(false); dist[a] = 0;
    for (;;) { let u = -1, best = Infinity; for (let i = 0; i < nodes.length; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; } if (u < 0 || u === b) break; done[u] = true; for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; } }
    const path = []; for (let v = b; v >= 0; v = prev[v]) path.unshift(v); return path[0] === a ? path : [a]; }
  function nodeNear(id, p) { let best = null, bd = 1e9; for (const n of ringIndex.get(id)) { const d = nodes[n].p.distanceToSquared(p); if (d < bd) { bd = d; best = n; } } return best; }
  function nearestNode(p) { let best = 0, bd = 1e9; for (let i = 0; i < nodes.length; i++) { const d = nodes[i].p.distanceToSquared(p); if (d < bd) { bd = d; best = i; } } return best; }
  return { nodes, adj, ringIndex, shortest, nodeNear, nearestNode, midFor };
}
// 路線：節點序列 → 可取樣的折線
export function makeRoute(pts) { const lens = [0]; for (let k = 1; k < pts.length; k++) lens.push(lens[k - 1] + pts[k].distanceTo(pts[k - 1])); return { pts, lens, total: lens[lens.length - 1] }; }
export function sampleRoute(route, s) { if (route.total < 0.001) return { p: route.pts[0].clone(), dir: new THREE.Vector3(0, 0, 1) }; let k = 1; while (k < route.lens.length - 1 && route.lens[k] < s) k++; const a = route.pts[k - 1], b = route.pts[k], seg = route.lens[k] - route.lens[k - 1] || 1; const t = Math.min(1, Math.max(0, (s - route.lens[k - 1]) / seg)); return { p: a.clone().lerp(b, t), dir: new THREE.Vector3().subVectors(b, a).setY(0).normalize() }; }
// 島內建築槽位
// 先照原本大小的島排好（島內半徑 INNER÷ISLAND_K），再整組乘上 ISLAND_K：島變大但建築、走道的比例跟原本一樣，不會變成擠滿大房子
export function slotLayout(n, heroSize, avoid = null) { const K = ISLAND_K, I0 = INNER / K, hh = heroSize / 2, heroZ = -0.58; // avoid(x, z, 半寬)：回傳 true 的位置不放建築（金蛋籃廣場；用放大後的座標判斷）
  const scaled = (size, slots) => ({ size: size * K, slots: slots.map(([x, z]) => [x * K, z * K]), heroZ: heroZ * K });
  for (let s = n <= 4 ? 0.62 : 0.56; s > 0.3; s -= 0.03) { const h = s / 2, gapX = s + 0.1, gapZ = s + 0.08, out = [];
    for (let zi = -4; zi <= 4; zi++) for (let xi = -5; xi <= 5; xi++) { const z = 0.2 + zi * gapZ, x = (xi + (Math.abs(zi) % 2 ? 0.5 : 0)) * gapX; if (![[x - h, z - h], [x + h, z - h], [x - h, z + h], [x + h, z + h]].every(([px, pz]) => insideHex(px, pz, I0 - 0.04))) continue; if (Math.abs(x) < hh + h + 0.06 && Math.abs(z - heroZ) < hh + h + 0.06) continue; if (avoid && avoid(x * K, z * K, h * K)) continue; out.push([x, z]); }
    if (out.length >= n) { out.sort((a, b) => Math.hypot(a[0], a[1] - 0.25) - Math.hypot(b[0], b[1] - 0.25)); return scaled(s, out.slice(0, n)); } }
  return scaled(0.3, []);
}
