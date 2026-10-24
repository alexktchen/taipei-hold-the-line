// 用法：cd scripts/stress && npm install && node sim.js game 10,20,40,60,100 25
//   第 1 個參數：game（照遊戲節奏送位置）或 idle（只上線不送）；第 2 個：每階段人數；第 3 個：每階段量測秒數
//   金鑰從 ../../js/backend.js 讀（anon 公開金鑰）。有 HTTPS_PROXY 就走 proxy。
//   注意：會真的佔用 Supabase 免費方案的連線數與每月訊息額度；不要超過 200 人（會擋到真實訪客）。
// 壓力測試：模擬 N 個玩家（每人 1 條 WebSocket、3 個頻道），用獨立的 stress-* 頻道，不影響正式站的線上人數與地圖。
const fs = require('fs'); const WebSocket = require('ws'); const { HttpsProxyAgent } = require('https-proxy-agent');
const be = fs.readFileSync(require('path').join(__dirname, '../../js/backend.js'), 'utf8'); const URL_ = be.match(/supabaseUrl:\s*'([^']+)'/)[1], KEY = be.match(/supabaseAnonKey:\s*'([^']+)'/)[1];
const agent = process.env.HTTPS_PROXY ? new HttpsProxyAgent(process.env.HTTPS_PROXY) : undefined; class PWS extends WebSocket { constructor(u, p, o) { super(u, p, { ...(o || {}), ...(agent ? { agent } : {}) }); } }
// realtime-js 在自訂 transport 時不會掛事件處理（函式庫 bug），改成把走 proxy 的 WebSocket 設成全域，讓它走正常路徑
globalThis.WebSocket = PWS; const { createClient } = require('@supabase/supabase-js');
const RUN = 'stress-' + Date.now().toString(36); const MODE = process.argv[2] || 'game'; // game：照遊戲節奏送位置；idle：只上線不送
const STEPS = (process.argv[3] || '10,25,40,60').split(',').map(Number); const HOLD = Number(process.argv[4] || 25);
const MP = { sendEvery: 1, sendPerPlayer: 0.25, sendMax: 8 };
const clients = []; const ev = { errors: [], statuses: {} }; const sleep = ms => new Promise(r => setTimeout(r, ms));
function bump(k) { ev.statuses[k] = (ev.statuses[k] || 0) + 1; }
async function addClient(i) {
  const sb = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 50 } } });
  const c = { i, sb, rx: 0, lat: [], sent: 0, ok: 0 };
  const db = sb.channel(RUN + '-db').on('postgres_changes', { event: '*', schema: 'public', table: 'heroes' }, () => {});
  const on = sb.channel(RUN + '-online', { config: { presence: { key: 'sim-' + i } } }); on.on('presence', { event: 'sync' }, () => { c.seen = Object.keys(on.presenceState()).length; });
  const play = sb.channel(RUN + '-play', { config: { broadcast: { self: false } } }); play.on('broadcast', { event: 'm' }, ({ payload }) => { c.rx++; if (payload.ts) c.lat.push(Date.now() - payload.ts); });
  for (const [name, ch] of [['db', db], ['online', on], ['play', play]]) ch.subscribe((st, err) => { bump(name + ':' + st); if (st === 'SUBSCRIBED') { c.ok++; if (name === 'online') on.track({ nick: 'sim' + i, phase: 'round' }).catch(e => ev.errors.push('track ' + e.message)); } else if (st !== 'CLOSED') ev.errors.push(`${name} ${st} ${err ? err.message : ''}`.trim()); });
  sb.realtime.onError?.(); c.play = play; clients.push(c); }
function loop() { if (MODE !== 'game') return; for (const c of clients) { const n = clients.length; const every = Math.min(MP.sendMax, Math.max(MP.sendEvery, n * MP.sendPerPlayer)) * 1000; if (!c.next) c.next = Date.now() + Math.random() * every; if (Date.now() >= c.next && c.ok >= 3) { c.next = Date.now() + every; c.sent++; c.play.send({ type: 'broadcast', event: 'm', payload: { t: 'p', id: 'sim-' + c.i, ts: Date.now(), x: Math.random() * 10, z: Math.random() * 10, r: 1 } }).then(r => { if (r !== 'ok') bump('send:' + r); }).catch(e => bump('sendErr')); } } }
const timer = setInterval(loop, 100);
(async () => {
  console.log('run', RUN, 'mode', MODE, 'steps', STEPS.join(','));
  for (const N of STEPS) {
    const t0 = Date.now(); while (clients.length < N) { await addClient(clients.length); if (clients.length % 15 === 0) await sleep(1000); }
    await sleep(8000); const joined = clients.filter(c => c.ok >= 3).length;
    for (const c of clients) { c.rx = 0; c.lat = []; c.sent = 0; } ev.errors = []; ev.statuses = {}; const m0 = Date.now(); await sleep(HOLD * 1000); const secs = (Date.now() - m0) / 1000;
    const sent = clients.reduce((a, c) => a + c.sent, 0), rx = clients.reduce((a, c) => a + c.rx, 0), expected = clients.reduce((a, c) => a + c.sent, 0) * (clients.length - 1);
    const lat = clients.flatMap(c => c.lat).sort((a, b) => a - b); const pct = p => lat.length ? lat[Math.floor(lat.length * p)] : null; const seen = clients.map(c => c.seen || 0); const seenMin = Math.min(...seen), seenMax = Math.max(...seen);
    const r = { N, joined, sendsPerSec: +(sent / secs).toFixed(1), deliveriesPerSec: +(rx / secs).toFixed(1), deliveryRatio: expected ? +(rx / expected).toFixed(3) : null, latP50: pct(0.5), latP95: pct(0.95), presenceSeen: `${seenMin}-${seenMax}`, errors: ev.errors.slice(0, 5), errorCount: ev.errors.length, statuses: ev.statuses };
    console.log(JSON.stringify(r));
    if (joined < N * 0.8 || (r.deliveryRatio !== null && r.deliveryRatio < 0.5)) { console.log('stop: capacity reached'); break; } }
  clearInterval(timer); for (const c of clients) await c.sb.removeAllChannels().catch(() => {}); console.log('cleaned up', clients.length); process.exit(0); })();
