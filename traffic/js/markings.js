/* 拉近才看得到的標線：車道分隔虛線（白）、雙向道路中央雙黃線、號誌路口與停讓路口的停止線、號誌路口的斑馬線。
   每 400 公尺一格，鏡頭附近才生成（跟示意建築一樣）；都是貼在路面上的薄四邊形，不做深度測試、畫在道路上面。
   同一格也種行道樹：主要～三級路（平面）兩側人行道每 12 公尺一棵 Q 版樹，路口前後與別條路旁邊不種。 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LANE_W, pointAt, heightAt, halfWidth, distToEdge } from './data.js';
// 樹：樹幹（咖啡）＋圓圓的樹冠（綠），頂點顏色；每棵再用 instanceColor 微調深淺
const TREE = (() => { const paint = (g, hex) => { g = g.toNonIndexed(); const c = new THREE.Color(hex), a = []; for (let i = 0; i < g.attributes.position.count; i++) a.push(c.r, c.g, c.b); g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); return g; };
  return mergeGeometries([paint(new THREE.CylinderGeometry(0.17, 0.24, 2.4, 6).translate(0, 1.2, 0), 0x8a6a4f), paint(new THREE.IcosahedronGeometry(1.9, 1).translate(0, 3.8, 0), 0x86b86a), paint(new THREE.IcosahedronGeometry(1.2, 0).translate(0.7, 4.9, 0.3), 0x9ccc7c)]); })();
const TREE_TINT = [0xffffff, 0xeef7e6, 0xf6f2dc, 0xe2f0dc, 0xfff4e4];

export function createMarkings(scene, net, grid) {
  const TILE = 400, tiles = new Map(), mat = new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const WHITE = [0.98, 0.98, 0.96], YEL = [0.96, 0.78, 0.25], p = { x: 0, z: 0, dx: 1, dz: 0, seg: 0 }, treeMat = new THREE.MeshLambertMaterial({ vertexColors: true }), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  function build(tx, tz) { const x0 = tx * TILE, z0 = tz * TILE, pos = [], col = [];
    // 沿著 link 在 s 位置、橫向 lat 的一個小四邊形（長 len、寬 w，沿行進方向）
    const quad = (L, s, lat, len, w, c) => { const e = net.edges[L.e]; pointAt(L.pts, L.cum, s, p); const cx = p.x - p.dz * lat, cz = p.z + p.dx * lat; if (cx < x0 || cx >= x0 + TILE || cz < z0 || cz >= z0 + TILE) return;
      const y = heightAt(net, e, L.dir > 0 ? s : L.len - s) + 0.75, ax = p.dx * len / 2, az = p.dz * len / 2, bx = -p.dz * w / 2, bz = p.dx * w / 2;
      const P = [[cx - ax - bx, cz - az - bz], [cx + ax - bx, cz + az - bz], [cx + ax + bx, cz + az + bz], [cx - ax + bx, cz - az + bz]]; for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(P[i][0], y, P[i][1]); col.push(...c); } };
    for (const id of grid.near(x0 + TILE / 2, z0 + TILE / 2, TILE * 0.75)) { const e = net.edges[id]; if (e.lv < 0 || e.cls > 5) continue; const two = e.f > 0 && e.r > 0;
      for (const lid of e.links) { if (lid < 0) continue; const L = net.links[lid], a = L.s0 + 2, b = L.len - L.stop - 1; if (b - a < 6) continue;
        if (L.lanes > 1 && e.cls <= 4) for (let i = 0; i < L.lanes - 1; i++) { const lat = L.off0 + (i + 0.5) * LANE_W; for (let s = a + 2; s < b - 4; s += 10) quad(L, s + 2, lat, 4, 0.3, WHITE); } // 車道虛線（Q 版畫粗一點才看得到）
        if (two && L.dir > 0 && e.cls <= 4) { const s0 = Math.max(L.s0, 2), s1 = L.len - Math.max(L.stop, 2); for (let s = s0; s < s1; s += 6) { const len = Math.min(6, s1 - s); quad(L, s + len / 2, -0.22, len, 0.22, YEL); quad(L, s + len / 2, 0.22, len, 0.22, YEL); } } // 中央雙黃線
        if (L.ctrl >= 0 || L.yieldTo) { const w = L.lanes * LANE_W, lat = two ? w / 2 : 0; quad(L, L.len - L.stop, lat, 0.45, w, WHITE); } // 停止線
        if (L.ctrl >= 0) { const hw = halfWidth(e), from = two ? -e.r * LANE_W : -L.lanes * LANE_W / 2, to = two ? e.f * LANE_W : L.lanes * LANE_W / 2; if (!two || L.dir > 0 || !e.links.includes(-1)) // 斑馬線：停止線外 1～4 公尺，條紋順著道路方向
            for (let lat = from + 0.5; lat < to - 0.3; lat += 1.1) quad(L, L.len - L.stop + 2.6, lat, 3.2, 0.55, WHITE); } } }
    const g = new THREE.Group(); if (pos.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); const m = new THREE.Mesh(geo, mat); m.renderOrder = 32; g.add(m); }
    const trees = plantTrees(x0, z0); if (trees) g.add(trees); if (!g.children.length) return null; scene.add(g); return g; }
  function plantTrees(x0, z0) { const T = []; let seed = (x0 * 73856093) ^ (z0 * 19349663); const rnd = () => ((seed = (seed * 1103515245 + 12345) | 0) >>> 0) / 4294967296;
    for (const id of grid.near(x0 + TILE / 2, z0 + TILE / 2, TILE * 0.75)) { const e = net.edges[id]; if (e.lv !== 0 || e.cls < 2 || e.cls > 4 || e.len < 60) continue; const two = e.f > 0 && e.r > 0, lo = two ? -e.r * LANE_W : -e.f * LANE_W / 2, hi = two ? e.f * LANE_W : e.f * LANE_W / 2;
      for (const lat of [hi + 1.7, lo - 1.7]) for (let s = 18 + rnd() * 6; s < e.len - 18; s += 11 + rnd() * 3) { pointAt(e.pts, e.cum, s, p); const cx = p.x - p.dz * lat, cz = p.z + p.dx * lat; if (cx < x0 || cx >= x0 + TILE || cz < z0 || cz >= z0 + TILE) continue;
        let ok = true; for (const oid of grid.near(cx, cz, 26)) { if (oid === id) continue; const o = net.edges[oid]; if (o.lv !== 0) continue; const [dd] = distToEdge(o, cx, cz); if (dd < halfWidth(o) + 2.6) { ok = false; break; } } if (ok) T.push([cx, cz, 0.75 + rnd() * 0.5, rnd() * 6.28, rnd()]); } }
    if (!T.length) return null; const m = new THREE.InstancedMesh(TREE, treeMat, T.length);
    T.forEach(([x, z, k, yaw, c], i) => { q.setFromAxisAngle(UP, yaw); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(k, k * (0.9 + c * 0.25), k)); m.setMatrixAt(i, m4); m.setColorAt(i, col.setHex(TREE_TINT[Math.floor(c * TREE_TINT.length)])); });
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); m.renderOrder = 41; return m; }
  const drop = g => { scene.remove(g); for (const c of g.children) { if (c.isInstancedMesh) c.dispose(); else c.geometry.dispose(); } };
  function update(cx, cz, radius, on, budget = 2) { const want = new Set(); if (on) { const r = Math.ceil(radius / TILE), tx0 = Math.floor(cx / TILE), tz0 = Math.floor(cz / TILE);
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const tx = tx0 + i, tz = tz0 + j; if (Math.hypot((tx + 0.5) * TILE - cx, (tz + 0.5) * TILE - cz) > radius + TILE * 0.7) continue; const k = tx + ',' + tz; want.add(k); if (!tiles.has(k) && budget > 0) { tiles.set(k, build(tx, tz)); budget--; } } }
    for (const [k, m] of tiles) if (!want.has(k)) { if (m) drop(m); tiles.delete(k); } }
  function reset() { for (const [k, m] of tiles) { if (m) drop(m); tiles.delete(k); } }
  return { update, reset }; }
