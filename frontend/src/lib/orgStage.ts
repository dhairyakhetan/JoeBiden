/**
 * The model behind the About-page hero (AquaTerra > departments > sub-departments > people).
 *
 * Pure on purpose: it takes the department tree and the roster the services already return and
 * shapes them for the stage, so the shaping and the search are tested without a browser or a database.
 * Rules it owns:
 *  - a department that sits inside another (Marketing holds Social Media) is a `kid` of its parent, not a
 *    top-level card; the parent's people are its own plus its kids';
 *  - a person is listed once per node; the search finds them at the lowest node they belong to;
 *  - counts come from the tree (always available); people come from the roster (may be missing).
 */
import type { DepartmentTreeTeam } from '../services/teamService'
import type { ChartPerson, ChartRoster } from './chartRoster'

export interface StageSub {
  uuid: string
  slug: string
  name: string
  count: number
  people: ChartPerson[]
}

export interface StageDept {
  uuid: string
  /** The team's numeric id, so openings (which store team_id) can be placed on the chart. */
  teamId?: number
  name: string
  count: number
  people: ChartPerson[]
  subs: StageSub[]
  kids: StageDept[]
}

/** Where the visitor is on the stage: a department, optionally a department inside it, optionally a sub-department. */
export interface StagePath {
  dept: string
  kid?: string
  sub?: string
}

export interface StageHit {
  kind: 'team' | 'sub' | 'person'
  label: string
  detail: string
  path: StagePath
  personUuid?: string
}

