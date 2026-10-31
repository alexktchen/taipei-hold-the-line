/* 學習森林的學習畫面（DOM）：教學卡片、發音、教育部標準筆順動畫、練習題、學習進度。
   - 發音：瀏覽器內建語音（speechSynthesis，優先找臺灣國語的聲音）；注音符號念它的示範字（ㄅ念「玻」）。
   - 筆順：data/strokes/XXXX.json（教育部《常用國字標準字體筆順學習網》，經 g0v/zh-stroke-data 整理），
     每一筆用輪廓當遮罩、沿著運筆軌跡畫粗線，就是一筆一筆寫出來的動畫。
   - 進度記在這台裝置（localStorage），學會一個知識點，通往下一個知識點的石板路就會打通。 */
import { NODES, REGIONS, GRAPH, initGraph, passOf, nodeById, regionById, lessonOf, quizOf, stripTone } from './content.js';
const BASE = new URL('.', import.meta.url).href;
// ── 進度：每個知識點的熟練度（1～3 星）、上次練習時間、最佳成績，存在這台裝置 ──
const KEY = 'forest.progress.v2', OLD = 'forest.progress.v1';
let P = { nodes: {} }; try { P = JSON.parse(localStorage.getItem(KEY)) || P; P.nodes ||= {}; if (!localStorage.getItem(KEY)) { const o = JSON.parse(localStorage.getItem(OLD) || 'null'); if (o && o.learned) for (const [id, t] of Object.entries(o.learned)) P.nodes[id] = { level: 1, last: t > 1e12 ? t : Date.now(), best: 0 }; } } catch (e) {} // 舊版進度搬過來
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} };
const DAY = 24 * 3600 * 1000, today = () => new Date().toDateString();
export const levelOf = id => (P.nodes[id] && P.nodes[id].level) || 0;
export const isLearned = id => levelOf(id) > 0;
// 複習間隔：熟練度 1、2、3 星分別隔幾天要再練一次（graph.json 的 review.days）；超過就「需要澆水」
export const reviewDays = id => GRAPH.review.days[Math.min(levelOf(id), GRAPH.review.days.length) - 1] || 1;
export const isDue = id => isLearned(id) && Date.now() - P.nodes[id].last > reviewDays(id) * DAY;
export const nextReview = id => isLearned(id) ? new Date(P.nodes[id].last + reviewDays(id) * DAY) : null;
// 區域：requires 裡的區域守護者都通過了才打開（第一個區域沒有 requires，一開始就開）
export const regionOpen = rid => (regionById(rid).requires || []).every(r => isLearned('guard-' + r));
export const regionNeeds = rid => (regionById(rid).requires || []).filter(r => !isLearned('guard-' + r)).map(r => nodeById('guard-' + r)).filter(Boolean);
// 狀態：mastered（已精通）、review（需要澆水）、open（可挑戰）、locked（迷霧封鎖）
export const nodeState = id => isLearned(id) ? (isDue(id) ? 'review' : 'mastered') : regionOpen(nodeById(id).region) && nodeById(id).pre.every(isLearned) ? 'open' : 'locked';
// 圖示（forest/icons）：區域與狀態
export const ICONS = BASE + 'icons/';
export const STATE_ICON = { mastered: 'state-mastered', review: 'state-needs-review', open: 'state-available', locked: 'state-locked', guardian: 'state-guardian' };
export const regionCount = rid => { const ns = NODES.filter(n => n.region === rid && !n.guardian); return [ns.filter(n => isLearned(n.id)).length, ns.length]; };
export const missingFor = id => nodeById(id).pre.filter(p => !isLearned(p)).map(p => nodeById(p));
// 練習通過：第一次＝1 星；到了複習時間再通過、或當天第一次全對，熟練度 +1（最多 3 星）
function record(id, right, total) { const rec = P.nodes[id] || (P.nodes[id] = { level: 0, last: 0, best: 0 }), was = rec.level, due = isDue(id);
  if (!rec.level) rec.level = 1; else if (due || (right === total && rec.day !== today())) { rec.level = Math.min(3, rec.level + 1); if (right === total) rec.day = today(); }
  rec.last = Date.now(); rec.best = Math.max(rec.best || 0, right); save(); return { first: !was, up: rec.level > was, level: rec.level }; }
export const stars = n => '★'.repeat(n) + '☆'.repeat(3 - n);

