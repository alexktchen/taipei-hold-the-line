// 共用工具：亂數、角度、招牌圖集、幾何合併器（整座城市合成少數幾個 mesh）
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
export function angleDiff(target, from) { let d = (target - from) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
export const damp = (cur, target, k, dt) => lerp(cur, target, 1 - Math.exp(-k * dt));

// mulberry32：同一個 seed 每次都產生一樣的城市
export function rng(seed) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => Math.floor(r.range(lo, hi + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}

export const FONT = '"Noto Sans TC","PingFang TC","Hiragino Sans","Microsoft JhengHei",system-ui,sans-serif';

/* 招牌圖集：一張 2048×1024 的畫布放所有招牌文字；橫招牌 256×128（上半 32 格）、直招牌 128×512（下半 16 格）。
   所有招牌共用一個材質，可以合併成一個 mesh。*/
export class SignAtlas {
  constructor() {
    this.W = 2048; this.H = 1024;
    const c = document.createElement('canvas'); c.width = this.W; c.height = this.H;
    this.ctx = c.getContext('2d');
    this.ctx.fillStyle = '#222'; this.ctx.fillRect(0, 0, this.W, this.H);
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.cache = new Map(); this.nh = 0; this.nv = 0;
  }
  _uv(x, y, w, h) { return [x / this.W, 1 - (y + h) / this.H, (x + w) / this.W, 1 - y / this.H]; }
  _hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // 圖案招牌（場景裡不放文字）：key 只拿來決定用哪種圖案
  _pattern(g, x, y, w, h, key, fg) {
    const k = this._hash(key), v = k % 6, cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.3;
    g.fillStyle = fg; g.strokeStyle = fg; g.lineWidth = Math.max(6, r * 0.35);
    if (v === 0) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }
    else if (v === 1) { for (let i = -1; i <= 1; i++) g.fillRect(cx + i * r * 0.9 - r * 0.22, cy - r, r * 0.44, r * 2); }
    else if (v === 2) { g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.fill(); }
    else if (v === 3) { g.fillRect(cx - r * 1.6, cy - r * 0.8, r * 3.2, r * 0.5); g.fillRect(cx - r * 1.6, cy + r * 0.3, r * 3.2, r * 0.5); }
    else if (v === 4) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, r * 0.35, 0, 7); g.fill(); }
    else { g.beginPath(); g.moveTo(cx - r, cy + r); g.lineTo(cx, cy - r); g.lineTo(cx + r, cy + r); g.closePath(); g.fill(); }
  }
  _arrow(g, x, y, w, h, dir, fg) {
    const cx = x + w / 2, cy = y + h / 2, L = w * 0.36, t = h * 0.14, hd = h * 0.3, d = dir === 'left' ? -1 : 1;
    g.fillStyle = fg; g.beginPath();
    g.moveTo(cx - d * L, cy - t); g.lineTo(cx + d * (L - hd), cy - t); g.lineTo(cx + d * (L - hd), cy - hd); g.lineTo(cx + d * L, cy); g.lineTo(cx + d * (L - hd), cy + hd); g.lineTo(cx + d * (L - hd), cy + t); g.lineTo(cx - d * L, cy + t); g.closePath(); g.fill();
  }
  h(key, bg = '#d9463b', fg = '#ffffff', opts = {}) {
    const ck = 'h|' + key + bg + fg + (opts.arrow || '');
    if (this.cache.has(ck)) return this.cache.get(ck);
    const i = this.nh++ % 32, x = (i % 8) * 256, y = Math.floor(i / 8) * 128, g = this.ctx;
    g.fillStyle = bg; g.fillRect(x, y, 256, 128);
    g.strokeStyle = opts.border || 'rgba(255,255,255,.55)'; g.lineWidth = 6; g.strokeRect(x + 6, y + 6, 244, 116);
    if (opts.arrow) this._arrow(g, x, y, 256, 128, opts.arrow, fg); else this._pattern(g, x, y, 256, 128, key, fg);
    const uv = this._uv(x, y, 256, 128); this.cache.set(ck, uv); this.tex.needsUpdate = true; return uv;
  }
  v(key, bg = '#d9463b', fg = '#ffffff') {
    const ck = 'v|' + key + bg + fg;
    if (this.cache.has(ck)) return this.cache.get(ck);
    const i = this.nv++ % 16, x = i * 128, y = 512, g = this.ctx;
    g.fillStyle = bg; g.fillRect(x, y, 128, 512);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6; g.strokeRect(x + 6, y + 6, 116, 500);
    const n = 3 + (this._hash(key) % 2); for (let k = 0; k < n; k++) this._pattern(g, x + 14, y + 30 + k * (452 / n), 100, 452 / n - 20, key + k, fg);
    const uv = this._uv(x, y, 128, 512); this.cache.set(ck, uv); this.tex.needsUpdate = true; return uv;
  }
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4();
const _c = new THREE.Color();
function colorize(geo, hex) {
  _c.set(hex);
  const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}
