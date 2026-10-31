// Pure helpers for the wall pinboard's "manufactured scatter" (16.1): the
// collage look comes from four hashed-not-random variables so a note sits at
// the same tint/size/side/rotation on every render and after every reload.
// No DOM, no React - easy to reason about and to unit test if this file ever
// gets covered.
import { stickerRotation } from '../../lib/uiHelpers'

// The palette's 7 accent hues (README.md invariant 7's contrast table -
// lemon/sky/tomato/pink/teal/grape/welfare). Body text on every one of these
// mixed at 26-34% into --bg stays comfortably light, so plain full-opacity
// ink reads at well over 4.5:1 regardless of which hue lands - verified
// separately (see the build report), not re-derived per hue here.
export const WALL_HUES = ['welfare', 'tomato', 'sky', 'lemon', 'pink', 'grape', 'teal'] as const
export type WallHue = (typeof WALL_HUES)[number]

const HUE_VAR: Record<WallHue, string> = {
  welfare: 'var(--welfare)',
  tomato: 'var(--tomato)',
  sky: 'var(--sky)',
  lemon: 'var(--lemon)',
  pink: 'var(--pink)',
  grape: 'var(--grape)',
  teal: 'var(--teal)',
}

// Same hash shape as lib/uiHelpers.ts's stickerRotation - djb2-ish, stable,
// never Math.random(). Salted per use (a suffix string) so the tint/side/size
// hashes of the SAME note id don't all land on the same bucket in lockstep.
function hashString(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** One of 7 hues, hashed from the note's own id. */
export function noteHue(noteId: string): WallHue {
  return WALL_HUES[hashString(noteId) % WALL_HUES.length]
}

/** "one of seven hues at 26-34% over cream" (16.1) - the percentage is
 *  hashed too, so the board doesn't sit at one flat saturation. */
export function noteTintBackground(noteId: string): string {
  const pct = 26 + (hashString(`${noteId}:pct`) % 9) // 26..34 inclusive
  return `color-mix(in srgb, ${HUE_VAR[noteHue(noteId)]} ${pct}%, var(--bg))`
}

/** true => the hash pill overhangs the note's LEFT edge; false => right. */
export function labelOnLeft(noteId: string): boolean {
  return hashString(`${noteId}:side`) % 2 === 0
}

/** The pill's rotation, from 13's own fixed ten-value set - reused, not
 *  reinvented, and hashed from the note id (not the label text) so it stays
 *  stable even if the same label string appears on two different notes. */
export function pillRotation(noteId: string): number {
  return stickerRotation(noteId)
}

// "a long body" (16.1's Note variants table) gets the serif-italic 17px
// treatment - the one deliberate exception to the hashed 13.5/14px scatter.
// Threshold picked at roughly half the 280-char cap: a note that fills most
// of the box earns the more generous, legible size; a short one is exactly
// the sort of thing the scatter is for.
const LONG_BODY_THRESHOLD = 140

export function isLongBody(body: string): boolean {
  return body.length > LONG_BODY_THRESHOLD
}

/** 13.5 / 14 / 17px, per the Note variants table. 17 always means the serif
 *  italic treatment (see isLongBody) - callers should pair this with
 *  isLongBody() to decide font-family/style, not re-derive "is it 17" some
 *  other way. */
export function bodyFontSize(noteId: string, body: string): number {
  if (isLongBody(body)) return 17
  return hashString(`${noteId}:size`) % 2 === 0 ? 13.5 : 14
}
