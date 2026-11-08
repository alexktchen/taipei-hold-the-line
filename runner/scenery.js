// 場景：台北夜市大街、東京下町商店街、京都祇園坂道。所有房子、招牌、樹、路燈、障礙物都是程式造型，
// 透過 Builder 合併成少數幾個 mesh；會動的東西（機車、垃圾車、電車、人力車、路人）是獨立的 Group。
import * as THREE from 'three';
import { Builder, SignAtlas, rng as mkRng, lerp, clamp, TAU } from './util.js';

const C = {
  asphalt: 0x3a3a40, steel: 0xb8bcc4, rust: 0x8a4a2a, wood: 0x6a4a2e, woodDark: 0x3e2a1c, plaster: 0xe8e0d0, red: 0xc8402a, vermilion: 0xd94f2b,
  leaf: [0x4f9a4a, 0x5fae55, 0x3f8a40], sakura: [0xf7c1d4, 0xf2a8c0, 0xfbd3e0], maple: [0xd9462b, 0xe8742a, 0xc93a1f, 0xf0a030], pine: 0x3a7a4a,
  warm: 0xffd98a, warm2: 0xffb060, neon: [0xff4d6d, 0x4dd9ff, 0xffe14d, 0x7dff7a, 0xff8ad8],
};
const night = (course) => course.time === 'night';

/* ───────── 共用小物（局部座標：原點在地面，+z 朝馬路） ───────── */
function streetLamp(b, lit, style = 'tw') {
  const col = style === 'jp' ? 0x5a5a60 : 0x3a4a5a;
  b.cyl(0.08, 0.11, 5.2, 0, 2.6, 0, col, { seg: 6 });
  b.box(0.12, 0.12, 1.5, 0, 5.1, 0.7, col);
  b.box(0.5, 0.18, 0.3, 0, 5.05, 1.35, col);
  if (lit) b.box(0.42, 0.06, 0.24, 0, 4.95, 1.35, 0xfff1c0, { lit: true });
}
function treeRound(b, R, h = 4, color) {
  const c = color || R.pick(C.leaf);
  b.cyl(0.14, 0.2, h * 0.45, 0, h * 0.22, 0, 0x6a4a2e, { seg: 6 });
  b.sphere(h * 0.32, 0, h * 0.62, 0, c, { seg: 7, seg2: 5 });
  b.sphere(h * 0.24, h * 0.18, h * 0.78, 0.1, c, { seg: 6, seg2: 5 });
  b.sphere(h * 0.22, -h * 0.16, h * 0.72, -0.1, c, { seg: 6, seg2: 5 });
}
function treeBlossom(b, R, h, pal) {
  b.cyl(0.12, 0.18, h * 0.5, 0, h * 0.25, 0, 0x4a3626, { seg: 6 });
  for (let i = 0; i < 5; i++) b.sphere(h * (0.18 + R() * 0.1), (R() - 0.5) * h * 0.5, h * (0.55 + R() * 0.3), (R() - 0.5) * h * 0.4, R.pick(pal), { seg: 6, seg2: 5 });
}
function palm(b, R, h = 6) {
  b.cyl(0.14, 0.22, h, 0, h / 2, 0, 0x8a6a4a, { seg: 6 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; b.box(0.5, 0.08, 2.6, Math.sin(a) * 1.1, h + 0.1, Math.cos(a) * 1.1, 0x4f9a4a, { ry: a, rx: -0.5 }); }
}
function bush(b, R, r = 0.5) { b.sphere(r, 0, r * 0.8, 0, R.pick(C.leaf), { seg: 6, seg2: 5 }); }
function cone(b) { b.cone(0.3, 0.75, 0, 0.38, 0, 0xf07020, { seg: 8 }); b.box(0.5, 0.05, 0.5, 0, 0.03, 0, 0x2a2a2a); b.cyl(0.2, 0.24, 0.1, 0, 0.45, 0, 0xffffff, { seg: 8 }); }
function trashCan(b, color = 0x3f7a5a) { b.cyl(0.36, 0.32, 0.95, 0, 0.48, 0, color, { seg: 10 }); b.cyl(0.4, 0.4, 0.08, 0, 0.98, 0, 0x2a2a2a, { seg: 10 }); }
function planter(b, R) { b.box(1.3, 0.5, 0.6, 0, 0.25, 0, 0x8a8a8a); b.push(0, 0.5, 0); bush(b, R, 0.45); b.pop(); }
function scooter(b, color) {
  b.box(0.5, 0.5, 1.5, 0, 0.6, 0, color);            // 車身
  b.box(0.3, 0.12, 0.6, 0, 0.9, -0.3, 0x2a2a2a);     // 座墊
  b.box(0.4, 0.5, 0.2, 0, 0.75, 0.6, color);         // 前擋
  b.box(0.46, 0.05, 0.05, 0, 1.05, 0.55, 0x2a2a2a);  // 把手
  b.sphere(0.07, 0, 0.8, 0.72, 0xfff0a0, { seg: 6, seg2: 4 }); // 大燈
  for (const z of [0.6, -0.55]) { b.cyl(0.24, 0.24, 0.12, 0, 0.26, z, 0x222222, { seg: 10, rz: Math.PI / 2 }); }
  b.sphere(0.2, 0, 0.9, -0.55, 0x2a2a2a, { seg: 6, seg2: 4 });   // 安全帽
}
function bicycle(b, color = 0x3a3a3a) {
  for (const z of [0.5, -0.5]) b.cyl(0.32, 0.32, 0.04, 0, 0.34, z, 0x222222, { seg: 12, rz: Math.PI / 2 });
  b.box(0.06, 0.06, 1.0, 0, 0.6, 0, color); b.box(0.06, 0.5, 0.06, 0, 0.8, -0.1, color); b.box(0.06, 0.5, 0.06, 0, 0.8, 0.4, color);
  b.box(0.3, 0.06, 0.16, 0, 1.0, -0.1, 0x3a2a1a); b.box(0.5, 0.05, 0.05, 0, 1.0, 0.45, 0x2a2a2a);
  b.box(0.35, 0.25, 0.3, 0, 0.9, 0.7, 0x5a4a3a); // 前籃
}
function vending(b, R, lit) {
  const col = R.pick([0xd9463b, 0x2f6fd0, 0xf2f2f2, 0x3fa66a]);
  b.box(1.0, 1.85, 0.75, 0, 0.93, 0, col);
  b.box(0.8, 0.9, 0.04, 0, 1.3, 0.38, 0x1a1a24);
  if (lit) { for (let i = 0; i < 6; i++) b.box(0.18, 0.3, 0.03, -0.3 + (i % 3) * 0.3, 1.5 - Math.floor(i / 3) * 0.4, 0.41, R.pick([0xff5a4a, 0x4ad0ff, 0xffe066, 0xffffff]), { lit: true }); }
  b.box(0.7, 0.28, 0.03, 0, 0.5, 0.39, 0x3a3a3a);
}
function bench(b) { b.box(1.6, 0.08, 0.45, 0, 0.45, 0, 0x8a6a4a); b.box(1.6, 0.4, 0.08, 0, 0.7, -0.2, 0x8a6a4a); for (const x of [-0.65, 0.65]) b.box(0.08, 0.45, 0.4, x, 0.22, 0, 0x3a3a3a); }
function mailboxTW(b) { b.box(0.5, 1.0, 0.45, -0.3, 0.6, 0, 0xd9463b); b.box(0.5, 1.0, 0.45, 0.3, 0.6, 0, 0x2f8a55); b.box(1.1, 0.12, 0.55, 0, 1.15, 0, 0x2a2a2a); }
function postJP(b) { b.cyl(0.26, 0.26, 1.1, 0, 0.6, 0, 0xd9463b, { seg: 10 }); b.cyl(0.3, 0.3, 0.12, 0, 1.2, 0, 0xd9463b, { seg: 10 }); b.box(0.3, 0.04, 0.1, 0, 0.95, 0.26, 0x2a2a2a); }
function trafficLight(b, lit, tw) {
  b.cyl(0.08, 0.1, 4.6, 0, 2.3, 0, 0x3a3a3a, { seg: 6 });
  b.box(0.12, 0.12, 2.8, 0, 4.5, 1.4, 0x3a3a3a);
  b.box(0.4, 1.1, 0.35, 0, 4.2, 2.6, 0x1f1f1f);
  const on = Math.random() < 0.5;
  b.sphere(0.12, 0, 4.55, 2.8, on ? 0xff3030 : 0x401010, { lit: lit && on, seg: 6, seg2: 5 });
  b.sphere(0.12, 0, 4.2, 2.8, 0x403a10, { seg: 6, seg2: 5 });
  b.sphere(0.12, 0, 3.85, 2.8, on ? 0x104010 : 0x30e060, { lit: lit && !on, seg: 6, seg2: 5 });
  if (tw) { b.box(0.4, 0.4, 0.1, 0, 2.6, 0.25, 0x1f1f1f); b.box(0.12, 0.26, 0.04, 0, 2.6, 0.32, 0x40ff70, { lit }); } // 小綠人
}
function utilityPole(b, lit) {
  b.cyl(0.12, 0.16, 8.5, 0, 4.25, 0, 0x8a8a84, { seg: 7 });
  b.box(1.8, 0.1, 0.1, 0, 8.0, 0, 0x6a6a64); b.box(1.4, 0.1, 0.1, 0, 7.4, 0, 0x6a6a64);
  b.cyl(0.3, 0.3, 0.6, 0.5, 6.6, 0.15, 0x7a7a74, { seg: 7 }); // 變壓器
  if (lit) b.box(0.3, 0.06, 0.2, 0, 6.0, 0.6, 0xfff1c0, { lit: true });
  b.box(0.08, 0.08, 1.0, 0, 6.05, 0.3, 0x5a5a5a);
}
function torii(b, w = 5, h = 5.5, col = C.vermilion) {
  for (const s of [-1, 1]) b.cyl(0.18, 0.22, h, s * w / 2, h / 2, 0, col, { seg: 8 });
  b.box(w + 1.2, 0.3, 0.3, 0, h - 0.15, 0, 0x1a1a1a);                 // 笠木
  b.box(w + 0.6, 0.22, 0.26, 0, h - 0.46, 0, col);                     // 島木
  b.box(w - 0.4, 0.2, 0.2, 0, h - 1.3, 0, col);                        // 貫
  b.box(0.3, 0.5, 0.26, 0, h - 0.95, 0, 0x1a1a1a);                     // 額束
}
function stoneLantern(b) {
  b.box(0.6, 0.3, 0.6, 0, 0.15, 0, 0x8a8a84); b.cyl(0.14, 0.16, 0.9, 0, 0.75, 0, 0x8a8a84, { seg: 8 });
  b.box(0.5, 0.1, 0.5, 0, 1.25, 0, 0x8a8a84); b.box(0.36, 0.4, 0.36, 0, 1.5, 0, 0x9a9a94); b.box(0.12, 0.2, 0.02, 0, 1.5, 0.19, 0xffe0a0, { lit: true });
  b.box(0.7, 0.14, 0.7, 0, 1.78, 0, 0x7a7a74); b.sphere(0.1, 0, 1.92, 0, 0x7a7a74, { seg: 6, seg2: 4 });
}
function lanternRow(b, n, y, z, spacing, color = 0xe03a2a) { for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * spacing; b.cyl(0.22, 0.22, 0.4, x, y, z, color, { lit: true, seg: 8 }); b.cyl(0.1, 0.1, 0.06, x, y + 0.24, z, 0x1a1a1a, { seg: 6 }); b.cyl(0.1, 0.1, 0.06, x, y - 0.24, z, 0x1a1a1a, { seg: 6 }); } }
function person(b, R) {
  const col = R.pick([0xe8b0c8, 0x6a8ab0, 0x3a3a3a, 0xf4e8c8, 0xb8362a, 0x2f8a55, 0xf2b134, 0xffffff, 0x1f2f6f]), skin = R.pick([0xf2c9a8, 0xe8b88a, 0xd9a070]);
  b.box(0.5, 0.62, 0.32, 0, 0.92, 0, col); b.box(0.2, 0.5, 0.2, -0.14, 0.3, 0, R.pick([0x2a2a30, 0x3b4a7a, 0x5a4a3a])); b.box(0.2, 0.5, 0.2, 0.14, 0.3, 0, R.pick([0x2a2a30, 0x3b4a7a]));
  b.box(0.16, 0.5, 0.16, -0.33, 0.95, 0, col); b.box(0.16, 0.5, 0.16, 0.33, 0.95, 0, col);
  b.sphere(0.3, 0, 1.56, 0, skin, { seg: 8, seg2: 6 }); b.box(0.64, 0.22, 0.6, 0, 1.76, -0.04, R.pick([0x2a1a10, 0x4a2f27, 0x8a6a4a, 0xe8e8e8]));
  const pick = R();
  if (pick < 0.25) { b.cyl(0.02, 0.02, 1.4, 0.3, 1.5, 0, 0x3e2a1c, { seg: 4 }); b.cone(0.85, 0.3, 0.3, 2.2, 0, R.pick([0xd9463b, 0xf2b134, 0xf4f4f4, 0x3a6fb0]), { seg: 10 }); }
  else if (pick < 0.5) b.box(0.3, 0.36, 0.16, -0.42, 0.6, 0.1, R.pick([0x8a5a3a, 0x2a2a2a, 0xd9463b]));
  else if (pick < 0.7) b.box(0.12, 0.2, 0.02, 0.2, 1.25, 0.3, 0x1a1a24);
  else if (pick < 0.85) b.box(0.12, 0.3, 0.12, 0.42, 1.0, 0.1, R.pick([0xc8905a, 0xf4f4f4]));
}
function flag(b, R, text, bg, fg) { b.cyl(0.04, 0.05, 3.2, 0, 1.6, 0, 0x5a4a3a, { seg: 5 }); b.box(0.6, 0.04, 0.04, 0.3, 3.1, 0, 0x5a4a3a); b.sign(text, 0.55, 2.0, 0.32, 2.05, 0.02, bg, fg, { vertical: true, double: true }); }
function awning(b, w, y, color, color2) { for (let i = 0; i < 6; i++) b.box(w / 6, 0.08, 1.3, -w / 2 + (i + 0.5) * w / 6, y, 0.65, i % 2 ? color : color2, { rx: 0.25 }); }
function noren(b, w, y, color) { for (let i = 0; i < 3; i++) b.box(w / 3 - 0.06, 0.9, 0.03, -w / 2 + (i + 0.5) * w / 3, y, 0.08, color); b.box(w + 0.1, 0.06, 0.06, 0, y + 0.47, 0.08, 0x3e2a1c); }
function acUnit(b, x, y, z) { b.box(0.7, 0.55, 0.3, x, y, z, 0xcfcfcf); b.cyl(0.2, 0.2, 0.04, x, y, z + 0.17, 0x4a4a4a, { seg: 10, rx: Math.PI / 2 }); }
function waterTank(b, x, z) { for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) b.box(0.08, 1.0, 0.08, x + dx, 0.5, z + dz, 0x3a3a3a); b.cyl(0.6, 0.6, 1.3, x, 1.65, z, C.steel, { seg: 10 }); b.cone(0.62, 0.3, x, 2.45, z, C.steel, { seg: 10 }); }

