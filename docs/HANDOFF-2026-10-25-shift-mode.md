# 交接：2026-10-25 塔防換成「打工模式」

萬安政策島（二創惡搞、非官方的 3D 台北政策島）。這一輪把塔防整個換成致敬斯普拉遁打工模式的玩法：最多 4 人一隊、一班 3 波、打倒魔王搶金蛋、搬進金蛋籃湊滿配額。這份給下一個 session：架構、數值、多人怎麼跑、上線前要做什麼、還沒做的。

## 1. 現況一覽

| 項目 | 位置／狀態 |
|---|---|
| 正式站 | https://taipei-hold-the-line.pages.dev （Cloudflare Pages，推 `main` 約 30 秒上線） |
| 後台 | `/admin/`（Supabase 帳號＋`admins` 白名單）。議題的「登陸方向、魔王」欄位打工不用，已藏起來 |
| 後端 | Supabase（免費方案），設定 `js/backend.js`。**打工戰績要先跑 `supabase/shifts.sql`**（加 shifts、eggs、clears、grade、grade_pts；舊塔防欄位不動） |
| 新檔案 | `js/room.js`（房間）、`js/nav.js`（走路與碰撞）、`supabase/shifts.sql` |
| 改寫 | `js/game.js`（整個重寫）、`js/ui.js`（大半重寫，政策卡、熱線、快訊、後台沿用）、`js/store.js`、`js/config.js`、`index.html`、`css/ui.css`（最後一段是打工） |
| 沿用 | 島、建築、人物、環境、政策卡、1999 熱線、城市快訊、在線名單、12 區對抗（分數改成金蛋）、市長 NPC |

## 2. 玩法重點（數字都在 `js/config.js`）

- **打工場**（`stages`）：4～5 座相鄰的島，金蛋籃在中間那座的廣場（`plaza`：島中央往前一條走道不放建築，廣場島標 `plaza: true`）。每 2 小時輪換（`rotateHours`）。
- **一班**（`shift`）：開場 4 秒、每波 100 秒、波間 7 秒（倒下的全部救起、清場）。配額 = `qBase[n] + qHazard[n] × 危險度`。
- **敵人**（`animals`）：雜魚 6 種＋暴走鼠；魔王 5 種（`ai`：bomber 側翼大V、leaper 大青蛙王、charger 鐵粉龍、tower 洗版塔、missile 飛彈鸚鵡）；金色 2 種（特殊波）。魔王掉 `egg.perBoss` 顆金蛋。
- **特殊波**：第 1 波 12%、之後每波 25%（`specialFirst`、`specialChance`），起大霧或暴走夜。
- **職業與特殊技**（`heroes`，id 不能改：Supabase 有檢查）。一班 2 次（`specials`）。
- **職級**（`grades`）：7 級、每級 0～100 點，過關 +20；危險度 0.3～2.0。一起打工取隊員平均。大選前夜起 +0.15。
- **NPC 同事**（`npc`）：優先順序＝躲紅圈紅線 > 被雜魚圍住先拉開 > 救人 > 搬蛋 > 撿蛋 > 打魔王 > 回籃子附近。卡在兩棟建築中間時改沿步道繞（`nav.waypoint` 的 ringOnly），同一顆蛋卡三次就先放著。

## 3. 架構

### 模擬與畫面（`js/game.js`）
- `startShift(cfg, role)`：role = `solo`（單人＋NPC）、`host`（房主）、`client`（房客）。solo／host 跑 `hostStep`（生怪、敵人 AI、打工仔攻擊、金蛋、救人、預告圈）；client 只跑自己的走路，其餘靠快照。
- **事件**：模擬端用 `ev([...])` 產生（自己先播，房主再塞進下一次快照），兩邊都用 `playEvent` 播：射擊、連鎖、擊倒、受傷、倒下、救起、撿蛋、入籃、預告圈／線、爆炸、光束、懶人包、口水、特殊技、快速訊號、市長台詞、魔王登場、頭上台詞、肉搜目標、開波、休息、收工。**事件只帶代碼與數字**（台詞用索引），房客自己用 config 組文字，房主送不了任意文字進別人畫面。
- **快照**（`makeSnapshot`／`applySnapshot`）：`P` 每人 12 個數字、`E` 每隻敵人 7 個數字、`O` 每顆蛋 4 個數字，座標乘 100 取整。房客把東西往目標位置平滑靠過去（`net.smooth`）。
- `view()` 每幀擺網格與特效（金蛋籃、預告圈、救生圈、頭上的蛋、鎖定圈、肉搜圈）。

