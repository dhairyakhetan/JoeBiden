import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { useToast } from '../components/Toast'
import { SuccessCheck } from '../components/SuccessCheck'
import {
  grievanceService, grievanceProblem, CATEGORIES, CATEGORY_LABEL, STATUS_LABEL, DESCRIPTION_MAX, RESPONSE_DAYS,
  type GrievanceCategory, type MyGrievance,
} from '../services/grievanceService'

/**
 * `/grievance` (handoff C-32): a grievance redressal form for signed-in, approved members. Only the HR team and Super Admins can
 * read what is written here (enforced in the database); the submitter sees only the status of their own submissions.
 * Nothing typed here is put in a URL, an analytics event, a log or an email.
 */
const fieldStyle = { width: '100%', padding: '10px 12px', background: 'var(--bg-2)', border: 'var(--hair-2)', borderRadius: 'var(--r-inner)', fontFamily: 'var(--eina)', fontSize: 16, color: 'var(--ink)', boxSizing: 'border-box' } as const
const labelStyle = { fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 6 } as const

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

export default function GrievancePage() {
  useMeta({ title: 'Raise a concern | AquaTerra', description: 'A private way to raise a concern with the AquaTerra HR team.', image: '', path: '/grievance', noIndex: true })
  const toast = useToast()
  const id = useId()
  const [category, setCategory] = useState<GrievanceCategory | ''>('')
  const [description, setDescription] = useState('')
  const [aboutText, setAboutText] = useState('')
  const [incidentDate, setIncidentDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [mine, setMine] = useState<MyGrievance[] | null>(null)

  const loadMine = () => { grievanceService.listMine().then(setMine).catch(() => setMine([])) }
  useEffect(() => { loadMine() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category) { setError('pick what this is about.'); return }
    const problem = grievanceProblem({ category, description, incidentDate })
    if (problem) { setError(problem); return }
    setError(null)
    setSending(true)
    try {
      await grievanceService.submit({ category, description, aboutText, incidentDate })
      setSent(true)
      setDescription(''); setAboutText(''); setIncidentDate(''); setCategory('')
      loadMine()
    } catch (err: any) {
      const msg = err?.message || 'Something went wrong. Please try again.'
      setError(msg)
      toast.error('Could not send it', msg)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="route-enter" style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(24px, 5vw, 48px) var(--page-px, 20px) 96px' }}>
      <h1 className="h-display" style={{ fontSize: 'clamp(30px, 6vw, 48px)', margin: 0 }}>raise a concern.</h1>
      <p style={{ fontFamily: 'var(--eina)', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', margin: '12px 0 8px' }}>
        Only the HR team and Super Admins can read this. We usually respond within {RESPONSE_DAYS} days.
      </p>
      <p style={{ fontFamily: 'var(--eina)', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-3)', margin: '0 0 24px' }}>
        If someone is in danger right now, contact the emergency services first. You can also reach the HR team on the <Link to="/equity-policy">equity policy page</Link>.
      </p>

      {sent ? (
        <div role="status" style={{ background: 'var(--welfare)', color: 'var(--ink)', border: 'var(--hair-2)', borderRadius: 'var(--r-inner)', padding: 24, textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><SuccessCheck color="var(--ink)" /></div>
          <div className="h-display" style={{ fontSize: 26, marginBottom: 8 }}>we have it.</div>
          <p style={{ margin: '0 0 16px', fontFamily: 'var(--eina)', fontSize: 14.5, lineHeight: 1.6 }}>
            Thank you for telling us. The HR team will read it. You can see its status below.
          </p>
          <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setSent(false)}>send another</button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 18 }}>
          <div>
            <label htmlFor={`${id}-cat`} style={labelStyle}>What is it about <span aria-hidden style={{ color: 'var(--accent-ink)' }}>*</span></label>
            <select id={`${id}-cat`} value={category} onChange={e => setCategory(e.target.value as GrievanceCategory | '')} style={fieldStyle} required>
              <option value="">choose one</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-desc`} style={labelStyle}>What happened <span aria-hidden style={{ color: 'var(--accent-ink)' }}>*</span></label>
            <textarea id={`${id}-desc`} value={description} onChange={e => setDescription(e.target.value)} maxLength={DESCRIPTION_MAX} rows={7}
              style={{ ...fieldStyle, minHeight: 160, resize: 'vertical' }} placeholder="Tell us in your own words. Plain text only." required />
            <div className="mono xs muted" style={{ marginTop: 4, textAlign: 'right' }}>{description.length} / {DESCRIPTION_MAX}</div>
          </div>
          <div>
            <label htmlFor={`${id}-about`} style={labelStyle}>Who is it about <span style={{ opacity: 0.6, textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
            <input id={`${id}-about`} value={aboutText} onChange={e => setAboutText(e.target.value)} maxLength={200} style={fieldStyle} autoComplete="off" placeholder="A name, if you want to give one" />
            <div className="mono xs muted" style={{ marginTop: 4 }}>If you name someone on the HR team, they will not be able to see this.</div>
          </div>
          <div>
            <label htmlFor={`${id}-date`} style={labelStyle}>When did it happen <span style={{ opacity: 0.6, textTransform: 'none', fontWeight: 400 }}>(optional)</span></label>
            <input id={`${id}-date`} type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} style={{ ...fieldStyle, maxWidth: 240 }} />
          </div>
          {error && <div role="alert" className="aq-field-error" style={{ fontFamily: 'var(--eina)', fontSize: 14 }}>{error}</div>}
          <div>
            <button type="submit" className="btn btn-primary" disabled={sending} style={{ minHeight: 48 }}>{sending ? 'Sending…' : 'Send it privately →'}</button>
          </div>
        </form>
      )}

      {mine && mine.length > 0 && (
        <section aria-labelledby={`${id}-mine`} style={{ marginTop: 40 }}>
          <h2 id={`${id}-mine`} className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 10 }}>what you have sent</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {mine.map(g => (
              <li key={g.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 'var(--r-inner)', border: 'var(--hair)' }}>
                <span style={{ fontFamily: 'var(--eina)', fontSize: 14.5 }}>{CATEGORY_LABEL[g.category]} <span className="muted">· {fmt(g.createdAt)}</span></span>
                <span className="mono xs upper" style={{ fontWeight: 800 }}>{STATUS_LABEL[g.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
