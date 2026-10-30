-- 闖關模式：heroes 加闖關戰績欄位（在 Supabase 後台 SQL Editor 整段貼上執行一次；重複執行也沒關係）
-- 還沒執行前遊戲照常運作，只是闖關戰績只記在玩家自己的裝置、闖關榜與 學期對抗只看得到自己；執行後就和所有人共享。
-- 舊舊版的 rounds／kills／finals 欄位保留不動（歷史資料），闖關只用下面這幾個新欄位。
alter table public.heroes add column if not exists shifts    integer not null default 0;  -- 打了幾關
alter table public.heroes add column if not exists eggs      integer not null default 0;  -- 搬進籃子的金蛋
alter table public.heroes add column if not exists clears    integer not null default 0;  -- 三波全過幾次
alter table public.heroes add column if not exists grade     integer not null default 0;  -- 闖關等級 0 見習生 … 6 局長
alter table public.heroes add column if not exists grade_pts integer not null default 0;  -- 職級點數
alter table public.heroes drop constraint if exists heroes_shift_check;
alter table public.heroes add constraint heroes_shift_check check (shifts >= 0 and eggs >= 0 and clears >= 0 and grade between 0 and 6 and grade_pts between 0 and 999);
-- PostgREST 重新載入欄位快取，前端馬上讀得到新欄位
notify pgrst, 'reload schema';