// ── 教育部辭典資料 ──
let D = null;
export async function loadData() { if (D) return D;
  const [g, M] = await Promise.all([fetch(BASE + 'data/graph.json').then(r => r.json()), fetch(BASE + 'data/moe.json').then(r => r.json())]); initGraph(g); // 知識圖譜（DAG）＋教育部辭典資料
  const ch = c => { const e = M.c[c]; return e ? { b: e[0], r: e[1], s: e[2], n: e[3] } : { b: [''], r: '', s: 0, n: 0 }; };
  const w = x => M.w[x] || (x.length === 1 ? ch(x).b[0] : [...x].map(c => ch(c).b[0]).join(' '));
  const syl = (word, c) => w(word).split(' ')[[...word].indexOf(c)] || ch(c).b[0];
  const one = c => !!M.c[c] && M.c[c][0].length === 1;
  const homoPool = [...'青清輕晴情請睛同童銅工公功弓宮今金斤巾京經精晶紅洪虹花華化畫話汽氣器期旗奇騎棋知之汁枝支'].filter(one);
  const groups = {}; for (const c of homoPool) (groups[ch(c).b[0]] ||= []).push(c);
  D = { ch, w, syl, one, sym: M.sym, homoPool, homo: Object.values(groups) }; return D; }

// ── 發音 ──
let voice = null; const pickVoice = () => { const vs = speechSynthesis.getVoices(); voice = vs.find(v => /zh[-_]TW|cmn.*TW|Hant/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null; };
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
export const SLOW = 0.5; // 注音念慢一點
export function speak(text, rate = 0.75) { if (!('speechSynthesis' in window)) { toast('這台裝置不支援語音朗讀'); return; } speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'zh-TW'; if (voice) u.voice = voice; u.rate = rate; speechSynthesis.speak(u); }

// ── 筆順動畫 ──
const strokeCache = new Map();
async function strokesOf(c) { if (!strokeCache.has(c)) strokeCache.set(c, fetch(BASE + 'data/strokes/' + c.codePointAt(0).toString(16).padStart(4, '0') + '.json').then(r => r.ok ? r.json() : null).catch(() => null)); return strokeCache.get(c); }
function strokePlayer(canvas, c, { onCount } = {}) { const g = canvas.getContext('2d'); let data = null, raf = 0, idx = 0, t = 0, playing = false, last = 0;
  const S = canvas.width / 2150;
  const lens = s => { let L = 0; const out = [0]; for (let i = 1; i < s[1].length; i++) { L += Math.hypot(s[1][i][0] - s[1][i - 1][0], s[1][i][1] - s[1][i - 1][1]); out.push(L); } return out; };
  const grid = () => { const W = canvas.width; g.clearRect(0, 0, W, W); g.fillStyle = '#fffdf8'; g.fillRect(0, 0, W, W); g.strokeStyle = '#f0a99a'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, W - 2); g.setLineDash([6, 6]); g.lineWidth = 1; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, W); g.moveTo(0, W / 2); g.lineTo(W, W / 2); g.stroke(); g.setLineDash([]); }; // 田字格
  function draw() { grid(); if (!data) return; g.save(); g.scale(S, S);
    data.forEach((s, i) => { const p = s.path || (s.path = new Path2D(s[0])); if (i < idx) { g.fillStyle = '#3b2c44'; g.fill(p); return; } if (i > idx) { g.fillStyle = '#e8dfe8'; g.fill(p); return; }
      g.fillStyle = '#e8dfe8'; g.fill(p); g.save(); g.clip(p); const L = s.L || (s.L = lens(s)), tr = s[1], want = t * L[L.length - 1]; g.strokeStyle = '#e8705c'; g.lineWidth = 260; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(tr[0][0], tr[0][1]);
        for (let k = 1; k < tr.length; k++) { if (L[k] <= want) g.lineTo(tr[k][0], tr[k][1]); else { const f = (want - L[k - 1]) / (L[k] - L[k - 1] || 1); g.lineTo(tr[k - 1][0] + (tr[k][0] - tr[k - 1][0]) * f, tr[k - 1][1] + (tr[k][1] - tr[k - 1][1]) * f); break; } }
        if (tr.length === 1) g.lineTo(tr[0][0] + 1, tr[0][1]); g.stroke(); g.restore(); });
    g.restore(); }
  function tick(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!data || !playing) return; const s = data[idx], L = (s.L || (s.L = lens(s))), dur = 0.35 + L[L.length - 1] / 2150 * 1.1; t += dt / dur;
    if (t >= 1) { t = 0; idx++; onCount && onCount(Math.min(idx, data.length), data.length); if (idx >= data.length) { playing = false; draw(); return; } } draw(); raf = requestAnimationFrame(tick); }
  const api = { async load() { data = await strokesOf(c); if (!data) { grid(); g.fillStyle = '#8a7a92'; g.font = '16px sans-serif'; g.textAlign = 'center'; g.fillText('這個字還沒有筆順資料', canvas.width / 2, canvas.width / 2); return false; } idx = data.length; t = 0; draw(); onCount && onCount(data.length, data.length); return true; },
    play() { if (!data) return; cancelAnimationFrame(raf); idx = 0; t = 0; playing = true; onCount && onCount(0, data.length); last = performance.now(); raf = requestAnimationFrame(tick); },
    step() { if (!data) return; cancelAnimationFrame(raf); playing = false; if (idx >= data.length) idx = 0; t = 0; idx++; draw(); onCount && onCount(idx, data.length); },
    stop() { cancelAnimationFrame(raf); playing = false; } };
  return api; }

