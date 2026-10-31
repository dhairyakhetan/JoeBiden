/**
 * TerraThon site config - the things a human edits without touching a component.
 *
 * Event data (fees, caps, venues, close times) deliberately does NOT live here:
 * it is in `terrathon_events` so the team can change it without a redeploy.
 * Only things the database has no business holding belong in this file.
 */
import type { SportSlug } from './lib/types'

/**
 * AQ's single collection account (blocker B4, answered 2026-09-19).
 *
 * The handle looks personal because Google Pay derives it from the signed-in
 * identity, but the underlying bank account is the NGO's, which is what AQ's
 * Non-negotiable 4 requires.
 *
 * `payeeName` is a REQUEST, not a guarantee: UPI apps override `pn` with the
 * bank's own registered account name. Confirm what the confirmation screen
 * actually shows during the ₹1 launch test.
 */
export interface Contact {
  name: string
  /** Not rendered any more: both contacts take every kind of question, and
      labelling one "Registrations" sent people to the wrong person. */
  role?: string
  /** 10 digits, no country code. A card renders ONLY when this is present. */
  phone?: string
}

/**
 * The two people who answer for TerraThon.
 *
 * Confirmed by the event director 2026-09-19, replacing a seven-name list in
 * which only one number existed. Roles are deliberately not rendered: both of
 * these take every kind of question, and labelling one "Registrations" sent
 * people to the wrong person. Never invent a number here.
 *
 * Declared before `UPI` and `ASK_PHONE` below because both derive their
 * numbers from this array rather than repeating the digits as a second
 * literal: a number changed here used to go stale in two other places.
 */
export const CONTACTS: Contact[] = [
  { name: 'Pratyaksh Singhania', phone: '9830554654' },
]

export const UPI = {
  vpa: 'kanishk.ag2468-2@okhdfcbank',
  payeeName: 'Team AquaTerra',
}

export const EVENT = {
  name: 'TerraThon 2026',
  wordmark: 'TERRATHON',
  wordmarkYear: '2026',
  tagline: 'Your team. Your court. Your money.',
  instagram: 'https://instagram.com/aquaterra.live',
  instagramNgo: 'https://instagram.com/ngo.aquaterra',
  email: 'ngo.aquaterra@gmail.com',
  mainSite: 'https://www.ngoaquaterra.com',
  /** Base path for every TerraThon route. Changing this moves the whole section. */
  base: '/terrathon',
}

/**
 * The number every "ask about this" link on the site points at.
 * Derived from CONTACTS rather than repeated as a literal: a number changed
 * in one place should not go stale in another. There is one contact now, so
 * this is index 0; it read index 1 until the second contact was removed on
 * 2026-09-21, which would have thrown at module load.
 */
export const ASK_PHONE = CONTACTS[0].phone as string

/** Per-sport copy. PRD 4.4: the vibe lines ship as written. */
export const SPORT_COPY: Record<SportSlug, { subtitle: string; vibe: string; fact: string; factLabel: string }> = {
  pickleball: {
    subtitle: 'Doubles, league into knockouts',
    vibe: 'Doubles, on a court the size of a badminton court. Rallies are short, the serve is underarm, and a pair who have never played before are usually competitive by the second game.',
    // PRD flag 7: the dog story is contested. One co-founder's family credited
    // the dog Pickles; the other said the name came from "pickle boat" and the
    // dog was named after the game. This wording is honest about that without
    // losing the hook.
    fact: 'Nobody agrees on the name. One co-founder swore it was the family dog, Pickles. The other family says the dog got named after the game.',
    factLabel: 'Did you know?',
  },
  cricket: {
    subtitle: 'One innings, straight knockout',
    vibe: 'One innings, straight knockout. There is no second chance and no league table, so every match is effectively a final and the whole draw is settled across the weekend.',
    fact: 'In 1939, a Test in Durban ran for ten days and still ended in a draw, only because England had to catch the boat home.',
    factLabel: 'Did you know?',
  },
  fifa: {
    subtitle: 'Solo league, one controller',
    vibe: 'One player, one controller, a straight league. Nothing to organise and no kit to bring, which makes it the easiest of the three to enter on your own.',
    fact: 'EA has put superstars in motion-capture suits for years to animate the way they actually move on the pitch.',
    factLabel: 'Did you know?',
  },
}

/**
 * Class options. No longer asked on the public form, which takes age instead
 * (2026-09-19), but still used by the admin's manual-add drawer for walk-ins
 * where a volunteer is filling it in from a conversation.
 */
export const CLASS_OPTIONS = [
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12',
  'College (1st year)', 'College (2nd year)', 'College (3rd year)', 'College (4th year)',
  'Other',
]

/**
 * Partners and sponsors. EMPTY ON PURPOSE until real ones are signed.
 *
 * The footer row and the partners band both render nothing at all while this is
 * empty, rather than showing "Your logo here" placeholders. A fake sponsor wall
 * on a fundraiser page is worse than no sponsor wall: it is the first thing a
 * real sponsor's marketing lead will notice.
 *
 * To add one: `{ name, url, logo }` where `logo` is a path under /public.
 */
export interface Partner {
  name: string
  url?: string
  /** Path to the logo file under /public, served as-is. */
  logo?: string
}
export const PARTNERS: Partner[] = []

/** What AQ has actually run before. Used by the credibility band on Home. */
export const TRACK_RECORD = [
  { value: '2021', label: 'Running since' },
  { value: '3', label: 'Sports this year' },
  { value: '12A · 80G', label: 'Registered NGO' },
]
