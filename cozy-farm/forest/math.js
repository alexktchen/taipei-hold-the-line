/* 數學森林（國小 1～6 年級數學，依 108 課綱「數與量、空間與形狀、關係」的順序）：出題函式與教學卡片。
   - 每個知識點的題目都是程式隨機產生（數字每次都不一樣、答案由程式算出來），錯誤選項是常見的算錯方式；
   - 圖（點點、十格框、積木、時鐘、錢幣、分數條、圖形、角度、立體）都用 SVG 畫，不用圖片也不用 emoji；
   - 純資料與出題函式，不碰 3D；learn.js 把題目和卡片畫出來，content.js 把出題函式登記進 QUESTION_TYPES。 */
const P = '#F28CA0', Y = '#F5B731', G = '#8CC77E', W = '#A0703F', B = '#7CC3E3', V = '#9C8BE0', INK = '#4a3b52', SOFT = '#efe9f2';
const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, r) => a[Math.floor(r() * a.length)];
const R = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a), lcm = (a, b) => a / gcd(a, b) * b;
// 題目：q 題目、正確答案、錯誤選項（會去掉重複與等於答案的）、svg 圖、why 解說、say 讀題（數學符號念成中文）
const mk = (q, correct, wrongs, r, extra = {}) => { correct = String(correct); const ws = shuffle([...new Set(wrongs.map(String))].filter(w => w !== correct), r); const ch = shuffle([correct, ...ws].slice(0, 4), r); return { q, choices: ch, a: ch.indexOf(correct), math: true, ...extra }; };
// 數字的錯誤選項：差 1、差 2、差 10（不會出現負數或重複）
const near = (n, r, min = 0, steps = [1, -1, 2, -2, 10, -10]) => shuffle(steps, r).map(s => n + s).filter(x => x >= min && x !== n);
export const frac = (n, d) => { const g = gcd(n, d); n /= g; d /= g; return d === 1 ? String(n) : `${n}/${d}`; };
const rawFrac = (n, d) => `${n}/${d}`;
const dec = cents => { const s = (cents / 100).toFixed(2); return s.replace(/\.?0+$/, ''); }; // 用「分」算，避免小數誤差
const ZH = '零一二三四五六七八九';
function zhSec(n, lead) { if (!n) return ''; const u = ['', '十', '百', '千'], ds = String(n).padStart(4, '0').split('').map(Number); let s = '', zero = false, started = false;
  ds.forEach((d, i) => { const p = 3 - i; if (!d) { if (started) zero = true; return; } if (zero) s += '零'; zero = false; s += (p === 1 && d === 1 && !started && lead ? '' : ZH[d]) + u[p]; started = true; }); return s; }
export function zhNum(n) { if (n === 0) return '零'; const hi = Math.floor(n / 10000), lo = n % 10000; if (!hi) return zhSec(lo, true);
  return zhSec(hi, true) + '萬' + (lo ? (lo < 1000 ? '零' : '') + zhSec(lo, false) : ''); }
// 讀題：把符號念成中文（3/5 念「五分之三」、× 念「乘以」）
export const speakText = s => s.replace(/(\d+)\/(\d+)/g, (m, a, b) => `${zhNum(+b)}分之${zhNum(+a)}`).replace(/×/g, '乘以').replace(/÷/g, '除以').replace(/＋|\+/g, '加').replace(/－|−/g, '減').replace(/＝|=/g, '等於').replace(/？|\?/g, '多少').replace(/○/g, '圈圈').replace(/%/g, '趴').replace(/[（）()]/g, '，');

// ── SVG 小圖 ──
const svg = (w, h, body, label = '') => `<svg class="mx" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}" style="max-width:100%;height:auto">${body}</svg>`;
const T = (x, y, s, size = 16, col = INK, anchor = 'middle') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="800" fill="${col}" text-anchor="${anchor}" dominant-baseline="middle" font-family="Noto Sans TC,PingFang TC,sans-serif">${s}</text>`;
// 點點（每排 5 個，像十格框）
export function dots(n, col = P, n2 = 0, col2 = B, cross = 0) { const per = 5, rows = Math.ceil((n + n2) / per) || 1, w = per * 30 + 10, h = rows * 30 + 10; let b = '';
  for (let i = 0; i < n + n2; i++) { const x = 20 + (i % per) * 30, y = 20 + Math.floor(i / per) * 30; b += `<circle cx="${x}" cy="${y}" r="11" fill="${i < n ? col : col2}"/>`; if (i >= n + n2 - cross) b += `<path d="M${x - 10} ${y - 10}L${x + 10} ${y + 10}M${x + 10} ${y - 10}L${x - 10} ${y + 10}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`; }
  return svg(w, h, b, `${n + n2} 個點`); }
// 積木：百（大方塊）、十（長條）、一（小方塊）
export function blocks(h, t, o) { let b = '', x = 8; const u = 9;
  for (let i = 0; i < h; i++) { b += `<rect x="${x}" y="8" width="${u * 10}" height="${u * 10}" rx="3" fill="${V}"/>`; for (let k = 1; k < 10; k++) b += `<path d="M${x + k * u} 8v${u * 10}M${x} ${8 + k * u}h${u * 10}" stroke="#fff" stroke-opacity=".5"/>`; x += u * 10 + 8; }
  for (let i = 0; i < t; i++) { b += `<rect x="${x}" y="8" width="${u}" height="${u * 10}" rx="2" fill="${B}"/>`; for (let k = 1; k < 10; k++) b += `<path d="M${x} ${8 + k * u}h${u}" stroke="#fff" stroke-opacity=".6"/>`; x += u + 5; }
  x += 4; for (let i = 0; i < o; i++) { b += `<rect x="${x + (i % 2) * (u + 3)}" y="${8 + Math.floor(i / 2) * (u + 3)}" width="${u}" height="${u}" rx="2" fill="${Y}"/>`; } if (o) x += 2 * (u + 3);
  return svg(Math.max(60, x + 8), u * 10 + 16, b, `${h} 個百、${t} 個十、${o} 個一`); }
// 排成幾排的點（乘法）
export function grid(rows, cols, col = G) { let b = ''; for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) b += `<circle cx="${18 + j * 26}" cy="${18 + i * 26}" r="9" fill="${col}"/>`; return svg(cols * 26 + 10, rows * 26 + 10, b, `${rows} 排，每排 ${cols} 個`); }
// 平分：幾個圈圈，每圈幾個
export function groups(g, each, rest = 0) { const cw = Math.max(2, Math.min(each, 4)) * 18 + 16, rowsIn = Math.ceil(each / 4); let b = '';
  for (let i = 0; i < g; i++) { const x0 = 6 + i * (cw + 8); b += `<rect x="${x0}" y="6" width="${cw}" height="${rowsIn * 18 + 16}" rx="14" fill="none" stroke="${V}" stroke-width="3"/>`; for (let k = 0; k < each; k++) b += `<circle cx="${x0 + 16 + (k % 4) * 18}" cy="${22 + Math.floor(k / 4) * 18}" r="7" fill="${Y}"/>`; }
  for (let k = 0; k < rest; k++) b += `<circle cx="${6 + g * (cw + 8) + 12 + (k % 2) * 18}" cy="${22 + Math.floor(k / 2) * 18}" r="7" fill="${P}"/>`;
  return svg(6 + g * (cw + 8) + (rest ? 50 : 0), rowsIn * 18 + 28 + Math.max(0, Math.ceil(rest / 2) - rowsIn) * 18, b, `${g} 份，每份 ${each} 個${rest ? `，剩 ${rest} 個` : ''}`); }
// 時鐘
export function clock(h, m) { let b = `<circle cx="80" cy="80" r="72" fill="#fff" stroke="${W}" stroke-width="6"/>`;
  for (let k = 1; k <= 12; k++) { const a = k / 12 * Math.PI * 2; b += T(80 + Math.sin(a) * 56, 80 - Math.cos(a) * 56, k, 15); }
  for (let k = 0; k < 60; k++) { const a = k / 60 * Math.PI * 2, r1 = k % 5 ? 66 : 63; b += `<path d="M${80 + Math.sin(a) * r1} ${80 - Math.cos(a) * r1}L${80 + Math.sin(a) * 69} ${80 - Math.cos(a) * 69}" stroke="${INK}" stroke-opacity=".4" stroke-width="${k % 5 ? 1 : 2}"/>`; }
  const ah = ((h % 12) + m / 60) / 12 * Math.PI * 2, am = m / 60 * Math.PI * 2;
  b += `<path d="M80 80L${80 + Math.sin(ah) * 34} ${80 - Math.cos(ah) * 34}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M80 80L${80 + Math.sin(am) * 52} ${80 - Math.cos(am) * 52}" stroke="${P}" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="80" r="5" fill="${INK}"/>`;
  return svg(160, 160, b, '時鐘'); }
