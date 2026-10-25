// 台北車流模擬的資料：在 GitHub Actions 上跑（.github/workflows/traffic-data.yml），結果寫進 traffic/data/。
// 來源：OpenStreetMap（Overpass API：道路、號誌節點、河川、綠地、行政區）、政府資料開放平臺的臺北市號誌位置（121890）與路口號誌時制計畫（145720）。
// 座標：以台北車站附近為原點的平面公尺（x 向東、z 向南），存成公寸整數（0.1 m）省空間。
// 輸出：meta.json、net-main.json（快速道路～三級路）、net-minor.json（巷弄）、signals.json、water.json、green.json、mrt.json（捷運路線與車站）、bld/（建物輪廓，1 公里一格）。
// 臺北市原始檔很大（時制兩個 JSON 共約 60 MB，超過 Cloudflare Pages 單檔 25 MB 上限），只放在 RAW_DIR（預設 /tmp），repo 裡的 raw/ 只留 CSV 與每個 JSON 的前幾筆樣本。
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
const CACHE = process.env.TRAFFIC_CACHE || ''; // 有設的話 Overpass 結果存在這個資料夾，下次直接讀（重跑、本機測試用）

const OUT = 'traffic/data', SAMPLE = OUT + '/raw', RAW = process.env.RAW_DIR || '/tmp/traffic-raw';
const UA = 'taipei-hold-the-line traffic data builder (github.com/alexktchen/taipei-hold-the-line)';
const OVERPASS = (process.env.OVERPASS_URLS || 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter,https://overpass.private.coffee/api/interpreter').split(',');
const ORIGIN = { lat: 25.0478, lon: 121.5170 }; // 台北車站
const KX = Math.cos(ORIGIN.lat * Math.PI / 180) * 111320, KZ = 110574;
const BBOX = '24.95,121.44,25.22,121.68'; // 南,西,北,東（河川、山區跨過市界也抓進來）
const DISTRICTS = ['北投區', '士林區', '內湖區', '大同區', '中山區', '松山區', '南港區', '萬華區', '中正區', '大安區', '信義區', '文山區'];
const proj = (lat, lon) => [(lon - ORIGIN.lon) * KX, -(lat - ORIGIN.lat) * KZ];
const dm = v => Math.round(v * 10); // 公尺 → 公寸
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 下載 ──
async function overpass(query, label, minCount = 1) {
  // 快取（GitHub Actions 會把這個資料夾留到下一次）：6 天內的直接用，Overpass 大塞車時失敗的那一輪也不用整個重抓
  const cf = CACHE && `${CACHE}/${label}.json`; if (cf && existsSync(cf) && Date.now() - statSync(cf).mtimeMs < (+process.env.TRAFFIC_CACHE_DAYS || 6) * 864e5) { const j = JSON.parse(await readFile(cf, 'utf8')); log(`Overpass ${label}：讀快取 ${j.elements.length} 筆`); return j.elements; }
  const els = await overpassFetch(query, label, minCount); if (cf) { await mkdir(CACHE, { recursive: true }); await writeFile(cf, JSON.stringify({ elements: els })); } return els; }
// 有的鏡像站會回空結果（沒有錯誤訊息）：少於 minCount 筆就當失敗、換下一個
async function overpassFetch(query, label, minCount) {
  for (let round = 0; round < 4; round++) { if (round) { log(`  第 ${round + 1} 輪，先等 ${30 * 2 ** round} 秒`); await sleep(30000 * 2 ** round); } for (const url of OVERPASS) {
    try { log(`Overpass ${label} ← ${url}`); const t = Date.now();
      const res = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query), signal: AbortSignal.timeout(900_000) });
      if (!res.ok) { log(`  HTTP ${res.status}`); await sleep(15000); continue; }
      const txt = await res.text(); const j = JSON.parse(txt); if (j.remark && /error|runtime/i.test(j.remark)) { log('  remark:', j.remark.slice(0, 200)); await sleep(15000); continue; }
      log(`  ${(txt.length / 1e6).toFixed(1)} MB、${j.elements.length} 筆、${((Date.now() - t) / 1000).toFixed(0)} 秒`); if (j.elements.length < minCount) { log('  筆數太少，換一個'); await sleep(10000); continue; } return j.elements; }
    catch (e) { log('  失敗：', e.message); await sleep(15000); } } }
  throw new Error('Overpass 全部失敗：' + label); }
