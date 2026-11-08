// 激走跑者（TomaRunner 風格的徒步競速）——唯一的參數檔：賽道、角色、道具、物理數值都在這裡改。
export const CFG = {
  laps: 2,
  racers: 8,
  cam: { squeeze: 0.84, portrait: { back: 5.0, up: 2.5, fov: 74, look: 7, lookY: 0.9 }, landscape: { back: 5.4, up: 2.3, fov: 60, look: 6.5, lookY: 1.0 } }, // squeeze < 1：畫面左右壓縮（PS1 走廊感）
  phys: {
    maxSpeed: 11.5,     // 跑步最高速（單位／秒）
    accel: 7,          // 加速到目標速度的速率
    steer: 2.3,        // 轉向角速度（弧度／秒）
    autoAlign: 0.9,    // 沒按方向時自動對齊賽道方向的強度
    dashMul: 1.42,     // 衝刺時的速度倍率
    dashDrain: 0.36,   // 衝刺每秒消耗的能量（0～1）
    dashRegen: 0.07,   // 不衝刺時每秒回復
    draftRegen: 0.22,  // 跟在別人後面（跟跑）每秒額外回復
    jumpV: 7.6,
    gravity: 22,
    sidewalkMul: 0.82, // 騎樓／人行道上的速度倍率
    wallBounce: 0.55,  // 撞牆後剩下的速度
    stunMul: 0.25,     // 被絆倒／撞到時的速度倍率
    radius: 0.5,
    shoveRange: 2.1, shoveCooldown: 1.3, shoveStun: 0.8,
  },
  items: {
    boba:    { name: '珍珠奶茶', desc: '喝下去衝刺 2.5 秒，能量補滿', color: '#c8905a' },
    banana:  { name: '香蕉皮',   desc: '丟在後面，踩到會打滑', color: '#f5d442' },
    slipper: { name: '藍白拖',   desc: '往前丟出去，打到人會跌倒', color: '#3b7bd9' },
    charm:   { name: '平安符',   desc: '8 秒內擋下一次攻擊或絆倒', color: '#d9463b' },
    cracker: { name: '鞭炮',     desc: '前方 14 公尺內的對手都嚇一跳', color: '#e0392b' },
  },
  itemWeightsByPlace: { front: ['banana', 'banana', 'slipper', 'charm'], mid: ['boba', 'slipper', 'banana', 'charm', 'cracker'], back: ['boba', 'boba', 'cracker', 'slipper', 'charm'] },
  // 角色：Gobkit 風的 Q 版大頭人（程式造型；也可以把 GLB 放進 models/ 由 manifest.json 指定）
  characters: [
    { id: 'office',  name: '阿凱',   job: '上班族',   desc: '抱著筆電趕捷運，起跑最快', colors: { skin: 0xf2c9a8, hair: 0x4a2f27, shirt: 0x3f7fd0, pants: 0x2b3f6a, shoes: 0x2a2a30 }, hair: 'short', acc: ['glasses', 'lanyard', 'laptop'], stats: { speed: 1.0, accel: 1.15, handling: 1.0, weight: 1.0 } },
    { id: 'cs',      name: '小美',   job: '客服人員', desc: '戴著耳麥，轉彎最靈巧',     colors: { skin: 0xf6d2b5, hair: 0x2d1f1b, shirt: 0x5a6fa8, pants: 0x3a3f5c, shoes: 0x3a2f2a }, hair: 'pony', acc: ['headset', 'lanyard', 'earring'], stats: { speed: 0.98, accel: 1.0, handling: 1.25, weight: 0.85 } },
    { id: 'police',  name: '陳警官', job: '警察',     desc: '手電筒照路，衝刺最持久',   colors: { skin: 0xe9b68c, hair: 0x1a1a1a, shirt: 0x24324f, pants: 0x1c2438, shoes: 0x111111 }, hair: 'short', acc: ['policeCap', 'belt', 'flashlight', 'radio'], stats: { speed: 1.02, accel: 0.95, handling: 0.95, weight: 1.15, dash: 1.3 } },
    { id: 'waiter',  name: '小傑',   job: '服務生',   desc: '端著一盤珍奶，跟跑回能快', colors: { skin: 0xf3cfae, hair: 0x5a3b2e, shirt: 0xf4f1ea, pants: 0x2d2d33, shoes: 0x3a2a22 }, hair: 'short', acc: ['lanyard', 'tray', 'apron'], stats: { speed: 1.0, accel: 1.05, handling: 1.05, weight: 0.95, draft: 1.5 } },
    { id: 'boss',    name: '黃董',   job: '董事長',   desc: '白髮老闆，撞人最有力',     colors: { skin: 0xe8bf9c, hair: 0xe8e8e8, shirt: 0x2b2b2b, pants: 0x242424, shoes: 0x1a1a1a }, hair: 'grey', acc: ['tie', 'lanyard'], stats: { speed: 0.96, accel: 0.9, handling: 0.95, weight: 1.35, shove: 1.5 } },
    { id: 'grandpa', name: '阿公',   job: '退休會計', desc: '計算機不離手，不容易被絆倒', colors: { skin: 0xecc39f, hair: 0xd8d8d8, shirt: 0xc9a46a, pants: 0x4a3f33, shoes: 0x3a2f28 }, hair: 'balding', acc: ['glasses', 'tie', 'calculator', 'vest'], stats: { speed: 0.95, accel: 0.95, handling: 1.1, weight: 1.1, tough: 1.6 } },
    { id: 'student', name: '小雨',   job: '高中生',   desc: '書包背著跑，跳得最高',     colors: { skin: 0xf7d6bb, hair: 0x3a2622, shirt: 0xf2f2f2, pants: 0x3b4a7a, shoes: 0xffffff }, hair: 'bob', acc: ['backpack', 'bowtie'], stats: { speed: 1.03, accel: 1.1, handling: 1.1, weight: 0.8, jump: 1.2 } },
    { id: 'chef',    name: '阿興師', job: '夜市老闆', desc: '鹽酥雞之王，速度最快但難煞車', colors: { skin: 0xe6b58f, hair: 0x2a2a2a, shirt: 0xffffff, pants: 0x3a3a3a, shoes: 0x222222 }, hair: 'short', acc: ['chefHat', 'apron', 'mustache', 'tongs'], stats: { speed: 1.08, accel: 0.9, handling: 0.85, weight: 1.2 } },
  ],
  courses: [
    {
      id: 'taipei', name: '台北夜市大街', sub: 'TAIPEI NIGHT MARKET', theme: 'taipei', time: 'night',
      desc: '騎樓、鐵窗、招牌與滿街機車；夜市段有攤販與紅燈籠，小心路口衝出來的機車和垃圾車。',
      width: 6.4, sidewalk: 1.4,
      // 格子狀路線：全部直角彎（grid: true），座標乘 scale；corner 是彎道半徑
      grid: true, scale: 0.6, corner: 3.5,
      points: [[0, 0], [70, 0], [70, -50], [120, -50], [120, 20], [170, 20], [170, -100], [90, -100], [90, -150], [-30, -150], [-30, -90], [-80, -90], [-80, -150], [-140, -150], [-140, -40], [-90, -40], [-90, 40], [-40, 40], [-40, 0]],
      // 特色段：t 是賽道比例（0 起點），都放在直線段中間
      features: { market: [0.235, 0.32], temple: 0.75, intersection: [0.476, 0.72], truck: 0.6 },
      items: [0.115, 0.409, 0.548, 0.683, 0.865], boosts: [0.163, 0.591, 0.917],
      sky: { top: 0x0b1335, horizon: 0x3a2a6a, ground: 0x151228 }, fog: { color: 0x2a2048, near: 55, far: 210 },
      light: { sun: 0xb8c0ff, sunI: 0.95, sunPos: [60, 90, -40], hemi: [0x7a84d8, 0x5a4660, 1.7] },
      pal: { road: 0x3a3a40, line: 0xe8c23a, edge: 0xdddddd, sidewalk: 0xa8655a, curb: 0x8a8a8a, ground: 0x2a2630 },
      music: 'taipei',
    },
    {
      id: 'tokyo', name: '東京下町商店街', sub: 'TOKYO SHITAMACHI', theme: 'tokyo', time: 'dusk',
      desc: '電線桿、自動販賣機、居酒屋提燈與櫻花；平交道有電車通過，遠方看得到東京鐵塔與富士山。',
      width: 6.0, sidewalk: 1.3,
      grid: true, scale: 0.6, corner: 3.5,
      points: [[0, 0], [80, 0], [80, 60], [140, 60], [140, -40, 5], [60, -40], [60, -100], [-60, -100], [-60, -40], [-120, -40], [-120, 60], [-40, 60], [-40, 0]],
      features: { crossing: 0.521, shrine: 0.76, sakura: [0.70, 0.90], bridge: [0.235, 0.285] },
      items: [0.115, 0.354, 0.427, 0.615, 0.854], boosts: [0.177, 0.677, 0.927],
      sky: { top: 0x2a2f6a, horizon: 0xf08a5a, ground: 0x3a3a4a }, fog: { color: 0xc48a7a, near: 70, far: 240 },
      light: { sun: 0xffc090, sunI: 1.3, sunPos: [-80, 40, 60], hemi: [0x8a8fd0, 0x7a5a4a, 1.1] },
      pal: { road: 0x4a4a4f, line: 0xf2f2f2, edge: 0xf2f2f2, sidewalk: 0xb8b2a4, curb: 0x9a9a9a, ground: 0x4a4740 },
      music: 'tokyo',
    },
    {
      id: 'kyoto', name: '京都祇園坂道', sub: 'KYOTO GION', theme: 'kyoto', time: 'day',
      desc: '町家木格子、石燈籠與楓葉；爬上清水坂、穿過千本鳥居，鴨川邊有人力車慢慢走。',
      width: 5.8, sidewalk: 1.2,
      grid: true, scale: 0.6, corner: 3.2,
      points: [[0, 0, 0], [60, 0, 0], [60, -50, 3], [130, -50, 6], [130, 30, 10], [60, 30, 12], [60, 90, 12], [-40, 90, 10], [-40, 30, 7], [-100, 30, 5], [-100, -60, 2], [-40, -60, 0], [-40, 0, 0]],
      features: { torii: [0.47, 0.555], pagoda: 0.256, river: [0.82, 0.88], bamboo: [0.72, 0.80], crosswalk: 0.674 },
      items: [0.099, 0.343, 0.605, 0.919], boosts: [0.169, 0.762],
      sky: { top: 0x6fb2f0, horizon: 0xe8f0f8, ground: 0x9aa8a0 }, fog: { color: 0xdbe6ee, near: 80, far: 260 },
      light: { sun: 0xfff2dc, sunI: 1.35, sunPos: [70, 100, 30], hemi: [0xbfd8ff, 0x8a7a5a, 0.7] },
      pal: { road: 0x6a645c, line: 0xf2f2f2, edge: 0xf2f2f2, sidewalk: 0xc8bfae, curb: 0xa8a098, ground: 0x7a9a5a },
      music: 'kyoto',
    },
  ],
  difficulty: {
    easy:   { label: '輕鬆', aiSpeed: 0.9,  rubber: 0.08, aiItems: 0.5 },
    normal: { label: '普通', aiSpeed: 0.97, rubber: 0.12, aiItems: 0.8 },
    hard:   { label: '激走', aiSpeed: 1.03, rubber: 0.14, aiItems: 1.0 },
  },
};
