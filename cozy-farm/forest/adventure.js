/* 冒險：出了新手村（森林主幹道與各區域）會有怪物，打倒掉金幣；同一種怪物打倒 5 隻一定拿到那件裝備（不抽卡、不隨機）。
   - 怪物：原創積木造型（蘑菇跳跳、墨水團、刺刺栗、紙飛蛾、石頭小兵、水滴怪、迷霧幽靈），在自己的地盤閒晃，靠近會追過來；
     不會走進知識點石碑、拱門、出生點附近（那裡是安全區，在石碑旁學習不會被打擾）。
   - 戰鬥：空白鍵／手機「攻擊」鈕揮武器（自動轉向最近的怪物）；被碰到少半顆或一顆愛心、往後彈一下；
     愛心用完就回到入口休息、愛心補滿，不會掉金幣也不會掉裝備；一段時間沒被打會慢慢回愛心，回新手村或學習會補滿。
   - 金幣：打怪、學習（每答對一題、過關）、小遊戲、收成都能賺；在新手村的「道具小舖」買裝備。
   - 存在 localStorage（forest.adventure.v1）。 */
import * as ICON from './icons.js';
import { modal, close, el, esc } from './learn.js';
const BASE = new URL('.', import.meta.url).href, KEY = 'forest.adventure.v1';
let A = null, S = null, X = null; // A＝資料、S＝存檔、X＝場景工具（init 時給）
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
export const data = () => A;
export const state = () => S;
export const item = id => A.items.find(i => i.id === id);
export function stats() { const w = item(S.equip.weapon) || item('twig'), sh = item(S.equip.shield), so = item(S.equip.shoes);
  return { atk: w.atk, range: 1.8 + (w.range || 0), def: sh ? sh.def : 0, spd: 1 + (so ? so.spd : 0), max: A.player.hearts * 2 }; }

export async function load() { if (A) return A; A = await (await fetch(BASE + 'data/adventure.json')).json();
  S = { coins: 0, owned: ['twig'], equip: { weapon: 'twig', shield: null, shoes: null }, kills: {}, hp: A.player.hearts * 2 };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {} S.equip ||= { weapon: 'twig' }; if (!S.owned.includes('twig')) S.owned.unshift('twig'); return A; }

// ── 金幣與獎勵 ──
let hudEl = null; const listeners = [];
export const onChange = f => listeners.push(f);
const changed = () => { renderHUD(); listeners.forEach(f => f(S)); };
export function addCoins(n, at) { if (!n) return; S.coins += n; save(); changed(); if (at && X) floatText(`+${n}`, at.x, at.z, 'coin'); }
function give(id) { if (S.owned.includes(id)) return false; S.owned.push(id); const it = item(id); if (!S.equip[it.slot] || better(it, item(S.equip[it.slot]))) S.equip[it.slot] = id; save(); changed(); X && X.banner(`${it.icon}|得到「${it.name}」！已經幫你裝上`); return true; }
const power = it => !it ? 0 : (it.atk || 0) * 2 + (it.range || 0) + (it.def || 0) * 2 + (it.spd || 0) * 10;
const better = (a, b) => power(a) > power(b);
// 學習也能賺金幣：答對越多賺越多；答錯只是少賺，不會扣
addEventListener('forest', e => { if (!A) return; const d = e.detail, L = A.learnCoins;
  if (d.type === 'practice') { addCoins((d.right || 0) * L.right + (d.pass ? L.pass : 0)); heal(); }
  else if (d.type === 'game') addCoins(L.game); else if (d.type === 'harvest') addCoins(L.harvest); });

// ── HUD：愛心、金幣、背包鈕 ──
const heartSVG = k => `<span class="adv-h${k === 1 ? ' half' : k === 0 ? ' empty' : ''}">${ICON.svg('heart', 20)}${k === 1 ? ICON.svg('heart', 20) : ''}</span>`;
export function mountHUD(elm) { hudEl = elm; renderHUD(); }
let showHearts = false; export function setHeartsVisible(v) { if (v !== showHearts) { showHearts = v; renderHUD(); } }
function renderHUD() { if (!hudEl || !S) return; const st = stats(), hp = Math.max(0, Math.round(S.hp)); let hs = ''; for (let i = 0; i < st.max / 2; i++) hs += heartSVG(Math.max(0, Math.min(2, hp - i * 2)));
  hudEl.innerHTML = `${showHearts ? `<span class="adv-hearts" aria-label="愛心 ${hp / 2}／${st.max / 2}">${hs}</span>` : ''}<button type="button" class="adv-bag" aria-label="背包與裝備（金幣 ${S.coins}）">${ICON.svg('coin', 22)}<b>${S.coins}</b>${ICON.svg('bag', 22)}</button>`;
  hudEl.querySelector('.adv-bag').onclick = () => open('bag'); }