// 非必要的圖層（水域、綠地、捷運…）：抓不到就沿用上一次的成品，不讓整個流程失敗
async function optional(label, fn, fallback) { try { return await fn(); } catch (e) { log(`${label}抓不到（${e.message}），沿用上一次的`); return fallback(); } }
const prevJSON = async (f, d) => { try { return JSON.parse(await readFile(`${OUT}/${f}`, 'utf8')); } catch (e) { return d; } };
async function getBuf(url) { const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(300_000) }); if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`); return Buffer.from(await res.arrayBuffer()); }
// 中文 CSV 常是 Big5：UTF-8 解出亂碼（替代字元）就改用 Big5
function decodeText(buf) { let s = new TextDecoder('utf-8').decode(buf); if ((s.match(/�/g) || []).length > 3) s = new TextDecoder('big5').decode(buf); return s.replace(/^﻿/, ''); }
// 政府資料開放平臺的資料集：先讀 API 拿到每個檔案的下載網址，再下載；原始檔留在 raw/
async function govDataset(id) {
  if (process.env.GOV_DIR) { const { readdir } = await import('node:fs/promises'); const out = []; for (const name of (await readdir(process.env.GOV_DIR)).filter(n => n.startsWith(id + '-') && /\.(json|csv)$/.test(n) && !/meta|sample/.test(n)).sort()) { const buf = await readFile(`${process.env.GOV_DIR}/${name}`); out.push({ name, ext: name.split('.').pop(), text: decodeText(buf) }); } log(`資料集 ${id}：讀本機 ${out.length} 個檔案`); return out; } // 本機測試用
  const meta = JSON.parse(decodeText(await getBuf(`https://data.gov.tw/api/v2/rest/dataset/${id}`)));
  const files = [], seen = new Set();
  const walk = (o) => { if (Array.isArray(o)) return o.forEach(walk); if (!o || typeof o !== 'object') return;
    const url = o.resourceDownloadUrl || o.downloadURL || o.downloadUrl || o.accessURL; const fmt = String(o.resourceFormat || o.format || o.fileFormat || '').toUpperCase();
    if (typeof url === 'string' && /^https?:/.test(url) && !seen.has(url)) { seen.add(url); files.push({ url, fmt, desc: o.resourceDescription || o.description || '' }); }
    Object.values(o).forEach(walk); };
  walk(meta.result || meta);
  log(`資料集 ${id}：${(meta.result && (meta.result.title || meta.result.datasetName)) || ''}，${files.length} 個檔案`, files.map(f => f.fmt).join(','));
  const out = [];
  for (const [k, f] of files.entries()) { try { const buf = await getBuf(f.url); const ext = /JSON/.test(f.fmt) ? 'json' : /CSV/.test(f.fmt) ? 'csv' : /XML/.test(f.fmt) ? 'xml' : 'bin';
      const name = `${id}-${k}.${ext}`, text = ext === 'bin' ? '' : decodeText(buf); await writeFile(`${RAW}/${name}`, buf); log(`  ${name} ${(buf.length / 1024).toFixed(0)} KB`);
      if (ext === 'csv' && buf.length < 2e6) await writeFile(`${SAMPLE}/${name}`, buf); else if (ext === 'json') { try { const j = JSON.parse(text), arr = Array.isArray(j) ? j : Object.values(j).find(Array.isArray) || []; await writeFile(`${SAMPLE}/${id}-${k}.sample.json`, JSON.stringify(arr.slice(0, 5), null, 1)); } catch (e) {} }
      out.push({ ...f, name, ext, text }); }
    catch (e) { log('  下載失敗', f.url, e.message); } }
  await writeFile(`${SAMPLE}/${id}-meta.json`, JSON.stringify(meta, null, 1)); return out; }
function parseCSV(text) { const rows = []; let row = [], cur = '', q = false; const first = text.slice(0, text.indexOf('\n') + 1 || 2000), sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ','; // 臺北市號誌位置是 tab 分隔
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(v => v !== '')) rows.push(row); row = []; } else cur += c; }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim()); return rows.map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()]))); }

// ── 幾何 ──
function simplify(pts, tol) { if (pts.length <= 2) return pts; const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); const [ax, az] = pts[a], [bx, bz] = pts[b], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1e-9; let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dz - (pts[i][1] - az) * dx) / L; if (d > best) { best = d; bi = i; } }
    if (best > tol) { keep[bi] = 1; st.push([a, bi], [bi, b]); } }
  return pts.filter((_, i) => keep[i]); }
