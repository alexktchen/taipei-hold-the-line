// 介面：道具圖示（inline SVG）、HUD 更新、小地圖、結果表
import { CFG } from './config.js';

export const ICONS = {
  boba: '<svg viewBox="0 0 48 48"><path d="M14 10h20l-3 30H17z" fill="#d9a066"/><path d="M16 22h16l-1.6 16H17.6z" fill="#a0683a"/><circle cx="20" cy="33" r="2.2" fill="#2a1a10"/><circle cx="26" cy="35" r="2.2" fill="#2a1a10"/><circle cx="23" cy="29" r="2.2" fill="#2a1a10"/><rect x="24" y="4" width="3" height="30" rx="1.5" fill="#ff5a3c"/><rect x="12" y="8" width="24" height="4" rx="2" fill="#fff"/></svg>',
  banana: '<svg viewBox="0 0 48 48"><path d="M10 14c2 14 12 24 28 24 2 0 4-1 4-3-10 0-20-8-26-23-1-2-6-1-6 2z" fill="#f5d442" stroke="#b58f1a" stroke-width="2"/><path d="M8 12l3-4" stroke="#6a4a1a" stroke-width="3" stroke-linecap="round"/></svg>',
  slipper: '<svg viewBox="0 0 48 48"><path d="M16 6c6 0 10 4 10 12 0 10-6 24-12 24S4 30 4 18C4 10 10 6 16 6z" fill="#fff" stroke="#3b7bd9" stroke-width="3"/><path d="M8 18c4-6 12-6 16 0" fill="none" stroke="#3b7bd9" stroke-width="4" stroke-linecap="round"/><path d="M30 10c6 0 10 4 10 12 0 10-6 24-12 24-2 0-4-1-5-3 4-4 8-14 8-22 0-4-1-7-3-9 1-1 1-2 2-2z" fill="#fff" stroke="#3b7bd9" stroke-width="3"/></svg>',
  charm: '<svg viewBox="0 0 48 48"><path d="M24 4l8 6v26l-8 8-8-8V10z" fill="#d9463b" stroke="#8a1a10" stroke-width="2"/><path d="M24 8v4M18 14h12M20 20h8M21 26h6M22 32h4" stroke="#ffd166" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="4" r="2.5" fill="#ffd166"/></svg>',
  cracker: '<svg viewBox="0 0 48 48"><rect x="18" y="14" width="12" height="28" rx="3" fill="#e0392b"/><rect x="18" y="22" width="12" height="4" fill="#ffd166"/><path d="M24 14V8" stroke="#6a4a1a" stroke-width="2"/><path d="M24 8l-4-4M24 8l4-4M24 8V2" stroke="#ffd166" stroke-width="2" stroke-linecap="round"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M22 9l-6 6M16 9l6 6"/></svg>',
};
const SUFFIX = ['', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'];
export const fmtTime = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };

