export const ROUNDS = 5

/** How long the pad stays red before it goes green: 1.2 to 4 seconds, from a 0..1 random. */
export const waitMs = (rand: number): number => 1200 + Math.floor(Math.min(Math.max(rand, 0), 0.9999) * 2800)

export const average = (times: number[]): number => (times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0)

export type Tone = 'lightning' | 'quick' | 'steady' | 'dreamy'
export function toneFor(ms: number): Tone {
  return ms < 220 ? 'lightning' : ms < 300 ? 'quick' : ms < 420 ? 'steady' : 'dreamy'
}
export const TONE_LINE: Record<Tone, string> = {
  lightning: 'lightning. blink and you missed it.',
  quick: 'quick hands.',
  steady: 'steady. right on the average.',
  dreamy: 'dreamy. try once more, eyes on the pad.',
}

/** A tap before the pad went green. */
export const isFalseStart = (state: 'wait' | 'go' | 'idle' | 'early' | 'result', tapped: boolean): boolean => tapped && state === 'wait'
