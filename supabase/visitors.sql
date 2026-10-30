-- 累計來過的人數：每位訪客第一次進站會匿名登入、在 auth.users 多一列，所以「來過幾人」= 匿名帳號數。
-- 不另外寫資料，只開一個唯讀函式給前端查兩個數字（總數、今天校園時間新來的），不回傳任何帳號資料。
-- 在 Supabase 後台 SQL Editor 整段貼上執行一次；重複執行也沒關係。
create or replace function public.visitor_stats() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'total', count(*),
    'today', count(*) filter (where created_at >= (date_trunc('day', now() at time zone 'Asia/Taipei') at time zone 'Asia/Taipei'))
  ) from auth.users where is_anonymous;
$$;
revoke all on function public.visitor_stats() from public;
grant execute on function public.visitor_stats() to anon, authenticated;
notify pgrst, 'reload schema';
