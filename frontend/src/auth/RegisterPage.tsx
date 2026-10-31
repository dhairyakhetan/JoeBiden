import { Mascot } from '../components/Mascot'
import Img from '../components/Img'
import { CLASS_OPTIONS } from '../lib/classOptions'
import './RegisterPage.css'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { I } from '../components/v6Shared'
import { useAuth } from './AuthContext'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import AuthFeaturePanel from '../components/AuthFeaturePanel'
import AuthShell, { AuthFullScreenSpinner } from '../components/AuthShell'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { trackProfileStarted, trackProfileCompleted } from '../lib/funnel'
import { APPROVAL_TIME } from '../lib/orgFacts'
import { normalizePhone, isPlausiblePhone, isRegistrationComplete } from '../lib/profileNudge'
import SignInReceipt from '../components/SignInReceipt'
import { hasPrintedReceipt } from '../lib/receiptRecord'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { isDirty } from '../lib/unsavedChanges'

// Moved to lib/classOptions.ts so /profile/edit writes from the SAME list.

const RegisterPage = () => {
  useMeta(pageMetadata.register)
  const navigate = useNavigate()
  const { member, refreshMember, isLoading: authLoading, isAuthenticated } = useAuth()

  const [step, setStep] = useState(1)
  // One question per screen (design ref: progress bar + a single big
  // question, not all fields on one form) - qIndex walks name -> class ->
  // phone within step 1. Email isn't its own question since it's read-only,
  // pulled from Google OAuth - nothing to ask.
  const [qIndex, setQIndex] = useState(0)
  const QUESTIONS = ['fullName', 'classGrade', 'phone'] as const
  const [formData, setFormData] = useState({
    fullName: member?.full_name || '',
    classGrade: member?.class_grade || '',
    phone: member?.phone || '',
    joinReason: member?.join_reason || '',
  })
  const [isLoading, setIsLoading] = useState(false)
  // `error` is now ONLY the submit/server failure routed to AuthShell's
  // banner. Field-level problems ("your name is required.") no longer come
  // here - see `fieldErrors` below.
  const [error, setError] = useState<string | null>(null)

  // changelog/11-system-states.md §11.10 / ACCEPTANCE.md §B. This screen is
  // the mandatory profile step for every new member and it is the only place
  // full_name / class_grade / phone are ever written, and until now it had no
  // field-level validation at all: one form-level string went to the banner
  // at the top of the shell, with no `aria-invalid`, no `aria-describedby`,
  // no per-field `role="alert"` and no focus move. §11.10 says to copy the
  // `fieldErrors` shape rather than invent one - this is the same shape
  // public/ContactPage.tsx uses, including its rule that typing only ever
  // CLEARS an error that blur or submit already set.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<typeof QUESTIONS[number], string>>>({})

  // Section 12. The receipt prints ONCE, on the first authenticated render
  // after the member row is filled in, which is this page's step 3.
  //
  // [DEV] The mounting guide reads the print-once flag in a `useState` lazy
  // initialiser. It cannot be read at mount HERE: this component renders a
  // spinner while `member` is still resolving, so an initialiser would see
  // `member === null` on the first render and latch `false` forever, silently
  // skipping the receipt for anyone whose auth was not already warm in cache.
  // It is resolved once instead, at the single moment step 3 is entered, which
  // is where `member` is guaranteed - and that satisfies the guide's actual
  // requirement (read the flag once, never on every render, or the receipt
  // unmounts itself mid-print the instant it writes its own flag).
  const [showReceipt, setShowReceipt] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [authLoading, isAuthenticated, navigate])

  // Fires once per genuinely-new account reaching the profile step. Gated on
  // "authenticated but no class_grade yet" so a returning member bouncing
  // through /register doesn't inflate the top of the funnel.
  const [profileStartTracked, setProfileStartTracked] = useState(false)
  useEffect(() => {
    if (authLoading || !isAuthenticated || profileStartTracked) return
    if (member && !member.class_grade) {
      trackProfileStarted()
      setProfileStartTracked(true)
    }
  }, [authLoading, isAuthenticated, member, profileStartTracked])

  // Deliberately keyed on PRIMITIVES (status/class_grade/phone), not the
  // `member` object itself. `member` gets a new reference on every
  // AuthContext update even when nothing meaningful changed (e.g. a burst of
  // onAuthStateChange events right after the OAuth callback, which is
  // exactly when a fresh registrant lands here) - an object in this effect's
  // deps re-fires on every one of those, calling navigate(..., {replace:
  // true}) each time. That's a real, reproduced bug: client_error_logs
  // recorded "Attempt to use history.replaceState() more than 100 times per
  // 10 seconds" on this exact page. The sibling bug on /choose-team (same
  // shape, same root cause) was already fixed 2026-09-14 by removing that
  // page's auto-redirect entirely (see FirstRunController.tsx) - this is the
  // same fix's spirit applied here, since /register still needs its redirect.
  const registrationComplete = member ? isRegistrationComplete(member) : false
  const memberStatus = member?.status
  useEffect(() => {
    if (registrationComplete) {
      if (memberStatus === 'active') {
        navigate('/', { replace: true })
      } else if (memberStatus === 'pending_approval') {
        navigate('/pending', { replace: true })
      } else if (memberStatus === 'rejected' || memberStatus === 'suspended' || memberStatus === 'deleted') {
        navigate('/rejected', { replace: true })
      }
    } else if (memberStatus === 'suspended' || memberStatus === 'deleted') {
      // Suspended/deleted members must never sit on /register - even
      // without a completed profile there is nothing for them to fill in here.
      navigate('/rejected', { replace: true })
    }
  }, [registrationComplete, memberStatus, navigate])

  // changelog/11-system-states.md §11.9 state 10. This is the mandatory
  // profile step for every new member, and its one in-app exit — `back` on the
  // first question — goes straight to `/` and drops whatever was typed. The
  // snapshot is taken at mount (the same values `formData` is seeded with), so
  // a member who reaches question three and hits back is dirty; one who never
  // typed is not, and closes in a single tap exactly as before.
  //
  // MUST stay above the spinner early-return below: hooks cannot be
  // conditional, and that return fires on the first render for anyone whose
  // auth is not already warm.
  const initialFormRef = useRef(formData)
  const { confirmDiscard } = useUnsavedChanges({
    dirty: isDirty(formData, initialFormRef.current),
    submitting: isLoading,
    submitted: step === 3,
    body: "your answers here aren't saved yet. leaving starts this over.",
  })

  if (authLoading || !member) {
    return <AuthFullScreenSpinner />
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const key = e.target.name as typeof QUESTIONS[number]
    setFormData(prev => ({ ...prev, [key]: e.target.value }))
    // ContactPage.set()'s rule, verbatim in intent: clear a field's error the
    // moment it is edited. This is NOT the keystroke validation §11.10
    // forbids - it only ever REMOVES a message blur or submit already put
    // there, and can never add one while someone is typing.
    setFieldErrors(fe => (fe[key] ? { ...fe, [key]: undefined } : fe))
  }

  // The three messages are the app's existing strings, moved from the
  // form-level banner to the field they are about. Not reworded.
  const QUESTION_LABEL: Record<typeof QUESTIONS[number], string> = {
    fullName: 'your name is required.',
    classGrade: 'pick your class or year.',
    phone: 'add a phone number to continue.',
  }

  // One rule per field, shared by blur and submit so the two can never
  // disagree about what "valid" means (ContactPage.validateField's shape).
  // Phone gets a second check beyond non-empty: isPlausiblePhone is the same
  // gate ContactNumberFields/ProfileNudgeCard use post-signup, so a member
  // can't satisfy this step with a single stray digit and end up with an
  // unreachable number on file.
  const validateField = (key: typeof QUESTIONS[number], value: string): string | undefined => {
    if (!value.trim()) return QUESTION_LABEL[key]
    if (key === 'phone' && !isPlausiblePhone(value)) return 'that does not look like a phone number yet.'
    return undefined
  }

  // §11.10: "validate on blur and on submit. Never on keystroke."
  const handleBlur = (key: typeof QUESTIONS[number]) => {
    setFieldErrors(fe => ({ ...fe, [key]: validateField(key, formData[key]) }))
  }

  // The DOM node focus should land on when a field fails. The class step is a
  // `role="radiogroup"` of buttons rather than a single control, so its focus
  // target is its first radio - focusing the group wrapper would move focus
  // somewhere a keyboard user cannot act from.
  const focusField = (key: typeof QUESTIONS[number]) => {
    if (key === 'classGrade') {
      document.querySelector<HTMLButtonElement>('#reg-class-group .reg-chip')?.focus()
      return
    }
    document.getElementById(key === 'fullName' ? 'reg-name' : 'reg-phone')?.focus()
  }

  const handleContinue = () => {
    const field = QUESTIONS[qIndex]
    const msg = validateField(field, formData[field])
    if (msg) {
      // §11.10: "on submit, focus the first invalid field. Do not just show
      // messages." One question per screen, so the current field IS the first
      // invalid one.
      setFieldErrors(fe => ({ ...fe, [field]: msg }))
      focusField(field)
      return
    }
    setFieldErrors(fe => ({ ...fe, [field]: undefined }))
    setError(null)
    if (qIndex < QUESTIONS.length - 1) {
      setQIndex(i => i + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = async () => {
    // Stepping back a question keeps everything typed, so it is never guarded.
    // Leaving the flow entirely is the exit that loses it (§11.9 state 10).
    if (qIndex > 0) { setError(null); setFieldErrors({}); setQIndex(i => i - 1); return }
    if (!(await confirmDiscard())) return
    navigate('/')
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { error: updateError } = await supabaseCommunity
        .from('members')
        .update({
          full_name: formData.fullName,
          class_grade: formData.classGrade,
          phone: normalizePhone(formData.phone),
        })
        .eq('member_id', member.member_id)

      if (updateError) throw updateError

      trackProfileCompleted()
      await refreshMember()
      // Resolved here, once. `member.uuid` is the key the flag is written
      // under - never a member id and never an email (a shared browser has to
      // be able to tell two members apart, and neither of those is what
      // `markReceiptPrinted` stores).
      setShowReceipt(!!member.uuid && !hasPrintedReceipt(member.uuid))
      setStep(3)
    } catch (err: any) {
      // §11.4: "never render a raw error, a stack, or a Postgres message.
      // Log it; show a sentence." This used to put `err.message` straight on
      // screen, which on an RLS failure is a policy name. The existing
      // fallback string is now the only thing shown - no new copy.
      console.error('Registration update error:', err)
      setError('Failed to submit registration')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      rootClassName="reg-root"
      left={<AuthFeaturePanel mode="register" />}
      mobileExtra={
        <div className="reg-mobile-logo" style={{ display: 'none', marginBottom: 28 }}>
          <Img src="/logo.png" alt="AquaTerra" className="no-outline" style={{ height: 32, width: 'auto', mixBlendMode: 'multiply' }} />
        </div>
      }
      header={
        <>
          {/* Step 22: back button, bar and counter in one row. `handleBack` is
              unchanged, including its navigate-home branch at qIndex === 0. */}
          <div className="reg-head-row">
            <button className="btn btn-sm" onClick={() => void handleBack()}><I.back /> back</button>
            {step === 1 && (
              <>
                <div className="reg-progress">
                  <div className="reg-progress-fill" style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%` }} />
                </div>
                <span className="reg-count">{String(qIndex + 1).padStart(2, '0')}/{String(QUESTIONS.length).padStart(2, '0')}</span>
              </>
            )}
          </div>
          {step === 3 && <span className="sticker wobble sticker--diecut" style={{ marginBottom: 12, display: 'inline-flex', background: 'var(--welfare)', color: '#0A0A0A', ['--sticker-ground' as string]: 'var(--bg)' }}>★ submitted</span>}
          {/* Step 24. Every <br /> and every welfare-coloured `?` is kept. */}
          <h1 className="h-display reg-h1">
            {step === 1 && QUESTIONS[qIndex] === 'fullName' && <>what's your<br />name<span style={{ color: 'var(--welfare-ink)' }}>?</span></>}
            {step === 1 && QUESTIONS[qIndex] === 'classGrade' && <>which class<br />are you in<span style={{ color: 'var(--welfare-ink)' }}>?</span></>}
            {step === 1 && QUESTIONS[qIndex] === 'phone' && <>what's your<br />phone number<span style={{ color: 'var(--welfare-ink)' }}>?</span></>}
            {step === 3 && <>you're<br /><span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--welfare-ink)' }}>in the queue</span>.</>}
          </h1>
        </>
      }
      error={error}
      // §11.4 / ACCEPTANCE.md §B: the banner now carries a retry, not a
      // dismiss ×. The only thing that can set `error` here is a failed
      // profile write, so the retry is that same write.
      onRetryError={handleSubmit}
    >
      <div className="card" style={{ padding: 32 }}>
        {step === 1 && (
          <div className="reg-note">
            {/* Step 25: `.reg-note-clip` deleted with its CSS. */}
            <span className="reg-note-sticker">
              {QUESTIONS[qIndex] === 'fullName' && '★'}
              {QUESTIONS[qIndex] === 'classGrade' && 'go you'}
              {QUESTIONS[qIndex] === 'phone' && 'last one'}
            </span>

            {QUESTIONS[qIndex] === 'fullName' && (
              <>
                <label htmlFor="reg-name" className="mono xs upper muted" style={{ fontWeight: 700 }}>your name</label>
                <input
                  id="reg-name"
                  className="input"
                  name="fullName"
                  placeholder="full name"
                  autoComplete="name"
                  autoFocus
                  value={formData.fullName}
                  onChange={handleChange}
                  onBlur={() => handleBlur('fullName')}
                  onKeyDown={e => { if (e.key === 'Enter') handleContinue() }}
                  aria-invalid={!!fieldErrors.fullName}
                  aria-describedby={fieldErrors.fullName ? 'reg-name-error' : undefined}
                  style={{ marginTop: 4 }}
                />
                {fieldErrors.fullName && <span id="reg-name-error" role="alert" className="field-error">{fieldErrors.fullName}</span>}
                <p className="mono xs muted" style={{ marginTop: 10, marginBottom: 0 }}>
                  signed in as {member?.email}. that part's locked to your google account.
                </p>
              </>
            )}

            {QUESTIONS[qIndex] === 'classGrade' && (
              <>
                {/* Step 27: the <select> becomes a chip group. Each chip writes
                    the IDENTICAL string the <option> carried into
                    formData.classGrade, so handleSubmit and the class_grade
                    column are unaffected. The label is kept and now names the
                    group via aria-labelledby, because a radiogroup takes its
                    name from a label it is pointed at, not from an adjacent
                    <label for>. */}
                <span id="reg-class-label" className="mono xs upper muted" style={{ fontWeight: 700 }}>school / class</span>
                <div
                  id="reg-class-group"
                  className="reg-chips"
                  role="radiogroup"
                  aria-labelledby="reg-class-label"
                  aria-invalid={!!fieldErrors.classGrade}
                  aria-describedby={fieldErrors.classGrade ? 'reg-class-error' : undefined}
                >
                  {CLASS_OPTIONS.map(c => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      className="reg-chip"
                      aria-checked={formData.classGrade === c}
                      onClick={() => {
                        setFormData(f => ({ ...f, classGrade: c }))
                        setFieldErrors(fe => (fe.classGrade ? { ...fe, classGrade: undefined } : fe))
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {fieldErrors.classGrade && <span id="reg-class-error" role="alert" className="field-error">{fieldErrors.classGrade}</span>}
              </>
            )}

            {QUESTIONS[qIndex] === 'phone' && (
              <>
                <label htmlFor="reg-phone" className="mono xs upper muted" style={{ fontWeight: 700 }}>phone</label>
                {/* Step 28. type, inputMode, autoComplete and required are all
                    unchanged. The +91 is PRESENTATION ONLY - it is not
                    prepended to the value here or anywhere else, so the column
                    keeps storing exactly what the member typed and there is no
                    second place that could normalise it differently. The
                    placeholder loses its own "+91" so the prefix is not shown
                    twice. */}
                <div className="reg-phone">
                  <span className="reg-phone-prefix" aria-hidden>+91</span>
                  <span className="reg-phone-div" aria-hidden />
                  <input
                    id="reg-phone"
                    className="input"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    autoFocus
                    placeholder="00000 00000"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    onBlur={() => handleBlur('phone')}
                    onKeyDown={e => { if (e.key === 'Enter') handleContinue() }}
                    aria-invalid={!!fieldErrors.phone}
                    aria-describedby={fieldErrors.phone ? 'reg-phone-error' : undefined}
                  />
                </div>
                {fieldErrors.phone && <span id="reg-phone-error" role="alert" className="field-error">{fieldErrors.phone}</span>}
              </>
            )}
          </div>
        )}

        {/* Section 12, mounted. The receipt IS this step's success state on a
            member's first pass: it carries the same three things the card
            below does (that the application landed, the approval promise via
            APPROVAL_SENTENCE, and the way on to /pending) and adds the record
            itself. The card below stays as the second-pass state, so the
            success state is never lost - a member who has already printed once
            gets the card, unchanged.

            `onDone` only navigates. The guide's snippet also flips the flag
            off, which here would repaint the card underneath for a frame
            before the route change commits. */}
        {step === 3 && showReceipt && (
          <div style={{ padding: '4px 0' }}>
            <SignInReceipt
              onDone={() => navigate('/pending')}
              primaryLabel="see what's happening →"
            />
          </div>
        )}

        {step === 3 && !showReceipt && (
          <div className="text-center" style={{ padding: '20px 0' }}>
            {/* Step 29: the CSS mascot at 64px. The star placeholder that stood
                here while section 09 did not exist is gone, and the layout does
                not move, because the placeholder was already sized to 64. The
                card is white, so khoka is not hue-on-hue. */}
            <Mascot character="khoka" pose="idle" size={64} />
            {/* Step 30 */}
            <div className="h-display" style={{ fontSize: 30, marginTop: 12 }}>application sent.</div>
            {/* Was "usually 24 hours, sometimes 48" — which the very next
                screen (/pending) contradicted with "within a week". Sourced
                from orgFacts now so the promise can't drift again. */}
            <p style={{ marginTop: 8, color: 'var(--ink-2)' }}>an HoD reads every application personally, usually {APPROVAL_TIME}. you'll get an in-app notification the moment you're approved. check back on this page anytime.</p>
            <button className="btn btn-lg btn-primary" style={{ marginTop: 24 }} onClick={() => navigate('/pending')}>got it →</button>
          </div>
        )}

        {step < 3 && (
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 28 }}>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleContinue}
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.55 : 1 }}
            >
              {isLoading ? 'submitting...' : qIndex < QUESTIONS.length - 1 ? 'continue →' : 'submit application →'}
            </button>
          </div>
        )}
      </div>
    </AuthShell>
  )
}

export default RegisterPage
