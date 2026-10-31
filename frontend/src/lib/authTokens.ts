/**
 * Inline tokens for the auth funnel's A6 headline layout.
 *
 * Section 02 step 40 describes A6: one line with inline tokens instead of
 * eyebrow + heading + paragraph. Tokens render at 40px, `vertical-align:
 * middle`, INSIDE the sentence rather than beside it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TWO KINDS, NOT THREE. The step names three: a drive photo, a member's
 * initials disc, and a mono count pill. **The initials disc is deliberately
 * not implemented.**
 *
 * `/login` is a SIGNED-OUT PUBLIC PAGE. The auth funnel's own constraint 1 is
 * "never name a member who has not opted into being named", and there is no
 * opt-in-to-be-named column on `members` (checked live 2026-09-04). Initials
 * are weaker than a full name but still identify a person, and the members
 * table is 1,317 active students, many of them minors. A design that shows a
 * stranger's initials to an anonymous visitor is not a smaller version of
 * naming them; it is the same disclosure at lower resolution.
 *
 * If an opt-in column is ever added, `TokenKind` gains 'initials' and this
 * comment gets deleted. Until then the type itself is the guard, and
 * `authTokens.test.ts` asserts it.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * The canonical public figures, verbatim from `AboutPage.tsx` and
 * `lib/orgFacts.ts`. A count pill may render ONE of these and nothing else.
 *
 * This list is the whole point of the type. `github.md` records that `1,247`
 * entered this project as an invented member number and spread to seven places
 * as a fake headcount; a token that can interpolate an arbitrary number into
 * the headline of the org's most-read signed-out page is exactly how that
 * happens again.
 *
 * '1,300+' and '540+' are `displayCount(ORG_FACTS.membersTotal)` and
 * `displayCount(ORG_FACTS.drivesWrittenUp)` respectively (changelog/21-org-facts.md) —
 * NOT hand-picked. They are copied here as literals rather than computed
 * inline because `CanonicalFigure` is a TypeScript literal-union type (that's
 * what makes an arbitrary number impossible at the type level), and a value
 * returned by a function call can never narrow to a string literal type, only
 * a literal written in source can. `authTokens.test.ts` cross-checks these two
 * against `displayCount(ORG_FACTS.*)` at test time, so a re-run of
 * `compute-org-facts.mjs` that moves either figure enough to change its
 * rounded display fails that test loudly instead of silently going stale here
 * (a stale entry doesn't crash anything — `countToken` just returns `null` and
 * the token quietly vanishes, which is exactly the failure mode the test
 * exists to catch). When that test fails, update the two literals below to
 * match, by hand — do not make this array computed.
 */
export const CANONICAL_FIGURES = [
  '1,300+',
  '540+',
  '3,500+',
  '4,000+',
  '15,000',
  '8',
  '16',
  '300',
  '₹1L+',
  '₹0',
] as const

export type CanonicalFigure = (typeof CANONICAL_FIGURES)[number]

export type TokenKind = 'count' | 'photo'

export type AuthToken =
  | {
      kind: 'count'
      /** Must be a canonical figure. The type makes an arbitrary number impossible. */
      value: CanonicalFigure
      /** Short mono label under/beside the figure, e.g. 'projects'. */
      label: string
    }
  | {
      kind: 'photo'
      /**
       * A hosted image URL. NOT populated today, deliberately: all 26 AQ Labs
       * process photos are `drive.google.com` form-upload URLs, which are not a
       * public image source, and the four drive photos live only in the design
       * bundle, not under `frontend/public/`. The kind exists so the renderer
       * and the tests are ready; the moment a real hosted photo exists, a rule
       * can carry one with no code change here.
       *
       * A photo token must belong to the row it is shown with. A generic stock
       * photo standing in for "a drive" is the failure this project has shipped
       * three times.
       */
      src: string
      /** Real alt text describing THIS photo, never a generic caption. */
      alt: string
    }

/** Type guard used by the renderer and asserted by the tests. */
export function isCanonicalFigure(v: string): v is CanonicalFigure {
  return (CANONICAL_FIGURES as readonly string[]).includes(v)
}

/**
 * Build a count token, or return null if the figure is not canonical.
 *
 * Returning null rather than throwing is deliberate: a headline that quietly
 * loses its token still reads as a sentence, whereas a thrown error takes down
 * the one screen a locked-out member needs. The test suite is what catches a
 * bad figure at build time; this is the runtime floor.
 */
export function countToken(value: string, label: string): AuthToken | null {
  if (!isCanonicalFigure(value)) return null
  return { kind: 'count', value, label }
}

/**
 * Build a photo token. Returns null for anything that is not a usable public
 * image, which today includes every photo this project actually has.
 *
 * `drive.google.com` is rejected by name because that is the specific trap:
 * those URLs render for the person who uploaded them and 404 or redirect to a
 * sign-in page for everyone else, so the failure is invisible in development.
 */
export function photoToken(src: string, alt: string): AuthToken | null {
  if (!src || !alt) return null
  if (/drive\.google\.com/i.test(src)) return null
  if (!/^\/|^https?:\/\//.test(src)) return null
  return { kind: 'photo', src, alt }
}

/**
 * Emphasis, per decision 4 of the 2026-09-05 study.
 *
 * The `rooms` reference greys roughly 40% of its headline so one clause lands
 * harder than the rest, without a second type size. Applying that to an
 * engine-generated string needs a convention, and there were two options:
 * grey everything except the last clause (a guess applied uniformly to 20+
 * strings), or mark the emphasis per rule.
 *
 * Per rule wins. A headline is the one string on this screen that has to land,
 * and "the last clause is always the point" is false for most of the rule
 * table: in "still deciding?" the whole line is the point, and in "you were
 * approved." the verb is.
 *
 * The contract: `emphasis` holds the substring of the headline that stays
 * INK. Everything else renders at `--ink-3`. An absent or unmatched value
 * means the whole headline stays ink, which is exactly today's behaviour, so
 * every existing rule is unaffected by construction.
 */
export type Emphasis = string | undefined

export type HeadlineSegment = { text: string; strong: boolean }

/**
 * Split a headline into ink and muted segments.
 *
 * Returns a single strong segment when there is no emphasis, when the
 * emphasis is not found, or when it matches the whole headline, so the
 * degenerate cases all land on "render it as it is today".
 */
export function splitHeadline(headline: string, emphasis: Emphasis): HeadlineSegment[] {
  if (!emphasis) return [{ text: headline, strong: true }]

  const i = headline.indexOf(emphasis)
  if (i === -1) return [{ text: headline, strong: true }]
  if (emphasis === headline) return [{ text: headline, strong: true }]

  const out: HeadlineSegment[] = []
  if (i > 0) out.push({ text: headline.slice(0, i), strong: false })
  out.push({ text: emphasis, strong: true })
  const rest = headline.slice(i + emphasis.length)
  if (rest) out.push({ text: rest, strong: false })
  return out
}
