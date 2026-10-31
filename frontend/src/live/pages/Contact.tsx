import { useId, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMeta } from '../../hooks/useMeta'
import { useToast } from '../../components/Toast'
import { pageMetadata } from '../../lib/metaConfig'
import { ASK, LIVE } from '../config'
import { EVENT } from '../../terrathon/config'
import { prettyPhone, waNumber } from '../../terrathon/lib/format'
import { Headline, Kicker } from '../components/Headline'
import { TOPICS, submitEnquiry, validateEnquiry, type EnquiryErrors } from '../lib/enquiries'
import { whatsappHref } from '../lib/links'

export function LiveContact() {
  useMeta(pageMetadata.liveContact)
  const { success, error: toastError } = useToast()
  const [params] = useSearchParams()
  const wanted = params.get('topic') ?? ''
  const id = useId()
  const [form, setForm] = useState({ name: '', contact: '', topic: TOPICS.some(t => t.value === wanted) ? wanted : '', message: '', website: '' })
  const [errors, setErrors] = useState<EnquiryErrors>({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [failed, setFailed] = useState(false)
  const wa = ASK.phone ? waNumber(ASK.phone) : null
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const r = validateEnquiry(form)
    if (!r.ok) {
      if (r.spam) { setSent(true); return }
      setErrors(r.errors)
      return
    }
    setErrors({})
    setBusy(true)
    setFailed(false)
    try {
      await submitEnquiry(r.value)
      setSent(true)
      success('Sent', 'The team will reply on the number or email you gave.')
    } catch {
      setFailed(true)
      toastError("Couldn't send that", 'Try again, or WhatsApp the team below.')
    } finally {
      setBusy(false)
    }
  }

  const fallback = whatsappHref(`Hi, I am ${form.name || 'writing'} about ${TOPICS.find(t => t.value === form.topic)?.label.toLowerCase() ?? 'AquaTerra.live'}. ${form.message}`.trim())

  return (
    <main id="lv-main" className="lv-main lv-page">
      <div className="lv-page-head">
        <Kicker>Say hello</Kicker>
        <Headline as="h1" text="Talk to a real person." />
        <p className="lv-lede">Tickets, timings, sponsorship, a stall, press. One person on the team answers all of it.</p>
      </div>

      <div className="lv-contact-grid">
        {sent ? (
          <div className="lv-empty" role="status">
            <strong>Got it.</strong>
            <p>Thank you. The team will get back to you on the number or email you gave.</p>
            <button type="button" className="lv-btn lv-btn-line" onClick={() => { setSent(false); setForm(f => ({ ...f, message: '' })) }}>Send another</button>
          </div>
        ) : (
          <form className="lv-form" onSubmit={submit} noValidate aria-label="Contact the AquaTerra.live team">
            <div className="lv-field">
              <label htmlFor={`${id}-name`}>Your name</label>
              <input id={`${id}-name`} className="lv-input" value={form.name} onChange={set('name')} autoComplete="name" aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? `${id}-name-e` : undefined} maxLength={80} />
              {errors.name && <p id={`${id}-name-e`} className="lv-field-err" role="alert">{errors.name}</p>}
            </div>
            <div className="lv-field">
              <label htmlFor={`${id}-contact`}>Mobile number or email</label>
              <input id={`${id}-contact`} className="lv-input" value={form.contact} onChange={set('contact')} autoComplete="email" inputMode="email" aria-invalid={errors.contact ? true : undefined} aria-describedby={errors.contact ? `${id}-contact-e` : undefined} maxLength={120} />
              {errors.contact && <p id={`${id}-contact-e`} className="lv-field-err" role="alert">{errors.contact}</p>}
            </div>
            <div className="lv-field">
              <label htmlFor={`${id}-topic`}>What is it about?</label>
              <select id={`${id}-topic`} className="lv-select" value={form.topic} onChange={set('topic')} aria-invalid={errors.topic ? true : undefined}>
                <option value="">Choose one</option>
                {TOPICS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {errors.topic && <p className="lv-field-err" role="alert">{errors.topic}</p>}
            </div>
            <div className="lv-field">
              <label htmlFor={`${id}-msg`}>Your message</label>
              <textarea id={`${id}-msg`} className="lv-textarea" value={form.message} onChange={set('message')} maxLength={1000} aria-invalid={errors.message ? true : undefined} aria-describedby={errors.message ? `${id}-msg-e` : undefined} />
              {errors.message && <p id={`${id}-msg-e`} className="lv-field-err" role="alert">{errors.message}</p>}
            </div>
            {/* a honeypot: people never see it, bots fill it */}
            <div className="lv-trap" aria-hidden><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label></div>
            <div className="lv-actions">
              <button type="submit" className="lv-btn lv-btn-gold lv-btn-lg" disabled={busy}>{busy ? 'Sending…' : 'Send it'}</button>
            </div>
            {failed && (
              <p className="lv-field-err" role="alert">
                That did not go through. {fallback ? <a className="lv-link" href={fallback} target="_blank" rel="noopener noreferrer">Send it on WhatsApp instead</a> : 'Please try again in a moment.'}
              </p>
            )}
          </form>
        )}

        <ul className="lv-cards lv-cards-stack">
          {wa && ASK.phone && (
            <li className="lv-card">
              <h2 className="lv-card-h">{ASK.name}</h2>
              <p className="lv-card-p">{prettyPhone(ASK.phone)}</p>
              <div className="lv-actions">
                <a className="lv-btn lv-btn-red" href={`tel:+${wa}`}>Call</a>
                <a className="lv-btn lv-btn-line" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              </div>
            </li>
          )}
          <li className="lv-card">
            <h2 className="lv-card-h">Email</h2>
            <p className="lv-card-p">{EVENT.email}</p>
            <div className="lv-actions"><a className="lv-btn lv-btn-line" href={`mailto:${EVENT.email}`}>Write to us</a></div>
          </li>
          <li className="lv-card">
            <h2 className="lv-card-h">Instagram</h2>
            <p className="lv-card-p">@aquaterra.live</p>
            <div className="lv-actions"><a className="lv-btn lv-btn-line" href={LIVE.instagram} target="_blank" rel="noopener noreferrer">Follow</a></div>
          </li>
        </ul>
      </div>
    </main>
  )
}
