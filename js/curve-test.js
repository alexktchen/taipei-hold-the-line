/* 彎曲地平線的測試場景：一大片平面草地（600×600、細分 240×240）＋泥土路＋成排的樹（InstancedMesh）＋路邊的房子（一般 Mesh）＋圍欄柱＋一個方塊人。
   全部材質都 applyCurve，陰影用彎過的深度材質。另外有一個「真的大圓柱／球」地面當對照：半徑 R = 1 / (2k)，人往前走時它跟著滾（動森滾木的原始想法）。 */
import * as THREE from 'three';
import { CURVE, applyCurve, curveObject, updateCurve, radiusFor } from './curve.js';
const $ = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(); const SKY = 0xbfe4f2; scene.background = new THREE.Color(SKY); scene.fog = new THREE.Fog(SKY, 60, 170);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xf2fbff, 0x8a7a5a, 1.4));
const sun = new THREE.DirectionalLight(0xfff1de, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
const rnd = (() => { let a = 7; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
// ── 貼圖：草地加淡淡的格線（看得出彎了多少）、泥土路 ──
function tex(draw, rep) { const c = document.createElement('canvas'); c.width = c.height = 256; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; }
const grassTex = rep => tex(g => { g.fillStyle = '#86c25a'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2600; i++) { g.fillStyle = ['#7ab64f', '#9cd06c', '#6faa46'][i % 3]; g.globalAlpha = 0.5; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } g.globalAlpha = 0.28; g.strokeStyle = '#4f8a32'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 256); g.globalAlpha = 1; for (let i = 0; i < 30; i++) { g.fillStyle = ['#fff', '#f6d36a', '#f2a1a1'][i % 3]; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2.2, 0, 7); g.fill(); } }, rep);
const dirtTex = tex(g => { g.fillStyle = '#d9b582'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 2200; i++) { g.fillStyle = ['#c9995f', '#e8c995', '#bb8b58'][i % 3]; g.globalAlpha = 0.6; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); } }, [1, 120]);
// ── 平面地面（被 shader 彎）──
const world = new THREE.Group(); scene.add(world);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 240, 240).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: grassTex([150, 150]), roughness: 1 })); ground.receiveShadow = true; world.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(3, 600, 6, 240).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 })); road.position.y = 0.01; road.receiveShadow = true; world.add(road);
// ── 樹（InstancedMesh：樹幹＋樹冠）──
const treePos = []; for (let i = 0; i < 900; i++) { const side = rnd() < 0.5 ? -1 : 1, x = side * (3.2 + rnd() * 60), z = 300 - rnd() * 600; if (Math.abs(x) < 9 && rnd() < 0.6) continue; treePos.push([x, z, 0.7 + rnd() * 0.7]); }
for (let z = 290; z > -300; z -= 6) for (const side of [-1, 1]) treePos.push([side * 4.4, z + rnd(), 0.8]); // 路邊一排行道樹：最容易看出往下彎
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
function instanced(geo, mat, list, place) { const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((t, i) => { place(t, pv, sv); m4.compose(pv, q, sv); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(t.color || 0xffffff)); }); im.castShadow = true; im.receiveShadow = true; world.add(im); return im; }
const GREENS = [0x5f9a3e, 0x6faa46, 0x4f8a32, 0x7cb355];
treePos.forEach(t => { t.color = GREENS[Math.floor(rnd() * GREENS.length)]; });
instanced(new THREE.CylinderGeometry(0.12, 0.18, 1, 7).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }), treePos.map(t => ({ t, color: 0x8a6a4a })), ({ t }, p, s) => { p.set(t[0], 0, t[1]); s.set(t[2], t[2], t[2]); });
instanced(new THREE.IcosahedronGeometry(0.75, 1).translate(0, 1.55, 0), new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), treePos, (t, p, s) => { p.set(t[0], 0, t[1]); s.set(t[2], t[2] * 1.1, t[2]); });
// ── 圍欄柱（InstancedMesh）──
const posts = []; for (let z = 296; z > -300; z -= 1.2) for (const side of [-1, 1]) posts.push({ x: side * 2.2, z }); instanced(new THREE.BoxGeometry(0.12, 0.5, 0.12).translate(0, 0.25, 0), new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 }), posts, (t, p, s) => { p.set(t.x, 0, t.z); s.set(1, 1, 1); });
// ── 路邊的房子（一般 Mesh）──
const ROOF = [0xdb6a41, 0x34477a, 0x4b974b, 0xc4281c, 0xe8c547];
for (let z = 280, k = 0; z > -300; z -= 24, k++) for (const side of [-1, 1]) { if ((k + (side > 0 ? 1 : 0)) % 2) continue; const h = new THREE.Group(); const w = 2.2 + rnd(), d = 2 + rnd() * 0.8;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), new THREE.MeshStandardMaterial({ color: [0xf7ede0, 0xf3e2c6, 0xfff8f4][k % 3], roughness: 0.9 })); body.position.y = 0.8;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.1, 4).rotateY(Math.PI / 4), new THREE.MeshStandardMaterial({ color: ROOF[k % ROOF.length], roughness: 0.8 })); roof.position.y = 2.15; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.05), new THREE.MeshStandardMaterial({ color: 0x6a4e36 })); door.position.set(0, 0.4, d / 2 + 0.02);
  for (const o of [body, roof, door]) { o.castShadow = true; o.receiveShadow = true; h.add(o); } h.position.set(side * (7 + rnd() * 2), 0, z); h.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; world.add(h); }
