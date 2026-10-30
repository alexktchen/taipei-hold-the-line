/* 金蛋商店（逛校園裡的面板）：錢包、衣服（服飾店裡買，買過的隨時能換）、蓋校園（走到工地投金蛋；全站一起依序蓋，蓋好的出現在每個人的地圖上）、
   捐書（遊戲；走到校長旁邊捐，全站累計解鎖全校加成，校長會回話）。不在地點旁邊時按「帶我去」自動走過去。
   金蛋只有闖關賺；這裡只花。數字都在 config.econ。 */
import { CONFIG as C } from './config.js';
const E = C.econ, $ = id => document.getElementById(id);
export function createShop({ S, esc, fmt, hint, banner, placeCity, shout, islandName, onChange, near, goTo, who }) {
  let tab = 'fit', busy = false, mayorLine = '';
  const cats = Object.entries(E.outfits);
  const at = kind => { const n = near(); return !!(n && n.kind === kind); };
  // 蓋校園的進度：依序蓋，前面的蓋好才輪到下一棟
  function cityState(built) { let left = built; const st = E.city.map((p, i) => { if (left >= p.cost) { left -= p.cost; return { ...p, i, st: 'done', got: p.cost }; } const got = left; left = 0; return { ...p, i, st: 'todo', got }; });
    const now = st.findIndex(p => p.st !== 'done'); return st.map((p, i) => ({ ...p, st: p.st === 'done' ? 'done' : i === now ? 'now' : 'lock' })); }
  const tierCount = d => E.donate.tiers.filter(t => d >= t.at).length;
  const WHY = { poor: '金蛋不夠，去闖關賺吧', offline: '沒連上雲端，金蛋只記在雲端，連上才能花', nocols: '雲端的金蛋帳本還沒開（supabase/economy.sql），暫時不能花', net: '連線不穩，沒有花成，再試一次' }, whyOf = r => WHY[r.why] || '買不了';
  const goBtn = (kind, txt) => `<button type="button" class="go2 go-there" data-go="${kind}">👣 ${txt}</button>`;
  function setTab(t) { if (t) tab = t; render(); }
  function render() { const e = S.econ(); $('wallet').textContent = fmt(e.wallet);
    $('walletNote').textContent = e.blocked === 'offline' ? '（沒連上雲端，金蛋只記在雲端，現在不能花）' : e.blocked === 'nocols' ? '（雲端的金蛋帳本還沒開，暫時不能花）' : `累計賺 ${fmt(e.eggs)} 顆${e.gift ? `・GM 發 ${fmt(e.gift)} 顆` : ''}`;
    $('shopTabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $('shopBody').innerHTML = tab === 'fit' ? fitHtml(e) : tab === 'city' ? cityHtml(e) : donateHtml(e); }
  function fitHtml(e) { const parts = e.outfit.split('.'), worn = {}, own = new Set(e.owned), shop = at('boutique'); ['hat', 'color', 'acc', 'suit'].forEach((c, i) => { worn[c] = parts[i] && parts[i] !== '-' ? parts[i] : ''; });
    return (shop ? '<p class="where ok">👕 歡迎光臨服飾店！買了就一直是你的，同一類一次穿一件，其他玩家看得到。</p>' : `<p class="where">買新衣服要走進服飾店（地圖上標「👕 服飾店」）；買過的隨時能換。${goBtn('boutique', '帶我去最近的服飾店')}</p>`)
      + (who ? (p => `<div class="fit-row who"><span class="k">角色</span><div class="fit-items"><label class="nick">暱稱<input id="shopNick" type="text" maxlength="24" value="${esc(p.nick)}" autocomplete="nickname"></label><label class="nick">我的學期（每次都從這裡出發，也算進學期對抗）<span class="home-row"><select id="shopDistrict">${who.districts().map(d => `<option value="${d.id}"${d.id === p.district ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select><button type="button" class="go2" data-home="1">🏠 回我的學期</button></span></label>${Object.entries(C.heroes).map(([id, H]) => `<button type="button" class="it${p.cls === id ? ' wear' : ''}" data-cls="${id}" aria-pressed="${p.cls === id}"><span class="ic2">${H.icon}</span><b>${esc(H.name)}</b><small>${p.cls === id ? '現在的角色' : '換角色（免費）'}</small></button>`).join('')}</div></div>`)(who.get()) : '')
      + ['suit', 'hat', 'color', 'acc'].map(cat => { const c = E.outfits[cat], on = worn[cat], list = Object.entries(c.items);
        const btn = ([id, it]) => { const free = it.price === 0, has = free || own.has(cat + ':' + id), wear = on === id, can = has || (shop && e.wallet >= it.price);
          return `<button type="button" class="it${wear ? ' wear' : ''}${it.desc ? ' suit' : ''}" data-cat="${cat}" data-id="${id}" aria-pressed="${wear}" ${can ? '' : 'disabled'} title="${esc(it.desc || it.name)}">${it.c != null ? `<i class="sw" style="background:#${it.c.toString(16).padStart(6, '0')}"></i>` : `<span class="ic2">${it.icon}</span>`}<b>${esc(it.name)}</b><small>${wear ? '穿著中' : free ? '免費換上' : has ? '換上' : `${it.price} 顆`}</small>${it.desc ? `<em>${esc(it.desc)}</em>` : ''}</button>`; };
        const off = on ? `<button type="button" class="it off" data-cat="${cat}" data-off="1"><span class="ic2">✕</span><b>${cat === 'suit' ? '脫下套裝' : '不穿'}</b><small>脫下</small></button>` : '';
        if (cat === 'suit') return `<div class="fit-row halloween"><span class="k">🎭 變裝派對</span><div><p class="hw-note">套裝會蓋過帽子、背心、配件。前 10 套免費、隨時能換；其他 ${list.filter(([, it]) => it.price).length} 套在服飾店用金蛋買。</p>
          <div class="fit-items">${list.filter(([, it]) => !it.price).map(btn).join('')}${off}</div><div class="fit-items paid">${list.filter(([, it]) => it.price).map(btn).join('')}</div></div></div>`;
        return `<div class="fit-row"><span class="k">${esc(c.label)}</span><div class="fit-items">${list.map(btn).join('')}${off}</div></div>`; }).join(''); }
  const linkName = id => islandName(id) || (E.city.find(x => x.id === id) || {}).name || ''; // 新莊接的是三重（也是新島的區）
  function cityList(st, compact) { return `<ol class="city-list${compact ? ' compact' : ''}">${st.map(p => `<li class="${p.st}"><span class="st">${p.st === 'done' ? '✅' : p.st === 'now' ? '🚧' : '🔒'}</span><span class="nm"><b>${esc(p.name)}</b><small>${p.kind === 'island' ? `新島・接${esc(linkName(p.link))}${p.via ? `（${esc(p.via)}）` : ''}` : esc(islandName(p.island))}・${fmt(p.cost)} 顆</small></span>${p.st === 'now' ? `<span class="bar"><i style="width:${(p.got / p.cost * 100).toFixed(1)}%"></i></span><span class="pc">${fmt(p.got)}／${fmt(p.cost)}</span>` : ''}</li>`).join('')}</ol>`; }
  function cityHtml(e) { const st = cityState(e.built), done = st.filter(p => p.st === 'done').length, now = st.find(p => p.st === 'now'), site = at('site');
    return `<p class="shop-lead">全站一起蓋：大家投入的金蛋加總，依序蓋下面這些建築；蓋好的會換掉那座島上的小房子，所有人的地圖上都看得到。你投入的金蛋也會再算一次進你學期的學期對抗。</p>
      <div class="city-sum"><b>${fmt(e.built)}</b><span>顆金蛋已投入・蓋好 ${done}／${st.length} 棟・你投入 ${fmt(e.myBuilt)} 顆</span></div>
      ${now ? (site ? `<p class="where ok">🚧 你在「${esc(now.name)}」工地旁邊，可以投金蛋。</p><div class="give">${E.buildAmounts.map(n => `<button type="button" class="go2" data-build="${n}" ${e.wallet < n ? 'disabled' : ''}>投入 ${n} 顆</button>`).join('')}</div>` : `<p class="where">走到「${esc(now.name)}」的工地（${now.kind === 'island' ? `${esc(islandName(now.link))}靠海那邊，海上正在填海` : esc(islandName(now.island))}）旁邊才能投金蛋。${goBtn('site', '帶我去工地')}</p>`) : '<p class="shop-lead">全部蓋好了！之後有新建設會再公告。</p>'}
      ${cityList(st)}
      ${e.builders.length ? `<h4>建設榜</h4><ol class="mini-board">${e.builders.slice(0, 5).map((h, i) => `<li><span class="r">${i + 1}</span><span class="n">${esc(h.nick || '匿名小學生')}</span><b>${fmt(h.n)}</b></li>`).join('')}</ol>` : ''}`; }
  function donateHtml(e) { const n = tierCount(e.donated), next = E.donate.tiers[n], m = at('mayor');
    return `<p class="shop-lead">把金蛋捐給校長，幫圖書館買書。全站累計到門檻就解鎖<b>全校加成</b>，所有人都吃得到。捐了校長會回你一句。</p>
      <div class="city-sum"><b>${fmt(e.donated)}</b><span>顆全站累計${next ? `・再 ${fmt(next.at - e.donated)} 顆解鎖「${esc(next.name)}」` : '・全校加成全部解鎖'}・你捐了 ${fmt(e.myDonated)} 顆</span></div>
      ${m ? `<p class="where ok">🎙 ${esc(C.mayor.name)}就在旁邊。</p><div class="give">${E.donate.amounts.map(k => `<button type="button" class="go2" data-donate="${k}" ${e.wallet < k ? 'disabled' : ''}>捐 ${k} 顆</button>`).join('')}</div>` : `<p class="where">走到${esc(C.mayor.name)}旁邊才能捐（校長在巡迴課程建築，名牌是「🎙 校長」）。${goBtn('mayor', '帶我去找校長')}</p>`}
      ${mayorLine ? `<p class="mayor-say"><span>🎙 ${esc(C.mayor.name)}</span>「${esc(mayorLine)}」</p>` : ''}
      <ol class="tiers">${E.donate.tiers.map((t, i) => `<li class="${i < n ? 'on' : ''}"><span class="st">${i < n ? '✨' : '🔒'}</span><span class="nm"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></span><span class="at">${fmt(t.at)} 顆</span></li>`).join('')}</ol>
      ${e.donors.length ? `<h4>捐書榜</h4><ol class="mini-board">${e.donors.map((h, i) => `<li><span class="r">${i + 1}</span><span class="n">${esc(h.nick || '匿名小學生')}</span><b>${fmt(h.n)}</b></li>`).join('')}</ol>` : ''}`; }
  const pick = a => a[Math.floor(Math.random() * a.length)];
  async function act(fn) { if (busy) return; busy = true; try { return await fn(); } finally { busy = false; render(); sync(); onChange && onChange(); } }
  $('shopTabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab); });
  $('shopBody').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.home && who) { who.goHome(); return; }
    if (b.dataset.cls && who) { who.setCls(b.dataset.cls); render(); onChange && onChange(); hint(`換成${C.heroes[b.dataset.cls].name}`); return; }
    if (b.dataset.go) { const k = b.dataset.go; if (goTo(k)) hint({ boutique: '往最近的服飾店走', site: '往工地走', mayor: '去找校長' }[k]); else hint('找不到可以去的地方', true); return; }
    if (b.dataset.cat) act(async () => { const cat = b.dataset.cat; if (b.dataset.off) { const r = await S.unequip(cat); hint(r.ok ? '脫下了' : whyOf(r), !r.ok); return; } const it = E.outfits[cat].items[b.dataset.id]; const owned = S.econ().owned.includes(cat + ':' + b.dataset.id) || it.price === 0;
      if (!owned && !at('boutique')) { hint('買新衣服要走進服飾店', true); return; } const r = await S.buy(cat, b.dataset.id); if (!r.ok) { hint(whyOf(r), true); return; } hint(r.equip ? `換上${it.name}` : `買了${it.name}，花 ${it.price} 顆金蛋`); });
    else if (b.dataset.build) act(async () => { if (!at('site')) { hint('要走到工地旁邊才能投', true); return; } const n = +b.dataset.build, before = cityState(S.econ().built).filter(p => p.st === 'done').length; const r = await S.give('built', n); if (!r.ok) { hint(whyOf(r), true); return; } const done = cityState(S.econ().built).filter(p => p.st === 'done'); if (done.length > before) { const p = done[done.length - 1]; if (p.kind === 'island') { banner(`🌉 新島・${p.name}接上了！`, 3); shout(`${p.name}${p.via ? `的${p.via}` : ''}通了，歡迎新島的朋友來逛！`); } else { banner(`🏗 ${p.name} 蓋好了！`, 3); shout(`${p.name}落成！謝謝大家一起蓋！`); } } else hint(`投入 ${n} 顆金蛋蓋校園`); });
    else if (b.dataset.donate) act(async () => { if (!at('mayor')) { hint('要走到校長旁邊才能捐', true); return; } const n = +b.dataset.donate; const r = await S.give('donated', n); if (!r.ok) { hint(whyOf(r), true); return; } const L = E.donate.lines; mayorLine = pick(n <= 5 ? L.small : n <= 20 ? L.mid : L.big); shout(mayorLine); }); });
  // 全站數字更新時：蓋校園的模型、全校加成解鎖的公告（每台裝置每階只公告一次）
  const TIER_KEY = 'pi-tier-seen'; let seen = (() => { try { return +localStorage.getItem(TIER_KEY) || 0; } catch (e) { return 0; } })();
  let fest = false; // 「校慶嘉年華」解鎖了沒（每幀都會問，先算好）
  function sync() { const e = S.econ(); placeCity(cityState(e.built)); const n = tierCount(e.donated); fest = E.donate.tiers.some(t => t.fireworks && e.donated >= t.at);
    if (n > seen) { const t = E.donate.tiers[n - 1]; if (seen || n === 1) { banner(`✨ 全校加成解鎖：${t.name}（${t.desc}）`, 4); shout(E.donate.lines.tier.replace('{name}', t.name)); mayorLine = E.donate.lines.tier.replace('{name}', t.name); } seen = n; try { localStorage.setItem(TIER_KEY, String(n)); } catch (err) { /* 無痕 */ } } }
  // 校長巡迴時，每講幾次就感謝一下捐書榜第一名
  let speeches = 0; function onSpeech(m, say) { if (++speeches % 4) return; const top = S.econ().donors[0]; if (top && top.nick) say(m, '📣 ' + E.donate.lines.thanks.replace('{nick}', top.nick)); }
  $('shopBody').addEventListener('change', e => { if (!who) return; if (e.target.id === 'shopNick') { who.setNick(e.target.value); onChange && onChange(); hint('暱稱改好了'); } else if (e.target.id === 'shopDistrict') { who.setDistrict(e.target.value); onChange && onChange(); hint(`之後都從${islandName(e.target.value)}出發；按「回我的學期」現在就過去`); } });
  $('shopLegal').textContent = E.legal;
  return { render, setTab, get tab() { return tab; }, sync, onSpeech, cityState, festival: () => fest };
}
