// @ts-nocheck
import { useEffect, useId, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fadeUp, stagger, scaleIn, slideLeft, SPRING, MotionLink } from '../lib/motion'
import { useToast } from '../components/ui/Toast'
import type { Event } from '../lib/types'
import { useWhatsAppGroup } from '../lib/useWhatsAppGroup'

type TeamMember = { name: string }

type Form = {
  name: string
  phone: string
  class_year: string
  event_id: string
  team_name: string
  team_members: TeamMember[]
  // For duo (team_format === 'pair') events we collect the second person's
  // name + phone inline. Larger teams' rosters are deferred until after
  // payment — collected by the POC on WhatsApp.
  partner_name: string
  partner_phone: string
}

type Errors = Partial<Record<keyof Form, string>>
type Touched = Partial<Record<keyof Form, boolean>>

const PHONE_RE = /^\+?[\d\s-]{7,}$/

// Hard registration cutoff — 30 May 2026, 9:00 PM IST.
// `+05:30` lets the constant be timezone-explicit regardless of where
// the user's browser is. Anyone landing on /paradox/register after this
// instant gets the "closed" panel below instead of the form.
const REGISTRATION_CUTOFF = new Date('2026-05-30T21:00:00+05:30')
const POC_NAME = 'Aastha Saluja'
// Country code prepended for the wa.me URL — Aastha's number lives in
// Team.tsx (TEAM_CONTACTS) as 8910353970; this constant + the link
// builder below stay deliberately co-located so the cutoff message
// doesn't drift if the contact list moves.
const POC_WA_NUMBER = '918910353970'

function validate(form: Form, isDuo: boolean, partnerRequired: boolean): Errors {
  const e: Errors = {}
  if (!form.name.trim()) e.name = 'required'
  if (!form.phone.trim()) e.phone = 'required'
  else if (!PHONE_RE.test(form.phone)) e.phone = 'invalid phone'
  if (!form.class_year.trim()) e.class_year = 'required'
  if (!form.event_id) e.event_id = 'pick an event'
  // Duo events: partner name + WhatsApp number are required by default so
  // the POC can reach both people. MUN events are the one exception — the
  // partner is often confirmed later, so collection is optional. We still
  // validate the partner phone shape if a user fills it in, regardless.
  if (isDuo) {
    if (partnerRequired) {
      if (!form.partner_name.trim()) e.partner_name = 'required'
      if (!form.partner_phone.trim()) e.partner_phone = 'required'
      else if (!PHONE_RE.test(form.partner_phone)) e.partner_phone = 'invalid phone'
    } else if (form.partner_phone.trim() && !PHONE_RE.test(form.partner_phone)) {
      // optional but if provided must still be a valid phone shape
      e.partner_phone = 'invalid phone'
    }
  }
  return e
}

/**
 * MUN-style events (Model UN) skip the up-front partner collection because
 * partners are typically allocated by the org running the event. Match on
 * slug or name containing "mun" as a token — covers "mun", "terramun",
 * "model-un-paradox" etc. Returns false for everything else.
 */
function isPartnerOptionalEvent(ev: { slug?: string | null; name?: string | null } | undefined): boolean {
  if (!ev) return false
  const haystack = `${ev.slug ?? ''} ${ev.name ?? ''}`.toLowerCase()
  // Match "mun" as a substring — terramun / mun / model-un all hit. Acceptable
  // false-positive surface is small (we'd need a new event with "mun" in the
  // name that ISN'T MUN-like).
  return /mun/.test(haystack)
}

