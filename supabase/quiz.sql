-- 解題任務：答對課程卡的題目，金蛋在資料庫裡直接加（在 Supabase 後台 SQL Editor 整段貼上執行一次；重複執行也沒關係）
-- 要先跑過 shifts.sql（eggs 欄位）。還沒執行前遊戲照常運作，只是解題任務答對不會記金蛋（畫面會提示）。
alter table public.heroes add column if not exists solved integer not null default 0;  -- 解題任務答對幾題
alter table public.heroes add column if not exists last_topic text;                     -- 最後答對的單元代號
-- 一題最多記 5 顆（前端 config.quiz.reward 是 2）；每天每個單元的題數上限由前端控制
create or replace function public.hero_quiz(p_eggs integer, p_topic text)
returns public.heroes language plpgsql security invoker set search_path = public as $$
declare r public.heroes;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.heroes (id) values (auth.uid()) on conflict (id) do nothing;
  update public.heroes set
    eggs = eggs + least(greatest(coalesce(p_eggs, 0), 0), 5),
    solved = solved + 1,
    last_topic = left(p_topic, 40),
    last_at = now()
  where id = auth.uid() returning * into r;
  return r;
end $$;
revoke all on function public.hero_quiz(integer, text) from public;
grant execute on function public.hero_quiz(integer, text) to anon, authenticated;
-- PostgREST 重新載入欄位快取，前端馬上讀得到新欄位
notify pgrst, 'reload schema';
