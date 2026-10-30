/* 闖關：一關 3 波、每波 100 秒。打倒魔王會掉金蛋，搬進金蛋籃湊滿這一波的配額才過關；全員倒下、或時間到配額不夠就下課。
   角色：solo（單人＋NPC 同學）與 host（房主）在這台跑模擬；client（房客）只收快照畫畫面、自己走路，把位置與指令送給房主。
   畫面特效一律走「事件」：模擬端產生事件時自己先播一次，再放進快照送給房客播，兩邊看到的一樣。事件只帶代碼與數字，文字由各自的 config 組出來。 */
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { TOP, R, makeRoute, sampleRoute } from './islands.js';
const SH = C.shift, EG = SH.egg, PL = SH.player, ML = C.melee, CH = C.chant, NP = C.npc, MC = C.mayor, RS = C.residents;
export const TYPES = Object.keys(C.animals), SPECIALS = ['', 'fog', 'rush'], PHASES = ['lobby', 'intro', 'wave', 'inter', 'result'];
const Y = TOP + 0.03, r2 = v => Math.round(v * 100), lerp = (a, b, k) => a + (b - a) * k, num = v => typeof v === 'number' && Number.isFinite(v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), EMOTES = new Map(C.emotes.map(e => [e.k, e]));
const fmt = (s, ...a) => s.replace(/\{(\w+)\}/g, (_, k) => a.shift() ?? '');
export function createGame(ctx) {
  const { scene, graph, nav, centers, people, animals, islands } = ctx; const cb = ctx.callbacks; const emit = (k, ...a) => cb[k] && cb[k](...a);
  const G = { phase: 'lobby', role: null, t: 0, clock: 0, stage: null, hazard: 0.5, waveNo: 0, waveT: 0, timeLeft: SH.waveSeconds, quota: 0, gold: 0, golds: [], quotas: [], special: '', issue: null, issues: [], players: [], me: -1,
    enemies: [], eggs: [], warns: [], spits: [], fx: [], residents: [], mayor: null, log: [], out: [], paused: false, result: null, basket: null, spawns: [], rushTarget: -1 };
  const enemyById = new Map(), enemyHits = [], V3 = THREE.Vector3;
  let eid = 0, eggId = 0;
  // ── 小工具：文字貼圖、飄字、日誌 ──
  const texCache = new Map();
  function textSprite(txt, { bg = '#fff8f4', fg = '#211d1d', size = 0.4 } = {}) { const key = txt + bg + fg; let tex = texCache.get(key); if (!tex) { const cv = document.createElement('canvas'); const g = cv.getContext('2d'); const font = '900 40px "Noto Sans TC", sans-serif'; g.font = font; const tw = Math.ceil(g.measureText(txt).width); cv.width = tw + 36; cv.height = 60; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.beginPath(); g.roundRect(2, 2, cv.width - 4, cv.height - 4, 14); g.fillStyle = bg; g.fill(); g.fillStyle = fg; g.fillText(txt, cv.width / 2, cv.height / 2 + 1); tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.userData = { w: cv.width, h: cv.height }; texCache.set(key, tex); } const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(size * tex.userData.w / tex.userData.h, size, 1); sp.renderOrder = 12; return sp; }
  function floatText(txt, x, y, z, opt) { const sp = textSprite(txt, opt); sp.position.set(x, y, z); scene.add(sp); G.fx.push({ obj: sp, ttl: 1.1, rise: 0.5 }); }
  function addLog(txt, cls = '') { const s = G.phase === 'wave' ? Math.floor(G.timeLeft) : 0; G.log.unshift({ t: G.phase === 'wave' ? `${G.waveNo}-${String(s).padStart(3, '0')}` : '---', txt, cls }); G.log.length = Math.min(G.log.length, C.ui.logMax); emit('log', G.log); }
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const tagAdd = (w, name, badge, color, kind) => emit('tag', 'add', w, { name, badge, color, kind }); const tagDel = w => emit('tag', 'remove', w);
  // ── 同學（大廳時在步道散步；開始闖關時闖關場上的同學先離開）──
  function spawnResidents() { const list = []; for (const isl of islands) { const ring = graph.ringIndex.get(isl.id); for (let k = 0; k < RS.perIsland; k++) { const node = ring[(k * 5 + isl.number) % 12]; const role = RS.roles[(isl.number * 3 + k) % RS.roles.length]; const w = people.makeWalker(role, graph.nodes[node].p); const sp = role === 'cyclist' ? RS.bikeSpeed : RS.speed; Object.assign(w, { home: isl.id, node, wait: Math.random() * 2, route: null, s: 0, speed: sp[0] + Math.random() * (sp[1] - sp[0]) }); list.push(w); } } G.residents = list; return list; }
  function walk(w, dt, speed) { if (!w.route) return true; w.s += speed * dt; const done = w.s >= w.route.total; const smp = sampleRoute(w.route, Math.min(w.s, w.route.total)); w.pos.copy(smp.p); if (smp.dir.lengthSq() > 0) w.yaw = Math.atan2(smp.dir.x, smp.dir.z); w.moving = !done; if (done) { w.route = null; w.moving = false; } return done; }
  function routeTo(fromPos, toNode) { const a = graph.nearestNode(fromPos); const ids = graph.shortest(a, toNode); return makeRoute([fromPos.clone(), ...ids.map(n => graph.nodes[n].p.clone())]); }
  function updateResidents(dt) { for (const w of G.residents) { if (w.away) continue; if (w.cheer > 0) { w.cheer -= dt; w.pose = w.cheer > 0 ? 'wave' : null; w.moving = false; continue; }
    if (w.route) walk(w, dt, w.speed); else { w.wait -= dt; if (w.wait <= 0) { const ring = graph.ringIndex.get(w.home); const next = ring[(ring.indexOf(w.node) + (Math.random() < 0.5 ? 1 : 11)) % 12]; w.route = makeRoute([w.pos.clone(), graph.nodes[next].p.clone()]); w.s = 0; w.node = next; w.wait = 1 + Math.random() * 3; } } } }
  // ── 校長 NPC：大廳時巡迴課程建築宣傳；開始闖關時站在金蛋籃旁邊廣播（像闖關的老闆）──
  let stops = [];
  function setStops(list) { stops = [...list].sort((a, b) => a.order - b.order || a.pos.x - b.pos.x); if (G.mayor && G.mayor.stop >= stops.length) G.mayor.stop = 0; }
  function spawnMayor() { const gc = centers.get((islands.find(i => i.goal) || islands[0]).id); const m = people.makeWalker('mayor', gc.clone().add(new V3(0.6, 0.03, 1.0))); Object.assign(m, { stop: 0, wait: 2, route: null, s: 0, state: 'walk', yaw: 0 });
    tagAdd(m, MC.name, '🎙 校長', '#db6a41', 'mayor'); m.hit = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ visible: false })); scene.add(m.hit); G.mayor = m; return m; }
  const sayCount = new Map();
  function slogan(pol) { const lines = [String(pol.summary || '').split(/[，。、；]/)[0], ...(pol.facts || []).slice(0, MC.sayFacts)].filter(Boolean); const n = sayCount.get(pol.id) || 0; sayCount.set(pol.id, n + 1); const line = lines.length ? lines[n % lines.length] : '';
    let t = `${pol.title}！${line}`; if (t.length > MC.sloganMax) t = line; return t.length > MC.sloganMax ? t.slice(0, MC.sloganMax) + '…' : t; }
  const setBubble = (m, txt) => emit('say', m, txt ? '📣 ' + txt : null);
  function updateMayor(dt) { const m = G.mayor; if (!m) return; m.hit.position.set(m.pos.x, m.pos.y + 0.3, m.pos.z);
    if (G.phase !== 'lobby') { if (m.bubbleT > 0) { m.bubbleT -= dt; if (m.bubbleT <= 0) setBubble(m, null); } m.moving = false; return; }
    if (m.shoutT > 0) { m.shoutT -= dt; if (m.shoutT <= 0 && m.state !== 'speech') setBubble(m, null); }
    if (!stops.length) return;
    if (m.state === 'walk') { if (!m.route) { m.wait -= dt; if (m.wait > 0) return; const st = stops[m.stop % stops.length]; const node = graph.nodeNear(st.island, st.pos); const np = graph.nodes[node].p; const front = np.clone().lerp(st.pos.clone().setY(np.y), MC.approach); m.route = makeRoute([m.pos.clone(), ...routeTo(m.pos, node).pts.slice(1), front]); m.s = 0; m.onBox = false; m.pose = null; }
      if (walk(m, dt, MC.speed)) { const st = stops[m.stop % stops.length]; m.state = 'speech'; m.speechT = MC.speechSeconds; m.onBox = true; m.pose = 'wave'; m.yaw = Math.atan2(st.pos.x - m.pos.x, st.pos.z - m.pos.z) + Math.PI; setBubble(m, slogan(st.pol)); m.current = st; emit('speech', m);
        for (const w of G.residents) if (!w.away && d2v(w.pos, m.pos) < MC.cheerRadius) { w.cheer = MC.speechSeconds; w.yaw = Math.atan2(m.pos.x - w.pos.x, m.pos.z - w.pos.z); } } }
    else if (m.state === 'speech') { m.speechT -= dt; if (m.speechT <= 0) { m.state = 'walk'; m.onBox = false; m.pose = null; m.stop = (m.stop + 1) % stops.length; m.wait = MC.pauseSeconds; setBubble(m, null); } } }
  const d2v = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // 大廳時校長臨時講一句（金蛋商店：捐書回應、建設落成）
  function shout(txt, secs = 5) { const m = G.mayor; if (!m || !txt) return; setBubble(m, txt); m.shoutT = secs; }
  function mayorSay(key, ...args) { const t = MC.lines[key]; if (!t || !G.mayor) return ''; const txt = fmt(t, ...args); G.mayor.bubbleT = 3.2; G.mayor.pose = 'wave'; setBubble(G.mayor, txt); return txt; }

  // ═══════════════ 開始闖關 ═══════════════
  // cfg = { stage, hazard, waves: [{ special, issue }], issues: [挑戰物件], roster: [{ slot, id, nick, cls, district, npc, grade }], mySlot }
  // 捐書的全校加成（房主開始闖關時決定、寫在開始闖關設定 boost＝解鎖了幾階）
  function boostOf(n) { const b = { dmg: 0, quota: 0, specials: 0 }; for (const t of C.econ.donate.tiers.slice(0, Math.max(0, n | 0))) if (t.shift) for (const k of Object.keys(b)) b[k] += t.shift[k] || 0; return b; }
  function startShift(cfg, role) { clearShift(); G.boost = boostOf(cfg.boost);
    G.role = role; G.cfg = cfg; G.stage = C.stages.find(s => s.id === cfg.stage) || C.stages[0]; G.hazard = cfg.hazard; G.waves = cfg.waves || []; G.issues = cfg.issues || [];
    const bc = centers.get(G.stage.basket); G.basket = { x: bc.x, z: bc.z + C.plaza.basketZ }; G.spawns = computeSpawns(G.stage);
    const onStage = new Set(G.stage.islands); for (const w of G.residents) w.away = onStage.has(w.home);
    G.me = num(cfg.mySlot) ? cfg.mySlot : -1;
    G.players = cfg.roster.map((r, i) => makePlayer(r, startPos(i, cfg.roster.length)));
    const m = G.mayor; if (m) { m.route = null; m.onBox = false; m.pose = 'wave'; m.pos.set(G.basket.x + 0.85, Y, G.basket.z - 0.15); m.yaw = 0.4; setBubble(m, null); }
    buildBasket(); rebuildPeople();
    Object.assign(G, { phase: 'intro', t: SH.introSeconds, waveNo: 0, waveT: 0, queue: [], fogGold: [], bossSaid: new Set(), golds: [], quotas: [], gold: 0, quota: 0, enemies: [], eggs: [], warns: [], spits: [], out: [], log: [], result: null, special: '', issue: G.issues[0] || null, timeLeft: SH.waveSeconds, clock: 0, paused: false, rushTarget: -1 });
    if (role !== 'client') ev(['say', 'intro']);
    addLog(`開始闖關：${G.stage.name}・危險度 ${Math.round(G.hazard * 100)}%`, 'good'); emit('shift', 'start'); emit('hud'); emit('team'); }
  function computeSpawns(stage) { const bc = centers.get(stage.basket), all = [...centers.values()], prim = [], side = [];
    for (const id of stage.islands) { if (id === stage.basket) continue; const c = centers.get(id), base = Math.atan2(c.x - bc.x, c.z - bc.z);
      for (const da of [0, 1.0, -1.0]) { const a = base + da, dx = Math.sin(a), dz = Math.cos(a), wx = c.x + dx * (R + 1.5), wz = c.z + dz * (R + 1.5);
        if (nav.walkable(wx, wz) || all.some(o => o !== c && Math.hypot(o.x - wx, o.z - wz) < R + 0.9)) continue;
        const [ex, ez] = nav.nearestWalkable(c.x + dx * (R - 0.4), c.z + dz * (R - 0.4)); (da === 0 ? prim : side).push({ wx, wz, ex, ez, island: id }); } }
    const out = prim.length >= 4 ? prim : [...prim, ...side.slice(0, 4 - prim.length + 1)]; return out.length ? out : [{ wx: bc.x, wz: bc.z + R + 1.5, ex: bc.x, ez: bc.z + R - 0.4 }]; }
  function startPos(i, n) { const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.PI / 4; return nav.nearestWalkable(G.basket.x + Math.sin(a) * 0.75, G.basket.z + 0.4 + Math.cos(a) * 0.6); }
  function makePlayer(r, [x, z]) { const cfg = C.heroes[r.cls] || C.heroes.chief; const w = people.makeWalker('citizen', new V3(x, Y, z), r.cls, r.fit); w.yaw = 0;
    const P = { slot: r.slot, id: String(r.id || ''), nick: String(r.nick || cfg.name).slice(0, 24), cls: C.heroes[r.cls] ? r.cls : 'chief', cfg, npc: !!r.npc, district: r.district || null, grade: r.grade | 0, local: r.slot === G.me, w, pos: w.pos,
      hp: PL.hp, down: false, carry: false, inv: 0, hitT: 99, revive: 0, sp: SH.specials + (G.boost ? G.boost.specials : 0), spT: 0, dash: null, gold: 0, power: 0, rescues: 0, downs: 0, cd: Math.random() * 0.3, focus: 0, move: { x: 0, z: 0 }, goal: null, think: Math.random() * 0.3, net: null, firing: false, flash: 0, emoteT: 0 };
    w.P = P; retag(P); return P; }
  function retag(P) { tagDel(P.w); const kind = P.local ? 'me' : P.npc ? 'npc' : 'player'; tagAdd(P.w, P.nick, `${P.cfg.icon} ${P.local ? '你' : P.npc ? 'NPC' : P.cfg.name}`, hex(P.cfg.color), kind); P.tagSig = ''; }
  // 逛校園（explore.js）的自己與其他玩家也一起畫
  let extra = [];
  function rebuildPeople() { people.build([...G.residents.filter(w => !w.away), G.mayor, ...G.players.map(P => P.w), ...extra].filter(Boolean)); }
  function setExtraWalkers(list) { extra = list || []; rebuildPeople(); }
  function clearShift() { for (const e of G.enemies) dropEnemyMesh(e); G.enemies = []; enemyById.clear(); enemyHits.length = 0; for (const g of G.eggs) if (g.obj) scene.remove(g.obj); G.eggs = []; for (const f of G.fx) scene.remove(f.obj); G.fx = []; G.warns = []; G.spits = [];
    for (const P of G.players) { tagDel(P.w); for (const o of [P.eggObj, P.buoy, P.ring]) if (o) scene.remove(o); } G.players = []; removeBasket(); }
  function backToLobby() { clearShift(); G.phase = 'lobby'; G.role = null; G.me = -1; G.special = ''; for (const w of G.residents) w.away = false; if (G.mayor) { G.mayor.state = 'walk'; G.mayor.route = null; G.mayor.wait = 1; G.mayor.pose = null; setBubble(G.mayor, null); } rebuildPeople(); emit('shift', 'lobby'); emit('hud'); emit('team'); }
  // ═══════════════ 一波 ═══════════════
  const quotaFor = n => Math.max(1, Math.round(SH.qBase[n - 1] + SH.qHazard[n - 1] * G.hazard) + (G.boost ? G.boost.quota : 0));
  function nextWave() { G.waveNo++; const w = G.waves[G.waveNo - 1] || {}; G.special = SPECIALS.includes(w.special) ? w.special : ''; G.issue = G.issues[G.waveNo - 1] || G.issues[0] || null; G.quota = quotaFor(G.waveNo); G.gold = 0; G.waveT = 0; G.timeLeft = SH.waveSeconds; G.phase = 'wave';
    Object.assign(G, { bossT: SH.bossFirst, lesserT: SH.lesserFirst, queue: [], goldT: 3, rushGT: 2, rushSwitch: 0, rushTarget: -1, fogGold: [...SH.fog.goldAt], saidHurry: false, bossSaid: new Set(), lastSpawn: -1 });
    ev(['wave', G.waveNo, G.quota, SPECIALS.indexOf(G.special), G.issue ? String(G.issue.id).slice(0, 32) : '']); ev(['say', 'wave', G.waveNo, G.quota]); if (G.special) ev(['say', G.special]); }
  function endWave() { G.golds[G.waveNo - 1] = G.gold; G.quotas[G.waveNo - 1] = G.quota;
    if (G.gold < G.quota) { ev(['say', 'timeup', G.quota - G.gold]); finish(false, 'timeup'); return; }
    if (G.waveNo >= SH.waves) { ev(['say', 'clear']); finish(true, 'clear'); return; }
    ev(['say', 'clearWave']); clearField(); for (const P of G.players) if (P.down) revive(P, null); G.phase = 'inter'; G.t = SH.interSeconds; G.special = ''; ev(['inter']); }
  function clearField() { for (const e of G.enemies) if (!e.dead) { e.dead = true; ev(['kill', e.id, r2(e.x), r2(e.z), 3]); } purge(); for (const g of G.eggs) g.gone = true; G.warns = []; G.spits = []; for (const P of G.players) P.carry = false; }
  function finish(clear, why) { if (G.phase === 'result') return; if (G.golds[G.waveNo - 1] == null) { G.golds[G.waveNo - 1] = G.gold; G.quotas[G.waveNo - 1] = G.quota; }
    if (why === 'wipe') ev(['say', 'fail']); G.phase = 'result'; G.t = SH.resultLinger; G.result = makeResult(clear, why); ev(['end', clear ? 1 : 0]); emit('end', G.result); }
  function makeResult(clear, why) { return { clear: !!clear, why, stage: G.stage.id, hazard: G.hazard, waves: SH.waves, waveNo: G.waveNo, cleared: clear ? SH.waves : Math.max(0, G.waveNo - 1), golds: [...G.golds], quotas: [...G.quotas],
    players: G.players.map(P => ({ slot: P.slot, id: P.id, nick: P.nick, cls: P.cls, npc: P.npc, district: P.district, gold: P.gold, power: P.power, rescues: P.rescues, downs: P.downs })) }; }
  // 房主離線、或自己按下課：直接結束（不算過關）
  function abort(why) { if (G.phase === 'lobby' || G.phase === 'result') return; if (G.role === 'client') { G.phase = 'result'; G.result = makeResult(false, why); emit('end', G.result); return; } finish(false, why); }

  // ═══════════════ 模擬主迴圈（solo／host）═══════════════
  function step(dt) { G.clock += dt; updateMayor(dt); updateResidents(dt); if (G.phase === 'lobby') return;
    if (G.role === 'client') { clientStep(dt); return; }
    for (const P of G.players) { if (P.local) moveLocal(P, dt); else if (P.npc) { if (G.phase === 'wave' || G.phase === 'inter' || G.phase === 'intro') npcThink(P, dt); moveLocal(P, dt); } else followNet(P, dt); tickPlayer(P, dt); }
    if (G.phase === 'intro' || G.phase === 'inter') { G.t -= dt; if (G.t <= 0) nextWave(); }
    else if (G.phase === 'wave') { G.waveT += dt; G.timeLeft = Math.max(0, SH.waveSeconds - G.waveT); spawner(dt);
      for (const e of G.enemies) if (!e.dead) updateEnemy(e, dt); separate(); fireAll(dt); dashes(dt); spitsStep(dt); updateChants(dt);
      if (!G.saidHurry && G.timeLeft < 25 && G.gold < G.quota) { G.saidHurry = true; ev(['say', 'hurry', G.quota - G.gold]); }
      purge(); if (G.phase === 'wave' && G.waveT >= SH.waveSeconds) endWave(); }
    if (G.phase === 'wave' || G.phase === 'inter') { eggsStep(dt); revives(dt); warnsStep(dt); }
    G.eggs = G.eggs.filter(g => { if (g.gone && g.obj) scene.remove(g.obj); return !g.gone; }); }
  function tickPlayer(P, dt) { P.inv -= dt; P.hitT += dt; P.emoteT -= dt; if (P.spT > 0) P.spT -= dt; if (P.quizT > 0) P.quizT -= dt; if (!P.down && P.hitT > PL.regenDelay) P.hp = Math.min(PL.hp, P.hp + PL.regen * dt); }
  const speedOf = P => P.cfg.speed * (P.carry ? EG.carrySpeed : 1);
  // 自己（或 NPC）走路：搖桿／鍵盤優先，沒有就走向點的位置（跨島自動找橋）
  function moveLocal(P, dt) { const w = P.w; if (P.down || G.phase === 'result') { w.moving = false; P.goal = null; return; }
    if (P.dash) { const D = P.dash, step2 = (D.dist / D.time) * dt; nav.move(P.pos, D.dx * step2, D.dz * step2, PL.radius); w.yaw = Math.atan2(D.dx, D.dz); w.moving = true; if (G.role === 'client') { D.t -= dt; if (D.t <= 0) P.dash = null; } return; }
    let vx = P.move.x, vz = P.move.z;
    // 走向目的地：用格子導航圖找一條繞過建築的路（目的地換了、或每 1 秒重找一次），沿著路線點走
    if (!vx && !vz && P.goal) { const [gx, gz] = P.goal; if (Math.hypot(gx - P.pos.x, gz - P.pos.z) < 0.08) { P.goal = null; P.path = null; } else { P.pathT = (P.pathT || 0) - dt;
      if (!P.path || !P.path.length || !P.pathFor || Math.hypot(P.pathFor[0] - gx, P.pathFor[1] - gz) > 0.25 || P.pathT <= 0 || P.wpT === 0) { P.path = nav.gridPath(P.pos.x, P.pos.z, gx, gz) || [[gx, gz]]; P.pathFor = [gx, gz]; P.pathT = 1; P.wpT = 1; }
      while (P.path.length > 1 && Math.hypot(P.path[0][0] - P.pos.x, P.path[0][1] - P.pos.z) < 0.14) P.path.shift();
      const dx = P.path[0][0] - P.pos.x, dz = P.path[0][1] - P.pos.z, L = Math.hypot(dx, dz); if (L > 1e-4) { vx = dx / L; vz = dz / L; } } }
    if (vx || vz) { const L = Math.hypot(vx, vz), k = Math.min(1, L), sp = speedOf(P) * dt * k; nav.move(P.pos, vx / L * sp, vz / L * sp, PL.radius); w.yaw = Math.atan2(vx, vz); w.moving = true;
      // 卡住（想走卻 0.7 秒幾乎沒移動）：馬上重找路
      if (P.goal) { if (!P.sw) P.sw = { x: P.pos.x, z: P.pos.z, t: 0 }; P.sw.t += dt; if (P.sw.t > 0.7) { if (Math.hypot(P.pos.x - P.sw.x, P.pos.z - P.sw.z) < speedOf(P) * P.sw.t * 0.25) { P.pathT = 0; P.stuckN = (P.stuckN || 0) + 1; } else P.stuckN = 0; P.sw = { x: P.pos.x, z: P.pos.z, t: 0 }; } } }
    else { nav.push(P.pos, PL.radius); w.moving = false; } }
  // 房主這邊的房客：往收到的位置靠（倒下時位置由房主決定）
  function followNet(P, dt) { if (P.down || !P.net) { P.w.moving = false; return; } const [tx, tz] = P.net, dx = tx - P.pos.x, dz = tz - P.pos.z, L = Math.hypot(dx, dz);
    if (L > 3) { P.pos.x = tx; P.pos.z = tz; } else { const k = Math.min(1, dt * C.net.smooth); P.pos.x += dx * k; P.pos.z += dz * k; } P.w.moving = L > 0.04; if (num(P.netYaw)) P.w.yaw = P.netYaw; }

  // ── 生怪 ──
  function randomSpawn() { const L = G.spawns; let i = Math.floor(Math.random() * L.length); if (L.length > 1 && i === G.lastSpawn) i = (i + 1) % L.length; G.lastSpawn = i; return L[i]; }
  function pickLesser() { const mix = G.issue && G.issue.mix ? Object.entries(G.issue.mix).filter(([k, v]) => C.lesserTypes.includes(k) && v > 0) : []; if (!mix.length) return C.lesserTypes[Math.floor(Math.random() * C.lesserTypes.length)]; const sum = mix.reduce((a, [, v]) => a + v, 0); let r = Math.random() * sum; for (const [k, v] of mix) { r -= v; if (r <= 0) return k; } return mix[0][0]; }
  function spawner(dt) { const h = G.hazard; let bossN = 0, lesserN = 0, goldN = 0; for (const e of G.enemies) { if (e.dead) continue; if (e.A.boss) bossN++; else if (e.A.gold) goldN++; else lesserN++; } const total = bossN + lesserN + goldN;
    while (G.queue.length && G.queue[0].t <= G.waveT) { const q = G.queue.shift(); if (total < SH.enemyCap) spawnEnemy(q.type, q.sp); }
    if (G.special === 'rush') { const RU = SH.rush; G.rushSwitch -= dt; const tgt = G.players[G.rushTarget]; if (G.rushSwitch <= 0 || !tgt || tgt.down) { const up = G.players.filter(P => !P.down && P !== tgt); const pick = up.length ? up[Math.floor(Math.random() * up.length)] : tgt; if (pick && pick.slot !== G.rushTarget) { G.rushTarget = pick.slot; ev(['rush', pick.slot]); } G.rushSwitch = RU.switchEvery; }
      G.rushGT -= dt; if (G.rushGT <= 0) { G.rushGT = RU.groupEvery / (1 + RU.groupK * h); if (lesserN < RU.cap) { const sp = randomSpawn(), n = Math.round(RU.group + RU.groupHazard * h); for (let i = 0; i < n; i++) G.queue.push({ t: G.waveT + i * 0.15, type: 'rushmouse', sp }); } }
      G.goldT -= dt; if (G.goldT <= 0) { G.goldT = RU.goldEvery / (RU.goldK0 + RU.goldK1 * h); if (goldN < RU.goldMax + RU.goldMaxK * h) spawnEnemy('goldmouse', randomSpawn()); } return; }
    if (G.special === 'fog' && G.fogGold.length && G.waveT >= G.fogGold[0]) { G.fogGold.shift(); spawnEnemy('goldfrog', randomSpawn()); }
    G.bossT -= dt; if (G.bossT <= 0) { G.bossT = SH.bossEvery / (SH.bossK0 + SH.bossK1 * h) * (0.8 + Math.random() * 0.4); if (bossN < SH.bossMax0 + SH.bossMax1 * h && total < SH.enemyCap) spawnEnemy(C.bossTypes[Math.floor(Math.random() * C.bossTypes.length)], randomSpawn()); }
    G.lesserT -= dt; if (G.lesserT <= 0) { G.lesserT = SH.lesserEvery / (SH.lesserK0 + SH.lesserK1 * h) / (G.special === 'fog' ? SH.fog.lesserMul : 1) * (0.8 + Math.random() * 0.4);
      if (lesserN < SH.lesserMax0 + SH.lesserMax1 * h) { const n = Math.round((SH.groupBase + SH.groupHazard * h) * ((G.issue && G.issue.intensity) || 1)), sp = randomSpawn(); for (let i = 0; i < n; i++) G.queue.push({ t: G.waveT + i * SH.groupGap, type: pickLesser(), sp }); } }
    G.queue.sort((a, b) => a.t - b.t); }
  function spawnEnemy(type, sp) { const A = C.animals[type]; const hpMul = SH.hpK0 + SH.hpK1 * G.hazard; const e = { id: ++eid, type, A, x: sp.wx, z: sp.wz, yaw: Math.atan2(sp.ex - sp.wx, sp.ez - sp.wz), hp: A.hp * hpMul, maxHp: A.hp * hpMul, state: 'land', t: 0, landT: 0, sp, target: -1, retarget: 0, cd: A.boss ? 2 : 0, mcd: 0.5, stun: 0, slow: 0, slowT: 0,
    seed: Math.random(), wing: Math.random() * 6, hopT: Math.random(), wp: null, wpT: 0, goldDropped: 0, chant: null, chantT: 0, restT: 0, spoke: false, dead: false, air: 0, flags: 0 };
    G.enemies.push(e); enemyById.set(e.id, e); if (A.boss && !G.bossSaid.has(type)) { G.bossSaid.add(type); ev(['boss', TYPES.indexOf(type)]); } return e; }
  function purge() { for (const e of G.enemies) if (e.dead) { dropEnemyMesh(e); enemyById.delete(e.id); } G.enemies = G.enemies.filter(e => !e.dead); }
  // ── 敵人 AI ──
  function nearestStanding(e) { let best = -1, bd = Infinity; const cur = G.players[e.target]; for (const P of G.players) { if (P.down) continue; const d = dist(e, P.pos); if (d < bd) { bd = d; best = P.slot; } } if (cur && !cur.down && dist(e, cur.pos) < bd * 1.3 + 0.3) return cur.slot; return bd <= SH.aggroRange ? best : -1; }
  const face = (e, p) => { e.yaw = Math.atan2(p.x - e.x, p.z - e.z); };
  function stepToward(e, tx, tz, step, walkOnly) { const dx = tx - e.x, dz = tz - e.z, L = Math.hypot(dx, dz); if (L < 1e-3) { e.moving = false; return; } const k = Math.min(step, L) / L; if (walkOnly) nav.move(e, dx * k, dz * k, 0.1); else { e.x += dx * k; e.z += dz * k; } e.yaw = Math.atan2(dx, dz); e.moving = true; }
  function chaseTo(e, tx, tz, spd, dt) { if (e.A.fly) { stepToward(e, tx, tz, spd * dt, false); return; }
    e.wpT -= dt; if (e.wpT <= 0 || !e.wp) { e.wpT = 0.35; if (e.ringT > 0) { const gp = nav.gridPath(e.x, e.z, tx, tz, 4000); e.wp = gp ? gp[0] : nav.waypoint(e.x, e.z, tx, tz, true); } else e.wp = nav.waypoint(e.x, e.z, tx, tz); } // 卡住時改用格子導航圖找路
    if (Math.hypot(e.wp[0] - e.x, e.wp[1] - e.z) < 0.1) e.wpT = 0; stepToward(e, e.wp[0], e.wp[1], spd * dt, true);
    if (e.sAcc == null) { e.sAcc = 0; e.sx = e.x; e.sz = e.z; } e.sAcc += dt; if (e.sAcc > 0.6) { if (Math.hypot(e.x - e.sx, e.z - e.sz) < spd * e.sAcc * 0.25) { e.ringT = 1.5; e.wpT = 0; } e.sAcc = 0; e.sx = e.x; e.sz = e.z; } if (e.ringT > 0) e.ringT -= dt; }
  function wander(e, dt, spd) { if (!e.wander || Math.hypot(e.wander[0] - e.x, e.wander[1] - e.z) < 0.3 || (e.wanderT -= dt) <= 0) { const id = G.stage.islands[Math.floor(Math.random() * G.stage.islands.length)], c = centers.get(id), a = Math.random() * 6.28; e.wander = nav.nearestWalkable(c.x + Math.cos(a) * 1.5, c.z + Math.sin(a) * 1.5); e.wanderT = 6; } chaseTo(e, e.wander[0], e.wander[1], spd, dt); }
  function meleeStep(e, P, dt, reach) { if (e.state === 'windup') { e.t -= dt; e.moving = false; if (e.t <= 0) { e.state = 'go'; e.mcd = ML.cooldown; if (P && !P.down && dist(e, P.pos) <= reach + ML.reach) hurt(P, e.A.dmg); } return true; }
    if (P && !P.down && dist(e, P.pos) <= reach) { face(e, P.pos); e.moving = false; if (e.mcd <= 0) { e.state = 'windup'; e.t = ML.windup; } return true; } return false; }
  function updateEnemy(e, dt) { const A = e.A; e.mcd -= dt; if (e.hitT > 0) e.hitT -= dt; if (e.clang > 0) e.clang -= dt;
    if (e.state === 'land') { e.landT += dt; const k = Math.min(1, e.landT / SH.landSeconds); e.x = lerp(e.sp.wx, e.sp.ex, k); e.z = lerp(e.sp.wz, e.sp.ez, k); e.moving = true; if (k >= 1) e.state = 'go'; return; }
    if (e.stun > 0 && e.state !== 'air') { e.stun -= dt; e.moving = false; if (e.state === 'windup' || e.state === 'windup2' || e.state === 'aim' || e.state === 'charge') e.state = 'go'; return; }
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
    const spd = A.speed * SH.unitsPerSec * (1 - e.slow);
    e.retarget -= dt; if (e.retarget <= 0) { e.retarget = SH.retarget * (0.7 + Math.random() * 0.6); e.target = A.glow && G.special === 'rush' && !A.gold ? G.rushTarget : nearestStanding(e); }
    if (A.gold) { wander(e, dt, spd); return; }
    const P = G.players[e.target], ok = P && !P.down, reach = ML.range + A.size * 0.1;
    switch (A.ai) {
      case 'bomber': e.cd -= dt;
        if (e.state === 'windup2') { e.t -= dt; e.moving = false; if (ok) face(e, P.pos); if (e.t <= 0) { e.state = 'go'; e.cd = A.every; if (ok) { const [tx, tz] = nav.nearestWalkable(P.pos.x, P.pos.z); ev(['lob', r2(e.x), r2(e.z), r2(tx), r2(tz), r2(A.fuse)]); warnCircle(tx, tz, A.blastR, A.fuse, () => blast(tx, tz, A.blastR, A.blastDmg)); } } return; }
        if (ok && e.cd <= 0 && dist(e, P.pos) < A.throwRange) { e.state = 'windup2'; e.t = A.windup; e.bombDmg = 0; return; }
        if (meleeStep(e, P, dt, reach)) return; ok ? chaseTo(e, P.pos.x, P.pos.z, spd, dt) : wander(e, dt, spd); return;
      case 'leaper': e.cd -= dt;
        if (e.state === 'aim') { e.t -= dt; e.moving = false; if (e.t <= 0) { e.state = 'air'; e.t = A.air; e.fx = e.x; e.fz = e.z; } return; }
        if (e.state === 'air') { e.t -= dt; const k = 1 - Math.max(0, e.t) / A.air; e.x = lerp(e.fx, e.tx, k); e.z = lerp(e.fz, e.tz, k); e.air = Math.sin(k * Math.PI); if (e.t <= 0) { e.air = 0; e.state = 'go'; e.stun = A.stun; e.cd = A.every; blast(e.tx, e.tz, A.slamR, A.slamDmg); } return; }
        if (ok && e.cd <= 0 && dist(e, P.pos) < A.leapRange) { e.state = 'aim'; e.t = A.aim; [e.tx, e.tz] = nav.nearestWalkable(P.pos.x, P.pos.z); face(e, P.pos); warnCircle(e.tx, e.tz, A.slamR, A.aim + A.air, null); return; }
        if (meleeStep(e, P, dt, reach)) return; ok ? chaseTo(e, P.pos.x, P.pos.z, spd, dt) : wander(e, dt, spd); return;
      case 'charger': e.cd -= dt;
        if (e.state === 'aim') { e.t -= dt; e.moving = false; if (e.t <= 0) { e.state = 'charge'; e.t = A.chargeTime; e.cdx = Math.sin(e.yaw); e.cdz = Math.cos(e.yaw); e.hitSet = new Set(); } return; }
        if (e.state === 'charge') { e.t -= dt; const st = A.chargeSpeed * dt, ox = e.x, oz = e.z; nav.move(e, e.cdx * st, e.cdz * st, 0.15); e.moving = true;
          for (const Q of G.players) if (!Q.down && !e.hitSet.has(Q.slot) && dist(e, Q.pos) < 0.32 + A.size * 0.1) { e.hitSet.add(Q.slot); hurt(Q, A.dmg); }
          if (e.t <= 0 || Math.hypot(e.x - ox, e.z - oz) < st * 0.4) { e.state = 'go'; e.stun = A.stun; e.cd = A.every; ev(['boom', r2(e.x), r2(e.z), 40]); } return; }
        if (ok && e.cd <= 0 && dist(e, P.pos) < 5) { e.state = 'aim'; e.t = A.aim; face(e, P.pos); const L = Math.min(A.chargeSpeed * A.chargeTime, 5.5); warnLine(e.x, e.z, e.x + Math.sin(e.yaw) * L, e.z + Math.cos(e.yaw) * L, 0.55, A.aim, null); return; }
        if (meleeStep(e, P, dt, reach)) return; ok ? chaseTo(e, P.pos.x, P.pos.z, spd, dt) : wander(e, dt, spd); return;
      case 'tower': e.cd -= dt; e.moving = false;
        if (e.state === 'aim') { e.t -= dt; if (e.t <= 0) { e.state = 'go'; e.cd = A.every; const x2 = e.x + e.bdx * A.beamLen, z2 = e.z + e.bdz * A.beamLen; ev(['laser', r2(e.x), r2(e.z), r2(x2), r2(z2)]); for (const Q of G.players) if (!Q.down && segDist(Q.pos.x, Q.pos.z, e.x, e.z, x2, z2) < A.beamW / 2 + PL.radius) hurt(Q, A.dmg); } return; }
        if (e.cd <= 0) { let tgt = null, bd = A.beamLen; for (const Q of G.players) if (!Q.down && dist(e, Q.pos) < bd) { bd = dist(e, Q.pos); tgt = Q; } if (tgt) { e.state = 'aim'; e.t = A.aim; const dx = tgt.pos.x - e.x, dz = tgt.pos.z - e.z, L = Math.hypot(dx, dz) || 1; e.bdx = dx / L; e.bdz = dz / L; e.yaw = Math.atan2(dx, dz); warnLine(e.x, e.z, e.x + e.bdx * A.beamLen, e.z + e.bdz * A.beamLen, A.beamW, A.aim, null); } else e.cd = 0.5; } return;
      case 'missile': e.cd -= dt;
        if (!e.hover || (e.hoverT -= dt) <= 0) { const s = randomSpawn(); e.hover = [lerp(s.wx, s.ex, 0.55), lerp(s.wz, s.ez, 0.55)]; e.hoverT = A.hover; }
        stepToward(e, e.hover[0], e.hover[1], spd * dt, false); if (ok) face(e, P.pos);
        if (e.state === 'aim') { e.t -= dt; if (e.t <= 0) e.state = 'go'; return; }
        if (e.cd <= 0) { e.cd = A.every; e.state = 'aim'; e.t = A.aim; for (const Q of G.players) if (!Q.down) { const [tx, tz] = [Q.pos.x, Q.pos.z]; warnCircle(tx, tz, A.blastR, A.aim, () => blast(tx, tz, A.blastR, A.dmg)); } } return;
      default: lesser(e, dt, spd, P, ok, reach); } }
  function lesser(e, dt, spd, P, ok, reach) { const A = e.A;
    if (A.ranged) { const RG = A.ranged; e.cd -= dt; if (ok) { const d = dist(e, P.pos); if (d <= RG.range && e.cd <= 0) { spit(e, P); e.cd = RG.every; } if (d > RG.range * 0.75) chaseTo(e, P.pos.x, P.pos.z, spd, dt); else { e.moving = false; face(e, P.pos); } } else wander(e, dt, spd); return; }
    if (meleeStep(e, P, dt, reach)) return; ok ? chaseTo(e, P.pos.x, P.pos.z, spd, dt) : wander(e, dt, spd); }
  function segDist(px, pz, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)); return Math.hypot(ax + dx * t - px, az + dz * t - pz); }
  function separate() { const E = G.enemies; for (let i = 0; i < E.length; i++) { const a = E[i]; if (a.dead || a.state === 'land' || a.A.fly) continue; for (let j = i + 1; j < E.length; j++) { const b = E[j]; if (b.dead || b.state === 'land' || b.A.fly) continue;
    const min = SH.separation * (a.A.size + b.A.size) * 0.6, dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz; if (d2 >= min * min || d2 < 1e-6) continue; const d = Math.sqrt(d2), f = (min - d) / d, wa = b.A.size / (a.A.size + b.A.size);
    if (a.A.ai !== 'tower' && a.state !== 'charge' && a.state !== 'air') nav.move(a, -dx * f * wa, -dz * f * wa, 0.1); if (b.A.ai !== 'tower' && b.state !== 'charge' && b.state !== 'air') nav.move(b, dx * f * (1 - wa), dz * f * (1 - wa), 0.1); } } }
  // ── 招式：預告圈／線、爆炸、口水 ──
  function warnCircle(x, z, r, ttl, end) { G.warns.push({ c: 1, x, z, r, t: ttl, end }); ev(['warnc', r2(x), r2(z), r2(r), r2(ttl)]); }
  function warnLine(x, z, x2, z2, w, ttl, end) { G.warns.push({ c: 0, x, z, x2, z2, w, t: ttl, end }); ev(['warnl', r2(x), r2(z), r2(x2), r2(z2), r2(w), r2(ttl)]); }
  function warnsStep(dt) { for (const w of G.warns) { w.t -= dt; if (w.t <= 0 && !w.done) { w.done = true; if (w.end && G.phase === 'wave') w.end(); } } G.warns = G.warns.filter(w => !w.done); }
  function blast(x, z, r, dmg) { ev(['boom', r2(x), r2(z), r2(r)]); for (const P of G.players) if (!P.down && Math.hypot(P.pos.x - x, P.pos.z - z) < r + PL.radius) hurt(P, dmg); }
  function spit(e, P) { const dx = P.pos.x - e.x, dz = P.pos.z - e.z, L = Math.hypot(dx, dz) || 1, RG = e.A.ranged; G.spits.push({ x: e.x, z: e.z, vx: dx / L * RG.speed, vz: dz / L * RG.speed, t: (RG.range + 0.6) / RG.speed, dmg: e.A.dmg }); ev(['spit', r2(e.x), r2(e.z), r2(dx / L), r2(dz / L), r2(RG.speed), r2((RG.range + 0.6) / RG.speed)]); }
  function spitsStep(dt) { for (const s of G.spits) { s.x += s.vx * dt; s.z += s.vz * dt; s.t -= dt; for (const P of G.players) if (!P.down && Math.hypot(P.pos.x - s.x, P.pos.z - s.z) < 0.26) { hurt(P, s.dmg); s.t = 0; break; } } G.spits = G.spits.filter(s => s.t > 0); }
  function dangerAt(x, z) { for (const w of G.warns) { if (w.c && Math.hypot(x - w.x, z - w.z) < w.r + 0.25) return w; if (!w.c && segDist(x, z, w.x, w.z, w.x2, w.z2) < w.w / 2 + 0.3) return w; } return null; }
  // ── 小學生受傷、倒下、救起 ──
  function hurt(P, dmg) { if (P.down || P.inv > 0 || P.dash || G.phase !== 'wave') return; dmg *= (SH.dmgK0 + SH.dmgK1 * G.hazard) * (1 - (G.boost ? G.boost.dmg : 0)); P.hp -= dmg; P.hitT = 0; P.inv = PL.invAfterHit; ev(['hurt', P.slot, Math.round(dmg)]); if (P.hp <= 0) knockDown(P); }
  function knockDown(P) { P.hp = 0; P.down = true; P.downs++; P.revive = 0; P.goal = null; P.dash = null; P.spT = 0; if (P.carry) { P.carry = false; dropEgg(P.pos.x, P.pos.z, 0.1); } ev(['down', P.slot]); if (G.players.every(q => q.down)) finish(false, 'wipe'); }
  function revives(dt) { for (const P of G.players) { if (!P.down) continue; let mate = null; for (const Q of G.players) if (Q !== P && !Q.down && Math.hypot(Q.pos.x - P.pos.x, Q.pos.z - P.pos.z) <= PL.reviveR) { mate = Q; break; }
    if (mate) { P.revive += dt * (mate.cfg.reviveMul || 1); if (P.revive >= PL.reviveTime) revive(P, mate); } else P.revive = Math.max(0, P.revive - dt * PL.reviveDecay); } }
  function revive(P, by) { P.down = false; P.hp = PL.hp; P.revive = 0; P.inv = PL.invAfterRevive; P.hitT = 99; if (by) by.rescues++; ev(['rev', P.slot, by ? by.slot : -1]); }
  // ── 小學生攻擊：自動瞄準（鎖定的 > 貼身的 > 魔王 > 最近的）──
  function weapon(P) { const c = P.cfg, s = P.spT > 0 && c.special.id === 'hose' ? c.special : null; return { dmg: c.dmg * (s ? s.dmgMul : 1), rate: c.rate / (s ? s.rateMul : 1), range: c.range + (s ? s.rangeAdd : 0) }; }
  function pickTarget(P, range) { const f = P.focus && enemyById.get(P.focus); if (f && !f.dead && f.state !== 'land' && dist(f, P.pos) <= range) return f; let best = null, bs = Infinity;
    for (const e of G.enemies) { if (e.dead || (e.state === 'land' && e.landT < SH.landSeconds * 0.5)) continue; const d = dist(e, P.pos); if (d > range) continue; const s = d - (d < SH.threatR ? 10 : 0) - (e.A.boss || e.A.gold ? 1.5 : 0); if (s < bs) { bs = s; best = e; } } return best; }
  function fireAll(dt) { for (const P of G.players) { if (P.down || P.dash) { P.firing = false; continue; } P.cd -= dt; if (P.cd > 0) continue; const W = weapon(P), tg = pickTarget(P, W.range); if (!tg) { P.firing = false; continue; }
    P.cd = W.rate; P.firing = true; if (!P.w.moving) P.w.yaw = Math.atan2(tg.x - P.pos.x, tg.z - P.pos.z);
    if (P.cfg.chain) { const hit = [tg]; let cur = tg; for (let i = 1; i < P.cfg.chain; i++) { let nx = null, bd = 1.3; for (const e of G.enemies) { if (e.dead || hit.includes(e)) continue; const d = dist(e, cur); if (d < bd) { bd = d; nx = e; } } if (!nx) break; hit.push(nx); cur = nx; } ev(['zap', P.slot, ...hit.map(e => e.id)]); hit.forEach((e, i) => damage(e, W.dmg * Math.pow(0.8, i), P)); }
    else { ev(['shot', P.slot, tg.id]); damage(tg, W.dmg, P); if (P.cfg.slow && !tg.dead) { tg.slow = Math.max(tg.slow, tg.A.boss ? P.cfg.slow * 0.5 : P.cfg.slow); tg.slowT = P.cfg.slowTime; } } } }
  function damage(e, amt, by) { if (e.dead) return; const A = e.A;
    if (A.ai === 'charger' && !(e.stun > 0) && by) { const fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), dx = by.pos.x - e.x, dz = by.pos.z - e.z, L = Math.hypot(dx, dz) || 1; if ((fx * dx + fz * dz) / L > Math.cos(A.shieldArc)) { amt *= A.shield; e.clang = 0.2; } }
    if (A.ai === 'leaper' && e.stun > 0) amt *= A.stunMul;
    e.hp -= amt; e.hitT = 0.12;
    if (A.ai === 'bomber' && e.state === 'windup2') { e.bombDmg += amt; if (e.bombDmg >= A.bombHp) { ev(['boom', r2(e.x), r2(e.z), r2(A.blastR)]); for (const o of G.enemies) if (o !== e && !o.dead && !o.A.boss && dist(o, e) < A.blastR) kill(o, by); e.hp = 0; } }
    if (A.gold && A.eggEvery) { const n = Math.min(Math.round(1 / A.eggEvery) - 1, Math.floor((1 - Math.max(0, e.hp) / e.maxHp) / A.eggEvery)); while (e.goldDropped < n) { dropEgg(e.x, e.z); e.goldDropped++; } }
    if (e.hp <= 0) kill(e, by); }
  function kill(e, by) { if (e.dead) return; e.dead = true; if (by) by.power++; const A = e.A; if (A.boss) for (let i = 0; i < EG.perBoss; i++) dropEgg(e.x, e.z); if (A.gold) for (let i = 0; i < (A.eggOnDeath || 0); i++) dropEgg(e.x, e.z); ev(['kill', e.id, r2(e.x), r2(e.z), A.boss ? 1 : A.gold ? 2 : 0]); }
  // ── 金蛋：掉落、撿、搬進籃子、丟 ──
  function dropEgg(x, z, scatter = EG.scatter) { const a = Math.random() * 6.28, r = Math.random() * scatter; const [px, pz] = nav.nearestWalkable(x + Math.cos(a) * r, z + Math.sin(a) * r); const g = { id: ++eggId, x: px, z: pz, y: 0, air: 0 }; G.eggs.push(g); return g; }
  function eggsStep(dt) { for (const g of G.eggs) { if (g.gone) continue;
      if (g.air > 0) { g.air -= dt; const k = 1 - Math.max(0, g.air) / EG.throwTime; g.x = lerp(g.fx, g.tx, k); g.z = lerp(g.fz, g.tz, k); g.y = 0.45 + Math.sin(k * Math.PI) * 0.6 - k * 0.45; if (g.air <= 0) { g.y = 0; if (Math.hypot(g.tx - G.basket.x, g.tz - G.basket.z) <= EG.basketR) { g.gone = true; deliver(G.players[g.by]); continue; } [g.x, g.z] = nav.nearestWalkable(g.tx, g.tz); } continue; }
      for (const P of G.players) { if (P.down || P.carry || P.dash) continue; if (Math.hypot(P.pos.x - g.x, P.pos.z - g.z) <= EG.pickR) { P.carry = true; g.gone = true; ev(['pick', P.slot]); break; } } }
    for (const P of G.players) if (P.carry && !P.down && Math.hypot(P.pos.x - G.basket.x, P.pos.z - G.basket.z) <= EG.basketR) { P.carry = false; deliver(P); } }
  function deliver(P) { if (G.phase !== 'wave') return; G.gold++; if (P) P.gold++; ev(['egg', P ? P.slot : -1]); if (G.gold === G.quota) ev(['say', 'quota']); }
  // ── 解題獎勵：答對一題，這一波金蛋 +bonusEggs（算進配額與自己的金蛋）、血補滿；每人每關最多 perShift 題、間隔 cooldown 秒（房客答對後送 qz 指令給房主）──
  function quizBonusHost(P) { if (!P || P.down || G.phase !== 'wave' || (P.quizT || 0) > 0 || (P.quizN || 0) >= C.quiz.perShift) return false; P.quizT = C.quiz.cooldown; P.quizN = (P.quizN || 0) + 1; const n = C.quiz.bonusEggs; G.gold += n; P.gold += n; P.hp = PL.hp; ev(['qz', P.slot, n]); if (G.gold >= G.quota && G.gold - n < G.quota) ev(['say', 'quota']); return true; }
  function quizBonus() { const P = meP(); if (!P || P.down || G.phase !== 'wave') return null; if (G.role !== 'client') { quizBonusHost(P); return null; } P.quizT = C.quiz.cooldown; P.quizN = (P.quizN || 0) + 1; return { t: 'i', k: 'qz' }; }
  function throwEggHost(P, dx, dz) { if (!P || !P.carry || P.down) return false; let tx, tz; const db = Math.hypot(P.pos.x - G.basket.x, P.pos.z - G.basket.z);
    if (db <= EG.throwAim) { tx = G.basket.x; tz = G.basket.z; } else { let L = Math.hypot(num(dx) ? dx : 0, num(dz) ? dz : 0); if (L < 0.01) { dx = Math.sin(P.w.yaw); dz = Math.cos(P.w.yaw); L = 1; } tx = P.pos.x + dx / L * EG.throwDist; tz = P.pos.z + dz / L * EG.throwDist; }
    P.carry = false; G.eggs.push({ id: ++eggId, x: P.pos.x, z: P.pos.z, y: 0.45, air: EG.throwTime, fx: P.pos.x, fz: P.pos.z, tx, tz, by: P.slot }); ev(['throw', P.slot]); return true; }
  // ── 特殊技（一關 2 次）──
  function useSpecialHost(P, dx, dz) { if (!P || P.down || P.sp <= 0 || P.spT > 0 || P.dash || G.phase !== 'wave') return false; const S = P.cfg.special; P.sp--; let L = Math.hypot(num(dx) ? dx : 0, num(dz) ? dz : 0); if (L < 0.01) { dx = Math.sin(P.w.yaw); dz = Math.cos(P.w.yaw); L = 1; } dx /= L; dz /= L;
    ev(['sp', P.slot, r2(P.pos.x), r2(P.pos.z), r2(dx), r2(dz)]);
    if (S.id === 'broadcast') for (const e of [...G.enemies]) { if (e.dead || dist(e, P.pos) > S.r) continue; damage(e, S.dmg, P); if (!e.dead) { e.stun = Math.max(e.stun, S.stun); if (e.state === 'charge') e.state = 'go'; } }
    if (S.id === 'dash') { P.dash = { dx, dz, t: S.time, dist: S.dist, time: S.time, hit: new Set() }; P.inv = S.time + 0.2; }
    if (S.id === 'hose') P.spT = S.time;
    if (S.id === 'bento') for (const Q of G.players) { if (Math.hypot(Q.pos.x - P.pos.x, Q.pos.z - P.pos.z) > S.r) continue; if (Q.down) revive(Q, Q === P ? null : P); Q.hp = PL.hp; Q.inv = S.inv; }
    if (S.id === 'chain') { const list = G.enemies.filter(e => !e.dead && dist(e, P.pos) <= S.r).sort((a, b) => dist(a, P.pos) - dist(b, P.pos)).slice(0, S.n); if (list.length) ev(['zap', P.slot, ...list.map(e => e.id)]); for (const e of list) damage(e, S.dmg, P); }
    return true; }
  function dashes(dt) { for (const P of G.players) { const D = P.dash; if (!D) continue; for (const e of G.enemies) if (!e.dead && !D.hit.has(e.id) && dist(e, P.pos) < P.cfg.special.w) { D.hit.add(e.id); damage(e, P.cfg.special.dmg, P); } D.t -= dt; if (D.t <= 0) P.dash = null; } }
  // ── NPC 同學：躲招 > 救人 > 搬蛋 > 撿蛋 > 打魔王 > 回籃子附近 ──
  function npcThink(P, dt) { P.think -= dt; if (P.think > 0 || P.down) return; P.think = NP.think * (0.8 + Math.random() * 0.4); const g0 = P.goal; npcDecide(P); if (P.goal && (!g0 || Math.hypot(P.goal[0] - g0[0], P.goal[1] - g0[1]) > 0.25)) P.wpT = 0; } // 目標換了就馬上重算路線
  function npcDecide(P) { P.focus = 0; P.goal = null;
    const dz = dangerAt(P.pos.x, P.pos.z); if (dz) { let ax, az; if (dz.c) { ax = P.pos.x - dz.x; az = P.pos.z - dz.z; const L = Math.hypot(ax, az) || 1; P.goal = nav.nearestWalkable(dz.x + ax / L * (dz.r + 0.5), dz.z + az / L * (dz.r + 0.5)); } else { const lx = dz.x2 - dz.x, lz = dz.z2 - dz.z, L = Math.hypot(lx, lz) || 1, side = ((P.pos.x - dz.x) * -lz + (P.pos.z - dz.z) * lx) >= 0 ? 1 : -1; P.goal = nav.nearestWalkable(P.pos.x - lz / L * side * (dz.w + 0.6), P.pos.z + lx / L * side * (dz.w + 0.6)); } return; }
    const near = (x, z) => Math.hypot(P.pos.x - x, P.pos.z - z);
    { let cx = 0, cz = 0, n = 0, close = false; for (const e of G.enemies) { if (e.dead || e.A.boss || e.state === 'land') continue; const d = dist(e, P.pos); if (d < 1.2) { cx += e.x; cz += e.z; n++; if (d < NP.kiteR) close = true; } }
      if (close && (P.hp < NP.kiteHp || n >= NP.kiteCrowd)) { cx /= n; cz /= n; let ax = P.pos.x - cx, az = P.pos.z - cz; const L = Math.hypot(ax, az) || 1; ax /= L; az /= L; const bx = G.basket.x - P.pos.x, bz = G.basket.z - P.pos.z, bl = Math.hypot(bx, bz) || 1; ax += bx / bl * 0.5; az += bz / bl * 0.5; const L2 = Math.hypot(ax, az) || 1; P.goal = nav.nearestWalkable(P.pos.x + ax / L2 * NP.kiteDist, P.pos.z + az / L2 * NP.kiteDist); return; } }
    if (G.phase === 'wave' && P.sp > 0) { const bossNear = G.enemies.filter(e => !e.dead && e.A.boss && dist(e, P.pos) < 3.5).length, downNear = G.players.filter(q => q.down && near(q.pos.x, q.pos.z) < P.cfg.special.r).length, crowd = G.enemies.filter(e => !e.dead && dist(e, P.pos) < 2).length, late = G.timeLeft < 20 && G.gold < G.quota;
      const want = P.cfg.special.id === 'bento' ? downNear >= 2 || (downNear >= 1 && late) : bossNear >= NP.specialBosses || crowd >= 7 || (late && bossNear >= 1) || (P.hp < 40 && crowd >= 4);
      if (want) { const t = G.enemies.find(e => !e.dead && e.A.boss && dist(e, P.pos) < 4.5); useSpecialHost(P, t ? t.x - P.pos.x : 0, t ? t.z - P.pos.z : 0); } }
    const downs = G.players.filter(q => q.down && q !== P).sort((a, b) => near(a.pos.x, a.pos.z) - near(b.pos.x, b.pos.z));
    for (const q of downs) { const d = near(q.pos.x, q.pos.z); if (d < NP.reviveRange && !G.players.some(o => o !== P && !o.down && o.npc && o.helping === q.slot && Math.hypot(o.pos.x - q.pos.x, o.pos.z - q.pos.z) < d)) { P.goal = [q.pos.x, q.pos.z]; P.helping = q.slot; return; } } P.helping = -1;
    if (P.carry) { if (near(G.basket.x, G.basket.z) < EG.throwAim - 0.2 && Math.random() < 0.5) throwEggHost(P, 0, 0); else P.goal = [G.basket.x, G.basket.z]; return; }
    let egg = null, be = Infinity; for (const g of G.eggs) { if (g.gone || g.air > 0) continue; if (G.players.some(o => o !== P && o.npc && o.eggT === g.id && !o.down)) continue; if (P.badEgg && P.badEgg.id === g.id && G.clock < P.badEgg.until) continue; const d = near(g.x, g.z), db = Math.hypot(g.x - G.basket.x, g.z - G.basket.z); if (d > NP.eggRange && db > NP.eggRange) continue; const s = d + db * 0.5; if (s < be) { be = s; egg = g; } }
    if (P.eggT && P.stuckN >= 3) { P.badEgg = { id: P.eggT, until: G.clock + 6 }; P.stuckN = 0; } // 同一顆蛋卡了三次就先放著，6 秒後再試
    P.eggT = egg ? egg.id : 0; if (egg) { P.goal = [egg.x, egg.z]; return; }
    let boss = null, bb = Infinity; for (const e of G.enemies) { if (e.dead || !(e.A.boss || e.A.gold) || e.state === 'land') continue; const d = dist(e, P.pos); if (d > NP.bossRange) continue; const s = d + Math.hypot(e.x - G.basket.x, e.z - G.basket.z) * 0.4; if (s < bb) { bb = s; boss = e; } }
    if (boss) { P.focus = boss.id; const d = dist(boss, P.pos), want = P.cfg.range * 0.75, a = Math.atan2(P.pos.x - boss.x, P.pos.z - boss.z) + (P.slot - 1.5) * 0.35, sx = boss.x + Math.sin(a) * want, sz = boss.z + Math.cos(a) * want; // 依編號往左右散開，不要擠成一團
      if (Math.abs(d - want) > 0.3 || Math.hypot(sx - P.pos.x, sz - P.pos.z) > 0.4) P.goal = nav.nearestWalkable(sx, sz); else P.goal = null; return; }
    if (near(G.basket.x, G.basket.z) > NP.home) { const a = Math.random() * 6.28; P.goal = nav.nearestWalkable(G.basket.x + Math.cos(a) * NP.home * 0.6, G.basket.z + Math.sin(a) * NP.home * 0.6); } }
  // ── 頭上台詞：同時最多 chant.max 句；剛登陸的先講（魔王優先）；牌堆洗牌輪流抽；鸚鵡會複製上一句加 +1 ──
  const decks = new Map(); let lastLine = '';
  function draw(key, n) { let d = decks.get(key); if (!d || !d.length) { d = [...Array(n).keys()]; for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } decks.set(key, d); } return d.pop(); }
  function updateChants(dt) { let talking = 0; G.chantGap = (G.chantGap || 0) - dt;
    for (const e of G.enemies) { if (e.chant) { e.chantT -= dt; if (e.chantT <= 0) { e.chant = null; e.restT = CH.rest; ev(['chant', e.id, -1, 0]); } else talking++; } else if (e.restT > 0) e.restT -= dt; }
    if (talking >= CH.max || G.chantGap > 0) return; const talkers = G.enemies.filter(e => e.chant && !e.dead);
    let best = null, bs = -1; for (const e of G.enemies) { if (e.dead || e.chant || e.restT > 0 || e.state === 'land' || talkers.some(o => (o.x - e.x) ** 2 + (o.z - e.z) ** 2 < CH.space ** 2)) continue; const s = (e.spoke ? 0 : 2) + (e.A.boss ? 3 : 0) + Math.random(); if (s > bs) { best = e; bs = s; } }
    if (!best) return; const A = best.A, iss = G.issue && G.issue.chants && G.issue.chants.length ? G.issue.chants : null; let src, idx;
    if (A.repeat && lastLine && lastLine.length <= CH.copyMax && Math.random() < 0.6) { src = 2; idx = 0; } else if (iss && !A.boss && !A.gold && Math.random() < CH.issueShare) { src = 0; idx = draw('i:' + G.issue.id, iss.length); } else { src = 1; idx = draw('a:' + best.type, A.chants.length); }
    best.chant = true; best.chantT = CH.on; best.spoke = true; G.chantGap = CH.every; ev(['chant', best.id, src, idx]); }
  function chantText(e, src, idx) { if (src === 2) return lastLine ? lastLine.replace(/[!！]+$/, '') + '+1' : '+1'; const list = src === 0 ? (G.issue && G.issue.chants) || [] : e.A.chants || []; return list[idx] || ''; }

  // ═══════════════ 快照（房主 → 房客）═══════════════
  const pflags = P => (P.down ? 1 : 0) | (P.carry ? 2 : 0) | (P.inv > 0 ? 4 : 0) | (P.firing ? 8 : 0) | (P.npc ? 16 : 0) | (P.spT > 0 ? 32 : 0) | (P.dash ? 64 : 0);
  const eflags = e => (e.stun > 0 ? 1 : 0) | (e.state === 'windup' || e.state === 'aim' || e.state === 'windup2' ? 2 : 0) | (e.state === 'air' ? 4 : 0) | (e.state === 'windup2' ? 8 : 0) | (e.state === 'charge' ? 16 : 0) | (e.hitT > 0 ? 32 : 0) | (e.state === 'land' ? 64 : 0);
  let seq = 0;
  function makeSnapshot() { return { t: 's', k: ++seq, ph: PHASES.indexOf(G.phase), wn: G.waveNo, tl: Math.round((G.phase === 'wave' ? G.timeLeft : G.t) * 10), q: G.quota, g: G.gold, sp: SPECIALS.indexOf(G.special), rt: G.rushTarget,
    P: G.players.flatMap(P => [P.slot, r2(P.pos.x), r2(P.pos.z), r2(P.w.yaw), Math.round(P.hp), pflags(P), P.gold, P.power, P.rescues, P.sp, Math.round(P.revive / PL.reviveTime * 100), P.downs]),
    E: G.enemies.filter(e => !e.dead).flatMap(e => [e.id, TYPES.indexOf(e.type), r2(e.x), r2(e.z), r2(e.yaw), Math.round(Math.max(0, e.hp) / e.maxHp * 100), eflags(e)]),
    O: G.eggs.filter(g => !g.gone).flatMap(g => [g.id, r2(g.x), r2(g.z), r2(g.y)]), V: G.out.splice(0) }; }
  // 房客：把快照套進自己的鏡像狀態（收到的都不可信：檢查型別與範圍）
  function applySnapshot(s) { if (G.role !== 'client' || !s || typeof s !== 'object') return;
    if (num(s.wn)) G.waveNo = Math.max(0, Math.min(SH.waves, s.wn | 0)); if (num(s.q)) G.quota = Math.max(0, s.q | 0); if (num(s.g)) G.gold = Math.max(0, s.g | 0); G.special = SPECIALS[s.sp] || ''; G.rushTarget = num(s.rt) ? s.rt : -1;
    const ph = PHASES[s.ph]; if (ph && ph !== 'lobby' && G.phase !== 'result') G.phase = ph; if (num(s.tl)) { if (G.phase === 'wave') G.timeLeft = s.tl / 10; else G.t = s.tl / 10; }
    if (Array.isArray(s.P)) for (let i = 0; i + 11 < s.P.length && i < 120; i += 12) { const a = s.P.slice(i, i + 12); if (!a.every(num)) continue; const [slot, x, z, yaw, hp, fl, gold, power, resc, sp, rev, downs] = a; const P = G.players[slot]; if (!P || Math.abs(x) > 6000 || Math.abs(z) > 6000) continue;
      P.hp = hp; P.down = !!(fl & 1); P.carry = !!(fl & 2); P.invF = !!(fl & 4); P.firing = !!(fl & 8); P.spOn = !!(fl & 32); P.gold = gold | 0; P.power = power | 0; P.rescues = resc | 0; P.sp = sp | 0; P.revive = rev / 100 * PL.reviveTime; P.downs = downs | 0;
      if (!!(fl & 16) !== P.npc) { P.npc = !!(fl & 16); if (P.npc && P.local) { P.local = false; G.me = -1; } retag(P); }
      if (P.local) { if (P.down || Math.hypot(P.pos.x - x / 100, P.pos.z - z / 100) > 4) { P.pos.x = x / 100; P.pos.z = z / 100; P.goal = null; P.dash = null; } } else { P.tx = x / 100; P.tz = z / 100; P.tyaw = yaw / 100; } }
    if (Array.isArray(s.E)) { const seen = new Set(); for (let i = 0; i + 6 < s.E.length && i < 7 * 80; i += 7) { const a = s.E.slice(i, i + 7); if (!a.every(num)) continue; const [id, ti, x, z, yaw, hp, fl] = a, type = TYPES[ti]; if (!type) continue; seen.add(id);
        let e = enemyById.get(id); if (!e) { e = { id, type, A: C.animals[type], x: x / 100, z: z / 100, yaw: yaw / 100, seed: Math.random(), wing: Math.random() * 6, hopT: Math.random(), dead: false, flags: 0, airT: 0 }; G.enemies.push(e); enemyById.set(id, e); }
        e.tx = x / 100; e.tz = z / 100; e.tyaw = yaw / 100; e.hpf = hp / 100; if ((fl & 4) && !(e.flags & 4)) e.airT = 0; e.flags = fl; }
      for (const e of G.enemies) if (!seen.has(e.id)) e.dead = true; purge(); }
    if (Array.isArray(s.O)) { const seen = new Set(); for (let i = 0; i + 3 < s.O.length && i < 4 * 120; i += 4) { const a = s.O.slice(i, i + 4); if (!a.every(num)) continue; const [id, x, z, y] = a; seen.add(id); let g = G.eggs.find(q => q.id === id); if (!g) { g = { id, x: x / 100, z: z / 100, y: y / 100 }; G.eggs.push(g); } g.tx = x / 100; g.tz = z / 100; g.ty = y / 100; }
      for (const g of G.eggs) if (!seen.has(g.id)) { g.gone = true; if (g.obj) scene.remove(g.obj); } G.eggs = G.eggs.filter(g => !g.gone); }
    if (Array.isArray(s.V)) for (const v of s.V.slice(0, 300)) if (Array.isArray(v) && typeof v[0] === 'string') { try { playEvent(v); } catch (err) { /* 壞掉的事件略過 */ } }
    emit('hud'); }
  function applyResult(res) { if (G.role !== 'client' || !res || typeof res !== 'object') return; G.phase = 'result'; G.result = res; emit('end', res); }
  function clientStep(dt) { const P = G.players[G.me]; if (P) { moveLocal(P, dt); tickPlayer(P, dt); } if (G.phase === 'wave') G.timeLeft = Math.max(0, G.timeLeft - dt); else if (G.phase !== 'result') G.t = Math.max(0, G.t - dt); }
  // 房主收到房客的輸入：位置（要走得到）、鎖定、特殊技、丟蛋、快速訊號
  function remoteInput(slot, m) { const P = G.players[slot]; if (!P || P.npc || P.local || !m || typeof m !== 'object') return;
    if (m.t === 'p') { if (!num(m.x) || !num(m.z) || !nav.walkable(m.x, m.z)) return; P.net = [m.x, m.z]; P.netYaw = num(m.y) ? m.y : null; P.focus = num(m.f) ? m.f : 0; }
    else if (m.t === 'i') { if (m.k === 'sp') useSpecialHost(P, m.dx, m.dz); else if (m.k === 'th') throwEggHost(P, m.dx, m.dz); else if (m.k === 'qz') quizBonusHost(P); else if (m.k === 'em' && EMOTES.has(m.e) && P.emoteT <= 0) { P.emoteT = C.emoteCooldown; ev(['em', slot, m.e]); } } }
  // 房客斷線：那一格改由 NPC 代打
  function toNpc(slot) { const P = G.players[slot]; if (!P || P.npc || P.local) return; P.npc = true; P.net = null; P.nick0 = P.nick; P.nick = (P.nick + '').slice(0, 16) + '（NPC 代打）'; retag(P); addLog(`${P.nick}`, 'bad'); emit('team'); }
  // 斷線的房客回來了：把那一格還給他
  function fromNpc(slot) { const P = G.players[slot]; if (!P || !P.npc || !P.nick0) return; P.npc = false; P.net = null; P.goal = null; P.nick = P.nick0; retag(P); addLog(`${P.nick} 回來了`, 'good'); emit('team'); }

  // ═══════════════ 自己的輸入 ═══════════════
  const meP = () => G.players[G.me];
  function setMove(x, z) { const P = meP(); if (!P) return; P.move.x = x; P.move.z = z; if (x || z) P.goal = null; }
  function moveTo(x, z) { const P = meP(); if (!P || P.down) return; const [px, pz] = nav.nearestWalkable(x, z, PL.radius); P.goal = [px, pz]; P.path = null; ring(px, pz, 0.28, 0xdb6a41, 2.2); if (goalMark) goalMark.userData.t = 0; } // 點地板：落點冒一圈波紋，目的地插一支標記，走到就收起來
  function focus(e) { const P = meP(); if (!P || !e) return; P.focus = e.id; ring(e.x, e.z, 0.35, 0xdb6a41, 3); }
  // 回傳要送給房主的指令（房客）；solo／房主直接執行
  function useSpecial(dx = 0, dz = 0) { const P = meP(); if (!P || P.down || P.sp <= 0 || G.phase !== 'wave') return null; if (!dx && !dz) { dx = Math.sin(P.w.yaw); dz = Math.cos(P.w.yaw); }
    if (G.role !== 'client') { useSpecialHost(P, dx, dz); return null; } const S = P.cfg.special; if (S.id === 'dash') { const L = Math.hypot(dx, dz) || 1; P.dash = { dx: dx / L, dz: dz / L, t: S.time, dist: S.dist, time: S.time }; } P.sp--; return { t: 'i', k: 'sp', dx: r2(dx) / 100, dz: r2(dz) / 100 }; }
  function throwEgg(dx = 0, dz = 0) { const P = meP(); if (!P || !P.carry || P.down) return null; if (G.role !== 'client') { throwEggHost(P, dx, dz); return null; } P.carry = false; return { t: 'i', k: 'th', dx: r2(dx) / 100, dz: r2(dz) / 100 }; }
  function emote(k) { const P = meP(); if (!P || !EMOTES.has(k)) return null; if (G.role !== 'client') { if (P.emoteT > 0) return null; P.emoteT = C.emoteCooldown; ev(['em', P.slot, k]); return null; } return { t: 'i', k: 'em', e: k }; }
  const myInput = () => { const P = meP(); return P && { t: 'p', x: r2(P.pos.x) / 100, z: r2(P.pos.z) / 100, y: r2(P.w.yaw) / 100, f: P.focus || 0 }; };

  // ═══════════════ 事件：產生（模擬端）與播放（兩邊）═══════════════
  function ev(v) { if (G.role === 'host') { G.out.push(v); if (G.out.length > 400) G.out.splice(0, 100); } playEvent(v); }
  const Pn = s => G.players[s];
  function playEvent(v) { const k = v[0];
    switch (k) {
      case 'shot': { const P = Pn(v[1]), e = enemyById.get(v[2]); if (P && e) proj(P, e); break; }
      case 'zap': { const P = Pn(v[1]); if (!P) break; let from = new V3(P.pos.x, Y + 0.45, P.pos.z); for (const id of v.slice(2, 14)) { const e = enemyById.get(id); if (!e) continue; const to = new V3(e.x, Y + 0.3, e.z); beam(from, to, P.cfg.color); from = to; } break; }
      case 'kill': { const [, , x, z, kind] = v; if (!num(x) || !num(z)) break; if (kind === 3) { puff(x / 100, z / 100, 0x9fcfd6, 0.35); break; } puff(x / 100, z / 100, kind === 1 ? 0xf2c14e : 0xfff8f4, kind === 1 ? 0.7 : 0.35); if (kind === 1) floatText('掉金蛋！', x / 100, Y + 1.0, z / 100, { bg: '#f2c14e' }); break; }
      case 'hurt': { const P = Pn(v[1]); if (!P || !num(v[2])) break; P.flash = 0.3; if (P.local) emit('hurt', v[2]); break; }
      case 'down': { const P = Pn(v[1]); if (!P) break; addLog(`${P.nick} 倒下了`, 'bad'); if (P.local) emit('banner', '你倒下了！等隊友過來救你', 2.5); else emit('hint', `${P.nick} 倒下了，靠過去就能救起來`); emit('team'); break; }
      case 'rev': { const P = Pn(v[1]), B = Pn(v[2]); if (!P) break; ring(P.pos.x, P.pos.z, 0.3, 0x7fa35e, 4); addLog(B ? `${B.nick} 救起 ${P.nick}` : `${P.nick} 回來了`, 'good'); emit('team'); break; }
      case 'pick': { const P = Pn(v[1]); if (P && P.local) emit('hint', '撿到金蛋！搬進金蛋籃（或按丟蛋）'); emit('team'); break; }
      case 'throw': emit('team'); break;
      case 'egg': { const P = Pn(v[1]); if (G.basket) { floatText('+1', G.basket.x, Y + 0.9, G.basket.z, { bg: '#f2c14e' }); ring(G.basket.x, G.basket.z, 0.4, 0xf2c14e, 3); if (basketObj) basketObj.userData.bounce = 0.3; } emit('hud'); emit('team'); break; }
      case 'warnc': { const [, x, z, r, ttl] = v; if ([x, z, r, ttl].every(num)) warnFx(1, x / 100, z / 100, r / 100, 0, 0, 0, ttl / 100); break; }
      case 'warnl': { const [, x, z, x2, z2, w, ttl] = v; if ([x, z, x2, z2, w, ttl].every(num)) warnFx(0, x / 100, z / 100, 0, x2 / 100, z2 / 100, w / 100, ttl / 100); break; }
      case 'boom': { const [, x, z, r] = v; if ([x, z, r].every(num)) { ring(x / 100, z / 100, Math.max(0.2, r / 100), 0xdb6a41, 5); puff(x / 100, z / 100, 0xfcea8b, r / 100); } break; }
      case 'laser': { const [, x, z, x2, z2] = v; if ([x, z, x2, z2].every(num)) laserFx(x / 100, z / 100, x2 / 100, z2 / 100); break; }
      case 'lob': { const [, x, z, x2, z2, t] = v; if ([x, z, x2, z2, t].every(num)) lobFx(x / 100, z / 100, x2 / 100, z2 / 100, t / 100); break; }
      case 'spit': { const [, x, z, dx, dz, sp, t] = v; if ([x, z, dx, dz, sp, t].every(num)) spitFx(x / 100, z / 100, dx / 100, dz / 100, sp / 100, t / 100); break; }
      case 'sp': { const P = Pn(v[1]); if (!P) break; const S = P.cfg.special, [, , x, z, dx, dz] = v; ring(P.pos.x, P.pos.z, 0.5, P.cfg.color, S.r ? S.r * 1.6 : 6); emit('banner', `${P.cfg.icon} ${P.nick}：${S.name}！`, 2); addLog(`${P.nick} 放了「${S.name}」`, 'good'); emit('team'); break; }
      case 'em': { const P = Pn(v[1]), E = EMOTES.get(v[2]); if (!P || !E) break; P.bubbleT = C.bubbleSeconds; emit('say', P.w, E.say, E.k); if (E.k === 'help') ring(P.pos.x, P.pos.z, 0.4, 0xdb6a41, 6); break; }
      case 'say': { const key = String(v[1]); if (!Object.hasOwn(MC.lines, key)) break; let a = v.slice(2, 4).map(x => num(x) ? x : ''); if (key === 'boss') a = [(C.animals[TYPES[v[2]]] || {}).name || '']; const txt = mayorSay(key, ...a); if (txt) { emit('banner', `📣 ${txt}`, 2.6); addLog(txt, key === 'fail' || key === 'timeup' ? 'bad' : 'good'); } break; }
      case 'boss': { const A = C.animals[TYPES[v[1]]]; if (!A || !A.boss) break; mayorSay('boss', A.name); emit('hint', `${A.name}：${A.desc}`); addLog(`${A.name}登場`, 'raid'); break; }
      case 'chant': { const e = enemyById.get(v[1]); if (!e || !e.obj) break; if (v[2] === -1) { animals.setChant(e.obj, null); break; } const t = chantText(e, v[2], v[3] | 0); if (!t) break; lastLine = t; animals.setChant(e.obj, t); break; }
      case 'rush': { const P = Pn(v[1]); if (P) { emit('banner', P.local ? '你被盯上了！快跑，把搗蛋鼠帶到隊友那邊！' : `${P.nick} 被盯上了！掩護他！`, 2.5); } break; }
      case 'qz': { const P = Pn(v[1]); if (!P) break; const n = v[2] | 0; addLog(`${P.nick} 答對了，金蛋 +${n}`, 'good'); if (P.local) emit('banner', `✏️ 答對！這一波金蛋 +${n}，血補滿`, 2.2); floatText(`+${n} 🥚`, P.pos.x, Y + 1.0, P.pos.z, { bg: '#f2c14e' }); mayorSay('quizOk', n); emit('hud'); emit('team'); break; }
      case 'wave': { const [, n, q, sp, iid] = v; if (G.role === 'client') { const iss = (ctx.issueById && ctx.issueById(String(iid))) || G.issues[0]; if (iss) G.issue = iss; G.special = SPECIALS[sp] || ''; } addLog(`第 ${n} 波・配額 ${q}${G.special ? '・' + (G.special === 'fog' ? '起大霧' : '搗蛋夜') : ''}${G.issue ? '・' + G.issue.tag : ''}`, 'good'); emit('wave', n); break; }
      case 'inter': for (const f of G.fx) if (f.warn) f.ttl = 0; emit('hud'); break;
      case 'end': emit('hud'); break;
    } }

  // ═══════════════ 畫面 ═══════════════
  const eggGeo = new THREE.SphereGeometry(0.5, 14, 10), eggMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.45, roughness: 0.28, emissive: 0x8a6400, emissiveIntensity: 0.35 });
  const mkEgg = () => { const m = new THREE.Mesh(eggGeo, eggMat); m.scale.set(0.12, 0.155, 0.12); m.castShadow = true; scene.add(m); return m; };
  let basketObj = null, spawnFx = [], focusRing = null, rushRing = null, goalMark = null;
  function buildBasket() { removeBasket(); const g = new THREE.Group(); const wick = new THREE.MeshStandardMaterial({ color: 0xc9a27c, roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: 0x9a7454, roughness: 0.9 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.3, 16, 1, true), wick); base.position.y = 0.15; base.material.side = THREE.DoubleSide; g.add(base);
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.03, 16), dark); bottom.position.y = 0.02; g.add(bottom);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 24), new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.4, roughness: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; g.add(rim);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.02), dark); s.position.set(Math.cos(a) * 0.3, 0.15, Math.sin(a) * 0.3); s.rotation.y = -a; g.add(s); }
    g.userData.eggs = []; for (let k = 0; k < 10; k++) { const m = new THREE.Mesh(eggGeo, eggMat); m.scale.set(0.1, 0.13, 0.1); const a = k * 2.4, r = 0.08 + (k % 3) * 0.06; m.position.set(Math.cos(a) * r, 0.22 + Math.floor(k / 4) * 0.06, Math.sin(a) * r); m.visible = false; g.add(m); g.userData.eggs.push(m); }
    const zone = new THREE.Mesh(new THREE.RingGeometry(EG.basketR - 0.05, EG.basketR, 48), new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide })); zone.rotation.x = -Math.PI / 2; zone.position.y = 0.02; g.add(zone);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(EG.basketR, 48), new THREE.MeshBasicMaterial({ color: 0xfcea8b, transparent: true, opacity: 0.22, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.015; g.add(fill);
    const sign = textSprite('金蛋籃', { bg: '#f2c14e', size: 0.3 }); sign.position.y = 0.75; g.add(sign);
    g.position.set(G.basket.x, TOP, G.basket.z); scene.add(g); basketObj = g;
    for (const s of G.spawns) { const m = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 32), new THREE.MeshBasicMaterial({ color: 0xdb6a41, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(s.wx, TOP - 0.8, s.wz); scene.add(m); spawnFx.push(m); }
    focusRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.34, 32), new THREE.MeshBasicMaterial({ color: 0xdb6a41, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); focusRing.rotation.x = -Math.PI / 2; focusRing.visible = false; focusRing.renderOrder = 3; scene.add(focusRing);
    rushRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0x4ad6c8, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); rushRing.rotation.x = -Math.PI / 2; rushRing.visible = false; scene.add(rushRing);
    // 走路目的地標記：地上一圈＋一支往下指的珊瑚色標記（不被建築擋住）
    goalMark = new THREE.Group(); const gm = new THREE.MeshBasicMaterial({ color: 0xdb6a41, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false, side: THREE.DoubleSide }); const gr = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.18, 32), gm); gr.rotation.x = -Math.PI / 2; gr.position.y = 0.03; const pin = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 12), new THREE.MeshBasicMaterial({ color: 0xdb6a41, depthTest: false, transparent: true })); pin.rotation.x = Math.PI; pin.position.y = 0.3; const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), pin.material); knob.position.y = 0.4;
    goalMark.add(gr, pin, knob); for (const m of [gr, pin, knob]) m.renderOrder = 11; goalMark.userData = { ring: gr, pin, knob, t: 0 }; goalMark.visible = false; scene.add(goalMark); }
  function removeBasket() { if (basketObj) scene.remove(basketObj); basketObj = null; for (const m of spawnFx) scene.remove(m); spawnFx = []; for (const o of [focusRing, rushRing, goalMark]) if (o) scene.remove(o); focusRing = rushRing = goalMark = null; }
  function makeEnemyMesh(e) { e.obj = animals.spawn(e.type); e.obj.userData.hit.userData.enemy = e; enemyHits.push(e.obj.userData.hit); e.obj.position.set(e.x, Y, e.z); }
  function dropEnemyMesh(e) { if (!e.obj) return; animals.remove(e.obj); const i = enemyHits.indexOf(e.obj.userData.hit); if (i >= 0) enemyHits.splice(i, 1); e.obj = null; }
  function ring(x, z, r, color, grow) { const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, TOP + 0.06, z); scene.add(m); G.fx.push({ obj: m, ttl: 1.0, grow }); }
  function puff(x, z, color, r) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false })); m.position.set(x, Y + 0.2, z); m.scale.setScalar(Math.max(0.15, r)); scene.add(m); G.fx.push({ obj: m, ttl: 0.45, grow: 2.5, fade: 1.6 }); }
  // 子彈與打擊效果：發光的子彈（外圈加一層加法混合的光暈）、粗的電擊光束、打中時冒火花
  const fxMats = new Map(); const fxMat = (color, glow) => { const k = color + (glow ? 'g' : ''); if (!fxMats.has(k)) { const m = new THREE.MeshBasicMaterial(glow ? { color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false } : { color }); m.userData.keep = true; fxMats.set(k, m); } return fxMats.get(k); };
  const beamGeo = new THREE.BoxGeometry(1, 1, 1);
  function beam(a, b, color, ttl = 0.26) { const L = a.distanceTo(b), g = new THREE.Group(); const core = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfffbe8, transparent: true, opacity: 1 })); core.scale.set(0.035, 0.035, L); const glow = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.set(0.11, 0.11, L); g.add(core, glow);
    g.position.copy(a).lerp(b, 0.5); g.lookAt(b); scene.add(g); G.fx.push({ obj: g, ttl, beam: [core.material, glow.material], total: ttl }); spark(b.x, b.z, color, b.y); }
  const projGeo = new THREE.SphereGeometry(0.085, 10, 8), haloGeo = new THREE.SphereGeometry(0.17, 10, 8), busGeo = new THREE.BoxGeometry(0.24, 0.12, 0.12);
  function proj(P, e) { const T = P.cfg, col = T.style === 'water' ? 0x66c6ff : T.style === 'ball' ? 0xfff3c4 : T.color; const m = new THREE.Mesh(T.style === 'bus' ? busGeo : projGeo, fxMat(col)); m.add(new THREE.Mesh(haloGeo, fxMat(T.style === 'water' ? 0x66c6ff : T.color, true))); const from = new V3(P.pos.x, Y + 0.45, P.pos.z); m.position.copy(from); scene.add(m); G.fx.push({ obj: m, ttl: 0.6, proj: { from, e, x: e.x, z: e.z, t: 0, col: T.style === 'water' ? 0x66c6ff : T.color, dur: Math.max(0.06, from.distanceTo(new V3(e.x, Y + 0.3, e.z)) / SH.projSpeed) } }); }
  const sparkGeo = new THREE.SphereGeometry(0.5, 8, 6); for (const g of [beamGeo, projGeo, haloGeo, busGeo, sparkGeo]) g.userData.keep = true;
  function spark(x, z, color, y = Y + 0.3) { const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.set(x, y, z); m.scale.setScalar(0.12); scene.add(m); G.fx.push({ obj: m, ttl: 0.22, grow: 2.2, fade: 4 }); }
  function warnFx(circle, x, z, r, x2, z2, w, ttl) { const mat = new THREE.MeshBasicMaterial({ color: 0xd9412b, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }), edge = new THREE.MeshBasicMaterial({ color: 0xd9412b, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }); const g = new THREE.Group(); let fill;
    if (circle) { const a = new THREE.Mesh(new THREE.CircleGeometry(r, 40), mat); fill = new THREE.Mesh(new THREE.CircleGeometry(r, 40), mat.clone()); fill.material.opacity = 0.35; const e = new THREE.Mesh(new THREE.RingGeometry(r - 0.04, r, 40), edge); for (const m of [a, fill, e]) { m.rotation.x = -Math.PI / 2; g.add(m); } g.position.set(x, TOP + 0.05, z); fill.scale.setScalar(0.01); }
    else { const L = Math.hypot(x2 - x, z2 - z), yaw = Math.atan2(x2 - x, z2 - z); const geo = new THREE.PlaneGeometry(w, L); geo.translate(0, L / 2, 0); geo.rotateX(-Math.PI / 2); geo.scale(1, 1, -1); const a = new THREE.Mesh(geo, mat); fill = new THREE.Mesh(geo, mat.clone()); fill.material.opacity = 0.35; g.add(a, fill); const b1 = new THREE.Mesh(new THREE.PlaneGeometry(0.03, L).translate(0, L / 2, 0).rotateX(-Math.PI / 2).scale(1, 1, -1), edge); b1.position.x = w / 2; const b2 = b1.clone(); b2.position.x = -w / 2; g.add(b1, b2); g.position.set(x, TOP + 0.05, z); g.rotation.y = yaw; fill.scale.set(1, 1, 0.01); }
    g.renderOrder = 2; scene.add(g); G.fx.push({ obj: g, ttl, warn: { fill, circle, total: ttl } }); }
  function laserFx(x, z, x2, z2) { const L = Math.hypot(x2 - x, z2 - z), m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, L), new THREE.MeshBasicMaterial({ color: 0x4ad6c8, transparent: true, opacity: 0.95 })); m.position.set((x + x2) / 2, Y + 0.35, (z + z2) / 2); m.rotation.y = Math.atan2(x2 - x, z2 - z); scene.add(m); G.fx.push({ obj: m, ttl: 0.35, fade: 3 }); }
  function lobFx(x, z, x2, z2, t) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: 0xfff8f4 })); scene.add(m); G.fx.push({ obj: m, ttl: t, lob: { x, z, x2, z2, t: 0, dur: Math.max(0.3, t * 0.6) } }); }
  function spitFx(x, z, dx, dz, sp, t) { const m = new THREE.Mesh(projGeo, new THREE.MeshBasicMaterial({ color: 0x8bd35a })); m.scale.setScalar(1.8); m.position.set(x, Y + 0.45, z); scene.add(m); G.fx.push({ obj: m, ttl: t, vel: [dx * sp, dz * sp] }); }
  const playerExtras = P => { if (!P.eggObj) { P.eggObj = mkEgg(); P.eggObj.visible = false; } if (!P.buoy) { P.buoy = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 20), new THREE.MeshStandardMaterial({ color: 0xff7a3d, roughness: 0.5 })); P.buoy.rotation.x = Math.PI / 2; P.buoy.visible = false; scene.add(P.buoy); } };
  // 每幀：房客把位置往快照的目標平滑靠過去；兩邊都在這裡擺網格、播特效
  function view(raw, time, zoom = 1) { if (G.phase === 'lobby') { updateFx(raw); return; } const client = G.role === 'client', k = Math.min(1, raw * C.net.smooth);
    for (const e of G.enemies) { if (e.dead) continue; if (!e.obj) makeEnemyMesh(e); const A = e.A;
      if (client && num(e.tx)) { const dx = e.tx - e.x, dz = e.tz - e.z; if (Math.hypot(dx, dz) > 3) { e.x = e.tx; e.z = e.tz; } else { e.x += dx * k; e.z += dz * k; } e.moving = Math.hypot(dx, dz) > 0.02; let dy = e.tyaw - e.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); e.yaw += dy * k; if (e.flags & 4) { e.airT += raw; e.air = Math.sin(Math.min(1, e.airT / (A.air || 0.5)) * Math.PI); } else e.air = 0; }
      const fl = client ? e.flags : eflags(e); e.wing += raw * (A.model === 'mouse' ? 22 : 12); if (A.hop && (e.moving || fl & 4)) e.hopT += raw * A.speed * 1.6;
      e.obj.position.set(e.x, Y + (e.air || 0) * 0.9 - (fl & 64 ? 0.12 : 0), e.z); e.obj.rotation.y = e.yaw - Math.PI / 2; e.obj.scale.setScalar(zoom * (fl & 2 ? 1 + Math.sin(time * 24) * 0.05 : 1) * (fl & 32 ? 1.14 : 1)); // 被打到時抖大一下
      animals.animate(e.obj, e, raw, time); animals.setHp(e.obj, client ? (e.hpf ?? 1) : Math.max(0, e.hp / e.maxHp));
      animals.setState(e.obj, { stun: fl & 1, bomb: fl & 8, stealth: A.stealth ? 0.25 + 0.75 * Math.abs(Math.sin(time * 1.3 + e.seed * 6)) : null, aim: fl & 2 }, time); }
    for (const g of G.eggs) { if (!g.obj) g.obj = mkEgg(); if (client && num(g.tx)) { const dx = g.tx - g.x, dz = g.tz - g.z; if (Math.hypot(dx, dz) > 3) { g.x = g.tx; g.z = g.tz; } else { g.x += dx * k; g.z += dz * k; } g.y = lerp(g.y, g.ty, k); }
      g.obj.position.set(g.x, Y + 0.12 + (g.y || 0) + (g.y ? 0 : Math.abs(Math.sin(time * 3 + g.id)) * 0.04), g.z); g.obj.rotation.y = time * 1.5 + g.id; }
    if (basketObj) { const n = Math.min(10, G.gold); basketObj.userData.eggs.forEach((m, i) => { m.visible = i < n; }); const b = basketObj.userData.bounce || 0; basketObj.scale.setScalar(1 + Math.max(0, b) * 0.4); basketObj.userData.bounce = b - raw; }
    for (const m of spawnFx) { const s = 1 + (time * 0.8 % 1) * 1.2; m.scale.setScalar(s); m.material.opacity = 0.55 * (1 - (time * 0.8 % 1)); m.position.y = -0.17; }
    const me = meP();
    for (const P of G.players) { playerExtras(P); const w = P.w;
      if (client && !P.local && num(P.tx)) { const dx = P.tx - P.pos.x, dz = P.tz - P.pos.z, d = Math.hypot(dx, dz); if (d > 3) { P.pos.x = P.tx; P.pos.z = P.tz; } else { P.pos.x += dx * k; P.pos.z += dz * k; } w.moving = d > 0.03 && !P.down; if (num(P.tyaw)) { let dy = P.tyaw - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); w.yaw += dy * k; } }
      w.down = P.down; w.pose = P.down ? null : P.firing && !w.moving ? 'fight' : (G.phase === 'result' || G.phase === 'inter') && !w.moving ? 'wave' : null;
      P.eggObj.visible = P.carry && !P.down; if (P.eggObj.visible) P.eggObj.position.set(P.pos.x, P.pos.y + 0.7 * zoom, P.pos.z);
      P.buoy.visible = P.down; if (P.down) { P.buoy.position.set(P.pos.x, P.pos.y + 0.08, P.pos.z); P.buoy.rotation.z = time * 2; P.buoy.scale.setScalar(1 + (P.revive / PL.reviveTime) * 0.5); }
      if (P.bubbleT > 0) { P.bubbleT -= raw; if (P.bubbleT <= 0) emit('say', w, null); }
      if (P.flash > 0) P.flash -= raw;
      const sig = `${Math.round(P.hp / 5)}|${P.down ? 1 : 0}|${P.carry ? 1 : 0}|${Math.round(P.revive * 10)}|${P.flash > 0 ? 1 : 0}`; if (sig !== P.tagSig) { P.tagSig = sig; emit('tagState', w, { hp: P.hp / PL.hp, down: P.down, carry: P.carry, revive: P.revive / PL.reviveTime, hit: P.flash > 0 }); } }
    const fe = me && me.focus && enemyById.get(me.focus); if (focusRing) { focusRing.visible = !!(fe && fe.obj && !fe.dead); if (focusRing.visible) { focusRing.position.set(fe.x, TOP + 0.05, fe.z); focusRing.scale.setScalar((0.9 + fe.A.size * 0.6) * (1 + Math.sin(time * 6) * 0.06)); } }
    if (goalMark) { const on = !!(me && me.goal && !me.down); goalMark.visible = on; if (on) { const u = goalMark.userData; u.t += raw; goalMark.position.set(me.goal[0], TOP, me.goal[1]); u.knob.position.y = 0.42 + Math.abs(Math.sin(time * 4)) * 0.08; u.pin.position.y = u.knob.position.y - 0.1; u.ring.scale.setScalar(1 + Math.sin(time * 5) * 0.12); goalMark.scale.setScalar(Math.min(1, 0.4 + u.t * 4) * zoom); } }
    const rt = G.special === 'rush' && Pn(G.rushTarget); if (rushRing) { rushRing.visible = !!rt; if (rt) { rushRing.position.set(rt.pos.x, TOP + 0.05, rt.pos.z); rushRing.scale.setScalar(1 + Math.sin(time * 8) * 0.15); } }
    updateFx(raw); }
  function updateFx(raw) { for (const f of G.fx) { f.ttl -= raw;
      if (f.proj) { const p = f.proj; p.t += raw; const e = p.e, tx = e && !e.dead ? e.x : p.x, tz = e && !e.dead ? e.z : p.z; p.x = tx; p.z = tz; const kk = Math.min(1, p.t / p.dur); f.obj.position.lerpVectors(p.from, new V3(tx, Y + 0.3, tz), kk); if (kk >= 1) { f.ttl = 0; spark(tx, tz, p.col); } }
      else if (f.beam) { const k = Math.max(0, f.ttl / f.total); f.beam[0].opacity = k; f.beam[1].opacity = 0.6 * k; }
      else if (f.lob) { const L = f.lob; L.t += raw; const kk = Math.min(1, L.t / L.dur); f.obj.position.set(lerp(L.x, L.x2, kk), Y + 0.8 + Math.sin(kk * Math.PI) * 1.2 - kk * 0.7, lerp(L.z, L.z2, kk)); f.obj.rotation.z += raw * 8; if (kk >= 1) f.obj.visible = false; }
      else if (f.vel) { f.obj.position.x += f.vel[0] * raw; f.obj.position.z += f.vel[1] * raw; }
      else if (f.warn) { const W = f.warn, kk = 1 - Math.max(0, f.ttl) / W.total; if (W.circle) W.fill.scale.setScalar(Math.max(0.01, kk)); else W.fill.scale.set(1, 1, Math.max(0.01, kk)); }
      else { if (f.rise) f.obj.position.y += raw * f.rise; if (f.grow) f.obj.scale.addScalar(f.grow * raw); if (f.obj.material) f.obj.material.opacity = Math.max(0, Math.min(1, f.ttl * (f.fade || 1))); }
      if (f.ttl <= 0) { scene.remove(f.obj); f.obj.traverse(o => { if (o.geometry && !o.isSprite && !o.geometry.userData.keep) o.geometry.dispose(); if (o.material && !o.material.userData.keep) o.material.dispose(); }); } } // 用完的特效釋放 GPU 資源（共用的幾何與材質留著）
    G.fx = G.fx.filter(f => f.ttl > 0); }
  const onPick = hit => { if (G.phase === 'lobby' || G.phase === 'result') return false; if (hit.enemy && !hit.enemy.dead) { focus(hit.enemy); return true; } if (hit.point) { moveTo(hit.point.x, hit.point.z); return true; } return false; };
  return { G, spawnResidents, spawnMayor, setStops, mayorStops: () => stops, startShift, backToLobby, abort, toNpc, fromNpc, step, view, makeSnapshot, applySnapshot, applyResult, remoteInput, myInput,
    setMove, moveTo, focus, useSpecial, throwEgg, emote, quizBonus, onPick, enemyHits, enemyById, rebuildPeople, setExtraWalkers, shout, me: meP, quotaFor,
    debugSpawn: type => G.phase === 'wave' && C.animals[type] && G.role !== 'client' ? spawnEnemy(type, randomSpawn()) : null }; // 除錯／測試用
}
