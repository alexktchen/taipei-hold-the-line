/* 進入點：建場景、島、建築、同學、動物、闖關遊戲、逛校園與 UI；鏡頭（跟隨、鳥瞰）、鍵盤／搖桿輸入、點擊；天色；主迴圈。 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG as C } from './config.js';
import { createEnvironment } from './env.js';
import { buildIslands, buildGraph, slotLayout, buildCampusZone, axialToWorld, TOP, R, H, RING_H, MAP_K, SIZE_K, NEIGHBORS } from './islands.js';
import { createProgress } from './progress.js';
import { createKit, createModels, GLOW, GLOW_GHOST, CUT, setCutVisible } from './buildings.js';
import { createPeople } from './people.js';
import { createAnimals } from './animals.js';
import { createGame } from './game.js';
import { createExplore } from './explore.js';
import { createNav } from './nav.js';
import { ICONS } from './icons.js';
import { createUI } from './ui.js';
import { mulberry } from './env.js';
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
// 草原小鎮與建築
const kit = createKit(TOP);
const CAMPUS = C.econ.city.filter(p => p.kind === 'island'); // 蓋校園的新校區：一開始是野地，蓋好才變成區塊
const world = buildIslands(scene, C.islands, kit, colors, CAMPUS, () => createKit(TOP));
const { centers, neighbors, views, tops, links, bridges, gates, cells } = world;
const center = new THREE.Vector3(); for (const c of centers.values()) center.add(c); center.divideScalar(centers.size); center.y = TOP;
const model = createModels(kit, colors); const rnd = mulberry(5);
// 每個區塊 8 個槽位：前 3 個給課程建築（動態），後 5 個放小房子（靜態）
const POLICY_SLOTS = 3, LAYOUT = new Map(), STATIC_OBST = [], CITY_POS = new Map(), BOUTIQUES = []; // BOUTIQUES：逛校園的服飾店；STATIC_OBST：不能穿過的建築（地標、小房子），課程建築另外動態加
const PZ = C.plaza;
const TREE_STYLE = { forest: 'conifer', garden: 'blossom', softpad: 'round', boardwalk: 'round', rubber: 'round', street: 'round', courtyard: 'blossom', meadow: 'willow', lawn: 'round', granite: 'round', terracotta: 'round', schoolyard: 'round', gravel: 'round' };
const FARM = new Set(['gravel', 'boardwalk', 'courtyard']); // 泥土地的區塊是牧場：牛、羊、牧草地
// 區塊的散景：步道環外圈一圈樹與花草（門口留路）、環內空地放田地與牧場小物；沒有廣場的區塊前方中間放池塘或牧場
function decorateZone(isl, c, lay, k, m, r, occ) { const style = TREE_STYLE[isl.ground] || 'round', free = (x, z, rr) => occ.every(([ox, oz, orr]) => Math.hypot(x - ox, z - oz) > rr + orr);
  const gateSide = NEIGHBORS.map(([dq, dr]) => gates.some(g => (g.a === isl.id || g.b === isl.id) && Math.sign(Math.round(g.x - c.x)) === dq && Math.sign(Math.round(g.z - c.z)) === dr));
  const band = (RING_H + H) / 2 + 0.05, BAND = ['tree', 'bush', 'flowers', 'tree', 'hay', 'flowers', 'tree', 'barrel', 'bush', 'tree', 'flowers', 'stump'];
  NEIGHBORS.forEach(([dq, dr], s) => { for (let t = -RING_H + 0.5, n = 0; t <= RING_H - 0.5; t += 0.72 + r() * 0.25, n++) { if (gateSide[s] && Math.abs(t) < 0.85) continue; const x = dq ? dq * band : t, z = dr ? dr * band : t; const kind = BAND[(n + s * 3 + isl.number) % BAND.length];
      if (kind === 'tree') k.tree(c.x + x, c.z + z, 0.36 + r() * 0.16, n + isl.number, style); else m(kind, c.x + x, c.z + z, 0.55, n + isl.number); } });
  if (!isl.plaza) { const fx = 0, fz = 1.5; occ.push([fx, fz, 1.0]); if (FARM.has(isl.ground)) { m('paddock', c.x + fx, c.z + fz, 1.2, isl.number); } else m('pond', c.x + fx, c.z + fz, 1.1, isl.number); }
  const MIX = FARM.has(isl.ground) ? ['field', 'hay', 'cow', 'field', 'sheep', 'scarecrow', 'well', 'barrel', 'crate', 'field', 'sheep', 'flowers'] : ['tree', 'field', 'flowers', 'bench', 'scarecrow', 'well', 'tree', 'flowers', 'crate', 'signpost', 'field', 'bush'];
  let placed = 0; for (let tries = 0; tries < 600 && placed < 14; tries++) { const lx = (r() - 0.5) * (RING_H - 0.45) * 2, lz = (r() - 0.5) * (RING_H - 0.45) * 2; const t = MIX[tries % MIX.length];
    const rr = t === 'tree' ? 0.3 : t === 'field' ? 0.4 : t === 'cow' || t === 'sheep' ? 0.25 : t === 'bench' || t === 'well' || t === 'scarecrow' ? 0.22 : 0.15; if (!free(lx, lz, rr)) continue; occ.push([lx, lz, rr]);
    if (t === 'tree') k.tree(c.x + lx, c.z + lz, 0.34 + r() * 0.2, placed + isl.number, style); else m(t, c.x + lx, c.z + lz, t === 'field' ? 0.75 : 0.6, placed + isl.number); placed++; } }
for (const isl of C.islands) { const c = centers.get(isl.id); const lay = slotLayout(8); LAYOUT.set(isl.id, lay);
  const occ = [[0, lay.heroZ, 0.95 * SIZE_K], ...lay.slots.map(([x, z]) => [x, z, lay.size * 0.62]), ...(isl.plaza ? [[0, PZ.basketZ, 1.15], [0, PZ.basketZ + 1.4, 0.4]] : [])];
  model(isl.landmark, c.x, c.z + lay.heroZ, 1.18 * SIZE_K, isl.number); STATIC_OBST.push([c.x, c.z + lay.heroZ, 0.42 * SIZE_K]);
  lay.slots.slice(POLICY_SLOTS).forEach(([sx, sz], i) => { const bq = C.explore.boutiques.some(([id, h]) => id === isl.id && h === i), kind = bq ? 'shop' : ['house', 'house2', 'shop', 'house', 'house2'][i % 5], cp = C.econ.city.find(p => p.island === isl.id && p.house === i); // 蓋校園的位置先空著，由 placeCity 決定放小房子、工地或蓋好的建築
    if (cp) CITY_POS.set(cp.id, { x: c.x + sx, z: c.z + sz, size: lay.size, kind, seed: isl.number * 3 + i }); else model(kind, c.x + sx, c.z + sz, lay.size * 1.05, isl.number * 3 + i); STATIC_OBST.push([c.x + sx, c.z + sz, lay.size * 0.38]);
    if (bq && !cp) BOUTIQUES.push({ x: c.x + sx, z: c.z + sz, island: isl.id }); });
  decorateZone(isl, c, lay, kit, model, rnd, occ); }
// 新校區：位置照 config 的格子；蓋的時候在野地上搭工地，蓋好變成區塊、門打開（placeCity）
const NEW_ISLES = new Map(CAMPUS.map(p => [p.id, { p, c: axialToWorld(...p.grid) }]));
for (const k of world.wildKits.values()) k.build(scene);
kit.build(scene);
const env = createEnvironment(scene, { center, quality }); env.setTime(720); for (const m of world.rivers) m.material = env.waterMat;
const graph = buildGraph(C.islands, centers, neighbors, links, gates);
const nav = createNav({ islands: C.islands, centers, gates, graph, cells }); nav.setObstacles(STATIC_OBST, []);
// ── 場景解鎖：鎖住的學期，門關著、門口掛「🔒」牌子寫要在哪裡答對幾題；解鎖後門打開（進度記在裝置上，progress.js）──
const gateLabels = new Map(); const islName = id => (C.islands.find(i => i.id === id) || CAMPUS.find(p => p.id === id) || {}).name || id;
let unlockedNow = [], unlockT = 0; // 一次解鎖好幾個學期時，公告合在一起
const progress = createProgress({ islands: C.islands, neighbors, onUnlock: id => { unlockedNow.push(islName(id)); clearTimeout(unlockT); unlockT = setTimeout(() => { refreshGates(); callbacks.banner && callbacks.banner(`🔓 解鎖新場景：${unlockedNow.join('、')}！`, 3.5); unlockedNow = []; }, 0); } });
const gkit = { k: null };
// 門扇：關著＝兩片木門擋住門口（中間一塊黃色鎖牌）；開著＝兩片門往兩邊打開
function gateDoors(k, g, open) { const along = g.axis === 'z' ? [1, 0] : [0, 1], across = [along[1], along[0]], yaw = g.axis === 'z' ? 0 : Math.PI / 2; const w = g.river ? 0.7 : 0.48;
  for (const sg of [-1, 1]) { let x, z, ry = yaw, dir = along; if (!open) { x = g.x + along[0] * sg * w / 2; z = g.z + along[1] * sg * w / 2; } else { x = g.x + along[0] * sg * (w + 0.03) + across[0] * w / 2; z = g.z + along[1] * sg * (w + 0.03) + across[1] * w / 2; ry = yaw + Math.PI / 2; dir = across; }
    k.hbox(x, TOP + 0.2, z, w, 0.04, 0.035, 0xb48560, null, [0, ry, 0]); k.hbox(x, TOP + 0.07, z, w, 0.04, 0.035, 0xb48560, null, [0, ry, 0]); for (const t of [-0.4, 0, 0.4]) k.hbox(x + dir[0] * t * w, TOP + 0.14, z + dir[1] * t * w, 0.05, 0.22, 0.04, 0xa07550, null, [0, ry, 0]); }
  if (!open) { k.hbox(g.x, TOP + 0.18, g.z, 0.14, 0.12, 0.07, 0xf2c14e, null, [0, yaw, 0]); k.part('torus', [g.x, TOP + 0.26, g.z], [0.05, 0.05, 0.05], 0x6a665f, [0, yaw, 0]); } }
function refreshGates() { if (gkit.k) gkit.k.dispose(scene); const k = createKit(TOP); gkit.k = k;
  for (const b of gates) { const open = progress.isUnlocked(b.a) && progress.isUnlocked(b.b); nav.setBridgeOpen(b.a, b.b, open); gateDoors(k, b, open); const key = b.key;
    const far = open ? null : progress.isUnlocked(b.a) ? b.b : progress.isUnlocked(b.b) ? b.a : null; const camp = far && NEW_ISLES.has(far); const h = far && !camp && progress.hint(far);
    const txt = !far ? '' : camp ? `🚧 ${islName(far)}・全站一起投金蛋蓋好就開` : `🔒 ${islName(far)}${h ? `・在${islName(h.by)}答對 ${h.need} 題（${Math.min(h.have, h.need)}／${h.need}）` : ''}`;
    let L = gateLabels.get(key); if (!txt) { if (L) { L.el.remove(); labels.splice(labels.indexOf(L), 1); gateLabels.delete(key); } continue; } if (!L) { L = addLabel(txt, new THREE.Vector3(b.x, TOP + 0.55, b.z), 'policy gate', '', 2); gateLabels.set(key, L); } if (L.txt !== txt) { L.txt = txt; L.el.lastChild.textContent = txt; L.w = 0; } }
  k.build(scene); }

// 課程建築：有指定學期就放該區，沒有就依 id 雜湊隨機落島；清單改變時整批重建
const pkit = createKit(TOP); const pmodel = createModels(pkit, colors); let policyMeshes = [], policyById = new Map(), policyIsland = new Map(), policyStops = [], gameRef = null, labelsReady = false;
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
function placePolicies(list) { pkit.dispose(scene); policyById = new Map(); policyIsland = new Map(); policyStops = []; const dyn = []; const used = new Map(C.islands.map(i => [i.id, 0])); const ids = C.islands.map(i => i.id);
  const pick = (pol) => { let idx = pol.district && ids.includes(pol.district) ? ids.indexOf(pol.district) : hash(pol.id) % ids.length; for (let k = 0; k < ids.length; k++) { const id = ids[(idx + k) % ids.length]; if (used.get(id) < POLICY_SLOTS) return id; } return ids[idx]; };
  for (const pol of list) { const islId = pick(pol); const n = used.get(islId); used.set(islId, n + 1); const c = centers.get(islId), lay = LAYOUT.get(islId); const [sx, sz] = lay.slots[Math.min(n, POLICY_SLOTS - 1)]; pkit.owner = pol.id; pmodel(pol.model || 'kiosk', c.x + sx, c.z + sz, lay.size * 1.08, hash(pol.id) % 7); dyn.push([c.x + sx, c.z + sz, lay.size * 0.4]); policyById.set(pol.id, pol); policyIsland.set(pol.id, islId); policyStops.push({ pol, island: islId, order: C.islands.find(i => i.id === islId).number, pos: new THREE.Vector3(c.x + sx, TOP, c.z + sz) }); }
  pkit.owner = null; policyMeshes = pkit.build(scene); nav.setObstacles(null, dyn); if (gameRef) gameRef.setStops(policyStops); if (labelsReady) refreshPolicyLabels(); }
placePolicies(C.policies);
const people = createPeople(scene, colors, C.heroes, C.econ.outfits); const animals = createAnimals(scene, C.animals, { chantSize: C.chant.size });
// 名牌（DOM，螢幕固定大小，每幀投影）：課程標籤為主、可點；學期只是淡淡的地面字；重疊時優先顯示前面的
const labelLayer = document.getElementById('labels'); const labels = [];
function addLabel(txt, pos, cls, num, prio = 1) { const el = document.createElement('div'); el.className = 'nameplate ' + (cls || ''); if (num) { const em = document.createElement('em'); em.textContent = num; el.appendChild(em); } el.appendChild(document.createTextNode(txt)); labelLayer.appendChild(el); const L = { el, pos: pos.clone(), v: new THREE.Vector3(), prio, w: 0, h: 0 }; labels.push(L); return L; }
const districtLabels = new Map();
for (const isl of C.islands) { const c = centers.get(isl.id); if (isl.goal) addLabel(C.goalLabel, c.clone().setY(TOP + 2.4), 'goal', '', 3); districtLabels.set(isl.id, addLabel(isl.name, c.clone().add(new THREE.Vector3(0, 0, H * 0.86)).setY(TOP), 'district', '', 0)); }
// 學期對抗：地上的區名後面掛名次（有戰績才掛），自己選的區換珊瑚色
function setDistrictRanks(board, mine) { const rank = new Map(board.filter(r => r.kills > 0).map((r, i) => [r.id, i + 1]));
  for (const [id, L] of districtLabels) { const isl = C.islands.find(i => i.id === id), n = rank.get(id); L.el.textContent = isl.name; if (n) { const b = document.createElement('span'); b.className = 'rk' + (n === 1 ? ' top' : ''); b.textContent = `第${n}`; L.el.appendChild(b); } L.el.classList.toggle('mine', id === mine); L.w = 0; } }
let policyLabels = [];
function refreshPolicyLabels() { for (const L of policyLabels) { L.el.remove(); const i = labels.indexOf(L); if (i >= 0) labels.splice(i, 1); } policyLabels = [];
  for (const st of policyStops) { const L = addLabel(st.pol.title, st.pos.clone().setY(TOP + 0.95), 'policy', st.pol.tag || '', 2); L.st = st; L.el.addEventListener('click', () => callbacks.card && callbacks.card(st.pol, st.island)); policyLabels.push(L); } }
labelsReady = true; refreshPolicyLabels();
// 蓋校園（金蛋商店）：還沒輪到＝原本的小房子、正在蓋＝工地、蓋好＝新建築；名牌寫名稱與進度
const ckit = createKit(TOP), cmodel = createModels(ckit, colors); let citySig = '', citySite = null; const cityLabels = new Map();
for (const b of BOUTIQUES) addLabel('👕 服飾店', new THREE.Vector3(b.x, TOP + 0.9, b.z), 'policy shopsign', '', 1.6); // 只在逛校園時顯示
// 新校區：蓋的時候在野地上搭工地（跟著進度多一些材料），投金蛋的地點在要接的那個區塊的門口；蓋好時野地拿掉、變成新的區塊、門打開
const isleSites = new Map(), isleBuilt = new Set();
function shoreOf(n) { const g = gates.find(g => g.campus && (g.a === n.p.id || g.b === n.p.id)); const l = centers.get(n.p.link); if (!g || !l) return null; const dx = Math.sign(Math.round(l.x - g.x)), dz = Math.sign(Math.round(l.z - g.z)); return { x: g.x + dx * 0.9, z: g.z + dz * 0.9 }; }
function reclaim(p) { const n = NEW_ISLES.get(p.id), pct = Math.max(0, Math.min(1, p.got / p.cost)), bucket = Math.floor(pct * 5); let g = isleSites.get(p.id); if (g && g.bucket === bucket) return; if (g) g.kit.dispose(scene);
  const k = createKit(TOP), m = createModels(k, colors), c = n.c; const site = shoreOf(n), dx = site ? Math.sign(Math.round(site.x - c.x)) : 0, dz = site ? Math.sign(Math.round(site.z - c.z)) : 1;
  const ox = c.x + dx * (H - 1.6), oz = c.z + dz * (H - 1.6); m('crane', ox, oz, 1.3, 3); if (bucket >= 1) m('scaffold', ox + (dz ? 1.3 : 0), oz + (dx ? 1.3 : 0), 0.9, 2); if (bucket >= 2) m('crate', ox - (dz ? 1.2 : 0), oz - (dx ? 1.2 : 0), 0.8, 1); if (bucket >= 3) m('hoarding', ox - dx * 1.1, oz - dz * 1.1, 1.0, 4); if (bucket >= 4) m('blueprint', ox + (dz ? 0.6 : -dx * 1.0), oz + (dx ? 0.6 : -dz * 1.0), 0.7, 5);
  k.build(scene); isleSites.set(p.id, { kit: k, bucket }); }
function growIsland(id) { if (isleBuilt.has(id)) return; isleBuilt.add(id); const n = NEW_ISLES.get(id), s = isleSites.get(id); if (s) { s.kit.dispose(scene); isleSites.delete(id); } const wk = world.wildKits.get(id); if (wk) { wk.dispose(scene); world.wildKits.delete(id); }
  const k = createKit(TOP), m = createModels(k, colors), c = n.c; buildCampusZone(scene, k, n.p, c, world); const lz = -1.45, isl = { id, number: 20 + id.length, ground: n.p.ground, plaza: false }; const lay = slotLayout(8);
  m(n.p.landmark, c.x, c.z + lz, 1.18 * SIZE_K, 7); const occ = [[0, lz, 0.95 * SIZE_K]]; decorateZone(isl, c, lay, k, m, mulberry(id.length * 13), occ);
  k.build(scene); centers.set(id, c); stageSpotCache.clear();
  nav.addIsland(id, c, n.p.grid, [[c.x, c.z + lz, 0.42 * SIZE_K]]); progress.addExtra(id); refreshGates();
  addLabel(n.p.name, c.clone().add(new THREE.Vector3(0, 0, H * 0.86)).setY(TOP), 'district newland', '新校區', 0); }
function placeCity(list) { for (const p of list) if (p.kind === 'island') { if (p.st === 'done') growIsland(p.id); else if (p.st === 'now') reclaim(p); }
  const now = list.find(p => p.st === 'now'), isle = now && NEW_ISLES.get(now.id), shore = isle && shoreOf(isle), at = now && (shore || CITY_POS.get(now.id)); citySite = at ? { id: now.id, name: now.name, x: at.x, z: at.z } : null; const sig = list.map(p => p.st).join(','); if (sig !== citySig) { citySig = sig; ckit.dispose(scene);
    for (const p of list) { const at = CITY_POS.get(p.id); if (!at) continue; cmodel(p.st === 'done' ? p.model : p.st === 'now' ? 'crane' : at.kind, at.x, at.z, at.size * 1.05, at.seed); }
    ckit.build(scene); }
  for (const p of list) { const ni = NEW_ISLES.get(p.id), at = ni ? { x: ni.c.x, z: ni.c.z } : CITY_POS.get(p.id); if (!at) continue; let L = cityLabels.get(p.id); const txt = p.st === 'done' ? (ni ? '' : p.name) : p.st === 'now' ? `🚧 ${ni ? '新校區・' : ''}${p.name}${ni ? ' 開發中' : ''} ${Math.floor(p.got / p.cost * 100)}%` : ''; // 蓋好的新島用島名名牌，這裡不另外掛
    if (!txt) { if (L) { L.el.remove(); labels.splice(labels.indexOf(L), 1); cityLabels.delete(p.id); } continue; }
    if (!L) { L = addLabel(txt, new THREE.Vector3(at.x, TOP + 0.95, at.z), 'policy city', '建設', 1.5); cityLabels.set(p.id, L); }
    if (L.txt !== txt) { L.txt = txt; L.el.lastChild.textContent = txt; L.el.classList.toggle('now', p.st === 'now'); L.w = 0; } } }
function updateLabels() { const w = stage.clientWidth, h = stage.clientHeight; const boxes = [];
  for (const L of labels) { const f = L.follow; if (f) L.pos.set(f.pos.x, f.pos.y + (f.down ? 0.3 : 0.66 * f.plan.scale * 0.8 + (f.onBox ? 0.07 : 0)) * lastZoom + 0.03, f.pos.z); L.v.copy(L.pos).project(camera); L.sx = (L.v.x + 1) / 2 * w; L.sy = (1 - L.v.y) / 2 * h; L.vis = L.v.z < 1 && Math.abs(L.v.x) < 1.15 && Math.abs(L.v.y) < 1.15; }
  const order = labels.filter(L => L.vis).sort((a, b) => b.prio - a.prio || a.v.z - b.v.z);
  for (const L of labels) if (!L.vis) L.el.style.display = 'none';
  for (const L of order) { L.el.style.display = ''; if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; } const bx = { x0: L.sx - L.w / 2 - 2, x1: L.sx + L.w / 2 + 2, y0: L.sy - L.h - 2, y1: L.sy + 2 };
    const over = o => bx.x0 < o.x1 && bx.x1 > o.x0 && bx.y0 < o.y1 && bx.y1 > o.y0;
    // 人物名牌彼此不互相隱藏：疊到就移到擋住它的那張上方（最多 10 次），課程標籤再讓位
    if (L.follow) { bx.y0 -= L.sayH || 0; for (let k = 0; k < 10; k++) { const o = boxes.find(q => q.person && over(q)); if (!o) break; const dy = bx.y1 - o.y0 + 1; bx.y0 -= dy; bx.y1 -= dy; L.sy -= dy; } bx.person = true; L.el.classList.remove('hidden'); boxes.push(bx); }
    else { const hit = L.prio < 3 && boxes.some(over); L.el.classList.toggle('hidden', hit); if (!hit) boxes.push(bx); }
    L.el.style.transform = `translate(-50%,-100%) translate(${L.sx.toFixed(1)}px,${L.sy.toFixed(1)}px)`; } }
// 遊戲
const callbacks = {};
// 人物名牌（校長、自己、其他玩家）：DOM 標籤跟著人走，優先權高於課程標籤
const personLabels = new Map();
callbacks.tag = (op, w, t) => { const old = personLabels.get(w); if (old) { old.el.remove(); labels.splice(labels.indexOf(old), 1); personLabels.delete(w); } if (op !== 'add') return;
  const el = document.createElement('div'); el.className = 'nameplate person ' + t.kind; const b = document.createElement('span'); b.className = 'badge'; b.textContent = t.badge; b.style.background = t.color; el.append(b, document.createTextNode(t.name));
  if (t.kind !== 'mayor' && !t.nohp) { const bar = document.createElement('i'); bar.className = 'hpb'; bar.appendChild(document.createElement('b')); el.appendChild(bar); } labelLayer.appendChild(el); // 小學生名牌底下一條血量（倒下時變成救援進度）
  const L = { el, pos: new THREE.Vector3(), v: new THREE.Vector3(), prio: t.kind === 'mayor' ? 2.8 : t.kind === 'me' ? 2.7 : 2.5, w: 0, h: 0, follow: w }; labels.push(L); personLabels.set(w, L); };
callbacks.tagState = (w, s) => { const L = personLabels.get(w); if (!L) return; const el = L.el; el.classList.toggle('down', !!s.down); el.classList.toggle('carry', !!s.carry); el.classList.toggle('hit', !!s.hit); const b = el.querySelector('.hpb b'); if (b) b.style.width = Math.round(Math.max(0, Math.min(1, s.down ? s.revive : s.hp)) * 100) + '%'; };
// 說話泡泡：掛在名牌上方（校長的政績口號、玩家的表情短句）
callbacks.say = (w, txt, ic) => { const L = personLabels.get(w); if (!L) return; let s = L.el.querySelector('.say'); if (!txt) { if (s) s.remove(); L.sayH = 0; return; } if (!s) { s = document.createElement('span'); s.className = 'say'; L.el.appendChild(s); } s.textContent = ''; if (ic && ICONS[ic]) { const i = document.createElement('span'); i.className = 'ic'; i.innerHTML = ICONS[ic]; s.appendChild(i); } s.appendChild(document.createTextNode(txt)); s.classList.remove('pop'); L.sayH = s.offsetHeight + 9; s.classList.add('pop'); };
const issueById = id => ((window.PIStore && window.PIStore.listIssues()) || C.issues).find(i => i.id === id) || null;
const game = createGame({ scene, graph, nav, centers, people, animals, islands: C.islands, colors, callbacks, issueById });
gameRef = game; game.setStops(policyStops); game.spawnMayor(); people.build([...game.spawnResidents(), game.G.mayor]);
// 逛校園：自己的角色與其他正在逛的人；同學與校長照樣由闖關那邊帶著走；名牌與說話泡泡共用
const xCallbacks = { tag: (...a) => callbacks.tag(...a), say: (...a) => callbacks.say(...a) };
// 闖關現場：某個闖關場岸外的海面（魔王浮在那裡），朝外的方向（dx,dz）與要面向的島心（fx,fz）
const stageSpotCache = new Map();
function stageSpots(sid) { if (stageSpotCache.has(sid)) return stageSpotCache.get(sid); const st = C.stages.find(s => s.id === sid), out = []; if (!st) return out; const c = centers.get(st.basket); if (!c) return out;
  for (const [x, z, dx] of [[-1.7, 2.6, -1], [1.7, 2.6, 1], [0, 3.0, 0], [-2.6, 1.4, -1], [2.6, 1.4, 1]]) out.push({ x: c.x + x, z: c.z + z, dx: dx * 0.7, dz: 0.3, fx: c.x, fz: c.z + PZ.basketZ });
  stageSpotCache.set(sid, out); return out; }
const explore = createExplore({ scene, nav, people, centers, animals, callbacks: xCallbacks, rebuild: list => game.setExtraWalkers(list), boutiques: () => BOUTIQUES, site: () => citySite, mayor: () => game.G.mayor, stageSpots });
// 闖關場頭上的牌子：「🔴 闖關中 2 隊」（只在逛校園時顯示）
const liveLabels = new Map();
// 校園裡闖關場頭上的牌子：現在輪到的場一直掛「🥚 現在的闖關場」，有人在打就變紅「🔴 闖關中 N 隊」
function liveSigns(groups, nowSid) { const want = new Set(groups.keys()); if (nowSid) want.add(nowSid);
  for (const [sid, L] of [...liveLabels]) if (!want.has(sid)) { L.el.remove(); labels.splice(labels.indexOf(L), 1); liveLabels.delete(sid); }
  for (const sid of want) { const st = C.stages.find(s => s.id === sid); if (!st) continue; let L = liveLabels.get(sid); const g = groups.get(sid), now = sid === nowSid;
    const txt = g ? `${now ? '現在的闖關場・' : ''}闖關中 ${g.n} 隊${g.bosses.length ? `・魔王 ${g.bosses.length} 種` : ''}` : '現在的闖關場', icon = g ? '🔴' : '🥚';
    if (!L) { const c = centers.get(st.basket); L = addLabel(txt, new THREE.Vector3(c.x, TOP + 1.7, c.z + C.plaza.basketZ), 'policy live', icon, 2.2); liveLabels.set(sid, L); }
    L.el.classList.toggle('idle', !g); if (L.txt !== txt) { L.txt = txt; L.el.firstChild.textContent = icon; L.el.lastChild.textContent = txt; L.w = 0; } } }
callbacks.speech = m => { if (callbacks.mayorExtra) callbacks.mayorExtra(m); };
// 相機
function fit() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
fit(); window.addEventListener('resize', fit);
const narrow = () => stage.clientWidth < 700;
function overview(instant) { controls.target.copy(center); const d = (narrow() ? 44 : 32) * MAP_K; const pol = THREE.MathUtils.degToRad(50); const to = new THREE.Vector3(center.x + Math.sin(0.08) * Math.sin(pol) * d, center.y + Math.cos(pol) * d, center.z + Math.cos(0.08) * Math.sin(pol) * d); if (instant) camera.position.copy(to); else fly = { from: camera.position.clone(), to, t: 0 }; }
let fly = null; overview(true);
// 闖關場全景：把這個場用到的島都框進畫面
function stageView() { const st = game.G.stage; if (!st) { overview(false); return; } stopFollow(); const c = new THREE.Vector3(); for (const id of st.islands) c.add(centers.get(id)); c.divideScalar(st.islands.length); c.y = TOP; let r = 0; for (const id of st.islands) r = Math.max(r, centers.get(id).distanceTo(c)); const d = (r + R + 1) * (narrow() ? 3.1 : 2.3), pol = THREE.MathUtils.degToRad(52);
  controls.target.copy(c); fly = { from: camera.position.clone(), to: new THREE.Vector3(c.x + Math.sin(0.08) * Math.sin(pol) * d, c.y + Math.cos(pol) * d, c.z + Math.cos(0.08) * Math.sin(pol) * d), t: 0 }; }
// 闖關場的大廳：鏡頭框住這個場（instant＝直接切過去，不飛）
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
// 點擊：開始闖關中點敵人＝鎖定、點地面＝走過去；大廳時點課程建築或校長開課程卡
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', e => { if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 6) return;
  const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (explore.G.on) { const rh = ray.intersectObjects(explore.remoteHits, false); if (rh.length) { const id = rh[0].object.userData.remoteId; xCallbacks.remote && xCallbacks.remote(id, explore.G.remotes.get(id)); return; } }
  if (game.G.phase !== 'lobby') { const eh = ray.intersectObjects(game.enemyHits, false); if (eh.length) { game.onPick({ enemy: eh[0].object.userData.enemy }); return; } const th = ray.intersectObjects(tops, false); if (th.length) game.onPick({ point: th[0].point }); return; }
  // 觸控裝置上課程標籤不吃指標事件（才能從標籤上開始拖地圖），點擊改在這裡用位置判斷
  const lh = policyLabels.find(L => L.el.style.display !== 'none' && !L.el.classList.contains('hidden') && (b => e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom + 6)(L.el.getBoundingClientRect())); if (lh) { callbacks.card && callbacks.card(lh.st.pol, lh.st.island); return; }
  const M = game.G.mayor; if (M && ray.intersectObject(M.hit, false).length) { const st = M.current || policyStops[M.stop % policyStops.length]; if (st) callbacks.card(st.pol, st.island); return; } const ph = ray.intersectObjects(policyMeshes, false); if (ph.length && ph[0].object.userData.owners) { const id = ph[0].object.userData.owners[ph[0].instanceId]; if (id && policyById.has(id)) { callbacks.card && callbacks.card(policyById.get(id), policyIsland.get(id)); return; } }
  if (explore.G.on) { const th = ray.intersectObjects(tops, false); if (th.length) explore.moveTo(th[0].point.x, th[0].point.z); } }); // 逛校園：點地板走過去
// UI
function flyTo(islandId) { const c = centers.get(islandId); if (!c) return; controls.target.copy(c); const pol = THREE.MathUtils.degToRad(48), d = narrow() ? 13 : 10; fly = { from: camera.position.clone(), to: new THREE.Vector3(c.x + Math.sin(0.3) * Math.sin(pol) * d, c.y + Math.cos(pol) * d, c.z + Math.cos(0.3) * Math.sin(pol) * d), t: 0 }; }
// 鳥瞰：鏡頭到校園中心正上方往下看；關掉就回到跟著自己
function bird(on) { if (on) { stopFollow(); const sc = (explore.G.on && explore.G.scene && centers.get(explore.G.scene)) || center; controls.target.copy(sc); fly = { from: camera.position.clone(), to: sc.clone().add(new THREE.Vector3(0.01, C.explore.birdHeight, C.explore.birdBack)), t: 0 }; } else if (explore.G.on) startFollow('xme', true); else overview(false); }
const policyPos = id => { const st = policyStops.find(x => x.pol.id === id); return st && { x: st.pos.x, z: st.pos.z }; };
const ui = createUI({ game, explore, xCallbacks, placeCity, bird, policyPos, warp, frameStage, liveSigns, progress, refreshGates, islName, stageCenter: sid => { const st = C.stages.find(s => s.id === sid); const c = st && centers.get(st.basket); return c && { x: c.x, z: c.z + C.plaza.basketZ }; }, callbacks, overview: () => { stopFollow(); overview(false); }, stageView, flyTo: (id) => { stopFollow(); flyTo(id); }, placePolicies, islandOf: id => policyIsland.get(id), setDistrictRanks, renderer,
  follow: { start: startFollow, stop: stopFollow, get kind() { return FOLLOW.kind; } }, input: { stick, clear: () => { keys.clear(); stick.x = stick.y = 0; }, aim: () => { fwd.copy(controls.target).sub(camera.position).setY(0).normalize(); return [fwd.x, fwd.z]; } } });
// 迴圈：天色與霧跟著波次（一般波早→午→下午、搗蛋夜是晚上、起大霧時霧拉近）
let last = performance.now(), acc = 0, lastZoom = 1, dayMin = 720, fogNear = scene.fog.near, fogFar = scene.fog.far; const G = game.G; const FOG0 = [scene.fog.near, scene.fog.far];
function frame(now) { const raw = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
  applyInput(); if (!G.paused) { const sub = Math.ceil(raw / 0.025); for (let i = 0; i < sub; i++) game.step(raw / sub); }
  if (explore.G.on) explore.step(raw);
  const zoomK = Math.min(1.7, Math.max(1, camera.position.distanceTo(controls.target) / 15)); lastZoom = zoomK; game.view(raw, t, zoomK); explore.view(raw, env.night, ui.shop.festival()); people.update(raw, t, zoomK); env.update(raw); GLOW.emissiveIntensity = GLOW_GHOST.emissiveIntensity = env.night * 3.2; // 晚上窗戶與燈亮起來
  const shift = G.phase !== 'lobby', XG = explore.G, wantMin = XG.on ? XG.clock : !shift ? 720 : G.special === 'rush' ? C.shift.rush.time : C.shift.dayTimes[Math.max(0, Math.min(2, G.waveNo - 1))]; if (XG.on && !XG.tween) dayMin = XG.clock; else { let d = wantMin - dayMin; if (XG.on) d = ((d % 1440) + 2160) % 1440 - 720; dayMin = (((dayMin + d * Math.min(1, raw * (XG.on ? 2.5 : 1.2))) % 1440) + 1440) % 1440; if (XG.on && Math.abs(d) < 2) { XG.tween = false; dayMin = XG.clock; } } env.setTime(dayMin); // 逛校園：時鐘照走，按時段時平順轉過去
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
window.PI = { game, explore, nav, progress, centers, layout: LAYOUT, cityPos: CITY_POS, boutiques: BOUTIQUES, people, scene, camera, controls, graph, centers, ui, get policies() { return policyById; }, get policyIsland() { return policyIsland; }, pickPolicy: id => callbacks.card(policyById.get(id), policyIsland.get(id)), get flightInfo() { return { flying: !!flight, warping, camY: +camera.position.y.toFixed(2), cloudY: +clouds.y.toFixed(2) }; } }; // 除錯用
