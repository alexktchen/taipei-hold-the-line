/* 解題：國小 1～6 年級的題庫（四選一）與解題視窗。
   題目兩種來源：數學類用產生器（每次數字都不一樣），其他科目用手寫題庫（依單元主題 topic）。
   makeQuestion(topic, grade) → { q, choices, a, why }；a 是正確選項的索引（choices 已洗牌）。
   createQuizUI() → ask({ topic, grade, title, mode }) 回傳 Promise<true 答對／false 答錯／null 關掉>。 */
import { CONFIG as C } from './config.js';
import { speedQuestion, chaptersForGrade } from './speedmath.js';
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
// 數字題的錯誤選項：答案附近、不重複、不是負數
function numChoices(ans, spread = 3, fmt = v => String(v)) { const set = new Set([ans]); let guard = 0; while (set.size < C.quiz.choices && guard++ < 50) { const d = ri(-spread, spread) || 1; const v = ans + d; if (v >= 0) set.add(v); } while (set.size < C.quiz.choices) set.add(ans + set.size * 2); return finish([...set].map(v => [fmt(v), v === ans])); }
function finish(pairs) { const list = shuffle(pairs); return { choices: list.map(p => p[0]), a: list.findIndex(p => p[1]) }; }
function textChoices(ans, wrongs) { const w = shuffle([...new Set(wrongs.filter(x => x !== ans))]).slice(0, C.quiz.choices - 1); return finish([[ans, true], ...w.map(x => [x, false])]); }
const nice = v => Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);

