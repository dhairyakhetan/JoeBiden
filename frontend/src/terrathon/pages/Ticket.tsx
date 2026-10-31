import { Link, useParams } from 'react-router-dom'
import { EVENT } from '../config'
import { Wordmark } from '../components/Wordmark'

/**
 * The QR target, `/terrathon/t/:token`. PRD 6.8.
 *
 * Deliberately does NO database lookup.
 *
 * The token is the only thing standing between a forwarded screenshot and a
 * free entry, so `terrathon_registrations` has no anon read policy at all and
 * this page could not query it even if it wanted to. Resolving the token is the
 * gate scanner's job, under a leader session, through `terrathon_check_in()`.
 *
 * A verification view (sport, reference code, confirmed or not, and never a
 * phone number or school) is PRD item PUB-21b, scheduled P2 post-event. It
 * needs its own SECURITY DEFINER function returning those three fields only.
 *
 * That constraint is why this page still cannot render a sport sticker, a QR
 * image, "when"/"report by"/captain, or anything else specific to one
 * registration: none of that data reaches this component, by design, and
 * inventing it here would defeat the whole point of the lockdown. The real
 * QR (the actual entry credential) lives only in the PNG `TicketModal.tsx`
 * generates and sends over WhatsApp; this route is what that QR's own code
 * points a scanning phone at, so its job is to look like the pass it came
 * from and explain what to do at the gate, not to reproduce ticket data it
 * was never given.
 */
export function TerraThonTicket() {
  const { token } = useParams<{ token: string }>()
  const looksValid = !!token && /^[0-9a-f-]{20,}$/i.test(token)

  return (
    <div className="tt-wrap tt-page" style={{ maxWidth: 480 }}>
      <div className="tt-pass">
        <div className="tt-pass__head">
          {/* tone="paper" = ink letters. The default is paper letters for an ink
              slab, and this band is cream: the mark measured 1.15:1, i.e. gone. */}
          <Wordmark size={38} tone="paper" />
          <span className="tt-kicker" style={{ color: '#0A0A0A' }}>Entry pass</span>
        </div>

        {/* The perforation: a dashed rule with two punched notches, same idea
            as .tt-ticket in terrathon.css but stacked vertically for a
            single pass rather than split into a side stub. Kept as a scoped
            rule here rather than a terrathon.css edit. */}
        <div className="tt-pass__perf" aria-hidden="true">
          <span className="tt-pass__notch tt-pass__notch--left" />
          <span className="tt-pass__notch tt-pass__notch--right" />
        </div>

        <div className="tt-pass__body">
          <div className="tt-pass__glyph" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--tt-go)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z" fill="var(--tt-go)" stroke="none" />
            </svg>
          </div>
          <h1 style={{ fontSize: 30, textTransform: 'uppercase', lineHeight: 1.05, margin: 0 }}>
            This is a TerraThon entry pass
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--tt-fs-body)', lineHeight: 1.65, color: 'var(--tt-muted)' }}>
            Show the QR code from your WhatsApp message at the entry desk. The volunteer on the gate
            scans it and admits your team.
          </p>

          {!looksValid && (
            <p role="alert" style={{ margin: 0, fontSize: 'var(--tt-fs-body)', color: 'var(--tt-amber)' }}>
              That link does not look like a TerraThon entry pass. Check the message we sent you.
            </p>
          )}

          <section className="tt-pass__gate">
            <h2 className="tt-kicker">At the gate</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 10, textAlign: 'left' }}>
              {[
                'Show this screen and a school or college ID at the desk.',
                'A screenshot of your WhatsApp entry pass works just as well.',
                'You do not need signal, the QR works offline.',
                'One scan per team, per day, once payment is confirmed.',
              ].map((t) => (
                <li key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 'var(--tt-fs-body)', color: 'var(--tt-muted)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tt-go)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto', marginTop: 1 }} aria-hidden="true">
                    <path d="M4 12.5 9.5 18 20 6.5" />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 }}>
        <Link to={`${EVENT.base}/schedule`} className="tt-btn tt-btn--quiet">Schedule</Link>
        <Link to={`${EVENT.base}/contact`} className="tt-btn tt-btn--quiet">Something wrong?</Link>
      </div>

      {/* Scoped to this page, not a terrathon.css edit. The head band and
          perforation are unique to this one pass shape (the vertical stack
          .tt-ticket does not offer), and the cream head band reuses the same
          --ink/--tt-ink flip .tt-listing .tt-card already establishes as the
          pattern for an inverted surface inside the dark poster theme. */}
      <style>{`
        .tt-pass {
          border: 3px solid var(--tt-line);
          border-radius: var(--tt-r-out);
          background: var(--tt-card);
          overflow: hidden;
        }
        .tt-pass__head {
          background: #F2EFE3;
          padding: var(--tt-sp-5) var(--tt-sp-6);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .tt-pass__perf {
          position: relative;
          border-top: 2px dashed rgba(10, 10, 10, 0.35);
          margin: 0 var(--tt-sp-6);
        }
        .tt-pass__notch {
          position: absolute;
          top: -9px;
          width: 16px;
          height: 16px;
          border-radius: var(--tt-r-pill);
          background: var(--tt-paper);
          border: var(--tt-bw) solid var(--tt-line);
        }
        .tt-pass__notch--left { left: calc(var(--tt-sp-6) * -1 - 9px); }
        .tt-pass__notch--right { right: calc(var(--tt-sp-6) * -1 - 9px); }
        .tt-pass__body {
          padding: var(--tt-sp-7) var(--tt-sp-6) var(--tt-sp-6);
          display: grid;
          gap: 14px;
          text-align: center;
        }
        .tt-pass__glyph {
          width: 64px;
          height: 64px;
          border-radius: var(--tt-r-in);
          background: var(--tt-paper-2);
          border: 2px solid var(--tt-line);
          display: grid;
          place-items: center;
          justify-self: center;
        }
        .tt-pass__gate {
          margin-top: 6px;
          padding-top: 16px;
          border-top: 2px solid var(--tt-hairline);
          display: grid;
          gap: 12px;
          text-align: left;
        }
      `}</style>
    </div>
  )
}
