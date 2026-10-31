import './CollaborationsPage.css'
import Img from '../components/Img'
import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, type WelfareProject, OBJ_CAT_MAP, normalizeObj } from '../lib/supabase'
import { CAT_COLORS } from '../lib/jobOpenings'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import { Marquee } from '../components/v6Shared'
import { checkText, BLOCK_MESSAGE } from '../lib/profanityFilter'
import { Reveal, RevealGroup } from '../components/Reveal'

// Exported for director/FormResponses.tsx (§20.6): the enquiries desk's type
// filter reads this list rather than retyping its own copy of it, so the two
// can never drift apart.
export const COLLAB_TYPES = ['Event Co-hosting', 'Sponsorship', 'Resource Sharing', 'Joint Welfare Drive', 'Technology Partnership', 'Media / Content', 'Other']

interface Form { orgName: string; contactName: string; email: string; phone: string; collabType: string; message: string }

const WHO_WE_WORK_WITH = [
  { label: 'Schools & Colleges', desc: 'campus chapters, teaching workshops, and joint welfare drives run with student bodies across Kolkata.', color: 'var(--sky)' },
  { label: 'NGO Partners', desc: 'joint relief trips, resource sharing, and cross-promotion with aligned welfare organisations.', color: 'var(--welfare)' },
  { label: 'Brands', desc: 'sponsorships, co-branded merch drops, and event partnerships that help fund the work.', color: 'var(--lemon)' },
]

const fieldErrSt: React.CSSProperties = { display: 'block', marginTop: 4, color: 'var(--danger)', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }
type ProjectCard = Pick<WelfareProject, 'id' | 'slug' | 'header' | 'location' | 'main_image' | 'main_image_alt' | 'objective' | 'collab_name'>

