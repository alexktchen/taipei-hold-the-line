/* 學習森林（國小 1～6 年級國語）的知識圖：區域、知識點、前後關係、教學卡片與題目。
   - 注音、讀音、部首、筆畫數都來自教育部《重編國語辭典修訂本》（tools/build-data.py 抽出 data/moe.json），不是手打的；
   - 手寫題庫（標點、修辭、成語⋯⋯）直接寫在這裡；
   - 純資料與出題函式，不碰畫面，3D 與介面在 forest/map.js、forest/learn.js。 */

// ── 知識圖譜（DAG）：區域與知識點都定義在 data/graph.json，這裡只放載入後的陣列（initGraph 填進來）──
// 節點：{ id, name, grade, region, prerequisites[], questionTypes[], position:[x,z], intro?, lesson?, questions?, guardian?, pass? }
// 區域：{ id, name, grades, theme, gate:[x,z], img, requires:[區域 id]（那些區域的守護者通過才打開）}
export const REGIONS = [], NODES = [], GRAPH = { pass: { total: 6, need: 5 }, review: { days: [1, 3, 7] } };
export function initGraph(g) { REGIONS.length = NODES.length = 0; REGIONS.push(...g.regions); NODES.push(...g.nodes.map(n => ({ ...n, pre: n.prerequisites || [] }))); Object.assign(GRAPH, { pass: g.pass || GRAPH.pass, review: g.review || GRAPH.review });
  const ids = new Set(NODES.map(n => n.id)); for (const n of NODES) for (const p of n.pre) if (!ids.has(p)) console.warn('知識圖譜：', n.id, '的前置', p, '不存在');
  const seen = new Set(), stack = new Set(), visit = id => { if (stack.has(id)) throw new Error('知識圖譜有循環：' + id); if (seen.has(id)) return; stack.add(id); for (const p of nodeById(id).pre) if (ids.has(p)) visit(p); stack.delete(id); seen.add(id); }; NODES.forEach(n => visit(n.id)); return { REGIONS, NODES }; }
export const nodeById = id => NODES.find(n => n.id === id);
export const regionById = id => REGIONS.find(r => r.id === id);
export const passOf = id => nodeById(id).pass || GRAPH.pass;

// ── 注音符號：說明用的例字（念出這個字就是這個符號的音）與例詞；建置時會用教育部辭典檢查例字讀音 ──
export const SHENGMU = [
  ['ㄅ', '玻', '爸爸', '👨'], ['ㄆ', '坡', '葡萄', '🍇'], ['ㄇ', '摸', '貓', '🐱'], ['ㄈ', '佛', '飛機', '✈️'],
  ['ㄉ', '得', '大象', '🐘'], ['ㄊ', '特', '兔子', '🐰'], ['ㄋ', '訥', '牛', '🐮'], ['ㄌ', '勒', '老虎', '🐯'],
  ['ㄍ', '哥', '狗', '🐶'], ['ㄎ', '科', '恐龍', '🦖'], ['ㄏ', '喝', '花', '🌸'],
  ['ㄐ', '基', '雞', '🐔'], ['ㄑ', '欺', '汽車', '🚗'], ['ㄒ', '希', '西瓜', '🍉'],
  ['ㄓ', '知', '蜘蛛', '🕷️'], ['ㄔ', '吃', '車子', '🚙'], ['ㄕ', '詩', '獅子', '🦁'], ['ㄖ', '日', '熱', '🔥'],
  ['ㄗ', '資', '嘴巴', '👄'], ['ㄘ', '雌', '草莓', '🍓'], ['ㄙ', '思', '傘', '☂️'],
];
export const YUNMU = [
  ['ㄧ', '衣', '椅子', '🪑'], ['ㄨ', '烏', '烏龜', '🐢'], ['ㄩ', '迂', '魚', '🐟'],
  ['ㄚ', '啊', '爸爸', '👨'], ['ㄛ', '喔', '婆婆', '👵'], ['ㄜ', '鵝', '鵝', '🦢'], ['ㄝ', null, '爺爺', '👴'],
  ['ㄞ', '哀', '愛心', '❤️'], ['ㄟ', null, '杯子', '🥤'], ['ㄠ', '凹', '貓', '🐱'], ['ㄡ', '歐', '猴子', '🐒'],
  ['ㄢ', '安', '山', '⛰️'], ['ㄣ', '恩', '門', '🚪'], ['ㄤ', '骯', '糖果', '🍬'], ['ㄥ', null, '風', '🌬️'], ['ㄦ', '兒', '耳朵', '👂'],
]; // 例字是 null 的，建置時從辭典裡找一個讀音剛好只有這個符號的字
export const TONES = [
  { n: 1, name: '一聲', mark: '（不標）', ex: '媽', tip: '高高平平，像一條直直的路' },
  { n: 2, name: '二聲', mark: 'ˊ', ex: '麻', tip: '往上揚，像在問「什麼？」' },
  { n: 3, name: '三聲', mark: 'ˇ', ex: '馬', tip: '先往下再往上，像山谷' },
  { n: 4, name: '四聲', mark: 'ˋ', ex: '罵', tip: '從高往下用力念' },
  { n: 5, name: '輕聲', mark: '˙', ex: '嗎', tip: '又短又輕，符號寫在前面' },
];

