-- ═══════════════════════════════════════════════════════════════════════════
-- Certificate verification codes. 2026-11-20.
--
-- STATUS: **APPLIED to the live database, confirmed 2026-11-21** by read-only queries (the verify_code
-- column, both functions and the trigger exist; `anon` can execute verify_certificate() and nothing else
-- here; the issue-code trigger is enabled). Applied together with certificate_pipeline_2026_11_20.sql as
-- one transaction. The behaviour is NOT yet proven: no request has been issued, so no code has been
-- assigned or checked. The cases worth proving on the first real issue: a code appears only on issue,
-- a client-sent code is discarded, a code cannot be changed after issue, a wrong or null code returns
-- no row.
--
-- Apply AFTER (or in the same transaction as) certificate_pipeline_2026_11_20.sql: it reads
-- `certificate_types`, which that file creates. On its own it fails with 'relation certificate_types does not exist'.
--
-- WHY (owner, 20 Nov 2026): the documents will carry the founders' signature images.
-- A signature served to a browser can be copied by anyone who can open the document, so
-- a document also carries a code a third party (a school, a college, an employer) can
-- check on a public page, and a copied signature on a forged page checks out as nothing.
--
-- WHAT
-- ────
-- 1. `certificate_requests.verify_code`: assigned BY THE DATABASE at the moment a request
--    becomes `issued`. 64 random bits from gen_random_uuid(), shown as AQ-XXXX-XXXX-XXXX-XXXX.
--    Whatever the browser sends for it is discarded; it can be neither preset on a pending
--    request nor changed afterwards.
-- 2. `verify_certificate(code)`: callable by anyone, signed in or not. Returns ONLY the
--    holder's name, the document's name and the issue date, and only for an issued
--    document. Not the hours, the teams, the text, the HoD answers or anything else.
--    Many members are minors: the name is exposed only to someone holding the code, which
--    only the member and HR can hand out. 64 bits makes guessing impractical.
--
-- TO REVERSE: drop the trigger, both functions, the index and the column.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.certificate_requests add column if not exists verify_code text;
create unique index if not exists certificate_requests_verify_code_key
  on public.certificate_requests (verify_code) where verify_code is not null;

comment on column public.certificate_requests.verify_code is
  'Assigned by the database when the request becomes issued. Public proof, checked with verify_certificate(). Never set by a client.';

create or replace function public.certificate_requests_issue_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h text;
begin
  if new.status = 'issued' and old.status is distinct from 'issued' then
    h := upper(replace(gen_random_uuid()::text, '-', ''));
    new.verify_code := 'AQ-' || substr(h, 1, 4) || '-' || substr(h, 5, 4) || '-' || substr(h, 9, 4) || '-' || substr(h, 13, 4);
  elsif new.verify_code is distinct from old.verify_code then
    raise exception 'certificate_field_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.certificate_requests_issue_code() from anon, authenticated, public;

drop trigger if exists certificate_requests_issue_code on public.certificate_requests;
create trigger certificate_requests_issue_code
  before update on public.certificate_requests
  for each row execute function public.certificate_requests_issue_code();

create or replace function public.verify_certificate(p_code text)
returns table (holder_name text, doc_label text, issued_on date)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.full_name::text, t.label, r.decided_at::date
  from public.certificate_requests r
  join public.members m on m.member_id = r.member_id
  join public.certificate_types t on t.key = r.doc_type
  where r.verify_code = upper(btrim(coalesce(p_code, '')))
    and r.status = 'issued'
  limit 1;
$$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

commit;

-- VERIFICATION (after applying): issue one test request, then
--   select * from verify_certificate('<its code>');   -- one row: name, label, date
--   select * from verify_certificate('AQ-0000-0000-0000-0000');   -- zero rows
-- and confirm `anon` cannot select from certificate_requests directly.
