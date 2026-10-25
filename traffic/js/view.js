/* 車子與紅綠燈的畫面：都用 InstancedMesh（一次畫完），拉遠時在 vertex shader 依距離放大到至少幾個像素，車流和燈號拉遠也看得到。 */
import * as THREE from 'three';
import { LANE_W, pointAt, heightAt } from './data.js';
import { shared } from './roads.js';

// 依鏡頭距離放大：uMinPx 像素、物件原本大小 size 公尺，最多放大 maxK 倍
function minPxMaterial(base, minPx, size, maxK) { base.onBeforeCompile = sh => { sh.uniforms.uPx = shared.uPx; sh.uniforms.uMinPx = { value: minPx };
    sh.vertexShader = 'uniform float uPx; uniform float uMinPx;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 icw = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); transformed *= clamp(uMinPx * uPx * distance(cameraPosition, icw.xyz) / ${size.toFixed(2)}, 1.0, ${maxK.toFixed(1)});`); }; return base; }

function carGeometry() { const parts = [new THREE.BoxGeometry(4.4, 1.0, 1.8).translate(0, 0.75, 0), new THREE.BoxGeometry(2.3, 0.75, 1.6).translate(-0.25, 1.6, 0)];
  const pos = [], nrm = [], col = [], idx = []; let base = 0;
  parts.forEach((g, gi) => { const p = g.attributes.position, n = g.attributes.normal, ix = g.index; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(n.getX(i), n.getY(i), n.getZ(i)); const k = gi === 1 ? (n.getY(i) > 0.5 ? 0.92 : 0.55) : 1; col.push(k, k, gi === 1 && n.getY(i) <= 0.5 ? k * 1.15 : k); } for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); base += p.count; }); // 車窗偏深藍
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g; }
const PALETTE = [0xfbfbf7, 0xdb6a41, 0x58a6a6, 0x3b3a42, 0xc9c4bb, 0x9fb8d6, 0xe6b796, 0x7fa35e, 0xb25b5b, 0xf4efe6];
export function createCars(scene, max) {
  const mesh = new THREE.InstancedMesh(carGeometry(), minPxMaterial(new THREE.MeshLambertMaterial({ vertexColors: true }), 6, 4.4, 40), max); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 50;
  mesh.setColorAt(0, new THREE.Color()); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3(), col = new THREE.Color(), tmp = { x: 0, z: 0, dx: 1, dz: 0, seg: 0 };
  const C_TAXI = new THREE.Color(0xf2c14e), C_BUS = new THREE.Color(0x2f6f9f), pal = PALETTE.map(h => new THREE.Color(h));
  // 只畫在 (cx,cz) 半徑 r 內的車
  function update(net, V, cx, cz, r) { let n = 0; const r2 = r * r;
    for (const v of V) { if (n >= max) break; const L = v.L; if (L.lv < 0) continue; pointAt(L.pts, L.cum, Math.min(v.s, L.len), tmp, v.seg); v.seg = tmp.seg;
      const lat = L.off0 + v.lane * LANE_W, x = tmp.x - tmp.dz * lat, z = tmp.z + tmp.dx * lat; if ((x - cx) * (x - cx) + (z - cz) * (z - cz) > r2) continue;
      const e = net.edges[L.e], y = heightAt(net, e, L.dir > 0 ? v.s : L.len - v.s) + 0.7; const k = Math.min(1, v.age / 0.8);
      q.setFromAxisAngle(UP, -Math.atan2(tmp.dz, tmp.dx)); P.set(x, y, z); S.set(k * v.len / 4.4, k * (v.kind === 2 ? 1.6 : 1), k * (v.kind === 2 ? 1.4 : 1)); m4.compose(P, q, S); mesh.setMatrixAt(n, m4);
      mesh.setColorAt(n, v.kind === 1 ? C_TAXI : v.kind === 2 ? C_BUS : pal[v.col % pal.length]); n++; }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; return n; }
  return { mesh, update }; }

// 紅綠燈：每個路口的每個進入方向一支桿子＋一顆燈（燈色跟著那個方向的時相）
export function createLamps(scene, net, sig) {
  const list = []; for (const c of sig.list) for (const L of c.appr) list.push(L);
  const lamp = new THREE.InstancedMesh(new THREE.SphereGeometry(1.1, 10, 8), minPxMaterial(new THREE.MeshBasicMaterial(), 5, 2.2, 400), Math.max(1, list.length));
  const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 6).translate(0, 3, 0), new THREE.MeshLambertMaterial({ color: 0x5c5650 }), Math.max(1, list.length));
  const m4 = new THREE.Matrix4(), tmp = { x: 0, z: 0, dx: 1, dz: 0, seg: 0 }, G = new THREE.Color(0x4fae4a), Yc = new THREE.Color(0xf2c14e), R = new THREE.Color(0xd8402c), last = new Array(list.length).fill('');
  list.forEach((L, i) => { const s = Math.max(0, L.len - L.stop), e = net.edges[L.e]; pointAt(L.pts, L.cum, s, tmp); const lat = (e.f > 0 && e.r > 0 ? L.lanes * LANE_W : L.lanes * LANE_W / 2) + 1.4; const x = tmp.x - tmp.dz * lat, z = tmp.z + tmp.dx * lat, y = heightAt(net, e, L.dir > 0 ? s : L.len - s);
    m4.makeTranslation(x, y, z); pole.setMatrixAt(i, m4); m4.makeTranslation(x, y + 6.4, z); lamp.setMatrixAt(i, m4); lamp.setColorAt(i, R); });
  lamp.count = pole.count = list.length; lamp.renderOrder = 60; scene.add(lamp, pole); lamp.frustumCulled = pole.frustumCulled = false;
  function update(t) { let ch = false; for (let i = 0; i < list.length; i++) { const st = sig.linkState(list[i], t); if (st !== last[i]) { last[i] = st; lamp.setColorAt(i, st === 'g' ? G : st === 'y' ? Yc : R); ch = true; } } if (ch) lamp.instanceColor.needsUpdate = true; }
  function dispose() { scene.remove(lamp, pole); lamp.dispose(); pole.dispose(); }
  return { lamp, pole, update, dispose, count: list.length }; }
