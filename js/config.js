/* 萬安政策島 打工 — 所有可調參數。其他檔案不得出現魔術數字。
   玩法像斯普拉遁的打工：最多 4 人一隊（人不夠由 NPC 同事補），一班 3 波，打倒魔王會掉金蛋，搬進金蛋籃湊滿配額才過關。
   新增議題：issues 加一筆（或從後台新增），它決定這一波雜魚的組合與頭上台詞。新增敵人：animals 加一筆，model 指到 animals.js 的外型。 */
export const CONFIG = {
  site: {
    name: '萬安政策島', sub: '打工・搬金蛋', tag: '二創惡搞・非官方', proj: '打工', tribute: '致敬沈伯洋的政策島',
    credit: '島嶼、人物與場景的做法參考 puma.taipei 的「HEART 政策島」互動頁，重新實作；打工玩法致敬斯普拉遁的打工模式，全部重新設計。',
    parody: '二創惡搞作品｜非官方',
    parodyLong: '這是網友自製的二創惡搞打工遊戲，不是台北市政府、蔣萬安本人或任何政黨、競選團隊的官方內容，也沒有收到任何委託或贊助。',
    disclaimer: '政策摘要整理自公開報導、僅供遊戲參考，細節以官方資訊為準。地標與建築是象徵性的迷你模型；議題、數值、動物與魔王都是遊戲設定，攻擊方動物是虛構角色，台詞改編自網路流行語並誇張化處理，不指涉任何真實人物。市長角色是 Q 版遊戲 NPC，台詞是遊戲旁白與政策摘要，不代表本人發言；NPC 同事的名字都是虛構的。',
  },
  election: { date: '2026-11-28', tz: 'Asia/Taipei', finalIssueId: 'final', hazardBonus: 0.15 }, // 大選前一晚起：每一波都是總攻擊議題、危險度加 hazardBonus
  // 一班：waves 波、每波 waveSeconds 秒；開場 introSeconds 秒、波與波之間 interSeconds 秒（這段時間會把倒下的人全部救起、清場）
  shift: {
    waves: 3, waveSeconds: 100, introSeconds: 4, interSeconds: 7, resultLinger: 1.2, autoCity: 8, // autoCity：單人打完幾秒後自動飛回城市（房間裡不自動）
    // 配額 = qBase[第幾波] + qHazard[第幾波] × 危險度（危險度 0.3～2.0）
    qBase: [10, 12, 14], qHazard: [8, 9, 10],
    // 魔王：每 bossEvery ÷ (bossK0 + bossK1 × 危險度) 秒來一隻，同時最多 bossMax0 + bossMax1 × 危險度 隻
    bossEvery: 9, bossK0: 0.7, bossK1: 0.35, bossMax0: 4, bossMax1: 2, bossFirst: 4,
    // 雜魚：每 lesserEvery ÷ (lesserK0 + lesserK1 × 危險度) 秒來一群，一群 groupBase + groupHazard × 危險度 隻，同時最多 lesserMax0 + lesserMax1 × 危險度 隻
    lesserEvery: 11, lesserK0: 0.8, lesserK1: 0.3, groupBase: 3, groupHazard: 2, groupGap: 0.3, lesserMax0: 14, lesserMax1: 6, lesserFirst: 1.5,
    enemyCap: 34,              // 場上敵人總數上限（手機效能）
    hpK0: 0.75, hpK1: 0.25,    // 敵人血量倍率 = hpK0 + hpK1 × 危險度
    dmgK0: 0.65, dmgK1: 0.35,  // 敵人傷害倍率 = dmgK0 + dmgK1 × 危險度（見習生被打比較輕）
    unitsPerSec: 1,            // 敵速 1.0 = 每秒走幾個世界單位（一座島直徑約 4）
    landSeconds: 1.2,          // 從水裡游上岸的時間
    separation: 0.28,          // 敵人彼此推開的距離
    retarget: 0.8,             // 敵人每幾秒重新挑最近的人
    aggroRange: 14,
    // 特殊波：第 1 波 specialFirst、之後每波 specialChance 的機率
    specialChance: 0.25, specialFirst: 0.12,
    fog: { near: 2.5, far: 10, lesserMul: 1.4, goldAt: [12, 42, 72] },
    rush: { time: 1300, groupEvery: 2.6, groupK: 0.25, group: 6, groupHazard: 2, cap: 30, goldEvery: 7, goldK0: 0.75, goldK1: 0.3, goldMax: 3, goldMaxK: 1, switchEvery: 12 }, // 暴走夜：每 groupEvery÷(1+groupK×危險度) 秒一群暴走鼠；金鍵盤鼠每 goldEvery÷(goldK0+goldK1×危險度) 秒一隻
    dayTimes: [600, 780, 960], // 一般波的天色：早上、中午、下午（分鐘）
    // 金蛋
    egg: { perBoss: 3, pickR: 0.32, basketR: 0.72, carrySpeed: 0.8, throwDist: 1.7, throwTime: 0.45, throwAim: 2.7, scatter: 0.45 },
    // 打工仔
    player: { hp: 100, radius: 0.14, regenDelay: 2.5, regen: 40, reviveR: 0.55, reviveTime: 0.9, reviveDecay: 1.5, invAfterRevive: 2, invAfterHit: 0.35 },
    specials: 2,               // 一班可以放幾次特殊技
    projSpeed: 10, focusR: 0.9, threatR: 0.9,
    cameraDist: 10, cameraDistNarrow: 12, cameraPolar: 30, // 開工時鏡頭跟著自己：距離與俯角（離垂直幾度，越小越像俯視，比較不會被建築擋住）
  },
  // 每 rotateHours 小時換一個打工場（大家同時間看到同一個場）
  rotateHours: 2,
  // 打工場：basket = 金蛋籃所在的島（島中央前方有廣場），islands = 這個場用到的島（敵人從外圍島的岸邊登陸）
  stages: [
    { id: 'xinyi',      name: '信義市府廣場', basket: 'xinyi',      islands: ['xinyi', 'daan', 'songshan', 'nangang', 'wenshan'] },
    { id: 'daan',       name: '大安森林公園', basket: 'daan',       islands: ['daan', 'zhongzheng', 'wenshan', 'xinyi', 'zhongshan'] },
    { id: 'zhongzheng', name: '艋舺車站前',   basket: 'zhongzheng', islands: ['zhongzheng', 'wanhua', 'datong', 'daan'] },
    { id: 'zhongshan',  name: '中山圓山',     basket: 'zhongshan',  islands: ['zhongshan', 'datong', 'shilin', 'neihu', 'songshan'] },
    { id: 'shilin',     name: '士林社子島',   basket: 'shilin',     islands: ['shilin', 'beitou', 'neihu', 'shezi'] },
  ],
  // 島的大小與整張地圖的間距（相對最早的版本）：島放大 islandK 倍、地圖攤開 mapK 倍
  world: { islandK: 1.15, mapK: 1.25 },
  plaza: { z: 0.5, len: 1.1, r: 0.5, basketZ: 0.62 }, // 金蛋籃廣場：島中心往前 z 開始、長 len、半寬 r 的走道不放建築；籃子在中心往前 basketZ
  // 打工職級：點數 0～100，滿 100 升一級（從 promoteTo 點開始），低於 0 降一級（從 demoteTo 點開始）；最高級的點數可以一直累積
  grades: {
    names: ['見習生', '工讀生', '約聘', '正職', '股長', '科長', '局長'],
    hazard: [0.3, 0.45, 0.6, 0.8, 1.0, 1.2, 1.4], hazardPerPts: 0.2, topPtsCap: 999, topHazardMax: 2.0,
    clear: 20, fail: [-20, -10, 0], failSafeBelow: 2, promoteTo: 40, demoteTo: 80, // failSafeBelow：這級以下失敗不扣點
    storageKey: 'pi.grade.v1',
  },
  // 打工點數（只是好玩的薪水單）：每過一波、每顆金蛋、每隻勸退、每次救人
  pay: { wave: 120, egg: 15, kill: 1, rescue: 10, clearBonus: 200 },
  // 市長在金蛋籃旁邊廣播（像打工的老闆）
  mayor: { name: '蔣萬安市長', speed: 0.5, speechSeconds: 5.5, pauseSeconds: 0.8, approach: 0.45, sloganMax: 22, sayFacts: 3, cheerRadius: 2.2,
    lines: {
      intro: '各位同事，開工囉！金蛋搬進籃子！', wave: '第 {n} 波！配額 {q} 顆金蛋！', fog: '起大霧了，看不清楚就跟緊彼此！', rush: '暴走夜！被肉搜的人快跑，其他人掩護！',
      boss: '{name}來了！打倒會掉金蛋！', quota: '達標！多搬的算加班費！', hurry: '還差 {k} 顆，衝啊！', clearWave: '這波收工！喘口氣！', fail: '全倒了⋯這班先收工', timeup: '時間到，配額還差 {k} 顆⋯', clear: '三波全過！今天辛苦了！',
    } },
  // 居民：平常在步道上散步；開工時打工場上的居民會先離開
  residents: { perIsland: 7, speed: [0.32, 0.40], bikeSpeed: [0.62, 0.70], roles: ['citizen','elder','child','parent','officeworker','youth','cyclist','worker','hiker','servant','researcher','farmer','traveler'] }, // 走路速度 0.32～0.40、腳踏車 0.62～0.70
  // 打工仔職業（id 不要改：Supabase heroes.cls 有檢查）。武器自動瞄準射程內的敵人；點敵人＝鎖定它
  // special：一班 2 次的特殊技
  heroes: {
    chief:     { name: '里長伯',   icon: '🧓', color: 0xdb6a41, dmg: 26, rate: 0.4,  range: 3.2, style: 'ball',  speed: 1.55, weapon: '大聲公',     desc: '中距離穩定輸出。', special: { id: 'broadcast', name: '里民廣播', desc: '身邊 3.5 格的敵人全部定住 3 秒並受到重傷。', r: 3.5, dmg: 300, stun: 3 } },
    driver:    { name: '公車司機', icon: '🚌', color: 0x2f6f9f, dmg: 12, rate: 0.16, range: 2.8, style: 'bus',   speed: 1.7,  weapon: '票卡連發',   desc: '射速最快、跑最快。',     special: { id: 'dash',      name: '公車衝鋒', desc: '開著公車往前衝 4.5 格，撞到的敵人受重傷，衝的時候不會受傷。', dist: 4.5, time: 0.6, w: 0.7, dmg: 600 } },
    fireman:   { name: '消防員',   icon: '🚒', color: 0xc9452f, dmg: 30, rate: 0.5,  range: 3.0, style: 'water', speed: 1.5, slow: 0.45, slowTime: 1.4, weapon: '水柱', desc: '打到會減速（魔王也有效）。', special: { id: 'hose', name: '水砲全開', desc: '8 秒內射速 3 倍、射程 +1、傷害 +20%。', time: 8, rateMul: 3, rangeAdd: 1, dmgMul: 1.2 } },
    volunteer: { name: '志工媽媽', icon: '🧺', color: 0xc97d97, dmg: 18, rate: 0.4,  range: 2.8, style: 'ball',  speed: 1.55, reviveMul: 2, weapon: '愛心飯糰', desc: '救人速度 2 倍。',        special: { id: 'bento',     name: '愛心便當', desc: '5 格內倒下的隊友全部救起、所有人補滿血並無敵 4 秒。', r: 5, inv: 4 } },
    engineer:  { name: '工程師',   icon: '💻', color: 0x4a3f8f, dmg: 40, rate: 0.8,  range: 3.4, style: 'zap', chain: 3, speed: 1.45, weapon: '台北通電擊', desc: '連鎖電擊一次打 3 隻。', special: { id: 'chain',     name: '台北通連鎖', desc: '6 格內最多 10 隻敵人各受 350 傷害。', r: 6, n: 10, dmg: 350 } },
  },
  // 敵人。model：bird / frog / worm / lizard / mouse / tower
  // 雜魚：hp 血量、speed 速度、dmg 近戰傷害、range 攻擊距離；parrot 會吐口水（ranged）
  // 魔王（boss: true）：打倒掉 egg.perBoss 顆金蛋；ai 決定招式。金色的（gold）被打會掉金蛋
  animals: {
    mouse:       { name: '鍵盤鼠',   model: 'mouse',  color: 0x9e9e9e, accent: 0x616161, hp: 30,   speed: 1.75, dmg: 18, size: 0.75, chants: ['已檢舉','笑死','認知作戰!','我不是1450','破防了','可悲'] },
    bird:        { name: '青鳥',     model: 'bird',   color: 0x17a3b4, accent: 0x0d7281, hp: 70,   speed: 1.3,  dmg: 30, size: 1.0, fly: true,  chants: ['青鳥起飛!!','守護民主','出來面對','抗中保台','我是自發的'] },
    frog:        { name: '青蛙',     model: 'frog',   color: 0x4caf50, accent: 0x2e7d32, hp: 200,  speed: 0.85, dmg: 50, size: 1.15, hop: true,  chants: ['呱!!','呱呱抗中保台','芒果乾呱','呱～罷掉'] },
    parrot:      { name: '綠鸚鵡',   model: 'bird',   color: 0x6abf4b, accent: 0xd94a3a, hp: 60,   speed: 1.0,  dmg: 25, size: 0.9, fly: true, ranged: { range: 2.6, speed: 3.2, every: 2.6 }, repeat: true, chants: ['同上','+1','複製貼上','台灣價值+1','芒果乾+1'] },
    caterpillar: { name: '綠毛蟲',   model: 'worm',   color: 0x7cb342, accent: 0x558b2f, hp: 320,  speed: 0.55, dmg: 45, size: 1.1, chants: ['慢慢連署中','排隊簽連署','陳情寫到一半','蠕動中'] },
    chameleon:   { name: '變色龍',   model: 'lizard', color: 0x66bb6a, accent: 0xffb300, hp: 110,  speed: 1.2,  dmg: 35, size: 1.0, stealth: true, chants: ['髮夾彎','此一時彼一時','我沒說過','萊豬不一樣','核電再說'] },
    rushmouse:   { name: '暴走鼠',   model: 'mouse',  color: 0x4ad6c8, accent: 0x167a72, hp: 25,   speed: 2.3,  dmg: 25, size: 0.8, glow: true, chants: ['肉搜!!','找到了','衝衝衝','起底中'] },
    // 魔王
    bigv:        { name: '側翼大V',  model: 'bird',   color: 0x0e5f6b, accent: 0xf2c14e, hp: 520,  speed: 0.75, dmg: 40, size: 1.8, boss: true, ai: 'bomber', fly: false, every: 6.5, windup: 1.6, bombHp: 110, fuse: 1.6, blastR: 1.0, blastDmg: 90, throwRange: 6, desc: '頭頂舉起懶人包丟人；舉著的時候猛打，包會在牠頭上爆炸。', chants: ['懶人包來了','請大家分享','截圖留存','帶風向中'] },
    frogking:    { name: '大青蛙王', model: 'frog',   color: 0x2e7d32, accent: 0xf2c14e, hp: 650,  speed: 0.6,  dmg: 50, size: 2.1, boss: true, ai: 'leaper', hop: true, every: 5, aim: 1.3, air: 0.5, slamR: 0.85, slamDmg: 100, stun: 2, stunMul: 1.5, leapRange: 5, desc: '瞄準一個人跳過去壓；落地後會暈 2 秒，傷害 1.5 倍。', chants: ['呱!!!!','總攻擊','全軍出動','罷免大成功'] },
    ironfan:     { name: '鐵粉龍',   model: 'lizard', color: 0x5d6d7e, accent: 0xd94a3a, hp: 480,  speed: 0.5,  dmg: 70, size: 1.6, boss: true, ai: 'charger', shield: 0.15, shieldArc: 1.05, every: 6, aim: 0.8, chargeSpeed: 3.2, chargeTime: 2.2, stun: 2.5, desc: '正面有鐵粉護盾（只吃 15% 傷害），衝撞後會暈，繞到旁邊或背後打。', chants: ['鐵粉在此','護主!!','不准黑','永遠支持'] },
    spamtower:   { name: '洗版塔',   model: 'tower',  color: 0x3b3a42, accent: 0x4ad6c8, hp: 420,  speed: 0.6,  dmg: 80, size: 1.6, boss: true, ai: 'tower', every: 4.5, aim: 1.1, beamW: 0.35, beamLen: 8, desc: '上岸就不動，一直對人發射洗版光束；看到紅線就閃開。', chants: ['洗版中','複製貼上','留言灌爆','+1+1+1'] },
    missile:     { name: '飛彈鸚鵡', model: 'bird',   color: 0x8bc34a, accent: 0xd94a3a, hp: 380,  speed: 0.8,  dmg: 75, size: 1.7, boss: true, ai: 'missile', fly: true, pods: true, every: 7, aim: 1.6, blastR: 0.75, hover: 15, desc: '停在岸邊上空，對每個人發射飛彈；腳下出現紅圈就快跑。', chants: ['飛彈發射','全員鎖定','標記完成','轟炸開始'] },
    // 金色（特殊波）：被打就掉金蛋
    goldfrog:    { name: '金青蛙',   model: 'frog',   color: 0xf2c14e, accent: 0xb8860b, hp: 300,  speed: 0.9,  dmg: 30, size: 1.3, gold: true, hop: true, glow: true, eggEvery: 0.25, eggOnDeath: 2, chants: ['金金金','發財呱','抓不到'] },
    goldmouse:   { name: '金鍵盤鼠', model: 'mouse',  color: 0xf2c14e, accent: 0xb8860b, hp: 120,  speed: 1.6,  dmg: 20, size: 1.0, gold: true, glow: true, eggOnDeath: 2, chants: ['金鍵盤!','打我啊','給你金蛋'] },
  },
  bossTypes: ['bigv', 'frogking', 'ironfan', 'spamtower', 'missile'],
  lesserTypes: ['mouse', 'bird', 'frog', 'parrot', 'caterpillar', 'chameleon'],
  melee: { range: 0.32, windup: 0.45, cooldown: 1.2, reach: 0.18 }, // 近戰：靠到 range 開始揮，揮完人還在 range + reach 內才算打到
  chant: { on: 2.6, max: 2, every: 1.8, rest: 8, issueShare: 0.65, copyMax: 6, size: 0.32, space: 2.2 },
  // NPC 同事（人不夠時補滿 4 人）。名字都是虛構的
  npc: { names: ['阿明', '小美', '阿凱', '佩佩', '志豪', '雅婷', '阿伯', '小傑', '阿珠', '建宏'], think: 0.25, eggRange: 6, reviveRange: 7, bossRange: 7, home: 2.6, specialBosses: 3, kiteR: 0.8, kiteHp: 70, kiteCrowd: 3, kiteDist: 1.6 }, // kite：雜魚貼身、血少或被圍時先拉開距離
  islands: [
    { id: 'beitou',   number: 1,  axial: [1, 0],  name: '北投區', ground: 'meadow',     landmark: 'hotspring' },
    { id: 'shilin',   number: 2,  axial: [0, 1],  name: '士林區', ground: 'lawn',       landmark: 'palace', plaza: true },
    { id: 'neihu',    number: 3,  axial: [1, 1],  name: '內湖區', ground: 'lawn',       landmark: 'techcampus' },
    { id: 'datong',   number: 4,  axial: [-1, 2], name: '大同區', ground: 'courtyard',  landmark: 'oldstreet' },
    { id: 'zhongshan',number: 5,  axial: [0, 2],  name: '中山區', ground: 'street',     landmark: 'grandhotel', plaza: true },
    { id: 'songshan', number: 6,  axial: [1, 2],  name: '松山區', ground: 'street',     landmark: 'airport' },
    { id: 'nangang',  number: 7,  axial: [2, 2],  name: '南港區', ground: 'gravel',     landmark: 'expo' },
    { id: 'wanhua',   number: 8,  axial: [-2, 3], name: '萬華區', ground: 'terracotta', landmark: 'temple' },
    { id: 'zhongzheng',number: 9, axial: [-1, 3], name: '中正區', ground: 'granite',    landmark: 'station', plaza: true },
    { id: 'daan',     number: 10, axial: [0, 3],  name: '大安區', ground: 'garden',     landmark: 'park', plaza: true },
    { id: 'xinyi',    number: 11, axial: [1, 3],  name: '信義區', ground: 'granite',    landmark: 'cityhall', goal: true, plaza: true },
    { id: 'wenshan',  number: 12, axial: [0, 4],  name: '文山區', ground: 'forest',     landmark: 'gondola' },
    // 社子島：獨立在士林西側的河口沙洲，不跟其他島相鄰，只靠一座陸橋連到士林
    { id: 'shezi',    number: 13, axial: [-1, 1], offset: [-1.9, -0.8], detached: true, link: 'shilin', name: '社子島', ground: 'garden', landmark: 'wetland' },
  ],
  // 地圖上的河口標籤（純裝飾）。
  landings: { west: { island: 'wanhua', name: '淡水河' }, north: { island: 'beitou', name: '關渡' }, east: { island: 'nangang', name: '基隆河' }, south: { island: 'wenshan', name: '景美溪' } },
  // 政策：每一筆是一棟可點擊的建築（政策卡顯示 summary、why、facts 最多 8 條、agencies 主責局處、issue 相關議題代號），沒指定 district 就依 id 雜湊隨機落在某座島。後台（共享資料庫 policies 集合）新增的會自動出現。政策建築在打工時也是障礙物。
  // model 可用：housing nursery elderhome busstop dome techcampus school smartpole garden crane containers theater kiosk station crossing nightmarket hub card court bigtree
  policies: [
    { id: 'housing',   title: '社會住宅',       tag: '#居住',  model: 'housing',    summary: '持續興建與包租代管，讓年輕家庭租得起。', why: '台北租金負擔重，以社宅與租屋協助減輕青年與家庭居住壓力。', facts: ['2023至2025年完工社宅4,805戶', '南港機廠社宅1區1,442戶，分批入住', '南港機廠社宅2區288戶，預計2029年竣工', '「臺北輕鬆住」租金分級補貼', '配合中央包租代管計畫媒合民間空屋'], agencies: ['都發局'], issue: 'housing' },
    { id: 'childcare', title: '托育與育兒支持', tag: '#育兒',  model: 'nursery',    summary: '生育獎勵、公共托育與托育補助，減輕年輕父母負擔。', why: '減輕生育與托育費用負擔，讓家長較能兼顧工作與照顧。', facts: ['生育獎勵金首胎4萬、二胎4.5萬、三胎5萬', '公托由2022年底81處增至2026年94處', '市府目標2026年底公托達108處', '2026年7月起準公托補助每月增3,000元', '2026年宣布第二胎起送托由市府全額補助'], agencies: ['社會局', '民政局'] },
    { id: 'senior',    title: '敬老卡點數',     tag: '#敬老',  model: 'card',       summary: '敬老卡點數加碼，鼓勵長者走出家門。', why: '補貼長者交通與休閒支出，鼓勵外出活動與社會參與。', facts: ['2026年7月起每月點數由480增至600點', '計程車單趟補助2026年2月起提高至85點', '點數可折抵聯合醫院門診掛號費', '可用於運動中心等公有場館', '換發二代卡後剩餘點數可累積'], agencies: ['社會局', '交通局公運處'] },
    { id: 'tpass',     title: 'TPASS 通勤月票', tag: '#交通',  model: 'busstop',    summary: '基北北桃通勤月票，捷運公車與臺鐵區間一票到底。', why: '以定額月票降低通勤族搭乘大眾運輸的交通支出。', facts: ['2023年7月1日上路，售價1,200元', '啟用後連續30天不限次數搭乘', '含捷運、輕軌、公車、客運與臺鐵區間', '北北YouBike 2.0前30分鐘免費', '交通部與基北北桃四市共同推動'], agencies: ['交通局'] },
    { id: 'dome',      title: '大巨蛋啟用',     tag: '#運動',  model: 'dome',       summary: '大巨蛋完工啟用，承辦職棒與大型賽事。', why: '提供大型室內棒球與展演場地，承接國際賽事與活動。', facts: ['2023年10月市府同意核發使用執照', '2023年12月亞洲棒球錦標賽為首場正式賽', '2024年世界12強B組預賽在此舉行', '2025年5月世壯運開幕典禮在此舉行', '滿場約4萬席，BOT案由遠雄興建營運'], agencies: ['體育局'], issue: 'dome', district: 'xinyi' },
    { id: 'techpark',  title: '北士科園區',     tag: '#產業',  model: 'techcampus', summary: '北投士林科技園區招商，輝達台灣總部落腳 T17、T18。', why: '活用北投士林科技園區土地，引進研發型企業與就業機會。', facts: ['2025年5月輝達宣布台灣總部落腳北士科', '2025年11月市府與新壽解約T17、T18', '2026年2月與輝達簽50年地上權契約', '權利金122億元，得再延長20年', '輝達稱預計2026年底動工、2030年啟用'], agencies: ['產業局'], issue: 'nvidia', district: 'beitou' },
    { id: 'bilingual', title: '雙語教育',       tag: '#教育',  model: 'school',     summary: '公立國中小推動雙語課程，搭配數位學習平台。', why: '增加學生在校使用英語的機會，提升溝通與國際交流能力。', facts: ['106學年度起首批2校推動雙語課程', '112學年度逾百所公立國中小實施雙語', '臺北酷課雲線上學習平台', '教育局建置「酷AI」輔助教學系統'], agencies: ['教育局'] },
    { id: 'taipeipass',title: '台北通',         tag: '#智慧',  model: 'smartpole',  summary: '一個 App 搞定市政服務、繳費與點數。', why: '以單一帳號整合市政服務、身分認證與繳費，減少臨櫃往返。', facts: ['2020年9月推出，前身為「台北卡」', '分卡證、服務、帳單、優惠四大功能', '可繳停車費、地方稅與學雜費等', '2021年獲IDC亞太智慧城市獎'], agencies: ['資訊局'] },
    { id: 'green',     title: '公園綠地與護樹', tag: '#環境',  model: 'garden',     summary: '樹木保護自治條例修法，加上閒置地綠美化與公園養護。', why: '保護老樹並增加綠地，改善都市熱環境與生活品質。', facts: ['樹木保護自治條例2003年制定公布', '2025年12月修正，新增暫定受保護機制', '修正後須於3個工作天內派員會勘', '修正條文自公布後6個月施行', '公有閒置地可簡易綠美化並開放認養'], agencies: ['文化局', '工務局公園處'], issue: 'trees' },
    { id: 'renewal',   title: '都市更新',       tag: '#都更',  model: 'crane',      summary: '加速老屋重建與公辦都更。', why: '協助老舊建物重建，提升耐震安全與居住品質。', facts: ['2023年3月推出「都更5箭」', '公辦都更7599專案：意願門檻降至75%', '都更150專案：審議時程以150天為目標', '老公寓增設電梯補助提高至300萬元', '2026年9月南港玉成段公辦都更簽約'], agencies: ['都發局', '都更處'] },
    { id: 'youth',     title: '青年創業',       tag: '#青年',  model: 'containers', summary: '青創貸款利息全額補貼，加上南港創業基地。', why: '降低青年創業的資金與場地門檻，協助新創團隊起步。', facts: ['2024年6月1日成立青年局', '青創貸款期間利息由青年局全額補貼', '一般方案貸款上限200萬元', '2026年起加碼創業準備金，總額達300萬', '南港INNOPAD基地2026年7月開幕'], agencies: ['青年局', '產業局'] },
    { id: 'culture',   title: '藝文場館',       tag: '#文化',  model: 'theater',    summary: '表演藝術中心與藝文補助。', why: '提供展演場地與經費支持，讓藝文團隊能穩定創作與演出。', facts: ['北藝中心2022年啟用，由OMA設計', '大劇場1,500席，可連通成2,300席', '藝文補助每年分上、下半年兩期受理', '北美館擴建2022年9月開工', '臺北兒童藝術節2025年為第26屆'], agencies: ['文化局'] },
    { id: 'metro',     title: '捷運路網延伸',   tag: '#交通',  model: 'station',    summary: '環狀線北環、南環施工中，東環段 2026 年動工。', why: '補足捷運路網缺口，縮短跨區通勤時間並分散路面車流。', facts: ['東環段綜合規劃2023年3月行政院核定', '東環段CF710標2026年2月開工', '東環段CF720標2026年4月開工', '東環段以2032年全線通車為目標', '北環、南環段施工中，預計2031年完工'], agencies: ['捷運局'] },
    { id: 'safety',    title: '通學與交通安全', tag: '#安全',  model: 'crossing',   summary: '行人安全友善計畫：路口行穿線退縮、庇護島與綠燈早開。', why: '改善路口設計與號誌，降低行人、學童與長者的事故風險。', facts: ['2023年5月啟動5年期行人安全友善計畫', '至2023年11月退縮43處路口行穿線', '同期設置14處行人庇護島', '542處路口實施行人綠燈早開', '2024年規劃國小周邊路口彩色行穿線'], agencies: ['交通局'], issue: 'roundabout' },
    { id: 'shezi-dev',   title: '生態社子島開發', tag: '#社子島', model: 'crane', district: 'shezi', summary: '推動生態社子島開發，先建專案住宅安置居民。', why: '處理社子島長年禁限建問題，兼顧防洪、安置與生態。', facts: ['開發範圍約302公頃，規劃分兩期辦理', '2024年12月內政部核定區段徵收範圍', '規劃先建專案住宅再拆遷', '2026年5月底區段徵收計畫送內政部審', '2022年1月環評通過，2025年4月遭撤銷', '市府已上訴，環評判決尚未確定'], agencies: ['地政局', '都發局'] },
    { id: 'shezi-flood', title: '社子島防洪',     tag: '#社子島', model: 'levee', district: 'shezi', summary: '防洪標準從 20 年提高到 200 年，堤防加高隨開發案推動。', why: '社子島位於兩河交會低地，須提高防洪標準才能安全開發。', facts: ['1987年核定以20年洪水標準築堤', '現行防洪計畫採200年防洪標準', '2019年12月行政院核定防洪計畫', '生態社子島方案大幅降低填土量', '堤防加高隨開發案推動，尚未動工'], agencies: ['工務局水利處'] },
    { id: 'tourism',   title: '夜市與觀光',     tag: '#觀光',  model: 'nightmarket',summary: '燈節與大型活動行銷，夜市推食安標章。', why: '整合夜市、節慶與大型活動，吸引旅客並帶動在地消費。', facts: ['2026臺北燈節：西門、花博雙展區', '燈節展期2026年2月25日至3月15日', '衛生局2018年起推夜市食安微笑標章', '2024年標章評核擴及艋舺、公館夜市'], agencies: ['觀傳局', '衛生局'] },
  ],
  // 議題：每一波從已開放（startsAt 到了）的議題挑一個，決定這一波雜魚的組合（mix）與頭上台詞（chants）；intensity 讓雜魚群大一點。routes、boss 是舊塔防的欄位，打工不使用
  issues: [
    { id: 'trees',      title: '護樹',           tag: '#護樹',   startsAt: '2026-10-01', intensity: 1.0, routes: ['west','north'], boss: null,       mix: { bird: 3, parrot: 1, mouse: 1 }, chants: ['護樹!!','樹呢??','移樹就是砍樹','樹也是台灣人','護樹護台灣','砍樹毀民主'], desc: '青鳥為主，從淡水河與關渡飛來。' },
    { id: 'roundabout', title: '拆圓環',         tag: '#拆圓環', startsAt: '2026-10-15', intensity: 1.1, routes: ['west','south'], boss: null,       mix: { frog: 3, bird: 1, caterpillar: 1 }, chants: ['圓環還我!!','公館塞爆','拆圓環毀民主','圓環也有台灣價值','芒果乾圓環'], desc: '青蛙群從公館方向跳進來。' },
    { id: 'dome',       title: '大巨蛋',         tag: '#大巨蛋', startsAt: '2026-10-25', intensity: 1.2, routes: ['east','north'], boss: null,       mix: { parrot: 2, mouse: 3, frog: 1 }, chants: ['巨蛋漏水','票很難買','散場塞車','又在蛋','巨蛋出來面對','蛋蛋的芒果乾'], desc: '鸚鵡與鍵盤鼠洗版。' },
    { id: 'nvidia',     title: '輝達總部',       tag: '#輝達',   startsAt: '2026-11-05', intensity: 1.3, routes: ['north','east'], boss: 'bigv',     mix: { chameleon: 2, bird: 2, mouse: 1 }, chants: ['T17 T18 呢','輝達要跑了','輝達快來南部','地上權卡關','科技島沒了'], desc: '變色龍帶隊，大 V 壓陣。' },
    { id: 'housing',    title: '社宅進度',       tag: '#社宅',   startsAt: '2026-11-15', intensity: 1.4, routes: ['west','south','east'], boss: 'frogking', mix: { caterpillar: 2, frog: 2, parrot: 1 }, chants: ['社宅呢','房租好貴','蓋太慢','社宅跳票','居住正義!!'], desc: '毛蟲慢慢爬，大青蛙王殿後。' },
    { id: 'final',      title: '大選前夜總攻擊', tag: '#總攻擊', startsAt: null, intensity: 2.2, routes: ['west','north','east','south'], boss: 'frogking', boss2: 'bigv', mix: { bird: 3, frog: 3, parrot: 2, caterpillar: 1, chameleon: 1, mouse: 4 }, chants: ['總攻擊!!','抗中保台!!','芒果乾吃起來','青鳥起飛','全部罷掉','下架!!','最後一夜','今日香港明日台灣'], desc: '四面八方、所有動物、兩隻魔王。一樣守得下來。' },
  ],
  // ═══ 逛城市：自己的角色（穿著金蛋買的衣服）在政策島上散步；服飾店買衣服、工地投金蛋蓋城市、找市長捐政治獻金。其他正在逛的人也看得到 ═══
  explore: {
    speed: 1.2, radius: 0.14, pathNodes: 70000,   // 走路速度（每秒幾個世界單位）、碰撞半徑、跨島找路最多展開幾格
    // 服飾店：[島, 第幾棟小房子 0～2]（一律畫成商店）。要選鏡頭看得到的位置：廣場島的 1、2 號在地標兩側，會被大地標（例如市政府）擋住
    boutiques: [['datong', 0], ['daan', 0], ['zhongshan', 0], ['beitou', 0], ['wanhua', 0], ['songshan', 0], ['wenshan', 0]],
    near: { boutique: 1.0, site: 1.05, mayor: 0.9 }, // 走到幾格內出現「進去」按鈕
    clockStart: 600, clockRate: 6,  // 逛城市的時鐘：從 10:00 開始，每秒走幾分鐘（遊戲時間）
    times: [ { min: 360, icon: '🌅', label: '清晨 06' }, { min: 720, icon: '☀️', label: '白天 12' }, { min: 1080, icon: '🌇', label: '黃昏 18' }, { min: 1260, icon: '🌙', label: '夜晚 21' } ],
    birdHeight: 42, birdBack: 6,      // 鳥瞰：鏡頭在城市中心正上方多高、往後退多少
    fireworks: { every: 1.4, night: 0.5 }, // 全城加成「城市嘉年華」解鎖後，晚上（天色暗度 ≥ night）每 every 秒放一發煙火
    multi: { sendEvery: 0.5, sendPerPlayer: 0.1, sendMax: 4, heartbeat: 6, timeout: 20, presenceGrace: 5, maxRemote: 40, snapDist: 4, bubbleSeconds: 3, emoteCooldown: 1.5, rxMinGap: 0.12 },
    emotes: [ { k: 'hi', icon: '👋', say: '嗨！' }, { k: 'yay', icon: '🎉', say: '讚啦！' }, { k: 'love', icon: '❤️', say: '台北加油！' }, { k: 'thx', icon: '🙏', say: '謝啦！' } ],
    five: { k: 'five', icon: '🙌', say: '擊掌！' },
    guideKey: 'pi-guide-explore', worldKey: 'pi-world', // worldKey：上次在哪個世界（city 逛城市／work 打工場），下次直接回去
    // 打工現場：正在打工的房主（或單人）每 send 秒最多送一次這班的摘要（換波、魔王出現或倒下時才送），沒變化時 heartbeat 秒送一次；逛城市的人 expire 秒沒收到就移除
    live: { send: 3, heartbeat: 10, expire: 25, maxShifts: 30, ghostMax: 5 },
  },
  // ═══ 金蛋經濟：金蛋只有打工賺（搬進籃子的才算），可以買衣服、大家一起蓋城市、捐政治獻金（遊戲裡的惡搞）═══
  // 錢包 = 累計金蛋 − 衣服花掉的 − 蓋城市投入的 − 政治獻金。衣服在逛城市時走進服飾店買（買過的隨時能換）；id 不能改（存在玩家資料裡）；同一類一次穿一件。
  // 穿著字串：帽子.背心.配件.套裝（舊的三段式照樣認得）
  econ: {
    legal: '金蛋是遊戲點數，只能靠打工搬進籃子賺，不是錢、不能買也不能換錢。「政治獻金」是二創惡搞的遊戲玩法，不是真的捐款，跟任何候選人、政黨、選舉都無關。',
    outfits: {
      // 萬聖節系列套裝：price 0 的 10 套免費、隨時隨地換；其他的在服飾店用金蛋買。穿上會蓋過帽子、背心、配件（脫下套裝就回到原本的穿著）
      suit: { label: '萬聖節', items: {
        pumpkin: { name: '南瓜頭里長', icon: '🎃', price: 0, desc: '頭殼空空，里民大會照開。' },
        zombie:  { name: '加班殭屍', icon: '🧟', price: 0, desc: '連續加班 72 小時，只想打卡下班。' },
        vampire: { name: '吸血鬼房東', icon: '🧛', price: 0, desc: '不吸血，只吸房租。' },
        ghost:   { name: '颱風假許願鬼', icon: '👻', price: 0, desc: '每年夏天都在市府門口飄：求放一天就好。' },
        witch:   { name: '嗶卡掃把巫婆', icon: '🧙', price: 0, desc: '掃把要先嗶卡才能起飛，餘額不足就用走的。' },
        mummy:   { name: '公文木乃伊', icon: '🩹', price: 0, desc: '被層層公文包起來，章蓋到一半。' },
        boba:    { name: '全糖珍奶怪', icon: '🧋', price: 0, desc: '全糖去冰，喝一口就想去打工。' },
        cone:    { name: '又在挖馬路', icon: '🚧', price: 0, desc: '這條路上個月才挖過，這個月再挖一次。' },
        truck:   { name: '給愛麗絲垃圾車', icon: '🎵', price: 0, desc: '音樂一響，全里的人都衝出來。' },
        bat:     { name: '夜市收攤蝙蝠', icon: '🦇', price: 0, desc: '夜市收攤才下班，白天倒掛補眠。' },
        bag:      { name: '鹹酥雞紙袋怪', icon: '🛍️', price: 18, desc: '頭上套著油油的紙袋，九層塔味三公尺外就聞得到。' },
        cutlet:   { name: '比臉大雞排', icon: '🍗', price: 25, desc: '雞排比臉還大，拿來擋太陽剛好。' },
        poncho:   { name: '機車雨衣俠', icon: '🛵', price: 15, desc: '雨衣一穿，傾盆大雨照樣上班。' },
        delivery: { name: '宵夜外送鬼', icon: '📦', price: 20, desc: '半夜兩點還在送鹹酥雞。' },
        card:     { name: '餘額不足卡', icon: '💳', price: 22, desc: '嗶——餘額不足，請加值。' },
        firework: { name: '跨年煙火頭', icon: '🎆', price: 40, desc: '頭上一棟樓，倒數十秒就開始放。' },
        bear:     { name: '台灣黑熊', icon: '🐻', price: 35, desc: '胸口一道 V，出來逛街順便宣導保育。' },
        leopard:  { name: '石虎', icon: '🐆', price: 35, desc: '過馬路請走斑馬線，車子請慢行。' },
        pigeon:   { name: '路口鴿子王', icon: '🐦', price: 20, desc: '路口麵包屑歸我管。' },
        nightshift: { name: '大夜班店員', icon: '🏪', price: 15, desc: '凌晨三點微波便當的專家。' },
        parking:  { name: '停車格怪', icon: '🅿️', price: 25, desc: '走到哪裡都自帶車位，被畫線了就走不了。' },
        duck:     { name: '巨大黃色鴨鴨', icon: '🦆', price: 30, desc: '漂到哪裡，哪裡就塞車。' },
        taro:     { name: '芋圓頭', icon: '🍡', price: 20, desc: '九份樓梯爬完，頭上就長出芋圓。' },
        tofu:     { name: '臭豆腐頭', icon: '🧈', price: 25, desc: '遠遠就聞得到，靠近才知道好吃。' },
        prince:   { name: '電音三太子', icon: '👑', price: 60, desc: '戴墨鏡下凡，說是來逛夜市。' },
        megaphone:{ name: '宣傳車大聲公', icon: '📣', price: 30, desc: '一早就在巷口喊「拜託拜託」。' },
        pumpbus:  { name: '南瓜公車', icon: '🚌', price: 50, desc: '午夜十二點一到，就變回一般公車。' },
        skeleton: { name: '加班到只剩骨頭', icon: '💀', price: 30, desc: '績效考核前一週的樣子。' },
        alien:    { name: '來看房的外星人', icon: '👽', price: 30, desc: '看完台北房價，決定回火星。' },
        lantern:  { name: '天燈頭', icon: '🏮', price: 25, desc: '願望寫在臉上：加薪、放假、房價跌。' } } },
      hat: { label: '帽子', items: {
        helmet: { name: '工地安全帽', icon: '⛑️', price: 10 }, straw: { name: '斗笠', icon: '👒', price: 10 }, cap: { name: '棒球帽', icon: '🧢', price: 15 }, beanie: { name: '毛帽', icon: '🧶', price: 15 },
        chef: { name: '廚師帽', icon: '👨‍🍳', price: 25 }, bunny: { name: '兔耳朵', icon: '🐰', price: 35 }, egg: { name: '頭頂金蛋', icon: '🥚', price: 50 }, crown: { name: '金蛋皇冠', icon: '👑', price: 80 } } },
      color: { label: '背心', items: {
        mint: { name: '薄荷綠', icon: '🟢', price: 8, c: 0x58a6a6 }, navy: { name: '深藍', icon: '🔵', price: 8, c: 0x26365c }, pink: { name: '櫻花粉', icon: '🌸', price: 12, c: 0xf2a1a1 }, purple: { name: '葡萄紫', icon: '🟣', price: 12, c: 0x8a6fc0 },
        black: { name: '酷黑', icon: '⚫', price: 15, c: 0x2b2b30 }, gold: { name: '金蛋金', icon: '🟡', price: 40, c: 0xf2c14e } } },
      acc: { label: '配件', items: {
        scarf: { name: '圍巾', icon: '🧣', price: 12 }, sash: { name: '彩帶', icon: '🎗️', price: 20 }, cape: { name: '英雄披風', icon: '🦸', price: 45 } } },
    },
    // 蓋城市：在逛城市時走到工地投金蛋（新北的區是在要接的那座島靠海那邊）。所有人投入的金蛋加總，依序蓋；蓋好的建築換掉那座島上原本的小房子（house = 第幾棟小房子 0～2），大家的地圖上都看得到。投入的金蛋也算進自己行政區的 12 區對抗。
    city: [
      { id: 'fountain', name: '金蛋噴水池',     island: 'xinyi',      house: 0, model: 'garden',     cost: 30 }, // 市政府右前方（1 號在市政府左邊，會被大樓擋住）
      { id: 'market2',  name: '夜市二館',       island: 'shilin',     house: 0, model: 'nightmarket', cost: 60 },
      { id: 'stage',    name: '河岸舞台',       island: 'datong',     house: 2, model: 'stage',      cost: 100 },
      // kind: 'island'＝新北市的行政區：照真實相對位置放在台北 12 區外圍（axial），蓋好時從海上長出來、用陸橋接到真實相鄰的那一區（link；via＝真實的橋名）；
      // 蓋的時候在 link 島靠新島那一邊投金蛋。不算 12 區對抗。蘆洲（會壓到社子島）沒放。
      { id: 'sanchong', name: '三重區', kind: 'island', axial: [-2, 2], link: 'datong', via: '台北橋', ground: 'street', landmark: 'nightmarket', cost: 160 },
      { id: 'nursery',  name: '科技園區托嬰',   island: 'neihu',      house: 0, model: 'nursery',    cost: 190 },
      { id: 'teahouse', name: '貓空茶藝館',     island: 'wenshan',    house: 1, model: 'theater',    cost: 230 },
      { id: 'sports',   name: '南港運動中心',   island: 'nangang',    house: 0, model: 'football',   cost: 280 },
      { id: 'yonghe',   name: '永和區', kind: 'island', axial: [-1, 4], link: 'zhongzheng', via: '中正橋', ground: 'courtyard', landmark: 'housing', cost: 360 },
      { id: 'housing',  name: '青年社宅',       island: 'wanhua',     house: 2, model: 'housing',    cost: 400 },
      { id: 'dome2',    name: '小巨蛋 2.0',     island: 'songshan',   house: 1, model: 'dome',       cost: 460 },
      { id: 'clock',    name: '城南鐘樓',       island: 'zhongzheng', house: 0, model: 'clock',      cost: 540 },
      { id: 'xizhi',    name: '汐止區', kind: 'island', axial: [2, 1], link: 'nangang', ground: 'gravel', landmark: 'techcampus', cost: 650 },
      { id: 'egg101',   name: '金蛋 101',       island: 'daan',       house: 2, model: 'tower101',   cost: 800 },
      { id: 'banqiao',  name: '板橋區', kind: 'island', axial: [-3, 4], link: 'wanhua', via: '華江橋', ground: 'granite', landmark: 'station', cost: 900 },
      { id: 'zhonghe',  name: '中和區', kind: 'island', axial: [-2, 4], link: 'wanhua', via: '華中橋', ground: 'garden', landmark: 'temple', cost: 1000 },
      { id: 'xindian',  name: '新店區', kind: 'island', axial: [-1, 5], link: 'wenshan', ground: 'boardwalk', landmark: 'park', cost: 1100 },
      { id: 'tamsui',   name: '淡水區', kind: 'island', axial: [0, 0], link: 'beitou', ground: 'terracotta', landmark: 'oldstreet', cost: 1250 },
      { id: 'xinzhuang', name: '新莊區', kind: 'island', axial: [-3, 2], link: 'sanchong', ground: 'schoolyard', landmark: 'school', cost: 1400 }, // 接三重（要先蓋好三重）
    ],
    buildAmounts: [5, 20, 50],
    // 政治獻金（惡搞）：在逛城市時走到市長旁邊捐。全站累計到 at 顆解鎖全城加成，所有人都吃得到；自己捐了市長會回一句
    donate: { amounts: [5, 20, 50, 100], boardMax: 10,
      tiers: [
        { at: 100,  name: '便當加菜', desc: '打工：受到的傷害 −10%', shift: { dmg: 0.1 } },
        { at: 300,  name: '全城動員', desc: '打工：每波配額 −1', shift: { quota: -1 } },
        { at: 700,  name: '神隊友加持', desc: '打工：特殊技多 1 次', shift: { specials: 1 } },
        { at: 1500, name: '城市嘉年華', desc: '逛城市：晚上放煙火', fireworks: true },
      ],
      lines: {
        small: ['謝謝支持！一顆也是心意', '收到！這顆拿去補路燈', '感謝，金蛋會用在刀口上'],
        mid: ['感謝！明天就拿去修人行道', '收到！公園多種幾棵樹', '謝謝！捷運站多一台飲水機'],
        big: ['哇，大金主！政策一定加速', '感謝大力支持，帳目全部公開（遊戲裡的）', '這麼多！我請大家喝珍奶（遊戲裡的）'],
        tier: '全城加成解鎖：{name}！謝謝大家！', thanks: '感謝 {nick} 的金蛋，政策會更快上路！',
      } },
  },
  palette: { coral: 0xdb6a41, ink: 0x211d1d, cream: 0xfff8f4, yellow: 0xfcea8b, green: 0x8fb37a, stone: 0xd9cbb4, accent: 0xdb6a41, gold: 0xf2c14e },
  // 市民熱線（右側卡片）與城市快訊（底部跑馬燈）
  ticker: { hotlineRows: 3, hotlineSeconds: 8, hotlineSlideMs: 700, pxPerSec: 90, mixHotlineEvery: 3, hotlineGenShare: 0.45, weights: { opponent: 0.34, praise: 0.28, crisis: 0.14, city: 0.14, roast: 0.10 } }, // weights：酸對手／誇市長／經濟危機／城市快訊／酸市長的出現比例
  canonicalHost: 'taipei-hold-the-line.pages.dev',
  // 跟隨鏡頭：lookUp = 看向對象頭部的高度；stiffness 越大跟得越緊
  follow: { lookUp: 0.35, stiffness: 6 },
  // 一起打工（Supabase Realtime）：房間最多 roomMax 人，房主的瀏覽器跑模擬、每秒送 snapHz 次快照；其他人每秒送 upHz 次自己的位置（沒動時 heartbeat 秒一次）
  // 頻道：shift-<房號> 給房主廣播與成員名單（presence），shift-<房號>-u-<人> 每位成員一條、只有房主收，訊息量只跟人數成正比
  net: { roomMax: 4, codeLen: 4, codeChars: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', snapHz: 5, upHz: 6, heartbeat: 1.5, hostGrace: 8, waitBeat: 5, smooth: 9, protocol: 1, autoStartFull: 3, maxSpeedSlack: 1.6 },
  // 快速訊號（預設三句，不開放打字）
  emotes: [ { k: 'here', icon: '👉', say: '這邊！' }, { k: 'help', icon: '🆘', say: '救我！' }, { k: 'yay', icon: '🎉', say: '讚啦！' } ],
  emoteCooldown: 1.2, bubbleSeconds: 2.6,
  controls: { joyR: 46, joyDead: 0.12, tapMoveExact: 0.9 },
  ui: { logMax: 30, leaderboardMax: 10, heroesQueryLimit: 1000, districtPanelKey: 'pi-dpanel' }, // districtPanelKey：左上 12 區對抗面板收合狀態存在裝置上的 key
};
window.PI_CONFIG = CONFIG;
