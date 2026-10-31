/* 地圖：右上角的小地圖（跟著鏡頭轉，畫面上方＝往前走的方向）＋點開後的大地圖（北方朝上，可以點地圖走過去、快速前往打開的區域）。
   每張地圖提供 MAP.mini：{ shape:'circle'|'rect', cx,cz,R | x0,x1,z0,z1, grass, paths:[{pts:[[x,z]…], to?, w?}], river?, riverW?, rects?, dots?() }，
   知識點（MAP.nodes）、玩法互動點（MAP.items）、傳送拱門（MAP.portals，icon／name）也一起畫。全部用 icons.js 的圖示，不用 emoji。 */
import * as ICON from './icons.js';
import { nodeState, levelOf } from './learn.js';

const STATE_COL = { mastered: '#8CC77E', review: '#F5B731', open: '#F28CA0', locked: '#B3A8CC' };
const STATE_ICON = { mastered: 'st-mastered', review: 'st-review', open: 'st-available', locked: 'st-locked' };

// view：{ cx, cz（畫面中心的世界座標）, scale（每格幾 px）, yaw（鏡頭角度；0＝北方朝上）, full（大地圖：畫圖示與名字）}
export function project(v, w, h) { const c = Math.cos(v.yaw), s = Math.sin(v.yaw); // 鏡頭右方 (cos,-sin)、前方 (-sin,-cos)
  return { to: (x, z) => { const dx = x - v.cx, dz = z - v.cz; return [w / 2 + (dx * c - dz * s) * v.scale, h / 2 - (-dx * s - dz * c) * v.scale]; },
    from: (px, py) => { const a = (px - w / 2) / v.scale, b = -(py - h / 2) / v.scale; return [v.cx + a * c - b * s, v.cz - a * s - b * c]; } }; }

export function draw(cv, MAP, PL, v) { const g = cv.getContext('2d'), dpr = cv._dpr || 1, w = cv.width / dpr, h = cv.height / dpr, m = MAP.mini; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = project(v, w, h), to = P.to, sc = v.scale; g.clearRect(0, 0, w, h);
  g.fillStyle = '#5f9e5a'; g.fillRect(0, 0, w, h); // 地圖外：樹林
  if (!m) return P;
  // 可以走的地方
  g.save(); g.beginPath(); if (m.shape === 'circle') { const [x, y] = to(m.cx, m.cz); g.arc(x, y, m.R * sc, 0, Math.PI * 2); } else { const pts = [[m.x0, m.z0], [m.x1, m.z0], [m.x1, m.z1], [m.x0, m.z1]].map(p => to(...p)); g.moveTo(...pts[0]); pts.slice(1).forEach(p => g.lineTo(...p)); g.closePath(); }
  g.fillStyle = m.grass || '#a6dc7a'; g.fill(); g.lineWidth = Math.max(3, 0.9 * sc); g.strokeStyle = '#4f8e4a'; g.stroke(); g.clip();
  const line = (pts, width, col, dash) => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = to(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.lineWidth = width; g.strokeStyle = col; g.setLineDash(dash || []); g.lineCap = g.lineJoin = 'round'; g.stroke(); g.setLineDash([]); };
  if (m.river) line(m.river, (m.riverW || 3.2) * sc, '#7cc3e3');
  for (const r of m.rects || []) { const c = [[r.x - r.hw, r.z - r.hd], [r.x + r.hw, r.z - r.hd], [r.x + r.hw, r.z + r.hd], [r.x - r.hw, r.z + r.hd]].map(p => to(...p)); g.beginPath(); g.moveTo(...c[0]); c.slice(1).forEach(p => g.lineTo(...p)); g.closePath(); g.fillStyle = r.col; g.fill(); }
  for (const p of m.paths || []) { const locked = p.to && nodeState(p.to) === 'locked'; line(p.pts, Math.max(2, (p.w || 1.2) * sc), locked ? '#ffffff55' : '#f1e2c0', locked ? [4, 5] : null); }
  // 玩法互動點
  for (const it of MAP.items || []) { if (it.x == null) continue; const [x, y] = to(it.x, it.z), r = Math.max(3.5, 0.55 * sc); g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fillStyle = '#F5B731'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke(); }
  // 鄰居
  for (const [x0, z0] of m.dots ? m.dots() : []) { const [x, y] = to(x0, z0); g.beginPath(); g.arc(x, y, Math.max(2.5, 0.4 * sc), 0, 7); g.fillStyle = '#9C8BE0'; g.fill(); }
  g.restore();
  // 知識點
  const iconSize = v.full ? Math.max(20, Math.min(34, 1.6 * sc)) : Math.max(13, Math.min(20, 1.3 * sc));
  for (const n of MAP.nodes || []) { const st = nodeState(n.id), [x, y] = to(n.x, n.z);
    if (v.full) { ICON.draw(g, n.guardian && st !== 'locked' ? 'st-guardian' : STATE_ICON[st], x - iconSize / 2, y - iconSize / 2, iconSize); g.font = '900 12px "Noto Sans TC","PingFang TC",sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#fffaf3'; g.strokeText(n.name, x, y + iconSize / 2 + 12); g.fillStyle = '#4a3b52'; g.fillText(n.name, x, y + iconSize / 2 + 12); }
    else { const r = Math.max(4, (n.guardian ? 0.9 : 0.7) * sc); g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = STATE_COL[st]; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); if (levelOf(n.id) > 0 && st === 'mastered') { g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r * 0.35, 0, 7); g.fill(); } } }
  // 傳送拱門
  for (const p of MAP.portals || []) { const [x, y] = to(p.x, p.z), s = iconSize * 1.05, lk = p.locked && p.locked(); g.globalAlpha = lk ? 0.55 : 1; ICON.draw(g, lk ? 'st-locked' : p.icon || 'door', x - s / 2, y - s / 2, s); g.globalAlpha = 1;
    if (v.full && p.name) { g.font = '900 12px "Noto Sans TC","PingFang TC",sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#fffaf3'; g.strokeText(p.name, x, y + s / 2 + 12); g.fillStyle = '#6a4f7a'; g.fillText(p.name, x, y + s / 2 + 12); } }
  // 自己：粉紅色箭頭（朝著角色面對的方向）
  { const [x, y] = to(PL.x, PL.z), [x2, y2] = to(PL.x + Math.sin(PL.yaw), PL.z + Math.cos(PL.yaw)), a = Math.atan2(y2 - y, x2 - x), r = v.full ? 11 : 8;
    g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(r * 1.2, 0); g.lineTo(-r * 0.8, r * 0.8); g.lineTo(-r * 0.35, 0); g.lineTo(-r * 0.8, -r * 0.8); g.closePath(); g.fillStyle = '#F28CA0'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); g.restore(); }
  return P; }

// 大地圖：整張地圖放進畫面（北方朝上）
export function fitView(MAP, w, h, pad = 24) { const m = MAP.mini; if (!m) return { cx: 0, cz: 0, scale: 6, yaw: 0, full: true };
  const [x0, x1, z0, z1] = m.shape === 'circle' ? [m.cx - m.R, m.cx + m.R, m.cz - m.R, m.cz + m.R] : [m.x0, m.x1, m.z0, m.z1];
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, scale: Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (z1 - z0)), yaw: 0, full: true }; }

export function sizeCanvas(cv, w, h) { const dpr = Math.min(2, devicePixelRatio || 1); cv._dpr = dpr; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