export default function CollaborationsPage() {
  useMeta(pageMetadata.collaborations)
  useJsonLd('collabs-breadcrumb', breadcrumbLd([['Home', '/'], ['Collaborations', '/collaborations']]))
  const [form, setForm] = useState<Form>({ orgName: '', contactName: '', email: '', phone: '', collabType: '', message: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Form, string>>>({})
  const [collabProjects, setCollabProjects] = useState<ProjectCard[]>([])

  useEffect(() => {
    supabase
      .from('welfare_projects')
      .select('id,slug,header,location,main_image,main_image_alt,objective,collab_name')
      .eq('is_draft', false)
      // Only projects that actually had a partner - this is the collaborations
      // rail, so show real collabs, and show all of them (there are ~12).
      .not('collab_name', 'is', null)
      .order('workshop_date', { ascending: false })
      .limit(12)
      // Decorative rail - a failed read just leaves it empty, but handle the
      // rejection (2-arg then; the query builder returns a PromiseLike with no
      // .catch) so it never surfaces as an unhandled promise error.
      .then(
        ({ data }) => { if (data) setCollabProjects(data as any) },
        () => {},
      )
  }, [])

  // "Our partners" wall, derived from the same live query as the
  // "collaborative projects" rail below rather than a hardcoded array -
  // that static list could silently drift (a partner no longer current,
  // a real new one missing until someone hand-edited it) while this rail
  // stays accurate by construction. Deduped by collab_name, colored by the
  // same objective->category mapping the rail's own cards use.
  const livePartners = useMemo(() => {
    const byName = new Map<string, { name: string; count: number; color: string }>()
    for (const p of collabProjects) {
      if (!p.collab_name) continue
      const existing = byName.get(p.collab_name)
      if (existing) { existing.count += 1; continue }
      const category = OBJ_CAT_MAP[normalizeObj(p.objective)] || 'welfare'
      byName.set(p.collab_name, { name: p.collab_name, count: 1, color: CAT_COLORS[category] || 'var(--welfare)' })
    }
    return Array.from(byName.values())
  }, [collabProjects])

  const set = (k: keyof Form, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    // Clear a field's inline error as soon as the user edits it.
    setFieldErrors(fe => (fe[k] ? { ...fe, [k]: undefined } : fe))
  }

  // ContactPage.tsx's own copy of this pattern (§07.0, lifted from here and
  // extended) documents it explicitly as an extension of this file's
  // validation - back-porting the same shared per-field validator so blur and
  // submit can never disagree about what "valid" means.
  type ValidatedField = 'orgName' | 'contactName' | 'email' | 'message'
  const FIELD_DOM_ID: Record<ValidatedField, string> = { orgName: 'col-org', contactName: 'col-contact', email: 'col-email', message: 'col-msg' }

  const validateField = (key: ValidatedField, value: string): string | undefined => {
    switch (key) {
      case 'orgName':
        return value.trim() ? undefined : 'Organisation name is required.'
      case 'contactName':
        return value.trim() ? undefined : 'Contact name is required.'
      case 'email':
        if (!value.trim()) return 'Email is required.'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.'
        return undefined
      case 'message':
        return value.trim() ? undefined : 'Tell us a little about your proposal.'
    }
  }

  const validate = (): Partial<Record<keyof Form, string>> => {
    const fe: Partial<Record<keyof Form, string>> = {}
    for (const key of ['orgName', 'contactName', 'email', 'message'] as const) {
      const msg = validateField(key, form[key])
      if (msg) fe[key] = msg
    }
    return fe
  }

  // Validate on blur too, not just on submit - mirrors ContactPage.tsx's
  // handleBlur, sharing the same per-field rule via validateField above.
  const handleBlur = (key: ValidatedField) => {
    setFieldErrors(fe => ({ ...fe, [key]: validateField(key, form[key]) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const fe = validate()
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe); setError(null)
      // Focus moves to the first invalid field on a failed submit, same as
      // ContactPage.tsx's handleSubmit.
      const order: ValidatedField[] = ['orgName', 'contactName', 'email', 'message']
      const firstBad = order.find(key => fe[key])
      if (firstBad) document.getElementById(FIELD_DOM_ID[firstBad])?.focus()
      return
    }
    // No moderation queue exists for this form - both tiers hard-block.
    if ((await checkText(form.message)).severity !== 'clean' || (await checkText(form.orgName)).severity !== 'clean') {
      setFieldErrors({}); setError(BLOCK_MESSAGE); return
    }
    setFieldErrors({})
    setLoading(true); setError(null)
    const { error: err } = await supabase.from('collaboration_submissions').insert([{
      org_name: form.orgName, contact_name: form.contactName, email: form.email,
      phone: form.phone || null, collab_type: form.collabType || null, message: form.message,
    }])
    setLoading(false)
    if (err) { setError('submission failed. please try again.'); return }
    // Give the completed proposal a real URL, so it can be counted and so the
    // "what happens next" answer has somewhere to live.
    navigate('/thank-you?from=collab')
  }

  return (
    <div className="route-enter">
      {/* bleed-under-nav: full-bleed dark first section - without it, the
          fixed nav's cleared-space padding on <main> shows through as a
          pale strip instead of black (see DirectorDashboard/BlogPostPage
          for the same fix). */}
      <section className="bleed-under-nav" data-nav-tint="ink" style={{ padding: 'calc(var(--nav-h, 70px) + clamp(44px, 8vw, 80px)) 0 clamp(32px, 5vw, 56px)', position: 'relative', overflow: 'hidden', background: 'var(--ink)' }}>
        {/* Giant faint repeated background texture */}
        <div aria-hidden style={{
          position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--display)', fontWeight: 900,
            fontSize: 'clamp(80px,20vw,260px)', color: 'rgba(255,255,255,0.045)',
            whiteSpace: 'nowrap', letterSpacing: '-0.03em', textTransform: 'uppercase',
          }}>
            TOGETHER · TOGETHER · TOGETHER
          </div>
        </div>
        <div className="container" style={{ position: 'relative' }}>
          <span className="sticker sticker-sky wobble sticker--diecut" style={{ marginBottom: 16, display: 'inline-flex', ['--sticker-ground' as string]: 'var(--ink)' }}>★ open to partnerships</span>
          <h1 className="giant" style={{ margin: 0, lineHeight: 0.88, color: 'var(--card)', position: 'relative', display: 'inline-block' }}>
            <span className="deco star" aria-hidden style={{ top: -14, right: -36, width: 24, height: 24 }} />
            let's<br />
            <span style={{ display: 'inline-block', transform: 'rotate(-3deg)' }}>build</span>{' '}
            <span style={{
              display: 'inline-block', background: 'var(--sky)', color: 'var(--ink)',
              padding: '2px 18px', borderRadius: 999, transform: 'rotate(2deg)',
              fontSize: '0.85em', verticalAlign: 'middle',
            }}>together</span>
            {/* accent-lint-ok: measured in-browser, the ground here is the ink slab (#0A0A0A), not cream. The display hue clears AA on ink (welfare 4.55:1, lemon 15.1:1) and its --*-ink partner does NOT (3.20:1 / 3.36:1) - swapping it made this worse and was reverted. The ground is on an ancestor element, so a static checker cannot see it. */}
            <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--lemon)' }}>.</span>
          </h1>
          <p style={{ fontSize: 19, marginTop: 22, maxWidth: 520, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
            co-host events, sponsor drives, share resources, or build something new together. we are open to any serious partnership from schools, colleges, NGOs, or brands.
          </p>
        </div>
      </section>

      {/* Partner marquee */}
      {livePartners.length > 0 && (
        <section data-nav-tint="ink" style={{ padding: '16px 0', background: 'var(--ink)', color: 'var(--bg)', overflow: 'hidden' }}>
          <Marquee items={livePartners.map(p => `★ ${p.name.toUpperCase()}`)} color="mint" />
        </section>
      )}

      {/* Past partners logo wall - real, live partners (see livePartners above) */}
      {livePartners.length > 0 && (
      <div className="container" style={{ padding: 'clamp(44px, 6vw, 64px) var(--page-px) 48px' }}>
        <h2 className="mono xs upper muted" style={{ fontWeight: 700, margin: '0 0 16px' }}>★ our partners</h2>
        <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
          {livePartners.map((p, i) => (
            <Reveal key={p.name} delay={Math.min(i * 0.03, 0.4)}>
              <div
                className="card collab-partner"
                /* p.color is a var(--c-*) reference, not a hex literal - the hover
                   tint reads it via --tint + color-mix() in CollaborationsPage.css
                   (appending an alpha suffix like `${p.color}26` produces an
                   invalid CSS value ("var(--c-welfare)26") that the browser
                   silently drops). */
                style={{ padding: '14px 18px', borderLeft: `6px solid ${p.color}`, ['--tint' as string]: p.color } as React.CSSProperties}
              >
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, fontFamily: 'var(--display)' }}>{p.name}</div>
                <div className="mono xs muted">{p.count} collab{p.count !== 1 ? 's' : ''}</div>
              </div>
            </Reveal>
          ))}
        </RevealGroup>
      </div>
      )}

      {/* Who we work with */}
      <div className="container" style={{ padding: 'clamp(32px, 5vw, 48px) var(--page-px, 24px) 48px' }}>
        <h2 className="mono xs upper muted" style={{ fontWeight: 700, margin: '0 0 16px' }}>★ WHO WE WORK WITH</h2>
        <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16 }}>
          {WHO_WE_WORK_WITH.map((w, i) => (
            <Reveal key={w.label} delay={i * 0.05}>
              <div className="card" style={{ padding: 24, height: '100%' }}>
                {/* Swatch tile: 14px tight radius + hairline edge (was 12px + 2px ink). */}
                <div style={{ width: 40, height: 40, borderRadius: 'var(--r-tight)', background: w.color, border: 'var(--hair-2)' }} />
                <h3 className="h-display" style={{ fontSize: 20, margin: '14px 0 8px' }}>{w.label}</h3>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>{w.desc}</p>
              </div>
            </Reveal>
          ))}
        </RevealGroup>
      </div>

      {/* Collab projects */}
      {collabProjects.length > 0 && (
        <div className="container" style={{ padding: '0 var(--page-px, 24px) 48px' }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
            <h2 className="mono xs upper muted" style={{ fontWeight: 700, margin: 0 }}>★ COLLABORATIVE PROJECTS</h2>
            <Link to="/projects" className="mono xs link-cta" style={{ color: 'var(--welfare-ink)' }}>all projects →</Link>
          </div>
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))', gap: 16 }}>
            {collabProjects.map((p, i) => (
              <Reveal key={p.slug} delay={Math.min(i * 0.03, 0.4)}>
                <Link to={`/projects/${p.slug}`} className="card card-hover" style={{ padding: 0, overflow: 'hidden', textDecoration: 'none' }}>
                  {p.main_image && (
                    <div style={{ aspectRatio: '16/9', overflow: 'hidden' }}>
                      <Img ctx="card" src={p.main_image} alt={p.main_image_alt || p.header} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />
                    </div>
                  )}
                  <div style={{ padding: '14px 16px' }}>
                    {p.collab_name && (
                      <span className="chip" style={{ marginBottom: 8, display: 'inline-block', fontSize: 11 }}>with {p.collab_name}</span>
                    )}
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 4 }}>{p.header}</div>
                    {p.location && <div className="mono xs muted">{p.location}</div>}
                  </div>
                </Link>
              </Reveal>
            ))}
          </RevealGroup>
        </div>
      )}

      {/* CTA */}
      <div className="container" style={{ padding: '0 var(--page-px, 24px) 48px' }}>
        <Reveal>
          <div className="card" style={{ padding: 'clamp(32px, 5vw, 48px)', background: 'var(--lemon)', color: 'var(--ink)', textAlign: 'center' }}>
            <h2 className="h-display" style={{ fontSize: 'clamp(28px, 4vw, 40px)', margin: '0 0 12px' }}>
              got a project in mind?
            </h2>
            <p style={{ opacity: 0.75, maxWidth: 460, margin: '0 auto' }}>tell us about it below - we usually reply within a few days.</p>
          </div>
        </Reveal>
      </div>

      {/* Proposal form */}
      <div className="container" style={{ padding: '0 var(--page-px) 64px' }}>
        {/* Frame stays the site-standard .container so the left edge matches the
            hero above; the narrow measure is an inner cap on the form itself. */}
        <div style={{ maxWidth: 680 }}>
        <h2 className="h-display" style={{ fontSize: 'clamp(32px, 5vw, 52px)', marginBottom: 32, lineHeight: 0.95 }}>
          send a proposal<span style={{ color: 'var(--welfare-ink)' }}>.</span>
        </h2>

        {/* The inline success card that used to live here is now the
            /thank-you route, which says the same thing plus what happens next
            — and has a URL, so completed proposals can actually be counted. */}
        <div className="card" style={{ padding: 28 }}>
            {error && (
              <div role="alert" style={{ padding: '10px 14px', marginBottom: 16, borderLeft: '4px solid var(--danger)', background: 'rgba(255,77,46,0.06)' }}>
                <span style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</span>
              </div>
            )}
            <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="col-fieldpair">
                <div>
                  <label htmlFor="col-org" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>organisation name *</label>
                  <input id="col-org" autoComplete="organization" className="input" value={form.orgName} onChange={e => set('orgName', e.target.value)} onBlur={() => handleBlur('orgName')} placeholder="your school / org" required aria-invalid={!!fieldErrors.orgName} aria-describedby={fieldErrors.orgName ? 'col-org-error' : undefined} />
                  {fieldErrors.orgName && <span id="col-org-error" role="alert" style={fieldErrSt}>{fieldErrors.orgName}</span>}
                </div>
                <div>
                  <label htmlFor="col-contact" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>contact name *</label>
                  <input id="col-contact" className="input" value={form.contactName} onChange={e => set('contactName', e.target.value)} onBlur={() => handleBlur('contactName')} placeholder="your name" required autoComplete="name" aria-invalid={!!fieldErrors.contactName} aria-describedby={fieldErrors.contactName ? 'col-contact-error' : undefined} />
                  {fieldErrors.contactName && <span id="col-contact-error" role="alert" style={fieldErrSt}>{fieldErrors.contactName}</span>}
                </div>
              </div>
              <div className="col-fieldpair">
                <div>
                  <label htmlFor="col-email" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>email *</label>
                  <input id="col-email" className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} onBlur={() => handleBlur('email')} placeholder="you@org.com" required autoComplete="email" inputMode="email" aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'col-email-error' : undefined} />
                  {fieldErrors.email && <span id="col-email-error" role="alert" style={fieldErrSt}>{fieldErrors.email}</span>}
                </div>
                <div>
                  <label htmlFor="col-phone" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>phone</label>
                  <input id="col-phone" className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 00000 00000" autoComplete="tel" inputMode="tel" />
                </div>
              </div>
              {/* Chip group, not one control — role="group" carries the name
                  (a <label> here associated with nothing). */}
              <div role="group" aria-labelledby="col-type-cap">
                <span id="col-type-cap" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>type of collaboration</span>
                <div className="row gap-2 flex-wrap">
                  {COLLAB_TYPES.map(t => (
                    <button key={t} type="button" aria-pressed={form.collabType === t} onClick={() => set('collabType', t)} className={'chip ' + (form.collabType === t ? 'chip-active' : '')}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="col-msg" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>message *</label>
                <textarea id="col-msg" className="textarea" rows={5} value={form.message} onChange={e => set('message', e.target.value)} onBlur={() => handleBlur('message')} placeholder="tell us about your proposal. what do you want to achieve and how does AQ fit?" required aria-invalid={!!fieldErrors.message} aria-describedby={fieldErrors.message ? 'col-msg-error' : undefined} />
                {fieldErrors.message && <span id="col-msg-error" role="alert" style={fieldErrSt}>{fieldErrors.message}</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <button type="submit" className="btn btn-primary btn-lg" disabled={loading} aria-busy={loading}>
                  {loading ? 'sending...' : 'send proposal →'}
                </button>
              </div>
            </form>
        </div>
        </div>
      </div>
    </div>
  )
}
