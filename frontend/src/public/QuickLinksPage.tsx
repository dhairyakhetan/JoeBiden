import './QuickLinksPage.css'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PUBLIC_DEPARTMENTS as DEPARTMENTS, type Department } from '../lib/departments'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import { useAuth } from '../auth/AuthContext'
import { ORG_FACTS, displayCount } from '../lib/orgFacts'
import { capitalise, departmentsPhrase } from '../lib/orgFigures'
import { useDepartmentCount } from '../hooks/useDepartmentCount'
import { setAuthIntent } from '../lib/authIntent'
import { Reveal, RevealGroup } from '../components/Reveal'

// ── External links ───────────────────────────────────────────────
const INSTAGRAM  = 'https://instagram.com/ngo.aquaterra'
const WHATSAPP   = 'https://wa.me/919748679979'
// The org's LinkedIn page, per ORG_FACTS.linkedinUrl (constants block) rather
// than a second hardcoded copy of the same URL - changelog/21-org-facts.md
// §21.3 names the LinkedIn slug explicitly as belonging in that block.
const LINKEDIN   = ORG_FACTS.linkedinUrl

// ── 4 big CTAs (the marquee destinations) ────────────────────────
// One hue per vertical (CLAUDE.md rule): welfare=green, events=sky,
// content=grape, labs=lemon. Solid brutalist fills - no dark gradients.
const BIG_CTAS = [
  { name: 'PROJECTS', tag: 'Welfare Drives', num: '01',
    desc: `Dogs, saplings, kids, communities. ${displayCount(ORG_FACTS.drivesWrittenUp)} drives since 2021.`,
    href: '/projects', accent: 'var(--welfare)' },
  { name: 'PARADOX', tag: 'Events & Fundraising', num: '02',
    desc: "AQ's annual cultural fest. All proceeds go to charity.",
    href: '/paradox', accent: 'var(--sky)' },
  { name: 'Crftd', tag: 'D2C / B2B Merch', num: '03',
    desc: 'Student-designed merch. Every purchase funds our welfare work.',
    href: '/crftd', accent: 'var(--grape)' },
  { name: 'SHIKSHAQ', tag: 'EdTech Start-up', num: '04',
    desc: 'A student-built EdTech platform making quality education accessible.',
    href: 'https://shikshaq.in', external: true, accent: 'var(--lemon)' },
]

// ── Small links (everything else) ────────────────────────────────
type SmallLink = {
  label: string
  sub: string
  href: string
  external?: boolean
  color: string
  icon: string
}

// Grouped by intent so the index reads as a real information architecture, not
// one flat pile of 15 links: discover the org, get involved, use the tools,
// then connect.
type LinkGroup = { heading: string; hue: string; links: SmallLink[] }