/* ───────── 台北：騎樓透天、鐵窗、招牌、頂樓加蓋與水塔 ───────── */
const TW_SIGNS = ['鹽酥雞', '珍珠奶茶', '牛肉麵', '藥局', '便利商店', '滷肉飯', '手搖飲', '水果行', '五金行', '洗衣店', '早餐店', '機車行', '彩券行', '麵包店', '小籠包', '豆漿店', '自助餐', '修鞋'];
const TW_VSIGNS = ['卡拉OK', '牙醫診所', '補習班', '旅社', '茶行', '按摩', '當舖', '眼鏡行', '中醫', 'KTV', '網咖', '髮廊'];
const TW_STALLS = ['蚵仔煎', '臭豆腐', '大腸包小腸', '藥燉排骨', '雞排', '地瓜球', '木瓜牛奶', '棺材板', '套圈圈', '彈珠台', '滷味', '燒仙草'];
const TW_TILES = [0xd8c8b0, 0xbfb8a8, 0xa8b8a0, 0xc8b8b0, 0xe0d8c8, 0x9aa8b0, 0xd0b8a0];
function bldTaipei(b, R, w, isNight) {
  const floors = R.int(3, 6), fh = 3.1, d = 10, tile = R.pick(TW_TILES);
  const H = floors * fh;
  b.box(w, 4, d, 0, -2, -d / 2, tile);                               // 地基（坡地也不會懸空）
  b.box(w, H - fh, d, 0, fh + (H - fh) / 2, -d / 2, tile);           // 二樓以上
  b.box(w, fh, d - 2.6, 0, fh / 2, -d / 2 - 1.3, 0xe8e0d4);          // 一樓店面（退縮成騎樓）
  const nCol = Math.max(2, Math.round(w / 4));
  for (let i = 0; i <= nCol; i++) b.box(0.5, fh, 0.5, -w / 2 + 0.25 + i * (w - 0.5) / nCol, fh / 2, -0.25, 0xd8d0c4); // 騎樓柱
  b.box(w, 0.5, d, 0, fh - 0.25, -d / 2, tile);
  // 店門與燈
  b.box(w * 0.6, 2.2, 0.1, 0, 1.15, -2.55, isNight ? 0xffe8b0 : 0x6a7a8a, { lit: isNight });
  if (isNight) b.box(w * 0.5, 0.08, 0.3, 0, fh - 0.55, -1.3, 0xfff6d0, { lit: true });
  // 窗戶＋鐵窗
  for (let f = 1; f < floors; f++) {
    const nW = Math.max(1, Math.round(w / 3.2));
    for (let k = 0; k < nW; k++) {
      const x = -w / 2 + (k + 0.5) * w / nW, y = f * fh + fh * 0.55;
      const on = isNight && R.chance(0.55);
      b.box(1.5, 1.4, 0.06, x, y, 0.03, on ? R.pick([0xffe4a8, 0xfff1c8, 0xbfe6ff]) : 0x3a4858, { lit: on });
      b.box(1.7, 1.6, 0.3, x, y, 0.1, 0x6a6a6a);                                              // 鐵窗框
      for (let j = 0; j < 4; j++) b.box(0.04, 1.5, 0.04, x - 0.6 + j * 0.4, y, 0.26, 0x7a7a7a); // 鐵條
      if (R.chance(0.55)) acUnit(b, x + 0.9, y - 0.4, 0.3);
    }
  }
  // 頂樓：女兒牆、加蓋、水塔
  b.box(w, 0.6, 0.2, 0, H + 0.3, -0.1, tile);
  if (R.chance(0.7)) { const sw = w * 0.55, sh = 2.4; b.box(sw, sh, d * 0.5, -w / 2 + sw / 2 + 0.5, H + sh / 2, -d / 2 - 1, R.pick([0x6a8ab0, 0x9a6a4a, 0x8a8a8a])); b.box(sw + 0.4, 0.15, d * 0.5 + 0.4, -w / 2 + sw / 2 + 0.5, H + sh + 0.05, -d / 2 - 1, R.pick([0x4a6a90, C.rust])); }
  waterTank(b, w / 2 - 1.5, -d + 2);
  // 招牌：騎樓上緣的橫招牌、側面凸出的直招牌
  const neon = isNight ? R.pick(['#e8322a', '#1f6fd0', '#f2b134', '#2fa35a', '#d4286e']) : R.pick(['#c8402a', '#2f5fb0', '#d49a1f']);
  b.box(w * 0.7 + 0.1, 1.15, 0.12, 0, fh + 0.75, 0.08, 0x2a2a2a);
  b.sign(R.pick(TW_SIGNS), w * 0.7, 1.05, 0, fh + 0.75, 0.15, neon, '#fff6e0');
  if (R.chance(0.95)) {
    const x = R.chance(0.5) ? w / 2 - 0.7 : -w / 2 + 0.7, y0 = fh + 2.2, vh = Math.min(H - y0 - 0.5, 5.5);
    b.box(0.14, vh, 0.9, x, y0 + vh / 2, 0.8, 0x2a2a2a);
    b.box(0.6, 0.1, 0.1, x, y0 + vh - 0.3, 0.4, 0x3a3a3a);
    b.sign(R.pick(TW_VSIGNS), 0.9, vh, x, y0 + vh / 2, 0.8, R.pick(['#e8322a', '#f2b134', '#1f6fd0', '#ffffff']), R.chance(0.3) ? '#1a1a1a' : '#ffffff', { vertical: true, ry: Math.PI / 2, double: true });
  }
}
function stall(b, R, isNight) {
  b.box(2.2, 0.9, 1.1, 0, 0.75, 0, R.pick([0xc8c8c8, 0xd0a060, 0x8a9ab0])); for (const x of [-0.9, 0.9]) b.cyl(0.18, 0.18, 0.1, x, 0.2, 0, 0x222222, { seg: 8, rx: Math.PI / 2 });
  for (const x of [-1, 1]) b.box(0.08, 2.4, 0.08, x, 1.3, 0.5, 0x3a3a3a);
  for (let i = 0; i < 4; i++) b.box(0.6, 0.06, 1.6, -0.9 + i * 0.6, 2.55, 0, i % 2 ? 0xd9463b : 0xf4f4f4, { rx: -0.15 });
  b.box(0.3, 0.3, 0.3, -0.5, 1.35, 0.1, 0xf4e0b0); b.box(0.5, 0.2, 0.4, 0.5, 1.3, 0.1, 0x8a5a3a);
  b.box(1.6, 0.5, 0.06, 0, 2.05, 0.75, 0x2a2a2a); b.sign(R.pick(TW_STALLS), 1.5, 0.42, 0, 2.05, 0.8, isNight ? '#f2b134' : '#d9463b', '#2a1a10');
  if (isNight) b.sphere(0.12, 0, 2.3, 0.3, 0xfff1c0, { lit: true, seg: 6, seg2: 4 });
}
function temple(b, R, isNight) { // 小廟：石階、紅柱、燕尾脊、香爐
  b.box(16, 1.2, 12, 0, 0.6, -6, 0x9a9490);
  b.box(14, 0.4, 2, 0, 1.0, 0.5, 0x8a8480);
  b.box(13, 5, 9, 0, 3.7, -7.5, 0xb8362a);
  for (let i = 0; i < 6; i++) b.cyl(0.32, 0.34, 5, -6 + i * 2.4, 3.7, -2, 0xb8362a, { seg: 10 });
  b.box(15, 0.5, 11.5, 0, 6.45, -6, 0x3a6a4a);                               // 屋簷
  b.box(14, 1.6, 10, 0, 7.4, -6, 0xd9742a, { });                                // 屋頂
  b.box(15.5, 0.5, 1.6, 0, 8.4, -6, 0x3a6a4a);                                  // 正脊
  for (const s of [-1, 1]) { b.box(2.4, 0.5, 1.0, s * 7.4, 8.9, -6, 0x3a6a4a, { rz: s * 0.6 }); b.box(0.5, 1.8, 0.5, s * 8.3, 9.6, -6, 0xe8b040, { rz: s * 0.35 }); } // 燕尾
  b.box(1.0, 1.6, 0.6, 0, 9.3, -6, 0xe8b040);                                   // 中央寶珠
  b.box(3, 3.2, 0.2, 0, 2.8, -3.1, 0x3a2a1a);                                    // 門
  b.sign('保安宮', 3.4, 1.0, 0, 5.3, -2.8, '#2a1a10', '#f2c94c');
  b.cyl(0.9, 0.7, 1.2, 0, 1.8, 2.2, 0x5a4a3a, { seg: 10 }); for (let i = 0; i < 8; i++) b.box(0.03, 0.9, 0.03, Math.sin(i) * 0.5, 2.8, 2.2 + Math.cos(i * 2) * 0.5, 0xd9463b); // 香爐與香
  for (const s of [-1, 1]) { b.box(0.5, 0.5, 0.5, s * 6.5, 1.45, 1.6, 0x6a6a64); b.sphere(0.55, s * 6.5, 2.2, 1.6, 0x8a8a84, { seg: 6, seg2: 5 }); } // 石獅（簡化）
  if (isNight) { lanternRow(b, 7, 6.0, 0.6, 2.0, 0xe8402a); }
}
function taipei101(b) {
  b.box(28, 20, 28, 0, 10, 0, 0x4a6a78);
  for (let i = 0; i < 8; i++) { const y = 20 + i * 22; b.box(24, 22, 24, 0, y + 11, 0, 0x3f8f9a, { sx: 1 + 0.12 * ((i % 1) + 1), sy: 1, sz: 1 }); b.box(27, 1.6, 27, 0, y + 21, 0, 0x2a5a66); for (let k = 0; k < 10; k++) b.box(0.6, 20, 0.2, -11 + k * 2.4, y + 11, 13.6, 0x9adfff, { lit: true }); }
  b.box(12, 20, 12, 0, 196 + 10, 0, 0x3f8f9a); b.cyl(0.8, 1.6, 40, 0, 236, 0, 0xbfe8f0, { seg: 8 }); b.sphere(2, 0, 256, 0, 0xffe4a8, { lit: true, seg: 8, seg2: 6 });
}
function garbageTruckMesh(atlas) {
  const b = new Builder(atlas);
  b.box(2.3, 2.0, 4.6, 0, 1.6, -1.2, 0xf2c230); b.box(2.3, 1.6, 1.8, 0, 1.4, 2.0, 0xf2c230);
  b.box(2.1, 0.8, 0.1, 0, 1.9, 2.92, 0x6ab0d8); b.box(2.5, 0.3, 4.4, 0, 2.75, -1.2, 0xe0b020);
  for (const z of [1.6, -1.8]) for (const s of [-1, 1]) b.cyl(0.5, 0.5, 0.4, s * 1.1, 0.5, z, 0x222222, { seg: 12, rz: Math.PI / 2 });
  b.sphere(0.25, 0, 2.95, -1.2, 0xffa020, { lit: true, seg: 8, seg2: 6 }); // 警示燈
  b.sign('資源回收', 2.0, 0.8, 0, 1.6, -3.52, '#2f8a55', '#ffffff', { ry: Math.PI });
  return b.build({ shadow: true });
}
function scooterRiderMesh(atlas, color) {
  const b = new Builder(atlas); scooter(b, color);
  b.box(0.5, 0.7, 0.36, 0, 1.3, -0.25, 0x3a6fb0); b.sphere(0.3, 0, 1.9, -0.25, 0xf2c9a8, { seg: 8, seg2: 6 }); b.sphere(0.33, 0, 1.98, -0.3, 0xe8402a, { seg: 8, seg2: 6 });
  return b.build();
}