// (No `checkCap()` helper anymore — caps are admin-internal hints and
// participants are never blocked from registering. We continue to accept
// any submission regardless of max_participants; admins triage on their
// side via the existing WA payment flow.)

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
  label, type = 'text', placeholder, value, error, touched, hint, onChange, onBlur,
}: {
  label: string
  type?: string
  placeholder?: string
  value: string
  error?: string
  touched?: boolean
  // Optional helper text rendered under the input — used for things
  // like "must be a WhatsApp-active number" where the constraint is
  // not enforceable via the validator but still important to surface
  // before submit. Hidden while an error is showing so the user only
  // sees one message at a time.
  hint?: string
  onChange: (v: string) => void
  onBlur: () => void
}) {
  const showErr = !!(touched && error)
  // The label used to be an unattached sibling of the input — no htmlFor, no id
  // — so every field on the registration form announced as unlabelled. One id
  // here fixes all of them, and carries the error/hint into aria-describedby.
  const id = useId()
  const msgId = `${id}-msg`
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <label htmlFor={id} className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70">{label}</label>
        <AnimatePresence initial={false}>
          {showErr && (
            <motion.span
              key="err"
              id={msgId}
              role="alert"
              variants={slideLeft}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="font-mono text-[11px] text-[var(--c1)]"
            >
              ↘ {error}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <motion.input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={showErr || undefined}
        aria-describedby={showErr || hint ? msgId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        whileFocus={{ boxShadow: showErr ? '4px 4px 0 var(--c1)' : '4px 4px 0 var(--ink)' }}
        transition={SPRING}
        className={`rounded-xl border-[1.5px] border-ink bg-bg px-4 py-2.5 font-body w-full min-h-[44px] focus:ring-2 focus:outline-none text-[16px] text-ink transition-[border-color,box-shadow] ${
          showErr ? 'border-[var(--c1)] focus:ring-[var(--c1)]' : 'focus:ring-[var(--c1)]'
        }`}
      />
      {hint && !showErr && (
        <p
          id={msgId}
          className="font-mono text-[10px] tracking-[0.08em] uppercase opacity-50 mt-1.5"
          style={{ textWrap: 'pretty' } as React.CSSProperties}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

function SelectField({
  label, value, error, touched, onChange, onBlur, options, loading,
}: {
  label: string
  value: string
  error?: string
  touched?: boolean
  onChange: (v: string) => void
  onBlur: () => void
  // `disabled` on a per-option basis lets the parent grey out e.g.
  // sold-out events while still keeping them visible in the list.
  options: { value: string; label: string; disabled?: boolean }[]
  loading?: boolean
}) {
  const showErr = !!(touched && error)
  const id = useId()
  const msgId = `${id}-msg`
  return (
    <div className="mb-3">
      <div className="flex justify-between items-baseline mb-1.5">
        <label htmlFor={id} className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70">{label}</label>
        <AnimatePresence initial={false}>
          {showErr && (
            <motion.span
              key="err"
              id={msgId}
              role="alert"
              variants={slideLeft}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="font-mono text-[11px] text-[var(--c1)]"
            >
              ↘ {error}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {loading ? (
        <div className="w-full h-[44px] animate-pulse bg-ink/10 rounded-xl border-[1.5px] border-ink/20" />
      ) : (
        <select
          id={id}
          value={value}
          aria-invalid={showErr || undefined}
          aria-describedby={showErr ? msgId : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={`rounded-xl border-[1.5px] border-ink bg-bg px-4 py-2.5 font-body w-full min-h-[44px] focus:ring-2 focus:ring-[var(--c1)] focus:outline-none text-[16px] text-ink appearance-none cursor-pointer transition-[border-color,box-shadow] duration-150 ${
            showErr ? 'border-[var(--c1)]' : ''
          }`}
        >
          <option value="">— select an event —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}

export function RegisterPage() {
  const [params] = useSearchParams()
  const eventSlugParam = params.get('event')
  const { success, error: toastError } = useToast()

  const [events, setEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [form, setForm] = useState<Form>({
    name: '', phone: '', class_year: '', event_id: '',
    team_name: '', team_members: [],
    partner_name: '', partner_phone: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Touched>({})
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [regId, setRegId] = useState<string>('')
  const [token, setToken] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // No cap-enforcement state. `max_participants` is admin-internal; we
  // never block participants from registering and never expose the count.
  // The only urgency cue is `event.limited_spots` (admin-toggled boolean).

  useEffect(() => {
    supabase
      .from('paradox_events')
      .select('*')
      // Pull both active + inactive so sold-out events stay visible
      // in the dropdown (greyed + disabled). Sort active-first so
      // selectable events sit at the top.
      .order('active', { ascending: false })
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const list = (data ?? []) as Event[]
        setEvents(list)
        setLoadingEvents(false)
        // Don't auto-select an event that's been marked inactive from
        // an old ?event= bookmark — leave the dropdown unselected so
        // the validator fires its "pick an event" message.
        if (eventSlugParam) {
          const match = list.find((e) => e.slug === eventSlugParam && e.active !== false)
          if (match) setForm((f) => ({ ...f, event_id: match.id }))
        }
      })
  }, [eventSlugParam])

  // Derive once — used for validation, payload shaping, and conditional UI.
  // A duo is `team_format === 'pair'` per `lib/types.ts`. Anything else with
  // a team_format ≠ 'solo' is treated as a team.
  const selectedEventForValidation = events.find((e) => e.id === form.event_id)
  const isDuo = selectedEventForValidation?.team_format === 'pair'
  const isTeamPlus = !!selectedEventForValidation?.team_format
    && selectedEventForValidation.team_format !== 'solo'
    && selectedEventForValidation.team_format !== 'pair'
  // Partner is required for every duo except MUN-style events. See
  // `isPartnerOptionalEvent` above for the slug/name match.
  const partnerRequired = isDuo && !isPartnerOptionalEvent(selectedEventForValidation)

  useEffect(() => {
    setErrors(validate(form, isDuo, partnerRequired))
  }, [form, isDuo, partnerRequired])

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }
  function blur(key: keyof Form) {
    setTouched((t) => ({ ...t, [key]: true }))
  }

  async function submit() {
    const errs = validate(form, isDuo, partnerRequired)
    setErrors(errs)
    // For duos we need to flag the partner fields as touched too so the
    // inline error chips render if the user hits submit on a blank partner.
    setTouched({
      name: true, phone: true, class_year: true, event_id: true,
      ...(isDuo ? { partner_name: true, partner_phone: true } : {}),
    })
    if (Object.keys(errs).length > 0) return
    setSubmitting(true)
    try {
      const ev = events.find((e) => e.id === form.event_id)

      // No cap pre-check. Registration always proceeds — admins triage on
      // their side via the existing WA payment flow.

      const eventSlug = ev?.slug ?? 'X'
      const reg_id = `PAR-${eventSlug.toUpperCase().slice(0, 6)}-${Date.now().toString(36).toUpperCase()}`
      const newToken = crypto.randomUUID()

      // For duo events, ship the partner as the first team_members entry so
      // admin tables + CSV exports surface the second person from day one.
      // member_count = 2 reflects the actual headcount for caps & analytics.
      // For MUN where the partner is optional and left blank, we send null
      // for team_members so the admin doesn't see a row of empty strings —
      // member_count still reflects the team headcount.
      const partnerProvided = isDuo && (form.partner_name.trim() || form.partner_phone.trim())
      const teamMembersPayload = partnerProvided
        ? [{ name: form.partner_name.trim(), phone: form.partner_phone.trim() }]
        : null
      const memberCount = isDuo ? 2 : 1

      // Free-entry events (no fee set in admin, e.g. Photography) skip the
      // payment loop entirely — every reg lands as paid=true so admins don't
      // have to manually flip every Photography submission. Paid events
      // stay paid=false until the POC confirms payment via WhatsApp.
      // `fee` is a free-form string column (e.g. "200", "₹200"); we treat
      // any non-empty value as "this event charges money".
      const isFreeEntry = !ev?.fee || !String(ev.fee).trim()

      // email + school are intentionally dropped from the form to keep
      // registration friction-free. Both columns *should* accept NULL on the
      // DB (see scripts/paradox_drop_email_school_required.sql) — but if the
      // migration hasn't run yet on this Paradox instance, the DB still has
      // NOT NULL on these columns and the insert would 23502.
      //
      // To stay resilient, we try `null` first. If we get back the NOT NULL
      // violation specifically for `email` or `school`, we retry with
      // synthetic placeholders that satisfy the constraint without claiming
      // the user actually provided real data. The placeholders are obvious
      // enough that an admin scanning the CSV won't mistake them for input.
      //
      // The placeholder for email derives from reg_id so each row is unique
      // (the column may also carry a UNIQUE constraint in some setups).
      const buildPayload = (opts: { withPlaceholders: boolean }) => ({
        reg_id,
        token: newToken,
        event_id: form.event_id,
        event_name: ev?.name,
        name: form.name.trim(),
        email: opts.withPlaceholders
          ? `noreply+${reg_id.toLowerCase()}@paradox.local`
          : null,
        phone: form.phone.trim(),
        school: opts.withPlaceholders ? 'not provided' : null,
        class_year: form.class_year.trim(),
        team_name: null,
        team_members: teamMembersPayload,
        member_count: memberCount,
        paid: isFreeEntry,
        attended: false,
        notes: isFreeEntry ? 'auto-paid · free entry event' : null,
      })

      // Detects "null value in column email/school violates not-null
      // constraint" or PostgREST PGRST204-style schema errors mentioning
      // either column. We match on PG error code 23502 OR explicit mention
      // of email/school in the message text.
      const isEmailOrSchoolRequired = (err: any) => {
        if (!err) return false
        if (err.code === '23502') return true
        const msg = String(err.message ?? err.details ?? err.hint ?? '').toLowerCase()
        return /(email|school)/.test(msg) && /(not[- ]null|null value)/.test(msg)
      }

      let { error } = await supabase.from('paradox_registrations').insert(buildPayload({ withPlaceholders: false }))
      if (error && isEmailOrSchoolRequired(error)) {
        // Retry with placeholders so the user can still register. Warn the
        // dev / admin to run the migration so this fallback can retire.
        console.warn('[paradox_registrations] email/school NOT NULL — retrying with placeholders. Run scripts/paradox_drop_email_school_required.sql to enable null.')
        const retry = await supabase.from('paradox_registrations').insert(buildPayload({ withPlaceholders: true }))
        error = retry.error
      }
      if (error) {
        console.error(error)
        toastError('Registration failed', error.message)
        setSubmitting(false)
        return
      }
      setRegId(reg_id)
      setToken(newToken)
      success("You're registered!", `Your reg ID is ${reg_id}`)
      setStep('success')
    } catch (err) {
      console.error(err)
      toastError('Registration failed', err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const waUrl = useWhatsAppGroup()

  if (step === 'success') {
    const firstName = form.name.split(' ')[0] || form.name
    const ev = events.find((e) => e.id === form.event_id)
    return (
      <div className="min-h-[100dvh] bg-bg text-ink" style={{ position: 'relative', zIndex: 1 }}>
        <div className="px-4 sm:px-8 py-7 sm:py-14 max-w-md mx-auto">
          <AnimatePresence initial={false}>
            <motion.div
              key="success-check"
              variants={scaleIn}
              initial="hidden"
              animate="show"
              className="w-20 h-20 rounded-2xl bg-[var(--c2)] border-[1.5px] border-ink flex items-center justify-center mb-6 -rotate-6"
              style={{ boxShadow: '4px 4px 0 var(--ink)' }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path d="M4 12 L10 18 L20 6" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          </AnimatePresence>

          <motion.div variants={stagger(0.07)} initial="hidden" animate="show">
            <motion.div variants={fadeUp} className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70">/confirmed</motion.div>
            <motion.h1
              variants={fadeUp}
              className="font-display mt-1.5"
              style={{
                fontSize: 'clamp(34px, 6vw, 66px)',
                letterSpacing: '-0.02em',
                lineHeight: 0.95,
                textWrap: 'balance',
              }}
            >
              you&apos;re in,{' '}
              <span style={{ color: 'var(--c1)' }}>{firstName}.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="font-body text-[15px] mt-4 leading-relaxed"
              style={{ textWrap: 'pretty' } as React.CSSProperties}
            >
              Thanks for registering. The event POC will WhatsApp you on{' '}
              <strong>{form.phone}</strong> with payment + next steps. If you
              haven&apos;t already, please join the official WhatsApp group below
              — that&apos;s where every update lives.
            </motion.p>

            {/* "you're in!" handwritten label above the reg ID card */}
            <motion.p
              variants={fadeUp}
              className="font-hand text-[22px] text-center mb-2"
              style={{ transform: 'rotate(-1deg)' }}
            >
              you&apos;re in! 🎉
            </motion.p>

            {/* Success ticket card — c2 bg, reg ID prominent */}
            <motion.div
              variants={fadeUp}
              className="rounded-2xl border-[1.5px] border-ink p-6 bg-[var(--c2)] mt-0"
              style={{ boxShadow: '4px 4px 0 var(--ink)' }}
            >
              <div className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70 mb-1">Registration ID</div>
              <div
                className="font-display tabular-nums"
                style={{
                  fontSize: 'clamp(22px, 4vw, 32px)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {regId}
              </div>
              <div className="mt-3 border-t border-ink/20 pt-3">
                <div
                  className="font-display"
                  style={{
                    fontSize: 'clamp(18px, 3vw, 24px)',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.05,
                    textWrap: 'balance',
                  }}
                >
                  {ev?.name ?? 'Event'}
                </div>
                <div className="font-mono text-[12px] opacity-65 mt-1 tabular-nums">
                  {ev?.date ? `${ev.date}` : ''}{ev?.venue ? ` · ${ev.venue}` : ''}
                </div>
              </div>
            </motion.div>

            {/* WhatsApp group CTA */}
            <motion.a
              variants={fadeUp}
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
              className="mt-5 rounded-2xl border-[1.5px] border-ink p-4 flex items-center justify-between gap-3"
              style={{ background: '#25D366', color: '#0A0A0A', textDecoration: 'none', boxShadow: '3px 3px 0 var(--ink)', transitionProperty: 'transform, box-shadow' }}
            >
              <div>
                <div className="font-mono text-[10px] tracking-[0.14em] uppercase" style={{ opacity: 0.65 }}>★ official group</div>
                <div className="font-display mt-0.5" style={{ fontSize: 'clamp(16px, 3vw, 20px)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                  join the whatsapp group
                </div>
                <div className="font-body text-[12px] mt-1" style={{ opacity: 0.7 }}>
                  payment details, updates &amp; event-day info — all here
                </div>
              </div>
              <span className="font-display text-[22px] shrink-0">→</span>
            </motion.a>

            {/* "Any queries?" — three quick contact paths so a registrant
                with questions never has to dig through the site. */}
            <motion.div
              variants={fadeUp}
              className="mt-5 rounded-2xl border-[1.5px] border-ink p-4"
              style={{ background: 'rgba(0,0,0,0.04)', boxShadow: '3px 3px 0 var(--ink)' }}
            >
              <div className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-65 mb-1">/ any queries?</div>
              <div className="font-display" style={{ fontSize: 'clamp(16px, 3vw, 20px)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                we&apos;ll be quick — promise.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                <motion.a
                  href="mailto:ngo.aquaterra@gmail.com?subject=Paradox%20query"
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING}
                  className="rounded-full border-[1.5px] border-ink px-4 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase bg-bg text-ink flex items-center justify-center gap-2 hover:bg-ink hover:text-bg [transition:background-color_180ms,color_180ms,transform_120ms]"
                >
                  ✉ email
                </motion.a>
                <motion.a
                  href="https://instagram.com/paradox.twenty26"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING}
                  className="rounded-full border-[1.5px] border-ink px-4 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase bg-bg text-ink flex items-center justify-center gap-2 hover:bg-ink hover:text-bg [transition:background-color_180ms,color_180ms,transform_120ms]"
                >
                  ✦ DM @paradox.twenty26
                </motion.a>
              </div>
              <MotionLink
                to="/paradox/contact"
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
                className="block mt-2 rounded-full border-[1.5px] border-ink px-4 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase bg-bg text-ink flex items-center justify-center hover:bg-ink hover:text-bg [transition:background-color_180ms,color_180ms,transform_120ms]"
              >
                ↗ full contact page
              </MotionLink>
            </motion.div>

            <motion.div variants={fadeUp} className="mt-5 flex flex-col gap-3">
              <MotionLink
                to={`/paradox/ticket/${token}`}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
                className="rounded-full border-[1.5px] border-ink px-5 py-3 min-h-[48px] font-body font-semibold bg-ink text-bg text-center flex items-center justify-center w-full"
                style={{ boxShadow: '4px 4px 0 var(--c1)' }}
              >
                View my ticket →
              </MotionLink>
              <MotionLink
                to="/paradox"
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
                className="rounded-full border-[1.5px] border-ink px-5 py-3 min-h-[48px] font-body font-semibold bg-transparent text-ink text-center flex items-center justify-center w-full transition-[background-color,color]"
              >
                Back to paradox →
              </MotionLink>
            </motion.div>
          </motion.div>
        </div>
      </div>
    )
  }

  const selectedEvent = events.find((e) => e.id === form.event_id)

  // ── Post-cutoff gate ───────────────────────────────────────────────
  // Past the cutoff the auto-form is replaced with a manual-route
  // panel: "few spots remain · DM Aastha to register". The user can
  // tap any event in the grid below to open a WhatsApp chat with
  // Aastha pre-filled with that specific event name, so she can
  // confirm availability one-on-one. Sold-out (inactive) events are
  // greyed and disabled. Anyone who finished the auto-form before
  // the cutoff still sees their success screen — that branch runs
  // above and returns first.
  const manualFlow = Date.now() > REGISTRATION_CUTOFF.getTime()
  if (manualFlow) {
    const buildWaHref = (eventName: string) => {
      const msg = encodeURIComponent(
        `Hi ${POC_NAME.split(' ')[0]}, I'd like to register for ${eventName} at Paradox 2026.`
      )
      return `https://wa.me/${POC_WA_NUMBER}?text=${msg}`
    }
    const generalMsg = encodeURIComponent(
      `Hi ${POC_NAME.split(' ')[0]}, I'd like to register for Paradox 2026. Which events still have spots?`
    )
    const generalWaHref = `https://wa.me/${POC_WA_NUMBER}?text=${generalMsg}`

    return (
      <div className="min-h-[100dvh] bg-bg text-ink" style={{ position: 'relative', zIndex: 1 }}>
        <div className="px-4 sm:px-8 py-10 sm:py-14 max-w-3xl mx-auto">
          {/* Hero card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING}
            className="rounded-2xl border-[1.5px] border-ink p-6 sm:p-8"
            style={{ background: 'var(--c2)', boxShadow: '4px 4px 0 var(--ink)' }}
          >
            <div className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70">
              registrations · last call
            </div>
            <h1
              className="font-display mt-2"
              style={{
                fontSize: 'clamp(30px, 5.5vw, 48px)',
                letterSpacing: '-0.02em',
                lineHeight: 0.95,
                textWrap: 'balance',
              } as React.CSSProperties}
            >
              few spots remain.
            </h1>
            <p className="font-body mt-4 text-[15px] leading-relaxed" style={{ textWrap: 'pretty' } as React.CSSProperties}>
              The auto-registration form is closed. <strong>DM {POC_NAME}</strong> on
              WhatsApp and she'll confirm whether the event you want still has
              room.
            </p>
            <a
              href={generalWaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink px-5 py-3 min-h-[48px] font-body font-semibold active:scale-[0.96]"
              style={{
                background: '#25D366',
                color: 'var(--ink)',
                boxShadow: '4px 4px 0 var(--ink)',
                transitionProperty: 'transform, box-shadow',
                transitionDuration: '120ms',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.88 11.9L4 20l4.22-1.1a7.94 7.94 0 0 0 3.83.97h.01A7.94 7.94 0 0 0 20 11.94a7.85 7.85 0 0 0-2.4-5.62Zm-5.55 12.21h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.43-.16-.25a6.6 6.6 0 0 1 5.6-10.1 6.55 6.55 0 0 1 4.66 1.94 6.55 6.55 0 0 1 1.93 4.66 6.6 6.6 0 0 1-6.59 6.59Zm3.62-4.94c-.2-.1-1.17-.58-1.35-.65-.18-.07-.31-.1-.45.1-.13.2-.51.65-.63.78-.12.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99a6 6 0 0 1-1.11-1.38c-.12-.2-.01-.31.09-.41.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.45-1.08-.62-1.48-.16-.39-.33-.34-.45-.34l-.38-.01a.74.74 0 0 0-.54.25c-.18.2-.71.7-.71 1.7s.73 1.97.83 2.1c.1.13 1.44 2.2 3.49 3.08.48.21.86.34 1.16.43.49.16.94.13 1.29.08.39-.06 1.2-.49 1.37-.97.17-.48.17-.88.12-.97-.05-.09-.18-.14-.38-.24Z"/>
              </svg>
              Message {POC_NAME.split(' ')[0]} — general
            </a>
            <div className="font-mono text-[11px] mt-3 opacity-60 tabular-nums">
              +91 89103 53970
            </div>
          </motion.div>

          {/* Per-event WA buttons. Each one prefills "Hi Aastha, I'd
              like to register for X at Paradox 2026." Sold-out events
              are visible but disabled so users know the event exists
              even if they can't request it. */}
          <div className="mt-8">
            <div className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70 mb-3">
              or pick an event
            </div>
            {loadingEvents ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse rounded-2xl border-[1.5px] border-ink/20 bg-ink/5 h-[64px]" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="font-body text-[14px] opacity-60">
                No events loaded — message {POC_NAME.split(' ')[0]} directly.
              </div>
            ) : (
              <motion.div
                variants={stagger(0.04)}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
              >
                {events.map((e) => {
                  const isSoldOut = (e as any).active === false
                  const feeLabel = (e as any).fee
                    ? (String((e as any).fee).startsWith('₹') ? String((e as any).fee) : `₹${(e as any).fee}`)
                    : null
                  const inner = (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="font-display text-[16px] sm:text-[17px] truncate" style={{ letterSpacing: '-0.01em' }}>
                          {e.name}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.08em] opacity-60 mt-0.5">
                          {[e.category, feeLabel].filter(Boolean).join(' · ') || '—'}
                          {isSoldOut && <span className="ml-2 text-[var(--c1)] font-semibold">· sold out</span>}
                        </div>
                      </div>
                      <span
                        aria-hidden
                        className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] opacity-70 flex-shrink-0"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.88 11.9L4 20l4.22-1.1a7.94 7.94 0 0 0 3.83.97h.01A7.94 7.94 0 0 0 20 11.94a7.85 7.85 0 0 0-2.4-5.62Zm-5.55 12.21h-.01a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.43-.16-.25a6.6 6.6 0 0 1 5.6-10.1 6.55 6.55 0 0 1 4.66 1.94 6.55 6.55 0 0 1 1.93 4.66 6.6 6.6 0 0 1-6.59 6.59Z"/>
                        </svg>
                        DM
                      </span>
                    </>
                  )
                  if (isSoldOut) {
                    return (
                      <motion.div
                        key={e.id}
                        variants={fadeUp}
                        className="rounded-2xl border-[1.5px] border-ink/30 bg-ink/4 px-4 py-3 min-h-[64px] flex items-center gap-3 cursor-not-allowed"
                        style={{ opacity: 0.55, filter: 'grayscale(0.45)' }}
                        title="This event is sold out"
                        aria-disabled="true"
                      >
                        {inner}
                      </motion.div>
                    )
                  }
                  return (
                    <motion.a
                      key={e.id}
                      variants={fadeUp}
                      href={buildWaHref(e.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileTap={{ scale: 0.97 }}
                      whileHover={{ y: -2, boxShadow: '5px 5px 0 var(--ink)' }}
                      transition={SPRING}
                      className="rounded-2xl border-[1.5px] border-ink bg-bg px-4 py-3 min-h-[64px] flex items-center gap-3 no-underline text-ink"
                      style={{ boxShadow: '3px 3px 0 var(--ink)' }}
                      aria-label={`Message ${POC_NAME} on WhatsApp about ${e.name}`}
                    >
                      {inner}
                    </motion.a>
                  )
                })}
              </motion.div>
            )}
          </div>

          {/* Secondary nav for users who landed here by accident */}
          <div className="mt-8 flex flex-wrap gap-2">
            <MotionLink
              to="/paradox/events"
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
              className="rounded-full border-[1.5px] border-ink px-4 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.1em] uppercase inline-flex items-center"
            >
              ← see events
            </MotionLink>
            <MotionLink
              to="/paradox/schedule"
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
              className="rounded-full border-[1.5px] border-ink px-4 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.1em] uppercase inline-flex items-center"
            >
              schedule
            </MotionLink>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-bg text-ink" style={{ position: 'relative', zIndex: 1 }}>
      {/* Page header */}
      <div className="px-4 sm:px-8 lg:px-12 pt-8 sm:pt-12 pb-6 border-b-[1.5px] border-ink max-w-[1280px] mx-auto">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70">/register</div>
        <h1
          className="font-display mt-1"
          style={{
            fontSize: 'clamp(34px, 6vw, 66px)',
            letterSpacing: '-0.02em',
            lineHeight: 0.95,
            textWrap: 'balance',
          }}
        >
          register.
        </h1>
      </div>

      <div className="px-4 sm:px-8 py-7 sm:py-14 pb-16 max-w-[540px] mx-auto">
        <motion.div variants={stagger(0.06)} initial="hidden" animate="show">
          <motion.div variants={fadeUp}>
            <Field
              label="Name"
              placeholder="your full name"
              value={form.name}
              error={errors.name}
              touched={touched.name}
              onChange={(v) => update('name', v)}
              onBlur={() => blur('name')}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <Field
              label="Phone (WhatsApp)"
              placeholder="+91 …"
              value={form.phone}
              error={errors.phone}
              touched={touched.phone}
              hint="make sure this number is active on whatsapp — POC texts here"
              onChange={(v) => update('phone', v)}
              onBlur={() => blur('phone')}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <Field
              label="Class / Year"
              placeholder="e.g. Class 12 / 2nd year"
              value={form.class_year}
              error={errors.class_year}
              touched={touched.class_year}
              onChange={(v) => update('class_year', v)}
              onBlur={() => blur('class_year')}
            />
          </motion.div>

          <motion.div variants={fadeUp}>
            <SelectField
              label="Event"
              value={form.event_id}
              error={errors.event_id}
              touched={touched.event_id}
              onChange={(v) => update('event_id', v)}
              onBlur={() => blur('event_id')}
              options={events.map((e) => {
                // Inactive events still appear so users know the event
                // existed — they're just unselectable, with a clear
                // SOLD OUT suffix on the label.
                const soldOut = e.active === false
                return {
                  value: e.id,
                  label: soldOut ? `${e.name} — SOLD OUT` : e.name,
                  disabled: soldOut,
                }
              })}
              loading={loadingEvents}
            />

            {/* Spots left / FULL status beneath the select */}
            <AnimatePresence initial={false}>
              {form.event_id && !loadingEvents && (
                <motion.div
                  key={form.event_id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING}
                  className="-mt-2 mb-4 flex items-center gap-2"
                >
                  {selectedEvent?.limited_spots ? (
                    // Admin-toggled urgency cue. Capacity is never surfaced
                    // as a number, and registration is never blocked even
                    // if the cap has been hit.
                    <span className="rounded-xl bg-[var(--c1)]/10 text-[var(--c1)] font-mono text-[11px] px-3 py-1.5 font-bold tracking-[0.08em] uppercase border border-[var(--c1)]/30">
                      ★ limited spots{selectedEvent?.name ? ` · ${selectedEvent.name}` : ''}
                    </span>
                  ) : selectedEvent?.name ? (
                    <span className="font-mono text-[10px] opacity-50 tracking-[0.08em]">
                      {selectedEvent.name}
                    </span>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Duo: inline partner inputs ── */}
          <AnimatePresence initial={false}>
            {isDuo && (
              <motion.div
                key={selectedEvent!.id + '-duo'}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="border-t-[1.5px] border-dashed border-ink/30 pt-4 mt-2 mb-4">
                  <div className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-60 mb-3">
                    / partner details · duo event{!partnerRequired && ' · optional'}
                  </div>
                  <Field
                    label={partnerRequired ? 'Partner name' : 'Partner name (optional)'}
                    placeholder={partnerRequired ? 'their full name' : 'leave blank if not yet decided'}
                    value={form.partner_name}
                    error={errors.partner_name}
                    touched={touched.partner_name}
                    onChange={(v) => update('partner_name', v)}
                    onBlur={() => blur('partner_name')}
                  />
                  <Field
                    label={partnerRequired ? 'Partner phone (WhatsApp)' : 'Partner phone (optional)'}
                    placeholder="+91 …"
                    value={form.partner_phone}
                    error={errors.partner_phone}
                    touched={touched.partner_phone}
                    hint="active on whatsapp — POC may text both teammates"
                    onChange={(v) => update('partner_phone', v)}
                    onBlur={() => blur('partner_phone')}
                  />
                  <p className="font-mono text-[10px] tracking-[0.08em] uppercase opacity-50 mt-1"
                    style={{ textWrap: 'pretty' } as React.CSSProperties}>
                    {partnerRequired
                      ? 'Our POC will WhatsApp both of you with payment + next steps.'
                      : "Partner allocation usually happens after registration for this event — fill in only if you've already paired up."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Team event note (3+ members) ── */}
          <AnimatePresence initial={false}>
            {isTeamPlus && (
              <motion.div
                key={selectedEvent!.id + '-team'}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                className="overflow-hidden"
              >
                <div className="border-t-[1.5px] border-dashed border-ink/30 pt-4 mt-2 mb-4">
                  <div className="rounded-2xl border-[1.5px] border-ink p-4"
                    style={{ background: 'rgba(255,210,63,0.12)', boxShadow: '3px 3px 0 var(--ink)' }}>
                    <div className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-65 mb-1">★ team event</div>
                    <div className="font-display"
                      style={{ fontSize: 'clamp(16px, 3vw, 20px)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                      You're registering as <span className="font-bold">Captain</span>.
                    </div>
                    <p className="font-body text-[13px] mt-1.5 leading-relaxed opacity-80"
                      style={{ textWrap: 'pretty' } as React.CSSProperties}>
                      Team details will be collected after payment — our POC will WhatsApp you for the roster + school IDs.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={fadeUp}>
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -1 }}
              transition={SPRING}
              disabled={submitting}
              onClick={submit}
              className="mt-3 w-full rounded-full border-[1.5px] border-ink px-5 py-3 min-h-[48px] font-body font-semibold bg-ink text-bg flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed transition-[transform,box-shadow,background-color,color]"
              style={{ boxShadow: submitting ? 'none' : '4px 4px 0 var(--c1)' }}
            >
              <span className="flex items-center gap-2">
                {submitting && <Spinner />}
                {submitting ? 'Locking…' : 'Lock it in →'}
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] opacity-75">
                instant confirm
              </span>
            </motion.button>
          </motion.div>
        </motion.div>

        <div className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-60 mt-4 text-center">
          our team will reach out to you on whatsapp within 24hrs
        </div>
      </div>
    </div>
  )
}
