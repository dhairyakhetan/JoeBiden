-- APPLIED LIVE 2026-09-14 via Supabase MCP (migration name:
-- mirror_welfare_project_to_post_enrich_body)
--
-- Owner request: "every single time a drive is posted ... a post is created
-- from Team AquaTerra ... these people were there and all of that."
--
-- The auto-post mechanism itself ALREADY EXISTED (welfare_project_publish_
-- mirror trigger -> mirror_welfare_project_to_post(), live since before this
-- session) and had 100% coverage: verified live, all 548 published
-- welfare_projects rows already had a linked_post_id. What it did NOT do was
-- say who was there - the post body was just header + short_summary, no
-- volunteer count, location, or drive lead.
--
-- This adds ONE optional line built only from columns already on the same
-- row being published: volunteer count ("6 volunteers there"), location, and
-- the drive lead's name (resolved from drive_lead_member_id), joined with
-- " · " and included only where that column is actually set - a row with
-- fewer details just gets a shorter line, never a sentence with blanks.
-- Nothing else about the trigger changes: same fire condition (draft ->
-- published, or inserted already published), same author (official@
-- ngoaquaterra.com), same category/status mapping.
--
-- Verified live: pg_get_functiondef matches this file after applying.

create or replace function public.mirror_welfare_project_to_post()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  aq_member_id integer;
  new_post_uuid uuid;
  lead_name text;
  meta_line text;
begin
  if (TG_OP = 'UPDATE' and OLD.is_draft = true and NEW.is_draft = false)
     or (TG_OP = 'INSERT' and NEW.is_draft = false) then
    if NEW.linked_post_id is null then
      select member_id into aq_member_id from public.members where email = 'official@ngoaquaterra.com';

      if NEW.drive_lead_member_id is not null then
        select full_name into lead_name from public.members where member_id = NEW.drive_lead_member_id;
      end if;

      meta_line := trim(both ' · ' from concat_ws(' · ',
        case when NEW.volunteers is not null then NEW.volunteers || ' volunteer' || (case when NEW.volunteers = 1 then '' else 's' end) || ' there' end,
        NEW.location,
        case when lead_name is not null then 'led by ' || lead_name end
      ));

      insert into public.posts (author_id, category, body, status)
      values (aq_member_id, NEW.category,
              trim(trailing E'\n' from (
                coalesce(NEW.header, '') || E'\n\n' || coalesce(NEW.short_summary, '') ||
                case when meta_line <> '' then E'\n\n' || meta_line else '' end
              )),
              'published')
      returning uuid into new_post_uuid;
      NEW.linked_post_id := new_post_uuid;
    end if;
  end if;
  return NEW;
end;
$function$;