// ── 場景：init 時拿到 three.js 與遊戲的工具 ──
export function init(ctx) { X = ctx; }
const rnd = (a, b) => a + Math.random() * (b - a);
const MAPS = new Map(); // 地圖 id → { list: 怪物[], coins: [], fx: [] }
let swingT = 0, cd = 0, hitDone = false, invuln = 0, sinceHit = 99, regenT = 0, kx = 0, kz = 0, weaponKey = '', lastHero = null, weaponG = null, shieldG = null;

function monsterMesh(type, lv) { const { THREE, Gc, G, addMesh, curvify, GRADIENT } = X, g = new THREE.Group(), body = new THREE.Group(); g.add(body); const mats = [], wings = [];
  const M = (color, o = {}) => { const m = curvify(new THREE.MeshToonMaterial({ color, gradientMap: GRADIENT, ...o })); mats.push(m); return m; };
  const add = (geo, mat, parent = body, outline = true) => addMesh(geo, mat, parent, { outline, cast: true });
  const white = M(0xffffff), dark = M(0x4a3b52);
  const eyes = (y, z, dx = 0.15, s = 0.14, mad = false) => { for (const sx of [-1, 1]) { add(Gc(s, s * 1.2, 0.05, 0.03, sx * dx, y, z), white, body, false); add(Gc(s * 0.5, s * 0.62, 0.04, 0.02, sx * dx + 0.015, y - 0.015, z + 0.03), dark, body, false); if (mad) add(G(s * 1.1, 0.04, 0.04, 0.015).clone().rotateZ(sx * 0.35).translate(sx * dx, y + s * 0.85, z + 0.02), dark, body, false); } };
  let top = 1, fly = 0;
  if (type === 'shroom') { add(Gc(0.46, 0.5, 0.42, 0.12, 0, 0.25, 0), M(0xf6e7cf)); add(Gc(1.0, 0.38, 1.0, 0.16, 0, 0.64, 0), M(0xf28ca0)); for (const [x, z] of [[0.22, 0.18], [-0.25, -0.1], [0.05, -0.3], [-0.12, 0.3]]) add(Gc(0.15, 0.06, 0.15, 0.03, x, 0.84, z), white, body, false); eyes(0.3, 0.22, 0.1, 0.11); top = 0.9; }
  else if (type === 'ink') { const m = M(0x8c7bc8); add(Gc(0.9, 0.62, 0.85, 0.28, 0, 0.31, 0), m); add(Gc(0.58, 0.38, 0.55, 0.18, 0, 0.72, 0), m); for (const sx of [-1, 1]) add(Gc(0.14, 0.26, 0.14, 0.06, sx * 0.32, 0.1, 0.33), m); add(Gc(0.14, 0.08, 0.05, 0.03, -0.18, 0.8, 0.26), white, body, false); eyes(0.48, 0.43); top = 0.95; }
  else if (type === 'chest') { add(Gc(0.8, 0.7, 0.8, 0.22, 0, 0.4, 0), M(0xa0703f)); add(Gc(0.72, 0.14, 0.72, 0.06, 0, 0.08, 0), M(0xefcfae)); const sp = M(0xd9b48a); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; add(G(0.17, 0.17, 0.17, 0.03).clone().rotateX(Math.PI / 4).rotateY(a).translate(Math.cos(a) * 0.42, 0.45 + (k % 2) * 0.15, Math.sin(a) * 0.42), sp, body, false); } add(G(0.2, 0.2, 0.2, 0.03).clone().rotateZ(Math.PI / 4).translate(0, 0.82, 0), sp, body, false); eyes(0.44, 0.41, 0.15, 0.13, true); top = 1.0; }
  else if (type === 'moth') { fly = 0.9; add(Gc(0.24, 0.24, 0.6, 0.09, 0, 0, 0), M(0xd9b48a)); for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx * 0.1, 0.05, 0); body.add(w); add(Gc(0.7, 0.04, 0.5, 0.02, sx * 0.36, 0, -0.02), M(0xfffaf3), w); add(Gc(0.5, 0.05, 0.035, 0.012, sx * 0.34, 0.01, 0.04), M(0xc7bfd6), w, false); wings.push(w); add(G(0.03, 0.22, 0.03, 0.01).clone().rotateZ(-sx * 0.4).translate(sx * 0.1, 0.18, 0.28), dark, body, false); } eyes(0.04, 0.31, 0.07, 0.08); top = 0.45; }
  else if (type === 'rock') { const m = M(0xb3a8cc); add(Gc(0.95, 0.78, 0.8, 0.18, 0, 0.44, 0), m); add(Gc(0.7, 0.34, 0.62, 0.12, 0, 0.98, 0), M(0xd5cfe0)); for (const sx of [-1, 1]) add(Gc(0.22, 0.42, 0.26, 0.08, sx * 0.6, 0.38, 0), m); eyes(0.6, 0.41, 0.17, 0.14, true); top = 1.25; }
  else if (type === 'drop') { const m = M(0x7cc3e3, { emissive: 0x3a8fb0, emissiveIntensity: 0.15 }); add(Gc(0.72, 0.68, 0.72, 0.3, 0, 0.34, 0), m); add(G(0.36, 0.36, 0.36, 0.08).clone().rotateZ(Math.PI / 4).translate(0, 0.68, 0), m); add(Gc(0.12, 0.18, 0.05, 0.04, -0.18, 0.5, 0.34), white, body, false); eyes(0.36, 0.36, 0.13, 0.12); top = 1.0; }
  else { fly = 0.45; const m = M(0xcfc6f2, { transparent: true, opacity: 0.88 }); add(Gc(0.8, 0.8, 0.74, 0.3, 0, 0.5, 0), m); for (let k = -1; k <= 1; k++) add(Gc(0.24, 0.24, 0.24, 0.09, k * 0.27, 0.1, 0.12), m, body, false); for (const sx of [-1, 1]) add(Gc(0.12, 0.17, 0.05, 0.05, sx * 0.15, 0.6, 0.38), dark, body, false); add(Gc(0.12, 0.08, 0.05, 0.035, 0, 0.42, 0.38), dark, body, false); top = 1.0; }
  g.scale.setScalar(1.2 + lv * 0.08);
  // 血條：Sprite，被打到才出現
  const cv = document.createElement('canvas'); cv.width = 72; cv.height = 14; const tex = new X.THREE.CanvasTexture(cv); const bar = new X.THREE.Sprite(new X.THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false })); bar.scale.set(1.1, 0.22, 1); bar.renderOrder = 5; bar.visible = false;
  return { g, body, mats, wings, fly, top: top + fly, bar, cv, tex }; }
