// 比賽模擬：跑者物理（轉向、衝刺、跳躍、撞牆）、AI 對手、道具箱與道具、障礙物與會動的東西的碰撞、圈數與名次。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CFG } from './config.js';
import { clamp, lerp, angleDiff, damp, textSprite, rng as mkRng } from './util.js';

const P = CFG.phys;
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const itemGeo = new RoundedBoxGeometry(1.25, 1.25, 1.25, 2, 0.14);

export class Race {
  constructor({ track, world, defs, playerIndex, laps, difficulty, onEvent, makeRig }) {
    this.track = track; this.world = world; this.laps = laps; this.diff = CFG.difficulty[difficulty] || CFG.difficulty.normal;
    this.on = onEvent || (() => {}); this.N = track.N;
    this.group = new THREE.Group();
    this.time = 0; this.state = 'countdown'; this.countdown = 3.6; this.lastCount = 4; this.raceTime = 0;
    this.R = mkRng(12345);
    this.effects = []; this.projectiles = []; this.bananas = [];
    // 障礙物投影到賽道（AI 用）
    for (const o of world.obstacles) { const pr = track.nearest(_v.set(o.x, 0, o.z), null, {}); o.idx = pr.idx; o.lat = pr.lateral; }
    // 道具箱
    this.boxes = [];
    for (const t of world.itemT) for (const lane of [-1, 0, 1]) { const lat = lane * track.halfW * 0.62;
      const p = track.pointT(t, lat), idx = track.idxAtT(t);
      const mesh = new THREE.Mesh(itemGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x442266 }));
      mesh.position.set(p.x, p.y + 1.3, p.z); mesh.castShadow = true;
      const q = textSprite('?', { color: '#fff', bg: 'rgba(0,0,0,0)', size: 56, w: 96, h: 96 }); q.scale.set(1.5, 1.5, 1); mesh.add(q);
      this.group.add(mesh);
      this.boxes.push({ x: p.x, z: p.z, y: p.y, idx, lat, mesh, active: true, respawn: 0, phase: Math.random() * 6 });
    }
    // 跑者
    this.racers = defs.map((def, i) => {
      const rig = makeRig(def);
      const r = {
        i, def, rig, isPlayer: i === playerIndex, name: def.name, stats: Object.assign({ speed: 1, accel: 1, handling: 1, weight: 1, dash: 1, draft: 1, shove: 1, tough: 1, jump: 1 }, def.stats),
        pos: new THREE.Vector3(), heading: 0, speed: 0, h: 0, vy: 0, grounded: true, slide: new THREE.Vector3(),
        idx: 0, frac: 0, lateral: 0, lap: 0, prog: 0, total: 0, place: i + 1,
        lane: 0, lat: 0, latKick: 0, lunge: 0, mash: 0, lastMash: '', brakeT: 0,
        dash: 1, dashing: false, stun: 0, slip: 0, shield: 0, boost: 0, immune: 0, shoveCd: 0, puddle: false, sidewalk: false, wrongT: 0, finished: false, finishTime: 0,
        item: null, itemCd: 0, steer: 0, brake: false, lastBoost: -1, hint: null,
        ai: { lane: 0, laneT: 0, wobble: Math.random() * 10, skill: lerp(0.85, 1.0, Math.random()), persona: lerp(0.97, 1.03, Math.random()), itemT: 2 + Math.random() * 4, jumpT: 0, dashHold: false, mash: lerp(0.35, 0.75, Math.random()), mashT: 0 },
      };
      const group = new THREE.Group(); group.add(rig.root);
      const tag = textSprite(def.name, { color: r.isPlayer ? '#ffe066' : '#fff', bg: r.isPlayer ? 'rgba(200,60,40,.85)' : 'rgba(20,20,40,.7)' }); tag.position.y = 2.3; tag.scale.multiplyScalar(0.55); tag.visible = i !== playerIndex; group.add(tag);
      r.group = group; r.tag = tag; this.group.add(group);
      // 起跑格：兩排四列，在起跑線後面
      const row = Math.floor(i / 3), col = i % 3; r.prog = this.N - 5 - row * 3.5; r.lane = col - 1; r.lat = r.lane * this.LW;
      this._rail(r); this._project(r); r.lap = 0;
      this._place(r);
      return r;
    });
    this.player = this.racers[playerIndex];
  }
  get LW() { return this.track.halfW * 0.62; } // 三線道的間距（6.4 公尺寬的路≈2 公尺）
  // 由 (prog, lat) 算世界座標與朝向
  _rail(r) {
    const N = this.N; r.prog = ((r.prog % N) + N) % N;
    const i = Math.floor(r.prog), f = r.prog - i; this.track.point(i, r.lat, f, r.pos); r.heading = this.track.yaw[i];
  }
  _project(r) {
    const prev = r.idx, N = this.N, i = Math.floor(r.prog), f = r.prog - i;
    r.idx = i; r.frac = f; r.lateral = r.lat; r.hint = i; r.groundY = lerp(this.track.pos[i].y, this.track.pos[(i + 1) % N].y, f); r.tanYaw = this.track.yaw[i]; r.curv = this.track.curv[i];
    // 跨越終點線
    if (this.state === 'racing' && !r.finished) {
      if (prev > this.N * 0.75 && r.idx < this.N * 0.25) { r.lap++; if (r.lap > this.laps) { r.finished = true; r.finishTime = this.raceTime; this.on('finish', r); } else if (r.lap > 1) this.on('lap', r); }
      else if (prev < this.N * 0.25 && r.idx > this.N * 0.75) r.lap--;
    }
    r.total = r.lap * this.N + r.prog; r.sidewalk = false;
  }
  _place(r) {
    const y = r.groundY + (r.sidewalk ? 0.14 : 0) + r.h;
    r.group.position.set(r.pos.x, y, r.pos.z); r.group.rotation.y = r.heading;
  }
  // 玩家輸入：{ left, right（換道，按一下）, jump, brake（按住）, brakePulse, dash（拉桿）, mashL, mashR（左右交替點擊加速）, shove, item }
  update(dt, input) {
    dt = Math.min(dt, 0.05); this.time += dt;
    if (this.state === 'countdown') {
      this.countdown -= dt; const c = Math.ceil(this.countdown);
      if (c !== this.lastCount && c >= 1 && c <= 3) { this.lastCount = c; this.on('count', c); }
      if (this.countdown <= 0) { this.state = 'racing'; this.on('go'); }
    }
    if (this.state === 'racing') this.raceTime += dt;
    const racing = this.state === 'racing';
    // 會動的東西
    for (const m of this.world.movers) m.update(dt, this.time);
    // 道具箱
    for (const b of this.boxes) { b.phase += dt; if (!b.active) { b.respawn -= dt; if (b.respawn <= 0) { b.active = true; b.mesh.visible = true; } } b.mesh.rotation.y = b.phase * 1.5; b.mesh.rotation.x = Math.sin(b.phase) * 0.3; b.mesh.position.y = b.y + 1.3 + Math.sin(b.phase * 2) * 0.12; b.mesh.material.emissive.setHSL((b.phase * 0.15) % 1, 0.7, 0.35); b.mesh.material.color.setHSL((b.phase * 0.15 + 0.5) % 1, 0.6, 0.75); }
    // 名次（給 AI 道具與橡皮筋用）
    const order = [...this.racers].sort((a, b) => (a.finished && b.finished) ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : b.total - a.total);
    order.forEach((r, k) => r.place = k + 1);
    for (const r of this.racers) {
      const inp = r.isPlayer ? (input || {}) : this._ai(r, dt, racing);
      this._step(r, inp, dt, racing);
    }
    this._collide(dt);
    for (const r of this.racers) { this._project(r); this._place(r); r.rig.update(dt, { speed: r.speed, maxSpeed: P.maxSpeed, grounded: r.grounded, stun: r.stun, slip: r.slip, finished: r.finished, steer: r.steer }); }
    this._projectiles(dt); this._effects(dt);
    if (this.player.finished && this.state === 'racing') { this.state = 'finished'; this.on('raceOver'); }
  }
  _step(r, inp, dt, racing) {
    const S = r.stats, tr = this.track, LW = this.LW;
    r.stun = Math.max(0, r.stun - dt); r.slip = Math.max(0, r.slip - dt); r.shield = Math.max(0, r.shield - dt); r.boost = Math.max(0, r.boost - dt); r.immune = Math.max(0, r.immune - dt); r.shoveCd = Math.max(0, r.shoveCd - dt); r.itemCd = Math.max(0, r.itemCd - dt); r.brakeT = Math.max(0, r.brakeT - dt);
    const canAct = racing && !r.finished && r.stun <= 0 && r.slip <= 0;
    // 換道（三格）
    if (canAct && inp.left) r.lane = Math.max(-1, r.lane - 1);
    if (canAct && inp.right) r.lane = Math.min(1, r.lane + 1);
    // 左右交替點擊加速：每次換邊 +0.16，會慢慢消退
    if (inp.mash !== undefined) r.mash = inp.mash;
    else {
      if (canAct && inp.mashL && r.lastMash !== 'L') { r.lastMash = 'L'; r.mash = Math.min(1, r.mash + 0.16); if (r.isPlayer) this.on('mash', r); }
      if (canAct && inp.mashR && r.lastMash !== 'R') { r.lastMash = 'R'; r.mash = Math.min(1, r.mash + 0.16); if (r.isPlayer) this.on('mash', r); }
      r.mash = Math.max(0, r.mash - 0.4 * dt);
    }
    if (inp.brakePulse) r.brakeT = 0.6;
    r.brake = canAct && (!!inp.brake || r.brakeT > 0);
    // 衝刺（拉桿）
    const wantDash = canAct && !!inp.dash && r.dash > 0.02;
    r.dashing = wantDash;
    if (r.dashing) r.dash = Math.max(0, r.dash - P.dashDrain / S.dash * dt); else r.dash = Math.min(1, r.dash + P.dashRegen * dt);
    // 跟跑：前方 5 公尺內有人且同一線道附近
    let draft = false;
    for (const o of this.racers) { if (o === r) continue; const d = o.total - r.total; if (d > 0.5 && d < 5.5 && Math.abs(o.lat - r.lat) < 1.3) { draft = true; break; } }
    if (draft && racing) r.dash = Math.min(1, r.dash + P.draftRegen * S.draft * dt);
    // 目標速度：基礎 82%，交替點擊最多再加 30%
    let target = racing && !r.finished ? P.maxSpeed * S.speed * (0.82 + 0.3 * r.mash) : 0;
    if (r.dashing) target *= P.dashMul;
    if (r.boost > 0) target *= 1.5;
    if (draft) target *= 1.06;
    if (r.puddle && r.grounded) target *= 0.6;
    if (r.brake) target *= 0.35;
    if (r.stun > 0) target *= P.stunMul;
    if (r.slip > 0) target *= 0.3;
    if (!r.isPlayer) target *= r.aiMul || 1;
    const rate = P.accel * S.accel * (target < r.speed ? 2.2 : 1) * (r.grounded ? 1 : 0.4);
    r.speed = damp(r.speed, target, rate / 4, dt);
    // 跳
    if (canAct && inp.jump && r.grounded) { r.vy = P.jumpV * S.jump; r.grounded = false; this.on('jump', r); }
    if (!r.grounded) { r.vy -= P.gravity * dt; r.h += r.vy * dt; if (r.h <= 0) { r.h = 0; r.vy = 0; r.grounded = true; r.rig.squash = 0.82; this.on('land', r); } }
    // 推人
    if (canAct && inp.shove && r.shoveCd <= 0) { r.shoveCd = P.shoveCooldown; this._shove(r); }
    // 道具
    if (canAct && inp.item && r.item && r.itemCd <= 0) this._useItem(r);
    // 沿軌道前進（lunge 是推人時的小衝、被撞時的後退）
    r.prog += r.speed * dt + r.lunge * dt; r.lunge *= Math.exp(-6 * dt);
    // 橫向：往自己的線道靠，被撞會偏出去再回來
    const prevLat = r.lat, laneSpeed = 7.5 * S.handling;
    r.latKick *= Math.exp(-3 * dt);
    const targetLat = r.lane * LW + r.latKick;
    r.lat += clamp(targetLat - r.lat, -laneSpeed * dt, laneSpeed * dt);
    r.lat = clamp(r.lat, -(tr.halfW - 0.55), tr.halfW - 0.55);
    r.steer = damp(r.steer, clamp((r.lat - prevLat) / (laneSpeed * dt || 1), -1, 1), 10, dt);
    if (r.slip > 0) r.heading += dt * 2.5;
    this._rail(r);
    if (r.slip > 0) r.heading = tr.yaw[r.idx] + (this.time * 6) % (Math.PI * 2); // 打滑：原地轉圈
  }
  _ai(r, dt, racing) {
    if (!racing || r.finished) return {};
    const tr = this.track, A = r.ai, N = this.N, pl = this.player, LW = this.LW;
    const gap = clamp((pl.total - r.total) / 70, -1, 1);
    r.aiMul = this.diff.aiSpeed * A.persona * (1 + this.diff.rubber * gap) * (pl.finished ? 1.05 : 1);
    // 節奏（模擬交替點擊）：每幾秒換一個等級
    A.mashT -= dt; if (A.mashT <= 0) { A.mashT = 2 + Math.random() * 3; A.mash = clamp(lerp(0.3, 0.85, Math.random()) * A.skill, 0, 1); }
    const laneOf = (lat) => Math.max(-1, Math.min(1, Math.round(lat / LW)));
    // 哪些線道前方被擋（障礙、香蕉皮、會動的東西、停住的跑者）
    const blocked = [false, false, false], jumpable = [false, false, false], look = 13;
    const mark = (lat, kind) => { const l = laneOf(lat) + 1; if (kind === 'jumpable') jumpable[l] = true; else blocked[l] = true; };
    let brake = false;
    for (const o of this.world.obstacles) { const d = (o.idx - r.idx + N) % N; if (d < 0.5 || d > look) continue; if (o.kind === 'puddle') continue; mark(o.lat, o.kind); }
    for (const bn of this.bananas) { const d = (bn.idx - r.idx + N) % N; if (d > 0.5 && d < look) mark(bn.lat, 'solid'); }
    for (const m of this.world.movers) for (const h of m.hits) { if (h.x > 1e5) continue; const dx = h.x - r.pos.x, dz = h.z - r.pos.z; if (dx * dx + dz * dz > 400) continue; const pr = tr.nearest(_v.set(h.x, 0, h.z), r.hint, {}); const d = (pr.idx - r.idx + N) % N; if (d < 0.5 || d > look + 4) continue; if (m.name === '電車' || m.warning) { brake = true; } else mark(pr.lateral, 'solid'); }
    // 想去的線道：沒道具就往道具箱靠，偶爾隨機換；被擋就換到沒被擋的
    A.laneT -= dt; if (A.laneT <= 0) { A.laneT = 3 + Math.random() * 4; A.lane = Math.floor(Math.random() * 3) - 1; }
    let want = A.lane;
    if (!r.item) { let best = null, bd = 1e9; for (const b of this.boxes) { if (!b.active) continue; const d = (b.idx - r.idx + N) % N; if (d > 2 && d < 40 && d < bd) { bd = d; best = b; } } if (best) want = laneOf(best.lat); }
    const bad = (l) => blocked[l + 1] || (jumpable[l + 1] && Math.random() > A.skill * 0.5);
    if (bad(want)) { const cands = [r.lane, r.lane - 1, r.lane + 1, -want].filter(l => l >= -1 && l <= 1 && !blocked[l + 1]); want = cands.length ? cands[0] : want; }
    if (bad(r.lane) && bad(want)) { const free = [-1, 0, 1].filter(l => !blocked[l + 1]); if (free.length) want = free.sort((a, b2) => Math.abs(a - r.lane) - Math.abs(b2 - r.lane))[0]; }
    const left = want < r.lane, right = want > r.lane;
    // 跳過前方可跳的障礙
    let jump = false; A.jumpT -= dt;
    for (const o of this.world.obstacles) { if (o.kind !== 'jumpable') continue; const d = (o.idx - r.idx + N) % N; if (d > 2.5 && d < 3.2 + r.speed * 0.18 && Math.abs(o.lat - r.lat) < o.r + 0.7 && A.jumpT <= 0 && Math.random() < A.skill) { jump = true; A.jumpT = 1; } }
    // 衝刺：直線且能量夠
    if (!A.dashHold && r.dash > 0.55 && Math.abs(r.curv || 0) < 0.03) A.dashHold = true;
    if (A.dashHold && (r.dash < 0.08 || Math.abs(r.curv || 0) > 0.06)) A.dashHold = false;
    // 道具
    let item = false; A.itemT -= dt;
    if (r.item && A.itemT <= 0 && Math.random() < this.diff.aiItems) {
      const behind = this.racers.some(o => o !== r && r.total - o.total > 0 && r.total - o.total < 8 && Math.abs(o.lat - r.lat) < 2.5);
      const aheadR = this.racers.some(o => o !== r && o.total - r.total > 0 && o.total - r.total < 22 && Math.abs(o.lat - r.lat) < 1.8);
      if (r.item === 'boba' && r.place > 1) item = true; if (r.item === 'banana' && behind) item = true; if (r.item === 'slipper' && aheadR) item = true; if (r.item === 'charm' && behind) item = true; if (r.item === 'cracker' && this.racers.some(o => o !== r && o.total - r.total > 0 && o.total - r.total < 14)) item = true;
      if (A.itemT < -6) item = true;
      if (item) A.itemT = 2 + Math.random() * 3;
    }
    const shove = this.racers.some(o => o !== r && Math.hypot(o.pos.x - r.pos.x, o.pos.z - r.pos.z) < P.shoveRange * 0.9 && o.total > r.total) && Math.random() < 0.02;
    return { left, right, jump, dash: A.dashHold && !brake, item, shove, brake, mash: A.mash };
  }
  _hit(r, dur, by) { // 被絆倒／撞到
    if (r.shield > 0) { r.shield = 0; this.on('shieldBreak', r); return false; }
    if (r.immune > 0 || r.finished) return false;
    r.stun = Math.max(r.stun, dur / r.stats.tough); r.immune = 0.9; r.speed *= 0.35; r.dashing = false;
    this.on('hit', r, by); this._burst(r.pos, 0xffe066, 8, 1.6);
    return true;
  }
  // 被撞飛到隔壁線道（在最邊邊就往另一邊）
  _knockLane(r, side) {
    let dir = side >= 0 ? 1 : -1; if (r.lane + dir < -1 || r.lane + dir > 1) dir = -dir;
    r.lane = Math.max(-1, Math.min(1, r.lane + dir)); r.latKick += dir * 0.5;
  }
  _shove(r) {
    this.on('shove', r);
    r.lunge += 4;
    for (const o of this.racers) {
      if (o === r) continue; const dp = o.total - r.total, dl = o.lat - r.lat, d = Math.hypot(dp, dl);
      if (d < P.shoveRange * (1 + (r.stats.shove - 1) * 0.3) && dp > -0.3) {
        const k = 2.2 * r.stats.shove / o.stats.weight;
        if (this._hit(o, P.shoveStun, r)) { o.latKick += (dl >= 0 ? 1 : -1) * k; o.lunge += 3; }
      }
    }
  }
  _useItem(r) {
    const it = r.item; r.item = null; r.itemCd = 0.5; this.on('useItem', r, it);
    if (it === 'boba') { r.boost = 2.5; r.dash = 1; }
    if (it === 'charm') { r.shield = 8; }
    if (it === 'banana') { const prog = ((r.prog - 1.8) % this.N + this.N) % this.N, i = Math.floor(prog); const bp = this.track.point(i, r.lat, prog - i); const m = makeBanana(); m.position.set(bp.x, bp.y + 0.08, bp.z); this.group.add(m); this.bananas.push({ x: bp.x, z: bp.z, mesh: m, owner: r, age: 0, idx: i, lat: r.lat }); }
    if (it === 'slipper') { const m = makeSlipper(); m.position.copy(r.pos).setY(r.group.position.y + 1.0); this.group.add(m); this.projectiles.push({ mesh: m, x: r.pos.x, z: r.pos.z, y: m.position.y, heading: r.heading, speed: r.speed + 16, life: 2.4, owner: r, spin: 0 }); }
    if (it === 'cracker') { this._burst(r.pos, 0xff4030, 30, 4); for (const o of this.racers) { if (o === r) continue; const d = o.total - r.total; if (d > -2 && d < 14) { if (this._hit(o, 1.1, r)) { o.latKick += (Math.random() - 0.5) * 3; } } } }
  }
  _collide(dt) {
    const tr = this.track, R2 = (P.radius * 2) ** 2;
    // 跑者互撞
    for (let i = 0; i < this.racers.length; i++) for (let j = i + 1; j < this.racers.length; j++) {
      const a = this.racers[i], b = this.racers[j]; const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < R2 && d2 > 1e-6 && Math.abs(a.h - b.h) < 1.0) {
        const d = Math.sqrt(d2), over = P.radius * 2 - d, wa = a.stats.weight, wb = b.stats.weight, ta = wb / (wa + wb), tb = wa / (wa + wb);
        const dl = b.lat - a.lat, sgn = dl >= 0 ? 1 : -1;
        if (Math.abs(dl) > 0.25) { a.lat -= sgn * over * ta; b.lat += sgn * over * tb; a.latKick -= sgn * 0.6 * ta; b.latKick += sgn * 0.6 * tb; }
        else { const dp = b.total - a.total; if (dp >= 0) a.speed *= 0.97; else b.speed *= 0.97; }
        if (!a.bumpT || this.time - a.bumpT > 0.5) { this.on('bump', a, b); a.bumpT = b.bumpT = this.time; }
      }
    }
    for (const r of this.racers) {
      r.puddle = false;
      // 障礙物
      for (const o of this.world.obstacles) {
        const dx = r.pos.x - o.x, dz = r.pos.z - o.z, rr = o.r + P.radius * 0.8; if (dx * dx + dz * dz > rr * rr) continue;
        if (o.kind === 'puddle') { if (r.grounded) r.puddle = true; continue; }
        if (o.kind === 'jumpable' && r.h >= o.h - 0.05) continue;
        if (this._hit(r, o.kind === 'solid' ? 1.0 : 0.8, o)) { this._knockLane(r, r.lat - (o.lat ?? r.lat)); r.lunge -= 3; }
      }
      // 會動的東西
      for (const m of this.world.movers) for (const h of m.hits) {
        if (h.x > 1e5) continue; const dx = r.pos.x - h.x, dz = r.pos.z - h.z, rr = h.r + P.radius * 0.8; if (dx * dx + dz * dz > rr * rr || r.h >= h.h) continue;
        if (this._hit(r, m.stun, m)) { this._knockLane(r, Math.random() - 0.5); r.latKick += (r.lane >= 0 ? 1 : -1) * 0.8; r.lunge -= 6; }
      }
      // 香蕉皮
      for (let k = this.bananas.length - 1; k >= 0; k--) { const bn = this.bananas[k]; if (bn.owner === r && bn.age < 1.2) continue; if (!r.grounded || r.slip > 0) continue; if ((r.pos.x - bn.x) ** 2 + (r.pos.z - bn.z) ** 2 < 1.0) { if (r.shield > 0) { r.shield = 0; this.on('shieldBreak', r); } else { r.slip = 1.1; r.speed *= 0.3; this.on('slip', r); } this.group.remove(bn.mesh); this.bananas.splice(k, 1); } }
      // 道具箱
      if (!r.item && !r.finished) for (const b of this.boxes) { if (!b.active) continue; if ((r.pos.x - b.x) ** 2 + (r.pos.z - b.z) ** 2 < 1.6) { b.active = false; b.respawn = 5; b.mesh.visible = false; r.item = this._rollItem(r); this.on('item', r, r.item); this._burst(b, 0xffffff, 10, 1.2); } }
      // 加速墊
      let onBoost = -1; this.world.boosts.forEach((bp, k) => { if ((r.pos.x - bp.x) ** 2 + (r.pos.z - bp.z) ** 2 < bp.r * bp.r) onBoost = k; });
      if (onBoost >= 0 && r.lastBoost !== onBoost && r.grounded) { r.boost = Math.max(r.boost, 1.3); r.dash = Math.min(1, r.dash + 0.3); this.on('boost', r); }
      r.lastBoost = onBoost;
      r.lat = clamp(r.lat, -(tr.halfW - 0.55), tr.halfW - 0.55); this._rail(r);
    }
    for (const bn of this.bananas) bn.age += dt;
  }
  _rollItem(r) {
    const n = this.racers.length, p = r.place; const pool = p <= Math.max(1, Math.round(n * 0.3)) ? CFG.itemWeightsByPlace.front : p >= Math.round(n * 0.7) ? CFG.itemWeightsByPlace.back : CFG.itemWeightsByPlace.mid;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  _projectiles(dt) {
    for (let k = this.projectiles.length - 1; k >= 0; k--) {
      const p = this.projectiles[k]; p.life -= dt; p.x += Math.sin(p.heading) * p.speed * dt; p.z += Math.cos(p.heading) * p.speed * dt; p.spin += dt * 12;
      p.mesh.position.set(p.x, p.y, p.z); p.mesh.rotation.set(p.spin, p.heading, 0);
      let gone = p.life <= 0;
      const pr = this.track.nearest(_v.set(p.x, 0, p.z), p.owner.hint, {}); if (Math.abs(pr.lateral) > this.track.limit) gone = true;
      for (const o of this.racers) { if (o === p.owner) continue; if ((o.pos.x - p.x) ** 2 + (o.pos.z - p.z) ** 2 < 1.1 && o.h < 1.2) { if (this._hit(o, 1.2, p.owner)) { o.latKick += (Math.random() < 0.5 ? -1 : 1) * 1.5; o.lunge += 2; } gone = true; break; } }
      if (gone) { this.group.remove(p.mesh); this.projectiles.splice(k, 1); }
    }
  }
  _burst(pos, color, n, spd) {
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18), mat = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mat); m.position.set(pos.x, (pos.y || 0) + 1, pos.z); const a = Math.random() * Math.PI * 2, s = spd * (0.5 + Math.random()); this.effects.push({ mesh: m, vx: Math.sin(a) * s, vz: Math.cos(a) * s, vy: 2 + Math.random() * 4, life: 0.7 + Math.random() * 0.4 }); this.group.add(m); }
  }
  _effects(dt) {
    for (let k = this.effects.length - 1; k >= 0; k--) { const e = this.effects[k]; e.life -= dt; e.vy -= 12 * dt; e.mesh.position.x += e.vx * dt; e.mesh.position.y += e.vy * dt; e.mesh.position.z += e.vz * dt; e.mesh.rotation.x += dt * 5; e.mesh.rotation.z += dt * 3; e.mesh.scale.setScalar(Math.max(0.01, e.life)); if (e.life <= 0) { this.group.remove(e.mesh); this.effects.splice(k, 1); } }
  }
  standings() {
    return [...this.racers].sort((a, b) => (a.finished && b.finished) ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : b.total - a.total);
  }
}

function makeBanana() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf5d442 })); m.scale.set(1, 0.3, 0.7); g.add(m);
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), new THREE.MeshLambertMaterial({ color: 0x6a4a1a })); s.position.set(0.4, 0.15, 0); g.add(s);
  return g;
}
function makeSlipper() {
  const g = new THREE.Group();
  const sole = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.12, 0.9, 2, 0.05), new THREE.MeshLambertMaterial({ color: 0xffffff })); g.add(sole);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 10, Math.PI), new THREE.MeshLambertMaterial({ color: 0x3b7bd9 })); strap.rotation.y = Math.PI / 2; strap.position.set(0, 0.06, 0.1); g.add(strap);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.9), new THREE.MeshLambertMaterial({ color: 0x3b7bd9 })); band.position.y = -0.03; g.add(band);
  return g;
}