// ── 方塊人（自己）──
const me = new THREE.Group(); const part = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })); m.position.set(x, y, z); m.castShadow = true; me.add(m); return m; };
const legs = [part(0.2, 0.42, 0.22, 0x27467a, -0.11, 0.21, 0), part(0.2, 0.42, 0.22, 0x27467a, 0.11, 0.21, 0)]; part(0.44, 0.42, 0.24, 0xdb6a41, 0, 0.63, 0); const arms = [part(0.18, 0.42, 0.2, 0xf5cd30, -0.32, 0.63, 0), part(0.18, 0.42, 0.2, 0xf5cd30, 0.32, 0.63, 0)]; part(0.34, 0.34, 0.33, 0xf5cd30, 0, 1.03, 0);
for (const [x] of [[-0.075], [0.075]]) part(0.045, 0.08, 0.01, 0x211d1d, x, 1.06, -0.17); world.add(me);
// 全部加上彎曲（地面、樹、柱子、房子、人）
curveObject(world);
// ── 對照組：真的大圓柱（滾木）／大球，半徑 R = 1/(2k)，人往前走時它跟著滾 ──
const refMat = new THREE.MeshStandardMaterial({ map: grassTex([60, 60]), roughness: 1 }); let refMesh = null, refKey = '';
function buildRef() { const k = CURVE.uCurve.value, R = Math.min(radiusFor(k), 3000), sphere = CURVE.uCurveMode.value > 0.5, key = `${sphere}|${R.toFixed(1)}`; if (key === refKey) return; refKey = key; if (refMesh) { scene.remove(refMesh); refMesh.geometry.dispose(); }
  const geo = sphere ? new THREE.SphereGeometry(R, 256, 160) : new THREE.CylinderGeometry(R, R, 600, 512, 1, true).rotateZ(Math.PI / 2); refMesh = new THREE.Mesh(geo, refMat); refMesh.receiveShadow = true; refMesh.userData.R = R; scene.add(refMesh); }
// ── 控制 ──
let ground_ = 'shader', auto = true, pitch = 22, yawCam = 0; const keys = new Set(); const walker = { x: 0, z: 250, dir: Math.PI, dist: 0 };
addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); }); addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
let drag = null; renderer.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, yaw: yawCam }; renderer.domElement.setPointerCapture(e.pointerId); }); renderer.domElement.addEventListener('pointermove', e => { if (drag) yawCam = drag.yaw - (e.clientX - drag.x) * 0.006; }); renderer.domElement.addEventListener('pointerup', () => { drag = null; });
function syncUI() { const k = CURVE.uCurve.value; $('kv').textContent = `${k.toFixed(4)}（等效半徑 ${k > 0 ? radiusFor(k).toFixed(0) : '∞'}）`; $('fv').textContent = `${CURVE.uCurveFlat.value} 格`; $('pv').textContent = `${pitch}°`;
  $('note').textContent = ground_ === 'ref' ? `對照組：一顆半徑 ${radiusFor(k).toFixed(0)} 的${CURVE.uCurveMode.value > 0.5 ? '大球' : '大圓柱'}，人往前走時地面跟著滾。和 shader 版的地平線形狀應該差不多（shader 版多了腳邊平坦區）。` : '平面草地 600×600：路邊的行道樹與房子越遠越往地平線下沉，人往前走時遠處的樹一棵棵從地平線冒出來。'; }
