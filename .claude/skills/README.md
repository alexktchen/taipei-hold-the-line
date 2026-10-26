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
