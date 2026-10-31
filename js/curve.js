/* 彎曲地平線（動物森友會的「滾木」效果）：用 onBeforeCompile 改 MeshStandardMaterial（或任何內建材質）的頂點著色器，
   讓頂點離相機越遠就往下彎：y −= k × d²。d 的算法有兩種：
   - log（滾木，預設）：d = 沿「相機水平前方」的距離 − 平坦區，左右不彎，像站在一根橫放的大圓木上；
   - sphere（球）：d = 水平面上離相機的距離 − 平坦區，四面八方一起彎，像小行星。
   彎曲在世界座標裡做（往世界的下方彎，相機俯仰角怎麼變都一樣），做完再換回物件座標，
   所以後面的投影、霧、陰影接收（worldpos_vertex）都吃到彎過的位置；法線也跟著轉同樣的角度，遠處的光影才會跟著地面彎下去。
   陰影投射：陰影貼圖用另一個深度材質畫，要用 curvedDepthMaterial() 當 mesh.customDepthMaterial，影子才會跟著彎（curveObject 會自動處理）。
   支援 InstancedMesh（會算進 instanceMatrix）。曲率 k 和半徑 R 的關係：y ≈ −d² / (2R)，所以 R = 1 / (2k)。
   用法：applyCurve(material)；每幀 render 前呼叫 updateCurve(camera)；調整 CURVE.uCurve.value 等參數。 */
import * as THREE from 'three';
export const CURVE = {
  uCurve: { value: 0.006 },                 // 曲率 k（越大彎得越快）
  uCurveFlat: { value: 3.0 },               // 相機前方這段距離內不彎（腳邊保持平的）
  uCurveCam: { value: new THREE.Vector3() }, // 相機的世界座標（updateCurve 每幀更新）
  uCurveFwd: { value: new THREE.Vector2(0, -1) }, // 相機在水平面上的前方（單位向量，x 和 z）
  uCurveMode: { value: 0 },                 // 0 = log（只沿前方彎）、1 = sphere（往四周彎）
  uCurveOn: { value: 1 },                   // 0 = 關掉（同一個材質不用重新編譯）
};
export const radiusFor = k => 1 / (2 * Math.max(k, 1e-6)); // 等效的圓柱／球半徑
const HEAD = /* glsl */`
uniform float uCurve; uniform float uCurveFlat; uniform vec3 uCurveCam; uniform vec2 uCurveFwd; uniform float uCurveMode; uniform float uCurveOn;
mat4 curveModel() { mat4 m = modelMatrix;
#ifdef USE_INSTANCING
  m = m * instanceMatrix;
#endif
  return m; }
float curveDist(vec2 rel) { float d = uCurveMode > 0.5 ? length(rel) : dot(rel, uCurveFwd); return max(d - uCurveFlat, 0.0); }
vec2 curveDir(vec2 rel) { if (uCurveMode > 0.5) { float L = length(rel); return L > 1e-4 ? rel / L : uCurveFwd; } return uCurveFwd; }
`;
// 法線：地面 y = −k d² 的斜率是 −2kd，把法線往「離開相機的方向」轉 atan(2kd)
const NORMAL = /* glsl */`
#include <beginnormal_vertex>
if (uCurveOn > 0.5 && abs(determinant(curveModel())) > 1e-12) { mat4 cm = curveModel(); vec4 cwp = cm * vec4(position, 1.0); vec2 crel = cwp.xz - uCurveCam.xz; float cd = curveDist(crel);
  if (cd > 0.0) { vec2 cdir = curveDir(crel); float th = atan(2.0 * uCurve * cd), cs = cos(th), sn = sin(th); vec3 ax = normalize(cross(vec3(0.0, 1.0, 0.0), vec3(cdir.x, 0.0, cdir.y)));
    mat3 m3 = mat3(cm); vec3 nw = m3 * objectNormal; nw = nw * cs + cross(ax, nw) * sn + ax * dot(ax, nw) * (1.0 - cs); objectNormal = inverse(m3) * nw; } }
`;
// 位置：換到世界座標往下彎，再換回物件座標（transformed 之後所有的 chunk 都用彎過的位置）
const POSITION = /* glsl */`
#include <begin_vertex>
if (uCurveOn > 0.5 && abs(determinant(curveModel())) > 1e-12) { mat4 cm = curveModel(); vec4 cwp = cm * vec4(transformed, 1.0); float cd = curveDist(cwp.xz - uCurveCam.xz); cwp.y -= uCurve * cd * cd; transformed = (inverse(cm) * cwp).xyz; }
`;
// 把彎曲加到一個材質上（會保留材質原本的 onBeforeCompile，例如建築的透視切面）
export function applyCurve(mat) { if (!mat || mat.userData.curved) return mat; const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (shader, renderer) => { if (prev) prev.call(mat, shader, renderer); Object.assign(shader.uniforms, CURVE);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + HEAD).replace('#include <beginnormal_vertex>', NORMAL).replace('#include <begin_vertex>', POSITION); };
  mat.customProgramCacheKey = () => prevKey() + '|curve'; mat.userData.curved = true; mat.needsUpdate = true; return mat; }
