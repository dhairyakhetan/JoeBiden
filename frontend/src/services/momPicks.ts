import type { MemberOfMonthPick } from './memberOfMonthService'

/**
 * Keep, for each team, only the picks from that team's newest period, and
 * return them ordered by team name then member name (the rail's stable,
 * readable order). A team can honour several members in a month, so "latest"
 * is a month, not a row. Pure and import-light so it is unit-testable without
 * the Supabase client. Input need not be sorted.
 */
export function latestPeriodPerTeam(rows: MemberOfMonthPick[]): MemberOfMonthPick[] {
  const newest = new Map<number, string>()
  for (const r of rows) {
    const cur = newest.get(r.teamId)
    if (!cur || r.period > cur) newest.set(r.teamId, r.period)
  }
  return rows
    .filter(r => newest.get(r.teamId) === r.period)
    .sort((a, b) => a.teamName.localeCompare(b.teamName) || a.memberName.localeCompare(b.memberName))
}