function unionPeople(...lists: (ChartPerson[] | undefined)[]): ChartPerson[] {
  const seen = new Set<string>()
  const out: ChartPerson[] = []
  for (const list of lists) for (const p of list || []) if (!seen.has(p.uuid)) { seen.add(p.uuid); out.push(p) }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

function shape(team: DepartmentTreeTeam, roster: ChartRoster | null, kids: StageDept[]): StageDept {
  const subs: StageSub[] = team.subTeams.map(st => ({
    uuid: st.uuid,
    slug: st.slug,
    name: st.name,
    count: st.memberCount,
    people: roster?.bySub[st.uuid] ?? [],
  }))
  const own = unionPeople(roster?.byTeam[team.uuid], ...subs.map(s => s.people))
  return {
    uuid: team.uuid,
    teamId: team.teamId,
    name: team.name,
    count: team.memberCount + kids.reduce((n, k) => n + k.count, 0),
    people: unionPeople(own, ...kids.map(k => k.people)),
    subs,
    kids,
  }
}

export function buildStage(tree: DepartmentTreeTeam[], roster: ChartRoster | null): StageDept[] {
  const kidsOf = (uuid: string) => tree.filter(t => t.parentUuid === uuid).map(t => shape(t, roster, []))
  return tree.filter(t => !t.parentUuid).map(t => shape(t, roster, kidsOf(t.uuid)))
}

export interface InsideChip { key: string; label: string; count: number }

/** Every team inside a department, flat, for its card: the departments inside it first, then the
 *  sub-departments of it and of those. Nothing is summarised as "5 sub-teams": each one is named. */
export function insideChips(d: StageDept): InsideChip[] {
  const chip = (x: { uuid: string; name: string; count: number }): InsideChip => ({ key: x.uuid, label: x.name, count: x.count })
  return [
    ...d.kids.map(chip),
    ...d.subs.map(chip),
    ...d.kids.flatMap(k => k.subs.map(chip)),
  ]
}

/** How many teams the organisation has in all: departments, the departments inside them, and every
 *  sub-department. The figure that says how wide AquaTerra really is. */
export function countTeams(stage: StageDept[]): number {
  return stage.reduce((n, d) => n + 1 + insideChips(d).length, 0)
}

/** Resolve a path to the node it points at (for the panel): its title, people, count and what is inside it. */
export function resolvePath(stage: StageDept[], path: StagePath | null) {
  if (!path) return null
  const dept = stage.find(d => d.uuid === path.dept)
  if (!dept) return null
  const kid = path.kid ? dept.kids.find(k => k.uuid === path.kid) : undefined
  const holder = kid ?? dept
  const sub = path.sub ? holder.subs.find(s => s.uuid === path.sub) : undefined
  return { dept, kid, sub }
}

/** Find a person, a department or a sub-department by name. At most `limit` hits, teams before people. */
export function searchStage(stage: StageDept[], query: string, limit = 8): StageHit[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const teams: StageHit[] = []
  const people: StageHit[] = []
  const seenPeople = new Set<string>()

  const visit = (dept: StageDept, parent: StageDept | null) => {
    const base: StagePath = parent ? { dept: parent.uuid, kid: dept.uuid } : { dept: dept.uuid }
    if (dept.name.toLowerCase().includes(q)) {
      teams.push({ kind: 'team', label: dept.name, detail: parent ? `inside ${parent.name}` : 'department', path: base })
    }
    for (const sub of dept.subs) {
      if (sub.name.toLowerCase().includes(q)) {
        teams.push({ kind: 'sub', label: sub.name, detail: `sub-department of ${dept.name}`, path: { ...base, sub: sub.uuid } })
      }
    }
    // lowest node first: sub-departments, then the department itself
    for (const sub of dept.subs) {
      for (const p of sub.people) {
        if (p.name.toLowerCase().includes(q) && !seenPeople.has(p.uuid)) {
          seenPeople.add(p.uuid)
          people.push({ kind: 'person', label: p.name, detail: `${sub.name}, ${dept.name}`, path: { ...base, sub: sub.uuid }, personUuid: p.uuid })
        }
      }
    }
    const subPeople = new Set(dept.subs.flatMap(s => s.people.map(p => p.uuid)))
    const direct = dept.people.filter(p => !subPeople.has(p.uuid) && !dept.kids.some(k => k.people.some(kp => kp.uuid === p.uuid)))
    for (const p of direct) {
      if (p.name.toLowerCase().includes(q) && !seenPeople.has(p.uuid)) {
        seenPeople.add(p.uuid)
        people.push({ kind: 'person', label: p.name, detail: dept.name, path: base, personUuid: p.uuid })
      }
    }
    for (const kid of dept.kids) visit(kid, dept)
  }
  for (const d of stage) visit(d, null)
  return [...teams, ...people].slice(0, limit)
}


// ── open roles on the chart ─────────────────────────────────────────────────

/** The part of an opening the chart needs. */
export interface OpeningRef { id: string; title: string; teamId?: number; teamName?: string }

const norm = (s?: string) => (s || '').trim().toLowerCase()

/** Openings that belong to exactly this node. A department or department-inside-one matches by team id when both sides have it;
 *  a sub-department (no id of its own, openings point at a team) matches by the team name the opening was written with. */
export function openingsFor(node: { name: string; teamId?: number }, openings: OpeningRef[]): OpeningRef[] {
  return openings.filter(o => {
    if (o.teamId != null && node.teamId != null) return o.teamId === node.teamId
    return norm(o.teamName) !== '' && norm(o.teamName) === norm(node.name)
  })
}

const uniq = (lists: OpeningRef[][]): OpeningRef[] => {
  const seen = new Set<string>()
  const out: OpeningRef[] = []
  for (const l of lists) for (const o of l) if (!seen.has(o.id)) { seen.add(o.id); out.push(o) }
  return out
}

/** For every node on the stage (department, department inside it, sub-department), the openings at it or anywhere inside it. */
export function openingsByNode(stage: StageDept[], openings: OpeningRef[]): Map<string, OpeningRef[]> {
  const map = new Map<string, OpeningRef[]>()
  const walk = (d: StageDept): OpeningRef[] => {
    const subLists = d.subs.map(s => { const o = openingsFor(s, openings); map.set(s.uuid, o); return o })
    const kidLists = d.kids.map(walk)
    const all = uniq([openingsFor(d, openings), ...subLists, ...kidLists])
    map.set(d.uuid, all)
    return all
  }
  stage.forEach(walk)
  return map
}

/** Every open role under the department that holds it, for the "now hiring" section. A role appears once, in the first
 *  department that claims it; roles no department claims go in a final group so nothing hiring is ever hidden. */
export function groupOpeningsByDepartment<T extends OpeningRef>(stage: StageDept[], openings: T[]): { uuid: string; name: string; items: T[] }[] {
  const byNode = openingsByNode(stage, openings)
  const claimed = new Set<string>()
  const groups = stage
    .map(d => {
      const items = ((byNode.get(d.uuid) ?? []) as T[]).filter(o => !claimed.has(o.id))
      items.forEach(o => claimed.add(o.id))
      return { uuid: d.uuid, name: d.name, items }
    })
    .filter(g => g.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name))
  const rest = openings.filter(o => !claimed.has(o.id))
  return rest.length ? [...groups, { uuid: 'rest', name: 'across AquaTerra', items: rest }] : groups
}
