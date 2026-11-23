import { Link } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'

/**
 * /terms: the Terms of Use (audit item E6). Text approved by the owner on
 * 20 Nov 2026 from docs/drafts/terms-of-use-draft.md, with the governing-law
 * line kept. Same layout and voice as the privacy policy, and served from the
 * same chunk (PrivacyPolicyPage dispatches on the path) to stay inside the
 * eager bundle budget. Say only what the site actually does; when a rule here
 * changes, change the date too.
 */
export default function TermsPage() {
  useMeta(pageMetadata.terms)
  useJsonLd('terms-breadcrumb', breadcrumbLd([
    ['Home', '/'],
    ['Terms of Use', '/terms'],
  ]))

  return (
    <div className="route-enter ep-page">
      <div className="container ep-shell">
      <section className="ep-hero">
        <span className="sticker sticker-mint ep-eyebrow sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ terms</span>
        <h1 className="h-display ep-title">
          the rules,<br />in <span className="ep-title-serif">plain</span> words.
        </h1>
        <p className="ep-standfirst">
          AquaTerra is a student-run volunteer group in Kolkata, and this site is how we organise.
          These are the rules for using it. They are short on purpose.
        </p>
        <div className="mono xs upper muted" style={{ marginTop: 10, fontWeight: 700 }}>last updated · november 2026</div>
      </section>

      <div className="ep-body">
        <article className="ep-doc">
          <div className="ep-runhead">AquaTerra · Terms of Use · November 2026</div>

          <section className="ep-section">
            <h2 className="ep-h">Who can use it</h2>
            <ul className="ep-list">
              <li>Anyone can read the public pages: projects, teams, the blog, Terra Notes and the rest.</li>
              <li>Joining means signing in with Google and being approved by AquaTerra&rsquo;s HR team. We take students from Class 6 upwards.</li>
              <li>If you are under 18, make sure a parent or guardian is happy for you to join before you sign in. A parent or guardian can ask us to remove an account at any time, and we will.</li>
              <li>One person, one account. One phone number belongs to one account.</li>
            </ul>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">What you post</h2>
            <ul className="ep-list">
              <li>You own what you write and the photos you take. By posting on AquaTerra you let us show it on this site and on AquaTerra&rsquo;s own pages and social accounts, with your name, for as long as it stays up.</li>
              <li>Every post is reviewed by an HoD before anyone else sees it. Approval is not a promise it stays up: we can take down anything that breaks these rules.</li>
              <li>Only post photos of other people if they are happy to be in them. Never post a photo of a child from a drive that shows their face without the organisers&rsquo; say-so.</li>
            </ul>
            <p className="ep-p">
              <strong>Want something taken down?</strong> Your own post, an essay with your name on it, or a
              photo of you: ask and we will remove it. Use the <Link to="/grievance">grievance form</Link> if
              you are signed in, or email <a href="mailto:ngo.aquaterra@gmail.com">ngo.aquaterra@gmail.com</a> with
              &ldquo;remove&rdquo; in the subject line. We aim to act within 7 days.
            </p>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">What is not allowed</h2>
            <ul className="ep-list">
              <li>Bullying, harassment, or anything that makes another member feel unsafe. The <Link to="/equity-policy">Equity Policy</Link> sets out how we treat each other, and it applies here too.</li>
              <li>Sharing another member&rsquo;s phone number, email or other personal details.</li>
              <li>Pretending to be someone else, or to speak for AquaTerra when you do not.</li>
              <li>Using the site to sell things, or to collect money in AquaTerra&rsquo;s name without HR&rsquo;s written say-so.</li>
              <li>Trying to get into parts of the site, or other people&rsquo;s accounts, that are not yours.</li>
            </ul>
            <p className="ep-p">
              Break these and we may hide your posts, suspend your account or remove you from AquaTerra.
              If you think we got it wrong, use the grievance form and HR will look at it again.
            </p>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">Money</h2>
            <p className="ep-p">
              AquaTerra does not take donations. Event tickets and Crftd orders go towards our welfare
              drives. We do not hold your card or bank details: payments happen through UPI or the
              event&rsquo;s own payment page.
            </p>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">Leaders</h2>
            <p className="ep-p">
              HoDs, Directors, HR and Super Admins can see more than other members (for example your
              phone number, to reach you about an application). They use it only for AquaTerra work, and
              some of what they open is logged. Our <Link to="/privacy-policy">Privacy Policy</Link> lists
              exactly what each role can see.
            </p>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">Things we cannot promise</h2>
            <ul className="ep-list">
              <li>The site is run by students between classes. We try hard to keep it working and accurate, but we cannot promise it will always be up or error-free.</li>
              <li>Links to other sites (Instagram, LinkedIn, WhatsApp, Google Drive) go to services we do not control.</li>
              <li>Figures on the site (members, drives, meals) come from our own records and update by themselves. If one looks wrong, tell us.</li>
            </ul>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">Changes</h2>
            <p className="ep-p">
              If these rules change, we update this page and the date at the top. If a change affects
              members in a real way, we will also say so in the app.
            </p>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">The legal bit</h2>
            <p className="ep-p">
              These terms are governed by the laws of India, and any dispute goes to the courts in Kolkata.
            </p>
          </section>

          <section className="ep-section">
            <h2 className="ep-h">Contact</h2>
            <p className="ep-p">
              Email <a href="mailto:ngo.aquaterra@gmail.com">ngo.aquaterra@gmail.com</a> or use the{' '}
              <Link to="/contact">contact form</Link>.
            </p>
          </section>
        </article>

        <div style={{ maxWidth: 720, margin: '28px auto 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/" className="btn">← back to site</Link>
          <Link to="/privacy-policy" className="btn">read the privacy policy →</Link>
        </div>
      </div>
      </div>
    </div>
  )
}
