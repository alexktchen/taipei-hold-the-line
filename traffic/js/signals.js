/* 號誌路口：每個路口一個控制器（雙向分隔的大路口有好幾個節點，資料流程已經聚好）。
   進入路口的每一段路（approach）分成兩組：第一階段放行的方向（組 0）與另一個方向（組 1）。
   有臺北市時制（timing）：依模擬的星期幾（segmenttype 1～7＝週一～週日）與時刻，從時段表找現在用第幾號計畫；
   計畫的 direction（0/2/4/6＝北東南西）決定第一階段是南北向還是東西向；各階段的綠、黃、全紅秒數照計畫。
   階段數超過 2（例如有左轉保護）時，前一半的階段算組 0、後一半算組 1，同一組連續的階段中間不變紅。
   沒有時制的路口用推估：週期看路口最大的路，綠燈依兩組的車道數與道路等級分配，時差依路口在主軸方向上的位置排（主要幹道會排出綠波）。 */
const W = [3, 2.5, 2, 1.6, 1.2, 0.5, 0.3]; // 等級權重：推估綠燈秒數用
const Y = 3, AR = 2, WAVE = 12; // 推估時的黃燈、全紅秒數；綠波速度（公尺／秒）
const mod = (a, n) => ((a % n) + n) % n;
const nsDir = d => d === 0 || d === 4; // 第一階段是南北向
// 階段 → 兩組的綠燈窗：[綠燈開始, 綠燈結束, 黃燈結束]（從週期起點算）
function windows(stages) { const n = stages.length, k = Math.ceil(n / 2); let t = 0; const w = [[0, 0, 0], [0, 0, 0]];
  stages.forEach((s, i) => { const grp = n === 1 ? 0 : i < k ? 0 : 1; if (i === 0 || i === k) w[grp][0] = t; w[grp][1] = t + s[0]; w[grp][2] = t + s[0] + s[1]; t += s[0] + s[1] + s[2]; });
  if (n === 1) w[1] = [0, 0, 0]; return w; }

