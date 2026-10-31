/* Family 03 · records: C13 certificate, C12 achievement, C10 project active,
   C11 project delivered, C09 drive, C20 class, C21 drop.
   Durable facts with their own tables. THE SHAPE COMES FROM THE RECORD TYPE,
   never from the body length: that is the whole reason the family sits above
   family 05. */

import {
  AcademicCapIcon,
  CheckBadgeIcon,
  DocumentCheckIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline'
import Img from '../../components/Img'
import { Sticker } from '../../components/Sticker'
import { AuthorPill, CardPhoto, CardShell, CreamCTA, Figure, LiveMarker, MetaRow, hueOrInk, inkHueFor, stickerHueFor } from './parts'
import type { CardProps } from './types'

/** C13 · certificate issued. A certificate is a DOCUMENT: mono, ruled,
    perforated, so it reads as a record and not as a post. */
export function CardCertificate({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  const figures = d.figures ?? []
  return (
    <CardShell className="aqc-cert" label={d.title ?? 'A certificate was issued'}>
      {/* A seal overhanging the top-right corner, same "state flag" device
          C16's break card already uses (cards.css's own usage table
          cross-references it) - a certificate being issued is a durable
          record, exactly the kind of rare, non-default shape this family's
          own header says the chooser reserves for records, not the common
          post - so it's a safe, naturally-throttled spot for one. */}
      <Sticker shape="rosette12" hue={stickerHueFor(d.category)} rotate={6} size={72} className="aqc-record-seal" />
      <div className="aqc-row">
        <DocumentCheckIcon width={16} height={16} strokeWidth={1.8} />
        <span className="aqc-kicker aqc-grow">{d.kicker ?? 'certificate · issued'}</span>
        {d.meta ? <span className="aqc-figure-label">{d.meta}</span> : null}
      </div>
      <span className="aqc-cert-name">{d.title}</span>
      <div className="aqc-cert-grid">
        {figures.map(f => <Figure key={f.label} figure={f} />)}
      </div>
      <div className="aqc-row">
        {d.ctaLabel ? <a className="aqc-btn aqc-btn-primary" href={d.ctaHref ?? d.href}>{d.ctaLabel}</a> : null}
        {d.secondaryLabel ? <a className="aqc-btn aqc-btn-quiet" href={d.secondaryHref}>{d.secondaryLabel}</a> : null}
      </div>
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C12 · achievement verified. An achievement is somebody else vouching for
    you, so the seal is the content. */
export function CardAchievement({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  return (
    <CardShell label={d.title ?? 'A verified achievement'}>
      <Sticker shape="rosette12" hue="welfare" rotate={-6} size={72} className="aqc-record-seal" />
      <AuthorPill name={d.authorName} role={d.authorRole} avatar={d.authorAvatar} href={d.authorHref} />
      <div className="aqc-row">
        <CheckBadgeIcon width={18} height={18} strokeWidth={2} style={{ color: hueOrInk('welfare') }} />
        <span className="aqc-kicker aqc-grow">{d.kicker ?? 'verified'}</span>
      </div>
      <h3 className="aqc-title">{d.title}</h3>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
      {d.ctaLabel ? <a className="aqc-btn aqc-btn-quiet" href={d.ctaHref ?? d.href}>{d.ctaLabel}</a> : null}
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C10 · project, in flight. A project is a commitment, not a moment: a
    target, a bar and who is on it. With no target resolved the bar is replaced
    by the live marker rather than being drawn at a guessed percentage. */
export function CardProject({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  const known = typeof d.filled === 'number' && typeof d.needed === 'number' && d.needed > 0
  const pct = known ? Math.min(100, Math.round((d.filled! / d.needed!) * 100)) : 0
  return (
    <CardShell label={d.title ?? 'A project in flight'}>
      <div className="aqc-row">
        <span className="aqc-kicker aqc-grow">{d.kicker ?? 'project · active'}</span>
        {d.meta ? <span className="aqc-pill">{d.meta}</span> : null}
      </div>
      <CardPhoto url={d.imageUrl} alt={d.imageAlt ?? ''} ctx="card" />
      <h3 className="aqc-title aqc-title-lg">{d.title}</h3>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
      {known ? (
        <>
          <div className="aqc-bar">
            <div className="aqc-bar-fill" style={{ width: `${pct}%`, background: hueOrInk(d.category) }} />
          </div>
          <span className="aqc-figure-label">{d.filled} of {d.needed}</span>
        </>
      ) : (
        <LiveMarker label="progress against the target" />
      )}
      {d.ctaLabel ? <a className="aqc-btn aqc-btn-primary" href={d.ctaHref ?? d.href}>{d.ctaLabel}</a> : null}
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C11 · project delivered. A finished project stops asking for anything: the
    number goes big and the progress bar disappears - deleting the bar is the
    point of the shape, so unlike C10 there is no live-marker fallback bar
    here at all (15.8). */
export function CardProjectDone({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  const headline = (d.figures ?? [])[0]
  return (
    <CardShell label={d.title ?? 'A delivered project'}>
      <div style={{ position: 'relative' }}>
        <CardPhoto url={d.imageUrl} alt={d.imageAlt ?? ''} ctx="card" ratio="16 / 10" />
        <span className="aqc-delivered-pill">{d.kicker ?? 'delivered'}</span>
      </div>
      {headline ? (
        headline.value !== null ? (
          <div>
            <p className="aqc-delivered-figure" style={{ margin: 0, color: inkHueFor(d.category) }}>{headline.value}</p>
            <span className="aqc-figure-label">{headline.label}</span>
          </div>
        ) : (
          <LiveMarker label={headline.label} />
        )
      ) : null}
      {/* The statistic is the headline; the title is secondary body copy here
          (15.8: "KEEP the title as 700 17px var(--eina)"). */}
      <h3 style={{ margin: 0, fontFamily: 'var(--eina)', fontWeight: 700, fontSize: 17, lineHeight: 1.25 }}>{d.title}</h3>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
      {/* Footer: mono completion date + a quiet cream pill. No like button -
          a delivered record is not asking for approval (15.8). */}
      <div className="aqc-row" style={{ marginTop: 2 }}>
        {d.meta ? <span className="aqc-figure-label aqc-grow">{d.meta}</span> : <span className="aqc-grow" />}
        <a className="aqc-btn aqc-btn-cream" href={d.ctaHref ?? d.href}>
          {d.secondaryLabel ?? 'Read it'} <span aria-hidden="true">&#8594;</span>
        </a>
      </div>
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C09 · drive, upcoming - the full-bleed photo card, and the only one that
    can be filled at scale (2,031 welfare_projects rows, 15.7 / "reference A").
    Unlike every other shape in this family, the shell itself is NOT the
    standard padded white card: tone="plain" hosts a self-contained, clipped
    wrapper (the same pattern C01's hero already used) so the photo can run
    edge to edge under a scrim, which is the one thing this shape is about. */
export function CardDrive({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  const spots = typeof d.filled === 'number' && typeof d.needed === 'number'
    ? `${Math.max(0, d.needed - d.filled)} of ${d.needed} spots left`
    : null
  // `welfare_projects.header` is free text a director types - most rows are a
  // short name ("Khidirpur books"), but a live one runs to 90 characters, a
  // full sentence naming a partner organisation, not a short name. 03.5's
  // rule is "shape comes from the record type, never from body length", so
  // the chooser will not gate C09
  // out for a long header - this card has to survive one instead of
  // rendering it at hero scale. cards.css's 3-line clamp is the hard floor;
  // this step just keeps a long header legible inside it rather than cutting
  // a short sentence off after four words at 28px.
  const titleLen = (d.title ?? '').length
  const titleSizeClass = titleLen > 70 ? ' aqc-fullbleed-title--sm' : titleLen > 40 ? ' aqc-fullbleed-title--md' : ''
  return (
    <CardShell tone="plain" label={d.title ?? 'An upcoming drive'}>
      <div className="aqc-fullbleed">
        {/* Rule 2: a photo belongs to the row it sits in. No url, no photo -
            not CardPhoto here because that device is aspect-ratio boxed, and
            this shape needs the image absolutely filling the shell instead
            (15.7: "photo absolutely filling it, min-height: 300px"). */}
        {d.imageUrl ? (
          <Img
            src={d.imageUrl}
            alt={d.imageAlt ?? ''}
            ctx="cover"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
        {/* Two-stop gradient, not a flat tint or a filter (15.7): paper on the
            .88 stop measures 14.2:1, and a flat tint is exactly what a light
            photo defeats. */}
        <div className="aqc-fullbleed-scrim" aria-hidden="true" />
        {/* A stamped category sticker, per 13 - inset rather than
            corner-breaking (unlike C05/C16's white-shell stickers) because
            THIS shell keeps overflow:hidden for its edge-to-edge photo, and
            an overhanging sticker would just be clipped by it. Real category
            info, so it carries a screen-reader label; the printed word is
            aria-hidden decoration same as every other sticker. */}
        <Sticker
          shape="circle"
          hue={stickerHueFor(d.category)}
          rotate={-2.5}
          size={72}
          type="status"
          label={d.category ?? undefined}
          className="aqc-fullbleed-sticker"
        >
          {d.category}
        </Sticker>
        <div className="aqc-fullbleed-body">
          <span className="aqc-fullbleed-date">{d.meta ? `${d.kicker} · ${d.meta}` : d.kicker}</span>
          <h3 className={`aqc-fullbleed-title${titleSizeClass}`}>{d.title}</h3>
          {/* The footer well: pulling the count and CTA onto paper guarantees
              their contrast regardless of what the photo behind them does. */}
          <div className="aqc-fullbleed-well">
            {/* welfare_projects.volunteers is prose, not a filled/needed pair
                (feedShape.ts's own note) - expect the live marker here on
                real rows, never a zero standing in for it (rule 4). */}
            {spots
              ? <span className="aqc-grow" style={{ fontWeight: 700, fontSize: 13 }}>{spots}</span>
              : <span className="aqc-grow"><LiveMarker label="spots left" /></span>}
            <a className="aqc-btn aqc-btn-primary" href={d.ctaHref ?? d.href}>{d.ctaLabel ?? 'Put my name down'}</a>
          </div>
        </div>
      </div>
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C20 · shikshaq class. A class has a teacher, a level and a room. Three
    facts, laid out as a table, not as prose. */
export function CardClass({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  return (
    <CardShell label={d.title ?? 'An upcoming class'}>
      <div className="aqc-row">
        <AcademicCapIcon width={18} height={18} strokeWidth={1.8} />
        <span className="aqc-kicker aqc-grow">{d.kicker ?? 'shikshaq'}</span>
      </div>
      <h3 className="aqc-title">{d.title}</h3>
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px' }}>
        {(d.figures ?? []).map(f => (
          <div key={f.label} style={{ display: 'contents' }}>
            <dt className="aqc-figure-label">{f.label}</dt>
            <dd style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
              {f.value === null ? <LiveMarker label={f.label} /> : f.value}
            </dd>
          </div>
        ))}
      </dl>
      {d.ctaLabel ? <CreamCTA label={d.ctaLabel} href={d.ctaHref} /> : null}
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C21 · crftd drop. A product drop is commerce, so it looks like commerce:
    one photo, price, stock, buy. */
export function CardDrop({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  return (
    <CardShell label={d.title ?? 'A Crftd drop'}>
      <Sticker shape="ribbon" hue="pink" rotate={-3} size={72} className="aqc-drop-ribbon">new</Sticker>
      <div className="aqc-row">
        <span className="aqc-badge" style={{ background: 'var(--pink)' }}>
          <span className="aqc-badge-dot" aria-hidden="true" />
          {d.kicker ?? 'crftd'}
        </span>
        {d.meta ? <span className="aqc-pill">{d.meta}</span> : null}
      </div>
      <CardPhoto url={d.imageUrl} alt={d.imageAlt ?? ''} ctx="card" ratio="1 / 1" />
      <h3 className="aqc-title">{d.title}</h3>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
      <div className="aqc-row">
        {(d.figures ?? [])[0]
          ? <span className="aqc-grow"><Figure figure={(d.figures ?? [])[0]} /></span>
          : <span className="aqc-grow"><LiveMarker label="the price" /></span>}
        <a className="aqc-btn aqc-btn-primary" href={d.ctaHref ?? d.href}>
          <ShoppingBagIcon width={16} height={16} strokeWidth={1.8} />
          {d.ctaLabel ?? 'Add to bag'}
        </a>
      </div>
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}
