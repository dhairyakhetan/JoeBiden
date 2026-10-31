// @ts-nocheck
import { useEffect, useId, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fadeUp, stagger, SPRING, SPRING_SOFT } from '../lib/motion'
import { useToast } from '../components/ui/Toast'

type Step = 'role' | 'days' | 'details' | 'success'

type Form = {
  name: string
  email: string
  phone: string
  school: string
  role_pref: string
  availability: string[]
  skills: string
}

type Errors = Partial<Record<'name' | 'email' | 'phone', string>>
type Touched = Partial<Record<'name' | 'email' | 'phone' | 'school', boolean>>

const EMAIL_RE = /^\S+@\S+\.\S+$/
const PHONE_RE = /^\+?[\d\s-]{7,}$/

const ROLES: { id: string; title: string; desc: string }[] = [
  { id: 'setup', title: 'setup crew.', desc: 'Build stalls, drag furniture, hang banners. The morning shift.' },
  { id: 'registration', title: 'registration desk.', desc: 'First face people see. IDs, bibs, smiles.' },
  { id: 'stalls', title: 'stalls & food.', desc: 'Run a corner. Pour chai, sell merch, keep things moving.' },
  { id: 'support', title: 'general support.', desc: 'Float between events. Wherever the fire is.' },
  { id: 'event_specific', title: 'event-specific.', desc: 'Embed with one event. Judging, scoring, anchor crew.' },
]

const DAYS = ['Jun 1', 'Jun 2', 'Jun 3', 'Jun 4', 'Jun 5', 'Jun 6']

const STEP_LABELS: Record<Exclude<Step, 'success'>, string> = {
  role: '01 role',
  days: '02 days',
  details: '03 details',
}

function validate(f: Form): Errors {
  const e: Errors = {}
  if (!f.name.trim()) e.name = 'required'
  if (!f.email.trim()) e.email = 'required'
  else if (!EMAIL_RE.test(f.email)) e.email = 'invalid email'
  if (!f.phone.trim()) e.phone = 'required'
  else if (!PHONE_RE.test(f.phone)) e.phone = 'invalid phone'
  return e
}

