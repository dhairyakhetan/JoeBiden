// Figures that read from one place instead of being typed into copy.
//
// Years come from ORG_FACTS.foundedOn, so "five years" turns into "six years" on its own on 11 June 2027.
// Department counts come from ORG_FACTS.departmentsActive (rewritten from the database by the build when it
// has the service key) or, in the browser, from the live department tree via useDepartmentCount().
import { ORG_FACTS } from './orgFacts'

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

/** 5 -> "five". Numbers past twelve stay as digits. */
export function numberWord(n: number): string {
  return Number.isInteger(n) && n >= 0 && n < WORDS.length ? WORDS[n] : String(n)
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Whole years completed between an ISO date (YYYY-MM-DD) and `now`. Never negative. */
export function yearsSince(iso: string, now: Date = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number)
  let years = now.getUTCFullYear() - y
  const beforeAnniversary = now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)
  if (beforeAnniversary) years -= 1
  return Math.max(years, 0)
}

/** Years since AquaTerra started (11 June 2021). */
export function yearsSinceFounding(now: Date = new Date()): number {
  return yearsSince(ORG_FACTS.foundedOn, now)
}

/** "year" or "years" with the count in words: 5 -> "five years". */
export function yearsPhrase(now: Date = new Date()): string {
  const n = yearsSinceFounding(now)
  return `${numberWord(n)} ${n === 1 ? 'year' : 'years'}`
}

/** 7 -> "seven departments". Defaults to the build-time figure. */
export function departmentsPhrase(n: number = ORG_FACTS.departmentsActive): string {
  return `${numberWord(n)} ${n === 1 ? 'department' : 'departments'}`
}

/** Top-level departments in a department tree: a department inside another does not count again. */
export function countDepartments(tree: { parentUuid?: string }[]): number {
  return tree.filter(t => !t.parentUuid).length
}
