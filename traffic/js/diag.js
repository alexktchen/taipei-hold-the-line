/* 號誌診斷：兩種「事件」。
   一、時制體檢（靜態，依交通工程常用的準則，拿臺北市時制與路口幾何算）：
     黃燈依速限（國內設置規則常用：50 km/h 以下 3 秒、51～60 為 4 秒、61 以上 5 秒）；全紅 ≥ (路口寬 + 6 m 車長) / 速度；行人綠閃 ≥ 斑馬線長 / 1.0 m/s；
     週期偏長（小路口 > 180 秒，或任何路口 ≥ 240 秒）；主要道路的綠燈比次要道路短；同一協調群組的路口週期不同（綠波接不起來）。
   二、路網事件（動態，看模擬的車）：
     回堵到上一個路口（排隊長度 ≈ 這一段路長）；一次綠燈過不完（綠燈結束時還有很多車在排，連續幾個週期）；
     綠燈空轉（這個方向綠燈幾乎沒車過、另一個方向還在排）；下游塞住進不去（綠燈但前面沒空間）；綠波斷點（同一次紅燈攔下 8 台以上剛從上一個路口綠燈過來、不到 40 秒的車）。
   每個事件有位置、嚴重度、說明與建議，給事件列表、地圖標記、導播鏡頭用。 */
import { halfWidth, LANE_W } from './data.js';
const SAT = 2.0; // 飽和車頭距（秒／車道）：一條車道綠燈每 2 秒大約能過一台
export const KIND = {
  spill: { icon: '🚨', name: '回堵到上一個路口', sev: 3 }, fail: { icon: '🔁', name: '一次綠燈過不完', sev: 2 }, waste: { icon: '💤', name: '綠燈空轉', sev: 2 },
  block: { icon: '⛔', name: '下游塞住進不去', sev: 2 }, wave: { icon: '〰️', name: '綠波斷點', sev: 1 }, rule: { icon: '📋', name: '時制體檢', sev: 1 }, scene: { icon: '🎬', name: '情境', sev: 2 } };

