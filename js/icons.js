/* 卡通圖示（原創 SVG）：粗黑框、奶油／珊瑚／暖黃配色，跟整站的 Q 版風格一致。用在表情列、說話泡泡、跟隨與全景按鈕。 */
const S = 'stroke="#211d1d" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"';
const svg = body => `<svg viewBox="0 0 32 32" width="1em" height="1em" aria-hidden="true" focusable="false">${body}</svg>`;
export const ICONS = {
  // 揮手：圓胖手掌＋兩道揮動弧線
  hi: svg(`<path d="M5.5 9.5c.9-2.2 2.4-3.8 4.6-4.8M26.5 22.5c1.8-1.1 3-2.7 3.4-4.7" fill="none" stroke="#db6a41" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M10.6 20.2c-1.7-2.4-4.2-5.2-2.9-6.5 1.3-1.2 3 .3 4.2 1.8l.2-7.6c0-1.7 3-1.7 3 0l.2 6.2.4-7.7c.1-1.7 3.1-1.7 3.1 0l.1 7.8.9-6.1c.3-1.6 3.1-1.3 2.9.4l-.6 7 1.4-3.9c.6-1.5 3.1-.9 2.7.8l-1.5 6.9c-.9 4.1-3.6 7.2-8 7.2-3.2 0-5.2-1.7-6.9-4.3z" fill="#f8d2ae" ${S}/>
    <circle cx="13.2" cy="21.6" r="1.3" fill="#f2a1a1"/>`),
  // 求援：紅色警示燈＋黃色光芒
  help: svg(`<path d="M16 2.8v3.4M6.2 6.8l2.3 2.3M25.8 6.8l-2.3 2.3M2.8 15.2h3.3M29.2 15.2h-3.3" stroke="#f2b530" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M9 23.5v-7a7 7 0 0 1 14 0v7z" fill="#e8553f" ${S}/><path d="M12.6 16.6a3.6 3.6 0 0 1 3.4-3.5" fill="none" stroke="#fff8f4" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="6.5" y="23.2" width="19" height="5.4" rx="2.2" fill="#78685e" ${S}/>`),
  // 交給我：珊瑚色盾牌＋黃星
  mine: svg(`<path d="M16 3.6l10.4 3.9v7.4c0 6.6-4.4 11.3-10.4 13.5C10 26.2 5.6 21.5 5.6 14.9V7.5z" fill="#db6a41" ${S}/>
    <path d="M9.4 9.8v5.1c0 3.2 1.4 6 4 7.9" fill="none" stroke="#fff8f4" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>
    <path d="M16 9.4l2 4 4.4.6-3.2 3.1.8 4.4-4-2.1-4 2.1.8-4.4-3.2-3.1 4.4-.6z" fill="#fcea8b" ${S} stroke-width="1.5"/>`),
  // 謝啦：瞇眼笑臉＋腮紅＋小星光
  thx: svg(`<circle cx="15.5" cy="17.5" r="11" fill="#fcd667" ${S}/>
    <path d="M10 16q1.9-2.2 3.8 0M17.2 16q1.9-2.2 3.8 0" fill="none" ${S}/><path d="M12 20.4q3.5 3.9 7 0" fill="none" ${S}/>
    <circle cx="9.3" cy="19.6" r="1.6" fill="#f2a1a1"/><circle cx="21.7" cy="19.6" r="1.6" fill="#f2a1a1"/>
    <path d="M26.6 3.2l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="#db6a41"/>`),
  // 守住了：拉炮＋彩帶紙花
  yay: svg(`<path d="M4.6 27.6l5.1-13.4 8.3 8.3z" fill="#f2b530" ${S}/><path d="M7.4 21.2l3.5 3.5M9.1 16.8l6.2 6.2" stroke="#db6a41" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M14.5 13.5c.6-3.4 3-5.2 6-4.6M18.5 17.5c3.1-.9 5.6.5 6.3 3.3" fill="none" stroke="#58a6a6" stroke-width="2" stroke-linecap="round"/>
    <rect x="20.5" y="3.5" width="3" height="3" rx=".8" fill="#db6a41" transform="rotate(20 22 5)"/><circle cx="27" cy="11" r="1.7" fill="#6f7fb5"/><circle cx="13" cy="6" r="1.5" fill="#e8553f"/><rect x="25.5" y="16" width="3" height="2.4" rx=".8" fill="#f2b530" transform="rotate(-25 27 17)"/>`),
  // 校園加油：有表情的愛心
  love: svg(`<path d="M16 27.5S5.5 21.2 5.5 13.8a5.6 5.6 0 0 1 10.5-3 5.6 5.6 0 0 1 10.5 3c0 7.4-10.5 13.7-10.5 13.7z" fill="#e8553f" ${S}/>
    <path d="M9.2 12.6a3 3 0 0 1 2.6-2.4" fill="none" stroke="#fff8f4" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12.6" cy="16.2" r="1.3" fill="#211d1d"/><circle cx="19.4" cy="16.2" r="1.3" fill="#211d1d"/><path d="M14 19.4q2 2 4 0" fill="none" stroke="#211d1d" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="10.6" cy="19" r="1.3" fill="#f7b3a8"/><circle cx="21.4" cy="19" r="1.3" fill="#f7b3a8"/>`),
  // 跟隨鏡頭：圓胖攝影機（機身色可由 --cam 換，按下時反白）
  cam: svg(`<circle cx="9" cy="8.6" r="4.4" fill="#fff8f4" ${S}/><circle cx="17.6" cy="9.4" r="3.6" fill="#fff8f4" ${S}/><circle cx="9" cy="8.6" r="1.3" fill="#211d1d"/><circle cx="17.6" cy="9.4" r="1.1" fill="#211d1d"/>
    <rect x="3.4" y="13" width="18.4" height="13" rx="4" style="fill:var(--cam,#db6a41)" ${S}/><path d="M21.8 17.4l6.8-3.6v11.4l-6.8-3.6z" fill="#78685e" ${S}/>
    <circle cx="8.4" cy="18" r="1.9" fill="#fcea8b" ${S} stroke-width="1.3"/><path d="M12.4 22.2h6" stroke="#fff8f4" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>`),
  // 全景：一塊島嶼地塊＋小房子＋樹
  home: svg(`<path d="M3.5 16.5v4.2L16 28l12.5-7.3v-4.2" fill="#c9a77c" ${S}/><path d="M16 9.2l12.5 7.3L16 23.8 3.5 16.5z" fill="#8fc46a" ${S}/>
    <rect x="12.2" y="12.6" width="7.4" height="6.6" rx="1" fill="#fff8f4" ${S} stroke-width="1.5"/><path d="M10.8 13.4l5.1-4.6 5.1 4.6z" fill="#db6a41" ${S} stroke-width="1.5"/><rect x="15" y="15.4" width="2" height="3.8" rx=".5" fill="#78685e"/>
    <circle cx="23" cy="13.6" r="2.6" fill="#5f9e4a" ${S} stroke-width="1.4"/><path d="M23 16.2v1.8" stroke="#211d1d" stroke-width="1.5" stroke-linecap="round"/>`),
};
// 同學站出來：兩隻舉高的手＋光芒（左右鏡像的揮手掌）
const HAND = 'M10.6 20.2c-1.7-2.4-4.2-5.2-2.9-6.5 1.3-1.2 3 .3 4.2 1.8l.2-7.6c0-1.7 3-1.7 3 0l.2 6.2.4-7.7c.1-1.7 3.1-1.7 3.1 0l.1 7.8.9-6.1c.3-1.6 3.1-1.3 2.9.4l-.6 7 1.4-3.9c.6-1.5 3.1-.9 2.7.8l-1.5 6.9c-.9 4.1-3.6 7.2-8 7.2-3.2 0-5.2-1.7-6.9-4.3z';
ICONS.cheer = svg(`<path d="M16 1.8v3M9.6 3.4l1.3 2.4M22.4 3.4l-1.3 2.4" stroke="#db6a41" stroke-width="2.2" stroke-linecap="round"/>
  <g transform="translate(-1.2 7.4) scale(.66) rotate(-12 16 16)"><path d="${HAND}" fill="#f8d2ae" stroke="#211d1d" stroke-width="2.6" stroke-linejoin="round"/></g>
  <g transform="translate(33.2 7.4) scale(-.66 .66) rotate(-12 16 16)"><path d="${HAND}" fill="#f8d2ae" stroke="#211d1d" stroke-width="2.6" stroke-linejoin="round"/></g>`);
