/* Family 06 · digest: C22 roundup, C28 milestone, C17 spotlight.
   Injected at fixed slots, NOT sorted: C22 at slot 4, C17 at slot 9, C28 only
   on the session where the counter crosses. Never two in one session, which the
   chooser enforces with `session.digestUsed`.

   RESTYLE 15-post-cards.md: all three shapes here are 15.15's blocked
   C17/C22/C28 ("a weekly aggregate endpoint that does not exist") - no
   numbered subsection of their own, so 15.15's generic instruction is the
   whole brief: match 15.2's shared chrome, then leave the shape unreachable.
   Built entirely on ./parts.tsx's CardShell/Figure/LiveMarker and
   ./cards.css's .aqc-* classes, both of which already carry this pass's
   token changes (--r-outer/--r-inner/--r-tight, --hair-2, the six-rung
   paper-on-ink ladder) with no per-file edit needed - checked line by line
   against 15.2 and rule 4 (CardRoundup/CardMilestone's live-marker fallback
   when a figure is null) and found nothing left to change there.

   One real fix DID land, in CardMilestone: tokens.css's own comment on the
   *-ink partners measures the raw category hues AS TEXT on a light card and
   two of the five fail even the >=24px/3:1 large-type floor - events/--sky
   at 2.54:1, labs/--lemon at 1.61:1 (tokens.css lines ~57-62). CardMilestone
   was colouring its 52px figure with hueOrInk(d.category), which hits that
   exact failure for those two categories. `inkHueFor` (./parts) swaps in the
   already-existing *-ink partner per category (no new colour - every value
   is already in tokens.css) so the colour-by-category idea survives without
   the contrast failure. family03Records.tsx's C11 has the identical
   exposure in its own delivered-figure and now shares this same helper -
   promoted to parts.tsx once a second caller needed it, per this file's own
   original note that it would be. */

import { UsersIcon } from '@heroicons/react/24/outline'
import { CardShell, Figure, LiveMarker, hueOrInk, inkHueFor } from './parts'
import type { CardProps } from './types'

/** C22 · impact roundup. A week is a summary, not a story: four numbers in a
    grid beats four separate cards. Any figure the host could not resolve prints
    the dashed marker, so the grid never fills itself with plausible numbers. */
export function CardRoundup({ item }: CardProps) {
  const d = item.display
  const figures = d.figures ?? []
  return (
    <CardShell tone="ink" label={d.title ?? 'This week in numbers'}>
      <span className="aqc-kicker">{d.kicker ?? 'this week'}</span>
      <h3 className="aqc-title aqc-title-lg" style={{ color: 'var(--paper)' }}>{d.title}</h3>
      <div className="aqc-roundup-grid">
        {figures.map(f => (
          <span key={f.label} className="aqc-roundup-cell">
            <Figure figure={f} hue={hueOrInk('welfare')} />
          </span>
        ))}
      </div>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
    </CardShell>
  )
}

/** C28 · milestone. A milestone is a single number and the sentence that earns
    it. Nothing else belongs on the card. Only canonical figures may be written
    here (lib/orgFacts, AboutPage); anything else is the live marker. */
export function CardMilestone({ item }: CardProps) {
  const d = item.display
  const n = (d.figures ?? [])[0]
  return (
    <CardShell label={d.title ?? 'A milestone'}>
      {n && n.value !== null
        ? <span className="aqc-figure-n" style={{ fontSize: 52, color: inkHueFor(d.category ?? 'welfare') }}>{n.value}</span>
        : <LiveMarker label={n?.label ?? 'the milestone figure'} />}
      <span className="aqc-figure-label">{n?.label ?? d.kicker}</span>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
    </CardShell>
  )
}

/** C17 · team spotlight. Recruitment momentum is worth showing, and avatars
    carry it better than a sentence does. */
export function CardSpotlight({ item }: CardProps) {
  const d = item.display
  const faces = (d.rows ?? []).slice(0, 8)
  const more = (d.rows?.length ?? 0) - faces.length
  return (
    <CardShell tone="ink" label={d.title ?? 'A team spotlight'}>
      <div className="aqc-row">
        <UsersIcon width={16} height={16} strokeWidth={1.8} />
        <span className="aqc-kicker aqc-grow">{d.kicker ?? 'team'}</span>
        {d.meta ? <span className="aqc-pill" style={{ borderColor: 'rgba(244,239,224,.4)', color: 'var(--paper)' }}>{d.meta}</span> : null}
      </div>
      <h3 className="aqc-title aqc-title-lg" style={{ color: 'var(--paper)' }}>{d.title}</h3>
      <div className="aqc-faces">
        {faces.map(f => (
          <span key={f.id} className="aqc-face" title={f.name}>{f.name.trim().charAt(0).toUpperCase()}</span>
        ))}
        {more > 0 ? <span className="aqc-face">+{more}</span> : null}
      </div>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
      {d.ctaLabel ? <a className="aqc-btn" style={{ background: 'var(--paper)' }} href={d.ctaHref ?? d.href}>{d.ctaLabel}</a> : null}
    </CardShell>
  )
}
