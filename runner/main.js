// 進入點：場景、相機、燈光、選單、輸入、主迴圈
import * as THREE from 'three';
import { CFG } from './config.js';
import { Track } from './track.js';
import { buildScenery } from './scenery.js';
import { Race } from './race.js';
import { createRunner, createRunnerAuto } from './characters.js';
import { GameAudio } from './audio.js';
import { HUD, ICONS, renderResults } from './ui.js';
import { clamp, damp, angleDiff, textSprite } from './util.js';

const MOBILE = matchMedia('(pointer:coarse)').matches || /Mobi|Android/i.test(navigator.userAgent);
if (MOBILE) document.body.classList.add('touch');
const $ = (id) => document.getElementById(id);

/* ── 渲染器、場景 ── */
const renderer = new THREE.WebGLRenderer({ antialias: !MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
sun.shadow.camera.left = -34; sun.shadow.camera.right = 34; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34; sun.shadow.camera.near = 1; sun.shadow.camera.far = 220; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
let sky = null;
function makeSky(c) {
  if (sky) { scene.remove(sky); sky.geometry.dispose(); sky.material.dispose(); }
  const geo = new THREE.SphereGeometry(800, 24, 12), pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const top = new THREE.Color(c.top), hor = new THREE.Color(c.horizon), gnd = new THREE.Color(c.ground), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 800; if (y >= 0) tmp.copy(hor).lerp(top, Math.pow(y, 0.6)); else tmp.copy(hor).lerp(gnd, Math.min(1, -y * 3)); col.set([tmp.r, tmp.g, tmp.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })); scene.add(sky);
  // 星星（夜晚）
  if (c.top === CFG.courses[0].sky.top) { const sg = new THREE.BufferGeometry(), arr = []; for (let i = 0; i < 500; i++) { const a = Math.random() * Math.PI * 2, e = Math.random() * 0.5 + 0.1; arr.push(Math.cos(a) * Math.cos(e) * 780, Math.sin(e) * 780, Math.sin(a) * Math.cos(e) * 780); } sg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false })); sky.add(stars); }
}
const isPortrait = () => innerHeight >= innerWidth;
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  document.body.classList.toggle('portrait', isPortrait()); document.body.classList.toggle('landscape', !isPortrait());
  if (pv.renderer) { const r = pv.canvas.getBoundingClientRect(); if (r.width > 0) { pv.renderer.setSize(Math.round(r.width), Math.round(r.height), false); pv.camera.aspect = r.width / r.height; pv.camera.updateProjectionMatrix(); } }
}

/* ── 音效 ── */
const audio = new GameAudio();
const muteBtns = [$('btnMute'), $('btnMuteMenu')];
const paintMute = () => muteBtns.forEach(b => { b.innerHTML = audio.muted ? ICONS.mute : ICONS.sound; b.setAttribute('aria-pressed', audio.muted); });
muteBtns.forEach(b => b.addEventListener('click', () => { audio.ensure(); audio.setMuted(!audio.muted); paintMute(); })); paintMute();