// ── 數學產生器 ──
const GEN = {
  add10() { if (Math.random() < 0.5) { const a = ri(1, 9), b = ri(1, 10 - a); return { q: `${a} + ${b} = ？`, ...numChoices(a + b, 2), why: `${a} 和 ${b} 合起來是 ${a + b}。` }; } const a = ri(2, 10), b = ri(1, a); return { q: `${a} − ${b} = ？`, ...numChoices(a - b, 2), why: `${a} 拿走 ${b} 還剩 ${a - b}。` }; },
  add20() { if (Math.random() < 0.6) { const a = ri(5, 9), b = ri(11 - a, 9); return { q: `${a} + ${b} = ？`, ...numChoices(a + b, 2), why: `湊十：${a} + ${10 - a} = 10，再加 ${b - (10 - a)} 得 ${a + b}。` }; } const a = ri(11, 18), b = ri(2, 9); return { q: `${a} − ${b} = ？`, ...numChoices(a - b, 2), why: `先減到 10：${a} − ${a - 10} = 10，再減 ${b - (a - 10)} 得 ${a - b}。` }; },
  times() { const a = ri(2, 9), b = ri(2, 9); return { q: `${a} × ${b} = ？`, ...numChoices(a * b, 4), why: `${a} 個 ${b} 加起來是 ${a * b}。` }; },
  divide() { if (Math.random() < 0.6) { const b = ri(2, 9), c = ri(2, 9); return { q: `${b * c} ÷ ${b} = ？`, ...numChoices(c, 2), why: `因為 ${b} × ${c} = ${b * c}。` }; } const b = ri(3, 9), c = ri(2, 8), r = ri(1, b - 1); return { q: `${b * c + r} ÷ ${b} 的餘數是多少？`, ...numChoices(r, 2), why: `${b} × ${c} = ${b * c}，${b * c + r} − ${b * c} = ${r}，餘數 ${r} 比除數 ${b} 小。` }; },
  clock() { const h = ri(1, 12), m = pick([0, 5, 10, 15, 20, 30, 40, 45, 50]); const mm = String(m).padStart(2, '0'); if (Math.random() < 0.5) return { q: m === 0 ? `時針剛好指著 ${h}，分針指著 12，現在幾點幾分？` : `時針在 ${h} 和 ${h % 12 + 1} 之間，分針指著 ${m / 5}，現在幾點幾分？`, ...textChoices(`${h}:${mm}`, [`${h}:${String((m + 5) % 60).padStart(2, '0')}`, `${h % 12 + 1}:${mm}`, `${h}:${String(m / 5).padStart(2, '0')}`, `${m / 5 || 12}:${String(h * 5).padStart(2, '0')}`]), why: `分針走一大格是 5 分鐘，指著 ${m / 5 || 12} 就是 ${m} 分。` };
    const add = pick([15, 30, 45, 60, 90]); const t = h * 60 + m + add, h2 = Math.floor(t / 60) % 12 || 12, m2 = t % 60; return { q: `現在 ${h}:${mm}，再過 ${add >= 60 ? `${Math.floor(add / 60)} 小時` + (add % 60 ? ` ${add % 60} 分` : '') : add + ' 分鐘'}是幾點幾分？`, ...textChoices(`${h2}:${String(m2).padStart(2, '0')}`, [`${h2}:${String((m2 + 30) % 60).padStart(2, '0')}`, `${h2 % 12 + 1}:${String(m2).padStart(2, '0')}`, `${h}:${String((m + 15) % 60).padStart(2, '0')}`]), why: `一小時 = 60 分鐘，加上去再換算就好。` }; },
  measure() { const k = Math.random(); if (k < 0.4) { const m = ri(1, 9); return { q: `${m} 公尺 = ？ 公分`, ...textChoices(`${m * 100}`, [`${m * 10}`, `${m * 1000}`, `${m + 100}`]), why: `1 公尺 = 100 公分。` }; } if (k < 0.7) { const a = ri(10, 60), b = ri(10, 60); return { q: `${a} 公分 + ${b} 公分 = ？ 公分`, ...numChoices(a + b, 5), why: `同樣是公分，直接相加。` }; } const items = [['鉛筆', 18, '公分'], ['教室的門', 2, '公尺'], ['課本', 26, '公分'], ['橡皮擦', 4, '公分'], ['操場跑道一圈', 200, '公尺']]; const [n, v, u] = pick(items); return { q: `${n}的長度大約是多少？`, ...textChoices(`${v} ${u}`, [`${v} ${u === '公分' ? '公尺' : '公分'}`, `${v * 10} ${u}`, `${Math.max(1, Math.round(v / 10))} ${u}`]), why: `用身邊的東西估一估：${n}大約 ${v} ${u}。` }; },
  fraction() { const k = Math.random(); if (k < 0.35) { const d = ri(3, 9), a = ri(1, d - 1), b = ri(1, d - 1); if (a === b) return GEN.fraction(); return { q: `${a}/${d} 和 ${b}/${d}，哪個比較大？`, ...textChoices(`${Math.max(a, b)}/${d}`, [`${Math.min(a, b)}/${d}`, '一樣大', `${d}/${Math.max(a, b)}`]), why: `分母一樣時，分子大的比較大。` }; } if (k < 0.7) { const d = ri(3, 9), a = ri(1, d - 2), b = ri(1, d - 1 - a); return { q: `${a}/${d} + ${b}/${d} = ？`, ...textChoices(`${a + b}/${d}`, [`${a + b}/${d * 2}`, `${a * b}/${d}`, `${a + b + 1}/${d}`]), why: `同分母相加，分子相加、分母不變。` }; } const n = ri(1, 4), m = ri(2, 4); return { q: `${n}/${n * m} 約分後是多少？`, ...textChoices(`1/${m}`, [`${n}/${m}`, `1/${m + 1}`, `${m}/1`]), why: `分子分母同時除以 ${n}。` }; },
  bignum() { const k = Math.random(); if (k < 0.4) { const w = ri(1, 9), q = ri(0, 9), h = ri(0, 9); const num = w * 10000 + q * 1000 + h * 100; const cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']; const txt = `${cn[w]}萬${q ? cn[q] + '千' : ''}${h ? (q ? '' : '零') + cn[h] + '百' : ''}`; return { q: `「${txt}」用數字寫是多少？`, ...textChoices(String(num), [String(num / 10), String(num * 10), String(w * 1000 + q * 100 + h * 10)]), why: `一萬是 10000，有 5 位數。` }; } if (k < 0.75) { const a = ri(12, 49), b = ri(3, 9); return { q: `${a} × ${b} = ？`, ...numChoices(a * b, 10), why: `拆開算：${Math.floor(a / 10) * 10} × ${b} = ${Math.floor(a / 10) * 10 * b}，${a % 10} × ${b} = ${(a % 10) * b}，加起來 ${a * b}。` }; } const a = ri(2, 9), b = ri(2, 9), c = ri(2, 5); return { q: `(${a} + ${b}) × ${c} = ？`, ...numChoices((a + b) * c, 6), why: `括號先算：${a} + ${b} = ${a + b}，再乘 ${c}。` }; },
  decimal() { const k = Math.random(); if (k < 0.35) { const a = ri(1, 9) / 10 + ri(0, 5), b = ri(1, 9) / 10 + ri(0, 5); const s = Math.round((a + b) * 10) / 10; return { q: `${nice(a)} + ${nice(b)} = ？`, ...textChoices(nice(s), [nice(s + 1), nice(s - 0.1), nice(Math.round((a + b) * 100) / 10)]), why: `小數點對齊再相加。` }; } if (k < 0.7) { const a = ri(11, 49) / 10, b = ri(2, 5); const s = Math.round(a * b * 10) / 10; return { q: `${nice(a)} × ${b} = ？`, ...textChoices(nice(s), [nice(s * 10), nice(s + 1), nice(Math.round((a + b) * 10) / 10)]), why: `先當整數算 ${Math.round(a * 10)} × ${b} = ${Math.round(a * 10) * b}，再點回一位小數。` }; } const d1 = pick([2, 3, 4, 5, 6]), d2 = pick([2, 3, 4, 5, 6].filter(x => x !== d1)); const l = lcm(d1, d2), s = l / d1 + l / d2; return { q: `1/${d1} + 1/${d2} = ？`, ...textChoices(frac(s, l), [`2/${d1 + d2}`, `1/${d1 * d2}`, frac(s + 1, l)]), why: `通分成分母 ${l}：${l / d1}/${l} + ${l / d2}/${l}。` }; },
  ratio() { const k = Math.random(); if (k < 0.35) { const g = ri(2, 6), a = ri(1, 5), b = ri(1, 5); if (a === b) return GEN.ratio(); return { q: `${a * g}：${b * g} 化成最簡整數比是？`, ...textChoices(`${a}：${b}`, [`${b}：${a}`, `${a * g}：${b}`, `${a + 1}：${b + 1}`]), why: `前項、後項同時除以 ${g}。` }; } if (k < 0.7) { const p = pick([10, 20, 25, 50, 75]), n = pick([40, 80, 120, 200, 400]); return { q: `${n} 的 ${p}% 是多少？`, ...numChoices(n * p / 100, 10), why: `${p}% = ${p}/100，${n} × ${p / 100} = ${n * p / 100}。` }; } const v = ri(3, 9) * 10, t = ri(2, 5); return { q: `騎腳踏車 ${t} 小時走了 ${v * t} 公里，速率是每小時幾公里？`, ...numChoices(v, 10), why: `速率 = 距離 ÷ 時間 = ${v * t} ÷ ${t}。` }; },
  geometry() { const k = Math.random(); if (k < 0.3) { const a = ri(3, 12), b = ri(3, 12); return { q: `長 ${a} 公分、寬 ${b} 公分的長方形，面積是幾平方公分？`, ...numChoices(a * b, 8), why: `長方形面積 = 長 × 寬。` }; } if (k < 0.55) { const a = ri(2, 10) * 2, b = ri(3, 12); return { q: `底 ${a} 公分、高 ${b} 公分的三角形，面積是幾平方公分？`, ...numChoices(a * b / 2, 6), why: `三角形面積 = 底 × 高 ÷ 2。` }; } if (k < 0.8) { const d = ri(1, 10) * 10; const c = Math.round(d * 3.14 * 100) / 100; return { q: `直徑 ${d} 公分的圓，圓周長大約是幾公分？（π 用 3.14）`, ...textChoices(nice(c), [nice(c / 2), nice(c * 2), nice(d * d * 3.14)]), why: `圓周長 = 直徑 × 3.14。` }; } const r = ri(1, 5); const a = Math.round(r * r * 3.14 * 100) / 100; return { q: `半徑 ${r} 公分的圓，面積大約是幾平方公分？（π 用 3.14）`, ...textChoices(nice(a), [nice(r * 2 * 3.14), nice(a * 2), nice(r * 3.14)]), why: `圓面積 = 半徑 × 半徑 × 3.14。` }; },
};
const gcd = (a, b) => b ? gcd(b, a % b) : a, lcm = (a, b) => a * b / gcd(a, b), frac = (n, d) => { const g = gcd(n, d); return `${n / g}/${d / g}`; };

// ── 手寫題庫：[題目, 正確答案, 錯誤選項…, 說明（可省略，用 ? 開頭）] ──
const W = (q, a, ...rest) => { const why = rest.length && rest[rest.length - 1].startsWith('?') ? rest.pop().slice(1) : ''; return { q, a, wrongs: rest, why }; };
const BANK = {
  shapes: [
    W('下面哪一個形狀沒有角？', '圓形', '三角形', '正方形', '長方形', '?圓形是圓的，一個角也沒有。'),
    W('三角形有幾個角？', '3 個', '2 個', '4 個', '5 個'),
    W('正方形有幾個邊？', '4 個', '3 個', '5 個', '6 個', '?而且 4 個邊一樣長。'),
    W('紅色和黃色混在一起會變成什麼顏色？', '橘色', '綠色', '紫色', '藍色'),
    W('藍色和黃色混在一起會變成什麼顏色？', '綠色', '橘色', '紫色', '紅色'),
    W('三原色是紅、黃和哪一個？', '藍', '綠', '橘', '黑'),
    W('🍎🍎🍎🍎 一共有幾顆蘋果？', '4 顆', '3 顆', '5 顆', '6 顆'),
    W('球是什麼形狀？', '圓形', '三角形', '正方形', '長方形'),
    W('哪一個東西通常是三角形？', '三明治切一半', '餅乾盒', '皮球', '門'),
    W('香蕉通常是什麼顏色？', '黃色', '藍色', '紫色', '黑色'),
  ],
  zhuyin: [
    W('「媽媽」的「媽」是第幾聲？', '一聲', '二聲', '三聲', '四聲'),
    W('「爸爸」的「爸」是第幾聲？', '四聲', '一聲', '二聲', '三聲'),
    W('「老師」的「老」是第幾聲？', '三聲', '一聲', '二聲', '四聲'),
    W('「貓」的注音是？', 'ㄇㄠ', 'ㄇㄨ', 'ㄋㄠ', 'ㄇㄢ'),
    W('「書」的注音是？', 'ㄕㄨ', 'ㄙㄨ', 'ㄕㄩ', 'ㄒㄩ'),
    W('下面哪一個是聲符？', 'ㄅ', 'ㄚ', 'ㄞ', 'ㄢ', '?ㄅㄆㄇㄈ是聲符，ㄚㄛㄜㄝ是韻符。'),
    W('下面哪一個是韻符？', 'ㄡ', 'ㄉ', 'ㄍ', 'ㄓ'),
    W('「ㄓ」要怎麼念？', '翹舌音「知」', '平舌音「資」', '「機」', '「西」'),
    W('「花」的注音是？', 'ㄏㄨㄚ', 'ㄈㄨㄚ', 'ㄏㄚ', 'ㄏㄨㄛ'),
    W('注音符號一共有幾個？', '37 個', '26 個', '30 個', '40 個'),
    W('「魚」的注音是？', 'ㄩˊ', 'ㄧㄡˊ', 'ㄨˊ', 'ㄩˇ'),
    W('「你好」的「好」是第幾聲？', '三聲', '一聲', '二聲', '四聲'),
  ],
  words1: [
    W('「一（　）狗」要用哪個量詞？', '隻', '本', '朵', '輛'),
    W('「一（　）書」要用哪個量詞？', '本', '隻', '朵', '條'),
    W('「一（　）花」要用哪個量詞？', '朵', '隻', '本', '輛'),
    W('「大」的相反詞是？', '小', '高', '多', '長'),
    W('「快」的相反詞是？', '慢', '高', '矮', '短'),
    W('「上」的相反詞是？', '下', '左', '前', '內'),
    W('寫字的筆順通常是？', '先上後下、先左後右', '先下後上', '先右後左', '隨便寫'),
    W('「河」「海」「江」都有哪個部首？', '水（氵）', '木', '火', '土'),
    W('「樹」「林」「桌」都有哪個部首？', '木', '水', '口', '人'),
    W('哪一個是完整的句子？', '小狗在草地上跑。', '小狗', '在草地上', '跑跑跑'),
    W('「一（　）車」要用哪個量詞？', '輛', '隻', '本', '朵'),
    W('「日」加「月」是哪個字？', '明', '晶', '昌', '朋'),
  ],
  sentence: [
    W('問句的最後要用哪個標點符號？', '？', '。', '，', '！'),
    W('句子說完了要用哪個標點符號？', '。', '，', '？', '、'),
    W('「紅色（　）花」要填哪個字？', '的', '得', '地', '了', '?「的」接名詞。'),
    W('「慢慢（　）走」要填哪個字？', '地', '的', '得', '了', '?「地」接動詞。'),
    W('「跑（　）很快」要填哪個字？', '得', '的', '地', '了', '?「得」接在動詞後面說明程度。'),
    W('哪一句最通順？', '我昨天和媽媽去公園玩。', '我和媽媽昨天去玩公園。', '昨天公園我去玩和媽媽。', '去公園我和媽媽玩昨天。'),
    W('「一（　）魚」要用哪個量詞？', '條', '本', '朵', '張'),
    W('「蘋果、香蕉、葡萄」中間要用哪個標點符號？', '、', '，', '。', '；', '?並列的東西用頓號「、」。'),
    W('「哇！好漂亮的煙火」最適合用哪個標點？', '！', '。', '？', '，'),
    W('把「小鳥唱歌」擴寫，哪一句最好？', '可愛的小鳥在樹上快樂地唱歌。', '小鳥唱歌唱歌。', '小鳥。唱歌。', '唱歌小鳥。'),
  ],
  eng1: [
    W('英文字母一共有幾個？', '26 個', '24 個', '30 個', '37 個'),
    W('「貓」的英文是？', 'cat', 'dog', 'pig', 'cow'),
    W('「狗」的英文是？', 'dog', 'cat', 'duck', 'fish'),
    W('「紅色」的英文是？', 'red', 'blue', 'green', 'yellow'),
    W('「three」是數字幾？', '3', '2', '5', '8'),
    W('「seven」是數字幾？', '7', '6', '9', '4'),
    W('下面哪一個是母音字母？', 'e', 'b', 'k', 't', '?母音有 a、e、i、o、u。'),
    W('「apple」的中文是？', '蘋果', '香蕉', '橘子', '葡萄'),
    W('「B」的小寫是？', 'b', 'd', 'p', 'q'),
    W('有人說 "Hello!" 你可以回？', 'Hello!', 'Apple!', 'Cat!', 'Blue!'),
    W('「黃色」的英文是？', 'yellow', 'green', 'black', 'white'),
    W('「ten」是數字幾？', '10', '1', '7', '2'),
  ],
  plants: [
    W('植物的哪個部位負責吸收水分、固定植物？', '根', '葉', '花', '果實'),
    W('植物的哪個部位會行光合作用製造養分？', '葉', '根', '種子', '莖'),
    W('種子發芽需要什麼？', '水、空氣和適當的溫度', '只要泥土', '只要太陽', '什麼都不用'),
    W('植物會朝有光的方向生長，這叫什麼？', '向光性', '向水性', '向地性', '向風性'),
    W('莖的工作是什麼？', '運送水分和養分', '製造種子', '吸收陽光發光', '抓住土壤'),
    W('植物開花之後通常會長出什麼？', '果實', '根', '新的葉子', '莖'),
    W('做自然觀察時最重要的是？', '每天記錄看到的變化', '猜一猜就好', '只看一次', '不用寫下來'),
    W('下面哪一個是植物的種子？', '綠豆', '石頭', '沙子', '貝殼'),
    W('葉子大多是綠色，是因為有什麼？', '葉綠素', '水分', '泥土', '空氣'),
  ],
  map: [
    W('一般地圖上，「上面」是哪個方向？', '北', '南', '東', '西'),
    W('一般地圖上，「右邊」是哪個方向？', '東', '西', '北', '南'),
    W('太陽從哪個方向升起？', '東', '西', '南', '北'),
    W('指北針的紅色指針指向哪裡？', '北方', '南方', '東方', '西方'),
    W('地圖上說明符號代表什麼的表格叫什麼？', '圖例', '比例尺', '方位', '經緯度'),
    W('比例尺 1：1000 的意思是？', '圖上 1 公分代表實際 1000 公分', '圖上 1 公分代表實際 1 公分', '實際 1 公分畫成 1000 公分', '地圖有 1000 頁'),
    W('面向北方時，你的右手邊是哪個方向？', '東', '西', '南', '北'),
    W('台灣的東邊是哪個海洋？', '太平洋', '台灣海峽', '印度洋', '大西洋'),
    W('太陽下山的方向是？', '西', '東', '南', '北'),
  ],
  water: [
    W('冰變成水的過程叫什麼？', '融化', '蒸發', '凝結', '凝固'),
    W('水變成水蒸氣的過程叫什麼？', '蒸發', '融化', '凝固', '凝結'),
    W('冷飲杯子外面的小水珠是怎麼來的？', '空氣中的水蒸氣凝結', '杯子漏水', '冰塊跑出來', '杯子流汗'),
    W('水在幾度 C 會結冰？', '0°C', '100°C', '50°C', '−100°C'),
    W('一般情況下水煮沸是幾度 C？', '100°C', '0°C', '50°C', '200°C'),
    W('水蒸氣是什麼樣子？', '看不見的氣體', '白色的煙', '透明的冰', '藍色的水'),
    W('水變成冰的過程叫什麼？', '凝固', '融化', '蒸發', '凝結'),
    W('固態、液態、氣態的水分別是？', '冰、水、水蒸氣', '水、冰、水蒸氣', '水蒸氣、水、冰', '冰、水蒸氣、水'),
    W('溼衣服晾在太陽下會乾，是因為水？', '蒸發了', '凝固了', '融化了', '不見了'),
  ],
  idiom: [
    W('「一舉兩得」的意思是？', '做一件事得到兩個好處', '舉起兩樣東西', '兩個人一起舉', '得到兩次機會'),
    W('「畫蛇添足」的意思是？', '多做了反而壞事', '把蛇畫得很好', '幫蛇加腳很厲害', '畫圖很認真'),
    W('「月亮像一艘小船」用了哪種修辭？', '譬喻', '擬人', '誇飾', '排比'),
    W('「風輕輕地唱歌」用了哪種修辭？', '擬人', '譬喻', '誇飾', '設問'),
    W('「他的聲音大得連山都在搖」用了哪種修辭？', '誇飾', '譬喻', '擬人', '排比'),
    W('「守株待兔」是在說？', '只想不勞而獲', '很會抓兔子', '保護樹木', '耐心等待是好事'),
    W('「井底之蛙」形容什麼樣的人？', '見識狹小的人', '很會跳的人', '喜歡游泳的人', '住在井邊的人'),
    W('「春天來了，花開了，草綠了，鳥叫了」用了哪種修辭？', '排比', '譬喻', '誇飾', '擬人'),
    W('「半途而廢」的意思是？', '做到一半就放棄', '走到一半休息', '一半的人回家', '半夜不睡覺'),
    W('「對牛彈琴」的意思是？', '對聽不懂的人說道理', '牛很喜歡音樂', '琴聲很好聽', '彈琴給朋友聽'),
  ],
  taiwan: [
    W('台灣最高的山是？', '玉山', '阿里山', '陽明山', '合歡山'),
    W('台灣最長的河川是？', '濁水溪', '淡水河', '高屏溪', '基隆河'),
    W('縱貫台灣南北的主要山脈是？', '中央山脈', '阿里山山脈', '海岸山脈', '雪山山脈'),
    W('北回歸線經過台灣的哪裡？', '嘉義和花蓮', '台北和宜蘭', '高雄和屏東', '新竹和苗栗'),
    W('台灣的平原大多在哪一邊？', '西部', '東部', '中央', '北部'),
    W('台灣夏天常見的天災是？', '颱風', '暴風雪', '沙塵暴', '冰雹'),
    W('台灣冬天吹的季風是？', '東北季風', '西南季風', '東南季風', '西北季風'),
    W('玉山大約有多高？', '約 3952 公尺', '約 1000 公尺', '約 8848 公尺', '約 500 公尺'),
    W('台灣位在哪個洲？', '亞洲', '歐洲', '非洲', '美洲'),
  ],
  eng2: [
    W('"I ___ a student." 要填？', 'am', 'is', 'are', 'be'),
    W('"She ___ my sister." 要填？', 'is', 'am', 'are', 'do'),
    W('"They ___ happy." 要填？', 'are', 'is', 'am', 'does'),
    W('"Do you like apples?" 可以回答？', 'Yes, I do.', 'Yes, I am.', 'Yes, it is.', 'Yes, I like.'),
    W('"What time is it?" 可以回答？', "It's seven o'clock.", "It's Monday.", "I'm fine.", "It's a book."),
    W('"There ___ two dogs." 要填？', 'are', 'is', 'am', 'be'),
    W('「星期一」的英文是？', 'Monday', 'Sunday', 'Friday', 'Tuesday'),
    W('"She is ___ a book." 要填？', 'reading', 'read', 'reads', 'readed'),
    W('"How old are you?" 可以回答？', "I'm ten years old.", "I'm fine, thank you.", "It's ten o'clock.", "I'm a student."),
    W('「星期天」的英文是？', 'Sunday', 'Saturday', 'Monday', 'Thursday'),
    W('"___ is your name?" 要填？', 'What', 'How', 'Where', 'When'),
  ],
  force: [
    W('把東西往地面拉的力叫什麼？', '重力', '摩擦力', '彈力', '磁力'),
    W('讓滑動的東西慢慢停下來的力叫什麼？', '摩擦力', '重力', '彈力', '浮力'),
    W('彈簧被壓扁後會彈回去，這是什麼力？', '彈力', '重力', '摩擦力', '磁力'),
    W('量「力」的大小可以用什麼工具？', '彈簧秤', '尺', '溫度計', '時鐘'),
    W('哪一種地面的摩擦力比較大？', '粗糙的水泥地', '光滑的冰面', '抹了油的地板', '光滑的玻璃'),
    W('力有哪兩個要素？', '大小和方向', '顏色和重量', '長度和高度', '溫度和時間'),
    W('下面哪一個例子是摩擦力在幫忙？', '腳踏車煞車停下來', '蘋果掉到地上', '彈簧彈回去', '磁鐵吸住鐵釘'),
    W('太空人在月球上比較輕，是因為？', '月球的重力比地球小', '太空衣很輕', '月球沒有空氣', '太空人變瘦了'),
  ],
  solar: [
    W('離太陽最近的行星是？', '水星', '金星', '地球', '火星'),
    W('太陽系一共有幾顆行星？', '8 顆', '9 顆', '7 顆', '10 顆'),
    W('地球自轉一圈需要多久？', '一天', '一年', '一個月', '一小時'),
    W('地球繞太陽公轉一圈需要多久？', '一年', '一天', '一個月', '一週'),
    W('月亮繞地球一圈大約需要多久？', '約 29.5 天', '約 1 天', '約 365 天', '約 7 天'),
    W('太陽系最大的行星是？', '木星', '土星', '地球', '海王星'),
    W('月亮本身會發光嗎？', '不會，它反射太陽光', '會，像燈泡一樣', '只有晚上會', '只有滿月時會'),
    W('太陽是一顆？', '恆星', '行星', '衛星', '彗星'),
    W('白天和晚上是因為？', '地球自轉', '地球公轉', '月亮繞地球', '太陽繞地球'),
    W('有美麗光環的行星是？', '土星', '火星', '金星', '水星'),
  ],
  reading: [
    W('文章裡「作者最想說的一句話」叫做？', '主旨', '標點', '修辭', '字數'),
    W('寫作文的「起承轉合」中，「合」是指？', '結尾', '開頭', '發展', '轉折'),
    W('寫作文之前先做什麼最有幫助？', '列大綱', '直接開始寫', '先數字數', '先想題目的顏色'),
    W('寫完作文要做什麼？', '檢查錯字和標點', '馬上交出去', '再寫一篇', '把紙折起來'),
    W('「段落大意」是指？', '每一段在講什麼', '文章有幾段', '段落的字數', '段落的標點'),
    W('要讓想法更有說服力，可以？', '舉具體的例子', '多寫幾個「很」', '把字寫大一點', '一直重複同一句'),
    W('小明每天練習跑步，比賽時跑了第一名。這段的主旨是？', '努力練習會有好成果', '小明很會跑', '比賽很好玩', '每天都要跑步'),
    W('讀一篇文章時，先看哪裡能最快知道在講什麼？', '題目和第一段', '最後一個字', '頁碼', '圖片的顏色'),
  ],
};
// 每個主題屬於哪一科、幾年級（找不到指定主題時用同科同年級的題）
const TOPIC_GRADE = { shapes: 0, zhuyin: 1, add10: 1, words1: 1, add20: 1, times: 2, clock: 2, measure: 2, sentence: 2, eng1: 3, divide: 3, plants: 3, fraction: 3, map: 4, bignum: 4, water: 4, idiom: 4, decimal: 5, taiwan: 5, eng2: 5, force: 5, ratio: 6, solar: 6, geometry: 6, reading: 6 };
export const TOPICS = Object.keys(TOPIC_GRADE);
export const topicsForGrade = (g, span = 1) => { const list = TOPICS.filter(t => TOPIC_GRADE[t] <= g && TOPIC_GRADE[t] >= g - span); return list.length ? list : TOPICS.filter(t => TOPIC_GRADE[t] <= Math.max(1, g)); };
export const speedTopicsForGrade = g => chaptersForGrade(g).map(c => 'sm:' + c.id); // 闖關中混進來的速算題（章節的建議年級不超過自己的年級）
export function makeQuestion(topic, grade) {
  if (typeof topic === 'string' && topic.startsWith('sm:')) { const s = speedQuestion(topic.slice(3), grade); const ans = String(s.a); const { choices, a } = textChoices(ans, s.wrongs.map(String)); return { topic, q: s.q, choices, a, why: s.why, trick: s.trick }; }
  if (!topic || !(GEN[topic] || BANK[topic])) topic = pick(topicsForGrade(Number.isFinite(grade) ? grade : 3));
  if (GEN[topic]) { const g = GEN[topic](); return { topic, q: g.q, choices: g.choices, a: g.a, why: g.why || '' }; }
  const it = pick(BANK[topic]); const { choices, a } = textChoices(it.a, it.wrongs); return { topic, q: it.q, choices, a, why: it.why }; }

// ── 解題視窗 ──
export function createQuizUI() {
  const $ = id => document.getElementById(id); const box = $('quizBox'); let resolve = null, cur = null, timer = 0;
  const close = v => { if (!resolve) return; const r = resolve; resolve = null; cur = null; box.hidden = true; clearTimeout(timer); r(v); };
  function ask({ topic, grade, title, mode, eyebrow, reward }) { if (resolve) close(null); cur = makeQuestion(topic, grade);
    $('quizEyebrow').textContent = eyebrow || (mode === 'shift' ? 'QUIZ・闖關解題' : 'QUIZ・解題任務'); $('quizTitle').textContent = title || '解題'; $('quizQ').textContent = cur.q; $('quizReward').textContent = reward || '';
    $('quizChoices').innerHTML = cur.choices.map((c, i) => `<button type="button" class="qc" data-i="${i}"><span class="n">${'ABCD'[i]}</span>${esc(c)}</button>`).join(''); $('quizFb').textContent = ''; $('quizFb').className = 'quiz-fb'; $('quizNext').hidden = true;
    box.hidden = false; return new Promise(res => { resolve = res; }); }
  const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  $('quizChoices').addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b || !cur || !resolve) return; const i = +b.dataset.i, ok = i === cur.a;
    for (const x of $('quizChoices').querySelectorAll('button')) { x.disabled = true; if (+x.dataset.i === cur.a) x.classList.add('ok'); else if (+x.dataset.i === i) x.classList.add('bad'); }
    const fb = $('quizFb'); fb.textContent = (ok ? '🎉 答對了！' : `❌ 答錯了，正確答案是「${cur.choices[cur.a]}」。`) + (cur.why ? ' ' + cur.why : ''); fb.className = 'quiz-fb ' + (ok ? 'ok' : 'bad');
    const r = resolve; resolve = null; cur = null; r(ok); $('quizNext').hidden = false; clearTimeout(timer); timer = setTimeout(() => { box.hidden = true; }, ok ? 1800 : 3200); });
  $('quizNext').addEventListener('click', () => { box.hidden = true; clearTimeout(timer); });
  $('quizClose').addEventListener('click', () => { if (resolve) close(null); else { box.hidden = true; clearTimeout(timer); } });
  return { ask, close: () => close(null), get open() { return !box.hidden; } };
}
// 每個單元每天答對幾題有獎勵（記在裝置上），超過只當練習
export function dailyTally(key) { const today = new Date().toLocaleDateString('en-CA', { timeZone: C.exam.tz }); let d = {}; try { d = JSON.parse(localStorage.getItem(C.quiz.storageKey) || '{}'); } catch (e) { d = {}; } if (d.day !== today) d = { day: today, n: {} }; d.n = d.n || {};
  return { count: d.n[key] || 0, solvedAll: Object.keys(d.n).length, add() { d.n[key] = (d.n[key] || 0) + 1; try { localStorage.setItem(C.quiz.storageKey, JSON.stringify(d)); } catch (e) { /* 無痕 */ } return d.n[key]; } }; }
