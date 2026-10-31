/* Roblox 風的方塊人（同學與角色）：方頭、方身體、方手腳。零件按幾何種類實例化，每幀合成矩陣做走路擺動。比例與做法參考原站 people.js，重新實作。 */
import * as THREE from 'three';
import { toonMat, instancedOutline } from './toon.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry } from './env.js';
export const ROLE_LABEL = { mayor: '校長', citizen: '同學', elder: '長者', child: '學童', parent: '家長', cyclist: '通勤族', officeworker: '上班族', youth: '年輕人', servant: '老師', researcher: '研究員', farmer: '農夫', traveler: '旅客', worker: '工地人員', hiker: '登山客', hero: '同學' };
const SKIN = [0xf5cd30, 0xf3cfae, 0xe6b48f, 0xcf9670, 0xa86f4c, 0xf5cd30, 0xf0c4a0], HAIR = [0x2e2522, 0x4a3426, 0x1f1d22, 0x6b4a33, 0xc98a3a], CASUAL = [0x0d69ac, 0xc4281c, 0x4b974b, 0xff8c1a, 0x8f4fd6, 0x58a6a6, 0xe8c547, 0xf2a1a1, 0x6f7fb5], PANTS = [0x3b3a42, 0x4a5a78, 0x6b5a4a, 0xa4bd47, 0x0d69ac, 0x27467a];
export function createPeople(scene, colors, heroCfgs, outfits = null) {
  // 金蛋買的衣服：fit = 「帽子.背心.配件」字串（id 見 config.econ.outfits），不認得的 id 當沒穿
  const fitOf = fit => { const a = typeof fit === 'string' ? fit.split('.') : [], ok = (c, id) => outfits && outfits[c] && Object.hasOwn(outfits[c].items, id);
    return { hat: ok('hat', a[0]) ? a[0] : '', color: ok('color', a[1]) ? outfits.color.items[a[1]].c : null, acc: ok('acc', a[2]) ? a[2] : '', suit: ok('suit', a[3]) ? a[3] : '' }; };
  // 變裝派對套裝：膚色、髮色、背心顏色（套裝蓋過帽子、背心、配件）
  const SUIT = { pumpkin: { vest: 0x3b5a2a }, zombie: { skin: 0x9cc27a, vest: 0x9aa0a8, hair: 0x3b3326 }, vampire: { vest: 0x211d1d, hair: 0x111111, skin: 0xf3e6dc }, ghost: { vest: 0xf7f7f2 }, witch: { vest: 0x6a4c93 },
    mummy: { skin: 0xefe6d2, vest: 0xefe6d2, hair: 0xefe6d2 }, boba: { vest: 0xd9b48a }, cone: { vest: 0xf28b2e }, truck: { vest: 0xe8c547 }, bat: { vest: 0x2b2b30, hair: 0x1d1a22 },
    bag: { vest: 0xdb6a41 }, cutlet: { vest: 0xfbfbf7 }, poncho: { vest: 0x8fd3e8 }, delivery: { vest: 0xf28b2e }, card: { vest: 0x2f6f9f }, firework: { vest: 0x26365c }, bear: { vest: 0x1d1a1a, hair: 0x1d1a1a, pants: 0x1d1a1a }, leopard: { vest: 0xc9955a, hair: 0xc9955a },
    pigeon: { vest: 0x9aa0a8 }, nightshift: { vest: 0xfbfbf7 }, parking: { vest: 0x3b3a42 }, duck: { vest: 0xf2d23c }, taro: { vest: 0x9a7ab5 }, tofu: { vest: 0xfbfbf7 }, prince: { vest: 0xc23b2a, pants: 0xc23b2a }, megaphone: { vest: 0xdb6a41 },
    pumpbus: { vest: 0xe8781e }, skeleton: { vest: 0x1d1a1a, pants: 0x1d1a1a, skin: 0xf4f1ea, hair: 0x1d1a1a }, alien: { skin: 0x9cd67a, vest: 0xc9d1d8, hair: 0x9cd67a }, lantern: { vest: 0xc23b2a } };
  const G = { blk: new THREE.BoxGeometry(1, 1, 1), rhead: new RoundedBoxGeometry(1, 1, 1, 3, 0.1), rcap: new RoundedBoxGeometry(1, 1, 1, 2, 0.14), leg: new RoundedBoxGeometry(1, 1, 1, 2, 0.3), body: new THREE.CapsuleGeometry(0.5, 0.6, 4, 10), arm: new RoundedBoxGeometry(1, 1, 1, 2, 0.35), head: new THREE.SphereGeometry(0.5, 16, 12), cap: new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), eye: new THREE.SphereGeometry(0.5, 8, 6), box: new RoundedBoxGeometry(1, 1, 1, 2, 0.2), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10), cone: new THREE.ConeGeometry(0.5, 1, 14), torus: new THREE.TorusGeometry(0.5, 0.09, 6, 18), shadow: new THREE.CircleGeometry(0.5, 20) };
  G.shadow.rotateX(-Math.PI / 2);
  const mat = toonMat({ roughness: 0.7 });
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x2a2018, transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  let rnd = mulberry(41);
  function plan(role, heroCls, fit) {
    const P = []; const H = heroCls ? heroCfgs[heroCls] : null; const F = H ? fitOf(fit) : { hat: '', color: null, acc: '', suit: '' }; const SU = SUIT[F.suit] || null;
    let skin = SKIN[Math.floor(rnd() * SKIN.length)]; let hair = HAIR[Math.floor(rnd() * HAIR.length)];
    let shirt = CASUAL[Math.floor(rnd() * CASUAL.length)], pants = PANTS[Math.floor(rnd() * PANTS.length)]; let sc = 1;
    if (role === 'child') sc = 0.78; if (role === 'elder') hair = 0xd9d4cc; if (role === 'worker') shirt = 0x4a5a78;
    if (H) { sc = 1.16; shirt = 0xfbfbf7; pants = 0x2f3a4a; hair = 0x241c1a; if (SU) { if (SU.skin) skin = SU.skin; if (SU.hair) hair = SU.hair; if (SU.pants) pants = SU.pants; } }
    const MAYOR = role === 'mayor'; if (MAYOR) { sc = 1.22; shirt = 0x26365c; pants = 0x26365c; hair = 0x15110f; }
    const add = (g, off, s, c, ch = null, r = null) => P.push({ g, off, s, c, ch, r });
    const base = (g, off, s, c, ch = null, r = null) => P.push({ g, off, s, c, ch, r, base: true });
    // ── Roblox 方塊人本體（R6 比例，頭稍大一點比較好認）：腳 0～0.17、身體 0.17～0.33、頭心 0.40 ──
    if (role === 'worker') shirt = 0xf2a33a; if (role === 'elder') shirt = 0x9c8a6a; if (role === 'servant') shirt = 0x3e7c8c; if (role === 'farmer') shirt = 0x8fb37a;
    if (H) shirt = SU ? SU.vest : F.color != null ? F.color : H.color;
    const longSleeve = !!H || MAYOR || role === 'elder' || role === 'researcher' || role === 'servant' || rnd() < 0.35; // 長袖：整條手臂是衣服色；短袖：上面一截衣服、下面是皮膚
    for (const sx of [-1, 1]) base('blk', [sx * 0.043, 0.085, 0], [0.082, 0.17, 0.088], pants, sx < 0 ? 'legL' : 'legR');
    base('blk', [0, 0.25, 0], [0.17, 0.16, 0.09], shirt);
    if (role === 'worker') base('blk', [0, 0.25, 0], [0.174, 0.018, 0.094], 0xf5f5ef);
    for (const sx of [-1, 1]) { const ch = sx < 0 ? 'armL' : 'armR';
      if (longSleeve) { base('blk', [sx * 0.125, 0.25, 0], [0.075, 0.16, 0.082], shirt, ch); base('blk', [sx * 0.125, 0.185, 0], [0.078, 0.03, 0.085], skin, ch); }
      else { base('blk', [sx * 0.125, 0.215, 0], [0.072, 0.09, 0.078], skin, ch); base('blk', [sx * 0.125, 0.29, 0], [0.078, 0.08, 0.084], shirt, ch); } }
    base('rhead', [0, 0.40, 0], [0.137, 0.137, 0.13], skin, 'head');
    // 臉：兩顆黑豆眼＋微笑（經典 Roblox 表情）
    for (const sx of [-1, 1]) base('blk', [sx * 0.03, 0.412, 0.0655], [0.018, 0.03, 0.006], 0x211d1d, 'head');
    base('blk', [0, 0.378, 0.0655], [0.036, 0.009, 0.006], 0x211d1d, 'head'); for (const sx of [-1, 1]) base('blk', [sx * 0.022, 0.383, 0.0655], [0.014, 0.009, 0.006], 0x211d1d, 'head', [0, 0, sx * 0.7]);
    if (role === 'child') for (const sx of [-1, 1]) base('blk', [sx * 0.048, 0.39, 0.0655], [0.018, 0.01, 0.005], 0xf2a1a1, 'head');
    const hatted = ['child', 'cyclist', 'hiker', 'worker', 'farmer'].includes(role) || (H && (F.hat || F.suit || ['chief', 'driver', 'fireman'].includes(heroCls)));
    // 方塊頭髮
    if (hatted) base('blk', [0, 0.445, -0.064], [0.146, 0.06, 0.02], hair, 'head');
    else { const styles = MAYOR ? ['side'] : role === 'elder' ? ['short', 'bun', 'short'] : role === 'youth' ? ['beanie', 'long', 'pony', 'puff', 'spiky'] : ['short', 'long', 'bun', 'pony', 'short', 'puff', 'spiky', 'side']; const st = styles[Math.floor(rnd() * styles.length)];
      const top = (h = 0.034, w = 0.148) => base('blk', [0, 0.468 + h / 2 - 0.004, -0.002], [w, h, 0.142], hair, 'head');
      if (st === 'beanie') { const bc = [0xdb6a41, 0x58a6a6, 0xe8c547, 0x6f7fb5][Math.floor(rnd() * 4)]; base('rcap', [0, 0.478, -0.002], [0.152, 0.06, 0.146], bc, 'head'); base('blk', [0, 0.52, -0.002], [0.035, 0.035, 0.035], 0xfff8f0, 'head'); base('blk', [0, 0.445, -0.064], [0.146, 0.06, 0.02], hair, 'head'); }
      else if (st === 'puff') { base('rcap', [0, 0.49, -0.008], [0.172, 0.08, 0.162], hair, 'head'); base('blk', [0, 0.43, -0.07], [0.165, 0.09, 0.03], hair, 'head'); }
      else { top(st === 'spiky' ? 0.03 : 0.034); base('blk', [0, 0.435, -0.064], [0.148, st === 'long' ? 0.16 : 0.075, 0.022], hair, 'head', null); if (st === 'long') base('blk', [0, 0.37, -0.066], [0.148, 0.06, 0.024], hair, 'head');
        base('blk', [st === 'side' ? 0.018 : 0, 0.458, 0.064], [st === 'side' ? 0.11 : 0.148, 0.024, 0.02], hair, 'head'); // 瀏海
        for (const sx of [-1, 1]) base('blk', [sx * 0.07, 0.44, 0.0], [0.014, st === 'long' ? 0.12 : 0.06, 0.13], hair, 'head');
        if (st === 'bun') base('blk', [0, 0.51, -0.035], [0.06, 0.055, 0.06], hair, 'head');
        if (st === 'pony') base('blk', [0, 0.41, -0.092], [0.045, 0.11, 0.04], hair, 'head', [0.25, 0, 0]);
        if (st === 'spiky') for (const [x, z] of [[-0.045, 0.02], [0, -0.01], [0.045, 0.02]]) base('blk', [x, 0.5, z], [0.035, 0.035, 0.05], hair, 'head', [0, 0.785, 0]); } }
    // 隨身物：背包、肩背包、提袋
    if (!H && !MAYOR) { const r2 = rnd(); const bagC = [0xdb6a41, 0x58a6a6, 0xe8c547, 0x6f7fb5, 0x3b3a42][Math.floor(rnd() * 5)];
      if (r2 < 0.18 && role !== 'child' && role !== 'hiker' && role !== 'youth') add('box', [0, 0.215, -0.072], [0.1, 0.12, 0.05], bagC);
      else if (r2 < 0.36) { add('box', [0.083, 0.165, 0.01], [0.028, 0.07, 0.075], bagC); add('box', [0.01, 0.235, 0.005], [0.15, 0.01, 0.012], bagC, null, [0, 0, -0.75]); }
      else if (r2 < 0.5) { add('box', [-0.085, 0.1, 0.02], [0.045, 0.06, 0.03], 0xfbfbf7, 'armL'); add('box', [-0.085, 0.14, 0.02], [0.004, 0.025, 0.02], bagC, 'armL'); } }
    switch (role) {
      case 'elder': add('cyl', [0.105, 0.09, 0.03], [0.012, 0.18, 0.012], 0x7a5a3e, 'armR'); break;
      case 'child': add('cap', [0, 0.39, 0], [0.205, 0.13, 0.195], 0xf1c232, 'head'); add('cyl', [0, 0.39, 0.02], [0.24, 0.008, 0.22], 0xf1c232, 'head'); add('box', [0, 0.2, -0.07], [0.1, 0.11, 0.05], [colors.coral, 0x4a6fa5, 0x58a6a6][Math.floor(rnd() * 3)]); break;
      case 'parent': add('box', [0, 0.1, 0.25], [0.1, 0.08, 0.14], 0x6f7fb5, 'stroller'); add('cap', [0, 0.14, 0.21], [0.11, 0.1, 0.1], 0x58a6a6, 'stroller'); for (const [dx, dz] of [[-0.05, 0.2], [0.05, 0.2], [-0.05, 0.3], [0.05, 0.3]]) add('torus', [dx, 0.03, dz], [0.045, 0.045, 0.045], 0x2a2524, 'wheelX'); add('box', [0, 0.17, 0.13], [0.008, 0.008, 0.12], 0x2a2524, 'stroller', [0.6, 0, 0]); break;
      case 'cyclist': add('cap', [0, 0.385, 0], [0.205, 0.12, 0.195], 0xe8c547, 'head'); { const fc = [0xdb6a41, 0x58a6a6, 0x3b3a42][Math.floor(rnd() * 3)]; for (const dz of [-0.12, 0.12]) add('torus', [0.06, 0.07, dz], [0.14, 0.14, 0.14], 0x2a2524, 'wheelX'); add('box', [0.06, 0.1, 0], [0.012, 0.012, 0.22], fc); add('box', [0.06, 0.13, -0.05], [0.012, 0.09, 0.012], fc, null, [0.4, 0, 0]); add('box', [0.06, 0.15, 0.09], [0.012, 0.1, 0.012], fc, null, [-0.3, 0, 0]); add('box', [0.06, 0.2, 0.11], [0.09, 0.012, 0.012], 0x3b3a42); add('box', [0.06, 0.17, -0.07], [0.03, 0.012, 0.05], 0x3b3a42); } break; // 通勤族：牽著腳踏車
      case 'hiker': add('box', [0, 0.21, -0.075], [0.11, 0.14, 0.07], 0xc06a3a); add('cyl', [0.1, 0.12, 0.03], [0.01, 0.24, 0.01], 0x4a4a52, 'armR'); add('cap', [0, 0.39, 0], [0.214, 0.1, 0.206], 0x58a6a6, 'head'); break;
      case 'worker': add('cap', [0, 0.395, 0], [0.21, 0.13, 0.2], 0xf1c232, 'head'); add('cyl', [0, 0.39, 0.02], [0.22, 0.01, 0.22], 0xf1c232, 'head'); break;
      case 'officeworker': add('cyl', [0.1, 0.16, 0.03], [0.03, 0.05, 0.03], 0xf6efe3, 'armR'); break;
      case 'youth': add('box', [0, 0.21, -0.07], [0.1, 0.1, 0.05], 0x2f3a46); break;
      case 'servant': add('box', [0.032, 0.222, 0.062], [0.026, 0.036, 0.004], 0xfbfbf7); add('box', [0.032, 0.25, 0.061], [0.004, 0.028, 0.004], 0xdb6a41); break; // 老師：背心＋識別證
      case 'researcher': add('box', [0, 0.165, 0.002], [0.146, 0.17, 0.124], 0xfbfbf7); add('box', [0, 0.24, 0.064], [0.03, 0.05, 0.004], 0xa8c4c2); for (const dx of [-0.038, 0.038]) add('torus', [dx, 0.35, 0.09], [0.05, 0.044, 0.05], 0x3b3a42, 'head'); break; // 研究員：白袍＋眼鏡
      case 'farmer': add('cone', [0, 0.43, 0], [0.36, 0.11, 0.36], 0xd9b56a, 'head'); add('cyl', [0, 0.385, 0], [0.22, 0.014, 0.22], 0xc49a4e, 'head'); break; // 農夫：斗笠
      case 'traveler': add('rbox', [0.1, 0.085, -0.13], [0.07, 0.13, 0.11], [0x6f7fb5, 0xdb6a41, 0x58a6a6][Math.floor(rnd() * 3)]); add('box', [0.1, 0.19, -0.1], [0.008, 0.11, 0.008], 0x3b3a42, null, [0.45, 0, 0]); for (const dz of [-0.17, -0.09]) add('eye', [0.1, 0.015, dz], [0.018, 0.018, 0.018], 0x211d1d); break; // 旅客：拖著行李箱
    }
    if (MAYOR) { // 校長：西裝頭（左側分線、頂部往後梳出蓬度、兩側修短）、濃眉；深藍西裝外套蓋到臀部、寬翻領、白襯衫開領不打領帶、胸袋巾；左手麥克風，演講時右手握拳
      add('box', [0, 0.165, 0], [0.142, 0.07, 0.122], 0x26365c);
      for (const sx of [-1, 1]) { add('box', [sx * 0.074, 0.245, 0], [0.05, 0.03, 0.06], 0x26365c); }
      add('box', [0, 0.232, 0.057], [0.044, 0.07, 0.006], 0xfbfbf7); for (const sx of [-1, 1]) add('box', [sx * 0.021, 0.262, 0.057], [0.032, 0.016, 0.006], 0xfbfbf7, null, [0, 0, sx * 0.6]);
      for (const sx of [-1, 1]) { add('box', [sx * 0.033, 0.218, 0.06], [0.026, 0.1, 0.006], 0x34477a, null, [0, 0, sx * -0.4]); add('box', [sx * 0.048, 0.25, 0.058], [0.022, 0.03, 0.006], 0x34477a, null, [0, 0, sx * 0.7]); }
      add('box', [0.042, 0.232, 0.062], [0.02, 0.012, 0.004], 0xfbfbf7); for (const yy of [0.172, 0.148]) add('eye', [0.004, yy, 0.062], [0.009, 0.009, 0.005], 0x0f1626);
      add('cyl', [-0.085, 0.13, 0.05], [0.022, 0.08, 0.022], 0x222222, 'armL', [0.5, 0, 0]); add('eye', [-0.085, 0.175, 0.075], [0.038, 0.038, 0.038], 0x3b3a42, 'armL');
      add('box', [0, 0.035, 0], [0.24, 0.07, 0.18], 0xb48560, 'soap'); add('box', [0, 0.04, 0.091], [0.15, 0.035, 0.004], 0xfff1de, 'soap'); }
    if (H) { const c = H.color;
      add('box', [0, 0.235, 0.058], [0.03, 0.05, 0.004], 0xfbfbf7);
      if (heroCls === 'chief' && !F.hat && !F.suit) { add('cap', [0, 0.39, 0], [0.205, 0.12, 0.195], c, 'head'); add('cyl', [0, 0.39, 0.06], [0.2, 0.008, 0.12], c, 'head'); add('cone', [0.1, 0.2, 0.1], [0.07, 0.1, 0.07], 0xfbfbf7, 'armR', [1.4, 0, 0]); }
      if (heroCls === 'driver' && !F.hat && !F.suit) { add('cap', [0, 0.39, 0], [0.205, 0.11, 0.195], c, 'head'); add('cyl', [0, 0.385, 0.08], [0.18, 0.008, 0.1], 0x211d1d, 'head'); add('box', [0.04, 0.24, 0.056], [0.03, 0.02, 0.004], 0xe8c547); }
      if (heroCls === 'fireman' && !F.hat && !F.suit) { add('cap', [0, 0.385, 0], [0.22, 0.15, 0.21], c, 'head'); add('cyl', [0, 0.36, 0.02], [0.25, 0.012, 0.24], c, 'head'); add('box', [0, 0.41, 0], [0.03, 0.06, 0.16], 0xe8c547, 'head'); add('cyl', [0, 0.19, 0.11], [0.03, 0.2, 0.03], 0x3b3a42, 'carry', [Math.PI / 2, 0, 0]); add('cyl', [0, 0.19, 0.22], [0.045, 0.04, 0.045], 0xbfbfc4, 'carry', [Math.PI / 2, 0, 0]); }
      if (heroCls === 'volunteer') { add('box', [0, 0.17, 0.05], [0.11, 0.15, 0.03], 0xf2b5c6); add('box', [0, 0.17, 0.11], [0.1, 0.07, 0.08], 0xb48560, 'carry'); add('torus', [0, 0.23, 0.11], [0.08, 0.08, 0.08], 0x7a5a3a, 'carry', [0, Math.PI / 2, 0]); add('eye', [0.02, 0.22, 0.12], [0.05, 0.04, 0.05], 0x8fb37a, 'carry'); }
      if (heroCls === 'engineer') { for (const dx of [-0.038, 0.038]) add('torus', [dx, 0.35, 0.09], [0.05, 0.044, 0.05], 0x211d1d, 'head'); add('box', [0, 0.352, 0.091], [0.026, 0.006, 0.006], 0x211d1d, 'head'); add('box', [0, 0.19, 0.1], [0.1, 0.012, 0.07], 0x211d1d, 'carry'); add('box', [0, 0.23, 0.065], [0.1, 0.07, 0.008], 0x211d1d, 'carry', [-0.3, 0, 0]); add('box', [0, 0.23, 0.07], [0.085, 0.055, 0.004], 0x86a8a6, 'carry', [-0.3, 0, 0]); } }
    if (H && (F.hat || F.suit)) { // 換了帽子或套裝：角色的手持道具照樣拿著
      if (heroCls === 'chief') add('cone', [0.1, 0.2, 0.1], [0.07, 0.1, 0.07], 0xfbfbf7, 'armR', [1.4, 0, 0]);
      if (heroCls === 'driver') { add('box', [0.04, 0.24, 0.056], [0.03, 0.02, 0.004], 0xe8c547); }
      if (heroCls === 'fireman') { add('cyl', [0, 0.19, 0.11], [0.03, 0.2, 0.03], 0x3b3a42, 'carry', [Math.PI / 2, 0, 0]); add('cyl', [0, 0.19, 0.22], [0.045, 0.04, 0.045], 0xbfbfc4, 'carry', [Math.PI / 2, 0, 0]); } }
    switch (F.suit ? '' : F.hat) {
      case 'helmet': add('cap', [0, 0.395, 0], [0.21, 0.13, 0.2], 0xf1c232, 'head'); add('cyl', [0, 0.39, 0.02], [0.22, 0.01, 0.22], 0xf1c232, 'head'); break;
      case 'straw': add('cone', [0, 0.43, 0], [0.36, 0.11, 0.36], 0xd9b56a, 'head'); add('cyl', [0, 0.385, 0], [0.22, 0.014, 0.22], 0xc49a4e, 'head'); break;
      case 'cap': add('cap', [0, 0.39, 0], [0.205, 0.12, 0.195], 0x4a6fa5, 'head'); add('cyl', [0, 0.39, 0.06], [0.2, 0.008, 0.12], 0x4a6fa5, 'head'); add('eye', [0, 0.45, 0], [0.03, 0.03, 0.03], 0xfbfbf7, 'head'); break;
      case 'beanie': add('cap', [0, 0.376, -0.008], [0.222, 0.17, 0.218], 0xdb6a41, 'head', [-0.2, 0, 0]); add('eye', [0, 0.465, -0.02], [0.045, 0.045, 0.045], 0xfff8f0, 'head'); break;
      case 'chef': add('cyl', [0, 0.43, 0], [0.17, 0.09, 0.17], 0xfbfbf7, 'head'); add('eye', [0, 0.5, 0], [0.22, 0.1, 0.22], 0xfbfbf7, 'head'); break;
      case 'bunny': for (const sx of [-1, 1]) { add('eye', [sx * 0.05, 0.5, -0.01], [0.042, 0.14, 0.03], 0xfbfbf7, 'head', [0, 0, sx * -0.18]); add('eye', [sx * 0.05, 0.5, 0.004], [0.022, 0.1, 0.012], 0xf2a1a1, 'head', [0, 0, sx * -0.18]); } break;
      case 'egg': add('eye', [0, 0.49, 0], [0.09, 0.12, 0.09], 0xf2c14e, 'head'); add('eye', [0.02, 0.51, 0.03], [0.02, 0.03, 0.01], 0xfff3c4, 'head'); break;
      case 'crown': add('cyl', [0, 0.445, 0], [0.16, 0.05, 0.16], 0xf2c14e, 'head'); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; add('cone', [Math.sin(a) * 0.068, 0.485, Math.cos(a) * 0.068], [0.035, 0.05, 0.035], 0xf2c14e, 'head'); } add('eye', [0, 0.45, 0.08], [0.024, 0.024, 0.01], 0xc23b2a, 'head'); break;
    }
    switch (F.suit ? '' : F.acc) {
      case 'scarf': add('torus', [0, 0.262, 0], [0.09, 0.09, 0.16], 0xdb6a41, null, [Math.PI / 2, 0, 0]); add('box', [0.03, 0.225, 0.06], [0.03, 0.06, 0.012], 0xdb6a41, null, [0, 0, -0.2]); break;
      case 'sash': add('box', [0, 0.205, 0.06], [0.026, 0.17, 0.006], 0xf2c14e, null, [0, 0, 0.72]); add('box', [0, 0.205, -0.056], [0.026, 0.17, 0.006], 0xf2c14e, null, [0, 0, -0.72]); break;
      case 'cape': add('box', [0, 0.19, -0.072], [0.15, 0.17, 0.012], 0xc23b2a, null, [0.14, 0, 0]); add('box', [0, 0.27, -0.06], [0.15, 0.02, 0.03], 0xa3301f); break;
    }
    // 變裝派對套裝（遊戲）
    const D = 0x211d1d;
    switch (F.suit) {
      case 'pumpkin': add('eye', [0, 0.35, 0], [0.25, 0.22, 0.24], 0xe8781e, 'head'); for (const sx of [-1, 1]) add('eye', [sx * 0.075, 0.35, 0.01], [0.14, 0.2, 0.2], 0xd8681a, 'head');
        add('cyl', [0, 0.47, 0], [0.03, 0.06, 0.03], 0x4f7a3a, 'head'); add('box', [0.035, 0.47, 0], [0.05, 0.01, 0.03], 0x6fa14a, 'head', [0, 0.4, 0.3]);
        for (const sx of [-1, 1]) add('box', [sx * 0.045, 0.375, 0.118], [0.032, 0.032, 0.01], 0x2a1505, 'head', [0, 0, 0.785]); add('box', [0, 0.345, 0.122], [0.018, 0.018, 0.01], 0x2a1505, 'head', [0, 0, 0.785]);
        add('box', [0, 0.31, 0.118], [0.1, 0.02, 0.01], 0x2a1505, 'head'); for (const dx of [-0.025, 0.025]) add('box', [dx, 0.318, 0.121], [0.014, 0.014, 0.008], 0xe8781e, 'head'); break;
      case 'zombie': add('box', [0, 0.215, 0.062], [0.022, 0.08, 0.006], 0xc23b2a); add('box', [0.04, 0.17, 0.06], [0.03, 0.025, 0.006], 0x9cc27a); add('box', [-0.045, 0.24, 0.06], [0.02, 0.02, 0.006], 0x9cc27a);
        for (const sx of [-1, 1]) add('eye', [sx * 0.036, 0.334, 0.082], [0.032, 0.012, 0.006], 0x5a7a46, 'head');
        for (const [dx, rz] of [[-0.05, 0.4], [0, 0], [0.05, -0.4]]) add('cone', [dx, 0.45, -0.01], [0.04, 0.07, 0.04], 0x3b3326, 'head', [0, 0, rz]);
        add('box', [0, 0.2, 0.1], [0.09, 0.06, 0.07], 0xfbfbf7, 'carry'); add('box', [0, 0.235, 0.1], [0.092, 0.008, 0.072], 0xe8e2d4, 'carry'); break;
      case 'vampire': add('box', [0, 0.2, -0.075], [0.17, 0.2, 0.014], 0x1a1418, null, [0.14, 0, 0]); add('box', [0, 0.2, -0.066], [0.15, 0.18, 0.006], 0xa3201c, null, [0.14, 0, 0]);
        for (const sx of [-1, 1]) add('box', [sx * 0.068, 0.29, -0.035], [0.06, 0.08, 0.012], 0xa3201c, null, [0, sx * 0.5, 0]);
        add('cone', [0, 0.42, 0.075], [0.045, 0.04, 0.02], 0x111111, 'head', [Math.PI, 0, 0]); for (const sx of [-1, 1]) add('box', [sx * 0.012, 0.309, 0.087], [0.008, 0.016, 0.004], 0xffffff, 'head');
        add('eye', [0, 0.17, 0.1], [0.08, 0.09, 0.08], 0xc9a050, 'carry'); add('box', [0, 0.215, 0.1], [0.03, 0.02, 0.03], 0x8a6a2a, 'carry'); break; // 手上一袋房租
      case 'ghost': add('eye', [0, 0.36, 0], [0.26, 0.27, 0.25], 0xf7f7f2, 'head'); add('cone', [0, 0.17, 0], [0.36, 0.38, 0.34], 0xf7f7f2);
        for (const sx of [-1, 1]) add('eye', [sx * 0.045, 0.37, 0.122], [0.035, 0.05, 0.01], D, 'head'); add('eye', [0, 0.31, 0.123], [0.03, 0.04, 0.01], D, 'head');
        add('cyl', [0, 0.22, 0.13], [0.01, 0.2, 0.01], 0x7a5a3e, 'carry'); add('box', [0, 0.33, 0.13], [0.15, 0.09, 0.008], 0xfff8e0, 'carry'); for (const yy of [0.345, 0.315]) add('box', [0, yy, 0.135], [0.11, 0.012, 0.004], yy > 0.33 ? 0x2f6f9f : 0xc23b2a, 'carry'); break; // 舉著「求颱風假」牌子
      case 'witch': add('cyl', [0, 0.4, 0], [0.34, 0.012, 0.34], 0x2b2238, 'head'); add('cone', [0, 0.5, -0.01], [0.2, 0.24, 0.2], 0x2b2238, 'head', [-0.2, 0, 0]); add('cyl', [0, 0.42, 0], [0.21, 0.022, 0.21], 0x8a6fc0, 'head');
        add('cyl', [0.09, 0.15, 0.06], [0.012, 0.34, 0.012], 0x8a6a4a, null, [0.4, 0, 0.5]); add('cone', [0.17, 0.03, 0.13], [0.07, 0.09, 0.07], 0xd9b56a, null, [0.4, 0, 0.5]); add('box', [0.04, 0.24, 0.0], [0.035, 0.022, 0.01], 0x58a6a6, null, [0.4, 0, 0.5]); break; // 掃把上綁著感應卡
      case 'mummy': for (const [y, rz] of [[0.14, 0.12], [0.18, -0.15], [0.22, 0.1], [0.26, -0.12]]) add('box', [0, y, 0.003], [0.145, 0.012, 0.124], 0xd9cfb8, null, [0, 0, rz]);
        for (const [y, rz] of [[0.3, 0.15], [0.4, -0.12], [0.43, 0.2]]) add('box', [0, y, 0], [0.2, 0.014, 0.185], 0xd9cfb8, 'head', [0, 0, rz]); add('box', [-0.03, 0.352, 0.07], [0.09, 0.016, 0.05], 0xd9cfb8, 'head', [0, 0, 0.35]);
        for (const sx of [-1, 1]) add('box', [sx * 0.077, 0.19, 0], [0.04, 0.012, 0.042], 0xd9cfb8, sx < 0 ? 'armL' : 'armR');
        add('box', [0, 0.2, 0.1], [0.1, 0.07, 0.012], 0x5a7fb5, 'carry'); add('box', [0.025, 0.21, 0.107], [0.025, 0.025, 0.004], 0xc23b2a, 'carry'); break; // 抱著蓋到一半的公文
      case 'boba': add('cyl', [0, 0.17, 0], [0.21, 0.27, 0.21], 0xd9b48a); add('cyl', [0, 0.21, 0], [0.215, 0.05, 0.215], 0xfbfbf7); add('cyl', [0, 0.31, 0], [0.22, 0.015, 0.22], 0xf6efe3);
        for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 1.6 - Math.PI * 0.8; add('eye', [Math.sin(a) * 0.1, 0.06 + (k % 2) * 0.03, Math.cos(a) * 0.1], [0.032, 0.032, 0.032], 0x2a1a14); }
        add('cyl', [0.05, 0.5, 0], [0.03, 0.22, 0.03], 0xdb6a41, 'head', [0, 0, -0.35]); break;
      case 'cone': add('box', [0, 0.405, 0], [0.27, 0.025, 0.27], 0xf28b2e, 'head'); add('cone', [0, 0.49, 0], [0.24, 0.3, 0.24], 0xf28b2e, 'head'); add('cyl', [0, 0.49, 0], [0.155, 0.025, 0.155], 0xfbfbf7, 'head'); add('cyl', [0, 0.55, 0], [0.1, 0.02, 0.1], 0xfbfbf7, 'head');
        for (const y of [0.18, 0.225]) add('box', [0, y, 0.06], [0.132, 0.014, 0.006], 0xe8f0d0); add('cyl', [0.1, 0.17, 0.06], [0.012, 0.25, 0.012], 0x7a5a3e); add('box', [0.1, 0.045, 0.06], [0.05, 0.06, 0.01], 0x9aa0a8); break; // 拿著鏟子準備再挖一次
      case 'truck': add('box', [0, 0.19, 0], [0.21, 0.18, 0.26], 0xe8c547); add('box', [0, 0.24, 0.131], [0.15, 0.06, 0.004], 0x86a8a6); add('box', [0, 0.13, 0], [0.215, 0.02, 0.265], 0x4f8a3f);
        for (const sx of [-1, 1]) { add('eye', [sx * 0.07, 0.15, 0.132], [0.025, 0.025, 0.01], 0xfff3c4); for (const sz of [-0.08, 0.08]) add('cyl', [sx * 0.108, 0.07, sz], [0.05, 0.02, 0.05], D, null, [0, 0, Math.PI / 2]); }
        for (const [x, y] of [[0.08, 0.5], [-0.07, 0.53]]) { add('eye', [x, y, 0], [0.04, 0.03, 0.03], D, 'head'); add('box', [x + 0.016, y + 0.04, 0], [0.008, 0.07, 0.008], D, 'head'); } break; // 頭上飄著音符
      case 'bat': for (const sx of [-1, 1]) { add('box', [sx * 0.15, 0.25, -0.06], [0.18, 0.13, 0.012], 0x2b2238, null, [0, sx * 0.4, sx * 0.35]); add('cone', [sx * 0.06, 0.47, 0], [0.05, 0.09, 0.03], 0x2b2238, 'head', [0, 0, sx * -0.2]); add('box', [sx * 0.012, 0.309, 0.087], [0.008, 0.014, 0.004], 0xffffff, 'head'); }
        add('cyl', [0.09, 0.2, 0.08], [0.01, 0.14, 0.01], 0xc49a4e, 'armR'); for (const y of [0.24, 0.27]) add('eye', [0.09, y, 0.08], [0.03, 0.03, 0.03], 0xb5652a, 'armR'); break; // 手上一串夜市烤肉
      // ── 以下是要花金蛋的變裝派對套裝 ──
      case 'bag': add('box', [0, 0.36, 0], [0.25, 0.27, 0.24], 0xc9a46a, 'head'); add('box', [0, 0.495, 0], [0.26, 0.02, 0.25], 0xb8935a, 'head'); for (const sx of [-1, 1]) add('box', [sx * 0.045, 0.38, 0.121], [0.035, 0.025, 0.01], D, 'head');
        for (const [x, y] of [[0.06, 0.31], [-0.07, 0.44], [0.08, 0.45]]) add('eye', [x, y, 0.121], [0.04, 0.03, 0.006], 0xa9844a, 'head'); add('cyl', [0.09, 0.2, 0.08], [0.008, 0.14, 0.008], 0xc49a4e, 'armR'); break;
      case 'cutlet': add('box', [0, 0.2, 0.075], [0.26, 0.3, 0.03], 0xc9852e, null, [0.1, 0, 0.15]); for (const [x, y] of [[-0.07, 0.27], [0.05, 0.14], [0.08, 0.28], [-0.04, 0.12]]) add('eye', [x, y, 0.095], [0.05, 0.04, 0.02], 0xb5752a, null); break;
      case 'poncho': add('cone', [0, 0.16, 0], [0.34, 0.36, 0.3], 0x8fd3e8); add('cap', [0, 0.37, -0.01], [0.23, 0.2, 0.22], 0x8fd3e8, 'head'); add('box', [0, 0.32, 0.1], [0.12, 0.012, 0.012], 0x6ab7cc, 'head'); break;
      case 'delivery': add('box', [0, 0.24, -0.11], [0.2, 0.2, 0.16], 0xf28b2e); add('box', [0, 0.24, -0.028], [0.205, 0.03, 0.005], 0xfbfbf7); add('cap', [0, 0.39, 0], [0.21, 0.13, 0.2], 0xf28b2e, 'head'); add('box', [0, 0.36, 0.1], [0.16, 0.035, 0.012], 0x2b2b30, 'head'); break;
      case 'card': add('box', [0, 0.2, 0.068], [0.2, 0.26, 0.012], 0x2f6f9f, null, [0, 0, 0.08]); add('box', [-0.04, 0.25, 0.075], [0.04, 0.03, 0.004], 0xe8c547, null, [0, 0, 0.08]); add('box', [0, 0.13, 0.075], [0.14, 0.02, 0.004], 0xc23b2a, null, [0, 0, 0.08]); break;
      case 'firework': add('box', [0, 0.45, 0], [0.09, 0.12, 0.09], 0xbfd6df, 'head'); add('box', [0, 0.53, 0], [0.065, 0.08, 0.065], 0x9fc4c6, 'head'); add('cyl', [0, 0.6, 0], [0.012, 0.08, 0.012], 0x9aa0a8, 'head');
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add('eye', [Math.cos(a) * 0.09, 0.64 + (k % 2) * 0.02, Math.sin(a) * 0.09], [0.03, 0.03, 0.03], [0xfcea8b, 0xdb6a41, 0x58a6a6, 0xf2a1a1][k % 4], 'head'); } break;
      case 'bear': add('cap', [0, 0.37, -0.01], [0.23, 0.22, 0.22], 0x1d1a1a, 'head', [-0.2, 0, 0]); for (const sx of [-1, 1]) { add('eye', [sx * 0.08, 0.465, -0.01], [0.06, 0.06, 0.04], 0x1d1a1a, 'head'); add('box', [sx * 0.025, 0.245, 0.06], [0.012, 0.07, 0.006], 0xf6efe3, null, [0, 0, sx * 0.6]); } break;
      case 'leopard': add('cap', [0, 0.37, -0.01], [0.23, 0.21, 0.22], 0xc9955a, 'head', [-0.2, 0, 0]); for (const sx of [-1, 1]) { add('cone', [sx * 0.07, 0.465, 0], [0.05, 0.07, 0.03], 0xc9955a, 'head'); add('box', [sx * 0.02, 0.43, 0.06], [0.01, 0.05, 0.01], 0xf6efe3, 'head'); }
        for (const [x, y] of [[-0.04, 0.17], [0.04, 0.23], [0.0, 0.14], [-0.03, 0.25]]) add('eye', [x, y, 0.06], [0.022, 0.022, 0.006], 0x5a3a1e); add('cyl', [0, 0.12, -0.1], [0.022, 0.18, 0.022], 0xc9955a, null, [1.1, 0, 0]); break;
      case 'pigeon': add('eye', [0, 0.36, 0], [0.24, 0.24, 0.23], 0x8a8f99, 'head'); add('cyl', [0, 0.27, 0], [0.16, 0.04, 0.16], 0x4f8a7a); add('cone', [0, 0.35, 0.13], [0.04, 0.06, 0.04], 0xe8b04a, 'head', [Math.PI / 2, 0, 0]);
        for (const sx of [-1, 1]) add('eye', [sx * 0.05, 0.38, 0.11], [0.03, 0.03, 0.01], 0xe8781e, 'head'); break;
      case 'nightshift': add('cap', [0, 0.39, 0], [0.205, 0.12, 0.195], 0x4f8a3f, 'head'); add('cyl', [0, 0.39, 0.06], [0.2, 0.008, 0.12], 0x4f8a3f, 'head'); for (const [y, c] of [[0.18, 0x4f8a3f], [0.215, 0xdb6a41], [0.25, 0x4f8a3f]]) add('box', [0, y, 0.06], [0.132, 0.014, 0.006], c);
        add('box', [0.035, 0.235, 0.064], [0.03, 0.02, 0.004], 0xfbfbf7); break;
      case 'parking': for (const sz of [-1, 1]) add('box', [0, 0.006, sz * 0.18], [0.27, 0.004, 0.025], 0xfbfbf7); for (const sx of [-1, 1]) add('box', [sx * 0.13, 0.006, 0], [0.025, 0.004, 0.36], 0xfbfbf7);
        add('cyl', [0, 0.47, 0], [0.01, 0.1, 0.01], 0x9aa0a8, 'head'); add('box', [0, 0.54, 0], [0.1, 0.1, 0.012], 0x2f6f9f, 'head'); add('box', [-0.012, 0.54, 0.007], [0.014, 0.065, 0.004], 0xfbfbf7, 'head'); add('box', [0.008, 0.56, 0.007], [0.03, 0.03, 0.004], 0xfbfbf7, 'head'); break;
      case 'duck': add('eye', [0, 0.18, 0], [0.26, 0.24, 0.28], 0xf2d23c); add('eye', [0, 0.36, 0], [0.24, 0.24, 0.23], 0xf2d23c, 'head'); add('box', [0, 0.33, 0.13], [0.1, 0.03, 0.07], 0xf28b2e, 'head'); for (const sx of [-1, 1]) add('eye', [sx * 0.05, 0.39, 0.11], [0.025, 0.025, 0.01], D, 'head'); add('cone', [0, 0.2, -0.14], [0.08, 0.08, 0.06], 0xf2d23c, null, [-1.2, 0, 0]); break;
      case 'taro': for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; add('eye', [Math.cos(a) * 0.07, 0.45 + (k % 3) * 0.02, Math.sin(a) * 0.07], [0.06, 0.05, 0.06], k % 2 ? 0x9a7ab5 : 0xe8b46a, 'head'); } add('eye', [0, 0.5, 0], [0.06, 0.05, 0.06], 0xb79ad0, 'head'); break;
      case 'tofu': add('box', [0, 0.37, 0], [0.24, 0.24, 0.24], 0xc98a3a, 'head'); for (const [x, y] of [[-0.05, 0.42], [0.06, 0.33], [0.03, 0.44], [-0.06, 0.31]]) add('eye', [x, y, 0.121], [0.025, 0.025, 0.006], 0x8a5a22, 'head'); for (const sx of [-1, 1]) add('box', [sx * 0.045, 0.375, 0.122], [0.03, 0.018, 0.006], D, 'head');
        for (let k = 0; k < 3; k++) add('eye', [(k - 1) * 0.05, 0.53 + k * 0.03, 0], [0.04, 0.04, 0.04], 0xf6f6f2, 'head'); break;
      case 'prince': add('eye', [0, 0.37, 0], [0.3, 0.29, 0.28], 0xf6d0c0, 'head'); for (const sx of [-1, 1]) add('eye', [sx * 0.08, 0.33, 0.115], [0.05, 0.03, 0.01], 0xf2a1a1, 'head'); add('box', [0, 0.385, 0.14], [0.2, 0.045, 0.01], D, 'head');
        add('cyl', [0, 0.52, 0], [0.18, 0.06, 0.18], 0xf2c14e, 'head'); for (let k = 0; k < 3; k++) add('eye', [(k - 1) * 0.06, 0.52, 0.09], [0.025, 0.025, 0.01], 0xc23b2a, 'head'); add('cone', [0, 0.16, 0], [0.34, 0.32, 0.3], 0xc23b2a); add('cyl', [0, 0.04, 0], [0.33, 0.02, 0.3], 0xf2c14e); break;
      case 'megaphone': add('cone', [0, 0.47, 0.06], [0.11, 0.16, 0.11], 0xfbfbf7, 'head', [-1.25, 0, 0]); add('cyl', [0, 0.45, -0.02], [0.04, 0.06, 0.04], 0xc23b2a, 'head', [-1.25, 0, 0]); add('box', [0, 0.205, 0.06], [0.026, 0.17, 0.006], 0xfbfbf7, null, [0, 0, 0.72]); break;
      case 'pumpbus': add('eye', [0, 0.17, 0], [0.32, 0.28, 0.32], 0xe8781e); for (const sx of [-1, 1]) add('box', [sx * 0.06, 0.2, 0.155], [0.07, 0.05, 0.01], 0x86a8a6); add('cyl', [0, 0.33, 0], [0.03, 0.05, 0.03], 0x4f7a3a);
        add('cap', [0, 0.39, 0], [0.205, 0.11, 0.195], 0x2f6f9f, 'head'); add('cyl', [0, 0.385, 0.08], [0.18, 0.008, 0.1], D, 'head'); break;
      case 'skeleton': add('box', [0, 0.2, 0.062], [0.012, 0.11, 0.006], 0xf4f1ea); for (let k = 0; k < 3; k++) add('box', [0, 0.17 + k * 0.03, 0.061], [0.09 - k * 0.008, 0.008, 0.006], 0xf4f1ea);
        for (const sx of [-1, 1]) { add('eye', [sx * 0.036, 0.35, 0.084], [0.038, 0.036, 0.008], D, 'head'); add('box', [sx * 0.077, 0.2, 0.02], [0.008, 0.08, 0.004], 0xf4f1ea, sx < 0 ? 'armL' : 'armR'); add('box', [sx * 0.032, 0.07, 0.03], [0.008, 0.1, 0.004], 0xf4f1ea, sx < 0 ? 'legL' : 'legR'); }
        add('box', [0, 0.33, 0.088], [0.012, 0.016, 0.006], D, 'head'); break;
      case 'alien': for (const sx of [-1, 1]) { add('cyl', [sx * 0.04, 0.48, 0], [0.008, 0.08, 0.008], 0x6aa04a, 'head', [0, 0, sx * -0.25]); add('eye', [sx * 0.06, 0.53, 0], [0.03, 0.03, 0.03], 0xfcea8b, 'head'); add('eye', [sx * 0.04, 0.355, 0.083], [0.05, 0.035, 0.01], D, 'head', [0, 0, sx * -0.3]); }
        add('box', [0, 0.2, 0.1], [0.06, 0.05, 0.06], 0xfbfbf7, 'carry'); add('cone', [0, 0.25, 0.1], [0.07, 0.04, 0.07], 0xdb6a41, 'carry'); break; // 手上捧著一棟小房子
      case 'lantern': add('cyl', [0, 0.48, 0], [0.2, 0.2, 0.2], 0xfff0c2, 'head'); add('cyl', [0, 0.585, 0], [0.16, 0.012, 0.16], 0xe8c547, 'head'); for (const y of [0.45, 0.5]) add('box', [0, y, 0.1], [0.06, 0.012, 0.006], 0xc23b2a, 'head'); add('box', [0.03, 0.475, 0.1], [0.012, 0.05, 0.006], 0xc23b2a, 'head'); break;
    }
    // 配件換算到方塊人：頭上的以頭心縮放、手上的往外移到方塊手臂、身上的照身體比例放大；半球形的帽子換成方塊帽，大的（兜帽）整個罩住頭
    const HC0 = 0.345, KH = 0.72, HEADY = 0.40, HEADTOP = 0.4685;
    for (const pt of P) { if (pt.base) continue; const [x, y, z] = pt.off, [sx, sy, sz] = pt.s;
      if (pt.ch === 'head') { pt.off = [x * KH, HEADY + (y - HC0) * KH, z * KH]; pt.s = [sx * KH, sy * KH, sz * KH];
        if (pt.g === 'cap') { pt.g = 'rcap'; pt.r = null; if (sy >= 0.19) { pt.s = [0.156, 0.15, 0.15]; pt.off = [0, HEADY + 0.008, -0.002]; } else { const h = Math.max(0.03, sy * KH * 0.6); pt.s = [Math.max(sx * KH, 0.152), h, Math.max(sz * KH, 0.146)]; pt.off = [pt.off[0], Math.max(pt.off[1], HEADTOP + h / 2 - 0.01), pt.off[2]]; } } }
      else if (pt.ch === 'armL' || pt.ch === 'armR') { const sg = pt.ch === 'armL' ? -1 : 1; pt.off = [x + sg * 0.048, y * 1.25, z]; pt.s = [sx * 1.1, sy * 1.25, sz]; }
      else if (pt.ch === 'legL' || pt.ch === 'legR') { pt.off = [x * 1.35, y * 1.3, z]; pt.s = [sx * 1.3, sy * 1.3, sz]; }
      else { pt.off = [x * 1.2, y * 1.25, z * 0.85]; pt.s = [sx * 1.2, sy * 1.25, sz * 0.9]; } }
    return { parts: P, scale: sc };
  }
  // ── 實例化 ──
  let meshes = {}, shadowMesh = null, people = [];
  function build(list) { dispose(); people = list; const counts = {}; for (const w of people) for (const pt of w.plan.parts) counts[pt.g] = (counts[pt.g] || 0) + 1;
    for (const [g, n] of Object.entries(counts)) { const m = new THREE.InstancedMesh(G[g], mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = g !== 'eye'; m.frustumCulled = false; scene.add(m); meshes[g] = { mesh: m, n: 0 }; if (g !== 'eye') { meshes[g].ol = instancedOutline(m); scene.add(meshes[g].ol); } }
    shadowMesh = new THREE.InstancedMesh(G.shadow, shadowMat, people.length); shadowMesh.frustumCulled = false; shadowMesh.renderOrder = 1; scene.add(shadowMesh);
    for (const w of people) for (const pt of w.plan.parts) { const slot = meshes[pt.g]; pt.idx = slot.n++; slot.mesh.setColorAt(pt.idx, new THREE.Color(pt.c)); pt.L0 = null; }
    for (const s of Object.values(meshes)) s.mesh.instanceColor.needsUpdate = true; }
  function dispose() { for (const s of Object.values(meshes)) { scene.remove(s.mesh); if (s.ol) scene.remove(s.ol); } if (shadowMesh) scene.remove(shadowMesh); meshes = {}; shadowMesh = null; people = []; }
  const dummy = new THREE.Object3D(), base = new THREE.Matrix4(), local = new THREE.Matrix4(), tmp = new THREE.Matrix4(), piv = new THREE.Matrix4(), unpiv = new THREE.Matrix4(), rot = new THREE.Matrix4();
  const pivots = { legL: 0.17, legR: 0.17, armL: 0.33, armR: 0.33, head: 0.33 };
  function update(dt, time, zoom = 1) {
    for (const [pi, w] of people.entries()) {
      const p = w.pos; const moving = w.moving && !w.down ? 1 : 0; const ph = (time * 9 + w.phase * 20) * (moving || (w.pose === 'fight' ? 1 : 0)); const bob = moving ? Math.abs(Math.sin(ph)) * 0.012 : 0; const sc = w.plan.scale * 0.8 * zoom;
      const lift = w.onBox ? 0.07 * sc : 0;
      dummy.rotation.order = 'YXZ'; if (w.down) { dummy.position.set(p.x, p.y + 0.05 * sc, p.z); dummy.rotation.set(-1.45, w.yaw, 0); } else { dummy.position.set(p.x, p.y + bob + lift, p.z); dummy.rotation.set(0, w.yaw, 0); } // 闖關倒下：整個人躺平
      dummy.scale.setScalar(sc); dummy.updateMatrix(); base.copy(dummy.matrix);
      for (const pt of w.plan.parts) { let ang = 0, axis = 'x';
        if (moving) { if (pt.ch === 'legL') ang = Math.sin(ph) * 0.7; if (pt.ch === 'legR') ang = -Math.sin(ph) * 0.7; if (pt.ch === 'armL') ang = -Math.sin(ph) * 0.7; if (pt.ch === 'armR') ang = Math.sin(ph) * 0.7; } // Roblox 走路：手腳直直地大幅擺動
        if (pt.ch === 'head') ang = Math.sin(time * 1.3 + w.phase * 9) * 0.06;
        if (w.pose === 'fight') { if (pt.ch === 'armR') { axis = 'z'; ang = 2.2 + Math.sin(time * 14 + w.phase * 9) * 0.6; } if (pt.ch === 'armL') ang = -0.8; }
        if (w.pose === 'wave' && pt.ch === 'armR') { axis = 'z'; ang = 2.5 + Math.sin(time * 5 + w.phase * 9) * 0.35; }
        if (!pt.L0) pt.L0 = new THREE.Matrix4().compose(new THREE.Vector3(...pt.off), pt.r ? new THREE.Quaternion().setFromEuler(new THREE.Euler(...pt.r)) : new THREE.Quaternion(), new THREE.Vector3(...pt.s));
        local.copy(pt.L0); if (pt.ch === 'wheelX') local.multiply(rot.makeRotationY(Math.PI / 2));
        if (pt.ch === 'soap') { if (!w.onBox) local.makeScale(0, 0, 0); else local.premultiply(rot.makeTranslation(0, -0.07, 0)); }
        if (ang && pivots[pt.ch] !== undefined) { const py = pivots[pt.ch]; const px = axis === 'z' && (pt.ch === 'armL' || pt.ch === 'armR') ? (pt.ch === 'armL' ? -0.125 : 0.125) : 0; piv.makeTranslation(px, py, 0); unpiv.makeTranslation(-px, -py, 0); if (axis === 'z') rot.makeRotationZ(ang); else rot.makeRotationX(ang); tmp.multiplyMatrices(piv, rot).multiply(unpiv).multiply(local); local.copy(tmp); }
        tmp.multiplyMatrices(base, local); meshes[pt.g].mesh.setMatrixAt(pt.idx, tmp); }
      dummy.position.set(p.x, p.y + 0.02, p.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.2 * sc); dummy.updateMatrix(); shadowMesh.setMatrixAt(pi, dummy.matrix);
      if (w.sprite) { w.sprite.position.set(p.x, p.y + 0.66 * sc + bob, p.z); w.sprite.scale.set(w.sprite.userData.w0 * zoom, w.sprite.userData.h0 * zoom, 1); }
    }
    for (const s of Object.values(meshes)) s.mesh.instanceMatrix.needsUpdate = true; if (shadowMesh) shadowMesh.instanceMatrix.needsUpdate = true;
  }
  function makeWalker(role, pos, heroCls = null, fit = '') { return { role, hero: !!heroCls, fit: fit || '', plan: plan(role, heroCls, fit), pos: pos.clone(), yaw: rnd() * 6.28, moving: false, pose: null, phase: rnd() }; }
  return { makeWalker, build, dispose, update, get people() { return people; }, reseed: (s) => { rnd = mulberry(s); } };
}