function drawBar(m) { const g = m.cv.getContext('2d'); g.clearRect(0, 0, 72, 14); g.fillStyle = '#4a3b52cc'; g.beginPath(); g.roundRect(0, 0, 72, 14, 7); g.fill(); g.fillStyle = '#F28CA0'; g.beginPath(); g.roundRect(2, 2, Math.max(4, 68 * m.hp / m.max), 10, 5); g.fill(); m.tex.needsUpdate = true; }

// 每張地圖第一次進去時放怪物；出生點在地圖範圍內、不在安全區、不在障礙物上
function safeAt(map, x, z, pad = 0) { for (const n of map.nodes || []) if (Math.hypot(x - n.x, z - n.z) < 3.3 + pad) return true; for (const p of map.portals || []) if (Math.hypot(x - p.x, z - p.z) < p.r + 2.6 + pad) return true; for (const k in map.spawns) { const s = map.spawns[k]; if (Math.hypot(x - s.x, z - s.z) < 3.6 + pad) return true; } return false; }
function randomSpot(map) { const m = map.mini; for (let k = 0; k < 300; k++) { let x, z; if (m.shape === 'circle') { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (m.R - 2); x = m.cx + Math.cos(a) * d; z = m.cz + Math.sin(a) * d; } else { x = rnd(m.x0 + 1.5, m.x1 - 1.5); z = rnd(m.z0 + 2, m.z1 - 2); }
    if (map.blocked(x, z) || safeAt(map, x, z, 1) || (map.colliders || []).some(c => Math.hypot(x - c.x, z - c.z) < c.r + 0.8)) continue; return { x, z }; } return null; }
function spawn(map, M, type) { const T = A.monsters[type], spot = randomSpot(map); if (!spot) return; const lv = M.lv, k = 1 + 0.35 * (lv - 1), mesh = monsterMesh(type, lv);
  const m = { type, T, lv, max: Math.round(T.hp * k), atk: T.atk + Math.floor((lv - 1) / 2), speed: T.speed * (1 + 0.05 * (lv - 1)), x: spot.x, z: spot.z, home: spot, yaw: Math.random() * 6.28, wx: spot.x, wz: spot.z, wt: 0, t: Math.random() * 10, cd: 0, hitT: 0, kx: 0, kz: 0, dead: 0, ...mesh };
  m.hp = m.max; drawBar(m); map.group.add(m.g); map.group.add(m.bar); M.list.push(m); }
export function ensure(map) { if (!A || !map || MAPS.has(map.id)) return; const cfg = A.maps[map.id]; const M = { list: [], coins: [], fx: [], lv: cfg ? cfg.lv : 1 }; MAPS.set(map.id, M); if (!cfg || !map.mini) return; for (let i = 0; i < cfg.n; i++) spawn(map, M, cfg.types[i % cfg.types.length]); }

