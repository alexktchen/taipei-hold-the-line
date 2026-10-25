/* 城市底圖：市界外的地、台北市的地、河川、綠地、行政區界線、台北 101，以及拉近才出現的示意建築。
   建築不是真實的房子：沿著每段路兩側依序排，避開別的路、河川與綠地（先把水域綠地畫成一張 10 公尺解析度的遮罩），
   面對幹道的比較高；以 400 公尺一格，鏡頭附近才生成。 */
import * as THREE from 'three';
import { polyMesh, ringLine } from './roads.js';
import { halfWidth, distToEdge } from './data.js';

export const COL = { outside: 0xded6c7, land: 0xebe3d3, water: 0x9fd0d8, green: 0xc4dba8, district: 0xb8a894, boundary: 0xdb6a41 };
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const BLD = [0xf6efe2, 0xefe3cf, 0xe9d8c4, 0xf3d9c9, 0xdde6e3, 0xe6e1d6, 0xf7e7c6, 0xd9d3c7, 0xeadfd8];

export function createGround(scene, meta, water, green) {
  const g = new THREE.Group(); scene.add(g); const S = 0.1, b = meta.bbox;
  const cx = (b[0] + b[2]) / 2 * S, cz = (b[1] + b[3]) / 2 * S;
  const out = new THREE.Mesh(new THREE.PlaneGeometry(140000, 140000), new THREE.MeshBasicMaterial({ color: COL.outside, depthTest: false, depthWrite: false })); out.rotation.x = -Math.PI / 2; out.position.set(cx, -1, cz); out.renderOrder = 0; g.add(out);
  if (meta.boundary) { const land = polyMesh([[meta.boundary]], -0.8, COL.land); land.renderOrder = 1; g.add(land); }
  const wm = polyMesh(water.polys, -0.6, COL.water); wm.renderOrder = 3; g.add(wm);
  const gm = polyMesh(green.polys, -0.7, COL.green); gm.renderOrder = 2; g.add(gm);
  const lines = new THREE.Group(); for (const d of meta.districts || []) if (d.ring) { const l = ringLine(d.ring, 0, COL.district, true); l.renderOrder = 4; lines.add(l); } g.add(lines);
  let bl = null; if (meta.boundary) { bl = ringLine(meta.boundary, 0, COL.boundary, false); bl.renderOrder = 5; g.add(bl); }
  return { group: g, districtLines: lines, center: new THREE.Vector3(cx, 0, cz) }; }

// 水域與綠地的遮罩（10 公尺一格）：建築不放在河上、公園裡
export function landMask(meta, water, green) { const S = 0.1, res = 10, b = meta.bbox, x0 = b[0] * S - 500, z0 = b[1] * S - 500, W = Math.ceil((b[2] - b[0]) * S / res + 100), H = Math.ceil((b[3] - b[1]) * S / res + 100);
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H }); const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.fillStyle = '#fff';
  for (const polys of [water.polys, green.polys]) for (const poly of polys) { x.beginPath(); for (const r of poly) { for (let i = 0; i < r.length; i += 2) { const px = (r[i] * S - x0) / res, pz = (r[i + 1] * S - z0) / res; if (i) x.lineTo(px, pz); else x.moveTo(px, pz); } x.closePath(); } x.fill('evenodd'); }
  const img = x.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H); for (let i = 0; i < mask.length; i++) mask[i] = img[i * 4] > 127 ? 1 : 0;
  return (px, pz) => { const i = Math.floor((px - x0) / res), j = Math.floor((pz - z0) / res); return i >= 0 && j >= 0 && i < W && j < H ? mask[j * W + i] === 1 : false; }; }

// 台北 101（照真實位置；很高，拉遠也看得到）
export function landmark101(scene, meta) { const lat = 25.03362, lon = 121.56461, x = (lon - meta.origin.lon) * meta.kx, z = -(lat - meta.origin.lat) * meta.kz;
  const g = new THREE.Group(), glass = new THREE.MeshLambertMaterial({ color: 0x9fc4bf }), trim = new THREE.MeshLambertMaterial({ color: 0x5f8a85 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(58, 90, 58), glass); base.position.y = 45; g.add(base);
  for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(25, 19, 34, 4, 1), glass); s.rotation.y = Math.PI / 4; s.position.y = 90 + 17 + i * 34; g.add(s); const r = new THREE.Mesh(new THREE.BoxGeometry(40, 2, 40), trim); r.position.y = 90 + i * 34 + 33; g.add(r); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(18, 40, 18), glass); top.position.y = 90 + 8 * 34 + 20; g.add(top); const sp = new THREE.Mesh(new THREE.CylinderGeometry(1, 2, 60, 6), trim); sp.position.y = 90 + 8 * 34 + 70; g.add(sp);
  g.position.set(x, 0, z); scene.add(g); return { group: g, x, z, h: 508 }; }

