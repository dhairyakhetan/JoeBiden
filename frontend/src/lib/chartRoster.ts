/**
 * Who sits where in the About-page org chart (report 717b4b00: "... Sub-departments -> Members").
 *
 * A member hangs from the LOWEST node they belong to: a person assigned to a sub-department shows under
 * that sub-department, and a person on the department but on none of its (active) sub-departments shows
 * under the department itself. So no one appears twice and a big team never lists its whole roster at once.
 * Pure on purpose, so the rule is tested without a database.
 */
export interface ChartPerson {
  uuid: string
  name: string
  avatarUrl?: string
}

export interface ChartRoster {
  /** department uuid -> people on it who are on none of its active sub-departments */
  byTeam: Record<string, ChartPerson[]>
  /** sub-department uuid -> people assigned to it */
  bySub: Record<string, ChartPerson[]>
}

interface RosterRow {
  uuid: string
  sub_teams?: { sub_team_id: number; uuid: string; is_active?: boolean | null }[] | null
  team_members?: {
    is_active?: boolean | null
    members?: { uuid: string; full_name: string | null; avatar_url?: string | null } | null
    team_member_sub_teams?: { sub_team_id: number }[] | null
  }[] | null
}

export function groupChartRoster(rows: RosterRow[]): ChartRoster {
  const byTeam: Record<string, ChartPerson[]> = {}
  const bySub: Record<string, ChartPerson[]> = {}
  const push = (bucket: Record<string, ChartPerson[]>, key: string, p: ChartPerson) => {
    const list = (bucket[key] ||= [])
    if (!list.some(x => x.uuid === p.uuid)) list.push(p)
  }

  for (const team of rows) {
    const activeSubs = new Map<number, string>()
    for (const st of team.sub_teams || []) {
      if (st && st.is_active !== false) activeSubs.set(st.sub_team_id, st.uuid)
    }
    for (const tm of team.team_members || []) {
      if (tm.is_active === false) continue
      const m = tm.members
      if (!m || !m.uuid || !m.full_name) continue
      const person: ChartPerson = { uuid: m.uuid, name: m.full_name, avatarUrl: m.avatar_url ?? undefined }
      const subUuids = (tm.team_member_sub_teams || [])
        .map(l => activeSubs.get(l.sub_team_id))
        .filter((u): u is string => !!u)
      if (subUuids.length === 0) push(byTeam, team.uuid, person)
      else for (const u of subUuids) push(bySub, u, person)
    }
  }

  const byName = (a: ChartPerson, b: ChartPerson) => a.name.localeCompare(b.name)
  for (const k of Object.keys(byTeam)) byTeam[k].sort(byName)
  for (const k of Object.keys(bySub)) bySub[k].sort(byName)
  return { byTeam, bySub }
}
