/* 道路畫成帶狀（ribbon）：真實寬度＝車道數×3.2 公尺，但拉遠時至少有幾個像素寬（在 vertex shader 依鏡頭距離放寬），所以整個台北看起來像地圖。
   雙向道路分左右兩半，各自依那個方向的車速上色（路況）；單向路整條同一色。
   依等級分四層（快速道路、主要幹道、次要與三級路、巷弄），層與層之間墊一點高度避免閃爍，各層可以依縮放顯示或隱藏。
   另外：陸地、市界外、河川、綠地（多邊形三角化）與市界、行政區界線。 */
import * as THREE from 'three';
import { LANE_W, heightAt } from './data.js';

export const GROUPS = [{ cls: [0, 1], y: 0.6, minPx: 3.2, casing: 0xd08a3c, base: 0xf7c86a }, { cls: [2], y: 0.45, minPx: 2.6, casing: 0xc4b39b, base: 0xffffff }, { cls: [3, 4], y: 0.3, minPx: 1.7, casing: 0xcdbfaa, base: 0xfffcf6 }, { cls: [5, 6], y: 0.15, minPx: 1.0, casing: 0xd6cab8, base: 0xfdfaf4 }];
export const FLOW = [[0.12, 0x8a2318], [0.3, 0xc23b2a], [0.5, 0xe8893a], [0.72, 0xf2c14e], [9, 0x5f9a4c]];
const flowHex = r => { for (const [k, c] of FLOW) if (r < k) return c; return 0x5f9a4c; };

const VERT = `
attribute vec2 aN; attribute float aOff; attribute float aHalf; attribute vec3 color;
uniform float uPx; uniform float uMinPx; uniform float uGrowPx; uniform float uCasing; uniform vec3 uCasingColor;
varying vec3 vCol;
#include <fog_pars_vertex>
void main(){
  vec3 p = position; float dist = distance(cameraPosition, (modelMatrix * vec4(p, 1.0)).xyz); float px = uPx * dist;
  float off = aOff * max(1.0, 0.5 * uMinPx * px / max(aHalf, 0.1));
  if (uCasing > 0.5) off += sign(aOff) * uGrowPx * px;
  p.x += aN.x * off; p.z += aN.y * off; p.y -= uCasing * 0.08;
  vCol = uCasing > 0.5 ? uCasingColor : color;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = `
uniform float uOpacity; varying vec3 vCol;
#include <fog_pars_fragment>
void main(){ gl_FragColor = vec4(vCol, uOpacity);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
export const shared = { uPx: { value: 0.001 } };
// 地面上的東西（陸地、水、綠地、道路）都不做深度測試，照 renderOrder 由下往上畫：不會互相閃爍，建築和車照常做深度測試蓋在上面
export function ribbonMaterial(minPx, casingHex) { const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, fog: true, transparent: false, side: THREE.DoubleSide, depthTest: false, depthWrite: false,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMinPx: { value: minPx }, uGrowPx: { value: 1.1 }, uCasing: { value: casingHex != null ? 1 : 0 }, uCasingColor: { value: new THREE.Color(casingHex || 0) }, uOpacity: { value: 1 } }]) });
  m.uniforms.uPx = shared.uPx; return m; } // 每像素幾公尺（依視窗高度與視角），所有道路共用

