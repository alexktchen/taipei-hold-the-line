/* 真實台北的細節（資料流程有產生才用）：
   一、OSM 建物輪廓（data/bld/，1 公里一格）：鏡頭附近才下載，擠出成 Q 版建物——粉彩外牆加窗格、屋頂淺一點；
       光影先算好放在頂點顏色（不用法向量，省一半記憶體），三角化分批做（每幀最多幾毫秒），一格合成一個 Mesh。
   二、捷運（data/mrt.json）：各線用官方顏色畫在地圖上（拉遠才畫，拉近就讓給道路），車站名稱標在地圖上。 */
import * as THREE from 'three';
import { ribbonMaterial } from './roads.js';

// 外牆顏色：奶油、杏桃、薄荷、淡紫、天空藍…；高樓偏玻璃的灰藍
const WALL = [0xf6ead8, 0xf2dcc8, 0xe9e0cd, 0xdfe8dc, 0xeadfe6, 0xdfe5ee, 0xf4e8cc, 0xe8d6cc, 0xe4ddd2], TALL = [0xd3dee5, 0xdbe1e2, 0xcfd9df, 0xe2e4e6];
const SUN = new THREE.Vector3(-0.5, 1, 0.35).normalize();
// 窗格紋理：白底、淡灰藍的窗；u＝沿外牆每 3.2 公尺一格、v＝每 3.3 公尺一層；屋頂取左下角的白邊
function windowTexture(renderer) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#b8c6cf'; g.fillRect(13, 16, 38, 30); g.fillStyle = '#d9e3e8'; g.fillRect(13, 16, 38, 6);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; if (renderer) t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; }

export async function loadBldIndex(base) { try { const r = await fetch(base + 'bld/index.json', { cache: 'no-cache' }); if (!r.ok) return null; const j = await r.json(); return j && j.tiles && Object.keys(j.tiles).length ? j : null; } catch (e) { return null; } }

export function createOsmBuildings(scene, idx, base, renderer) {
  const TILE = idx.size, U = idx.unit, tiles = new Map(), mat = new THREE.MeshBasicMaterial({ vertexColors: true, map: windowTexture(renderer) });
  const col = new THREE.Color(), roofC = new THREE.Color(), tmp = new THREE.Color(); let loading = 0, building = null;
  const shadeWall = (nx, nz) => 0.8 + 0.42 * Math.max(0, nx * SUN.x + nz * SUN.z) - 0.06 * Math.max(0, -(nx * SUN.x + nz * SUN.z)); // 向陽面亮、背陽面暗一點
  // 一棟：外牆每邊一個四邊形（各自的顏色＝面向決定的明暗），屋頂用輪廓三角化
  function addBuilding(T, b, i, out) { const h = b[0], n = (b.length - 1) / 2; if (n < 3) return; const ox = T.o[0], oz = T.o[1], P = new Array(n);
    for (let k = 0; k < n; k++) P[k] = [ox + b[1 + k * 2] * U, oz + b[2 + k * 2] * U];
    let a = 0; for (let k = 0; k < n; k++) { const [x1, z1] = P[k], [x2, z2] = P[(k + 1) % n]; a += x1 * z2 - x2 * z1; } if (a < 0) P.reverse(); // 統一方向：外牆法向量 (dz, −dx) 朝外
    const hs = ((i * 2654435761) >>> 0) / 4294967296; col.setHex(h > 36 ? TALL[Math.floor(hs * TALL.length)] : WALL[Math.floor(hs * WALL.length)]); roofC.copy(col).lerp(tmp.setHex(0xffffff), 0.35);
    const { pos, cl, uv } = out; let u = 0;
    for (let k = 0; k < n; k++) { const [x1, z1] = P[k], [x2, z2] = P[(k + 1) % n], L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.05) continue; const nx = (z2 - z1) / L, nz = -(x2 - x1) / L, s = shadeWall(nx, nz), r = col.r * s, g = col.g * s, bl = col.b * s, u2 = u + L / 3.2, v = h / 3.3;
      pos.push(x1, 0, z1, x2, h, z2, x2, 0, z2, x1, 0, z1, x1, h, z1, x2, h, z2); uv.push(u, 0, u2, v, u2, 0, u, 0, u, v, u2, v); /* 正面朝外（逆時針看過去） */ for (let q = 0; q < 6; q++) cl.push(r, g, bl); u = u2; }
    const tri = THREE.ShapeUtils.triangulateShape(P.map(([x, z]) => new THREE.Vector2(x, z)), []); const rs = 1.04;
    for (const t of tri) { const [A, B, C] = t.map(k => P[k]); const up = (B[1] - A[1]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[1] - A[1]) > 0; /* 屋頂朝上 */
      for (const Q of up ? [A, B, C] : [A, C, B]) { pos.push(Q[0], h, Q[1]); uv.push(0.04, 0.04); cl.push(roofC.r * rs, roofC.g * rs, roofC.b * rs); } } }
  function finish(job) { const { k, out } = job, geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2));
    const c8 = new Uint8Array(out.cl.length); for (let i = 0; i < c8.length; i++) c8[i] = Math.min(255, Math.round(out.cl[i] * 255)); geo.setAttribute('color', new THREE.BufferAttribute(c8, 3, true)); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 40; const t = tiles.get(k); if (!t) { geo.dispose(); return; } t.mesh = mesh; t.n = job.T.b.length; t.state = 'ready'; mesh.visible = t.on !== false; scene.add(mesh); }
  // 分批三角化：每次最多 ms 毫秒
  function work(ms) { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (!building) { const next = [...tiles.entries()].find(([, t]) => t.state === 'data'); if (!next) return; next[1].state = 'building'; building = { k: next[0], T: next[1].data, i: 0, out: { pos: [], cl: [], uv: [] } }; next[1].data = null; }
      const J = building, end = Math.min(J.T.b.length, J.i + 200); for (; J.i < end; J.i++) { try { addBuilding(J.T, J.T.b[J.i], J.i, J.out); } catch (e) {} } if (J.i >= J.T.b.length) { finish(J); building = null; } } }
  function update(cx, cz, radius, on) { const want = new Set(); if (on) { const r = Math.ceil(radius / TILE), tx0 = Math.floor(cx / TILE), tz0 = Math.floor(cz / TILE), cand = [];
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) { const tx = tx0 + i, tz = tz0 + j, k = tx + '_' + tz; if (!idx.tiles[k]) continue; const d = Math.hypot(Math.max(0, Math.abs((tx + 0.5) * TILE - cx) - TILE / 2), Math.max(0, Math.abs((tz + 0.5) * TILE - cz) - TILE / 2)); if (d < radius) cand.push([d, k]); }
      cand.sort((a, b) => a[0] - b[0]); for (const [, k] of cand) { want.add(k); if (!tiles.has(k) && loading < 3) { const t = { state: 'loading' }; tiles.set(k, t); loading++;
          fetch(base + 'bld/' + k + '.json').then(r => (r.ok ? r.json() : null)).then(T => { loading--; if (tiles.get(k) !== t) return; if (T && T.b) { t.state = 'data'; t.data = T; } else t.state = 'empty'; }).catch(() => { loading--; if (tiles.get(k) === t) t.state = 'empty'; }); } } }
    for (const [k, t] of tiles) if (!want.has(k)) { if (t.mesh) { scene.remove(t.mesh); t.mesh.geometry.dispose(); } if (building && building.k === k) building = null; tiles.delete(k); }
    let n = 0; for (const t of tiles.values()) if (t.mesh) n += t.n; return n; }
  return { update, work, get count() { return tiles.size; }, get pending() { return [...tiles.values()].filter(t => t.state !== 'ready' && t.state !== 'empty').length; } }; }

