/* 獎勵（內容在 data/rewards.json）：字精靈收集與跟隨、方塊角色服裝帽子與院子家具、稱號、鄰居新故事、每日集章與連續天數貼紙。
   原則：沒有抽卡、沒有扣分、沒有排行榜；答錯只是拿不到這次的獎勵，學過的東西和收集到的都不會倒退。
   遊戲裡發生的事（練習、複習、小遊戲、收成、聊天）用 window 的 'forest' 事件傳進來，這裡記次數、判斷解鎖與每日任務。 */
import { NODES, nodeById, isLearned, nodeState, modal, el, esc, close } from './learn.js';
import { gameState, itemCount } from './games.js';
const BASE = new URL('.', import.meta.url).href, KEY = 'forest.rewards.v1';
let R = null, S = { follower: null, shirt: 'coral', hat: 'none', title: 't-new', furniture: { bench: true }, stamps: {}, day: null, seen: {}, known: {}, counters: {} };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
export const state = () => S;
let hooks = { onChange() {}, onNotify() {} };
export async function init(h) { Object.assign(hooks, h); if (!R) R = await (await fetch(BASE + 'data/rewards.json')).json(); ensureDay(); checkNew(true); return R; }
export const data = () => R;
// ── 條件 ──
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const spiritsGot = () => R.spirits.filter(s => s.nodes.every(isLearned));
export function streak() { let n = 0; const d = new Date(); if (!S.stamps[dateKey(d)]) d.setDate(d.getDate() - 1); while (S.stamps[dateKey(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }
export function ok(c) { const G = gameState(); switch (c.type) {
  case 'free': return true; case 'region': return isLearned('guard-' + c.id); case 'node': return isLearned(c.id);
  case 'nodes': return NODES.filter(n => !n.guardian && isLearned(n.id)).length >= c.n; case 'spirits': return spiritsGot().length >= c.n;
  case 'monsters': return G.monsters >= c.n; case 'items': return itemCount() >= c.n; case 'flowers': return G.flowers.length >= c.n;
  case 'harvest': return (S.counters.harvest || 0) >= c.n; case 'stamps': return Object.keys(S.stamps).length >= c.n; case 'streak': return streak() >= c.n; } return false; }
export function condText(c) { return { free: '一開始就有', region: `通過${nodeById('guard-' + c.id)?.name || c.id}的挑戰`, node: `學會「${nodeById(c.id)?.name}」`, nodes: `精通 ${c.n} 個知識點`, spirits: `收服 ${c.n} 隻字精靈`, monsters: `收服 ${c.n} 隻錯字小怪`, items: `煮出 ${c.n} 樣食材`, flowers: `種出 ${c.n} 朵修辭花`, harvest: `在田裡收成 ${c.n} 次`, stamps: `集到 ${c.n} 個章`, streak: `連續 ${c.n} 天蓋章` }[c.type] || ''; }
// 新解鎖的東西（精靈、稱號、衣服、帽子、家具、貼紙）：跟上次記得的比，新的就通知
function unlockedNow() { const out = []; for (const s of R.spirits) if (s.nodes.every(isLearned)) out.push(['spirit', s.id, `🧚 收服了「${s.name}」`]);
  for (const t of R.titles) if (ok(t.cond)) out.push(['title', t.id, `🏅 得到稱號「${t.name}」`]); for (const x of R.shirts) if (ok(x.cond)) out.push(['shirt', x.id, `👕 解鎖衣服「${x.name}」`]);
  for (const x of R.hats) if (ok(x.cond)) out.push(['hat', x.id, `🎩 解鎖「${x.name}」`]); for (const x of R.furniture) if (ok(x.cond)) out.push(['furn', x.id, `🪑 解鎖家具「${x.name}」`]);
  for (const k of R.daily.stickers) if (streak() >= k.days) out.push(['sticker', 'st' + k.days, `${k.emoji} 得到「${k.name}」（連續 ${k.days} 天）`]); return out; }
export function checkNew(silent = false) { const fresh = unlockedNow().filter(([t, id]) => !S.known[t + ':' + id]); for (const [t, id] of fresh) S.known[t + ':' + id] = 1; if (fresh.length) save(); if (!silent) for (const f of fresh) hooks.onNotify(f[2]); return fresh; }
// ── 每日任務與集章 ──
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }
function ensureDay() { const k = dateKey(); if (S.day && S.day.date === k) return; const pool = R.daily.tasks.slice(), pickd = []; let h = hash(k);
  while (pickd.length < R.daily.count && pool.length) { const t = pool.splice(h % pool.length, 1)[0]; h = Math.imul(h, 1103515245) + 12345 >>> 0; if (pickd.some(p => p.event === t.event)) continue; pickd.push(t.id); }
  S.day = { date: k, tasks: pickd, counts: {} }; save(); }
export const todayTasks = () => { ensureDay(); return S.day.tasks.map(id => { const t = R.daily.tasks.find(x => x.id === id), have = Math.min(t.n, S.day.counts[t.event] || 0); return { ...t, have, done: have >= t.n }; }); };
function track(type, d = {}) { ensureDay(); S.counters[type] = (S.counters[type] || 0) + 1; const bump = ev => { S.day.counts[ev] = (S.day.counts[ev] || 0) + 1; };
  if (type === 'practice') { bump('practice'); if (d.pass && d.wasDue) bump('review'); else if (d.pass && !NODES.some(n => nodeState(n.id) === 'review') && S.day.tasks.includes('review')) bump('review'); } // 沒有要澆水的知識點時，練習通過也算
  else bump(type);
  const before = !!S.stamps[S.day.date], tasks = todayTasks(); save();
  if (!before && tasks.every(t => t.done)) { S.stamps[S.day.date] = true; save(); hooks.onNotify(`📮 今天的任務都完成了，蓋一個章！連續 ${streak()} 天`); }
  checkNew(); hooks.onChange(); }
addEventListener('forest', e => { if (R) track(e.detail.type, e.detail); });
export const emit = (type, detail = {}) => dispatchEvent(new CustomEvent('forest', { detail: { type, ...detail } }));
// ── 鄰居劇情：完成特定知識點後，鄰居有新故事可以說 ──
export const storyFor = name => R && R.stories.find(s => s.neighbor === name && isLearned(s.after) && !S.seen[s.neighbor + ':' + s.after]);
export function readStory(s) { S.seen[s.neighbor + ':' + s.after] = 1; save(); }
// ── 目前的外觀（index.html 依這個建角色、跟隨精靈、稱號、家具）──
export const look = () => ({ shirt: (R.shirts.find(x => x.id === S.shirt && ok(x.cond)) || R.shirts[0]).color, hat: (R.hats.find(x => x.id === S.hat && ok(x.cond)) || R.hats[0]).acc,
  title: (R.titles.find(t => t.id === S.title && ok(t.cond)) || R.titles[0]).name, follower: spiritsGot().find(s => s.id === S.follower) || null, furniture: R.furniture.filter(f => S.furniture[f.id] && ok(f.cond)).map(f => f.id) });
// ── 獎勵畫面：字精靈／衣櫃／稱號／集章冊 ──
const CSS = `.rw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}.rw-card{background:#fff;border-radius:14px;padding:10px;text-align:center;box-shadow:0 3px 0 #ead9cc;display:flex;flex-direction:column;gap:6px;align-items:center}
.rw-card.lock{opacity:.55;filter:grayscale(.7)}.rw-face{width:58px;height:58px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;color:#fff;box-shadow:inset 0 -6px 0 #0002}
.rw-card small{color:#8a7a92;line-height:1.4}.rw-card .lf-btn{padding:6px 12px;font-size:14px}.rw-sw{width:44px;height:44px;border-radius:12px;box-shadow:inset 0 -5px 0 #0002}
.rw-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}.rw-cal div{background:#fff;border-radius:8px;padding:6px 0;font-size:13px;min-height:42px}.rw-cal .on{background:#ffe3ec}.rw-cal .on b{display:block;font-size:18px}.rw-cal .h{background:none;color:#8a7a92;min-height:0}
.rw-task{background:#fff;border-radius:12px;padding:8px 12px;margin:6px 0;display:flex;justify-content:space-between}.rw-task.done{background:#dff7e6}.rw-stk{font-size:34px;text-align:center;letter-spacing:6px}`;
let styled = false;
export function open(tab = 'spirit') { if (!styled) { styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  const m = modal({ title: '我的收藏與獎勵', sub: '沒有扣分、不會倒退，慢慢收集就好' }), b = m.body, tabs = el('div', 'lf-tabs'), body = el('div'); tabs.style.padding = '0 0 10px'; b.append(tabs, body);
  const T = { spirit: ['🧚 字精靈', spiritTab], wardrobe: ['👕 衣櫃', wardrobeTab], title: ['🏅 稱號', titleTab], stamp: ['📅 集章冊', stampTab] };
  const show = k => { [...tabs.children].forEach(x => x.setAttribute('aria-selected', String(x.dataset.k === k))); body.innerHTML = ''; T[k][1](body, () => show(k)); };
  for (const [k, [label]] of Object.entries(T)) { const bt = el('button', null, label); bt.dataset.k = k; bt.onclick = () => show(k); tabs.appendChild(bt); } show(tab); }
function spiritTab(b, re) { const got = spiritsGot(); b.appendChild(el('div', 'lf-intro', `每學會一組知識點，就收服一隻字精靈（${got.length}／${R.spirits.length}）。選一隻跟著你一起冒險！`)); const g = el('div', 'rw-grid'); b.appendChild(g);
  for (const s of R.spirits) { const has = got.includes(s), c = el('div', 'rw-card' + (has ? '' : ' lock')); c.innerHTML = `<div class="rw-face" style="background:${s.color}">${esc(s.face)}</div><b>${esc(s.name)}</b><small>${s.nodes.map(id => `${isLearned(id) ? '✅' : '⬜'}${esc(nodeById(id)?.name || id)}`).join('<br>')}</small>`;
    if (has) { const bt = el('button', 'lf-btn ' + (S.follower === s.id ? 'go' : 'alt'), S.follower === s.id ? '跟隨中' : '跟著我'); bt.onclick = () => { S.follower = S.follower === s.id ? null : s.id; save(); hooks.onChange(); re(); }; c.appendChild(bt); } g.appendChild(c); } }
function wardrobeTab(b, re) { const sec = (title, list, cur, apply, draw) => { b.appendChild(el('div', 'lf-q', title)); const g = el('div', 'rw-grid'); b.appendChild(g);
    for (const x of list) { const has = ok(x.cond), c = el('div', 'rw-card' + (has ? '' : ' lock')); c.innerHTML = `${draw(x)}<b>${esc(x.name)}</b><small>${has ? '' : '🔒 ' + esc(condText(x.cond))}</small>`; if (has) { const on = cur(x), bt = el('button', 'lf-btn ' + (on ? 'go' : 'alt'), on ? '使用中' : '換上'); bt.onclick = () => { apply(x); save(); hooks.onChange(); re(); }; c.appendChild(bt); } g.appendChild(c); } };
  sec('衣服顏色', R.shirts, x => S.shirt === x.id, x => { S.shirt = x.id; }, x => `<div class="rw-sw" style="background:${x.color}"></div>`);
  sec('帽子與配件', R.hats, x => S.hat === x.id, x => { S.hat = x.id; }, x => `<div class="rw-face" style="background:#f3ebe4;color:#4a3b52;font-size:26px">${{ none: '🙂', cap: '🧢', headband: '🎽', strawhat: '👒', nightcap: '🌙', beret: '🎨', earsCat: '🐱', earsBear: '🐻' }[x.id] || '🎩'}</div>`);
  b.appendChild(el('div', 'gm-note', '家具會擺在新手村小木屋的院子裡')); sec('院子家具', R.furniture, x => !!S.furniture[x.id], x => { S.furniture[x.id] = !S.furniture[x.id]; }, x => `<div class="rw-face" style="background:#f3ebe4;font-size:26px">${{ bench: '🪑', pot: '🪴', windmill: '🎡', swing: '🛝', doghouse: '🐶', bookshelf: '📚' }[x.id] || '🏠'}</div>`); }
function titleTab(b, re) { b.appendChild(el('div', 'lf-intro', '稱號會顯示在角色頭上。')); const g = el('div', 'rw-grid'); b.appendChild(g);
  for (const t of R.titles) { const has = ok(t.cond), c = el('div', 'rw-card' + (has ? '' : ' lock')); c.innerHTML = `<div class="rw-face" style="background:${has ? '#f2c14e' : '#c9c2d6'}">🏅</div><b>${esc(t.name)}</b><small>${esc(condText(t.cond))}</small>`; if (has) { const bt = el('button', 'lf-btn ' + (S.title === t.id ? 'go' : 'alt'), S.title === t.id ? '使用中' : '戴上'); bt.onclick = () => { S.title = t.id; save(); hooks.onChange(); re(); }; c.appendChild(bt); } g.appendChild(c); } }
function stampTab(b) { const tasks = todayTasks(); b.appendChild(el('div', 'lf-q', `今天的任務（全部完成就蓋一個章）　🔥 連續 ${streak()} 天`)); for (const t of tasks) b.appendChild(el('div', 'rw-task' + (t.done ? ' done' : ''), `<span>${t.done ? '✅' : '⬜'} ${esc(t.text)}</span><b>${t.have}／${t.n}</b>`));
  const now = new Date(), y = now.getFullYear(), mo = now.getMonth(), first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate(); b.appendChild(el('div', 'lf-q', `${y} 年 ${mo + 1} 月的集章冊`));
  const cal = el('div', 'rw-cal'); '日一二三四五六'.split('').forEach(d => cal.appendChild(el('div', 'h', d))); for (let k = 0; k < first; k++) cal.appendChild(el('div', 'h', ''));
  for (let d = 1; d <= days; d++) { const on = S.stamps[dateKey(new Date(y, mo, d))]; cal.appendChild(el('div', on ? 'on' : '', `${d}${on ? '<b>🌸</b>' : ''}`)); } b.appendChild(cal);
  b.appendChild(el('div', 'lf-q', '連續天數貼紙')); b.appendChild(el('div', 'rw-stk', R.daily.stickers.map(k => streak() >= k.days || S.known['sticker:st' + k.days] ? k.emoji : '⬜').join(' '))); b.appendChild(el('div', 'gm-note', R.daily.stickers.map(k => `${k.emoji} ${k.name}：連續 ${k.days} 天`).join('　'))); }
export { close };
