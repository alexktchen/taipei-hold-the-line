// 角色：Gobkit 風的 Q 版大頭人（大圓角方頭、小身體、短手短腳、識別證掛繩、各職業配件），全部程式造型。
// 也支援外部 GLB：models/manifest.json 寫 { "office": { "file": "office.glb", "clips": { "run": "Run", "idle": "Idle", "jump": "Jump" } } }
// 有檔就用 GLB＋AnimationMixer，沒有就用程式人偶。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clamp, lerp, damp } from './util.js';

const matCache = new Map();
function mat(hex, opts = {}) {
  const key = hex + '|' + (opts.flat ? 'f' : '') + (opts.emissive ? 'e' : '');
  if (!matCache.has(key)) {
    const m = opts.flat ? new THREE.MeshBasicMaterial({ color: hex }) : new THREE.MeshLambertMaterial({ color: hex });
    if (opts.emissive && !opts.flat) m.emissive = new THREE.Color(hex).multiplyScalar(0.5);
    matCache.set(key, m);
  }
  return matCache.get(key);
}
function mesh(geo, hex, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, mat(hex, opts)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; return m;
}
const rbox = (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2.2));
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const DARK = 0x1c1a22, WHITE = 0xffffff, LANYARD = 0x2f7fd8;

/* 尺寸（單位：公尺，人偶約 1.7 高）：鞋 0.14、腿 0.34、身體 0.62、頭 0.72 */
const H = { shoe: 0.14, leg: 0.34, body: 0.62, head: 0.72, headW: 0.84, headD: 0.78, bodyW: 0.6, bodyD: 0.4 };

