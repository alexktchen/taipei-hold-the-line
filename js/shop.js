/* 金蛋商店（逛城市裡的面板）：錢包、衣服（服飾店裡買，買過的隨時能換）、蓋城市（走到工地投金蛋；全站一起依序蓋，蓋好的出現在每個人的地圖上）、
   政治獻金（惡搞；走到市長旁邊捐，全站累計解鎖全城加成，市長會回話）。不在地點旁邊時按「帶我去」自動走過去。
   金蛋只有打工賺；這裡只花。數字都在 config.econ。 */
import { CONFIG as C } from './config.js';
const E = C.econ, $ = id => document.getElementById(id);
export function createShop({ S, esc, fmt, hint, banner, placeCity, shout, islandName, onChange, near, goTo }) {
  let tab = 'fit', busy = false, mayorLine = '';
  const cats = Object.entries(E.outfits);
  const at = kind => { const n = near(); return !!(n && n.kind === kind); };
  // 蓋城市的進度：依序蓋，前面的蓋好才輪到下一棟
  function cityState(built) { let left = built; const st = E.city.map((p, i) => { if (left >= p.cost) { left -= p.cost; return { ...p, i, st: 'done', got: p.cost }; } const got = left; left = 0; return { ...p, i, st: 'todo', got }; });
    const now = st.findIndex(p => p.st !== 'done'); return st.map((p, i) => ({ ...p, st: p.st === 'done' ? 'done' : i === now ? 'now' : 'lock' })); }
  const tierCount = d => E.donate.tiers.filter(t => d >= t.at).length;
  const goBtn = (kind, txt) => `<button type="button" class="go2 go-there" data-go="${kind}">👣 ${txt}</button>`;
  function setTab(t) { if (t) tab = t; render(); }
  function render() { const e = S.econ(); $('wallet').textContent = fmt(e.wallet);
    $('walletNote').textContent = e.local ? '（只記在這台裝置）' : `累計賺 ${fmt(e.eggs)} 顆`;
    $('shopTabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $('shopBody').innerHTML = tab === 'fit' ? fitHtml(e) : tab === 'city' ? cityHtml(e) : donateHtml(e); }
  function fitHtml(e) { const fit = e.outfit.split('.'), own = new Set(e.owned), shop = at('boutique');
    return (shop ? '<p class="where ok">👕 歡迎光臨服飾店！買了就一直是你的，同一類一次穿一件，其他玩家看得到。</p>' : `<p class="where">買新衣服要走進服飾店（地圖上標「👕 服飾店」）；買過的隨時能換。${goBtn('boutique', '帶我去最近的服飾店')}</p>`)
      + cats.map(([cat, c], ci) => { const on = fit[ci] && fit[ci] !== '-' ? fit[ci] : '';
      return `<div class="fit-row"><span class="k">${esc(c.label)}</span><div class="fit-items">${Object.entries(c.items).map(([id, it]) => { const has = own.has(cat + ':' + id), wear = on === id, can = has || (shop && e.wallet >= it.price);
        return `<button type="button" class="it${wear ? ' wear' : ''}" data-cat="${cat}" data-id="${id}" aria-pressed="${wear}" ${can ? '' : 'disabled'}>${it.c != null ? `<i class="sw" style="background:#${it.c.toString(16).padStart(6, '0')}"></i>` : `<span class="ic2">${it.icon}</span>`}<b>${esc(it.name)}</b><small>${wear ? '穿著中' : has ? '換上' : `${it.price} 顆`}</small></button>`; }).join('')}${on ? `<button type="button" class="it off" data-cat="${cat}" data-off="1"><span class="ic2">✕</span><b>不穿</b><small>脫下</small></button>` : ''}</div></div>`; }).join(''); }
  function cityList(st, compact) { return `<ol class="city-list${compact ? ' compact' : ''}">${st.map(p => `<li class="${p.st}"><span class="st">${p.st === 'done' ? '✅' : p.st === 'now' ? '🚧' : '🔒'}</span><span class="nm"><b>${esc(p.name)}</b><small>${esc(islandName(p.island))}・${fmt(p.cost)} 顆</small></span>${p.st === 'now' ? `<span class="bar"><i style="width:${(p.got / p.cost * 100).toFixed(1)}%"></i></span><span class="pc">${fmt(p.got)}／${fmt(p.cost)}</span>` : ''}</li>`).join('')}</ol>`; }
  function cityHtml(e) { const st = cityState(e.built), done = st.filter(p => p.st === 'done').length, now = st.find(p => p.st === 'now'), site = at('site');
    return `<p class="shop-lead">全站一起蓋：大家投入的金蛋加總，依序蓋下面這些建築；蓋好的會換掉那座島上的小房子，所有人的地圖上都看得到。你投入的金蛋也會再算一次進你行政區的 12 區對抗。</p>
      <div class="city-sum"><b>${fmt(e.built)}</b><span>顆金蛋已投入・蓋好 ${done}／${st.length} 棟・你投入 ${fmt(e.myBuilt)} 顆</span></div>
      ${now ? (site ? `<p class="where ok">🚧 你在「${esc(now.name)}」工地旁邊，可以投金蛋。</p><div class="give">${E.buildAmounts.map(n => `<button type="button" class="go2" data-build="${n}" ${e.wallet < n ? 'disabled' : ''}>投入 ${n} 顆</button>`).join('')}</div>` : `<p class="where">走到「${esc(now.name)}」的工地（${esc(islandName(now.island))}）旁邊才能投金蛋。${goBtn('site', '帶我去工地')}</p>`) : '<p class="shop-lead">全部蓋好了！之後有新建設會再公告。</p>'}
      ${cityList(st)}
      ${e.builders.length ? `<h4>建設榜</h4><ol class="mini-board">${e.builders.slice(0, 5).map((h, i) => `<li><span class="r">${i + 1}</span><span class="n">${esc(h.nick || '匿名打工仔')}</span><b>${fmt(h.n)}</b></li>`).join('')}</ol>` : ''}`; }
  function donateHtml(e) { const n = tierCount(e.donated), next = E.donate.tiers[n], m = at('mayor');
    return `<p class="shop-lead">二創惡搞：把金蛋捐給遊戲裡的市長。全站累計到門檻就解鎖<b>全城加成</b>，所有人都吃得到。捐了市長會回你一句。</p>
      <div class="city-sum"><b>${fmt(e.donated)}</b><span>顆全站累計${next ? `・再 ${fmt(next.at - e.donated)} 顆解鎖「${esc(next.name)}」` : '・全城加成全部解鎖'}・你捐了 ${fmt(e.myDonated)} 顆</span></div>
      ${m ? `<p class="where ok">🎙 ${esc(C.mayor.name)}就在旁邊。</p><div class="give">${E.donate.amounts.map(k => `<button type="button" class="go2" data-donate="${k}" ${e.wallet < k ? 'disabled' : ''}>捐 ${k} 顆</button>`).join('')}</div>` : `<p class="where">走到${esc(C.mayor.name)}旁邊才能捐（市長在巡迴政策建築，名牌是「🎙 市長」）。${goBtn('mayor', '帶我去找市長')}</p>`}
      ${mayorLine ? `<p class="mayor-say"><span>🎙 ${esc(C.mayor.name)}</span>「${esc(mayorLine)}」</p>` : ''}
      <ol class="tiers">${E.donate.tiers.map((t, i) => `<li class="${i < n ? 'on' : ''}"><span class="st">${i < n ? '✨' : '🔒'}</span><span class="nm"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></span><span class="at">${fmt(t.at)} 顆</span></li>`).join('')}</ol>
      ${e.donors.length ? `<h4>獻金榜</h4><ol class="mini-board">${e.donors.map((h, i) => `<li><span class="r">${i + 1}</span><span class="n">${esc(h.nick || '匿名打工仔')}</span><b>${fmt(h.n)}</b></li>`).join('')}</ol>` : ''}`; }
  // 大廳的逛城市分頁：錢包、城市建設進度、獻金榜（唯讀）
  function renderLobby() { const e = S.econ(); $('xWallet').innerHTML = `<span class="egg" aria-hidden="true"></span><b>${fmt(e.wallet)}</b><span>顆金蛋可以花${e.local ? '（只記在這台裝置）' : ''}</span>`;
    $('xCity').innerHTML = cityList(cityState(e.built), true);
    $('xDonors').innerHTML = e.donors.length ? e.donors.map((h, i) => `<li><span class="rank">${i + 1}</span><span class="who">${esc(h.nick || '匿名打工仔')}</span><b>${fmt(h.n)}</b></li>`).join('') : '<li class="empty">還沒有人捐。走到市長旁邊就能捐。</li>'; }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  async function act(fn) { if (busy) return; busy = true; try { return await fn(); } finally { busy = false; render(); sync(); onChange && onChange(); } }
  $('shopTabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('shopBody').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.go) { const k = b.dataset.go; if (goTo(k)) hint({ boutique: '往最近的服飾店走', site: '往工地走', mayor: '去找市長' }[k]); else hint('找不到可以去的地方', true); return; }
    if (b.dataset.cat) act(async () => { const cat = b.dataset.cat; if (b.dataset.off) { await S.unequip(cat); hint('脫下了'); return; } const it = E.outfits[cat].items[b.dataset.id]; const owned = S.econ().owned.includes(cat + ':' + b.dataset.id);
      if (!owned && !at('boutique')) { hint('買新衣服要走進服飾店', true); return; } const r = await S.buy(cat, b.dataset.id); if (!r.ok) { hint(r.why === 'poor' ? '金蛋不夠，去打工賺吧' : '買不了', true); return; } hint(r.equip ? `換上${it.name}` : `買了${it.name}，花 ${it.price} 顆金蛋`); });
    else if (b.dataset.build) act(async () => { if (!at('site')) { hint('要走到工地旁邊才能投', true); return; } const n = +b.dataset.build, before = cityState(S.econ().built).filter(p => p.st === 'done').length; const r = await S.give('built', n); if (!r.ok) { hint('金蛋不夠，去打工賺吧', true); return; } const done = cityState(S.econ().built).filter(p => p.st === 'done'); if (done.length > before) { const p = done[done.length - 1]; banner(`🏗 ${p.name} 蓋好了！`, 3); shout(`${p.name}落成！謝謝大家一起蓋！`); } else hint(`投入 ${n} 顆金蛋蓋城市`); });
    else if (b.dataset.donate) act(async () => { if (!at('mayor')) { hint('要走到市長旁邊才能捐', true); return; } const n = +b.dataset.donate; const r = await S.give('donated', n); if (!r.ok) { hint('金蛋不夠，去打工賺吧', true); return; } const L = E.donate.lines; mayorLine = pick(n <= 5 ? L.small : n <= 20 ? L.mid : L.big); shout(mayorLine); }); });
  // 全站數字更新時：蓋城市的模型、全城加成解鎖的公告（每台裝置每階只公告一次）
  const TIER_KEY = 'pi-tier-seen'; let seen = (() => { try { return +localStorage.getItem(TIER_KEY) || 0; } catch (e) { return 0; } })();
  let fest = false; // 「城市嘉年華」解鎖了沒（每幀都會問，先算好）
  function sync() { const e = S.econ(); placeCity(cityState(e.built)); const n = tierCount(e.donated); fest = E.donate.tiers.some(t => t.fireworks && e.donated >= t.at);
    if (n > seen) { const t = E.donate.tiers[n - 1]; if (seen || n === 1) { banner(`✨ 全城加成解鎖：${t.name}（${t.desc}）`, 4); shout(E.donate.lines.tier.replace('{name}', t.name)); mayorLine = E.donate.lines.tier.replace('{name}', t.name); } seen = n; try { localStorage.setItem(TIER_KEY, String(n)); } catch (err) { /* 無痕 */ } } }
  // 市長巡迴時，每講幾次就感謝一下獻金榜第一名
  let speeches = 0; function onSpeech(m, say) { if (++speeches % 4) return; const top = S.econ().donors[0]; if (top && top.nick) say(m, '📣 ' + E.donate.lines.thanks.replace('{nick}', top.nick)); }
  $('shopLegal').textContent = E.legal;
  return { render, renderLobby, setTab, get tab() { return tab; }, sync, onSpeech, cityState, festival: () => fest };
}
