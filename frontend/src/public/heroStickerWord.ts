/* The hero's category sticker is a 200x64 "ticket". Its type layer keeps a 9%
   safe inset and sets the word at 0.155 of the sticker width, so one line holds
   roughly 8 caps and there is no room for a second. Project 1018's objective
   ("Distribution Workshop", 21 chars) wrapped to three lines and spilled out of
   the die-cut, over the back button. The full objective is still printed in the
   hero kicker beside the title, so the sticker only needs a short stamp. */

export const HERO_STICKER_MAX = 12

const SHORT: Record<string, string> = {
  'Distribution Drive': 'Distribution',
  'Distribution Workshop': 'Workshop',
  'Plantation Drive': 'Plantation',
  'Feeding Dogs': 'Dogs',
  'Fundraising Event': 'Fundraiser',
  'Sundarbans Relief': 'Sundarbans',
  'Old Age Home Visit': 'Old Age',
}

export function heroStickerWord(objective: string): string {
  const t = objective.trim()
  if (SHORT[t]) return SHORT[t]
  if (t.length <= HERO_STICKER_MAX) return t
  const first = t.split(/\s+/)[0]
  return first.length <= HERO_STICKER_MAX ? first : `${first.slice(0, HERO_STICKER_MAX - 1)}…`
}
