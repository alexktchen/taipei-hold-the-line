/* 療癒系卡通畫風（和 cozy-farm/ 同一套做法）：
   - toonMat()：MeshToonMaterial＋4 階 gradientMap，取代原本的 MeshStandardMaterial（roughness／metalness／flatShading 這些卡通材質沒有的參數直接丟掉）；
   - 反向外殼描邊：outlineMat() 是 BackSide 的純色材質，頂點沿法線往外撐。撐多少在世界座標裡算：離鏡頭越遠越粗（畫面上看起來差不多粗），
     但不超過物件最細那一邊的 18%（細柵欄、小花不會被描成一團）；InstancedMesh 會算進 instanceMatrix，所以零件庫、方塊人都能共用 instanceMatrix 加描邊；
   - outlineGeo()：方塊的法線是一面一面分開的，直接撐開角落會裂開，描邊用的那一份把法線換成「從中心往外」的方向，撐開來還是一個完整的殼。
   彎曲地平線（curve.js）會在 main.js 掃過整個場景時再套上去，這裡的 onBeforeCompile 會保留下來一起用。 */
import * as THREE from 'three';
export const OUTLINE_COLOR = 0x4a3352; // 描邊顏色（深紫，比黑色柔和）
export const TOON = { uOutline: { value: 0.0016 }, uOutlineMax: { value: 0.035 } }; // 粗細＝離鏡頭距離 × uOutline，上限 uOutlineMax（世界單位）
export function makeGradient(steps) { const t = new THREE.DataTexture(new Uint8Array(steps), steps.length, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; }
export const GRADIENT = makeGradient([105, 170, 222, 255]); // 4 階：暗、半暗、亮、高光（最暗那階越亮，整體越粉彩）
export function toonMat(p = {}) { const { roughness, metalness, flatShading, envMapIntensity, ...rest } = p; return new THREE.MeshToonMaterial({ gradientMap: GRADIENT, ...rest }); }
const OUT_GLSL = /* glsl */`
{ mat4 om = modelMatrix;
  #ifdef USE_INSTANCING
    om = om * instanceMatrix;
  #endif
  if (abs(determinant(om)) > 1e-12) { vec4 ow = om * vec4(transformed, 1.0); mat3 o3 = mat3(om); vec3 onw = normalize(transpose(inverse(o3)) * normal);
    float oMin = min(length(o3[0]), min(length(o3[1]), length(o3[2])));
    float ot = min(min(distance(ow.xyz, cameraPosition) * uOutline, uOutlineMax), oMin * 0.18);
    ow.xyz += onw * ot; transformed = (inverse(om) * ow).xyz; } }`;
// 把描邊的頂點位移加到一個材質上（保留原本的 onBeforeCompile，例如建築的透視切面）
export function addOutline(mat) { const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (sh, r) => { if (prev) prev.call(mat, sh, r); Object.assign(sh.uniforms, TOON);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uOutline; uniform float uOutlineMax;').replace('#include <begin_vertex>', '#include <begin_vertex>\n' + OUT_GLSL); };
  mat.customProgramCacheKey = () => prevKey() + '|outline'; return mat; }
export function outlineMat(base = null) { const m = base || new THREE.MeshBasicMaterial(); m.color.setHex(OUTLINE_COLOR); m.side = THREE.BackSide; return addOutline(m); }
export const OUTLINE = outlineMat();
// 描邊用的幾何：硬邊的方塊把法線換成從中心往外（其他形狀法線本來就連續，直接用）
const OGEO = new WeakMap();
export function outlineGeo(g) { if (!g.isBufferGeometry || g.type !== 'BoxGeometry') return g; if (OGEO.has(g)) return OGEO.get(g);
  const o = g.clone(), p = o.attributes.position, n = o.attributes.normal, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); n.setXYZ(i, v.x, v.y, v.z); } OGEO.set(g, o); return o; }
// 一個 mesh 加描邊（子物件，跟著動）；InstancedMesh 用 instancedOutline
export function meshOutline(m, mat = OUTLINE) { const o = new THREE.Mesh(outlineGeo(m.geometry), mat); o.castShadow = o.receiveShadow = false; o.raycast = () => {}; o.userData.outline = true; m.add(o); return o; }
export function instancedOutline(im, mat = OUTLINE) { const o = new THREE.InstancedMesh(outlineGeo(im.geometry), mat, im.count); o.instanceMatrix = im.instanceMatrix; o.count = im.count; o.castShadow = o.receiveShadow = false; o.frustumCulled = im.frustumCulled; o.raycast = () => {}; o.userData.outline = true; return o; }
