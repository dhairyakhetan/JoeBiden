/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   One rule for "what is this post's title".
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   `.feed-card` (feed/FeedPostCard.tsx) used to derive its heading with a
   word-boundary slice of the first ~120 characters of `post.body`. That rule
   has no notion of a title, so on a body that opens with its OWN title line
   ("People in the Mirror\n\nI've been a lot of people…") it swallowed the
   title AND the first sentence of the body into a single bold <h2>, then
   printed that same body again underneath. On the pinned hero, no less.

   Three cards further down the same page, the `.aqc` family already answers
   the question correctly: `splitPostBody` (lib/feedShape.ts, frozen) splits on
   the author's own blank line, which 583 of 586 published bodies have. So the
   feed was giving two contradictory answers to "what is a post title" on one
   screen. This makes `.feed-card` use the `.aqc` answer.

   The only thing added on top of `splitPostBody` is a length guard, for the
   handful of rows whose "title" is really a whole run-on paragraph (no blank
   line, no newline). There the old word-boundary slice is still the right
   degrade, so it is kept — applied to the FIRST LINE rather than to the raw
   body, and what it cuts off is pushed into the snippet instead of being lost.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { splitPostBody } from '../lib/feedShape'

/** Longest heading the card will set before it falls back to a boundary cut. */
export const HEADLINE_LIMIT = 120

/** How much of the body the card prints under the heading. */
export const SNIPPET_LIMIT = 300

export interface PostHeadline {
  /** The heading. Never contains a paragraph break; '' only for an empty body. */
  headline: string
  /** The snippet printed under it, already capped. */
  rest: string
  /** True only when `headline` is a cut of a longer line (i.e. render an "…"). */
  truncated: boolean
}

/**
 * @param snippetLimit How much of the remainder to keep. Defaults to
 *   SNIPPET_LIMIT, which is right for `.feed-card`, where the snippet is a
 *   teaser under a heading. The `.aqc` family-05 cards pass `Infinity`: two of
 *   them (CardStandard, CardStack) print `rest` with no clamp at all, so a
 *   300-character cut there would silently drop the end of a real post. They
 *   want the headline guard, not the snippet policy.
 */
export function derivePostHeadline(
  body: string | null | undefined,
  snippetLimit: number = SNIPPET_LIMIT,
): PostHeadline {
  const { title, rest } = splitPostBody(body)
  if (!title) return { headline: '', rest: '', truncated: false }

  if (title.length <= HEADLINE_LIMIT) {
    return { headline: title, rest: rest.slice(0, snippetLimit).trim(), truncated: false }
  }

  // No title structure at all (one long paragraph): cut at the end of the first
  // sentence inside the budget, else at the last word boundary, never mid-word.
  const window_ = title.slice(0, HEADLINE_LIMIT + 1)
  const sentence = window_.search(/[.!?](\s|$)/)
  const lastSpace = window_.lastIndexOf(' ')
  const cut = sentence > 40 ? sentence + 1 : lastSpace > 40 ? lastSpace : HEADLINE_LIMIT

  const headline = title.slice(0, cut).trim()
  const tail = `${title.slice(cut).trim()}${rest ? `\n\n${rest}` : ''}`.trim()
  return {
    headline: headline || title.slice(0, HEADLINE_LIMIT).trim(),
    rest: tail.slice(0, snippetLimit).trim(),
    truncated: headline.length < title.length,
  }
}
