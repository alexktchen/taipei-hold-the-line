# 專案技能（Claude Code skills）

這個資料夾的技能在這個 repo 開 Claude Code（本機或雲端）時自動載入，依描述自動觸發，也可以打 `/技能名稱` 直接叫。

## 遊戲開發技能（awesome-gamedev-agent-skills）

- 來源：<https://github.com/gamedev-skills/awesome-gamedev-agent-skills>，commit `184b72b`（2026-10-24）。
- 授權：Apache-2.0，原文與 NOTICE 在 `awesome-gamedev-agent-skills.LICENSE`、`awesome-gamedev-agent-skills.NOTICE`。
- 內容：`router`（先判斷引擎與任務、再挑該讀的技能）加上 76 個技能，照官方「Claude Code manual copy」方式攤平放在這一層：
  - 引擎：Godot、Unity、Unreal、Ebitengine、Phaser、PixiJS、three.js（`threejs-*`）、Bevy、pygame、LÖVE、Defold、Roblox
  - 跨引擎：`game-feel`、`game-ui-ux`、`camera-systems`、`performance-optimization`、`shader-programming`、`procedural-gen`、`game-ai`、`audio-design`、`save-systems`、`input-systems`、`physics-tuning`、`level-design`、`dialogue-systems`、`create-game-assets`、`ai-behavior-trees-utility-ai`
  - 類型：`tower-defense`、`rpg`、`roguelike`、`platformer`、`fps-shooter`、`card-game`、`visual-novel`、`survival-crafting`、`puzzle`
  - 流程：`game-jam`、`prototype-fast`、`itch-publish`、`steam-publish`
- 本專案注意：three.js 放在 `vendor/three`（r160），沒有 `package.json`，router 的自動偵測認不出來；`threejs-*` 技能以 r186 為基準，這裡照 r160 的 API 寫（不升級）。
- 更新：重新 clone 上游，刪掉這裡同名的技能資料夾後照上游 `docs/INSTALLATION.md` 的「Claude Code (manual copy)」再複製一次，並更新上面的 commit。

## three.js 技能（threejs-skills）

- 來源：<https://github.com/cloudai-x/threejs-skills>，commit `0e18186（2026-10-19）`。
- 授權：MIT，原文在 `threejs-skills.LICENSE`。
- 內容：13 個技能，照上游 README 的手動安裝方式（`cp -r skills/* .claude/skills/`）放在這一層：`threejs-fundamentals`、`threejs-geometry`、`threejs-materials`、`threejs-lighting`、`threejs-textures`、`threejs-animation`、`threejs-loaders`、`threejs-shaders`、`threejs-postprocessing`、`threejs-interaction`、`threejs-performance`、`threejs-react-three-fiber`、`threejs-asset-pipeline`。只有 SKILL.md 文件，沒有腳本。
- 和上面合集的 `threejs-scene-setup`、`threejs-materials-lighting`、`threejs-gltf-loading` 名稱不重複，主題有重疊，兩邊都會依描述觸發。
- 本專案注意：這套技能以 three.js r186 為基準（`HDRLoader`、`Timer`、`RenderPipeline`、WebGPU／TSL 等），本專案是 `vendor/three` 的 r160、用 WebGLRenderer 和 GLSL；照這些技能寫程式時要用 r160 有的 API（不升級）。
- 更新：重新 clone 上游，刪掉這裡 13 個 `threejs-*` 同名資料夾後再複製一次，並更新上面的 commit。

