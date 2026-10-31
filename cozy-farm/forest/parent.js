/* 家長檢視：
   - gate()：進家長模式前的小關卡（一題兩位數加法），避免孩子誤觸；同一次開啟頁面只要過一次。
   - report()：學習報告視窗——總覽、待複習清單、需要加強的知識點、各區域每個知識點的正確率與最近 10 題。
   地圖上的熱力圖在 map.js（setParent），這裡只負責 DOM 視窗。全部用 icons.js 畫的圖示，不用 emoji。
   正確率只計算這台裝置上的作答；答錯只會讓這一次少拿獎勵，進度不會倒退。 */
import { modal, close, el, esc, toast, NODES, REGIONS, nodeById, regionById, nodeStats, regionStats, heatColor, pct, stars, STATE_ICON, nextReview, ICON } from './learn.js';
import * as REWARDS from './rewards.js';

const CSS = `
.pv-gate{display:flex;flex-direction:column;align-items:center;gap:12px;padding:6px 0 4px;text-align:center}
.pv-gate p{margin:0;font-weight:700;color:#6e5d7a}.pv-gate .q{font-size:30px;font-weight:900;color:#4a3b52}
.pv-gate input{font:inherit;font-size:24px;font-weight:900;width:140px;text-align:center;border:2px solid #e6dcea;border-radius:14px;padding:8px;background:#fff;color:#4a3b52}
.pv-btn{border:0;border-radius:999px;padding:9px 20px;font:inherit;font-weight:900;background:#f09a8a;color:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.pv-btn.alt{background:#f3ebe4;color:#6e5d7a}
.pv-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px}
.pv-tile{background:#fff;border-radius:16px;padding:10px 12px;box-shadow:0 2px 8px #6a4f7a14;display:flex;align-items:center;gap:10px}
.pv-tile b{display:block;font-size:22px;font-weight:900;line-height:1.1}.pv-tile small{color:#8a7a92;font-weight:700;font-size:12px}
.pv-h{margin:16px 0 8px;font-size:16px;font-weight:900;display:flex;align-items:center;gap:6px}
.pv-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;font-weight:700;color:#6e5d7a;margin:4px 0 6px}
.pv-legend i{display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:-2px;margin-right:4px}
.pv-list{display:flex;flex-direction:column;gap:6px}
.pv-row{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:8px;background:#fff;border-radius:12px;padding:7px 10px;box-shadow:0 1px 4px #6a4f7a10}
.pv-row .nm{font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pv-row .sub{display:block;font-size:12px;color:#8a7a92;font-weight:700;white-space:normal}
.pv-row .rt{font-weight:900;text-align:right;white-space:nowrap}
.pv-bar{height:8px;border-radius:4px;background:#efe9f2;overflow:hidden;margin-top:4px}.pv-bar>i{display:block;height:100%;border-radius:4px}
.pv-dots{display:inline-flex;gap:2px;vertical-align:middle;margin-left:4px}.pv-dots i{width:7px;height:7px;border-radius:50%;display:block}
.pv-reg{background:#fff7ef;border-radius:16px;padding:10px;margin-bottom:10px}
.pv-reg>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:8px;align-items:center}
.pv-reg>summary::-webkit-details-marker{display:none}.pv-reg>summary b{font-weight:900}.pv-reg>summary small{display:block;color:#8a7a92;font-weight:700;font-size:12px}
.pv-reg .pv-list{margin-top:8px}
.pv-empty{color:#8a7a92;font-weight:700;font-size:13px;padding:6px 2px}
.pv-note{color:#8a7a92;font-size:12px;font-weight:700;margin-top:14px;line-height:1.6}
`;
let styled = false, passed = false;
const style = () => { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); };
const ic = (n, s = 28) => ICON.svg(n, s);
const dateText = t => { if (!t) return '還沒練習'; const d = new Date(t), days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5); return days <= 0 ? '今天' : days === 1 ? '昨天' : days < 7 ? `${days} 天前` : `${d.getMonth() + 1}/${d.getDate()}`; };
const bar = rate => `<div class="pv-bar"><i style="width:${rate == null ? 0 : Math.round(rate * 100)}%;background:${heatColor(rate)}"></i></div>`;
const dots = r => r ? `<span class="pv-dots" title="最近 ${r.length} 題（左舊右新）">${[...r].map(x => `<i style="background:${x === '1' ? '#8CC77E' : '#F28CA0'}"></i>`).join('')}</span>` : '';
const STATE_TEXT = { mastered: '已精通', review: '需要複習', open: '可以挑戰', locked: '還沒解鎖' };

// 家長關卡：兩位數加法（答錯就換一題，不鎖住）
export function gate(onPass) { if (passed) { onPass(); return; } style();
  const m = modal({ title: '家長檢視', sub: '給大人看的學習報告', icon: 'family' }); let a, b;
  const ask = (msg = '') => { a = 11 + Math.floor(Math.random() * 39); b = 11 + Math.floor(Math.random() * 39); m.body.innerHTML = '';
    const w = el('div', 'pv-gate', `<p>請大人算一算，答對就能打開家長檢視</p><div class="q">${a} ＋ ${b} ＝ ？</div>${msg ? `<p style="color:#d0607a">${esc(msg)}</p>` : ''}`);
    const inp = el('input'); inp.type = 'text'; inp.inputMode = 'numeric'; inp.autocomplete = 'off'; inp.setAttribute('aria-label', '答案'); const go = el('button', 'pv-btn', `${ic('chart', 22)} 打開家長檢視`);
    const check = () => { if (+inp.value.trim() === a + b) { passed = true; close(); onPass(); } else ask('不對喔，換一題再試試'); };
    go.onclick = check; inp.onkeydown = e => { if (e.key === 'Enter') check(); e.stopPropagation(); }; w.append(inp, go); m.body.appendChild(w); setTimeout(() => inp.focus(), 30); };
  ask(); }