// ── 字庫（建置時用辭典過濾掉多音字，只留一個讀音的字）──
export const POOL_BASIC = '人大口手日月山水火木天上下中左右花草魚鳥牛羊狗貓馬雞鴨米田土石雨雲風星爸媽哥姊弟妹家門書包筆紙桌椅吃喝看聽走跑跳飛哭笑紅黃藍白黑早晚春夏秋冬東西南北多少高矮';
export const STROKE_CHARS = '一二三十人大口日月木水火山田小中上下手女子王目耳米竹'; // 筆順示範字
export const DUTI = '日月山水火木人口大小手目女子牛羊馬魚鳥田王心力刀禾竹米石耳';
export const HETI = [['明', '日＋月'], ['好', '女＋子'], ['林', '木＋木'], ['休', '人＋木'], ['男', '田＋力'], ['尖', '小＋大'], ['鳴', '口＋鳥'], ['炎', '火＋火'], ['岩', '山＋石'], ['森', '木＋木＋木'], ['品', '口＋口＋口'], ['間', '門＋日']];
export const WORDS = [
  ['蘋果', '🍎'], ['香蕉', '🍌'], ['西瓜', '🍉'], ['太陽', '☀️'], ['月亮', '🌙'], ['星星', '⭐'], ['下雨', '🌧️'], ['彩虹', '🌈'],
  ['老師', '🧑‍🏫'], ['學校', '🏫'], ['書包', '🎒'], ['鉛筆', '✏️'], ['猴子', '🐒'], ['兔子', '🐰'], ['老虎', '🐯'], ['大象', '🐘'],
  ['花朵', '🌸'], ['樹木', '🌳'], ['汽車', '🚗'], ['飛機', '✈️'], ['雨傘', '☂️'], ['眼睛', '👀'], ['耳朵', '👂'], ['生日', '🎂'],
];
export const POOL_RADICAL = '媽姐妹好河湖海洗打拍推拉想快情忙你他們住花草茶菜送這道說話語錢鐵狗貓猴跑跳路眼睛吃唱叫樹林校晴明時燈熱雲雪電';
export const RADICAL_LABEL = { 水: '水（氵）', 手: '手（扌）', 心: '心（忄）', 人: '人（亻）', 艸: '艸（艹）', 辵: '辵（辶）', 犬: '犬（犭）', 火: '火（灬）', 足: '足（⻊）', 言: '言', 金: '金', 豸: '豸' };
export const POOL_HOMO = '青清輕晴情請睛同童銅工公功弓宮今金斤巾京經精晶紅洪虹花華化畫話汽氣器期旗奇騎棋知之汁枝支';
export const DUOYIN = [['長', '長短'], ['長', '長大'], ['行', '行走'], ['行', '銀行'], ['重', '重要'], ['重', '重新'], ['樂', '快樂'], ['樂', '音樂'], ['好', '好人'], ['好', '好奇'],
  ['還', '還有'], ['還', '還錢'], ['覺', '覺得'], ['覺', '睡覺'], ['種', '種子'], ['種', '種花'], ['為', '認為'], ['為', '為什麼'], ['背', '背包'], ['背', '背書'], ['教', '教書'], ['教', '教室']];
