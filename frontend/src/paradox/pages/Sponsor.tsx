// @ts-nocheck
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { fadeUp, stagger, scaleIn, slideLeft, SPRING } from '../lib/motion'
import { MotionLink } from '../lib/motion'
import { useToast } from '../components/ui/Toast'

type Tier = {
  id: string
  name: string
  price: string
  benefits: string[]
  featured?: boolean
  tierClass: 0 | 1 | 2 | 3 | 'cafe' | 'fashion'
  amtColor?: string
}

// Tier backgrounds per spec:
// tier-0: ink bg, bg text, c2 amount
// tier-1: c1 bg, bg text
// tier-2: c2 bg, ink text
// tier-3: c3 bg, ink text
// cafe/fashion: bg bg, ink text (no special class)

const TIER_STYLES: Record<string, { bg: string; color: string; amtColor?: string }> = {
  '0': { bg: 'var(--ink)', color: 'var(--bg)', amtColor: 'var(--c2)' },
  '1': { bg: 'var(--c1)', color: 'var(--bg)' },
  '2': { bg: 'var(--c2)', color: 'var(--ink)' },
  '3': { bg: 'var(--c3)', color: 'var(--ink)' },
  'cafe': { bg: 'var(--bg)', color: 'var(--ink)' },
  'fashion': { bg: 'var(--bg)', color: 'var(--ink)' },
}

const TIERS: Tier[] = [
  {
    id: 'title',
    name: 'Title Sponsor',
    price: '₹70K',
    tierClass: 0,
    featured: true,
    benefits: [
      'Logo on all event assets',
      'Stage mention at every event',
      'Dedicated activation booth',
      'Social media spotlight',
    ],
  },
  {
    id: 'co',
    name: 'Co-Sponsor',
    price: '₹50K',
    tierClass: 1,
    benefits: [
      'Logo on stage backdrop',
      'Event mention at 6 events',
      'On-ground signage rights',
    ],
  },
  {
    id: 'associate',
    name: 'Associate',
    price: '₹30K',
    tierClass: 2,
    benefits: [
      'Logo wall placement',
      'Website link + social mention',
      'Thank-you post on day 1',
    ],
  },
  {
    id: 'education',
    name: 'Education',
    price: '₹25K',
    tierClass: 3,
    benefits: [
      'Category exclusivity',
      'Banner at workshops',
      'Social shoutout',
    ],
  },
  {
    id: 'cafe',
    name: 'Cafe Partner',
    price: '₹20K',
    tierClass: 'cafe',
    benefits: [
      'Branded stall at venue',
      'Menu in event booklet',
      'Logo on F&B collateral',
    ],
  },
  {
    id: 'fashion',
    name: 'Fashion Partner',
    price: '₹17.5K',
    tierClass: 'fashion',
    benefits: [
      'Showcase slot at fashion event',
      'Logo on runway backdrop',
      'Social coverage',
    ],
  },
]

const BENEFITS_PILLS = [
  'logo on all assets',
  'stage mentions',
  'activation booth',
  '100% to charity',
  'social coverage',
  '8.9L raised in 4.0',
]

type Form = {
  company: string
  contact: string
  phone: string
  email: string
  tier: string
  message: string
}
type Errors = Partial<Record<keyof Form, string>>
type Touched = Partial<Record<keyof Form, boolean>>

const EMAIL_RE = /^\S+@\S+\.\S+$/
const PHONE_RE = /^\+?[\d\s-]{7,}$/

function validate(f: Form): Errors {
  const e: Errors = {}
  if (!f.company.trim()) e.company = 'required'
  if (!f.contact.trim()) e.contact = 'required'
  if (!f.phone.trim()) e.phone = 'required'
  else if (!PHONE_RE.test(f.phone)) e.phone = 'invalid phone'
  if (!f.email.trim()) e.email = 'required'
  else if (!EMAIL_RE.test(f.email)) e.email = 'invalid email'
  return e
}

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
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function DarkField({
  label,
  type = 'text',
  placeholder,
  value,
  error,
  touched,
  onChange,
  onBlur,
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
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1.5">
        <label
          className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70"
          style={{ color: 'var(--bg)' }}
        >
          {label}
        </label>
        {showErr && (
          <motion.span
            variants={slideLeft}
            initial="hidden"
            animate="show"
            className="font-mono text-[11px]"
            style={{ color: 'var(--c1)' }}
          >
            ↘ {error}
          </motion.span>
        )}
      </div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full px-4 py-3 min-h-[48px] rounded-xl font-body text-[16px] bg-transparent outline-none focus:ring-2 focus:ring-[var(--c1)] transition-[border-color,box-shadow]"
        style={{
          color: 'var(--bg)',
          border: `1.5px solid ${showErr ? 'var(--c1)' : 'rgba(251,245,230,0.3)'}`,
        }}
      />
    </div>
  )
}

