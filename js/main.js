/* 進入點：建場景、島、建築、居民、動物、打工遊戲、逛城市與 UI；鏡頭（跟隨、鳥瞰）、鍵盤／搖桿輸入、點擊；天色；主迴圈。 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG as C } from './config.js';
import { createEnvironment } from './env.js';
import { buildIslands, buildGraph, slotLayout, buildExtraIsland, nearestRingPair, axialToWorld, TOP, INNER, R, RING_R, MAP_K, ISLAND_K, hexVertex, dirOf } from './islands.js';
import { createKit, createModels, GLOW, GLOW_GHOST, CUT, setCutVisible } from './buildings.js';
import { createPeople } from './people.js';
import { createAnimals } from './animals.js';
import { createGame } from './game.js';
import { createExplore } from './explore.js';
import { createNav } from './nav.js';
import { ICONS } from './icons.js';
import { createUI } from './ui.js';
import { mulberry, WATER_Y } from './env.js';
const stage = document.getElementById('stage');
const quality = (navigator.hardwareConcurrency || 4) >= 6 && !/Mobi|Android/i.test(navigator.userAgent) ? 'high' : 'medium';
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'high' ? 1.75 : 1.25)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.3, 320);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minPolarAngle = THREE.MathUtils.degToRad(25); controls.maxPolarAngle = THREE.MathUtils.degToRad(70); controls.minDistance = 4; controls.maxDistance = 70 * MAP_K; controls.enablePan = true; controls.screenSpacePanning = false;
const TOUCH_MAP = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }, TOUCH_FOLLOW = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }; controls.touches = { ...TOUCH_MAP }; // 手機：單指拖地圖、雙指縮放旋轉（跟地圖 App 一樣）
const colors = C.palette;
// 島與建築
const kit = createKit(TOP);
const { centers, neighbors, views, tops, links, bridges } = buildIslands(scene, C.islands, kit, colors);
const center = new THREE.Vector3(); for (const c of centers.values()) center.add(c); center.divideScalar(centers.size); center.y = TOP;
const model = createModels(kit, colors); const rnd = mulberry(5);
// 每座島固定 8 個槽位：前 5 個給政策建築（動態），後 3 個放小房子（靜態）
const POLICY_SLOTS = 5, LAYOUT = new Map(), STATIC_OBST = [], CITY_POS = new Map(), BOUTIQUES = []; // BOUTIQUES：逛城市的服飾店（那幾座島的第 1 棟小房子） // STATIC_OBST：打工時不能穿過的建築（地標、小房子），政策建築另外動態加
const PZ = C.plaza, inPlaza = (x, z, h) => Math.abs(x) < PZ.r + h && z + h > PZ.z - PZ.r && z - h < PZ.z + PZ.len; // 金蛋籃廣場：島中央前方一條走道不放建築
const TREE_STYLE = { forest: 'conifer', garden: 'blossom', softpad: 'topiary', boardwalk: 'palm', rubber: 'palm', street: 'poplar', courtyard: 'blossom', meadow: 'willow', lawn: 'round', granite: 'topiary', terracotta: 'round', schoolyard: 'round', gravel: 'round' };
const TRIM = { granite: 'bollard', lawn: 'hedge', gravel: 'hoarding', street: 'bollard', schoolyard: 'railing', forest: 'logs', softpad: 'picket', terracotta: 'wall', garden: 'hedge', meadow: 'railing', boardwalk: 'rope', rubber: 'picket', courtyard: 'wall' };
for (const isl of C.islands) { const c = centers.get(isl.id); const lay = slotLayout(8, 1.18, isl.plaza ? inPlaza : null); LAYOUT.set(isl.id, lay); const style = TREE_STYLE[isl.ground] || 'round'; const occ = [[0, lay.heroZ, 0.95 * ISLAND_K], ...lay.slots.map(([x, z]) => [x, z, lay.size * 0.55]), ...(isl.plaza ? [[0, PZ.basketZ, 0.8], [0, PZ.z + PZ.len - 0.2, 0.5]] : [])];
  const free = (x, z, r) => occ.every(([ox, oz, orr]) => Math.hypot(x - ox, z - oz) > r + orr);
  model(isl.landmark, c.x, c.z + lay.heroZ, 1.18 * ISLAND_K, isl.number); STATIC_OBST.push([c.x, c.z + lay.heroZ, 0.42 * ISLAND_K]);
  lay.slots.slice(POLICY_SLOTS).forEach(([sx, sz], i) => { const bq = C.explore.boutiques.some(([id, h]) => id === isl.id && h === i), kind = bq ? 'shop' : ['shop', 'house', 'house2'][i % 3], cp = C.econ.city.find(p => p.island === isl.id && p.house === i); // 蓋城市的位置先空著，由 placeCity 決定放小房子、工地或蓋好的建築
    if (cp) CITY_POS.set(cp.id, { x: c.x + sx, z: c.z + sz, size: lay.size, kind, seed: isl.number * 3 + i }); else model(kind, c.x + sx, c.z + sz, lay.size * 1.05, isl.number * 3 + i); STATIC_OBST.push([c.x + sx, c.z + sz, lay.size * 0.38]);
    if (bq && !cp) BOUTIQUES.push({ x: c.x + sx, z: c.z + sz, island: isl.id }); });
  // 島緣：沒有橋的邊放圍欄／樹籬／矮牆
  const nb = neighbors.get(isl.id); const bridgeDirs = nb.filter(n => n.id).map(n => dirOf(n.dq, n.dr)); for (const L of links) if (L.a === isl.id || L.b === isl.id) { const mine = L.a === isl.id ? L.pa : L.pb; const v = mine.clone().sub(c).setY(0).normalize(); bridgeDirs.push([v.x, v.z]); } const trim = TRIM[isl.ground];
  for (let k = 0; k < 6; k++) { const [ax, az] = hexVertex(0, 0, RING_R + 0.3, k), [bx, bz] = hexVertex(0, 0, RING_R + 0.3, k + 1); const mx = (ax + bx) / 2, mz = (az + bz) / 2, ml = Math.hypot(mx, mz); if (bridgeDirs.some(([dx, dz]) => (dx * mx + dz * mz) / ml > 0.86)) continue; const yaw = Math.atan2(bx - ax, bz - az), len = Math.hypot(bx - ax, bz - az);
    for (let s = 0; s <= 8; s++) { const t = 0.08 + (s / 8) * 0.84; const x = c.x + ax + (bx - ax) * t, z = c.z + az + (bz - az) * t;
      if (trim === 'bollard') { if (s % 2 === 0) { kit.cyl(x, TOP + 0.07, z, 0.045, 0.14, 0x3b3a42); kit.cyl(x, TOP + 0.15, z, 0.05, 0.03, 0xe8c547); } }
      else if (trim === 'hedge') kit.part('leaf', [x, TOP + 0.1, z], [0.22, 0.18, 0.22], s % 2 ? 0x9cc27a : 0x8db86f);
      else if (trim === 'wall') { if (s % 2 === 0) kit.hbox(x, TOP + 0.08, z, 0.08, 0.16, 0.08, 0xd9cbb4); }
      else if (trim === 'logs') { if (s % 2 === 0) kit.cyl(x, TOP + 0.09, z, 0.06, 0.18, 0x7a5c42); }
      else if (trim === 'picket') kit.hbox(x, TOP + 0.08, z, 0.025, 0.16, 0.025, [0xf2b5c6, 0xfff8f4, 0x9fc4e6][s % 3]);
      else kit.hbox(x, TOP + 0.09, z, 0.022, 0.18, 0.022, trim === 'rope' ? 0x9a7a5a : 0xfff8f4); }
    if (trim === 'wall') kit.hbox(c.x + mx, TOP + 0.08, c.z + mz, 0.06, 0.14, len * 0.84, 0xe4d6c3, null, [0, yaw, 0]);
    else if (trim === 'railing' || trim === 'picket') kit.hbox(c.x + mx, TOP + 0.16, c.z + mz, 0.015, 0.015, len * 0.84, trim === 'picket' ? 0xfff8f4 : 0xdb6a41, null, [0, yaw, 0]);
    else if (trim === 'rope') kit.hbox(c.x + mx, TOP + 0.14, c.z + mz, 0.012, 0.012, len * 0.84, 0x7a5c42, null, [0, yaw, 0]);
    else if (trim === 'hoarding') kit.hbox(c.x + mx, TOP + 0.12, c.z + mz, 0.03, 0.24, len * 0.84, k % 2 ? 0xdb6a41 : 0xf2efe8, null, [0, yaw, 0]); }
  // 散景：樹、灌木、花、長椅（有人坐）、單車架、垃圾桶、花盆、鵝卵石、小攤
  const MIX = ['tree', 'bush', 'flowers', 'bench', 'umbrella', 'tree', 'pot', 'vending', 'bikerack', 'cone', 'flowers', 'hedge', 'tree', 'signpost', 'pebble', 'stand', 'bush', 'bin'];
  let placed = 0; for (let tries = 0; tries < 220 && placed < 20; tries++) { const lx = (rnd() - 0.5) * INNER * 1.93, lz = (rnd() - 0.5) * INNER * 1.64; const t = MIX[placed % MIX.length]; const r = t === 'tree' ? 0.22 : t === 'bench' || t === 'stand' || t === 'umbrella' ? 0.2 : t === 'vending' || t === 'signpost' ? 0.13 : 0.1; if (Math.hypot(lx, lz) > INNER - 0.12 || Math.abs(lx) * 0.5 + Math.abs(lz) * 0.866 > INNER - 0.12 || !free(lx, lz, r)) continue; occ.push([lx, lz, r]);
    if (t === 'tree') kit.tree(c.x + lx, c.z + lz, 0.3 + rnd() * 0.22, placed + isl.number, style); else model(t, c.x + lx, c.z + lz, 0.5, placed + isl.number); placed++; }
  // 彩旗：夜市與老街風格的島，在路燈間掛旗
  if (['boardwalk', 'courtyard', 'rubber'].includes(isl.ground)) for (let k = 0; k < 6; k++) { const [ax, az] = hexVertex(c.x, c.z, RING_R + 0.3, k), [bx, bz] = hexVertex(c.x, c.z, RING_R + 0.3, k + 1); for (let s = 1; s < 9; s++) { const t = s / 9; kit.hbox(ax + (bx - ax) * t, TOP + 0.5 - Math.sin(t * Math.PI) * 0.06, az + (bz - az) * t, 0.05, 0.07, 0.01, [0xdb6a41, 0xe8c547, 0x58a6a6, 0xf2a1a1][s % 4], null, [0, Math.atan2(bx - ax, bz - az), 0]); } kit.hbox((ax + bx) / 2, TOP + 0.47, (az + bz) / 2, 0.008, 0.008, Math.hypot(bx - ax, bz - az), 0x211d1d, null, [0, Math.atan2(bx - ax, bz - az), 0]); } }

// 蓋城市的新北行政區：位置先算好（海上裝飾避開這些位置），蓋好才真的從海上長出來（placeCity）
const NEW_ISLES = new Map(C.econ.city.filter(p => p.kind === 'island').map(p => [p.id, { p, c: axialToWorld(...p.axial) }]));
// ── 海上裝飾：小樹島、梯田小丘、沙洲陽傘、消波塊、小船、浮標、燈塔（避開島、未來的新島與登陸航線）──
{ const srnd = mulberry(77); const placed = []; const W0 = WATER_Y; const lanes = Object.values(C.landings).map(l => { const lc = centers.get(l.island); const d = lc.clone().sub(center).setY(0).normalize(); return { a: lc, d }; });
  const nearLane = (x, z) => lanes.some(({ a, d }) => { const vx = x - a.x, vz = z - a.z; const t = vx * d.x + vz * d.z; if (t < -1 || t > 12) return false; return Math.hypot(vx - d.x * t, vz - d.z * t) < 2.4; });
  const ok = (x, z, r) => [...centers.values(), ...[...NEW_ISLES.values()].map(n => n.c)].every(c => Math.hypot(x - c.x, z - c.z) > R + 1.2 + r) && placed.every(([px, pz, pr]) => Math.hypot(x - px, z - pz) > pr + r + 1.2) && !nearLane(x, z);
  const pav = (x, y, z, s, roof) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.cyl(x + dx * 0.18 * s, y + 0.18 * s, z + dz * 0.18 * s, 0.035 * s, 0.36 * s, 0xfff8f4); kit.part('hip', [x, y + 0.44 * s, z], [0.6 * s, 0.2 * s, 0.6 * s], roof); kit.part('rbox', [x, y + 0.03 * s, z], [0.5 * s, 0.06 * s, 0.5 * s], 0xd9cbb4); };
  const KINDS = ['islet', 'breakwater', 'terrace', 'sandbar', 'boat', 'buoys', 'lighthouse', 'islet', 'boat', 'breakwater', 'buoys', 'sandbar'];
  let made = 0;
  for (let tries = 0; tries < 900 && made < KINDS.length; tries++) { const a = srnd() * Math.PI * 2, rad = (8 + srnd() * 11) * MAP_K; const x = center.x + Math.cos(a) * rad * 1.1, z = center.z + Math.sin(a) * rad * 0.95; const kind = KINDS[made]; const r = { islet: 1.6, terrace: 1.4, sandbar: 1.2, breakwater: 2.0, boat: 0.6, buoys: 0.6, lighthouse: 1.0 }[kind]; if (!ok(x, z, r)) continue; placed.push([x, z, r]); made++;
    if (kind === 'islet') { kit.cyl(x, W0 + 0.08, z, 3.0, 0.22, 0xe6d6b8); kit.part('dome', [x, W0 + 0.18, z], [2.6, 0.5, 2.6], 0xa9c98a); for (let k = 0; k < 5; k++) { const aa = k * 1.25 + srnd(), rr = 0.35 + srnd() * 0.6; kit.tree(x + Math.cos(aa) * rr, z + Math.sin(aa) * rr, 0.38 + srnd() * 0.18, k, 'round', W0 + 0.33); } pav(x + 0.45, W0 + 0.38, z + 0.4, 1.2, 0xdb6a41); }
    else if (kind === 'terrace') { for (let k = 0; k < 4; k++) { kit.cyl(x, W0 + 0.12 + k * 0.22, z, 2.6 - k * 0.55, 0.22, [0x9cc27a, 0xb3cf8e][k % 2]); kit.part('torus', [x, W0 + 0.23 + k * 0.22, z], [(2.6 - k * 0.55) / 2, (2.6 - k * 0.55) / 2, 0.6], 0x86ad6a, [Math.PI / 2, 0, 0]); } kit.cyl(x, W0 + 0.04, z, 2.9, 0.1, 0xe6d6b8); kit.tree(x, z, 0.4, 3, 'round', W0 + 1.0); }
    else if (kind === 'sandbar') { kit.cyl(x, W0 + 0.04, z, 2.4, 0.1, 0xf0e2c4); kit.part('ico', [x + 0.5, W0 + 0.06, z - 0.3], [0.9, 0.12, 0.6], 0xe9d9b6); for (let k = 0; k < 3; k++) { const ux = x - 0.6 + k * 0.6, uz = z + (k % 2) * 0.3; kit.cyl(ux, W0 + 0.35, uz, 0.02, 0.6, 0x6a665f); kit.part('cone', [ux, W0 + 0.66, uz], [0.6, 0.18, 0.6], [0xdb6a41, 0xe8c547, 0x58a6a6][k]); kit.hbox(ux + 0.15, W0 + 0.1, uz + 0.2, 0.3, 0.01, 0.16, [0xf2a1a1, 0xfff8f4, 0x9fc4e6][k]); } }
    else if (kind === 'breakwater') { const yaw = srnd() * Math.PI; const cs = [0xdb6a41, 0xf3e2c6, 0xe8c547, 0x58a6a6, 0xf2a1a1, 0xf4efe6]; for (let k = 0; k < 9; k++) { const t = (k - 4) * 0.42; const bx = x + Math.cos(yaw) * t, bz = z + Math.sin(yaw) * t; kit.part('rbox', [bx, W0 + 0.12 + (k % 2) * 0.06, bz], [0.36, 0.46, 0.36], cs[k % cs.length], [0, yaw + (k % 3 - 1) * 0.15, (k % 2 - 0.5) * 0.12]); if (k % 2) kit.part('ico', [bx + 0.12, W0 + 0.05, bz + 0.22], [0.2, 0.14, 0.2], 0x9d968a); if (k % 3 === 0) { kit.cyl(bx, W0 + 0.42, bz, 0.05, 0.12, 0xe8b04a); } } }
    else if (kind === 'boat') { const yaw = srnd() * Math.PI * 2; kit.part('rbox', [x, W0 + 0.08, z], [0.9, 0.16, 0.34], 0xfbfbf7, [0, yaw, 0]); kit.part('rbox', [x, W0 + 0.04, z], [0.92, 0.04, 0.36], 0xdb6a41, [0, yaw, 0]); kit.part('rbox', [x - Math.cos(yaw) * 0.12, W0 + 0.26, z + Math.sin(yaw) * 0.12], [0.34, 0.2, 0.26], 0x58a6a6, [0, yaw, 0]); kit.cyl(x + Math.cos(yaw) * 0.15, W0 + 0.5, z - Math.sin(yaw) * 0.15, 0.025, 0.7, 0x6a665f); kit.part('box', [x + Math.cos(yaw) * 0.25, W0 + 0.75, z - Math.sin(yaw) * 0.25], [0.2, 0.12, 0.01], 0xdb6a41, [0, yaw, 0]); }
    else if (kind === 'buoys') { for (let k = 0; k < 3; k++) { const bx = x + (k - 1) * 0.5, bz = z + (k % 2) * 0.3; kit.cyl(bx, W0 + 0.08, bz, 0.18, 0.18, k % 2 ? 0xe8c547 : 0xdb6a41); kit.cyl(bx, W0 + 0.2, bz, 0.16, 0.06, 0xfbfbf7); kit.part('sphere', [bx, W0 + 0.28, bz], [0.1, 0.1, 0.1], k % 2 ? 0xe8c547 : 0xdb6a41); } }
    else if (kind === 'lighthouse') { kit.cyl(x, W0 + 0.08, z, 1.6, 0.24, 0xd9cbb4); kit.part('ico', [x + 0.5, W0 + 0.12, z + 0.3], [0.5, 0.3, 0.4], 0x9d968a); for (let k = 0; k < 4; k++) kit.cyl(x, W0 + 0.38 + k * 0.3, z, 0.42 - k * 0.04, 0.3, k % 2 ? 0xdb6a41 : 0xfbfbf7); kit.cyl(x, W0 + 1.66, z, 0.38, 0.06, 0x3b3a42); kit.part('glowsphere', [x, W0 + 1.82, z], [0.24, 0.24, 0.24], 0xfff0c2); kit.part('cone', [x, W0 + 2.02, z], [0.36, 0.2, 0.36], 0xdb6a41); } } }
kit.build(scene);
const env = createEnvironment(scene, { center, quality }); env.setTime(720);
const graph = buildGraph(C.islands, centers, neighbors, links);
const nav = createNav({ islands: C.islands, centers, bridges, links, graph }); nav.setObstacles(STATIC_OBST, []);
// 政策建築：有指定行政區就放該區，沒有就依 id 雜湊隨機落島；清單改變時整批重建
const pkit = createKit(TOP); const pmodel = createModels(pkit, colors); let policyMeshes = [], policyById = new Map(), policyIsland = new Map(), policyStops = [], gameRef = null, labelsReady = false;
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
function placePolicies(list) { pkit.dispose(scene); policyById = new Map(); policyIsland = new Map(); policyStops = []; const dyn = []; const used = new Map(C.islands.map(i => [i.id, 0])); const ids = C.islands.map(i => i.id);
  const pick = (pol) => { let idx = pol.district && ids.includes(pol.district) ? ids.indexOf(pol.district) : hash(pol.id) % ids.length; for (let k = 0; k < ids.length; k++) { const id = ids[(idx + k) % ids.length]; if (used.get(id) < POLICY_SLOTS) return id; } return ids[idx]; };
  for (const pol of list) { const islId = pick(pol); const n = used.get(islId); used.set(islId, n + 1); const c = centers.get(islId), lay = LAYOUT.get(islId); const [sx, sz] = lay.slots[Math.min(n, POLICY_SLOTS - 1)]; pkit.owner = pol.id; pmodel(pol.model || 'kiosk', c.x + sx, c.z + sz, lay.size * 1.08, hash(pol.id) % 7); dyn.push([c.x + sx, c.z + sz, lay.size * 0.4]); policyById.set(pol.id, pol); policyIsland.set(pol.id, islId); policyStops.push({ pol, island: islId, order: C.islands.find(i => i.id === islId).number, pos: new THREE.Vector3(c.x + sx, TOP, c.z + sz) }); }
  pkit.owner = null; policyMeshes = pkit.build(scene); nav.setObstacles(null, dyn); if (gameRef) gameRef.setStops(policyStops); if (labelsReady) refreshPolicyLabels(); }
placePolicies(C.policies);
const people = createPeople(scene, colors, C.heroes, C.econ.outfits); const animals = createAnimals(scene, C.animals, { chantSize: C.chant.size });
// 名牌（DOM，螢幕固定大小，每幀投影）：政策標籤為主、可點；行政區只是淡淡的地面字；重疊時優先顯示前面的
const labelLayer = document.getElementById('labels'); const labels = [];
function addLabel(txt, pos, cls, num, prio = 1) { const el = document.createElement('div'); el.className = 'nameplate ' + (cls || ''); if (num) { const em = document.createElement('em'); em.textContent = num; el.appendChild(em); } el.appendChild(document.createTextNode(txt)); labelLayer.appendChild(el); const L = { el, pos: pos.clone(), v: new THREE.Vector3(), prio, w: 0, h: 0 }; labels.push(L); return L; }
const districtLabels = new Map();
for (const isl of C.islands) { const c = centers.get(isl.id); if (isl.goal) addLabel('市政府', c.clone().setY(TOP + 2.4), 'goal', '', 3); districtLabels.set(isl.id, addLabel(isl.name, c.clone().add(new THREE.Vector3(0, 0, R * 0.78)).setY(TOP), 'district', '', 0)); }
// 12 區對抗：地上的區名後面掛名次（有戰績才掛），自己選的區換珊瑚色
function setDistrictRanks(board, mine) { const rank = new Map(board.filter(r => r.kills > 0).map((r, i) => [r.id, i + 1]));
  for (const [id, L] of districtLabels) { const isl = C.islands.find(i => i.id === id), n = rank.get(id); L.el.textContent = isl.name; if (n) { const b = document.createElement('span'); b.className = 'rk' + (n === 1 ? ' top' : ''); b.textContent = `第${n}`; L.el.appendChild(b); } L.el.classList.toggle('mine', id === mine); L.w = 0; } }
for (const l of Object.values(C.landings)) { const lc = centers.get(l.island); const away = lc.clone().sub(center).setY(0).normalize(); addLabel(`${l.name} →`, lc.clone().add(away.multiplyScalar(4.2 * MAP_K)).setY(TOP + 0.3), 'river', '', 0); }
let policyLabels = [];
function refreshPolicyLabels() { for (const L of policyLabels) { L.el.remove(); const i = labels.indexOf(L); if (i >= 0) labels.splice(i, 1); } policyLabels = [];
  for (const st of policyStops) { const L = addLabel(st.pol.title, st.pos.clone().setY(TOP + 0.95), 'policy', st.pol.tag || '', 2); L.st = st; L.el.addEventListener('click', () => callbacks.card && callbacks.card(st.pol, st.island)); policyLabels.push(L); } }
labelsReady = true; refreshPolicyLabels();
// 蓋城市（金蛋商店）：還沒輪到＝原本的小房子、正在蓋＝工地、蓋好＝新建築；名牌寫名稱與進度
const ckit = createKit(TOP), cmodel = createModels(ckit, colors); let citySig = '', citySite = null; const cityLabels = new Map();
for (const b of BOUTIQUES) addLabel('👕 服飾店', new THREE.Vector3(b.x, TOP + 0.9, b.z), 'policy shopsign', '', 1.6); // 只在逛城市時顯示
// 新北的區：蓋的時候海上一片沙洲（跟著進度長大）、浮標圍一圈、一艘吊車船；投金蛋的工地在要接的那座島靠海那邊（接三重的新莊要等三重蓋好）
const isleSites = new Map(), isleBuilt = new Set();
function shoreOf(n) { const l = centers.get(n.p.link); return l ? nearestRingPair(l, n.c).pa : null; }
function reclaim(p) { const n = NEW_ISLES.get(p.id), pct = Math.max(0, Math.min(1, p.got / p.cost)), bucket = Math.floor(pct * 10); let g = isleSites.get(p.id); if (g && g.bucket === bucket) return; if (g) g.kit.dispose(scene);
  const k = createKit(TOP), c = n.c, rr = R * (0.25 + 0.7 * pct), W = WATER_Y;
  k.cyl(c.x, W + 0.01, c.z, rr * 2 + 0.3, 0.04, 0xcbbd9c); k.cyl(c.x, W + 0.05, c.z, rr * 2, 0.1, 0xe6d6b8); k.part('cone', [c.x - rr * 0.2, W + 0.16, c.z + rr * 0.1], [rr * 0.8, 0.18, rr * 0.7], 0xdccaa6);
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; k.cyl(c.x + Math.cos(a) * (R + 0.3), W + 0.06, c.z + Math.sin(a) * (R + 0.3), 0.12, 0.1, i % 2 ? 0xdb6a41 : 0xfbfbf7); }
  const bx = c.x + R + 0.75, bz = c.z; k.box(bx, W + 0.08, bz, 0.95, 0.16, 0.46, 0x3b5a7a); k.part('cone', [bx + 0.2, W + 0.26, bz], [0.36, 0.22, 0.3], 0xe6d6b8);
  k.box(bx - 0.25, W + 0.66, bz, 0.08, 1.0, 0.08, 0xe8c547); k.box(bx - 0.6, W + 1.14, bz, 0.8, 0.06, 0.06, 0xe8c547); k.box(bx - 0.92, W + 0.82, bz, 0.012, 0.6, 0.012, 0x333333); k.box(bx - 0.92, W + 0.5, bz, 0.12, 0.08, 0.12, 0x6a665f);
  k.build(scene); isleSites.set(p.id, { kit: k, bucket }); }
function growIsland(id) { if (isleBuilt.has(id)) return; isleBuilt.add(id); const n = NEW_ISLES.get(id), s = isleSites.get(id); if (s) { s.kit.dispose(scene); isleSites.delete(id); }
  const k = createKit(TOP), m = createModels(k, colors), c = n.c, r = buildExtraIsland(scene, { id, ground: n.p.ground }, c, centers.get(n.p.link), k, colors), lz = -0.58 * ISLAND_K;
  m(n.p.landmark, c.x, c.z + lz, 1.18 * ISLAND_K, 7); const tr = mulberry(id.length * 13);
  for (const [x, z] of [[-1.0, 0.4], [1.0, 0.5], [-0.5, 1.0], [0.6, 1.1], [-1.2, -0.2], [1.25, -0.1]]) { if (tr() < 0.75) k.tree(c.x + x * ISLAND_K, c.z + z * ISLAND_K, 0.32 + tr() * 0.18, Math.floor(tr() * 9), TREE_STYLE[n.p.ground] || 'round'); else m('bench', c.x + x * ISLAND_K, c.z + z * ISLAND_K, 0.5, 3); }
  k.build(scene); tops.push(r.top, r.cliff); centers.set(id, c); stageSpotCache.clear();
  nav.addIsland(id, c, r.pa, r.pb, [[c.x, c.z + lz, 0.42 * ISLAND_K]]);
  addLabel(n.p.name, c.clone().add(new THREE.Vector3(0, 0, R * 0.78)).setY(TOP), 'district newland', '新北', 0); }
function placeCity(list) { for (const p of list) if (p.kind === 'island') { if (p.st === 'done') growIsland(p.id); else if (p.st === 'now') reclaim(p); }
  const now = list.find(p => p.st === 'now'), isle = now && NEW_ISLES.get(now.id), shore = isle && shoreOf(isle), at = now && (shore || CITY_POS.get(now.id)); citySite = at ? { id: now.id, name: now.name, x: at.x, z: at.z } : null; const sig = list.map(p => p.st).join(','); if (sig !== citySig) { citySig = sig; ckit.dispose(scene);
    for (const p of list) { const at = CITY_POS.get(p.id); if (!at) continue; cmodel(p.st === 'done' ? p.model : p.st === 'now' ? 'crane' : at.kind, at.x, at.z, at.size * 1.05, at.seed); }
    ckit.build(scene); }
  for (const p of list) { const ni = NEW_ISLES.get(p.id), at = ni ? { x: ni.c.x, z: ni.c.z } : CITY_POS.get(p.id); if (!at) continue; let L = cityLabels.get(p.id); const txt = p.st === 'done' ? (ni ? '' : p.name) : p.st === 'now' ? `🚧 ${ni ? '新北・' : ''}${p.name}${ni ? ' 接通工程' : ''} ${Math.floor(p.got / p.cost * 100)}%` : ''; // 蓋好的新島用島名名牌，這裡不另外掛
    if (!txt) { if (L) { L.el.remove(); labels.splice(labels.indexOf(L), 1); cityLabels.delete(p.id); } continue; }
    if (!L) { L = addLabel(txt, new THREE.Vector3(at.x, TOP + 0.95, at.z), 'policy city', '建設', 1.5); cityLabels.set(p.id, L); }
    if (L.txt !== txt) { L.txt = txt; L.el.lastChild.textContent = txt; L.el.classList.toggle('now', p.st === 'now'); L.w = 0; } } }
function updateLabels() { const w = stage.clientWidth, h = stage.clientHeight; const boxes = [];
  for (const L of labels) { const f = L.follow; if (f) L.pos.set(f.pos.x, f.pos.y + (f.down ? 0.3 : 0.66 * f.plan.scale * 0.8 + (f.onBox ? 0.07 : 0)) * lastZoom + 0.03, f.pos.z); L.v.copy(L.pos).project(camera); L.sx = (L.v.x + 1) / 2 * w; L.sy = (1 - L.v.y) / 2 * h; L.vis = L.v.z < 1 && Math.abs(L.v.x) < 1.15 && Math.abs(L.v.y) < 1.15; }
  const order = labels.filter(L => L.vis).sort((a, b) => b.prio - a.prio || a.v.z - b.v.z);
  for (const L of labels) if (!L.vis) L.el.style.display = 'none';
  for (const L of order) { L.el.style.display = ''; if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; } const bx = { x0: L.sx - L.w / 2 - 2, x1: L.sx + L.w / 2 + 2, y0: L.sy - L.h - 2, y1: L.sy + 2 };
    const over = o => bx.x0 < o.x1 && bx.x1 > o.x0 && bx.y0 < o.y1 && bx.y1 > o.y0;
    // 人物名牌彼此不互相隱藏：疊到就移到擋住它的那張上方（最多 10 次），政策標籤再讓位
    if (L.follow) { bx.y0 -= L.sayH || 0; for (let k = 0; k < 10; k++) { const o = boxes.find(q => q.person && over(q)); if (!o) break; const dy = bx.y1 - o.y0 + 1; bx.y0 -= dy; bx.y1 -= dy; L.sy -= dy; } bx.person = true; L.el.classList.remove('hidden'); boxes.push(bx); }
    else { const hit = L.prio < 3 && boxes.some(over); L.el.classList.toggle('hidden', hit); if (!hit) boxes.push(bx); }
    L.el.style.transform = `translate(-50%,-100%) translate(${L.sx.toFixed(1)}px,${L.sy.toFixed(1)}px)`; } }
// 遊戲
const callbacks = {};
// 人物名牌（市長、自己、其他玩家）：DOM 標籤跟著人走，優先權高於政策標籤
const personLabels = new Map();
callbacks.tag = (op, w, t) => { const old = personLabels.get(w); if (old) { old.el.remove(); labels.splice(labels.indexOf(old), 1); personLabels.delete(w); } if (op !== 'add') return;
  const el = document.createElement('div'); el.className = 'nameplate person ' + t.kind; const b = document.createElement('span'); b.className = 'badge'; b.textContent = t.badge; b.style.background = t.color; el.append(b, document.createTextNode(t.name));
  if (t.kind !== 'mayor' && !t.nohp) { const bar = document.createElement('i'); bar.className = 'hpb'; bar.appendChild(document.createElement('b')); el.appendChild(bar); } labelLayer.appendChild(el); // 打工仔名牌底下一條血量（倒下時變成救援進度）
  const L = { el, pos: new THREE.Vector3(), v: new THREE.Vector3(), prio: t.kind === 'mayor' ? 2.8 : t.kind === 'me' ? 2.7 : 2.5, w: 0, h: 0, follow: w }; labels.push(L); personLabels.set(w, L); };
callbacks.tagState = (w, s) => { const L = personLabels.get(w); if (!L) return; const el = L.el; el.classList.toggle('down', !!s.down); el.classList.toggle('carry', !!s.carry); el.classList.toggle('hit', !!s.hit); const b = el.querySelector('.hpb b'); if (b) b.style.width = Math.round(Math.max(0, Math.min(1, s.down ? s.revive : s.hp)) * 100) + '%'; };
// 說話泡泡：掛在名牌上方（市長的政績口號、玩家的表情短句）
callbacks.say = (w, txt, ic) => { const L = personLabels.get(w); if (!L) return; let s = L.el.querySelector('.say'); if (!txt) { if (s) s.remove(); L.sayH = 0; return; } if (!s) { s = document.createElement('span'); s.className = 'say'; L.el.appendChild(s); } s.textContent = ''; if (ic && ICONS[ic]) { const i = document.createElement('span'); i.className = 'ic'; i.innerHTML = ICONS[ic]; s.appendChild(i); } s.appendChild(document.createTextNode(txt)); s.classList.remove('pop'); L.sayH = s.offsetHeight + 9; s.classList.add('pop'); };
const issueById = id => ((window.PIStore && window.PIStore.listIssues()) || C.issues).find(i => i.id === id) || null;
const game = createGame({ scene, graph, nav, centers, people, animals, islands: C.islands, colors, callbacks, issueById });
gameRef = game; game.setStops(policyStops); game.spawnMayor(); people.build([...game.spawnResidents(), game.G.mayor]);
// 逛城市：自己的角色與其他正在逛的人；居民與市長照樣由打工那邊帶著走；名牌與說話泡泡共用
const xCallbacks = { tag: (...a) => callbacks.tag(...a), say: (...a) => callbacks.say(...a) };
// 打工現場：某個打工場岸外的海面（魔王浮在那裡），朝外的方向（dx,dz）與要面向的島心（fx,fz）
const stageSpotCache = new Map();
function stageSpots(sid) { if (stageSpotCache.has(sid)) return stageSpotCache.get(sid); const st = C.stages.find(s => s.id === sid), out = []; if (!st) return out; const bc = centers.get(st.basket), all = [...centers.values()];
  for (const id of st.islands) { if (id === st.basket) continue; const c = centers.get(id); let dx = c.x - bc.x, dz = c.z - bc.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    for (const da of [0, 0.7, -0.7]) { const ax = dx * Math.cos(da) - dz * Math.sin(da), az = dx * Math.sin(da) + dz * Math.cos(da), x = c.x + ax * (R + 1.1), z = c.z + az * (R + 1.1);
      if (nav.walkable(x, z) || all.some(o => o !== c && Math.hypot(o.x - x, o.z - z) < R + 0.6)) continue; out.push({ x, z, dx: ax, dz: az, fx: c.x, fz: c.z }); break; } }
  if (!out.length) out.push({ x: bc.x, z: bc.z + R + 1.1, dx: 0, dz: 1, fx: bc.x, fz: bc.z }); stageSpotCache.set(sid, out); return out; }
const explore = createExplore({ scene, nav, people, centers, animals, callbacks: xCallbacks, rebuild: list => game.setExtraWalkers(list), boutiques: () => BOUTIQUES, site: () => citySite, mayor: () => game.G.mayor, stageSpots });
// 打工場頭上的牌子：「🔴 打工中 2 隊」（只在逛城市時顯示）
const liveLabels = new Map();
// 城市裡打工場頭上的牌子：現在輪到的場一直掛「🥚 現在的打工場」，有人在打就變紅「🔴 打工中 N 隊」
function liveSigns(groups, nowSid) { const want = new Set(groups.keys()); if (nowSid) want.add(nowSid);
  for (const [sid, L] of [...liveLabels]) if (!want.has(sid)) { L.el.remove(); labels.splice(labels.indexOf(L), 1); liveLabels.delete(sid); }
  for (const sid of want) { const st = C.stages.find(s => s.id === sid); if (!st) continue; let L = liveLabels.get(sid); const g = groups.get(sid), now = sid === nowSid;
    const txt = g ? `${now ? '現在的打工場・' : ''}打工中 ${g.n} 隊${g.bosses.length ? `・魔王 ${g.bosses.length} 種` : ''}` : '現在的打工場', icon = g ? '🔴' : '🥚';
    if (!L) { const c = centers.get(st.basket); L = addLabel(txt, new THREE.Vector3(c.x, TOP + 1.7, c.z + C.plaza.basketZ), 'policy live', icon, 2.2); liveLabels.set(sid, L); }
    L.el.classList.toggle('idle', !g); if (L.txt !== txt) { L.txt = txt; L.el.firstChild.textContent = icon; L.el.lastChild.textContent = txt; L.w = 0; } } }
callbacks.speech = m => { if (callbacks.mayorExtra) callbacks.mayorExtra(m); };
// 相機
function fit() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
fit(); window.addEventListener('resize', fit);
const narrow = () => stage.clientWidth < 700;
function overview(instant) { controls.target.copy(center); const d = (narrow() ? 44 : 32) * MAP_K; const pol = THREE.MathUtils.degToRad(50); const to = new THREE.Vector3(center.x + Math.sin(0.08) * Math.sin(pol) * d, center.y + Math.cos(pol) * d, center.z + Math.cos(0.08) * Math.sin(pol) * d); if (instant) camera.position.copy(to); else fly = { from: camera.position.clone(), to, t: 0 }; }
let fly = null; overview(true);
// 打工場全景：把這個場用到的島都框進畫面
function stageView() { const st = game.G.stage; if (!st) { overview(false); return; } stopFollow(); const c = new THREE.Vector3(); for (const id of st.islands) c.add(centers.get(id)); c.divideScalar(st.islands.length); c.y = TOP; let r = 0; for (const id of st.islands) r = Math.max(r, centers.get(id).distanceTo(c)); const d = (r + R + 1) * (narrow() ? 3.1 : 2.3), pol = THREE.MathUtils.degToRad(52);
  controls.target.copy(c); fly = { from: camera.position.clone(), to: new THREE.Vector3(c.x + Math.sin(0.08) * Math.sin(pol) * d, c.y + Math.cos(pol) * d, c.z + Math.cos(0.08) * Math.sin(pol) * d), t: 0 }; }
// 打工場的大廳：鏡頭框住這個場（instant＝直接切過去，不飛）
function frameStage(sid, instant) { const st = C.stages.find(s => s.id === sid); if (!st) { overview(instant); return; } stopFollow(); const c = new THREE.Vector3(); for (const id of st.islands) c.add(centers.get(id)); c.divideScalar(st.islands.length); c.y = TOP; let r = 0; for (const id of st.islands) r = Math.max(r, centers.get(id).distanceTo(c)); const d = (r + R + 1) * (narrow() ? 3.1 : 2.3), pol = THREE.MathUtils.degToRad(52);
  controls.target.copy(c); const to = new THREE.Vector3(c.x + Math.sin(0.08) * Math.sin(pol) * d, c.y + Math.cos(pol) * d, c.z + Math.cos(0.08) * Math.sin(pol) * d); if (instant) { fly = null; camera.position.copy(to); } else fly = { from: camera.position.clone(), to, t: 0 }; }
// 換世界：鏡頭往上穿過雲層、飛到雲海上方（雲海從上面看是不透明的，這時候換世界），在雲上滑到新世界的上空，再往下穿過雲層降落
let flight = null, warping = false; const UP = new THREE.Vector3(0, 1, 0);
const cw = document.getElementById('cloudwipe'), cwText = document.getElementById('cwText');
const wait = ms => new Promise(r => setTimeout(r, ms)), nextFrame = () => new Promise(r => requestAnimationFrame(() => r())), still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 雲海：一大片雲的地板＋一圈雲朵（sprite），平常藏著；材質用畫布畫，第一次換世界才建
const clouds = (() => { let g = null, matF = null; const mats = [], puffs = [];
  const blob = (x, cx, cy, r, col, a) => { const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.55, `rgba(${col},${a * 0.6})`); gr.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); };
  // 雲海地板：灰藍的底、一團團白雲（每團右下有一點陰影，看起來是鼓起來的積雲頂），邊上的也畫到對邊，貼起來沒有接縫
  function floorTex() { const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N; const x = cv.getContext('2d'), rnd = mulberry(5); x.fillStyle = '#cfdbe5'; x.fillRect(0, 0, N, N);
    const wrap = (cx, cy, r, col, a) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) if (Math.abs(cx + dx - N / 2) < N / 2 + r && Math.abs(cy + dy - N / 2) < N / 2 + r) blob(x, cx + dx, cy + dy, r, col, a); };
    for (let i = 0; i < 18; i++) wrap(rnd() * N, rnd() * N, 90 + rnd() * 110, '236,242,247', 0.55); // 大片的明暗起伏
    for (let i = 0; i < 230; i++) { const cx = rnd() * N, cy = rnd() * N, r = 10 + rnd() * 30; wrap(cx + r * 0.3, cy + r * 0.35, r * 1.08, '138,162,184', 0.32); wrap(cx, cy, r, '255,255,255', 0.97); }
    for (let i = 0; i < 90; i++) wrap(rnd() * N, rnd() * N, 5 + rnd() * 9, '255,255,255', 1); // 亮點
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(16, 16); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  // 一朵雲：底部灰藍、上面一顆顆白色的圓頂
  function puffTex() { const W = 256, H = 160, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d'), rnd = mulberry(9);
    for (let i = 0; i < 10; i++) blob(x, 46 + rnd() * 164, 100 + rnd() * 16, 30 + rnd() * 16, '150,172,194', 0.55);
    for (let i = 0; i < 16; i++) { const u = rnd(), cx = 40 + u * 176, cy = 84 - Math.sin(u * Math.PI) * 36 + rnd() * 10, r = 24 + Math.sin(u * Math.PI) * 26 + rnd() * 10; blob(x, cx + r * 0.2, cy + r * 0.3, r, '170,190,210', 0.45); blob(x, cx, cy, r, '255,255,255', 0.97); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
  function make() { g = new THREE.Group(); g.visible = false;
    matF = new THREE.MeshBasicMaterial({ map: floorTex(), transparent: true, opacity: 0, fog: false }); // 地板寫深度：從上面看時雲層下面的 sprite 會被擋住
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), matF); floor.rotation.x = -Math.PI / 2; floor.renderOrder = 20; g.add(floor);
    const tp = puffTex(); for (let k = 0; k < 3; k++) mats.push(new THREE.SpriteMaterial({ map: tp, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    const rnd = mulberry(13); for (let i = 0; i < 90; i++) { const sp = new THREE.Sprite(mats[i % 3]), a = rnd() * Math.PI * 2, r = 4 + Math.sqrt(rnd()) * 64, k = 10 + rnd() * 16;
      sp.position.set(Math.cos(a) * r, -8 + rnd() * 14, Math.sin(a) * r); sp.scale.set(k, k * 0.62, 1); sp.renderOrder = 21; sp.userData = { y0: sp.position.y, w: rnd() * 6 }; g.add(sp); puffs.push(sp); }
    scene.add(g); }
  return { get y() { return g ? g.position.y : 0; },
    show(x, y, z) { if (!g) make(); g.position.set(x, y, z); g.visible = true; },
    hide() { if (g) g.visible = false; },
    // 依鏡頭高度算濃淡：在雲層下面看不到雲，穿過雲層時被雲朵包住，到雲層上面雲海整片不透明
    update(camY, night, t) { if (!g || !g.visible) return; const y = g.position.y, kP = sstep(y - 17, y - 3, camY), kF = sstep(y - 0.5, y + 8, camY), v = 1 - 0.58 * night;
      matF.opacity = kF; matF.color.setRGB(v * 0.97, v * 0.985, Math.min(1, v + 0.06 * night)); mats.forEach((m, i) => { m.opacity = kP * [1, 0.85, 0.7][i]; m.color.copy(matF.color); });
      for (const sp of puffs) sp.position.y = sp.userData.y0 + Math.sin(t * 0.35 + sp.userData.w) * 0.35; } }; })();
// 鏡頭飛一段：位置與目標都內插、照真實時間走；飛行中不讓 OrbitControls 介入（它會把仰角夾在 25° 以上）
const camAt = () => ({ pos: camera.position.clone(), target: controls.target.clone() });
function flyLeg(a, b, dur, ease) { return new Promise(res => { flight = { a, b, t0: performance.now(), dur: dur * 1000, ease, res }; stepFlight(); }); }
function stepFlight() { const f = flight; if (!f) return; const t = Math.min(1, (performance.now() - f.t0) / f.dur), k = f.ease(t);
  controls.target.lerpVectors(f.a.target, f.b.target, k); const oa = f.a.pos.clone().sub(f.a.target), ob = f.b.pos.clone().sub(f.b.target), la = oa.length(), lb = ob.length();
  camera.position.copy(controls.target).addScaledVector(oa.normalize().lerp(ob.normalize(), k).normalize(), la + (lb - la) * k); camera.lookAt(controls.target);
  if (t >= 1) { flight = null; f.res(); } }
const smoothE = t => t * t * (3 - 2 * t), outE = t => 1 - Math.pow(1 - t, 3);
// 雲海上方的位置：目標正上方偏一點（保留原本的方位），高度在雲層上面 alt
function above(target, from, alt) { const off = from.clone().sub(target); off.y = Math.max(off.y, 0.01); const dir = off.normalize().lerp(UP, 0.72).normalize(); return { pos: target.clone().addScaledVector(dir, (alt - target.y) / dir.y), target: target.clone() }; }
// 新世界第一次出現的材質先在雲後面編好 shader，降落時才不會卡一下（最多等 0.6 秒）
const prewarm = () => Promise.race([renderer.compileAsync ? renderer.compileAsync(scene, camera).catch(() => {}) : Promise.resolve(renderer.compile(scene, camera)), wait(600)]);
// opt.covered：一開始畫面就蓋著（重新整理後回訪，從雲端直接降落）；opt.sky：降落得慢一點
async function warp(label, fn, opt = {}) { if (warping) return false; warping = true; cwText.textContent = label; document.body.classList.add('warping'); fly = null; // 名牌先淡出，飛的時候不跟著跳
  const reduce = still(); controls.enabled = false;
  try {
    if (reduce) { // 減少動態：只用霧淡入淡出
      if (!opt.covered) { cw.className = 'cloudwipe'; cw.hidden = false; void cw.offsetWidth; await nextFrame(); cw.className = 'cloudwipe in'; await wait(300); } else { cw.hidden = false; cw.className = 'cloudwipe cover'; }
      await fn(); await prewarm(); await nextFrame(); cw.className = 'cloudwipe out'; await wait(300); return true; }
    let from = camAt();
    if (!opt.covered) { const cy = Math.max(from.target.y + 22, from.pos.y + 8); clouds.show(from.target.x, cy, from.target.z); // 往上穿過雲層
      cw.hidden = false; cw.className = 'cloudwipe fly'; const peak = above(from.target, from.pos, cy + 22); await flyLeg(from, peak, 1.15, smoothE); from = peak; }
    await fn(); fly = null; const to = camAt(); // fn 把鏡頭擺到新世界該在的位置：記下來當降落的終點
    if (opt.covered) { const cy = Math.max(to.target.y + 22, to.pos.y + 8); clouds.show(to.target.x, cy, to.target.z); from = above(to.target, to.pos, cy + 22); cw.hidden = false; cw.className = 'cloudwipe cover'; }
    camera.position.copy(from.pos); controls.target.copy(from.target); camera.lookAt(from.target);
    await prewarm();
    if (opt.covered) { await nextFrame(); cw.className = 'cloudwipe fly'; await wait(450); } // 霧散開，看到的是雲海上方
    const top = above(to.target, to.pos, clouds.y + 22), d = Math.hypot(top.target.x - from.target.x, top.target.z - from.target.z);
    if (d > 0.5) await flyLeg(from, top, Math.min(1.0, Math.max(0.45, d / 30)), smoothE); // 在雲上滑到新世界的上空
    cw.className = 'cloudwipe fly done'; await flyLeg(top, to, opt.sky ? 2.0 : 1.55, outE); // 往下穿過雲層降落
    return true; }
  finally { flight = null; clouds.hide(); controls.enabled = true; cw.className = 'cloudwipe'; cw.hidden = true; warping = false; document.body.classList.remove('warping'); document.body.classList.add('landed'); setTimeout(() => document.body.classList.remove('landed'), 600); } }
// 跟隨鏡頭：鏡頭目標平順追著對象走，保留玩家自己轉的角度與遠近；跟隨中關掉平移，避免和追蹤打架
const FOLLOW = { target: null, kind: null };
function followGetter(kind) { const G = game.G; if (kind === 'mayor') return () => G.mayor && G.mayor.pos; if (kind === 'hero') return () => { const P = game.me(); return P && P.pos; }; if (kind === 'basket') return () => G.basket && new THREE.Vector3(G.basket.x, TOP, G.basket.z); if (kind === 'xme') return () => explore.G.me && explore.G.me.pos; return () => null; }
function startFollow(kind, reset) { const get = followGetter(kind); const p = get(); if (!p) return false; FOLLOW.kind = kind; FOLLOW.target = get; fly = null; controls.enablePan = false; controls.touches = { ...TOUCH_FOLLOW };
  const want = kind === 'mayor' ? (narrow() ? 7.5 : 6) :  narrow() ? C.shift.cameraDistNarrow : C.shift.cameraDist; let off = camera.position.clone().sub(controls.target);
  if (reset) { const pol = THREE.MathUtils.degToRad(C.shift.cameraPolar); off = new THREE.Vector3(Math.sin(0.08) * Math.sin(pol), Math.cos(pol), Math.cos(0.08) * Math.sin(pol)); }
  off.setLength(want); controls.target.copy(p).setY(p.y + C.follow.lookUp); camera.position.copy(controls.target).add(off); return true; }
function stopFollow() { FOLLOW.kind = null; FOLLOW.target = null; controls.enablePan = true; controls.touches = { ...TOUCH_MAP }; }
function updateFollow(dt) { if (!FOLLOW.target) return; const p = FOLLOW.target(); if (!p) { stopFollow(); callbacks.follow && callbacks.follow(null); return; }
  const want = p.clone(); want.y += C.follow.lookUp; const k = 1 - Math.exp(-dt * C.follow.stiffness); const next = controls.target.clone().lerp(want, k); const delta = next.clone().sub(controls.target); controls.target.copy(next); camera.position.add(delta); }
// 鍵盤（WASD／方向鍵）與手機搖桿：依鏡頭方向換算成地圖上的移動方向
const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' }; const keys = new Set(), stick = { x: 0, y: 0 };
addEventListener('keydown', e => { const k = KEYMAP[e.code]; if (!k || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || (game.G.phase === 'lobby' && !explore.G.on)) return; keys.add(k); e.preventDefault(); });
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys.delete(k); }); addEventListener('blur', () => keys.clear());
const fwd = new THREE.Vector3();
function applyInput() { const mover = explore.G.on ? explore : game; let fx = stick.y, rx = stick.x; if (keys.has('f')) fx += 1; if (keys.has('b')) fx -= 1; if (keys.has('r')) rx += 1; if (keys.has('l')) rx -= 1; const L = Math.hypot(fx, rx); if (L < 0.01) { mover.setMove(0, 0); return; } if (L > 1) { fx /= L; rx /= L; }
  fwd.copy(controls.target).sub(camera.position).setY(0).normalize(); mover.setMove(fwd.x * fx - fwd.z * rx, fwd.z * fx + fwd.x * rx); }
// 點擊：開工中點敵人＝鎖定、點地面＝走過去；大廳時點政策建築或市長開政策卡
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 6) return;
  const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (explore.G.on) { const rh = ray.intersectObjects(explore.remoteHits, false); if (rh.length) { const id = rh[0].object.userData.remoteId; xCallbacks.remote && xCallbacks.remote(id, explore.G.remotes.get(id)); return; } }
  if (game.G.phase !== 'lobby') { const eh = ray.intersectObjects(game.enemyHits, false); if (eh.length) { game.onPick({ enemy: eh[0].object.userData.enemy }); return; } const th = ray.intersectObjects(tops, false); if (th.length) game.onPick({ point: th[0].point }); return; }
  // 觸控裝置上政策標籤不吃指標事件（才能從標籤上開始拖地圖），點擊改在這裡用位置判斷
  const lh = policyLabels.find(L => L.el.style.display !== 'none' && !L.el.classList.contains('hidden') && (b => e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom + 6)(L.el.getBoundingClientRect())); if (lh) { callbacks.card && callbacks.card(lh.st.pol, lh.st.island); return; }
  const M = game.G.mayor; if (M && ray.intersectObject(M.hit, false).length) { const st = M.current || policyStops[M.stop % policyStops.length]; if (st) callbacks.card(st.pol, st.island); return; } const ph = ray.intersectObjects(policyMeshes, false); if (ph.length && ph[0].object.userData.owners) { const id = ph[0].object.userData.owners[ph[0].instanceId]; if (id && policyById.has(id)) { callbacks.card && callbacks.card(policyById.get(id), policyIsland.get(id)); return; } }
  if (explore.G.on) { const th = ray.intersectObjects(tops, false); if (th.length) explore.moveTo(th[0].point.x, th[0].point.z); } }); // 逛城市：點地板走過去
// UI
function flyTo(islandId) { const c = centers.get(islandId); if (!c) return; controls.target.copy(c); const pol = THREE.MathUtils.degToRad(48), d = narrow() ? 13 : 10; fly = { from: camera.position.clone(), to: new THREE.Vector3(c.x + Math.sin(0.3) * Math.sin(pol) * d, c.y + Math.cos(pol) * d, c.z + Math.cos(0.3) * Math.sin(pol) * d), t: 0 }; }
// 鳥瞰：鏡頭到城市中心正上方往下看；關掉就回到跟著自己
function bird(on) { if (on) { stopFollow(); controls.target.copy(center); fly = { from: camera.position.clone(), to: center.clone().add(new THREE.Vector3(0.01, C.explore.birdHeight, C.explore.birdBack)), t: 0 }; } else if (explore.G.on) startFollow('xme', true); else overview(false); }
const policyPos = id => { const st = policyStops.find(x => x.pol.id === id); return st && { x: st.pos.x, z: st.pos.z }; };
const ui = createUI({ game, explore, xCallbacks, placeCity, bird, policyPos, warp, frameStage, liveSigns, stageCenter: sid => { const st = C.stages.find(s => s.id === sid); const c = st && centers.get(st.basket); return c && { x: c.x, z: c.z + C.plaza.basketZ }; }, callbacks, overview: () => { stopFollow(); overview(false); }, stageView, flyTo: (id) => { stopFollow(); flyTo(id); }, placePolicies, islandOf: id => policyIsland.get(id), setDistrictRanks, renderer,
  follow: { start: startFollow, stop: stopFollow, get kind() { return FOLLOW.kind; } }, input: { stick, clear: () => { keys.clear(); stick.x = stick.y = 0; }, aim: () => { fwd.copy(controls.target).sub(camera.position).setY(0).normalize(); return [fwd.x, fwd.z]; } } });
// 迴圈：天色與霧跟著波次（一般波早→午→下午、暴走夜是晚上、起大霧時霧拉近）
let last = performance.now(), acc = 0, lastZoom = 1, dayMin = 720, fogNear = scene.fog.near, fogFar = scene.fog.far; const G = game.G; const FOG0 = [scene.fog.near, scene.fog.far];
function frame(now) { const raw = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  applyInput(); if (!G.paused) { const sub = Math.ceil(raw / 0.025); for (let i = 0; i < sub; i++) game.step(raw / sub); }
  if (explore.G.on) explore.step(raw);
  const zoomK = Math.min(1.7, Math.max(1, camera.position.distanceTo(controls.target) / 15)); lastZoom = zoomK; game.view(raw, t, zoomK); explore.view(raw, env.night, ui.shop.festival()); people.update(raw, t, zoomK); env.update(raw); GLOW.emissiveIntensity = GLOW_GHOST.emissiveIntensity = env.night * 3.2; // 晚上窗戶與燈亮起來
  const shift = G.phase !== 'lobby', XG = explore.G, wantMin = XG.on ? XG.clock : !shift ? 720 : G.special === 'rush' ? C.shift.rush.time : C.shift.dayTimes[Math.max(0, Math.min(2, G.waveNo - 1))]; if (XG.on && !XG.tween) dayMin = XG.clock; else { let d = wantMin - dayMin; if (XG.on) d = ((d % 1440) + 2160) % 1440 - 720; dayMin = (((dayMin + d * Math.min(1, raw * (XG.on ? 2.5 : 1.2))) % 1440) + 1440) % 1440; if (XG.on && Math.abs(d) < 2) { XG.tween = false; dayMin = XG.clock; } } env.setTime(dayMin); // 逛城市：時鐘照走，按時段時平順轉過去
  const fog = shift && G.special === 'fog'; fogNear += ((fog ? C.shift.fog.near : FOG0[0]) - fogNear) * Math.min(1, raw * 1.5); fogFar += ((fog ? C.shift.fog.far : FOG0[1]) - fogFar) * Math.min(1, raw * 1.5); scene.fog.near = fogNear; scene.fog.far = fogFar;
  if (fly) { fly.t = Math.min(1, fly.t + raw * 1.2); const k = fly.t * fly.t * (3 - 2 * fly.t); camera.position.lerpVectors(fly.from, fly.to, k); if (fly.t >= 1) fly = null; }
  if (flight) stepFlight(); else if (!warping) { updateFollow(raw); controls.update(); } clouds.update(camera.position.y, env.night, t); // 換世界時鏡頭歸飛行管（兩段之間停著不動）
  { const me = G.phase !== 'lobby' && FOLLOW.kind === 'hero' ? game.me() : FOLLOW.kind === 'xme' ? explore.G.me : null, on = me ? 1 : 0; // 擋住自己的建築變半透明（腰部以上、鏡頭到自己的圓錐裡）
    if (CUT.uCutOn.value !== on) { CUT.uCutOn.value = on; setCutVisible(on); } if (me) { CUT.uCutA.value.copy(camera.position); CUT.uCutB.value.set(me.pos.x, me.pos.y + 0.3, me.pos.z); CUT.uCutY.value = me.pos.y + 0.32; } }
  renderer.render(scene, camera); if (!warping) updateLabels(); // 換世界途中名牌藏著不用排
  acc += raw; if (acc > 0.2) { acc = 0; ui.tick(); }
  requestAnimationFrame(frame); }
requestAnimationFrame(frame);
{ const ld = document.getElementById('loading'); if (ld) requestAnimationFrame(() => requestAnimationFrame(() => { ld.classList.add('done'); setTimeout(() => ld.remove(), 450); })); } // 第一幀畫完再收掉載入畫面
window.PI = { game, explore, nav, layout: LAYOUT, cityPos: CITY_POS, boutiques: BOUTIQUES, people, scene, camera, controls, graph, centers, ui, get policies() { return policyById; }, get policyIsland() { return policyIsland; }, pickPolicy: id => callbacks.card(policyById.get(id), policyIsland.get(id)), get flightInfo() { return { flying: !!flight, warping, camY: +camera.position.y.toFixed(2), cloudY: +clouds.y.toFixed(2) }; } }; // 除錯用
