// "Jump to a desk" search (bug tracker e11544ed): type "enqui", pick
// "Enquiries", land on that desk. Pure so the ranking is unit-tested; the
// input only ever searches the desks the viewer can already see.

import type { Desk, NavKey } from './deskAccess'

/** Words people use for a desk that are not in its name. Lowercase. */
export const DESK_ALIASES: Partial<Record<NavKey, string[]>> = {
  approvals: ['applicants', 'join requests', 'pending', 'new members', 'accounts'],
  posts: ['moderation queue', 'review posts'],
  enquiries: ['collaborations', 'collab requests', 'contact messages', 'form responses'],
  hiring: ['job applications', 'openings', 'recruitment'],
  member_of_month: ['mom', 'story'],
  projects: ['drives', 'welfare projects'],
  hods: ['directors', 'heads of department'],
  volunteer_apps: ['volunteers', 'whatsapp outreach'],
  roles: ['capabilities', 'access'],
  activity_log: ['audit', 'history'],
  categories: ['moderators'],
  content: ['every post'],
}

export type DeskHit = { desk: Desk; group: string }

/**
 * Desks matching `query`, best first. Lower score is better:
 * 0 label starts with it, 1 a word of the label starts with it, 2 label
 * contains it, 3 an alias or the group name contains it, 4 the blurb does.
 * An empty query returns nothing (the list only opens once you type).
 */
export function matchDesks(groups: { label: string; items: Desk[] }[], query: string, limit = 8): DeskHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const scored: { hit: DeskHit; score: number; order: number }[] = []
  let order = 0
  for (const g of groups) {
    for (const desk of g.items) {
      order++
      const label = desk.label.toLowerCase()
      const aliases = DESK_ALIASES[desk.key] ?? []
      let score = -1
      if (label.startsWith(q)) score = 0
      else if (label.split(/[^a-z0-9]+/).some(w => w.startsWith(q))) score = 1
      else if (label.includes(q)) score = 2
      else if (aliases.some(a => a.includes(q)) || g.label.toLowerCase().includes(q)) score = 3
      else if (desk.blurb.toLowerCase().includes(q)) score = 4
      if (score >= 0) scored.push({ hit: { desk, group: g.label }, score, order })
    }
  }
  return scored.sort((a, b) => a.score - b.score || a.order - b.order).slice(0, limit).map(s => s.hit)
}