// 錢幣
export function coins(list) { const C = { 1: ['#d9cfc0', 15], 5: ['#d9cfc0', 18], 10: [Y, 20], 50: [Y, 24], 100: [G, 30] }; let x = 6, b = '';
  for (const v of list) { const [col, r] = C[v]; if (v === 100) { b += `<rect x="${x}" y="10" width="64" height="36" rx="5" fill="${col}"/>` + T(x + 32, 29, '100元', 13, '#fff'); x += 72; continue; } b += `<circle cx="${x + r}" cy="28" r="${r}" fill="${col}" stroke="${W}" stroke-opacity=".5" stroke-width="2"/>` + T(x + r, 29, v, r > 18 ? 16 : 13); x += r * 2 + 6; }
  return svg(x + 4, 56, b, '錢幣'); }
// 分數條（d 等分、塗 n 份）
export function fbar(n, d, col = P, w = 240) { let b = ''; const cw = w / d; for (let i = 0; i < d; i++) b += `<rect x="${6 + i * cw}" y="6" width="${cw}" height="40" fill="${i < n ? col : '#fff'}" stroke="${INK}" stroke-width="2"/>`; return svg(w + 12, 52, b, `${d} 等分塗了 ${n} 份`); }
export function pie(n, d, col = Y) { let b = `<circle cx="60" cy="60" r="52" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  for (let i = 0; i < d; i++) { const a0 = i / d * Math.PI * 2 - Math.PI / 2, a1 = (i + 1) / d * Math.PI * 2 - Math.PI / 2; if (i < n) b += `<path d="M60 60L${60 + Math.cos(a0) * 52} ${60 + Math.sin(a0) * 52}A52 52 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${60 + Math.cos(a1) * 52} ${60 + Math.sin(a1) * 52}Z" fill="${col}"/>`; b += `<path d="M60 60L${60 + Math.cos(a0) * 52} ${60 + Math.sin(a0) * 52}" stroke="${INK}" stroke-width="2"/>`; }
  return svg(120, 120, b + `<circle cx="60" cy="60" r="52" fill="none" stroke="${INK}" stroke-width="2"/>`, `圓分成 ${d} 份塗了 ${n} 份`); }
// 百格板（小數二位、百分率）
export function grid100(n, col = B) { let b = ''; for (let i = 0; i < 100; i++) b += `<rect x="${6 + (i % 10) * 14}" y="${6 + Math.floor(i / 10) * 14}" width="13" height="13" fill="${i < n ? col : '#fff'}" stroke="${INK}" stroke-opacity=".35"/>`; return svg(152, 152, b, `100 格塗了 ${n} 格`); }
// 圖形
const POLY = { 三角形: 3, 正方形: 4, 長方形: 4, 五邊形: 5, 六邊形: 6, 圓形: 0 };
export function shape(name, col = G) { let b; if (name === '圓形') b = `<circle cx="70" cy="60" r="48" fill="${col}" stroke="${INK}" stroke-width="3"/>`;
  else if (name === '正方形') b = `<rect x="25" y="15" width="90" height="90" fill="${col}" stroke="${INK}" stroke-width="3"/>`;
  else if (name === '長方形') b = `<rect x="10" y="30" width="120" height="62" fill="${col}" stroke="${INK}" stroke-width="3"/>`;
  else { const n = POLY[name], pts = Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + k / n * Math.PI * 2; return `${70 + Math.cos(a) * 52},${64 + Math.sin(a) * 52}`; }).join(' '); b = `<polygon points="${pts}" fill="${col}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`; }
  return svg(140, 120, b, name); }
// 長方形／正方形（標邊長）
export function rectFig(w, h, unit = '公分', col = B) { const s = Math.min(30, 200 / Math.max(w, h)), W2 = w * s, H2 = h * s; return svg(W2 + 90, H2 + 60, `<rect x="45" y="12" width="${W2}" height="${H2}" fill="${col}" fill-opacity=".55" stroke="${INK}" stroke-width="3"/>` + T(45 + W2 / 2, H2 + 34, `${w} ${unit}`, 15) + T(40, 12 + H2 / 2, `${h} ${unit}`, 15, INK, 'end'), `長 ${w}、寬 ${h}`); }
export function triFig(bs, hs, kind = 'tri') { const s = Math.min(30, 200 / Math.max(bs, hs)), w = bs * s, h = hs * s, x0 = 30, y0 = h + 16, sk = kind === 'para' ? w * 0.3 : 0;
  const poly = kind === 'para' ? `${x0},${y0} ${x0 + w},${y0} ${x0 + w + sk},${y0 - h} ${x0 + sk},${y0 - h}` : `${x0},${y0} ${x0 + w},${y0} ${x0 + w * 0.35},${y0 - h}`, hx = kind === 'para' ? x0 + sk : x0 + w * 0.35;
  return svg(w + sk + 70, h + 50, `<polygon points="${poly}" fill="${Y}" fill-opacity=".6" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M${hx} ${y0 - h}V${y0}" stroke="${P}" stroke-width="2.5" stroke-dasharray="5 4"/>` + T(x0 + w / 2, y0 + 18, `底 ${bs} 公分`, 14) + T(hx + 6, y0 - h / 2, `高 ${hs}`, 14, P, 'start'), kind === 'para' ? '平行四邊形' : '三角形'); }
