/* 車子與紅綠燈的畫面（Q 版但比例照真實）：都用 InstancedMesh，一種車型一個；拉遠時在 vertex shader 依距離放大到至少幾個像素，車流和燈號拉遠也看得到。
   轎車（車窗、四個輪子）、計程車（黃色＋車頂燈）、公車（窗帶）、機車（騎士戴彩色安全帽）。紅綠燈：桿子＋橫臂＋三色燈箱，亮的那一顆是現在的燈。 */
import * as THREE from 'three';
import { lanePoint, connPoint, pointAt, heightAt, LANE_W } from './data.js';
import { shared } from './roads.js';

// 依鏡頭距離放大：uMinPx 像素、物件原本大小 size 公尺，最多放大 maxK 倍
function minPxMaterial(base, minPx, size, maxK) { base.onBeforeCompile = sh => { sh.uniforms.uPx = shared.uPx; sh.uniforms.uMinPx = { value: minPx };
    sh.vertexShader = 'uniform float uPx; uniform float uMinPx;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 icw = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0); transformed *= clamp(uMinPx * uPx * distance(cameraPosition, icw.xyz) / ${size.toFixed(2)}, 1.0, ${maxK.toFixed(1)});`); }; return base; }
// 幾個方塊合成一個模型；每塊有自己的顏色係數（乘上每台車的顏色），陣列表示固定顏色（輪子、車窗）
function boxes(parts) { const pos = [], nrm = [], col = [], idx = []; let base = 0;
  for (const [w, h, d, x, y, z, k] of parts) { const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z), p = g.attributes.position, n = g.attributes.normal, ix = g.index;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(n.getX(i), n.getY(i), n.getZ(i)); const top = n.getY(i) > 0.5 ? 1.08 : n.getY(i) < -0.5 ? 0.7 : 1; if (Array.isArray(k)) col.push(...k.map(c => c * top)); else col.push(k * top, k * top, k * top); }
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); base += p.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g; }
const WIN = [0.32, 0.38, 0.48], TIRE = [0.12, 0.12, 0.13];
const wheels = (L, W, r) => [[-L * 0.32, -1], [L * 0.32, -1], [-L * 0.32, 1], [L * 0.32, 1]].map(([x, s]) => [r * 2, r * 2, 0.28, x, r, s * (W / 2 - 0.08), TIRE]);
const GEO = {
  car: () => boxes([[4.3, 0.7, 1.78, 0, 0.62, 0, 1], [2.3, 0.62, 1.6, -0.25, 1.28, 0, WIN], [2.1, 0.08, 1.52, -0.25, 1.62, 0, 1.05], [0.12, 0.25, 1.5, 2.16, 0.7, 0, [1, 0.97, 0.85]], ...wheels(4.3, 1.78, 0.33)]),
  taxi: () => boxes([[4.3, 0.7, 1.78, 0, 0.62, 0, 1], [2.3, 0.62, 1.6, -0.25, 1.28, 0, WIN], [2.1, 0.08, 1.52, -0.25, 1.62, 0, 1.05], [0.5, 0.22, 0.32, -0.25, 1.77, 0, [1, 1, 0.95]], ...wheels(4.3, 1.78, 0.33)]),
  bus: () => boxes([[11.5, 2.3, 2.5, 0, 1.55, 0, 1], [11.0, 0.75, 2.52, 0, 1.95, 0, WIN], [11.3, 0.12, 2.4, 0, 2.75, 0, [0.95, 0.95, 0.93]], ...wheels(11.5, 2.5, 0.48)]),
  moto: () => boxes([[1.8, 0.45, 0.55, 0, 0.5, 0, [0.9, 0.9, 0.92]], [0.55, 0.75, 0.5, -0.1, 1.12, 0, [0.35, 0.38, 0.45]], [0.42, 0.38, 0.42, -0.1, 1.62, 0, 1], [0.5, 0.5, 0.14, -0.62, 0.28, 0, TIRE], [0.5, 0.5, 0.14, 0.62, 0.28, 0, TIRE]]) };