/* ── 選單 ── */
const save = JSON.parse(localStorage.getItem('runner.pick') || '{}');
const pick = { char: save.char || 'office', course: save.course || 'taipei', diff: save.diff || 'normal', laps: save.laps || CFG.laps, ai: save.ai ?? 7 };
const persist = () => localStorage.setItem('runner.pick', JSON.stringify(pick));
const charList = $('charList'), courseList = $('courseList'), charInfo = $('charInfo');
const STAT_LABEL = { speed: '速度', accel: '起跑', handling: '轉向', weight: '體重', dash: '衝刺', draft: '跟跑', shove: '推人', tough: '耐撞', jump: '跳躍' };
function paintChars() {
  charList.querySelectorAll('.pick').forEach(el => el.classList.toggle('on', el.dataset.id === pick.char));
  const d = CFG.characters.find(c => c.id === pick.char);
  charInfo.innerHTML = `<b>${d.name}</b><span>${d.job}</span><span style="flex-basis:100%">${d.desc}</span><span class="stats">${Object.entries(d.stats).filter(([k, v]) => v !== 1).map(([k, v]) => `<span class="stat">${STAT_LABEL[k] || k} <i>${v > 1 ? '▲' : '▼'}</i></span>`).join('')}</span>`;
  previewChar(d);
}
for (const d of CFG.characters) { const el = document.createElement('button'); el.type = 'button'; el.className = 'pick'; el.dataset.id = d.id; el.innerHTML = `<img alt=""><b>${d.name}</b><small>${d.job}</small>`; el.addEventListener('click', () => { pick.char = d.id; persist(); paintChars(); audio.ensure(); audio.tone(660, 0.06, 'square', 0.15); }); charList.appendChild(el); }
const skyCss = (s) => `linear-gradient(180deg, #${s.top.toString(16).padStart(6, '0')}, #${s.horizon.toString(16).padStart(6, '0')} 70%, #${s.ground.toString(16).padStart(6, '0')})`;
for (const c of CFG.courses) { const el = document.createElement('button'); el.type = 'button'; el.className = 'course'; el.dataset.id = c.id; el.innerHTML = `<div class="sky" style="background:${skyCss(c.sky)}"></div><div class="body"><b>${c.name}</b><small>${c.sub}</small><p>${c.desc}</p></div>`; el.addEventListener('click', () => { pick.course = c.id; persist(); paintCourses(); audio.ensure(); audio.tone(660, 0.06, 'square', 0.15); }); courseList.appendChild(el); }
function paintCourses() { courseList.querySelectorAll('.course').forEach(el => el.classList.toggle('on', el.dataset.id === pick.course)); }
function seg(id, options, get, set) { const el = $(id); el.innerHTML = ''; for (const [v, label] of options) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.v = v; b.addEventListener('click', () => { set(v); persist(); paint(); }); el.appendChild(b); } const paint = () => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(b.dataset.v) === String(get()))); paint(); }
seg('diffSeg', Object.entries(CFG.difficulty).map(([k, v]) => [k, v.label]), () => pick.diff, v => pick.diff = v);
seg('lapSeg', [[1, '1'], [2, '2'], [3, '3']], () => pick.laps, v => pick.laps = +v);
seg('aiSeg', [[3, '3 人'], [5, '5 人'], [7, '7 人']], () => pick.ai, v => pick.ai = +v);
paintCourses();

// 角色預覽：小畫布轉盤；縮圖也用它畫一次
const pv = { canvas: $('preview'), renderer: null, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(32, 440 / 520, 0.1, 50), rig: null, t: 0 };
pv.renderer = new THREE.WebGLRenderer({ canvas: pv.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); pv.renderer.setPixelRatio(1); pv.renderer.setSize(440, 520, false); pv.renderer.outputColorSpace = THREE.SRGBColorSpace;
pv.scene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 1.1)); const pvSun = new THREE.DirectionalLight(0xffffff, 1.4); pvSun.position.set(2, 4, 3); pv.scene.add(pvSun);
pv.camera.position.set(0, 1.25, 4.0); pv.camera.lookAt(0, 0.95, 0);
const pvFloor = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })); pvFloor.rotation.x = -Math.PI / 2; pvFloor.position.y = 0.01; pv.scene.add(pvFloor);
function previewChar(def) { if (pv.rig) pv.scene.remove(pv.rig.root); pv.rig = createRunner(def); pv.scene.add(pv.rig.root); }
function thumbnails() {
  const keep = pv.rig; if (keep) pv.scene.remove(keep.root);
  for (const d of CFG.characters) { const rig = createRunner(d); pv.scene.add(rig.root); rig.root.rotation.y = -0.4; rig.update(0.016, { speed: 9, maxSpeed: 11, grounded: true }); pv.renderer.render(pv.scene, pv.camera); charList.querySelector(`[data-id="${d.id}"] img`).src = pv.canvas.toDataURL('image/png'); pv.scene.remove(rig.root); }
  if (keep) pv.scene.add(keep.root);
}
thumbnails(); paintChars();
// 選單開著時，預覽人偶在轉盤上跑步
let pvLast = performance.now();
(function pvLoop(now) { requestAnimationFrame(pvLoop); if ($('menu').hidden || !pv.rig) return; const dt = Math.min(0.05, (now - pvLast) / 1000); pvLast = now; pv.t += dt; pv.rig.root.rotation.y = -0.5 + Math.sin(pv.t * 0.7) * 0.6; pv.rig.update(dt, { speed: 9, maxSpeed: 11, grounded: true }); pv.renderer.render(pv.scene, pv.camera); })(pvLast);
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 60)); resize();

