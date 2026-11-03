-- ──────────────────────────────────────────────────────────────────────────
-- Guest apply: "we found an account for you" (owner request, 3 Nov 2026).
--
-- STATUS: APPLIED 3 Nov 2026 via the Supabase connector (migration name guest_apply_match); tested: invalid, none, phone_match (masked), email_match.
--
-- A signed-out visitor applying for a role gives name, phone and email. Before sending them to Google,
-- the app asks this function whether the phone (or email) already belongs to an account, so it can say
--   none         -> "you're new: create your account with Google, then your team reaches out"
--   email_match  -> "we found an account for you: sign in to continue"
--   phone_match  -> "we found an account with this number: sign in with <masked email>"
-- The function NEVER returns a name, a status or a full email. The masked email (public.mask_email, the same
-- masking the signed-in phone check already uses) is returned only when the phone matches but the typed email
-- differs, which is the case the owner asked for.
--
-- Abuse guard. It is callable by anon, so a visitor could probe phone numbers. Every call is counted per
-- caller (hash of x-forwarded-for) and per phone, and refused with outcome 'limited' past 30 per 10 minutes per
-- caller or 6 per hour per phone. Attempt rows hold only hashes, are locked (RLS on, no grants) and are pruned
-- after a day. A phone match never attaches an application to that account: the application is saved by
-- whichever account actually signs in.
--
-- Live checks after applying (all expected):
--   select outcome from guest_apply_match('0000000000','nobody@example.invalid');   -- invalid or none
--   select has_function_privilege('anon','public.guest_apply_match(text,text)','execute');  -- true
--   select has_table_privilege('anon','public.guest_match_attempts','select');       -- false
-- Rollback: revoke execute on the function; drop function public.guest_apply_match(text,text);
--           drop table public.guest_match_attempts;
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.guest_match_attempts (
  id     bigserial primary key,
  bucket text        not null,
  at     timestamptz not null default now()
);
create index if not exists guest_match_attempts_bucket_at on public.guest_match_attempts (bucket, at);
alter table public.guest_match_attempts enable row level security;
revoke all on public.guest_match_attempts from anon, authenticated;

create or replace function public.guest_apply_match(p_phone text, p_email text)
returns table(outcome text, masked_email text)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_key   text := public.members_phone_key(p_phone);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ip    text;
  v_ipb   text;
  v_phb   text;
  v_pm    text;
  v_found boolean;
begin
  if v_key is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  begin
    v_ip := split_part(coalesce((current_setting('request.headers', true)::json)->>'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_ip := '';
  end;
  v_ipb := 'ip:' || md5(coalesce(nullif(trim(v_ip), ''), 'unknown'));
  v_phb := 'ph:' || md5(v_key);

  if (select count(*) from public.guest_match_attempts where bucket = v_ipb and at > now() - interval '10 minutes') >= 30
     or (select count(*) from public.guest_match_attempts where bucket = v_phb and at > now() - interval '1 hour') >= 6 then
    return query select 'limited'::text, null::text;
    return;
  end if;
  insert into public.guest_match_attempts (bucket) values (v_ipb), (v_phb);
  if random() < 0.02 then
    delete from public.guest_match_attempts where at < now() - interval '1 day';
  end if;

  select m.email into v_pm
    from public.members m
   where public.members_phone_key(m.phone) = v_key
     and coalesce(m.status, '') not in ('deleted', 'rejected')
     and m.deleted_at is null
   order by (m.status = 'active') desc, m.created_at
   limit 1;
  v_found := found;

  if v_found then
    if lower(coalesce(v_pm, '')) = v_email then
      return query select 'email_match'::text, null::text;
    else
      return query select 'phone_match'::text, public.mask_email(v_pm);
    end if;
    return;
  end if;

  if exists (
    select 1 from public.members m
     where lower(m.email) = v_email
       and coalesce(m.status, '') not in ('deleted', 'rejected')
       and m.deleted_at is null
  ) then
    return query select 'email_match'::text, null::text;
    return;
  end if;

  return query select 'none'::text, null::text;
end;
$$;

revoke all on function public.guest_apply_match(text, text) from public;
grant execute on function public.guest_apply_match(text, text) to anon, authenticated;
