# 交接：2026-10-24 手機修版、多人同框、壓力測試

萬安政策島 TD（二創惡搞、非官方的 3D 台北政策島塔防）。這份給下一個 session：現在長怎樣、這輪做了什麼、哪裡有坑、接下來該做什麼。

## 1. 現況一覽

| 項目 | 位置／狀態 |
|---|---|
| 正式站 | https://taipei-hold-the-line.pages.dev （Cloudflare Pages，連 GitHub `main` 自動部署，推上去約 30 秒生效） |
| 後台 | https://taipei-hold-the-line.pages.dev/admin/ （Supabase Auth 登入＋`admins` 白名單） |
| 原始碼 | GitHub `alexktchen/taipei-hold-the-line`，分支 `main`。沒有 build，純靜態 |
| 後端 | Supabase 專案 `sagvwzinlltlypxgxkre`（免費方案）。設定在 `js/backend.js`，結構在 `supabase/schema.sql`、`supabase/admin.sql` |
| 舊的 Worker | `taipei-hold-the-line.cktalex.workers.dev` 已停用、刪除，回 404 |
| 舊的 twquant 分支 | `twquant` repo 的 `poc/policy-island-td` 是很早的同步副本，已不再更新，可刪 |

**確認部署生效的方法**：`curl -s "https://taipei-hold-the-line.pages.dev/js/<檔案>?v=$RANDOM" | grep <新程式碼片段>`。

## 2. 這輪做了什麼（依時間）

1. **Threads 推廣文案**（只在對話裡，沒進 repo）。
2. **1999 市民熱線**改成由下往上推的捲動：新的一則從底部滑入，整排往上推一格，最上面那則淡出。秒數在 `config.ticker.hotlineSlideMs`。
3. **手機修版**
   - 「二創惡搞」浮動徽章同時被 top 與 bottom 撐成整條直條，手機改收進左上品牌框。
   - 手機上熱線卡收起，改**整合進底部城市快訊**：輪到熱線時標籤換成黃底「📞 1999 熱線」。
   - 大廳「出戰」按鈕改成浮動圓角按鈕。
   - **英雄選不了**的 bug：大廳重畫時會用已存的英雄蓋掉剛點的角色，已修。
   - **Android 系統字級放大**時不再爆版：寬度依內容、關鍵字不換行、右側改圓形圖示鈕。
   - 手勢改成地圖 App 慣例：**單指拖地圖、雙指縮放旋轉**。觸控裝置上政策標籤不吃事件，從標籤上也能拖，點擊改在 canvas 用位置判斷。
4. **多人同框**（見第 3 節）。
5. **人物名牌**改成跟市長同款的 DOM 標籤：黑框圓角、下方小三角、左側徽章。「🎙 市長」徽章只有市長有，玩家徽章是英雄職業（英雄代表色），自己是「你」。名牌彼此往上疊、不互相隱藏，說話泡泡掛在名牌上方。
6. **卡通 SVG 圖示**（`js/icons.js`，原創）：表情列、跟隨鏡頭、全景、大招按鈕。取代系統 emoji。
7. **英雄自動攻擊開關**：開＝自己找怪開火；關＝「自由逛逛」，點哪走哪、不自動開火（點敵人仍可重擊）。記在 localStorage（`pi-hero-auto`），快捷鍵 A。關閉時在別人畫面上不幫打。
8. **快取**：`_headers` 把 `/js/*`、`/css/*` 改成 `no-cache`（每次用 ETag 驗證、沒改回 304）。之前是 `max-age=300`，部署後會發生「HTML 新、CSS 舊」，新功能沒樣式（自動攻擊開關只剩一行字）。
9. **壓力測試**（見第 4 節），腳本在 `scripts/stress/`。

## 3. 多人同框怎麼運作

- **頻道**（`js/store.js` 的 `initSupabase`）：每位訪客 1 條 WebSocket、3 個頻道。
  - `heroes-db`：postgres_changes，heroes 表有變動就重抓排行榜（1.5 秒去抖）。
  - `online`：presence，算線上人數，key 是匿名 uid。
  - `play`：broadcast（`self: false`），英雄位置、表情、大招，不寫資料庫。
- **訊息格式**（`js/ui.js` 的「多人同框」段）
  - `p`：位置，欄位 `n` 暱稱、`c` 職業、`x`、`z`、`r` 是否在回合中、`f` 是否在打、`a` 是否開自動攻擊。
  - `e`：表情，欄位 `k`；擊掌另有 `to` 指定對象。
  - `u`：大招。
  - `bye`：離開。
- **傳送頻率**：間隔＝在線人數 × 0.25 秒，介於 1 到 8 秒（`config.multi`）。人沒動時每 8 秒心跳一次。
- **收到的都不可信**：會驗型別、範圍、長度，限制頻率。暱稱只用 textContent 或畫布，不進 innerHTML。表情只有預設 6 種，**沒有自由輸入**。
- **遊戲端**（`js/game.js` 的 `upsertRemote` 等）：遠端英雄沿步道走到收到的位置；在**你的**世界裡以一半火力（`allyDmg`）幫打你畫面上的網軍。點遠端英雄＝擊掌。
- **各自的波次**：每個人的網軍與波次是自己裝置模擬的，**沒有同步**。別人的英雄是「來你這邊幫忙的隊友」。要真正同一波需要伺服器裁判，是大工程。
- **名牌與泡泡**：遊戲端 `emit('tag'|'say')`，`js/main.js` 的 `callbacks.tag/say` 畫成 DOM（`.nameplate.person`）。

## 4. 壓力測試結果（2026-10-24）