const LINK_GROUPS: LinkGroup[] = [
  {
    heading: 'Explore AquaTerra', hue: 'var(--welfare)',
    links: [
      { label: 'About',            sub: 'Who we are, our story',        href: '/about',          color: '#00E5A0', icon: '★' },
      { label: 'Teams',            sub: `All ${departmentsPhrase(ORG_FACTS.departmentsActive)}`,            href: '/teams',          color: 'var(--grape)', icon: '🧩' },
      { label: 'Members',          sub: 'The people behind the work',   href: '/members',        color: '#FFE94A', icon: '👥' },
      // audit-ok: Pop Orange as a card fill (--dc), the sticker palette.
      { label: 'Blog',             sub: 'Stories from the community',   href: '/blog',           color: '#FF7A1A', icon: '✍' },
      { label: 'Open Books',       sub: 'Every rupee in, every rupee out', href: '/accounts',    color: 'var(--welfare)', icon: '📒' },
      { label: 'Terra Notes',      sub: 'The monthly digital magazine',  href: '/terranotes',     color: 'var(--grape)', icon: '📖' },
      { label: 'AQ Labs',          sub: '8 student-built projects',     href: '/terranotes/articles/labs', color: 'var(--lemon)', icon: '🧪' },
      { label: 'The AQ Map',       sub: 'Everything we do, one map',    href: '/directory',      color: 'var(--sky)', icon: '🗺' },
    ],
  },
  {
    heading: 'Get involved', hue: 'var(--sky)',
    links: [
      { label: 'Open Roles',       sub: 'Openings across departments',  href: '/opportunities',  color: 'var(--sky)', icon: '🎯' },
      { label: 'TerraThon',        sub: 'Cricket, pickleball & FIFA · 2-4 Oct', href: '/terrathon', color: 'var(--sky)', icon: '🏆' },
      { label: 'Volunteer Handbook', sub: 'Everything about volunteering', href: '/volunteer',   color: 'var(--lemon)', icon: '📖' },
      { label: 'Collaborate',      sub: 'Events, sponsorships, schools', href: '/collaborations', color: 'var(--sky)', icon: '🤝' },
      { label: 'Support Us',       sub: 'No donations - real ways to help', href: '/support',    color: 'var(--welfare)', icon: '🌱' },
    ],
  },
  {
    heading: 'Find your way around', hue: 'var(--grape)',
    links: [
      { label: 'Search',           sub: 'Find posts, members, teams',   href: '/search',         color: '#00E5A0', icon: '🔍' },
      { label: 'School Directory', sub: 'Schools in the AQ network',    href: '/schools',        color: '#00E5A0', icon: '🏫' },
      { label: 'Class Cohorts',    sub: 'Members by class year',        href: '/classes',        color: '#FF6BD6', icon: '🎓' },
      { label: 'FAQ',              sub: 'Real questions, real answers', href: '/faq',            color: 'var(--tomato)', icon: '❓' },
    ],
  },
  {
    heading: 'Connect with us', hue: 'var(--tomato)',
    links: [
      { label: 'WhatsApp Community', sub: 'Join the group to hear first', href: WHATSAPP, external: true, color: '#25D366', icon: '💬' },
      { label: 'Instagram',        sub: '@ngo.aquaterra',               href: INSTAGRAM, external: true, color: '#FF6BD6', icon: '📸' },
      { label: 'LinkedIn',         sub: 'Follow our work',              href: LINKEDIN,  external: true, color: '#0A66C2', icon: '💼' },
      { label: 'Contact Us',       sub: 'Get in touch directly',        href: '/contact',        color: '#FF6BD6', icon: '✉' },
    ],
  },
]

// One expandable department card - tap to reveal what the team builds.
function DeptCard({ d }: { d: Department }) {
  const [open, setOpen] = useState(false)
  const panelId = `dept-${d.name.replace(/[^a-zA-Z0-9]+/g, '-')}`
  return (
    // The panel used to live INSIDE the button, hidden only by a 0fr grid row,
    // so it stayed in the accessibility tree: every department button's
    // accessible name was its label plus the whole description and stat, read
    // out as a button name even when collapsed. The container is now a <div>,
    // the button holds only the head row, and the panel is its sibling. The
    // 0fr/1fr transition and every existing class are unchanged.
    <div
      className={'ql-dept' + (open ? ' open' : '')}
      style={{ ['--dc' as string]: d.color }}
    >
      <button
        type="button"
        className="ql-dept-btn"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span className="ql-dept-head">
          <span className="ql-dept-icon" aria-hidden>{d.icon}</span>
          <span className="ql-dept-name">{d.name}</span>
          <span className="ql-dept-cat">{d.category}</span>
          <span className="ql-dept-plus" aria-hidden>⌄</span>
        </span>
      </button>
      {/* aria-hidden rather than `hidden`, which would kill the expand
          transition. The panel holds no focusable content, so nothing is
          trapped behind it. */}
      <span id={panelId} className="ql-dept-wrap" aria-hidden={!open || undefined}>
        <span className="ql-dept-body">
          <span style={{ display: 'block' }}>
            <span className="ql-dept-desc" style={{ display: 'block' }}>{d.desc}</span>
            <span className="ql-dept-stat">★ {d.stat}</span>
          </span>
        </span>
      </span>
    </div>
  )
}