// ── 飄字與金幣 ──
function floatText(text, x, z, icon, col) { const M = MAPS.get(X.getMap().id); if (!M) return; const sp = X.label(text, { icon, h: 0.68, bg: col ? '#fff' : '#fff6d8', fg: col || '#a0703f' }); const y = X.getMap().groundY(x, z) + 1.6; sp.position.set(x, y, z); X.getMap().group.add(sp); M.fx.push({ sp, t: 0, y, x, z }); }
function dropCoins(map, M, m) { const [a, b] = m.T.coins, n = Math.round(rnd(a, b + 0.99) * (1 + 0.5 * (m.lv - 1))); const pieces = Math.min(6, Math.max(1, Math.ceil(n / 2))); let left = n;
  for (let i = 0; i < pieces; i++) { const v = i === pieces - 1 ? left : Math.ceil(n / pieces); left -= v; const mesh = X.addMesh(COIN_GEO(), X.toon(0xf5b731, { emissive: 0xf5a020, emissiveIntensity: 0.25 }), map.group, { outline: true, cast: false }); const a2 = Math.random() * 6.28, sp = rnd(1.2, 2.4);
    M.coins.push({ mesh, x: m.x, z: m.z, y: 0.5, vx: Math.cos(a2) * sp, vz: Math.sin(a2) * sp, vy: rnd(3, 4.5), t: 0, v }); } }
let coinGeo = null; const COIN_GEO = () => coinGeo ||= new X.THREE.CylinderGeometry(0.17, 0.17, 0.06, 16).rotateX(Math.PI / 2).translate(0, 0.2, 0);

// ── 揮武器 ──
export function nearestMonster(r = 2.6) { const M = X && MAPS.get(X.getMap().id); if (!M) return null; let best = null, bd = r; const P = X.PL; for (const m of M.list) { if (m.dead) continue; const d = Math.hypot(m.x - P.x, m.z - P.z); if (d < bd) { bd = d; best = m; } } return best; }
export function attack() { if (cd > 0) return false; const st = stats(), P = X.PL, t = nearestMonster(st.range + 1.2); if (t) P.yaw = Math.atan2(t.x - P.x, t.z - P.z); cd = 0.45; swingT = 0.32; hitDone = false; return true; }
function doHit(map, M) { const st = stats(), P = X.PL, fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
  for (const m of M.list) { if (m.dead) continue; const dx = m.x - P.x, dz = m.z - P.z, d = Math.hypot(dx, dz); if (d > st.range || (d > 0.5 && (dx * fx + dz * fz) / d < 0.25)) continue;
    const crit = Math.random() < 0.15, dmg = st.atk * (crit ? 2 : 1); m.hp -= dmg; m.hitT = 0.18; m.kx = dx / (d || 1) * 5; m.kz = dz / (d || 1) * 5; m.aggro = 3; drawBar(m); m.bar.visible = true;
    floatText(crit ? `${dmg}！` : String(dmg), m.x, m.z, null, crit ? '#e8705c' : '#6a4f7a');
    if (m.hp <= 0) { m.dead = 0.4; m.bar.visible = false; S.kills[m.type] = (S.kills[m.type] || 0) + 1; save(); dropCoins(map, M, m); const dr = m.T.drop; if (dr && S.kills[m.type] >= dr.n) give(dr.item); changed(); } } }

// ── 被打到：少愛心、往後彈；愛心用完就回入口休息 ──
function hurt(m) { const st = stats(), dmg = Math.max(1, m.atk - st.def); S.hp = Math.max(0, S.hp - dmg); invuln = 1.0; sinceHit = 0; const P = X.PL, dx = P.x - m.x, dz = P.z - m.z, d = Math.hypot(dx, dz) || 1; kx = dx / d * 6; kz = dz / d * 6; save(); changed();
  if (S.hp <= 0) { S.hp = st.max; save(); changed(); invuln = 2.5; X.faint(); } }
export function heal() { if (!S) return; const mx = stats().max; if (S.hp !== mx) { S.hp = mx; save(); changed(); } }

// ── 手上的武器與盾（森林裡拿武器、新手村拿澆水壺）──
function equipVisual(inVillage) { const hero = X.hero(), key = S.equip.weapon + '|' + S.equip.shield; const handR = hero.arms[1].userData.hand, handL = hero.arms[0].userData.hand;
  if (hero !== lastHero || key !== weaponKey) { lastHero = hero; weaponKey = key; weaponG?.removeFromParent(); shieldG?.removeFromParent(); weaponG = weaponModel(S.equip.weapon); handR.add(weaponG); shieldG = S.equip.shield ? shieldModel(S.equip.shield) : null; if (shieldG) handL.add(shieldG); }
  for (const c of handR.children) c.visible = (c === weaponG) !== inVillage; if (shieldG) shieldG.visible = !inVillage; }
