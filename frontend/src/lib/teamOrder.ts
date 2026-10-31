// Order for the director Teams desk: the same tree as the About page. Top-level departments by name,
// each followed by the teams inside it (also by name). A team whose parent is not in the list (filtered
// out, or hidden) is treated as top level so it never disappears.

export interface OrderableTeam {
  uuid: string
  name: string
  parentUuid?: string
}

export interface OrderedTeam<T extends OrderableTeam> {
  team: T
  /** Name of the department this team sits inside, when it is shown nested. */
  insideName?: string
}

const byName = <T extends OrderableTeam>(a: T, b: T) => a.name.localeCompare(b.name)

export function orderTeamsAsTree<T extends OrderableTeam>(teams: readonly T[]): OrderedTeam<T>[] {
  const present = new Set(teams.map(t => t.uuid))
  const nested = (t: T) => !!t.parentUuid && present.has(t.parentUuid)
  const top = teams.filter(t => !nested(t)).sort(byName)
  const out: OrderedTeam<T>[] = []
  for (const t of top) {
    out.push({ team: t })
    for (const k of teams.filter(c => c.parentUuid === t.uuid).sort(byName)) out.push({ team: k, insideName: t.name })
  }
  return out
}
