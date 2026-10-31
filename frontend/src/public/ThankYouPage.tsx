import { Link, useSearchParams } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import HowItWorks from '../components/HowItWorks'
import SuccessCheck from '../components/SuccessCheck'
import { CONTACT_REPLY_TIME } from '../lib/orgFacts'

/**
 * Confirmation page after an enquiry.
 *
 * Contact and Collaborations already showed an inline success state, which is
 * good UX — it keeps you in place and lets you send another. This does NOT
 * replace that. It exists because an inline state has no URL, and a form
 * submission with no URL of its own is invisible to analytics: there is no
 * distinct page to count, so "how many people actually completed the contact
 * form" was unanswerable.
 *
 * A real route also gives the moment somewhere to say what happens next, which
 * an inline "sent!" line has no room for.
 *
 * `?from=` tailors the copy to the form that sent you. It is presentation
 * only — never trust it for anything that matters, and always fall back to
 * wording that is true whichever form it was.
 */

type Source = 'contact' | 'collab' | 'default'

const COPY: Record<Source, { eyebrow: string; heading: string; sub: string; steps: [string, string][] }> = {
  contact: {
    eyebrow: '★ message sent',
    heading: 'thanks, that reached us.',
    sub: "A real student reads every message that comes through this form. Not a bot, not an inbox nobody opens.",
    steps: [
      ['Your message is in our inbox', 'nothing else for you to do'],
      ['Someone from the team reads it', 'usually whoever handles that area'],
      ['You get a reply', `usually ${CONTACT_REPLY_TIME}, to the email you gave us`],
    ],
  },
  collab: {
    eyebrow: '★ proposal sent',
    heading: 'thanks, proposal received.',
    sub: 'Partnerships get read by the Collabs team, who run school, college and NGO tie-ups.',
    steps: [
      ['Your proposal is with the Collabs team', 'they handle every partnership'],
      ['They check the fit', 'what you need, and whether we can actually deliver it'],
      ['You hear back either way', 'usually within a few days'],
    ],
  },
  default: {
    eyebrow: '★ sent',
    heading: 'thanks, we got that.',
    sub: 'It reached the right people.',
    steps: [
      ['Your message is in our inbox', 'nothing else for you to do'],
      ['A student on the team reads it', 'every message gets a human'],
      ['You get a reply', `usually ${CONTACT_REPLY_TIME}`],
    ],
  },
}

export default function ThankYouPage() {
  // noindex, matching EquityPolicyPage's pattern: this is a real public page
  // (no auth needed), so it belongs on robots.txt's Allow side and out of
  // EXCLUDED_PREFIXES - a Disallow would stop Google fetching it at all,
  // which per this repo's own robots.txt reasoning (see its /member/ and
  // /post/ comments) blocks the crawl that lets THIS tag apply, the stronger
  // exclusion. It was reachable and indexable with neither protection before
  // this - same boilerplate confirmation for every visitor, and absent from
  // the sitemap, so there was nothing for it to rank on anyway. Found in a
  // full SEO audit, 2026-09-24.
  useMeta({ ...pageMetadata.thankYou, noIndex: true })
  const [params] = useSearchParams()
  const raw = params.get('from')
  const source: Source = raw === 'contact' || raw === 'collab' ? raw : 'default'
  const c = COPY[source]

  return (
    <div className="route-enter container" style={{ padding: 'clamp(40px, 8vw, 88px) var(--page-px) clamp(56px, 9vw, 104px)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <SuccessCheck fx="confetti" />
        </div>

        <span className="sticker sticker-mint sticker--diecut" style={{ display: 'inline-flex', marginBottom: 16, ['--sticker-ground' as string]: 'var(--bg)' }}>
          {c.eyebrow}
        </span>

        <h1 className="h-display" style={{ fontSize: 'clamp(30px, 6vw, 52px)', margin: '0 0 12px' }}>
          {c.heading}
        </h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 16, margin: '0 auto 6px', maxWidth: 460 }}>
          {c.sub}
        </p>
      </div>

      {/* Same explainer format as /login and /teams — the question "so what
          happens now?" gets the same shape of answer everywhere it's asked. */}
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <HowItWorks
          label="What happens next"
          steps={c.steps.map(([title, detail]) => ({ title, detail }))}
        />
      </div>

      {/* Somewhere to go. A confirmation page that dead-ends is a page people
          close, and closing is the end of the visit. */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 34 }}>
        <Link to="/projects" className="btn btn-primary">see what we&apos;ve been doing →</Link>
        <Link to="/opportunities" className="btn">open roles</Link>
        <Link to="/" className="btn">back to site</Link>
      </div>
    </div>
  )
}