export function createRunner(def) {
  const c = def.colors, acc = new Set(def.acc || []);
  const root = new THREE.Group(); root.name = 'runner:' + def.id;
  const body = new THREE.Group(); root.add(body); // 上下跳動用
  const hipY = H.shoe + H.leg; body.position.y = hipY;

  // 腿（樞軸在髖）
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.15, 0, 0); body.add(hip);
    const leg = mesh(rbox(0.24, H.leg, 0.26, 0.05), c.pants, 0, -H.leg / 2, 0); hip.add(leg);
    const shoe = mesh(rbox(0.26, H.shoe, 0.36, 0.06), c.shoes, 0, -H.leg - H.shoe / 2, 0.04); hip.add(shoe);
    legs.push(hip);
  }
  // 軀幹（樞軸在髖，往上）
  const torso = new THREE.Group(); body.add(torso);
  const shirtH = H.body * 0.72, pantsH = H.body - shirtH;
  torso.add(mesh(rbox(H.bodyW, pantsH + 0.04, H.bodyD, 0.06), c.pants, 0, pantsH / 2, 0));
  const shirt = mesh(rbox(H.bodyW + 0.02, shirtH, H.bodyD + 0.02, 0.08), c.shirt, 0, pantsH + shirtH / 2, 0); torso.add(shirt);
  if (acc.has('apron')) torso.add(mesh(box(H.bodyW * 0.8, H.body * 0.78, 0.03), def.id === 'chef' ? 0xf4f4f4 : 0x2d2d33, 0, H.body * 0.42, H.bodyD / 2 + 0.02));
  if (acc.has('vest')) torso.add(mesh(box(H.bodyW + 0.04, shirtH * 0.95, H.bodyD + 0.05), 0x7a5a3a, 0, pantsH + shirtH / 2, 0));
  if (acc.has('tie')) { torso.add(mesh(box(0.1, 0.3, 0.03), def.id === 'boss' ? 0xd9463b : 0x3a6fb0, 0, H.body - 0.2, H.bodyD / 2 + 0.03)); }
  if (acc.has('bowtie')) { torso.add(mesh(box(0.18, 0.08, 0.04), 0xd9463b, 0, H.body - 0.06, H.bodyD / 2 + 0.03)); }
  if (acc.has('belt')) torso.add(mesh(box(H.bodyW + 0.03, 0.07, H.bodyD + 0.03), 0x2a2a2a, 0, pantsH + 0.02, 0));
  if (acc.has('lanyard')) { // 掛繩：兩條斜帶＋白色識別證
    for (const s of [-1, 1]) { const m = mesh(box(0.035, 0.34, 0.02), LANYARD, s * 0.09, H.body - 0.17, H.bodyD / 2 + 0.03); m.rotation.z = -s * 0.32; torso.add(m); }
    torso.add(mesh(box(0.16, 0.2, 0.025), 0xf4f4f4, 0, H.body - 0.4, H.bodyD / 2 + 0.035));
    torso.add(mesh(box(0.16, 0.05, 0.03), LANYARD, 0, H.body - 0.33, H.bodyD / 2 + 0.037));
  }
  if (acc.has('backpack')) { const bp = mesh(rbox(0.46, 0.44, 0.22, 0.07), 0xd9463b, 0, H.body * 0.55, -H.bodyD / 2 - 0.1); torso.add(bp); torso.add(mesh(box(0.3, 0.16, 0.08), 0xa83a30, 0, H.body * 0.3, -H.bodyD / 2 - 0.14)); }

  // 手臂（樞軸在肩）
  const arms = [];
  const shoulderY = H.body - 0.08, armL = 0.46;
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * (H.bodyW / 2 + 0.1), shoulderY, 0); torso.add(sh);
    sh.add(mesh(rbox(0.2, armL * 0.6, 0.2, 0.05), c.shirt, 0, -armL * 0.3, 0));
    sh.add(mesh(rbox(0.19, armL * 0.4, 0.19, 0.05), c.skin, 0, -armL * 0.8, 0));
    arms.push(sh);
  }
  // 頭（樞軸在頸）
  const neck = new THREE.Group(); neck.position.y = H.body; torso.add(neck);
  const head = mesh(rbox(H.headW, H.head, H.headD, 0.16), c.skin, 0, H.head / 2, 0); neck.add(head);
  const fz = H.headD / 2;
  // 眼睛：大黑橢圓＋白色亮點，眉毛
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.075, 10, 8), DARK, s * 0.17, H.head * 0.46, fz - 0.02, { flat: true }); eye.scale.set(1, 1.25, 0.5); neck.add(eye);
    const hl = mesh(new THREE.SphereGeometry(0.022, 6, 6), WHITE, s * 0.17 + 0.025, H.head * 0.46 + 0.035, fz + 0.02, { flat: true }); neck.add(hl);
    const brow = mesh(box(0.13, 0.03, 0.02), def.hair === 'grey' || def.hair === 'balding' ? 0x9a9a9a : c.hair, s * 0.17, H.head * 0.46 + 0.14, fz); neck.add(brow);
  }
  // 嘴：小小的微笑
  const mouth = mesh(box(0.14, 0.03, 0.02), 0x8a4a4a, 0, H.head * 0.24, fz, { flat: true }); neck.add(mouth);
  if (acc.has('mustache')) neck.add(mesh(box(0.3, 0.06, 0.04), 0x2a2a2a, 0, H.head * 0.3, fz + 0.01));
  // 腮紅
  for (const s of [-1, 1]) { const b = mesh(new THREE.SphereGeometry(0.05, 6, 6), 0xf0a0a0, s * 0.3, H.head * 0.32, fz - 0.03, { flat: true }); b.scale.set(1.2, 0.7, 0.3); neck.add(b); }
  // 耳朵
  for (const s of [-1, 1]) neck.add(mesh(rbox(0.08, 0.16, 0.14, 0.03), c.skin, s * (H.headW / 2 + 0.02), H.head * 0.42, 0));
  // 頭髮
  const hw = H.headW + 0.06, hd = H.headD + 0.06;
  const hairColor = c.hair;
  if (def.hair === 'short' || def.hair === 'grey' || def.hair === 'pony') {
    neck.add(mesh(rbox(hw, 0.26, hd, 0.1), hairColor, 0, H.head - 0.06, -0.02));
    neck.add(mesh(rbox(hw, 0.4, 0.2, 0.08), hairColor, 0, H.head - 0.3, -hd / 2 + 0.08)); // 後腦
    if (def.hair !== 'pony') neck.add(mesh(rbox(hw * 0.5, 0.1, 0.22, 0.04), hairColor, 0.12, H.head + 0.02, 0.18)); // 瀏海翹起
  }
  if (def.hair === 'pony') { const p = mesh(rbox(0.2, 0.5, 0.2, 0.08), hairColor, 0, H.head - 0.35, -hd / 2 - 0.08); p.rotation.x = 0.3; neck.add(p); neck.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), 0xd9463b, 0, H.head - 0.18, -hd / 2 - 0.04)); }
  if (def.hair === 'bob') {
    neck.add(mesh(rbox(hw, 0.26, hd, 0.1), hairColor, 0, H.head - 0.06, -0.02));
    for (const s of [-1, 1]) neck.add(mesh(rbox(0.1, 0.55, hd * 0.8, 0.04), hairColor, s * (hw / 2 - 0.02), H.head - 0.36, -0.06));
    neck.add(mesh(rbox(hw, 0.5, 0.16, 0.06), hairColor, 0, H.head - 0.3, -hd / 2 + 0.06));
    neck.add(mesh(rbox(hw * 0.9, 0.12, 0.16, 0.04), hairColor, 0, H.head - 0.1, hd / 2 - 0.1)); // 齊瀏海
  }
  if (def.hair === 'balding') { for (const s of [-1, 1]) neck.add(mesh(rbox(0.1, 0.3, hd * 0.7, 0.04), hairColor, s * (hw / 2 - 0.02), H.head - 0.42, -0.06)); neck.add(mesh(rbox(hw * 0.8, 0.22, 0.14, 0.05), hairColor, 0, H.head - 0.3, -hd / 2 + 0.05)); }
  // 帽子與頭部配件
  if (acc.has('policeCap')) {
    neck.add(mesh(new THREE.CylinderGeometry(0.46, 0.44, 0.22, 16), 0x1f2d4f, 0, H.head + 0.08, -0.02));
    neck.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 16), 0x16213a, 0, H.head + 0.2, -0.02));
    neck.add(mesh(box(0.5, 0.04, 0.26), 0x111111, 0, H.head - 0.02, fz - 0.06));
    neck.add(mesh(box(0.14, 0.1, 0.03), 0xf2c94c, 0, H.head + 0.1, fz - 0.03, { flat: true }));
  }
  if (acc.has('chefHat')) { neck.add(mesh(new THREE.CylinderGeometry(0.44, 0.4, 0.3, 16), 0xf8f8f8, 0, H.head + 0.12, -0.02)); neck.add(mesh(new THREE.SphereGeometry(0.46, 12, 10), 0xffffff, 0, H.head + 0.3, -0.02)); }
  if (acc.has('glasses')) {
    for (const s of [-1, 1]) { const f = mesh(box(0.26, 0.2, 0.03), DARK, s * 0.17, H.head * 0.46, fz + 0.03); const lens = mesh(box(0.2, 0.14, 0.035), 0x9ad0ff, s * 0.17, H.head * 0.46, fz + 0.03, { flat: true }); neck.add(f); neck.add(lens); }
    neck.add(mesh(box(0.1, 0.03, 0.03), DARK, 0, H.head * 0.46, fz + 0.03));
    for (const s of [-1, 1]) neck.add(mesh(box(0.03, 0.03, 0.4), DARK, s * (H.headW / 2 + 0.01), H.head * 0.46, fz - 0.2));
  }
  if (acc.has('headset')) {
    const band = mesh(new THREE.TorusGeometry(0.46, 0.03, 8, 20, Math.PI), 0x2a2a30, 0, H.head - 0.1, 0); band.rotation.z = 0; neck.add(band);
    for (const s of [-1, 1]) neck.add(mesh(rbox(0.1, 0.18, 0.18, 0.04), 0x2a2a30, s * (H.headW / 2 + 0.05), H.head * 0.42, 0));
    const mic = mesh(box(0.03, 0.03, 0.34), 0x2a2a30, -0.3, H.head * 0.3, fz - 0.12); mic.rotation.y = 0.4; neck.add(mic); neck.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), 0xd9463b, -0.2, H.head * 0.27, fz + 0.04));
  }
  if (acc.has('earring')) for (const s of [-1, 1]) neck.add(mesh(new THREE.SphereGeometry(0.03, 6, 6), 0xd9463b, s * (H.headW / 2 + 0.03), H.head * 0.3, 0, { flat: true }));

  // 手持道具（掛在右手或雙手）
  const handR = arms[1], handL = arms[0];
  const hold = (m, side = 1) => { (side > 0 ? handR : handL).add(m); };
  if (acc.has('laptop')) { const g = new THREE.Group(); g.position.set(-0.3, -armL + 0.1, 0.26); g.add(mesh(box(0.56, 0.03, 0.4), 0x8a8f99)); const scr = mesh(box(0.56, 0.36, 0.03), 0x8a8f99, 0, 0.18, -0.2); g.add(scr); g.add(mesh(box(0.5, 0.3, 0.02), 0x66c2ff, 0, 0.18, -0.18, { flat: true })); hold(g, 1); }
  if (acc.has('tray')) { const g = new THREE.Group(); g.position.set(0, -armL + 0.1, 0.22); g.add(mesh(box(0.5, 0.03, 0.34), 0xc9a46a)); for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.16, 8), 0xf2dcb8, -0.15 + i * 0.15, 0.1, 0)); for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.05, 8), 0x4a3020, -0.15 + i * 0.15, 0.05, 0)); hold(g, 1); }
  if (acc.has('calculator')) { const g = new THREE.Group(); g.position.set(0.05, -armL + 0.08, 0.14); g.add(mesh(box(0.22, 0.04, 0.34), 0x2a2a2a)); g.add(mesh(box(0.18, 0.02, 0.1), 0xa8e070, 0, 0.03, -0.1, { flat: true })); for (let i = 0; i < 6; i++) g.add(mesh(box(0.04, 0.02, 0.04), 0xeeeeee, -0.06 + (i % 3) * 0.06, 0.03, 0.03 + Math.floor(i / 3) * 0.06, { flat: true })); hold(g, 1); }
  if (acc.has('flashlight')) { const g = new THREE.Group(); g.position.set(0, -armL + 0.05, 0.08); const t = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), 0x2a2a2a); t.rotation.x = Math.PI / 2; g.add(t); const hd = mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.08, 8), 0x3a3a3a, 0, 0, 0.18); hd.rotation.x = Math.PI / 2; g.add(hd); g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 8), 0xfff2a0, 0, 0, 0.225, { flat: true }).rotateX(Math.PI / 2)); hold(g, 1); }
  if (acc.has('radio')) { const g = mesh(box(0.1, 0.18, 0.06), 0x1a1a1a, 0, -armL + 0.1, 0.1); g.add(mesh(box(0.02, 0.14, 0.02), 0x1a1a1a, 0.03, 0.14, 0)); hold(g, -1); }
  if (acc.has('tongs')) { const g = new THREE.Group(); g.position.set(0, -armL + 0.05, 0.1); for (const s of [-1, 1]) { const t = mesh(box(0.025, 0.025, 0.36), 0xc0c4cc, s * 0.03, 0, 0.1); t.rotation.y = -s * 0.15; g.add(t); } hold(g, 1); }

  // 影子接收：腳下不用；人偶都投影
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

  const api = {
    root, def, kind: 'procedural',
    parts: { body, torso, neck, legs, arms, head },
    phase: Math.random() * 6, bob: 0, lean: 0, roll: 0, spin: 0, squash: 1,
    // state：{ speed, maxSpeed, grounded, stun, slip, dash, finished, idle, steer }
    update(dt, s) {
      const sp = s.speed || 0, ratio = clamp(sp / (s.maxSpeed || 11), 0, 1.6);
      const run = ratio > 0.03;
      this.phase += dt * (run ? 7 + ratio * 8 : 1.2);
      const ph = this.phase, swing = run ? (0.75 + ratio * 0.45) : 0;
      const grounded = s.grounded !== false;
      let legA = Math.sin(ph) * swing, armA = -Math.sin(ph) * swing * 0.9;
      let bob = run && grounded ? Math.abs(Math.cos(ph)) * (0.05 + ratio * 0.06) : Math.sin(ph) * 0.01;
      let lean = run ? 0.12 + ratio * 0.18 : 0, roll = -(s.steer || 0) * 0.22 * ratio;
      let kneeL = 0, kneeR = 0;
      if (!grounded) { legA = 0; bob = 0.02; lean = 0.05; kneeL = -0.9; kneeR = -0.4; armA = 0; }
      if (s.slip > 0) { this.spin += dt * 14; roll = Math.sin(this.spin) * 0.3; lean = -0.25; legA = Math.sin(this.spin * 2) * 0.8; }
      else this.spin = damp(this.spin, 0, 8, dt);
      if (s.stun > 0 && !s.slip) { lean = 0.55; legA = Math.sin(ph * 2) * 0.3; armA = 0; bob = -0.08; } // 跌跌撞撞
      if (s.finished) { legA = 0; armA = 0; bob = Math.abs(Math.sin(ph * 1.2)) * 0.25; lean = -0.05; } // 歡呼跳
      this.bob = damp(this.bob, bob, 18, dt); this.lean = damp(this.lean, lean, 10, dt); this.roll = damp(this.roll, roll, 10, dt);
      body.position.y = hipY + this.bob;
      torso.rotation.set(this.lean, 0, this.roll);
      torso.rotation.y = s.slip > 0 ? this.spin : 0;
      legs[0].rotation.x = legA + kneeL; legs[1].rotation.x = -legA + kneeR;
      const armBase = s.finished ? -2.8 : (!grounded ? -2.2 : 0);
      arms[0].rotation.x = armBase + armA; arms[1].rotation.x = armBase - armA;
      arms[0].rotation.z = 0.15 + (s.finished ? -0.4 : 0); arms[1].rotation.z = -0.15 + (s.finished ? 0.4 : 0);
      neck.rotation.x = -this.lean * 0.6 + (s.finished ? -0.2 : 0);
      neck.rotation.z = -this.roll * 0.4;
      neck.rotation.y = s.slip > 0 ? 0 : (s.steer || 0) * 0.15;
      // 落地 squash：landing 事件由外面設 this.squash = 0.8
      this.squash = damp(this.squash, 1, 12, dt);
      root.scale.set(1 / this.squash, this.squash, 1 / this.squash);
    },
  };
  return api;
}