$('on').addEventListener('change', e => { CURVE.uCurveOn.value = e.target.checked ? 1 : 0; });
$('k').addEventListener('input', e => { CURVE.uCurve.value = +e.target.value; syncUI(); });
$('flat').addEventListener('input', e => { CURVE.uCurveFlat.value = +e.target.value; syncUI(); });
$('pitch').addEventListener('input', e => { pitch = +e.target.value; syncUI(); });
$('auto').addEventListener('change', e => { auto = e.target.checked; });
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { CURVE.uCurveMode.value = +b.dataset.mode; document.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); syncUI(); }));
document.querySelectorAll('[data-ground]').forEach(b => b.addEventListener('click', () => { ground_ = b.dataset.ground; document.querySelectorAll('[data-ground]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); syncUI(); }));
syncUI();
function fit() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } fit(); addEventListener('resize', fit);
// ── 主迴圈 ──
let last = performance.now(), t = 0;
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
  let mx = 0, mz = 0; if (keys.has('w') || keys.has('arrowup')) mz -= 1; if (keys.has('s') || keys.has('arrowdown')) mz += 1; if (keys.has('a') || keys.has('arrowleft')) mx -= 1; if (keys.has('d') || keys.has('arrowright')) mx += 1; if (auto && !mx && !mz) mz = -1;
  const moving = !!(mx || mz); if (moving) { const c = Math.cos(yawCam), s = Math.sin(yawCam), wx = mx * c + mz * s, wz = -mx * s + mz * c, L = Math.hypot(wx, wz), sp = 4.2 * dt; walker.x = Math.max(-40, Math.min(40, walker.x + wx / L * sp)); walker.z += wz / L * sp; walker.dist += sp; walker.dir = Math.atan2(wx, wz); if (walker.z < -280) walker.z += 540; if (walker.z > 290) walker.z -= 540; }
  me.position.set(walker.x, 0, walker.z); me.rotation.y = walker.dir + Math.PI; const sw = moving ? Math.sin(t * 11) * 0.7 : 0; legs[0].rotation.x = sw; legs[1].rotation.x = -sw; arms[0].rotation.x = -sw; arms[1].rotation.x = sw;
  // 鏡頭：在人後上方，俯角 pitch
  const dist = 9, pr = THREE.MathUtils.degToRad(pitch); camera.position.set(walker.x + Math.sin(yawCam) * dist * Math.cos(pr), 1 + dist * Math.sin(pr), walker.z + Math.cos(yawCam) * dist * Math.cos(pr)); camera.lookAt(walker.x, 1, walker.z);
  sun.position.set(walker.x + 18, 30, walker.z + 10); sun.target.position.set(walker.x, 0, walker.z - 10);
  // 地面：shader 版／對照組
  const ref = ground_ === 'ref'; ground.visible = road.visible = !ref; if (ref) { buildRef(); refMesh.visible = true; const R = refMesh.userData.R; refMesh.position.set(walker.x, -R, walker.z); if (CURVE.uCurveMode.value > 0.5) refMesh.rotation.set(-walker.dist / R, 0, walker.x / R * 0); else refMesh.rotation.set(-walker.dist / R, 0, 0); } else if (refMesh) refMesh.visible = false;
  updateCurve(camera); renderer.render(scene, camera); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
window.CT = { CURVE, camera, scene, walker, setGround: g => { ground_ = g; syncUI(); }, setPitch: p => { pitch = p; } }; // 測試用