const ringArea = r => { let s = 0; for (let i = 0; i < r.length; i++) { const [x1, z1] = r[i], [x2, z2] = r[(i + 1) % r.length]; s += x1 * z2 - x2 * z1; } return s / 2; };
// 多邊形關係：把 outer／inner 成員的線段接成封閉環
function rings(members) { const segs = members.filter(m => m.type === 'way' && m.geometry).map(m => ({ role: m.role || 'outer', pts: m.geometry.map(g => proj(g.lat, g.lon)) })); const out = { outer: [], inner: [] };
  for (const role of ['outer', 'inner']) { const pool = segs.filter(s => (s.role === 'inner') === (role === 'inner')).map(s => s.pts.slice()); const key = p => p[0].toFixed(2) + ',' + p[1].toFixed(2);
    while (pool.length) { let ring = pool.pop(); for (let guard = 0; guard < 5000 && key(ring[0]) !== key(ring[ring.length - 1]); guard++) { const end = key(ring[ring.length - 1]); const i = pool.findIndex(s => key(s[0]) === end || key(s[s.length - 1]) === end); if (i < 0) break; let s = pool.splice(i, 1)[0]; if (key(s[0]) !== end) s = s.reverse(); ring = ring.concat(s.slice(1)); }
      if (ring.length >= 4) out[role].push(ring); } }
  return out; }
