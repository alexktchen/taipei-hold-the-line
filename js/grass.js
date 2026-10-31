/* 會隨風擺動的草叢（和 cozy-farm/ 同一套做法）：一叢＝3 片細長草葉，全部收進一個 InstancedMesh。
   位置：每個學期區塊步道環外圈到圍欄之間那一圈（避開門口、泥土地的區塊不長），和小鎮外圍的野地（避開河、新校區）。
   vertex shader：葉尖用兩層正弦隨風擺、自己走過時往外倒；跟著地平線一起彎；顏色依時間乘一個光色（草不吃燈光，晚上變藍紫）。 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry } from './env.js';
import { CURVE, CURVE_WORLD_GLSL } from './curve.js';
import { H, RING_H, TOP, SPACING, NEIGHBORS, RIVER_HW, cellKey } from './islands.js';
const DIRT = new Set(['gravel', 'boardwalk', 'courtyard', 'ringtile']);
const TINT = { wild: [0x5f9a3e, 0xa8d878], forest: [0x5f9a3e, 0xa8d878] }, DEF = [0x6fae4a, 0xc0e58a]; // [根部, 葉尖]
export function createGrass(scene, world, { quality = 'medium', rivers = [] } = {}) {
  const rnd = mulberry(77), max = quality === 'low' ? 3500 : quality === 'high' ? 11000 : 7500;
  // 一叢草：三片往不同方向張開的葉子（底寬頂尖），uv.y 0＝根、1＝尖
  const blade = (yaw, lean) => { const g = new THREE.PlaneGeometry(0.035, 0.2, 1, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.1; p.setXYZ(i, p.getX(i) * (1 - (y / 0.2) * 0.85), y, y * lean); } return g.rotateY(yaw); };
  const geo = mergeGeometries([blade(0, 0.25), blade(2.1, 0.3), blade(4.2, 0.2)]);
  const tint = new Float32Array(max * 6); const spots = [];
  const nearRiver = (x, z) => rivers.some(rv => rv.axis === 'z' ? Math.abs(z - rv.at * SPACING) < RIVER_HW + 0.35 : Math.abs(x - rv.at * SPACING) < RIVER_HW + 0.35);
  const cellAt = (x, z) => world.cells.get(cellKey(Math.round(x / SPACING), Math.round(z / SPACING)));
  // 1) 區塊外圈（步道外緣 RING_H+0.3 到圍欄內 H−0.12）
  const zones = [...world.cells.values()].filter(Z => Z.zone && !DIRT.has(Z.isl && Z.isl.ground));
  const bandN = Math.floor(max * 0.45 / Math.max(1, zones.length));
  for (const Z of zones) { const gateSide = NEIGHBORS.map(([dq, dr]) => world.gates.some(g => (g.a === Z.id || g.b === Z.id) && Math.sign(Math.round(g.x - Z.c.x)) === dq && Math.sign(Math.round(g.z - Z.c.z)) === dr));
    let got = 0; for (let k = 0; k < bandN * 3 && got < bandN; k++) { const lx = (rnd() * 2 - 1) * (H - 0.12), lz = (rnd() * 2 - 1) * (H - 0.12), m = Math.max(Math.abs(lx), Math.abs(lz)); if (m < RING_H + 0.3) continue;
      const s = Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? 1 : 3) : (lz > 0 ? 2 : 0), along = s % 2 ? lz : lx; if (gateSide[s] && Math.abs(along) < 0.8) continue; // 門口留空
      if (nearRiver(Z.c.x + lx, Z.c.z + lz)) continue; spots.push({ x: Z.c.x + lx, z: Z.c.z + lz, c: DEF }); got++; } }
  // 2) 野地：小鎮格子外圍幾格的範圍內，越靠近小鎮越密
  const all = [...world.cells.values()]; const x0 = Math.min(...all.map(z => z.c.x)) - H - 7, x1 = Math.max(...all.map(z => z.c.x)) + H + 7, z0 = Math.min(...all.map(z => z.c.z)) - H - 7, z1 = Math.max(...all.map(z => z.c.z)) + H + 7;
  for (let k = 0; k < max * 6 && spots.length < max; k++) { const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), C = cellAt(x, z); if (C && (C.zone || C.campus)) { if (Math.abs(x - C.c.x) < H + 0.25 && Math.abs(z - C.c.z) < H + 0.25) continue; }
    if (nearRiver(x, z)) continue; const edge = Math.min(x - x0, x1 - x, z - z0, z1 - z); if (rnd() > Math.min(1, edge / 5)) continue; spots.push({ x, z, c: TINT.wild }); }
  const n = Math.min(max, spots.length);
  const mat = new THREE.ShaderMaterial({ fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3(1e4, 0, 1e4) }, uLight: { value: new THREE.Color(1, 1, 1) } }]),
    vertexShader: /* glsl */`${CURVE_WORLD_GLSL}
      uniform float uTime; uniform vec3 uPlayer; attribute vec3 aBase; attribute vec3 aTip; varying vec3 vCol; varying float vVar;
      #include <fog_pars_vertex>
      void main() { float t = clamp(uv.y, 0.0, 1.0); vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vec3 root = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float wind = sin(uTime * 1.7 + root.x * 1.6 + root.z * 1.1) * 0.5 + sin(uTime * 2.9 + root.x * 3.7) * 0.2; // 兩層正弦＝不規則的風
        w.x += wind * 0.035 * t * t; w.z += wind * 0.014 * t * t;
        vec2 away = root.xz - uPlayer.xz; float dd = length(away), push = (1.0 - smoothstep(0.05, 0.32, dd)) * 0.09 * t; // 自己附近的草往外倒
        if (dd > 0.001) w.xz += away / dd * push; w.y -= push * 0.4;
        vVar = fract(sin(dot(root.xz, vec2(12.9898, 78.233))) * 43758.5453); vCol = mix(aBase, aTip, t);
        w.xyz = curveWorldPos(w.xyz); vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLight; varying vec3 vCol; varying float vVar;
      #include <fog_pars_fragment>
      void main() { gl_FragColor = vec4(vCol * (0.86 + vVar * 0.26) * uLight, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` });
  Object.assign(mat.uniforms, CURVE); // 共用彎曲 uniform（merge 會複製值，所以另外接上）
  const base = new Float32Array(n * 3), tip = new Float32Array(n * 3), cb = new THREE.Color(), ct = new THREE.Color();
  const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.raycast = () => {}; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let i = 0; i < n; i++) { const s = spots[i], k = 0.7 + rnd() * 0.7; m4.compose(v.set(s.x, TOP, s.z), q.setFromEuler(e.set(0, rnd() * 6.28, 0)), sc.set(k, k * (0.8 + rnd() * 0.5), k)); im.setMatrixAt(i, m4);
    cb.setHex(s.c[0]); ct.setHex(s.c[1]); base.set([cb.r, cb.g, cb.b], i * 3); tip.set([ct.r, ct.g, ct.b], i * 3); }
  geo.setAttribute('aBase', new THREE.InstancedBufferAttribute(base, 3)); geo.setAttribute('aTip', new THREE.InstancedBufferAttribute(tip, 3));
  scene.add(im);
  const night = new THREE.Color(0.42, 0.46, 0.78), white = new THREE.Color(1, 1, 1), sunT = new THREE.Color();
  return { mesh: im,
    // 每幀：時間、自己的位置（沒有就傳 null）、光色（夜晚程度＋太陽色）
    update(time, playerPos, nightK = 0, sunColor = null) { mat.uniforms.uTime.value = time; if (playerPos) mat.uniforms.uPlayer.value.copy(playerPos); else mat.uniforms.uPlayer.value.set(1e4, 0, 1e4);
      const L = mat.uniforms.uLight.value.copy(white).lerp(night, nightK); if (sunColor) L.multiply(sunT.copy(white).lerp(sunColor, 0.3)); } };
}
