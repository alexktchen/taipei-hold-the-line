-- GM 發金蛋（在 Supabase 後台 SQL Editor 執行；要先跑過 economy.sql）。
-- 也可以不寫 SQL：用管理員帳號登入 admin/，到「英雄資料」找到那個人按「＋金蛋」。
-- 發的金蛋記在 gift 欄位：錢包會多這麼多，但不算闖關榜、全體戰績與 學期對抗。

-- 1) 先看看有誰叫這個名字（同名可能不只一位，依最後上線排）
select id, nick, district, eggs, gift, donated + built + spent as used, eggs + gift - donated - built - spent as wallet, last_at
from public.heroes where lower(trim(nick)) = lower('我是GM') order by last_at desc;

-- 2) 發 10000 顆給最近上線的那一位（要發給別人就改暱稱，或把 where 換成 id = '那一列的 id'）
update public.heroes set gift = gift + 10000
where id = (select id from public.heroes where lower(trim(nick)) = lower('我是GM') order by last_at desc limit 1)
returning id, nick, eggs, gift, eggs + gift - donated - built - spent as wallet;