function weaponModel(id) { const { THREE, Gc, G, addMesh, toon } = X, g = new THREE.Group(); g.position.set(0, -0.06, 0.04); const add = (geo, col, o = {}) => addMesh(geo, toon(col, o), g, { cast: false });
  if (id === 'twig') { add(Gc(0.05, 0.5, 0.05, 0.02, 0, -0.25, 0), 0x9a6b48); add(Gc(0.12, 0.04, 0.08, 0.02, 0.06, -0.38, 0), 0x8cc77e); }
  else if (id === 'wood') { add(Gc(0.05, 0.12, 0.05, 0.02, 0, -0.02, 0), 0x9a6b48); add(Gc(0.22, 0.05, 0.07, 0.02, 0, -0.1, 0), 0xa0703f); add(Gc(0.09, 0.42, 0.035, 0.02, 0, -0.33, 0), 0xe6c79a); }
  else if (id === 'pencil') { add(Gc(0.1, 0.42, 0.1, 0.03, 0, -0.26, 0), 0xf5b731); add(Gc(0.1, 0.08, 0.1, 0.03, 0, -0.02, 0), 0xf28ca0); add(G(0.07, 0.07, 0.07, 0.02).clone().rotateX(Math.PI / 4).scale(1, 1.6, 1).translate(0, -0.5, 0), 0xefcfae); }
  else if (id === 'brush') { add(Gc(0.05, 0.62, 0.05, 0.02, 0, -0.26, 0), 0xa0703f); add(Gc(0.1, 0.17, 0.1, 0.04, 0, -0.63, 0), 0x4a3b52); add(Gc(0.07, 0.05, 0.07, 0.02, 0, -0.53, 0), 0xf5b731); }
  else if (id === 'ruler') { add(Gc(0.05, 0.1, 0.05, 0.02, 0, -0.01, 0), 0x9c8be0); add(Gc(0.12, 0.5, 0.03, 0.015, 0, -0.32, 0), 0xbfe3f2); for (let k = 0; k < 5; k++) add(Gc(0.05, 0.015, 0.035, 0.005, -0.03, -0.14 - k * 0.08, 0), 0x7cc3e3); }
  else { add(Gc(0.05, 0.5, 0.05, 0.02, 0, -0.24, 0), 0x9c8be0); for (const r of [0, Math.PI / 4]) add(G(0.2, 0.2, 0.06, 0.03).clone().rotateZ(r).translate(0, -0.55, 0), 0xf5b731, { emissive: 0xf5a020, emissiveIntensity: 0.5 }); }
  return g; }
function shieldModel(id) { const { THREE, Gc, addMesh, toon } = X, g = new THREE.Group(); g.position.set(0.06, -0.05, 0.02); const col = { book: 0xf28ca0, pot: 0xc7cbd6, stone: 0xb3a8cc, cloud: 0xffffff }[id] || 0xcccccc;
  addMesh(Gc(0.05, 0.32, 0.28, 0.08, 0, 0, 0), toon(col), g, { cast: false }); addMesh(Gc(0.055, 0.12, 0.12, 0.04, 0.01, 0, 0), toon(id === 'book' ? 0xffffff : id === 'cloud' ? 0x7cc3e3 : 0xf5b731), g, { cast: false, outline: false }); return g; }