// 陰影用的深度材質（陰影跟著彎）
export function curvedDepthMaterial() { return applyCurve(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })); }
// 整棵物件樹：每個 mesh 的材質加上彎曲、陰影用彎過的深度材質；彎下去的東西可能跑出原本的包圍盒，關掉視錐剔除比較保險
let sharedDepth = null;
export function curveObject(root, { cull = false } = {}) { root.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(applyCurve); if (!sharedDepth) sharedDepth = curvedDepthMaterial(); o.customDepthMaterial = sharedDepth; if (!cull) o.frustumCulled = false; }); return root; }
// 每幀 render 前：記下彎曲的中心（預設是相機位置；遊戲傳鏡頭看的那一點，前景就不彎、只有它後面往下彎）與水平前方
const _f = new THREE.Vector3();
export function updateCurve(camera, pivot = null) { camera.updateMatrixWorld(); if (pivot) CURVE.uCurveCam.value.copy(pivot); else CURVE.uCurveCam.value.setFromMatrixPosition(camera.matrixWorld); camera.getWorldDirection(_f); const L = Math.hypot(_f.x, _f.z); if (L > 1e-4) CURVE.uCurveFwd.value.set(_f.x / L, _f.z / L); }
// 在 CPU 端算一個點彎完的高度（要把 DOM 名牌、點擊判定對齊彎過的畫面時用）
export function curvedY(x, y, z) { if (CURVE.uCurveOn.value < 0.5) return y; const c = CURVE.uCurveCam.value, f = CURVE.uCurveFwd.value, rx = x - c.x, rz = z - c.z;
  const d = Math.max((CURVE.uCurveMode.value > 0.5 ? Math.hypot(rx, rz) : rx * f.x + rz * f.y) - CURVE.uCurveFlat.value, 0); return y - CURVE.uCurve.value * d * d; }
// 手寫的 ShaderMaterial（水、草）用：在世界座標呼叫 curveWorldPos(w)，uniforms 要 Object.assign(mat.uniforms, CURVE)
export const CURVE_WORLD_GLSL = /* glsl */`
uniform float uCurve; uniform float uCurveFlat; uniform vec3 uCurveCam; uniform vec2 uCurveFwd; uniform float uCurveMode; uniform float uCurveOn;
vec3 curveWorldPos(vec3 w) { if (uCurveOn < 0.5) return w; vec2 rel = w.xz - uCurveCam.xz; float d = uCurveMode > 0.5 ? length(rel) : dot(rel, uCurveFwd); d = max(d - uCurveFlat, 0.0); w.y -= uCurve * d * d; return w; }
`;
// Sprite（頭上的字、血條）：sprite 只有中心點一個位置，把中心點彎下去
const SPRITE_POS = 'vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );';
export function applyCurveSprite(mat) { if (!mat || mat.userData.curved) return mat; const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => { if (prev) prev.call(mat, shader, renderer); Object.assign(shader.uniforms, CURVE);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + CURVE_WORLD_GLSL).replace(SPRITE_POS, 'vec4 mvPosition = viewMatrix * vec4(curveWorldPos((modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz), 1.0);'); };
  mat.customProgramCacheKey = () => 'curve-sprite'; mat.userData.curved = true; mat.needsUpdate = true; return mat; }
// 掃過整棵場景樹：還沒彎的材質加上彎曲、會投影的 mesh 換彎過的陰影深度材質、關掉視錐剔除（彎下去的東西會跑出包圍盒）。
// userData.noCurve 的物件（連同子物件）跳過；手寫的 ShaderMaterial 不動（它們自己呼叫 curveWorldPos）。新加進場景的東西多掃幾次就會補上。
export function curveSweep(root) { if (root.userData.noCurve) return; const mats = root.material ? (Array.isArray(root.material) ? root.material : [root.material]) : [];
  if (root.isSprite) mats.forEach(applyCurveSprite);
  else if (root.isMesh || root.isPoints || root.isLine) { mats.forEach(m => { if (!m.isShaderMaterial) applyCurve(m); }); if (root.isMesh && root.castShadow && !root.customDepthMaterial) { if (!sharedDepth) sharedDepth = curvedDepthMaterial(); root.customDepthMaterial = sharedDepth; } root.frustumCulled = false; }
  for (const c of root.children) curveSweep(c); }