// Spinner SVG for loading states
function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function Field({
  label, type = 'text', placeholder, value, error, touched, onChange, onBlur,
}: {
  label: string
  type?: string
  placeholder?: string
  value: string
  error?: string
  touched?: boolean
  onChange: (v: string) => void
  onBlur: () => void
}) {
  const showErr = !!(touched && error)
  // Was an unattached sibling label — one id here labels every field that uses
  // this wrapper.
  const id = useId()
  const msgId = `${id}-msg`
  return (
    <div className="mb-3.5">
      <div className="flex justify-between items-baseline mb-1.5">
        <label htmlFor={id} className="font-mono text-[13px] tracking-[0.14em] uppercase opacity-70">{label}</label>
        <AnimatePresence initial={false}>
          {showErr && (
            <motion.span
              key="err"
              id={msgId}
              role="alert"
              initial={{ x: -8, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -8, opacity: 0 }}
              transition={SPRING}
              className="font-mono text-[11px] text-c1"
            >
              ↘ {error}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {/* Accordion error */}
      <AnimatePresence initial={false}>
        {showErr && (
          <motion.div
            key="acc-err"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          />
        )}
      </AnimatePresence>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={showErr || undefined}
        aria-describedby={showErr ? msgId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full px-3.5 py-3.5 min-h-[48px] font-body text-[16px] text-ink bg-transparent border-[1.5px] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink/40 focus:ring-2 focus:ring-[var(--c1)] focus:outline-none ${
          showErr ? 'border-c1 shadow-[3px_3px_0_#FF4338]' : 'border-ink focus:shadow-[3px_3px_0_#181818]'
        }`}
      />
    </div>
  )
}

function Textarea({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  // Was a plain <div> caption, so the textarea had no accessible name at all.
  const id = useId()
  return (
    <div className="mb-3.5">
      <label htmlFor={id} className="block font-mono text-[13px] tracking-[0.14em] uppercase opacity-70 mb-1.5">{label}</label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-3.5 min-h-[120px] font-body text-[16px] text-ink bg-transparent border-[1.5px] border-ink outline-none focus:ring-2 focus:ring-[var(--c1)] focus:outline-none placeholder:text-ink/40 resize-none transition-[border-color,box-shadow]"
      />
    </div>
  )
}

export function VolunteerPage() {
  const { success, error: toastError } = useToast()
  const [step, setStep] = useState<Step>('role')
  const [form, setForm] = useState<Form>({
    name: '', email: '', phone: '', school: '',
    role_pref: '', availability: [], skills: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Touched>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setErrors(validate(form))
  }, [form])

  function update<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }
  function blur(k: keyof Touched) {
    setTouched((t) => ({ ...t, [k]: true }))
  }

  function toggleDay(d: string) {
    setForm((f) => ({
      ...f,
      availability: f.availability.includes(d)
        ? f.availability.filter((x) => x !== d)
        : [...f.availability, d],
    }))
  }

  async function submit() {
    const errs = validate(form)
    setErrors(errs)
    setTouched({ name: true, email: true, phone: true, school: true })
    if (Object.keys(errs).length > 0) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('paradox_volunteers').insert({
        name: form.name,
        email: form.email,
        phone: form.phone,
        school: form.school || null,
        role_pref: form.role_pref,
        availability: form.availability,
        skills: form.skills || null,
      })
      if (error) {
        console.error(error)
        toastError('Submission failed', 'Please try again or email us directly')
        setSubmitting(false)
        return
      }
      success('Application received!', "We'll reach out before Jun 1")
      setStep('success')
    } finally {
      setSubmitting(false)
    }
  }

  const stepIdx = step === 'role' ? 0 : step === 'days' ? 1 : step === 'details' ? 2 : 2
  const segDone = (i: number) => i < stepIdx || step === 'success'
  const segActive = (i: number) => i === stepIdx && step !== 'success'

  // Step counter label for the progress bar
  const stepCounterLabel = step !== 'success'
    ? `${stepIdx + 1} / 3`
    : null

  return (
    <div className="min-h-[100dvh] bg-bg text-ink">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="bg-ink text-bg px-4 sm:px-8 py-10 sm:py-14"
      >
        <div className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-55">/volunteer</div>
        <h1
          className="font-display font-semibold leading-[0.92] tracking-tight mt-1 text-bg"
          style={{ fontSize: 'clamp(38px, 9vw, 64px)', textWrap: 'balance' } as React.CSSProperties}
        >
          run the <span className="text-c1">show.</span>
        </h1>
        <p
          className="font-body text-[15px] opacity-70 max-w-sm mt-3 leading-relaxed"
          style={{ textWrap: 'pretty' } as React.CSSProperties}
        >
          50+ volunteers keep Paradox running. Show up, work hard, leave with a crew of new friends.
        </p>
      </motion.div>

      {step !== 'success' && (
        <div className="bg-bg border-b-[1.5px] border-ink px-4 sm:px-8 py-3 flex gap-1.5 items-center">
          {[
            { i: 0, label: STEP_LABELS.role },
            { i: 1, label: STEP_LABELS.days },
            { i: 2, label: STEP_LABELS.details },
          ].map((s) => (
            <div
              key={s.i}
              className={`flex-1 px-2 py-2 font-mono text-[11px] tracking-[0.06em] uppercase text-center border-[1.5px] border-ink min-h-[44px] flex items-center justify-center transition-[background-color,color] duration-150 ${
                segDone(s.i) || segActive(s.i) ? 'bg-c2 text-ink' : 'bg-transparent text-ink/55'
              }`}
            >
              {s.label}
            </div>
          ))}
          {/* Step counter */}
          {stepCounterLabel && (
            <div className="font-mono text-[10px] tabular-nums opacity-50 pl-2 shrink-0">
              {stepCounterLabel}
            </div>
          )}
        </div>
      )}

      <div className="px-4 sm:px-8 py-7 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'role' && (
            <motion.div
              key="role"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={SPRING_SOFT}
            >
              <div className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-60 mb-3">[ pick a role ]</div>
              <motion.div
                variants={stagger(0.07)}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-3"
              >
                {ROLES.map((r) => {
                  const active = form.role_pref === r.id
                  return (
                    <motion.button
                      key={r.id}
                      variants={fadeUp}
                      transition={SPRING}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => update('role_pref', r.id)}
                      className={`text-left bg-bg border-[1.5px] border-ink rounded-2xl p-4 min-h-[48px] transition-[transform,box-shadow,background-color,color] duration-150 hover:scale-[1.02] ${
                        active ? 'bg-ink text-bg shadow-[4px_4px_0_#FF4338]' : 'shadow-[3px_3px_0_#181818]'
                      }`}
                    >
                      <div
                        className="font-display font-semibold text-[22px] leading-tight tracking-tight"
                        style={{ textWrap: 'balance' } as React.CSSProperties}
                      >
                        {r.title}
                      </div>
                      <div
                        className={`font-body text-[13px] mt-1 leading-relaxed ${active ? 'opacity-80' : 'opacity-75'}`}
                        style={{ textWrap: 'pretty' } as React.CSSProperties}
                      >
                        {r.desc}
                      </div>
                    </motion.button>
                  )
                })}
              </motion.div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                disabled={!form.role_pref}
                onClick={() => setStep('days')}
                className="mt-5 w-full min-h-[52px] bg-c1 text-white border-[2px] border-ink shadow-[4px_4px_0_#181818] p-4 font-body font-bold text-base disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-[transform,box-shadow,opacity]"
              >
                continue →
              </motion.button>
            </motion.div>
          )}

          {step === 'days' && (
            <motion.div
              key="days"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={SPRING_SOFT}
            >
              <div className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-60 mb-3">[ pick days ]</div>
              <motion.div
                variants={stagger(0.07)}
                initial="hidden"
                animate="show"
                className="grid grid-cols-4 sm:grid-cols-7 gap-2"
              >
                {DAYS.map((d) => {
                  const active = form.availability.includes(d)
                  return (
                    <motion.button
                      key={d}
                      variants={fadeUp}
                      transition={SPRING}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => toggleDay(d)}
                      className={`border-[1.5px] border-ink p-2 sm:p-3.5 min-h-[48px] font-display font-semibold text-[15px] sm:text-[18px] leading-none tracking-tight text-center tabular-nums transition-[background-color,color] duration-150 ${
                        active ? 'bg-c2 text-ink' : 'bg-bg text-ink'
                      }`}
                    >
                      {d}
                    </motion.button>
                  )
                })}
              </motion.div>
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-55 mt-3">
                <span className="tabular-nums">{form.availability.length}</span> day{form.availability.length === 1 ? '' : 's'} selected
              </div>
              <div className="flex gap-2 mt-5">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setStep('role')}
                  className="px-4 py-3 min-h-[48px] font-mono text-[11px] tracking-[0.1em] uppercase border-[1.5px] border-ink transition-[background-color,color]"
                >
                  ← back
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  disabled={form.availability.length === 0}
                  onClick={() => setStep('details')}
                  className="flex-1 min-h-[52px] bg-c1 text-white border-[2px] border-ink shadow-[4px_4px_0_#181818] p-4 font-body font-bold text-base disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed transition-[transform,box-shadow,opacity]"
                >
                  continue →
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={SPRING_SOFT}
            >
              <div className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-60 mb-3">[ your details ]</div>
              <div className="max-w-md">
                <motion.div
                  variants={stagger(0.06)}
                  initial="hidden"
                  animate="show"
                >
                  <motion.div key="name" variants={fadeUp} transition={{ ...SPRING, delay: 0 }}>
                    <Field
                      label="Name"
                      placeholder="your name"
                      value={form.name}
                      error={errors.name}
                      touched={touched.name}
                      onChange={(v) => update('name', v)}
                      onBlur={() => blur('name')}
                    />
                  </motion.div>
                  <motion.div key="email" variants={fadeUp} transition={{ ...SPRING, delay: 0.06 }}>
                    <Field
                      label="Email"
                      type="email"
                      placeholder="you@school.edu"
                      value={form.email}
                      error={errors.email}
                      touched={touched.email}
                      onChange={(v) => update('email', v)}
                      onBlur={() => blur('email')}
                    />
                  </motion.div>
                  <motion.div key="phone" variants={fadeUp} transition={{ ...SPRING, delay: 0.12 }}>
                    <Field
                      label="Phone"
                      placeholder="+91 …"
                      value={form.phone}
                      error={errors.phone}
                      touched={touched.phone}
                      onChange={(v) => update('phone', v)}
                      onBlur={() => blur('phone')}
                    />
                  </motion.div>
                  <motion.div key="school" variants={fadeUp} transition={{ ...SPRING, delay: 0.18 }}>
                    <Field
                      label="School / college"
                      placeholder="optional"
                      value={form.school}
                      onChange={(v) => update('school', v)}
                      onBlur={() => blur('school')}
                    />
                  </motion.div>
                  <motion.div key="skills" variants={fadeUp} transition={{ ...SPRING, delay: 0.24 }}>
                    <Textarea
                      label="Skills / notes (optional)"
                      placeholder="anything we should know — design, anchoring, first aid…"
                      value={form.skills}
                      onChange={(v) => update('skills', v)}
                    />
                  </motion.div>
                </motion.div>

                <div className="flex gap-2 mt-2">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setStep('days')}
                    className="px-4 py-3 min-h-[48px] font-mono text-[11px] tracking-[0.1em] uppercase border-[1.5px] border-ink transition-[background-color,color]"
                  >
                    ← back
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    disabled={submitting}
                    onClick={submit}
                    className="flex-1 min-h-[52px] bg-c1 text-white border-[2px] border-ink shadow-[4px_4px_0_#181818] p-4 font-body font-bold text-base disabled:opacity-60 disabled:cursor-not-allowed transition-[transform,box-shadow,opacity] flex items-center justify-center gap-2"
                  >
                    {submitting && <Spinner />}
                    {submitting ? 'sending…' : 'sign me up →'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={SPRING}
              className="max-w-md mx-auto py-8"
            >
              <motion.div
                initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
                animate={{ scale: [0.4, 1.15, 1], opacity: 1, rotate: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="w-20 h-20 bg-c2 border-2 border-ink shadow-[4px_4px_0_#181818] flex items-center justify-center mb-5"
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12 L10 18 L20 6" stroke="#181818" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
                </svg>
              </motion.div>
              <div className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-55">/in</div>
              <h2
                className="font-display font-semibold text-[40px] leading-[0.95] tracking-tight mt-1"
                style={{ textWrap: 'balance' } as React.CSSProperties}
              >
                welcome to the <span className="text-c1">crew.</span>
              </h2>
              <p
                className="font-body text-[15px] opacity-80 mt-4 leading-relaxed"
                style={{ textWrap: 'pretty' } as React.CSSProperties}
              >
                We'll send a WhatsApp invite to <strong>{form.phone}</strong> with the briefing and shift details.
                Read it. Show up. We'll handle the rest.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
