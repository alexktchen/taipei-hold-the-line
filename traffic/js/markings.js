/* 拉近才看得到的標線：車道分隔虛線（白）、雙向道路中央雙黃線、號誌路口與停讓路口的停止線、號誌路口的斑馬線。
   每 400 公尺一格，鏡頭附近才生成（跟示意建築一樣）；都是貼在路面上的薄四邊形，不做深度測試、畫在道路上面。 */
import * as THREE from 'three';
import { LANE_W, pointAt, heightAt, halfWidth } from './data.js';

export function createMarkings(scene, net, grid) {
  const TILE = 400, tiles = new Map(), mat = new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
  const WHITE = [0.98, 0.98, 0.96], YEL = [0.96, 0.78, 0.25], p = { x: 0, z: 0, dx: 1, dz: 0, seg: 0 };
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
    if (!pos.length) return null; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 32; scene.add(m); return m; }
  function update(cx, cz, radius, on, budget = 2) { const want = new Set(); if (on) { const r = Math.ceil(radius / TILE), tx0 = Math.floor(cx / TILE), tz0 = Math.floor(cz / TILE);
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const tx = tx0 + i, tz = tz0 + j; if (Math.hypot((tx + 0.5) * TILE - cx, (tz + 0.5) * TILE - cz) > radius + TILE * 0.7) continue; const k = tx + ',' + tz; want.add(k); if (!tiles.has(k) && budget > 0) { tiles.set(k, build(tx, tz)); budget--; } } }
    for (const [k, m] of tiles) if (!want.has(k)) { if (m) { scene.remove(m); m.geometry.dispose(); } tiles.delete(k); } }
  function reset() { for (const [k, m] of tiles) { if (m) { scene.remove(m); m.geometry.dispose(); } tiles.delete(k); } }
  return { update, reset }; }