// 封閉環頭尾是同一點，直接簡化會整圈縮成一條線：從離起點最遠的點切成兩半各自簡化
function simplifyRing(r, tol) { let k = 0, best = -1; for (let i = 1; i < r.length; i++) { const d = Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]); if (d > best) { best = d; k = i; } } if (k === 0) return r; return simplify(r.slice(0, k + 1), tol).concat(simplify(r.slice(k), tol).slice(1)); }
const packRing = (r, tol) => { const s = simplifyRing(r, tol); if (s.length < 4) return null; return s.flatMap(([x, z]) => [dm(x), dm(z)]); };
// 外環配內環（內環的第一點落在哪個外環裡）
const inside = ([x, z], r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
function polys(elements, tol, minArea) { const res = [];
  const add = (outer, inner) => { for (const o of outer) { const a = Math.abs(ringArea(o)); if (a < minArea) continue; const po = packRing(o, tol); if (!po) continue; const holes = inner.filter(h => inside(h[0], o) && Math.abs(ringArea(h)) > minArea / 4).map(h => packRing(h, tol)).filter(Boolean); res.push([po, ...holes]); } };
  for (const e of elements) { if (e.type === 'way' && e.geometry) { const r = e.geometry.map(g => proj(g.lat, g.lon)); if (r.length >= 4) add([r], []); } else if (e.type === 'relation' && e.members) { const { outer, inner } = rings(e.members); add(outer, inner); } }
  return res; }

// ── 道路圖 ──
const CLS = { motorway: 0, motorway_link: 0, trunk: 1, trunk_link: 1, primary: 2, primary_link: 2, secondary: 3, secondary_link: 3, tertiary: 4, tertiary_link: 4, unclassified: 5, residential: 5, living_street: 5, service: 6 };
const SPEED = [80, 60, 50, 50, 40, 30, 20], LANES = [3, 2, 2, 2, 1, 1, 1];
const isYes = v => v === 'yes' || v === '1' || v === 'true';
function buildNet(ways, signalNodes) {
  ways = ways.filter(w => { const t = w.tags || {}; if (!(t.highway in CLS) || !w.geometry || w.nodes.length < 2) return false; if (t.area === 'yes' || t.access === 'private' || t.access === 'no') return false;
    if (t.highway === 'service' && t.service && t.service !== 'alley') return false; return true; }); // service 只留巷道（不要停車場走道、車道）
  const use = new Map(); for (const w of ways) w.nodes.forEach((id, i) => use.set(id, (use.get(id) || 0) + (i === 0 || i === w.nodes.length - 1 ? 2 : 1)));
  const isNode = id => use.get(id) >= 2 || signalNodes.has(id);
  const nodeIdx = new Map(), nodeXY = [], nodeCls = [];
  const nodeOf = (id, p, cls) => { let k = nodeIdx.get(id); if (k == null) { k = nodeXY.length; nodeIdx.set(id, k); nodeXY.push(p); nodeCls.push(cls); } else nodeCls[k] = Math.min(nodeCls[k], cls); return k; };
  const names = [], nameIdx = new Map(), nm = s => { if (!s) return -1; let k = nameIdx.get(s); if (k == null) { k = names.length; nameIdx.set(s, k); names.push(s); } return k; };
  const edges = [];
  for (const w of ways) { const t = w.tags, cls = CLS[t.highway], pts = w.geometry.map(g => proj(g.lat, g.lon));
    let ow = isYes(t.oneway) || t.highway === 'motorway' || t.junction === 'roundabout' ? 1 : t.oneway === '-1' ? -1 : 0; if (t.oneway === 'no') ow = 0;
    const tot = parseInt(t.lanes) || 0, lf = parseInt(t['lanes:forward']) || 0, lb = parseInt(t['lanes:backward']) || 0;
    let fw = lf || (ow ? tot || LANES[cls] : Math.max(1, Math.ceil((tot || LANES[cls] * 2) / 2))), bw = ow ? 0 : lb || (tot ? Math.max(1, tot - fw) : LANES[cls]);
    const sp = parseInt(t.maxspeed) || SPEED[cls], lv = isYes(t.bridge) || t.bridge === 'viaduct' ? Math.max(1, parseInt(t.layer) || 1) : t.tunnel && t.tunnel !== 'no' ? -1 : 0, name = nm(t.name || t.ref || '');
    let start = 0;
    for (let i = 1; i < w.nodes.length; i++) { if (i < w.nodes.length - 1 && !isNode(w.nodes[i])) continue;
      let seg = simplify(pts.slice(start, i + 1), 0.8), a = nodeOf(w.nodes[start], pts[start], cls), b = nodeOf(w.nodes[i], pts[i], cls), f = fw, r = bw;
      if (ow === -1) { seg = seg.slice().reverse(); [a, b] = [b, a]; r = 0; } if (a !== b) edges.push({ a, b, cls, f, r, sp, name, lv, seg, osm: w.id });
      start = i; } }
  return { nodeIdx, nodeXY, nodeCls, edges, names }; }
// 輸出：主要道路與巷弄分兩個檔；巷弄檔的節點接在主要道路的節點後面編號
function packNet(net) {
  const main = net.edges.filter(e => e.cls <= 4), minor = net.edges.filter(e => e.cls > 4);
  const order = new Map(), xy = [];
  const take = list => { for (const e of list) for (const n of [e.a, e.b]) if (!order.has(n)) { order.set(n, order.size); xy.push(net.nodeXY[n]); } };
  take(main); const nMain = order.size; take(minor);
  const pk = (list, from, to) => ({ nodeBase: from, nodes: xy.slice(from, to).flatMap(([x, z]) => [dm(x), dm(z)]),
    edges: list.map(e => { const a = order.get(e.a), b = order.get(e.b), [x0, z0] = net.nodeXY[e.a]; const mid = e.seg.slice(1, -1).flatMap(([x, z]) => [dm(x - x0), dm(z - z0)]); return [a, b, e.cls, e.f, e.r, e.sp, e.name, e.lv, mid]; }) });
  return { main: { ...pk(main, 0, nMain), names: net.names }, minor: pk(minor, nMain, xy.length), order, nMain }; }

// ── 號誌 ──
const rowsOf = f => { try { if (f.ext === 'csv') return parseCSV(f.text); const j = JSON.parse(f.text); return Array.isArray(j) ? j : Object.values(j).find(Array.isArray) || []; } catch (e) { log('  解析失敗', f.name, e.message); return []; } };
const cleanName = s => String(s || '').trim().replace(/[\s　]+/g, '／'); // 「老泉街　　　　防汛道路」→「老泉街／防汛道路」
// 號誌位置：121890（流水號、地點、行政區、WGS 經緯度）與 145720 的 CSV（icid、路口名稱、經緯度——有 icid 才對得到時制）
function signalPositions(files) { const out = [];
  for (const f of files) { if (f.ext !== 'csv') continue; const rows = rowsOf(f); if (!rows.length) continue; const keys = Object.keys(rows[0]);
    const kLon = keys.find(k => /經度|^lon|lng|longitude/i.test(k)), kLat = keys.find(k => /緯度|^lat|latitude/i.test(k)), kName = keys.find(k => /地點|路口名稱|icname/i.test(k)), kId = keys.find(k => /^icid$/i.test(k)), kDist = keys.find(k => /行政區/.test(k)), kGrp = keys.find(k => /群組/.test(k));
    log(`  號誌位置 ${f.name}：${rows.length} 列，經度=${kLon} 緯度=${kLat} 名稱=${kName} 編號=${kId || '無'}`); if (!kLon || !kLat) continue;
    for (const r of rows) { const lon = parseFloat(r[kLon]), lat = parseFloat(r[kLat]); if (!(lat > 24.8 && lat < 25.4 && lon > 121.3 && lon < 121.8)) continue; out.push({ id: kId ? r[kId] : '', name: kName ? cleanName(r[kName]) : '', dist: kDist ? r[kDist] : '', grp: kGrp ? r[kGrp] : '', lat, lon }); } }
  return out; }
// 時制：145720 的兩個 JSON。一個是每個路口每種日型的時段表（segmenttype 1～7，當成週一～週日；subsegment：幾點幾分起用第幾號計畫），
// 一個是每個路口的各號時制計畫（cycletime 週期、offset 時差、direction 第一時相的方向〔0/2/4/6＝北東南西〕、subplan 各時相的綠黃全紅秒數）。
// 時相合成「階段」：黃燈 0 的時相是接到下一個時相的前導或延續，遇到有黃燈的才算一個階段結束。
function timingTables(files) { const sched = new Map(), plans = new Map(); const pidOf = r => +(r['planid（SeqNo）'] ?? r['planid(SeqNo)'] ?? r.planid ?? r.SeqNo);
  for (const f of files) { if (f.ext !== 'json') continue; const rows = rowsOf(f); log(`  時制 ${f.name}：${rows.length} 筆`);
    for (const r of rows) { const id = r.icid; if (!id) continue;
      if (Array.isArray(r.subsegment)) { const st = +r.segmenttype; if (!(st >= 1 && st <= 7)) continue; let m = sched.get(id); if (!m) sched.set(id, m = {});
        m[st] = r.subsegment.map(x => { const tm = String(x.time || '').padStart(4, '0'); return [+tm.slice(0, 2) * 60 + +tm.slice(2, 4), pidOf(x)]; }).filter(a => Number.isFinite(a[0]) && Number.isFinite(a[1])).sort((a, b) => a[0] - b[0]); }
      else if (Array.isArray(r.subplan)) { const pid = pidOf(r), C = +r.cycletime; if (!(C >= 20 && C <= 300) || !Number.isFinite(pid)) continue;
        // 每個階段：[綠, 黃, 全紅, 行人綠閃, 行人紅, 最短綠]（行人與最短綠燈拿來檢查時制合不合理）
        const stages = []; let g = 0, pf = 0, pr = 0, mg = 0;
        for (const p of r.subplan.slice().sort((x, y) => x.subphaseid - y.subphaseid)) { const y = +p.yellow || 0, ar = +p.allred || 0; g += (+p.green || 0) + (y ? 0 : ar); mg += +p.mingreen || 0; pf = Math.max(pf, +p.pedgreenflash || 0); pr = Math.max(pr, +p.pedred || 0); if (y > 0) { stages.push([g, y, ar, pf, pr, mg]); g = 0; pf = 0; pr = 0; mg = 0; } }
        if (g > 0) { if (stages.length) stages[stages.length - 1][0] += g; else stages.push([g, 0, 0, pf, pr, mg]); } if (!stages.length) continue;
        const lost = stages.reduce((a, x) => a + x[1] + x[2], 0), grn = stages.reduce((a, x) => a + x[0], 0); if (grn + lost !== C && grn > 0) { const k = (C - lost) / grn; for (const x of stages) x[0] = Math.max(1, Math.round(x[0] * k)); } // 總和對不上週期就照比例調綠燈
        let m = plans.get(id); if (!m) plans.set(id, m = {}); m[pid] = [C, +r.offset || 0, +r.direction || 0, stages]; } } }
  return { sched, plans }; }
// 一個路口的時制打包：days＝不重複的時段表，dmap＝週一～週日各用哪一個，plans＝各號計畫
function packTiming(id, T) { const S = T.sched.get(id), P = T.plans.get(id); if (!P) return null; const days = [], dmap = [];
  for (let d = 1; d <= 7; d++) { const s = S && S[d]; if (!s || !s.length) { dmap.push(-1); continue; } const k = JSON.stringify(s); let i = days.findIndex(x => JSON.stringify(x) === k); if (i < 0) { i = days.length; days.push(s); } dmap.push(i); }
  return { days, dmap, plans: P }; }

async function main() {
  await mkdir(RAW, { recursive: true }); await mkdir(SAMPLE, { recursive: true });
  // 1. 道路、號誌節點、市界、行政區
  const area = 'area["ISO3166-2"="TW-TPE"]->.tp;';
  const roads = await overpass(`[out:json][timeout:900][maxsize:2000000000];${area}way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service)$"](area.tp);out body geom qt;`, '道路', 5000);
  const sigEls = await overpass(`[out:json][timeout:300];node["highway"="traffic_signals"](${BBOX});out body qt;`, '號誌節點', 200);
  const bound = await overpass(`[out:json][timeout:300];relation["ISO3166-2"="TW-TPE"];out geom;`, '市界');
  const dists = await optional('行政區', () => overpass(`[out:json][timeout:300];${area}relation["boundary"="administrative"]["name"~"區$"](area.tp);out geom;`, '行政區'), () => []);
  const water = await optional('河川水域', () => overpass(`[out:json][timeout:600];(way["natural"="water"](${BBOX});relation["natural"="water"](${BBOX});way["waterway"="riverbank"](${BBOX});relation["waterway"="riverbank"](${BBOX}););out geom qt;`, '河川水域', 50), () => null);
  const green = await optional('綠地', () => overpass(`[out:json][timeout:600];(way["leisure"="park"](${BBOX});relation["leisure"="park"](${BBOX});way["landuse"~"^(forest|grass|recreation_ground|meadow)$"](${BBOX});relation["landuse"~"^(forest|grass|recreation_ground)$"](${BBOX});way["natural"~"^(wood|scrub)$"](${BBOX});relation["natural"~"^(wood|scrub)$"](${BBOX}););out geom qt;`, '綠地', 200), () => null);

  const mrtR = await optional('捷運路線', () => overpass(`[out:json][timeout:300];relation["route"="subway"](${BBOX});out geom;`, '捷運路線', 3), () => null);
  const mrtS = await optional('捷運車站', () => overpass(`[out:json][timeout:300];(node["railway"="station"]["station"="subway"](${BBOX});node["public_transport"="station"]["subway"="yes"](${BBOX}););out body;`, '捷運車站', 20), () => []);
  const tpRing = bound.filter(e => e.type === 'relation').flatMap(e => rings(e.members).outer).sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0] || null;
  // 建物：範圍切 4×4 分批抓（一次抓全市容易逾時），用 way id 去重，只留中心點在市界內的
  const [bS, bW, bN, bE] = BBOX.split(',').map(Number), K = 4, bld = [], seenB = new Set();
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) { const cell = [bS + (bN - bS) * i / K, bW + (bE - bW) * j / K, bS + (bN - bS) * (i + 1) / K, bW + (bE - bW) * (j + 1) / K].map(v => v.toFixed(5)).join(',');
    let els = []; try { els = await overpass(`[out:json][timeout:600];way["building"](${cell});out geom qt;`, `建物${i}${j}`, 1); } catch (e) { log('  建物這一格失敗：', e.message); }
    for (const w of els) { if (w.type !== 'way' || !w.geometry || w.geometry.length < 4 || seenB.has(w.id)) continue; seenB.add(w.id); const r = w.geometry.map(g => proj(g.lat, g.lon)); let cx = 0, cz = 0; for (const [x, z] of r) { cx += x; cz += z; } cx /= r.length; cz /= r.length;
      if (tpRing && !inside([cx, cz], tpRing)) continue; const area = Math.abs(ringArea(r)); if (area < 12) continue; const t = w.tags || {};
      const lv = parseFloat(t['building:levels']), hh = parseFloat(t.height); let h = Number.isFinite(hh) ? hh : Number.isFinite(lv) ? lv * 3.3 + 1 : null;
      if (h == null) { const ty = t.building; h = /^(house|detached|bungalow)$/.test(ty) ? 7 : /^(roof|garage|garages|shed|kiosk|carport|hut)$/.test(ty) ? 3.5 : /^(industrial|warehouse)$/.test(ty) ? 9 : area > 3000 ? 30 : area > 800 ? 20 : area > 250 ? 15 : 12; } // 台北的公寓大多 4～5 樓
      bld.push({ cx, cz, h: Math.max(3, Math.min(510, Math.round(h))), r: simplifyRing(r, 0.4) }); } }
  log(`建物：${bld.length} 棟`);
  const signalNodes = new Map(sigEls.filter(e => e.type === 'node').map(e => [e.id, e]));
  const net = buildNet(roads, signalNodes); const P = packNet(net);
  log(`道路圖：${net.nodeXY.length} 個節點、${net.edges.length} 段（主要 ${P.main.edges.length}、巷弄 ${P.minor.edges.length}）`);

  // 2. 臺北市號誌位置與時制
  let posFiles = [], planFiles = [];
  try { posFiles = await govDataset(121890); } catch (e) { log('號誌位置下載失敗', e.message); }
  try { planFiles = await govDataset(145720); } catch (e) { log('時制計畫下載失敗', e.message); }
  const tpPos = signalPositions([...planFiles, ...posFiles]), T = timingTables(planFiles); // 有 icid 的位置（時制的 CSV）排前面，聚類時編號會留在路口上

  // 3. 號誌路口：OSM 號誌節點與臺北市號誌位置，30 公尺內的聚成一個路口（雙向分隔的大路口常有好幾個號誌節點）
  const pts = [];
  for (const e of signalNodes.values()) { const k = P.order.get(net.nodeIdx.get(e.id)); if (k == null) continue; const [x, z] = proj(e.lat, e.lon); pts.push({ x, z, node: k, src: 'osm' }); }
  for (const s of tpPos) { const [x, z] = proj(s.lat, s.lon); pts.push({ x, z, src: 'tp', id: s.id, name: s.name, dist: s.dist, grp: s.grp }); }
  const cell = 40, grid = new Map(), gk = (x, z) => Math.floor(x / cell) + ',' + Math.floor(z / cell);
  const ctrls = [];
  for (const p of pts) { let best = null, bd = 30; const cx = Math.floor(p.x / cell), cz = Math.floor(p.z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const c of grid.get((cx + dx) + ',' + (cz + dz)) || []) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = c; } }
    if (!best) { best = { x: p.x, z: p.z, n: 0, nodes: new Set(), src: new Set(), ids: [], names: [], grp: '' }; ctrls.push(best); const k = gk(p.x, p.z); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(best); }
    best.x = (best.x * best.n + p.x) / (best.n + 1); best.z = (best.z * best.n + p.z) / (best.n + 1); best.n++; best.src.add(p.src); if (p.node != null) best.nodes.add(p.node); if (p.id) best.ids.push(p.id); if (p.name) best.names.push(p.name); if (p.grp && !best.grp) best.grp = p.grp; }
  // 只有臺北市位置、沒有 OSM 號誌節點的：接到 35 公尺內最近、而且是路口（3 條路以上）的節點
  const deg = new Map(); for (const e of net.edges) for (const n of [e.a, e.b]) deg.set(n, (deg.get(n) || 0) + 1);
  const ngrid = new Map(); for (const [osmId, k] of net.nodeIdx) { if ((deg.get(k) || 0) < 3) continue; const o = P.order.get(k); if (o == null) continue; const [x, z] = net.nodeXY[k], g = gk(x, z); if (!ngrid.has(g)) ngrid.set(g, []); ngrid.get(g).push({ o, x, z }); }
  for (const c of ctrls) { if (c.nodes.size) continue; const cx = Math.floor(c.x / cell), cz = Math.floor(c.z / cell); let best = null, bd = 35;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const n of ngrid.get((cx + dx) + ',' + (cz + dz)) || []) { const d = Math.hypot(n.x - c.x, n.z - c.z); if (d < bd) { bd = d; best = n; } }
    if (best) c.nodes.add(best.o); }
  // 時制計畫：用 icid 對
  let matched = 0;
  const signals = ctrls.filter(c => c.nodes.size).map((c, i) => { const id = c.ids.find(x => T.plans.has(x)) || c.ids[0] || ''; const timing = id ? packTiming(id, T) : null; if (timing) matched++;
    return { i, x: dm(c.x), z: dm(c.z), nodes: [...c.nodes], src: [...c.src], id, name: c.names[0] || '', grp: c.grp || '', timing }; });
  log(`號誌路口：${signals.length} 處（OSM 號誌節點 ${signalNodes.size}、臺北市位置 ${tpPos.length}；時制計畫 ${T.plans.size} 個路口，對到 ${matched}）`);
  { const ex = signals.find(x => x.timing && /忠孝/.test(x.name)) || signals.find(x => x.timing); if (ex) log('  範例：', JSON.stringify(ex).slice(0, 1200)); }

  // 4. 市界、行政區、水域、綠地
  const bRings = bound.filter(e => e.type === 'relation').flatMap(e => rings(e.members).outer).sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)));
  const districts = dists.filter(e => e.type === 'relation' && DISTRICTS.includes(e.tags && e.tags.name)).map(e => { const r = rings(e.members).outer.sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0]; if (!r) return null; let sx = 0, sz = 0; for (const [x, z] of r) { sx += x; sz += z; } return { name: e.tags.name, x: dm(sx / r.length), z: dm(sz / r.length), ring: packRing(r, 15) }; }).filter(Boolean);
  const waterP = water ? polys(water, 4, 400) : (await prevJSON('water.json', { polys: [] })).polys, greenP = green ? polys(green, 6, 1500) : (await prevJSON('green.json', { polys: [] })).polys;
  const xs = P.main.nodes.filter((_, i) => i % 2 === 0), zs = P.main.nodes.filter((_, i) => i % 2 === 1);
  const meta = { origin: ORIGIN, kx: KX, kz: KZ, unit: 0.1, bbox: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], boundary: bRings[0] ? packRing(bRings[0], 10) : null, districts,
    counts: { nodes: P.order.size, mainEdges: P.main.edges.length, minorEdges: P.minor.edges.length, signals: signals.length, signalsWithPlan: matched, tpPositions: tpPos.length, osmSignals: signalNodes.size, timingIntersections: T.plans.size, water: waterP.length, green: greenP.length },
    generated: new Date().toISOString(),
    sources: ['© OpenStreetMap contributors（ODbL）', '臺北市號誌位置（臺北市交通管制工程處，政府資料開放授權條款第 1 版）', '臺北市路口號誌時制計畫（臺北市政府交通局，政府資料開放授權條款第 1 版）'] };
  const w = (f, o) => writeFile(`${OUT}/${f}`, JSON.stringify(o)).then(() => log(`寫出 ${f}`));
  // 捷運：每條線（依 ref 或名稱）收集不重複的路段折線，顏色用 OSM 的 colour
  const MRT_COL = { R: '#e3002c', BL: '#0070bd', BR: '#c48c31', G: '#008659', O: '#f8b61c', Y: '#ffdb00' }, lines = new Map();
  for (const r of mrtR || []) { if (r.type !== 'relation') continue; const t = r.tags || {}, ref = String(t.ref || '').replace(/\s/g, '') || t.name || 'MRT', key = ref.match(/^[A-Z]+/) ? ref.match(/^[A-Z]+/)[0] : ref; let L = lines.get(key);
    if (!L) { L = { ref: key, name: String(t.name || '').replace(/[（(].*$/, '').replace(/\s*[:：].*$/, ''), color: t.colour || MRT_COL[key] || '#888888', ways: new Map() }; lines.set(key, L); }
    for (const m of r.members || []) if (m.type === 'way' && m.geometry && m.role !== 'platform' && !L.ways.has(m.ref)) L.ways.set(m.ref, m.geometry.map(g => proj(g.lat, g.lon))); }
  const stByName = new Map(); for (const n of mrtS) { const nm = n.tags && (n.tags.name || n.tags['name:zh']); if (!nm || n.lat == null) continue; const [x, z] = proj(n.lat, n.lon); const a = stByName.get(nm) || []; a.push([x, z]); stByName.set(nm, a); }
  const mrt = { lines: [...lines.values()].map(L => ({ ref: L.ref, name: L.name, color: L.color, segs: [...L.ways.values()].map(p => simplify(p, 3).flatMap(([x, z]) => [dm(x), dm(z)])) })),
    stations: [...stByName].map(([name, ps]) => ({ name: name.replace(/站$/, ''), x: dm(ps.reduce((a, p) => a + p[0], 0) / ps.length), z: dm(ps.reduce((a, p) => a + p[1], 0) / ps.length) })) };
  if (!mrtR) Object.assign(mrt, await prevJSON('mrt.json', mrt)); log(`捷運：${mrt.lines.length} 條線、${mrt.stations.length} 站`); await w('mrt.json', mrt);
  // 建物分格：1 公里一格，座標存成這一格原點起算的 0.5 公尺整數
  const TILE = 1000, tiles = new Map(); if (bld.length > 1000) { await rm(`${OUT}/bld`, { recursive: true, force: true }); } else log('建物太少（Overpass 失敗？），沿用上一次的建物格'); await mkdir(`${OUT}/bld`, { recursive: true });
  for (const b of bld) { const tx = Math.floor(b.cx / TILE), tz = Math.floor(b.cz / TILE), k = tx + '_' + tz; let T = tiles.get(k); if (!T) tiles.set(k, T = { o: [tx * TILE, tz * TILE], b: [] }); T.b.push([b.h, ...b.r.slice(0, -1).flatMap(([x, z]) => [Math.round((x - T.o[0]) * 2), Math.round((z - T.o[1]) * 2)])]); }
  if (bld.length > 1000) { for (const [k, T] of tiles) await writeFile(`${OUT}/bld/${k}.json`, JSON.stringify(T));
  await w('bld/index.json', { size: TILE, unit: 0.5, tiles: Object.fromEntries([...tiles].map(([k, T]) => [k, T.b.length])) }); meta.counts.buildings = bld.length; meta.counts.buildingTiles = tiles.size; } meta.counts.mrtStations = mrt.stations.length;
  await w('meta.json', meta); await w('net-main.json', P.main); await w('net-minor.json', P.minor); await w('signals.json', { signals }); await w('water.json', { polys: waterP }); await w('green.json', { polys: greenP });
  log('完成', JSON.stringify(meta.counts)); }
main().catch(e => { console.error(e); process.exit(1); });