/* ───────── 東京：細長樓房、雨棚、暖簾、提燈、電線桿、自動販賣機 ───────── */
const JP_SIGNS = ['居酒屋', 'ラーメン', '薬局', 'コンビニ', 'たばこ', '寿司', '焼き鳥', '甘味処', '銭湯', '喫茶', 'うどん', '書店', '床屋', '八百屋', '和菓子', 'そば'];
const JP_VSIGNS = ['カラオケ', '居酒屋', '質屋', '旅館', '中華料理', '麻雀', '焼肉', 'スナック'];
const JP_WALLS = [0xf2efe8, 0xd8d4cc, 0xbfb8b0, 0x8a8078, 0xe8dcc8, 0x4a4a50, 0xc8b8a0];
function bldTokyo(b, R, w, isDusk) {
  const floors = R.int(2, 4), fh = 3.0, d = 9, wall = R.pick(JP_WALLS), H = floors * fh;
  b.box(w, 4, d, 0, -2, -d / 2, wall);
  b.box(w, H, d, 0, H / 2, -d / 2, wall);
  // 一樓店面
  b.box(w * 0.75, 2.3, 0.1, 0, 1.25, 0.03, isDusk ? 0xffe0a8 : 0x8ab0c8, { lit: isDusk });
  const shop = R.pick(['izakaya', 'ramen', 'konbini', 'shop']);
  if (shop === 'konbini') { b.box(w, 0.9, 0.2, 0, fh - 0.2, 0.1, 0xffffff, { lit: true }); b.box(w, 0.3, 0.22, 0, fh + 0.3, 0.1, R.pick([0x2f8a55, 0xe8632a, 0x2f6fd0])); b.sign('コンビニ', w * 0.5, 0.8, 0, fh - 0.2, 0.22, '#ffffff', '#1f6fd0'); }
  else {
    awning(b, w * 0.8, fh - 0.3, R.pick([0xd9463b, 0x2f5fb0, 0x2f8a55, 0x3a3a3a]), 0xf4f4f4);
    noren(b, w * 0.35, 1.9, R.pick([0x1f2f6f, 0xb8362a, 0x2a2a2a, 0x3a6a4a]));
    b.box(w * 0.6 + 0.1, 0.9, 0.12, 0, fh + 0.6, 0.06, 0x3a2a1c);
    b.sign(R.pick(JP_SIGNS), w * 0.6, 0.8, 0, fh + 0.6, 0.13, R.pick(['#b8362a', '#1f2f6f', '#f4e8c8', '#2a2a2a']), R.chance(0.5) ? '#f4e8c8' : '#ffffff');
    if (shop === 'izakaya') lanternRow(b, Math.max(2, Math.round(w / 1.6)), fh - 0.95, 0.9, 1.4, R.pick([0xe03a2a, 0xf4f4f4]));
  }
  // 樓上：窗戶、陽台
  for (let f = 1; f < floors; f++) {
    const y = f * fh;
    b.box(w * 0.9, 0.9, 0.6, 0, y + 0.45, 0.3, wall); for (let k = 0; k < Math.round(w * 2); k++) b.box(0.05, 0.85, 0.05, -w * 0.45 + k * 0.5, y + 0.5, 0.58, 0x5a5a5a); // 陽台欄杆
    const nW = Math.max(1, Math.round(w / 3));
    for (let k = 0; k < nW; k++) { const x = -w / 2 + (k + 0.5) * w / nW, on = isDusk && R.chance(0.5); b.box(1.6, 1.3, 0.06, x, y + 1.9, 0.03, on ? 0xffe4a8 : 0x4a5868, { lit: on }); if (R.chance(0.35)) acUnit(b, x + 0.9, y + 1.0, 0.35); }
  }
  b.box(w, 0.4, 0.2, 0, H + 0.2, -0.1, wall);
  if (R.chance(0.5)) waterTank(b, -w / 2 + 1.4, -d + 2);
  b.box(0.08, 3, 0.08, w / 2 - 1, H + 1.5, -d + 1.5, 0x5a5a5a); b.box(1.2, 0.06, 0.06, w / 2 - 1, H + 2.8, -d + 1.5, 0x5a5a5a); // 天線
  if (R.chance(0.8)) { const x = R.chance(0.5) ? w / 2 - 0.5 : -w / 2 + 0.5, y0 = fh + 1.6, vh = Math.min(H - y0 - 0.4, 4.5); if (vh > 1.5) { b.box(0.12, vh, 0.8, x, y0 + vh / 2, 0.6, 0x2a2a2a); b.sign(R.pick(JP_VSIGNS), 0.8, vh, x, y0 + vh / 2, 0.6, R.pick(['#b8362a', '#f4f4f4', '#1f2f6f']), R.chance(0.4) ? '#1a1a1a' : '#ffffff', { vertical: true, ry: Math.PI / 2, double: true }); } }
}
function shrine(b) {
  b.box(14, 0.6, 12, 0, 0.3, -7, 0x9a9490);
  b.push(0, 0, 1.5); torii(b, 6, 6); b.pop();
  b.box(8, 3.5, 6, 0, 2.35, -9, 0xb8362a); for (let i = 0; i < 4; i++) b.cyl(0.25, 0.25, 3.5, -3.5 + i * 2.33, 2.35, -6, 0xb8362a, { seg: 8 });
  b.box(10, 0.5, 8.5, 0, 4.3, -8.5, 0x3a3a3a); b.box(9, 1.6, 7.5, 0, 5.2, -8.5, 0x3a3a3a, { }); b.box(10.5, 0.4, 1.2, 0, 6.2, -8.5, 0x2a2a2a);
  for (const s of [-1, 1]) { b.box(1.2, 1.0, 1.2, s * 3.5, 1.1, -4, 0x8a8a84); b.sphere(0.6, s * 3.5, 2.0, -4, 0x9a9a94, { seg: 6, seg2: 5 }); } // 狛犬
  for (const s of [-1, 1]) { b.push(s * 5, 0, -2); stoneLantern(b); b.pop(); }
  b.box(1.6, 0.6, 0.1, 0, 3.3, -6.0, 0xf4e8c8); b.sign('神社', 1.5, 0.5, 0, 3.3, -5.94, '#f4e8c8', '#1a1a1a');
}
function tokyoTower(b) {
  const segs = [[16, 26, 60, 0xe8502a], [8, 16, 50, 0xf4f4f4], [5, 8, 40, 0xe8502a], [3, 5, 30, 0xf4f4f4]]; let y = 0;
  for (const [rt, rb, h, col] of segs) { b.cyl(rt, rb, h, 0, y + h / 2, 0, col, { seg: 4, open: true }); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; b.cyl(0.5, 0.7, h / Math.cos(0.08), Math.sin(a) * (rt + rb) / 2 * 1.0, y + h / 2, Math.cos(a) * (rt + rb) / 2 * 1.0, col, { seg: 5, rx: Math.cos(a) * -0.1, rz: Math.sin(a) * 0.1 }); } y += h; }
  b.box(22, 6, 22, 0, 62, 0, 0xf4f4f4); b.box(10, 5, 10, 0, 150, 0, 0xf4f4f4); b.cyl(0.5, 1.2, 50, 0, 205, 0, 0xe8502a, { seg: 6 });
  b.sphere(1.5, 0, 231, 0, 0xffb060, { lit: true, seg: 8, seg2: 6 });
}
function fuji(b, x, z, scale = 1) { b.cone(170 * scale, 70 * scale, x, 35 * scale, z, 0x5a6a8a, { seg: 18 }); b.cone(60 * scale, 26 * scale, x, 57 * scale, z, 0xf4f8ff, { seg: 18 }); }
function trainMesh(atlas) {
  const b = new Builder(atlas);
  for (let c = 0; c < 4; c++) {
    const x = (c - 1.5) * 12.5;
    b.box(12, 3.2, 2.8, x, 2.3, 0, 0xe8e8e8); b.box(12, 0.9, 2.82, x, 1.3, 0, 0x3fa66a); b.box(12, 0.25, 2.4, x, 3.95, 0, 0xbfbfbf);
    for (let k = 0; k < 6; k++) for (const s of [-1, 1]) b.box(1.4, 1.1, 0.05, x - 4.6 + k * 1.85, 2.7, s * 1.42, 0xfff0c0, { lit: true });
    for (const dx of [-4, 4]) for (const s of [-1, 1]) b.cyl(0.45, 0.45, 0.3, x + dx, 0.45, s * 1.1, 0x222222, { seg: 10, rz: Math.PI / 2 });
    b.box(12.2, 0.4, 2.9, x, 0.9, 0, 0x2a2a2a);
  }
  for (const s of [-1, 1]) b.sphere(0.25, s * 25.2, 2.3, 0, 0xfff0a0, { lit: true, seg: 6, seg2: 5 });
  return b.build();
}
function crossingGate(b, lit) { // 平交道：黃黑柵欄柱＋紅燈
  b.cyl(0.15, 0.15, 3.6, 0, 1.8, 0, 0x8a8a84, { seg: 6 }); b.box(0.9, 0.9, 0.2, 0, 3.0, 0, 0xf2c230); b.box(0.9, 0.12, 0.22, 0, 3.0, 0, 0x1a1a1a, { rz: 0.785 }); b.box(0.9, 0.12, 0.22, 0, 3.0, 0, 0x1a1a1a, { rz: -0.785 });
  for (const s of [-1, 1]) b.sphere(0.16, s * 0.35, 2.2, 0.12, 0xff3a2a, { lit, seg: 6, seg2: 5 });
  b.box(0.08, 0.4, 0.08, 0, 3.8, 0, 0x8a8a84); b.cyl(0.22, 0.22, 0.1, 0, 4.0, 0, 0x2a2a2a, { seg: 8, rx: Math.PI / 2 });
}

