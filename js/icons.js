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
  // 台北加油：有表情的愛心
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
// 台北人站出來：兩隻舉高的手＋光芒（左右鏡像的揮手掌）
const HAND = 'M10.6 20.2c-1.7-2.4-4.2-5.2-2.9-6.5 1.3-1.2 3 .3 4.2 1.8l.2-7.6c0-1.7 3-1.7 3 0l.2 6.2.4-7.7c.1-1.7 3.1-1.7 3.1 0l.1 7.8.9-6.1c.3-1.6 3.1-1.3 2.9.4l-.6 7 1.4-3.9c.6-1.5 3.1-.9 2.7.8l-1.5 6.9c-.9 4.1-3.6 7.2-8 7.2-3.2 0-5.2-1.7-6.9-4.3z';
ICONS.cheer = svg(`<path d="M16 1.8v3M9.6 3.4l1.3 2.4M22.4 3.4l-1.3 2.4" stroke="#db6a41" stroke-width="2.2" stroke-linecap="round"/>
  <g transform="translate(-1.2 7.4) scale(.66) rotate(-12 16 16)"><path d="${HAND}" fill="#f8d2ae" stroke="#211d1d" stroke-width="2.6" stroke-linejoin="round"/></g>
  <g transform="translate(33.2 7.4) scale(-.66 .66) rotate(-12 16 16)"><path d="${HAND}" fill="#f8d2ae" stroke="#211d1d" stroke-width="2.6" stroke-linejoin="round"/></g>`);
ICONS.five = ICONS.hi;
