/* 台北車流模擬：進入點。讀資料 → 鋪地與路 → 號誌 → 車流；依鏡頭高度分層顯示（拉遠只看幹道、拉近才有巷弄、建築、紅綠燈桿）。 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fetchJSON, createNet, addNet, nodeHeights, setbacks, edgeGrid, distToEdge, halfWidth, CLS_NAME } from './data.js';
import { createRoads, shared } from './roads.js';
import { createSignals } from './signals.js';
import { createSim } from './sim.js';
import { createGround, landMask, landmark101, createBuildings } from './city.js';
import { createCars, createLamps } from './view.js';
import { createMarkings } from './markings.js';
import { createDiag } from './diag.js';
import { createStory } from './story.js';

const $ = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const DATA = 'data/', TOUCH = matchMedia('(pointer:coarse)').matches, ld = msg => { $('ldMsg').textContent = msg; };
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TOUCH ? 1.5 : 2)); stage.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe3dccf); scene.fog = new THREE.Fog(0xe3dccf, 30000, 90000);
const camera = new THREE.PerspectiveCamera(40, 1, 2, 150000);
scene.add(new THREE.HemisphereLight(0xfff8ee, 0xb9ad9b, 1.6)); const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-0.5, 1, 0.35); scene.add(sun);
// 地圖式操作（同 MapControls）：左鍵／單指拖曳移動、右鍵拖曳旋轉、滾輪／雙指縮放
const controls = new OrbitControls(camera, renderer.domElement); controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }; controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }; controls.enableDamping = true; controls.dampingFactor = 0.09; controls.screenSpacePanning = false; controls.minDistance = 40; controls.maxDistance = 48000; controls.maxPolarAngle = 1.2; controls.zoomSpeed = 1.4;
function fit() { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); shared.uPx.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / h; }
fit(); addEventListener('resize', fit);
let fly = null; // 鏡頭飛到 { target, dist }
function look(x, z, dist, pol = 0.62, instant = false) { const tgt = new THREE.Vector3(x, 0, z), off = new THREE.Vector3(0, Math.cos(pol), Math.sin(pol)).multiplyScalar(dist);
  if (instant) { controls.target.copy(tgt); camera.position.copy(tgt).add(off); return; } fly = { t: 0, ft: controls.target.clone(), fp: camera.position.clone(), tt: tgt, tp: tgt.clone().add(off) }; }

// ── 狀態 ──
const net = createNet(); let meta, sigData, roads, sig, sim, cars, lamps, ground, buildings, grid, diag, story, masked = () => false;
const layer = { flow: true, signals: true, cars: true, buildings: true, names: true }; let speed = 1;
const taipeiWeekday = () => { const d = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', weekday: 'short' }).format(new Date()); return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(d) + 1; }; // 1～7＝週一～週日
const taipeiNow = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date()); const g = k => +p.find(x => x.type === k).value; return g('hour') * 3600 + g('minute') * 60 + g('second'); };

async function boot() {
  try { meta = await fetchJSON(DATA + 'meta.json'); } catch (e) { showEmpty(); return; }
  ld('鋪主要道路…'); const [main, water, green, sg] = await Promise.all([fetchJSON(DATA + 'net-main.json'), fetchJSON(DATA + 'water.json').catch(() => ({ polys: [] })), fetchJSON(DATA + 'green.json').catch(() => ({ polys: [] })), fetchJSON(DATA + 'signals.json').catch(() => ({ signals: [] }))]);
  sigData = sg; const [e0, e1] = addNet(net, main); nodeHeights(net); setbacks(net);
  ground = createGround(scene, meta, water, green); landmark101(scene, meta);
  roads = createRoads(scene, net); roads.add(e0, e1);
  grid = edgeGrid(net); for (let i = e0; i < e1; i++) grid.add(net.edges[i]);
  sig = createSignals(net, sigData); sig.setWeekday(taipeiWeekday()); sig.build();
  const laneKm = net.links.reduce((a, L) => a + L.lanes * L.len, 0) / 1000, cap = TOUCH ? 5000 : 12000;
  sim = createSim(net, sig, { t0: taipeiNow(), base: Math.min(cap, Math.round(laneKm * 4)) }); sim.rebuildSpawn(); sim.scatter(sim.demand());
  cars = createCars(scene, cap * 1.2); lamps = createLamps(scene, net, sig); sig.choose(sim.t);
  diag = createDiag(net, sig, sim); story = createStory({ net, sim, sig, diag, meta, look, controls, labelEl: $('labels'), pick: p => { picked = p; renderInspect(); }, pickedRoad: () => picked && picked.kind === 'road' ? picked.e : null,
    project: (x, z) => { v3.set(x, 0, z).project(camera); if (v3.z > 1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) return null; return [(v3.x + 1) / 2 * stage.clientWidth, (1 - v3.y) / 2 * stage.clientHeight]; } });
  controls.addEventListener('start', () => story.stopDirector()); // 自己動鏡頭就離開導播
  const c = ground.center; look(c.x, c.z + 1500, 30000, 0.55, true);
  setupLabels(); renderStats(); buildUI();
  $('loading').classList.add('done'); setTimeout(() => $('loading').remove(), 500);
  try { if (!localStorage.getItem('pi-traffic-help')) { $('help').hidden = false; localStorage.setItem('pi-traffic-help', '1'); } } catch (e) {}
  // 巷弄背景載入：接上道路圖、重算號誌路口、重排車子出現的地方
  fetchJSON(DATA + 'net-minor.json').then(minor => { const [m0, m1] = addNet(net, minor); nodeHeights(net); setbacks(net); roads.add(m0, m1); for (let i = m0; i < m1; i++) grid.add(net.edges[i]);
    sig.build(); sig.choose(sim.t); diag.checkRules(); story.render(); marks && marks.reset(); lamps.dispose(); lamps = createLamps(scene, net, sig); sim.rebuildSpawn(); masked = landMask(meta, water, green); renderStats(); }).catch(e => console.warn('巷弄資料', e));
  requestAnimationFrame(frame); }
function showEmpty() { $('loading').classList.add('done'); const el = $('empty'); el.hidden = false;
  el.innerHTML = `<h2>資料還在準備</h2><p>道路與號誌資料由 GitHub Actions「台北車流資料」整理後放進 <code>traffic/data/</code>，跑完重新整理就會出現。</p><p><a href="https://github.com/alexktchen/taipei-hold-the-line/actions/workflows/traffic-data.yml" target="_blank" rel="noopener">看資料整理進度</a>・<a href="../">回萬安政策島</a></p>`; }

// ── 畫面上的字：行政區（拉遠）、主要道路路名（中距離）、台北 101 ──
const labelEl = $('labels'); let labels = [];
function setupLabels() { const add = (txt, x, z, cls, min, max, prio) => { const el = document.createElement('div'); el.className = 'lbl ' + cls; el.textContent = txt; labelEl.appendChild(el); labels.push({ el, p: new THREE.Vector3(x, 0, z), min, max, prio, w: 0, h: 0 }); };
  for (const d of meta.districts || []) add(d.name, d.x * 0.1, d.z * 0.1, 'district', 3500, 1e9, 3);
  const lat = 25.03362, lon = 121.56461; add('台北 101', (lon - meta.origin.lon) * meta.kx, -(lat - meta.origin.lat) * meta.kz, 'mark', 0, 1e9, 4);
  // 路名：同名的路每 900 公尺最多一個
  const byName = new Map(); for (const e of net.edges) { if (e.cls > 3 || e.name < 0 || e.len < 120 || e.lv < 0) continue; const nm = net.names[e.name]; if (!byName.has(nm)) byName.set(nm, []); byName.get(nm).push(e); }
  for (const [nm, es] of byName) { const placed = []; es.sort((a, b) => b.len - a.len); for (const e of es) { const k = Math.floor(e.pts.length / 4) * 2, x = e.pts[k], z = e.pts[k + 1]; if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 900)) continue; placed.push([x, z]); add(nm, x, z, 'road', 0, e.cls <= 2 ? 9000 : 4500, e.cls <= 2 ? 2 : 1); } } }
const v3 = new THREE.Vector3();
function updateLabels(dist) { const w = stage.clientWidth, h = stage.clientHeight, boxes = []; const vis = [];
  for (const L of labels) { const on = dist >= L.min && dist <= L.max && (layer.names || L.el.classList.contains('district')); if (!on) { L.el.style.display = 'none'; continue; } v3.copy(L.p).project(camera); if (v3.z > 1 || Math.abs(v3.x) > 1.1 || Math.abs(v3.y) > 1.1) { L.el.style.display = 'none'; continue; } L.sx = (v3.x + 1) / 2 * w; L.sy = (1 - v3.y) / 2 * h; vis.push(L); }
  vis.sort((a, b) => b.prio - a.prio); let n = 0;
  for (const L of vis) { L.el.style.display = ''; if (!L.w) { L.w = L.el.offsetWidth; L.h = L.el.offsetHeight; } const b = [L.sx - L.w / 2 - 4, L.sy - L.h / 2 - 3, L.sx + L.w / 2 + 4, L.sy + L.h / 2 + 3];
    if (n > 60 || boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) { L.el.style.display = 'none'; continue; } boxes.push(b); n++; L.el.style.transform = `translate(${(L.sx - L.w / 2).toFixed(1)}px,${(L.sy - L.h / 2).toFixed(1)}px)`; } }

// ── 介面 ──
const fmtT = s => { s = ((s % 86400) + 86400) % 86400; return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`; };
function renderStats() { if (!sim) return; const S = sim.stats, withPlan = sig.list.filter(c => c.timing).length;
  $('stats').innerHTML = `<div><b>${S.n.toLocaleString()}</b><span>台車在路上</span></div><div><b>${Math.round(S.avg * 3.6)}</b><span>平均時速 km/h</span></div><div><b>${S.atRed.toLocaleString()}</b><span>台在等紅燈</span></div><div><b>${sig.list.length.toLocaleString()}</b><span>個號誌路口</span></div><div class="wide">時制：${withPlan.toLocaleString()} 個照臺北市公開的計畫，其餘推估</div>`;
  $('clock').textContent = fmtT(sim.t); $('clockDay').textContent = `週${'一二三四五六日'[sig.dayOf(sim.t) - 1]}・${speed ? speed + '× 模擬' : '暫停'}`; }
function buildUI() {
  document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b)); renderStats(); }));
  document.querySelector('[data-speed="1"]').classList.add('on');
  document.querySelectorAll('[data-hour]').forEach(b => b.addEventListener('click', () => { sim.t = +b.dataset.hour * 3600; roads.resetFlow(); renderStats(); }));
  $('volume').addEventListener('input', e => { sim.setVolume(+e.target.value); $('volumeN').textContent = Math.round(e.target.value * 100) + '%'; });
  document.querySelectorAll('[data-layer]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.layer; layer[k] = !layer[k]; b.setAttribute('aria-pressed', String(layer[k])); if (k === 'flow') roads.resetFlow(); $('legend').hidden = !layer.flow; }));
  $('btnCity').addEventListener('click', () => { const c = ground.center; look(c.x, c.z + 1500, 30000, 0.55); });
  $('btnCenter').addEventListener('click', () => look(0, 0, 900, 0.75));
  $('btnFull').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); });
  $('btnHelp').addEventListener('click', () => { $('help').hidden = false; }); $('helpClose').addEventListener('click', () => { $('help').hidden = true; });
  $('inspectClose').addEventListener('click', () => { picked = null; $('inspect').hidden = true; }); }

// ── 點路口／道路 ──
let marks = null, picked = null, down = null; const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => { if (!down || !sim) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null; if (moved > 6) return;
  const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); if (!ray.ray.intersectPlane(plane, hit)) return;
  const px = shared.uPx.value * camera.position.distanceTo(hit); let best = null, bd = Math.max(25, 14 * px);
  for (const c of sig.list) { const d = Math.hypot(c.x - hit.x, c.z - hit.z); if (d < bd) { bd = d; best = c; } }
  if (best) { picked = { kind: 'sig', c: best }; renderInspect(); return; }
  let be = null, bde = 1e9; for (const id of grid.near(hit.x, hit.z, Math.max(20, 10 * px))) { const ed = net.edges[id]; if (!roadVisible(ed.cls)) continue; const [d] = distToEdge(ed, hit.x, hit.z); const lim = Math.max(halfWidth(ed) + 4, 8 * px); if (d < lim && d < bde) { bde = d; be = ed; } }
  if (be) { picked = { kind: 'road', e: be }; renderInspect(); } else { picked = null; $('inspect').hidden = true; } });
const lampHtml = st => `<span class="lamp ${st === 'f' ? 'y' : st}"></span>`;
// 路口卡：兩個方向的即時指標（排隊、上次綠燈結束剩幾台、綠燈利用率）與時制體檢
function metricsHtml(c) { const M = diag.metrics(c); return `<div class="mrow">${[0, 1].map(ax => `<div>${esc(roadNames(c, ax))}<b>排 ${M[ax].q} 台・${Math.round(M[ax].len)} 公尺</b>上次綠燈結束剩 ${M[ax].resid} 台${M[ax].util != null ? `・綠燈利用 ${Math.round(Math.min(1, M[ax].util) * 100)}%` : ''}</div>`).join('')}</div>`; }
function findingsHtml(c) { const r = diag.rules.find(x => x.c === c); return r ? `<div class="findings"><b>📋 時制體檢</b>${r.found.map(x => `<span><i class="tag${diag.RULE[x.k].safe ? ' safe' : ''}">${diag.RULE[x.k].name}</i>${esc(x.t)}</span>`).join('')}</div>` : ''; }
$('inspectBody').addEventListener('click', e => { const b = e.target.closest('button[data-tune]'); if (!b || !picked || picked.kind !== 'sig') return; const c = picked.c, [k, v] = b.dataset.tune.split(':');
  if (k === 'reset') sig.setAdj(c, null); else if (k === 'flash') { c.flash = !c.flash; c.flashUntil = c.flash ? sim.t + 300 : 0; } else { const a = { ...(c.adj || {}) }; a[k] = (a[k] || 0) + +v; sig.setAdj(c, a); }
  sig.choose(sim.t); renderInspect(); story.toast(k === 'reset' ? '還原成臺北市公開的時制' : k === 'flash' ? (c.flash ? '這個路口號誌故障閃黃 5 分鐘' : '號誌恢復') : '已套用試算時制，看幾個週期的變化'); });
function roadNames(c, axis) { return [...new Set(c.appr.filter(L => L.axis === axis).map(L => net.edges[L.e].name).filter(n => n >= 0).map(n => net.names[n]))].slice(0, 3).join('、') || '未命名道路'; }
function renderInspect() { const box = $('inspect'), body = $('inspectBody'); if (!picked) { box.hidden = true; return; } box.hidden = false; const t = sim.t;
  if (picked.kind === 'sig') { const c = picked.c, p = c.plan, nm = c.name || `${roadNames(c, 0)}／${roadNames(c, 1)}`; if (!p) { body.innerHTML = `<h2>${esc(nm)}</h2><p class="sub">這個時段沒有時制資料</p>`; return; }
    const u = ((t - p.off) % p.C + p.C) % p.C, pct = x => (x / p.C * 100).toFixed(2);
    // 每個方向一條時間軸：綠、黃、紅
    const bar = axis => { const grp = p.flip ? 1 - axis : axis, w = p.win[grp]; const seg = []; const push = (a, b, k) => { if (b > a) seg.push([a, b, k]); };
      if (w[1] > w[0]) { push(0, Math.min(w[0], p.C), 'r'); push(w[0], Math.min(w[1], p.C), 'g'); push(w[1], Math.min(w[2], p.C), 'y'); push(Math.min(w[2], p.C), p.C, 'r'); if (w[2] > p.C) seg.unshift([0, w[2] - p.C, 'y']); } else push(0, p.C, 'r');
      return `<div class="phase">${seg.map(([a, b, k]) => `<i class="${k}" style="width:${pct(b - a)}%"></i>`).join('')}<span class="now" style="left:${pct(u)}%"></span></div>`; };
    const q = axis => c.appr.filter(L => L.axis === axis).reduce((a, L) => a + L.q.reduce((b, lane) => b + lane.filter(v => v.v < 0.5).length, 0), 0);
    const dir = axis => { const [st, left] = sig.state(c, axis, t); return `<div>${lampHtml(st)}<span><b>${esc(roadNames(c, axis))}</b><br>${st === 'g' ? '綠燈' : st === 'y' ? '黃燈' : '紅燈'} 剩 ${Math.ceil(left)} 秒・排隊 ${q(axis)} 台</span></div>`; };
    const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const planLine = p.real ? `第 ${p.pid} 號計畫（${hm(p.from)} 起）・週期 ${p.C} 秒・時差 ${p.off} 秒・${p.stages.length} 個階段（${p.stages.map(s => `${s[0]}+${s[1]}+${s[2]}`).join('、')} 秒）` : `週期 ${Math.round(p.C)} 秒・綠燈 ${p.stages.map(s => Math.round(s[0])).join('／')} 秒・時差 ${Math.round(p.off)} 秒（照綠波推估）`;
    body.innerHTML = `<h2>${esc(nm)}</h2><p class="sub">${p.real ? '<span class="pill real">臺北市時制計畫</span>' : '<span class="pill est">推估時制</span>'}${c.id ? `路口編號 ${esc(c.id)}` : c.src.includes('osm') ? 'OpenStreetMap 號誌' : ''}</p>
      <p class="sub" style="margin:2px 0 0">${esc(roadNames(c, 0))}</p>${bar(0)}<p class="sub" style="margin:6px 0 0">${esc(roadNames(c, 1))}</p>${bar(1)}
      <p class="sub" style="margin-top:6px">${planLine}</p><div class="dirs">${dir(0)}${dir(1)}</div>
      ${metricsHtml(c)}${picked.ev ? `<p class="evnote"><b>${esc(picked.ev.text)}</b><br>建議：${esc(picked.ev.tip || '')}</p>` : ''}${findingsHtml(c)}
      <div class="tune" aria-label="試算調整"><button type="button" data-tune="split:10">${esc(roadNames(c, 0))} 綠 +10 秒</button><button type="button" data-tune="split:-10">${esc(roadNames(c, 0))} 綠 −10 秒</button><button type="button" data-tune="cycle:20">週期 +20 秒</button><button type="button" data-tune="cycle:-20">週期 −20 秒</button>${c.adj ? '<button type="button" data-tune="reset">還原公開時制</button>' : ''}<button type="button" class="warn" data-tune="flash">${c.flash ? '號誌恢復' : '模擬故障閃黃'}</button></div>
      ${p.adj ? '<p class="sub" style="margin-top:6px">⚙️ 這個路口目前用你試算的時制（只在你的瀏覽器）。看幾個週期，排隊與「一次綠燈過不完」有沒有改善。</p>' : ''}
      ${p.real && p.sched ? `<details class="raw"><summary>今天的時段表</summary><p>${p.sched.map(([m, id]) => `${hm(m)} 第 ${id} 號`).join('・')}</p></details>` : ''}`; }
  else { const e = picked.e, nm = e.name >= 0 ? net.names[e.name] : '（沒有路名）', ls = e.links.filter(i => i >= 0).map(i => net.links[i]);
    const row = L => { const n = L.q.reduce((a, q) => a + q.length, 0), sp = L.seen ? Math.round(L.ema * L.vf * 3.6) : null; return `<tr><td>${L.dir > 0 ? '順向' : '逆向'}・${L.lanes} 車道</td><td class="num">${n} 台</td><td class="num">${sp == null ? '—' : sp + ' km/h'}</td></tr>`; };
    body.innerHTML = `<h2>${esc(nm)}</h2><p class="sub">${CLS_NAME[e.cls]}・速限 ${e.sp} km/h・${e.f && e.r ? '雙向' : '單行道'}・這一段 ${Math.round(e.len)} 公尺${e.lv > 0 ? '・高架' : ''}</p><table>${ls.map(row).join('')}</table>`; } }

// ── 依縮放顯示哪些東西 ──
let dist = 30000; const roadVisible = cls => cls <= 2 || (cls <= 4 ? dist < 16000 : dist < 5500);
function lod() { dist = camera.position.distanceTo(controls.target);
  roads.setVisible(0, true); roads.setVisible(1, true); roads.setVisible(2, dist < 16000); roads.setVisible(3, dist < 5500);
  if (ground) ground.districtLines.visible = dist > 2500;
  cars.visible = layer.cars && dist < 9000; lamps.lamp.visible = layer.signals && dist < 7000; lamps.pole.visible = layer.signals && dist < 1500; }

// ── 主迴圈 ──
let last = performance.now(), acc = 0, uiT = 0, flowT = 0, bT = 0, mT = 0;
function frame(now) { const raw = Math.min(0.1, (now - last) / 1000); last = now;
  if (fly) { fly.t = Math.min(1, fly.t + raw / 1.4); const k = fly.t * fly.t * (3 - 2 * fly.t); controls.target.lerpVectors(fly.ft, fly.tt, k); camera.position.lerpVectors(fly.fp, fly.tp, k); if (fly.t >= 1) fly = null; }
  controls.update(); lod(); camera.near = Math.max(1, dist * 0.01); camera.far = dist * 8 + 30000; camera.updateProjectionMatrix();
  // 模擬：每步 0.2 秒（5 倍速以上 0.4 秒）；這一幀最多花 9 毫秒，追不上就慢一點
  if (speed && !document.hidden) { const dt = speed >= 5 ? 0.4 : 0.2; acc += raw * speed; const t0 = performance.now(); while (acc >= dt) { const s0 = Math.floor(sim.t); sim.step(dt); diag.tick(dt); if (Math.floor(sim.t) !== s0) story.tick(); acc -= dt; if (performance.now() - t0 > 9) { acc = 0; break; } } }
  story.updatePins();
  const tg = controls.target; if (cars.visible) cars.update(net, sim.V, tg.x, tg.z, Math.min(dist * 2.2, 9000));
  if (lamps.lamp.visible) lamps.update(sim.t);
  flowT += raw; if (flowT > 0.5) { flowT = 0; roads.updateFlow(layer.flow, sim.t); }
  shared.uClose.value = Math.min(1, Math.max(0, (1800 - dist) / 1100)); // 1800 公尺以內慢慢變成柏油路
  mT += raw; if (!marks && grid) marks = createMarkings(scene, net, grid); if (marks && mT > 0.25) { mT = 0; marks.update(tg.x, tg.z, Math.min(900, dist * 1.6), dist < 1300); }
  bT += raw; if (bT > 0.25 && buildings !== false) { bT = 0; if (!buildings && masked) buildings = createBuildings(scene, net, grid, masked); if (buildings) buildings.update(tg.x, tg.z, 1300, layer.buildings && dist < 2600); }
  renderer.render(scene, camera); updateLabels(dist);
  uiT += raw; if (uiT > 0.5) { uiT = 0; renderStats(); if (picked) renderInspect(); story.render(); story.cutIfIdle(); }
  requestAnimationFrame(frame); }
window.TR = { get net() { return net; }, get sim() { return sim; }, get sig() { return sig; }, get diag() { return diag; }, get story() { return story; }, camera, controls, look, scene }; // 除錯用
boot().catch(e => { console.error(e); ld('載入失敗：' + e.message); });
