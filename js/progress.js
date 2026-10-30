/* 學習進度與場景解鎖（記在這台裝置上）：每個場景（學期島）累計答對幾題；
   一個鎖住的場景，只要有任何一個相鄰（上下左右）已解鎖的場景答對滿 config.unlock.need 題就解鎖。
   一開始就開的：config.unlock.free 的場景、自己選的學期（home）、蓋好的新校區。 */
import { CONFIG as C } from './config.js';
const KEY = 'pi.progress.v1';
export function createProgress({ islands, neighbors, onUnlock }) {
  let st = { solved: {}, unlocked: [] }; try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && typeof d === 'object') st = { solved: d.solved || {}, unlocked: Array.isArray(d.unlocked) ? d.unlocked : [] }; } catch (e) { /* 無痕 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 無痕 */ } };
  let home = null; const extra = new Set();
  const base = () => new Set([...C.unlock.free, ...(home ? [home] : []), ...st.unlocked, ...extra]);
  const isUnlocked = id => base().has(id);
  const solved = id => st.solved[id] | 0;
  // 鎖住的場景要靠哪個相鄰場景解鎖（挑已解鎖、答對最多的那個）
  function keyFor(id) { const nb = (neighbors.get(id) || []).map(n => n.id).filter(Boolean); const open = nb.filter(isUnlocked); if (!open.length) return null; return open.sort((a, b) => solved(b) - solved(a))[0]; }
  function check() { const out = []; for (const i of islands) { if (isUnlocked(i.id)) continue; const k = keyFor(i.id); if (k && solved(k) >= C.unlock.need) { st.unlocked.push(i.id); out.push(i.id); } } if (out.length) { save(); for (const id of out) onUnlock && onUnlock(id); } return out; }
  return {
    setHome(id) { home = id; check(); }, addExtra(id) { extra.add(id); },
    isUnlocked, solved, keyFor,
    // 答對一題：記到那個場景，順便看有沒有解鎖新場景（回傳新解鎖的場景 id 陣列）
    add(id, n = 1) { if (!id) return []; st.solved[id] = solved(id) + n; save(); return check(); },
    // 鎖住的場景要怎麼解：{ by: 相鄰場景 id, need, have }
    hint(id) { const k = keyFor(id); return k ? { by: k, need: C.unlock.need, have: solved(k) } : null; },
    get state() { return st; } };
}