export default function QuickLinksPage() {
  useMeta(pageMetadata.quickLinks)
  useJsonLd('links-breadcrumb', breadcrumbLd([['Home', '/'], ['Quick Links', '/links']]))
  const { isAuthenticated } = useAuth()
  const departments = useDepartmentCount()
  return (
    <div className="route-enter">
      {/* Scoped polish: focus-visible rings + press feedback + reduced-motion safety */}

      {/* ── ① Masthead - a zine cover on paper, not a dark hero ─────── */}
      <section className="bleed-under-nav" style={{
        background: 'var(--bg)',
        padding: 'calc(var(--nav-h, 70px) + clamp(32px,6vw,60px)) var(--page-px,24px) clamp(36px,6vw,64px)',
        position: 'relative', overflow: 'hidden',
        borderBottom: '2px dashed var(--line)',
      }}>
        {/* scrapbook doodles */}
        <span className="deco star" aria-hidden style={{ top: '18%', right: '10%' }} />
        <span className="deco ring" aria-hidden style={{ bottom: '14%', left: '7%' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* zine kicker + sticker badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <span className="sticker sticker-mint wobble sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ the AQ index</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, letterSpacing: '0.1em' }}>
              vol. 01 · every link, one place
            </span>
          </div>

          {/* wordmark */}
          <div style={{ fontFamily: 'var(--display)', fontWeight: 900,
            fontSize: 'clamp(22px,4vw,32px)', letterSpacing: '-0.03em', lineHeight: 1,
            color: 'var(--ink)', marginBottom: 12 }}>
            AQUA<span style={{ color: 'var(--welfare-ink)' }}>TERRA</span>
          </div>

          {/* headline */}
          <h1 className="h-display" style={{ fontFamily: 'var(--display)', fontWeight: 900,
            fontSize: 'clamp(44px,10vw,88px)', letterSpacing: '-0.045em', lineHeight: 0.92,
            color: 'var(--ink)', margin: '0 0 18px', textWrap: 'balance' } as React.CSSProperties}>
            join the <span className="underline-doodle" style={{ color: 'var(--welfare-ink)', fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>movement</span>.
          </h1>

          <p style={{ fontFamily: 'var(--eina)', fontSize: 16, lineHeight: 1.65,
            color: 'var(--ink-2)', maxWidth: 460, margin: '0 0 26px' }}>
            Student-led NGO from Kolkata. Real work, real impact, LoRs &amp; certificates
            for the best - and zero fees, always.
          </p>

          {/* primary CTA - hard-bordered brutalist button */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to={isAuthenticated ? '/' : '/login'} className="ql-press ql-focus ql-cta-primary"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: 'var(--welfare)', color: 'var(--ink)',
                fontFamily: 'var(--display)', fontWeight: 800,
                fontSize: 'clamp(15px,2.4vw,18px)', letterSpacing: '-0.01em',
                padding: '15px 30px', borderRadius: 999, textDecoration: 'none',
                // Primary CTA: keeps the ink keyline + a hard offset, but the
                // measured --shadow-cta token, not a hand-rolled 4px 4px 0.
                border: 'var(--hair-2)', boxShadow: 'var(--lift-1)',
              }}>
              {isAuthenticated ? 'Go to the feed →' : 'Join AquaTerra →'}
            </Link>

            {/* social pills - bordered sticker chips on paper */}
            {[
              { href: WHATSAPP, label: 'WhatsApp', fg: '#178a43' },
              { href: INSTAGRAM, label: 'Instagram', fg: 'var(--grape)' },
              { href: LINKEDIN, label: 'LinkedIn', fg: 'var(--sky)' },
            ].map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                className="ql-press ql-focus"
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  background: 'var(--card)', color: s.fg, border: 'var(--hair-2)',
                  fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  padding: '8px 14px', borderRadius: 999, textDecoration: 'none',
                  boxShadow: 'var(--lift-1)',
                }}>
                {s.label} ↗
              </a>
            ))}
          </div>

          <div style={{ marginTop: 34, color: 'var(--ink-3)',
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em' }}>
            DARPAN certified NGO · reg AAFTT2300ME20251 · explore everything ↓
          </div>
        </div>
      </section>

      {/* ── ② Four ways in - brutalist ledger cards, solid hues ─────── */}
      <section style={{ background: 'var(--bg-2)', borderBottom: '2px dashed var(--line)',
        padding: 'clamp(44px,7vw,72px) var(--page-px,24px)' }}>
        <div>
          <div className="mono" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 12 }}>
            § start here
          </div>
          <h2 className="h-display" style={{ fontFamily: 'var(--display)', fontWeight: 900,
            fontSize: 'clamp(28px,5vw,52px)', letterSpacing: '-0.03em', color: 'var(--ink)',
            margin: '0 0 10px', lineHeight: 1, textWrap: 'balance' } as React.CSSProperties}>
            four ways in.
          </h2>
          <p style={{ fontFamily: 'var(--eina)', fontSize: 15, lineHeight: 1.7,
            color: 'var(--ink-2)', maxWidth: 500, margin: '0 0 32px' }}>
            Real tools, real organisations, real impact - something students rarely get the
            opportunity to build. Pick a lane and start.
          </p>

          <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
            {BIG_CTAS.map((p, i) => {
              const CardTag = p.external ? 'a' : Link
              const cardProps = p.external
                ? { href: p.href, target: '_blank', rel: 'noopener noreferrer' }
                : { to: p.href }
              return (
              <Reveal key={p.name} delay={i * 0.05}>
              <CardTag {...(cardProps as any)} className="ql-focus" style={{ textDecoration: 'none', display: 'block' }}>
                <div className="ql-big-cta" style={{
                  background: 'var(--card)',
                  border: 'var(--hair-2)',
                  borderRadius: 'var(--r-outer)', padding: '0 0 20px', overflow: 'hidden',
                  minHeight: 220, display: 'flex', flexDirection: 'column',
                  boxShadow: 'var(--lift-1)',
                  cursor: 'pointer',
                  ['--rot' as string]: `${i % 2 ? 0.5 : -0.5}deg`,
                } as React.CSSProperties}>
                  {/* solid hue header band with ledger number */}
                  <div style={{ background: p.accent, borderBottom: 'var(--hair)',
                    padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink)' }}>
                      {p.tag}
                    </span>
                    <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 15, color: 'var(--ink)', opacity: 0.5 }}>
                      №{p.num}
                    </span>
                  </div>
                  <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ fontFamily: 'var(--display)', fontWeight: 900,
                      fontSize: 'clamp(24px,2.8vw,32px)', letterSpacing: '-0.03em',
                      color: 'var(--ink)', lineHeight: 1, marginBottom: 12 }}>
                      {p.name}
                    </div>
                    <p style={{ fontFamily: 'var(--eina)', fontSize: 13.5, lineHeight: 1.6,
                      color: 'var(--ink-2)', margin: 0 }}>
                      {p.desc}
                    </p>
                    <div style={{ marginTop: 'auto', paddingTop: 16, fontFamily: 'var(--mono)', fontSize: 11,
                      fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.04em',
                      borderTop: '1px dashed var(--line)' }}>
                      explore →
                    </div>
                  </div>
                </div>
              </CardTag>
              </Reveal>
              )
            })}
          </RevealGroup>
        </div>
      </section>

      {/* ── ③ Everything we do (interactive accordion) ───────────── */}
      <section style={{ padding: 'clamp(44px,7vw,72px) var(--page-px,24px)', background: 'var(--bg)', borderTop: '1px solid var(--line)' }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 14 }}>
            Everything we do
          </div>
          <h2 style={{ fontFamily: 'var(--display)', fontWeight: 900,
            fontSize: 'clamp(28px,5vw,48px)', letterSpacing: '-0.03em', color: 'var(--ink)',
            margin: '0 0 10px', lineHeight: 0.95, textWrap: 'balance' } as React.CSSProperties}>
            {capitalise(departmentsPhrase(departments))},<br />all student-run.
          </h2>
          <p style={{ fontFamily: 'var(--eina)', fontSize: 15, lineHeight: 1.6,
            color: 'var(--ink-3)', maxWidth: 480, margin: '0 0 28px' }}>
            Tap any team to see what they actually build. Every one of them runs on volunteers.
          </p>

          <RevealGroup className="ql-depts">
            {DEPARTMENTS.map((d, i) => <Reveal key={d.name} delay={i * 0.03}><DeptCard d={d} /></Reveal>)}
          </RevealGroup>

          <div style={{ marginTop: 22 }}>
            {/* 2026-09-10 FIX: this rendered as "FULL BREAKDOWNEVERYTHING WE DO"
                - one word. `.link-cta` is `display: inline-flex`, and flex
                layout discards the whitespace text node between the label and
                the <span>, so the literal space in the JSX below never painted.
                A `gap` is the flex-native way to say it; set inline so the
                shared .link-cta class (used elsewhere) is left alone. */}
            <Link to="/everything-we-do" className="ql-focus link-cta"
              style={{ gap: '0.4em', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', textDecoration: 'none' }}>
              full breakdown <span style={{ color: 'var(--ink)', borderBottom: '1.5px solid var(--welfare)' }}>everything we do →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── ④ All the small links ────────────────────────────────── */}
      <section style={{ padding: 'clamp(40px,6vw,64px) var(--page-px,24px)', background: 'var(--bg)' }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 24 }}>
            The full index
          </div>
          <RevealGroup style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {LINK_GROUPS.map((group, gi) => (
            <Reveal key={group.heading} delay={gi * 0.04}>
              <h3 className="mono" style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-2)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: group.hue, border: '1.5px solid var(--ink)', flexShrink: 0 }} />
                {group.heading}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 10 }}>
            {group.links.map(a => {
              const inner = (
                <div className="ql-link-row" style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 18px',
                  background: 'var(--bg-2)',
                  border: 'var(--hair-2)',
                  borderRadius: 'var(--r-tight)',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  ['--lc' as string]: a.color,
                } as React.CSSProperties}>
                  {/* Icon */}
                  <span style={{
                    width: 40, height: 40, borderRadius: 'var(--r-tight)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${a.color}18`,
                    border: `1px solid ${a.color}33`,
                    fontSize: 18, lineHeight: 1,
                  }}>
                    {a.icon}
                  </span>
                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14.5,
                      letterSpacing: '-0.02em', color: 'var(--ink)', marginBottom: 2 }}>
                      {a.label}
                    </div>
                    <div style={{ fontFamily: 'var(--eina)', fontSize: 12, color: 'var(--ink-3)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.sub}
                    </div>
                  </div>
                  {/* Arrow */}
                  {/* Was a.color: #FFE94A on --bg-2 is 1.01:1, literally
                      invisible. The icon chip beside it still carries the hue. */}
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-2)',
                    fontWeight: 700, flexShrink: 0 }}>
                    {a.external ? '↗' : '→'}
                  </span>
                </div>
              )

              return a.external ? (
                <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer"
                  className="ql-focus"
                  style={{ textDecoration: 'none', display: 'block' }}>
                  {inner}
                </a>
              ) : (
                <Link key={a.label} to={a.href} className="ql-focus" style={{ textDecoration: 'none', display: 'block' }}>
                  {inner}
                </Link>
              )
            })}
              </div>
            </Reveal>
            ))}
          </RevealGroup>

          {/* Soft recruitment reinforcement - no recruitment pitch for someone
              who's already a member. */}
          {!isAuthenticated && (
            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <Link to="/login" className="ql-focus link-cta"
                onClick={() => setAuthIntent({ kind: 'apply' })}
                style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: 'var(--ink-3)', textDecoration: 'none' }}>
                Still here? <span style={{ color: 'var(--ink)', borderBottom: '1.5px solid var(--welfare)' }}>Join AquaTerra →</span>
              </Link>
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