export const PICS = [['日', '☀️'], ['月', '🌙'], ['山', '⛰️'], ['水', '💧'], ['火', '🔥'], ['木', '🌳'], ['魚', '🐟'], ['鳥', '🐦'], ['牛', '🐮'], ['羊', '🐑'], ['馬', '🐴'], ['雨', '🌧️'], ['口', '👄'], ['手', '✋'], ['目', '👁️'], ['耳', '👂'], ['花', '🌸'], ['米', '🍚'], ['田', '🌾'], ['門', '🚪'], ['雲', '☁️'], ['星', '⭐'], ['石', '🪨'], ['竹', '🎋']]; // 認字：看圖認字

// ── 工具 ──
export function rng(seed = Date.now()) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, r) => a[Math.floor(r() * a.length)];
const chars = s => [...s];
// 四選一：wrongs 裡前 prio 個一定會出現（例如多音字的另一個真正讀音），其餘隨機補滿
const mk = (q, correct, wrongs, r, extra = {}, prio = 0) => { const ws = [...new Set(wrongs)].filter(w => w !== correct), keep = ws.slice(0, prio), rest = shuffle(ws.slice(prio), r); const ch = shuffle([correct, ...keep, ...rest].slice(0, 4), r); return { q, choices: ch, a: ch.indexOf(correct), ...extra }; };
export const toneOf = b => b.startsWith('˙') ? 5 : b.endsWith('ˊ') ? 2 : b.endsWith('ˇ') ? 3 : b.endsWith('ˋ') ? 4 : 1;
export const stripTone = b => b.replace(/[ˊˇˋ˙]/g, '');
const withTone = (base, n) => n === 1 ? base : n === 5 ? '˙' + base : base + ['', '', 'ˊ', 'ˇ', 'ˋ'][n];
const INITIALS = SHENGMU.map(x => x[0]);

// ── 教學卡片（給 learn.js 畫）：依節點的 lesson.type；沒有 lesson 就拿題庫的前三題當例子 ──
export function lessonOf(id, D) {
  const n = nodeById(id), intro = n.intro || '', L = n.lesson || {};
  if (n.guardian) return { intro, cards: NODES.filter(x => x.region === n.region && !x.guardian).map(x => ({ kind: 'text', q: `知識點：${x.name}`, a: `${x.grade} 年級`, why: (x.intro || '').slice(0, 42) + '…' })) };
  if (L.type === 'zhuyin') return { intro, cards: (L.set === 'yunmu' ? YUNMU : SHENGMU).map(([s, c, w, e]) => ({ kind: 'zhuyin', sym: s, say: D.sym[s] || c, word: w, emoji: e, wordB: D.w(w) })) };
  if (L.type === 'tones') return { intro, cards: TONES.map(t => ({ kind: 'tone', ...t, b: D.ch(t.ex).b[0] })) };
  if (L.type === 'pics') return { intro, cards: PICS.map(([c, e]) => ({ kind: 'char', c, b: D.ch(c).b[0], tag: e })) };
  if (L.type === 'chars') return { intro, cards: chars(L.chars || '').map(c => { const e = D.ch(c); return { kind: 'char', c, b: e.b[0], strokes: L.show === 'strokes' ? e.s : 0, tag: L.show === 'radical' ? `${RADICAL_LABEL[e.r] || e.r}部・去部首 ${e.n} 畫` : '' }; }) };
  if (L.type === 'duti') return { intro, cards: [...chars(DUTI).slice(0, 12).map(c => ({ kind: 'char', c, b: D.ch(c).b[0], tag: '獨體字' })), ...HETI.slice(0, 6).map(([c, p]) => ({ kind: 'char', c, b: D.ch(c).b[0], tag: p }))] };
  if (L.type === 'words' && L.set === 'duoyin') return { intro, cards: DUOYIN.slice(0, 10).map(([c, w]) => ({ kind: 'word', w, b: D.w(w), tag: `「${c}」念 ${D.syl(w, c)}` })) };
  if (L.type === 'words') return { intro, cards: WORDS.map(([w, e]) => ({ kind: 'word', w, emoji: e, b: D.w(w) })) };
  return { intro, cards: (n.questions || []).slice(0, 3).map(row => ({ kind: 'text', q: row[0], a: row[1], why: row[row.length - 1] })) };
}

