-- 7 Nov 2026, owner chose "hide the stat": welfare_projects id 1616 ("Smile Notes Campaign") had key_statistic
-- '00 notes with affirmations and 100 toffees were distributed to passerbys and with each note a toffee was distributed.'
-- (a typo; the sibling rows say 100 notes). APPLIED: set to null. Rollback or correct with:
--   update welfare_projects set key_statistic = '100 notes with affirmations and 100 toffees were distributed to passerbys and with each note a toffee was distributed.' where id = 1616;
update welfare_projects set key_statistic = null where id = 1616 and key_statistic like '00 notes%';
