import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { EVENT, ASK_PHONE, CONTACTS } from '../config'
import { SPORT_ORDER, type PublicEvent, type SportSlug } from '../lib/types'
import { SportMark } from '../components/SportMarks'
import { Markdown } from '../components/Markdown'
import { GENERAL_RULES, type GeneralRule } from '../lib/generalRules'
import { WhatsAppMark } from '../components/BrandMarks'
import { rupees, dayRange, prettyPhone, waNumber } from '../lib/format'
import { StarStickers } from '../components/StarStickers'
import { fadeInUp } from '../../lib/motion'

interface Props {
  events: PublicEvent[]
  loading: boolean
  error: string | null
  reload: () => void
}

interface Section {
  key: string
  tag: string
  title: string
  content: React.ReactNode
}

/**
 * /terrathon/rules: two callouts, then an accordion.
 *
 * The two callouts (what confirms your slot, and refunds) are pulled out
 * ahead of everything collapsible because they are the two things people get
 * wrong, and a rule buried inside a closed panel does not get read before
 * someone signs up believing the opposite. Both are sourced from
 * `GENERAL_RULES` (lib/generalRules.ts), the same list the sign-up form's
 * consent dialog reads, so this page and that dialog cannot disagree.
 *
 * Every sport's own rules still come from `rules_md` on the events row, via
 * the shared `Markdown` component, not retyped here.
 */