export function createSignals(net, data) {
  const list = []; let byNode = new Map(), weekday0 = 1;
  function build() { list.length = 0; byNode = new Map(); for (const L of net.links) { L.ctrl = -1; L.axis = 0; L.yieldTo = 0; } // 停止線位置（L.stop）在 data.setbacks 依路口寬度算好
    for (const s of data.signals) { const nodes = new Set(s.nodes.filter(n => n < net.nx.length && net.inn[n])); if (!nodes.size) continue;
      const appr = []; for (const n of nodes) for (const lid of net.inn[n]) { const L = net.links[lid]; if (!nodes.has(L.from)) appr.push(L); }
      if (appr.length < 2) continue;
      const head = L => { const p = L.pts, n = p.length; return Math.atan2(p[n - 1] - p[n - 3], p[n - 2] - p[n - 4]); };
      const c = { i: list.length, id: s.id || '', name: s.name || '', x: s.x * 0.1, z: s.z * 0.1, nodes, appr, timing: s.timing, src: s.src || [], plan: null, key: '' };
      const tm = s.timing, firstPlan = tm && Object.values(tm.plans)[0];
      if (firstPlan) { c.ns = nsDir(firstPlan[2]); for (const L of appr) { const h = head(L), ns = Math.abs(Math.sin(h)) > Math.abs(Math.cos(h)); L.axis = ns === c.ns ? 0 : 1; } } // 南北向的進入路段：行進方向接近 ±z
      else { const top = appr.reduce((a, b) => (b.cls < a.cls || (b.cls === a.cls && b.lanes > a.lanes) ? b : a)), th = mod(head(top), Math.PI); let wA = 0, wB = 0, minCls = 9;
        for (const L of appr) { const d = Math.abs(mod(head(L), Math.PI) - th); L.axis = Math.min(d, Math.PI - d) < Math.PI / 4 ? 0 : 1; const w = L.lanes * W[L.cls]; if (L.axis) wB += w; else wA += w; minCls = Math.min(minCls, L.cls); }
        const C = minCls <= 1 ? 160 : minCls === 2 ? 140 : minCls === 3 ? 120 : minCls === 4 ? 100 : 70, use = C - 2 * (Y + AR), gA = wB ? Math.max(15, Math.min(use - 15, use * wA / (wA + wB))) : use;
        const off = mod((c.x * Math.cos(th) + c.z * Math.sin(th)) / WAVE, C); c.est = { C, off, stages: wB ? [[gA, Y, AR], [use - gA, Y, AR]] : [[use, Y, AR]], real: false }; c.est.win = windows(c.est.stages); c.plan = c.est; }
      for (const L of appr) { L.ctrl = c.i; if (L.stop < 3) L.stop = Math.min(L.len * 0.4, 3); }
      for (const n of nodes) byNode.set(n, c.i);
      list.push(c); }
    // 沒有號誌的路口：小路碰到大路要讓（yieldTo），停讓線在路口前一點
    for (const L of net.links) { if (L.ctrl >= 0 || byNode.has(L.to)) continue; let maxOther = 9; for (const lid of net.inn[L.to]) { const M = net.links[lid]; if (M.e === L.e) continue; maxOther = Math.min(maxOther, M.cls); }
      if (maxOther < L.cls) L.yieldTo = 1; }
    lastKey = ''; return list; }
  // 模擬時間 t（秒，從模擬第一天 0 點起算）→ 星期幾（1～7＝週一～週日）與當天第幾分鐘
  const dayOf = t => ((weekday0 - 1 + Math.floor(t / 86400)) % 7 + 7) % 7 + 1, minuteOf = t => Math.floor(mod(t, 86400) / 60);
  // 依時段表選現在的計畫（同一分鐘內不重算）
  let lastKey = '';
  function choose(t) { const key = dayOf(t) + ':' + minuteOf(t); if (key === lastKey) return; lastKey = key; const d = dayOf(t), m = minuteOf(t);
    for (const c of list) { const tm = c.timing; if (!tm) continue; let pid = null; const di = tm.dmap[d - 1], sched = di >= 0 ? tm.days[di] : tm.days[0];
      if (sched) for (const [start, p] of sched) { if (start <= m) pid = p; else break; } if (pid == null && sched && sched.length) pid = sched[sched.length - 1][1];
      const raw = tm.plans[pid] || Object.values(tm.plans)[0]; if (!raw) { c.plan = c.est || null; continue; } const k = pid + '@' + d; if (c.key === k && c.plan) continue; c.key = k;
      const [C, off, dir, stages] = raw; c.base = { C, off, dir, stages, win: windows(stages), real: true, pid, flip: nsDir(dir) !== c.ns, from: sched ? (sched.filter(x => x[0] <= m).pop() || sched[0])[0] : 0, sched }; c.plan = adjusted(c.base, c.adj); }
    for (const c of list) if (!c.timing && c.est) c.plan = adjusted(c.est, c.adj); }
  // 試算調整：split＝第一組方向（axis 0）多給幾秒綠燈（從另一組扣），cycle＝週期加減幾秒（綠燈照比例）
  function adjusted(p, adj) { if (!adj || (!adj.split && !adj.cycle)) return p; const n = p.stages.length, k = Math.ceil(n / 2), st = p.stages.map(x => x.slice()); if (n < 2) return p;
    const g0 = p.flip ? 1 : 0, lastOf = g => (g === 0 ? k - 1 : n - 1); // axis 0 對應的階段組
    if (adj.split) { const a = lastOf(g0), b = lastOf(1 - g0), d = Math.max(-(st[a][0] - 8), Math.min(st[b][0] - 8, adj.split)); st[a][0] += d; st[b][0] -= d; }
    let C = p.C; if (adj.cycle) { const lost = st.reduce((x, y) => x + y[1] + y[2], 0), grn = st.reduce((x, y) => x + y[0], 0), C2 = Math.max(lost + 16, Math.min(240, C + adj.cycle)), kk = (C2 - lost) / grn; for (const x of st) x[0] = Math.max(6, Math.round(x[0] * kk)); C = st.reduce((x, y) => x + y[0] + y[1] + y[2], 0); }
    return { ...p, C, stages: st, win: windows(st), adj: true }; }
  function setAdj(c, adj) { c.adj = adj; c.key = ''; lastKey = ''; if (!c.timing && c.est) c.plan = adjusted(c.est, adj); }
  // 某一組在時間 t 的燈：['g'|'y'|'r', 這個燈還剩幾秒]
  function state(c, axis, t) { const p = c.plan; if (!p) return ['g', 99]; const grp = p.flip ? 1 - axis : axis, w = p.win[grp], u = mod(t - p.off, p.C);
    if (w[1] <= w[0]) return ['r', p.C]; const inR = (a, b) => (b > a ? u >= a && u < b : u >= a || u < b - p.C);
    if (inR(w[0], w[1])) return ['g', mod(w[1] - u, p.C)]; if (inR(w[1], w[2])) return ['y', mod(w[2] - u, p.C)]; return ['r', mod(w[0] - u, p.C)]; }
  const linkState = (L, t) => L.ctrl < 0 ? null : list[L.ctrl].flash ? 'f' : state(list[L.ctrl], L.axis, t)[0]; // f＝號誌故障閃黃
  return { list, build, choose, state, linkState, setAdj, setWeekday(d) { weekday0 = d; lastKey = ''; }, dayOf, get byNode() { return byNode; } }; }
