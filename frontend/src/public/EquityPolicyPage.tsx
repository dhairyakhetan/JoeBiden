import './EquityPolicyPage.css'
import { Link } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'

/**
 * The Equity Policy, reproduced verbatim from the HR team's source document
 * (NGO AQUATERA-Equity Policy.md / .pdf).
 *
 * The wording here is NOT editorial copy — it is a governance document that
 * members are told they agree to by remaining in the community, and the
 * consequences section is quoted in moderation decisions. Do not reword,
 * summarise, "tighten", or fix the source's own punctuation. If the policy
 * changes, the HR team changes the document and this page follows it exactly.
 *
 * The only liberties taken are presentational: the source's bold/italic
 * emphasis is carried over as <strong>/<em>, and the running header and closing
 * quotation (which repeat on every page of the PDF) appear once each.
 *
 * REDESIGN, appendix A4: the route already existed, so the gap was never
 * routing — it was that no page had been designed for it. The document is now
 * laid out in the poster system, one slab per section, with the seven core
 * principles as numbered cards. Not one character of the policy changed in that
 * pass; the diff is markup and CSS. The single piece of NON-policy text on the
 * page is the marked cross-reference under Direct Messaging, and it is styled
 * and labelled so it cannot be mistaken for part of the policy.
 */

const CORE_PRINCIPLES: [string, string][] = [
  ['Respect', 'Treat every member with dignity. No personal attacks, insults, or harassment online or offline will be tolerated.'],
  ['Inclusion', 'Discriminatory remarks based on race, caste, religion, gender, sexuality, disability, or background will not be tolerated.'],
  ['Safety', 'Create a space free from bullying, threats, or harmful content.'],
  ['Professionalism', 'Communicate responsibly, especially when representing AQUATERRA.'],
  ['Constructive Dialogue', 'Disagree with ideas, not people. Criticism must remain respectful.'],
  ['Direct Messaging', 'Do not text or call another member privately without their prior permission.'],
  ['Privacy', 'Do not share private messages, personal information, or images without consent.'],
]

const HR_TEAM: [string, string][] = [
  ['Naisha Mehta', '7439432821'],
  ['Janvi Baid', '6291133946'],
  ['Aarushi Gupta', '9051277776'],
  ['Diya Poddar', '9674465849'],
  ['Hrishika Khemka', '9007940202'],
]

/** The document's own sections, in order, for the jump bar. The labels match
    the headings byte for byte so the bar can never name a section the page
    does not have. */
const SECTIONS: [string, string][] = [
  ['purpose', 'Purpose'],
  ['scope', 'Scope'],
  ['core-principles', 'Core Principles'],
  ['expected-behaviour', 'Expected Member Behaviour'],
  ['moderation', 'Moderation & Reporting'],
  ['consequences', 'Consequences'],
  ['appeal', 'Appeal'],
  ['updates', 'Updates'],
  ['accountability', 'Accountability & Commitment'],
  ['contact', 'Contact'],
]

