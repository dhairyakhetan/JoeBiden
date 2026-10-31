/**
 * The pure mapping at the centre of the auth funnel's contextual hero:
 * `resolveAuthHero(intent, counts) -> AuthHero`. One function, one place,
 * that owns "which intent gets which look" - see auth/AuthHero.tsx for the
 * component that renders what this returns, and lib/authIntent.ts for where
 * the intent itself comes from.
 *
 * Every hue used here is a background FILL, so text colour is resolved with
 * `stickerTextHex()` - the same measured-contrast function components/
 * Sticker.tsx uses - rather than one of the `--*-ink` tokens, which are tuned
 * for the opposite case (a hue used as text colour on a light ground). Do not
 * swap these two; `--welfare-ink` on `--welfare` itself has never been
 * measured for that direction.
 */
import type { AuthIntent, GateCategory, PostGateAction } from './authIntent'
import { HUE_VAR, stickerTextHex, type StickerHue } from './stickerShapes'
import { APPROVAL_TIME } from './orgFacts'

export interface AuthHeroCounts {
  membersDisplay: string
  /** Top-level departments (ORG_FACTS.departmentsActive), the figure "N departments" means. */
  departmentsActive: number
  drivesDisplay: string
}

export interface AuthHeroTone {
  /** null on the deliberately flat/admin variant - no sticker, no hue. */
  hue: StickerHue | null
  bg: string
  ink: string
  /** The admin variant only: muted and explicitly non-promotional. */
  flat?: boolean
}

export interface AuthHero {
  kind: AuthIntent['kind']
  tone: AuthHeroTone
  /** Small state-readout pill above the sentence, e.g. "★ open role". Empty
   *  on the flat/admin variant, which carries no eyebrow at all. */
  eyebrow: string
  /** The one headline sentence. Real content only. */
  sentence: string
  /** The substring of `sentence` that stays ink; the rest renders muted.
   *  Reuses lib/authTokens.ts's `splitHeadline`, the same emphasis
   *  convention the sign-in card's own headline already uses, so the
   *  treatment reads as one system across a palette that changes per
   *  variant. */
  emphasis?: string
  subline: string
  /** A short (<= 2 word) word for the one-sticker fragment callout, or null
   *  when the kind has nothing worth putting on a sticker (a demo's flow
   *  name and a resume label are both too long for the sticker's own
   *  short-word convention - see components/Sticker.tsx). */
  fragmentWord?: string | null
  /** The default/no-intent hero's numeral fragment. */
  fragmentNumeral?: { value: string; unit: string } | null
}

function toneFor(hue: StickerHue): AuthHeroTone {
  return { hue, bg: HUE_VAR[hue], ink: stickerTextHex(hue) }
}

const CATEGORY_HUE: Record<GateCategory, StickerHue> = {
  welfare: 'welfare',
  events: 'events',
  labs: 'labs',
  operations: 'ops',
  content: 'content',
}

const POST_COPY: Record<PostGateAction, { eyebrow: string; subline: string }> = {
  like: { eyebrow: '★ about to like this', subline: 'Sign in and the like is one tap away.' },
  save: { eyebrow: '★ about to save this', subline: 'Sign in and it goes straight to your saved posts.' },
  comment: { eyebrow: '★ about to reply', subline: 'Sign in and your reply posts right under it.' },
}

/** Pure, deterministic. `default` is the floor and always matches. */
export function resolveAuthHero(intent: AuthIntent, counts: AuthHeroCounts): AuthHero {
  switch (intent.kind) {
    case 'post': {
      const copy = POST_COPY[intent.action]
      const quoted = `“${intent.excerpt}”`
      return {
        kind: 'post',
        tone: toneFor(CATEGORY_HUE[intent.category]),
        eyebrow: copy.eyebrow,
        sentence: `${quoted} is right where you left it.`,
        emphasis: quoted,
        subline: copy.subline,
        fragmentWord: intent.category,
      }
    }

    case 'opening': {
      const quoted = `“${intent.title}”`
      return {
        kind: 'opening',
        tone: toneFor(CATEGORY_HUE[intent.category]),
        eyebrow: '★ open role',
        sentence: `${quoted} is still open.`,
        emphasis: quoted,
        subline: intent.teamName
          ? `Sign in and your application goes straight to the ${intent.teamName} team.`
          : 'Sign in and your application goes to the team that opened it.',
        fragmentWord: intent.category,
      }
    }

    case 'apply':
      return {
        kind: 'apply',
        tone: toneFor('welfare'),
        eyebrow: '★ ready when you are',
        sentence: 'you came here to join in.',
        emphasis: 'join in.',
        subline: `Same button whether you're new or returning. Usually reviewed ${APPROVAL_TIME}.`,
        fragmentWord: 'join',
      }

    case 'demo': {
      const quoted = `“${intent.flowName}”`
      return {
        kind: 'demo',
        tone: toneFor('content'),
        eyebrow: '★ that was the demo',
        sentence: `${quoted}. time to do it for real.`,
        emphasis: quoted,
        subline: 'Everything you just clicked works the same the moment you sign in.',
        fragmentWord: null,
      }
    }

    case 'resume':
      return {
        kind: 'resume',
        tone: toneFor('events'),
        eyebrow: '★ almost there',
        sentence: `sign in and you're back at ${intent.label}.`,
        emphasis: intent.label,
        subline: 'Same place, nothing lost.',
        fragmentWord: null,
      }

    case 'admin':
      return {
        kind: 'admin',
        tone: { hue: null, bg: 'var(--bg-2)', ink: 'var(--ink-2)', flat: true },
        eyebrow: '',
        sentence: 'this address is for AquaTerra staff.',
        subline: 'If that is you, sign in with the Google account on file.',
        fragmentWord: null,
      }

    case 'default':
    default:
      return {
        kind: 'default',
        tone: toneFor('lemon'),
        eyebrow: '★ the work, in numbers',
        sentence: `${counts.membersDisplay} students. ${counts.departmentsActive} departments. ${counts.drivesDisplay} drives written up.`,
        subline: 'all of it run by people who showed up.',
        fragmentNumeral: { value: String(counts.departmentsActive), unit: 'departments' },
      }
  }
}
