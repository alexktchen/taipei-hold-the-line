-- 後台管理員權限（在 SQL Editor 執行一次；之後要加管理員就 insert 進 admins）
-- 前置：Authentication → Users → Add user → Create new user，輸入管理員 email 與密碼，勾選 Auto Confirm User。

create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;           -- 不開任何 policy：前端讀不到名單
insert into public.admins (email) values ('cktalex@gmail.com') on conflict do nothing;

-- 是否為管理員：非匿名登入、email 已驗證、且 email 在 admins 名單裡
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and coalesce(u.is_anonymous, false) = false
      and u.email_confirmed_at is not null
      and lower(u.email) in (select lower(a.email) from public.admins a)
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 管理員可以新增／修改／刪除政策與議題，並刪除英雄資料（清測試帳號用）
drop policy if exists "admin writes policies" on public.policies;
drop policy if exists "admin writes issues"   on public.issues;
drop policy if exists "admin deletes heroes"  on public.heroes;
create policy "admin writes policies" on public.policies for all    using (public.is_admin()) with check (public.is_admin());
create policy "admin writes issues"   on public.issues   for all    using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes heroes"  on public.heroes   for delete using (public.is_admin());