ICONS.five = ICONS.hi; ICONS.here = ICONS.hi; // 闖關的「這邊！」沿用揮手
// 怎麼玩：黃色對話框＋問號
ICONS.howto = svg(`<path d="M16 3.5c7 0 12.5 4.6 12.5 10.6S23 24.7 16 24.7c-1.5 0-2.9-.2-4.2-.6L6 27.5l1.4-5.6C5 20 3.5 17.2 3.5 14.1 3.5 8.1 9 3.5 16 3.5z" fill="#fcea8b" ${S}/>
  <path d="M12.6 11.4a3.5 3.5 0 0 1 6.8 1.1c0 2.4-3.4 2.8-3.4 5" fill="none" stroke="#211d1d" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="21" r="1.5" fill="#211d1d"/>`);
// 課程卡的分類圖示：依標籤（去掉 #）挑，沒有對應的用 fallback
export const POLICY_ICONS = {
  // 居住：珊瑚屋頂小屋＋黃門＋藍窗
  居住: svg(`<path d="M7 14.5V27h18V14.5" fill="#fff8f4" ${S}/><path d="M3.8 15.6L16 5.2l12.2 10.4z" fill="#db6a41" ${S}/>
    <rect x="13.4" y="19" width="5.2" height="8" rx="1" fill="#fcea8b" ${S}/><rect x="20" y="16.8" width="3.4" height="3.4" rx=".6" fill="#58a6a6" ${S} stroke-width="1.4"/>`),
  // 育兒：奶瓶＋刻度
  育兒: svg(`<path d="M13.6 4.4h4.8l.7 4.2h-6.2z" fill="#f2a1a1" ${S}/><rect x="10.8" y="8.4" width="10.4" height="3.2" rx="1.2" fill="#db6a41" ${S}/>
    <rect x="10.6" y="11.6" width="10.8" height="16" rx="3.4" fill="#fff8f4"/><path d="M10.8 19.2h10.4v4.8a3.3 3.3 0 0 1-3.3 3.4h-3.8a3.3 3.3 0 0 1-3.3-3.4z" fill="#fcea8b"/>
    <rect x="10.6" y="11.6" width="10.8" height="16" rx="3.4" fill="none" ${S}/><path d="M14 15.2h3M14 18h2" stroke="#211d1d" stroke-width="1.4" stroke-linecap="round"/>`),
  // 敬老：黃色卡片＋愛心
  敬老: svg(`<rect x="3.5" y="8" width="25" height="17" rx="3" fill="#fcea8b" ${S}/><path d="M3.5 12.6h25" stroke="#211d1d" stroke-width="1.8"/>
    <path d="M10.5 22.6c-3-1.8-4.6-3.5-4.6-5.3a2.3 2.3 0 0 1 4.6-.4 2.3 2.3 0 0 1 4.6.4c0 1.8-1.6 3.5-4.6 5.3z" fill="#db6a41" ${S} stroke-width="1.4"/>
    <path d="M18.4 17.4h6.6M18.4 20.8h4.2" stroke="#211d1d" stroke-width="1.6" stroke-linecap="round"/>`),
  // 交通：正面公車
  交通: svg(`<rect x="6" y="4.5" width="20" height="21" rx="4" fill="#58a6a6" ${S}/><rect x="9" y="8" width="14" height="7.6" rx="1.5" fill="#fff8f4" ${S}/>
    <circle cx="11" cy="20.2" r="1.7" fill="#fcea8b" ${S} stroke-width="1.4"/><circle cx="21" cy="20.2" r="1.7" fill="#fcea8b" ${S} stroke-width="1.4"/>
    <path d="M9.5 26v2.2M22.5 26v2.2" stroke="#211d1d" stroke-width="2.6" stroke-linecap="round"/>`),
  // 運動：棒球
  運動: svg(`<circle cx="16" cy="16" r="11.5" fill="#fff8f4" ${S}/>
    <path d="M9.2 6.8c2.6 2.4 3.9 5.4 3.9 9.2s-1.3 6.8-3.9 9.2M22.8 6.8c-2.6 2.4-3.9 5.4-3.9 9.2s1.3 6.8 3.9 9.2" fill="none" stroke="#db6a41" stroke-width="1.8" stroke-dasharray="1.6 1.7"/>`),
  // 產業：晶片
  產業: svg(`<path d="M11 4v4M16 4v4M21 4v4M11 24v4M16 24v4M21 24v4M4 11h4M4 16h4M4 21h4M24 11h4M24 16h4M24 21h4" stroke="#211d1d" stroke-width="1.8" stroke-linecap="round"/>
    <rect x="7.5" y="7.5" width="17" height="17" rx="3" fill="#4a3f8f" ${S}/><rect x="12" y="12" width="8" height="8" rx="1.5" fill="#fcea8b" ${S} stroke-width="1.4"/>`),
  // 教育：翻開的書
  教育: svg(`<path d="M16 9c-3-2.2-7-2.6-11-1.6v17c4-1 8-.6 11 1.6 3-2.2 7-2.6 11-1.6v-17c-4-1-8-.6-11 1.6z" fill="#fff8f4" ${S}/><path d="M16 9v17" stroke="#211d1d" stroke-width="1.8"/>
    <path d="M8 12.6c2-.3 3.8 0 5 .7M8 16.6c2-.3 3.8 0 5 .7M19 13.3c1.2-.7 3-1 5-.7M19 17.3c1.2-.7 3-1 5-.7" stroke="#db6a41" stroke-width="1.6" stroke-linecap="round" fill="none"/>`),
  // 智慧：手機＋訊號
  智慧: svg(`<rect x="9" y="3.5" width="14" height="25" rx="3.2" fill="#fff8f4" ${S}/><rect x="11.2" y="7" width="9.6" height="15" rx="1.2" fill="#fcea8b" ${S} stroke-width="1.4"/>
    <circle cx="16" cy="25.3" r="1.1" fill="#211d1d"/><path d="M12.8 13.4a4.5 4.5 0 0 1 6.4 0M14.5 15.6a2 2 0 0 1 3 0" fill="none" stroke="#db6a41" stroke-width="1.7" stroke-linecap="round"/><circle cx="16" cy="18" r="1" fill="#db6a41"/>`),
  // 環境：圓樹冠
  環境: svg(`<rect x="14.2" y="17" width="3.6" height="10.5" rx="1" fill="#b98a63" ${S}/><circle cx="16" cy="12.5" r="8.5" fill="#8fb37a" ${S}/>
    <path d="M11.8 11.6a4.4 4.4 0 0 1 3.6-3.6" stroke="#fff8f4" stroke-width="1.8" stroke-linecap="round" opacity=".75" fill="none"/><path d="M8.5 28h15" stroke="#211d1d" stroke-width="1.8" stroke-linecap="round"/>`),
  // 都更：吊車吊著新房子
  都更: svg(`<rect x="7" y="5" width="3.4" height="23" rx="1" fill="#f2b530" ${S}/><rect x="4" y="5.4" width="23.5" height="3" rx="1" fill="#f2b530" ${S}/>
    <path d="M22.5 8.4v4.4" stroke="#211d1d" stroke-width="1.4"/><path d="M17.5 27.6v-8.2l5-3.8 5 3.8v8.2z" fill="#fff8f4" ${S}/><rect x="21" y="22.4" width="3" height="5.2" rx=".6" fill="#db6a41" ${S} stroke-width="1.3"/>
    <path d="M3.5 28h11" stroke="#211d1d" stroke-width="1.8" stroke-linecap="round"/>`),
  // 青年：小火箭
  青年: svg(`<path d="M10.6 16.2l-3.6 3.4.4 4.4 4.6-3.5M21.4 16.2l3.6 3.4-.4 4.4-4.6-3.5" fill="#db6a41" ${S}/>
    <path d="M16 3.5c4.2 3 6 7.6 5.4 13.6L19 20.5h-6l-2.4-3.4C10 11.1 11.8 6.5 16 3.5z" fill="#fff8f4" ${S}/><circle cx="16" cy="11.5" r="2.3" fill="#58a6a6" ${S} stroke-width="1.4"/>
    <path d="M14 21.5c-.4 2.2 0 4.2 2 6 2-1.8 2.4-3.8 2-6z" fill="#f2b530" ${S} stroke-width="1.4"/>`),
  // 文化：拉開布幕的舞台＋星星
  文化: svg(`<rect x="4" y="5" width="24" height="22" rx="2" fill="#fff8f4" ${S}/><path d="M5 8c2.5 1 5.2 4.3 5.9 12.6L5 22zM27 8c-2.5 1-5.2 4.3-5.9 12.6L27 22z" fill="#db6a41" ${S}/>
    <rect x="4" y="5" width="24" height="3.4" rx="1" fill="#c9452f" ${S}/><path d="M16 12.6l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="#fcea8b" ${S} stroke-width="1.3"/>`),
  // 安全：黃色三角警示牌＋走路小人
  安全: svg(`<path d="M16 3.8l12.6 22H3.4z" fill="#fcea8b" ${S}/><circle cx="16.6" cy="11.6" r="1.9" fill="#211d1d"/>
    <path d="M16.2 14.4l-1.1 4.4 2.4 1.8.9 3.2M15.1 18.8l-2 3.8M15.9 15l-2.5 1.9M16.4 15.2l2.7 1.5" stroke="#211d1d" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`),
  // 社子島：綠色小島＋旗子＋水波
  社子島: svg(`<path d="M4 20.5c3-6.5 7-9.5 12-9.5s9 3 12 9.5z" fill="#8fb37a" ${S}/><path d="M14.2 11V4.6l6 2.3-6 2.3" fill="#db6a41" ${S} stroke-width="1.5"/>
    <path d="M3 25c2.2-1.6 4.3-1.6 6.5 0s4.3 1.6 6.5 0 4.3-1.6 6.5 0 4.3 1.6 6.5 0" fill="none" stroke="#58a6a6" stroke-width="2.2" stroke-linecap="round"/>`),
  // 觀光：燈籠
  觀光: svg(`<path d="M16 2.8v3" stroke="#211d1d" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="16" cy="15.5" rx="9" ry="8.3" fill="#db6a41" ${S}/>
    <path d="M16 7.4v16.2M11.6 8.6c-1.6 4.4-1.6 9.4 0 13.8M20.4 8.6c1.6 4.4 1.6 9.4 0 13.8" stroke="#211d1d" stroke-width="1.3" fill="none" opacity=".5"/>
    <rect x="12" y="5.6" width="8" height="2.6" rx="1" fill="#f2b530" ${S} stroke-width="1.5"/><rect x="12" y="22.6" width="8" height="2.6" rx="1" fill="#f2b530" ${S} stroke-width="1.5"/>
    <path d="M14 25.4v3M16 25.4v3.6M18 25.4v3" stroke="#f2b530" stroke-width="1.6" stroke-linecap="round"/>`),
  // 其他：珊瑚圓底＋黃星
  fallback: svg(`<circle cx="16" cy="16" r="11.5" fill="#db6a41" ${S}/><path d="M16 8.6l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#fcea8b" ${S} stroke-width="1.5"/>`),
};
// 科目圖示：沿用既有的卡通圖示，數學與英語用字母磚
POLICY_ICONS.國語 = POLICY_ICONS.教育; POLICY_ICONS.自然 = POLICY_ICONS.環境; POLICY_ICONS.社會 = POLICY_ICONS.社子島; POLICY_ICONS.生活 = POLICY_ICONS.智慧; POLICY_ICONS.期末考 = POLICY_ICONS.安全;
POLICY_ICONS.數學 = svg(`<rect x="4" y="4" width="24" height="24" rx="5" fill="#fcea8b" ${S}/><path d="M9 11h6M12 8v6M17 11h6M9 21h6M17 19h6M17 23h6" stroke="#211d1d" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="21" r="1.4" fill="#db6a41"/>`);
POLICY_ICONS.英語 = svg(`<rect x="4" y="4" width="24" height="24" rx="5" fill="#58a6a6" ${S}/><text x="16" y="21.5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="13" fill="#fff8f4" stroke="#211d1d" stroke-width=".8">ABC</text>`);
export const policyIcon = tag => POLICY_ICONS[String(tag || '').replace(/^#/, '')] || POLICY_ICONS.fallback;