/* ── 輸入 ── */
const keys = {}; const edge = { jump: false, shove: false, item: false, left: false, right: false, mashL: false, mashR: false, brakePulse: false };
addEventListener('keydown', (e) => {
  if (e.repeat) return; keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { edge.jump = true; e.preventDefault(); }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { edge.left = true; e.preventDefault(); } if (e.code === 'ArrowRight' || e.code === 'KeyD') { edge.right = true; e.preventDefault(); }
  if (e.code === 'KeyZ' || e.code === 'KeyJ') edge.mashL = true; if (e.code === 'KeyX' || e.code === 'KeyK') edge.mashR = true;
  if (e.code === 'KeyE') edge.shove = true; if (e.code === 'KeyQ' || e.code === 'ControlLeft') edge.item = true;
  if (e.code === 'KeyM') { audio.setMuted(!audio.muted); paintMute(); } if (e.code === 'Escape' && race && race.state !== 'finished') endRace(true);
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
const touch = { dash: false };
for (const b of document.querySelectorAll('.tctl button')) {
  const k = b.dataset.k;
  const down = (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('down'); edge[k] = true; audio.ensure(); };
  const up = (e) => { e.preventDefault(); b.classList.remove('down'); };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
}
// 衝刺拉桿：按住往上拉就衝刺，放開彈回
const lever = $('lever'), knob = $('leverKnob'); let leverId = null, leverY0 = 0, leverLift = 0;
const setLever = (lift) => { leverLift = clamp(lift, 0, 1); knob.style.transform = `translateY(${-leverLift * 100}px)`; touch.dash = leverLift > 0.45; lever.classList.toggle('on', touch.dash); };
lever.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); leverId = e.pointerId; leverY0 = e.clientY + leverLift * 100; lever.setPointerCapture(e.pointerId); audio.ensure(); });
lever.addEventListener('pointermove', (e) => { if (e.pointerId !== leverId) return; setLever((leverY0 - e.clientY) / 100); });
for (const ev of ['pointerup', 'pointercancel']) lever.addEventListener(ev, (e) => { if (e.pointerId !== leverId) return; leverId = null; setLever(0); });
// 畫面滑動：左右滑換線道、上滑跳、下滑煞車；沒有滑動就是點擊，左半邊／右半邊交替點擊加速
const swipes = new Map();
const appEl = $('app');
appEl.addEventListener('pointerdown', (e) => { if (!race) return; swipes.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), done: false }); audio.ensure(); });
appEl.addEventListener('pointermove', (e) => {
  const sw = swipes.get(e.pointerId); if (!sw || sw.done) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y, TH = 28;
  if (Math.abs(dx) < TH && Math.abs(dy) < TH) return;
  sw.done = true;
  if (Math.abs(dx) > Math.abs(dy)) { if (dx < 0) edge.left = true; else edge.right = true; } else { if (dy < 0) edge.jump = true; else edge.brakePulse = true; }
});
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, (e) => {
  const sw = swipes.get(e.pointerId); if (!sw) return; swipes.delete(e.pointerId);
  if (!sw.done && ev === 'pointerup' && performance.now() - sw.t < 400) { if (sw.x < innerWidth / 2) edge.mashL = true; else edge.mashR = true; }
});
function readInput() {
  const inp = { left: edge.left, right: edge.right, jump: edge.jump, brake: !!(keys.ArrowDown || keys.KeyS), brakePulse: edge.brakePulse, dash: !!(keys.ShiftLeft || keys.ShiftRight || touch.dash), mashL: edge.mashL, mashR: edge.mashR, shove: edge.shove, item: edge.item };
  for (const k in edge) edge[k] = false; return inp;
}
const clearEdges = (inp) => { inp.left = inp.right = inp.jump = inp.brakePulse = inp.mashL = inp.mashR = inp.shove = inp.item = false; };