// ── 畫面 ──
const CSS = `
.lf-ov{position:fixed;inset:0;z-index:50;background:#4a3b5266;display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;color:#4a3b52}
.lf-box{background:#fffaf3;border-radius:22px;box-shadow:0 14px 40px #4a3b5255;width:min(760px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;overflow:hidden}
.lf-top{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;border-bottom:1px solid #4a3b5214}
.lf-top h2{margin:0;font-size:20px;font-weight:900;flex:1;display:flex;align-items:center;gap:8px}.lf-top img{width:40px;height:40px;flex:none}.lf-top h2 img{width:28px;height:28px}.lf-top small{color:#8a7a92;font-weight:700}
.lf-x{border:0;background:#fff;border-radius:50%;width:34px;height:34px;font-size:18px;box-shadow:0 2px 6px #6a4f7a22;cursor:pointer}
.lf-tabs{display:flex;gap:6px;padding:10px 16px 0}.lf-tabs button{border:0;border-radius:999px;padding:7px 16px;font:inherit;font-weight:800;background:#f3ebe4;color:#8a7a92;cursor:pointer}.lf-tabs button[aria-selected=true]{background:#f09a8a;color:#fff}
.lf-body{padding:14px 16px 18px;overflow:auto}
.lf-intro{background:#fff;border-radius:14px;padding:10px 14px;line-height:1.7;margin-bottom:12px;box-shadow:0 2px 8px #6a4f7a14}
.lf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}
.lf-card{border:0;background:#fff;border-radius:16px;padding:10px 6px 8px;box-shadow:0 3px 0 #ead9cc,0 4px 12px #6a4f7a14;cursor:pointer;font:inherit;color:inherit;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:112px;justify-content:center}
.lf-card:active{transform:translateY(2px)}.lf-card .big{font-size:38px;font-weight:900;line-height:1.1}.lf-card .zy{font-size:14px;color:#8a7a92;letter-spacing:.05em}.lf-card .tag{font-size:12px;color:#c0786a;font-weight:700;text-align:center}
.lf-text{background:#fff;border-radius:14px;padding:10px 14px;margin-bottom:8px;line-height:1.6}.lf-text b{color:#e8705c}
.lf-detail{display:flex;gap:16px;flex-wrap:wrap;align-items:center;justify-content:center}
.lf-detail canvas{width:220px;height:220px;border-radius:12px;box-shadow:0 3px 12px #6a4f7a22}
.lf-side{display:flex;flex-direction:column;gap:8px;align-items:flex-start;min-width:200px}.lf-side .huge{font-size:64px;font-weight:900;line-height:1}.lf-side .zy{font-size:22px;color:#8a7a92}
.lf-btns{display:flex;gap:8px;flex-wrap:wrap}.lf-btn{border:0;border-radius:999px;padding:9px 16px;font:inherit;font-weight:800;background:#8fd3f0;color:#fff;box-shadow:0 3px 0 #5aa9cc;cursor:pointer}.lf-btn.alt{background:#fff;color:#4a3b52;box-shadow:0 3px 0 #e6d6c8}.lf-btn.go{background:#f09a8a;box-shadow:0 3px 0 #d4786a}
.lf-q{font-size:19px;font-weight:800;line-height:1.6;margin:4px 0 10px}.lf-qbig{font-size:56px;font-weight:900;text-align:center;margin:4px 0}.lf-qbig ruby rt{font-size:15px;color:#8a7a92}
.lf-ch{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.lf-ch button{border:0;border-radius:14px;padding:14px 10px;font:inherit;font-size:19px;font-weight:800;background:#fff;color:#4a3b52;box-shadow:0 3px 0 #ead9cc;cursor:pointer;min-height:56px}
.lf-ch button.ok{background:#b7e4a4;box-shadow:0 3px 0 #86c072}.lf-ch button.no{background:#f6b6ad;box-shadow:0 3px 0 #d98c82}
.lf-why{margin-top:10px;background:#fff5d6;border-radius:12px;padding:8px 12px;line-height:1.6}
.lf-bar{height:10px;background:#f3ebe4;border-radius:999px;overflow:hidden;margin:2px 0 12px}.lf-bar i{display:block;height:100%;background:#f09a8a;transition:width .3s}
.lf-done{text-align:center;padding:10px}.lf-done .em{font-size:64px}.lf-done h3{margin:6px 0;font-size:22px}
.lf-toast{position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#4a3b52;color:#fff;border-radius:999px;padding:8px 16px;z-index:60;font-weight:700}
.lf-credit{font-size:11px;color:#a597a8;padding:0 16px 10px;line-height:1.5}
@media (max-width:520px){.lf-ch{grid-template-columns:1fr}.lf-card .big{font-size:32px}.lf-qbig{font-size:46px}}`;
let styled = false; const style = () => { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) { style(); const t = el('div', 'lf-toast', esc(msg)); document.body.appendChild(t); setTimeout(() => t.remove(), 2200); }
const ruby = (text, b) => { const ws = [...text], bs = (b || '').split(' '); return ws.length === bs.length ? ws.map((c, i) => `<ruby>${esc(c)}<rt>${esc(bs[i])}</rt></ruby>`).join('') : esc(text); };