export function angleFig(deg) { const a = deg * Math.PI / 180, x0 = 30, y0 = 110, L = 110; let b = `<path d="M${x0} ${y0}H${x0 + L}M${x0} ${y0}L${x0 + Math.cos(a) * L} ${y0 - Math.sin(a) * L}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
  b += deg === 90 ? `<path d="M${x0 + 18} ${y0}V${y0 - 18}H${x0}" fill="none" stroke="${P}" stroke-width="3"/>` : `<path d="M${x0 + 26} ${y0}A26 26 0 0 0 ${x0 + Math.cos(a) * 26} ${y0 - Math.sin(a) * 26}" fill="none" stroke="${P}" stroke-width="3"/>`;
  return svg(deg > 90 ? 180 : 160, 124, b, '角'); }
// 長方體（斜斜畫，標長寬高）
export function boxFig(l, w, h) { const s = 22, X = l * s, Y2 = h * s, D = w * s * 0.5, x0 = 20, y0 = D + 12;
  const b = `<polygon points="${x0},${y0} ${x0 + X},${y0} ${x0 + X},${y0 + Y2} ${x0},${y0 + Y2}" fill="${B}" fill-opacity=".6" stroke="${INK}" stroke-width="2.5"/><polygon points="${x0},${y0} ${x0 + D},${y0 - D} ${x0 + X + D},${y0 - D} ${x0 + X},${y0}" fill="${B}" fill-opacity=".35" stroke="${INK}" stroke-width="2.5"/><polygon points="${x0 + X},${y0} ${x0 + X + D},${y0 - D} ${x0 + X + D},${y0 + Y2 - D} ${x0 + X},${y0 + Y2}" fill="${B}" fill-opacity=".85" stroke="${INK}" stroke-width="2.5"/>`;
  return svg(X + D + 100, Y2 + D + 46, b + T(x0 + X / 2, y0 + Y2 + 18, `長 ${l}`, 14) + T(x0 + X + D + 6, y0 + Y2 / 2 - D / 2, `高 ${h}`, 14, INK, 'start') + T(x0 + X + D / 2 + 6, y0 - D / 2 - 8, `寬 ${w}`, 14, INK, 'start'), `長 ${l} 寬 ${w} 高 ${h} 的長方體`); }
// 直式（加減乘）
export function column(a, op, b2) { const w = Math.max(String(a).length, String(b2).length) + 1, fs = 26, cw = 18, W2 = w * cw + 30; const rt = (s, y) => [...String(s)].reverse().map((c, i) => T(W2 - 14 - i * cw, y, c, fs)).join('');
  return svg(W2, 100, rt(a, 22) + T(14, 56, op, fs) + rt(b2, 56) + `<path d="M8 78H${W2 - 4}" stroke="${INK}" stroke-width="3"/>`, `${a} ${op} ${b2}`); }

// ── 出題：每個知識點一個（key 對應 graph.json 的 questionTypes）──
const shapesNames = Object.keys(POLY);
const people = ['小明', '小美', '阿跳', '小禾', '書書', '阿壯', '咪嚕'], things = [['糖果', '顆'], ['貼紙', '張'], ['鉛筆', '枝'], ['彈珠', '顆'], ['蘋果', '顆'], ['卡片', '張']];
export const MATH_TYPES = {
  // 數數小村（1 年級）
  'm-count10': r => { const n = R(r, 1, 10), c = pick([P, B, G, V], r); return mk('數一數，一共有幾個？', n, near(n, r, 1, [1, -1, 2, -2, 3]), r, { svg: dots(n, c), why: `一個一個點著數：1、2、3⋯⋯數到 ${n}。` }); },
  'm-compare': r => { if (r() < 0.6) { const a = R(r, 1, 99), b = r() < 0.15 ? a : R(r, 1, 99), s = a > b ? '>' : a < b ? '<' : '='; return mk(`${a} ○ ${b}，○ 裡要填什麼？`, s, ['>', '<', '='], r, { big: `${a} ○ ${b}`, why: s === '=' ? '兩個數一樣大，用「＝」。' : `${Math.max(a, b)} 比較大；開口朝向大的數，所以是 ${a} ${s} ${b}。` }); }
    const ns = shuffle([...new Set(Array.from({ length: 8 }, () => R(r, 10, 99)))], r).slice(0, 4), big = r() < 0.5, ans = big ? Math.max(...ns) : Math.min(...ns); return mk(`哪一個數最${big ? '大' : '小'}？`, ans, ns, r, { why: `先比十位，十位一樣再比個位：${ans} 最${big ? '大' : '小'}。` }); },
  'm-place': r => { const n = R(r, 11, 99), t = Math.floor(n / 10), o = n % 10; if (r() < 0.5) return mk('積木代表多少？（長條是 10，小方塊是 1）', n, [o * 10 + t, n + 10, n - 1, n + 1, t + o].filter(x => x > 0), r, { svg: blocks(0, t, o), why: `${t} 條十是 ${t * 10}，再加 ${o} 個一，是 ${n}。` });
    return mk(`${n} 是幾個十和幾個一？`, `${t} 個十和 ${o} 個一`, [`${o} 個十和 ${t} 個一`, `${t + 1} 個十和 ${o} 個一`, `${t} 個十和 ${o + 1} 個一`, `${Math.max(1, t - 1)} 個十和 ${o + 10} 個一`], r, { why: `${n} 的十位是 ${t}、個位是 ${o}。` }); },
  'm-add10': r => { const a = R(r, 1, 9), b = R(r, 1, 10 - a), s = a + b; return mk(`${a} ＋ ${b} ＝ ？`, s, near(s, r, 0, [1, -1, 2, -2]), r, { svg: dots(a, P, b, B), big: `${a} ＋ ${b}`, why: `${a} 個粉紅點加 ${b} 個藍點，一共 ${s} 個。` }); },
  'm-sub10': r => { const a = R(r, 2, 10), b = R(r, 1, a), d = a - b; return mk(`${a} － ${b} ＝ ？`, d, near(d, r, 0, [1, -1, 2, -2]).concat([a + b]), r, { svg: dots(a - b, G, b, G, b), big: `${a} － ${b}`, why: `${a} 個拿走 ${b} 個（打叉的），還剩 ${d} 個。` }); },
  'm-add20': r => { if (r() < 0.5) { const a = R(r, 5, 9), b = R(r, 11 - a, 9), s = a + b, need = 10 - a; return mk(`${a} ＋ ${b} ＝ ？`, s, near(s, r, 0, [1, -1, 10, -10, 2]), r, { big: `${a} ＋ ${b}`, svg: dots(a, P, b, B), why: `湊十：${a} 再 ${need} 就是 10，${b} 拆成 ${need} 和 ${b - need}，10 ＋ ${b - need} ＝ ${s}。` }); }
    const a = R(r, 11, 18), b = R(r, a - 9, 9), d = a - b; return mk(`${a} － ${b} ＝ ？`, d, near(d, r, 0, [1, -1, 10, 2, -2]), r, { big: `${a} － ${b}`, why: `退位：先算 10 － ${b} ＝ ${10 - b}，再加個位的 ${a - 10}，${10 - b} ＋ ${a - 10} ＝ ${d}。` }); },
  // 加減林（2 年級）
  'm-add2': r => { let a, b; do { a = R(r, 15, 79); b = R(r, 11, 99 - a); } while ((a % 10) + (b % 10) < 10 && r() < 0.7); const s = a + b, carry = (a % 10) + (b % 10) >= 10; return mk(`${a} ＋ ${b} ＝ ？`, s, [s - 10, s + 10, s + 1, s - 1, carry ? s - 10 : s + 2], r, { svg: column(a, '+', b), why: `個位 ${a % 10}＋${b % 10}＝${(a % 10) + (b % 10)}${carry ? '，滿十進位到十位' : ''}；十位 ${Math.floor(a / 10)}＋${Math.floor(b / 10)}${carry ? '＋1' : ''}，答案 ${s}。` }); },
  'm-sub2': r => { let a, b; do { a = R(r, 30, 99); b = R(r, 11, a - 5); } while ((a % 10) >= (b % 10) && r() < 0.7); const d = a - b, borrow = (a % 10) < (b % 10); return mk(`${a} － ${b} ＝ ？`, d, [d + 10, d - 10, d + 1, d - 1, Math.abs((a % 10) - (b % 10)) + (Math.floor(a / 10) - Math.floor(b / 10)) * 10].filter(x => x >= 0), r, { svg: column(a, '−', b), why: borrow ? `個位 ${a % 10} 不夠減 ${b % 10}，跟十位借 1 個十：${(a % 10) + 10}－${b % 10}＝${(a % 10) + 10 - (b % 10)}；十位 ${Math.floor(a / 10) - 1}－${Math.floor(b / 10)}，答案 ${d}。` : `個位、十位分別相減，答案 ${d}。` }); },
  'm-add3': r => { if (r() < 0.5) { const a = R(r, 120, 599), b = R(r, 105, 999 - a), s = a + b; return mk(`${a} ＋ ${b} ＝ ？`, s, [s + 10, s - 10, s + 100, s - 100, s + 1], r, { svg: column(a, '+', b), why: `從個位算起，滿十就往前一位進 1，答案 ${s}。` }); }
    const a = R(r, 300, 999), b = R(r, 101, a - 50), d = a - b; return mk(`${a} － ${b} ＝ ？`, d, [d + 10, d - 10, d + 100, d - 100, d + 1].filter(x => x > 0), r, { svg: column(a, '−', b), why: `從個位算起，不夠減就跟前一位借 1，答案 ${d}。` }); },
  'm-money': r => { if (r() < 0.6) { const list = Array.from({ length: R(r, 2, 5) }, () => pick([1, 5, 10, 10, 50], r)).sort((x, y) => y - x), s = list.reduce((x, y) => x + y, 0); return mk('這些錢一共是多少元？', `${s} 元`, near(s, r, 1, [1, -1, 5, -5, 10, -10]).map(x => `${x} 元`), r, { svg: coins(list), why: `從大的錢幣開始加：${list.join(' ＋ ')} ＝ ${s} 元。` }); }
    const price = R(r, 12, 48), pay = 50, ch = pay - price, [it] = pick(things, r); return mk(`一包${it}賣 ${price} 元，付 ${pay} 元，要找回多少元？`, `${ch} 元`, [ch + 10, ch - 1, ch + 1, price, ch + 5].filter(x => x > 0).map(x => `${x} 元`), r, { svg: coins([50]), why: `${pay} － ${price} ＝ ${ch}，找回 ${ch} 元。` }); },
  'm-clock': r => { const h = R(r, 1, 12), m = pick([0, 0, 30, 30, 15, 45, 5, 10, 20, 25, 35, 40, 50, 55], r), say = (hh, mm) => mm ? `${hh} 點 ${mm} 分` : `${hh} 點整`, h2 = h % 12 + 1;
    return mk('時鐘上是幾點幾分？', say(h, m), [say(h2, m), say(h === 1 ? 12 : h - 1, m), say(h, (m + 30) % 60), say(h, (m + 5) % 60), say(Math.round(m / 5) || 12, (h * 5) % 60)], r, { svg: clock(h, m), why: `短針（時針）${m ? `走過 ${h}` : `指著 ${h}`}，長針（分針）${m ? `指著 ${m / 5}，代表 ${m} 分` : '指著 12'}，是 ${say(h, m)}。` }); },
  'm-word2': r => { const who = pick(people, r), [it, u] = pick(things, r), t = R(r, 0, 2);
    if (t === 0) { const a = R(r, 15, 60), b = R(r, 8, 39), s = a + b; return mk(`${who}有 ${a} ${u}${it}，又拿到 ${b} ${u}，一共有幾${u}？`, `${s} ${u}`, [a - b, s + 10, s - 10, s + 1].filter(x => x > 0).map(x => `${x} ${u}`), r, { why: `「又拿到」變多，用加法：${a} ＋ ${b} ＝ ${s}。` }); }
    if (t === 1) { const a = R(r, 30, 90), b = R(r, 8, a - 5), d = a - b; return mk(`${who}有 ${a} ${u}${it}，送給朋友 ${b} ${u}，還剩幾${u}？`, `${d} ${u}`, [a + b, d + 10, d - 1, d + 1].filter(x => x > 0).map(x => `${x} ${u}`), r, { why: `「送出去」變少，用減法：${a} － ${b} ＝ ${d}。` }); }
    const a = R(r, 25, 80), b = R(r, 5, 20), d = a - b; return mk(`哥哥有 ${a} ${u}${it}，比弟弟多 ${b} ${u}。弟弟有幾${u}？`, `${d} ${u}`, [a + b, d + 1, d - 10, b].filter(x => x > 0).map(x => `${x} ${u}`), r, { why: `哥哥比較多，弟弟要少 ${b} ${u}：${a} － ${b} ＝ ${d}。` }); },
  // 乘法山谷（2～3 年級）
  'm-group': r => { const rows = R(r, 2, 5), cols = R(r, 2, 6), n = rows * cols; if (r() < 0.5) return mk(`每排 ${cols} 個，有 ${rows} 排，用乘法怎麼記？`, `${cols} × ${rows}`, [`${cols} ＋ ${rows}`, `${cols} × ${cols}`, `${rows} ＋ ${rows}`, `${cols} × ${rows + 1}`], r, { svg: grid(rows, cols), why: `「每排 ${cols} 個、有 ${rows} 排」就是 ${rows} 個 ${cols}，記成 ${cols} × ${rows}。` });
    return mk(`每排 ${cols} 個，有 ${rows} 排，一共幾個？`, n, [cols + rows, n + cols, n - cols, n + 1], r, { svg: grid(rows, cols), why: `${Array(rows).fill(cols).join(' ＋ ')} ＝ ${cols} × ${rows} ＝ ${n}。` }); },
  'm-table': r => { const a = R(r, 2, 9), b = R(r, 2, 9), p = a * b; return mk(`${a} × ${b} ＝ ？`, p, [a * (b + 1), a * (b - 1), (a + 1) * b, a + b, p + 1].filter(x => x > 0), r, { big: `${a} × ${b}`, why: `九九乘法：${ZH[a]}${ZH[b]}${p >= 10 ? zhNum(p) : '得' + ZH[p]}，${a} × ${b} ＝ ${p}。` }); },
  'm-div': r => { const b = R(r, 2, 9), q = R(r, 2, 9), a = b * q; if (r() < 0.5) return mk(`${a} ÷ ${b} ＝ ？`, q, [q + 1, q - 1, a - b, b].filter(x => x > 0 && x !== q), r, { big: `${a} ÷ ${b}`, why: `想乘法：${b} × ${q} ＝ ${a}，所以 ${a} ÷ ${b} ＝ ${q}。` });
    const [it, u] = pick(things, r); return mk(`${a} ${u}${it}平分給 ${b} 個人，每人分到幾${u}？`, `${q} ${u}`, [q + 1, q - 1, a - b, b * 2].filter(x => x > 0).map(x => `${x} ${u}`), r, { svg: q * b <= 24 ? groups(b, q) : '', why: `平分用除法：${a} ÷ ${b} ＝ ${q}。` }); },
  'm-rem': r => { const b = R(r, 3, 9), q = R(r, 2, 9), m = R(r, 1, b - 1), a = b * q + m; return mk(`${a} ÷ ${b} ＝ ？`, `${q} 餘 ${m}`, [`${q - 1} 餘 ${m + b}`, `${q + 1} 餘 ${m}`, `${q} 餘 ${m + 1 < b ? m + 1 : m - 1}`, `${q + 1} 餘 ${Math.max(0, m - 1)}`], r, { big: `${a} ÷ ${b}`, svg: b * q <= 24 ? groups(b, q, m) : '', why: `${b} × ${q} ＝ ${b * q}，${a} － ${b * q} ＝ ${m}；餘數 ${m} 要比除數 ${b} 小。` }); },
  'm-mul2': r => { let a = R(r, 12, 98); if (a % 10 === 0) a++; const b = R(r, 2, 9), p = a * b; return mk(`${a} × ${b} ＝ ？`, p, [p + 10, p - 10, (a % 10) * b + Math.floor(a / 10) * b, p + b].filter(x => x > 0), r, { svg: column(a, '×', b), why: `${a} 拆成 ${Math.floor(a / 10) * 10} 和 ${a % 10}：${Math.floor(a / 10) * 10}×${b}＝${Math.floor(a / 10) * 10 * b}，${a % 10}×${b}＝${(a % 10) * b}，合起來 ${p}。` }); },
  'm-word3': r => { const [it, u] = pick(things, r), t = R(r, 0, 2);
    if (t === 0) { const a = R(r, 4, 9), b = R(r, 3, 9); return mk(`每盒有 ${a} ${u}${it}，${b} 盒一共有幾${u}？`, `${a * b} ${u}`, [a + b, a * b + a, a * (b - 1)].map(x => `${x} ${u}`), r, { why: `${b} 個 ${a}：${a} × ${b} ＝ ${a * b}。` }); }
    if (t === 1) { const b = R(r, 3, 9), q = R(r, 3, 9), a = b * q; return mk(`有 ${a} ${u}${it}，每 ${b} ${u}裝一袋，可以裝幾袋？`, `${q} 袋`, [q + 1, q - 1, a - b].filter(x => x > 0).map(x => `${x} 袋`), r, { why: `包裝用除法：${a} ÷ ${b} ＝ ${q}。` }); }
    const b = R(r, 3, 8), q = R(r, 3, 8), m = R(r, 1, b - 1), a = b * q + m; return mk(`有 ${a} ${u}${it}，每 ${b} ${u}裝一袋，裝完後還剩幾${u}？`, `${m} ${u}`, [q, m + 1, b - m, m + b].filter(x => x > 0).map(x => `${x} ${u}`), r, { why: `${a} ÷ ${b} ＝ ${q} 餘 ${m}，裝了 ${q} 袋，剩 ${m} ${u}。` }); },
  // 分數河橋（3～4 年級）
  'm-frac': r => { const d = R(r, 2, 8), n = R(r, 1, d - 1), ans = rawFrac(n, d); return mk('塗色的部分是全部的幾分之幾？', ans, [rawFrac(d - n, d), rawFrac(n, d + 1), rawFrac(d, n), rawFrac(n, Math.max(2, d - 1))].filter(x => x !== ans), r, { svg: r() < 0.5 ? fbar(n, d) : pie(n, d), why: `平分成 ${d} 份，塗了 ${n} 份，是 ${d} 分之 ${n}，寫成 ${n}/${d}。` }); },
  'm-fcompare': r => { if (r() < 0.6) { const d = R(r, 3, 12), a = R(r, 1, d - 1), b = R(r, 1, d - 1), s = a > b ? '>' : a < b ? '<' : '='; return mk(`${a}/${d} ○ ${b}/${d}，○ 裡要填什麼？`, s, ['>', '<', '='], r, { big: `${a}/${d} ○ ${b}/${d}`, why: a === b ? `分母一樣、分子也一樣，兩個分數一樣大。` : `分母一樣（都是 ${d} 等分），分子大的比較大。` }); }
    let a = R(r, 2, 9), b = R(r, 2, 9); if (a === b) b = a + 1; const s = 1 / a > 1 / b ? '>' : '<'; return mk(`1/${a} ○ 1/${b}，○ 裡要填什麼？`, s, ['>', '<', '='], r, { big: `1/${a} ○ 1/${b}`, why: `分子都是 1：分得越多份，每一份越小，所以 1/${Math.min(a, b)} 比較大。` }); },
  'm-faddsame': r => { const d = R(r, 3, 12); if (r() < 0.5) { const a = R(r, 1, d - 2), b = R(r, 1, d - 1 - a), s = a + b; return mk(`${a}/${d} ＋ ${b}/${d} ＝ ？`, rawFrac(s, d), [rawFrac(s, d + d), rawFrac(s + 1, d), rawFrac(a * b, d), rawFrac(s, d - 1)], r, { big: `${a}/${d} ＋ ${b}/${d}`, svg: fbar(s, d), why: `分母一樣，分母不變、分子相加：${a} ＋ ${b} ＝ ${s}，是 ${s}/${d}。` }); }
    const a = R(r, 2, d - 1), b = R(r, 1, a - 1), s = a - b; return mk(`${a}/${d} － ${b}/${d} ＝ ？`, rawFrac(s, d), [rawFrac(s, 0 + d * 2), rawFrac(a + b, d), rawFrac(s + 1, d), rawFrac(s, Math.max(1, d - 1))], r, { big: `${a}/${d} － ${b}/${d}`, why: `分母不變、分子相減：${a} － ${b} ＝ ${s}，是 ${s}/${d}。` }); },
  'm-decimal': r => { const n = R(r, 1, 9); if (r() < 0.5) return mk('塗色的部分用小數怎麼寫？（全部是 1）', `0.${n}`, [`0.${10 - n}`, `${n}`, `0.0${n}`, `0.${n === 9 ? 8 : n + 1}`], r, { svg: fbar(n, 10, B), why: `1 平分成 10 份，每份是 0.1；塗了 ${n} 份，是 0.${n}。` });
    const w = R(r, 1, 5); return mk(`${w}.${n} 是幾個 0.1？`, `${w * 10 + n} 個`, [w + n, n, w * 10 + n + 1, w * 100 + n, w * 10 + n - 1].map(x => `${x} 個`), r, { why: `1 是 10 個 0.1，${w} 是 ${w * 10} 個，再加 ${n} 個，一共 ${w * 10 + n} 個 0.1。` }); },
  'm-dec2': r => { if (r() < 0.3) { const n = R(r, 1, 99); return mk('塗色的部分用小數怎麼寫？（100 格是 1）', dec(n), [dec(n * 10 > 99 ? n + 1 : n * 10), dec(100 - n), String(n), dec(n + 10)].filter(x => x !== dec(n)), r, { svg: grid100(n), why: `每格是 0.01，塗了 ${n} 格是 ${dec(n)}。` }); }
    const a = R(r, 105, 899), b = R(r, 12, 499), add = r() < 0.6, x = add ? a + b : Math.max(a, b) - Math.min(a, b), A = add ? a : Math.max(a, b), Bv = add ? b : Math.min(a, b);
    return mk(`${dec(A)} ${add ? '＋' : '－'} ${dec(Bv)} ＝ ？`, dec(x), [x + 10, x - 10, x + 100, x + 1].filter(v => v > 0).map(dec), r, { big: `${dec(A)} ${add ? '＋' : '－'} ${dec(Bv)}`, why: `小數點對齊，像整數一樣${add ? '相加' : '相減'}，答案 ${dec(x)}。` }); },
  'm-convert': r => { const pairs = [[1, 2, 50], [1, 4, 25], [3, 4, 75], [1, 5, 20], [2, 5, 40], [3, 5, 60], [4, 5, 80], [1, 10, 10], [3, 10, 30], [7, 10, 70], [9, 10, 90], [1, 20, 5], [1, 25, 4]], [n, d, c] = pick(pairs, r);
    if (r() < 0.5) return mk(`${n}/${d} 寫成小數是多少？`, dec(c), [dec(c + 10), dec(100 - c), `${n}.${d}`, dec(n * 10 === c ? c + 5 : n * 10)].filter(x => x !== dec(c)), r, { why: `${n}/${d} ＝ ${n} ÷ ${d} ＝ ${dec(c)}（也可以想：分母變成 100，${n}/${d} ＝ ${c}/100）。` });
    return mk(`${dec(c)} 寫成最簡分數是多少？`, frac(c, 100), [frac(c + 5, 100), rawFrac(c, 10), frac(100 - c, 100), rawFrac(1, Math.round(100 / c) + 1)].filter(x => x !== frac(c, 100)), r, { why: `${dec(c)} ＝ ${c}/100，約分後是 ${frac(c, 100)}。` }); },
  // 圖形花園（2～5 年級）
  'm-shapes': r => { const nm = pick(shapesNames, r), col = pick([P, Y, G, B, V], r); if (r() < 0.5 || nm === '圓形') return mk('這是什麼形狀？', nm, shapesNames, r, { svg: shape(nm, col), why: nm === '圓形' ? '圓圓的、沒有角，是圓形。' : `有 ${POLY[nm]} 條邊、${POLY[nm]} 個角${nm === '正方形' ? '，四條邊一樣長、四個直角' : nm === '長方形' ? '，四個角都是直角，對邊一樣長' : ''}，是${nm}。` });
    const n = POLY[nm]; return mk(`這個${nm}有幾個角？`, `${n} 個`, [n - 1, n + 1, n + 2, n * 2].map(x => `${x} 個`), r, { svg: shape(nm, col), why: `${nm}有 ${n} 條邊、${n} 個角。` }); },
  'm-perim': r => { if (r() < 0.3) { const a = R(r, 2, 15), p = a * 4; return mk(`邊長 ${a} 公分的正方形，周長是幾公分？`, `${p} 公分`, [a * a, a * 2, a + 4, p + a].map(x => `${x} 公分`), r, { svg: rectFig(a, a), why: `正方形四條邊一樣長：${a} × 4 ＝ ${p}。` }); }
    const w = R(r, 3, 15), h = R(r, 2, w - 1), p = 2 * (w + h); return mk('這個長方形的周長是幾公分？', `${p} 公分`, [w * h, w + h, 2 * w + h, p + 2].map(x => `${x} 公分`), r, { svg: rectFig(w, h), why: `周長是繞一圈的長度：(${w} ＋ ${h}) × 2 ＝ ${p}。` }); },
  'm-area': r => { if (r() < 0.3) { const a = R(r, 2, 12), s = a * a; return mk(`邊長 ${a} 公分的正方形，面積是幾平方公分？`, `${s} 平方公分`, [a * 4, a * 2, s + a, a + a].map(x => `${x} 平方公分`), r, { svg: rectFig(a, a), why: `正方形面積 ＝ 邊長 × 邊長 ＝ ${a} × ${a} ＝ ${s}。` }); }
    const w = R(r, 3, 15), h = R(r, 2, w - 1), s = w * h; return mk('這個長方形的面積是幾平方公分？', `${s} 平方公分`, [2 * (w + h), w + h, s + w, s - h].map(x => `${x} 平方公分`), r, { svg: rectFig(w, h), why: `長方形面積 ＝ 長 × 寬 ＝ ${w} × ${h} ＝ ${s}（周長才是 ${2 * (w + h)}）。` }); },
  'm-angle': r => { const deg = pick([30, 40, 45, 60, 70, 90, 90, 110, 120, 135, 150], r), kind = deg < 90 ? '銳角' : deg === 90 ? '直角' : '鈍角'; if (r() < 0.75) return mk('這是什麼角？', kind, ['銳角', '直角', '鈍角', '平角'], r, { svg: angleFig(deg), why: `比直角（90 度）小是銳角、剛好 90 度是直角、比直角大（小於 180 度）是鈍角；這個角是 ${deg} 度，是${kind}。` });
    const q = pick([['直角', '90 度'], ['平角', '180 度'], ['一圈（周角）', '360 度']], r); return mk(`${q[0]}是幾度？`, q[1], ['45 度', '90 度', '180 度', '360 度', '100 度'], r, { why: `直角 90 度，平角 180 度（兩個直角），一圈 360 度。` }); },
  'm-tri': r => { if (r() < 0.55) { let b = R(r, 3, 14), h = R(r, 2, 12); if ((b * h) % 2) b++; const s = b * h / 2; return mk('這個三角形的面積是幾平方公分？', `${s} 平方公分`, [b * h, b + h, s + b, (b * h) * 2].map(x => `${x} 平方公分`), r, { svg: triFig(b, h), why: `三角形面積 ＝ 底 × 高 ÷ 2 ＝ ${b} × ${h} ÷ 2 ＝ ${s}。` }); }
    const b = R(r, 3, 14), h = R(r, 2, 10), s = b * h; return mk('這個平行四邊形的面積是幾平方公分？', `${s} 平方公分`, [s / 2, b + h, 2 * (b + h), s + h].map(x => `${x} 平方公分`), r, { svg: triFig(b, h, 'para'), why: `平行四邊形可以剪拼成長方形：底 × 高 ＝ ${b} × ${h} ＝ ${s}。` }); },
  'm-volume': r => { const l = R(r, 2, 6), w = R(r, 2, 5), h = R(r, 2, 5), v = l * w * h; return mk('這個長方體的體積是幾立方公分？（單位：公分）', `${v} 立方公分`, [l * w, l + w + h, 2 * (l * w + w * h + l * h), v + l * w].map(x => `${x} 立方公分`), r, { svg: boxFig(l, w, h), why: `體積 ＝ 長 × 寬 × 高 ＝ ${l} × ${w} × ${h} ＝ ${v}。` }); },
  // 大數古城（4～5 年級）
  'm-big': r => { const places = ['個位', '十位', '百位', '千位', '萬位', '十萬位', '百萬位', '千萬位'];
    if (r() < 0.5) { let n, k, d; do { n = R(r, 10000, 99999999); const s = String(n); k = R(r, 0, s.length - 1); d = s[s.length - 1 - k]; } while ([...String(n)].filter(c => c === d).length > 1 || d === '0'); return mk(`${n.toLocaleString('en-US')} 裡的「${d}」在哪一位？`, places[k], places.slice(0, String(n).length), r, { why: `從右邊數起：個、十、百、千、萬、十萬、百萬、千萬；「${d}」在${places[k]}。` }); }
    const n = R(r, 2, 99) * 10000 + pick([R(r, 1, 9) * 1000 + R(r, 0, 9) * 10, R(r, 1, 999), R(r, 1000, 9999)], r), right = zhNum(n), alt = [zhNum(n + 1000), zhNum(n - 9 > 0 ? n * 10 : n + 10), zhNum(Math.floor(n / 10)), zhNum(n + 10000)];
    return mk(`${n.toLocaleString('en-US')} 怎麼讀？`, right, alt, r, { noRead: true, why: `四位一節：先讀萬以上的「${zhNum(Math.floor(n / 10000))}萬」，再讀後面四位；中間有 0 要讀「零」。` }); },
  'm-muldiv': r => { if (r() < 0.55) { const a = R(r, 105, 499), b = R(r, 11, 49), p = a * b; return mk(`${a} × ${b} ＝ ？`, p, [p + 10, p - a, p + a, a * (b % 10) + a * Math.floor(b / 10)].filter(x => x > 0), r, { svg: column(a, '×', b), why: `拆開乘：${a} × ${b % 10} ＝ ${a * (b % 10)}，${a} × ${Math.floor(b / 10) * 10} ＝ ${a * Math.floor(b / 10) * 10}，合起來 ${p}。` }); }
    const b = R(r, 3, 9), q = R(r, 112, 999), a = b * q; return mk(`${a} ÷ ${b} ＝ ？`, q, [q + 10, q - 1, q + 100, Math.floor(q / 10)].filter(x => x > 0), r, { big: `${a} ÷ ${b}`, why: `從最高位開始一位一位除；驗算：${q} × ${b} ＝ ${a}。` }); },
  'm-order': r => { const t = R(r, 0, 3), a = R(r, 2, 20), b = R(r, 2, 9), c = R(r, 2, 9);
    if (t === 0) { const ans = a + b * c; return mk(`${a} ＋ ${b} × ${c} ＝ ？`, ans, [(a + b) * c, ans + 1, a * b + c], r, { big: `${a} ＋ ${b} × ${c}`, why: `先乘除、後加減：${b} × ${c} ＝ ${b * c}，${a} ＋ ${b * c} ＝ ${ans}。` }); }
    if (t === 1) { const ans = (a + b) * c; return mk(`(${a} ＋ ${b}) × ${c} ＝ ？`, ans, [a + b * c, ans + c, a * c + b], r, { big: `(${a} ＋ ${b}) × ${c}`, why: `有括號先算括號：${a} ＋ ${b} ＝ ${a + b}，再 × ${c} ＝ ${ans}。` }); }
    if (t === 2) { const q = R(r, 2, 9), A = R(r, b * q + 1, b * q + 30), ans = A - b * q; return mk(`${A} － ${b * q} ÷ ${b} ＝ ？`, A - q, [ans, A - q + 1, A + q, A - q - 1].filter(x => x >= 0), r, { big: `${A} － ${b * q} ÷ ${b}`, why: `先除：${b * q} ÷ ${b} ＝ ${q}，再減：${A} － ${q} ＝ ${A - q}。` }); }
    const C2 = Math.min(c, a * b - 1), ans = a * b - C2; return mk(`${a} × ${b} － ${C2} ＝ ？`, ans, [a * (b - C2), ans + 1, ans - 1, a + b - C2, ans + 2].filter(x => x >= 0), r, { big: `${a} × ${b} － ${C2}`, why: `先乘：${a} × ${b} ＝ ${a * b}，再減 ${C2} ＝ ${ans}。` }); },
  'm-factor': r => { if (r() < 0.55) { const n = pick([12, 16, 18, 20, 24, 28, 30, 32, 36, 40, 42, 45, 48], r), fs = [], nf = []; for (let k = 2; k < n; k++) (n % k ? nf : fs).push(k); const f = pick(fs, r); return mk(`下面哪一個是 ${n} 的因數？`, f, shuffle(nf, r).slice(0, 3), r, { why: `${n} ÷ ${f} ＝ ${n / f}，可以整除，所以 ${f} 是 ${n} 的因數。` }); }
    const k = R(r, 3, 9), m = k * R(r, 3, 12), wr = [m + 1, m - 1, m + 2, k * 2 + 1, m + k - 1].filter(x => x % k); return mk(`下面哪一個是 ${k} 的倍數？`, m, wr, r, { why: `${m} ＝ ${k} × ${m / k}，所以是 ${k} 的倍數。` }); },
  'm-gcd': r => { let a, b; do { const g = R(r, 2, 9); a = g * R(r, 2, 8); b = g * R(r, 2, 8); } while (a === b); const G1 = gcd(a, b), L1 = lcm(a, b);
    if (r() < 0.5) return mk(`${a} 和 ${b} 的最大公因數是多少？`, G1, [L1, G1 * 2, Math.max(1, G1 - 1), a * b, Math.min(a, b)].filter(x => x !== G1), r, { why: `${a} 和 ${b} 都可以被 ${G1} 整除，${G1} 是最大的那個。` });
    return mk(`${a} 和 ${b} 的最小公倍數是多少？`, L1, [a * b === L1 ? L1 * 2 : a * b, G1, L1 + Math.min(a, b), L1 * 2].filter(x => x !== L1), r, { why: `把 ${Math.max(a, b)} 的倍數一個一個列出來，第一個也是 ${Math.min(a, b)} 的倍數的是 ${L1}。` }); },
  // 比例塔頂（5～6 年級）
  'm-simplify': r => { let p, q; do { q = R(r, 2, 9); p = R(r, 1, q - 1); } while (gcd(p, q) > 1); const k = R(r, 2, 6);
    if (r() < 0.55) return mk(`${p * k}/${q * k} 約成最簡分數是多少？`, rawFrac(p, q), [rawFrac(p + 1, q), rawFrac(q, p), rawFrac(p, q + 1), rawFrac(p * k, q)].filter(x => x !== rawFrac(p, q)), r, { why: `分子分母同除以 ${k}：${p * k} ÷ ${k} ＝ ${p}，${q * k} ÷ ${k} ＝ ${q}。` });
    return mk(`${p}/${q} ＝ ？/${q * k}`, p * k, [p + k, p * k + 1, q * k - p, p * (k + 1), p * k - 1, q * k].filter(x => x > 0), r, { why: `分母乘 ${k}，分子也要乘 ${k}：${p} × ${k} ＝ ${p * k}。` }); },
  'm-fracadd': r => { let a, b, c, d; do { b = R(r, 2, 6); d = R(r, 2, 8); a = R(r, 1, b - 1); c = R(r, 1, d - 1); } while (b === d || a * d + c * b >= b * d); const add = r() < 0.6;
    if (!add && a * d < c * b) [a, b, c, d] = [c, d, a, b]; const L1 = lcm(b, d), x = a * (L1 / b) + (add ? 1 : -1) * c * (L1 / d), ans = frac(x, L1);
    return mk(`${a}/${b} ${add ? '＋' : '－'} ${c}/${d} ＝ ？`, ans, [rawFrac(add ? a + c : Math.abs(a - c), b + d), frac(x + 1, L1), frac(add ? a + c : Math.abs(a - c), L1), frac(Math.abs(x - 1) || 1, L1), frac(x, L1 * 2)].filter(v => v !== ans && !/^0(\/|$)/.test(v)), r, { big: `${a}/${b} ${add ? '＋' : '－'} ${c}/${d}`, why: `先通分成分母 ${L1}：${a}/${b} ＝ ${a * L1 / b}/${L1}，${c}/${d} ＝ ${c * L1 / d}/${L1}；分子${add ? '相加' : '相減'}得 ${x}/${L1}${frac(x, L1) !== rawFrac(x, L1) ? `，約分是 ${ans}` : ''}。` }); },
  'm-fracmul': r => { const t = R(r, 0, 2);
    if (t === 0) { const n = R(r, 2, 12), b = R(r, 2, 9), a = R(r, 1, b - 1), ans = frac(n * a, b); return mk(`${n} × ${a}/${b} ＝ ？`, ans, [rawFrac(n * a, n * b), frac(a, n * b), frac(n + a, b), frac(n * b, a)].filter(v => v !== ans), r, { big: `${n} × ${a}/${b}`, why: `整數乘分子、分母不變：${n} × ${a} ＝ ${n * a}，是 ${rawFrac(n * a, b)}${ans !== rawFrac(n * a, b) ? `，約分是 ${ans}` : ''}。` }); }
    const b = R(r, 2, 9), a = R(r, 1, b - 1), d = R(r, 2, 9), c = R(r, 1, d - 1);
    if (t === 1) { const ans = frac(a * c, b * d); return mk(`${a}/${b} × ${c}/${d} ＝ ？`, ans, [frac(a + c, b + d), frac(a * d, b * c), frac(a * c, b + d), frac(a * c + 1, b * d)].filter(v => v !== ans), r, { big: `${a}/${b} × ${c}/${d}`, why: `分子乘分子、分母乘分母：${a * c}/${b * d}${ans !== rawFrac(a * c, b * d) ? `，約分是 ${ans}` : ''}。` }); }
    const ans = frac(a * d, b * c); return mk(`${a}/${b} ÷ ${c}/${d} ＝ ？`, ans, [frac(a * c, b * d), frac(b * c, a * d), frac(a * d + 1, b * c), frac(a, b * c)].filter(v => v !== ans), r, { big: `${a}/${b} ÷ ${c}/${d}`, why: `除以一個分數，等於乘它的倒數：${a}/${b} × ${d}/${c} ＝ ${rawFrac(a * d, b * c)}${ans !== rawFrac(a * d, b * c) ? `，約分是 ${ans}` : ''}。` }); },
  'm-ratio': r => { if (r() < 0.5) { const a = R(r, 1, 12), b = R(r, 2, 12), ans = frac(a, b); return mk(`${a} : ${b} 的比值是多少？`, ans, [frac(b, a), rawFrac(a + 1, b), frac(a, a + b), String(a + b)].filter(v => v !== ans), r, { why: `比值 ＝ 前項 ÷ 後項 ＝ ${a} ÷ ${b} ＝ ${ans}。` }); }
    const a = R(r, 1, 9), b = R(r, 2, 9), k = R(r, 2, 6); return mk(`${a} : ${b} ＝ ${a * k} : ？`, b * k, [b + k, b * k + 1, a * b, b * (k + 1)], r, { why: `前項乘 ${k}（${a} → ${a * k}），後項也要乘 ${k}：${b} × ${k} ＝ ${b * k}。` }); },
  'm-percent': r => { const t = R(r, 0, 2);
    if (t === 0) { const tot = pick([20, 25, 40, 50], r), m = R(r, 1, tot - 1), p = m * 100 / tot; if (p % 1) return MATH_TYPES['m-percent'](r); return mk(`班上 ${tot} 人，有 ${m} 人戴眼鏡，戴眼鏡的人占百分之幾？`, `${p}%`, [m, p + 10, 100 - p, Math.round(tot / m)].filter(x => x > 0 && x <= 100).map(x => `${x}%`), r, { svg: tot <= 50 ? grid100(p, P) : '', why: `${m} ÷ ${tot} ＝ ${dec(p)}，就是 ${p}%。` }); }
    if (t === 1) { const c = R(r, 1, 99); return mk(`${dec(c)} 是百分之幾？`, `${c}%`, [c / 10, c * 10, c + 10, 100 - c].filter(x => x > 0 && x <= 1000 && x !== c).map(x => `${x}%`), r, { svg: grid100(c), why: `${dec(c)} ＝ ${c}/100 ＝ ${c}%。` }); }
    const p = pick([10, 20, 25, 50, 75, 30, 40], r), n = pick([20, 40, 60, 80, 100, 200, 120], r), ans = n * p / 100; if (ans % 1) return MATH_TYPES['m-percent'](r); return mk(`${n} 的 ${p}% 是多少？`, ans, [n - ans, ans * 10, ans + p, p].filter(x => x > 0 && x !== ans), r, { why: `${n} × ${p}/100 ＝ ${ans}。` }); },
  'm-speed': r => { const t = R(r, 0, 2);
    if (t === 0) { const v = R(r, 40, 90), h = R(r, 2, 5), d = v * h; return mk(`一輛車 ${h} 小時走了 ${d} 公里，平均每小時走幾公里？`, `${v} 公里`, [d - h, v + 10, d * h, v - 5].filter(x => x > 0).map(x => `${x} 公里`), r, { why: `速率 ＝ 距離 ÷ 時間 ＝ ${d} ÷ ${h} ＝ ${v}（時速 ${v} 公里）。` }); }
    if (t === 1) { const v = R(r, 50, 90), m = R(r, 3, 15), d = v * m; return mk(`小明每分鐘走 ${v} 公尺，走 ${m} 分鐘，一共走幾公尺？`, `${d} 公尺`, [v + m, d + v, d - v, v * (m + 1) + 10].map(x => `${x} 公尺`), r, { why: `距離 ＝ 速率 × 時間 ＝ ${v} × ${m} ＝ ${d}。` }); }
    const v = pick([4, 5, 6, 8, 10, 12, 15], r), h = R(r, 2, 6), d = v * h; return mk(`從家裡到公園 ${d} 公里，騎腳踏車每小時騎 ${v} 公里，要騎幾小時？`, `${h} 小時`, [h + 1, h - 1, d - v, d * v].filter(x => x > 0).map(x => `${x} 小時`), r, { why: `時間 ＝ 距離 ÷ 速率 ＝ ${d} ÷ ${v} ＝ ${h}。` }); },
};

// ── 教學卡片：每個知識點 3～4 張，圖＋一句話＋例子；點開會念出來 ──
const C = (title, pic, text) => ({ kind: 'math', title, svg: pic, text });
export const MATH_LESSONS = {
  'm-count10': [C('數數', dots(3), '一個一個點著數，最後數到的數就是一共有幾個。'), C('5 個一排', dots(5, B), '五個排一排，數起來更快。'), C('10', dots(10, G), '兩排 5 個就是 10。10 個一數叫「一十」。')],
  'm-compare': [C('大於 >', '', '5 > 3 讀作「5 大於 3」。開口朝向大的數，像小鱷魚要吃大的。'), C('小於 <', '', '2 < 7 讀作「2 小於 7」。'), C('先比十位', blocks(0, 4, 2), '42 和 38：十位 4 比 3 大，所以 42 > 38；十位一樣再比個位。')],
  'm-place': [C('十和一', blocks(0, 1, 3), '一條長條是 10，一個小方塊是 1。13 是 1 個十和 3 個一。'), C('十位、個位', blocks(0, 5, 7), '57：5 在十位（5 個十），7 在個位（7 個一）。'), C('數到 100', blocks(1, 0, 0), '10 個十是 100（一百）。')],
  'm-add10': [C('合起來', dots(3, P, 2, B), '3 個和 2 個合起來是 5 個：3 ＋ 2 ＝ 5。'), C('換順序', dots(2, P, 3, B), '2 ＋ 3 也是 5，加法換順序答案一樣。'), C('湊成 10', dots(6, P, 4, B), '6 ＋ 4 ＝ 10，6 和 4 是「10 的好朋友」。')],
  'm-sub10': [C('拿走', dots(4, G, 3, G, 3), '7 個拿走 3 個，還剩 4 個：7 － 3 ＝ 4。'), C('比多少', '', '8 比 5 多多少？8 － 5 ＝ 3。'), C('減加互查', '', '因為 4 ＋ 3 ＝ 7，所以 7 － 3 ＝ 4。')],
  'm-add20': [C('湊十法', dots(8, P, 5, B), '8 ＋ 5：8 再 2 就是 10，5 拆成 2 和 3，10 ＋ 3 ＝ 13。'), C('退位減法', '', '13 － 5：先算 10 － 5 ＝ 5，再加 3，是 8。'), C('想加法', '', '13 － 5 ＝ ？想：5 ＋ 8 ＝ 13，所以是 8。')],
  'm-add2': [C('直式', column(38, '+', 25), '個位對個位、十位對十位，從個位開始算。'), C('進位', column(38, '+', 25), '個位 8 ＋ 5 ＝ 13，寫 3、進 1 到十位；十位 3 ＋ 2 ＋ 1 ＝ 6，答案 63。')],
  'm-sub2': [C('直式', column(52, '−', 27), '個位 2 不夠減 7，向十位借 1 個十，12 － 7 ＝ 5。'), C('借了要記得', column(52, '−', 27), '十位 5 被借走 1 變成 4，4 － 2 ＝ 2，答案 25。'), C('驗算', '', '25 ＋ 27 ＝ 52，答案對了。')],
  'm-add3': [C('三位數', blocks(2, 3, 4), '234 是 2 個百、3 個十、4 個一。'), C('一樣從個位算', column(256, '+', 178), '個位滿十進位，十位滿十也進位到百位：256 ＋ 178 ＝ 434。')],
  'm-money': [C('錢幣', coins([1, 5, 10, 50]), '1 元、5 元、10 元、50 元。'), C('從大的開始數', coins([50, 10, 10, 5, 1]), '50、60、70、75、76：一共 76 元。'), C('找錢', '', '買 35 元的東西付 50 元，50 － 35 ＝ 15，找 15 元。')],
  'm-clock': [C('長針短針', clock(3, 0), '短針是時針、長針是分針。長針指 12、短針指 3，是 3 點整。'), C('半點', clock(3, 30), '長針指 6 是 30 分，3 點 30 分（3 點半）。'), C('5 分一格', clock(8, 15), '長針每走一個數字是 5 分；指 3 是 15 分，8 點 15 分。')],
  'm-word2': [C('變多用加法', '', '「又買了」「一共」：原來的加上新的。'), C('變少用減法', '', '「吃掉」「送出」「還剩」：原來的減掉少掉的。'), C('比多少', '', '哥哥比弟弟多 5 張，弟弟比較少，用哥哥的減 5。')],
  'm-group': [C('幾個一數', grid(3, 4), '每排 4 個、有 3 排：4、8、12，一共 12 個。'), C('乘法記法', grid(3, 4), '3 個 4 記成 4 × 3 ＝ 12。'), C('連加變乘法', '', '5 ＋ 5 ＋ 5 ＋ 5 ＝ 5 × 4 ＝ 20。')],
  'm-table': [C('九九乘法', grid(2, 9), '二九十八：2 × 9 ＝ 18。'), C('換順序一樣', '', '3 × 7 和 7 × 3 都是 21，背一半就夠了。'), C('小技巧', '', '9 的乘法：9 × 4 ＝ 36，十位 3 加個位 6 剛好是 9。')],
  'm-div': [C('平分', groups(3, 4), '12 顆平分成 3 份，每份 4 顆：12 ÷ 3 ＝ 4。'), C('想乘法', '', '20 ÷ 4 ＝ ？想：4 × 5 ＝ 20，所以是 5。'), C('包裝', '', '15 個每 5 個一袋，可以裝 15 ÷ 5 ＝ 3 袋。')],
  'm-rem': [C('分不完', groups(3, 4, 2), '14 顆每人 4 顆，分給 3 人，剩 2 顆：14 ÷ 4 ＝ 3 餘 2。'), C('餘數要比較小', '', '餘數一定比除數小；剩的還夠分，就要再多分一份。'), C('驗算', '', '4 × 3 ＋ 2 ＝ 14。')],
  'm-mul2': [C('拆開乘', column(23, '×', 4), '23 × 4：20 × 4 ＝ 80，3 × 4 ＝ 12，80 ＋ 12 ＝ 92。'), C('直式', column(47, '×', 3), '個位 7 × 3 ＝ 21，寫 1 進 2；十位 4 × 3 ＝ 12 再加 2 ＝ 14，答案 141。')],
  'm-word3': [C('每份 × 份數', '', '每盒 6 個、4 盒：6 × 4 ＝ 24。'), C('總數 ÷ 每份', '', '24 個每盒 6 個：24 ÷ 6 ＝ 4 盒。'), C('還剩幾個', '', '26 個每盒 6 個：26 ÷ 6 ＝ 4 餘 2，剩 2 個。')],
  'm-frac': [C('平分', fbar(1, 4), '把 1 個東西平分成 4 份，1 份是四分之一，寫成 1/4。'), C('分子、分母', fbar(3, 5), '3/5：下面的 5 是分母（分成 5 份），上面的 3 是分子（取 3 份）。'), C('圓也可以', pie(2, 3), '圓平分成 3 份塗 2 份，是 2/3。')],
  'm-fcompare': [C('分母一樣', fbar(3, 6), '3/6 和 5/6：每份一樣大，5 份比 3 份多，5/6 > 3/6。'), C('分子都是 1', fbar(1, 3, B), '1/3 和 1/5：分越多份，每份越小，所以 1/3 > 1/5。')],
  'm-faddsame': [C('同分母相加', fbar(3, 7), '1/7 ＋ 2/7 ＝ 3/7：分母不變，分子相加。'), C('同分母相減', '', '5/8 － 2/8 ＝ 3/8。'), C('剛好是 1', fbar(4, 4), '4/4 就是 1 整個。')],
  'm-decimal': [C('0.1', fbar(1, 10, B), '1 平分成 10 份，每份是 0.1（零點一）。'), C('0.7', fbar(7, 10, B), '7 份是 0.7，等於 7/10。'), C('1.3', '', '1.3 是 1 和 0.3，也是 13 個 0.1。')],
  'm-dec2': [C('0.01', grid100(1), '1 平分成 100 份，每份是 0.01。'), C('0.45', grid100(45), '45 格是 0.45。'), C('對齊小數點', '', '1.25 ＋ 0.6：小數點對齊（0.6 看成 0.60），答案 1.85。')],
  'm-convert': [C('1/2 ＝ 0.5', fbar(1, 2), '一半就是 0.5。'), C('1/4 ＝ 0.25', grid100(25), '1/4 ＝ 25/100 ＝ 0.25。'), C('小數變分數', '', '0.6 ＝ 6/10 ＝ 3/5（約分）。')],
  'm-shapes': [C('三角形', shape('三角形', P), '3 條邊、3 個角。'), C('正方形和長方形', shape('長方形', B), '都有 4 個直角；正方形 4 條邊一樣長，長方形是對邊一樣長。'), C('圓形', shape('圓形', Y), '圓圓的，沒有邊也沒有角。')],
  'm-perim': [C('周長', rectFig(6, 4), '繞圖形一圈的長度：6 ＋ 4 ＋ 6 ＋ 4 ＝ 20 公分。'), C('長方形', rectFig(6, 4), '長方形周長 ＝ (長 ＋ 寬) × 2。'), C('正方形', rectFig(5, 5), '正方形周長 ＝ 邊長 × 4 ＝ 20 公分。')],
  'm-area': [C('面積', rectFig(4, 3), '平面的大小。1 公分 × 1 公分的小方格是 1 平方公分。'), C('長方形', rectFig(4, 3), '長方形面積 ＝ 長 × 寬 ＝ 4 × 3 ＝ 12 平方公分。'), C('別和周長搞混', '', '周長是邊的長度（公分），面積是格子數（平方公分）。')],
  'm-angle': [C('直角', angleFig(90), '像書本的角，是 90 度。'), C('銳角', angleFig(45), '比直角小的角。'), C('鈍角', angleFig(130), '比直角大、比平角（180 度）小的角。')],
  'm-tri': [C('平行四邊形', triFig(6, 4, 'para'), '剪下一個角拼到另一邊變成長方形：面積 ＝ 底 × 高。'), C('三角形', triFig(6, 4), '兩個一樣的三角形拼成平行四邊形：面積 ＝ 底 × 高 ÷ 2。'), C('高要垂直', triFig(8, 3), '高是從頂點垂直畫到底的長度（虛線）。')],
  'm-volume': [C('體積', boxFig(3, 2, 2), '立體占的空間大小；1 公分 × 1 公分 × 1 公分是 1 立方公分。'), C('長方體', boxFig(3, 2, 2), '體積 ＝ 長 × 寬 × 高 ＝ 3 × 2 × 2 ＝ 12 立方公分。'), C('正方體', boxFig(3, 3, 3), '正方體體積 ＝ 邊長 × 邊長 × 邊長 ＝ 27 立方公分。')],
  'm-big': [C('萬', '', '10 個一千是一萬（10,000）。'), C('四位一節', '', '35,060,200：「三千五百零六萬零二百」。萬以上先讀一節，後面再讀四位。'), C('億', '', '一萬個一萬是一億（100,000,000）。')],
  'm-muldiv': [C('三位數乘二位數', column(213, '×', 32), '213 × 32 ＝ 213 × 2 ＋ 213 × 30 ＝ 426 ＋ 6390 ＝ 6816。'), C('除法直式', '', '從最高位開始除：852 ÷ 4，8 ÷ 4 ＝ 2、5 ÷ 4 ＝ 1 餘 1、12 ÷ 4 ＝ 3，答案 213。'), C('驗算', '', '商 × 除數 ＋ 餘數 ＝ 被除數。')],
  'm-order': [C('先乘除後加減', '', '3 ＋ 4 × 5 ＝ 3 ＋ 20 ＝ 23。'), C('括號最先', '', '(3 ＋ 4) × 5 ＝ 7 × 5 ＝ 35。'), C('同級從左算到右', '', '20 － 6 ＋ 3 ＝ 14 ＋ 3 ＝ 17。')],
  'm-factor': [C('因數', grid(3, 4), '12 可以排成 3 × 4，3 和 4 都是 12 的因數。'), C('12 的因數', '', '1、2、3、4、6、12。'), C('倍數', '', '3 的倍數：3、6、9、12、15⋯⋯（3 × 1、3 × 2、3 × 3⋯⋯）。')],
  'm-gcd': [C('公因數', '', '12 和 18 的公因數：1、2、3、6；最大公因數是 6。'), C('公倍數', '', '4 和 6 的公倍數：12、24、36⋯⋯；最小公倍數是 12。'), C('用在哪裡', '', '約分用最大公因數，通分用最小公倍數。')],
  'm-simplify': [C('約分', fbar(2, 4), '2/4 分子分母同除以 2 是 1/2，大小一樣。'), C('擴分', fbar(1, 2), '1/2 分子分母同乘 3 是 3/6，大小一樣。'), C('最簡分數', '', '分子分母只有公因數 1，就是最簡分數。')],
  'm-fracadd': [C('先通分', '', '1/2 ＋ 1/3：通分成 3/6 ＋ 2/6 ＝ 5/6。'), C('找公倍數', '', '分母 4 和 6 的最小公倍數是 12，就通分成十二分之幾。'), C('答案約分', '', '1/4 ＋ 1/4 ＝ 2/4 ＝ 1/2。')],
  'm-fracmul': [C('整數 × 分數', '', '3 × 2/7 ＝ 6/7（分子乘、分母不變）。'), C('分數 × 分數', '', '2/3 × 3/5 ＝ 6/15 ＝ 2/5。'), C('除以分數', '', '1/2 ÷ 1/4 ＝ 1/2 × 4/1 ＝ 2：乘以倒數。')],
  'm-ratio': [C('比', '', '3 個蘋果、2 個橘子，蘋果和橘子的比是 3 : 2。'), C('比值', '', '3 : 2 的比值 ＝ 3 ÷ 2 ＝ 3/2。'), C('相等的比', '', '前項後項同乘或同除一個數，比值不變：3 : 2 ＝ 6 : 4。')],
  'm-percent': [C('百分率', grid100(30, P), '把全部看成 100 份，30 份是 30%（百分之三十）。'), C('小數和百分率', '', '0.25 ＝ 25/100 ＝ 25%。'), C('求部分', '', '80 的 25% ＝ 80 × 25/100 ＝ 20。')],
  'm-speed': [C('速率', '', '一段時間走多遠：速率 ＝ 距離 ÷ 時間。'), C('時速、分速', '', '每小時走 60 公里叫時速 60 公里；每分鐘走 80 公尺叫分速 80 公尺。'), C('三兄弟', '', '距離 ＝ 速率 × 時間；時間 ＝ 距離 ÷ 速率。')],
};
export const mathLesson = key => MATH_LESSONS[key] || [];