export function createDiag(net, sig, sim) {
  const events = [], live = new Map(), A = new Map(); let seq = 0;
  const nameOf = c => c.name || [0, 1].map(ax => [...new Set(c.appr.filter(L => L.axis === ax).map(L => net.edges[L.e].name).filter(n => n >= 0).map(n => net.names[n]))][0] || '').filter(Boolean).join('／') || '路口';
  const roadsOf = (c, ax) => [...new Set(c.appr.filter(L => L.axis === ax).map(L => net.edges[L.e].name).filter(n => n >= 0).map(n => net.names[n]))].slice(0, 2).join('、') || '未命名道路';
  const dirName = L => { const p = L.pts, n = p.length, dx = p[n - 2] - p[n - 4], dz = p[n - 1] - p[n - 3]; const a = Math.atan2(dx, -dz) * 180 / Math.PI; return ['北上', '往東北', '東行', '往東南', '南下', '往西南', '西行', '往西北'][Math.round(((a + 360) % 360) / 45) % 8]; }; // 行進方向（北＝−z）
  // 新事件或更新同一個（同一路口同一種、5 分鐘內算同一件，次數 +1）
  function emit(kind, c, text, tip, extra = {}) { const key = kind + ':' + (c ? c.i : extra.key || ''), now = sim.t; let ev = live.get(key);
    if (ev && now - ev.last < 300) { ev.last = now; ev.n++; ev.text = text; ev.tip = tip; Object.assign(ev, extra); return ev; }
    ev = { id: ++seq, kind, c, x: extra.x ?? c.x, z: extra.z ?? c.z, name: extra.name || (c ? nameOf(c) : ''), text, tip, t: now, last: now, n: 1, sev: extra.sev ?? KIND[kind].sev, ...extra };
    live.set(key, ev); events.unshift(ev); if (events.length > 200) events.pop(); onEvent && onEvent(ev); return ev; }
  let onEvent = null;
  // ── 一、時制體檢 ──
  // 每一條：k 種類、w 權重（安全問題排前面）、t 說明。主次道路那條要看號誌方向對應，是推估的，信心比較低。
  const RULE = { yellow: { name: '黃燈偏短', safe: 1, w: 3 }, allred: { name: '全紅偏短', safe: 1, w: 3 }, ped: { name: '行人綠閃偏短', safe: 1, w: 2 }, main: { name: '主要道路綠燈較短', w: 1 }, cycle: { name: '週期偏長', w: 1 }, grp: { name: '同群組週期不同', w: 1 } };
  function checkRules() { const out = []; const byGrp = new Map(); rulesAt = Math.floor(sim.t / 900);
    for (const c of sig.list) { const p = c.plan; if (!p || !p.real) continue; if (c.grp) { const a = byGrp.get(c.grp) || []; a.push(c); byGrp.set(c.grp, a); }
      const n = p.stages.length, k = Math.ceil(n / 2), grpOf = i => (n === 1 ? 0 : i < k ? 0 : 1), axOf = g => (p.flip ? 1 - g : g);
      /* 匝道（快速道路等級 0、1）在號誌處其實已減速，速限與道路等級只看平面道路的進口 */
      const surf = ax => c.appr.filter(L => L.axis === ax && L.cls >= 2), vmax = ax => Math.max(8, ...surf(ax).map(L => L.vf)), width = ax => Math.max(6, ...c.appr.filter(L => L.axis === ax).map(L => 2 * halfWidth(net.edges[L.e])));
      const cls = ax => Math.min(9, ...surf(ax).map(L => L.cls)), found = [], add = (k, t) => { if (!found.some(f => f.k === k)) found.push({ k, t }); };
      p.stages.forEach((s, i) => { const last = i === n - 1 || grpOf(i + 1) !== grpOf(i); if (!last) return; const ax = axOf(grpOf(i)), v = vmax(ax), W = width(1 - ax);
        const kmh = Math.round(v * 3.6), yReq = kmh <= 50 ? 3 : kmh <= 60 ? 4 : 5, arReq = (W + 6) / v - 0.5; /* 全紅：車頭清出路口所需（扣掉黃燈尾段的 0.5 秒） */
        if (s[1] > 0 && s[1] < yReq && surf(ax).length) add('yellow', `黃燈 ${s[1]} 秒（${roadsOf(c, ax)}，速限 ${kmh} km/h 一般用 ${yReq} 秒）`);
        if (s[2] < arReq - 0.3) add('allred', `全紅 ${s[2]} 秒（路口寬約 ${Math.round(W)} 公尺，車子清出路口建議 ≥ ${Math.max(1, arReq).toFixed(1)} 秒）`);
        const pf = s[3] || 0, cross = width(1 - ax); if (pf > 0 && pf < cross / 1.0 - 1) add('ped', `行人綠閃 ${pf} 秒（${roadsOf(c, 1 - ax)}約 ${Math.round(cross)} 公尺，以每秒 1 公尺走要 ${Math.round(cross)} 秒）`); });
      /* 週期：大路口尖峰用 200 秒是刻意的；只提小路口的長週期，或任何路口超過 240 秒 */
      if (p.C >= 240 || (p.C > 180 && cls(0) >= 4 && cls(1) >= 4)) add('cycle', `週期 ${p.C} 秒${p.C >= 240 ? '很長' : '，以小路口來說偏長'}（行人與支道要等很久）`);
      const g = [0, 0]; p.stages.forEach((s, i) => { g[axOf(grpOf(i))] += s[0]; });
      for (const ax of [0, 1]) if (cls(ax) + 1 < cls(1 - ax) && cls(1 - ax) < 9 && g[ax] < g[1 - ax] * 0.9) add('main', `主要道路（${roadsOf(c, ax)}）綠 ${g[ax]} 秒比次要道路（${roadsOf(c, 1 - ax)}）綠 ${g[1 - ax]} 秒短${p.dir === 0 ? '（這個路口的號誌方向是推估的，先對照現場）' : ''}`);
      if (found.length) out.push({ c, found }); }
    // 同一協調群組：週期不同就排不出綠波
    for (const [grp, cs] of byGrp) { if (cs.length < 2) continue; const cnt = new Map(); for (const c of cs) cnt.set(c.plan.C, (cnt.get(c.plan.C) || 0) + 1); const main = [...cnt].sort((a, b) => b[1] - a[1])[0][0];
      for (const c of cs) if (c.plan.C !== main) { let f = out.find(o => o.c === c); if (!f) out.push(f = { c, found: [] }); f.found.push({ k: 'grp', t: `跟同群組 ${grp} 的路口週期不同（${c.plan.C} 秒，群組多數 ${main} 秒），綠波接不起來` }); } }
    // 排序：安全問題多的、大馬路的排前面
    for (const r of out) { const big = Math.min(...r.c.appr.map(L => L.cls)); r.score = r.found.reduce((a, f) => a + RULE[f.k].w, 0) * 10 + Math.max(0, 6 - big); }
    out.sort((a, b) => b.score - a.score); rules = out; return out; }
  let rules = [], rulesAt = -1;
  // ── 二、路網事件 ──
  const stOf = L => { let s = A.get(L.id); if (!s) A.set(L.id, s = { L, st: '', gT: 0, dep: 0, streak: 0, lastResid: 0, blockT: 0, spillT: 0 }); return s; };
  sim.hooks.cross = (v, L, t) => { if (L.ctrl < 0) return; const s = stOf(L); if (sig.linkState(L, t) !== 'r') s.dep++; v.lastPass = { c: L.ctrl, t, red: !!v.redSeen }; };
  sim.hooks.stop = (v, L, t) => { if (L.ctrl < 0) return; const lp = v.lastPass; if (lp && lp.c !== L.ctrl && !lp.red && t - lp.t < 40) { const a = sig.list[lp.c], b = sig.list[L.ctrl]; if (!a || !b) return; const s = stOf(L); s.waveN = (s.waveN || 0) + 1;
      if (s.waveN === 8) { emit('wave', b, `一整隊車（8 台以上）剛從 ${nameOf(a)} 綠燈過來，不到 40 秒就在這裡被紅燈攔下（${dirName(L)}）`, '兩個路口的時差沒對上車隊行進時間：調整這個路口的時差，或把兩個路口放進同一群組、同一週期', { from: a.i }); } } };
  const queueOf = L => { let n = 0, tail = L.len - L.stop; for (const q of L.q) { let m = 0, end = L.len - L.stop; for (const v of q) { if (v.v > 1.2 || end - v.s > 18) break; m++; end = v.s - v.len; } n += m; tail = Math.min(tail, end); } return [n, L.len - L.stop - tail]; };
  let acc = 0;
  function tick(dt) { acc += dt; if (acc < 1) return; const t = sim.t; acc = 0;
    for (const c of sig.list) { if (!c.appr.some(L => L.q.some(q => q.length))) continue;
      for (const L of c.appr) { const s = stOf(L), st = sig.linkState(L, t), [qn, qlen] = queueOf(L), room = L.len - L.stop - L.s0;
        if (st === 'g') { s.gT += 1; s.waveN = 0; } /* 綠波斷點只算同一次紅燈被攔下的車隊 */
        // 綠燈結束：看還剩多少車、這次綠燈過了幾台
        if (s.st === 'g' && st !== 'g') { const util = s.gT > 3 ? s.dep * SAT / (s.gT * L.lanes) : 1; s.lastResid = qn; s.lastUtil = util;
          if (qn >= Math.max(3, L.lanes * 2)) { s.streak++; if (s.streak >= 2) emit('fail', c, `${roadsOf(c, L.axis)}（${dirName(L)}）連續 ${s.streak} 次綠燈結束還有 ${qn} 台在排`, `這個方向綠燈不夠：試試把它的綠燈加長（例如 +10 秒），或縮短週期讓它多輪幾次`, { L: L.id, axis: L.axis }); } else s.streak = 0;
          const other = c.appr.filter(M => M.axis !== L.axis).reduce((a, M) => Math.max(a, stOf(M).lastResid || 0), 0);
          if (s.gT >= 15 && util < 0.22 && other >= 4) emit('waste', c, `${roadsOf(c, L.axis)}綠 ${s.gT} 秒只過 ${s.dep} 台，${roadsOf(c, 1 - L.axis)}還有 ${other} 台在排`, `綠燈給錯方向：把 ${roadsOf(c, L.axis)} 的綠燈分一些給 ${roadsOf(c, 1 - L.axis)}`, { L: L.id, axis: L.axis });
          s.gT = 0; s.dep = 0; }
        s.st = st; s.q = qn; s.qlen = qlen;
        // 回堵：排隊長度接近這一段路的長度（快退到上一個路口）
        if (room > 60 && qn >= 6 && qlen > room - 10) { s.spillT += 1; if (s.spillT === 8) emit('spill', c, `${roadsOf(c, L.axis)}（${dirName(L)}）排了 ${qn} 台、${Math.round(qlen)} 公尺，回堵到上一個路口`, `回堵會卡住上游路口：加長這個方向的綠燈，或在上游路口減少放進來的車（上游綠燈縮短、時差調整）`, { L: L.id, axis: L.axis }); } else s.spillT = 0;
        // 綠燈但前面塞住進不去
        const f = L.q.map(q => q[0]).find(v => v && v.v < 0.3 && L.len - L.stop - v.s < 6); if (st === 'g' && f && f.blocked > 0) { s.blockT += 1; if (s.blockT === 15) emit('block', c, `${roadsOf(c, L.axis)}綠燈，但出口那段塞住，車子進不去`, `下游路口回堵過來：先處理下游的瓶頸（下游綠燈加長），這裡綠燈再長也沒用`, { L: L.id, axis: L.axis }); } else if (st !== 'g') s.blockT = 0; } } }
  // 給資訊卡：某路口兩個方向的即時指標
  function metrics(c) { return [0, 1].map(ax => { const ls = c.appr.filter(L => L.axis === ax); let q = 0, len = 0, util = null, resid = 0; for (const L of ls) { const s = A.get(L.id); if (!s) continue; q += s.q || 0; len = Math.max(len, s.qlen || 0); if (s.lastUtil != null) util = Math.max(util ?? 0, s.lastUtil); resid += s.lastResid || 0; } return { q, len, util, resid }; }); }
  return { events, tick, checkRules, RULE, get rules() { if (Math.floor(sim.t / 900) !== rulesAt) checkRules(); return rules; }, metrics, emit, nameOf, roadsOf, set onEvent(f) { onEvent = f; } }; }
