/* 萬安政策島 TD — 所有可調參數。其他檔案不得出現魔術數字。
   新增議題：ISSUES 加一筆（或編輯者在大廳表單新增）。新增動物：ANIMALS 加一筆，model 指到 animals.js 的外型。 */
export const CONFIG = {
  site: {
    name: '萬安政策島', sub: 'TD・守住市政府', tag: '二創惡搞・非官方', waveWord: '波攻擊',
    credit: '島嶼、人物與場景的做法參考 puma.taipei 的「HEART 政策島」互動頁，重新實作。',
    parody: '二創惡搞作品｜非官方',
    parodyLong: '這是網友自製的二創惡搞塔防遊戲，不是台北市政府、蔣萬安本人或任何政黨、競選團隊的官方內容，也沒有收到任何委託或贊助。',
    disclaimer: '政策摘要整理自公開報導、僅供遊戲參考，細節以官方資訊為準。地標與建築是象徵性的迷你模型；議題、數值、動物與路線都是遊戲設定，攻擊方動物是虛構角色，台詞改編自網路流行語並誇張化處理，不指涉任何真實人物。市長角色是 Q 版遊戲 NPC，台詞取自政策摘要，不代表本人發言。',
  },
  election: { date: '2026-11-28', tz: 'Asia/Taipei', finalIssueId: 'final' },
  round: {
    seconds: 180, autoNextSeconds: 4, toastLinger: 2, dayStart: 420, dayEnd: 1050, // 一場的天色從 07:00 走到 17:30，不進入夜晚
    bossAt: 140, surgeAt: 158, surgeEvery: 1.5, surgePct: 0.35, surgeBelowApproval: 40, wipeAt: 176,
    startApproval: 100, approvalFloor: 1,
    baseSpawn: 26, bursts: [ { from: 3, to: 45, share: 0.35 }, { from: 55, to: 98, share: 0.35 }, { from: 106, to: 138, share: 0.30 } ],
    windShift: { minGap: 30, maxGap: 55, duration: 5, speedMul: 1.5 },
    raid: { minGap: 28, maxGap: 48, size: 5, chance: 0.7 },
    unitsPerSec: 0.9,          // 敵速 1.0 = 每秒走幾個世界單位（一座島直徑約 4）
    spawnGap: 1.2,             // 依序登陸：兩隻之間至少隔幾秒
    // 頭上對話：每句顯示 chantOn 秒、同時最多 chantMax 句、新的一句至少隔 chantEvery 秒、講完休息 chantRest 秒；chantIssueShare = 講議題台詞（其餘講動物自己的）的比例；鸚鵡複製上一句的長度上限 chantCopyMax；chantSize = 對話框高度（世界單位）；chantSpace = 正在說話的兩隻至少要隔多遠
    chantOn: 2.6, chantMax: 2, chantEvery: 1.6, chantRest: 7, chantIssueShare: 0.65, chantCopyMax: 6, chantSize: 0.32, chantSpace: 2.2, // chantSpace：說話的兩隻至少隔幾個世界單位
    focusDmgMul: 3, focusCooldown: 1.4, ultCooldown: 45, ultPct: 0.6, ultSlow: 0.6, ultSlowTime: 3,
    projSpeed: 9,
  },
  // 市民熱線（右側卡片）與城市快訊（底部跑馬燈）
  ticker: { hotlineRows: 3, hotlineSeconds: 8, hotlineSlideMs: 700, pxPerSec: 90, mixHotlineEvery: 3, hotlineGenShare: 0.45, weights: { opponent: 0.34, praise: 0.28, crisis: 0.14, city: 0.14, roast: 0.10 } }, // weights：酸對手／誇市長／經濟危機／城市快訊／酸市長的出現比例
  // 正式網址（Cloudflare Pages）
  canonicalHost: 'taipei-hold-the-line.pages.dev',
  // 跟隨鏡頭：lookUp = 看向對象頭部的高度；stiffness 越大跟得越緊
  follow: { lookUp: 0.35, stiffness: 5 },
  // 市長 NPC：依行政區順序巡迴每棟政策建築宣傳；回合中每次演講 +滿意度，附近居民會停下來揮手。sayFacts = 演講輪流講摘要與前幾條細項（後面的細項放進度與爭議）
  mayor: { name: '蔣萬安市長', speed: 0.5, speechSeconds: 5.5, pauseSeconds: 0.8, approach: 0.45, sloganMax: 22, sayFacts: 3, approvalPerSpeech: 2, cheerRadius: 2.2 },
  // 居民（原本就住在島上的人）：平常在步道上散步，有敵人時會走過去勸退。
  residents: { perIsland: 7, speed: 0.6, engageRadius: 9, meleeRange: 0.45, dps: 9, maxPerTarget: 3, roles: ['citizen','elder','child','parent','officeworker','youth','cyclist','worker','hiker'] },
  // 英雄（登入者）：點島嶼就走過去，自動攻擊射程內的敵人。
  heroes: {
    chief:     { name: '里長伯',   icon: '🧓', color: 0xdb6a41, dmg: 16, rate: 0.55, range: 3.2, style: 'ball',  speed: 1.1, desc: '人面廣，中距離穩定輸出。' },
    driver:    { name: '公車司機', icon: '🚌', color: 0x2f6f9f, dmg: 10, rate: 0.3,  range: 3.0, style: 'bus',   speed: 1.2, desc: '班次密，連發。' },
    fireman:   { name: '消防員',   icon: '🚒', color: 0xc9452f, dmg: 18, rate: 0.7,  range: 2.8, style: 'water', slow: 0.5, slowTime: 1.6, speed: 1.1, desc: '水柱打到會減速。' },
    volunteer: { name: '志工媽媽', icon: '🧺', color: 0xc97d97, dmg: 9,  rate: 0.6,  range: 2.8, style: 'ball',  regen: 0.4, rally: 1.3, speed: 1.05, desc: '每秒回一點滿意度，身邊居民攻擊 +30%。' },
    engineer:  { name: '工程師',   icon: '💻', color: 0x4a3f8f, dmg: 22, rate: 1.0,  range: 3.2, style: 'zap',   chain: 3, speed: 1.0, desc: '台北通連鎖電擊，一次打 3 隻。' },
  },
  // 攻擊方動物（model: bird / frog / worm / lizard / mouse）
  animals: {
    bird:        { name: '青鳥',       model: 'bird',   color: 0x17a3b4, accent: 0x0d7281, hp: 40,   speed: 1.0,  bounty: 1, size: 1.0, leak: 4,  fly: true,  chants: ['青鳥起飛!!','守護民主','出來面對','抗中保台','我是自發的'] },
    frog:        { name: '青蛙',       model: 'frog',   color: 0x4caf50, accent: 0x2e7d32, hp: 95,   speed: 0.65, bounty: 1, size: 1.0, leak: 6,  hop: true,  chants: ['呱!!','呱呱抗中保台','芒果乾呱','呱～罷掉'] },
    parrot:      { name: '綠鸚鵡',     model: 'bird',   color: 0x6abf4b, accent: 0xd94a3a, hp: 60,   speed: 1.1,  bounty: 1, size: 0.9, leak: 4,  fly: true,  repeat: true, chants: ['同上','+1','複製貼上','台灣價值+1','芒果乾+1'] },
    caterpillar: { name: '綠毛蟲',     model: 'worm',   color: 0x7cb342, accent: 0x558b2f, hp: 240,  speed: 0.38, bounty: 1, size: 1.0, leak: 8,  chants: ['慢慢連署中','排隊簽連署','陳情寫到一半','蠕動中'] },
    chameleon:   { name: '變色龍',     model: 'lizard', color: 0x66bb6a, accent: 0xffb300, hp: 130,  speed: 0.9,  bounty: 1, size: 1.0, leak: 6,  shift: true, hairpin: [0.45, 1.5], chants: ['髮夾彎','此一時彼一時','我沒說過','萊豬不一樣','核電再說'] },
    mouse:       { name: '鍵盤鼠',     model: 'mouse',  color: 0x9e9e9e, accent: 0x616161, hp: 22,   speed: 1.6,  bounty: 1, size: 0.7, leak: 1,  chants: ['已檢舉','笑死','認知作戰!','我不是1450','破防了','可悲'] },
    bigv:        { name: '側翼大 V',   model: 'bird',   color: 0x0e5f6b, accent: 0xf2c14e, hp: 950,  speed: 0.5,  bounty: 1, size: 2.0, leak: 25, fly: true,  boss: true, spawn: { type: 'mouse', every: 4 }, chants: ['懶人包來了','請大家分享','截圖留存','帶風向中','轉發一百次'] },
    frogking:    { name: '大青蛙王',   model: 'frog',   color: 0x2e7d32, accent: 0xf2c14e, hp: 1500, speed: 0.38, bounty: 1, size: 2.3, leak: 30, hop: true,  boss: true, spawn: { type: 'frog', every: 7 }, chants: ['呱!!!!','總攻擊','全軍出動','罷免大成功'] },
  },
  // 12 座島 = 台北市 12 個行政區，軸座標依實際地理相對位置排列（上北下南、左西右東）。goal = 市政府所在的信義區。
  // landmark：該區的象徵地標（純裝飾）；政策建築另外依 policies 隨機散落。
  islands: [
    { id: 'beitou',   number: 1,  axial: [1, 0],  name: '北投區', ground: 'meadow',     landmark: 'hotspring' },
    { id: 'shilin',   number: 2,  axial: [0, 1],  name: '士林區', ground: 'lawn',       landmark: 'palace' },
    { id: 'neihu',    number: 3,  axial: [1, 1],  name: '內湖區', ground: 'lawn',       landmark: 'techcampus' },
    { id: 'datong',   number: 4,  axial: [-1, 2], name: '大同區', ground: 'courtyard',  landmark: 'oldstreet' },
    { id: 'zhongshan',number: 5,  axial: [0, 2],  name: '中山區', ground: 'street',     landmark: 'grandhotel' },
    { id: 'songshan', number: 6,  axial: [1, 2],  name: '松山區', ground: 'street',     landmark: 'airport' },
    { id: 'nangang',  number: 7,  axial: [2, 2],  name: '南港區', ground: 'gravel',     landmark: 'expo' },
    { id: 'wanhua',   number: 8,  axial: [-2, 3], name: '萬華區', ground: 'terracotta', landmark: 'temple' },
    { id: 'zhongzheng',number: 9, axial: [-1, 3], name: '中正區', ground: 'granite',    landmark: 'station' },
    { id: 'daan',     number: 10, axial: [0, 3],  name: '大安區', ground: 'garden',     landmark: 'park' },
    { id: 'xinyi',    number: 11, axial: [1, 3],  name: '信義區', ground: 'granite',    landmark: 'cityhall', goal: true },
    { id: 'wenshan',  number: 12, axial: [0, 4],  name: '文山區', ground: 'forest',     landmark: 'gondola' },
    // 社子島：獨立在士林西側的河口沙洲，不跟其他島相鄰，只靠一座陸橋連到士林
    { id: 'shezi',    number: 13, axial: [-1, 1], offset: [-1.9, -0.8], detached: true, link: 'shilin', name: '社子島', ground: 'garden', landmark: 'wetland' },
  ],
  // 敵人從河口登陸的區（四個方向），再沿步道與橋走向信義區市政府。
  landings: { west: { island: 'wanhua', name: '淡水河' }, north: { island: 'beitou', name: '關渡' }, east: { island: 'nangang', name: '基隆河' }, south: { island: 'wenshan', name: '景美溪' } },
  // 政策：每一筆是一棟可點擊的建築（政策卡顯示 summary、why、facts 最多 8 條、agencies 主責局處、issue 相關議題代號），沒指定 district 就依 id 雜湊隨機落在某座島。後台（共享資料庫 policies 集合）新增的會自動出現。
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
  issues: [
    { id: 'trees',      title: '護樹',           tag: '#護樹',   startsAt: '2026-10-01', intensity: 1.0, routes: ['west','north'], boss: null,       mix: { bird: 3, parrot: 1, mouse: 1 }, chants: ['護樹!!','樹呢??','移樹就是砍樹','樹也是台灣人','護樹護台灣','砍樹毀民主'], desc: '青鳥為主，從淡水河與關渡飛來。' },
    { id: 'roundabout', title: '拆圓環',         tag: '#拆圓環', startsAt: '2026-10-15', intensity: 1.1, routes: ['west','south'], boss: null,       mix: { frog: 3, bird: 1, caterpillar: 1 }, chants: ['圓環還我!!','公館塞爆','拆圓環毀民主','圓環也有台灣價值','芒果乾圓環'], desc: '青蛙群從公館方向跳進來。' },
    { id: 'dome',       title: '大巨蛋',         tag: '#大巨蛋', startsAt: '2026-10-25', intensity: 1.2, routes: ['east','north'], boss: null,       mix: { parrot: 2, mouse: 3, frog: 1 }, chants: ['巨蛋漏水','票很難買','散場塞車','又在蛋','巨蛋出來面對','蛋蛋的芒果乾'], desc: '鸚鵡與鍵盤鼠洗版。' },
    { id: 'nvidia',     title: '輝達總部',       tag: '#輝達',   startsAt: '2026-11-05', intensity: 1.3, routes: ['north','east'], boss: 'bigv',     mix: { chameleon: 2, bird: 2, mouse: 1 }, chants: ['T17 T18 呢','輝達要跑了','輝達快來南部','地上權卡關','科技島沒了'], desc: '變色龍帶隊，大 V 壓陣。' },
    { id: 'housing',    title: '社宅進度',       tag: '#社宅',   startsAt: '2026-11-15', intensity: 1.4, routes: ['west','south','east'], boss: 'frogking', mix: { caterpillar: 2, frog: 2, parrot: 1 }, chants: ['社宅呢','房租好貴','蓋太慢','社宅跳票','居住正義!!'], desc: '毛蟲慢慢爬，大青蛙王殿後。' },
    { id: 'final',      title: '大選前夜總攻擊', tag: '#總攻擊', startsAt: null, intensity: 2.2, routes: ['west','north','east','south'], boss: 'frogking', boss2: 'bigv', mix: { bird: 3, frog: 3, parrot: 2, caterpillar: 1, chameleon: 1, mouse: 4 }, chants: ['總攻擊!!','抗中保台!!','芒果乾吃起來','青鳥起飛','全部罷掉','下架!!','最後一夜','今日香港明日台灣'], desc: '四面八方、所有動物、兩隻魔王。一樣守得下來。' },
  ],
  raidTags: ['#護樹','#拆圓環','#出來面對','#抗中保台','#芒果乾','#青鳥起飛','#洗版中'],
  palette: { coral: 0xdb6a41, ink: 0x211d1d, cream: 0xfff8f4, yellow: 0xfcea8b, green: 0x8fb37a, stone: 0xd9cbb4, accent: 0xdb6a41 },
  // 多人同框：其他玩家的英雄透過 Supabase Realtime broadcast 出現在你的地圖上，一起打你畫面上的網軍。
  // 位置傳送間隔隨在線人數拉長（人數 × sendPerPlayer 秒，介於 sendEvery 與 sendMax），控制免費方案的訊息量。只有預設表情與短句，不開放自由輸入。
  multi: { sendEvery: 1, sendPerPlayer: 0.25, sendMax: 8, heartbeat: 8, timeout: 25, presenceGrace: 5, maxRemote: 48, snapDist: 6, catchUp: 1.3, allyDmg: 0.5, allyUltMul: 0.5, allyUltRadius: 3, bubbleSeconds: 3, emoteCooldown: 1.5, rxMinGap: 0.2,
    emotes: [ { k: 'hi', icon: '👋', say: '嗨！一起守！' }, { k: 'help', icon: '🆘', say: '這邊需要支援！' }, { k: 'mine', icon: '💪', say: '交給我！' }, { k: 'thx', icon: '🙏', say: '謝啦！' }, { k: 'yay', icon: '🎉', say: '守住了！' }, { k: 'love', icon: '❤️', say: '台北加油！' } ],
    five: { k: 'five', icon: '🙌', say: '擊掌！' } },
  // 英雄模式：手動點島後自動找怪暫停幾秒；點的位置離步道多近就直接走到那一點
  heroMode: { manualSeconds: 8, exactRadius: 0.9, storageKey: 'pi-hero-auto' },
  ui: { logMax: 30, leaderboardMax: 10, heroesQueryLimit: 1000, districtPanelKey: 'pi-dpanel' }, // districtPanelKey：左上 12 區對抗面板收合狀態存在裝置上的 key
};
window.PI_CONFIG = CONFIG;
