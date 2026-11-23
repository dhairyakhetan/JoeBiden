import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMeta } from '../hooks/useMeta'
import { useToast } from '../components/Toast'
import { SuccessCheck } from '../components/SuccessCheck'
import certificateService, { type CertificateRequest } from '../services/certificateService'
import {
  buildTeamTree, certificateErrorMessage, certificateLink, formatHours, isValid, parseHours, validateApplication, LIMITS,
  type ApplicationErrors, type CertTypeInfo, type OrgSubTeam, type OrgTeam, type TeamTag,
} from './certificateLogic'
import { DocTypePicker, HodPicker, MonthPicker, TeamPicker, thisMonth, type HodOption } from './pickers'
import './certificates.css'

/**
 * `/certificates`: any signed-in, active member asks for a certificate or letter here.
 *
 * They pick the documents (with a sample of each), the teams and sub-teams they were part of, the HoDs who have seen their work,
 * the minimum hours they worked, and optionally a few rough notes. HR then approves; the text is drafted in between. See
 * scripts/certificate_pipeline_2026_11_20.sql for the rules the database enforces behind this form.
 */

const STATUS_WORD: Record<CertificateRequest['status'], string> = { pending: 'in review', issued: 'ready', declined: 'not issued' }

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' }
}

type OwnRow = CertificateRequest & { typeLabel: string }