/* 外部 GLB（例如 Gobkit 的角色包）：
   models/manifest.json → { "<角色 id>": { "file": "xxx.glb", "height": 1.7, "clips": { "run": "Run", "idle": "Idle", "jump": "Jump", "fall": "Fall", "win": "Victory" } } }
   回傳與 createRunner 一樣的 api（update(dt, state)），載入失敗回傳 null。*/
let manifestPromise = null;
export function loadManifest(base = './models/') {
  if (!manifestPromise) manifestPromise = fetch(base + 'manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
  return manifestPromise;
}
export async function createRunnerFromGLB(def, entry, base = './models/') {
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(base + entry.file);
    const model = gltf.scene;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    // 依指定身高縮放、腳底對齊 y=0
    const bb = new THREE.Box3().setFromObject(model), size = bb.getSize(new THREE.Vector3());
    const sc = (entry.height || 1.7) / (size.y || 1); model.scale.setScalar(sc);
    bb.setFromObject(model); model.position.y -= bb.min.y; model.position.x -= (bb.min.x + bb.max.x) / 2; model.position.z -= (bb.min.z + bb.max.z) / 2;
    if (entry.rotateY) model.rotation.y = entry.rotateY;
    const root = new THREE.Group(); root.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const clips = {}, names = entry.clips || {};
    const find = (n) => gltf.animations.find(a => a.name === n) || gltf.animations.find(a => a.name.toLowerCase().includes((n || '').toLowerCase()));
    for (const k of ['run', 'idle', 'jump', 'fall', 'win']) { const c = names[k] ? find(names[k]) : find(k); if (c) clips[k] = mixer.clipAction(c); }
    if (!clips.run && gltf.animations[0]) clips.run = mixer.clipAction(gltf.animations[0]);
    let cur = null;
    const play = (k, fade = 0.15) => { const a = clips[k] || clips.run; if (!a || a === cur) return; if (cur) cur.fadeOut(fade); a.reset().fadeIn(fade).play(); cur = a; };
    play('idle');
    return {
      root, def, kind: 'glb', squash: 1, lean: 0,
      update(dt, s) {
        const ratio = clamp((s.speed || 0) / (s.maxSpeed || 11), 0, 1.6);
        if (s.finished) play('win'); else if (s.stun > 0 || s.slip > 0) play('fall'); else if (s.grounded === false) play('jump'); else if (ratio > 0.05) play('run'); else play('idle');
        if (cur === clips.run && clips.run) clips.run.timeScale = 0.6 + ratio * 0.8;
        mixer.update(dt);
        this.lean = damp(this.lean, ratio > 0.05 ? 0.08 + ratio * 0.1 : 0, 8, dt);
        model.rotation.x = this.lean; model.rotation.z = -(s.steer || 0) * 0.15 * ratio;
        this.squash = damp(this.squash, 1, 12, dt); root.scale.set(1 / this.squash, this.squash, 1 / this.squash);
      },
    };
  } catch (e) { console.warn('GLB 載入失敗，改用程式人偶', def.id, e); return null; }
}

export async function createRunnerAuto(def) {
  const mf = await loadManifest();
  if (mf && mf[def.id]) { const r = await createRunnerFromGLB(def, mf[def.id]); if (r) return r; }
  return createRunner(def);
}