// ── 題型：節點的 questionTypes 從這裡挑（每一題隨機挑一種）；bank＝節點自己的 questions、mix＝守護者綜合題 ──
export const QUESTION_TYPES = {
  'listen-shengmu': (r, n, D) => { const [s, c] = pick(SHENGMU, r); return mk('聽聽看，這是哪一個聲母？', s, INITIALS, r, { say: D.sym[s] || c, listen: true }); },
  'word-shengmu': (r, n, D) => { const [s, , w, e] = pick(SHENGMU, r); return mk(`「${w}」${e} 開頭的聲音是？`, s, INITIALS, r, { big: w, bigB: D.w(w) }); },
  'listen-yunmu': (r, n, D) => { const all = YUNMU.map(x => x[0]), [s, c] = pick(YUNMU, r); return mk('聽聽看，這是哪一個韻母？', s, all, r, { say: D.sym[s] || c, listen: true }); },
  'word-yunmu': (r, n, D) => { const all = YUNMU.map(x => x[0]), [s, , w, e] = pick(YUNMU, r); return mk(`「${w}」${e} 的注音裡有哪一個韻母？`, s, all.filter(x => !stripTone(D.w(w)).includes(x)), r, { big: w, bigB: D.w(w) }); },
  tone: (r, n, D) => { const c = pick(chars(POOL_BASIC).filter(D.one), r), b = D.ch(c).b[0], t = toneOf(b); return mk(r() < 0.5 ? '聽聽看，這個字是第幾聲？' : `「${c}」（${stripTone(b)}）是第幾聲？`, TONES[t - 1].name, TONES.map(x => x.name), r, { say: c, listen: true, big: c }); },
  'zhuyin-to-char': (r, n, D) => { const pool = chars(POOL_BASIC).filter(D.one), c = pick(pool, r), b = D.ch(c).b[0]; return mk(`哪一個字念「${b}」？`, c, shuffle(pool.filter(x => x !== c && D.ch(x).b[0] !== b), r).slice(0, 8), r, { say: c }); },
  'char-to-zhuyin': (r, n, D) => { const c = pick(chars(POOL_BASIC).filter(D.one), r), b = D.ch(c).b[0], base = stripTone(b), t = toneOf(b); return mk(`「${c}」的注音是？`, b, [1, 2, 3, 4].filter(k => k !== t).map(k => withTone(base, k)), r, { big: c, say: c }); },
  'pic-char': (r, n, D) => { const [c, e] = pick(PICS, r); return mk(`${e} 是哪一個字？`, c, PICS.map(x => x[0]), r, { big: e, say: c }); },
  'char-to-pic': (r, n, D) => { const [c, e] = pick(PICS, r); return mk(`「${c}」（${D.ch(c).b[0]}）是哪一個圖？`, e, PICS.map(x => x[1]), r, { big: c, say: c }); },
  'stroke-count': (r, n, D) => { const c = pick(chars(STROKE_CHARS + DUTI), r), s = D.ch(c).s; return mk(`「${c}」一共有幾畫？`, s + ' 畫', [s - 1, s + 1, s + 2, s - 2].filter(x => x > 0).map(x => x + ' 畫'), r, { big: c, stroke: c }); },
  'duti-pick': (r) => mk('哪一個是獨體字？', pick(chars(DUTI), r), HETI.map(h => h[0]), r),
  'heti-split': (r) => { const [c, p] = pick(HETI, r); return mk(`「${c}」可以拆成哪幾個字？`, p, HETI.map(h => h[1]), r, { big: c }); },
  'word-emoji': (r) => { const [w, e] = pick(WORDS, r); return mk(`${e} 是哪一個詞？`, w, WORDS.map(x => x[0]), r, { big: e }); },
  'word-zhuyin': (r, n, D) => { const [w] = pick(WORDS, r); return mk(`注音「${D.w(w)}」是哪一個詞？`, w, WORDS.map(x => x[0]), r, { say: w }); },
  radical: (r, n, D) => { const c = pick(chars(POOL_RADICAL), r), rad = D.ch(c).r, lab = x => RADICAL_LABEL[x] || x, rads = [...new Set(chars(POOL_RADICAL).map(x => D.ch(x).r))]; return mk(`「${c}」的部首是？`, lab(rad), rads.filter(x => x !== rad).map(lab), r, { big: c }); },
  dictionary: (r, n, D) => { const c = pick(chars(POOL_RADICAL), r), e = D.ch(c), lab = x => (RADICAL_LABEL[x] || x) + '部', rads = [...new Set(chars(POOL_RADICAL).map(x => D.ch(x).r))].filter(x => x !== e.r);
    return mk(`用部首查字典，「${c}」要怎麼查？`, `${lab(e.r)}，再查 ${e.n} 畫`, [`${lab(e.r)}，再查 ${e.n + 1} 畫`, `${lab(e.r)}，再查 ${Math.max(1, e.n - 1)} 畫`, `${lab(pick(rads, r))}，再查 ${e.n} 畫`, `${lab(e.r)}，再查 ${e.s} 畫`], r, { big: c, why: `「${c}」是${lab(e.r)}，去掉部首還有 ${e.n} 畫（總共 ${e.s} 畫）。` }); },
  homophone: (r, n, D) => { const g = pick(D.homo.filter(g => g.length >= 2), r), [a, b] = shuffle(g, r); return mk(`哪一個字的讀音和「${a}」（${D.ch(a).b[0]}）完全一樣？`, b, shuffle(D.homoPool.filter(x => D.ch(x).b[0] !== D.ch(a).b[0]), r).slice(0, 6), r, { big: a, why: `「${a}」和「${b}」都念 ${D.ch(a).b[0]}。` }); },
  polyphone: (r, n, D) => { const [c, w] = pick(DUOYIN, r), s = D.syl(w, c), real = [...new Set([...DUOYIN.filter(x => x[0] === c).map(x => D.syl(x[1], c)), ...D.ch(c).b])].filter(x => x !== s), base = stripTone(s);
    return mk(`「${w}」的「${c}」怎麼念？`, s, real.concat([1, 2, 3, 4].map(k => withTone(base, k)).filter(x => x !== s)), r, { big: w, say: w, why: `「${w}」念 ${D.w(w)}。` }, Math.min(2, real.length)); },
  bank: (r, n) => { if (!n.questions || !n.questions.length) return null; const [q, a, ...rest] = pick(n.questions, r), why = rest.pop(); return mk(q, a, rest, r, { why }); },
};
export function quizOf(id, D, seed) {
  const n = nodeById(id), r = rng(seed), N = passOf(id).total, out = [];
  if (n.guardian || (n.questionTypes || []).includes('mix')) { const ns = NODES.filter(x => x.region === n.region && !x.guardian); return shuffle(ns.flatMap((x, k) => quizOf(x.id, D, seed + k * 101).slice(0, 3)), r).slice(0, N); }
  const types = (n.questionTypes || ['bank']).filter(t => QUESTION_TYPES[t]); if (!types.length) return out;
  const seen = new Set();
  for (let k = 0; out.length < N && k < 300; k++) { const item = QUESTION_TYPES[pick(types, r)](r, n, D); if (!item) continue; const key = item.q + item.choices[item.a]; if (seen.has(key) && k < 200) continue; seen.add(key); out.push(item); }
  return out;
}

