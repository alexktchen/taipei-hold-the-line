-- 金蛋經濟：heroes 加買衣服、蓋城市、政治獻金、GM 發金蛋的欄位與函式（在 Supabase 後台 SQL Editor 整段貼上執行一次；重複執行也沒關係）
-- 要先跑過 shifts.sql（eggs 欄位）；GM 發金蛋的後台按鈕要先跑過 admin.sql（is_admin）。
-- 金蛋只記在雲端：還沒執行前可以打工，但商店不能花。
-- 錢包 = eggs + gift − donated − built − spent（eggs 只有打工會增加；gift 是 GM 發的，玩家自己改不了；這裡記花掉的）。
alter table public.heroes add column if not exists donated integer not null default 0;   -- 政治獻金（遊戲裡的惡搞）累計
alter table public.heroes add column if not exists built   integer not null default 0;   -- 蓋城市投入累計（全站加總依序蓋）
alter table public.heroes add column if not exists spent   integer not null default 0;   -- 買衣服花掉的
alter table public.heroes add column if not exists outfit  text    not null default '-.-.-'; -- 穿著：帽子.背心.配件.套裝（id 見 js/config.js 的 econ.outfits）
alter table public.heroes add column if not exists owned   text    not null default '';   -- 買過的衣服：cat:id,cat:id
alter table public.heroes add column if not exists gift    integer not null default 0;   -- GM 發的金蛋（不算打工榜與 12 區對抗）
alter table public.heroes drop constraint if exists heroes_econ_check;
alter table public.heroes add constraint heroes_econ_check check (
  donated >= 0 and built >= 0 and spent >= 0 and gift >= 0
  and donated + built + spent <= eggs + gift               -- 花的不能比賺的（加 GM 發的）多
  and char_length(outfit) <= 60 and outfit ~ '^[a-z0-9.-]*$'
  and char_length(owned) <= 600 and owned ~ '^[a-z0-9:,]*$'
);

-- 玩家（REST 進來的 anon／authenticated）不能自己改 gift；SQL Editor 與後台的 admin_gift 不受限
create or replace function public.heroes_keep_gift() returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then new.gift := 0; else new.gift := old.gift; end if;
  end if;
  return new;
end $$;
drop trigger if exists heroes_keep_gift on public.heroes;
create trigger heroes_keep_gift before insert or update on public.heroes for each row execute function public.heroes_keep_gift();

-- 打完一班：班數、金蛋、過關數在資料庫裡直接加（多台裝置同時玩也不會互相蓋掉）；一班最多記 300 顆
create or replace function public.hero_shift(p_eggs integer, p_clear boolean, p_grade integer, p_pts integer, p_stage text)
returns public.heroes language plpgsql security invoker set search_path = public as $$
declare r public.heroes;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.heroes (id) values (auth.uid()) on conflict (id) do nothing;
  update public.heroes set
    shifts = shifts + 1,
    eggs = eggs + least(greatest(coalesce(p_eggs, 0), 0), 300),
    clears = clears + case when p_clear then 1 else 0 end,
    grade = least(greatest(coalesce(p_grade, 0), 0), 6),
    grade_pts = least(greatest(coalesce(p_pts, 0), 0), 999),
    last_issue = left(p_stage, 40),
    last_at = now()
  where id = auth.uid() returning * into r;
  return r;
end $$;

-- 花金蛋：spent 買衣服、built 蓋城市、donated 政治獻金（p_n = 0 只換穿著）；錢包不夠就失敗（錯誤訊息 poor），不會扣成負的
create or replace function public.hero_spend(p_kind text, p_n integer, p_owned text default null, p_outfit text default null)
returns public.heroes language plpgsql security invoker set search_path = public as $$
declare r public.heroes;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_kind not in ('spent', 'built', 'donated') or p_n is null or p_n < 0 or p_n > 100000 then raise exception 'bad amount'; end if;
  update public.heroes set
    spent   = spent   + case when p_kind = 'spent'   then p_n else 0 end,
    built   = built   + case when p_kind = 'built'   then p_n else 0 end,
    donated = donated + case when p_kind = 'donated' then p_n else 0 end,
    owned   = coalesce(p_owned, owned),
    outfit  = coalesce(p_outfit, outfit),
    last_at = now()
  where id = auth.uid() and eggs + gift - donated - built - spent >= p_n
  returning * into r;
  if r.id is null then raise exception 'poor'; end if;
  return r;
end $$;
revoke all on function public.hero_shift(integer, boolean, integer, integer, text) from public;
revoke all on function public.hero_spend(text, integer, text, text) from public;
grant execute on function public.hero_shift(integer, boolean, integer, integer, text) to anon, authenticated;
grant execute on function public.hero_spend(text, integer, text, text) to anon, authenticated;

-- GM 發金蛋（後台 admin/ 的「英雄資料 → ＋金蛋」用）：只有 admins 名單裡的管理員能用；p_n 可以是負的（收回，最低到 0）
create or replace function public.admin_gift(p_hero uuid, p_n integer) returns integer
language plpgsql security definer set search_path = public as $$
declare g integer;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  update public.heroes set gift = greatest(0, gift + p_n) where id = p_hero returning gift into g;
  return g;
end $$;
revoke all on function public.admin_gift(uuid, integer) from public;
grant execute on function public.admin_gift(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