let ov = null, onDone = null, keyFn = null;
export const isOpen = () => !!ov;
export function close() { if (!ov) return; ov.remove(); ov = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); removeEventListener('keydown', keyFn, true); }
// 打開一個知識點：學習卡片＋練習；onLearned(id) 在第一次學會時呼叫
export async function open(id, onLearned) { style(); close(); await loadData(); onDone = onLearned; const n = nodeById(id), R = regionById(n.region), L = lessonOf(id, D);
  ov = el('div', 'lf-ov'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', n.name);
  const box = el('div', 'lf-box'); ov.appendChild(box);
  const PASS = passOf(id), st = nodeState(id), stIcon = n.guardian ? STATE_ICON.guardian : STATE_ICON[st], lv = levelOf(id);
  const top = el('div', 'lf-top', `<img src="${ICONS}${R.img}.svg" alt=""><h2>${esc(n.name)}<img src="${ICONS}${stIcon}.svg" alt="${{ mastered: '已精通', review: '需要澆水', open: '可挑戰', locked: '迷霧封鎖' }[st]}">${lv ? `<span style="color:#f2b84a;font-size:18px">${stars(lv)}</span>` : ''}</h2><small>${esc(R.name)}・${esc(R.grades)}</small>`); const x = el('button', 'lf-x', '✕'); x.setAttribute('aria-label', '關閉'); x.onclick = close; top.appendChild(x); box.appendChild(top);
  const tabs = el('div', 'lf-tabs'); tabs.setAttribute('role', 'tablist'); const body = el('div', 'lf-body'); box.append(tabs, body);
  box.appendChild(el('div', 'lf-credit', '注音、部首、筆畫：教育部《重編國語辭典修訂本》（CC BY-ND 3.0 TW）；筆順：教育部《常用國字標準字體筆順學習網》（g0v/zh-stroke-data 整理）；發音：裝置內建語音。'));
  const tab = (label, fn) => { const b = el('button', null, label); b.setAttribute('role', 'tab'); b.onclick = () => { [...tabs.children].forEach(t => t.setAttribute('aria-selected', String(t === b))); body.innerHTML = ''; fn(); }; tabs.appendChild(b); return b; };
  const learnTab = tab('📖 學習', () => renderLearn(body, L)); tab(`✏️ 練習（答對 ${PASS.need}／${PASS.total} 題就通過）`, () => renderQuiz(body, id));
  keyFn = e => { if (!ov) return; if (e.key === 'Escape') { close(); e.stopPropagation(); return; } const k = +e.key; if (k >= 1 && k <= 4) { const bs = ov.querySelectorAll('.lf-ch button'); if (bs[k - 1] && !bs[k - 1].disabled) { bs[k - 1].click(); e.stopPropagation(); } } };
  addEventListener('keydown', keyFn, true); document.body.appendChild(ov); learnTab.click(); x.focus(); }

function renderLearn(body, L) { body.appendChild(el('div', 'lf-intro', esc(L.intro)));
  if (L.cards[0] && L.cards[0].kind === 'text') { for (const c of L.cards) body.appendChild(el('div', 'lf-text', `${esc(c.q)}<br>答案：<b>${esc(c.a)}</b>　${esc(c.why)}`)); body.appendChild(el('div', 'lf-intro', '看完例子，就到「練習」試試看吧！')); return; }
  const grid = el('div', 'lf-grid'); body.appendChild(grid);
  for (const c of L.cards) { const b = el('button', 'lf-card');
    if (c.kind === 'zhuyin') b.innerHTML = `<span class="big">${c.sym}</span><span class="zy">${c.emoji} ${esc(c.word)}</span><span class="tag">${esc(c.wordB)}</span>`;
    else if (c.kind === 'tone') b.innerHTML = `<span class="big">${c.ex}</span><span class="zy">${esc(c.b)}</span><span class="tag">${c.name} ${c.mark}</span>`;
    else if (c.kind === 'word') b.innerHTML = `<span class="big" style="font-size:26px">${c.emoji ? c.emoji + '<br>' : ''}${esc(c.w)}</span><span class="zy">${esc(c.b)}</span>${c.tag ? `<span class="tag">${esc(c.tag)}</span>` : ''}`;
    else b.innerHTML = `<span class="big">${esc(c.c)}</span><span class="zy">${esc(c.b)}</span>${c.tag ? `<span class="tag">${esc(c.tag)}</span>` : c.strokes ? `<span class="tag">${c.strokes} 畫</span>` : ''}`;
    b.onclick = () => detail(body, L, c); grid.appendChild(b); } }

// 卡片細節：大字、注音、發音、筆順動畫
function detail(body, L, c) { body.innerHTML = ''; const wrap = el('div', 'lf-detail'); body.appendChild(wrap);
  const glyph = c.kind === 'zhuyin' ? c.sym : c.kind === 'tone' ? c.ex : c.kind === 'word' ? c.w : c.c, slow = c.kind === 'zhuyin' || c.kind === 'tone', sayText = c.kind === 'zhuyin' ? `${c.word}，${c.word}` : slow ? `${glyph}，${glyph}` : glyph, rate = slow ? SLOW : 0.75;
  const side = el('div', 'lf-side');
  side.innerHTML = c.kind === 'zhuyin' ? `<div class="huge">${c.sym}</div><div style="font-size:30px">${c.emoji} ${ruby(c.word, c.wordB)}</div><div style="color:#8a7a92">「${esc(c.word)}」裡有「${c.sym}」的音；單獨念像「${esc(c.ex)}」</div>`
    : c.kind === 'tone' ? `<div class="huge">${c.ex}</div><div class="zy">${esc(c.b)}</div><div><b>${c.name}</b>　${esc(c.tip)}</div>`
    : c.kind === 'word' ? `<div class="huge" style="font-size:44px">${c.emoji || ''} ${ruby(c.w, c.b)}</div>${c.tag ? `<div>${esc(c.tag)}</div>` : ''}`
    : `<div class="huge">${esc(c.c)}</div><div class="zy">${esc(c.b)}</div>${c.tag ? `<div>${esc(c.tag)}</div>` : ''}`;
  const btns = el('div', 'lf-btns'); const say = el('button', 'lf-btn', slow ? '🔊 慢慢念' : '🔊 聽發音'); say.onclick = () => speak(sayText, rate); btns.appendChild(say);
  if (c.kind === 'tone') { const all = el('button', 'lf-btn alt', '🔊 媽麻馬罵嗎'); all.onclick = () => speak('媽，麻，馬，罵，嗎', SLOW); btns.appendChild(all); }
  side.appendChild(btns);
  const strokeChar = [...glyph].length === 1 ? glyph : null;
  if (strokeChar) { const cv = el('canvas'); cv.width = cv.height = 440; cv.setAttribute('aria-label', `「${strokeChar}」的筆順動畫`); wrap.appendChild(cv); const cnt = el('div', null, ''); const pl = strokePlayer(cv, strokeChar, { onCount: (i, n) => { cnt.textContent = `第 ${i}／${n} 筆`; } });
    const sb = el('div', 'lf-btns'); const play = el('button', 'lf-btn go', '▶ 播放筆順'), step = el('button', 'lf-btn alt', '下一筆'); play.onclick = () => pl.play(); step.onclick = () => pl.step(); sb.append(play, step); side.append(sb, cnt);
    pl.load().then(ok => { if (ok) pl.play(); else { play.disabled = step.disabled = true; } }); }
  wrap.appendChild(side); const back = el('button', 'lf-btn alt', '← 回到卡片'); back.style.marginTop = '14px'; back.onclick = () => { body.innerHTML = ''; renderLearn(body, L); }; body.appendChild(back); speak(sayText, rate); }

function renderQuiz(body, id) { const PASS = passOf(id), qs = quizOf(id, D, Date.now() & 0xffffff); let i = 0, right = 0;
  const show = () => { body.innerHTML = ''; const bar = el('div', 'lf-bar', `<i style="width:${i / qs.length * 100}%"></i>`); body.appendChild(bar);
    if (i >= qs.length) return finish(); const q = qs[i];
    body.appendChild(el('div', 'lf-q', `第 ${i + 1} 題　${esc(q.q)}`));
    if (q.listen) { const b = el('button', 'lf-btn go', '🔊 再聽一次'); b.onclick = () => speak(q.say, q.slow ? SLOW : 0.75); body.appendChild(b); speak(q.say, q.slow ? SLOW : 0.75); }
    else if (q.big) body.appendChild(el('div', 'lf-qbig', q.bigB ? ruby(q.big, q.bigB) : esc(q.big)));
    const ch = el('div', 'lf-ch'); body.appendChild(ch);
    q.choices.forEach((c, k) => { const b = el('button', null, `${k + 1}. ${esc(c)}`); b.onclick = () => { [...ch.children].forEach(x => x.disabled = true); const ok = k === q.a; if (ok) right++; b.classList.add(ok ? 'ok' : 'no'); ch.children[q.a].classList.add('ok');
        const why = el('div', 'lf-why', `${ok ? '答對了！🎉' : `答案是「${esc(q.choices[q.a])}」`}${q.after ? '　剛剛念的是：' + esc(q.after) : ''}${q.why ? '　' + esc(q.why) : ''}`); body.appendChild(why);
        if (q.say && !q.listen) speak(q.say, q.slow ? SLOW : 0.75);
        const nx = el('button', 'lf-btn go', i + 1 < qs.length ? '下一題 →' : '看結果'); nx.style.marginTop = '10px'; nx.onclick = () => { i++; show(); }; body.appendChild(nx); nx.focus(); }; ch.appendChild(b); }); };
  const finish = () => { const pass = right >= PASS.need, res = pass ? record(id, right, qs.length) : null, first = res && res.first, g = nodeById(id).guardian;
    const nx = pass && nextReview(id), when = nx ? `${nx.getMonth() + 1}/${nx.getDate()}` : '';
    const d = el('div', 'lf-done', `<div class="em">${pass ? (g ? '👑' : '🌸') : '💪'}</div><h3>${pass ? (first ? (g ? '征服了這個區域！' : '精通了！') : res.up ? '熟練度提升！' : '複習完成！') : '再試一次！'}</h3>${pass ? `<p style="font-size:30px;color:#f2b84a;margin:4px 0">${stars(res.level)}</p>` : ''}<p>答對 ${right}／${qs.length} 題${pass ? `。${when} 以後記得回來澆水（複習）` : `，要答對 ${PASS.need} 題才算通過喔`}</p>`);
    if (first && g) { const opened = REGIONS.filter(R => (R.requires || []).includes(nodeById(id).region) && regionOpen(R.id)); if (opened.length) d.appendChild(el('p', null, `🗺️ 新地圖打開了：${opened.map(R => esc(R.name)).join('、')}`)); }
    if (first) { const nexts = NODES.filter(n => n.pre.includes(id) && nodeState(n.id) === 'open'); d.appendChild(el('p', null, nexts.length ? `🪨 石板路打通了：${nexts.map(n => `${esc(regionById(n.region).name)}「${esc(n.name)}」`).join('、')}` : '')); }
    const again = el('button', 'lf-btn alt', '再練一次'); again.onclick = () => renderQuiz(body, id); const done = el('button', 'lf-btn go', '回到森林'); done.onclick = close; const bs = el('div', 'lf-btns'); bs.style.justifyContent = 'center'; bs.append(again, done); d.appendChild(bs);
    body.appendChild(d); if (pass && onDone) onDone(id, first, res.up); };
  show(); }
export { REGIONS, NODES, GRAPH, nodeById, regionById, passOf, stripTone };