// 一層道路的幾何：minorStyle＝每點 2 個頂點（整條同色，巷弄用，省記憶體）；否則每點 4 個頂點（左右兩半分開上色）
function buildGroup(net, edges, g, split) {
  let nv = 0, ni = 0; for (const e of edges) { const k = e.pts.length / 2; nv += k * (split ? 4 : 2); ni += (k - 1) * (split ? 12 : 6); }
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 2), off = new Float32Array(nv), half = new Float32Array(nv), col = new Uint8Array(nv * 3), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const base = new THREE.Color(g.base), br = Math.round(base.r * 255), bg = Math.round(base.g * 255), bb = Math.round(base.b * 255);
  let v = 0, ii = 0;
  for (const e of edges) { const P = e.pts, k = P.length / 2, two = e.f > 0 && e.r > 0, lo = two ? -e.r * LANE_W : -e.f * LANE_W / 2, hi = two ? e.f * LANE_W : e.f * LANE_W / 2, hw = (hi - lo) / 2, v0 = v;
    for (let i = 0; i < k; i++) { // 轉角用斜接（miter），太尖的角限制放大倍數
      let ax = 0, az = 0; if (i > 0) { const dx = P[i * 2] - P[i * 2 - 2], dz = P[i * 2 + 1] - P[i * 2 - 1], L = Math.hypot(dx, dz) || 1; ax += -dz / L; az += dx / L; }
      if (i < k - 1) { const dx = P[i * 2 + 2] - P[i * 2], dz = P[i * 2 + 3] - P[i * 2 + 1], L = Math.hypot(dx, dz) || 1; ax += -dz / L; az += dx / L; }
      const al = Math.hypot(ax, az) || 1; let nx = ax / al, nz = az / al; if (i > 0 && i < k - 1) { const dx = P[i * 2 + 2] - P[i * 2], dz = P[i * 2 + 3] - P[i * 2 + 1], L = Math.hypot(dx, dz) || 1; const c = Math.max(0.35, nx * (-dz / L) + nz * (dx / L)); nx /= c; nz /= c; }
      const y = heightAt(net, e, e.cum[i]) + g.y, offs = split ? [lo, 0, 0, hi] : [lo, hi];
      for (const o of offs) { pos[v * 3] = P[i * 2]; pos[v * 3 + 1] = y; pos[v * 3 + 2] = P[i * 2 + 1]; nrm[v * 2] = nx; nrm[v * 2 + 1] = nz; off[v] = o; half[v] = hw; col[v * 3] = br; col[v * 3 + 1] = bg; col[v * 3 + 2] = bb; v++; } }
    const per = split ? 4 : 2;
    for (let i = 0; i < k - 1; i++) { const b = v0 + i * per, n = b + per;
      if (split) { idx[ii++] = b; idx[ii++] = b + 1; idx[ii++] = n; idx[ii++] = b + 1; idx[ii++] = n + 1; idx[ii++] = n; idx[ii++] = b + 2; idx[ii++] = b + 3; idx[ii++] = n + 2; idx[ii++] = b + 3; idx[ii++] = n + 3; idx[ii++] = n + 2; }
      else { idx[ii++] = b; idx[ii++] = b + 1; idx[ii++] = n; idx[ii++] = b + 1; idx[ii++] = n + 1; idx[ii++] = n; } }
    e.rv = { start: v0, k, per, two }; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aN', new THREE.BufferAttribute(nrm, 2)); geo.setAttribute('aOff', new THREE.BufferAttribute(off, 1)); geo.setAttribute('aHalf', new THREE.BufferAttribute(half, 1));
  const ca = new THREE.BufferAttribute(col, 3, true); ca.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('color', ca); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere(); return { geo, base: [br, bg, bb] }; }

