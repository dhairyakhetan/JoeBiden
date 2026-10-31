/* ─────────────────────────────────────────────────────────────────────────
   The mascot cast — redesign section 09.

   Pure data plus two pure helpers, deliberately kept out of the component so
   `vitest` (node environment, the lib test glob) can cover them without a
   DOM or the React plugin. The component that renders this is
   `components/Mascot.tsx` (renamed from `AQMascot.tsx` by
   18-mascots-and-motion.md once the legacy parked companion was retired).

   The cast table is copied from `docs/CHANGELOG-REDESIGN.md` section 09 and
   the geometry from `AQ Mascots.dc.html` cards K1 and K2. Every part is a
   border-radius box: there is no image file, no SVG and no icon font, which
   is what lets the cast recolour from the palette and scale from 26px to
   110px with no assets.

   Colours are token references only. Nothing here introduces a hue that is
   not already in `styles/tokens.css`.
   ───────────────────────────────────────────────────────────────────────── */

export type MascotCharacter = 'nolen' | 'ilish' | 'tuk' | 'mishti' | 'khoka' | 'bhoot'

/** Body silhouettes, expressed as the `border-radius` shorthand each one uses. */
export type MascotBody = 'round' | 'tall' | 'squat' | 'wide' | 'heavy'

/** Eye arrangements. `worried` is `two` with the pupils dropped to the floor. */
export type MascotEyes = 'two' | 'three' | 'one' | 'wide' | 'worried'

export type MascotMouth = 'grin' | 'teeth' | 'smile' | 'o' | 'flat'

export interface CastEntry {
  /** Display name, as it appears on the cast card. NeutralFace is caps-only. */
  name: string
  /** The desk this character speaks for. */
  desk: string
  /** One-line temperament, from the section 09 table. */
  temperament: string
  /** Token reference used as the fill. Never a raw hex. */
  hue: string
  /** The same hue as a hex, for contrast maths and tests only. */
  hueHex: string
  body: MascotBody
  eyes: MascotEyes
  mouth: MascotMouth
  arms: boolean
  feet: boolean
  antenna: boolean
}

/**
 * The six. Order is load-bearing: `characterForSeed` indexes into it, so
 * reordering this array reassigns every seeded member to a new character.
 */
export const CHARACTERS: readonly MascotCharacter[] = [
  'nolen',
  'ilish',
  'tuk',
  'mishti',
  'khoka',
  'bhoot',
] as const

export const CAST: Record<MascotCharacter, CastEntry> = {
  nolen: {
    name: 'NOLEN',
    desk: 'Welfare',
    temperament: 'the steady one',
    hue: 'var(--welfare)',
    hueHex: '#1B8A5A',
    body: 'tall',
    eyes: 'two',
    mouth: 'grin',
    arms: false,
    feet: true,
    antenna: false,
  },
  ilish: {
    name: 'ILISH',
    desk: 'Events',
    temperament: 'the excitable one',
    hue: 'var(--sky)',
    hueHex: '#3DA9FC',
    body: 'round',
    eyes: 'three',
    mouth: 'teeth',
    arms: true,
    feet: false,
    antenna: false,
  },
  tuk: {
    name: 'TUK',
    desk: 'Human Resources',
    temperament: 'the patient one',
    hue: 'var(--lemon)',
    hueHex: '#FFC700',
    body: 'squat',
    eyes: 'two',
    mouth: 'smile',
    arms: false,
    feet: false,
    antenna: true,
  },
  mishti: {
    name: 'MISHTI',
    desk: 'Media',
    temperament: 'the show-off',
    hue: 'var(--pink)',
    hueHex: '#FF4D8C',
    body: 'round',
    eyes: 'one',
    mouth: 'grin',
    arms: true,
    feet: true,
    antenna: false,
  },
  khoka: {
    name: 'KHOKA',
    desk: 'ShikshAQ',
    temperament: 'the explainer',
    hue: 'var(--teal)',
    hueHex: '#12909C',
    body: 'wide',
    eyes: 'wide',
    mouth: 'o',
    arms: false,
    feet: true,
    antenna: false,
  },
  bhoot: {
    name: 'BHOOT',
    desk: 'Projects',
    temperament: 'the deadpan',
    hue: 'var(--grape)',
    hueHex: '#7E5BFF',
    body: 'heavy',
    eyes: 'worried',
    mouth: 'flat',
    arms: true,
    feet: false,
    antenna: false,
  },
}

/** The eight poses. There is no ninth. */
export const POSES = [
  'idle',
  'blink',
  'peek',
  'load',
  'cheer',
  'sleep',
  'stumped',
  'follow',
] as const
export type MascotPose = (typeof POSES)[number]

/** Four steps only, never between them. */
export const SIZES = [26, 44, 64, 110] as const
export type MascotSize = (typeof SIZES)[number]

/**
 * FNV-1a, 32-bit, returned unsigned. Stable across runs and platforms, which
 * is the whole point: a member must get the same character every time.
 */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** `hash(seed) % 6`, per the section 09 props table. */
export function characterForSeed(seed: string): MascotCharacter {
  return CHARACTERS[hashSeed(seed) % CHARACTERS.length]
}

/**
 * Blink delays are staggered so a group never blinks in unison. Derived from
 * the seed (or the character name when there is no seed) rather than
 * randomised, so a re-render does not resynchronise the row.
 * Returns seconds in [0, 4.2), one tenth of a second apart.
 */
export function blinkDelay(key: string): number {
  return (hashSeed(key) % 42) / 10
}