### 走路（`js/nav.js`）
- 能走 = 島面（六角形內縮 0.1）＋橋（線段膠囊）。建築是圓形障礙物：地標、3 棟小房子（靜態）＋政策建築（`placePolicies` 時更新）。
- 移動被擋時試幾個偏角滑開；站在不能走的地方時先讓他走回來。
- 跨島：步道路網 156 個節點先用 Floyd–Warshall 算好下一跳，走的時候挑看得到的最遠節點。

### 房間（`js/room.js`、`js/ui.js` 的「房間」段）
- 頻道：`shift-<房號>`（成員 presence＋房主 broadcast）、`shift-<房號>-u-<uid 前 8 碼>`（每位房客一條，只有房主收）。
- 房主訊息：`r` 房間狀態（等人時每 5 秒一次）、`go` 開工設定（打工中才進來的人會單獨收到一份，`to` 指定）、`s` 快照（每秒 5 次）、`end` 結算、`full` 滿了、`bye` 房主離開。
- 房客訊息：`p` 位置（每秒最多 6 次，沒動時 1.5 秒一次心跳）、`i` 指令（`sp` 特殊技、`th` 丟蛋、`em` 快速訊號）。
- 快速配對：房主把 `room`、`rh`、`rn`、`rs`、`pub` 放進全站 `online` presence，`store.js` 的 `peer()` 驗證後列出來。
- 房主切到背景時，`ui.js` 用計時器繼續推進模擬與送快照（瀏覽器會把背景計時器放慢到約每秒一次，房客會覺得卡，但不會停）。

## 4. 數值平衡（2026-10-25 實測）

方法：瀏覽器裡把 4 格都交給 NPC，或「3 位 NPC＋1 位站在籃子旁邊不動、只會自動開火的人」，手動 `game.step(0.025)` 快轉整班。每格 3～4 班。

| 危險度 | 4 位 NPC 過關 | 3 NPC＋1 個不動的人 過關 | 每波搬進籃子 |
|---|---|---|---|
| 0.3（見習生） | 3/3 | 4/4、3/3 | 約 20～26 顆（配額 11/13/16） |
| 0.6 | — | 4/4、3/3 | 約 21～30 顆（配額 13/16/18） |
| 1.0 | 1/3 | 1/4、3/3（變異大） | 約 19～33 顆（配額 16/19/22） |
| 1.4 | — | 1/4 | 多半第 2～3 波全倒 |
| 2.0（局長滿點） | 0/3 | 0/4 | 第 1～2 波全倒 |

- 低職級幾乎一定過，讓新手熟悉；到股長、科長以後要靠真人操作（躲招、救人、丟蛋）才過得了。
- 失敗主要原因是**全倒**（青蛙、魔王招式），配額本身在中低危險度不難。要調難度先動 `qBase`／`qHazard`（配額）與 `hpK0`／`hpK1`（血量），其次 `bossEvery`、`lesserEvery`。
- 暴走夜的金蛋量跟危險度一起變多（`rush.goldK0`／`goldK1`），起大霧的金青蛙在 12、42、72 秒出現。

## 5. 訊息量（Supabase Realtime 免費方案每月 200 萬則）

- **單人＝0 則**（全部在自己的瀏覽器）。只有一起打工才用 broadcast。
- 4 人一班（約 5.5 分鐘）：房主快照每秒 5 次 × 3 位房客 = 15 則／秒；房客位置每秒最多 6 次 × 3 人 × 只送房主 = 18 則／秒。合計最多約 33 則／秒 ≈ **1.1 萬則／班**。若 Supabase 照送達計費，免費額度約夠 **180 班 4 人房／月**；2 人房約 3,500 則／班。
- 快照大小：早期 2 人、敵人少時平均約 270 bytes；滿場（30 隻敵人）約 1～2 KB。4 人一班約 3～5 MB 流量。
- 舊版全站 `play` 頻道（人數平方成長）已經拿掉；`heroes-db` 的 postgres_changes 也拿掉，改成每 60 秒重抓一次排行榜（只在前景分頁）。

