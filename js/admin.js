/* 後台：Supabase email／密碼登入；權限由資料庫 is_admin()（admins 名單）把關，前端不存任何密碼。
   課程與挑戰 = config 預設 + 資料庫覆寫；預設項目不能真的刪，改成 hidden:true 隱藏。 */
import { CONFIG as C } from './config.js';
const B = window.PI_BACKEND || {}; const $ = id => document.getElementById(id);
const esc = s => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
const DISTRICT = Object.fromEntries(C.islands.map(i => [i.id, i.name]));
const MODELS = ['housing','nursery','elderhome','busstop','dome','techcampus','school','smartpole','garden','crane','containers','theater','kiosk','station','crossing','nightmarket','hub','card','court','bigtree','levee'];
let sb = null, rows = { policies: [], issues: [], heroes: [] };

async function boot() {
  if (!B.supabaseUrl || !B.supabaseAnonKey) { $('loginMsg').textContent = '後端尚未設定（js/backend.js）。'; $('loginMsg').className = 'msg bad'; return; }
  const { createClient } = await import(B.supabaseJs);
  sb = createClient(B.supabaseUrl, B.supabaseAnonKey, { auth: { storageKey: 'pi-admin-auth', persistSession: true, autoRefreshToken: true } });
  fillSelects();
  const { data: { session } } = await sb.auth.getSession();
  if (session && !session.user.is_anonymous) await enter(session.user); 
}
const fillIssueOptions = list => { const el = $('polIssue'), cur = el.value; el.innerHTML = '<option value="">無</option>' + list.map(i => `<option value="${esc(i.id)}">${esc(i.tag || '')} ${esc(i.title || i.id)}</option>`).join(''); el.value = cur; };
function fillSelects() {
  fillIssueOptions(C.issues);
  $('polModel').innerHTML = MODELS.map(m => `<option>${m}</option>`).join('');
  $('polDistrict').innerHTML = '<option value="">不指定（隨機落島）</option>' + C.islands.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
  $('issBoss').innerHTML = '<option value="">無</option>' + Object.entries(C.animals).filter(([, a]) => a.boss).map(([k, a]) => `<option value="${k}">${esc(a.name)}</option>`).join('');
  $('issRoutes').innerHTML = '<legend>登陸方向</legend>' + Object.entries(C.landings).map(([k, l]) => `<label><input type="checkbox" name="routes" value="${k}">${esc(l.name)}</label>`).join('');
}
$('loginForm').addEventListener('submit', async ev => { ev.preventDefault(); const msg = $('loginMsg'); msg.className = 'msg'; msg.textContent = '登入中…';
  const { data, error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
  $('password').value = '';
  if (error) { msg.className = 'msg bad'; msg.textContent = error.message === 'Invalid login credentials' ? '帳號或密碼錯誤。' : '登入失敗：' + error.message; return; }
  await enter(data.user); });
$('btnLogout').addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });
async function enter(user) {
  const { data: ok, error } = await sb.rpc('is_admin');
  if (error || !ok) { $('loginMsg').className = 'msg bad'; $('loginMsg').textContent = error ? '無法確認權限：' + error.message + '（是否執行過 supabase/admin.sql？）' : '這個帳號不是管理員。'; await sb.auth.signOut(); return; }
  $('login').hidden = true; $('app').hidden = false; $('who').hidden = false; $('whoEmail').textContent = user.email; await loadAll();
}
async function loadAll() {
  const [p, i, h] = await Promise.all([sb.from('policies').select('id,data,updated_at'), sb.from('issues').select('id,data,updated_at'), sb.from('heroes').select('id,nick,cls,shifts,eggs,clears,gift,donated,built,spent,last_at').order('last_at', { ascending: false }).limit(1000)]);
  let hh = h; if (h.error && /gift|donated|built|spent/.test(h.error.message || '')) hh = await sb.from('heroes').select('id,nick,cls,shifts,eggs,clears,last_at').order('last_at', { ascending: false }).limit(1000); // 還沒跑新版 supabase/economy.sql
  if (hh.error && /shifts|eggs|clears/.test(hh.error.message || '')) hh = await sb.from('heroes').select('id,nick,cls,last_at').order('last_at', { ascending: false }).limit(1000); // 還沒跑 supabase/shifts.sql
  rows.policies = p.data || []; rows.issues = i.data || []; rows.heroes = hh.data || []; render();
}
const merged = (defaults, dbRows) => { const map = new Map(defaults.map(d => [d.id, { ...d, _src: 'config' }])); for (const r of dbRows) map.set(r.id, { ...(map.get(r.id) || {}), ...(r.data || {}), id: r.id, _src: map.has(r.id) ? 'override' : 'db' }); return [...map.values()]; };
const srcPill = x => x.hidden ? '<span class="pill hid">已隱藏</span>' : x._src === 'config' ? '<span class="pill">預設</span>' : x._src === 'override' ? '<span class="pill db">預設＋後台修改</span>' : '<span class="pill db">後台新增</span>';
function render() {
  const pols = merged(C.policies, rows.policies), iss = merged(C.issues, rows.issues), H = rows.heroes;
  $('stats').innerHTML = [[pols.filter(x => !x.hidden).length, '課程'], [iss.filter(x => !x.hidden).length, '挑戰'], [H.length, '位小學生'], [H.reduce((a, h) => a + (h.shifts || 0), 0), '關'], [H.reduce((a, h) => a + (h.eggs || 0), 0), '顆金蛋']].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join('');
  $('polRows').innerHTML = pols.map(x => `<tr><td><b>${esc(x.title)}</b><br><small>${esc(x.id)}</small></td><td class="tag">${esc(x.tag || '')}</td><td>${esc(DISTRICT[x.district] || '隨機')}</td><td>${esc(x.model || '')}</td><td>${srcPill(x)}</td><td class="act"><button class="btn ghost sm" data-edit-pol="${esc(x.id)}">編輯</button> ${x.hidden ? `<button class="btn ghost sm" data-show-pol="${esc(x.id)}">恢復</button>` : x._src === 'db' ? `<button class="btn danger sm" data-del-pol="${esc(x.id)}">刪除</button>` : `<button class="btn danger sm" data-hide-pol="${esc(x.id)}">隱藏</button>`}</td></tr>`).join('');
  $('issRows').innerHTML = iss.map(x => `<tr><td><b>${esc(x.title)}</b><br><small>${esc(x.id)}</small></td><td class="tag">${esc(x.tag || '')}</td><td>${x.startsAt ? esc(x.startsAt) : x.id === C.exam.finalIssueId ? '期末考前夜' : '—'}</td><td class="num">${x.intensity || 1}</td><td>${srcPill(x)}</td><td class="act"><button class="btn ghost sm" data-edit-iss="${esc(x.id)}">編輯</button> ${x.hidden ? `<button class="btn ghost sm" data-show-iss="${esc(x.id)}">恢復</button>` : x._src === 'db' ? `<button class="btn danger sm" data-del-iss="${esc(x.id)}">刪除</button>` : `<button class="btn danger sm" data-hide-iss="${esc(x.id)}">隱藏</button>`}</td></tr>`).join('');
  renderHeroes();
  window.__merged = { pols, iss }; fillIssueOptions(iss);
}
// 學生資料：可以用暱稱搜尋；GM 發金蛋記在 gift（錢包＝金蛋＋GM 發的−花掉的），不算闖關榜與學期對抗
const walletOf = h => h.gift == null ? null : (h.eggs || 0) + (h.gift || 0) - (h.donated || 0) - (h.built || 0) - (h.spent || 0);
function renderHeroes() { const q = $('heroSearch').value.trim().toLowerCase(), H = rows.heroes.filter(h => !q || String(h.nick || '').toLowerCase().includes(q)), gm = rows.heroes.some(h => h.gift != null);
  $('heroRows').innerHTML = H.length ? H.map(h => `<tr><td>${esc(h.nick || '（未取名）')}<br><small>${esc(h.id.slice(0, 8))}</small></td><td>${esc((C.heroes[h.cls] || {}).name || h.cls)}</td><td class="num">${h.shifts ?? '—'}</td><td class="num">${h.eggs ?? '—'}</td><td class="num">${h.gift ?? '—'}</td><td class="num">${walletOf(h) ?? '—'}</td><td><small>${esc(new Date(h.last_at).toLocaleString('zh-TW', { timeZone: C.exam.tz }))}</small></td>
    <td class="act">${gm ? `<input class="gift-n" type="number" step="100" value="10000" aria-label="發幾顆" data-gift-n="${esc(h.id)}"> <button class="btn sm" data-gift="${esc(h.id)}" data-nick="${esc(h.nick || '')}">＋金蛋</button> ` : ''}<button class="btn danger sm" data-del-hero="${esc(h.id)}" data-nick="${esc(h.nick || '')}">刪除</button></td></tr>`).join('') : `<tr><td colspan="8">${q ? '找不到這個暱稱。' : '還沒有小學生資料。'}</td></tr>`;
  $('heroNote').textContent = gm ? '' : '要發金蛋請先在 SQL Editor 執行新版 supabase/economy.sql（加 gift 欄位與 admin_gift）。'; }
