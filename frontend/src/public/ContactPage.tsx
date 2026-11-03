import './ContactPage.css'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { checkText, BLOCK_MESSAGE } from '../lib/profanityFilter'
import { CONTACT_REPLY_TIME } from '../lib/orgFacts'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { isDirty } from '../lib/unsavedChanges'
import { Reveal, RevealGroup } from '../components/Reveal'
import { sentRecently, markSent, TRAP_STYLE } from '../lib/formGuard'

// changelog/07-auth-and-contact.md §07.0: the three fields validation can
// fail on. `subject` is a free `<option>` picker with no wrong answer, so it
// is deliberately excluded from ContactField rather than given an always-null
// case - a field with no possible error should not need a switch branch to
// say so.
type ContactField = 'name' | 'email' | 'message'

export default function ContactPage() {
  useMeta(pageMetadata.contact)
  useJsonLd('contact-breadcrumb', breadcrumbLd([['Home', '/'], ['Contact', '/contact']]))
  const { info, error: toastError } = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [trap, setTrap] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // §07.0's field-level errors, lifted from CollaborationsPage.tsx's
  // `fieldErrors` shape (the one form in the product already doing per-field
  // errors correctly) rather than a second, invented pattern.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactField, string>>>({})

  // changelog/11-system-states.md §11.9 state 10. This page has no close
  // button and no in-app exit of its own — every way out is the nav, the
  // footer or the browser — so the guard here is the `beforeunload` half only.
  // In-app navigation cannot be blocked without a data router (App.tsx mounts
  // <BrowserRouter>, and react-router's useBlocker throws outside a data
  // router); converting it is a route change this pass may not make. Reported
  // rather than half-built.
  //
  // `submitted` covers both successful exits: the real one navigates to
  // /thank-you, and the mailto fallback sets this same flag — in both cases the
  // message has left this form and there is nothing to warn about.
  useUnsavedChanges({
    dirty: isDirty(form, { name: '', email: '', subject: '', message: '' }),
    submitting: loading,
    submitted,
  })

  const set = (k: keyof typeof form, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    // Same as CollaborationsPage.set(): clear a field's error the moment the
    // user edits it. This is not the keystroke validation §07.0 forbids -
    // it only ever REMOVES an error that blur or submit already put there,
    // never adds one while typing.
    if (k === 'name' || k === 'email' || k === 'message') {
      setFieldErrors(fe => (fe[k as ContactField] ? { ...fe, [k]: undefined } : fe))
    }
  }

  // One rule per field, shared by blur and submit so the two can never
  // disagree about what "valid" means. `that address looks incomplete.` is
  // the bulk-approved string from §07.0's "A note on strings"; the other two
  // match the app's own existing voice for a missing required field (see
  // auth/LoginPage.tsx's `we need your email.` / `we need your password.`).
  const validateField = (key: ContactField, value: string): string | undefined => {
    switch (key) {
      case 'name':
        return value.trim() ? undefined : 'we need your name.'
      case 'email':
        if (!value.trim()) return 'we need your email.'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'that address looks incomplete.'
        return undefined
      case 'message':
        return value.trim() ? undefined : 'we need a message.'
    }
  }

  // §07.0: "Validate on blur and on submit - never on keystroke." This is
  // the blur half; handleSubmit below is the other.
  const handleBlur = (key: ContactField) => {
    setFieldErrors(fe => ({ ...fe, [key]: validateField(key, form[key]) }))
  }

  // Built in one place — the two fallback paths had drifted into separate
  // copies of the same string, so a change to one silently missed the other.
  const mailtoFor = () =>
    `mailto:aquaterrakolkata@gmail.com?subject=${encodeURIComponent('Website enquiry: ' + (form.subject || 'General'))}` +
    `&body=${encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`)}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // §07.0 / ACCEPTANCE.md "field-level errors render... focus moves to the
    // first invalid field on a failed submit." Replaces the old single toast
    // ('a few fields still need filling.') that named no field.
    const fe: Partial<Record<ContactField, string>> = {}
    const order: ContactField[] = ['name', 'email', 'message']
    for (const key of order) {
      const msg = validateField(key, form[key])
      if (msg) fe[key] = msg
    }
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe)
      const firstBad = order.find(key => fe[key])
      if (firstBad) document.getElementById(`c-${firstBad}`)?.focus()
      return
    }
    setFieldErrors({})
    // Honeypot filled: a bot. Look like it worked, send nothing.
    if (trap) { setSubmitted(true); return }
    if (sentRecently('contact')) { toastError('You just sent a message.', 'Give it a few seconds before sending another.'); return }
    // No moderation queue exists for this form - both tiers hard-block.
    if ((await checkText(form.message)).severity !== 'clean' || (await checkText(form.subject)).severity !== 'clean') {
      toastError(BLOCK_MESSAGE)
      return
    }
    setLoading(true)
    try {
      // Try saving to supabase, fall back to mailto if table doesn't exist
      // The table's columns are name, email, phone, role, message (checked live 3 Nov 2026). This used to insert `full_name` and
      // `subject`, which do not exist, so EVERY submission failed here and fell back to the mail client: the form had never
      // saved one message. The subject rides at the front of the message.
      const { error: dbErr } = await supabase.from('contact_submissions').insert([{
        name: form.name.trim(),
        email: form.email.trim(),
        message: (form.subject ? `[${form.subject}] ` : '') + form.message.trim(),
      }])
      if (!dbErr) markSent('contact')
      if (dbErr) {
        // Graceful fallback: open email client pre-filled.
        //
        // This used to fall through to "Message sent!" — but nothing had been
        // sent. The insert failed and the user still has to press send inside
        // their mail client. Telling them it's done is how a message quietly
        // never arrives and nobody follows up. Say what actually happened, and
        // stay on the page so the pre-filled draft is still reachable.
        // window.open() here can be silently popup-blocked - it follows two
        // awaited network calls (checkText, the insert above), and several
        // browsers only allow window.open as the *direct, synchronous*
        // result of a user gesture. If that happens this is the one fallback
        // this form has, and it fails invisibly - so the toast leads with the
        // "reopen the draft" button in the submitted state below instead of
        // assuming the popup succeeded.
        window.open(mailtoFor())
        info('we’ve drafted the email for you.', "we couldn't save it here, so press send in the tab that opened, or use “reopen the draft” below if nothing did.")
        setSubmitted(true)
        setLoading(false)
        return
      }
      setForm({ name: '', email: '', subject: '', message: '' })
      // A real URL for the completed enquiry. The inline success state had no
      // address, so "how many people finish this form" was unanswerable.
      navigate('/thank-you?from=contact')
    } catch {
      window.open(mailtoFor())
      info('we’ve drafted the email for you.', "we couldn't reach the server, so press send in the tab that opened, or use “reopen the draft” below if nothing did.")
      setSubmitted(true)
    }
    setLoading(false)
  }

  return (
    // Standard .container frame (no inline maxWidth) so the page's content edge
    // matches the nav, the footer and every other page — it used to be a centred
    // 720px column, which pushed its content well inside the footer's edge and
    // read as disconnected. The postcard form keeps its own 720px cap below, but
    // now left-aligns to the content edge instead of floating centre-stage.
    <div className="route-enter container" style={{ padding: 'clamp(28px, 5vw, 48px) var(--page-px,24px) clamp(40px, 6vw, 64px)' }}>
      <h1 className="h-display" style={{ fontSize: 'clamp(52px, 8vw, 80px)', margin: 0, lineHeight: 0.9, position: 'relative', display: 'inline-block' }}>
        <span className="deco plus" aria-hidden style={{ top: -10, right: -34, width: 18, height: 18 }} />
        say <span className="underline-doodle" style={{ color: 'var(--welfare-ink)' }}>hi</span>.
      </h1>
      <p style={{ fontSize: 18, marginTop: 12, color: 'var(--ink-2)', maxWidth: '60ch' }}>
        partnerships, collabs, questions, or just want to know more. we read everything.
      </p>

      {/* A successful send now goes to /thank-you, so this block is ONLY the
          fallback: the save failed and we opened a pre-filled draft in the
          visitor's mail app. It used to show a green tick and "message sent",
          which was the same false claim in a nicer font — the message is
          sitting unsent in their drafts and only they can send it. */}
      {/* the form on the left, the ways to reach us beside it: it used to leave two thirds of the page empty */}
      <div className="ct-layout">
      {submitted ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 720 }}>
          <div className="h-display" style={{ fontSize: 30 }}>almost, one more tap.</div>
          <p style={{ color: 'var(--ink-2)', marginTop: 10, maxWidth: '46ch', margin: '10px auto 0' }}>
            We couldn&apos;t save your message here, so we&apos;ve opened it as a draft in your email
            app with everything filled in. <strong>Press send there</strong> and it reaches us the
            same way.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
            <a className="btn btn-primary" href={mailtoFor()}>reopen the draft</a>
            <button className="btn" onClick={() => setSubmitted(false)}>
              back to the form
            </button>
          </div>
        </div>
      ) : (
        // changelog/07-auth-and-contact.md §07.3: "DELETE the hard ink border
        // + offset shadow from the auth and contact card shells (00.6). They
        // survive only on .btn-primary and stamped stickers." The hand-placed
        // rotate() is untouched - §07.3 names only the border+shadow, and
        // .lg-card in auth/LoginPage.css keeps its own tilt for the same
        // "charm that still reads" reason - this just isn't a surface the
        // instruction covers, so it is left exactly as it was.
        <form noValidate className="card" style={{ maxWidth: 720, padding: 0, overflow: 'hidden', position: 'relative' }} onSubmit={handleSubmit}>
          <div style={TRAP_STYLE} aria-hidden><label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} /></label></div>
          {/* Postage-stamp graphic.
              audit-ok: dashed + 4px radius - a stamp perforation, drawn, not UI. */}
          <div aria-hidden style={{
            position: 'absolute', top: 20, right: 24, width: 60, height: 74,
            border: '2px dashed var(--line-2)', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--welfare)', color: 'var(--ink)', transform: 'rotate(4deg)',
            zIndex: 1,
          }}>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 22 }}>★</span>
          </div>

          {/* Handwritten postcard label. Right padding clears the absolutely-
              positioned postage-stamp (60px wide, 24px from the right) so the
              heading's last letters never sit under the green ★. */}
          <div style={{ padding: '26px 96px 18px 28px', borderBottom: 'var(--hair-2)', background: 'var(--bg-2)' }}>
            <div style={{ fontFamily: 'var(--font-hand, "Caveat", cursive)', fontSize: 32, lineHeight: 1, color: 'var(--ink)' }}>
              a note to aquaterra…
            </div>
          </div>

          <div style={{ padding: '24px 28px 28px' }}>
            {/* §07.0: the four boxed `.input`/`.textarea`/`.sel` fields below
                become `.aq-field` underline fields - "the single most
                reusable thing in this file." Validation (fieldErrors,
                handleBlur, handleSubmit above) is CollaborationsPage.tsx's
                own pattern, lifted rather than reinvented, extended with the
                blur half §07.0 requires as a hard rule ("validate on blur
                and on submit - never on keystroke") that CollaborationsPage
                itself does not yet have. */}
            <div className="row gap-3" style={{ flexWrap: 'wrap' }}>
              <div className="aq-field" data-invalid={fieldErrors.name ? true : undefined} style={{ flex: 1, minWidth: 220 }}>
                <label className="aq-field-label" htmlFor="c-name">from *</label>
                <input
                  id="c-name"
                  maxLength={200}
                  className="aq-field-input"
                  placeholder="your name"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'c-name-error' : undefined}
                  autoComplete="name"
                  required
                />
                {fieldErrors.name && <span id="c-name-error" role="alert" className="aq-field-error">{fieldErrors.name}</span>}
              </div>
              <div className="aq-field" data-invalid={fieldErrors.email ? true : undefined} style={{ flex: 1, minWidth: 220 }}>
                <label className="aq-field-label" htmlFor="c-email">reply-to *</label>
                <input
                  id="c-email"
                  maxLength={254}
                  className="aq-field-input"
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  onBlur={() => handleBlur('email')}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'c-email-error' : undefined}
                  autoComplete="email"
                  inputMode="email"
                  required
                />
                {fieldErrors.email && <span id="c-email-error" role="alert" className="aq-field-error">{fieldErrors.email}</span>}
              </div>
            </div>

            <div className="aq-field" style={{ marginTop: 24 }}>
              <label className="aq-field-label" htmlFor="c-subject">what is this about?</label>
              <select
                id="c-subject"
                className="aq-field-input"
                value={form.subject}
                onChange={e => set('subject', e.target.value)}
              >
                <option value="">pick one</option>
                <option>partnership or collaboration</option>
                <option>school or college collab</option>
                <option>NGO partnership</option>
                <option>Crftd or merchandise</option>
                <option>ShikshAQ</option>
                <option>AQ.Ventures</option>
                <option>media or press</option>
                <option>something else</option>
              </select>
            </div>

            <div className="aq-field" data-invalid={fieldErrors.message ? true : undefined} style={{ marginTop: 24 }}>
              <label className="aq-field-label" htmlFor="c-message">message *</label>
              <textarea
                id="c-message"
                maxLength={4000}
                className="aq-field-input"
                placeholder="tell us what you need. be as direct as you want."
                style={{
                  minHeight: 140, lineHeight: '28px', paddingTop: 8, resize: 'vertical',
                  backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 27px, var(--line) 27px, var(--line) 28px)',
                  backgroundAttachment: 'local',
                }}
                value={form.message}
                onChange={e => set('message', e.target.value)}
                onBlur={() => handleBlur('message')}
                aria-invalid={!!fieldErrors.message}
                aria-describedby={fieldErrors.message ? 'c-message-error' : undefined}
                required
              />
              {fieldErrors.message && <span id="c-message-error" role="alert" className="aq-field-error">{fieldErrors.message}</span>}
            </div>

            <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              {/* --code, not the inherited --mono: NeutralFace is caps-only and
                  would render the handle as @NGO.AQUATERRA. */}
              <p className="mono xs muted" style={{ margin: 0, fontFamily: 'var(--code)' }}>
                usually {CONTACT_REPLY_TIME} · Instagram: @ngo.aquaterra
              </p>
              <button
                type="submit"
                className="btn btn-lg btn-primary"
                disabled={loading}
                aria-busy={loading}
                // §07.1: "SET the submit to min-height: 54px." It measured
                // 49px at 360x780 - .btn-lg's own height, which is short of
                // the 54 this file asks for on the one control the page
                // exists for.
                style={{ minWidth: 120, minHeight: 54, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {loading ? (
                  <>
                    <span aria-hidden="true" style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                    sending…
                  </>
                ) : 'post it →'}
              </button>
            </div>
          </div>
        </form>
      )}

      <RevealGroup className="ct-aside">
        {[
          { label: 'Instagram', value: '@ngo.aquaterra', sub: 'fastest response', href: 'https://instagram.com/ngo.aquaterra' },
          { label: 'ShikshAQ', value: '@shikshaq.in', sub: 'tuition platform', href: 'https://instagram.com/shikshaq.in' },
          { label: 'Registration', value: 'DARPAN ID: WB/2025/0745627', sub: 'TerraRoots charitable trust', href: undefined },
        ].map((c, i) => (
          <Reveal key={c.label} delay={i * 0.05}>
            {c.href ? (
              <a href={c.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div className="card card-hover" style={{ padding: 18 }}>
                  <div className="mono xs upper muted" style={{ fontWeight: 700 }}>{c.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6, color: 'var(--ink)' }}>{c.value}</div>
                  <div className="mono xs muted" style={{ marginTop: 2 }}>{c.sub}</div>
                </div>
              </a>
            ) : (
              <div className="card" style={{ padding: 18 }}>
                <div className="mono xs upper muted" style={{ fontWeight: 700 }}>{c.label}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>{c.value}</div>
                <div className="mono xs muted" style={{ marginTop: 2 }}>{c.sub}</div>
              </div>
            )}
          </Reveal>
        ))}
      </RevealGroup>
      </div>
    </div>
  )
}