// 示意建築：一格一格生成
export function createBuildings(scene, net, grid, masked) {
  const TILE = 400, tiles = new Map(); const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  { const c = []; const p = geo.attributes.position, n = geo.attributes.normal; for (let i = 0; i < p.count; i++) { const k = n.getY(i) > 0.5 ? 0.86 : n.getX(i) !== 0 ? 0.93 : 1; c.push(k, k, k); } geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); } // 屋頂、側面深一點
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  function build(tx, tz) { const x0 = tx * TILE, z0 = tz * TILE, rnd = mulberry(tx * 7919 + tz * 104729), list = [], occ = new Set(), cell = 7;
    const ids = grid.near(x0 + TILE / 2, z0 + TILE / 2, TILE * 0.75);
    for (const id of ids) { const e = net.edges[id]; if (e.lv !== 0 || e.cls <= 1) continue; const hw = halfWidth(e), big = e.cls <= 3, P = e.pts;
      for (let i = 0; i + 3 < P.length; i += 2) { const ax = P[i], az = P[i + 1], bx = P[i + 2], bz = P[i + 3], L = Math.hypot(bx - ax, bz - az); if (L < 8) continue; const dx = (bx - ax) / L, dz = (bz - az) / L, s0 = e.cum[i / 2];
        for (let d = 6 + rnd() * 6; d < L - 6; ) { const w = big ? 14 + rnd() * 14 : 8 + rnd() * 8, depth = big ? 16 + rnd() * 16 : 9 + rnd() * 9, along = s0 + d; if (along < 14 || along > e.len - 14) { d += w + 2; continue; }
          for (const side of [1, -1]) { const off = hw + 3 + depth / 2, cx = ax + dx * (d + w / 2) - dz * off * side, cz = az + dz * (d + w / 2) + dx * off * side;
            if (cx < x0 || cx >= x0 + TILE || cz < z0 || cz >= z0 + TILE || masked(cx, cz)) continue; const ok = (() => { const k = Math.floor(cx / cell) + ',' + Math.floor(cz / cell); if (occ.has(k)) return false;
              for (const oid of grid.near(cx, cz, 30)) { if (oid === id) continue; const o = net.edges[oid]; const [dd] = distToEdge(o, cx, cz); if (dd < halfWidth(o) + Math.min(w, depth) / 2 + 2) return false; } return true; })();
            if (!ok) continue; for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) occ.add((Math.floor(cx / cell) + ox) + ',' + (Math.floor(cz / cell) + oz));
            const h = big ? 14 + rnd() * rnd() * 70 : 6 + rnd() * 16; list.push([cx, cz, w * 0.92, depth * 0.92, h, Math.atan2(dz, dx), BLD[Math.floor(rnd() * BLD.length)]]); }
          d += w + 1 + rnd() * 3; } } }
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); mesh.count = list.length;
    list.forEach(([cx, cz, w, dpt, h, yaw, c], i) => { q.setFromAxisAngle(UP, -yaw); m4.compose(new THREE.Vector3(cx, 0, cz), q, new THREE.Vector3(w, h, dpt)); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col.setHex(c)); });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.renderOrder = 40; scene.add(mesh); return { mesh, n: list.length }; }
  // 鏡頭附近 radius 公尺內的格子要有建築，遠的收掉；一幀最多蓋 budget 格
  function update(cx, cz, radius, on, budget = 2) { const want = new Set(); if (on) { const r = Math.ceil(radius / TILE); const tx0 = Math.floor(cx / TILE), tz0 = Math.floor(cz / TILE);
      const cand = []; for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const tx = tx0 + i, tz = tz0 + j, d = Math.hypot((tx + 0.5) * TILE - cx, (tz + 0.5) * TILE - cz); if (d < radius + TILE * 0.7) cand.push([d, tx, tz]); }
      cand.sort((a, b) => a[0] - b[0]); for (const [, tx, tz] of cand) { const k = tx + ',' + tz; want.add(k); if (!tiles.has(k) && budget > 0) { tiles.set(k, build(tx, tz)); budget--; } } }
    for (const [k, t] of tiles) if (!want.has(k)) { scene.remove(t.mesh); t.mesh.dispose(); tiles.delete(k); }
    let n = 0; for (const t of tiles.values()) n += t.n; return n; }
  return { update, get count() { return tiles.size; } }; }