function DarkSelect({
  label,
  value,
  onChange,
  onBlur,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="mb-4">
      <div
        className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70 mb-1.5"
        style={{ color: 'var(--bg)' }}
      >
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full px-4 py-3 min-h-[48px] rounded-xl font-body text-[16px] bg-transparent outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-[var(--c1)] transition-[border-color,box-shadow]"
        style={{
          color: 'var(--bg)',
          border: '1.5px solid rgba(251,245,230,0.3)',
        }}
      >
        <option value="" className="text-ink">— optional —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-ink">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function DarkTextarea({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="mb-4">
      <div
        className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70 mb-1.5"
        style={{ color: 'var(--bg)' }}
      >
        {label}
      </div>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 min-h-[100px] rounded-xl font-body text-[16px] bg-transparent outline-none resize-none focus:ring-2 focus:ring-[var(--c1)] transition-[border-color,box-shadow]"
        placeholder="anything we should know?"
        style={{
          color: 'var(--bg)',
          border: '1.5px solid rgba(251,245,230,0.3)',
        }}
      />
    </div>
  )
}

function TierCard({ tier, selected, onClick }: { tier: Tier; selected: boolean; onClick: () => void }) {
  const styleKey = String(tier.tierClass)
  const styles = TIER_STYLES[styleKey]

  return (
    <motion.button
      variants={fadeUp}
      whileHover={{ y: -4, transition: SPRING }}
      whileTap={{ scale: 0.96, transition: SPRING }}
      onClick={onClick}
      className="text-left rounded-2xl border-[1.5px] border-ink p-4 sm:p-5 w-full"
      style={{
        background: styles.bg,
        color: styles.color,
        boxShadow: selected ? 'none' : '3px 3px 0 var(--ink)',
        transform: selected ? 'translate(2px, 2px)' : undefined,
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
    >
      {/* Tier badge — JetBrains Mono, uppercase small */}
      <div
        className="font-mono text-[11px] tracking-[0.14em] uppercase mb-2"
        style={{ opacity: 0.75 }}
      >
        {tier.featured ? '★ most visible' : 'tier'}
      </div>
      {/* Amount in Boldonse — smaller clamp */}
      <div
        className="font-display leading-[0.9] tabular-nums"
        style={{
          fontSize: 'clamp(26px, 4vw, 44px)',
          color: styles.amtColor ?? styles.color,
        }}
      >
        {tier.price}
      </div>
      {/* Hand-font tagline on Title tier */}
      {tier.id === 'title' && (
        <p className="font-hand text-[15px] -rotate-1 inline-block mt-1 opacity-80">best ROI in Kolkata →</p>
      )}
      {/* Tier name in Boldonse, smaller */}
      <div
        className="font-display mt-1"
        style={{ fontSize: 'clamp(16px, 2.2vw, 20px)', letterSpacing: '-0.02em' }}
      >
        {tier.name}
      </div>
      {/* Benefits in Bricolage Grotesque */}
      <ul
        className="mt-4 space-y-1.5 font-body"
        style={{ fontSize: '13px', lineHeight: 1.6, opacity: 0.92 }}
      >
        {tier.benefits.map((b) => (
          <li key={b} className="leading-relaxed text-[13px]" style={{ textWrap: 'pretty' } as React.CSSProperties}>→ {b}</li>
        ))}
      </ul>
    </motion.button>
  )
}

export function SponsorPage() {
  const { error: toastError } = useToast()
  const [selectedTier, setSelectedTier] = useState<string>('')
  const [form, setForm] = useState<Form>({
    company: '',
    contact: '',
    phone: '',
    email: '',
    tier: '',
    message: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Touched>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setErrors(validate(form))
  }, [form])

  function update<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function blur(k: keyof Form) {
    setTouched((t) => ({ ...t, [k]: true }))
  }

  function pickTier(t: Tier) {
    setSelectedTier(t.id)
    setForm((f) => ({ ...f, tier: t.name }))
  }

  async function submit() {
    const errs = validate(form)
    setErrors(errs)
    setTouched({ company: true, contact: true, phone: true, email: true })
    if (Object.keys(errs).length > 0) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('paradox_inquiries').insert({
        company: form.company,
        contact: form.contact,
        phone: form.phone,
        email: form.email,
        tier: form.tier || null,
        message: form.message || null,
      })
      if (error) {
        console.error(error)
        // Replaced native `alert()` so the error matches the rest of the
        // Paradox form ecosystem (Register, Contact, Volunteer all use this
        // toast) — keeps the brand voice + can't be blocked on iOS.
        toastError('Could not send inquiry. Try again.')
        setSubmitting(false)
        return
      }
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-[100dvh]"
      style={{ background: 'var(--bg)', color: 'var(--ink)', position: 'relative', zIndex: 1 }}
    >
      {/* ── Hero — c2 background ── */}
      <motion.section
        variants={stagger(0.07)}
        initial="hidden"
        animate="show"
        className="border-b-[1.5px] border-ink py-6 sm:py-14 px-4 sm:px-8 lg:px-12"
        style={{ background: 'var(--c2)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            variants={fadeUp}
            className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70"
          >
            /sponsor
          </motion.div>
          <motion.h1
            variants={fadeUp}
            className="font-display mt-2 leading-[0.92]"
            style={{
              fontSize: 'clamp(34px, 6vw, 66px)',
              letterSpacing: '-0.02em',
              textWrap: 'balance',
              color: 'var(--ink)',
            }}
          >
            sponsor paradox.
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="font-body mt-3 max-w-md leading-relaxed text-[15px]"
            style={{ opacity: 0.75, color: 'var(--ink)', textWrap: 'pretty' } as React.CSSProperties}
          >
            All proceeds fund AquaTerra&apos;s summer drives — water, books, and meals across rural
            Bengal. Your logo on the stage, their name in the books.
          </motion.p>

          {/* Benefits pill tags */}
          <motion.div variants={stagger(0.06)} className="flex flex-wrap gap-2 mt-6">
            {BENEFITS_PILLS.map((pill) => (
              <motion.span
                key={pill}
                variants={fadeUp}
                className="rounded-full border-[1.5px] border-ink px-4 py-2 font-body font-semibold text-[13px]"
                style={{
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  boxShadow: '3px 3px 0 var(--c1)',
                }}
              >
                {pill}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* ── Tier grid ── */}
      <section
        className="border-b-[1.5px] border-ink py-6 sm:py-14 px-4 sm:px-8 lg:px-12"
        style={{ background: 'var(--bg)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70 mb-6"
          >
            [ pick a tier ]
          </motion.div>

          <motion.div
            variants={stagger(0.08)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {TIERS.map((t) => (
              <TierCard
                key={t.id}
                tier={t}
                selected={selectedTier === t.id}
                onClick={() => pickTier(t)}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA / Contact form ── */}
      <section
        className="py-6 sm:py-14 px-4 sm:px-8 lg:px-12"
        style={{ background: 'var(--ink)', color: 'var(--bg)' }}
      >
        <div className="max-w-[1280px] mx-auto">
          {done ? (
            <motion.div
              variants={stagger(0.07)}
              initial="hidden"
              animate="show"
              className="max-w-md py-8"
            >
              <motion.div
                variants={scaleIn}
                className="w-20 h-20 rounded-2xl border-[1.5px] flex items-center justify-center mb-5 -rotate-6"
                style={{
                  background: 'var(--c2)',
                  borderColor: 'var(--bg)',
                  boxShadow: '4px 4px 0 var(--c1)',
                }}
              >
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12 L10 18 L20 6"
                    stroke="var(--ink)"
                    strokeWidth="3"
                    strokeLinecap="square"
                    strokeLinejoin="miter"
                  />
                </svg>
              </motion.div>
              <motion.div
                variants={fadeUp}
                className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70"
              >
                /received
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="font-display mt-2"
                style={{
                  fontSize: 'clamp(28px, 5vw, 44px)',
                  letterSpacing: '-0.02em',
                  color: 'var(--bg)',
                  textWrap: 'balance',
                }}
              >
                done. we&apos;ll be in{' '}
                <span style={{ color: 'var(--c2)' }}>touch within 24h</span>.
              </motion.h2>
              <motion.p
                variants={fadeUp}
                className="font-body mt-4 leading-relaxed text-[15px]"
                style={{ opacity: 0.8, textWrap: 'pretty' } as React.CSSProperties}
              >
                We&apos;ll reach out at <strong>{form.email}</strong>
                {form.tier ? (
                  <>
                    {' '}about the <strong>{form.tier}</strong> tier
                  </>
                ) : null}
                . Talk soon.
              </motion.p>
            </motion.div>
          ) : (
            <motion.div
              variants={stagger(0.06)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              className="max-w-md"
            >
              <motion.div
                variants={fadeUp}
                className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70"
              >
                /get in touch
              </motion.div>
              <motion.h2
                variants={fadeUp}
                className="font-display mt-2"
                style={{
                  fontSize: 'clamp(28px, 5vw, 44px)',
                  letterSpacing: '-0.02em',
                  color: 'var(--bg)',
                  textWrap: 'balance',
                }}
              >
                let&apos;s talk{' '}
                <span style={{ color: 'var(--c2)' }}>partnership</span>.
              </motion.h2>

              <motion.div variants={fadeUp} className="mt-6">
                <DarkField
                  label="Company"
                  placeholder="your brand"
                  value={form.company}
                  error={errors.company}
                  touched={touched.company}
                  onChange={(v) => update('company', v)}
                  onBlur={() => blur('company')}
                />
                <DarkField
                  label="Contact name"
                  placeholder="who should we ping?"
                  value={form.contact}
                  error={errors.contact}
                  touched={touched.contact}
                  onChange={(v) => update('contact', v)}
                  onBlur={() => blur('contact')}
                />
                <DarkField
                  label="Phone"
                  placeholder="+91 …"
                  value={form.phone}
                  error={errors.phone}
                  touched={touched.phone}
                  onChange={(v) => update('phone', v)}
                  onBlur={() => blur('phone')}
                />
                <DarkField
                  label="Email"
                  type="email"
                  placeholder="you@brand.com"
                  value={form.email}
                  error={errors.email}
                  touched={touched.email}
                  onChange={(v) => update('email', v)}
                  onBlur={() => blur('email')}
                />
                <DarkSelect
                  label="Tier interest"
                  value={form.tier}
                  onChange={(v) => update('tier', v)}
                  onBlur={() => blur('tier')}
                  options={TIERS.map((t) => ({ value: t.name, label: `${t.name} — ${t.price}` }))}
                />
                <DarkTextarea
                  label="Message"
                  value={form.message}
                  onChange={(v) => update('message', v)}
                />

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ y: -2, transition: SPRING }}
                  transition={SPRING}
                  disabled={submitting}
                  onClick={submit}
                  className="mt-2 w-full sm:w-auto rounded-full border-[1.5px] px-5 py-3 min-h-[48px] font-body font-semibold flex justify-between items-center disabled:opacity-50 disabled:cursor-not-allowed transition-[transform,box-shadow,background-color,color]"
                  style={{
                    borderColor: 'var(--bg)',
                    background: 'var(--bg)',
                    color: 'var(--ink)',
                    boxShadow: submitting ? 'none' : '4px 4px 0 var(--c1)',
                  }}
                >
                  <span className="flex items-center gap-2">
                    {submitting && <Spinner />}
                    {submitting ? 'Sending…' : 'Send inquiry →'}
                  </span>
                  <span className="font-mono text-[10px] tracking-[0.1em] opacity-70">
                    we reply in 24h
                  </span>
                </motion.button>

                <div className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-55 mt-4 text-center">
                  or email{' '}
                  <a
                    href="mailto:ngo.aquaterra@gmail.com?subject=Paradox 2026 Sponsorship"
                    className="underline underline-offset-2"
                  >
                    ngo.aquaterra@gmail.com
                  </a>
                </div>

                <div className="flex justify-center mt-4">
                  <MotionLink
                    to="/paradox/contact"
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING}
                    className="rounded-full border-[1.5px] px-5 py-3 font-body font-semibold transition-colors"
                    style={{
                      borderColor: 'var(--bg)',
                      background: 'transparent',
                      color: 'var(--bg)',
                    }}
                  >
                    visit contact page →
                  </MotionLink>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  )
}