export class HUD {
  constructor() {
    this.el = document.getElementById('hud'); this.$ = (id) => document.getElementById(id);
    this.lap = this.$('hudLap'); this.laps = this.$('hudLaps'); this.time = this.$('hudTime'); this.place = this.$('hudPlace'); this.suf = this.$('hudPlaceSuf'); this.placeBox = this.$('hudPlaceBox');
    this.dash = this.$('hudDash'); this.speed = this.$('hudSpeed'); this.item = this.$('hudItem'); this.center = this.$('center'); this.toastEl = this.$('toast');
    this.mini = this.$('mini'); this.mctx = this.mini.getContext('2d'); this.lastItem = undefined; this.lastPlace = 0; this.centerT = 0; this.toastT = 0;
  }
  show(on) { this.el.hidden = !on; }
  setTrack(track) {
    this.track = track; const xs = track.pos.map(p => p.x), zs = track.pos.map(p => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const W = this.mini.width, pad = 26, sc = Math.min((W - pad * 2) / (maxX - minX), (W - pad * 2) / (maxZ - minZ));
    this.mm = { sc, ox: W / 2 - (minX + maxX) / 2 * sc, oz: W / 2 - (minZ + maxZ) / 2 * sc };
    // 底圖畫一次
    const c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d');
    g.lineCap = 'round'; g.lineJoin = 'round';
    const path = () => { g.beginPath(); track.pos.forEach((p, i) => { const [x, y] = this.mp(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
    path(); g.strokeStyle = '#000a'; g.lineWidth = 14; g.stroke();
    path(); g.strokeStyle = '#d8d2ff'; g.lineWidth = 9; g.stroke();
    path(); g.strokeStyle = '#4a4a60'; g.lineWidth = 6; g.stroke();
    const s = track.pos[0], l = track.left[0]; const [ax, ay] = this.mp(s.x + l.x * 6, s.z + l.z * 6), [bx, by] = this.mp(s.x - l.x * 6, s.z - l.z * 6);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.strokeStyle = '#ffd166'; g.lineWidth = 4; g.stroke();
    this.base = c;
  }
  mp(x, z) { return [x * this.mm.sc + this.mm.ox, z * this.mm.sc + this.mm.oz]; }
  update(race, dt) {
    const p = race.player, laps = race.laps;
    this.lap.textContent = Math.min(laps, Math.max(1, p.lap)); this.laps.textContent = laps;
    this.time.textContent = fmtTime(race.raceTime);
    if (p.place !== this.lastPlace) { this.lastPlace = p.place; this.place.textContent = p.place; this.suf.textContent = SUFFIX[p.place] || 'th'; this.placeBox.classList.toggle('p1', p.place === 1); }
    this.dash.firstElementChild.style.transform = `scaleX(${p.dash.toFixed(3)})`; this.dash.classList.toggle('low', p.dash < 0.2);
    this.speed.textContent = Math.round(p.speed * 4.2);
    if (p.item !== this.lastItem) { this.lastItem = p.item; this.item.classList.toggle('has', !!p.item); this.item.querySelector('.ico').innerHTML = p.item ? ICONS[p.item] : ''; this.item.querySelector('b').textContent = p.item ? CFG.items[p.item].name : '道具'; }
    if (this.centerT > 0) { this.centerT -= dt; if (this.centerT <= 0) this.center.classList.remove('on'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toastEl.classList.remove('on'); }
    // 小地圖
    const g = this.mctx, W = this.mini.width; g.clearRect(0, 0, W, W); g.drawImage(this.base, 0, 0);
    for (const m of race.world.movers) { if (m.mesh.visible === false) continue; const [x, y] = this.mp(m.mesh.position.x, m.mesh.position.z); g.fillStyle = '#ff9a3c'; g.fillRect(x - 3, y - 3, 6, 6); }
    for (const r of race.racers) { if (r.isPlayer) continue; const [x, y] = this.mp(r.pos.x, r.pos.z); g.beginPath(); g.arc(x, y, 5, 0, 7); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke(); }
    { const [x, y] = this.mp(p.pos.x, p.pos.z); g.beginPath(); g.arc(x, y, 8, 0, 7); g.fillStyle = '#ffd166'; g.fill(); g.strokeStyle = '#3a1a10'; g.lineWidth = 2.5; g.stroke(); }
  }
  showCenter(text, dur = 1, warn = false) { this.center.textContent = text; this.center.classList.toggle('warn', warn); this.center.classList.remove('pop'); void this.center.offsetWidth; this.center.classList.add('on', 'pop'); this.centerT = dur; }
  hideCenter() { this.center.classList.remove('on'); this.centerT = 0; }
  toast(text, dur = 1.6) { this.toastEl.textContent = text; this.toastEl.classList.add('on'); this.toastT = dur; }
}

export function renderResults(race, course) {
  const body = document.getElementById('resBody'), st = race.standings(), me = race.player;
  document.getElementById('resTitle').innerHTML = me.place === 1 ? '第 <b>1</b> 名！冠軍！' : `第 <b>${me.place}</b> 名`;
  document.getElementById('resSub').textContent = `${course.name}・${race.laps} 圈・${fmtTime(me.finishTime || race.raceTime)}`;
  body.innerHTML = st.map((r, k) => `<tr class="${r.isPlayer ? 'me' : ''}"><td class="pl">${k + 1}</td><td>${r.name}<small>${r.def.job}</small></td><td class="t">${r.finished ? fmtTime(r.finishTime) : `第 ${Math.min(race.laps, Math.max(1, r.lap))} 圈 ${Math.round((r.prog / race.N) * 100)}%`}</td></tr>`).join('');
}