export function createRoads(scene, net) {
  const layers = GROUPS.map((g, gi) => ({ g, gi, meshes: [], parts: [] }));
  // edges 是新接進來的路（主要道路或巷弄）：依等級分到各層，各做一組網格
  function add(e0, e1) { for (const layer of layers) { const edges = []; for (let i = e0; i < e1; i++) { const e = net.edges[i]; if (layer.g.cls.includes(e.cls) && e.lv >= 0) edges.push(e); } if (!edges.length) continue;
      const split = layer.gi < 3, { geo, base } = buildGroup(net, edges, layer.g, split); const fill = new THREE.Mesh(geo, ribbonMaterial(layer.g.minPx, null)); fill.renderOrder = 20 + (3 - layer.gi); scene.add(fill);
      const part = { geo, base, edges, fill, casing: null }; for (const e of edges) e.part = part; layer.meshes.push(fill);
      if (layer.g.casing) { const cas = new THREE.Mesh(geo, ribbonMaterial(layer.g.minPx, layer.g.casing)); cas.renderOrder = 10 + (3 - layer.gi); scene.add(cas); part.casing = cas; layer.meshes.push(cas); }
      layer.parts.push(part); } }
  // 路況上色：只改這一段路的頂點顏色（髒了才改）
  const tmp = new THREE.Color();
  function paint(e, side, hexOrNull, part) { const rv = e.rv; if (!rv) return; const col = part.geo.attributes.color.array; let r, g, b; if (hexOrNull == null) [r, g, b] = part.base; else { tmp.setHex(hexOrNull); r = Math.round(tmp.r * 255); g = Math.round(tmp.g * 255); b = Math.round(tmp.b * 255); }
    for (let i = 0; i < rv.k; i++) { const b0 = rv.start + i * rv.per; const which = rv.per === 2 ? [0, 1] : !rv.two ? [0, 1, 2, 3] : side > 0 ? [2, 3] : [0, 1]; for (const w of which) { const o = (b0 + w) * 3; col[o] = r; col[o + 1] = g; col[o + 2] = b; } } part.dirty = true; }
  function updateFlow(on, now) { for (const L of net.links) { if (!L.colorDirty && !(on && L.seen && now - L.seen > 120)) continue; L.colorDirty = false; const e = net.edges[L.e]; if (!e.part) continue;
      const fresh = on && L.seen && now - L.seen < 120; if (e.rv.per === 2 && e.f > 0 && e.r > 0) { const o = net.links[e.links[L.dir > 0 ? 1 : 0]]; const r = fresh ? (o && o.seen && now - o.seen < 120 ? Math.min(L.ema, o.ema) : L.ema) : null; paint(e, 0, r == null ? null : flowHex(r), e.part); }
      else paint(e, L.dir, fresh ? flowHex(L.ema) : null, e.part); if (!fresh) L.seen = 0; }
    for (const layer of layers) for (const p of layer.parts) if (p.dirty) { p.dirty = false; p.geo.attributes.color.needsUpdate = true; } }
  function resetFlow() { for (const L of net.links) { L.colorDirty = true; } }
  function setVisible(gi, on) { for (const m of layers[gi].meshes) m.visible = on; }
  return { layers, add, updateFlow, resetFlow, setVisible }; }

// ── 多邊形（陸地、河川、綠地）──
export function polyMesh(polys, y, hex, scale = 0.1) { const pos = [], idx = []; let base = 0;
  for (const poly of polys) { const rings = poly.map(r => { const a = []; for (let i = 0; i < r.length - 2; i += 2) a.push(new THREE.Vector2(r[i] * scale, r[i + 1] * scale)); return a; }); if (!rings[0] || rings[0].length < 3) continue;
    let tris; try { tris = THREE.ShapeUtils.triangulateShape(rings[0], rings.slice(1)); } catch (e) { continue; }
    const all = rings.flat(); for (const p of all) pos.push(p.x, y, p.y); for (const t of tris) idx.push(base + t[0], base + t[1], base + t[2]); base += all.length; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(base > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, depthTest: false, depthWrite: false })); }
export function ringLine(ring, y, hex, dashed, scale = 0.1) { const pts = []; for (let i = 0; i < ring.length; i += 2) pts.push(new THREE.Vector3(ring[i] * scale, y, ring[i + 1] * scale));
  const geo = new THREE.BufferGeometry().setFromPoints(pts); const m = dashed ? new THREE.LineDashedMaterial({ color: hex, dashSize: 60, gapSize: 40, depthTest: false, depthWrite: false }) : new THREE.LineBasicMaterial({ color: hex, depthTest: false, depthWrite: false }); const line = new THREE.Line(geo, m); if (dashed) line.computeLineDistances(); return line; }
