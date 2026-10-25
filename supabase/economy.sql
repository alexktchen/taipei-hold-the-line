-- 金蛋經濟：heroes 加買衣服、蓋城市、政治獻金的欄位（在 Supabase 後台 SQL Editor 整段貼上執行一次；重複執行也沒關係）
-- 要先跑過 shifts.sql（eggs 欄位）。還沒執行前遊戲照常運作，只是花金蛋的紀錄只存在玩家自己的裝置，蓋城市與獻金榜只算自己；執行後就和所有人共享。
-- 錢包 = eggs − donated − built − spent（金蛋只有打工會增加，這裡只記花掉的）。
alter table public.heroes add column if not exists donated integer not null default 0;   -- 政治獻金（遊戲裡的惡搞）累計
alter table public.heroes add column if not exists built   integer not null default 0;   -- 蓋城市投入累計（全站加總依序蓋）
alter table public.heroes add column if not exists spent   integer not null default 0;   -- 買衣服花掉的
alter table public.heroes add column if not exists outfit  text    not null default '-.-.-'; -- 穿著：帽子.背心.配件（id 見 js/config.js 的 econ.outfits）
alter table public.heroes add column if not exists owned   text    not null default '';   -- 買過的衣服：cat:id,cat:id
alter table public.heroes drop constraint if exists heroes_econ_check;
alter table public.heroes add constraint heroes_econ_check check (
  donated >= 0 and built >= 0 and spent >= 0
  and donated + built + spent <= eggs                      -- 花的不能比賺的多
  and char_length(outfit) <= 60 and outfit ~ '^[a-z0-9.-]*$'
  and char_length(owned) <= 600 and owned ~ '^[a-z0-9:,]*$'
);
notify pgrst, 'reload schema';
