/* 各區小遊戲（DOM 視窗，內容在 data/games.json）：
   注音小村＝拼音煮湯鍋、識字林＝收服錯字小怪、書塔山頂＝字精靈（多音字）與鄰居來信、修辭花園＝種修辭花、成語古城＝石碑典故解謎。
   部首山谷的「幫迷路的字找部落」在 3D 地圖裡玩（map.js），這裡只放共用的進度。
   朗讀用 Web Speech API（zh-TW）：題目、故事、信件都有「🔊」按鈕；會洩漏答案的（多音字的句子）答完才念。 */
import { modal, close, speak, SLOW, el, esc, ruby, recordPass, dataNow, quizOf, nodeById, nodeState, NODES } from './learn.js';
const BASE = new URL('.', import.meta.url).href;
const KEY = 'forest.games.v1';
let S = { items: {}, monsters: 0, captured: 0, flowers: [], gates: {}, letters: {}, tribes: 0 }; try { Object.assign(S, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
export const gameState = () => S;
let G = null; export async function loadGames() { if (!G) G = await (await fetch(BASE + 'data/games.json')).json(); return G; }
export const games = () => G;
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const itemCount = () => Object.values(S.items).reduce((a, b) => a + b, 0);
const CSS = `.gm-row{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.gm-row b{width:100%;font-size:14px;color:#8a7a92}
.gm-k{border:0;border-radius:12px;min-width:44px;height:44px;font:inherit;font-size:22px;font-weight:900;background:#fff;color:#4a3b52;box-shadow:0 3px 0 #ead9cc;cursor:pointer}.gm-k[aria-pressed=true]{background:#f09a8a;color:#fff;box-shadow:0 3px 0 #d4786a}
.gm-pot{display:flex;align-items:center;justify-content:center;gap:14px;background:#4a3b52;color:#fff;border-radius:50% 50% 40% 40%/30% 30% 70% 70%;height:96px;margin:6px auto 10px;max-width:320px;font-size:36px;font-weight:900;letter-spacing:.06em;box-shadow:inset 0 -10px 0 #3a2c44}
.gm-want{font-size:20px;font-weight:800;text-align:center}.gm-want .em{font-size:56px;display:block}
.gm-sign{display:flex;gap:6px;justify-content:center;background:#c99a6a;padding:14px;border-radius:14px;box-shadow:inset 0 0 0 6px #9a6b48;margin:8px 0}.gm-sign button{border:0;background:#fff8ec;border-radius:8px;font:inherit;font-size:34px;font-weight:900;width:58px;height:62px;color:#4a3b52;cursor:pointer}.gm-sign button.no{background:#f6b6ad}.gm-sign button.ok{background:#b7e4a4}
.gm-spirit{font-size:72px;text-align:center;transition:transform .3s}.gm-spirit.pop{transform:scale(1.25) rotate(-8deg)}
.gm-sent{font-size:24px;text-align:center;line-height:1.8;margin:6px 0}.gm-sent mark{background:#fff3c4;border-radius:6px;padding:0 4px;color:#e8705c;font-weight:900}
.gm-story{background:#efe9f2;border-radius:14px;padding:14px 16px;line-height:1.9;font-size:17px;white-space:pre-wrap;box-shadow:inset 0 0 0 4px #d8d0e0}
.gm-letter{background:#fffdf4;border-radius:10px;padding:14px 18px;line-height:1.9;font-size:17px;white-space:pre-wrap;box-shadow:0 2px 10px #6a4f7a22;background-image:repeating-linear-gradient(#fffdf4 0 31px,#f0e4cf 31px 32px)}
.gm-bag{font-size:30px;letter-spacing:4px;text-align:center}.gm-note{color:#8a7a92;font-size:14px;text-align:center}`;
let styled = false; const style = () => { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); };
const btn = (txt, cls = 'lf-btn go') => el('button', cls, txt);
const readBtn = (text, rate = 0.75, label = '🔊 朗讀') => { const b = btn(label, 'lf-btn alt'); b.onclick = () => speak(text, rate); return b; };
// 四選一（共用）：答錯會顯示說明；retry＝答錯後可以再選（成語、讀信）
function ask(body, { q, choices, a, why = '', read = true }, done, { retry = false } = {}) {
  const wrap = el('div'); body.appendChild(wrap); const row = el('div', 'lf-q', esc(q) + ' '); wrap.appendChild(row); if (read) { const r = readBtn(q.replace(/＿+/g, '什麼')); r.style.cssText = 'padding:4px 12px;font-size:14px'; row.appendChild(r); }
  const ch = el('div', 'lf-ch'); wrap.appendChild(ch); let tries = 0;
  choices.forEach((c, k) => { const b = el('button', null, `${k + 1}. ${esc(c)}`); b.onclick = () => { tries++; const ok = k === a;
      if (!ok && retry) { b.classList.add('no'); b.disabled = true; const w = el('div', 'lf-why', `再想想看！${why ? esc(why) : ''}`); wrap.querySelector('.lf-why')?.remove(); wrap.appendChild(w); return; }
      [...ch.children].forEach(x => x.disabled = true); b.classList.add(ok ? 'ok' : 'no'); ch.children[a].classList.add('ok'); wrap.querySelector('.lf-why')?.remove(); wrap.appendChild(el('div', 'lf-why', `${ok ? '答對了！🎉' : `答案是「${esc(choices[a])}」`}${why ? '　' + esc(why) : ''}`)); done(ok && tries === 1, wrap); }; ch.appendChild(b); });
  return wrap; }
const mkQ = (row, read = true) => { const [q, ans, ...rest] = row; const choices = shuffle([ans, ...rest]); return { q, choices, a: choices.indexOf(ans), read }; };
const played = name => dispatchEvent(new CustomEvent('forest', { detail: { type: 'game', name } })); // 給集章冊的每日任務
function finish(body, { title, em, lines = [], again, node, right, total }) { body.innerHTML = ''; played(title); const res = node && right != null ? recordPass(node, right, total) : null;
  const d = el('div', 'lf-done', `<div class="em">${em}</div><h3>${esc(title)}</h3>${lines.map(l => `<p>${l}</p>`).join('')}${res ? `<p class="gm-note">也算「${esc(nodeById(node).name)}」的練習：熟練度 ${'★'.repeat(res.level)}${'☆'.repeat(3 - res.level)}</p>` : ''}`);
  const bs = el('div', 'lf-btns'); bs.style.justifyContent = 'center'; if (again) { const a = btn('再玩一次', 'lf-btn alt'); a.onclick = again; bs.appendChild(a); } const c = btn('回到森林'); c.onclick = close; bs.appendChild(c); d.appendChild(bs); body.appendChild(d); }

// ── 注音小村：拼音煮湯鍋。選聲母、介音、韻母、聲調放進鍋裡，拼出食材的讀音就煮出那樣東西（例如ㄩˊ得到魚）──
const INI = [...'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ'], MED = [...'ㄧㄨㄩ'], FIN = [...'ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ'], TONE = [['一聲', ''], ['二聲', 'ˊ'], ['三聲', 'ˇ'], ['四聲', 'ˋ'], ['輕聲', '˙']];
export async function soup() { style(); await loadGames(); const D = dataNow(), cfg = G.soup, m = modal({ title: '拼音煮湯鍋', sub: '注音小村', icon: 'region-zhuyin-village' });
  const order = shuffle(cfg.items).slice(0, cfg.round); let i = 0, right = 0, got = [];
  const round = () => { const b = m.body; b.innerHTML = ''; if (i >= order.length) return finish(b, { title: '湯煮好了！', em: '🍲', lines: [`煮出了 ${right}／${order.length} 樣食材`, `<span class="gm-bag">${got.join(' ')}</span>`], again: soup, node: cfg.node, right, total: order.length });
    const [c, e] = order[i], want = D.ch(c).b[0], pickd = { ini: '', med: '', fin: '', tone: '' }; let tries = 0;
    b.appendChild(el('div', 'gm-want', `<span class="em">${e}</span>第 ${i + 1}／${order.length} 道：拼出「${esc(c)}」的注音放進鍋裡`)); const say = readBtn(`${c}，${c}`, SLOW, '🔊 聽聽看'); say.style.display = 'block'; say.style.margin = '6px auto'; b.appendChild(say); speak(`${c}，${c}`, SLOW);
    const pot = el('div', 'gm-pot', '　'); b.appendChild(pot);
    const compose = () => (pickd.tone === '˙' ? '˙' : '') + pickd.ini + pickd.med + pickd.fin + (pickd.tone !== '˙' ? pickd.tone : '');
    const show = () => { pot.textContent = (pickd.ini + pickd.med + pickd.fin) ? compose() : '　'; };
    const row = (label, keys, field, txt = x => x) => { const r = el('div', 'gm-row', `<b>${label}</b>`); keys.forEach(k => { const kv = Array.isArray(k) ? k[1] : k, bt = el('button', 'gm-k', esc(Array.isArray(k) ? k[0] : k)); bt.setAttribute('aria-pressed', 'false'); bt.onclick = () => { pickd[field] = pickd[field] === kv && field !== 'tone' ? '' : kv; [...r.querySelectorAll('.gm-k')].forEach(x => x.setAttribute('aria-pressed', String(x === bt && pickd[field] === kv))); show(); }; r.appendChild(bt); }); b.appendChild(r); return r; };
    row('聲母', INI, 'ini'); row('介音（ㄧㄨㄩ）', MED, 'med'); row('韻母', FIN, 'fin'); const tr = row('聲調', TONE, 'tone'); tr.querySelectorAll('.gm-k').forEach(x => { x.style.fontSize = '16px'; x.style.padding = '0 10px'; });
    const go = btn('🍲 下鍋煮！'); go.style.marginTop = '8px'; b.appendChild(go); const fb = el('div'); b.appendChild(fb);
    go.onclick = () => { const z = compose(); if (!(pickd.ini + pickd.med + pickd.fin)) return; tries++;
      if (z === want) { if (tries === 1) right++; got.push(e); S.items[e] = (S.items[e] || 0) + 1; save(); speak(c, SLOW); fb.innerHTML = ''; fb.appendChild(el('div', 'lf-why', `咕嘟咕嘟⋯⋯煮出了 ${e}「${esc(c)}」（${esc(want)}）！`)); go.disabled = true; const nx = btn('下一道 →'); nx.style.marginTop = '8px'; nx.onclick = () => { i++; round(); }; fb.appendChild(nx); return; }
      fb.innerHTML = ''; fb.appendChild(el('div', 'lf-why', tries >= 2 ? `鍋子冒出黑煙了⋯⋯「${esc(c)}」念 <b>${esc(want)}</b>，照著拼一次吧！` : `咦，煮出來不太對（${esc(z)}）。再聽一次，想想開頭的聲音和聲調。`)); };
  }; round(); }

// ── 識字林：錯字小怪（晚上才出現）把招牌改錯了。先點出錯的字，再選正確的字，就能收服牠 ──
export async function typo(sign, onCaptured) { style(); await loadGames(); const cfg = G.typo, m = modal({ title: '收服錯字小怪', sub: '識字林・夜晚', icon: 'region-character-forest' }), b = m.body;
  const wrong = [...sign.wrong], right = [...sign.right], at = wrong.findIndex((c, k) => c !== right[k]);
  b.appendChild(el('div', 'gm-want', `<span class="em">👾</span>錯字小怪把招牌改錯了！哪一個字寫錯了？`)); const board = el('div', 'gm-sign'); b.appendChild(board); const fb = el('div'); b.appendChild(fb); let miss = 0;
  wrong.forEach((c, k) => { const t = el('button', null, esc(c)); t.onclick = () => { if (k !== at) { miss++; t.classList.add('no'); fb.innerHTML = '<div class="lf-why">這個字沒有錯，再找找看！</div>'; return; } [...board.children].forEach(x => x.disabled = true); t.classList.add('no'); fb.innerHTML = '';
      ask(fb, { q: `「${sign.wrong}」裡的「${c}」應該改成哪一個字？`, choices: shuffle(sign.options), a: -1, read: false }, () => {}); const ch = fb.querySelector('.lf-ch'); const opts = [...ch.children]; opts.forEach(o => { const v = o.textContent.replace(/^\d\.\s*/, ''); o.onclick = () => { opts.forEach(x => x.disabled = true); const ok = v === right[at]; o.classList.add(ok ? 'ok' : 'no'); opts.find(x => x.textContent.endsWith(right[at])).classList.add('ok');
        t.textContent = right[at]; t.classList.remove('no'); t.classList.add('ok'); speak(sign.right, 0.75);
        const good = ok && miss === 0; fb.appendChild(el('div', 'lf-why', `${good ? '收服成功！👾✨' : '招牌修好了，小怪逃走前被你收服了！'}　正確是「${esc(sign.right)}」。${esc(sign.why)}`)); S.monsters++; S.captured++; save(); onCaptured && onCaptured(); played('typo');
        const res = S.captured % cfg.round === 0 ? recordPass(cfg.node, cfg.round, cfg.round) : null; if (res) fb.appendChild(el('p', 'gm-note', `已經收服 ${S.monsters} 隻錯字小怪！也算「${esc(nodeById(cfg.node).name)}」的練習`)); const c2 = btn('回到森林'); c2.style.marginTop = '8px'; c2.onclick = close; fb.appendChild(c2); }; }); }; board.appendChild(t); }); }

// ── 書塔山頂：字精靈。依句子換造型，選出這個多音字在句子裡的正確讀音（答完才朗讀句子）──
const COSTUME = ['🧚', '🧞', '🦄', '🐉', '🧜'];
export async function spirit() { style(); await loadGames(); const D = dataNow(), cfg = G.spirit, m = modal({ title: '字精靈的變裝秀', sub: '書塔山頂・多音字', icon: 'region-book-tower' });
  const order = shuffle(cfg.sentences).slice(0, cfg.round); let i = 0, right = 0;
  const round = () => { const b = m.body; b.innerHTML = ''; if (i >= order.length) return finish(b, { title: '變裝秀結束！', em: '🧚', lines: [`答對 ${right}／${order.length} 題`], again: spirit, node: cfg.node, right, total: order.length });
    const [c, w, sent] = order[i], ans = D.syl(w, c), readings = [...new Set([...cfg.sentences.filter(x => x[0] === c).map(x => D.syl(x[1], c)), ...D.ch(c).b])], opts = shuffle([ans, ...readings.filter(x => x !== ans).slice(0, 3)]);
    const sp = el('div', 'gm-spirit', '✨'); b.appendChild(sp); b.appendChild(el('div', 'gm-note', `字精靈拿著「${esc(c)}」，牠會照句子換上不同的衣服`));
    const k = sent.indexOf(w), kk = k + [...w].indexOf(c); b.appendChild(el('div', 'gm-sent', esc(sent.slice(0, kk)) + `<mark>${esc(c)}</mark>` + esc(sent.slice(kk + 1))));
    ask(b, { q: `句子裡的「${c}」怎麼念？`, choices: opts, a: opts.indexOf(ans), why: `「${w}」念 ${D.w(w)}。`, read: false }, (ok, wrap) => { if (ok) right++; sp.textContent = COSTUME[readings.indexOf(ans) % COSTUME.length]; sp.classList.add('pop'); setTimeout(() => sp.classList.remove('pop'), 300); speak(sent, SLOW);
      wrap.appendChild(el('div', 'gm-note', `字精靈換上了「${esc(ans)}」的衣服！`)); const r = readBtn(sent, SLOW, '🔊 再念一次句子'); const nx = btn('下一句 →'); const row = el('div', 'lf-btns'); row.style.marginTop = '8px'; row.append(r, nx); wrap.appendChild(row); nx.onclick = () => { i++; round(); }; }); };
  round(); }

// ── 修辭花園：判斷或完成修辭句，種出對應的花（譬喻開雙色花、誇飾長出超大花⋯⋯）──
export const RHETORIC = ['piyu', 'niren', 'kuashi', 'paibi', 'shewen', 'yingchen'];
export async function flower(slot, onPlant) { style(); await loadGames(); const D = dataNow(), m = modal({ title: '種一朵修辭花', sub: '修辭花園', icon: 'region-rhetoric-garden' }), b = m.body;
  const avail = RHETORIC.filter(id => nodeById(id) && nodeState(id) !== 'locked'); if (!avail.length) { b.appendChild(el('div', 'lf-intro', '先到花園裡的石碑學「譬喻」，就能開始種花囉！')); return; }
  const id = pick(avail), F = G.flowers[id], q = quizOf(id, D, Math.random() * 1e6 | 0)[0];
  b.appendChild(el('div', 'gm-want', `<span class="em">🌱</span>這顆是「${esc(nodeById(id).name)}」的種子：答對就會開出 <b>${esc(F.name)}</b>`)); b.appendChild(el('div', 'gm-note', esc(F.tip)));
  ask(b, { q: q.q, choices: q.choices, a: q.a, why: q.why || '' }, (ok, wrap) => { played('flower'); if (ok) { S.flowers.push({ slot, type: id, t: Date.now() }); save(); onPlant && onPlant(id); wrap.appendChild(el('div', 'lf-done', `<div class="em">🌸</div><h3>種出了 ${esc(F.name)}！</h3>`)); }
    else wrap.appendChild(el('p', 'gm-note', '種子沒有發芽⋯⋯看完說明再試一次吧！')); const c = btn(ok ? '回到花園' : '再試一次'); c.style.marginTop = '8px'; c.onclick = ok ? close : () => flower(slot, onPlant); wrap.appendChild(c); }); }

// ── 成語古城：讀石碑上的典故故事（可以朗讀），答對三題，城門就會打開 ──
export async function story(gate, onOpen) { style(); await loadGames(); const cfg = G.stories, m = modal({ title: `石碑：${gate.title}`, sub: '成語古城', icon: 'region-idiom-city' }), b = m.body; let k = 0, first = 0;
  b.appendChild(el('div', 'gm-story', esc(gate.story))); const rr = el('div', 'lf-btns'); rr.style.margin = '8px 0'; rr.appendChild(readBtn(gate.story, 0.8, '🔊 朗讀故事')); b.appendChild(rr); const qa = el('div'); b.appendChild(qa);
  const next = () => { if (k >= gate.questions.length) { const was = !!S.gates[gate.id]; S.gates[gate.id] = true; save(); onOpen && onOpen(); return finish(b, { title: was ? '城門本來就開著囉！' : '城門打開了！', em: '🏯', lines: [`你讀懂了「${esc(gate.title)}」的故事。`], node: was ? null : cfg.node, right: first, total: gate.questions.length }); }
    const row = gate.questions[k], q = mkQ(row); ask(qa, q, ok => { if (ok) first++; const nx = btn(k + 1 < gate.questions.length ? '下一題 →' : '🗝️ 打開城門'); nx.style.marginTop = '8px'; nx.onclick = () => { k++; qa.innerHTML = ''; next(); }; qa.appendChild(nx); }, { retry: true }); };
  next(); }

// ── 書塔山頂：鄰居的來信。讀信（可以朗讀）→ 回答問題 → 選回信的內容 → 排好書信的格式 ──
export async function letter() { style(); await loadGames(); const cfg = G.letters, L = cfg.list.find(x => !S.letters[x.id]) || pick(cfg.list), m = modal({ title: `${L.from}的來信`, sub: '書塔山頂・閱讀與寫作', icon: 'region-book-tower' }), b = m.body;
  let step = 0, first = 0; const steps = [...L.questions.map(q => ({ kind: 'q', row: q })), { kind: 'q', row: L.reply }, { kind: 'order' }];
  b.appendChild(el('div', 'gm-letter', esc(L.text))); const rr = el('div', 'lf-btns'); rr.style.margin = '8px 0'; rr.appendChild(readBtn(L.text.replace(/\n/g, '，'), 0.8, '🔊 朗讀這封信')); b.appendChild(rr); const qa = el('div'); b.appendChild(qa);
  const next = () => { qa.innerHTML = ''; if (step >= steps.length) { S.letters[L.id] = true; save(); return finish(b, { title: '回信寄出去了！', em: '💌', lines: [`${esc(L.from)}一定會很開心。`], again: letter, node: cfg.node, right: first, total: steps.length }); }
    const st = steps[step], go = () => { const nx = btn('下一步 →'); nx.style.marginTop = '8px'; nx.onclick = () => { step++; next(); }; qa.appendChild(nx); };
    if (st.kind === 'q') return ask(qa, mkQ(st.row), ok => { if (ok) first++; go(); }, { retry: true });
    // 排書信格式：照順序點
    qa.appendChild(el('div', 'lf-q', '最後，把回信的格式照順序排好（依序點）：')); const want = cfg.parts, got = el('div', 'lf-intro', '　'); qa.appendChild(got); const ch = el('div', 'lf-ch'); qa.appendChild(ch); let n = 0, miss = 0;
    shuffle(want).forEach(p => { const bt = el('button', null, esc(p)); bt.onclick = () => { if (p === want[n]) { bt.disabled = true; bt.classList.add('ok'); n++; got.textContent = want.slice(0, n).join(' → '); if (n === want.length) { if (!miss) first++; qa.appendChild(el('div', 'lf-why', '格式排好了！書信要有稱謂、問候、正文、祝福語和署名。')); go(); } } else { miss++; bt.classList.add('no'); setTimeout(() => bt.classList.remove('no'), 400); } }; ch.appendChild(bt); }); };
  next(); }
export { NODES };