## 6. 上線前（使用者要做）

1. Supabase → SQL Editor 執行 `supabase/shifts.sql`（可重複執行）。沒跑也能玩，只是打工戰績、職級只記在玩家自己的裝置，打工榜與 12 區只看得到自己（大廳會寫「打工戰績欄位還沒建好」）。
2. 推上 `main` 後用 `curl -s "https://taipei-hold-the-line.pages.dev/js/room.js?v=$RANDOM" | head -3` 確認部署生效。舊版還開著的人重新整理才會換到新版；新舊版本混用時房間會提示「版本不同，請重新整理」。

## 7. 待辦（建議順序）

1. **在正式後端實測多人**：這輪多人只用「兩個分頁＋假的 Realtime（BroadcastChannel）」測過（建房、加入、開工、位置同步、特殊技、結算、房客離開由 NPC 代打、回來拿回位置、房主離開關房）。正式 Supabase 的延遲、斷線重連、presence 時序還沒實測。
2. **房主換人**：現在房主離開這班就中止。可以讓下一位房客接手（他手上已經有快照，敵人狀態大致都在）。
3. **頻道權限**：Realtime 公開頻道任何人都能加入、冒充房主送快照或冒充房客送位置。影響只在那一房、內容都有驗證，但要擋的話改用 private channel＋RLS（Realtime Authorization）。
4. **WebRTC 直連**：快照改走 P2P，Supabase 只做信令，訊息量幾乎歸零；要處理 NAT 穿不過（台灣行動網路常見）時退回 broadcast。
5. 新手教學（第一次開工時的提示）、音效、更多打工場、第 4 波的「網軍總司令」（類似打工的頭目鮭魚）。
6. 舊壓力測試腳本 `scripts/stress/` 量的是已經拿掉的 `play` 頻道；要量房間就改成每 4 人一房、各自的 `shift-*` 頻道。

## 8. 規則與陷阱

- **秘密**：後台密碼絕對不要寫進任何檔案、commit、測試。service_role key 絕不進 repo。
- **內容**：UI 不提「綠營」；對手只用遊戲角色代稱，不點名真人；NPC 同事名字是虛構的；二創惡搞、非官方的警語要明顯（手機開工時藏在左上那塊的「二創惡搞」小標）。
- **快取**：js/css 是 `no-cache`，three.js（`/vendor/*`）一年 immutable。
- **`.ic` 是 SVG 圖示的共用 class**（`line-height:0`），裡面放 emoji 會錯位，要另外把行高還回來。
- **按鈕樣式**：`.room-btns button`、`.res-btns button` 會蓋掉 `.go` 的底色，已經另外指定。

## 9. 測試工作法（Playwright）

- 本機 `python3 -m http.server 8080`；Chromium 加 `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`；擋 `fonts.googleapis.com`；要本機模式就再擋 `**/supabase-js@*/**`。
- 3D 在 swiftshader 很慢：`window.PI.scene.visible = false` 再跑；要截圖前再打開。
- **快轉一整班**：`G.paused = true` 讓主迴圈不推進，自己呼叫 `PI.game.step(0.025)` 跑到 `G.phase === 'result'`；roster 全部 `npc: true` 就是全自動。
- **指定魔王**：`PI.game.debugSpawn('bigv')`（只在波次中、模擬端有效）。
- **多人不碰正式後端**：用 `addInitScript` 塞一個用 `BroadcastChannel` 轉送的假 Supabase（`channel/on/subscribe/send/track/untrack/presenceState`、`removeChannel`、`from().upsert`、`rpc`），兩個分頁各設 `PIStore.state.sb`、`uid`、`mode = 'supabase'`，再把大廳的多人按鈕 `disabled` 拿掉。
- 除錯入口：`window.PI`（`game`、`nav`、`ui.room`、`people`、`scene`、`camera`、`controls`、`centers`），`window.PIStore`。

## 10. 補充（同一天稍晚）：逛城市＋金蛋經濟

（中間一度把原本的塔防拿回來當「守城」分頁，之後依使用者要求改成「逛城市」；塔防程式只留在 git 歷史，`7b0db26` 以前與 `4f06c1f`。舊的 `rounds`／`kills`／`finals` 欄位不讀也不寫。）