export function TerraThonRules({ events, loading, error, reload }: Props) {
  const ordered = SPORT_ORDER
    .map((s) => events.find((e) => e.slug === s))
    .filter(Boolean) as PublicEvent[]

  const ask = CONTACTS.find((c) => c.phone === ASK_PHONE)
  const reduce = useReducedMotion()

  // GENERAL_RULES, in order: [0] age, [1] ID, [2] report time, [3] what
  // confirms your slot, [4] refunds, [5] player swaps, [6] misconduct,
  // [7] official's decision is final. [3] and [4] become the top callouts;
  // the rest are grouped into the three general accordion sections below.
  const byRest = (needle: string): GeneralRule | undefined =>
    GENERAL_RULES.find((r) => r.rest.includes(needle))
  const confirmedRule = byRest('confirmed once payment')
  const refundRule = byRest('non-refundable')
  const ageRule = byRest('every member of a team')
  const swapRule = byRest('swap a player')
  const idRule = byRest('school or college ID')
  const reportRule = byRest('Report 15 minutes')
  const conductRule = byRest('Misconduct')
  const finalRule = byRest("decision is final")

  const renderRules = (rules: Array<GeneralRule | undefined>) => (
    <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 9, fontSize: 'var(--tt-fs-body)', lineHeight: 1.6 }}>
      {rules.filter(Boolean).map((r) => (
        <li key={(r as GeneralRule).rest}>
          {(r as GeneralRule).strong && <strong>{(r as GeneralRule).strong}</strong>}
          {(r as GeneralRule).rest}
        </li>
      ))}
    </ul>
  )

  const generalSections: Section[] = [
    { key: 'who', tag: 'ALL', title: 'Who can play', content: renderRules([ageRule, swapRule]) },
    { key: 'onday', tag: 'ALL', title: 'On the day', content: renderRules([idRule, reportRule]) },
    { key: 'conduct', tag: 'ALL', title: 'Conduct', content: renderRules([conductRule, finalRule]) },
  ]

  const sportSections: Section[] = ordered.map((e) => ({
    key: e.slug,
    tag: e.slug.toUpperCase(),
    title: e.display_name,
    content: (
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SportMark sport={e.slug} size={24} />
          <span className="tt-chip tt-chip--solid">{rupees(e.fee_inr)} entry</span>
          {e.prize_pool_inr != null && <span className="tt-chip">{rupees(e.prize_pool_inr)} prize pool</span>}
          <span className="tt-chip">{dayRange(e.day_first, e.day_last)}</span>
          {e.venue && <span className="tt-chip">{e.venue}</span>}
          <Link to={`${EVENT.base}/${e.slug}`} className="tt-chip" style={{ textDecoration: 'none' }}>
            Sport page
          </Link>
        </div>
        {e.rules_md
          ? <Markdown source={e.rules_md} />
          : (
            <p style={{ margin: 0, fontSize: 'var(--tt-fs-body)', color: 'var(--tt-muted)' }}>
              The full rules for {e.display_name} go up here shortly. Message us and we will send
              them to you in the meantime.
            </p>
          )}
      </div>
    ),
  }))

  const sections = loading || error ? [] : [...generalSections, ...sportSections]

  // `undefined` means "no manual choice yet": the default applies, which is
  // the URL hash's section if it matches one (so a link like
  // /terrathon/rules#cricket from the sign-up form opens straight to it),
  // otherwise the first section. Once someone clicks a header, `manualOpen`
  // takes over and an empty string means "everything closed".
  const [manualOpen, setManualOpen] = useState<string | undefined>(undefined)
  const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : ''
  const defaultOpen = sections.some((s) => s.key === hash) ? hash : (sections[0]?.key ?? null)
  const openKey = manualOpen === undefined ? defaultOpen : (manualOpen || null)

  return (
    <div className="tt-wrap tt-page">
      <style>{`
        .ttr-accordion { display: grid; gap: 10px; }
        .ttr-item { overflow: hidden; }
        .ttr-head {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px var(--tt-sp-6);
          min-height: var(--tt-ctl-lg);
          background: none;
          border: none;
          color: var(--tt-ink);
          font: inherit;
          text-align: left;
          cursor: pointer;
        }
        .ttr-head__tag {
          flex: 0 0 78px;
          font-family: var(--tt-code);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
        }
        .ttr-head__tag--all { color: var(--tt-hot); }
        .ttr-head__tag--sport { color: var(--tt-go); }
        .ttr-head__title {
          flex: 1 1 auto;
          font-family: var(--tt-poster);
          font-size: var(--tt-fs-body);
          text-transform: uppercase;
        }
        .ttr-head__chevron {
          flex: 0 0 auto;
          transform: rotate(0deg);
          transition: transform 200ms ease;
        }
        .ttr-head[aria-expanded="true"] .ttr-head__chevron { transform: rotate(180deg); }
        .ttr-panel { padding: 0 var(--tt-sp-6) var(--tt-sp-6); }
        .ttr-callouts { display: grid; gap: var(--tt-sp-5); margin-top: var(--tt-block); }
        .ttr-callouts__rule { display: none; }
        @media (min-width: 700px) {
          .ttr-callouts { grid-template-columns: 1fr auto 1fr; align-items: stretch; }
          .ttr-callouts__rule { display: block; width: 3px; border-radius: 2px; background: rgba(10, 10, 10, 0.12); }
        }
      `}</style>

      {/* position: relative is required, not cosmetic: StarStickers is
          absolutely positioned and would otherwise hang off whatever ancestor
          happens to be positioned. The lead paragraph is capped at 640px and
          the stars sit right-of-centre, so they frame the title rather than
          landing on it. */}
      <div style={{ position: 'relative', isolation: 'isolate' }}>
        <StarStickers />
        <span className="tt-kick">TerraThon 2026</span>
        <h1 className="tt-h1-poster" style={{ marginTop: 8, textTransform: 'uppercase' }}>The rules</h1>
        <p style={{ margin: '14px 0 0', maxWidth: 640, fontSize: 'var(--tt-fs-lead)', lineHeight: 1.6, color: 'var(--tt-muted)' }}>
          All of them, in the order people actually ask about them. The money section is the one to
          read before you pay.
        </p>
      </div>

      {/* ── The two callouts, pulled out before anything collapsible ────────── */}
      <motion.div
        className="tt-plate ttr-callouts"
        initial={reduce ? false : fadeInUp.hidden}
        whileInView={fadeInUp.visible}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
      >
        <section>
          <h2 className="tt-poster-line" style={{ fontSize: 22, margin: 0, color: '#7A2B8A' }}>What confirms your slot</h2>
          <p style={{ margin: '12px 0 0', fontSize: 'var(--tt-fs-lead)', lineHeight: 1.6 }}>
            {confirmedRule?.rest ?? 'Your slot is confirmed once payment is made, not when the form is submitted.'}
          </p>
        </section>
        <div className="ttr-callouts__rule" aria-hidden="true" />
        <section>
          <h2 className="tt-poster-line" style={{ fontSize: 22, margin: 0, color: '#7A2B8A' }}>Refunds</h2>
          <p style={{ margin: '12px 0 0', fontSize: 'var(--tt-fs-lead)', lineHeight: 1.6 }}>
            {refundRule?.rest ?? 'Entry fees are not refunded, except when AquaTerra cancels a sport, in which case every team in it is refunded in full.'}
          </p>
        </section>
      </motion.div>

      {/* ── Accordion ──────────────────────────────────────────────────────── */}
      {error ? (
        // Never a cheerful empty state after a failure.
        <div className="tt-card" role="alert" style={{ marginTop: 'var(--tt-block)', borderColor: 'var(--tt-danger)' }}>
          <h2 style={{ fontSize: 22 }}>Couldn't load the sport rules</h2>
          <p style={{ margin: '8px 0 16px', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }}>{error}</p>
          <button type="button" className="tt-btn tt-btn--plain" onClick={reload}>Try again</button>
        </div>
      ) : loading ? (
        <div className="tt-card" style={{ marginTop: 'var(--tt-block)', height: 240, opacity: 0.4 }} aria-hidden="true" />
      ) : (
        <div className="ttr-accordion" style={{ marginTop: 'var(--tt-block)' }}>
          {sections.map((s) => {
            const isOpen = openKey === s.key
            return (
              <div key={s.key} id={sportSections.some((sp) => sp.key === s.key) ? (s.key as SportSlug) : undefined} className="tt-card ttr-item" style={{ padding: 0, scrollMarginTop: 80 }}>
                <button
                  type="button"
                  className="ttr-head"
                  aria-expanded={isOpen}
                  aria-controls={`ttr-panel-${s.key}`}
                  id={`ttr-head-${s.key}`}
                  onClick={() => setManualOpen(isOpen ? '' : s.key)}
                >
                  <span className={`ttr-head__tag ${sportSections.some((sp) => sp.key === s.key) ? 'ttr-head__tag--sport' : 'ttr-head__tag--all'}`}>{s.tag}</span>
                  <span className="ttr-head__title">{s.title}</span>
                  <svg
                    className="ttr-head__chevron"
                    width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div
                  id={`ttr-panel-${s.key}`}
                  role="region"
                  aria-labelledby={`ttr-head-${s.key}`}
                  className="ttr-panel"
                  hidden={!isOpen}
                >
                  {s.content}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── One way to ask ─────────────────────────────────────────────────── */}
      {ask && (
        <section style={{ marginTop: 'var(--tt-block)', display: 'grid', gap: 12, justifyItems: 'start' }}>
          <h2 style={{ fontSize: 24, textTransform: 'uppercase' }}>Something not covered here?</h2>
          <a
            href={`https://wa.me/${waNumber(ASK_PHONE)}?text=${encodeURIComponent('Hi, a question about the TerraThon rules: ')}`}
            target="_blank"
            rel="noreferrer noopener"
            className="tt-btn"
          >
            <WhatsAppMark />
            WhatsApp {ask.name.split(' ')[0]} &middot; {prettyPhone(ASK_PHONE)}
          </a>
        </section>
      )}
    </div>
  )
}