export default function CertificatesPage() {
  useMeta({ title: 'Certificates | AquaTerra', description: 'Ask for a certificate or a letter from AquaTerra.', image: '', path: '/certificates', noIndex: true })
  const { member } = useAuth()
  const memberId = (member as any)?.member_id as number | undefined
  const toast = useToast()
  const id = useId()

  const [types, setTypes] = useState<CertTypeInfo[]>([])
  const [org, setOrg] = useState<{ teams: OrgTeam[]; subTeams: OrgSubTeam[] }>({ teams: [], subTeams: [] })
  const [hods, setHods] = useState<HodOption[]>([])
  const [mine, setMine] = useState<OwnRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [docTypes, setDocTypes] = useState<string[]>([])
  const [teams, setTeams] = useState<TeamTag[]>([])
  const [hodIds, setHodIds] = useState<number[]>([])
  const [hoursRaw, setHoursRaw] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [highlights, setHighlights] = useState('')
  const [errors, setErrors] = useState<ApplicationErrors>({})
  const [sending, setSending] = useState(false)
  const [sentCount, setSentCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      const [t, o, h] = await Promise.all([certificateService.listTypes(), certificateService.listOrg(), certificateService.hodOptions()])
      setTypes(t); setOrg(o); setHods(h)
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load the form.')
    } finally {
      setLoading(false)
    }
  }, [])
  const loadMine = useCallback(() => {
    if (memberId == null) return
    certificateService.getOwnRequests(memberId).then(r => setMine(r.data)).catch(() => setMine([]))
  }, [memberId])
  useEffect(() => { void load() }, [load])
  useEffect(() => { loadMine() }, [loadMine])

  const tree = useMemo(() => buildTeamTree(org.teams, org.subTeams), [org])
  const waiting = useMemo(() => new Set(mine.filter(r => r.status === 'pending').map(r => r.docType)), [mine])
  const chosen = docTypes.filter(k => !waiting.has(k))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const input = { docTypes: chosen, hodIds, teams, minHours: parseHours(hoursRaw), periodStart, periodEnd, highlights }
    const found = validateApplication(input, types)
    if (hoursRaw.trim() && input.minHours == null && !found.hours) found.hours = 'use digits only, like 40 or 12.5.'
    setErrors(found)
    if (!isValid(found)) {
      toast.error('one more thing before this can go.', Object.values(found)[0])
      return
    }
    setSending(true)
    try {
      const result = await certificateService.submit(input)
      setSentCount(result.data.length)
      setDocTypes([]); setTeams([]); setHodIds([]); setHoursRaw(''); setPeriodStart(''); setPeriodEnd(''); setHighlights(''); setErrors({})
      loadMine()
      toast.success('request sent', 'The HoDs you tagged have been told.')
    } catch (err: any) {
      const msg = certificateErrorMessage(err)
      setErrors({})
      toast.error('could not send that.', msg)
    } finally {
      setSending(false)
    }
  }

  const label = { fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' } as const
  const req = <span aria-hidden style={{ color: 'var(--accent-ink)' }}> *</span>

  return (
    <div className="route-enter cert-page">
      <h1 className="h-display" style={{ fontSize: 'clamp(30px, 6vw, 48px)', margin: 0 }}>certificates.</h1>
      <p className="cert-lede">
        Ask for a certificate or a letter from AquaTerra. You tag the HoDs who have seen your work, they say whether they can vouch for you,
        and the HR team approves. Your document is written in between, so it can take a few days.
      </p>
      <p className="cert-lede-small">
        Only you, the HoDs you tag and the HR team can see a request. You will see only whether it is in review, ready or not issued.
      </p>

      {mine.length > 0 && (
        <section className="cert-section" aria-labelledby={`${id}-mine`}>
          <h2 id={`${id}-mine`}>your requests</h2>
          <ul className="cert-requests">
            {mine.map(r => (
              <li key={r.id} className="cert-req">
                <span>
                  <span className="cert-req-title">{r.typeLabel}</span>
                  <span className="cert-req-meta" style={{ display: 'block' }}>
                    asked {fmt(r.requestedAt)}{r.claimedMinHours != null && ` · at least ${formatHours(r.claimedMinHours)} h`}
                    {r.status === 'declined' && r.decisionNote && ` · ${r.decisionNote}`}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {r.status === 'issued' && <Link className="btn btn-sm" to={certificateLink(r.id)}>open and download</Link>}
                  <span className="cert-status" data-s={r.status}>{STATUS_WORD[r.status]}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sentCount > 0 && (
        <div role="status" className="cert-done">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><SuccessCheck color="var(--ink)" /></div>
          <div className="h-display" style={{ fontSize: 26, marginBottom: 8 }}>{sentCount === 1 ? 'we have it.' : 'we have them.'}</div>
          <p>The HoDs you tagged will be asked whether they can vouch for you, then HR approves. You can follow it in your requests above.</p>
          <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setSentCount(0)}>ask for something else</button>
        </div>
      )}

      {loading ? (
        <p className="cert-lede" style={{ marginTop: 32 }}>loading the form…</p>
      ) : loadError ? (
        <div role="alert" className="cert-error" style={{ marginTop: 32 }}>
          {loadError} <button type="button" className="cert-link-btn" onClick={() => void load()}>try again</button>
        </div>
      ) : sentCount === 0 && (
        <form onSubmit={submit} noValidate>
          <section className="cert-section">
            <h2>1. what do you need{req}</h2>
            <p className="cert-hint">Pick one or more. Open a sample to see how each one looks.</p>
            <DocTypePicker types={types} value={docTypes} onChange={setDocTypes} alreadyPending={waiting} />
            {errors.docTypes && <div role="alert" className="aq-field-error cert-error">{errors.docTypes}</div>}
          </section>

          <section className="cert-section">
            <h2>2. which teams were you part of{req}</h2>
            <p className="cert-hint">Tick a team, or a sub-team inside it, like LinkedIn Team inside Social Media. Pick as many as apply, past teams included.</p>
            <TeamPicker tree={tree} teams={org.teams} subTeams={org.subTeams} value={teams} onChange={setTeams} />
            {errors.teams && <div role="alert" className="aq-field-error cert-error">{errors.teams}</div>}
          </section>

          <section className="cert-section">
            <h2>3. which HoDs have seen your work</h2>
            <p className="cert-hint">
              Tag every HoD who can vouch for you. Letters of recommendation and recognition need at least one. Only HoDs and Directors appear here.
            </p>
            <HodPicker options={hods} value={hodIds} onChange={setHodIds} />
            {errors.hods && <div role="alert" className="aq-field-error cert-error">{errors.hods}</div>}
          </section>

          <section className="cert-section">
            <h2><label htmlFor={`${id}-hours`}>4. minimum hours you worked{req}</label></h2>
            <p className="cert-hint">The least you worked, not your best guess. HoDs and HR will see this number next to what they know of your work.</p>
            <input id={`${id}-hours`} className="cert-field cert-hours" inputMode="decimal" value={hoursRaw} onChange={e => setHoursRaw(e.target.value)}
              placeholder="e.g. 40" autoComplete="off" aria-invalid={!!errors.hours} aria-describedby={errors.hours ? `${id}-hours-err` : undefined} />
            {errors.hours && <div id={`${id}-hours-err`} role="alert" className="aq-field-error cert-error">{errors.hours}</div>}
          </section>

          <section className="cert-section">
            <h2>5. when were you with us{req}</h2>
            <p className="cert-hint">The month you started and the month you finished. Still with us? Use this month. It is printed on your document, so give it the way you would want it read.</p>
            <div style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
              <MonthPicker label="from" value={periodStart} onChange={setPeriodStart} error={!!errors.period} />
              <MonthPicker label="to" value={periodEnd} onChange={setPeriodEnd} error={!!errors.period} />
              <button type="button" className="cert-link-btn" style={{ justifySelf: 'start' }} onClick={() => setPeriodEnd(thisMonth())}>still with us: use this month</button>
            </div>
            {errors.period && <div role="alert" className="aq-field-error cert-error">{errors.period}</div>}
          </section>

          <section className="cert-section">
            <h2><label htmlFor={`${id}-notes`}>6. anything you want mentioned <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(optional)</span></label></h2>
            <p className="cert-hint">Qualities, moments, things you led. Used for letters. Rough is fine, you do not have to write it properly. Leave it empty and we will write a general one from your teams and hours. Certificates have fixed wording.</p>
            <textarea id={`${id}-notes`} className="cert-field" rows={5} style={{ minHeight: 120, resize: 'vertical' }} maxLength={LIMITS.maxHighlights}
              value={highlights} onChange={e => setHighlights(e.target.value)} placeholder="e.g. led the reels team through Paradox, good at explaining things to new volunteers" />
            <div className="cert-count">{highlights.length} / {LIMITS.maxHighlights}</div>
            {errors.highlights && <div role="alert" className="aq-field-error cert-error">{errors.highlights}</div>}
          </section>

          <div style={{ marginTop: 32 }}>
            <button type="submit" className="btn btn-primary" disabled={sending} style={{ minHeight: 48 }}>
              {sending ? 'Sending…' : 'Send my request →'}
            </button>
            <p className="cert-hint" style={{ marginTop: 12, ...label, textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--eina)', fontWeight: 400, fontSize: 13 }}>
              Please do not ask on WhatsApp as well. This page reaches the right people.
            </p>
          </div>
        </form>
      )}
    </div>
  )
}
