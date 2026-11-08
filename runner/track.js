// 賽道：封閉的 CatmullRom 曲線，每約 1 公尺取一個樣本（位置、切線、左向量、曲率）；
// nearest() 把任一點投影到賽道（最近樣本、沿線比例、橫向偏移），build() 做馬路、標線、人行道、路緣與起跑線。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { angleDiff, lerp } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();

export class Track {
  constructor(course) {
    this.course = course;
    const pts = course.points.map(([x, z, y = 0]) => new THREE.Vector3(x, y, z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    this.length = this.curve.getLength();
    const N = this.N = Math.round(this.length);
    const sp = this.curve.getSpacedPoints(N); sp.pop();
    this.pos = sp; this.tan = []; this.left = []; this.yaw = []; this.curv = [];
    for (let i = 0; i < N; i++) {
      const a = sp[(i - 1 + N) % N], b = sp[(i + 1) % N];
      const t = new THREE.Vector3().subVectors(b, a); t.y = 0; t.normalize();
      this.tan.push(t); this.left.push(new THREE.Vector3(t.z, 0, -t.x)); this.yaw.push(Math.atan2(t.x, t.z));
    }
    for (let i = 0; i < N; i++) this.curv.push(angleDiff(this.yaw[(i + 4) % N], this.yaw[(i - 4 + N) % N]) / 8); // 每公尺轉幾弧度（正＝往左彎）
    this.halfW = course.width / 2; this.sw = course.sidewalk || 2.4;
    this.limit = this.halfW + this.sw; // 再過去就是牆（房子）
  }
  wrap(i) { const N = this.N; return ((i % N) + N) % N; }
  idxAtT(t) { return this.wrap(Math.round(((t % 1) + 1) % 1 * this.N)); }
  // 把點投影到賽道：hint 是上一次的樣本（附近搜尋），沒有就全掃
  nearest(p, hint = null, out = {}) {
    const N = this.N; let best = -1, bd = Infinity;
    if (hint == null) { for (let i = 0; i < N; i++) { const q = this.pos[i], d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2; if (d < bd) { bd = d; best = i; } } }
    else { for (let k = -45; k <= 45; k++) { const i = this.wrap(hint + k), q = this.pos[i], d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2; if (d < bd) { bd = d; best = i; } } }
    const q = this.pos[best], t = this.tan[best];
    _d.set(p.x - q.x, 0, p.z - q.z);
    let along = _d.dot(t);
    if (along < 0) { // 其實比較靠近前一段
      const j = this.wrap(best - 1), qj = this.pos[j]; _d.set(p.x - qj.x, 0, p.z - qj.z); const a2 = _d.dot(this.tan[j]);
      if (a2 >= 0 && a2 <= 1.2) { best = j; along = a2; _d.set(p.x - qj.x, 0, p.z - qj.z); }
      else { along = 0; _d.set(p.x - q.x, 0, p.z - q.z); }
    }
    const frac = Math.max(0, Math.min(1, along));
    out.idx = best; out.frac = frac; out.lateral = _d.dot(this.left[best]);
    out.progress = best + frac;
    out.y = lerp(this.pos[best].y, this.pos[this.wrap(best + 1)].y, frac);
    out.yaw = this.yaw[best]; out.curv = this.curv[best];
    return out;
  }
  // 由樣本與橫向偏移算世界座標
  point(idx, lateral = 0, frac = 0, out = new THREE.Vector3()) {
    const i = this.wrap(Math.floor(idx)), j = this.wrap(i + 1), f = frac || idx - Math.floor(idx);
    out.copy(this.pos[i]).lerp(this.pos[j], f);
    out.addScaledVector(this.left[i], lateral);
    return out;
  }
  pointT(t, lateral = 0, out) { return this.point(((t % 1) + 1) % 1 * this.N, lateral, undefined, out); }
  // 擺設用的局部座標：ry 讓局部 +z 朝向馬路
  frame(idx, lateral) {
    const i = this.wrap(Math.round(idx)), p = this.point(i, lateral), l = this.left[i];
    const toRoad = lateral > 0 ? l.clone().negate() : l.clone();
    return { x: p.x, y: p.y, z: p.z, ry: Math.atan2(toRoad.x, toRoad.z), yaw: this.yaw[i], left: l };
  }
  frameT(t, lateral) { return this.frame(((t % 1) + 1) % 1 * this.N, lateral); }
  inRange(t, range) { if (!range) return false; if (typeof range === 'number') return Math.abs(angleDiff(t * Math.PI * 2, range * Math.PI * 2)) < 0.02 * Math.PI * 2; const [a, b] = range; return a <= b ? (t >= a && t <= b) : (t >= a || t <= b); }

  /* 帶狀幾何：從橫向 latA（高 yA）到 latB（高 yB），沿整條賽道。dash = { period, duty, offset } 可做虛線。
     range=[t0,t1] 只做一段。顏色隨機微變化讓柏油不那麼平。 */
  ribbon(latA, yA, latB, yB, color, o = {}) {
    const N = this.N, pos = [], nrm = [], col = [], idx = [];
    const c = new THREE.Color(color), ca = new THREE.Color(), cb = new THREE.Color();
    let v = 0;
    const seg = (i) => {
      if (o.range && !this.inRange(i / N, o.range)) return false;
      if (o.dash) { const ph = ((i + (o.dash.offset || 0)) % o.dash.period) / o.dash.period; if (ph > (o.dash.duty || 0.5)) return false; }
      return true;
    };
    for (let i = 0; i < N; i++) {
      if (!seg(i)) continue;
      const j = this.wrap(i + 1);
      const p0 = this.pos[i], p1 = this.pos[j], l0 = this.left[i], l1 = this.left[j];
      const a0 = [p0.x + l0.x * latA, p0.y + yA, p0.z + l0.z * latA], b0 = [p0.x + l0.x * latB, p0.y + yB, p0.z + l0.z * latB];
      const a1 = [p1.x + l1.x * latA, p1.y + yA, p1.z + l1.z * latA], b1 = [p1.x + l1.x * latB, p1.y + yB, p1.z + l1.z * latB];
      pos.push(...a0, ...b0, ...a1, ...b1);
      // 法線：由 (b0-a0) × (a1-a0)
      const e1 = new THREE.Vector3(b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]), e2 = new THREE.Vector3(a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]);
      const n = e2.cross(e1).normalize(); if (n.y < 0 && Math.abs(latA - latB) > 1e-6 && yA === yB) n.negate();
      if (latA === latB) { n.copy(this.left[i]); if (latA > 0) n.negate(); } // 垂直的路緣面朝向馬路
      for (let k = 0; k < 4; k++) nrm.push(n.x, n.y, n.z);
      const jit = o.noise ? (Math.sin(i * 12.9898) * 43758.5453 % 1) * o.noise : 0;
      ca.copy(c).offsetHSL(0, 0, jit);
      for (let k = 0; k < 4; k++) col.push(ca.r, ca.g, ca.b);
      // 兩個三角形：繞法讓法線朝上
      if (n.y >= 0 || latA === latB) idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3); else idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      v += 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
  }
  build() {
    const pal = this.course.pal, hw = this.halfW, sw = this.sw, geos = [];
    geos.push(this.ribbon(-hw, 0, hw, 0, pal.road, { noise: 0.025 }));
    geos.push(this.ribbon(-0.12, 0.012, 0.12, 0.012, pal.line, { dash: { period: 6, duty: 0.5 } }));           // 中線（虛）
    geos.push(this.ribbon(hw - 0.4, 0.012, hw - 0.25, 0.012, pal.edge));                                        // 邊線
    geos.push(this.ribbon(-hw + 0.25, 0.012, -hw + 0.4, 0.012, pal.edge));
    for (const s of [1, -1]) { // 人行道：立面（路緣）＋ 頂面
      const a = s * hw, b = s * (hw + sw);
      geos.push(this.ribbon(a, 0, a, 0.14, pal.curb));
      geos.push(this.ribbon(a, 0.14, b, 0.14, pal.sidewalk, { noise: 0.03 }));
      geos.push(this.ribbon(b, 0.14, s * (hw + sw + 0.6), 0.14, pal.curb)); // 房子前的一條
    }
    // 起跑線：黑白格
    const cols = 10, cw = (hw * 2) / cols;
    for (let r = 0; r < 2; r++) for (let k = 0; k < cols; k++) {
      const lat0 = -hw + k * cw, g = this.ribbon(lat0, 0.02, lat0 + cw, 0.02, (k + r) % 2 ? 0xf4f4f4 : 0x1a1a1a, { range: [(1 + r) / this.N, (2 + r) / this.N] });
      geos.push(g);
    }
    const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.receiveShadow = true;
    return mesh;
  }
  // 斑馬線（特定 t 的位置）
  crosswalk(t) {
    const geos = [], hw = this.halfW, n = 8, w = (hw * 2) / (n * 2);
    for (let k = 0; k < n; k++) geos.push(this.ribbon(-hw + (k * 2 + 0.5) * w, 0.015, -hw + (k * 2 + 1.5) * w, 0.015, 0xf2f2f2, { range: [t - 2 / this.N, t + 2 / this.N] }));
    const g = mergeGeometries(geos, false); geos.forEach(x => x.dispose()); return g;
  }
}
