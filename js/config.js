/* 小學闖關島 — 所有可調參數。其他檔案不得出現魔術數字。
   玩法：最多 4 人一隊（人不夠由 NPC 同學補），一關 3 波，打倒大魔王會掉金蛋，搬進金蛋籃湊滿配額才過關；闖關中和逛校園時都可以「解題」拿獎勵。
   新增挑戰：issues 加一筆（或從後台新增），它決定這一波小怪的組合與頭上台詞。新增小怪：animals 加一筆，model 指到 animals.js 的外型。
   新增課程單元：lessons 加一筆（後台的「課程單元」也會自動出現），quiz 指到 quiz.js 題庫的主題。 */
export const CONFIG = {
  site: {
    name: '小學闖關島', sub: '解題・搬金蛋', tag: '國小 1～6 年級・非官方教學遊戲', proj: '闖關', eyebrow: 'LEARNING ISLAND',
    credit: '島嶼、人物與場景的畫法參考網路上的 Q 版互動地圖，重新實作；闖關玩法致敬斯普拉遁的打工模式，全部重新設計。',
    badge: '教學版',
    parody: '非官方教學遊戲｜免費',
    parodyLong: '這是網友自製的小學課程闖關遊戲，題目依國小 1～6 年級常見的課程內容編寫，不是任何學校、出版社或教育機關的官方教材，也沒有收到任何委託或贊助。',
    disclaimer: '題目與學習重點整理自國小各年級常見的課程內容，僅供練習與遊戲參考，實際進度以學校課本為準。地標與建築是象徵性的迷你模型；小怪、魔王、數值都是遊戲設定，角色與 NPC 同學的名字都是虛構的。',
  },
  exam: { date: '2027-01-15', tz: 'Asia/Taipei', finalIssueId: 'final', hazardBonus: 0.15 }, // 期末大考前一晚起：每一波都是期末大考、危險度加 hazardBonus
  // 一關：waves 波、每波 waveSeconds 秒；開場 introSeconds 秒、波與波之間 interSeconds 秒（這段時間會把倒下的人全部救起、清場）
  shift: {
    waves: 3, waveSeconds: 100, introSeconds: 4, interSeconds: 7, resultLinger: 1.2, autoCity: 8, // autoCity：單人打完幾秒後自動飛回校園（房間裡不自動）
    // 配額 = qBase[第幾波] + qHazard[第幾波] × 危險度（危險度 0.3～2.0）
    qBase: [10, 12, 14], qHazard: [8, 9, 10],
    // 魔王：每 bossEvery ÷ (bossK0 + bossK1 × 危險度) 秒來一隻，同時最多 bossMax0 + bossMax1 × 危險度 隻
    bossEvery: 9, bossK0: 0.7, bossK1: 0.35, bossMax0: 4, bossMax1: 2, bossFirst: 4,
    // 小怪：每 lesserEvery ÷ (lesserK0 + lesserK1 × 危險度) 秒來一群，一群 groupBase + groupHazard × 危險度 隻，同時最多 lesserMax0 + lesserMax1 × 危險度 隻
    lesserEvery: 11, lesserK0: 0.8, lesserK1: 0.3, groupBase: 3, groupHazard: 2, groupGap: 0.3, lesserMax0: 14, lesserMax1: 6, lesserFirst: 1.5,
    enemyCap: 34,              // 場上敵人總數上限（手機效能）
    hpK0: 0.75, hpK1: 0.25,    // 敵人血量倍率 = hpK0 + hpK1 × 危險度
    dmgK0: 0.65, dmgK1: 0.35,  // 敵人傷害倍率 = dmgK0 + dmgK1 × 危險度（新生被打比較輕）
    unitsPerSec: 1,            // 敵速 1.0 = 每秒走幾個世界單位（一個學期區塊寬約 8.4）
    landSeconds: 1.2,          // 從圍欄外翻進來的時間
    separation: 0.28,          // 敵人彼此推開的距離
    retarget: 0.8,             // 敵人每幾秒重新挑最近的人
    aggroRange: 14,
    // 特殊波：第 1 波 specialFirst、之後每波 specialChance 的機率
    specialChance: 0.25, specialFirst: 0.12,
    fog: { near: 2.5, far: 10, lesserMul: 1.4, goldAt: [12, 42, 72] },
    rush: { time: 1300, groupEvery: 2.6, groupK: 0.25, group: 6, groupHazard: 2, cap: 30, goldEvery: 7, goldK0: 0.75, goldK1: 0.3, goldMax: 3, goldMaxK: 1, switchEvery: 12 }, // 搗蛋夜：每 groupEvery÷(1+groupK×危險度) 秒一群搗蛋鼠；金星鼠每 goldEvery÷(goldK0+goldK1×危險度) 秒一隻
    dayTimes: [600, 780, 960], // 一般波的天色：早上、中午、下午（分鐘）
    // 金蛋
    egg: { perBoss: 3, pickR: 0.32, basketR: 0.72, carrySpeed: 0.8, throwDist: 1.7, throwTime: 0.45, throwAim: 2.7, scatter: 0.45 },
    // 闖關的人
    player: { hp: 100, radius: 0.14, regenDelay: 2.5, regen: 40, reviveR: 0.55, reviveTime: 0.9, reviveDecay: 1.5, invAfterRevive: 2, invAfterHit: 0.35 },
    specials: 2,               // 一關可以放幾次特殊技
    projSpeed: 10, focusR: 0.9, threatR: 0.9,
    cameraDist: 10, cameraDistNarrow: 12, cameraPolar: 30, // 闖關時鏡頭跟著自己：距離與俯角（離垂直幾度，越小越像俯視，比較不會被建築擋住）
  },
  // ═══ 解題：闖關中按「解題」或在課程卡按「解題任務」會出一題（四選一）═══
  // 闖關中答對：這一波直接 +bonusEggs 顆金蛋（算進配額與自己的金蛋）、血補滿；答錯沒有懲罰但要等 cooldown 秒才能再答。
  // 逛校園（課程卡）答對：每題 reward 顆金蛋記進雲端（每個單元每天最多 dailyCap 題有獎勵，之後只是練習）。
  quiz: { bonusEggs: 2, cooldown: 12, reward: 2, dailyCap: 3, choices: 4, perShift: 6, storageKey: 'pi.quiz.v1', gradeKey: 'pi.quiz.grade' },
  // 每 rotateHours 小時換一個闖關場（大家同時間看到同一個場）
  rotateHours: 2,
  // 闖關場：每個場就是一個學期區塊，basket = 金蛋籃所在的區塊（區塊前方有廣場），敵人從四邊的圍欄外翻進來
  stages: [
    { id: 'beitou',     name: '一年級上・大操場',   basket: 'beitou',     islands: ['beitou'] },
    { id: 'shilin',     name: '一年級下・圖書館前', basket: 'shilin',     islands: ['shilin'] },
    { id: 'zhongshan',  name: '三年級上・科學館廣場', basket: 'zhongshan', islands: ['zhongshan'] },
    { id: 'zhongzheng', name: '五年級上・音樂廳前', basket: 'zhongzheng', islands: ['zhongzheng'] },
    { id: 'daan',       name: '五年級下・體育館前', basket: 'daan',       islands: ['daan'] },
  ],
  // 島的大小與整張地圖的間距（相對最早的版本）：島放大 islandK 倍、地圖攤開 mapK 倍
  // 草原小鎮：zone 區塊半寬、sizeK 建築大小、mapK 環境與鏡頭距離；rivers 小河（axis 'z' 東西向、位在第 at 列與下一列之間、從第 from 欄流到第 to 欄；axis 'x' 南北向）
  world: { zone: 4.2, sizeK: 1.5, mapK: 1.4, rivers: [{ axis: 'z', at: 1.5, from: -2, to: 5 }, { axis: 'x', at: 0.5, from: 1.5, to: 4 }] },
  // 場景解鎖：free 一開始就開；其他場景要在相鄰（上下左右）已解鎖的場景答對 need 題才開（自己選的學期也一開始就開）
  unlock: { need: 3, free: ['shezi', 'beitou'] },
  plaza: { z: 0.5, len: 1.8, r: 0.9, basketZ: 1.4 }, // 金蛋籃廣場：島中心往前 z 開始、長 len、半寬 r 的走道不放建築；籃子在中心往前 basketZ
  // 闖關等級：點數 0～100，滿 100 升一級（從 promoteTo 點開始），低於 0 降一級（從 demoteTo 點開始）；最高級的點數可以一直累積
  grades: {
    names: ['新生', '小學生', '小組長', '副班長', '班長', '模範生', '學霸'],
    hazard: [0.3, 0.45, 0.6, 0.8, 1.0, 1.2, 1.4], hazardPerPts: 0.2, topPtsCap: 999, topHazardMax: 2.0,
    clear: 20, fail: [-20, -10, 0], failSafeBelow: 2, promoteTo: 40, demoteTo: 80, // failSafeBelow：這級以下失敗不扣點
    storageKey: 'pi.grade.v1',
  },
  // 闖關點數（只是好玩的成績單）：每過一波、每顆金蛋、每隻趕跑、每次救人
  pay: { wave: 120, egg: 15, kill: 1, rescue: 10, clearBonus: 200 },
  // 校長在金蛋籃旁邊廣播（像闖關的主持人）；大廳時巡迴課程建築介紹課程
  mayor: { name: '校長', speed: 0.5, speechSeconds: 5.5, pauseSeconds: 0.8, approach: 0.45, sloganMax: 22, sayFacts: 3, cheerRadius: 2.2,
    lines: {
      intro: '各位同學，闖關開始！金蛋搬進籃子！', wave: '第 {n} 波！配額 {q} 顆金蛋！', fog: '起大霧了，看不清楚就跟緊彼此！', rush: '搗蛋夜！被盯上的人快跑，其他人掩護！',
      boss: '{name}來了！打倒會掉金蛋！', quota: '達標！多搬的算加分！', hurry: '還差 {k} 顆，衝啊！', clearWave: '這波過關！喘口氣！', fail: '全倒了⋯這關先休息', timeup: '時間到，配額還差 {k} 顆⋯', clear: '三波全過！今天太棒了！',
      quizOk: '答對了！加 {n} 顆金蛋！', quizNo: '沒關係，再想想！',
    } },
  // 居民（校園裡的同學與老師）：平常在步道上散步；闖關時場上的居民會先離開
  residents: { perIsland: 8, speed: [0.32, 0.40], bikeSpeed: [0.62, 0.70], roles: ['citizen','elder','child','parent','officeworker','youth','cyclist','worker','hiker','servant','researcher','farmer','traveler'] }, // 走路速度 0.32～0.40、腳踏車 0.62～0.70
  // 闖關角色（id 不要改：Supabase heroes.cls 有檢查）。武器自動瞄準射程內的敵人；點敵人＝鎖定它
  // special：一關 2 次的特殊技
  heroes: {
    chief:     { name: '班長',     icon: '📣', color: 0xdb6a41, dmg: 26, rate: 0.4,  range: 3.2, style: 'ball',  speed: 1.55, weapon: '哨子音波',   desc: '中距離穩定輸出。', special: { id: 'broadcast', name: '全班安靜', desc: '身邊 3.5 格的小怪全部定住 3 秒並受到重傷。', r: 3.5, dmg: 300, stun: 3 } },
    driver:    { name: '體育老師', icon: '🏃', color: 0x2f6f9f, dmg: 12, rate: 0.16, range: 2.8, style: 'bus',   speed: 1.7,  weapon: '躲避球連發', desc: '射速最快、跑最快。',     special: { id: 'dash',      name: '衝刺跑', desc: '往前衝 4.5 格，撞到的小怪受重傷，衝的時候不會受傷。', dist: 4.5, time: 0.6, w: 0.7, dmg: 600 } },
    fireman:   { name: '自然老師', icon: '🔬', color: 0xc9452f, dmg: 30, rate: 0.5,  range: 3.0, style: 'water', speed: 1.5, slow: 0.45, slowTime: 1.4, weapon: '實驗水槍', desc: '打到會減速（魔王也有效）。', special: { id: 'hose', name: '噴水實驗', desc: '8 秒內射速 3 倍、射程 +1、傷害 +20%。', time: 8, rateMul: 3, rangeAdd: 1, dmgMul: 1.2 } },
    volunteer: { name: '保健老師', icon: '🩹', color: 0xc97d97, dmg: 18, rate: 0.4,  range: 2.8, style: 'ball',  speed: 1.55, reviveMul: 2, weapon: 'OK 繃飛鏢', desc: '救人速度 2 倍。',        special: { id: 'bento',     name: '營養午餐', desc: '5 格內倒下的隊友全部救起、所有人補滿血並無敵 4 秒。', r: 5, inv: 4 } },
    engineer:  { name: '電腦老師', icon: '💻', color: 0x4a3f8f, dmg: 40, rate: 0.8,  range: 3.4, style: 'zap', chain: 3, speed: 1.45, weapon: '程式閃電', desc: '連鎖電擊一次打 3 隻。', special: { id: 'chain',     name: '連鎖除錯', desc: '6 格內最多 10 隻小怪各受 350 傷害。', r: 6, n: 10, dmg: 350 } },
  },
  // 敵人（學習路上的小怪）。model：bird / frog / worm / lizard / mouse / tower
  // 小怪：hp 血量、speed 速度、dmg 近戰傷害、range 攻擊距離；parrot 會吐口水（ranged）
  // 魔王（boss: true）：打倒掉 egg.perBoss 顆金蛋；ai 決定招式。金色的（gold）被打會掉金蛋
  animals: {
    mouse:       { name: '粗心鼠',   model: 'mouse',  color: 0x9e9e9e, accent: 0x616161, hp: 30,   speed: 1.75, dmg: 18, size: 0.75, chants: ['忘記進位','看錯題目','抄錯行','粗心!','少一個零','沒寫單位'] },
    bird:        { name: '分心鳥',   model: 'bird',   color: 0x17a3b4, accent: 0x0d7281, hp: 70,   speed: 1.3,  dmg: 30, size: 1.0, fly: true,  chants: ['好想玩!!','看窗外','下課了嗎','放空中','聽不到'] },
    frog:        { name: '拖延蛙',   model: 'frog',   color: 0x4caf50, accent: 0x2e7d32, hp: 200,  speed: 0.85, dmg: 50, size: 1.15, hop: true,  chants: ['呱!!','明天再寫','呱～再等等','先玩一下'] },
    parrot:      { name: '複製鸚鵡', model: 'bird',   color: 0x6abf4b, accent: 0xd94a3a, hp: 60,   speed: 1.0,  dmg: 25, size: 0.9, fly: true, ranged: { range: 2.6, speed: 3.2, every: 2.6 }, repeat: true, chants: ['同上','+1','照抄','抄答案','我也是'] },
    caterpillar: { name: '瞌睡蟲',   model: 'worm',   color: 0x7cb342, accent: 0x558b2f, hp: 320,  speed: 0.55, dmg: 45, size: 1.1, chants: ['好睏','打哈欠','趴下睡','zzz'] },
    chameleon:   { name: '藉口龍',   model: 'lizard', color: 0x66bb6a, accent: 0xffb300, hp: 110,  speed: 1.2,  dmg: 35, size: 1.0, stealth: true, chants: ['作業被狗吃了','我忘了','不是我','老師沒說','鉛筆不見了'] },
    rushmouse:   { name: '搗蛋鼠',   model: 'mouse',  color: 0x4ad6c8, accent: 0x167a72, hp: 25,   speed: 2.3,  dmg: 25, size: 0.8, glow: true, chants: ['搗蛋!!','抓到你了','衝衝衝','嘿嘿'] },
    // 魔王
    bigv:        { name: '錯字大嘴鳥', model: 'bird',   color: 0x0e5f6b, accent: 0xf2c14e, hp: 520,  speed: 0.75, dmg: 40, size: 1.8, boss: true, ai: 'bomber', fly: false, every: 6.5, windup: 1.6, bombHp: 110, fuse: 1.6, blastR: 1.0, blastDmg: 90, throwRange: 6, desc: '頭頂舉起錯字本丟人；舉著的時候猛打，本子會在牠頭上爆炸。', chants: ['錯字來了','的得地','在再不分','再再再'] },
    frogking:    { name: '大考蛙王',   model: 'frog',   color: 0x2e7d32, accent: 0xf2c14e, hp: 650,  speed: 0.6,  dmg: 50, size: 2.1, boss: true, ai: 'leaper', hop: true, every: 5, aim: 1.3, air: 0.5, slamR: 0.85, slamDmg: 100, stun: 2, stunMul: 1.5, leapRange: 5, desc: '瞄準一個人跳過去壓；落地後會暈 2 秒，傷害 1.5 倍。', chants: ['呱!!!!','期中考','全部考','默寫!'] },
    ironfan:     { name: '鐵頭龍',     model: 'lizard', color: 0x5d6d7e, accent: 0xd94a3a, hp: 480,  speed: 0.5,  dmg: 70, size: 1.6, boss: true, ai: 'charger', shield: 0.15, shieldArc: 1.05, every: 6, aim: 0.8, chargeSpeed: 3.2, chargeTime: 2.2, stun: 2.5, desc: '正面有鐵頭護盾（只吃 15% 傷害），衝撞後會暈，繞到旁邊或背後打。', chants: ['我才對','不聽不聽','就是這樣','不改'] },
    spamtower:   { name: '吵鬧塔',     model: 'tower',  color: 0x3b3a42, accent: 0x4ad6c8, hp: 420,  speed: 0.6,  dmg: 80, size: 1.6, boss: true, ai: 'tower', every: 4.5, aim: 1.1, beamW: 0.35, beamLen: 8, desc: '翻進圍欄就不動，一直對人發射吵鬧音波；看到紅線就閃開。', chants: ['吵吵吵','講話中','嘰嘰喳喳','好吵'] },
    missile:     { name: '問號鸚鵡',   model: 'bird',   color: 0x8bc34a, accent: 0xd94a3a, hp: 380,  speed: 0.8,  dmg: 75, size: 1.7, boss: true, ai: 'missile', fly: true, pods: true, every: 7, aim: 1.6, blastR: 0.75, hover: 15, desc: '停在圍欄邊的上空，對每個人丟問號炸彈；腳下出現紅圈就快跑。', chants: ['為什麼?','怎麼辦?','聽不懂','問問問'] },
    // 金色（特殊波）：被打就掉金蛋
    goldfrog:    { name: '金星蛙',   model: 'frog',   color: 0xf2c14e, accent: 0xb8860b, hp: 300,  speed: 0.9,  dmg: 30, size: 1.3, gold: true, hop: true, glow: true, eggEvery: 0.25, eggOnDeath: 2, chants: ['金金金','發財呱','抓不到'] },
    goldmouse:   { name: '金星鼠',   model: 'mouse',  color: 0xf2c14e, accent: 0xb8860b, hp: 120,  speed: 1.6,  dmg: 20, size: 1.0, gold: true, glow: true, eggOnDeath: 2, chants: ['金星!','打我啊','給你金蛋'] },
  },
  bossTypes: ['bigv', 'frogking', 'ironfan', 'spamtower', 'missile'],
  lesserTypes: ['mouse', 'bird', 'frog', 'parrot', 'caterpillar', 'chameleon'],
  melee: { range: 0.32, windup: 0.45, cooldown: 1.2, reach: 0.18 }, // 近戰：靠到 range 開始揮，揮完人還在 range + reach 內才算打到
  chant: { on: 2.6, max: 2, every: 1.8, rest: 8, issueShare: 0.65, copyMax: 6, size: 0.32, space: 2.2 },
  // NPC 同學（人不夠時補滿 4 人）。名字都是虛構的
  npc: { names: ['小明', '小美', '阿凱', '佩佩', '志豪', '雅婷', '小宇', '小傑', '阿珠', '建宏'], think: 0.25, eggRange: 6, reviveRange: 7, bossRange: 7, home: 2.6, specialBosses: 3, kiteR: 0.8, kiteHp: 70, kiteCrowd: 3, kiteDist: 1.6 }, // kite：小怪貼身、血少或被圍時先拉開距離
  // 13 個場景 = 12 個學期（一上…六下）加幼兒園，排在 4 欄的格子上（grid = [欄, 列]，蛇行排列讓前後學期上下左右相鄰）；grade = 年級（題目難度）。id 不要改：Supabase heroes.district 有檢查
  //   幼  一上 一下 二上
  //   四上 三下 三上 二下
  //   四下 五上 五下 六上
  //               六下
  islands: [
    { id: 'shezi',     number: 13, grid: [0, 0], name: '幼兒園',   short: '幼',   grade: 0, ground: 'garden',     landmark: 'wetland' },
    { id: 'beitou',    number: 1,  grid: [1, 0], name: '一年級上', short: '一上', grade: 1, ground: 'meadow',     landmark: 'hotspring', goal: true, plaza: true },
    { id: 'shilin',    number: 2,  grid: [2, 0], name: '一年級下', short: '一下', grade: 1, ground: 'lawn',       landmark: 'palace', plaza: true },
    { id: 'neihu',     number: 3,  grid: [3, 0], name: '二年級上', short: '二上', grade: 2, ground: 'lawn',       landmark: 'techcampus' },
    { id: 'datong',    number: 4,  grid: [3, 1], name: '二年級下', short: '二下', grade: 2, ground: 'courtyard',  landmark: 'oldstreet' },
    { id: 'zhongshan', number: 5,  grid: [2, 1], name: '三年級上', short: '三上', grade: 3, ground: 'street',     landmark: 'grandhotel', plaza: true },
    { id: 'songshan',  number: 6,  grid: [1, 1], name: '三年級下', short: '三下', grade: 3, ground: 'street',     landmark: 'airport' },
    { id: 'nangang',   number: 7,  grid: [0, 1], name: '四年級上', short: '四上', grade: 4, ground: 'gravel',     landmark: 'expo' },
    { id: 'wanhua',    number: 8,  grid: [0, 2], name: '四年級下', short: '四下', grade: 4, ground: 'terracotta', landmark: 'temple' },
    { id: 'zhongzheng',number: 9,  grid: [1, 2], name: '五年級上', short: '五上', grade: 5, ground: 'granite',    landmark: 'station', plaza: true },
    { id: 'daan',      number: 10, grid: [2, 2], name: '五年級下', short: '五下', grade: 5, ground: 'garden',     landmark: 'park', plaza: true },
    { id: 'xinyi',     number: 11, grid: [3, 2], name: '六年級上', short: '六上', grade: 6, ground: 'granite',    landmark: 'cityhall' },
    { id: 'wenshan',   number: 12, grid: [3, 3], name: '六年級下', short: '六下', grade: 6, ground: 'forest',     landmark: 'gondola' },
  ],
  goalLabel: '校長室',
  scene: { fadeMs: 320 }, // 走到相鄰場景時的轉場（畫面淡出再淡入，像牧場物語換畫面）
  // 地圖上的河口標籤（純裝飾）。
  landings: { west: { island: 'nangang', name: '彩虹河' }, north: { island: 'beitou', name: '雲朵灣' }, east: { island: 'datong', name: '鉛筆河' }, south: { island: 'wenshan', name: '故事溪' } },
  // 課程單元：每一筆是一棟可點擊的建築（課程卡顯示 summary 學什麼、why 為什麼要學、facts 學習重點最多 8 條、agencies 關鍵字、issue 相關挑戰代號），
  // district = 屬於哪個學期的島；quiz = 題庫主題（quiz.js），沒有就依科目與年級出題。後台（共享資料庫 policies 集合）新增的會自動出現。課程建築在闖關時也是障礙物。
  // model 可用：housing nursery elderhome busstop dome techcampus school smartpole garden crane containers theater kiosk station crossing nightmarket hub card court bigtree levee
  policies: [
    // 幼兒園
    { id: 'shapes',   title: '顏色與形狀',   tag: '#生活', model: 'nightmarket', district: 'shezi', grade: 0, quiz: 'shapes', summary: '認識紅黃藍綠，分辨圓形、三角形、正方形。', why: '顏色和形狀是觀察世界的第一步，也是之後學數學與自然的基礎。', facts: ['三原色：紅、黃、藍', '圓形沒有角，三角形有 3 個角', '正方形 4 個邊一樣長', '長方形對邊一樣長', '數一數：一共有幾個角？'], agencies: ['顏色', '形狀', '數一數'], issue: 'count' },
    // 一年級上
    { id: 'zhuyin',   title: '注音符號',     tag: '#國語', model: 'school',   district: 'beitou', grade: 1, quiz: 'zhuyin', summary: '37 個注音符號，聲符、韻符和四聲，拼出每一個字的讀音。', why: '會注音就能自己讀繪本、查字典，認識更多的字。', facts: ['聲符 21 個：ㄅㄆㄇㄈ…', '韻符 16 個：ㄚㄛㄜㄝ…', '一聲平、二聲揚、三聲轉彎、四聲降', '輕聲不標調號', 'ㄓㄔㄕㄖ要翹舌', '拼音順序：聲符在前、韻符在後'], agencies: ['聲符', '韻符', '四聲'], issue: 'zhuyin' },
    { id: 'count',    title: '10 以內的加減', tag: '#數學', model: 'kiosk',   district: 'beitou', grade: 1, quiz: 'add10', summary: '數到 10、比大小，用數字卡算 10 以內的加法和減法。', why: '所有的計算都從 10 以內的加減開始，熟了以後進位就不難。', facts: ['數字 0 到 10 的順序', '比大小：7 比 5 大', '合起來是加法：3 + 4 = 7', '拿走是減法：9 − 2 = 7', '10 的好朋友：1 和 9、2 和 8、3 和 7、4 和 6、5 和 5'], agencies: ['加法', '減法', '比大小'], issue: 'count' },
    // 一年級下
    { id: 'words1',   title: '認識國字',     tag: '#國語', model: 'theater', district: 'shilin', grade: 1, quiz: 'words1', summary: '從生活常用字開始：筆順、部首、量詞和簡單句子。', why: '認得字才能讀課本和故事，寫字從正確的筆順開始最不容易寫錯。', facts: ['筆順：先上後下、先左後右、先外後內', '常見部首：人、口、水、木、火', '量詞：一「隻」狗、一「本」書、一「朵」花', '相反詞：大小、高矮、快慢', '句子要有「誰」做「什麼」'], agencies: ['筆順', '部首', '量詞'], issue: 'zhuyin' },
    { id: 'add20',    title: '20 以內的加減', tag: '#數學', model: 'card',    district: 'shilin', grade: 1, quiz: 'add20', summary: '用「湊十」的方法算 20 以內的加減，認識個位和十位。', why: '湊十法是進位和借位的基礎，之後算幾十幾百都用得到。', facts: ['13 = 1 個十 + 3 個一', '湊十：8 + 5 → 8 + 2 + 3 = 13', '減法也能拆：15 − 7 → 15 − 5 − 2 = 8', '加法交換：4 + 9 = 9 + 4', '錢幣：1 元、5 元、10 元'], agencies: ['湊十', '個位', '十位'], issue: 'count' },
    // 二年級上
    { id: 'times',    title: '九九乘法',     tag: '#數學', model: 'techcampus', district: 'neihu', grade: 2, quiz: 'times', summary: '幾個幾用乘法算：背熟九九乘法表，算得又快又準。', why: '乘法是除法、面積、分數的基礎，背熟了高年級才不會卡住。', facts: ['3 × 4 就是 3 個 4 加起來', '乘法交換：6 × 7 = 7 × 6', '任何數 × 1 都是自己', '任何數 × 0 都是 0', '5 的倍數尾數是 0 或 5', '9 的倍數：數字加起來是 9'], agencies: ['乘法', '倍數', '九九表'], issue: 'times' },
    { id: 'clock',    title: '看時鐘',       tag: '#生活', model: 'smartpole', district: 'neihu', grade: 2, quiz: 'clock', summary: '認識時針、分針，會看幾點幾分，算經過的時間。', why: '會看時間才能自己安排上學、寫作業和玩的時間。', facts: ['短針是時針、長針是分針', '分針走一大格是 5 分鐘', '一小時 = 60 分鐘', '一天 24 小時', '下午 3 點也叫 15 點'], agencies: ['時針', '分針', '經過時間'], issue: 'count' },
    // 二年級下
    { id: 'measure',  title: '長度與公分',   tag: '#數學', model: 'crane',   district: 'datong', grade: 2, quiz: 'measure', summary: '用尺量長度，認識公分和公尺，比較誰長誰短。', why: '量東西是生活技能，也是之後學面積、體積的第一步。', facts: ['1 公尺 = 100 公分', '量東西要從尺的 0 開始', '鉛筆大約 18 公分', '教室門大約 2 公尺高', '長度可以加減：30 公分 + 25 公分 = 55 公分'], agencies: ['公分', '公尺', '估測'], issue: 'times' },
    { id: 'sentence', title: '量詞與造句',   tag: '#國語', model: 'housing', district: 'datong', grade: 2, quiz: 'sentence', summary: '用對量詞、標點符號，把話寫成完整通順的句子。', why: '句子寫通順了，才能寫日記、寫作文，把想法說清楚。', facts: ['句號「。」句子說完才用', '問號「？」用在問句', '逗號「，」句子中間停一下', '「的」接名詞：紅色的花', '「地」接動詞：慢慢地走', '擴寫：小狗跑 → 可愛的小狗在草地上跑'], agencies: ['標點', '量詞', '造句'], issue: 'zhuyin' },
    // 三年級上
    { id: 'eng1',     title: '英語字母與單字', tag: '#英語', model: 'hub',   district: 'zhongshan', grade: 3, quiz: 'eng1', summary: '26 個字母的大小寫、自然發音，和顏色、動物、數字的單字。', why: '認得字母和基本單字，才能開口打招呼、看懂簡單的英文。', facts: ['字母 A 到 Z 共 26 個', '母音：a e i o u', 'cat、dog、pig 都是三個字母的單字', '顏色：red、blue、yellow、green', '數字：one、two、three… ten', '打招呼：Hello! How are you?'], agencies: ['字母', '單字', '發音'], issue: 'english' },
    { id: 'divide',   title: '除法',         tag: '#數學', model: 'containers', district: 'zhongshan', grade: 3, quiz: 'divide', summary: '平分東西用除法：12 顆糖分給 3 個人，每人幾顆？', why: '除法和乘法是一家人，會除法才能算平均、分數和比。', facts: ['12 ÷ 3 = 4，因為 3 × 4 = 12', '被除數 ÷ 除數 = 商', '有剩下的叫餘數：13 ÷ 3 = 4 餘 1', '餘數一定比除數小', '任何數 ÷ 1 都是自己'], agencies: ['除法', '餘數', '平分'], issue: 'times' },
    // 三年級下
    { id: 'plants',   title: '植物的身體',   tag: '#自然', model: 'garden',  district: 'songshan', grade: 3, quiz: 'plants', summary: '根、莖、葉、花、果實、種子各有什麼工作？', why: '觀察植物怎麼長大，學會做紀錄，是自然課最重要的本事。', facts: ['根：吸收水分、固定植物', '莖：運送水分和養分', '葉：行光合作用做養分', '花：開花後結果', '種子發芽需要水、空氣和適當溫度', '向光性：植物會朝有光的方向長'], agencies: ['光合作用', '發芽', '觀察'], issue: 'science' },
    { id: 'fraction', title: '分數入門',     tag: '#數學', model: 'nursery', district: 'songshan', grade: 3, quiz: 'fraction', summary: '把一個東西平分成幾份，其中的幾份就是分數。', why: '分數是比、小數、百分率的起點，先用披薩和巧克力想清楚。', facts: ['1/2 就是平分成 2 份拿 1 份', '分母寫下面：分成幾份', '分子寫上面：拿幾份', '同分母比大小：分子大的比較大', '1/2 和 2/4 一樣大', '同分母相加：1/5 + 2/5 = 3/5'], agencies: ['分子', '分母', '平分'], issue: 'fraction' },
    // 四年級上
    { id: 'map',      title: '地圖與方位',   tag: '#社會', model: 'station', district: 'nangang', grade: 4, quiz: 'map', summary: '看懂地圖的方位、比例尺和圖例，找到自己的位置。', why: '會看地圖就不會迷路，也能認識自己住的地方和台灣各地。', facts: ['地圖上通常上北下南、左西右東', '圖例說明地圖上的符號', '比例尺：圖上 1 公分代表實際多遠', '太陽從東邊升起、西邊落下', '指北針的紅針指向北方', '台灣四面環海，東邊是太平洋'], agencies: ['方位', '比例尺', '圖例'], issue: 'social' },
    { id: 'bignum',   title: '大數與直式乘法', tag: '#數學', model: 'dome', district: 'nangang', grade: 4, quiz: 'bignum', summary: '讀寫萬以上的大數，用直式算兩位數乘法。', why: '生活裡的價錢、人口都是大數，直式乘法讓大的計算也不出錯。', facts: ['一萬 = 10000，有 5 位數', '四位一節：億、萬、個', '23 × 45：先算 23 × 5，再算 23 × 40', '直式要對齊個位', '估算：19 × 21 大約是 20 × 20 = 400', '括號先算：(2 + 3) × 4 = 20'], agencies: ['位值', '直式', '估算'], issue: 'times' },
    // 四年級下
    { id: 'water',    title: '水的三態',     tag: '#自然', model: 'levee',   district: 'wanhua', grade: 4, quiz: 'water', summary: '冰、水、水蒸氣會互相變化：融化、蒸發、凝結、凝固。', why: '雲、雨、霧和冰塊都是同一種水，知道原理就懂天氣怎麼來的。', facts: ['固態是冰、液態是水、氣態是水蒸氣', '冰變水叫融化（0°C）', '水變水蒸氣叫蒸發，煮沸是 100°C', '水蒸氣變水叫凝結：冷飲杯外面的水珠', '水變冰叫凝固', '水蒸氣看不見，白煙是小水滴'], agencies: ['融化', '蒸發', '凝結'], issue: 'science' },
    { id: 'idiom',    title: '成語與修辭',   tag: '#國語', model: 'theater', district: 'wanhua', grade: 4, quiz: 'idiom', summary: '認識常用成語的意思，學會譬喻、擬人等修辭讓文章更生動。', why: '用對成語和修辭，作文會更精彩，閱讀也更能體會作者的意思。', facts: ['一舉兩得：做一件事得到兩個好處', '畫蛇添足：多做反而壞事', '譬喻：月亮像一艘小船', '擬人：風輕輕地唱歌', '誇飾：他的聲音大得連山都搖', '排比：春天來了，花開了，草綠了，鳥叫了'], agencies: ['成語', '譬喻', '擬人'], issue: 'zhuyin' },
    // 五年級上
    { id: 'decimal',  title: '小數與分數運算', tag: '#數學', model: 'crossing', district: 'zhongzheng', grade: 5, quiz: 'decimal', summary: '小數的加減乘除、分數的通分與約分，兩種寫法互相換。', why: '價錢、身高、體重都是小數，和分數互換後，很多題目就變簡單了。', facts: ['0.5 = 1/2，0.25 = 1/4', '小數加減：小數點對齊', '1.2 × 3 = 3.6', '約分：4/8 = 1/2', '通分：1/2 + 1/3 = 3/6 + 2/6 = 5/6', '帶分數：7/4 = 1 又 3/4'], agencies: ['小數點', '通分', '約分'], issue: 'fraction' },
    { id: 'taiwan',   title: '台灣的地形',   tag: '#社會', model: 'bigtree', district: 'zhongzheng', grade: 5, quiz: 'taiwan', summary: '認識台灣的山脈、河川、平原與氣候，知道各地的特色。', why: '了解自己生長的土地，才知道為什麼這裡會下雨、那裡種什麼。', facts: ['台灣最高峰是玉山，約 3952 公尺', '中央山脈縱貫南北', '最長的河是濁水溪', '西部多平原、東部多山', '北回歸線經過嘉義和花蓮', '夏天常有颱風，冬天有東北季風'], agencies: ['山脈', '河川', '氣候'], issue: 'social' },
    // 五年級下
    { id: 'eng2',     title: '英語句型',     tag: '#英語', model: 'school',  district: 'daan', grade: 5, quiz: 'eng2', summary: 'be 動詞、現在式與疑問句，會問會答簡單的英文對話。', why: '有了句型，單字才能組成完整的句子，和外國朋友聊天。', facts: ['I am / You are / He is / She is', 'Do you like apples? Yes, I do.', 'What time is it? It is seven o\'clock.', 'There is a cat. There are two dogs.', '現在進行式：She is reading.', '星期：Monday 到 Sunday'], agencies: ['be 動詞', '疑問句', '對話'], issue: 'english' },
    { id: 'force',    title: '力與運動',     tag: '#自然', model: 'elderhome', district: 'daan', grade: 5, quiz: 'force', summary: '力可以改變物體的形狀和運動，認識重力、摩擦力和彈力。', why: '為什麼球會掉下來、腳踏車會停？懂了力，就能解釋生活裡的現象。', facts: ['重力：地球把東西往下拉', '摩擦力：讓滑動的東西慢下來', '彈力：彈簧被壓後會彈回去', '力有大小和方向', '用彈簧秤量力的大小', '粗糙的表面摩擦力比較大'], agencies: ['重力', '摩擦力', '彈力'], issue: 'science' },
    // 六年級上
    { id: 'ratio',    title: '比與比值',     tag: '#數學', model: 'court',   district: 'xinyi', grade: 6, quiz: 'ratio', summary: '用比表示兩個量的關係，會求比值、化簡比和算百分率。', why: '比例尺、打折、濃度都是比，是國中數學最常用的工具之一。', facts: ['3：4 讀作 3 比 4，比值是 3/4', '前項和後項同乘同除一個數，比不變', '6：8 化簡是 3：4', '50% 就是 50/100 = 1/2', '打 8 折 = 原價 × 0.8', '速率 = 距離 ÷ 時間'], agencies: ['比值', '百分率', '速率'], issue: 'fraction' },
    { id: 'solar',    title: '太陽系與月相', tag: '#自然', model: 'smartpole', district: 'xinyi', grade: 6, quiz: 'solar', summary: '八大行星、地球的自轉與公轉，以及月亮為什麼會圓缺。', why: '抬頭看星星月亮時，知道它們怎麼動，宇宙就不再神祕。', facts: ['八大行星由近到遠：水金地火木土天海', '地球自轉一圈是一天', '地球繞太陽公轉一圈是一年', '月亮繞地球一圈約 29.5 天', '滿月時月亮在地球的背光側', '太陽是恆星，會自己發光'], agencies: ['行星', '自轉', '月相'], issue: 'science' },
    // 六年級下
    { id: 'geometry', title: '圓與面積',     tag: '#數學', model: 'busstop', district: 'wenshan', grade: 6, quiz: 'geometry', summary: '圓周率、圓面積與圓周長，三角形和平行四邊形的面積。', why: '面積和周長在蓋房子、鋪地板時天天用到，也是國中幾何的起點。', facts: ['圓周率 π 約 3.14', '圓周長 = 直徑 × 3.14', '圓面積 = 半徑 × 半徑 × 3.14', '長方形面積 = 長 × 寬', '三角形面積 = 底 × 高 ÷ 2', '平行四邊形面積 = 底 × 高'], agencies: ['圓周率', '面積', '周長'], issue: 'fraction' },
    { id: 'reading',  title: '閱讀理解與作文', tag: '#國語', model: 'theater', district: 'wenshan', grade: 6, quiz: 'reading', summary: '抓出文章的主旨和重點，用起承轉合寫出有條理的作文。', why: '讀得懂、寫得清楚，是每一科都需要的基本功。', facts: ['主旨：作者最想說的一句話', '段落大意：每一段在講什麼', '起承轉合：開頭、發展、轉折、結尾', '先列大綱再動筆', '用具體的例子支持想法', '寫完要檢查錯字和標點'], agencies: ['主旨', '大綱', '起承轉合'], issue: 'zhuyin' },
  ],
  // 單元挑戰：每一波從已開放（startsAt 到了）的挑戰挑一個，決定這一波小怪的組合（mix）與頭上台詞（chants）；intensity 讓小怪群大一點。routes、boss 是舊版的欄位，闖關不使用
  issues: [
    { id: 'count',    title: '數與加減',   tag: '#數學', startsAt: '2026-09-01', intensity: 1.0, routes: ['west','north'], boss: null,       mix: { mouse: 3, bird: 1, parrot: 1 }, chants: ['3+5=9?','忘記進位','借位呢','數錯了','少算一個'], desc: '粗心鼠為主，從彩虹河與雲朵灣來。' },
    { id: 'zhuyin',   title: '注音與國字', tag: '#國語', startsAt: '2026-09-01', intensity: 1.0, routes: ['west','south'], boss: null,       mix: { bird: 3, frog: 1, caterpillar: 1 }, chants: ['ㄓㄗ不分','寫錯字','筆順亂七八糟','的得地','在再不分'], desc: '分心鳥群從故事溪飛進來。' },
    { id: 'times',    title: '乘法與除法', tag: '#數學', startsAt: '2026-09-15', intensity: 1.1, routes: ['east','north'], boss: null,       mix: { parrot: 2, mouse: 3, frog: 1 }, chants: ['7×8=54?','九九表忘了','餘數呢','抄答案','同上'], desc: '複製鸚鵡與粗心鼠一起來。' },
    { id: 'english',  title: '英語單字',   tag: '#英語', startsAt: '2026-10-01', intensity: 1.2, routes: ['north','east'], boss: 'bigv',     mix: { chameleon: 2, bird: 2, mouse: 1 }, chants: ['apple怎麼拼','大小寫','I am 還是 I is','Monday?','忘記 s'], desc: '藉口龍帶隊，錯字大嘴鳥壓陣。' },
    { id: 'science',  title: '自然觀察',   tag: '#自然', startsAt: '2026-10-15', intensity: 1.2, routes: ['west','south'], boss: 'ironfan',  mix: { caterpillar: 2, chameleon: 2, bird: 1 }, chants: ['忘記記錄','水蒸氣看得到?','沒澆水','不聽不聽','實驗沒做完'], desc: '瞌睡蟲慢慢爬，鐵頭龍殿後。' },
    { id: 'social',   title: '地圖與方位', tag: '#社會', startsAt: '2026-10-15', intensity: 1.1, routes: ['east','south'], boss: 'missile',  mix: { bird: 2, parrot: 2, mouse: 1 }, chants: ['東邊是哪邊','上北下南?','迷路了','比例尺是什麼','圖例看不懂'], desc: '分心鳥與複製鸚鵡亂飛，問號鸚鵡在天上丟問號。' },
    { id: 'fraction', title: '分數與小數', tag: '#數學', startsAt: '2026-11-01', intensity: 1.4, routes: ['west','south','east'], boss: 'frogking', mix: { caterpillar: 2, frog: 2, parrot: 1 }, chants: ['分母相加?','小數點呢','1/2 比 1/3 小?','沒通分','約分忘了'], desc: '拖延蛙群跳進來，大考蛙王殿後。' },
    { id: 'final',    title: '期末大考',   tag: '#期末考', startsAt: null, intensity: 2.2, routes: ['west','north','east','south'], boss: 'frogking', boss2: 'bigv', mix: { bird: 3, frog: 3, parrot: 2, caterpillar: 1, chameleon: 1, mouse: 4 }, chants: ['期末考!!','全部都考','默寫!','背起來','最後一題','時間到!!','交卷!','考試大成功'], desc: '四面八方、所有小怪、兩隻魔王。一樣守得下來。' },
  ],
  // ═══ 逛校園：自己的角色（穿著金蛋買的衣服）在草原小鎮散步；服飾店買衣服、工地投金蛋蓋校園、找校長捐書。其他正在逛的人也看得到 ═══
  explore: {
    speed: 1.35, radius: 0.14, pathNodes: 90000,   // 走路速度（每秒幾個世界單位）、碰撞半徑、跨區塊找路最多展開幾格
    // 服飾店：[島, 第幾棟小房子 0～2]（一律畫成商店）。要選鏡頭看得到的位置：廣場島的 1、2 號在地標兩側，會被大地標擋住
    boutiques: [['datong', 0], ['daan', 0], ['zhongshan', 0], ['beitou', 0], ['wanhua', 0], ['songshan', 0], ['wenshan', 0]],
    near: { boutique: 1.0, site: 1.05, mayor: 0.9 }, // 走到幾格內出現「進去」按鈕
    clockStart: 600, clockRate: 6,  // 逛校園的時鐘：從 10:00 開始，每秒走幾分鐘（遊戲時間）
    times: [ { min: 360, icon: '🌅', label: '清晨 06' }, { min: 720, icon: '☀️', label: '白天 12' }, { min: 1080, icon: '🌇', label: '黃昏 18' }, { min: 1260, icon: '🌙', label: '夜晚 21' } ],
    birdHeight: 16, birdBack: 3,      // 鳥瞰：鏡頭在目前場景正上方多高、往後退多少
    fireworks: { every: 1.4, night: 0.5 }, // 全校加成「校慶嘉年華」解鎖後，晚上（天色暗度 ≥ night）每 every 秒放一發煙火
    multi: { sendEvery: 0.5, sendPerPlayer: 0.1, sendMax: 4, heartbeat: 6, timeout: 20, presenceGrace: 5, maxRemote: 40, snapDist: 4, bubbleSeconds: 3, emoteCooldown: 1.5, rxMinGap: 0.12 },
    emotes: [ { k: 'hi', icon: '👋', say: '嗨！' }, { k: 'yay', icon: '🎉', say: '讚啦！' }, { k: 'love', icon: '❤️', say: '一起加油！' }, { k: 'thx', icon: '🙏', say: '謝啦！' } ],
    five: { k: 'five', icon: '🙌', say: '擊掌！' },
    guideKey: 'pi-guide-explore', worldKey: 'pi-world', // worldKey：上次在哪個世界（city 逛校園／work 闖關場），下次直接回去
    // 闖關現場：正在闖關的房主（或單人）每 send 秒最多送一次這關的摘要（換波、魔王出現或倒下時才送），沒變化時 heartbeat 秒送一次；逛校園的人 expire 秒沒收到就移除
    live: { send: 3, heartbeat: 10, expire: 25, maxShifts: 30, ghostMax: 5 },
  },
  // ═══ 金蛋經濟：金蛋靠闖關與解題賺，可以買衣服、大家一起蓋校園、捐書給圖書館 ═══
  // 錢包 = 累計金蛋 − 衣服花掉的 − 蓋校園投入的 − 捐書。衣服在逛校園時走進服飾店買（買過的隨時能換）；id 不能改（存在玩家資料裡）；同一類一次穿一件。
  // 穿著字串：帽子.背心.配件.套裝（舊的三段式照樣認得）
  econ: {
    legal: '金蛋是遊戲點數，只能靠闖關搬進籃子或答對題目賺，不是錢、不能買也不能換錢。「捐書」是遊戲玩法，不是真的捐款。',
    outfits: {
      // 變裝系列套裝：price 0 的 10 套免費、隨時隨地換；其他的在服飾店用金蛋買。穿上會蓋過帽子、背心、配件（脫下套裝就回到原本的穿著）
      suit: { label: '變裝派對', items: {
        pumpkin: { name: '南瓜頭同學', icon: '🎃', price: 0, desc: '頭殼空空，但上課超認真。' },
        zombie:  { name: '熬夜殭屍', icon: '🧟', price: 0, desc: '昨天寫作業寫到太晚，今天只想睡覺。' },
        vampire: { name: '吸血鬼圖書館長', icon: '🧛', price: 0, desc: '不吸血，只吸收知識。' },
        ghost:   { name: '颱風假許願鬼', icon: '👻', price: 0, desc: '每年夏天都在學校門口飄：求放一天就好。' },
        witch:   { name: '掃把巫婆', icon: '🧙', price: 0, desc: '掃把要先掃完教室才能起飛。' },
        mummy:   { name: '考卷木乃伊', icon: '🩹', price: 0, desc: '被層層考卷包起來，訂正到一半。' },
        boba:    { name: '全糖珍奶怪', icon: '🧋', price: 0, desc: '全糖去冰，喝一口就想去闖關。' },
        cone:    { name: '操場施工中', icon: '🚧', price: 0, desc: '這條跑道上個月才整修過，這個月再修一次。' },
        truck:   { name: '下課鐘聲車', icon: '🎵', price: 0, desc: '音樂一響，全校的人都衝出來。' },
        bat:     { name: '夜讀蝙蝠', icon: '🦇', price: 0, desc: '晚上讀書最清醒，白天倒掛補眠。' },
        bag:      { name: '書包怪', icon: '🛍️', price: 18, desc: '頭上套著書包，三公尺外就聞得到便當味。' },
        cutlet:   { name: '比臉大雞排', icon: '🍗', price: 25, desc: '雞排比臉還大，拿來擋太陽剛好。' },
        poncho:   { name: '雨衣俠', icon: '🛵', price: 15, desc: '雨衣一穿，傾盆大雨照樣上學。' },
        delivery: { name: '便當外送鬼', icon: '📦', price: 20, desc: '中午十二點準時把便當送到教室。' },
        card:     { name: '餘額不足卡', icon: '💳', price: 22, desc: '嗶——餘額不足，請加值。' },
        firework: { name: '校慶煙火頭', icon: '🎆', price: 40, desc: '頭上一棟樓，倒數十秒就開始放。' },
        bear:     { name: '台灣黑熊', icon: '🐻', price: 35, desc: '胸口一道 V，出來逛校園順便宣導保育。' },
        leopard:  { name: '石虎', icon: '🐆', price: 35, desc: '過馬路請走斑馬線，車子請慢行。' },
        pigeon:   { name: '操場鴿子王', icon: '🐦', price: 20, desc: '操場上的麵包屑歸我管。' },
        nightshift: { name: '福利社店員', icon: '🏪', price: 15, desc: '下課十分鐘賣完一百個麵包的專家。' },
        parking:  { name: '腳踏車格怪', icon: '🅿️', price: 25, desc: '走到哪裡都自帶車位，被畫線了就走不了。' },
        duck:     { name: '巨大黃色鴨鴨', icon: '🦆', price: 30, desc: '漂到哪裡，哪裡就塞滿同學。' },
        taro:     { name: '芋圓頭', icon: '🍡', price: 20, desc: '爬完樓梯到頂樓，頭上就長出芋圓。' },
        tofu:     { name: '臭豆腐頭', icon: '🧈', price: 25, desc: '遠遠就聞得到，靠近才知道好吃。' },
        prince:   { name: '電音三太子', icon: '👑', price: 60, desc: '戴墨鏡下凡，說是來看運動會。' },
        megaphone:{ name: '大聲公啦啦隊', icon: '📣', price: 30, desc: '運動會一早就在操場喊「加油加油」。' },
        pumpbus:  { name: '南瓜校車', icon: '🚌', price: 50, desc: '午夜十二點一到，就變回一般校車。' },
        skeleton: { name: '考到只剩骨頭', icon: '💀', price: 30, desc: '期末考前一週的樣子。' },
        alien:    { name: '來上學的外星人', icon: '👽', price: 30, desc: '上完數學課，決定回火星繼續算。' },
        lantern:  { name: '天燈頭', icon: '🏮', price: 25, desc: '願望寫在臉上：考一百、放假、不用訂正。' } } },
      hat: { label: '帽子', items: {
        helmet: { name: '工地安全帽', icon: '⛑️', price: 10 }, straw: { name: '斗笠', icon: '👒', price: 10 }, cap: { name: '棒球帽', icon: '🧢', price: 15 }, beanie: { name: '毛帽', icon: '🧶', price: 15 },
        chef: { name: '廚師帽', icon: '👨‍🍳', price: 25 }, bunny: { name: '兔耳朵', icon: '🐰', price: 35 }, egg: { name: '頭頂金蛋', icon: '🥚', price: 50 }, crown: { name: '金蛋皇冠', icon: '👑', price: 80 } } },
      color: { label: '背心', items: {
        mint: { name: '薄荷綠', icon: '🟢', price: 8, c: 0x58a6a6 }, navy: { name: '深藍', icon: '🔵', price: 8, c: 0x26365c }, pink: { name: '櫻花粉', icon: '🌸', price: 12, c: 0xf2a1a1 }, purple: { name: '葡萄紫', icon: '🟣', price: 12, c: 0x8a6fc0 },
        black: { name: '酷黑', icon: '⚫', price: 15, c: 0x2b2b30 }, gold: { name: '金蛋金', icon: '🟡', price: 40, c: 0xf2c14e } } },
      acc: { label: '配件', items: {
        scarf: { name: '圍巾', icon: '🧣', price: 12 }, sash: { name: '彩帶', icon: '🎗️', price: 20 }, cape: { name: '英雄披風', icon: '🦸', price: 45 } } },
    },
    // 蓋校園：在逛校園時走到工地投金蛋（新校區是在要接的那個區塊的門口）。所有人投入的金蛋加總，依序蓋；蓋好的建築換掉那個區塊原本的小房子（house = 第幾棟小房子 0～2），大家的地圖上都看得到。投入的金蛋也算進自己學期的對抗。
    city: [
      { id: 'fountain', name: '金蛋噴水池',   island: 'xinyi',      house: 0, model: 'garden',     cost: 30 }, // 校長室右前方（1 號在校長室左邊，會被大樓擋住）
      { id: 'market2',  name: '福利社',       island: 'shilin',     house: 0, model: 'nightmarket', cost: 60 },
      { id: 'stage',    name: '操場舞台',     island: 'datong',     house: 2, model: 'stage',      cost: 100 },
      // kind: 'island'＝新校區：放在學期格子旁邊的空格（grid），蓋好時野地變成新的區塊、通往相鄰區塊的門打開（link；via＝橋名）；
      // 蓋的時候在 link 區塊通往新校區的門口投金蛋。不算學期對抗。
      { id: 'sanchong', name: '音樂島', kind: 'island', grid: [4, 1], link: 'datong', via: '音符橋', ground: 'street', landmark: 'nightmarket', cost: 160 },
      { id: 'nursery',  name: '幼兒園遊戲室', island: 'neihu',      house: 0, model: 'nursery',    cost: 190 },
      { id: 'teahouse', name: '茶藝教室',     island: 'wenshan',    house: 1, model: 'theater',    cost: 230 },
      { id: 'sports',   name: '運動中心',     island: 'nangang',    house: 0, model: 'football',   cost: 280 },
      { id: 'yonghe',   name: '美術島', kind: 'island', grid: [1, 3], link: 'zhongzheng', via: '畫筆橋', ground: 'courtyard', landmark: 'housing', cost: 360 },
      { id: 'housing',  name: '學生宿舍',     island: 'wanhua',     house: 2, model: 'housing',    cost: 400 },
      { id: 'dome2',    name: '小巨蛋體育館', island: 'songshan',   house: 1, model: 'dome',       cost: 460 },
      { id: 'clock',    name: '校園鐘樓',     island: 'zhongzheng', house: 0, model: 'clock',      cost: 540 },
      { id: 'xizhi',    name: '科學島', kind: 'island', grid: [-1, 1], link: 'nangang', ground: 'gravel', landmark: 'techcampus', cost: 650 },
      { id: 'egg101',   name: '金蛋 101',     island: 'daan',       house: 2, model: 'tower101',   cost: 800 },
      { id: 'banqiao',  name: '體育島', kind: 'island', grid: [-1, 2], link: 'wanhua', via: '跳繩橋', ground: 'granite', landmark: 'station', cost: 900 },
      { id: 'zhonghe',  name: '圖書島', kind: 'island', grid: [0, 3], link: 'wanhua', via: '書本橋', ground: 'garden', landmark: 'temple', cost: 1000 },
      { id: 'xindian',  name: '生態島', kind: 'island', grid: [2, 3], link: 'wenshan', ground: 'boardwalk', landmark: 'park', cost: 1100 },
      { id: 'tamsui',   name: '天文島', kind: 'island', grid: [1, -1], link: 'beitou', ground: 'terracotta', landmark: 'oldstreet', cost: 1250 },
      { id: 'xinzhuang', name: '電腦島', kind: 'island', grid: [4, 2], link: 'sanchong', ground: 'schoolyard', landmark: 'school', cost: 1400 }, // 接音樂島（要先蓋好音樂島）
    ],
    buildAmounts: [5, 20, 50],
    // 捐書：在逛校園時走到校長旁邊捐。全站累計到 at 顆解鎖全校加成，所有人都吃得到；自己捐了校長會回一句
    donate: { amounts: [5, 20, 50, 100], boardMax: 10,
      tiers: [
        { at: 100,  name: '圖書角', desc: '闖關：受到的傷害 −10%', shift: { dmg: 0.1 } },
        { at: 300,  name: '全校動員', desc: '闖關：每波配額 −1', shift: { quota: -1 } },
        { at: 700,  name: '神隊友加持', desc: '闖關：特殊技多 1 次', shift: { specials: 1 } },
        { at: 1500, name: '校慶嘉年華', desc: '逛校園：晚上放煙火', fireworks: true },
      ],
      lines: {
        small: ['謝謝！一顆也是心意', '收到！這顆拿去買繪本', '感謝，圖書館多一本故事書'],
        mid: ['感謝！明天就進一套百科全書', '收到！圖書角多一排書架', '謝謝！閱讀課多一本新書'],
        big: ['哇，大書迷！圖書館要擴建了', '感謝大力支持，書單全部公開（遊戲裡的）', '這麼多！我請全校喝珍奶（遊戲裡的）'],
        tier: '全校加成解鎖：{name}！謝謝大家！', thanks: '感謝 {nick} 的金蛋，圖書館的書越來越多！',
      } },
  },
  palette: { coral: 0xdb6a41, ink: 0x211d1d, cream: 0xfff8f4, yellow: 0xfcea8b, green: 0x8fb37a, stone: 0xd9cbb4, accent: 0xdb6a41, gold: 0xf2c14e },
  // 校園信箱（右側卡片）與校園快訊（底部跑馬燈）
  ticker: { hotlineRows: 3, hotlineSeconds: 8, hotlineSlideMs: 700, pxPerSec: 90, mixHotlineEvery: 3, hotlineGenShare: 0.45, weights: { monster: 0.30, tip: 0.28, quiz: 0.16, campus: 0.14, fun: 0.12 } }, // weights：小怪糗事／學習小訣竅／快問快答／校園快訊／冷知識的出現比例
  canonicalHost: 'taipei-hold-the-line.pages.dev',
  // 跟隨鏡頭：lookUp = 看向對象頭部的高度；stiffness 越大跟得越緊
  follow: { lookUp: 0.35, stiffness: 6 },
  // 一起闖關（Supabase Realtime）：房間最多 roomMax 人，房主的瀏覽器跑模擬、每秒送 snapHz 次快照；其他人每秒送 upHz 次自己的位置（沒動時 heartbeat 秒一次）
  // 頻道：shift-<房號> 給房主廣播與成員名單（presence），shift-<房號>-u-<人> 每位成員一條、只有房主收，訊息量只跟人數成正比
  net: { roomMax: 4, codeLen: 4, codeChars: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', snapHz: 5, upHz: 6, heartbeat: 1.5, hostGrace: 8, waitBeat: 5, smooth: 9, protocol: 2, autoStartFull: 3, maxSpeedSlack: 1.6 },
  // 快速訊號（預設三句，不開放打字）
  emotes: [ { k: 'here', icon: '👉', say: '這邊！' }, { k: 'help', icon: '🆘', say: '救我！' }, { k: 'yay', icon: '🎉', say: '讚啦！' } ],
  emoteCooldown: 1.2, bubbleSeconds: 2.6,
  controls: { joyR: 46, joyDead: 0.12, tapMoveExact: 0.9 },
  ui: { logMax: 30, leaderboardMax: 10, heroesQueryLimit: 1000, districtPanelKey: 'pi-dpanel' }, // districtPanelKey：左上學期對抗面板收合狀態存在裝置上的 key
};
window.PI_CONFIG = CONFIG;
