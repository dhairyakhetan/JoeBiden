import { mulberry32 } from '../../lib/particles'

export const SYMBOLS = 8

export interface Card { id: number; symbol: number; matched: boolean }

/** Sixteen cards: each of the eight symbols twice, shuffled by a seed. */
export function buildDeck(seed: number): Card[] {
  const rand = mulberry32(seed)
  const symbols = Array.from({ length: SYMBOLS * 2 }, (_, i) => i % SYMBOLS)
  for (let i = symbols.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[symbols[i], symbols[j]] = [symbols[j], symbols[i]]
  }
  return symbols.map((symbol, id) => ({ id, symbol, matched: false }))
}

export const isMatch = (a: Card, b: Card): boolean => a.id !== b.id && a.symbol === b.symbol

export const isWon = (cards: Card[]): boolean => cards.length > 0 && cards.every(c => c.matched)

/** Three stars for a near-perfect game (8 moves is the floor), two for a tidy one, one for finishing. */
export function starsFor(moves: number): 1 | 2 | 3 {
  return moves <= 11 ? 3 : moves <= 16 ? 2 : 1
}