**方法**：`scripts/stress/sim.js`。Node 模擬玩家，每人 1 條連線＋3 個頻道，照遊戲節奏送位置。用獨立的 `stress-<時間>-*` 頻道，正式站看不到假玩家、線上人數不受影響。不做匿名登入，不產生帳號。每階段量測 25 秒，送達率低於一半就自動停止，結束時全部斷線。

| 同時在線 | 連上 | 訊息送達 | 延遲中位數 | 最慢 5% | 錯誤 |
|---|---|---|---|---|---|
| 10 | 全部 | 100% | 40 ms | 46 ms | 無 |
| 26 | 全部 | 98% | 40 ms | 55 ms | 無 |
| 40 | 全部 | 98% | 40 ms | 53 ms | 無 |
| 60 | 全部 | 100% | 41 ms | 50 ms | 無 |
| 100 | 全部 | 100% | 43 ms | 53 ms | 無 |
| 150 | 全部 | 65% | 47 ms | 78 ms | 89 個 play 頻道被斷 |

**結論**
- 多人同框的頻道撐得住約 **100 人**同時在回合中，**150 人**開始掉線、丟三分之一訊息。人數與線上數仍正確，遊戲本身照跑。
- 文件上的「每秒 100 則」實測沒有照「每位收件人」計算：100 人時每秒送達約 1,200 則仍正常。
- 硬上限是**同時 200 條連線**（免費方案）。為了不擋到真實訪客，沒有測超過 150。

**真正先撞到的是每月額度**
- **Realtime 每月 200 萬則**：位置是每人收所有人的，量大約跟人數平方成正比。若照送達計費：10 人同時約 15 小時用完、20 人約 7 小時、50 人約 2 小時、100 人不到半小時。
- **流量每月 5 GB**：每次有人打完一波，所有在線的人都會重抓整張排行榜。現在 48 列、約 6 KB（每列約 125 bytes），每多一位玩家多一列，上限 1,000 列約 125 KB。到上限時 50 人在線約一小時就用完。
- **匿名登入每 IP 每小時 30 次**（Supabase 預設，可調）：學校、公司或部分行動網路共用 IP 時可能撞到。超過的人會退回本機模式，看不到線上人數、沒有多人、不存戰績。這點**沒有實測**，只引用文件，避免產生大量假帳號。

**重跑**
```bash
cd scripts/stress && npm install
node sim.js game 10,20,40,60,100 25
```
`realtime-js` 2.45.4 用自訂 `transport` 時不會掛事件處理（函式庫 bug），所以腳本把走 proxy 的 WebSocket 設成 `globalThis.WebSocket` 再載入 supabase-js。

## 5. 待辦（建議順序）

1. **多人分房間**：每房 20 到 30 人，用 `play-<房號>`，位置只在房內交換。量會從人數平方變成線性，同時解決每秒上限與每月額度。房號可用 presence 人數挑最少的房。
2. **排行榜別每波都重抓全表**：改成只抓前 10 名＋總數（view 或 RPC），或大廳裡每 60 秒刷新一次。`heroes-db` 的 postgres_changes 也可考慮拿掉。
3. **使用者自己調**：Supabase → Authentication → Rate Limits，提高匿名登入上限。量大時考慮付費方案。
4. **確認後台登入**：Supabase Authentication → Users 是否已有 cktalex@gmail.com（Auto Confirm）。`admin.sql` 已執行（`rpc/is_admin` 存在），但不確定使用者有沒有建、能不能登入。
5. **清測試資料**：heroes 表裡有早期測試列（暱稱「連線測試」「測試甲」「寫入驗證」），可在後台刪。
6. （可選）Supabase 的 Site URL 設成 pages.dev。
7. （可選）刪 twquant 的 `poc/policy-island-td` 分支。

## 6. 規則與陷阱

- **秘密**：使用者在對話裡給過後台密碼，**絕對不要寫進任何檔案、commit、測試**，登入一律走 Supabase Auth。service_role key 絕不進 repo。anon key 只放這個 repo 的 `js/backend.js`，不放 twquant。
- **內容**：UI 不提「綠營」。對手只用遊戲角色代稱，不點名真人。跑馬燈與圖示全原創，不抄 SimCity、不模仿台北市府 logo。二創惡搞、非官方的警語要明顯。
- **快取**：js/css 是 `no-cache`，three.js（`/vendor/*`）是一年 immutable。改 vendor 要換路徑。
- **手機**：iOS 與 Android 的 Threads／LINE 內建瀏覽器會放大字級。新 UI 盡量用依內容的寬度、`white-space:nowrap`，別寫死窄寬度。
- **使用者回報「沒有」「壞了」時**，先懷疑快取：請對方關掉頁面重開。
- **commit 訊息**用中文一句話，結尾加 Co-Authored-By 與 Claude-Session 兩行。不要寫模型名稱。

## 7. 測試工作法（Playwright）

- 本機起靜態伺服器（Node `http.createServer` 讀 repo），Chromium 加 `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`。
- 擋掉 `fonts.googleapis.com`，不然 `goto` 會卡 load。要本機模式就再擋 `**/supabase-js@*/**`。
- 3D 在 swiftshader 很慢：進場後 `window.PI.scene.visible = false`，動畫與計時才會接近真實速度。
- 除錯入口 `window.PI`：`game`（含 `G`、`remotes`、`upsertRemote`、`setAuto`）、`people`、`scene`、`camera`、`controls`、`centers`。`window.PIStore` 是共享狀態。
- 多人邏輯可以不碰正式後端：兩個分頁各設 `PIStore.state.uid`，把 `PIStore.state.playCh` 換成用 `BroadcastChannel` 轉送的假物件，`subs.net` 收訊。
- 對正式站測多人：先把 `PIStore.saveHero`／`recordRound` 換成空函式，才不會寫進排行榜。