/* ───────── 京都：町家、格子窗、瓦屋頂、暖簾、石燈籠、鳥居、五重塔、竹林 ───────── */
const KY_SIGNS = ['抹茶', '漬物', '京菓子', '八ツ橋', '湯豆腐', '和傘', '扇子', '茶寮', '甘味', '着物', '骨董', '京料理'];
function machiya(b, R, w) {
  const d = 10, h1 = 2.9, h2 = 2.4;
  b.box(w, 4, d, 0, -2, -d / 2, C.woodDark);
  b.box(w, h1, d, 0, h1 / 2, -d / 2, R.pick([0x4a3626, 0x5a4232, 0x3e2e22]));
  b.box(w, h2, d, 0, h1 + h2 / 2, -d / 2, R.pick([0xe8e0d0, 0xd8cfbf, 0xc8b89a]));
  // 一樓格子（木條）
  const n = Math.round(w / 0.22);
  for (let i = 0; i < n; i++) if (Math.abs(i - n / 2) > n * 0.12) b.box(0.08, h1 - 0.5, 0.08, -w / 2 + (i + 0.5) * w / n, h1 / 2 - 0.1, 0.06, 0x8a6a4a);
  b.box(w * 0.22, 2.2, 0.1, 0, 1.1, 0.02, 0x2a1a10); // 門口
  noren(b, w * 0.2, 1.9, R.pick([0x1f2f6f, 0xb8362a, 0x6a2a3a, 0x3a6a4a]));
  // 二樓蟲籠窗
  for (let k = 0; k < Math.max(1, Math.round(w / 3)); k++) { const x = -w / 2 + (k + 0.5) * w / Math.max(1, Math.round(w / 3)); b.box(1.4, 1.0, 0.1, x, h1 + 1.2, 0.03, 0x2a1a10); for (let j = 0; j < 6; j++) b.box(0.06, 1.0, 0.08, x - 0.6 + j * 0.24, h1 + 1.2, 0.08, 0xe8e0d0); }
  // 屋頂：一樓庇、二樓大屋頂
  b.box(w + 0.4, 0.2, 1.4, 0, h1 + 0.15, 0.5, 0x3a3a40, { rx: 0.18 });
  b.box(w + 0.8, 0.35, d + 1.4, 0, h1 + h2 + 0.3, -d / 2 + 0.3, 0x3a3a40, { rx: 0.1 });
  b.box(w + 0.8, 0.5, 0.6, 0, h1 + h2 + 0.75, -d / 2, 0x2a2a30);
  for (let i = 0; i < Math.round(w / 0.5); i++) b.cyl(0.08, 0.08, 1.4, -w / 2 + (i + 0.5) * 0.5, h1 + h2 + 0.35, 0.5, 0x4a4a50, { seg: 5, rx: Math.PI / 2 + 0.1 }); // 瓦
  if (R.chance(0.7)) { b.box(1.6 + 0.1, 0.5, 0.1, w / 2 - 1.5, h1 - 0.1, 0.12, 0x2a1a10); b.sign(R.pick(KY_SIGNS), 1.6, 0.42, w / 2 - 1.5, h1 - 0.1, 0.18, '#5a3a22', '#f4e8c8'); }
  if (R.chance(0.5)) b.box(0.08, 1.6, 0.6, -w / 2 + 1.2, 1.5, 0.3, 0x8a6a4a); // 犬矢來（簡化）
}
function pagoda(b) {
  b.box(14, 1.0, 14, 0, 0.5, 0, 0x8a8a84);
  for (let i = 0; i < 5; i++) { const y = 1 + i * 5.2, w = 9 - i * 1.0; b.box(w, 4.2, w, 0, y + 2.1, 0, 0xb8362a); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; b.cyl(0.3, 0.3, 4.2, Math.sin(a) * w / 2, y + 2.1, Math.cos(a) * w / 2, 0x3e2a1c, { seg: 8 }); } b.box(w + 3.6, 0.5, w + 3.6, 0, y + 4.45, 0, 0x3a3a40); b.box(w + 2.6, 0.5, w + 2.6, 0, y + 4.9, 0, 0x4a4a50); b.box(w * 0.7, 1.0, w * 0.7, 0, y + 5.2 - 0.3, 0, 0xe8e0d0); }
  b.cyl(0.25, 0.4, 7, 0, 27 + 3.5, 0, 0xe8b040, { seg: 8 }); for (let i = 0; i < 6; i++) b.cyl(0.9 - i * 0.1, 0.9 - i * 0.1, 0.15, 0, 28 + i * 1.0, 0, 0xe8b040, { seg: 10 });
}
function bambooGrove(b, R, n, w) { for (let i = 0; i < n; i++) { const x = (R() - 0.5) * w, z = -R() * 7 - 0.5, h = R.range(9, 15); b.cyl(0.12, 0.16, h, x, h / 2, z, R.pick([0x6aa84a, 0x5a9a40, 0x7ab85a]), { seg: 5 }); for (let k = 1; k < 5; k++) b.cyl(0.18, 0.18, 0.08, x, h * k / 5, z, 0x4a7a30, { seg: 5 }); b.sphere(0.9, x + 0.3, h - 0.5, z, 0x5a9a40, { seg: 5, seg2: 4 }); } }
function rickshawMesh(atlas) {
  const b = new Builder(atlas);
  b.box(1.2, 0.9, 1.2, 0, 1.0, 0, 0x1a1a24); b.box(1.25, 0.6, 1.1, 0, 1.75, -0.2, 0xb8362a); b.box(1.1, 0.35, 0.9, 0, 1.0, 0.1, 0xd9463b);
  for (const s of [-1, 1]) b.cyl(0.6, 0.6, 0.06, s * 0.75, 0.6, 0, 0x2a2a2a, { seg: 14, rz: Math.PI / 2 });
  for (const s of [-1, 1]) b.box(0.06, 0.06, 2.6, s * 0.45, 0.75, 1.6, 0x3e2a1c);
  b.box(0.5, 0.7, 0.4, 0, 1.3, 2.6, 0x1f2f6f); b.sphere(0.3, 0, 1.95, 2.6, 0xe8b88a, { seg: 8, seg2: 6 }); b.box(0.26, 0.5, 0.26, -0.15, 0.5, 2.6, 0x1a1a1a); b.box(0.26, 0.5, 0.26, 0.15, 0.5, 2.85, 0x1a1a1a);
  // 坐的遊客
  b.box(0.55, 0.6, 0.4, 0, 1.6, -0.1, 0xe8b0c8); b.sphere(0.3, 0, 2.2, -0.1, 0xf2c9a8, { seg: 8, seg2: 6 }); b.box(0.68, 0.2, 0.6, 0, 2.5, -0.15, 0x2a1a10);
  return b.build();
}
function pedestrianMesh(atlas, R) {
  const b = new Builder(atlas); const col = R.pick([0xe8b0c8, 0x6a8ab0, 0x3a3a3a, 0xf4e8c8, 0xb8362a]);
  b.box(0.5, 0.7, 0.34, 0, 0.9, 0, col); b.box(0.24, 0.55, 0.24, -0.14, 0.28, 0, 0x2a2a30); b.box(0.24, 0.55, 0.24, 0.14, 0.28, 0, 0x2a2a30);
  b.sphere(0.3, 0, 1.56, 0, 0xf2c9a8, { seg: 8, seg2: 6 }); b.box(0.64, 0.22, 0.6, 0, 1.78, -0.04, 0x2a1a10);
  if (R.chance(0.5)) { b.cyl(0.02, 0.02, 1.4, 0.3, 1.6, 0, 0x3e2a1c, { seg: 4 }); b.cone(0.9, 0.3, 0.3, 2.3, 0, R.pick([0xd9463b, 0xf2b134, 0xf4f4f4]), { seg: 10 }); } // 和傘
  return b.build();
}