export default function EquityPolicyPage() {
  // noIndex, owner-ruled 2026-09-06. This page names five welfare contacts
  // AND their personal mobile numbers (see CONTACTS below). The members are
  // 14-19, so some are minors, and the harm this actually guards against is
  // "search a student's name, get their phone number" - which is a search
  // ENGINE problem, not a scraper problem. Be clear-eyed: `noindex` does
  // nothing against a scraper, which ignores robots meta entirely. It keeps
  // the numbers out of Google, and that is all it does.
  // `noindex, follow` (not `nofollow`): crawlers still traverse the outbound
  // links, so the rest of the site keeps whatever link equity this page passes.
  // Paired with removal from the sitemap and a robots tag in the prerendered
  // HTML - all three must agree or the page is still indexed.
  // To reverse: drop `noIndex` here, restore the sitemap entry, and remove the
  // NOINDEX_PATHS entry in scripts/prerender-meta.mjs.
  useMeta({ ...pageMetadata.equityPolicy, noIndex: true })
  useJsonLd('equity-breadcrumb', breadcrumbLd([['Home', '/'], ['Equity Policy', '/equity-policy']]))

  return (
    <div className="route-enter ep-page">
      <div className="container ep-shell">
        {/* ── Masthead ── */}
        <header className="ep-masthead">
          <span className="ep-eyebrow">this equity policy is an hr initiative</span>
          <h1 className="ep-h1">
            equity<br />
            <span className="ep-h1-serif">policy</span>.
          </h1>
          <p className="ep-standfirst">
            Community, General Members and WhatsApp Community - Equity Policy
          </p>
        </header>

        {/* ── The ink block: the document's own welcome line ── */}
        <section className="ep-ink" aria-labelledby="ep-welcome">
          <span className="ep-ink-sticker">★ an hr initiative</span>
          <h2 className="ep-ink-h" id="ep-welcome">WELCOME TO THE EQUITY POLICY</h2>
          {/* The seven principle NAMES, nothing more. An index, not a summary:
              quoting the clauses here would print the policy twice and invite
              the two copies to drift. */}
          <p className="ep-ink-p">
            {CORE_PRINCIPLES.map(([term]) => term).join(' · ')}
          </p>
        </section>

        {/* Ten sections is long enough to need a way in. The labels are the
            headings themselves, so the bar cannot drift from the document. */}
        <nav className="ep-jump" aria-label="Jump to a section of the policy">
          {SECTIONS.map(([id, label]) => (
            <a key={id} className="ep-jump-link" href={`#${id}`}>{label}</a>
          ))}
        </nav>

        <article className="ep-doc">
          <section className="ep-slab" id="purpose" aria-labelledby="ep-h-purpose">
            <h2 className="ep-h" id="ep-h-purpose">Purpose</h2>
            <p className="ep-p">
              NGO AQUATERRA aims to create a <strong>respectful, safe, and inclusive community space</strong> for
              all members. This policy outlines the minimum expectations for behaviour and the consequences of
              violations.
            </p>
          </section>

          <section className="ep-slab" id="scope" aria-labelledby="ep-h-scope">
            <h2 className="ep-h" id="ep-h-scope">Scope</h2>
            <p className="ep-p">
              This policy applies to all members of any AQUATERRA WhatsApp community, group, or channel.
            </p>
          </section>

          <section className="ep-slab ep-slab--principles" id="core-principles" aria-labelledby="ep-h-principles">
            <h2 className="ep-h" id="ep-h-principles">Core Principles</h2>
            <ol className="ep-principles">
              {CORE_PRINCIPLES.map(([term, body], i) => (
                <li key={term} className="ep-principle">
                  <span className="ep-principle-no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="ep-term">{term}</h3>
                  <p className="ep-principle-body">{body}</p>

                  {/* NOT part of the policy. The one editorial note on the page,
                      labelled and boxed so it reads as a cross-reference rather
                      than as a clause. It states an obligation the desk owes
                      this principle, which is true whatever the desk currently
                      does; it does not claim a shipped behaviour. */}
                  {term === 'Direct Messaging' && (
                    <aside className="ep-xref">
                      <span className="ep-xref-label">cross reference, not policy</span>
                      <p className="ep-xref-body">
                        This is the line every contact rule inside AquaTerra&apos;s own tools answers to.
                        A leader who reveals one member&apos;s phone number to another is granting an
                        exception to a written policy, so a reveal is something the member desk has to
                        record rather than do quietly.
                      </p>
                    </aside>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section className="ep-slab" id="expected-behaviour" aria-labelledby="ep-h-expected">
            <h2 className="ep-h" id="ep-h-expected">Expected Member Behaviour</h2>
            <ul className="ep-list">
              <li>Use respectful language at all times.</li>
              <li>
                Keep discussions relevant to AQUATERRA’s purpose and activities, in official groups.
                <br />
                (Of course you can go off-topic in the spam group of AQ)
              </li>
              <li>Share opportunities, resources, and ideas that benefit the community.</li>
              <li>Ask for consent before forwarding someone’s personal messages or media.</li>
              <li>Support an environment where new members feel welcome.</li>
            </ul>
          </section>

          <section className="ep-slab" id="moderation" aria-labelledby="ep-h-moderation">
            <h2 className="ep-h" id="ep-h-moderation">Moderation &amp; Reporting</h2>
            <ul className="ep-list">
              <li>Concerns can be raised directly to the group admins via private message.</li>
              <li>You may also address the concern by filling out the form attached below.</li>
              <li>Admins will review issues fairly, confidentially, and promptly.</li>
            </ul>
          </section>

          {/* Consequences is the section quoted back at people in moderation
              decisions, so it gets the page's one ink slab besides the welcome
              block: it is the part that must be findable at a glance. */}
          <section className="ep-slab ep-slab--ink" id="consequences" aria-labelledby="ep-h-consequences">
            <h2 className="ep-h ep-h--ink" id="ep-h-consequences">Consequences</h2>
            <p className="ep-p ep-p--ink">Violations may result in:</p>
            <ul className="ep-list ep-list--ink">
              <li>Warning</li>
              <li>Temporary suspension</li>
              <li>Permanent removal from AQ groups</li>
              <li>Severe breaches (e.g., hate speech, threats, doxxing) may lead to immediate removal.</li>
            </ul>
          </section>

          <section className="ep-slab" id="appeal" aria-labelledby="ep-h-appeal">
            <h2 className="ep-h" id="ep-h-appeal">Appeal</h2>
            <p className="ep-p">
              Members may appeal disciplinary action by contacting the Core Committee within 7 days, or filling
              the provided form within 7 days.
            </p>
          </section>

          <section className="ep-slab" id="updates" aria-labelledby="ep-h-updates">
            <h2 className="ep-h" id="ep-h-updates">Updates</h2>
            <p className="ep-p">
              This policy will be reviewed and may be modified from time to time as the need arises. Any changes
              will be communicated to all members.
            </p>
          </section>

          <section className="ep-slab" id="accountability" aria-labelledby="ep-h-accountability">
            <h2 className="ep-h" id="ep-h-accountability">Accountability &amp; Commitment</h2>
            <p className="ep-p">
              By remaining in the AQUATERRA COMMUNITY and all WhatsApp groups, all members agree to:
            </p>
            <ul className="ep-list">
              <li>Uphold this policy in spirit and practice.</li>
              <li>Hold themselves accountable to the same standards as others.</li>
              <li>Foster a positive, supportive, and equitable community.</li>
            </ul>
          </section>

          <section className="ep-slab" id="contact" aria-labelledby="ep-h-contact">
            <h2 className="ep-h" id="ep-h-contact">Contact</h2>
            <p className="ep-p">For questions or concerns, please contact the HR Team</p>
            <ul className="ep-contact">
              {HR_TEAM.map(([name, phone]) => (
                <li key={phone}>
                  <span className="ep-contact-name">{name}</span>
                  <span className="ep-contact-dash"> - </span>
                  {/* tel: so a member on a phone can act on it in one tap,
                      rather than copying digits out of running text. */}
                  <a className="ep-contact-num" href={`tel:+91${phone}`}>{phone}</a>
                </li>
              ))}
            </ul>
          </section>

          <blockquote className="ep-quote">
            <p>“Together, we build a community where every voice can be heard and respected.</p>
            <p>By upholding these values, we strengthen not just our group, but the impact we create beyond it”</p>
          </blockquote>
        </article>

        {/* No page is a dead end. Both exits are places a reader of this
            document plausibly wants next, not a generic banner. */}
        <nav className="ep-exits" aria-label="Where to go next">
          <Link to="/volunteer" className="ep-exit">
            <span className="ep-exit-h">the volunteer handbook</span>
            <span className="ep-exit-p">How the work actually runs, department by department.</span>
          </Link>
          <Link to="/faq" className="ep-exit">
            <span className="ep-exit-h">questions about joining</span>
            <span className="ep-exit-p">What membership costs, what it asks of you, and who to ask.</span>
          </Link>
        </nav>
      </div>
    </div>
  )
}