const PALETTE = [0xfbfbf7, 0xe9e6df, 0xdb6a41, 0x58a6a6, 0x3b3a42, 0xb9bec6, 0x9fb8d6, 0xc94f4f, 0x7fa35e, 0x2f4f7f, 0xf4efe6, 0x8a8f99];
const HELMET = [0xdb6a41, 0xf2c14e, 0x58a6a6, 0xfbfbf7, 0xe36f9a, 0x2f6f9f, 0x7fa35e, 0x3b3a42];
const BUS = [0x2f6f9f, 0x3d8f8a, 0xc94f4f];
export function createCars(scene, max) {
  const mk = (geo, n, size) => { const m = new THREE.InstancedMesh(geo, minPxMaterial(new THREE.MeshLambertMaterial({ vertexColors: true }), 6, size, 40), n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.renderOrder = 50; m.setColorAt(0, new THREE.Color()); m.instanceColor.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; };
  const M = [mk(GEO.car(), max, 4.4), mk(GEO.taxi(), Math.ceil(max * 0.35), 4.4), mk(GEO.bus(), Math.ceil(max * 0.12), 11.5), mk(GEO.moto(), Math.ceil(max * 0.5), 1.9)]; // 種類 0 轎車、1 計程車、2 公車、3 機車
  const crash = mk(GEO.car(), 64, 4.4);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3(), tmp = { x: 0, z: 0, y: 0, dx: 1, dz: 0, seg: 0 };
  const C_TAXI = new THREE.Color(0xf2c14e), C_CRASH = new THREE.Color(0xc23b2a), pal = PALETTE.map(h => new THREE.Color(h)), hel = HELMET.map(h => new THREE.Color(h)), bus = BUS.map(h => new THREE.Color(h));
  // 只畫在 (cx,cz) 半徑 r 內的車
  function update(net, V, cx, cz, r) { const n = [0, 0, 0, 0], r2 = r * r; let nc = 0;
    for (const v of V) { const L = v.L; if (L.lv < 0) continue;
      if (v.conn && v.s < L.s0) connPoint(v.conn, v.s - v.connFrom, tmp); else { tmp.seg = v.seg; lanePoint(net, L, v.lane, v.s, tmp); v.seg = tmp.seg; } // 在路口曲線上，或在車道上
      const x = tmp.x, z = tmp.z; if ((x - cx) * (x - cx) + (z - cz) * (z - cz) > r2) continue;
      const k = Math.min(1, v.age / 0.8), mesh = v.fixed ? crash : M[v.kind], i = v.fixed ? nc : n[v.kind]; if (i >= mesh.instanceMatrix.count) continue;
      const yaw = -Math.atan2(tmp.dz, tmp.dx) + (v.fixed ? 0.5 : 0); q.setFromAxisAngle(UP, yaw); P.set(x - tmp.dx * v.len / 2, tmp.y + 0.62, z - tmp.dz * v.len / 2); S.set(k, k, k); m4.compose(P, q, S); mesh.setMatrixAt(i, m4); // v.s 是車頭，模型中心往後半個車長
      mesh.setColorAt(i, v.fixed ? C_CRASH : v.kind === 1 ? C_TAXI : v.kind === 2 ? bus[v.col % 3] : v.kind === 3 ? hel[v.col % hel.length] : pal[v.col % pal.length]); if (v.fixed) nc++; else n[v.kind]++; }
    M.forEach((m, j) => { m.count = n[j]; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }); crash.count = nc; crash.instanceMatrix.needsUpdate = true; crash.instanceColor.needsUpdate = true; return n[0] + n[1] + n[2] + n[3]; }
  const meshes = [...M, crash];
  return { meshes, set visible(on) { for (const m of meshes) m.visible = on; }, get visible() { return M[0].visible; }, update }; }

// 紅綠燈：每個路口的每個進入方向一組（桿子＋橫臂＋燈箱＋亮的那顆燈）
export function createLamps(scene, net, sig) {
  const list = []; for (const c of sig.list) for (const L of c.appr) list.push(L); const n = Math.max(1, list.length);
  const lamp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 8), minPxMaterial(new THREE.MeshBasicMaterial(), 5, 0.85, 900), n);
  const steel = new THREE.MeshLambertMaterial({ vertexColors: true });
  const pole = new THREE.InstancedMesh(boxes([[0.32, 6.2, 0.32, 0, 3.1, 0, [0.42, 0.42, 0.44]]]), steel, n), arm = new THREE.InstancedMesh(boxes([[0.2, 0.2, 1, 0, 0, 0.5, [0.42, 0.42, 0.44]]]), steel, n), head = new THREE.InstancedMesh(boxes([[0.55, 1.6, 0.6, 0, 0, 0, [0.16, 0.17, 0.2]]]), steel, n);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), tmp = { x: 0, z: 0, dx: 1, dz: 0, seg: 0 }, G = new THREE.Color(0x3fd06a), Yc = new THREE.Color(0xffc93a), R = new THREE.Color(0xff3b2a), F = new THREE.Color(0xffa020), OFF = new THREE.Color(0x3a3530), last = new Array(list.length).fill('');
  list.forEach((L, i) => { const s = Math.max(0, L.len - L.stop), e = net.edges[L.e]; pointAt(L.pts, L.cum, s, tmp); const reach = (e.f > 0 && e.r > 0 ? L.lanes * LANE_W : L.lanes * LANE_W / 2), lat = reach + 1.2;
    const x = tmp.x - tmp.dz * lat, z = tmp.z + tmp.dx * lat, y = heightAt(net, e, L.dir > 0 ? s : L.len - s), len = Math.min(6.5, reach * 0.6), hx = x + tmp.dz * len, hz = z - tmp.dx * len; // 桿子在路的右邊，橫臂往路中間伸
    m4.makeTranslation(x, y, z); pole.setMatrixAt(i, m4);
    q.setFromAxisAngle(UP, Math.atan2(tmp.dz, -tmp.dx)); m4.compose(new THREE.Vector3(x, y + 5.9, z), q, new THREE.Vector3(1, 1, len)); arm.setMatrixAt(i, m4);
    m4.makeTranslation(hx, y + 5.6, hz); head.setMatrixAt(i, m4);
    m4.makeTranslation(hx - tmp.dx * 0.33, y + 5.6, hz - tmp.dz * 0.33); lamp.setMatrixAt(i, m4); lamp.setColorAt(i, R); }); // 燈朝著開過來的車
  lamp.count = pole.count = arm.count = head.count = list.length; lamp.renderOrder = 60; scene.add(lamp, pole, arm, head); for (const m of [lamp, pole, arm, head]) m.frustumCulled = false;
  const poles = { set visible(on) { pole.visible = arm.visible = head.visible = on; }, get visible() { return pole.visible; } };
  function update(t) { let ch = false; const blink = Math.floor(t * 1.5) % 2; for (let i = 0; i < list.length; i++) { let st = sig.linkState(list[i], t); if (st === 'f') st = blink ? 'f' : 'o'; if (st !== last[i]) { last[i] = st; lamp.setColorAt(i, st === 'g' ? G : st === 'y' ? Yc : st === 'f' ? F : st === 'o' ? OFF : R); ch = true; } } if (ch) lamp.instanceColor.needsUpdate = true; }
  function dispose() { scene.remove(lamp, pole, arm, head); for (const m of [lamp, pole, arm, head]) m.dispose(); }
  return { lamp, pole: poles, update, dispose, count: list.length }; }