### 逛城市（`js/explore.js`、`js/exploreui.js`、`config.explore`）
- 大廳上方兩個分頁「🥚 打工／🏙 逛城市」，選過的記在裝置（`localStorage pi-mode`）。`.shift-only`／`.explore-only` 依分頁顯示。
- 逛城市時打工那邊仍是大廳狀態（居民散步、市長巡迴照舊）；自己的角色與其他人用 `game.setExtraWalkers()` 一起畫。輸入（鍵盤、搖桿）由 main.js 的 `applyInput` 轉給 `explore.setMove`；點地板 `explore.moveTo`（`nav.gridPath`，最多展開 `pathNodes` 格，跨島也找得到橋）。
- 地點：服飾店＝`config.explore.boutiques` 那幾座島的第 1 棟小房子（main.js 收集成 `BOUTIQUES`、掛「👕 服飾店」名牌，只在逛城市時顯示）；工地＝目前在蓋的城市建設（`placeCity` 記住 `citySite`）；市長＝`game.G.mayor`。走到 `near` 範圍內發 `near` 事件，右下出現「進去」鈕（E）。`explore.goTo(kind)` 是「帶我去」（市長會走動，每 0.6 秒重新對準）。
- 時鐘：`explore.G.clock`（分鐘）從 10:00 開始每秒走 `clockRate` 分鐘；按時段時 `tween` 平順轉過去。鳥瞰＝城市中心正上方 `birdHeight`。
- 多人同框：`store.playOn(true)` 只在逛城市時加入 `play` 頻道；位置每 0.5～4 秒（依在線人數）送一次，沒動時 6 秒心跳，收到的全部驗證（職業、座標範圍、穿著字串格式、暱稱長度）。人多時要改成只送附近的人或分房。
- 全城加成「城市嘉年華」解鎖後，逛城市晚上（`env.night ≥ 0.5`）放煙火（`explore.view`）。

### 金蛋經濟（`js/shop.js`、`config.econ`、`supabase/economy.sql`）
- 錢包 = `eggs − donated − built − spent`。只有打工會加 `eggs`。`store.buy(cat, id)`（買過的再點＝換上）、`unequip(cat)`、`give('built'|'donated', n)`、`econ()`（錢包、全站累計、榜單）。
- 商店面板依地點開放：新衣服只能在服飾店買（買過的隨時能換）；投金蛋要在工地旁；捐獻金要在市長旁。不在旁邊時面板有「帶我去」。
- 衣服：`outfit` 字串「帽子.背心.配件」（沒穿寫 `-`），`owned` 是 `cat:id` 逗號清單。`people.makeWalker(role, pos, cls, fit)` 依字串加帽子、換背心顏色、加配件（換帽子時職業帽拿掉、手上道具保留）。打工：房間 presence `fit` → 開工設定 roster `fit`；逛城市：位置訊息 `o`。收到的字串只認 config 裡有的 id。
- 蓋城市：全站 `built` 加總（每人不超過自己的 eggs）依序蓋 `config.econ.city`。位置是各島 3 棟小房子之一（`house` 0～2）；main.js 的 `placeCity()` 依狀態畫小房子／工地（`crane`）／建築，並加名牌。蓋城市投入的金蛋再算一次進 12 區對抗。
- 政治獻金（惡搞）：全站 `donated` 加總解鎖 `tiers`。打工加成由房主開工時算好放進開工設定 `boost`（解鎖幾階，房客照收），game.js `boostOf()` 套用（受傷減免、配額、特殊技次數）。自己捐了市長回一句（面板裡與地圖上都有），新解鎖時公告一次（每台裝置記 `pi-tier-seen`）；市長每講 4 次感謝獻金榜第一名。
- **上線前要跑 `supabase/economy.sql`**（可重複執行；有「花的不能比賺的多」的 check）。沒跑時花費只記在本機、全站數字只算自己（錢包旁會寫「只記在這台裝置」）。
- 已知限制：跟打工戰績一樣，數字由玩家自己的瀏覽器寫（RLS 只限本人那一列），有心人能改自己的 eggs 再花。要防就把「搬進籃子」與「花費」改成 RPC，由伺服器端加減。
- 警語（`config.econ.legal`）放在商店面板底部：金蛋不是錢、不能買賣；政治獻金不是真的捐款，跟任何候選人、政黨、選舉都無關。
