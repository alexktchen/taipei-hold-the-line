# 台北車流模擬（`/traffic/`）交接文件

和萬安政策島同一個 repo、同一套畫風的另一個頁面：用 OpenStreetMap 的道路與臺北市公開的號誌位置、時制計畫，畫出台北市地圖並模擬車流。實驗性質、非官方，**不是即時路況**。

## 資料流程（GitHub Actions）
- 這個雲端開發環境連不到 overpass-api.de、data.gov.tw、data.taipei，所以資料在 GitHub 的機器上抓：`.github/workflows/traffic-data.yml` 跑 `scripts/traffic/build-data.mjs`，結果 commit 回 main 的 `traffic/data/`（Cloudflare Pages 接著部署）。
- 觸發：GitHub → Actions →「台北車流資料」→ Run workflow；或改了 `scripts/traffic/**`、這個 workflow 檔推上 main 時自動跑。大約 10 分鐘。
- 來源：
  - Overpass：道路（`highway` motorway～service，service 只留 alley 或沒標的）、`highway=traffic_signals` 節點、市界（`ISO3166-2=TW-TPE`）、12 區界、水域、綠地。鏡像站會回 502 或空結果，腳本會換站重試（`minCount`）。
  - 政府資料開放平臺 API（`https://data.gov.tw/api/v2/rest/dataset/<id>`）找下載網址：121890 臺北市號誌位置（tab 分隔 CSV：流水號、地點、行政區、WGS 經緯度）、145720 臺北市路口號誌時制計畫（兩個 JSON＋一個 CSV）。
- 臺北市時制的格式（2026-10 實測）：
  - 時段表 JSON：每個路口（`icid`）每種日型一筆，`segmenttype` 1～7（當成週一～週日），`subsegment` 是「`time` HHMM 起用第 `planid（SeqNo）` 號計畫」。
  - 計畫 JSON：每個路口每號計畫一筆，`cycletime` 週期、`offset` 時差、`direction`（0/2/4/6，當成第一時相是北東南西——南北或東西）、`phaseorder`（時相編碼，目前沒用）、`subplan` 各時相的 `green`／`yellow`／`allred`。
  - CSV：`icid`、設備編號、路口名稱、群組、經緯度、三合一報表 PDF 連結。用它的經緯度把時制對到路口。
  - 原始 JSON 兩個共約 60 MB，超過 Cloudflare Pages 單檔 25 MB 上限：只放 `/tmp`（`RAW_DIR`），repo 的 `traffic/data/raw/` 只留 CSV 與每個 JSON 前 5 筆樣本。
- 整理：
  - 道路圖：節點＝端點、兩條路以上共用的點、號誌節點；邊＝兩節點之間的一段（折線 Douglas-Peucker 0.8 m）。等級 0 快速道路、1 快速公路、2 主要、3 次要、4 三級、5 巷弄、6 巷道。車道數看 `lanes`／`lanes:forward|backward`，沒有就依等級預設；單行道 `oneway`（-1 會反轉）。高架 `bridge`＋`layer`，隧道不畫。
  - 號誌路口：OSM 號誌節點與臺北市位置 30 m 內聚成一個路口；只有臺北市位置的接到 35 m 內最近、3 條路以上的節點。有 `icid` 的帶上時制（`timing: { days, dmap, plans }`）。
  - 座標：原點台北車站（25.0478, 121.5170），x 向東、z 向南，公尺；檔案存公寸整數。
- 檔案：`meta.json`（市界、行政區、來源、統計）、`net-main.json`（等級 0～4）、`net-minor.json`（5～6，節點接在主要後面編號）、`signals.json`、`water.json`、`green.json`。
- 本機測試資料腳本：`TRAFFIC_CACHE=<Overpass 快取資料夾> GOV_DIR=<臺北市原始檔資料夾> node scripts/traffic/build-data.mjs`。

## 前端（`traffic/`）
- `index.html`、`traffic.css`：和遊戲同一套奶油色面板。左上品牌、右上鏡頭、左邊數據、下方工具列（時間、速度、時段、交通量、圖層）、路況圖例、版權。第一次來顯示說明。資料還沒建好時顯示「資料還在準備」。
- `js/data.js`：道路圖（nodes、edges、links〔有方向〕、車道、停止線）、高架節點高度、折線取點、空間格子。
- `js/roads.js`：道路帶狀網格，vertex shader 依鏡頭距離放寬到至少幾個像素（`uPx`＝每像素幾公尺）；雙向路左右兩半分開依車速上色。地面圖層全部不做深度測試、照 `renderOrder` 疊（不閃爍），建築與車照常深度測試。
- `js/signals.js`：每個路口兩組方向。真實時制：依模擬的星期幾與時刻選計畫（`choose`），階段＝黃燈 0 的時相併到下一個；前一半階段給第一組。`direction` 決定第一組是南北向或東西向（進入路段的行進方向接近 ±z 算南北）。推估時制：週期看最大的路、綠燈依兩組車道數與等級分、時差依主軸投影÷12 m/s（綠波）。
- `js/sim.js`：IDM 跟車（a 1.4、b 2.2、s0 2.2、T 1.3）。車道最前面的車看：紅燈或來不及停的黃燈→停在停止線；小路接大路要讓；下一段沒空間就不進路口；卡 90 秒以上（不是紅燈）就移除。到路口依等級與轉彎角度選下一段（直走＞右轉＞左轉，很少迴轉），一趟跑完在路口消失。車量＝基準×時段曲線（`PROFILE`，上下班尖峰）×交通量滑桿，從路口開出來補。每 2 秒依車速／速限更新每段路的路況。
- `js/view.js`：車（轎車、計程車黃、公車藍）與紅綠燈（每個進入方向一支桿子＋一顆燈）都是 InstancedMesh，遠看依距離放大。
- `js/city.js`：地、河、綠地、區界、台北 101（真實位置）、示意建築（每 400 m 一格，沿路兩側排，避開別的路與水域綠地，鏡頭附近才生成）。
- `js/main.js`：先載主要道路就能看，巷弄背景載入後再接上；縮放分層：拉遠只有快速道路與主要幹道，16 km 內出現次要道路，5.5 km 內巷弄，2.6 km 內建築，1.5 km 內紅綠燈桿；點路口看兩個方向的燈號時間軸、現在用第幾號計畫、今天的時段表；點道路看路名、車道、車速。
- 模擬時間從台北現在的時刻開始；工具列可以切時段與速度（5 倍速以上每步 0.4 秒，每幀最多算 9 ms）。

## 限制與待辦
- 時制的 `phaseorder`（左轉保護、行人專用時相等）沒用上，同一組方向在它所有階段都當綠燈；`segmenttype` 1～7 的星期對應、`direction` 的方向意義是從資料推的。
- 車流是取樣：桌機最多約 1.2 萬台、手機 5 千台，主要分布在幹道；沒有起訖點，到路口隨機選路。可以接 TDX 的 VD（車輛偵測器）資料校正每條路的量。
- 建築是示意；之後可以改用 OSM 建物輪廓（量很大，要分格）。
