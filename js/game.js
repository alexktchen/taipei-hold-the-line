/* 一場（約 3 分鐘）：敵人沿步道與橋走向市政核心；居民自動走過去勸退；英雄由玩家點島移動並自動攻擊；保證守住。 */
import * as THREE from 'three';
import { CONFIG as C } from './config.js';
import { TOP, makeRoute, sampleRoute } from './islands.js';
const RC = C.round, RS = C.residents;
export function createGame(ctx) {
  const { scene, graph, centers, people, animals, islands, colors } = ctx; const cb = ctx.callbacks; const emit = (k, ...a) => cb[k] && cb[k](...a);
  const goalIsland = islands.find(i => i.goal); const goalCenter = centers.get(goalIsland.id);
  const G = { phase: 'lobby', t: 0, approval: 100, enemies: [], projs: [], beams: [], floats: [], rings: [], queue: [], issue: null, hero: null, residents: [], kills: 0, leaked: 0, raids: 0, waveNo: 1, raidT: 0, windT: 0, windLeft: 0, surgeT: 0, surges: 0, final: false, log: [], spawnedTotal: 0, ultCd: 0, focusCd: 0, paused: false, speed: 1, auto: true };
  const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  let eid = 0; const enemyHits = [];
  // ── 文字貼圖 ──
  const texCache = new Map();
  function textSprite(txt, { bg = '#fff8f4', fg = '#211d1d', size = 0.5 } = {}) { const key = txt + bg + fg; let tex = texCache.get(key); if (!tex) { const cv = document.createElement('canvas'); const g = cv.getContext('2d'); const font = '900 40px "Noto Sans TC", sans-serif'; g.font = font; const tw = Math.ceil(g.measureText(txt).width); cv.width = tw + 36; cv.height = 60; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.beginPath(); g.roundRect(2, 2, cv.width - 4, cv.height - 4, 14); g.fillStyle = bg; g.fill(); g.fillStyle = fg; g.fillText(txt, cv.width / 2, cv.height / 2 + 1); tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.userData = { w: cv.width, h: cv.height }; texCache.set(key, tex); } const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(size * tex.userData.w / tex.userData.h, size, 1); sp.renderOrder = 12; return sp; }
  function floatText(txt, x, y, z, opt) { const sp = textSprite(txt, opt); sp.position.set(x, y, z); scene.add(sp); G.floats.push({ obj: sp, ttl: 1.1 }); }
  function addLog(txt, cls = '') { const m = Math.floor(G.t / 60), s = Math.floor(G.t % 60); G.log.unshift({ t: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, txt, cls }); G.log.length = Math.min(G.log.length, C.ui.logMax); emit('log', G.log); }
  // ── 居民 ──
  function spawnResidents() {
    const list = []; let seed = 1;
    for (const isl of islands) { const ring = graph.ringIndex.get(isl.id); for (let k = 0; k < RS.perIsland; k++) { const node = ring[(k * 5 + isl.number) % 12]; const role = RS.roles[(isl.number * 3 + k) % RS.roles.length]; const w = people.makeWalker(role, graph.nodes[node].p); w.home = isl.id; w.node = node; w.state = 'idle'; w.wait = Math.random() * 2; w.route = null; w.s = 0; w.target = null; w.seed = seed++; list.push(w); } }
    G.residents = list; return list;
  }
  const ev = e => new THREE.Vector3(e.x, TOP + 0.03, e.z);
  function routeTo(fromPos, toNode) { const a = graph.nearestNode(fromPos); const ids = graph.shortest(a, toNode); const pts = [fromPos.clone(), ...ids.map(n => graph.nodes[n].p.clone())]; return makeRoute(pts); }
  function walk(w, dt, speed) { if (!w.route) return true; w.s += speed * dt; const done = w.s >= w.route.total; const smp = sampleRoute(w.route, Math.min(w.s, w.route.total)); w.pos.copy(smp.p); if (smp.dir.lengthSq() > 0) w.yaw = Math.atan2(smp.dir.x, smp.dir.z); w.moving = !done; if (done) { w.route = null; w.moving = false; } return done; }
  function updateResidents(dt) {
    const targets = new Map();
    for (const w of G.residents) {
      if ((w.state === 'idle' || w.state === 'home') && w.cheer > 0 && !(G.phase === 'round' && G.enemies.length)) { w.cheer -= dt; w.pose = w.cheer > 0 ? 'wave' : null; w.moving = false; continue; }
      if (w.state === 'idle' || w.state === 'home') {
        if (G.phase === 'round' && G.enemies.length) { let best = null, bd = RS.engageRadius; for (const e of G.enemies) { if (e.dead) continue; const n = targets.get(e) || e.defenders || 0; if (n >= RS.maxPerTarget) continue; const d = d2(e, w.pos); if (d < bd) { bd = d; best = e; } } if (best) { best.defenders = (best.defenders || 0) + 1; w.target = best; w.state = 'engage'; w.route = routeTo(w.pos, graph.nearestNode(ev(best))); w.s = 0; w.pose = null; continue; } }
        if (w.route) { walk(w, dt, RS.speed); } else { w.wait -= dt; if (w.wait <= 0) { const ring = graph.ringIndex.get(w.home); const next = ring[(ring.indexOf(w.node) + (Math.random() < 0.5 ? 1 : 11)) % 12]; w.route = makeRoute([w.pos.clone(), graph.nodes[next].p.clone()]); w.s = 0; w.node = next; w.wait = 1 + Math.random() * 3; w.state = 'idle'; } }
      } else if (w.state === 'engage') {
        const e = w.target; if (!e || e.dead) { release(w); continue; }
        const d = d2(e, w.pos);
        if (d <= RS.meleeRange + 0.05) { w.state = 'fight'; w.pose = 'fight'; w.moving = false; w.route = null; w.yaw = Math.atan2(e.x - w.pos.x, e.z - w.pos.z); }
        else if (w.route) { if (walk(w, dt, RS.speed)) w.route = null; }
        else { const v = RS.speed * dt; const dx = e.x - w.pos.x, dz = e.z - w.pos.z, L = Math.hypot(dx, dz) || 1; w.reroute = (w.reroute || 0) - dt; if (d > 1.2 && w.reroute <= 0) { w.route = routeTo(w.pos, graph.nearestNode(ev(e))); w.s = 0; w.reroute = 0.7; } else { w.pos.x += dx / L * v; w.pos.z += dz / L * v; w.pos.y = TOP + 0.03; w.yaw = Math.atan2(dx, dz); w.moving = true; } }
      } else if (w.state === 'fight') {
        const e = w.target; if (!e || e.dead || d2(e, w.pos) > RS.meleeRange + 0.35) { if (e && !e.dead) { w.state = 'engage'; w.pose = null; } else release(w); continue; }
        const rally = G.hero && G.hero.cfg.rally && d2(G.hero.pos, w.pos) < 2 ? G.hero.cfg.rally : 1; damage(e, RS.dps * rally * dt, w);
      }
    }
  }
  function release(w) { if (w.target) w.target.defenders = Math.max(0, (w.target.defenders || 0) - 1); w.target = null; w.pose = null; w.state = 'home'; const ring = graph.ringIndex.get(w.home); w.node = ring[Math.floor(Math.random() * 12)]; w.route = routeTo(w.pos, w.node); w.s = 0; }
  // ── 市長 NPC：依行政區順序巡迴每棟政策建築，站上宣傳台講政績 ──
  const MC = C.mayor; let stops = [];
  function setStops(list) { stops = [...list].sort((a, b) => a.order - b.order || a.pos.x - b.pos.x); if (G.mayor && G.mayor.stop >= stops.length) G.mayor.stop = 0; }
  function spawnMayor() { const m = people.makeWalker('mayor', goalCenter.clone().add(new THREE.Vector3(0.6, 0.03, 1.0))); m.stop = 0; m.wait = 2; m.route = null; m.s = 0; m.state = 'walk'; m.yaw = 0;
    tagAdd(m, MC.name.replace(/市長$/, ''), '🎙 市長', '#db6a41', 'mayor');
    m.hit = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ visible: false })); scene.add(m.hit); G.mayor = m; return m; }
  // 名牌交給 main.js 畫成 DOM 標籤（清楚、不隨距離縮小）。「🎙 市長」徽章只給市長；玩家徽章是英雄圖示＋職業，用英雄代表色
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const tagAdd = (w, name, badge, color, kind) => emit('tag', 'add', w, { name, badge, color, kind }); const tagDel = w => emit('tag', 'remove', w);
  // 每次巡迴到同一棟輪流講摘要與前幾條細項；標題加上去太長就只講那一句
  const sayCount = new Map();
  function slogan(pol) { const lines = [String(pol.summary || '').split(/[，。、；]/)[0], ...(pol.facts || []).slice(0, MC.sayFacts)].filter(Boolean); const n = sayCount.get(pol.id) || 0; sayCount.set(pol.id, n + 1); const line = lines.length ? lines[n % lines.length] : '';
    let t = `${pol.title}！${line}`; if (t.length > MC.sloganMax) t = line; return t.length > MC.sloganMax ? t.slice(0, MC.sloganMax) + '…' : t; }
  function setBubble(m, txt) { emit('say', m, txt ? '📣 ' + txt : null); }
  function updateMayor(dt, zoom = 1) { const m = G.mayor; if (!m || !stops.length) return;
    if (m.state === 'walk') { if (!m.route) { m.wait -= dt; if (m.wait > 0) return; const st = stops[m.stop % stops.length]; const node = graph.nodeNear(st.island, st.pos); const np = graph.nodes[node].p; const front = np.clone().lerp(st.pos.clone().setY(np.y), MC.approach); m.route = makeRoute([m.pos.clone(), ...routeTo(m.pos, node).pts.slice(1), front]); m.s = 0; m.onBox = false; m.pose = null; }
      if (walk(m, dt, MC.speed)) { const st = stops[m.stop % stops.length]; m.state = 'speech'; m.speechT = MC.speechSeconds; m.onBox = true; m.pose = 'wave'; m.yaw = Math.atan2(st.pos.x - m.pos.x, st.pos.z - m.pos.z) + Math.PI; setBubble(m, slogan(st.pol)); m.current = st;
        const dn = (islands.find(i => i.id === st.island) || {}).name || ''; addLog(`${MC.name}在${dn}宣傳「${st.pol.title}」`, 'good');
        if (G.phase === 'round') { G.approval = Math.min(RC.startApproval, G.approval + MC.approvalPerSpeech); floatText(`+${MC.approvalPerSpeech}% 滿意度`, m.pos.x, TOP + 1.1, m.pos.z, { bg: '#fcea8b' }); emit('hud'); }
        for (const w of G.residents) if ((w.state === 'idle' || w.state === 'home') && d2(w.pos, m.pos) < MC.cheerRadius) { w.cheer = MC.speechSeconds; w.yaw = Math.atan2(m.pos.x - w.pos.x, m.pos.z - w.pos.z); } } }
    else if (m.state === 'speech') { m.speechT -= dt; if (m.speechT <= 0) { m.state = 'walk'; m.onBox = false; m.pose = null; m.stop = (m.stop + 1) % stops.length; m.wait = MC.pauseSeconds; setBubble(m, null); } }
    m.hit.position.set(m.pos.x, m.pos.y + 0.3, m.pos.z);
  }
  // ── 一場 ──
  function startRound(issue, hero, waveNo, isFinal) {
    clearRound(); Object.assign(G, { phase: 'round', t: 0, approval: RC.startApproval, issue, waveNo, final: !!isFinal, kills: 0, leaked: 0, raids: 0, surges: 0, spawnedTotal: 0, speed: 1, paused: false, windLeft: 0, surgeT: 0, log: [], ultCd: 0, focusCd: 0, nextSpawn: 0, chantGap: 0 }); lastLine = '';
    // 有選 12 區對抗的區就從那座島的步道出發，沒選就從市政府
    const home = hero.district && centers.get(hero.district); const start = home ? graph.nodes[graph.nodeNear(hero.district, home)].p.clone().setY(goalCenter.y + 0.03) : goalCenter.clone().add(new THREE.Vector3(0, 0.03, 1.1));
    const hw = people.makeWalker('citizen', start, hero.cls); hw.pose = 'wave'; hw.nick = hero.nick; hw.district = hero.district || null; hw.cfg = C.heroes[hero.cls]; hw.cls = hero.cls; hw.cd = 0; hw.route = null; hw.s = 0;
    tagAdd(hw, hero.nick || hw.cfg.name, `${hw.cfg.icon} 你`, hex(hw.cfg.color), 'me'); G.hero = hw;
    rebuildPeople();
    buildSchedule(issue); G.raidT = RC.raid.minGap + Math.random() * (RC.raid.maxGap - RC.raid.minGap); G.windT = RC.windShift.minGap + Math.random() * (RC.windShift.maxGap - RC.windShift.minGap);
    addLog(`第 ${waveNo} 波開始：${issue.tag}「${issue.title}」，${G.queue.length} 隻從 ${issue.routes.map(r => C.landings[r].name).join('、')} 登陸`, G.final ? 'bad' : '');
    if (G.final) emit('banner', '⚠ 大選前夜總攻擊：四面八方全軍出動', 4);
    emit('hud'); emit('log', G.log); emit('hero');
  }
  function buildSchedule(issue) { const total = Math.round(RC.baseSpawn * (issue.intensity || 1)); const types = Object.keys(issue.mix), wsum = Object.values(issue.mix).reduce((a, b) => a + b, 0); const pick = () => { let r = Math.random() * wsum; for (const t of types) { r -= issue.mix[t]; if (r <= 0) return t; } return types[0]; }; let ri = 0; const route = () => issue.routes[(ri++) % issue.routes.length]; G.queue = [];
    for (const b of RC.bursts) { const n = Math.round(total * b.share); for (let i = 0; i < n; i++) G.queue.push({ t: b.from + Math.random() * (b.to - b.from), type: pick(), path: route() }); }
    if (issue.boss) G.queue.push({ t: RC.bossAt, type: issue.boss, path: issue.routes[0] }); if (issue.boss2) G.queue.push({ t: RC.bossAt + 6, type: issue.boss2, path: issue.routes[issue.routes.length - 1] }); G.queue.sort((a, b) => a.t - b.t); }
  function clearRound() { for (const e of G.enemies) animals.remove(e.obj); for (const p of G.projs) scene.remove(p.obj); for (const b of G.beams) scene.remove(b.obj); for (const f of G.floats) scene.remove(f.obj); for (const r of G.rings) scene.remove(r.obj); if (G.hero) tagDel(G.hero); if (G.hero) G.hero.bubbleT = 0; G.enemies = []; G.projs = []; G.beams = []; G.floats = []; G.rings = []; G.queue = []; enemyHits.length = 0; for (const w of G.residents) { w.target = null; if (w.state !== 'idle') { w.state = 'home'; w.pose = null; w.route = null; } } }
  function endRound() { G.phase = 'result'; const res = { waveNo: G.waveNo, kills: G.kills, leaked: G.leaked, approval: Math.round(G.approval), raids: G.raids, surges: G.surges, issueId: G.issue.id, issueTitle: G.issue.title, tag: G.issue.tag, final: G.final, hero: { nick: G.hero.nick, cls: G.hero.cls, district: G.hero.district || null } }; addLog(`第 ${G.waveNo} 波守住了。擊退 ${G.kills} 隻，滿意度 ${res.approval}%`, 'good'); if (G.hero) G.hero.pose = 'wave'; emit('end', res); }
  function backToLobby() { clearRound(); G.phase = 'lobby'; G.hero = null; rebuildPeople(); emit('hud'); emit('hero'); }
  // ── 敵人 ──
  function landingRoute(routeId) { const land = C.landings[routeId]; const lc = centers.get(land.island); const away = lc.clone().sub(goalCenter).setY(0).normalize(); const ring = graph.ringIndex.get(land.island); let best = ring[0], bd = -1e9; for (const n of ring) { const d = graph.nodes[n].p.clone().sub(lc).dot(away); if (d > bd) { bd = d; best = n; } } const goalNode = graph.nodeNear(goalIsland.id, graph.nodes[best].p); const ids = graph.shortest(best, goalNode); const start = graph.nodes[best].p.clone().add(away.clone().multiplyScalar(2.6)); start.y = TOP + 0.03; return makeRoute([start, ...ids.map(n => graph.nodes[n].p.clone()), goalCenter.clone().setY(TOP + 0.03)]); }
  const routeCache = {};
  function spawn(type, routeId) { const A = C.animals[type]; const route = routeCache[routeId] || (routeCache[routeId] = landingRoute(routeId)); const e = { id: ++eid, type, route, routeId, hp: A.hp, maxHp: A.hp, s: 0, x: route.pts[0].x, z: route.pts[0].z, slow: 0, slowT: 0, speedMul: 1, hairT: 0, chant: null, chantT: 0, restT: 0, spoke: false, wing: Math.random() * 6, hopT: Math.random(), seed: Math.random(), spawnT: 0, prog: 0, lateral: (Math.random() - 0.5) * 0.16, obj: animals.spawn(type), dead: false, defenders: 0 };
    e.obj.userData.hit.userData.enemy = e; enemyHits.push(e.obj.userData.hit); e.obj.position.set(e.x, TOP + 0.03, e.z); G.enemies.push(e); G.spawnedTotal++;
    if (A.boss) { emit('banner', `${A.name} 從${C.landings[routeId].name}登陸了！`, 3); addLog(`${A.name}從${C.landings[routeId].name}方向登陸`, 'bad'); } return e; }
  // 頭上對話：同時最多 chantMax 句、每句至少隔 chantEvery 秒；剛登陸還沒講過的先講（魔王優先），講完休息 chantRest 秒
  // 台詞用洗牌的牌堆依序抽，整副抽完才重洗，每句梗都輪得到；鸚鵡會把上一句複製一次再加 +1
  const decks = new Map(); let lastLine = '';
  function draw(key, list) { let d = decks.get(key); if (!d || !d.length) { d = [...list]; for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } decks.set(key, d); } return d.pop(); }
  function lineFor(e) { const A = C.animals[e.type]; if (A.repeat && lastLine && lastLine.length <= RC.chantCopyMax && Math.random() < 0.6) return lastLine.replace(/[!！]+$/, '') + '+1';
    return Math.random() < RC.chantIssueShare ? draw('issue:' + G.issue.id, G.issue.chants) : draw('animal:' + e.type, A.chants); }
  function updateChants(dt) { let talking = 0; G.chantGap -= dt;
    for (const e of G.enemies) { if (e.chant) { e.chantT -= dt; if (e.chantT <= 0) { e.chant = null; e.restT = RC.chantRest; animals.setChant(e.obj, null); } else talking++; } else if (e.restT > 0) e.restT -= dt; }
    if (talking >= RC.chantMax || G.chantGap > 0) return;
    let best = null, bestScore = -1; for (const e of G.enemies) { if (e.dead || e.chant || e.restT > 0) continue; const score = (e.spoke ? 0 : 2) + (C.animals[e.type].boss ? 3 : 0) + Math.random(); if (score > bestScore) { best = e; bestScore = score; } }
    if (!best) return; best.chant = lineFor(best); best.chantT = RC.chantOn; best.spoke = true; lastLine = best.chant; G.chantGap = RC.chantEvery; animals.setChant(best.obj, best.chant); }
  function damage(e, amt, by) { if (e.dead) return; e.hp -= amt; animals.setHp(e.obj, Math.max(0, e.hp / e.maxHp)); if (e.hp <= 0) { e.dead = true; G.kills++; floatText(by && by.role && !by.hero ? '勸退！' : '+1', e.x, TOP + 0.9, e.z, { bg: '#fcea8b' }); emit('hud'); } }
  function leak(e) { const A = C.animals[e.type]; G.leaked++; G.approval = Math.max(RC.approvalFloor, G.approval - A.leak); floatText(`−${A.leak}% 滿意度`, goalCenter.x, TOP + 2.4, goalCenter.z, { bg: '#c23b2a', fg: '#fff' }); if (A.boss) addLog(`${A.name}衝進市政府，滿意度 −${A.leak}%`, 'bad'); emit('hud'); }
  function removeEnemy(e) { animals.remove(e.obj); const i = enemyHits.indexOf(e.obj.userData.hit); if (i >= 0) enemyHits.splice(i, 1); }
  // ── 英雄 ──
  function heroGoTo(islandId, point) { const H = G.hero; if (!H || G.phase !== 'round') return; const node = point ? graph.nodeNear(islandId, point) : graph.ringIndex.get(islandId)[0]; H.route = routeTo(H.pos, node);
    // 點的位置離步道很近就走到點的那一格（逛街用），太遠（建築裡）就停在步道上
    if (point) { const tp = point.clone().setY(TOP + 0.03); if (tp.distanceTo(graph.nodes[node].p) < C.heroMode.exactRadius) H.route = makeRoute([...H.route.pts, tp]); }
    H.s = 0; H.pose = null; H.manual = G.auto ? C.heroMode.manualSeconds : 0; const name = islands.find(i => i.id === islandId).name; emit('hint', G.auto ? `${H.nick} 前往「${name}」（${C.heroMode.manualSeconds} 秒內不會自己跑掉）` : `${H.nick} 散步到「${name}」`); }
  // 自動攻擊開關：開＝自己找怪、自動開火；關＝不追怪也不自動開火，點哪走哪、可以找其他玩家互動（點敵人仍可重擊）
  function setAuto(on) { G.auto = !!on; const H = G.hero; if (H) { H.manual = 0; if (!G.auto) { H.route = null; H.moving = false; if (H.pose === 'fight') H.pose = null; } } emit('hero'); }
  // 英雄自動找怪：射程內沒敵人就往最前面（最接近市政府）的敵人走
  function heroAuto(dt) { const H = G.hero; if (!G.auto) return; H.manual = Math.max(0, (H.manual || 0) - dt); H.think = (H.think || 0) - dt; if (H.manual > 0 || H.think > 0) return; H.think = 0.8; let best = null; for (const e of G.enemies) if (!e.dead && (!best || e.prog / e.route.total > best.prog / best.route.total)) best = e; if (!best) { if (!H.route && d2(H.pos, goalCenter) > 2.2) { H.route = routeTo(H.pos, graph.nodeNear(goalIsland.id, H.pos)); H.s = 0; } return; } if (d2(best, H.pos) <= H.cfg.range * 0.85) { H.route = null; H.moving = false; return; } H.route = routeTo(H.pos, graph.nearestNode(ev(best))); H.s = 0; H.pose = null; }
  function focusStrike(e) { if (G.focusCd > 0 || !G.hero) return; const H = G.hero.cfg; G.focusCd = RC.focusCooldown; beam(G.hero.pos.clone().add(new THREE.Vector3(0, 0.45, 0)), new THREE.Vector3(e.x, TOP + 0.3, e.z), H.color); damage(e, H.dmg * RC.focusDmgMul); floatText('重擊', e.x, TOP + 0.9, e.z, { bg: '#db6a41', fg: '#fff' }); emit('hero'); }
  function ultimate() { if (G.phase !== 'round' || G.ultCd > 0) return; G.ultCd = RC.ultCooldown; ring(G.hero.pos.x, G.hero.pos.z, 0.5, 0xfcea8b, 14); for (const e of [...G.enemies]) { damage(e, e.maxHp * RC.ultPct); if (!e.dead) { e.slow = Math.max(e.slow, RC.ultSlow); e.slowT = RC.ultSlowTime; } } emit('banner', '🙌 台北人站出來！', 2.5); addLog('英雄大招：台北人站出來', 'good'); emit('hero'); }
  function surge() { G.surges++; ring(goalCenter.x, goalCenter.z, 0.5, 0xdb6a41, 16); for (const e of [...G.enemies]) damage(e, e.maxHp * RC.surgePct); if (G.surges === 1) { emit('banner', '🏙️ 全民護城！每座島的居民都出來了', 3); addLog('全民護城啟動：居民一起把網軍請出去', 'good'); } }
  function ring(x, z, r, color, grow) { const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(x, TOP + 0.06, z); scene.add(m); G.rings.push({ obj: m, ttl: 1.2, grow }); }
  function beam(a, b, color) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 })); scene.add(l); G.beams.push({ obj: l, ttl: 0.22 }); }
  const projGeo = new THREE.SphereGeometry(0.05, 8, 8), busGeo = new THREE.BoxGeometry(0.16, 0.08, 0.08);
  function fire(from, target, dmg, Tw) { if (Tw.chain) { let cur = target; const hit = new Set([cur]); let f = from; for (let i = 0; i < Tw.chain && cur; i++) { const to = new THREE.Vector3(cur.x, TOP + 0.3, cur.z); beam(f, to, Tw.color); damage(cur, dmg * Math.pow(0.8, i)); f = to; let nxt = null, bd = 1.2; for (const e of G.enemies) { if (hit.has(e) || e.dead) continue; const d = d2(e, cur); if (d < bd) { bd = d; nxt = e; } } cur = nxt; if (cur) hit.add(cur); } return; }
    const m = new THREE.Mesh(Tw.style === 'bus' ? busGeo : projGeo, new THREE.MeshBasicMaterial({ color: Tw.style === 'water' ? 0x66c6ff : Tw.style === 'ball' ? 0xffffff : Tw.color })); m.position.copy(from); scene.add(m); G.projs.push({ obj: m, pos: from.clone(), target, dmg, slow: Tw.slow, slowTime: Tw.slowTime }); }
  function nearest(src, R) { let best = null; for (const e of G.enemies) if (!e.dead && d2(e, src) <= R && (!best || e.prog > best.prog)) best = e; return best; }
  function raid() { G.raids++; const routeId = G.issue.routes[Math.floor(Math.random() * G.issue.routes.length)]; const tag = C.raidTags[Math.floor(Math.random() * C.raidTags.length)]; const n = RC.raid.size + Math.floor(G.t / 30); for (let i = 0; i < n; i++) G.queue.push({ t: G.t + i * 0.3, type: 'mouse', path: routeId }); G.queue.sort((a, b) => a.t - b.t); emit('banner', `🐭 網軍突襲 ${tag}　從${C.landings[routeId].name}登陸`, 3); addLog(`網軍突襲 ${tag}：${C.landings[routeId].name}方向冒出一群帳號`, 'raid'); }
  // ── 其他玩家的英雄（多人同框）：位置由網路更新、沿步道走過去；在你這邊的世界裡幫你打網軍 ──
  const MP = C.multi; const remotes = new Map(); const remoteHits = [];
  function rebuildPeople() { people.build([...G.residents, G.mayor, G.hero, ...remotes.values()].filter(Boolean)); }
  function tagSprite(w) { tagDel(w); tagAdd(w, w.nick, `${w.cfg.icon} ${w.cfg.name}`, hex(w.cfg.color), 'player'); }
  function bubble(w, txt, secs, ic) { w.bubbleT = secs; emit('say', w, txt, ic); }
  function upsertRemote(m) { let w = remotes.get(m.id); const tp = new THREE.Vector3(m.x, TOP + 0.03, m.z);
    if (w && w.cls !== m.c) { removeRemote(m.id); w = null; }
    if (!w) { if (remotes.size >= MP.maxRemote) return null; w = people.makeWalker('citizen', tp, m.c); Object.assign(w, { remote: true, id: m.id, cls: m.c, cfg: C.heroes[m.c], nick: m.n, cd: 0, route: null, s: 0 }); tagSprite(w);
      w.hit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ visible: false })); w.hit.userData.remoteId = m.id; scene.add(w.hit); remoteHits.push(w.hit); remotes.set(m.id, w); rebuildPeople(); }
    if (w.nick !== m.n) { w.nick = m.n; tagSprite(w); }
    w.inRound = m.r; w.fighting = m.f; w.auto = m.a; w.seen = performance.now();
    const d = d2(w.pos, tp); if (d > MP.snapDist) { w.pos.copy(tp); w.route = null; }
    else if (d > 0.12) { const pts = d < 1 ? [w.pos.clone(), tp] : [w.pos.clone(), ...graph.shortest(graph.nearestNode(w.pos), graph.nearestNode(tp)).map(n => graph.nodes[n].p.clone()), tp]; w.route = makeRoute(pts); w.s = 0; }
    return w; }
  function removeRemote(id) { const w = remotes.get(id); if (!w) return; tagDel(w); scene.remove(w.hit); const i = remoteHits.indexOf(w.hit); if (i >= 0) remoteHits.splice(i, 1); remotes.delete(id); rebuildPeople(); }
  function pruneRemotes(alive, now) { for (const [id, w] of [...remotes]) { const age = (now - w.seen) / 1000; if (age > MP.timeout || (alive && !alive.has(id) && age > MP.presenceGrace)) removeRemote(id); } }
  function remoteEmote(id, em) { const w = remotes.get(id); if (!w) return null; bubble(w, em.say, MP.bubbleSeconds, em.k); if (em.k === 'help') ring(w.pos.x, w.pos.z, 0.4, 0xdb6a41, 6); return w.nick; }
  function remoteUlt(id) { const w = remotes.get(id); if (!w) return null; ring(w.pos.x, w.pos.z, 0.5, 0xfcea8b, 10); bubble(w, '台北人站出來！', 2, 'yay'); if (G.phase === 'round') for (const e of [...G.enemies]) if (d2(e, w.pos) < MP.allyUltRadius) damage(e, e.maxHp * RC.ultPct * MP.allyUltMul); return w.nick; }
  function myEmote(em) { if (!G.hero) return false; bubble(G.hero, em.say, MP.bubbleSeconds, em.k); if (em.k === 'help') ring(G.hero.pos.x, G.hero.pos.z, 0.4, 0xdb6a41, 6); return true; }
  // 走路與泡泡用真實時間（暫停、2× 都不影響別人的英雄）；幫忙攻擊只在你的回合進行中、跟著遊戲時間
  function updateRemotes(dt, zoom = 1) { for (const w of remotes.values()) { if (w.route) walk(w, dt, w.cfg.speed * MP.catchUp); else w.moving = false; if (!w.moving && w.pose !== 'fight') w.pose = w.fighting ? 'fight' : null; w.hit.position.set(w.pos.x, w.pos.y + 0.3, w.pos.z); }
    for (const w of [G.hero, ...remotes.values()]) if (w && w.bubbleT > 0) { w.bubbleT -= dt; if (w.bubbleT <= 0) emit('say', w, null); } }
  function allyFire(dt) { for (const w of remotes.values()) { if (!w.inRound || w.auto === false) continue; w.cd -= dt; if (w.cd > 0) continue; const tg = nearest(w.pos, w.cfg.range); if (!tg) { if (w.pose === 'fight' && !w.fighting) w.pose = null; continue; } w.cd = w.cfg.rate; fire(w.pos.clone().add(new THREE.Vector3(0, 0.45, 0)), tg, w.cfg.dmg * MP.allyDmg, w.cfg); if (!w.moving) { w.yaw = Math.atan2(tg.x - w.pos.x, tg.z - w.pos.z); w.pose = 'fight'; } } }
  // ── 主迴圈 ──
  function step(dt, zoom = 1) {
    updateMayor(dt, zoom);
    if (G.phase !== 'round') { updateResidents(dt); return; }
    G.t += dt;
    // 依序登陸：兩隻之間至少隔 spawnGap 秒，才看得清楚每一隻頭上講什麼
    if (G.queue.length && G.queue[0].t <= G.t && G.t >= G.nextSpawn) { const q = G.queue.shift(); spawn(q.type, q.path); G.nextSpawn = G.t + RC.spawnGap; }
    updateChants(dt);
    G.raidT -= dt; if (G.raidT <= 0 && G.t < RC.bossAt) { if (Math.random() < RC.raid.chance) raid(); G.raidT = RC.raid.minGap + Math.random() * (RC.raid.maxGap - RC.raid.minGap); }
    G.windT -= dt; if (G.windT <= 0 && G.t < RC.surgeAt) { G.windLeft = RC.windShift.duration; emit('banner', '💨 風向變了！敵人全體加速', 2.5); addLog('有人帶風向，網軍短暫加速', 'raid'); G.windT = RC.windShift.minGap + Math.random() * (RC.windShift.maxGap - RC.windShift.minGap); }
    if (G.windLeft > 0) G.windLeft -= dt;
    if ((G.t >= RC.surgeAt || G.approval <= RC.surgeBelowApproval) && G.enemies.length) { G.surgeT -= dt; if (G.surgeT <= 0) { surge(); G.surgeT = RC.surgeEvery; } }
    if (G.t >= RC.wipeAt) for (const e of [...G.enemies]) damage(e, e.maxHp);
    if (G.hero.cfg.regen) G.approval = Math.min(RC.startApproval, G.approval + G.hero.cfg.regen * dt); if (G.ultCd > 0) G.ultCd -= dt; if (G.focusCd > 0) G.focusCd -= dt;
    const wind = G.windLeft > 0 ? RC.windShift.speedMul : 1;
    for (const e of G.enemies) { const A = C.animals[e.type]; if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; } if (A.hairpin) { e.hairT -= dt; if (e.hairT <= 0) { e.speedMul = A.hairpin[0] + Math.random() * (A.hairpin[1] - A.hairpin[0]); e.hairT = 1.5 + Math.random() * 2; } }
      const blocked = e.defenders > 0 && !A.boss ? 0.35 : 1; // 被居民圍住會慢下來
      e.s += A.speed * e.speedMul * (1 - e.slow) * wind * blocked * RC.unitsPerSec * dt;
      if (e.s >= e.route.total) { e.dead = true; leak(e); continue; }
      const smp = sampleRoute(e.route, e.s); e.x = smp.p.x + -smp.dir.z * e.lateral; e.z = smp.p.z + smp.dir.x * e.lateral; e.prog = e.s; e.obj.position.set(e.x, TOP + 0.03, e.z); e.obj.rotation.y = Math.atan2(smp.dir.x, smp.dir.z) - Math.PI / 2;
      e.wing += dt * (A.model === 'mouse' ? 22 : 12); if (A.hop) e.hopT += dt * A.speed * 1.6 * e.speedMul;
      if (A.spawn) { e.spawnT += dt; if (e.spawnT >= A.spawn.every) { e.spawnT = 0; const n = spawn(A.spawn.type, e.routeId); n.s = e.s; } }
      animals.animate(e.obj, e, dt, G.t); }
    for (const e of G.enemies) if (e.dead) removeEnemy(e); G.enemies = G.enemies.filter(e => !e.dead);
    updateResidents(dt); allyFire(dt);
    // 英雄
    { const H = G.hero; heroAuto(dt); if (H.route) walk(H, dt, H.cfg.speed); H.cd -= dt; if (H.cd <= 0) { const tg = G.auto ? nearest(H.pos, H.cfg.range) : null; if (tg) { H.cd = H.cfg.rate; fire(H.pos.clone().add(new THREE.Vector3(0, 0.45, 0)), tg, H.cfg.dmg, H.cfg); if (!H.moving) H.yaw = Math.atan2(tg.x - H.pos.x, tg.z - H.pos.z); if (!H.moving) H.pose = 'fight'; } else if (!H.moving && H.pose === 'fight') H.pose = null; } }
    for (const p of G.projs) { const tg = p.target; if (tg.dead) { p.dead = true; continue; } const to = new THREE.Vector3(tg.x, TOP + (C.animals[tg.type].fly ? 0.55 : 0.2), tg.z); const d = p.pos.distanceTo(to), v = RC.projSpeed * dt; if (d <= v + 0.05) { p.dead = true; damage(tg, p.dmg); if (p.slow && !C.animals[tg.type].boss) { tg.slow = Math.max(tg.slow, p.slow); tg.slowT = p.slowTime; } } else { p.pos.lerp(to, v / d); p.obj.position.copy(p.pos); } }
    for (const p of G.projs) if (p.dead) scene.remove(p.obj); G.projs = G.projs.filter(p => !p.dead);
    for (const e of G.enemies) if (e.dead) removeEnemy(e); G.enemies = G.enemies.filter(e => !e.dead);
    for (const b of G.beams) { b.ttl -= dt; b.obj.material.opacity = Math.max(0, b.ttl * 4); if (b.ttl <= 0) scene.remove(b.obj); } G.beams = G.beams.filter(b => b.ttl > 0);
    for (const f of G.floats) { f.ttl -= dt; f.obj.position.y += dt * 0.5; f.obj.material.opacity = Math.min(1, f.ttl); if (f.ttl <= 0) scene.remove(f.obj); } G.floats = G.floats.filter(f => f.ttl > 0);
    for (const r of G.rings) { r.ttl -= dt; r.obj.scale.addScalar(r.grow * dt); r.obj.material.opacity = Math.max(0, r.ttl); if (r.ttl <= 0) scene.remove(r.obj); } G.rings = G.rings.filter(r => r.ttl > 0);
    if (G.t >= RC.seconds || (!G.queue.length && !G.enemies.length && G.t > RC.bossAt + 4)) endRound();
  }
  function onPick(hit) { if (hit.remote) { emit('remote', hit.remote, remotes.get(hit.remote)); return; } if (G.phase !== 'round') return; if (hit.enemy && !hit.enemy.dead) { focusStrike(hit.enemy); return; } if (hit.island) heroGoTo(hit.island, hit.point); }
  return { G, spawnResidents, spawnMayor, setStops, mayorStops: () => stops, startRound, backToLobby, step, onPick, ultimate, setAuto, enemyHits, goalCenter, remoteHits, remotes, upsertRemote, removeRemote, pruneRemotes, remoteEmote, remoteUlt, myEmote, updateRemotes };
}
