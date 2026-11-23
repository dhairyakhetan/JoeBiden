-- Welfare has one sub-department: Campaigns (bug tracker 5e76c372, owner confirmed 19 Nov 2026).
-- Every member placed in any other Welfare sub-department is added to Campaigns, then every other
-- Welfare sub-department is hidden (is_active = false). Nothing is deleted: the old placement rows
-- stay, so flipping is_active back restores the old structure. No posts were tagged to any of them.
-- Applied live 19 Nov 2026 via the Supabase connector.
begin;
  insert into public.team_member_sub_teams (team_member_id, sub_team_id)
  select distinct x.team_member_id, c.sub_team_id
    from public.team_member_sub_teams x
    join public.sub_teams s on s.sub_team_id = x.sub_team_id
    join public.teams t on t.team_id = s.team_id
    join public.sub_teams c on c.team_id = t.team_id and c.name = 'Campaigns'
   where t.uuid = 'a1b2c3d4-0001-0000-0000-000000000002'
     and s.sub_team_id <> c.sub_team_id
  on conflict (team_member_id, sub_team_id) do nothing;

  update public.sub_teams s set is_active = false
    from public.teams t
   where t.team_id = s.team_id and t.uuid = 'a1b2c3d4-0001-0000-0000-000000000002'
     and s.name <> 'Campaigns';

  update public.sub_teams s set display_order = 1, is_active = true
    from public.teams t
   where t.team_id = s.team_id and t.uuid = 'a1b2c3d4-0001-0000-0000-000000000002'
     and s.name = 'Campaigns';
commit;