/* ── 比賽 ── */
const hud = new HUD();
let race = null, track = null, world = null, course = null, labelSprites = [];
const cam = { yaw: 0, fov: 62, pos: new THREE.Vector3(), look: new THREE.Vector3() };
let raf = 0, lastT = 0, dashSound = false, acc = 0; const STEP = 1 / 60;
async function startRace() {
  $('menu').hidden = true; $('results').hidden = true; $('loading').hidden = false; $('loadMsg').textContent = '建造城市中…';
  await new Promise(r => setTimeout(r, 30));
  clearRace();
  course = CFG.courses.find(c => c.id === pick.course) || CFG.courses[0];
  track = new Track(course);
  const sc = buildScenery(track, course, course.id.length * 131 + 7);
  world = sc; scene.add(sc.group); scene.add(track.build());
  scene.fog = new THREE.Fog(course.fog.color, course.fog.near, course.fog.far);
  makeSky(course.sky);
  sun.color.set(course.light.sun); sun.intensity = course.light.sunI; hemi.color.set(course.light.hemi[0]); hemi.groundColor.set(course.light.hemi[1]); hemi.intensity = course.light.hemi[2];
  for (const l of sc.labels) { const sp = textSprite(l.text, { color: '#ffd166', bg: 'rgba(20,20,40,.6)', size: 48 }); sp.position.set(l.x, l.y, l.z); sp.scale.multiplyScalar(2.2); scene.add(sp); labelSprites.push(sp); }
  // 角色：玩家選的放第 0 位，其餘隨機挑
  const me = CFG.characters.find(c => c.id === pick.char), others = CFG.characters.filter(c => c !== me).sort(() => Math.random() - 0.5).slice(0, pick.ai);
  const defs = [me, ...others].sort(() => Math.random() - 0.5), playerIndex = defs.indexOf(me);
  $('loadMsg').textContent = '選手入場…';
  const rigs = new Map(); for (const d of defs) rigs.set(d.id, await createRunnerAuto(d));
  race = new Race({ track, world, defs, playerIndex, laps: pick.laps, difficulty: pick.diff, onEvent, makeRig: (d) => rigs.get(d.id) });
  scene.add(race.group);
  hud.setTrack(track); hud.show(true); hud.lastItem = undefined; hud.lastPlace = 0; hud.update(race, 0);
  const p = race.player; cam.yaw = p.heading; cam.pos.copy(p.pos).add(new THREE.Vector3(-Math.sin(p.heading) * 7, 3, -Math.cos(p.heading) * 7)); cam.fov = 62;
  $('loading').hidden = true;
window.RUNNER = { startRace, endRace, pick, get race() { return race; } }; // 除錯用
  audio.ensure(); audio.startMusic(course.music);
  if (MOBILE) setTimeout(() => hud.toast('左右滑換線道・上滑跳・下滑煞車・左右交替點畫面加速・拉桿往上衝刺', 6), 4200);
  lastT = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function clearRace() {
  if (race) { scene.remove(race.group); race = null; }
  for (const o of [...scene.children]) if (o !== sky && o !== hemi && o !== sun && o !== sun.target) scene.remove(o);
  labelSprites = []; hud.show(false); audio.dashLoop(false); dashSound = false;
}
function endRace(toMenu) { cancelAnimationFrame(raf); audio.stopMusic(); clearRace(); hud.hideCenter(); $('results').hidden = true; if (toMenu) $('menu').hidden = false; }
function onEvent(type, r, extra) {
  const mine = r && r.isPlayer;
  switch (type) {
    case 'count': hud.showCenter(String(r), 0.9); audio.count(r); break;
    case 'go': hud.showCenter('GO!', 0.8); audio.go(); break;
    case 'lap': if (mine) { hud.showCenter(r.lap === race.laps ? '最後一圈！' : `第 ${r.lap} 圈`, 1.4); audio.lap(); } break;
    case 'finish': if (mine) { hud.showCenter(r.place === 1 ? '冠軍！' : `第 ${r.place} 名`, 3); audio.finish(r.place); } break;
    case 'raceOver': setTimeout(() => { renderResults(race, course); $('results').hidden = false; }, 2200); break;
    case 'jump': if (mine) audio.jump(); break;
    case 'land': if (mine) audio.land(); break;
    case 'hit': if (mine) { audio.hit(); hud.toast(extra && extra.name ? `撞到${extra.name}！` : extra && extra.def ? `被${extra.def.name}撞倒！` : '跌倒了！'); shake = 0.5; } else if (extra === race.player) hud.toast(`撞倒了${r.name}！`); break;
    case 'slip': if (mine) { audio.slip(); hud.toast('踩到香蕉皮！'); shake = 0.3; } break;
    case 'item': if (mine) { audio.item(); hud.toast(`${CFG.items[extra].name}：${CFG.items[extra].desc}`, 2.4); } break;
    case 'useItem': if (mine) audio.use(); break;
    case 'shove': if (mine) audio.shove(); break;
    case 'bump': if (mine || (extra && extra.isPlayer)) audio.bump(); break;
    case 'boost': if (mine) { audio.boost(); hud.toast('加速！'); } break;
    case 'wall': if (mine) { audio.bump(); shake = 0.25; } break;
    case 'shieldBreak': if (mine) { audio.shield(); hud.toast('平安符擋下了一次！'); } break;
    case 'mash': audio.tone(320 + r.mash * 300, 0.04, 'square', 0.08); break;
  }
}
let shake = 0;
const sunDir = new THREE.Vector3();
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.25, (now - lastT) / 1000); lastT = now;
  if (!race) return;
  // 固定步長模擬（1/60 秒），畫面慢時多算幾步，比賽速度不會變慢
  acc += dt; const inp = readInput(); let steps = 0;
  while (acc >= STEP && steps < 15) { race.update(STEP, inp); acc -= STEP; steps++; clearEdges(inp); }
  if (steps === 15) acc = 0;
  const p = race.player;
  // 相機：跟在後面，衝刺時視角拉寬、些微震動
  cam.yaw += angleDiff(p.tanYaw ?? p.heading, cam.yaw) * (1 - Math.exp(-5 * dt));
  const port = isPortrait(), CC = port ? CFG.cam.portrait : CFG.cam.landscape, back = CC.back + p.speed * 0.06, up = CC.up;
  const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  const target = new THREE.Vector3(p.pos.x - fx * back, p.group.position.y - p.h * 0.6 + up, p.pos.z - fz * back);
  cam.pos.lerp(target, 1 - Math.exp(-7 * dt));
  shake = Math.max(0, shake - dt);
  camera.position.copy(cam.pos); if (shake > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5, 0));
  cam.look.set(p.pos.x + fx * CC.look, p.group.position.y + CC.lookY, p.pos.z + fz * CC.look); camera.lookAt(cam.look);
  cam.fov = damp(cam.fov, CC.fov + (p.dashing ? 10 : 0) + (p.boost > 0 ? 8 : 0), 6, dt); camera.fov = cam.fov; camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[0] *= CFG.cam.squeeze; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); // 左右壓縮
  // 太陽影子跟著玩家
  sunDir.set(...course.light.sunPos).normalize();
  sun.position.copy(p.pos).addScaledVector(sunDir, 90); sun.target.position.copy(p.pos); sun.target.updateMatrixWorld();
  // 衝刺音
  const dashing = p.dashing && race.state === 'racing'; if (dashing !== dashSound) { dashSound = dashing; audio.dashLoop(dashing); }
  for (const r of race.racers) if (!r.isPlayer) r.tag.visible = r.pos.distanceToSquared(camera.position) > 30; // 太近的名牌不顯示
  hud.update(race, dt);
  lever.querySelector('.fill').style.transform = `scaleY(${p.dash.toFixed(3)})`; lever.classList.toggle('low', p.dash < 0.2);
  renderer.render(scene, camera);
}
$('btnStart').addEventListener('click', () => { audio.ensure(); startRace(); });
$('btnAgain').addEventListener('click', () => { endRace(false); startRace(); });
$('btnMenu').addEventListener('click', () => endRace(true));
$('loading').hidden = true;
