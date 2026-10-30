/* 逛校園：自己的角色（穿著金蛋買的衣服）在草原小鎮散步——鍵盤／搖桿／點地板，走過門口就換到隔壁的學期區塊（轉場）。走到服飾店、工地、校長旁邊會出現「進去」的按鈕（near 事件）。
   其他正在逛的玩家（多人同框）：位置由 play 頻道送來，這裡平滑靠過去，穿著照他們買的衣服畫。
   同學與校長照樣由 game.js 帶著走（逛校園時闖關那邊仍是大廳狀態）。全校加成「校慶嘉年華」解鎖後，晚上放煙火。
   闖關現場：別人正在闖關的場，廣場旁站著那幾關現在的魔王（setLive；裝飾用、不能打）。 */
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { TOP } from './islands.js';
const X = C.explore, MP = X.multi, Y = TOP + 0.03;
export function createExplore(ctx) {
  const { scene, nav, people, centers } = ctx; const cb = ctx.callbacks; const emit = (k, ...a) => cb[k] && cb[k](...a);
  const G = { on: false, me: null, move: { x: 0, z: 0 }, goal: null, path: null, chase: null, near: null, clock: X.clockStart, clockOn: true, tween: false, remotes: new Map(), scene: null, gate: null };
  const hex = c => '#' + c.toString(16).padStart(6, '0'), num = v => typeof v === 'number' && Number.isFinite(v);
  const tagAdd = (w, name, badge, color, kind) => emit('tag', 'add', w, { name, badge, color, kind, nohp: true }); const tagDel = w => emit('tag', 'remove', w);
  const remoteHits = [], fx = [];
  function rebuild() { ctx.rebuild([G.me, ...G.remotes.values()].filter(Boolean)); }
  // ── 自己 ──
  function tagMe() { const H = C.heroes[G.me.cls] || C.heroes.chief; tagDel(G.me); tagAdd(G.me, G.me.nick || H.name, `${H.icon} 你`, hex(H.color), 'me'); }
  // 出生點：自己選的學期那個區塊的廣場前（沒選就在一年級上）
  const homeOf = p => { const home = (p.district && centers.get(p.district)) || centers.get('beitou'); return nav.nearestWalkable(home.x + 0.3, home.z + 1.5, X.radius); };
  function start(p) { stop(true); const [x, z] = homeOf(p);
    const w = people.makeWalker('citizen', new THREE.Vector3(x, Y, z), p.cls, p.fit); Object.assign(w, { nick: p.nick, cls: p.cls, yaw: 0 }); G.me = w; tagMe();
    Object.assign(G, { on: true, goal: null, path: null, chase: null, near: null, gate: null }); G.scene = nav.islandAt(x, z); G.move.x = G.move.z = 0; rebuild(); emit('near', null); emit('scene', G.scene, true); }
  function stop(quiet) { if (G.me) tagDel(G.me); G.me = null; G.on = false; G.near = null; clearRemotes(true); setLive(new Map()); if (goalMark) goalMark.visible = false; if (!quiet) rebuild(); }
  // 回自己的學期：瞬間回到出生點
  function respawn(p) { if (!G.me) return; const [x, z] = homeOf(p); G.me.pos.x = x; G.me.pos.z = z; Object.assign(G, { goal: null, path: null, chase: null }); ripple(x, z); }
  // 換了衣服或角色：原地換一個新的角色
  function refit(p) { const old = G.me; if (!old) return; const w = people.makeWalker('citizen', old.pos, p.cls, p.fit); Object.assign(w, { nick: p.nick, cls: p.cls, yaw: old.yaw }); tagDel(old); G.me = w; tagMe(); rebuild(); }
  // ── 走路：搖桿／鍵盤優先，沒有就走向目的地（格子導航圖 A*，跨區塊也找得到門）──
  function setMove(x, z) { G.move.x = x; G.move.z = z; if (x || z) { G.goal = null; G.chase = null; } }
  function moveTo(x, z, quiet) { if (!G.me) return; const [px, pz] = nav.nearestWalkable(x, z, X.radius); G.goal = [px, pz]; G.path = null; if (!quiet) { G.chase = null; ripple(px, pz); if (goalMark) goalMark.userData.t = 0; } }
  function spots() { const out = []; for (const b of ctx.boutiques()) out.push({ kind: 'boutique', x: b.x, z: b.z, r: X.near.boutique, island: b.island });
    const s = ctx.site(); if (s) out.push({ kind: 'site', x: s.x, z: s.z, r: X.near.site, name: s.name, id: s.id });
    const m = ctx.mayor(); if (m) out.push({ kind: 'mayor', x: m.pos.x, z: m.pos.z, r: X.near.mayor }); return out; }
  // 帶我去：最近的服飾店／工地／校長（校長會走動，邊走邊重新對準）
  function goTo(kind) { if (!G.me) return false; const p = G.me.pos; let best = null, bd = Infinity; for (const s of spots()) { if (s.kind !== kind) continue; const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
    if (!best) return false; moveTo(best.x, best.z); G.chase = kind === 'mayor' ? { kind, t: 0 } : null; return true; }
  function walk(dt) { const me = G.me, p = me.pos; let vx = G.move.x, vz = G.move.z;
    if (G.chase) { G.chase.t -= dt; if (G.chase.t <= 0) { G.chase.t = 0.6; const m = ctx.mayor(); if (m) moveTo(m.pos.x, m.pos.z, true); } }
    if (!vx && !vz && G.goal) { const [gx, gz] = G.goal; if (Math.hypot(gx - p.x, gz - p.z) < 0.08) { G.goal = null; G.path = null; } else { G.pathT = (G.pathT || 0) - dt;
      if (!G.path || !G.path.length || !G.pathFor || Math.hypot(G.pathFor[0] - gx, G.pathFor[1] - gz) > 0.25 || G.pathT <= 0) { G.path = nav.gridPath(p.x, p.z, gx, gz, X.pathNodes) || [[gx, gz]]; G.pathFor = [gx, gz]; G.pathT = 1.5; }
      while (G.path.length > 1 && Math.hypot(G.path[0][0] - p.x, G.path[0][1] - p.z) < 0.14) G.path.shift();
      const dx = G.path[0][0] - p.x, dz = G.path[0][1] - p.z, L = Math.hypot(dx, dz); if (L > 1e-4) { vx = dx / L; vz = dz / L; } } }
    if (vx || vz) { const L = Math.hypot(vx, vz), sp = X.speed * dt * Math.min(1, L); nav.move(p, vx / L * sp, vz / L * sp, X.radius); me.yaw = Math.atan2(vx, vz); me.moving = true;
      if (G.goal) { if (!G.sw) G.sw = { x: p.x, z: p.z, t: 0 }; G.sw.t += dt; if (G.sw.t > 0.7) { if (Math.hypot(p.x - G.sw.x, p.z - G.sw.z) < X.speed * G.sw.t * 0.25) G.pathT = 0; G.sw = { x: p.x, z: p.z, t: 0 }; } } }
    else { nav.push(p, X.radius); me.moving = false; } }
  // 旁邊有什麼可以進去：服飾店、工地、校長（距離÷範圍最小的那個）
  function updateNear() { const p = G.me.pos; let best = null, bk = 1; for (const s of spots()) { const k = Math.hypot(s.x - p.x, s.z - p.z) / s.r; if (k < bk) { bk = k; best = s; } }
    const sig = best ? best.kind + (best.id || best.island || '') : ''; if (sig !== (G.near ? G.near.sig : '')) { G.near = best ? { ...best, sig } : null; emit('near', G.near); if (best && G.chase && G.chase.kind === best.kind) { G.chase = null; G.goal = null; } } }
  // ── 主迴圈：時鐘、自己、其他人 ──
  function step(dt) { if (!G.on || !G.me) return; if (G.clockOn && !G.tween) G.clock = (G.clock + X.clockRate * dt) % 1440; walk(dt); updateNear(); updateScene(); updateRemotes(dt); }
  // 走進另一個場景（過了橋）：通知畫面做轉場；走到鎖住的橋頭：提示怎麼解鎖（每個橋頭提示一次，走開再回來才會再提示）
  function updateScene() { const p = G.me.pos; const sid = nav.islandAt(p.x, p.z); if (sid && sid !== G.scene) { G.scene = sid; emit('scene', sid, false); }
    const g = nav.closedBridgeNear ? nav.closedBridgeNear(p.x, p.z, 1.1) : null; const key = g ? g.a + '|' + g.b : null; if (key !== G.gate) { G.gate = key; emit('gate', g); } }
  // ── 其他正在逛的人 ──
  function bubble(w, txt, secs, ic) { w.bubbleT = secs; emit('say', w, txt, ic); }
  function tagRemote(w) { const H = C.heroes[w.cls] || C.heroes.chief; tagDel(w); tagAdd(w, w.nick, `${H.icon} ${H.name}`, hex(H.color), 'player'); }
  function upsertRemote(m) { if (!G.on) return null; let w = G.remotes.get(m.id);
    if (w && (w.cls !== m.c || w.fit !== m.o)) { removeRemote(m.id, true); w = null; }
    if (!w) { if (G.remotes.size >= MP.maxRemote) return null; w = people.makeWalker('citizen', new THREE.Vector3(m.x, Y, m.z), m.c, m.o); Object.assign(w, { remote: true, id: m.id, cls: m.c, nick: m.n, tx: m.x, tz: m.z }); tagRemote(w);
      w.hit = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ visible: false })); w.hit.userData.remoteId = m.id; scene.add(w.hit); remoteHits.push(w.hit); G.remotes.set(m.id, w); rebuild(); }
    if (w.nick !== m.n) { w.nick = m.n; tagRemote(w); }
    w.tx = m.x; w.tz = m.z; w.tyaw = m.y; w.seen = performance.now(); if (Math.hypot(w.pos.x - m.x, w.pos.z - m.z) > MP.snapDist) { w.pos.x = m.x; w.pos.z = m.z; } return w; }
  function removeRemote(id, quiet) { const w = G.remotes.get(id); if (!w) return; tagDel(w); scene.remove(w.hit); const i = remoteHits.indexOf(w.hit); if (i >= 0) remoteHits.splice(i, 1); G.remotes.delete(id); if (!quiet) rebuild(); }
  function clearRemotes(quiet) { for (const id of [...G.remotes.keys()]) removeRemote(id, true); if (!quiet) rebuild(); }
  function pruneRemotes(alive, now) { for (const [id, w] of [...G.remotes]) { const age = (now - w.seen) / 1000; if (age > MP.timeout || (alive && !alive.has(id) && age > MP.presenceGrace)) removeRemote(id); } }
  function updateRemotes(dt) { for (const w of G.remotes.values()) { const dx = w.tx - w.pos.x, dz = w.tz - w.pos.z, L = Math.hypot(dx, dz);
      if (L > 0.03) { const sp = Math.min(L, X.speed * 1.35 * dt); w.pos.x += dx / L * sp; w.pos.z += dz / L * sp; w.yaw = Math.atan2(dx, dz); w.moving = true; } else { w.moving = false; if (num(w.tyaw)) w.yaw = w.tyaw; }
      w.hit.position.set(w.pos.x, w.pos.y + 0.3, w.pos.z); }
    for (const w of [G.me, ...G.remotes.values()]) if (w && w.bubbleT > 0) { w.bubbleT -= dt; if (w.bubbleT <= 0) emit('say', w, null); } }
  function remoteEmote(id, em) { const w = G.remotes.get(id); if (!w) return null; bubble(w, em.say, MP.bubbleSeconds, em.k); return w.nick; }
  function myEmote(em) { if (!G.me) return false; bubble(G.me, em.say, MP.bubbleSeconds, em.k); return true; }
  // ── 闖關現場：每個有人在闖關的場，岸外浮著那幾關現在場上的魔王（每場最多 ghostMax 隻），頭上寫在作亂 ──
  const ghosts = new Map();
  function setLive(stages) { const want = new Map();
    for (const [sid, info] of stages) { const spots = ctx.stageSpots(sid); if (!spots.length) continue; info.bosses.slice(0, X.live.ghostMax).forEach((type, i) => { if (!C.animals[type]) return; const sp = spots[i % spots.length], k = Math.floor(i / spots.length); want.set(sid + ':' + type, { type, x: sp.x + sp.dx * k * 0.9, z: sp.z + sp.dz * k * 0.9, fx: sp.fx, fz: sp.fz }); }); }
    for (const [k, g] of [...ghosts]) if (!want.has(k)) { ctx.animals.remove(g.obj); ghosts.delete(k); }
    for (const [k, w] of want) if (!ghosts.has(k)) { const obj = ctx.animals.spawn(w.type), A = C.animals[w.type]; ctx.animals.setChant(obj, `${A.name}作亂中`); obj.position.set(w.x, TOP, w.z); obj.rotation.y = Math.atan2(w.fx - w.x, w.fz - w.z) - Math.PI / 2; ghosts.set(k, { obj, A, e: { type: w.type, wing: Math.random() * 6, hopT: 0, seed: Math.random() } }); } }
  // ── 畫面：點地板的波紋與目的地標記、煙火 ──
  const fxMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  function ripple(x, z) { const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 32), fxMat(0xdb6a41)); m.rotation.x = -Math.PI / 2; m.position.set(x, TOP + 0.04, z); m.renderOrder = 11; scene.add(m); fx.push({ obj: m, ttl: 0.6, grow: 2.2, fade: 1.5 }); }
  const goalMark = (() => { const g = new THREE.Group(), mat = fxMat(0xdb6a41); const r = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.18, 32), mat); r.rotation.x = -Math.PI / 2; r.position.y = 0.03; const pin = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 12), mat); pin.rotation.x = Math.PI; pin.position.y = 0.3; const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), mat); knob.position.y = 0.4;
    for (const m of [r, pin, knob]) { m.renderOrder = 11; g.add(m); } g.userData = { pin, knob, t: 0 }; g.visible = false; scene.add(g); return g; })();
  let fwT = 0; const FW_COLORS = [0xfcea8b, 0xdb6a41, 0x58a6a6, 0xf2a1a1, 0x9fc4e6, 0xf2c14e];
  function firework() { const cs = [...centers.values()], c = cs[Math.floor(Math.random() * cs.length)]; const n = 48, pos = new Float32Array(n * 3), vel = [];
    const ox = c.x + (Math.random() - 0.5) * 3, oz = c.z + (Math.random() - 0.5) * 3, oy = TOP + 3.2 + Math.random() * 1.8;
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), sp = 1.4 + Math.random() * 0.5; vel.push([Math.cos(a) * s * sp, u * sp, Math.sin(a) * s * sp]); pos.set([ox, oy, oz], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)], size: 0.16, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(pts); fx.push({ obj: pts, ttl: 1.6, vel, firework: true }); }
  function view(raw, night, festival) { const me = G.me, now = performance.now() / 1000;
    for (const g of ghosts.values()) { g.e.wing += raw * 10; g.obj.position.y = TOP + (g.A.fly ? 0.7 : 0.02) + Math.sin(now * 1.6 + g.e.seed * 6) * 0.05; ctx.animals.animate(g.obj, g.e, raw, now); }
    if (goalMark) { const on = !!(G.on && me && G.goal && !G.chase); goalMark.visible = on; if (on) { const u = goalMark.userData; u.t += raw; goalMark.position.set(G.goal[0], TOP, G.goal[1]); u.pin.position.y = 0.3 + Math.abs(Math.sin(u.t * 4)) * 0.08; u.knob.position.y = u.pin.position.y + 0.1; } }
    if (G.on && festival && night >= X.fireworks.night) { fwT -= raw; if (fwT <= 0) { fwT = X.fireworks.every * (0.6 + Math.random() * 0.8); firework(); } }
    for (const f of fx) { f.ttl -= raw;
      if (f.firework) { const a = f.obj.geometry.attributes.position; for (let i = 0; i < f.vel.length; i++) { const v = f.vel[i]; v[1] -= 1.6 * raw; v[0] *= 0.985; v[2] *= 0.985; a.array[i * 3] += v[0] * raw; a.array[i * 3 + 1] += v[1] * raw; a.array[i * 3 + 2] += v[2] * raw; } a.needsUpdate = true; f.obj.material.opacity = Math.max(0, Math.min(1, f.ttl / 0.8)); }
      else { f.obj.scale.addScalar(f.grow * raw); f.obj.material.opacity = Math.max(0, f.ttl * f.fade); }
      if (f.ttl <= 0) { scene.remove(f.obj); f.obj.geometry.dispose(); f.obj.material.dispose(); } }
    for (let i = fx.length - 1; i >= 0; i--) if (fx[i].ttl <= 0) fx.splice(i, 1); }
  // 時鐘：按時段按鈕時天色平順轉過去（tween），轉完才繼續走
  function setClock(min) { G.clock = ((min % 1440) + 1440) % 1440; G.tween = true; }
  return { G, start, stop, refit, respawn, setMove, moveTo, goTo, step, view, setClock, spots, setLive, upsertRemote, removeRemote, clearRemotes, pruneRemotes, remoteEmote, myEmote, remoteHits };
}