$('heroSearch').addEventListener('input', renderHeroes);
async function save(table, id, data, msgEl) { const el = $(msgEl); el.className = 'msg'; el.textContent = '儲存中…'; const { error } = await sb.from(table).upsert({ id, data, updated_at: new Date().toISOString() });
  if (error) { el.className = 'msg bad'; el.textContent = '儲存失敗：' + error.message; return false; } el.className = 'msg ok'; el.textContent = '已儲存，遊戲重新整理後就會看到。'; await loadAll(); return true; }
const strip = x => { const o = { ...x }; delete o._src; delete o.id; return o; };
document.addEventListener('click', async ev => { const t = ev.target.closest('button'); if (!t) return; const d = t.dataset;
  if (t.dataset.tab) { document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b === t))); document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== t.dataset.tab; }); return; }
  const { pols, iss } = window.__merged || { pols: [], iss: [] };
  if (d.editPol) { const x = pols.find(p => p.id === d.editPol); const f = $('polForm'); f.id.value = x.id; f.title.value = x.title || ''; f.tag.value = x.tag || ''; f.model.value = x.model || 'kiosk'; f.district.value = x.district || ''; f.summary.value = x.summary || ''; f.why.value = x.why || ''; f.facts.value = (x.facts || []).join('\n'); f.agencies.value = (x.agencies || []).join(', '); f.issue.value = x.issue || ''; f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (d.hidePol || d.showPol) { const x = pols.find(p => p.id === (d.hidePol || d.showPol)); await save('policies', x.id, { ...strip(x), hidden: !!d.hidePol }, 'polMsg'); }
  if (d.delPol) { t.disabled = true; const { error } = await sb.from('policies').delete().eq('id', d.delPol); $('polMsg').className = error ? 'msg bad' : 'msg ok'; $('polMsg').textContent = error ? '刪除失敗：' + error.message : '已刪除。'; await loadAll(); }
  if (d.editIss) { const x = iss.find(p => p.id === d.editIss); const f = $('issForm'); f.id.value = x.id; f.title.value = x.title || ''; f.tag.value = x.tag || ''; f.startsAt.value = x.startsAt || ''; f.intensity.value = x.intensity || 1; f.boss.value = x.boss || ''; f.mix.value = Object.entries(x.mix || {}).map(([k, v]) => `${k}:${v}`).join(', '); f.chants.value = (x.chants || []).join('\n'); f.desc.value = x.desc || ''; f.querySelectorAll('input[name=routes]').forEach(cb => { cb.checked = (x.routes || []).includes(cb.value); }); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  if (d.hideIss || d.showIss) { const x = iss.find(p => p.id === (d.hideIss || d.showIss)); await save('issues', x.id, { ...strip(x), hidden: !!d.hideIss }, 'issMsg'); }
  if (d.delIss) { t.disabled = true; const { error } = await sb.from('issues').delete().eq('id', d.delIss); $('issMsg').className = error ? 'msg bad' : 'msg ok'; $('issMsg').textContent = error ? '刪除失敗：' + error.message : '已刪除。'; await loadAll(); }
  if (d.gift) { const n = Math.round(Number(document.querySelector(`[data-gift-n="${CSS.escape(d.gift)}"]`).value) || 0); if (!n) return; if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = `確定${n > 0 ? '發' : '收回'} ${Math.abs(n)} 顆給「${d.nick || '未取名'}」？`; return; }
    t.disabled = true; const { data, error } = await sb.rpc('admin_gift', { p_hero: d.gift, p_n: n }); const m = $('heroNote'); m.className = error ? 'msg bad' : 'msg ok'; m.textContent = error ? '發金蛋失敗：' + error.message : `已${n > 0 ? '發' : '收回'} ${Math.abs(n)} 顆給「${d.nick || '未取名'}」，GM 發的累計 ${data} 顆；對方遊戲裡一分鐘內會更新（重新整理立刻看到）。`; await loadAll(); }
  if (d.delHero) { if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = `確定刪除「${d.nick || '未取名'}」？`; return; } t.disabled = true; const { error } = await sb.from('heroes').delete().eq('id', d.delHero); if (error) alertMsg('刪除失敗：' + error.message); await loadAll(); }
});
const alertMsg = txt => { const m = $('heroNote'); m.className = 'msg bad'; m.textContent = txt; };
$('polForm').addEventListener('submit', async ev => { ev.preventDefault(); const f = ev.target; const id = f.id.value.trim();
  const data = { title: f.title.value.trim(), tag: f.tag.value.trim(), model: f.model.value, district: f.district.value || null, summary: f.summary.value.trim(), why: f.why.value.trim(), facts: f.facts.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8), agencies: f.agencies.value.split(/[,，、]/).map(s => s.trim()).filter(Boolean).slice(0, 4), issue: f.issue.value || null, hidden: false };
  if (await save('policies', id, data, 'polMsg')) f.reset(); });
$('issForm').addEventListener('submit', async ev => { ev.preventDefault(); const f = ev.target; const id = f.id.value.trim(); const mix = {}; for (const part of f.mix.value.split(',')) { const [k, v] = part.split(':').map(s => s.trim()); if (C.lesserTypes.includes(k)) mix[k] = Number(v) || 1; }
  const routes = [...f.querySelectorAll('input[name=routes]:checked')].map(i => i.value); // 闖關不使用登陸方向與魔王欄位，保留給舊資料
  const data = { title: f.title.value.trim(), tag: f.tag.value.trim(), startsAt: f.startsAt.value || null, intensity: Number(f.intensity.value) || 1, routes, boss: f.boss.value || null, mix: Object.keys(mix).length ? mix : { bird: 1 }, chants: f.chants.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12), desc: f.desc.value.trim(), hidden: false };
  if (await save('issues', id, data, 'issMsg')) f.reset(); });
boot().catch(e => { $('loginMsg').className = 'msg bad'; $('loginMsg').textContent = '後台載入失敗：' + (e.message || e); });