/* ───────── 主流程 ───────── */
export function buildScenery(track, course, seed = 7) {
  const R = mkRng(seed), atlas = new SignAtlas(), b = new Builder(atlas), bt = new Builder(atlas); // bt：樹，離鏡頭近就不畫
  const world = { obstacles: [], movers: [], boosts: [], itemT: [], atlas, labels: [] };
  const isNight = night(course), lit = course.time !== 'day';
  const lim = track.limit, N = track.N, feat = course.features || {};
  const addObs = (f, r, h, kind = 'solid', name = '') => world.obstacles.push({ x: f.x, z: f.z, y: f.y, r, h, kind, name });
  const placeProp = (fn, t, lateral, r, h, kind, name) => { const f = track.frameT(t, lateral); b.push(f.x, f.y + 0.14, f.z, f.ry); fn(); b.pop(); if (r) addObs(f, r, h, kind, name); return f; };
  const inFeat = (t, keys) => keys.some(k => track.inRange(t, feat[k]));
  const noBuildAt = (t) => isTaipei ? inFeat(t, ['temple']) : isTokyo ? inFeat(t, ['shrine', 'crossing', 'bridge']) : inFeat(t, ['torii', 'pagoda', 'bamboo', 'river']);
  const isTaipei = course.theme === 'taipei', isTokyo = course.theme === 'tokyo', isKyoto = course.theme === 'kyoto';
  const stepsAt = (period, offset = 0) => { const arr = []; for (let i = offset; i < N; i += period) arr.push(i / N); return arr; };

  // ── 房子：沿兩側排
  const bldW = () => isKyoto ? R.range(6.5, 10) : isTokyo ? R.range(6, 9) : R.range(8, 13);
  const placeBld = (t, x, y, z, ry, w, s) => {
    if (noBuildAt(t)) return;
    if (isKyoto && track.inRange(t, feat.river) && s < 0) return; // 河邊段右側不蓋房
    b.push(x, y, z, ry);
    if (isTaipei) bldTaipei(b, R, w, isNight); else if (isTokyo) bldTokyo(b, R, w, lit); else machiya(b, R, w);
    b.pop();
  };
  if (course.grid) {
    const nC = track.corners.length;
    for (let i = 0; i < nC; i++) {
      const A = track.corners[i], B = track.corners[(i + 1) % nC];
      const d = B.pos.clone().sub(A.pos); const L = d.length(); d.normalize(); const l = new THREE.Vector3(d.z, 0, -d.x);
      for (const s of [1, -1]) {
        let a = lim + 0.5; const end = L - (lim + 0.5);
        while (end - a >= 4) {
          let w = bldW(); if (a + w > end || end - (a + w) < 4) w = end - a; // 最後一棟吃掉剩下的
          const m = a + w / 2, c = A.pos.clone().addScaledVector(d, m).addScaledVector(l, s * (lim + 0.5));
          placeBld(((A.idx + m) % N) / N, c.x, lerp(A.pos.y, B.pos.y, m / L), c.z, Math.atan2(-s * l.x, -s * l.z), w, s);
          a += w + R.range(0, 0.3);
        }
      }
    }
  } else {
    for (const s of [1, -1]) {
      let i = R.range(0, 6);
      while (i < N) { const w = bldW(), f = track.frameT(i / N, s * (lim + 0.5)); placeBld(i / N, f.x, f.y, f.z, f.ry, w, s); i += w + R.range(0, 0.3); }
    }
  }
  // ── 直角彎：外側補一棟轉角大樓把正前方的牆補滿，牆上放箭頭指示牌（像走廊盡頭的告示）
  for (const c of track.corners) {
    const u = c.dIn, v = c.dOut, P = c.pos, H = isKyoto ? R.range(6, 9) : R.range(12, isTaipei ? 24 : 16);
    const du = lim + 0.5 + 7, dv = -6.5, sizeV = 2 * lim + 16;
    const cx = P.x + u.x * du + v.x * dv, cz = P.z + u.z * du + v.z * dv;
    const ry = Math.atan2(-u.x, -u.z); // 局部 +z 朝向跑過來的人
    b.push(cx, P.y, cz, ry);
    const wallCol = isTaipei ? R.pick(TW_TILES) : isTokyo ? R.pick(JP_WALLS) : 0xe8e0d0;
    b.box(sizeV, H + 4, 14, 0, H / 2 - 2, 0, wallCol);
    if (isKyoto) b.box(sizeV + 0.8, 0.5, 14.8, 0, H + 0.2, 0, 0x3a3a40); else b.box(sizeV, 0.6, 14, 0, H + 0.3, 0, wallCol);
    // 窗
    for (let f = 1; f < Math.floor(H / 3); f++) for (let k = 0; k < Math.floor(sizeV / 3); k++) { const on = lit && R.chance(0.5); b.box(1.4, 1.2, 0.06, -sizeV / 2 + 1.5 + k * 3, f * 3 + 1.5, 7.03, on ? 0xffe4a8 : 0x3a4858, { lit: on }); }
    b.pop();
    // 箭頭牌：掛在正前方的牆上、略偏彎道外側，高 3.4 公尺
    const sx = P.x + u.x * (lim + 0.45) + v.x * (-lim * 0.35), sz = P.z + u.z * (lim + 0.45) + v.z * (-lim * 0.35);
    b.push(sx, P.y, sz, ry);
    b.box(4.6, 3.0, 0.14, 0, 3.6, -0.08, 0x2a2a2a);
    b.sign(c.turn > 0 ? '←' : '→', 4.4, 2.8, 0, 3.6, 0.0, '#f2c230', '#1f4fd0', { size: 112 }); // turn>0 左轉
    if (lit) b.box(1.0, 0.08, 0.3, 0, 4.7, 0.2, 0xfff1c0, { lit: true });
    b.pop();
  }
  // ── 遠景：第二排街廓（深色量體，夜晚亮窗）
  const backRows = isTaipei ? 2 : 1;
  for (let row = 0; row < backRows; row++) for (const s of [1, -1]) {
    for (let i = R.range(0, 10); i < N; i += R.range(11, 19)) {
      const f = track.frameT(i / N, s * (lim + 14 + row * 14)), w = R.range(10, 18), h = isKyoto ? R.range(5, 9) : R.range(10, isTaipei ? 36 : 22);
      { let tooClose = false; for (let k = 0; k < N; k += 2) { const q = track.pos[k]; if ((q.x - f.x) ** 2 + (q.z - f.z) ** 2 < 14 * 14) { tooClose = true; break; } } if (tooClose) continue; } // 太靠近別段馬路就不放
      b.push(f.x, f.y, f.z, f.ry); b.box(w, h + 4, 12, 0, h / 2 - 2, -6, R.pick(isTaipei ? [0x3a3a48, 0x4a4a58, 0x5a5a68] : isKyoto ? [0x5a4232, 0xe8e0d0, 0x4a3626] : [0x8a8a90, 0xa8a4a0, 0x6a6a70])); if (isKyoto) b.box(w + 1, 0.5, 13, 0, h + 0.2, -6, 0x3a3a40);
      if (lit) for (let k = 0; k < Math.round(w * h / 14); k++) if (R.chance(0.4)) b.box(0.9, 1.0, 0.1, -w / 2 + 1 + R() * (w - 2), 1 + R() * (h - 2), 0.05, R.pick([0xffe4a8, 0xbfe6ff, 0xfff1c8]), { lit: true });
      b.pop();
    }
  }
  // ── 路燈、樹、小物（每隔幾公尺）
  for (const s of [1, -1]) for (const t of stepsAt(18, s > 0 ? 0 : 9)) {
    if (isKyoto && track.inRange(t, feat.torii)) continue;
    const f = track.frameT(t, s * (lim - 0.4)); b.push(f.x, f.y + 0.14, f.z, f.ry); streetLamp(b, lit, isTaipei ? 'tw' : 'jp'); b.pop();
  }
  if (isTokyo) { // 電線桿＋電線
    const poles = [];
    for (const t of stepsAt(14, 7)) { if (track.inRange(t, feat.bridge)) continue; const f = track.frameT(t, lim - 0.6); b.push(f.x, f.y + 0.14, f.z, f.ry); utilityPole(b, lit); b.pop(); poles.push(f); }
    for (let i = 0; i < poles.length; i++) { const a = poles[i], c = poles[(i + 1) % poles.length]; const dx = c.x - a.x, dz = c.z - a.z, len = Math.hypot(dx, dz); if (len > 40) continue; for (const [dy, off] of [[8.1, -0.7], [8.1, 0.7], [7.5, -0.5], [7.5, 0.5]]) { b.push((a.x + c.x) / 2, (a.y + c.y) / 2 + dy - 0.3, (a.z + c.z) / 2, Math.atan2(dx, dz)); b.box(0.04, 0.04, len, off, 0, 0, 0x1a1a1a); b.pop(); } }
  }
  for (const s of [1, -1]) for (const t of stepsAt(14, s > 0 ? 4 : 11)) {
    if (noBuildAt(t) && !(isKyoto && track.inRange(t, feat.river) && s < 0)) continue;
    const f = track.frameT(t, s * (lim - 0.5));
    bt.push(f.x, f.y + 0.14, f.z, f.ry);
    if (isTaipei) { if (R.chance(0.4)) palm(bt, R, R.range(5.5, 7)); else treeRound(bt, R, R.range(4.5, 5.5)); }
    else if (isTokyo) { if (track.inRange(t, feat.sakura) || R.chance(0.3)) treeBlossom(bt, R, R.range(4.5, 5.5), C.sakura); else treeRound(bt, R, R.range(4, 5)); }
    else { if (R.chance(0.6)) treeBlossom(bt, R, R.range(4, 5), C.maple); else bt.cone(1.4, 4, 0, 3, 0, C.pine, { seg: 7 }), bt.cyl(0.14, 0.18, 1.2, 0, 0.6, 0, 0x4a3626, { seg: 6 }); }
    bt.pop();
  }

  const sidewalkObs = Math.round(N / 4.5);
  for (let k = 0; k < sidewalkObs; k++) { // 人行道上的東西玩家碰不到，不用碰撞圓
    const t = R(), s = R.chance(0.5) ? 1 : -1;
    if (t < 0.03 || t > 0.97) continue;
    if (isKyoto && track.inRange(t, feat.torii)) continue;
    if (isKyoto && track.inRange(t, feat.river) && s < 0) continue;
    const lat = s * (track.halfW + R.range(0.8, track.sw - 0.5));
    const f = track.frameT(t, lat), ry = f.yaw + (R.chance(0.5) ? 0 : Math.PI) + R.range(-0.3, 0.3);
    b.push(f.x, f.y + 0.14, f.z, ry);
    const pick = R();
    if (pick < 0.42) person(b, R);
    else if (isTaipei) { if (pick < 0.75) scooter(b, R.pick([0xd9463b, 0x2f5fb0, 0xf4f4f4, 0x2a2a2a, 0xf2b134])); else if (pick < 0.85) trashCan(b, 0x3f7a5a); else if (pick < 0.92) planter(b, R); else if (pick < 0.96) mailboxTW(b); else flag(b, R, R.pick(['特價', '新開幕', '人氣', '排隊']), R.pick(['#e8322a', '#f2b134']), '#fff'); }
    else if (isTokyo) { if (pick < 0.62) vending(b, R, lit); else if (pick < 0.8) bicycle(b, R.pick([0x3a3a3a, 0xd9463b, 0x2f5fb0, 0xf4f4f4])); else if (pick < 0.86) trashCan(b, 0x5a5a60); else if (pick < 0.9) postJP(b); else flag(b, R, R.pick(['営業中', '大売出', 'セール', 'おでん', '生ビール']), R.pick(['#b8362a', '#1f2f6f', '#f4f4f4']), pick < 0.95 ? '#fff' : '#1a1a1a'); }
    else { if (pick < 0.62) stoneLantern(b); else if (pick < 0.75) bench(b); else if (pick < 0.85) planter(b, R); else if (pick < 0.9) bicycle(b, 0x3a3a3a); else flag(b, R, R.pick(['抹茶', '甘味', '京漬物', '湯豆腐']), R.pick(['#5a3a22', '#b8362a', '#1f2f6f']), '#f4e8c8'); }
    b.pop();
  }
  world.itemT = course.items || [0.14, 0.42, 0.66, 0.88];
  const LW = track.halfW * 0.62; // 三線道間距
  const blockedT = (t) => world.itemT.some(x => Math.abs(x - t) < 0.015) || t < 0.03 || t > 0.965 || track.nearCorner(t, 9)
    || (isTaipei && (Math.abs(t - feat.intersection[0]) < 0.02 || Math.abs(t - feat.intersection[1]) < 0.02))
    || (isTokyo && Math.abs(t - feat.crossing) < 0.025) || (isKyoto && Math.abs(t - feat.crosswalk) < 0.015);
  for (let i = 14; i < N - 8; i += R.range(11, 19)) {
    const t = i / N; if (blockedT(t)) continue;
    const lanes = R.chance(0.6) ? [R.int(-1, 1)] : (() => { const a = R.int(-1, 1); let c = R.int(-1, 1); if (c === a) c = ((a + 2) % 3) - 1; return [a, c]; })(); // 最多擋兩線
    for (const lane of lanes) {
      const f = track.frameT(t, lane * LW + R.range(-0.25, 0.25)), pick = R();
      b.push(f.x, f.y, f.z, f.yaw + R.range(-0.2, 0.2));
      if (pick < 0.28) { cone(b); b.pop(); addObs(f, 0.4, 0.75, 'jumpable', '三角錐'); }
      else if (pick < 0.46) { b.pop(); b.push(f.x, f.y + 0.005, f.z, f.yaw); b.cyl(1.2, 1.2, 0.01, 0, 0, 0, isNight ? 0x3a5aa0 : 0x6a8ab0, { seg: 10, sx: 1.3 }); b.pop(); addObs(f, 1.3, 0, 'puddle', '水窪'); }
      else if (isTaipei) { if (pick < 0.72) { scooter(b, R.pick([0xd9463b, 0x2f5fb0, 0xf4f4f4, 0x2a2a2a])); b.pop(); addObs(f, 0.75, 0.95, 'jumpable', '機車'); } else if (pick < 0.88) { for (let k = 0; k < 3; k++) b.sphere(0.4, (k - 1) * 0.5, 0.35, R.range(-0.2, 0.2), 0x2a2a30, { seg: 7, seg2: 5, sy: 0.8 }); b.pop(); addObs(f, 0.8, 0.7, 'jumpable', '垃圾袋'); } else { b.box(1.8, 1.0, 0.3, 0, 0.6, 0, 0xf2b134); b.box(1.8, 0.12, 0.32, 0, 0.6, 0, 0x1a1a1a, { rz: 0.4 }); for (const x of [-0.8, 0.8]) b.box(0.1, 1.1, 0.5, x, 0.55, 0, 0x6a6a6a); b.pop(); addObs(f, 1.0, 1.1, 'solid', '施工圍欄'); } }
      else if (isTokyo) { if (pick < 0.7) { bicycle(b, R.pick([0x3a3a3a, 0xd9463b, 0x2f5fb0])); b.pop(); addObs(f, 0.6, 0.95, 'jumpable', '腳踏車'); } else if (pick < 0.86) { cone(b); b.box(1.6, 0.08, 0.08, 0, 0.75, 0, 0xf2f2f2); b.pop(); addObs(f, 0.9, 0.8, 'jumpable', '三角錐'); } else { b.box(1.6, 1.0, 0.3, 0, 0.6, 0, 0xf4f4f4); for (let k = 0; k < 4; k++) b.box(0.25, 1.0, 0.32, -0.6 + k * 0.4, 0.6, 0, 0xe8502a); for (const x of [-0.7, 0.7]) b.box(0.1, 1.1, 0.5, x, 0.55, 0, 0x6a6a6a); b.pop(); addObs(f, 0.9, 1.1, 'solid', '施工圍欄'); } }
      else { if (pick < 0.68) { planter(b, R); b.pop(); addObs(f, 0.7, 0.9, 'jumpable', '花台'); } else if (pick < 0.86) { stoneLantern(b); b.pop(); addObs(f, 0.5, 1.9, 'solid', '石燈籠'); } else { b.box(1.2, 0.9, 1.2, 0, 1.0, 0, 0x1a1a24); b.box(1.25, 0.6, 1.1, 0, 1.75, -0.2, 0xb8362a); for (const sx of [-1, 1]) b.cyl(0.6, 0.6, 0.06, sx * 0.75, 0.6, 0, 0x2a2a2a, { seg: 14, rz: Math.PI / 2 }); b.pop(); addObs(f, 1.0, 2.0, 'solid', '停著的人力車'); } }
    }
  }
  // ── 加速墊
  const boostT = course.boosts || [0.31, 0.78];
  for (const t of boostT) { const f = track.frameT(t, 0); b.push(f.x, f.y + 0.01, f.z, f.yaw); for (let i = 0; i < 3; i++) { b.box(1.2, 0.02, 0.35, -0.6, 0, i * 1.1 - 1, 0x40f0ff, { lit: true, ry: 0.6 }); b.box(1.2, 0.02, 0.35, 0.6, 0, i * 1.1 - 1, 0x40f0ff, { lit: true, ry: -0.6 }); } b.pop(); world.boosts.push({ x: f.x, z: f.z, r: 1.6 }); }

  // ── 主題特色
  if (isTaipei) {
    // 夜市段：攤販、跨街燈籠、更多人
    const [m0, m1] = feat.market; const span = m1 - m0;
    for (const s of [1, -1]) for (let k = 0; k < Math.round(span * N / 4.5); k++) { const t = m0 + (k + (s > 0 ? 0.25 : 0.75)) * span / Math.round(span * N / 4.5); if (track.nearCorner(t, 7)) continue; const f = track.frameT(t, s * (track.halfW + 0.9)); b.push(f.x, f.y + 0.14, f.z, f.ry); stall(b, R, isNight); b.pop(); b.push(f.x, f.y + 0.14, f.z, f.ry + Math.PI + R.range(-0.5, 0.5)); b.push(R.range(-0.8, 0.8), 0, -1.6, 0); person(b, R); b.pop(); b.pop(); }
    for (let k = 0; k < Math.round(span * N / 5); k++) { const t = m0 + k * span / Math.round(span * N / 5); if (track.nearCorner(t, 5)) continue; const f = track.frameT(t, 0); b.push(f.x, f.y, f.z, f.yaw); b.box(0.05, 0.05, lim * 2 + 2, 0, 5.2, 0, 0x1a1a1a, { ry: Math.PI / 2 }); lanternRow(b, 9, 4.9, 0, (lim * 2) / 9, R.pick([0xe03a2a, 0xe03a2a, 0xf2b134])); b.pop(); }
    // 廟
    { const f = track.frameT(feat.temple, lim + 0.5); b.push(f.x, f.y, f.z, f.ry); temple(b, R, isNight); b.pop(); world.labels.push({ x: f.x, y: f.y + 11, z: f.z, text: '保安宮' }); }
    // 路口：紅綠燈＋斑馬線＋穿越的機車
    for (const t of [feat.intersection[0], feat.intersection[1]]) {
      for (const s of [1, -1]) { const f = track.frameT(t - 0.008 * s, s * (lim - 0.5)); b.push(f.x, f.y + 0.14, f.z, f.ry + Math.PI / 2 * s); trafficLight(b, lit, true); b.pop(); }
      b.raw(track.crosswalk(t), 0xffffff);
      // 橫向的小路（視覺）
      const f = track.frameT(t, 0); b.push(f.x, f.y - 0.002, f.z, f.yaw); b.box(lim * 2 + 40, 0.02, 7, 0, 0, 0, 0x3a3a40); b.pop();
      world.movers.push(makeCrosser(track, t, atlas, R, 'scooter'));
    }
    // 垃圾車（沿路慢慢開）
    world.movers.push(makeRoadVehicle(track, garbageTruckMesh(atlas), feat.truck, -LW, 5.5, 1.3, 3.0, 1.4, '垃圾車'));
    // 台北 101：放在賽道外側遠處
    { const c = track.pos[track.idxAtT(0.5)].clone().add(track.left[track.idxAtT(0.5)].clone().multiplyScalar(-120)); b.push(c.x, -2, c.z, 0); taipei101(b); b.pop(); }
    // YouBike 站
    { const f = track.frameT(0.95, track.halfW + 1.5); b.push(f.x, f.y + 0.14, f.z, f.yaw); for (let i = 0; i < 5; i++) { b.push(0, 0, i * 1.1 - 2.2, Math.PI / 2); bicycle(b, 0xf2b134); b.pop(); } b.pop(); addObs(f, 1.2, 0.95, 'jumpable', 'YouBike'); }
  }
  if (isTokyo) {
    // 平交道：鐵軌、柵欄、電車
    { const t = feat.crossing, f = track.frameT(t, 0); b.push(f.x, f.y, f.z, f.yaw); for (const z of [-0.75, 0.75]) b.box(lim * 2 + 60, 0.08, 0.14, 0, 0.04, z, 0x6a6a64); for (let i = -20; i <= 20; i++) b.box(0.25, 0.06, 2.2, i * 3.2, 0.02, 0, 0x4a3a2a); b.pop();
      for (const s of [1, -1]) { const g = track.frameT(t - s * 0.012, s * (lim - 0.6)); b.push(g.x, g.y + 0.14, g.z, g.ry); crossingGate(b, lit); b.pop(); }
      world.movers.push(makeTrain(track, t, atlas));
      world.labels.push({ x: f.x, y: f.y + 6, z: f.z, text: '踏切' });
    }
    { const f = track.frameT(feat.shrine, lim + 0.5); b.push(f.x, f.y, f.z, f.ry); shrine(b); b.pop(); }
    // 橋：欄杆＋河
    { const [b0, b1] = feat.bridge; for (const s of [1, -1]) b.raw(track.ribbon(s * (lim - 0.2), 0.14, s * (lim + 0.2), 1.3, 0x7a8a9a, { range: [b0, b1] })); b.raw(track.ribbon(-lim - 0.3, -0.6, lim + 0.3, -0.6, 0x3a4a5a, { range: [b0, b1] }));
      const mid = (b0 + b1) / 2, f = track.frameT(mid, 0); b.push(f.x, -0.4, f.z, f.yaw); b.box(400, 0.1, 26, 0, 0, 0, 0x3a6a9a); b.box(400, 1.2, 1.5, 0, 0.3, 13.5, 0x8a8a84); b.box(400, 1.2, 1.5, 0, 0.3, -13.5, 0x8a8a84); b.pop();
      for (let k = 0; k <= 4; k++) { const g = track.frameT(b0 + (b1 - b0) * k / 4, 0); b.push(g.x, g.y - 3, g.z, g.yaw); b.box(2.5, 7, lim * 2, 0, 0, 0, 0x6a6a70); b.pop(); } }
    // 東京鐵塔與富士山
    { const c = track.pos[track.idxAtT(0.2)].clone().add(track.left[track.idxAtT(0.2)].clone().multiplyScalar(-150)); b.push(c.x, 0, c.z, 0); tokyoTower(b); b.pop(); }
    { const c = track.pos[track.idxAtT(0.75)].clone().add(track.left[track.idxAtT(0.75)].clone().multiplyScalar(420)); fuji(b, c.x, c.z, 1.0); }
    // 計程車（停在路邊）
    for (const t of [0.05, 0.47, 0.7]) { const f = track.frameT(t, -LW); b.push(f.x, f.y, f.z, f.yaw); b.box(1.8, 0.9, 4.2, 0, 0.7, 0, R.pick([0xf2c230, 0x1a1a1a, 0x2f8a55])); b.box(1.7, 0.7, 2.2, 0, 1.45, -0.2, 0xf4f4f4); b.box(0.5, 0.2, 0.3, 0, 1.9, -0.2, 0xffe066, { lit }); for (const z of [1.4, -1.4]) for (const s of [-1, 1]) b.cyl(0.35, 0.35, 0.25, s * 0.85, 0.35, z, 0x222222, { seg: 10, rz: Math.PI / 2 }); b.pop(); addObs(f, 1.2, 1.8, 'solid', '計程車'); }
  }
  if (isKyoto) {
    // 千本鳥居：兩側密排
    { const [t0, t1] = feat.torii; const n = Math.round((t1 - t0) * N / 1.5); for (let k = 0; k <= n; k++) { const f = track.frameT(t0 + (t1 - t0) * k / n, 0); b.push(f.x, f.y, f.z, f.yaw); torii(b, track.halfW * 2 + 1.2, 6.2); b.pop(); }
      for (const s of [1, -1]) b.raw(track.ribbon(s * (track.halfW + 0.6), 0.15, s * (lim + 0.5), 0.15, 0x3a6a3a, { range: [t0, t1] }));
      for (let k = 0; k < 30; k++) { const f = track.frameT(t0 + (t1 - t0) * R(), (R.chance(0.5) ? 1 : -1) * (lim + R.range(2, 10))); b.push(f.x, f.y, f.z, 0); b.cone(1.6, 6, 0, 3, 0, C.pine, { seg: 7 }); b.pop(); }
      const f = track.frameT((t0 + t1) / 2, 0); world.labels.push({ x: f.x, y: f.y + 8, z: f.z, text: '千本鳥居' }); }
    { const f = track.frameT(feat.pagoda, lim + 6); b.push(f.x, f.y, f.z, f.ry); pagoda(b); b.pop(); world.labels.push({ x: f.x, y: f.y + 36, z: f.z, text: '五重塔' }); }
    { const [t0, t1] = feat.bamboo; for (const s of [1, -1]) for (let k = 0; k < Math.round((t1 - t0) * N / 10); k++) { const f = track.frameT(t0 + (t1 - t0) * (k + 0.5) / Math.round((t1 - t0) * N / 10), s * (lim + 0.5)); b.push(f.x, f.y, f.z, f.ry); bambooGrove(b, R, 14, 10); b.pop(); } }
    // 鴨川：右側是河與堤防
    { const [r0, r1] = feat.river; b.raw(track.ribbon(-lim - 0.6, 0.14, -lim - 4, -1.6, 0x8aa070, { range: [r0, r1] })); b.raw(track.ribbon(-lim - 4, -1.6, -lim - 30, -1.6, 0x4a8ab8, { range: [r0, r1] })); b.raw(track.ribbon(-lim - 30, -1.6, -lim - 38, 0.4, 0x8aa070, { range: [r0, r1] }));
      for (let k = 0; k < 24; k++) { const f = track.frameT(r0 + (r1 - r0) * (k + 0.5) / 24, -(lim + 2)); b.push(f.x, f.y - 1.0, f.z, f.yaw); bench(b); if (k % 2) { b.push(0.4, 0, -0.5, Math.PI); person(b, R); b.pop(); } b.pop(); } }
    { const t = feat.crosswalk; b.raw(track.crosswalk(t), 0xffffff); for (let k = 0; k < 3; k++) world.movers.push(makeCrosser(track, t, atlas, R, 'ped', k)); }
    world.movers.push(makeRoadVehicle(track, rickshawMesh(atlas), 0.2, LW, 4.2, 0.9, 2.2, 1.1, '人力車'));
    // 遠山
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, c = Math.cos(a) * 320, s2 = Math.sin(a) * 320; b.cone(R.range(90, 150), R.range(40, 80), c, 0, s2, R.pick([0x5a7a5a, 0x6a8a66, 0x4a6a50]), { seg: 10 }); }
  }

  // ── 地面
  const ground = new THREE.Group();
  const minY = Math.min(...track.pos.map(p => p.y)), maxY = Math.max(...track.pos.map(p => p.y));
  if (maxY - minY > 1.5) { // 有坡度：地面跟著賽道，兩側再向外斜下去
    // 格子路線的街道只隔約 30 公尺，地面帶狀不能太寬，否則會蓋到隔壁那條路
    const gw = course.grid ? 8 : 24, gs = course.grid ? 11 : 60, gd = course.grid ? -3 : -8;
    for (const s of [1, -1]) { b.raw(track.ribbon(s * (lim + 0.4), 0.1, s * (lim + gw), 0.1, course.pal.ground, { noise: 0.02 })); b.raw(track.ribbon(s * (lim + gw), 0.1, s * (lim + gs), gd, course.pal.ground, { noise: 0.03 })); }
  }
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshLambertMaterial({ color: course.pal.ground }));
  plane.rotation.x = -Math.PI / 2; plane.position.y = (maxY - minY > 1.5 ? minY - 8 : -0.05); plane.receiveShadow = true; ground.add(plane);

  const group = b.build({ nearCull: 2.2 });
  group.add(bt.build({ nearCull: 6 }));
  group.add(ground);
  for (const m of world.movers) group.add(m.mesh);
  return { group, ...world };
}

