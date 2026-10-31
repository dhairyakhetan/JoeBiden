import './EquityPolicyPage.css'
import './PrivacyPolicyPage.css'
import { Link } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { APPROVAL_TIME } from '../lib/orgFacts'

/**
 * Privacy policy.
 *
 * Written FROM THE CODE, not from a template. Every claim below is traceable
 * to something this app actually does:
 *
 *   • Google OAuth + ensure_member()   → name, email, profile photo
 *   • /register                        → class/grade, phone number
 *   • posts, comments, likes, saved, follows, achievements
 *   • main.tsx inject()                → Vercel Analytics (page views)
 *   • main.tsx injectSpeedInsights()   → Vercel Speed Insights
 *   • index.html tag v8xi8sv15p        → Microsoft Clarity SESSION RECORDING
 *   • lib/funnel.ts                    → 4 named events, deliberately no PII
 *
 * If any of those change, this page changes with them. A privacy policy that
 * drifts from the code is worse than none — it's a written promise the
 * software is quietly breaking.
 *
 * Two things are left visibly unfilled rather than invented, because they are
 * the org's calls and a plausible-looking placeholder would hide the gap:
 * a named grievance contact.
 *
 * RESOLVED 2026-09-18: Clarity no longer runs for signed-in members. The tag
 * in index.html checks localStorage for a Supabase session before inserting
 * itself, and AuthContext calls clarity('stop') on a mid-session sign-in.
 *
 * Reuses EquityPolicyPage.css (the established policy-document look) and adds
 * only the table styles that page had no need for.
 */

const COLLECTED: [string, string, string][] = [
  ['Your Google account', 'Name, email address, profile photo', 'Signing in: this is what creates your account'],
  ['The registration form', 'Class or year, and a phone number', 'So a director can tell you are a real student before approving you'],
  ['What you post', 'Posts, comments, likes, saved posts, follows, achievements', 'Running the community feed'],
  ['Team activity', 'Which teams you are in, and applications you send', 'Team leads reviewing who wants to join'],
]

const THIRD_PARTIES: [string, string, string][] = [
  ['Supabase', 'Database and sign-in', 'Everything in the table above'],
  ['Vercel', 'Hosting, Analytics, Speed Insights', 'Pages visited and load speed. No names, no emails.'],
  ['Microsoft Clarity', 'Session recordings, signed-out visitors only',
   'How you move, click and scroll. Never runs once you are signed in.'],
  ['Google', 'Sign-in only', 'Confirms it is really you'],
]

export default function PrivacyPolicyPage() {
  useMeta(pageMetadata.privacyPolicy)
  useJsonLd('privacy-breadcrumb', breadcrumbLd([
    ['Home', '/'],
    ['Privacy Policy', '/privacy-policy'],
  ]))

  return (
    <div className="route-enter">
      <section className="ep-hero">
        <span className="sticker sticker-mint ep-eyebrow sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ privacy</span>
        <h1 className="h-display ep-title">
          what we collect,<br />and <span className="ep-title-serif">why</span>.
        </h1>
        <p className="ep-standfirst">
          AquaTerra is run by students, and most people using this site are students too. So this
          is written to be read, not to be survived. Everything we hold about you, who else can
          see it, and how to get rid of it.
        </p>
        {/* Reuses the same real date already stated in the document body (the
            ep-runhead below and the closing note both say "August 2026"),
            rather than inventing a new one. */}
        <div className="mono xs upper muted" style={{ marginTop: 10, fontWeight: 700 }}>last updated · august 2026</div>
      </section>

      <div className="ep-body">
        <article className="ep-doc">
          <div className="ep-runhead">AquaTerra · Privacy Policy · August 2026</div>

          <section className="ep-section">
            <h2 className="ep-h">What we collect</h2>
            <p className="ep-p">
              Only things you hand us. There is no tracking pixel following you around the internet.
            </p>
            <div className="pp-scroll" tabIndex={0} role="region" aria-label="What we collect">
              <table className="pp-table">
                <thead>
                  <tr><th>Where it comes from</th><th>What it is</th><th>Why we need it</th></tr>
                </thead>
                <tbody>
                  {COLLECTED.map(([src, what, why]) => (
                    <tr key={src}><td><strong>{src}</strong></td><td>{what}</td><td>{why}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">What we never do</h2>
            <ul className="ep-list">
              <li>We do not sell your data. We are not a business; there is nobody to sell it to.</li>
              <li>We do not run ads, and we share nothing with advertisers.</li>
              <li>We do not ask for your address, your family's details, or anything financial.</li>
              <li>We do not read anything in your Google account beyond your name, email and photo.</li>
            </ul>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">Who else touches it</h2>
            <p className="ep-p">
              A few services keep the site running. They only see what they need to do their job.
            </p>
            <div className="pp-scroll" tabIndex={0} role="region" aria-label="Third-party services">
              <table className="pp-table">
                <thead>
                  <tr><th>Service</th><th>What it does</th><th>What it can see</th></tr>
                </thead>
                <tbody>
                  {THIRD_PARTIES.map(([name, does, sees]) => (
                    <tr key={name}><td><strong>{name}</strong></td><td>{does}</td><td>{sees}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">Members under 18</h2>
            <p className="ep-p">
              Most AquaTerra members are school students, so this matters more here than on most
              sites. If you are under 18, make sure a parent or guardian is happy for you to join
              before you sign in. If a parent or guardian wants an account removed, we remove it:
              no questions, no delay.
            </p>
            <p className="ep-p pp-flag">
              <strong>Session recording stops when you sign in.</strong> Microsoft Clarity records
              how visitors move and click through the public pages, which is how we find broken
              layouts and dead ends. It does not run once you are signed in. Nothing you do inside
              your profile, the feed, a team page or the HoD desk is ever recorded or replayed.
            </p>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">What other members can see</h2>
            <p className="ep-p">
              AquaTerra is a community, so some of this is public by design. Your name, photo, class,
              teams and anything you post are visible to other approved members, and posts an HoD
              approves can appear on the public site. Your <strong>email address and phone number
              are never shown to other members</strong>. Only directors handling approvals see them.
            </p>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">Getting your data out, or deleting it</h2>
            <p className="ep-p">
              Ask and we will do it. Message a director in the app, or email us, and we will confirm
              within {APPROVAL_TIME}. Deleting your account removes your profile, phone number and
              email. Posts you made in a team space may stay as part of that team's record, with
              your name removed on request.
            </p>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">Contact</h2>
            <p className="ep-p">
              Email <a href="mailto:ngo.aquaterra@gmail.com">ngo.aquaterra@gmail.com</a> or use the{' '}
              <Link to="/contact">contact form</Link>. Put “privacy” in the subject line so it
              reaches the right person.
            </p>
            <p className="ep-p pp-flag">
              <strong>To be filled in by AquaTerra:</strong> a named grievance contact for data
              questions. India's DPDP Act 2023 expects a specific, reachable person. A made-up
              name here would be worse than an obvious gap.
            </p>
          </section>

          <div className="ep-runhead" style={{ marginTop: 28 }}>
            Written to match what the site actually does, as of August 2026.
          </div>
        </article>

        <div style={{ maxWidth: 720, margin: '28px auto 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" className="btn">← back to site</Link>
          <Link to="/equity-policy" className="btn">read the equity policy →</Link>
        </div>
      </div>
    </div>
  )
}