// ── 每一幀 ──
export function update(dt, time, { inVillage, frozen, hidden = false }) { if (!A || !X) return; const map = X.getMap(), P = X.PL, st = stats();
  P.speed = A.player.speed * st.spd; equipVisual(inVillage); setHeartsVisible(!inVillage);
  if (inVillage) { if (S.hp < st.max) heal(); X.hero().root.visible = true; return; }
  ensure(map); const M = MAPS.get(map.id); cd = Math.max(0, cd - dt); invuln = Math.max(0, invuln - dt); sinceHit += dt;
  // 被彈開
  if (Math.abs(kx) + Math.abs(kz) > 0.05) { const nx = P.x + kx * dt, nz = P.z + kz * dt; if (!map.blocked(nx, P.z)) P.x = nx; if (!map.blocked(P.x, nz)) P.z = nz; kx *= Math.exp(-dt * 9); kz *= Math.exp(-dt * 9); }
  X.hero().root.visible = invuln <= 0 || Math.floor(time * 14) % 2 === 0; // 受傷後閃一閃
  if (sinceHit > 6 && S.hp < st.max) { regenT += dt; if (regenT > 3) { regenT = 0; S.hp++; save(); changed(); } }
  // 揮武器：先舉高再往前劈
  const arm = X.hero().arms[1]; if (swingT > 0) { swingT -= dt; const p = 1 - swingT / 0.32; arm.rotation.set(p < 0.3 ? -1.0 - p / 0.3 * 1.9 : -2.9 + Math.min(1, (p - 0.3) / 0.4) * 2.5, 0, -0.15); if (!hitDone && p > 0.55) { hitDone = true; doHit(map, M); } } else arm.rotation.set(-1.0 + Math.sin(time * 2) * 0.04, 0, -0.18);
  if (!M) return;
  const inSafeP = safeAt(map, P.x, P.z, -0.6);
  for (const m of M.list) {
    if (hidden) { m.g.visible = false; m.bar.visible = false; continue; } else if (!m.dead) m.g.visible = true;
    if (m.dead) { if (m.dead > 0 && m.dead < 99) { m.dead -= dt; const k = Math.max(0, m.dead / 0.4); m.g.scale.setScalar((1.2 + m.lv * 0.08) * (1 + (1 - k) * 0.4) * (k > 0 ? 1 : 0.0001)); if (m.dead <= 0) { m.dead = 99 + 20 + Math.random() * 10; m.g.visible = false; } continue; }
      m.dead -= dt; if (m.dead < 99) { const sp = randomSpot(map) || m.home; if (Math.hypot(sp.x - P.x, sp.z - P.z) < 7) { m.dead = 101; continue; } Object.assign(m, { x: sp.x, z: sp.z, home: sp, hp: m.max, dead: 0, aggro: 0 }); m.g.visible = true; m.g.scale.setScalar(1.2 + m.lv * 0.08); drawBar(m); } continue; }
    m.t += dt; m.cd = Math.max(0, m.cd - dt); m.hitT = Math.max(0, m.hitT - dt); m.aggro = Math.max(0, (m.aggro || 0) - dt);
    const dx = P.x - m.x, dz = P.z - m.z, d = Math.hypot(dx, dz), chase = !inSafeP && !frozen && (d < 5.5 || m.aggro > 0) ;
    const inSafe = safeAt(map, m.x, m.z); let tx, tz; if (inSafe) { tx = m.home.x; tz = m.home.z; } else if (chase) { tx = P.x; tz = P.z; } else { m.wt -= dt; if (m.wt <= 0 || Math.hypot(m.wx - m.x, m.wz - m.z) < 0.3) { m.wt = rnd(2, 4.5); const a = Math.random() * 6.28, r = rnd(0, 4); m.wx = m.home.x + Math.cos(a) * r; m.wz = m.home.z + Math.sin(a) * r; } tx = m.wx; tz = m.wz; }
    let moving = 0; if (!frozen) { const vx = tx - m.x, vz = tz - m.z, vl = Math.hypot(vx, vz); if (vl > (chase ? 0.75 : 0.25)) { const sp = m.speed * (chase ? 1 : 0.45) * (m.T.move === 'hop' ? 0.6 + Math.abs(Math.sin(m.t * 5)) * 0.8 : 1), nx = m.x + vx / vl * sp * dt, nz = m.z + vz / vl * sp * dt;
        if (!map.blocked(nx, nz) && (inSafe || !safeAt(map, nx, nz))) { m.x = nx; m.z = nz; moving = 1; } else m.wt = 0; m.yaw += (((Math.atan2(vx, vz) - m.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8); } }
    if (Math.abs(m.kx) + Math.abs(m.kz) > 0.05) { const nx = m.x + m.kx * dt, nz = m.z + m.kz * dt; if (!map.blocked(nx, nz)) { m.x = nx; m.z = nz; } m.kx *= Math.exp(-dt * 8); m.kz *= Math.exp(-dt * 8); }
    for (const o of M.list) { if (o === m || o.dead) continue; const ox = m.x - o.x, oz = m.z - o.z, od = Math.hypot(ox, oz); if (od < 1.2 && od > 1e-3) { const nx = m.x + ox / od * (1.2 - od) * 0.5, nz = m.z + oz / od * (1.2 - od) * 0.5; if (!map.blocked(nx, nz)) { m.x = nx; m.z = nz; } } }
    if (chase && !frozen && d < 0.6 * m.g.scale.x + 0.3 && m.cd <= 0 && invuln <= 0) { m.cd = 1.3; hurt(m); }
    // 動作：跳的會壓扁伸長、滾的會左右晃、飛的上下飄還拍翅膀、走的一搖一擺
    const gy = map.groundY(m.x, m.z); m.g.position.set(m.x, gy, m.z); m.g.rotation.y = m.yaw; const b = m.body;
    if (m.T.move === 'hop') { const h = Math.abs(Math.sin(m.t * 5)); b.position.y = h * 0.28 * (moving || chase ? 1 : 0.4); b.scale.set(1 + (1 - h) * 0.12, 1 - (1 - h) * 0.15 + h * 0.06, 1 + (1 - h) * 0.12); }
    else if (m.T.move === 'roll') { b.rotation.z = Math.sin(m.t * 7) * 0.22 * (moving ? 1 : 0.3); b.position.y = Math.abs(Math.sin(m.t * 7)) * 0.06; }
    else if (m.T.move === 'fly') { b.position.y = m.fly + Math.sin(m.t * 3) * 0.12; m.wings.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * Math.sin(m.t * 16) * 0.6); b.rotation.x = moving ? 0.15 : 0; }
    else { b.rotation.z = Math.sin(m.t * 5) * 0.08 * (moving ? 1 : 0.2); b.position.y = Math.abs(Math.sin(m.t * 5)) * 0.05 * moving; }
    const fl = m.hitT > 0 ? 1 : 0; for (const mt of m.mats) if (mt.emissive) { mt.userData.e0 ??= [mt.emissive.getHex(), mt.emissiveIntensity]; if (fl) { mt.emissive.setHex(0xffffff); mt.emissiveIntensity = 0.8; } else { mt.emissive.setHex(mt.userData.e0[0]); mt.emissiveIntensity = mt.userData.e0[1]; } }
    m.bar.visible = m.hp < m.max; if (m.bar.visible) m.bar.position.set(m.x, gy + m.top * m.g.scale.y + 0.35 - X.curveDrop(m.x, m.z), m.z); }
  // 金幣：彈出來、落地、靠近就被吸過來
  for (let i = M.coins.length - 1; i >= 0; i--) { const c = M.coins[i]; c.t += dt; const gy = map.groundY(c.x, c.z), dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz);
    if (c.t > 0.5 && d < 3.2) { const sp = 7 + c.t * 4; c.x += dx / d * Math.min(d, sp * dt); c.z += dz / d * Math.min(d, sp * dt); c.y += (0.5 - c.y) * Math.min(1, dt * 8); } else { c.vy -= 14 * dt; c.x += c.vx * dt; c.z += c.vz * dt; c.y += c.vy * dt; if (c.y < 0) { c.y = 0; c.vy = Math.abs(c.vy) * 0.35; c.vx *= 0.6; c.vz *= 0.6; } }
    c.mesh.position.set(c.x, gy + c.y, c.z); c.mesh.rotation.y = time * 5 + i;
    if ((c.t > 0.5 && d < 0.55) || c.t > 25) { c.mesh.removeFromParent(); M.coins.splice(i, 1); if (c.t <= 25) addCoins(c.v, { x: P.x, z: P.z }); } }
  for (let i = M.fx.length - 1; i >= 0; i--) { const f = M.fx[i]; f.t += dt; f.sp.position.y = f.y + f.t * 1.2 - X.curveDrop(f.x, f.z); f.sp.material.opacity = Math.min(1, 2.2 - f.t * 2.2); if (f.t > 1) { f.sp.removeFromParent(); f.sp.material.map.dispose(); f.sp.material.dispose(); M.fx.splice(i, 1); } } }
