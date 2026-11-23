-- 2026-11-15: Instagram content tracker. One row per post, saying whether an AQ
-- Instagram carousel has been generated for it, skipped, or is blocked.
-- APPLIED LIVE 2026-11-15 (owner ran it in the SQL editor): 8 generated, 1 skipped, 19 not_applicable, 89 no_photos, 509 not_started = 626.
--
-- Backfill rule (reverse-engineered from the live data on 2026-11-15):
--   generated      the 8 drive carousels built 13-14 Nov 2026 (posts 876-878, 901-905)
--   skipped        owner said skip (906, Momo Aunty sunset)
--   not_applicable job openings (hiring posts, not drives)
--   no_photos      published, but no photo anywhere (post_images, or for a mirrored
--                  welfare project: main_image / image_1..4 on welfare_projects)
--   not_started    has photos, no content generated yet
-- NOTE: mirrored welfare projects keep their photos on welfare_projects, NOT post_images,
-- so a post_images-only check wrongly calls ~490 old drives photo-less.

create table if not exists public.ig_content_tracker (
  post_id          integer primary key references public.posts(post_id) on delete cascade,
  status           text not null default 'not_started'
                   check (status in ('not_started','generated','skipped','no_photos','not_applicable','posted')),
  reason           text,
  kind             text,            -- source_kind (welfare_project / blog / native / job_opening)
  category         text,
  drive_date       date,            -- welfare_projects.workshop_date, else the post date
  has_photos       boolean not null default false,
  photo_count      integer not null default 0,
  carousel_folder  text,            -- e.g. out/drives_nov2026/876_sharbat_northern_park
  slide_count      integer,
  generated_at     timestamptz,
  ig_url           text,
  updated_at       timestamptz not null default now()
);

create index if not exists ig_content_tracker_status_idx on public.ig_content_tracker (status);

alter table public.ig_content_tracker enable row level security;
drop policy if exists ig_content_tracker_leaders on public.ig_content_tracker;
create policy ig_content_tracker_leaders on public.ig_content_tracker
  for all to authenticated
  using (public.is_director() or public.is_super_admin())
  with check (public.is_director() or public.is_super_admin());
grant select, insert, update on public.ig_content_tracker to authenticated;

-- Backfill every published, undeleted post. Safe to re-run: existing rows are kept.
insert into public.ig_content_tracker
  (post_id, status, reason, kind, category, drive_date, has_photos, photo_count)
select p.post_id,
       case when p.source_kind = 'job_opening' then 'not_applicable'
            when coalesce(ph.n, 0) = 0 then 'no_photos'
            else 'not_started' end,
       case when p.source_kind = 'job_opening' then 'hiring post, not a drive'
            when coalesce(ph.n, 0) = 0 then 'no photo on the post or its welfare project' end,
       coalesce(p.source_kind, 'native'),
       p.category,
       coalesce(w.workshop_date::date, p.created_at::date),
       coalesce(ph.n, 0) > 0,
       coalesce(ph.n, 0)
  from public.posts p
  left join public.welfare_projects w on w.linked_post_id::text = p.uuid::text
  left join lateral (
    select (select count(*) from public.post_images i where i.post_id = p.post_id)
         + (select count(*) from (values (w.main_image),(w.image_1),(w.image_2),(w.image_3),(w.image_4)) v(u) where nullif(v.u,'') is not null) as n
  ) ph on true
 where p.status = 'published' and p.deleted_at is null
on conflict (post_id) do nothing;

-- The 8 carousels that exist.
update public.ig_content_tracker t set
  status = 'generated', reason = null, generated_at = now(), updated_at = now(),
  carousel_folder = v.folder, slide_count = v.slides
  from (values
    (876,'out/drives_nov2026/876_sharbat_northern_park',3),
    (877,'out/drives_nov2026/877_sharbat_momo_aunty_bangur',4),
    (878,'out/drives_nov2026/878_dog_drive_jatindas_park',3),
    (901,'out/drives_nov2026/901_subject_predicate_ektara',2),
    (902,'out/drives_nov2026/902_grammar_disha',3),
    (903,'out/drives_nov2026/903_teaching_internship_disha',4),
    (904,'out/drives_nov2026/904_dog_feeding_natural_city',3),
    (905,'out/drives_nov2026/905_rakhi_tangra',3)
  ) as v(pid, folder, slides)
 where t.post_id = v.pid;

update public.ig_content_tracker
   set status = 'skipped', reason = 'owner asked to skip', updated_at = now()
 where post_id = 906;

-- Check:  select status, count(*) from public.ig_content_tracker group by 1 order by 1;

-- Follow-up, applied 2026-11-15 at the owner's instruction: every old post that had photos
-- but no generated content is assumed already posted to Instagram.
--   update public.ig_content_tracker set status='posted',
--     reason='assumed already posted to Instagram (owner, 2026-11-15)', updated_at=now()
--   where status='not_started';
-- Result: generated 8, posted 509, no_photos 89, not_applicable 19, skipped 1.