function strip(geo) { // 只留 position / normal / uv，合併時屬性才一致
  for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') geo.deleteAttribute(k);
  const n = geo.attributes.position.count;
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); // ribbon 沒有 uv，補零讓屬性一致
  if (!geo.attributes.normal) geo.computeVertexNormals();
  if (!geo.index) { const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; geo.setIndex(new THREE.BufferAttribute(idx, 1)); }
  return geo;
}

/* 幾何合併器：box / cyl / sphere / sign 累積到三個桶（受光、發光、招牌），build() 合成最多 3 個 mesh。
   push(x,y,z,ry) / pop() 可以設定局部座標，方便把一整棟房子朝向馬路。*/
export class Builder {
  constructor(atlas) {
    this.atlas = atlas || new SignAtlas();
    this.opq = []; this.lit = []; this.sgn = [];
    this.stack = []; this.cur = new THREE.Matrix4();
  }
  push(x, y, z, ry = 0) { this.stack.push(this.cur.clone()); _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s); this.cur.multiply(_m); }
  pop() { this.cur = this.stack.pop(); }
  _add(list, geo, color, x, y, z, o) {
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(o.rx || 0, o.ry || 0, o.rz || 0)), _s.set(o.sx || 1, o.sy || 1, o.sz || 1));
    _m.premultiply(this.cur); geo.applyMatrix4(_m); _s.set(1, 1, 1);
    colorize(strip(geo), color); list.push(geo); return geo;
  }
  box(w, h, d, x, y, z, color, o = {}) { return this._add(o.lit ? this.lit : this.opq, new THREE.BoxGeometry(w, h, d), color, x, y, z, o); }
  cyl(rt, rb, h, x, y, z, color, o = {}) { return this._add(o.lit ? this.lit : this.opq, new THREE.CylinderGeometry(rt, rb, h, o.seg || 10, 1, !!o.open), color, x, y, z, o); }
  cone(r, h, x, y, z, color, o = {}) { return this.cyl(0, r, h, x, y, z, color, o); }
  sphere(r, x, y, z, color, o = {}) { return this._add(o.lit ? this.lit : this.opq, new THREE.SphereGeometry(r, o.seg || 8, o.seg2 || 6), color, x, y, z, o); }
  // 招牌：一面貼圖的平面（局部 +z 朝外）。vertical=true 用直招牌格
  sign(text, w, h, x, y, z, bg, fg, o = {}) {
    const uv = o.vertical ? this.atlas.v(text, bg, fg) : this.atlas.h(text, bg, fg, o);
    const geo = new THREE.PlaneGeometry(w, h), a = geo.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, lerp(uv[0], uv[2], a.getX(i)), lerp(uv[1], uv[3], a.getY(i)));
    if (o.double) { // 兩面：再加一面反向
      const back = geo.clone(); back.rotateY(Math.PI); this._add(this.sgn, back, 0xffffff, x, y, z, o);
    }
    return this._add(this.sgn, geo, 0xffffff, x, y, z, o);
  }
  // 自訂幾何（例如 ribbon）
  raw(geo, color, lit = false) { colorize(strip(geo), color); (lit ? this.lit : this.opq).push(geo); }
  build(opts = {}) {
    const g = new THREE.Group();
    if (this.opq.length) {
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      if (opts.nearCull) { // 太靠近相機的東西（樹冠、招牌）直接不畫，免得擋住視線
        mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n\tif (length(vViewPosition) < ' + opts.nearCull.toFixed(2) + ') discard;'); };
      }
      const m = new THREE.Mesh(mergeGeometries(this.opq, false), mat);
      m.castShadow = opts.shadow !== false; m.receiveShadow = true; g.add(m); this.opq.forEach(x => x.dispose());
    }
    if (this.lit.length) {
      const m = new THREE.Mesh(mergeGeometries(this.lit, false), new THREE.MeshBasicMaterial({ vertexColors: true }));
      g.add(m); this.lit.forEach(x => x.dispose());
    }
    if (this.sgn.length) {
      const m = new THREE.Mesh(mergeGeometries(this.sgn, false), new THREE.MeshBasicMaterial({ map: this.atlas.tex }));
      g.add(m); this.sgn.forEach(x => x.dispose());
    }
    this.opq = []; this.lit = []; this.sgn = [];
    return g;
  }
}

// 文字 sprite（名牌、位次）
export function textSprite(text, { color = '#fff', bg = 'rgba(20,20,40,.7)', size = 44, w = 256, h = 72 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 24); g.fill();
  g.fillStyle = color; g.font = `900 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(w / 100, h / 100, 1); sp.renderOrder = 10;
  return sp;
}