function nodeRow(id, showRegion = false) { const n = nodeById(id), S = nodeStats(id), R = regionById(n.region), nx = nextReview(id);
  const sub = [showRegion ? R.name : null, S.level ? stars(S.level) : null, STATE_TEXT[S.state], S.due ? (S.overdueDays ? `已經超過 ${S.overdueDays} 天該複習` : '今天該複習') : nx ? `下次複習 ${nx.getMonth() + 1}/${nx.getDate()}` : null, `上次練習：${dateText(S.tried || S.last)}`].filter(Boolean).join('・');
  return `<div class="pv-row">${ic(S.due ? 'st-review' : n.guardian && S.state !== 'locked' ? STATE_ICON.guardian : STATE_ICON[S.state], 30)}<div style="min-width:0"><div class="nm">${esc(n.name)}${dots(S.recent)}</div><span class="sub">${esc(sub)}</span>${bar(S.rate)}</div>
    <div class="rt" style="color:${S.rate == null ? '#8a7a92' : '#4a3b52'}">${pct(S.rate)}${S.a ? `<span class="sub">${S.c}／${S.a} 題</span>` : ''}</div></div>`; }

export function report() { style(); const m = modal({ title: '學習報告', sub: '家長檢視', icon: 'clipboard' });
  const all = NODES.map(n => ({ n, S: nodeStats(n.id) })), learn = all.filter(x => !x.n.guardian), a = all.reduce((t, x) => t + x.S.a, 0), c = all.reduce((t, x) => t + x.S.c, 0);
  const due = all.filter(x => x.S.due).sort((p, q) => q.S.overdueDays - p.S.overdueDays || (p.S.rate ?? 1) - (q.S.rate ?? 1));
  const weak = all.filter(x => x.S.a >= 3 && x.S.rate < 0.6).sort((p, q) => p.S.rate - q.S.rate);
  const tiles = [['st-mastered', `${learn.filter(x => x.S.level > 0).length}／${learn.length}`, '學會的知識點'], ['chart', pct(a ? c / a : null), `整體正確率（${a} 題）`], ['st-review', due.length, '待複習'], ['calendar', `${REWARDS.streak?.() || 0} 天`, '連續學習']];
  let h = `<div class="pv-tiles">${tiles.map(([i, v, t]) => `<div class="pv-tile">${ic(ICON.has(i) ? i : 'chart', 36)}<div><b>${esc(String(v))}</b><small>${esc(t)}</small></div></div>`).join('')}</div>`;
  h += `<div class="pv-legend"><span><i style="background:#8CC77E"></i>85% 以上</span><span><i style="background:#F5B731"></i>60～85%</span><span><i style="background:#F28CA0"></i>60% 以下</span><span><i style="background:#B3A8CC"></i>尚未作答</span><span><i style="background:#9C8BE0"></i>地圖上的紫色光環＝待複習</span></div>`;
  h += `<div class="pv-h">${ic('st-review', 26)} 待複習（${due.length}）</div><div class="pv-list">${due.length ? due.map(x => nodeRow(x.n.id, true)).join('') : '<div class="pv-empty">目前沒有需要複習的知識點。</div>'}</div>`;
  h += `<div class="pv-h">${ic('chart', 26)} 需要加強（作答 3 題以上、正確率低於 60%）</div><div class="pv-list">${weak.length ? weak.map(x => nodeRow(x.n.id, true)).join('') : '<div class="pv-empty">沒有正確率偏低的知識點。</div>'}</div>`;
  h += `<div class="pv-h">${ic('forest', 26)} 各區域</div>`;
  for (const R of REGIONS) { const S = regionStats(R.id), ns = NODES.filter(n => n.region === R.id);
    h += `<details class="pv-reg"${S.a || S.due ? ' open' : ''}><summary>${ic(R.img, 36)}<div style="min-width:0"><b>${esc(R.name)}</b><small>${esc(R.grades || '')}・學會 ${S.mastered}／${S.total}${S.due ? `・待複習 ${S.due}` : ''}</small>${bar(S.rate)}</div><div class="rt" style="font-weight:900">${pct(S.rate)}</div></summary>
      <div class="pv-list">${ns.map(n => nodeRow(n.id)).join('')}</div></details>`; }
  h += `<p class="pv-note">正確率只計算這台裝置上的作答（學習石碑的練習題與各區小遊戲）。答錯只會讓那一次少拿獎勵，學會的知識點不會倒退。<br>圓點是最近 10 題（綠＝答對、粉紅＝答錯，左舊右新）。在地圖上也可以看到同樣的顏色：每個知識點腳下的圓圈就是它的正確率。</p>`;
  m.body.innerHTML = h; const row = el('div', null); row.style.cssText = 'display:flex;gap:8px;justify-content:center;margin-top:12px'; const b = el('button', 'pv-btn alt', '關閉'); b.onclick = close; row.appendChild(b); m.body.appendChild(row); }
