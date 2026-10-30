/* 速算祕笈：44 招小學速算技巧，分成 7 章（和數學課程一起，是課程清單裡的「#速算」單元）。
   每一招：章節 ch、第幾招 no、名稱 title、適合幾年級 grade、口訣 rule、經典例子 ex，以及 gen() 出一題練習：
   gen() → { q: 題目, a: 答案（數字或文字）, wrongs?: 錯誤選項（沒有就自動產生）, why: 用這一題的數字說明怎麼套用這招 }。
   整理自國小常見的速算口訣與印度吠陀速算（各家整理的招數不一樣，這裡挑出 44 招、統一寫法與例子）。不依賴瀏覽器，可以直接用 node 測。 */
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
const p2 = n => String(n).padStart(2, '0');
const sumDigits = n => String(n).split('').reduce((s, d) => s + +d, 0);
export const CHAPTERS = [
  { id: 'A', title: '加法速算', grade: 1, zone: 'shilin', icon: '➕', summary: '湊十、湊整、拆位、配對：加法不用一位一位慢慢算。' },
  { id: 'B', title: '減法速算', grade: 2, zone: 'datong', icon: '➖', summary: '破十、減整再加、補數：退位減法也能一眼看出答案。' },
  { id: 'C', title: '乘以特殊數', grade: 3, zone: 'songshan', icon: '✖️', summary: '乘 9、11、5、25、125、99、101、15：遇到這些數字有捷徑。' },
  { id: 'D', title: '兩位數乘法妙招', grade: 4, zone: 'nangang', icon: '🔢', summary: '頭同尾合十、尾同頭合十、十幾乘十幾、接近 100：兩位數相乘直接寫答案。' },
  { id: 'E', title: '除法速算', grade: 4, zone: 'wanhua', icon: '➗', summary: '除以 5、25、125 變成乘法，商不變的性質讓除法變簡單。' },
  { id: 'F', title: '整除與驗算', grade: 5, zone: 'zhongzheng', icon: '✅', summary: '不用真的除，就知道能不能整除；估算一下就知道答案對不對。' },
  { id: 'G', title: '分數與百分比', grade: 6, zone: 'xinyi', icon: '％', summary: '百分比對調、交叉相乘比大小：分數題也有快招。' },
];
export const TRICKS = [
  // ── A 加法速算 ──
  { id: 'make10', ch: 'A', grade: 1, title: '湊十法', rule: '看大數，拆小數，先湊成十再加剩下的。', ex: '8 + 5 → 8 + 2 = 10，10 + 3 = 13',
    gen() { const a = ri(6, 9), b = ri(11 - a, 9), k = 10 - a; return { q: `${a} + ${b}`, a: a + b, why: `${a} 還差 ${k} 就是 10，把 ${b} 拆成 ${k} 和 ${b - k}：10 + ${b - k} = ${a + b}` }; } },
  { id: 'addRound', ch: 'A', grade: 2, title: '加整再減', rule: '加的數接近整十、整百：先加整數，多加的再減回來。', ex: '368 + 99 → 368 + 100 − 1 = 467',
    gen() { const x = ri(120, 880), y = pick([9, 19, 29, 39, 49, 98, 99, 198, 199]), n = y % 100 >= 90 ? Math.ceil(y / 100) * 100 : Math.ceil(y / 10) * 10, d = n - y; return { q: `${x} + ${y}`, a: x + y, why: `${y} 看成 ${n} − ${d}：${x} + ${n} = ${x + n}，再減 ${d} 得 ${x + y}` }; } },
  { id: 'splitAdd', ch: 'A', grade: 2, title: '拆位相加', rule: '十位加十位、個位加個位，最後合起來。', ex: '73 + 19 → (70 + 10) + (3 + 9) = 80 + 12 = 92',
    gen() { const a = ri(21, 79), b = ri(11, 99 - a), t = Math.floor(a / 10) * 10 + Math.floor(b / 10) * 10, o = a % 10 + b % 10; return { q: `${a} + ${b}`, a: a + b, why: `十位 ${Math.floor(a / 10) * 10} + ${Math.floor(b / 10) * 10} = ${t}，個位 ${a % 10} + ${b % 10} = ${o}，${t} + ${o} = ${a + b}` }; } },
  { id: 'pair100', ch: 'A', grade: 2, title: '湊整結合', rule: '連加時先找能湊成整十、整百的兩個數。', ex: '25 + 38 + 75 → (25 + 75) + 38 = 138',
    gen() { const p = pick([25, 35, 45, 64, 72, 18, 37, 81]), r = ri(11, 89); return { q: `${p} + ${r} + ${100 - p}`, a: 100 + r, why: `先把 ${p} 和 ${100 - p} 湊成 100，再加 ${r} 得 ${100 + r}` }; } },
  { id: 'gauss', ch: 'A', grade: 3, title: '首尾配對（高斯求和）', rule: '連續的數相加：（第一個 + 最後一個）× 個數 ÷ 2。', ex: '1 + 2 + … + 10 → (1 + 10) × 10 ÷ 2 = 55',
    gen() { const s = ri(1, 9), n = pick([10, 20]), l = s + n - 1, a = (s + l) * n / 2; return { q: `${s} + ${s + 1} + ${s + 2} + … + ${l}`, a, why: `一共 ${n} 個數，首尾配對：(${s} + ${l}) × ${n} ÷ 2 = ${a}` }; } },
  { id: 'baseAdd', ch: 'A', grade: 3, title: '基準數法', rule: '幾個數都接近同一個數：用它當基準，再加減差多少。', ex: '98 + 102 + 97 + 103 → 100 × 4 + (−2 + 2 − 3 + 3) = 400',
    gen() { const base = pick([50, 100, 200]), off = Array.from({ length: 5 }, () => ri(-4, 4)), nums = off.map(o => base + o), d = off.reduce((s, o) => s + o, 0); return { q: nums.join(' + '), a: base * 5 + d, why: `都接近 ${base}：${base} × 5 = ${base * 5}，差加起來 ${off.map(o => (o >= 0 ? '+' : '') + o).join(' ')} = ${d}，答案 ${base * 5 + d}` }; } },
  { id: 'repeatAdd', ch: 'A', grade: 2, title: '同數連加變乘法', rule: '同一個數加好幾次，用乘法一次算完。', ex: '12 + 12 + 12 + 12 → 12 × 4 = 48',
    gen() { const n = ri(11, 25), k = ri(3, 6); return { q: Array(k).fill(n).join(' + '), a: n * k, why: `${k} 個 ${n} 相加 = ${n} × ${k} = ${n * k}` }; } },
  { id: 'leftAdd', ch: 'A', grade: 3, title: '從左往右加', rule: '三位數加三位數：先加百位、再加十位、最後個位，邊加邊記。', ex: '345 + 278 → 500 + 110 + 13 = 623',
    gen() { const a = ri(101, 499), b = ri(101, 499), h = (Math.floor(a / 100) + Math.floor(b / 100)) * 100, t = (Math.floor(a / 10) % 10 + Math.floor(b / 10) % 10) * 10, o = a % 10 + b % 10; return { q: `${a} + ${b}`, a: a + b, why: `百位 ${h}、十位 ${t}、個位 ${o}，${h} + ${t} + ${o} = ${a + b}` }; } },
  // ── B 減法速算 ──
  { id: 'break10', ch: 'B', grade: 1, title: '破十法', rule: '個位不夠減：從 10 裡面減，再加上個位。', ex: '13 − 8 → 10 − 8 = 2，2 + 3 = 5',
    gen() { const u = ri(1, 8), b = ri(u + 1, 9), a = 10 + u; return { q: `${a} − ${b}`, a: a - b, why: `${a} 拆成 10 和 ${u}：10 − ${b} = ${10 - b}，再加 ${u} 得 ${a - b}` }; } },
  { id: 'subRound', ch: 'B', grade: 2, title: '減整再加', rule: '減的數接近整十、整百：先減整數，多減的再加回來。', ex: '534 − 98 → 534 − 100 + 2 = 436',
    gen() { const x = ri(300, 900), y = pick([9, 19, 29, 39, 98, 99, 198]), n = y % 100 >= 90 ? Math.ceil(y / 100) * 100 : Math.ceil(y / 10) * 10, d = n - y; return { q: `${x} − ${y}`, a: x - y, why: `${y} 看成 ${n} − ${d}：${x} − ${n} = ${x - n}，再加回 ${d} 得 ${x - y}` }; } },
  { id: 'complement', ch: 'B', grade: 3, title: '補數法（整百整千減一個數）', rule: '前面每一位用 9 去減，最後一位用 10 去減。', ex: '1000 − 648 → 9−6、9−4、10−8 → 352',
    gen() { const base = pick([100, 1000]), len = String(base).length - 1; let y = ri(Math.max(11, base / 10 + 1), base - 1); if (y % 10 === 0) y += 1; const ds = String(y).padStart(len, '0').split('').map(Number), r = ds.map((d, i) => i < len - 1 ? 9 - d : 10 - d);
      return { q: `${base} − ${y}`, a: base - y, why: `把 ${y} 寫成 ${ds.join('')}：${ds.map((d, i) => i < len - 1 ? `9−${d}` : `10−${d}`).join('、')} → ${r.join('')}，答案 ${base - y}` }; } },
  { id: 'subSum', ch: 'B', grade: 3, title: '連減變減和', rule: '連續減兩個數，等於減去它們的和；先湊成整數。', ex: '500 − 23 − 77 → 500 − (23 + 77) = 400',
    gen() { const x = pick([200, 300, 500, 1000]), a = ri(11, 89); return { q: `${x} − ${a} − ${100 - a}`, a: x - 100, why: `${a} + ${100 - a} = 100，${x} − 100 = ${x - 100}` }; } },
  { id: 'sameShift', ch: 'B', grade: 3, title: '同加同減，差不變', rule: '被減數和減數同時加（或減）同一個數，差不變；把減數變成整十。', ex: '85 − 29 → 86 − 30 = 56',
    gen() { const b = ri(2, 6) * 10 + pick([7, 8, 9]), a = ri(b + 12, 99), d = 10 - b % 10; return { q: `${a} − ${b}`, a: a - b, why: `兩個數同時加 ${d}：${a + d} − ${b + d} = ${a - b}` }; } },
  { id: 'countUp', ch: 'B', grade: 2, title: '往上數（減法變加法）', rule: '從小的數往上數到大的數：先數到整十，再數到目標。', ex: '62 − 37 → 37 到 40 是 3，40 到 62 是 22，共 25',
    gen() { let b = ri(21, 69); if (b % 10 === 0) b += 3; const a = ri(b + 11, 99), c = Math.ceil(b / 10) * 10; return { q: `${a} − ${b}`, a: a - b, why: `${b} 到 ${c} 是 ${c - b}，${c} 到 ${a} 是 ${a - c}，共 ${a - b}` }; } },
  // ── C 乘以特殊數 ──
  { id: 'x9', ch: 'C', grade: 3, title: '乘 9：乘 10 再減一次', rule: '× 9 = × 10 − 自己。', ex: '23 × 9 → 230 − 23 = 207',
    gen() { const n = ri(12, 99); return { q: `${n} × 9`, a: n * 9, why: `${n} × 10 = ${n * 10}，再減 ${n} 得 ${n * 9}` }; } },
  { id: 'x11', ch: 'C', grade: 3, title: '乘 11：兩頭一拉，中間相加', rule: '兩位數 × 11：兩個數字拉開，中間放它們的和；滿十往前進位。', ex: '25 × 11 → 2_(2+5)_5 = 275；88 × 11 = 968',
    gen() { const n = ri(12, 98), a = Math.floor(n / 10), b = n % 10, s = a + b; return { q: `${n} × 11`, a: n * 11, why: s < 10 ? `${a} 和 ${b} 拉開，中間放 ${a} + ${b} = ${s}：${a}${s}${b}` : `中間 ${a} + ${b} = ${s} 滿十，寫 ${s % 10} 並把 ${a} 進位成 ${a + 1}：${n * 11}` }; } },
  { id: 'x5', ch: 'C', grade: 3, title: '乘 5：乘 10 再除以 2', rule: '× 5 = × 10 ÷ 2。', ex: '46 × 5 → 460 ÷ 2 = 230',
    gen() { const n = ri(12, 98); return { q: `${n} × 5`, a: n * 5, why: `${n} × 10 = ${n * 10}，÷ 2 = ${n * 5}` }; } },
  { id: 'x25', ch: 'C', grade: 4, title: '乘 25：乘 100 再除以 4', rule: '× 25 = × 100 ÷ 4。', ex: '36 × 25 → 3600 ÷ 4 = 900',
    gen() { const n = 4 * ri(3, 24); return { q: `${n} × 25`, a: n * 25, why: `${n} ÷ 4 = ${n / 4}，再乘 100 = ${n * 25}` }; } },
  { id: 'x125', ch: 'C', grade: 5, title: '乘 125：乘 1000 再除以 8', rule: '× 125 = × 1000 ÷ 8。', ex: '48 × 125 → 48 ÷ 8 = 6，6 × 1000 = 6000',
    gen() { const n = 8 * ri(2, 12); return { q: `${n} × 125`, a: n * 125, why: `${n} ÷ 8 = ${n / 8}，再乘 1000 = ${n * 125}` }; } },
  { id: 'x99', ch: 'C', grade: 4, title: '乘 99：乘 100 再減一次', rule: '× 99 = × 100 − 自己。', ex: '37 × 99 → 3700 − 37 = 3663',
    gen() { const n = ri(12, 98); return { q: `${n} × 99`, a: n * 99, why: `${n} × 100 = ${n * 100}，再減 ${n} 得 ${n * 99}` }; } },
  { id: 'x101', ch: 'C', grade: 4, title: '乘 101：寫兩次', rule: '兩位數 × 101，就是把這個數連寫兩次。', ex: '47 × 101 = 4747',
    gen() { const n = ri(12, 98); return { q: `${n} × 101`, a: n * 101, why: `把 ${n} 連寫兩次：${n}${p2(n)} = ${n * 101}` }; } },
  { id: 'x15', ch: 'C', grade: 4, title: '乘 15：乘 10 再加一半', rule: '× 15 = × 10 + 它的一半。', ex: '24 × 15 → 240 + 120 = 360',
    gen() { const n = 2 * ri(6, 40); return { q: `${n} × 15`, a: n * 15, why: `${n} × 10 = ${n * 10}，一半是 ${n * 5}，${n * 10} + ${n * 5} = ${n * 15}` }; } },
  { id: 'finger9', ch: 'C', grade: 2, title: '九九乘法的手指算', rule: '9 × 幾：十根手指彎下第幾根，左邊幾根是十位、右邊幾根是個位。', ex: '9 × 7 → 彎第 7 根，左邊 6、右邊 3 → 63',
    gen() { const n = ri(2, 10); return { q: `9 × ${n}`, a: 9 * n, why: `彎下第 ${n} 根手指：左邊 ${n - 1} 根（十位）、右邊 ${10 - n} 根（個位）→ ${9 * n}` }; } },
  // ── D 兩位數乘法妙招 ──
  { id: 'headSame', ch: 'D', grade: 4, title: '頭同尾合十', rule: '十位相同、個位加起來是 10：頭 ×（頭 + 1）接在前面，尾 × 尾寫兩位接在後面。', ex: '23 × 27 → 2 × 3 = 6、3 × 7 = 21 → 621',
    gen() { const t = ri(1, 9), u = ri(1, 9), v = 10 - u, a = (10 * t + u) * (10 * t + v); return { q: `${t}${u} × ${t}${v}`, a, why: `頭 ${t} × ${t + 1} = ${t * (t + 1)}，尾 ${u} × ${v} = ${p2(u * v)} → ${a}` }; } },
  { id: 'tailSame', ch: 'D', grade: 5, title: '尾同頭合十', rule: '個位相同、十位加起來是 10：頭 × 頭 + 尾 接在前面，尾 × 尾寫兩位接在後面。', ex: '48 × 68 → 4 × 6 + 8 = 32、8 × 8 = 64 → 3264',
    gen() { const u = ri(1, 9), a1 = ri(1, 9), b1 = 10 - a1, a = (10 * a1 + u) * (10 * b1 + u); return { q: `${a1}${u} × ${b1}${u}`, a, why: `頭 ${a1} × ${b1} + ${u} = ${a1 * b1 + u}，尾 ${u} × ${u} = ${p2(u * u)} → ${a}` }; } },
  { id: 'teens', ch: 'D', grade: 4, title: '十幾乘十幾', rule: '一個數加上另一個數的個位，乘 10，再加上兩個個位的積。', ex: '13 × 14 → (13 + 4) × 10 + 3 × 4 = 182',
    gen() { const a = ri(11, 19), b = ri(11, 19), u = a % 10, v = b % 10; return { q: `${a} × ${b}`, a: a * b, why: `(${a} + ${v}) × 10 = ${(a + v) * 10}，再加 ${u} × ${v} = ${u * v}，答案 ${a * b}` }; } },
  { id: 'ones1', ch: 'D', grade: 5, title: '幾十一乘幾十一', rule: '個位都是 1：十位相乘放百位、十位相加放十位、個位寫 1（滿十進位）。', ex: '31 × 41 → 3 × 4 = 12、3 + 4 = 7、1 → 1271',
    gen() { const a = ri(2, 9), b = ri(2, 9), ans = (10 * a + 1) * (10 * b + 1); return { q: `${a}1 × ${b}1`, a: ans, why: `${a} × ${b} = ${a * b} 當百位、${a} + ${b} = ${a + b} 當十位、個位 1：${a * b} × 100 + ${a + b} × 10 + 1 = ${ans}` }; } },
  { id: 'sq5', ch: 'D', grade: 4, title: '個位是 5 的平方', rule: '十位 ×（十位 + 1），後面接 25。', ex: '35 × 35 → 3 × 4 = 12，接 25 → 1225',
    gen() { const t = ri(1, 9), a = (10 * t + 5) ** 2; return { q: `${t}5 × ${t}5`, a, why: `${t} × ${t + 1} = ${t * (t + 1)}，後面接 25 → ${a}` }; } },
  { id: 'near100', ch: 'D', grade: 5, title: '接近 100 的兩個數相乘', rule: '都比 100 少一點：前面是「一個數 − 另一個的差」，後面是兩個差相乘（寫兩位）。', ex: '97 × 96 → 97 − 4 = 93、3 × 4 = 12 → 9312',
    gen() { const a = ri(91, 99), b = ri(91, 99), da = 100 - a, db = 100 - b, ans = a * b; return { q: `${a} × ${b}`, a: ans, why: `差 ${da} 和 ${db}：${a} − ${db} = ${a - db}，${da} × ${db} = ${p2(da * db)} → ${ans}` }; } },
  { id: 'halfDouble', ch: 'D', grade: 4, title: '加倍減半', rule: '一個數減半、另一個加倍，積不變；把 5 結尾的數變成整十。', ex: '14 × 35 → 7 × 70 = 490',
    gen() { const a = 2 * ri(6, 24), b = pick([15, 25, 35, 45]); return { q: `${a} × ${b}`, a: a * b, why: `${a} 減半是 ${a / 2}、${b} 加倍是 ${b * 2}：${a / 2} × ${b * 2} = ${a * b}` }; } },
  { id: 'distribute', ch: 'D', grade: 4, title: '拆數相乘（分配律）', rule: '把兩位數拆成整十和個位，分別乘再加起來。', ex: '7 × 28 → 7 × 20 + 7 × 8 = 140 + 56 = 196',
    gen() { const a = ri(3, 9), b = ri(21, 98), t = Math.floor(b / 10) * 10, o = b % 10; return { q: `${a} × ${b}`, a: a * b, why: `${b} 拆成 ${t} + ${o}：${a} × ${t} = ${a * t}，${a} × ${o} = ${a * o}，加起來 ${a * b}` }; } },
  { id: 'pairMul', ch: 'D', grade: 4, title: '湊整結合（乘法）', rule: '連乘時先找好朋友：4 × 25 = 100、8 × 125 = 1000、2 × 50 = 100。', ex: '4 × 37 × 25 → (4 × 25) × 37 = 3700',
    gen() { const [p, q] = pick([[4, 25], [8, 125], [2, 50], [5, 20]]), r = ri(13, 49); return { q: `${p} × ${r} × ${q}`, a: p * q * r, why: `先算 ${p} × ${q} = ${p * q}，再乘 ${r} = ${p * q * r}` }; } },
  // ── E 除法速算 ──
  { id: 'd5', ch: 'E', grade: 4, title: '除以 5：乘 2 再除以 10', rule: '÷ 5 = × 2 ÷ 10。', ex: '135 ÷ 5 → 270 ÷ 10 = 27',
    gen() { const q = ri(13, 99), n = q * 5; return { q: `${n} ÷ 5`, a: q, why: `${n} × 2 = ${n * 2}，÷ 10 = ${q}` }; } },
  { id: 'd25', ch: 'E', grade: 5, title: '除以 25：乘 4 再除以 100', rule: '÷ 25 = × 4 ÷ 100。', ex: '675 ÷ 25 → 2700 ÷ 100 = 27',
    gen() { const q = ri(5, 40), n = q * 25; return { q: `${n} ÷ 25`, a: q, why: `${n} × 4 = ${n * 4}，÷ 100 = ${q}` }; } },
  { id: 'd125', ch: 'E', grade: 5, title: '除以 125：乘 8 再除以 1000', rule: '÷ 125 = × 8 ÷ 1000。', ex: '3000 ÷ 125 → 24000 ÷ 1000 = 24',
    gen() { const q = ri(2, 24), n = q * 125; return { q: `${n} ÷ 125`, a: q, why: `${n} × 8 = ${n * 8}，÷ 1000 = ${q}` }; } },
  { id: 'quotient', ch: 'E', grade: 4, title: '商不變（同乘同除）', rule: '被除數和除數同時乘（或除以）同一個數，商不變；把除數變整十。', ex: '360 ÷ 15 → 720 ÷ 30 = 24',
    gen() { const b = pick([15, 35, 45]), q = ri(4, 30), n = b * q; return { q: `${n} ÷ ${b}`, a: q, why: `兩個數同時乘 2：${n * 2} ÷ ${b * 2} = ${q}` }; } },
  { id: 'splitDiv', ch: 'E', grade: 4, title: '拆開被除數', rule: '把被除數拆成好除的兩塊，分別除再加起來。', ex: '156 ÷ 12 → 120 ÷ 12 + 36 ÷ 12 = 10 + 3 = 13',
    gen() { const b = ri(6, 15), q = ri(11, 29), n = b * q, t = Math.floor(q / 10) * 10, big = b * t; return { q: `${n} ÷ ${b}`, a: q, why: `${n} 拆成 ${big} + ${n - big}：${big} ÷ ${b} = ${t}，${n - big} ÷ ${b} = ${q - t}，共 ${q}` }; } },
  { id: 'cast9', ch: 'E', grade: 5, title: '棄九法（除以 9 的餘數）', rule: '一個數除以 9 的餘數，等於它的各位數字和除以 9 的餘數。', ex: '583 → 5 + 8 + 3 = 16，16 除以 9 餘 7',
    gen() { const n = ri(100, 9999), s = sumDigits(n), r = n % 9; return { q: `${n} ÷ 9 的餘數是多少？`, a: r, wrongs: [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(x => x !== r), why: `各位數字相加 ${String(n).split('').join(' + ')} = ${s}，${s} 除以 9 餘 ${s % 9}` }; } },
  // ── F 整除與驗算 ──
  { id: 'div3', ch: 'F', grade: 5, title: '被 3 整除', rule: '各位數字加起來是 3 的倍數，這個數就能被 3 整除（9 也一樣）。', ex: '471 → 4 + 7 + 1 = 12，能被 3 整除',
    gen() { const n = Math.random() < 0.5 ? 3 * ri(34, 333) : ri(100, 999), s = sumDigits(n), ok = n % 3 === 0; return { q: `${n} 能不能被 3 整除？`, a: ok ? '能' : '不能', wrongs: [ok ? '不能' : '能'], why: `各位數字和 ${s}，${ok ? '是' : '不是'} 3 的倍數，所以${ok ? '能' : '不能'}` }; } },
  { id: 'div48', ch: 'F', grade: 5, title: '被 4、8 整除', rule: '被 4 整除看末兩位、被 8 整除看末三位。', ex: '5316 → 16 是 4 的倍數，能被 4 整除',
    gen() { const d = pick([4, 8]), k = d === 4 ? 2 : 3, n = Math.random() < 0.5 ? d * ri(125, 1249) : ri(1000, 9999), last = n % (10 ** k), ok = n % d === 0; return { q: `${n} 能不能被 ${d} 整除？`, a: ok ? '能' : '不能', wrongs: [ok ? '不能' : '能'], why: `看末 ${k} 位 ${String(last).padStart(k, '0')}：${ok ? '是' : '不是'} ${d} 的倍數，所以${ok ? '能' : '不能'}` }; } },
  { id: 'div11', ch: 'F', grade: 5, title: '被 11 整除', rule: '從右邊數，奇數位的和減偶數位的和，差是 11 的倍數（含 0）就能被 11 整除。', ex: '2475 → (5 + 4) − (7 + 2) = 0，能被 11 整除',
    gen() { const n = Math.random() < 0.5 ? 11 * ri(91, 909) : ri(1000, 9999), ds = String(n).split('').reverse().map(Number), odd = ds.filter((_, i) => i % 2 === 0).reduce((s, d) => s + d, 0), even = ds.filter((_, i) => i % 2 === 1).reduce((s, d) => s + d, 0), ok = n % 11 === 0;
      return { q: `${n} 能不能被 11 整除？`, a: ok ? '能' : '不能', wrongs: [ok ? '不能' : '能'], why: `奇數位和 ${odd}、偶數位和 ${even}，差 ${odd - even}${ok ? ' 是' : ' 不是'} 11 的倍數，所以${ok ? '能' : '不能'}` }; } },
  { id: 'estimate', ch: 'F', grade: 5, title: '估算驗算', rule: '先把數字取成整十、整百估一下，答案差太多就是算錯了。', ex: '498 × 21 ≈ 500 × 20 = 10000',
    gen() { const A = ri(2, 9) * 100, B = ri(2, 9) * 10, a = A + pick([-2, -1, 1, 2]), b = B + pick([-1, 1]), e = A * B; return { q: `${a} × ${b} 大約是多少？`, a: e, wrongs: [e * 10, e / 10, e + A, e - A * 2].filter(x => x > 0 && Number.isInteger(x)), why: `${a} ≈ ${A}、${b} ≈ ${B}，${A} × ${B} = ${e}` }; } },
  // ── G 分數與百分比 ──
  { id: 'pctSwap', ch: 'G', grade: 6, title: '百分比對調', rule: 'x% 的 y = y% 的 x：哪一邊好算就算哪一邊。', ex: '8% 的 50 = 50% 的 8 = 4',
    gen() { const n = pick([25, 50]), p = pick(n === 50 ? [4, 6, 8, 12, 14, 18, 22] : [4, 8, 12, 16, 20, 24, 36]), a = p * n / 100; return { q: `${p}% 的 ${n} 是多少？`, a, why: `${p}% 的 ${n} = ${n}% 的 ${p} = ${p} 的${n === 50 ? '一半' : '四分之一'} = ${a}` }; } },
  { id: 'crossCmp', ch: 'G', grade: 6, title: '交叉相乘比大小', rule: '比較 a/b 和 c/d：算 a × d 和 c × b，比較大的那邊分數比較大。', ex: '3/5 和 4/7 → 3 × 7 = 21、4 × 5 = 20，3/5 比較大',
    gen() { let a, b, c, d; do { b = ri(3, 9); d = ri(3, 9); a = ri(1, b - 1); c = ri(1, d - 1); } while (b === d || a * d === c * b); const L = `${a}/${b}`, Rr = `${c}/${d}`, big = a * d > c * b ? L : Rr; return { q: `${L} 和 ${Rr} 哪個比較大？`, a: big, wrongs: [big === L ? Rr : L, '一樣大'], why: `交叉相乘：${a} × ${d} = ${a * d}、${c} × ${b} = ${c * b}，所以 ${big} 比較大` }; } },
];
TRICKS.forEach((t, i) => { t.no = i + 1; });
export const trickById = id => TRICKS.find(t => t.id === id) || null;
export const tricksOf = ch => TRICKS.filter(t => t.ch === ch);
export const chapterById = id => CHAPTERS.find(c => c.id === id) || null;
// 數字答案的錯誤選項：差 1、差 10、差 100、個位或十位寫錯，都是小學生常見的錯
export function distractors(a, n = 3) { const out = new Set(); const cand = [a + 10, a - 10, a + 1, a - 1, a + 2, a - 2, a + 9, a - 9, ...(a >= 100 ? [a + 100, a - 100] : [a * 10])];
  if (a >= 10) { const s = String(a); cand.push(+(s.slice(0, -2) + s.slice(-1) + s.slice(-2, -1))); }
  for (const c of cand.sort(() => Math.random() - 0.5)) { if (c >= 0 && c !== a && Number.isInteger(c)) out.add(c); if (out.size >= n) break; } return [...out]; }
// 出一題：key 可以是招式代號，或章節代號（A～G，隨機挑那一章的一招）
export function speedQuestion(key, grade) { const pool = chapterById(key) ? tricksOf(key) : trickById(key) ? [trickById(key)] : TRICKS.filter(t => t.grade <= (grade || 6)); const t = pick(pool.length ? pool : TRICKS); const g = t.gen();
  return { trick: t, q: /？$/.test(g.q) ? g.q : `${g.q} = ？`, a: g.a, wrongs: g.wrongs || distractors(g.a), why: `【第 ${t.no} 招・${t.title}】${g.why}` }; }
// 某個年級可以練的章節（章節的建議年級不超過這個年級）
export const chaptersForGrade = g => CHAPTERS.filter(c => c.grade <= Math.max(1, g || 1));
