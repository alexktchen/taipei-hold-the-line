/* 學習森林的 3D 地圖（積木風，和田園小場景共用材質與工具）：
   - trunk：森林主幹道（識字與詞語），從南邊的新手村往北一路往上爬，兩旁是各區域的入口，年級越高越後面、越高；
   - 每個區域一張獨立地圖：知識點是石碑，石板路照「先學會哪個才能學下一個」連起來；
     還沒打通的路沒有石板、石碑被樹叢圍住，學會前置知識點後石板一塊塊冒出來、樹叢消失。
   每張地圖回傳 { group, colliders, groundY, blocked, spawns, portals, nodes, update, refresh }，由 index.html 切換。 */
import { REGIONS, NODES, regionById, nodeById, subjectOf } from './content.js';
import { nodeState, regionOpen, regionNeeds, regionCount, levelOf, stars, STATE_ICON, dataNow, recordPass, speak, SLOW, nodeStats, regionStats, heatColor, pct } from './learn.js';
import * as ICON from './icons.js';
import * as GAMES from './games.js';

export function createForest(ctx) {
  const { THREE, G, Gc, Gl, merge, toon, addMesh, addInstanced, setRoot, curveDrop, TREE_GEO, CFG } = ctx, PL = ctx.player;
  const Bx = (w, h, d, x = 0, y = 0, z = 0, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z); // 小東西（花、小石子、草）用一般方塊就好，每個只有 12 個三角形
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler(), COL = new THREE.Color();
  const rng = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const distSeg = (px, pz, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1))); return Math.hypot(px - ax - vx * t, pz - az - vz * t); };
  const noise = (x, z) => Math.sin(x * 0.73 + Math.sin(z * 0.31) * 2.1) * Math.cos(z * 0.67 + Math.sin(x * 0.27) * 1.7);

  // ── 名牌：畫布文字做成 Sprite；每幀依地平線彎曲往下移，才會和彎過的地面對齊 ──
  // icon＝icons.js 的圖示名（區域、知識點狀態、玩法），程式畫在名牌左邊（不用圖片、不用 emoji）
  function drawLabel(cv, text, { bg = '#fffaf3', fg = '#4a3b52', icon = null } = {}) { const g = cv.getContext('2d'), font = '900 44px "Noto Sans TC","PingFang TC",sans-serif'; g.font = font; const iw = icon ? 64 : 0, w = Math.ceil(g.measureText(text).width) + 48 + iw; cv.width = w; cv.height = 72;
    g.font = font; g.fillStyle = bg; g.strokeStyle = '#4a3b5233'; g.lineWidth = 4; g.beginPath(); g.roundRect(2, 2, w - 4, 68, 34); g.fill(); g.stroke(); if (icon) ICON.draw(g, icon, 12, 6, 60);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, (w + iw) / 2, 38); return w; }
  function label(text, opt = {}) { const h = opt.h || 0.55, cv = document.createElement('canvas'), w = drawLabel(cv, text, opt);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false })); sp.scale.set(h * w / 72, h, 1); sp.renderOrder = 3; sp.userData.text = text; return sp; }
  function setLabel(sp, text, opt) { const n = label(text, opt); sp.material.map.dispose(); sp.material.map = n.material.map; sp.scale.copy(n.scale); sp.userData.text = text; }

  // ── 家長檢視：同一張地圖疊一層熱力圖。地上一圈顏色＝正確率（綠 85% 以上、黃 60～85%、粉紅 60% 以下、灰＝還沒作答），
  //    需要複習的知識點外面多一圈紫色、會呼吸的光環；圓圈順著地形（hFn）貼地，不會插進坡裡 ──
  let HEAT_TEX = null;
  const HEAT_BG = { '#8CC77E': '#e3f4dc', '#F5B731': '#fdf0c8', '#F28CA0': '#fde0e5', '#B3A8CC': '#efe9f2' };
  function heatDisc(x, z, rad, hFn, parent) { if (!HEAT_TEX) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      [[0, 0.9], [0.55, 0.72], [0.8, 0.45], [1, 0]].forEach(([t, a]) => gr.addColorStop(t, `rgba(255,255,255,${a})`)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); HEAT_TEX = new THREE.CanvasTexture(cv); }
    const conform = geo => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, hFn(x + p.getX(i), z + p.getZ(i)) + 0.07); return geo; };
    const mat = ctx.curvify(new THREE.MeshBasicMaterial({ map: HEAT_TEX, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    const disc = new THREE.Mesh(conform(new THREE.CircleGeometry(rad, 40, 0).rotateX(-Math.PI / 2)), mat); disc.position.set(x, 0, z); disc.renderOrder = 1; parent.add(disc);
    const ringMat = ctx.curvify(new THREE.MeshBasicMaterial({ color: 0x9c8be0, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
    const ring = new THREE.Mesh(conform(new THREE.RingGeometry(rad * 0.9, rad * 1.04, 48, 1).rotateX(-Math.PI / 2)), ringMat); ring.position.set(x, 0.01, z); ring.renderOrder = 2; parent.add(ring);
    return { disc, ring, paint(rate, due) { mat.color.set(heatColor(rate)); ring.visible = !!due; } }; }

  // ── 共用零件 ──
  function ground(size, seg, hFn, colFn) { const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, hFn(x, z)); colFn(x, z, c); col.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals(); return addMesh(geo, toon(0xffffff, { vertexColors: true }), ctx.ROOT(), { outline: false, cast: false }); }
  // 樹：沿用田園的積木樹形（闊葉、針葉），每張地圖一組 InstancedMesh
  function trees(list, leaf, pine, cast = true) { if (!list.length) return; const broad = list.filter(t => t.kind === 'broad'), pines = list.filter(t => t.kind !== 'broad');
    const tr = addInstanced(TREE_GEO.trunk, toon(CFG.pal.trunk), list.length, { cast }); list.forEach((t, i) => { M4.compose(V.set(t.x, t.y - 0.05, t.z), Q.setFromEuler(E.set(0, t.r, 0)), S.set(t.s, t.s * (t.kind === 'broad' ? 1 : 1.15), t.s)); tr.im.setMatrixAt(i, M4); });
    if (broad.length) { const b = addInstanced(TREE_GEO.broad, toon(0xffffff), broad.length, { cast }); broad.forEach((t, i) => { M4.compose(V.set(t.x, t.y - 0.05, t.z), Q.setFromEuler(E.set(0, t.r, 0)), S.setScalar(t.s)); b.im.setMatrixAt(i, M4); b.im.setColorAt(i, COL.setHex(leaf[i % leaf.length])); }); }
    if (pines.length) { const p = addInstanced(TREE_GEO.pine, toon(0xffffff), pines.length, { cast }); pines.forEach((t, i) => { M4.compose(V.set(t.x, t.y - 0.05, t.z), Q.setFromEuler(E.set(0, t.r, 0)), S.set(t.s, t.s * 1.15, t.s)); p.im.setMatrixAt(i, M4); p.im.setColorAt(i, COL.setHex(pine[i % pine.length])); }); } }
  // ── 邊界：一圈矮樹籬（積木灌木）＋後面兩排大樹，地圖走不出去的地方都看得到牆；pts＝沿著邊界每 0.8 格一點 {x,z,nx,nz}（nx,nz＝往外的方向）──
  const BUSH = merge([Gl(1.15, 0.85, 0.95, 0.26, 0, 0.42, 0), Gl(0.85, 0.72, 0.75, 0.22, 0.32, 0.8, 0.08), Gl(0.72, 0.62, 0.62, 0.2, -0.3, 0.74, -0.1)]);
  function border(pts, hFn, { leaf, pine, pineK = 0.4, hedge = [0x6fb85e, 0x7cc76a, 0x62a956], seed = 7, skip = null, low = null, treesOn = true } = {}) { const rr = rng(seed), base = pts.filter(p => !(skip && skip(p.x, p.z))), ok = [...base, ...base.filter(p => low && low(p)).map(p => ({ ...p, x: p.x + p.nx * 1.1, z: p.z + p.nz * 1.1, back: true }))]; // low：鏡頭那一側只種樹籬（兩排），不種大樹，才不會擋住畫面
    const b = addInstanced(BUSH, toon(0xffffff), Math.max(1, ok.length), { cast: false }); ok.forEach((p, i) => { const s = 1.0 + rr() * 0.4, x = p.x + p.nx * 0.35, z = p.z + p.nz * 0.35; M4.compose(V.set(x, hFn(x, z) - 0.08, z), Q.setFromEuler(E.set(0, Math.atan2(p.nx, p.nz) + (rr() - 0.5) * 0.8, 0)), S.set(s * 1.05, s * (0.85 + rr() * 0.35), s)); b.im.setMatrixAt(i, M4); b.im.setColorAt(i, COL.setHex(hedge[i % hedge.length])); });
    const tl = []; if (treesOn) base.forEach((p, i) => { if (low && low(p)) return; for (const row of [0]) { if (i % 3) continue; const off = 1.9 + rr() * 0.8, x = p.x + p.nx * off + (rr() - 0.5) * 0.5, z = p.z + p.nz * off + (rr() - 0.5) * 0.5; if (skip && skip(x, z)) continue; tl.push({ x, z, y: hFn(x, z), s: 1.0 + rr() * 0.55, r: rr() * 6.28, kind: rr() < pineK ? 'pine' : 'broad' }); } });
    trees(tl, leaf, pine, false); }
  const ringPts = (cx, cz, R) => { const n = Math.ceil(2 * Math.PI * R / 1.0); return Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2; return { x: cx + Math.cos(a) * R, z: cz + Math.sin(a) * R, nx: Math.cos(a), nz: Math.sin(a) }; }); };
  // ── 石板路：幾種不規則的圓角石板（擠出成厚片、圓倒角）＋路邊的小石子與草叢；每一種一組 InstancedMesh ──
  // list 的每一項 {kind, x, z, y, rot, sx, sy, sz, col}；layout(fnK) 依每一項的顯示比例（0～1）擺放，路一段段冒出來時用
  const FLAGS = [0, 1, 2, 3].map(seed => { const rr = rng(seed * 977 + 13), n = 7, P = []; for (let k = 0; k < n; k++) { const a = (k + (rr() - 0.5) * 0.45) / n * Math.PI * 2, d = 0.42 + rr() * 0.12; P.push([Math.cos(a) * d, Math.sin(a) * d]); }
    const sh = new THREE.Shape(), mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(P[n - 1], P[0]); sh.moveTo(m0[0], m0[1]); for (let k = 0; k < n; k++) { const m = mid(P[k], P[(k + 1) % n]); sh.quadraticCurveTo(P[k][0], P[k][1], m[0], m[1]); }
    return new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.05, bevelSegments: 1, curveSegments: 2 }).rotateX(-Math.PI / 2); });
  const DECO_GEO = { f0: FLAGS[0], f1: FLAGS[1], f2: FLAGS[2], f3: FLAGS[3], pb: Bx(0.15, 0.09, 0.12, 0, 0.04, 0), cb: Gl(0.36, 0.17, 0.3, 0.06, 0, 0.07, 0),
    tf: merge([[0, 0, 0.24], [0.07, 0.5, 0.2], [-0.07, -0.5, 0.18], [0.02, 1.2, 0.15]].map(([x, rz, h]) => Bx(0.05, h, 0.04, x, h / 2, 0).rotateZ(rz * 0.5))) };
  const STONE_COL = [0xeee6d8, 0xe2d8c8, 0xd8d0e0, 0xe9dfcd, 0xd6ccbc], PEBBLE_COL = [0xc4bad0, 0xd9cebb, 0xb3a99e, 0xe0d6c6], TUFT_COL = [0x6fb85e, 0x7cc76a, 0x8fd36f];
  const flagKind = () => 'f' + Math.floor(Math.random() * 4);
  function pathDeco(list) { const groups = {}; for (const d of list) (groups[d.kind] ||= []).push(d);
    const ims = Object.entries(groups).map(([kind, arr]) => { const im = addInstanced(DECO_GEO[kind], toon(0xffffff), arr.length, { cast: false, outline: kind[0] === 'f' || kind === 'cb' }).im; arr.forEach((d, i) => im.setColorAt(i, COL.setHex(d.col))); return { im, arr }; });
    const layout = (fk = () => 1) => { for (const { im, arr } of ims) { arr.forEach((d, i) => { const k = fk(d) + 1e-4; M4.compose(V.set(d.x, d.y, d.z), Q.setFromEuler(E.set(0, d.rot, 0)), S.set(d.sx * k, (d.sy || 1) * k, d.sz * k)); im.setMatrixAt(i, M4); }); im.instanceMatrix.needsUpdate = true; } };
    layout(); return { layout }; }
  // 沿著一條路（一串點）鋪：踏腳石左右交錯、偶爾一顆小石板、路邊小石子和草叢
  function stepStones(pts, hFn, { width = 1, extra = {}, skip = null } = {}) { const out = [], rr = rng(Math.round(pts[0].x * 31 + pts[0].z * 17) + 99);
    for (let k = 1; k < pts.length - 1; k++) { const p = pts[k], a = pts[k - 1], b = pts[k + 1], tx = b.x - a.x, tz = b.z - a.z, tl = Math.hypot(tx, tz) || 1, nx = -tz / tl, nz = tx / tl, yaw = Math.atan2(tx, tz), side = k % 2 ? 1 : -1;
      const put = (kind, lat, along, o) => { const x = p.x + nx * lat + tx / tl * along, z = p.z + nz * lat + tz / tl * along; if (skip && skip(x, z)) return; out.push({ kind, x, z, y: hFn(x, z) + (o.dy || 0), ...o, ...extra, k: k / pts.length }); };
      put(flagKind(), side * 0.17 * width + (rr() - 0.5) * 0.08, 0, { rot: yaw + (rr() - 0.5) * 0.7, sx: (0.62 + rr() * 0.16) * width, sz: 0.5 + rr() * 0.12, col: STONE_COL[(k * 7 + Math.floor(rr() * 5)) % 5], dy: 0.01 });
      if (rr() < 0.35) put(flagKind(), -side * 0.42 * width, (rr() - 0.5) * 0.2, { rot: rr() * 6.28, sx: 0.3 + rr() * 0.08, sz: 0.26 + rr() * 0.06, col: STONE_COL[Math.floor(rr() * 5)] });
      if (rr() < 0.5) put('pb', (rr() < 0.5 ? -1 : 1) * (0.62 + rr() * 0.3) * width, (rr() - 0.5) * 0.4, { rot: rr() * 6.28, sx: 0.8 + rr() * 0.6, sy: 0.8 + rr() * 0.5, sz: 0.8 + rr() * 0.6, col: PEBBLE_COL[Math.floor(rr() * 4)] });
      if (rr() < 0.45) put('tf', (rr() < 0.5 ? -1 : 1) * (0.6 + rr() * 0.4) * width, (rr() - 0.5) * 0.4, { rot: rr() * 6.28, sx: 1, sy: 0.8 + rr() * 0.6, sz: 1, col: TUFT_COL[Math.floor(rr() * 3)] }); }
    return out; }
  // 拱門（入口）：兩根方柱＋橫樑＋招牌；locked 時中間多兩片木柵
  function arch(x, z, y, yaw, color, sign, icon = null) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = yaw; ctx.ROOT().add(g);
    for (const sx of [-1, 1]) { addMesh(Gc(0.36, 2.6, 0.36, 0.06, sx * 1.3, 1.3, 0), toon(color), g); addMesh(Gc(0.5, 0.18, 0.5, 0.05, sx * 1.3, 2.68, 0), toon(0x9a6b48), g); }
    addMesh(Gc(3.3, 0.3, 0.42, 0.08, 0, 2.55, 0), toon(0x9a6b48), g); addMesh(Gc(1.9, 0.62, 0.12, 0.05, 0, 2.0, 0.22), toon(0xfff1dc), g);
    const bars = new THREE.Group(); g.add(bars); for (let k = -2; k <= 2; k++) addMesh(Gc(0.12, 1.5, 0.12, 0.03, k * 0.48, 0.75, 0), toon(0xb07a55), bars); addMesh(Gc(2.4, 0.12, 0.12, 0.03, 0, 1.1, 0), toon(0xb07a55), bars); addMesh(Gc(2.4, 0.12, 0.12, 0.03, 0, 0.4, 0), toon(0xb07a55), bars);
    const lab = label(sign, { icon }); lab.position.set(0, 3.35, 0); g.add(lab); return { g, bars, lab }; }
  // 小房子、石頭、花圃、城牆、書塔：各區域的主題擺設
  const PROPS = {
    hut(x, z, y, r, col) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = r; ctx.ROOT().add(g); addMesh(Gc(2.2, 1.5, 1.9, 0.08, 0, 0.75, 0), toon(0xfff1dc), g); [2.3, 1.6, 0.9].forEach((d, i) => addMesh(Gc(2.5, 0.32, d, 0.06, 0, 1.66 + i * 0.32, 0), toon(i % 2 ? col : new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.2).getHex()), g)); addMesh(Gc(0.5, 0.85, 0.1, 0.03, 0, 0.43, 0.96), toon(0x9a6b48), g); addMesh(Gc(0.42, 0.4, 0.08, 0.03, 0.62, 0.95, 0.96), toon(0xffd27a), g); return 1.4; },
    rock(x, z, y, r, col) { const s = 0.8 + (r % 1) * 1.4; addMesh(Gc(1.2 * s, 0.9 * s, 1.0 * s, 0.18 * s, 0, 0.35 * s, 0, r), toon(col), ctx.ROOT()).position.set(x, y, z); return 0.65 * s; },
    bed(x, z, y, r, col) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = r; ctx.ROOT().add(g); addMesh(Gc(2.0, 0.25, 1.1, 0.06, 0, 0.12, 0), toon(0x9a6b48), g); const fl = [0xffb3c7, 0xfff3a8, 0xd8c2ff, 0xffc9a0, 0xffffff]; for (let k = 0; k < 8; k++) addMesh(Gc(0.2, 0.2, 0.2, 0.05, -0.75 + (k % 4) * 0.5, 0.36, k < 4 ? -0.25 : 0.25), toon(fl[(k + Math.round(r * 3)) % 5]), g, { outline: false }); return 1.1; },
    wall(x, z, y, r, col) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = r; ctx.ROOT().add(g); addMesh(Gc(3.2, 1.6, 0.7, 0.06, 0, 0.8, 0), toon(col), g); for (let k = -1; k <= 1; k++) addMesh(Gc(0.6, 0.4, 0.72, 0.05, k * 1.2, 1.8, 0), toon(col), g); return 1.7; },
    lantern(x, z, y, r, col) { const g = new THREE.Group(); g.position.set(x, y, z); ctx.ROOT().add(g); addMesh(Gc(0.14, 1.6, 0.14, 0.03, 0, 0.8, 0), toon(0x6a4e36), g); addMesh(Gc(0.42, 0.5, 0.42, 0.1, 0, 1.75, 0), toon(0xe8705c, { emissive: 0xff8a5c, emissiveIntensity: 0.4 }), g); return 0.3; },
    cubes(x, z, y, r, col) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = r; ctx.ROOT().add(g); const cs = [0xf28ca0, 0xf5b731, 0x8cc77e, 0x7cc3e3, 0x9c8be0]; let k = Math.round(r * 7);
      for (const [cx, cy, cz] of [[-0.5, 0.4, 0], [0.4, 0.4, 0.1], [-0.05, 1.2, 0.05], [0.9, 0.4, -0.7]]) addMesh(Gc(0.8, 0.8, 0.8, 0.12, cx, cy, cz), toon(cs[k++ % 5]), g); return 1.2; }, // 數學森林：彩色積木
    solids(x, z, y, r, col) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = r; ctx.ROOT().add(g); const k = Math.floor(r * 10) % 3;
      if (k === 0) addMesh(new THREE.ConeGeometry(0.7, 1.4, 4).rotateY(Math.PI / 4).translate(0, 0.7, 0), toon(0xf5b731), g); else if (k === 1) addMesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 16).translate(0, 0.55, 0), toon(0x7cc3e3), g); else addMesh(new THREE.ConeGeometry(0.6, 1.3, 16).translate(0, 0.65, 0), toon(0xf28ca0), g);
      addMesh(Gc(1.4, 0.12, 1.4, 0.05, 0, 0.0, 0), toon(0xd9cfc0), g); return 0.8; }, // 數學森林：立體圖形（角錐、圓柱、圓錐）
    books(x, z, y, r, col) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = r; ctx.ROOT().add(g); const cs = [0xe8705c, 0x8fb6ec, 0xf2d27a, 0x8fd3a0, 0xc9b8f0]; for (let k = 0; k < 4; k++) addMesh(Gc(1.0 - k * 0.06, 0.22, 0.75, 0.04, (k % 2) * 0.06, 0.11 + k * 0.22, 0, k * 0.2), toon(cs[k % 5]), g); return 0.7; },
  };
  const THEMES = {
    village: { grass: [0xa6dc7a, 0x94cf6c], leaf: [0x8fd36f, 0xa8de7e], pine: [0x5fae84, 0x6fbf8f], props: ['hut', 'hut', 'hut', 'bed', 'rock'], slope: 0.02, trees: 35, pineK: 0.3 },
    woods: { grass: [0x86c46a, 0x76b45c], leaf: [0x6fbf5e, 0x7cc76a, 0x5fae52], pine: [0x4f9e7a, 0x5fae84], props: ['rock', 'books'], slope: 0.03, trees: 70, pineK: 0.55 },
    valley: { grass: [0xb8d68a, 0xc9c08e], leaf: [0x9ccf6a, 0xb5d77a], pine: [0x6fae84], props: ['rock', 'rock', 'rock', 'rock', 'books'], slope: 0.02, trees: 30, pineK: 0.4, bowl: true },
    river: { grass: [0x9fd87a, 0x8fcf6e], leaf: [0x8fd36f, 0x9ccf6a], pine: [0x5fae84], props: ['rock', 'bed'], slope: 0.02, trees: 35, pineK: 0.3, river: true },
    garden: { grass: [0xaee68a, 0x9ad97c], leaf: [0xf2b5c6, 0x9ccf6a, 0xf6c9d4], pine: [0x6fbf8f], props: ['bed', 'bed', 'bed', 'bed', 'lantern'], slope: 0.02, trees: 30, pineK: 0.15 },
    city: { grass: [0xc9d69a, 0xb7cc8a], leaf: [0x9ccf6a], pine: [0x5fae84, 0x4f9e7a], props: ['wall', 'wall', 'lantern', 'lantern', 'hut'], slope: 0.02, trees: 25, pineK: 0.6 },
    mcount: { grass: [0xb2e08a, 0x9fd37a], leaf: [0x8fd36f, 0xa8de7e], pine: [0x6fbf8f], props: ['cubes', 'cubes', 'hut', 'bed'], slope: 0.02, trees: 30, pineK: 0.25 }, // 數學森林的區域
    mcalc: { grass: [0x9fd88a, 0x8cc77e], leaf: [0x7cc76a, 0x8fd36f], pine: [0x5fae84], props: ['cubes', 'rock', 'books'], slope: 0.03, trees: 50, pineK: 0.5 },
    mmul: { grass: [0xc3dc8e, 0xb5d089], leaf: [0x9ccf6a, 0xb5d77a], pine: [0x6fae84], props: ['cubes', 'rock', 'rock', 'solids'], slope: 0.02, trees: 30, pineK: 0.4, bowl: true },
    mshape: { grass: [0xb6e696, 0xa2da84], leaf: [0xf2b5c6, 0x9ccf6a], pine: [0x6fbf8f], props: ['solids', 'solids', 'solids', 'bed'], slope: 0.02, trees: 30, pineK: 0.2 },
    mfrac: { grass: [0xa6dc84, 0x95d078], leaf: [0x8fd36f, 0x9ccf6a], pine: [0x5fae84], props: ['cubes', 'bed', 'rock'], slope: 0.02, trees: 35, pineK: 0.3, river: true },
    mbig: { grass: [0xcbd89c, 0xbccf8e], leaf: [0x9ccf6a], pine: [0x5fae84, 0x4f9e7a], props: ['wall', 'lantern', 'cubes', 'hut'], slope: 0.02, trees: 25, pineK: 0.6 },
    mratio: { grass: [0xaed6a0, 0xbfdcab], leaf: [0x8fd36f], pine: [0x5fae84, 0x6fbf8f], props: ['solids', 'books', 'cubes'], slope: 0.06, trees: 40, pineK: 0.7 },
    tower: { grass: [0xa9d09a, 0xbad6a6], leaf: [0x8fd36f], pine: [0x5fae84, 0x6fbf8f, 0x4f9e7a], props: ['books', 'books', 'rock'], slope: 0.07, trees: 40, pineK: 0.7 },
  };

  // ── 森林變茂盛：一片野花，學得越多開得越多（還沒開的花縮成 0，開的時候一朵朵長出來）──
  function bloomField(pts, palette) { const n = Math.max(1, pts.length), petal = addInstanced(merge([0, 1, 2, 3].map(k => Bx(0.15, 0.05, 0.15, Math.cos(k * Math.PI / 2) * 0.1, 0.3, Math.sin(k * Math.PI / 2) * 0.1))), toon(0xffffff), n, { outline: false, cast: false });
    const core = addInstanced(merge([Bx(0.03, 0.3, 0.03, 0, 0.15, 0), Bx(0.09, 0.08, 0.09, 0, 0.32, 0), Bx(0.16, 0.04, 0.08, 0.07, 0.12, 0, 0.5)]), toon(0x7cc76a), n, { outline: false, cast: false });
    pts.forEach((p, i) => petal.im.setColorAt(i, COL.setHex(palette[i % palette.length]))); const k = new Float32Array(n), M = new THREE.Matrix4(); let want = 0, dirty = true;
    const write = () => { pts.forEach((p, i) => { M.compose(V.set(p.x, p.y, p.z), Q.setFromEuler(E.set(0, p.r, 0)), S.setScalar(p.s * k[i] + 1e-4)); petal.im.setMatrixAt(i, M); core.im.setMatrixAt(i, M); }); petal.im.instanceMatrix.needsUpdate = core.im.instanceMatrix.needsUpdate = true; };
    write(); return { set(ratio) { want = Math.round(pts.length * Math.min(1, Math.max(0, ratio))); dirty = true; }, now: () => want / Math.max(1, pts.length),
      update(dt) { if (!dirty) return; let moving = false; for (let i = 0; i < pts.length; i++) { const t = i < want ? 1 : 0; if (k[i] !== t) { k[i] = t > k[i] ? Math.min(t, k[i] + dt * (1.2 + (i % 7) * 0.15)) : Math.max(t, k[i] - dt * 2); moving = true; } } if (moving) write(); else dirty = false; } }; }

  // ── 區域地圖 ──
  function buildRegion(rid) {
    const R = regionById(rid), CH = subjectOf(rid) === 'chinese', TRUNK = CH ? 'trunk' : 'mtrunk', T = THEMES[R.theme], r = rng(rid.length * 7919 + rid.charCodeAt(0)), group = new THREE.Group(); setRoot(group);
    const colliders = [], RAD = 25, ENTRY = [0, 19];
    // 知識點位置：graph.json 的 position；沒寫的照前後關係自動分層（越後面越北、越高）
    const ns = NODES.filter(n => n.region === rid), depth = {}; const dep = n => depth[n.id] ??= Math.max(0, ...n.pre.map(p => { const pn = ns.find(x => x.id === p); return pn ? dep(pn) + 1 : 0; }));
    ns.forEach(dep); const layers = {}; ns.forEach(n => (layers[depth[n.id]] ||= []).push(n)); const L = Object.keys(layers).length;
    const pos = {}; Object.entries(layers).forEach(([d, arr]) => arr.forEach((n, i) => { const span = Math.min(18, arr.length * 7.5); pos[n.id] = n.position || [arr.length === 1 ? 0 : -span / 2 + span * i / (arr.length - 1), 11 - d * Math.min(9, 26 / Math.max(1, L - 1 + 0.6))]; }));
    // 石板路＝DAG 的邊：區域內的前置 → 這個知識點，用 CatmullRomCurve3 彎彎地連起來；前置在別的區域（或沒有）就從入口接過來；守護者從區域最後的知識點接過去
    const leaves = ns.filter(n => !n.guardian && !ns.some(m => !m.guardian && m.pre.includes(n.id))).map(n => n.id);
    const edges = []; for (const n of ns) { const inner = n.guardian ? leaves : n.pre.filter(p => pos[p]); if (!inner.length) edges.push({ a: ENTRY, b: pos[n.id], to: n.id, from: null }); else for (const p of inner) edges.push({ a: pos[p], b: pos[n.id], to: n.id, from: p }); }
    for (const e of edges) { const [ax, az] = e.a, [bx, bz] = e.b, len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len, off = (r() - 0.5) * Math.min(3, len * 0.25);
      e.curve = new THREE.CatmullRomCurve3([new THREE.Vector3(ax, 0, az), new THREE.Vector3((ax + bx) / 2 + nx * off, 0, (az + bz) / 2 + nz * off), new THREE.Vector3(bx, 0, bz)]); e.len = e.curve.getLength(); e.pts = e.curve.getSpacedPoints(Math.max(4, Math.ceil(e.len / 0.6))); }
    const segs = edges.flatMap(e => e.pts.slice(1).map((p, i) => [e.pts[i].x, e.pts[i].z, p.x, p.z]));
    const pathD = (x, z) => { let d = Math.hypot(x - ENTRY[0], z - ENTRY[1]) - 1; for (const s of segs) d = Math.min(d, distSeg(x, z, s[0], s[1], s[2], s[3])); return d; };
    const riverZ = 3.2, river = T.river; const inRiver = (x, z) => river && Math.abs(z - riverZ - Math.sin(x * 0.25) * 1.2) < 1.6;
    const H = (x, z) => { let h = -z * T.slope + 0.18 * noise(x * 0.6, z * 0.6); if (T.bowl) h += smooth(14, 26, Math.hypot(x, z)) * 2.2; h = THREE.MathUtils.lerp(h, -z * T.slope, 1 - smooth(1.2, 3, pathD(x, z)));
      for (const id in pos) h = THREE.MathUtils.lerp(h, -pos[id][1] * T.slope, 1 - smooth(2.2, 4, Math.hypot(x - pos[id][0], z - pos[id][1])));
      if (river) h = THREE.MathUtils.lerp(h, -0.7 - z * T.slope, 1 - smooth(1.1, 2.0, Math.abs(z - riverZ - Math.sin(x * 0.25) * 1.2))); return h; };
    ground(80, 90, H, (x, z, c) => { const n = noise(x * 1.3, z * 1.3) * 0.5 + 0.5; c.setHex(T.grass[0]).lerp(new THREE.Color(T.grass[1]), n); const pd = pathD(x, z); if (pd < 1.1) c.lerp(new THREE.Color(0xe2c79a), 0.5 * (1 - smooth(0.5, 1.1, pd))); if (river && inRiver(x, z)) c.setHex(0xf4e3b8); });
    // 水（句子河橋）：一條彎彎的河，石板路過河的地方有木橋
    const bridges = [];
    if (river) { const geo = new THREE.PlaneGeometry(80, 3.2, 80, 1).rotateX(-Math.PI / 2), p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + riverZ + Math.sin(p.getX(i) * 0.25) * 1.2); geo.computeVertexNormals();
      const wm = addMesh(geo, toon(0x7fd4dc, { emissive: 0x2a6f80, emissiveIntensity: 0.15 }), group, { outline: false, cast: false }); wm.position.y = -0.38;
      for (const e of edges) { const k = e.pts.findIndex(p => inRiver(p.x, p.z)); if (k < 0) continue; const p = e.pts[k], t = e.curve.getTangentAt(k / (e.pts.length - 1)); if (!bridges.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 3)) bridges.push({ x: p.x, z: riverZ + Math.sin(p.x * 0.25) * 1.2, yaw: Math.atan2(t.x, t.z) }); }
      for (const b of bridges) { const g = new THREE.Group(); g.position.set(b.x, -b.z * T.slope - 0.05, b.z); g.rotation.y = b.yaw; group.add(g); for (let k = -4; k <= 4; k++) addMesh(Gc(1.8, 0.12, 0.42, 0.03, 0, 0.12 + Math.cos(k / 4 * Math.PI / 2) * 0.25, k * 0.46), toon(k % 2 ? 0xc99a6a : 0xd6a977), g); for (const sx of [-1, 1]) addMesh(Gc(0.1, 0.1, 4.2, 0.03, sx * 0.9, 0.62, 0), toon(0x9a6b48), g); } }
    const onBridge = (x, z) => bridges.some(b => { const dx = x - b.x, dz = z - b.z, c = Math.cos(b.yaw), s = Math.sin(b.yaw), along = dx * s + dz * c, across = dx * c - dz * s; return Math.abs(along) < 2.3 && Math.abs(across) < 1.0; });
    const groundY = (x, z) => onBridge(x, z) ? -z * T.slope + 0.3 : H(x, z);
    const blocked = (x, z) => Math.hypot(x, z) > RAD || (river && inRiver(x, z) && !onBridge(x, z));
    // ── 知識點：石座＋石碑＋頂上一株小植物；四種狀態各有樣子 ──
    // 迷霧封鎖＝霧氣團＋纏在石碑上的藤蔓；可挑戰＝旁邊一支發光、上下浮動的路標；已精通＝植物開花、頭上 1～3 顆星；需要澆水＝葉子轉黃、花謝了
    const starGeo = (() => { const s = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? 0.07 : 0.17; k ? s.lineTo(Math.cos(a) * rr, -Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, -Math.sin(a) * rr); } s.closePath(); return new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }).translate(0, 0, -0.03); })();
    const ACCENT = { village: 0xf2928a, woods: 0xffd27a, valley: 0xc9b8f0, river: 0x8fd3f0, garden: 0xffb3c7, city: 0xf6c06a, tower: 0xd8c2ff, mcount: 0xf28ca0, mcalc: 0xf5b731, mmul: 0x9c8be0, mshape: 0x8cc77e, mfrac: 0x7cc3e3, mbig: 0xf6c06a, mratio: 0xd8c2ff }[R.theme] || 0xffd27a;
    const nodes = ns.map(n => { const [x, z] = pos[n.id], y = H(x, z), g = new THREE.Group(); g.position.set(x, y, z); group.add(g);
      addMesh(Gc(1.5, 0.3, 1.5, 0.08, 0, 0.15, 0), toon(0xc9c2d6), g); addMesh(Gc(1.05, 1.35, 0.36, 0.08, 0, 0.95, 0), toon(0xf3eee6), g);
      const leafMat = ctx.curvify(new THREE.MeshToonMaterial({ color: 0x7cc76a, gradientMap: ctx.GRADIENT })), plant = new THREE.Group(); plant.position.y = 1.62; g.add(plant);
      if (n.guardian) for (let k = 0; k < 5; k++) addMesh(Gc(0.16, k % 2 ? 0.24 : 0.4, 0.16, 0.04, -0.4 + k * 0.2, 0.12, 0), toon(0xf2c14e, { emissive: 0xf2a020, emissiveIntensity: 0.25 }), plant, { outline: false }); // 守護者：金色王冠
      else { addMesh(Gc(0.08, 0.34, 0.08, 0.02, 0, 0.17, 0), toon(0x6fae52), plant); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; addMesh(Gc(0.34, 0.12, 0.2, 0.05, Math.cos(a) * 0.17, 0.3 + k * 0.05, Math.sin(a) * 0.17, -a), leafMat, plant); } }
      const flowers = new THREE.Group(); g.add(flowers); [[0, 2.08, 0], [-0.62, 0.36, 0.62], [0.62, 0.36, 0.62], [-0.62, 0.36, -0.62], [0.62, 0.36, -0.62]].forEach(([fx, fy, fz], k) => { const f = new THREE.Group(); f.position.set(fx, fy, fz); flowers.add(f);
        for (let q = 0; q < 4; q++) addMesh(Gc(0.12, 0.07, 0.12, 0.03, Math.cos(q * Math.PI / 2) * 0.09, 0, Math.sin(q * Math.PI / 2) * 0.09), toon(k ? [ACCENT, 0xffffff, 0xfff3a8, 0xffb3c7][k - 1] : ACCENT), f, { outline: false }); addMesh(Gc(0.09, 0.08, 0.09, 0.03, 0, 0.02, 0), toon(0xffd84a), f, { outline: false }); });
      const starG = new THREE.Group(); starG.position.y = 2.75; g.add(starG); const starList = [-0.42, 0, 0.42].map(sx => { const m = addMesh(starGeo, toon(0xffd166, { emissive: 0xffb84a, emissiveIntensity: 0.35 }), starG, { outline: false }); m.position.x = sx; return m; });
      const signMat = ctx.curvify(new THREE.MeshToonMaterial({ color: 0xffc85a, gradientMap: ctx.GRADIENT, emissive: 0xffb030, emissiveIntensity: 0.5 })), sign = new THREE.Group(); sign.position.set(1.15, 0, 0.75); g.add(sign);
      addMesh(Gc(0.1, 1.05, 0.1, 0.03, 0, 0.52, 0), toon(0x9a6b48), sign); addMesh(Gc(0.62, 0.24, 0.08, 0.04, -0.12, 0.92, 0), signMat, sign); addMesh(Gc(0.2, 0.2, 0.08, 0.03).rotateZ(Math.PI / 4).translate(-0.46, 0.92, 0), signMat, sign); // 路標的箭頭
      const fogMat = new THREE.MeshToonMaterial({ color: 0xece4f4, gradientMap: ctx.GRADIENT, transparent: true, opacity: 0.6, depthWrite: false }); ctx.curvify(fogMat); const fog = new THREE.Group(); g.add(fog);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + r(), d = 0.7 + r() * 0.9, s = 0.75 + r() * 0.6, m = addMesh(G(s, s * 0.7, s, s * 0.3), fogMat, fog, { outline: false, cast: false }); m.position.set(Math.cos(a) * d, 0.5 + r() * 1.9, Math.sin(a) * d); m.userData.a = a; m.userData.d = d; }
      for (const [vx, vz, rz] of [[-0.3, 0.19, 0.35], [0.25, 0.19, -0.4], [0.05, -0.19, 0.5], [-0.2, -0.19, -0.3]]) { const v = addMesh(Gc(0.07, 1.3, 0.05, 0.02, 0, 0, 0), toon(0x4f8f45), fog, { outline: false }); v.position.set(vx, 0.95, vz); v.rotation.z = rz; addMesh(Gc(0.14, 0.08, 0.1, 0.03), toon(0x6fae52), v, { outline: false }).position.set(0.05, 0.3, 0); } // 藤蔓
      if (n.guardian) g.scale.setScalar(1.3);
      const lab = label(n.name); lab.userData.base = y + (n.guardian ? 4.2 : 3.35); lab.position.set(x, lab.userData.base, z); group.add(lab);
      colliders.push({ x, z, r: 0.8 * (n.guardian ? 1.3 : 1) });
      return { id: n.id, name: n.name, guardian: !!n.guardian, x, z, g, plant, leafMat, flowers, starG, starList, sign, signMat, fog, fogMat, lab, state: null, level: -1, fogK: 1, bloomK: 0 }; });
    // 石板（沿著曲線鋪，一條路的石板只在它通往的知識點打開後出現）
    const near = (x, z, id) => { const p = pos[id]; return p && Math.hypot(x - p[0], z - p[1]) < 1.45 * (nodeById(id).guardian ? 1.3 : 1); };
    const stones = edges.flatMap(e => stepStones(e.curve.getSpacedPoints(Math.max(2, Math.round(e.len / 0.82))), H, { extra: { to: e.to }, skip: (x, z) => near(x, z, e.to) || (e.from && near(x, z, e.from)) || (river && inRiver(x, z)) }));
    const st = pathDeco(stones);
    // 入口拱門（回主幹道）
    const ent = arch(ENTRY[0], ENTRY[1] + 2.2, H(ENTRY[0], ENTRY[1] + 2.2), 0, 0xc99a6a, CH ? '森林主幹道' : '數學主幹道', 'back'); colliders.push({ x: ENTRY[0] - 1.3, z: ENTRY[1] + 2.2, r: 0.35 }, { x: ENTRY[0] + 1.3, z: ENTRY[1] + 2.2, r: 0.35 }); ent.bars.visible = false;
    const title = label(`${R.name}（${R.grades}）`, { bg: '#f09a8a', fg: '#fff', h: 0.7, icon: R.img }); title.userData.base = H(0, 15) + 3.2; title.position.set(0, title.userData.base, 15); group.add(title);
    // 樹與主題擺設（避開石板路、石碑、河）
    const free = (x, z, pad) => pathD(x, z) > 1.8 + pad && !(river && Math.abs(z - riverZ - Math.sin(x * 0.25) * 1.2) < 2.2 + pad) && Object.values(pos).every(([px, pz]) => Math.hypot(x - px, z - pz) > 3.4 + pad) && Math.hypot(x - ENTRY[0], z - ENTRY[1]) > 3 + pad && !colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + pad + 0.5);
    T.props.forEach((kind, i) => { for (let k = 0; k < 40; k++) { const a = r() * Math.PI * 2, d = 6 + r() * 15, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 1.4)) continue; const rad = PROPS[kind](x, z, H(x, z), r() * 6.28, [0xf2928a, 0x8fb6ec, 0xf2d27a, 0xb9b0c2, 0xd8c9a0][i % 5]); colliders.push({ x, z, r: rad }); break; } });
    if (R.theme === 'tower') { const g = new THREE.Group(); const tz = -20, ty = H(0, tz); g.position.set(0, ty, tz); group.add(g); const cs = [0xe8705c, 0x8fb6ec, 0xf2d27a, 0x8fd3a0, 0xc9b8f0, 0xf2b5c6]; for (let k = 0; k < 9; k++) addMesh(Gc(3.2 - k * 0.18, 0.7, 2.4 - k * 0.12, 0.08, (k % 2) * 0.15, 0.35 + k * 0.7, 0, k * 0.12), toon(cs[k % 6]), g); colliders.push({ x: 0, z: tz, r: 1.9 }); }
    // ── 各區玩法的擺設與互動點（items：{ x, z, r, text(), act() }，index.html 靠近時顯示提示、按空白鍵觸發）──
    const items = [], fx = []; // fx：每幀要動的東西
    const spot = ([x0, z0], pad = 1) => { for (let k = 0; k < 200; k++) { const a = r() * Math.PI * 2, d = k * 0.08, x = x0 + Math.cos(a) * d, z = z0 + Math.sin(a) * d; if (Math.hypot(x, z) < RAD - 2 && free(x, z, pad - 1.8 + 0.6)) return [x, z]; } return [x0, z0]; };
    const floatLab = (text, x, z, h, opt) => { const l = label(text, opt); l.userData.base = H(x, z) + h; l.userData.x = x; l.userData.z = z; l.position.set(x, l.userData.base, z); group.add(l); fx.push(() => { l.position.y = l.userData.base - curveDrop(l.userData.x, l.userData.z); }); return l; };
    if (CH && R.theme === 'village') { // 拼音煮湯鍋
      const [px, pz] = spot([7.5, 14.5], 1.6), g = new THREE.Group(); g.position.set(px, H(px, pz), pz); group.add(g);
      for (const [lx, lz] of [[-0.45, -0.35], [0.45, -0.35], [0, 0.5]]) addMesh(Gc(0.13, 0.5, 0.13, 0.03, lx, 0.25, lz), toon(0x4a3b52), g);
      addMesh(Gc(1.35, 0.85, 1.35, 0.32, 0, 0.88, 0), toon(0x5a4a66), g); addMesh(Gc(1.12, 0.08, 1.12, 0.03, 0, 1.3, 0), toon(0xf2c46a), g, { outline: false });
      const fire = [0, 1, 2, 3].map(k => addMesh(Gc(0.22, 0.3, 0.22, 0.06, Math.cos(k * 1.6) * 0.3, 0.15, Math.sin(k * 1.6) * 0.3), toon(0xff9a4a, { emissive: 0xff7a2a, emissiveIntensity: 0.8 }), g, { outline: false, cast: false }));
      const steam = [0, 1, 2, 3, 4].map(k => { const m = new THREE.Mesh(G(0.3, 0.3, 0.3, 0.1), ctx.curvify(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }))); m.frustumCulled = false; m.userData.t = k / 5; g.add(m); return m; });
      fx.push((dt, time) => { fire.forEach((f, k) => f.scale.y = 0.8 + Math.sin(time * 9 + k * 2) * 0.25); steam.forEach(m => { m.userData.t = (m.userData.t + dt * 0.35) % 1; const t = m.userData.t; m.position.set(Math.sin(t * 7) * 0.2, 1.4 + t * 1.6, 0); m.scale.setScalar(0.5 + t); m.material.opacity = 0.6 * (1 - t); }); });
      colliders.push({ x: px, z: pz, r: 0.95 }); floatLab('拼音煮湯鍋', px, pz, 2.6, { icon: 'pot' });
      items.push({ x: px, z: pz, r: 2.1, text: () => `pot|按空白鍵煮注音湯（拼出食材的注音）・收集了 ${GAMES.itemCount()} 樣`, act: () => GAMES.soup() });
    }
    if (CH && R.theme === 'woods') { // 招牌＋夜晚的錯字小怪
      const signs = GAMES.games().typo.signs, boards = [];
      edges.slice(0, 5).forEach((e, k) => { if (boards.length >= 4) return; const p = e.curve.getPointAt(0.5), t = e.curve.getTangentAt(0.5), side = k % 2 ? 1 : -1, [bx, bz] = spot([p.x - t.z * 2.4 * side, p.z + t.x * 2.4 * side], 0.8);
        const g = new THREE.Group(); g.position.set(bx, H(bx, bz), bz); g.rotation.y = Math.atan2(-bx, 19 - bz); // 招牌面向入口 group.add(g); for (const sx of [-0.7, 0.7]) addMesh(Gc(0.12, 1.4, 0.12, 0.03, sx, 0.7, 0), toon(0x9a6b48), g); addMesh(Gc(1.9, 0.75, 0.12, 0.05, 0, 1.25, 0), toon(0xd9b58a), g);
        const mon = new THREE.Group(); mon.position.set(1.3, 0, 0.6); g.add(mon); addMesh(Gc(0.7, 0.62, 0.6, 0.25, 0, 0.4, 0), toon(0x9a6fd0, { emissive: 0x5a2f9a, emissiveIntensity: 0.25 }), mon); for (const ex of [-0.15, 0.15]) { addMesh(Gc(0.16, 0.16, 0.05, 0.05, ex, 0.5, 0.3), toon(0xffffff), mon, { outline: false }); addMesh(Gc(0.07, 0.07, 0.03, 0.02, ex, 0.49, 0.33), toon(0x2a1a3a), mon, { outline: false }); } for (const hx of [-0.2, 0.2]) addMesh(Gc(0.08, 0.18, 0.08, 0.03, hx, 0.78, 0), toon(0xffd166), mon, { outline: false });
        colliders.push({ x: bx, z: bz, r: 0.6 }); const lab = floatLab('', bx, bz, 2.25, { h: 0.6 }); boards.push({ x: bx, z: bz, g, mon, lab, sign: signs[(k + Math.floor(r() * signs.length)) % signs.length], fixed: false, shown: null }); });
      let wasNight = false;
      fx.push((dt, time) => { const night = ctx.night() > 0.55; if (night && !wasNight) boards.forEach((b, k) => { b.fixed = false; b.sign = signs[Math.floor(Math.random() * signs.length)]; }); wasNight = night;
        for (const b of boards) { const monOn = night && !b.fixed; b.mon.visible = monOn; if (monOn) { b.mon.position.y = Math.abs(Math.sin(time * 3 + b.x)) * 0.25; b.mon.rotation.y = Math.sin(time * 1.5 + b.z) * 0.6; }
          const txt = monOn ? b.sign.wrong : b.sign.right; if (b.shown !== txt) { b.shown = txt; setLabel(b.lab, txt, monOn ? { bg: '#f3e2ff', fg: '#6a3fa0', h: 0.6 } : { bg: '#fff1dc', h: 0.6 }); } } });
      for (const b of boards) items.push({ x: b.x, z: b.z, r: 2.2, text: () => ctx.night() > 0.55 ? (b.fixed ? 'sparkle|這塊招牌已經修好了' : `monster|錯字小怪把招牌改錯了！按空白鍵收服牠（已收服 ${GAMES.gameState().monsters} 隻）`) : `moon|招牌：「${b.sign.right}」・錯字小怪晚上才會出現（可以把左上的時間調到晚上）`,
        act: () => { if (ctx.night() > 0.55 && !b.fixed) GAMES.typo(b.sign, () => { b.fixed = true; }); } });
    }
    if (CH && R.theme === 'valley') { // 部首部落：族長是鄰居，幫迷路的字找到自己的部落
      const T2 = GAMES.games().tribes, D = dataNow(), chiefs = [], N = T2.radicals.length;
      T2.radicals.forEach(([rad, variant, name], k) => { const th = -2.5 + 5 * k / (N - 1), [cx, cz] = spot([Math.sin(th) * 15, -Math.cos(th) * 15], 1.4);
        const ch = ctx.makeChar({ colors: { shirt: [0xf2928a, 0x8fb6ec, 0xf2d27a, 0x8fd3a0, 0xc9b8f0, 0xffb347, 0x7fc6d6, 0xd8b07a][k], pants: 0x5d6f9e, hat: [0xe8705c, 0x6f8fc8, 0xd9a83a, 0x5faa7a, 0x9a7ad0, 0xe08a2a, 0x4fa6b8, 0xb08a4a][k], hair: [0x3a2a24, 0x5a3b2e, 0x2a2a2a, 0xb5653a][k % 4] }, accessories: [['hairShort', 'cap'], ['hairBob', 'beret'], ['hairSpiky', 'headband'], ['hairBun', 'strawhat'], ['hairShort', 'scarf'], ['hairBob', 'earsBear'], ['hairSpiky', 'cap'], ['hairShort', 'glasses']][k], face: 'happy' });
        ch.root.position.set(cx, H(cx, cz), cz); ch.root.rotation.y = Math.atan2(-cx, -cz); group.add(ch.root);
        const pole = new THREE.Group(); pole.position.set(cx + 0.9, H(cx, cz), cz); group.add(pole); addMesh(Gc(0.1, 2.2, 0.1, 0.03, 0, 1.1, 0), toon(0x9a6b48), pole); addMesh(Gc(0.8, 0.55, 0.06, 0.03, 0.4, 1.9, 0), toon(0xfff1dc), pole, { outline: false });
        colliders.push({ x: cx, z: cz, r: 0.5 }, { x: cx + 0.9, z: cz, r: 0.2 }); const lab = floatLab(`${variant} ${name}`, cx + 0.4, cz, 2.8, { bg: '#fff3c4', h: 0.6 });
        chiefs.push({ rad, variant, name, x: cx, z: cz, ch, lab, members: [] }); });
      const lost = []; let carry = null;
      const spawn = () => { const pool = [...T2.chars].filter(c => !lost.some(l => l.c === c)); for (let k = 0; k < 5; k++) { const c = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], [lx, lz] = spot([(Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18 + 2], 0.6); const sp = label(c, { bg: '#ffffff', h: 0.75 }); group.add(sp); lost.push({ c, x: lx, z: lz, sp, ph: Math.random() * 6, home: [lx, lz] }); } };
      spawn();
      fx.push((dt, time) => { for (const c of chiefs) c.ch.update(dt, 0); const P = PL();
        for (const l of lost) { if (l === carry) { l.x = P.x; l.z = P.z; l.sp.position.set(P.x, groundY(P.x, P.z) - curveDrop(P.x, P.z) + 2.25 + Math.sin(time * 4) * 0.05, P.z); continue; }
          if (l.done) { l.sp.position.y = H(l.x, l.z) + 1.2 - curveDrop(l.x, l.z); continue; } l.ph += dt; l.x = l.home[0] + Math.sin(l.ph * 0.5) * 0.8; l.z = l.home[1] + Math.cos(l.ph * 0.4) * 0.8; l.sp.position.set(l.x, H(l.x, l.z) + 0.9 + Math.abs(Math.sin(l.ph * 3)) * 0.25 - curveDrop(l.x, l.z), l.z); } });
      items.push({ x: 0, z: 0, r: 0, dyn: () => { const P = PL(), out = [];
        if (!carry) for (const l of lost) if (!l.done && Math.hypot(l.x - P.x, l.z - P.z) < 1.5) out.push({ d: Math.hypot(l.x - P.x, l.z - P.z), text: () => `package|迷路的字「${l.c}」：按空白鍵帶它去找部落`, act: () => { carry = l; speak(l.c, SLOW); } });
        for (const c of chiefs) { const d = Math.hypot(c.x - P.x, c.z - P.z); if (d > 2.2) continue;
          out.push({ d, text: () => carry ? `flag|按空白鍵把「${carry.c}」交給${c.name}的族長` : `flag|${c.variant} ${c.name}族長：「我們部落的字都有『${c.variant}』。已經找回 ${c.members.length} 個字！」`,
            act: () => { if (!carry) return; const l = carry; if (D.ch(l.c).r === c.rad) { carry = null; l.done = true; c.members.push(l.c); const a = c.members.length * 0.9; l.x = c.x + Math.cos(a) * 1.3; l.z = c.z + Math.sin(a) * 1.3 + 0.8; speak(`${l.c}，${c.name}`, 0.75); ctx.banner(`star|「${l.c}」回到${c.name}了！`);
                if (lost.every(x => x.done)) { const res = recordPass(T2.node, 5, 5); GAMES.gameState().tribes++; dispatchEvent(new CustomEvent('forest', { detail: { type: 'game', name: 'tribes' } })); ctx.talk(`trophy|迷路的字都回家了！${res ? '也算「部首」的練習。' : ''}又有新的字迷路了⋯⋯`); lost.forEach(x => setTimeout(() => { group.remove(x.sp); }, 1500)); setTimeout(() => { lost.length = 0; spawn(); }, 1600); } }
              else ctx.talk(`flag|${c.name}族長：「嗯⋯⋯「${l.c}」不是我們部落的字喔。看看它的部首是什麼？」`); } }); }
        return out; } });
    }
    if (CH && R.theme === 'garden') { // 修辭花圃：答對種出對應的花
      const FL = GAMES.games().flowers, beds = [];
      for (let k = 0; k < 12; k++) { const side = k < 6 ? -1 : 1, j = k % 6, [bx, bz] = spot([side * (7 + (j % 3) * 2.2), 13 + Math.floor(j / 3) * 2.4], 0.4);
        const g = new THREE.Group(); g.position.set(bx, H(bx, bz), bz); group.add(g); addMesh(Gc(1.3, 0.22, 1.3, 0.06, 0, 0.11, 0), toon(0x9a6b48), g, { outline: false }); addMesh(Gc(1.1, 0.06, 1.1, 0.03, 0, 0.24, 0), toon(0x6a4a34), g, { outline: false });
        const plant = new THREE.Group(); plant.position.y = 0.26; g.add(plant); colliders.push({ x: bx, z: bz, r: 0.6 }); beds.push({ k, x: bx, z: bz, g, plant, type: null }); }
      const petals = (p, cols, y, s = 1) => { for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI * 2; addMesh(Gc(0.22 * s, 0.08 * s, 0.22 * s, 0.05 * s, Math.cos(a) * 0.17 * s, y, Math.sin(a) * 0.17 * s), toon(cols[q % cols.length]), p, { outline: false }); } addMesh(Gc(0.16 * s, 0.12 * s, 0.16 * s, 0.05 * s, 0, y + 0.02, 0), toon(0xffd84a), p, { outline: false }); };
      const stem = (p, h, x = 0, z = 0) => { addMesh(Gc(0.06, h, 0.06, 0.02, x, h / 2, z), toon(0x5faa52), p, { outline: false }); addMesh(Gc(0.22, 0.06, 0.12, 0.03, x + 0.1, h * 0.45, z, 0.4), toon(0x7cc76a), p, { outline: false }); };
      const grow = (b, type) => { b.type = type; const p = b.plant; while (p.children.length) p.remove(p.children[0]);
        if (type === 'piyu') { stem(p, 0.7); petals(p, [0xff8fb0, 0x8fb6ec], 0.74); } // 雙色花
        else if (type === 'niren') { stem(p, 0.7); petals(p, [0xffd166], 0.74, 1.15); const f = new THREE.Group(); f.position.set(0, 0.8, 0.1); p.add(f); for (const ex of [-0.05, 0.05]) addMesh(Gc(0.035, 0.05, 0.02, 0.01, ex, 0.02, 0), toon(0x3b2c44), f, { outline: false }); addMesh(Gc(0.09, 0.025, 0.02, 0.01, 0, -0.03, 0), toon(0xe8705c), f, { outline: false }); } // 笑臉花
        else if (type === 'kuashi') { stem(p, 1.4); p.children.forEach(m => m.scale.set(2, 1, 2)); petals(p, [0xff6f91, 0xffb3c7], 1.45, 2.4); } // 超大花
        else if (type === 'paibi') for (const sx of [-0.3, 0, 0.3]) { stem(p, 0.55, sx); const q = new THREE.Group(); q.position.x = sx; p.add(q); petals(q, [0xc9b8f0], 0.58, 0.8); } // 三連花
        else if (type === 'shewen') { for (const [x, y] of [[0, 0.15], [0, 0.35], [0, 0.55], [0.08, 0.72], [0.2, 0.8], [0.32, 0.72], [0.36, 0.58]]) addMesh(Gc(0.08, 0.12, 0.08, 0.03, x, y, 0), toon(0x5faa52), p, { outline: false }); const q = new THREE.Group(); q.position.set(0.36, 0, 0); p.add(q); petals(q, [0xffa94d], 0.46, 0.8); } // 問號花
        else if (type === 'yingchen') { stem(p, 0.7); petals(p, [0x2f2a36, 0xffffff], 0.74); } // 黑白花
        p.scale.setScalar(0.01); b.pop = 1; };
      for (const f of GAMES.gameState().flowers) { const b = beds.find(x => x.k === f.slot); if (b) { grow(b, f.type); b.pop = 0; b.plant.scale.setScalar(1); } }
      fx.push((dt, time) => { for (const b of beds) { if (b.pop) { b.pop = Math.max(0, b.pop - dt * 1.2); b.plant.scale.setScalar(1 + Math.sin((1 - b.pop) * Math.PI) * 0.15 - b.pop * 0.99 + 0.0); } if (b.type) b.plant.rotation.z = Math.sin(time * 1.4 + b.x) * 0.05; } });
      floatLab('修辭花圃', -9.2, 12.5, 1.8, { bg: '#ffe3ec', h: 0.6, icon: 'rg-xiuci' }); floatLab('修辭花圃', 9.2, 12.5, 1.8, { bg: '#ffe3ec', h: 0.6, icon: 'rg-xiuci' });
      for (const b of beds) items.push({ x: b.x, z: b.z, r: 1.4, text: () => b.type ? `flower|${FL[b.type].name}（${nodeById(b.type).name}）：${FL[b.type].tip}` : 'seed|按空白鍵種一朵修辭花（答對修辭題就會開花）', act: () => { if (!b.type) GAMES.flower(b.k, type => grow(b, type)); } });
    }
    if (CH && R.theme === 'city') { // 石碑典故＋城門
      const gates = GAMES.games().stories.gates, spots = [[-13, 7], [13, 4], [-12, -11]];
      gates.forEach((gt, k) => { const [gx, gz] = spot(spots[k % spots.length], 2.2), yaw = Math.atan2(-gx, -gz), a = arch(gx, gz, H(gx, gz), yaw, 0xb8a07a, `${gt.title}門`, 'rg-chengyu'); colliders.push({ x: gx - Math.cos(yaw) * 1.3, z: gz + Math.sin(yaw) * 1.3, r: 0.35 }, { x: gx + Math.cos(yaw) * 1.3, z: gz - Math.sin(yaw) * 1.3, r: 0.35 });
        a.bars.visible = false; const doors = [-1, 1].map(sx => { const d = new THREE.Group(); d.position.set(sx * 1.15, 0, 0); a.g.add(d); addMesh(Gc(1.1, 2.0, 0.14, 0.04, -sx * 0.55, 1.0, 0), toon(0x9a3b2a), d); addMesh(Gc(0.12, 0.12, 0.05, 0.03, -sx * 0.95, 1.0, 0.1), toon(0xf2c14e), d, { outline: false }); return d; });
        const chest = new THREE.Group(); chest.position.set(0, 0, -1.4); a.g.add(chest); addMesh(Gc(0.7, 0.45, 0.5, 0.06, 0, 0.23, 0), toon(0xb07a3a), chest); addMesh(Gc(0.74, 0.16, 0.54, 0.05, 0, 0.5, 0), toon(0xd99a3a), chest); addMesh(Gc(0.12, 0.14, 0.04, 0.02, 0, 0.36, 0.26), toon(0xf2c14e), chest, { outline: false });
        const block = { x: gx, z: gz, r: 1.0 }; const [tx, tz] = [gx + Math.cos(yaw) * 2.6, gz - Math.sin(yaw) * 2.6]; const tab = new THREE.Group(); tab.position.set(tx, H(tx, tz), tz); tab.rotation.y = yaw; group.add(tab); addMesh(Gc(0.9, 1.2, 0.25, 0.06, 0, 0.6, 0), toon(0xc9c2d6), tab); addMesh(Gc(1.1, 0.18, 0.4, 0.05, 0, 0.09, 0), toon(0xb0a8c0), tab);
        colliders.push({ x: tx, z: tz, r: 0.5 }); floatLab(gt.title, tx, tz, 1.75, { h: 0.5, icon: 'scroll' });
        const st = { open: !!GAMES.gameState().gates[gt.id], k: GAMES.gameState().gates[gt.id] ? 1 : 0 }; if (!st.open) colliders.push(block);
        fx.push(dt => { const want = st.open ? 1 : 0; if (st.k !== want) st.k = Math.min(1, st.k + dt * 0.8); doors.forEach((d, i) => { d.rotation.y = (i ? -1 : 1) * st.k * 1.6; }); chest.visible = st.k > 0.5; });
        items.push({ x: tx, z: tz, r: 1.8, text: () => st.open ? `rg-chengyu|${gt.title}門已經打開了，按空白鍵可以再讀一次故事` : `scroll|按空白鍵閱讀石碑「${gt.title}」，答對問題打開城門`, act: () => GAMES.story(gt, () => { if (!st.open) { st.open = true; const i = colliders.indexOf(block); if (i >= 0) colliders.splice(i, 1); ctx.banner(`key|${gt.title}門打開了！`); } }) }); });
    }
    if (CH && R.theme === 'tower') { // 鄰居信箱＋字精靈
      const [mx, mz] = spot([6, 15.5], 1.0), mb = new THREE.Group(); mb.position.set(mx, H(mx, mz), mz); mb.rotation.y = -0.6; group.add(mb); addMesh(Gc(0.14, 1.1, 0.14, 0.03, 0, 0.55, 0), toon(0x9a6b48), mb); addMesh(Gc(0.5, 0.42, 0.7, 0.12, 0, 1.25, 0), toon(0xe8705c), mb); const flag = addMesh(Gc(0.05, 0.3, 0.16, 0.02, 0.28, 1.45, 0.1), toon(0xffd166), mb, { outline: false });
      colliders.push({ x: mx, z: mz, r: 0.45 }); floatLab('鄰居信箱', mx, mz, 2.0, { h: 0.5, icon: 'letter' });
      const [sx, sz] = spot([-3.5, 13], 1.0), sp = new THREE.Group(); group.add(sp); const body = addMesh(G(0.6, 0.6, 0.6, 0.2), toon(0xd8c2ff, { emissive: 0xa080ff, emissiveIntensity: 0.45 }), sp); for (const ex of [-0.12, 0.12]) addMesh(Gc(0.08, 0.1, 0.03, 0.02, ex, 0.04, 0.3), toon(0x3b2c44), body, { outline: false }); addMesh(Gc(0.12, 0.03, 0.03, 0.01, 0, -0.1, 0.3), toon(0xe8705c), body, { outline: false });
      for (const wx of [-1, 1]) { const w = addMesh(Gc(0.4, 0.04, 0.25, 0.02, wx * 0.45, 0.1, -0.05), toon(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.3 }), sp, { outline: false }); w.userData.wx = wx; }
      const slab = floatLab('字精靈', sx, sz, 2.4, { bg: '#efe4ff', h: 0.5, icon: 'spirit' }); colliders.push({ x: sx, z: sz, r: 0.4 });
      fx.push((dt, time) => { const unread = GAMES.games().letters.list.some(l => !GAMES.gameState().letters[l.id]); flag.rotation.z = unread ? 0 : -1.4; sp.position.set(sx, H(sx, sz) + 1.2 + Math.sin(time * 2) * 0.15 - curveDrop(sx, sz), sz); sp.rotation.y = time * 0.7; sp.children.forEach(c => { if (c.userData.wx) c.rotation.z = c.userData.wx * Math.sin(time * 12) * 0.4; }); });
      items.push({ x: mx, z: mz, r: 1.7, text: () => { const n = GAMES.games().letters.list.filter(l => !GAMES.gameState().letters[l.id]).length; return n ? `letter|有 ${n} 封鄰居的來信！按空白鍵讀信、回信` : 'letter|信都回完了，按空白鍵再讀一封'; }, act: () => GAMES.letter() });
      items.push({ x: sx, z: sz, r: 1.8, text: () => 'spirit|字精靈：「我會依句子換衣服，猜猜我怎麼念？」按空白鍵玩多音字', act: () => GAMES.spirit() });
    }
    const tl = []; for (let k = 0; k < T.trees * 30 && tl.length < T.trees; k++) { const edge = k % 3 === 0, a = r() * Math.PI * 2, d = edge ? RAD + 0.5 + r() * 9 : 4 + r() * 21, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!edge && !free(x, z, 0.3)) continue; if (edge && z / d > 0.45) continue; const s = 0.85 + r() * 0.6; tl.push({ x, z, y: H(x, z), s, r: r() * 6.28, kind: r() < T.pineK ? 'pine' : 'broad' }); if (d < RAD + 1) colliders.push({ x, z, r: 0.42 * s }); }
    trees(tl, T.leaf, T.pine);
    border(ringPts(0, 0, RAD + 0.4), H, { leaf: T.leaf, pine: T.pine, pineK: Math.max(0.35, T.pineK), seed: rid.length * 131, skip: river ? (x, z) => inRiver(x, z) : null, low: p => p.nz > 0.45 }); // 邊界：樹籬＋大樹圍一圈
    const bpts = []; for (let k = 0; k < 2400 && bpts.length < 170; k++) { const a = r() * Math.PI * 2, d = 3 + Math.sqrt(r()) * 21, x = Math.cos(a) * d, z = Math.sin(a) * d; if (pathD(x, z) < 0.9 || (river && inRiver(x, z)) || colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 0.3) || Object.values(pos).some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.6)) continue; bpts.push({ x, y: H(x, z), z, r: r() * 6.28, s: 0.8 + r() * 0.6 }); }
    const bloom = bloomField(bpts, [ACCENT, 0xffffff, 0xfff3a8, 0xffb3c7, 0xd8c2ff]);
    const lushNow = () => { const [have, all] = regionCount(rid); return (have + (levelOf('guard-' + rid) > 0 ? 1 : 0)) / (all + 1); }; // 這一區的茂盛程度（守護者也算一份）
    setRoot(null);
    // ── 依學習進度更新（熟練度與上次練習時間在 learn.js / localStorage）──
    const BG = { mastered: '#dff7e6', review: '#fdecc8', open: '#fff3c4', locked: '#efe9f2' };
    let revealT = 0; const revealFrom = new Map();
    function refresh() { for (const n of nodes) { const s = nodeState(n.id), lv = levelOf(n.id); if (s === n.state && lv === n.level) continue; const was = n.state; n.state = s; n.level = lv;
        setLabel(n.lab, n.name + (s === 'mastered' || s === 'review' ? ' ' + stars(lv) : '') + (s === 'review' ? '・要澆水' : ''), { bg: BG[s], fg: s === 'locked' ? '#8a7a92' : '#4a3b52', icon: n.guardian && s !== 'locked' ? STATE_ICON.guardian : STATE_ICON[s], h: n.guardian ? 0.7 : 0.55 });
        n.leafMat.color.setHex(s === 'review' ? 0xe0b84a : s === 'locked' ? 0x9aa58f : 0x7cc76a); // 需要澆水：葉子轉黃
        n.starList.forEach((m, i) => { m.visible = i < lv && s !== 'locked'; m.material = toon(s === 'review' ? 0xd9c79a : 0xffd166, s === 'review' ? {} : { emissive: 0xffb84a, emissiveIntensity: 0.35 }); });
        n.sign.visible = s === 'open';
        if (s === 'locked') { n.fog.visible = true; n.fogK = 1; } else if (was === 'locked') { revealFrom.set(n.id, revealT); } else if (was === null) { n.fog.visible = false; n.fogK = 0; } // 剛打通：霧氣散開、石板一塊塊冒出來
        const bloom = s === 'mastered' ? 1 : 0; if (was === null) n.bloomK = bloom; n.bloomTo = bloom; }
      layoutStones(); bloom.set(lushNow()); if (parentOn) paintHeat(); }
    // 家長檢視：每個知識點腳下的熱力圈＋另一塊名牌（正確率、答對幾題、待複習幾天了）
    let heat = null, parentOn = false;
    function paintHeat() { for (const n of nodes) { const S = nodeStats(n.id), col = heatColor(S.rate); n.heat.paint(S.rate, S.due);
        const txt = `${n.name}　${pct(S.rate)}${S.a ? `（${S.c}／${S.a}）` : ''}${S.due ? `・待複習${S.overdueDays ? ` ${S.overdueDays} 天` : ''}` : ''}`;
        if (n.plab.userData.text !== txt) setLabel(n.plab, txt, { bg: HEAT_BG[col], fg: S.state === 'locked' && !S.a ? '#8a7a92' : '#4a3b52', icon: S.due ? 'st-review' : S.state === 'locked' ? 'st-locked' : 'chart', h: n.guardian ? 0.62 : 0.5 }); } }
    function setParent(on) { parentOn = !!on; if (parentOn && !heat) { heat = new THREE.Group(); group.add(heat); for (const n of nodes) { n.heat = heatDisc(n.x, n.z, n.guardian ? 3.3 : 2.7, H, heat); n.plab = label(''); n.plab.userData.base = n.lab.userData.base; n.plab.position.set(n.x, n.plab.userData.base, n.z); group.add(n.plab); } }
      if (!heat) return; heat.visible = parentOn; for (const n of nodes) { n.plab.visible = parentOn; n.lab.visible = !parentOn; } if (parentOn) paintHeat(); }
    const nodeOf = {}; for (const n of nodes) nodeOf[n.id] = n;
    function layoutStones() { st.layout(s => { const vis = nodeOf[s.to].state !== 'locked'; const t0 = revealFrom.get(s.to); if (!vis) return 0; return t0 != null ? smooth(0, 0.35, revealT - t0 - 0.4 - s.k * 1.4) : 1; }); }
    function update(dt, time) { revealT += dt; if (revealFrom.size) { layoutStones(); for (const [id, t0] of revealFrom) if (revealT - t0 > 2.4) revealFrom.delete(id); }
      for (const n of nodes) {
        if (n.state !== 'locked' && n.fogK > 0) { n.fogK = Math.max(0, n.fogK - dt * 0.9); n.fogMat.opacity = 0.6 * n.fogK; n.fog.scale.setScalar(1 + (1 - n.fogK) * 0.6); if (!n.fogK) n.fog.visible = false; }
        if (n.fog.visible) n.fog.children.forEach((m, k) => { if (m.userData.d == null) return; const a = m.userData.a + time * 0.25; m.position.x = Math.cos(a) * m.userData.d; m.position.z = Math.sin(a) * m.userData.d; });
        if (n.bloomK !== n.bloomTo) n.bloomK += Math.sign(n.bloomTo - n.bloomK) * Math.min(Math.abs(n.bloomTo - n.bloomK), dt * 1.8);
        n.flowers.visible = n.bloomK > 0.01; n.flowers.children.forEach((f, k) => f.scale.setScalar(smooth(k * 0.12, k * 0.12 + 0.5, n.bloomK) * (1 + Math.sin(time * 2 + k) * 0.05))); // 開花：一朵一朵長出來
        n.plant.scale.setScalar(n.state === 'review' ? 0.9 : 1 + n.bloomK * 0.15); n.plant.rotation.z = n.state === 'review' ? 0.18 : Math.sin(time * 1.3 + n.x) * 0.04; // 缺水時植物垂下來
        if (n.sign.visible) { n.sign.position.y = 0.08 + Math.sin(time * 2.4 + n.z) * 0.08; n.signMat.emissiveIntensity = 0.45 + Math.sin(time * 4 + n.x) * 0.25; } // 可挑戰：路標發光、上下浮動
        n.starG.rotation.y = time * 0.8; n.starG.position.y = 2.75 + Math.sin(time * 1.6 + n.x) * 0.06;
        n.lab.position.y = n.lab.userData.base - curveDrop(n.x, n.z) + Math.sin(time * 1.2 + n.z) * 0.04;
        if (parentOn) { n.plab.position.y = n.lab.position.y; if (n.heat.ring.visible) { const k = 0.5 + Math.sin(time * 3 + n.x) * 0.5; n.heat.ring.material.opacity = 0.45 + k * 0.45; n.heat.ring.scale.setScalar(1 + k * 0.04); } } }
      title.position.y = title.userData.base - curveDrop(0, 15); for (const f of fx) f(dt, time); bloom.update(dt); }
    const spawns = { entry: { x: ENTRY[0], z: ENTRY[1] - 0.5, yaw: Math.PI } };
    const trunkName = CH ? '森林主幹道' : '數學主幹道', portals = [{ x: ENTRY[0], z: ENTRY[1] + 1.6, r: 1.5, to: TRUNK, spawn: 'from-' + rid, icon: CH ? 'forest' : 'math', name: trunkName, text: () => `door|走進拱門回到${trunkName}`, locked: () => false }];
    // 小地圖用：邊界、石板路（通往哪個知識點）、河
    const mini = { shape: 'circle', cx: 0, cz: 0, R: RAD, grass: '#' + new THREE.Color(T.grass[0]).getHexString(), paths: edges.map(e => ({ to: e.to, pts: e.pts.map(p => [p.x, p.z]) })), river: river ? Array.from({ length: 81 }, (_, i) => [i - 40, riverZ + Math.sin((i - 40) * 0.25) * 1.2]) : null };
    refresh(); group.visible = false;
    return { id: rid, name: R.name, icon: R.img, group, colliders, groundY, blocked, spawns, portals, nodes, items, refresh, update, setParent, mini, lush: lushNow, spawn: 'entry' };
  }

  // ── 森林主幹道：南邊接新手村，往北爬坡；兩旁是各區域的入口 ──
  function buildTrunk(subject = 'chinese') { const MATH = subject === 'math', SUB = REGIONS.filter(R => subjectOf(R.id) === subject), ID = MATH ? 'mtrunk' : 'trunk';
    const group = new THREE.Group(); setRoot(group); const colliders = [], r = rng(MATH ? 31415926 : 20241101), SLOPE = 0.09, roadX = z => Math.sin(z * 0.12 + (MATH ? 1.3 : 0)) * 1.5;
    const gates = SUB.map(R => ({ R, x: R.gate[0] * 1.2, z: R.gate[1] * 1.05 }));
    const roadD = (x, z) => Math.min(Math.abs(x - roadX(z)) - 1.3, ...gates.map(g => distSeg(x, z, roadX(g.z), g.z, g.x, g.z) - 0.9));
    const H = (x, z) => { const base = -z * SLOPE + 1.2; let h = base + 0.3 * noise(x * 0.5, z * 0.5) + smooth(9, 16, Math.abs(x)) * 2.5; return THREE.MathUtils.lerp(h, base, 1 - smooth(0.2, 2.2, roadD(x, z))); };
    ground(90, 100, H, (x, z, c) => { const n = noise(x * 1.2, z * 1.2) * 0.5 + 0.5; c.setHex(0x9fd87a).lerp(new THREE.Color(0x86c46a), n); const d = roadD(x, z); if (d < 0.6) c.lerp(new THREE.Color(0xd9cbb4), 1 - smooth(-0.2, 0.6, d)); });
    // 主幹道的石板（大塊、兩排）
    // 主幹道：三排交錯的不規則石板鋪滿路面，兩邊一顆顆圓角路緣石，外面點綴草叢；通往各區的岔路是踏腳石
    const deco = [], put = (kind, x, z, o) => deco.push({ kind, x, z, y: H(x, z) + (o.dy || 0), ...o });
    for (let z = 31.2, row = 0; z > -33.6; z -= 0.62, row++) { const cx = roadX(z), yaw = Math.atan2(roadX(z - 0.5) - roadX(z + 0.5), -1);
      for (let c = -1; c <= 1; c++) { const lat = c * 0.66 + (row % 2 ? 0.33 : 0) + (r() - 0.5) * 0.08; if (Math.abs(lat) > 1.0) continue; put(flagKind(), cx + lat, z + (r() - 0.5) * 0.1, { rot: yaw + (r() - 0.5) * 0.5, sx: 0.66 + r() * 0.1, sz: 0.58 + r() * 0.08, col: STONE_COL[Math.floor(r() * 5)], dy: 0.01 }); }
      for (const sd of [-1, 1]) { const gap = gates.some(g => Math.sign(g.x - cx) === sd && Math.abs(g.z - z) < 1.1); if (!gap) put('cb', cx + sd * 1.32, z, { rot: (r() - 0.5) * 0.3, sx: 0.9 + r() * 0.3, sy: 0.9 + r() * 0.4, sz: 1.4 + r() * 0.3, col: PEBBLE_COL[Math.floor(r() * 4)] }); if (r() < 0.35 && !gap) put('tf', cx + sd * (1.65 + r() * 0.4), z + (r() - 0.5) * 0.5, { rot: r() * 6.28, sx: 1, sy: 0.8 + r() * 0.6, sz: 1, col: TUFT_COL[Math.floor(r() * 3)] }); } }
    for (const g of gates) { const sx = roadX(g.z) + Math.sign(g.x - roadX(g.z)) * 1.4, ex = g.x + Math.sign(g.x) * 0.6, n = Math.max(2, Math.round(Math.abs(ex - sx) / 0.8)); deco.push(...stepStones(Array.from({ length: n + 2 }, (_, k) => ({ x: sx + (ex - sx) * (k - 0.5) / n, z: g.z })), H, { width: 1.3 })); }
    pathDeco(deco);
    // 各區域入口（拱門＋招牌），門口一塊進度牌
    const gateObjs = gates.map(g => { const side = Math.sign(g.x) || 1, ax = g.x + side * 1.2, a = arch(ax, g.z, H(ax, g.z), side > 0 ? -Math.PI / 2 : Math.PI / 2, [0xf2928a, 0x8fb6ec, 0xb9a0d8, 0x7fc6d6, 0xf2b5c6, 0xd8b07a, 0xe8c56a][SUB.indexOf(g.R) % 7], g.R.name, g.R.img);
      colliders.push({ x: ax, z: g.z - 1.3, r: 0.35 }, { x: ax, z: g.z + 1.3, r: 0.35 }); const info = label(''); info.userData.base = H(g.x, g.z) + 1.1; info.position.set(g.x - side * 0.2, info.userData.base, g.z); group.add(info);
      return { ...g, side, ax, a, info, open: null }; });
    // 入口牌坊（南邊，回新手村）與北邊山頂
    const home = arch(roadX(32), 32.5, H(roadX(32), 32.5), 0, 0xc99a6a, '新手村', 'back'); home.bars.visible = false; colliders.push({ x: roadX(32) - 1.3, z: 32.5, r: 0.35 }, { x: roadX(32) + 1.3, z: 32.5, r: 0.35 });
    const title = label(MATH ? '數學森林・數與計算主幹道' : '學習森林・識字與詞語主幹道', { bg: MATH ? '#7cb8d8' : '#f09a8a', fg: '#fff', h: 0.85, icon: MATH ? 'math' : 'forest' }); title.userData.base = H(0, 27) + 3.4; title.position.set(0, title.userData.base, 27); group.add(title);
    const tl = []; for (let k = 0; k < 6000 && tl.length < 70; k++) { const x = (r() - 0.5) * 60, z = 36 - r() * 74; if (z > 30.5 || roadD(x, z) < 1.6 || gates.some(g => Math.hypot(x - g.x - g.side * 1.2, z - g.z) < 3.4) || Math.hypot(x - roadX(32), z - 32.5) < 3) continue; const s = 0.85 + r() * 0.6; tl.push({ x, z, y: H(x, z), s, r: r() * 6.28, kind: r() < 0.45 ? 'pine' : 'broad' }); if (Math.abs(x) < 13) colliders.push({ x, z, r: 0.42 * s }); }
    trees(tl, [0x8fd36f, 0x7cc76a, 0xa8de7e], [0x5fae84, 0x4f9e7a, 0x6fbf8f]);
    { const bp = []; for (let z = 34.2; z > -34.6; z -= 1.0) for (const sd of [-1, 1]) bp.push({ x: sd * 13.1, z, nx: sd, nz: 0 }); for (let x = -12.6; x <= 12.6; x += 1.0) { bp.push({ x, z: 34.3, nx: 0, nz: 1 }); bp.push({ x, z: -34.7, nx: 0, nz: -1 }); }
      border(bp, H, { leaf: [0x8fd36f, 0x7cc76a, 0xa8de7e], pine: [0x5fae84, 0x4f9e7a, 0x6fbf8f], pineK: 0.5, seed: 4242, low: p => p.nz > 0.5 || p.z > 28 }); } // 邊界：兩旁與南北兩端都是樹籬＋大樹
    const bpts = []; for (let k = 0; k < 3000 && bpts.length < 220; k++) { const x = (r() - 0.5) * 24, z = 33 - r() * 66; if (roadD(x, z) < 0.6 || Math.abs(x) > 12 || colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 0.3)) continue; bpts.push({ x, y: H(x, z), z, r: r() * 6.28, s: 0.8 + r() * 0.6 }); }
    const bloom = bloomField(bpts, [0xffb3c7, 0xfff3a8, 0xffffff, 0xd8c2ff, 0xffc9a0, 0x8fd3f0]);
    const lushNow = () => { const ns = NODES.filter(n => !n.guardian && subjectOf(n.region) === subject); return ns.filter(n => levelOf(n.id) > 0).length / ns.length; }; // 主幹道：整座森林學會了多少
    setRoot(null);
    const groundY = H, blocked = (x, z) => Math.abs(x) > 12.4 || z > 33.6 || z < -34.1;
    let heat = null, parentOn = false; // 家長檢視：每個區域門口一圈熱力色（整區的正確率），進度牌改成「正確率・待複習」
    function refresh() { for (const g of gateObjs) { const open = regionOpen(g.R.id); const [have, all] = regionCount(g.R.id); const conquered = levelOf('guard-' + g.R.id) > 0; bloom.set(lushNow()); g.a.bars.visible = !open; g.open = open;
        if (parentOn) { const S = regionStats(g.R.id), col = heatColor(S.rate); g.heat.paint(S.rate, S.due); const txt = `正確率 ${pct(S.rate)}${S.due ? `・待複習 ${S.due}` : ''}・學會 ${have}／${all}`;
          if (g.txt !== txt) { g.txt = txt; setLabel(g.info, txt, { bg: HEAT_BG[col], fg: '#4a3b52', h: 0.42, icon: S.due ? 'st-review' : 'chart' }); } continue; }
        const txt = !open ? `先征服：${regionNeeds(g.R.id).map(n => n.name).join('、')}` : conquered ? `已征服・${have}／${all}` : `${have}／${all} 已學會`;
        if (g.txt !== txt) { g.txt = txt; setLabel(g.info, txt, !open ? { bg: '#efe9f2', fg: '#8a7a92', h: 0.42, icon: STATE_ICON.locked } : { bg: conquered ? '#dff7e6' : '#fffaf3', h: 0.42, icon: conquered ? STATE_ICON.guardian : STATE_ICON.open }); } } }
    function setParent(on) { parentOn = !!on; if (parentOn && !heat) { heat = new THREE.Group(); group.add(heat); for (const g of gateObjs) g.heat = heatDisc(g.x, g.z, 2.2, H, heat); } if (heat) heat.visible = parentOn; refresh(); }
    function update(dt, time) { bloom.update(dt); for (const g of gateObjs) { g.info.position.y = g.info.userData.base - curveDrop(g.x, g.z); if (parentOn && g.heat.ring.visible) { const k = 0.5 + Math.sin(time * 3 + g.z) * 0.5; g.heat.ring.material.opacity = 0.45 + k * 0.45; } } title.position.y = title.userData.base - curveDrop(0, 27); }
    const spawns = { south: { x: roadX(30), z: 30, yaw: Math.PI } }; for (const g of gateObjs) spawns['from-' + g.R.id] = { x: g.x - g.side * 0.8, z: g.z, yaw: g.side > 0 ? -Math.PI / 2 : Math.PI / 2 };
    const portals = [{ x: roadX(32), z: 32.2, r: 1.4, to: 'village', spawn: MATH ? 'math' : 'forest', icon: 'sprout', name: '新手村', text: () => 'door|走進拱門回到新手村', locked: () => false },
      ...gateObjs.map(g => ({ x: g.ax, z: g.z, r: 1.3, to: g.R.id, spawn: 'entry', icon: g.R.img, name: g.R.name, locked: () => !regionOpen(g.R.id), text: () => regionOpen(g.R.id) ? `${g.R.img}|走進拱門就會進入${g.R.name}（${g.R.grades}）` : `st-locked|${g.R.name}還沒打開：先通過${regionNeeds(g.R.id).map(n => `「${n.name}」`).join('、')}的挑戰` }))];
    const mini = { shape: 'rect', x0: -12.4, x1: 12.4, z0: -34.1, z1: 33.6, grass: '#9fd87a', paths: [{ pts: Array.from({ length: 66 }, (_, i) => [roadX(31.5 - i), 31.5 - i]), w: 2.6 }, ...gates.map(g => ({ pts: [[roadX(g.z), g.z], [g.x + Math.sign(g.x || 1) * 0.6, g.z]] }))] };
    refresh(); group.visible = false;
    return { id: ID, name: MATH ? '數學主幹道' : '森林主幹道', icon: MATH ? 'math' : 'forest', group, colliders, groundY, blocked, spawns, portals, nodes: [], items: [], refresh, update, setParent, mini, lush: lushNow, spawn: 'south' };
  }
  return { buildRegion, buildTrunk, label, arch, border, ringPts, pathDeco, stepStones };
}