/* ───────── 會動的東西 ───────── */
// 沿賽道開的車（固定橫向位置、固定速度）
function makeRoadVehicle(track, mesh, t0, lateral, speed, r, h, stun, name) {
  let prog = ((t0 % 1) + 1) % 1 * track.N; const p = new THREE.Vector3();
  mesh.castShadow = true;
  const mv = { mesh, name, stun, hits: [{ x: 0, z: 0, r, h }], update(dt) { prog = (prog + speed * dt) % track.N; const i = Math.floor(prog); track.point(i, lateral, prog - i, p); mesh.position.set(p.x, p.y, p.z); mesh.rotation.y = track.yaw[i]; mv.hits[0].x = p.x; mv.hits[0].z = p.z; } };
  mv.update(0); return mv;
}
// 從路邊橫越馬路的東西（機車、路人）
function makeCrosser(track, t, atlas, R, kind, k = 0) {
  const f = track.frameT(t + (kind === 'ped' ? (k - 1) * 0.004 : 0), 0), left = f.left;
  const mesh = kind === 'ped' ? pedestrianMesh(atlas, R) : scooterRiderMesh(atlas, R.pick([0xd9463b, 0x2f5fb0, 0xf4f4f4, 0x2a2a2a]));
  const speed = kind === 'ped' ? R.range(1.2, 1.8) : R.range(7, 10), span = kind === 'ped' ? track.limit + 0.5 : track.limit + 14, period = kind === 'ped' ? R.range(9, 14) : R.range(5.5, 8);
  let timer = R.range(0, period), dir = R.chance(0.5) ? 1 : -1;
  const hit = { x: f.x, z: f.z, r: kind === 'ped' ? 0.45 : 0.9, h: 1.9 };
  const mv = { mesh, name: kind === 'ped' ? '遊客' : '機車', stun: kind === 'ped' ? 0.7 : 1.3, hits: [hit], active: false, update(dt) {
    timer += dt;
    const travel = span * 2 / speed; // 從一邊到另一邊的時間
    if (timer > period) { timer -= period; dir = -dir; }
    const active = timer < travel;
    mv.active = active; mesh.visible = active;
    if (active) { const lat = dir * (span - speed * timer); mesh.position.set(f.x + left.x * lat, f.y + (Math.abs(lat) > track.halfW ? 0.14 : 0), f.z + left.z * lat); mesh.rotation.y = Math.atan2(-dir * left.x, -dir * left.z); hit.x = mesh.position.x; hit.z = mesh.position.z; }
    else { hit.x = 1e6; hit.z = 1e6; }
  } };
  mv.update(0); return mv;
}
// 電車：每隔一段時間橫越平交道（警示燈先閃）
function makeTrain(track, t, atlas) {
  const f = track.frameT(t, 0), left = f.left, mesh = trainMesh(atlas);
  const period = 17, warn = 3.5, speed = 22, span = 120; let timer = 6, dir = 1;
  const hits = []; for (let c = 0; c < 4; c++) for (let k = -1; k <= 1; k++) hits.push({ x: 1e6, z: 1e6, r: 1.9, h: 4, off: (c - 1.5) * 12.5 + k * 4 });
  const mv = { mesh, name: '電車', stun: 2.2, hits, warning: false, update(dt) {
    timer += dt; if (timer > period) { timer -= period; dir = -dir; }
    const travel = (span * 2 + 50) / speed;
    mv.warning = timer > period - warn || timer < travel;
    const active = timer < travel; mesh.visible = active;
    if (active) { const lat = dir * (span + 25 - speed * timer); mesh.position.set(f.x + left.x * lat, f.y, f.z + left.z * lat); mesh.rotation.y = Math.atan2(left.x, left.z); for (const h of hits) { h.x = mesh.position.x + left.x * h.off; h.z = mesh.position.z + left.z * h.off; } }
    else for (const h of hits) { h.x = 1e6; h.z = 1e6; }
  } };
  mv.update(0); return mv;
}
