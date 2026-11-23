-- Disco Diwali: record whether the name on a ticket was changed after booking.
-- APPLIED 2026-11-01 to the community project as migration `disco_diwali_name_changed`. Safe to re-run.
-- The desk works without it: the column is only sent when ticked, and the edit modal's save
-- reports "needs the database update" until this runs.
-- Existing RLS (director / super admin only) covers the new column; existing rows take false.
alter table public.disco_diwali_registrations
  add column if not exists name_changed boolean not null default false;

comment on column public.disco_diwali_registrations.name_changed is
  'True if the name on the ticket was changed after booking. Default false.';
