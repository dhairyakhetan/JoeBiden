/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SECTION 10 step 5 · the dispatcher
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Look the chosen shape up in the registry and render it. That is the whole
   file.

   THE DECISION IS A PROP, NOT A RENDER-TIME CALL. `chooseCardShape` mutates the
   session (that is what the caps require), so calling it from a component's
   render body would consume the hero cap, the ask throttle and the per-author
   collapse again on every re-render, and twice per render under StrictMode. The
   list resolves its shapes once with `shapeFeed(items)` in a `useMemo` and
   passes each decision down. `shape` is accepted directly for the same reason.

   This is a NEW, MOUNTABLE dispatcher and NOT a replacement for
   `feed/FeedPostCard.tsx`. FeedPostCard is the live card and keeps working
   untouched; section 10 step 5's "FeedPostCard becomes a thin dispatcher" is
   the mounting step, set out in CHANGELOG_SEC10_34.md.

   Supabase-free by contract, like the card it will eventually replace: it
   fetches nothing and takes everything as props.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import type { CardShape, FeedItem, ShapeDecision } from '../../lib/feedShape'
import { CARD_COMPONENTS } from './registry'
import type { CardProps } from './types'

interface Props extends Omit<CardProps, 'item'> {
  item: FeedItem
  /** From `shapeFeed(items)`, resolved once for the whole list. */
  decision?: ShapeDecision
  /** Or the bare shape id, for the catalogue and for tests. */
  shape?: CardShape
}

export default function FeedCard({ item, decision, shape, ...wiring }: Props) {
  const chosen = shape ?? decision?.shape
  if (!chosen) return null
  const Component = CARD_COMPONENTS[chosen]
  return (
    /* `data-card-shape` is the only way to tell from the outside which of the
       thirty shapes a row actually resolved to. Without it the feed's variety
       can only be eyeballed, and eyeballing is what let "4 of 30 render" sit
       unnoticed. One attribute on a wrapper that adds no box: `display:
       contents` means this element generates no layout of its own, so the
       card's own grid/flex placement in the list is untouched. */
    <div data-card-shape={chosen} data-card-rule={decision?.rule} style={{ display: 'contents' }}>
      <Component item={item} {...wiring} />
    </div>
  )
}
