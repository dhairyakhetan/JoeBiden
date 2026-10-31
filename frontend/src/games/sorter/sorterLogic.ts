import { mulberry32 } from '../../lib/particles'

export type Bin = 'dry' | 'wet' | 'ewaste'
export interface SortItem { id: string; name: string; bin: Bin }

export const BINS: { id: Bin; label: string; hint: string }[] = [
  { id: 'dry', label: 'dry', hint: 'paper, plastic, metal, glass' },
  { id: 'wet', label: 'wet', hint: 'food and garden scraps' },
  { id: 'ewaste', label: 'e-waste', hint: 'anything with a battery or a wire' },
]

export const ITEMS: SortItem[] = [
  { id: 'bottle', name: 'plastic bottle', bin: 'dry' },
  { id: 'paper', name: 'old newspaper', bin: 'dry' },
  { id: 'can', name: 'tin can', bin: 'dry' },
  { id: 'jar', name: 'glass jar', bin: 'dry' },
  { id: 'box', name: 'cardboard box', bin: 'dry' },
  { id: 'wrapper', name: 'biscuit wrapper', bin: 'dry' },
  { id: 'banana', name: 'banana peel', bin: 'wet' },
  { id: 'apple', name: 'apple core', bin: 'wet' },
  { id: 'tea', name: 'used tea leaves', bin: 'wet' },
  { id: 'veg', name: 'vegetable scraps', bin: 'wet' },
  { id: 'rice', name: 'leftover rice', bin: 'wet' },
  { id: 'flowers', name: 'wilted flowers', bin: 'wet' },
  { id: 'phone', name: 'old phone', bin: 'ewaste' },
  { id: 'battery', name: 'dead battery', bin: 'ewaste' },
  { id: 'earphones', name: 'broken earphones', bin: 'ewaste' },
  { id: 'charger', name: 'phone charger', bin: 'ewaste' },
  { id: 'bulb', name: 'fused bulb', bin: 'ewaste' },
  { id: 'remote', name: 'dead remote', bin: 'ewaste' },
]

export const ROUND_SIZE = 12

/** A seeded shuffle, so a round is reproducible in tests. */
export function dealRound(seed: number, size: number = ROUND_SIZE): SortItem[] {
  const rand = mulberry32(seed)
  const a = [...ITEMS]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, Math.min(size, a.length))
}

export const judge = (item: SortItem, bin: Bin): boolean => item.bin === bin

/** Streak after an answer: a right answer extends it, a wrong one resets it. */
export const nextStreak = (streak: number, correct: boolean): number => (correct ? streak + 1 : 0)

/** 10 per right answer, plus 2 for each step of the streak, up to 5 steps. A wrong answer scores nothing and takes nothing. */
export const pointsFor = (correct: boolean, streakBefore: number): number => (correct ? 10 + Math.min(streakBefore, 5) * 2 : 0)

export type Grade = 'seedling' | 'sapling' | 'tree'
export function gradeFor(correct: number, total: number): Grade {
  const share = total > 0 ? correct / total : 0
  return share >= 0.9 ? 'tree' : share >= 0.6 ? 'sapling' : 'seedling'
}
export const GRADE_LINE: Record<Grade, string> = {
  seedling: 'a seedling. every sorter starts here.',
  sapling: 'a sapling. nearly everything in the right bin.',
  tree: 'a full tree. a drive would be lucky to have you.',
}