export function hideMonsters(id, hide) { const M = MAPS.get(id); if (M) for (const m of M.list) if (!m.dead) m.g.visible = !hide; }

// ── 背包、商店、怪物圖鑑 ──
const CSS = `
.adv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.adv-card{background:#fff;border-radius:16px;padding:10px;box-shadow:0 2px 8px #6a4f7a14;display:flex;flex-direction:column;gap:4px;align-items:flex-start;position:relative}
.adv-card.on{box-shadow:0 0 0 3px #F5B731}.adv-card.lock{opacity:.6}.adv-card b{font-weight:900}.adv-card small{color:#8a7a92;font-weight:700;font-size:12px;line-height:1.4}
.adv-card .st{font-size:12px;font-weight:900;color:#a0703f}
.adv-card button{border:0;border-radius:999px;padding:5px 12px;font:inherit;font-weight:900;background:#f09a8a;color:#fff;cursor:pointer;display:flex;align-items:center;gap:4px;margin-top:2px}.adv-card button[disabled]{background:#e6dcea;color:#8a7a92;cursor:default}
.adv-slot{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.adv-slot div{flex:1;min-width:120px;background:#fff7ef;border-radius:14px;padding:8px;display:flex;align-items:center;gap:8px;font-weight:900}.adv-slot small{display:block;color:#8a7a92;font-size:11px}
.adv-top{display:flex;align-items:center;gap:8px;font-weight:900;margin-bottom:10px;flex-wrap:wrap}.adv-top .c{display:flex;align-items:center;gap:4px;background:#fff6d8;border-radius:999px;padding:3px 12px 3px 4px}
.adv-h3{font-weight:900;margin:12px 0 6px;font-size:15px}
.adv-bar{height:7px;border-radius:4px;background:#efe9f2;overflow:hidden;width:100%}.adv-bar i{display:block;height:100%;background:#8CC77E}
`;
let styled = false;
const statText = it => [it.atk ? `攻擊 ${it.atk}` : '', it.range ? '距離＋' : '', it.def ? `防禦 ${it.def}` : '', it.spd ? `速度＋${Math.round(it.spd * 100)}%` : ''].filter(Boolean).join('・');
const sourceText = it => it.price != null ? (it.price ? `道具小舖 ${it.price} 金幣` : '一開始就有') : `打倒 ${A.monsters[it.from].drop.n} 隻${A.monsters[it.from].name}`;
export function open(tab = 'bag', { shop = false } = {}) { if (!styled) { styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  const m = modal({ title: shop ? '道具小舖' : '背包與裝備', sub: shop ? '用金幣買裝備' : '打怪、學習都能賺金幣', icon: shop ? 'coin' : 'bag' }); const tabs = el('div', 'lf-tabs'); m.body.before(tabs);
  const T = [['bag', '裝備'], ['shop', '商店'], ['book', '怪物圖鑑']]; let cur = shop ? 'shop' : tab;
  const render = () => { tabs.innerHTML = ''; for (const [k, n] of T) { const b = el('button', null, n); b.setAttribute('aria-selected', String(k === cur)); b.onclick = () => { cur = k; render(); }; tabs.appendChild(b); }
    const st = stats(), b = m.body; b.innerHTML = `<div class="adv-top"><span class="c">${ICON.svg('coin', 24)}${S.coins} 金幣</span><span class="c">${ICON.svg('heart', 22)}${S.hp / 2}／${st.max / 2}</span><span class="c">${ICON.svg('sword', 22)}攻擊 ${st.atk}</span><span class="c">${ICON.svg('shield', 22)}防禦 ${st.def}</span><span class="c">${ICON.svg('boot', 22)}速度 ${Math.round(st.spd * 100)}%</span></div>`;
    if (cur === 'bag') { b.insertAdjacentHTML('beforeend', `<div class="adv-slot">${Object.entries(A.slots).map(([k, n]) => { const it = item(S.equip[k]); return `<div>${ICON.svg(it ? it.icon : 'st-locked', 40)}<span><small>${n}</small>${it ? esc(it.name) : '還沒有'}</span></div>`; }).join('')}</div>`);
      for (const [k, n] of Object.entries(A.slots)) { b.appendChild(el('div', 'adv-h3', n)); const g = el('div', 'adv-grid'); b.appendChild(g);
        for (const it of A.items.filter(x => x.slot === k)) { const own = S.owned.includes(it.id), on = S.equip[k] === it.id, c = el('div', 'adv-card' + (on ? ' on' : '') + (own ? '' : ' lock'), `${ICON.svg(own ? it.icon : 'st-locked', 48)}<b>${esc(it.name)}</b><span class="st">${statText(it)}</span><small>${own ? esc(it.desc) : esc(sourceText(it))}</small>`);
          if (own) { const bt = el('button', null, on ? '裝備中' : k === 'weapon' ? '拿這個' : on ? '裝備中' : '裝上'); bt.disabled = on; bt.onclick = () => { S.equip[k] = it.id; save(); changed(); render(); }; c.appendChild(bt); if (on && k !== 'weapon') { const off = el('button', null, '拿下來'); off.style.background = '#f3ebe4'; off.style.color = '#6e5d7a'; off.onclick = () => { S.equip[k] = null; save(); changed(); render(); }; c.appendChild(off); } } g.appendChild(c); } } }
    else if (cur === 'shop') { b.insertAdjacentHTML('beforeend', `<p class="adv-h3" style="font-weight:700;color:#8a7a92;font-size:13px">${shop ? '歡迎光臨！金幣可以打怪賺，也可以在石碑練習賺：每答對一題 +2，過關再 +5。' : '要到新手村的「道具小舖」才能買喔（從學習森林拱門往村子走就看得到）。'}</p>`); const g = el('div', 'adv-grid'); b.appendChild(g);
      for (const it of A.items.filter(x => x.price)) { const own = S.owned.includes(it.id), c = el('div', 'adv-card' + (own ? ' on' : ''), `${ICON.svg(it.icon, 48)}<b>${esc(it.name)}</b><span class="st">${statText(it)}</span><small>${esc(it.desc)}</small>`); const bt = el('button', null, own ? '已經有了' : `${ICON.svg('coin', 18)}${it.price}`); bt.disabled = own || !shop || S.coins < it.price;
        bt.onclick = () => { if (S.coins < it.price || own) return; S.coins -= it.price; save(); give(it.id); render(); }; c.appendChild(bt); g.appendChild(c); }
      b.insertAdjacentHTML('beforeend', `<p class="adv-h3" style="font-weight:700;color:#8a7a92;font-size:13px">有些裝備買不到：打倒同一種怪物 5 隻就一定會得到（看「怪物圖鑑」）。</p>`); }
    else { const g = el('div', 'adv-grid'); b.appendChild(g); for (const [k, T2] of Object.entries(A.monsters)) { const n = S.kills[k] || 0, it = item(T2.drop.item), got = S.owned.includes(it.id), where = Object.entries(A.maps).filter(([, v]) => v.types.includes(k)).map(([id]) => id);
        g.appendChild(el('div', 'adv-card' + (n ? '' : ' lock'), `${ICON.svg(n ? T2.icon : 'st-locked', 48)}<b>${n ? esc(T2.name) : '？？？'}</b><small>${n ? esc(T2.desc) : '還沒遇過'}</small><span class="st">打倒 ${n} 隻</span><small>${got ? `已經得到「${esc(it.name)}」` : `再打倒 ${Math.max(0, T2.drop.n - n)} 隻得到「${esc(it.name)}」`}</small><div class="adv-bar"><i style="width:${Math.min(100, n / T2.drop.n * 100)}%"></i></div><small>出沒：${where.map(id => X && X.mapName ? esc(X.mapName(id)) : id).join('、')}</small>`)); } } };
  render(); }
