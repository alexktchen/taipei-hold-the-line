/* 學習森林的 3D 地圖（積木風，和田園小場景共用材質與工具）：
   - trunk：森林主幹道（識字與詞語），從南邊的新手村往北一路往上爬，兩旁是各區域的入口，年級越高越後面、越高；
   - 每個區域一張獨立地圖：知識點是石碑，石板路照「先學會哪個才能學下一個」連起來；
     還沒打通的路沒有石板、石碑被樹叢圍住，學會前置知識點後石板一塊塊冒出來、樹叢消失。
   每張地圖回傳 { group, colliders, groundY, blocked, spawns, portals, nodes, update, refresh }，由 index.html 切換。 */
import { REGIONS, NODES, regionById, nodeById } from './content.js';
import { nodeState, regionOpen, regionNeeds, regionCount, levelOf, stars, ICONS, STATE_ICON } from './learn.js';

export function createForest(ctx) {
  const { THREE, G, Gc, merge, toon, addMesh, addInstanced, setRoot, curveDrop, TREE_GEO, CFG } = ctx;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler(), COL = new THREE.Color();
  const rng = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const distSeg = (px, pz, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz || 1))); return Math.hypot(px - ax - vx * t, pz - az - vz * t); };
  const noise = (x, z) => Math.sin(x * 0.73 + Math.sin(z * 0.31) * 2.1) * Math.cos(z * 0.67 + Math.sin(x * 0.27) * 1.7);

  // ── 名牌：畫布文字做成 Sprite；每幀依地平線彎曲往下移，才會和彎過的地面對齊 ──
  // icon＝forest/icons 裡的圖示名（區域、知識點狀態），畫在名牌左邊；圖片還沒載入就先畫文字，載入後重畫
  const IMG = new Map(); const img = name => { if (!IMG.has(name)) { const im = new Image(); im.src = ICONS + name + '.png'; IMG.set(name, im); } return IMG.get(name); };
  function drawLabel(cv, text, { bg = '#fffaf3', fg = '#4a3b52', icon = null } = {}) { const g = cv.getContext('2d'), font = '900 44px "Noto Sans TC","PingFang TC",sans-serif'; g.font = font; const iw = icon ? 64 : 0, w = Math.ceil(g.measureText(text).width) + 48 + iw; cv.width = w; cv.height = 72;
    g.font = font; g.fillStyle = bg; g.strokeStyle = '#4a3b5233'; g.lineWidth = 4; g.beginPath(); g.roundRect(2, 2, w - 4, 68, 34); g.fill(); g.stroke(); const im = icon && img(icon); if (im && im.complete && im.naturalWidth) g.drawImage(im, 12, 6, 60, 60);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, (w + iw) / 2, 38); return w; }
  function label(text, opt = {}) { const h = opt.h || 0.55, cv = document.createElement('canvas'), w = drawLabel(cv, text, opt);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false })); sp.scale.set(h * w / 72, h, 1); sp.renderOrder = 3;
    if (opt.icon) { const im = img(opt.icon); if (!im.complete) im.addEventListener('load', () => { if (sp.userData.text === text) { drawLabel(cv, text, opt); tex.needsUpdate = true; } }, { once: true }); } sp.userData.text = text; return sp; }
  function setLabel(sp, text, opt) { const n = label(text, opt); sp.material.map.dispose(); sp.material.map = n.material.map; sp.scale.copy(n.scale); sp.userData.text = text; }

  // ── 共用零件 ──
  function ground(size, seg, hFn, colFn) { const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, hFn(x, z)); colFn(x, z, c); col.set([c.r, c.g, c.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals(); return addMesh(geo, toon(0xffffff, { vertexColors: true }), ctx.ROOT(), { outline: false, cast: false }); }
  // 樹：沿用田園的積木樹形（闊葉、針葉），每張地圖一組 InstancedMesh
  function trees(list, leaf, pine) { if (!list.length) return; const broad = list.filter(t => t.kind === 'broad'), pines = list.filter(t => t.kind !== 'broad');
    const tr = addInstanced(TREE_GEO.trunk, toon(CFG.pal.trunk), list.length); list.forEach((t, i) => { M4.compose(V.set(t.x, t.y - 0.05, t.z), Q.setFromEuler(E.set(0, t.r, 0)), S.set(t.s, t.s * (t.kind === 'broad' ? 1 : 1.15), t.s)); tr.im.setMatrixAt(i, M4); });
    if (broad.length) { const b = addInstanced(TREE_GEO.broad, toon(0xffffff), broad.length); broad.forEach((t, i) => { M4.compose(V.set(t.x, t.y - 0.05, t.z), Q.setFromEuler(E.set(0, t.r, 0)), S.setScalar(t.s)); b.im.setMatrixAt(i, M4); b.im.setColorAt(i, COL.setHex(leaf[i % leaf.length])); }); }
    if (pines.length) { const p = addInstanced(TREE_GEO.pine, toon(0xffffff), pines.length); pines.forEach((t, i) => { M4.compose(V.set(t.x, t.y - 0.05, t.z), Q.setFromEuler(E.set(0, t.r, 0)), S.set(t.s, t.s * 1.15, t.s)); p.im.setMatrixAt(i, M4); p.im.setColorAt(i, COL.setHex(pine[i % pine.length])); }); } }
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
    books(x, z, y, r, col) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = r; ctx.ROOT().add(g); const cs = [0xe8705c, 0x8fb6ec, 0xf2d27a, 0x8fd3a0, 0xc9b8f0]; for (let k = 0; k < 4; k++) addMesh(Gc(1.0 - k * 0.06, 0.22, 0.75, 0.04, (k % 2) * 0.06, 0.11 + k * 0.22, 0, k * 0.2), toon(cs[k % 5]), g); return 0.7; },
  };
  const THEMES = {
    village: { grass: [0xa6dc7a, 0x94cf6c], leaf: [0x8fd36f, 0xa8de7e], pine: [0x5fae84, 0x6fbf8f], props: ['hut', 'hut', 'hut', 'bed', 'rock'], slope: 0.02, trees: 70, pineK: 0.3 },
    woods: { grass: [0x86c46a, 0x76b45c], leaf: [0x6fbf5e, 0x7cc76a, 0x5fae52], pine: [0x4f9e7a, 0x5fae84], props: ['rock', 'books'], slope: 0.03, trees: 150, pineK: 0.55 },
    valley: { grass: [0xb8d68a, 0xc9c08e], leaf: [0x9ccf6a, 0xb5d77a], pine: [0x6fae84], props: ['rock', 'rock', 'rock', 'rock', 'books'], slope: 0.02, trees: 60, pineK: 0.4, bowl: true },
    river: { grass: [0x9fd87a, 0x8fcf6e], leaf: [0x8fd36f, 0x9ccf6a], pine: [0x5fae84], props: ['rock', 'bed'], slope: 0.02, trees: 70, pineK: 0.3, river: true },
    garden: { grass: [0xaee68a, 0x9ad97c], leaf: [0xf2b5c6, 0x9ccf6a, 0xf6c9d4], pine: [0x6fbf8f], props: ['bed', 'bed', 'bed', 'bed', 'lantern'], slope: 0.02, trees: 60, pineK: 0.15 },
    city: { grass: [0xc9d69a, 0xb7cc8a], leaf: [0x9ccf6a], pine: [0x5fae84, 0x4f9e7a], props: ['wall', 'wall', 'lantern', 'lantern', 'hut'], slope: 0.02, trees: 50, pineK: 0.6 },
    tower: { grass: [0xa9d09a, 0xbad6a6], leaf: [0x8fd36f], pine: [0x5fae84, 0x6fbf8f, 0x4f9e7a], props: ['books', 'books', 'rock'], slope: 0.07, trees: 80, pineK: 0.7 },
  };

  // ── 區域地圖 ──
  function buildRegion(rid) {
    const R = regionById(rid), T = THEMES[R.theme], r = rng(rid.length * 7919 + rid.charCodeAt(0)), group = new THREE.Group(); setRoot(group);
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
    const ACCENT = { village: 0xf2928a, woods: 0xffd27a, valley: 0xc9b8f0, river: 0x8fd3f0, garden: 0xffb3c7, city: 0xf6c06a, tower: 0xd8c2ff }[R.theme];
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
    const stones = []; for (const e of edges) { const pts = e.curve.getSpacedPoints(Math.max(2, Math.round(e.len / 0.95))); pts.forEach((p, k) => { if (!k || k === pts.length - 1) return; const x = p.x + (r() - 0.5) * 0.2, z = p.z + (r() - 0.5) * 0.2; if (near(x, z, e.to) || (e.from && near(x, z, e.from)) || (river && inRiver(x, z))) return; stones.push({ x, z, y: H(x, z), to: e.to, rot: r() * 0.6, s: 0.85 + r() * 0.3, k: k / pts.length }); }); }
    const st = addInstanced(Gc(0.62, 0.1, 0.5, 0.04, 0, 0.05, 0), toon(0xffffff), Math.max(1, stones.length), { cast: false }); stones.forEach((s, i) => st.im.setColorAt(i, COL.setHex([0xd8d0e0, 0xc9c2d6, 0xe6dfea][i % 3])));
    // 入口拱門（回主幹道）
    const ent = arch(ENTRY[0], ENTRY[1] + 2.2, H(ENTRY[0], ENTRY[1] + 2.2), 0, 0xc99a6a, `↩ 森林主幹道`); colliders.push({ x: ENTRY[0] - 1.3, z: ENTRY[1] + 2.2, r: 0.35 }, { x: ENTRY[0] + 1.3, z: ENTRY[1] + 2.2, r: 0.35 }); ent.bars.visible = false;
    const title = label(`${R.name}（${R.grades}）`, { bg: '#f09a8a', fg: '#fff', h: 0.7, icon: R.img }); title.userData.base = H(0, 15) + 3.2; title.position.set(0, title.userData.base, 15); group.add(title);
    // 樹與主題擺設（避開石板路、石碑、河）
    const free = (x, z, pad) => pathD(x, z) > 1.8 + pad && !(river && Math.abs(z - riverZ - Math.sin(x * 0.25) * 1.2) < 2.2 + pad) && Object.values(pos).every(([px, pz]) => Math.hypot(x - px, z - pz) > 3.4 + pad) && Math.hypot(x - ENTRY[0], z - ENTRY[1]) > 3 + pad && !colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + pad + 0.5);
    T.props.forEach((kind, i) => { for (let k = 0; k < 40; k++) { const a = r() * Math.PI * 2, d = 6 + r() * 15, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 1.4)) continue; const rad = PROPS[kind](x, z, H(x, z), r() * 6.28, [0xf2928a, 0x8fb6ec, 0xf2d27a, 0xb9b0c2, 0xd8c9a0][i % 5]); colliders.push({ x, z, r: rad }); break; } });
    if (R.theme === 'tower') { const g = new THREE.Group(); const tz = -20, ty = H(0, tz); g.position.set(0, ty, tz); group.add(g); const cs = [0xe8705c, 0x8fb6ec, 0xf2d27a, 0x8fd3a0, 0xc9b8f0, 0xf2b5c6]; for (let k = 0; k < 9; k++) addMesh(Gc(3.2 - k * 0.18, 0.7, 2.4 - k * 0.12, 0.08, (k % 2) * 0.15, 0.35 + k * 0.7, 0, k * 0.12), toon(cs[k % 6]), g); colliders.push({ x: 0, z: tz, r: 1.9 }); }
    const tl = []; for (let k = 0; k < T.trees * 30 && tl.length < T.trees; k++) { const edge = k % 3 === 0, a = r() * Math.PI * 2, d = edge ? RAD + 0.5 + r() * 9 : 4 + r() * 21, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!edge && !free(x, z, 0.3)) continue; const s = 0.85 + r() * 0.6; tl.push({ x, z, y: H(x, z), s, r: r() * 6.28, kind: r() < T.pineK ? 'pine' : 'broad' }); if (d < RAD + 1) colliders.push({ x, z, r: 0.42 * s }); }
    trees(tl, T.leaf, T.pine);
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
      layoutStones(); }
    function layoutStones() { stones.forEach((s, i) => { const nd = nodes.find(n => n.id === s.to); const vis = nd.state !== 'locked'; const t0 = revealFrom.get(s.to); let k = vis ? 1 : 0; if (vis && t0 != null) k = smooth(0, 0.35, revealT - t0 - 0.4 - s.k * 1.4); M4.compose(V.set(s.x, s.y, s.z), Q.setFromEuler(E.set(0, s.rot, 0)), S.setScalar(s.s * k + 1e-4)); st.im.setMatrixAt(i, M4); }); st.im.instanceMatrix.needsUpdate = true; }
    function update(dt, time) { revealT += dt; if (revealFrom.size) { layoutStones(); for (const [id, t0] of revealFrom) if (revealT - t0 > 2.4) revealFrom.delete(id); }
      for (const n of nodes) {
        if (n.state !== 'locked' && n.fogK > 0) { n.fogK = Math.max(0, n.fogK - dt * 0.9); n.fogMat.opacity = 0.6 * n.fogK; n.fog.scale.setScalar(1 + (1 - n.fogK) * 0.6); if (!n.fogK) n.fog.visible = false; }
        if (n.fog.visible) n.fog.children.forEach((m, k) => { if (m.userData.d == null) return; const a = m.userData.a + time * 0.25; m.position.x = Math.cos(a) * m.userData.d; m.position.z = Math.sin(a) * m.userData.d; });
        if (n.bloomK !== n.bloomTo) n.bloomK += Math.sign(n.bloomTo - n.bloomK) * Math.min(Math.abs(n.bloomTo - n.bloomK), dt * 1.8);
        n.flowers.visible = n.bloomK > 0.01; n.flowers.children.forEach((f, k) => f.scale.setScalar(smooth(k * 0.12, k * 0.12 + 0.5, n.bloomK) * (1 + Math.sin(time * 2 + k) * 0.05))); // 開花：一朵一朵長出來
        n.plant.scale.setScalar(n.state === 'review' ? 0.9 : 1 + n.bloomK * 0.15); n.plant.rotation.z = n.state === 'review' ? 0.18 : Math.sin(time * 1.3 + n.x) * 0.04; // 缺水時植物垂下來
        if (n.sign.visible) { n.sign.position.y = 0.08 + Math.sin(time * 2.4 + n.z) * 0.08; n.signMat.emissiveIntensity = 0.45 + Math.sin(time * 4 + n.x) * 0.25; } // 可挑戰：路標發光、上下浮動
        n.starG.rotation.y = time * 0.8; n.starG.position.y = 2.75 + Math.sin(time * 1.6 + n.x) * 0.06;
        n.lab.position.y = n.lab.userData.base - curveDrop(n.x, n.z) + Math.sin(time * 1.2 + n.z) * 0.04; }
      title.position.y = title.userData.base - curveDrop(0, 15); }
    const spawns = { entry: { x: ENTRY[0], z: ENTRY[1] - 0.5, yaw: Math.PI } };
    const portals = [{ x: ENTRY[0], z: ENTRY[1] + 1.4, r: 1.7, to: 'trunk', spawn: 'from-' + rid, text: () => '🚪 按空白鍵回到森林主幹道', locked: () => false }];
    refresh(); group.visible = false;
    return { id: rid, name: R.name, group, colliders, groundY, blocked, spawns, portals, nodes, refresh, update, spawn: 'entry' };
  }

  // ── 森林主幹道：南邊接新手村，往北爬坡；兩旁是各區域的入口 ──
  function buildTrunk() {
    const group = new THREE.Group(); setRoot(group); const colliders = [], r = rng(20241101), SLOPE = 0.09, roadX = z => Math.sin(z * 0.12) * 1.5;
    const gates = REGIONS.map(R => ({ R, x: R.gate[0] * 1.2, z: R.gate[1] * 1.05 }));
    const roadD = (x, z) => Math.min(Math.abs(x - roadX(z)) - 1.3, ...gates.map(g => distSeg(x, z, roadX(g.z), g.z, g.x, g.z) - 0.9));
    const H = (x, z) => { const base = -z * SLOPE + 1.2; let h = base + 0.3 * noise(x * 0.5, z * 0.5) + smooth(9, 16, Math.abs(x)) * 2.5; return THREE.MathUtils.lerp(h, base, 1 - smooth(0.2, 2.2, roadD(x, z))); };
    ground(90, 100, H, (x, z, c) => { const n = noise(x * 1.2, z * 1.2) * 0.5 + 0.5; c.setHex(0x9fd87a).lerp(new THREE.Color(0x86c46a), n); const d = roadD(x, z); if (d < 0.6) c.lerp(new THREE.Color(0xd9cbb4), 1 - smooth(-0.2, 0.6, d)); });
    // 主幹道的石板（大塊、兩排）
    const slabs = []; for (let z = 31; z > -34; z -= 0.85) for (const o of [-0.5, 0.5]) slabs.push({ x: roadX(z) + o + (r() - 0.5) * 0.15, z: z + (r() - 0.5) * 0.15, rot: (r() - 0.5) * 0.4 });
    for (const g of gates) { const sx = roadX(g.z), n = Math.floor(Math.abs(g.x - sx) / 0.85); for (let k = 1; k < n; k++) slabs.push({ x: sx + (g.x - sx) * k / n, z: g.z + (r() - 0.5) * 0.2, rot: r() }); }
    const st = addInstanced(Gc(0.7, 0.1, 0.62, 0.04, 0, 0.05, 0), toon(0xffffff), slabs.length, { cast: false }); slabs.forEach((s, i) => { M4.compose(V.set(s.x, H(s.x, s.z), s.z), Q.setFromEuler(E.set(0, s.rot, 0)), S.setScalar(1)); st.im.setMatrixAt(i, M4); st.im.setColorAt(i, COL.setHex([0xd8d0e0, 0xc9c2d6, 0xe6dfea][i % 3])); });
    // 各區域入口（拱門＋招牌），門口一塊進度牌
    const gateObjs = gates.map(g => { const side = Math.sign(g.x) || 1, ax = g.x + side * 1.2, a = arch(ax, g.z, H(ax, g.z), side > 0 ? -Math.PI / 2 : Math.PI / 2, [0xf2928a, 0x8fb6ec, 0xb9a0d8, 0x7fc6d6, 0xf2b5c6, 0xd8b07a, 0xe8c56a][REGIONS.indexOf(g.R)], g.R.name, g.R.img);
      colliders.push({ x: ax, z: g.z - 1.3, r: 0.35 }, { x: ax, z: g.z + 1.3, r: 0.35 }); const info = label(''); info.userData.base = H(g.x, g.z) + 1.1; info.position.set(g.x - side * 0.2, info.userData.base, g.z); group.add(info);
      return { ...g, side, ax, a, info, open: null }; });
    // 入口牌坊（南邊，回新手村）與北邊山頂
    const home = arch(roadX(32), 32.5, H(roadX(32), 32.5), 0, 0xc99a6a, '↩ 新手村'); home.bars.visible = false; colliders.push({ x: roadX(32) - 1.3, z: 32.5, r: 0.35 }, { x: roadX(32) + 1.3, z: 32.5, r: 0.35 });
    const title = label('🌳 學習森林・識字與詞語主幹道', { bg: '#f09a8a', fg: '#fff', h: 0.85 }); title.userData.base = H(0, 27) + 3.4; title.position.set(0, title.userData.base, 27); group.add(title);
    const tl = []; for (let k = 0; k < 6000 && tl.length < 170; k++) { const x = (r() - 0.5) * 60, z = 36 - r() * 74; if (roadD(x, z) < 1.6 || gates.some(g => Math.hypot(x - g.x - g.side * 1.2, z - g.z) < 3.4) || Math.hypot(x - roadX(32), z - 32.5) < 3) continue; const s = 0.85 + r() * 0.6; tl.push({ x, z, y: H(x, z), s, r: r() * 6.28, kind: r() < 0.45 ? 'pine' : 'broad' }); if (Math.abs(x) < 13) colliders.push({ x, z, r: 0.42 * s }); }
    trees(tl, [0x8fd36f, 0x7cc76a, 0xa8de7e], [0x5fae84, 0x4f9e7a, 0x6fbf8f]);
    setRoot(null);
    const groundY = H, blocked = (x, z) => Math.abs(x) > 12.5 || z > 33.5 || z < -34;
    function refresh() { for (const g of gateObjs) { const open = regionOpen(g.R.id); const [have, all] = regionCount(g.R.id); const conquered = levelOf('guard-' + g.R.id) > 0; const txt = !open ? `先征服：${regionNeeds(g.R.id).map(n => n.name).join('、')}` : conquered ? `已征服・${have}／${all}` : `${have}／${all} 已學會`;
        if (g.txt !== txt) { g.txt = txt; setLabel(g.info, txt, !open ? { bg: '#efe9f2', fg: '#8a7a92', h: 0.42, icon: STATE_ICON.locked } : { bg: conquered ? '#dff7e6' : '#fffaf3', h: 0.42, icon: conquered ? STATE_ICON.guardian : STATE_ICON.open }); } g.a.bars.visible = !open; g.open = open; } }
    function update(dt, time) { for (const g of gateObjs) g.info.position.y = g.info.userData.base - curveDrop(g.x, g.z); title.position.y = title.userData.base - curveDrop(0, 27); }
    const spawns = { south: { x: roadX(30), z: 30, yaw: Math.PI } }; for (const g of gateObjs) spawns['from-' + g.R.id] = { x: g.x - g.side * 0.8, z: g.z, yaw: g.side > 0 ? -Math.PI / 2 : Math.PI / 2 };
    const portals = [{ x: roadX(32), z: 31.8, r: 1.7, to: 'village', spawn: 'forest', text: () => '🚪 按空白鍵回到新手村', locked: () => false },
      ...gateObjs.map(g => ({ x: g.x + g.side * 0.6, z: g.z, r: 1.6, to: g.R.id, spawn: 'entry', locked: () => !regionOpen(g.R.id), text: () => regionOpen(g.R.id) ? `🚪 按空白鍵進入${g.R.name}（${g.R.grades}）` : `🔒 ${g.R.name}還沒打開：先通過${regionNeeds(g.R.id).map(n => `「${n.name}」`).join('、')}的挑戰` }))];
    refresh(); group.visible = false;
    return { id: 'trunk', name: '森林主幹道', group, colliders, groundY, blocked, spawns, portals, nodes: [], refresh, update, spawn: 'south' };
  }
  return { buildRegion, buildTrunk, label, arch };
}
