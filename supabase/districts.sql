-- 12 區對抗：heroes 加 district 欄位（在 Supabase 後台 SQL Editor 整段貼上執行一次；重複執行也沒關係）
-- 還沒執行前遊戲照常運作，只是區對抗只算得到自己；執行後各區排名就會用所有人的戰績。
alter table public.heroes add column if not exists district text;
alter table public.heroes drop constraint if exists heroes_district_check;
alter table public.heroes add constraint heroes_district_check check (district is null or district in
  ('beitou','shilin','neihu','datong','zhongshan','songshan','nangang','wanhua','zhongzheng','daan','xinyi','wenshan'));
-- PostgREST 重新載入欄位快取，前端馬上讀得到新欄位
notify pgrst, 'reload schema';