// ── 捷運 ──
export function createMrt(scene, mrt) { const group = new THREE.Group(), lines = [];
  for (const L of mrt.lines || []) { const pos = [], nrm = [], off = [], half = [], cl = [], idx = []; const c = new THREE.Color(L.color || '#888888'); let v = 0;
    for (const s of L.segs) { const k = s.length / 2; if (k < 2) continue; const v0 = v;
      for (let i = 0; i < k; i++) { let ax = 0, az = 0; const px = j => s[j * 2] * 0.1, pz = j => s[j * 2 + 1] * 0.1;
        if (i > 0) { const dx = px(i) - px(i - 1), dz = pz(i) - pz(i - 1), l = Math.hypot(dx, dz) || 1; ax += -dz / l; az += dx / l; } if (i < k - 1) { const dx = px(i + 1) - px(i), dz = pz(i + 1) - pz(i), l = Math.hypot(dx, dz) || 1; ax += -dz / l; az += dx / l; }
        const al = Math.hypot(ax, az) || 1; for (const o of [-2, 2]) { pos.push(px(i), 0.9, pz(i)); nrm.push(ax / al, az / al); off.push(o); half.push(2); cl.push(c.r, c.g, c.b); v++; } }
      for (let i = 0; i < k - 1; i++) { const b = v0 + i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    if (!v) continue; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 2)); geo.setAttribute('aOff', new THREE.Float32BufferAttribute(off, 1)); geo.setAttribute('aHalf', new THREE.Float32BufferAttribute(half, 1)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); geo.setIndex(idx);
    // 線本身：顏色固定（拉近不變柏油色）；外框白色
    const fill = ribbonMaterial(3.2, null, { asphalt: c.getHex(), walk: 0 }), casing = ribbonMaterial(3.2, 0xffffff, { asphalt: c.getHex(), walk: 0 }); casing.uniforms.uWalk.value.set(0xffffff); casing.uniforms.uGrowPx.value = 1.2;
    const m1 = new THREE.Mesh(geo, casing), m2 = new THREE.Mesh(geo, fill); m1.renderOrder = 30.5; m2.renderOrder = 30.6; m1.frustumCulled = m2.frustumCulled = false; group.add(m1, m2); lines.push({ ref: L.ref, name: L.name, color: '#' + c.getHexString(), segs: L.segs }); }
  scene.add(group);
  // 車站在哪幾條線上：離線 120 公尺內
  const segDist = (x, z, s) => { let best = 1e9; for (let i = 0; i + 3 < s.length; i += 2) { const ax = s[i] * 0.1, az = s[i + 1] * 0.1, bx = s[i + 2] * 0.1, bz = s[i + 3] * 0.1, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z)); } return best; };
  const stations = (mrt.stations || []).map(st => { const x = st.x * 0.1, z = st.z * 0.1; return { name: st.name, x, z, colors: lines.filter(L => L.segs.some(s => segDist(x, z, s) < 120)).map(L => L.color) }; });
  return { group, lines, stations, set visible(v) { group.visible = v; }, get visible() { return group.visible; } }; }