// ── 建置時需要從辭典抽出的字與詞（tools/build-data.py 讀這個）──
export const NEED = (() => {
  const words = new Set([...SHENGMU, ...YUNMU].map(x => x[2]).concat(WORDS.map(x => x[0]), DUOYIN.map(x => x[1])));
  const cs = new Set(chars(PICS.map(x => x[0]).join('') + POOL_BASIC + STROKE_CHARS + DUTI + POOL_RADICAL + POOL_HOMO + '爸媽魚鳥花草山水媽麻馬罵嗎' + HETI.map(h => h[0]).join('') + DUOYIN.map(x => x[0]).join('') + [...SHENGMU, ...YUNMU].map(x => x[1] || '').join('')));
  for (const w of words) for (const c of w) cs.add(c);
  return { chars: [...cs].join(''), words: [...words], symbols: [...SHENGMU, ...YUNMU].map(x => x[0]), strokes: [...new Set(chars(PICS.map(x => x[0]).join('') + STROKE_CHARS + DUTI + POOL_BASIC + '爸媽魚鳥花草山水' + HETI.map(h => h[0]).join('') + '媽河打想你花送說'))].join('') };
})();
// 圖譜裡 lesson.chars 用到的字也要有讀音與筆順（新增知識點只改 JSON，重跑 build-data.py 就會補上）
export function needFor(g) { const extra = [...new Set(g.nodes.flatMap(n => [...((n.lesson && n.lesson.chars) || '')]))].join(''); return { ...NEED, chars: [...new Set(NEED.chars + extra)].join(''), strokes: [...new Set(NEED.strokes + extra)].join('') }; }
