// @ts-nocheck
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../lib/auth'
import { stagger, fadeUp, SPRING } from '../lib/motion'

export function AdminLoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    if (session) navigate('/paradox/admin', { replace: true })
  }, [session, navigate])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error)
    else navigate('/paradox/admin')
  }

  return (
    <div
      className="min-h-[100dvh] bg-ink text-bg flex flex-col items-center justify-center px-5 py-12"
      style={{ position: 'relative', zIndex: 1 }}
    >
      {/* ── Logo ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.05 }}
        className="flex items-baseline gap-2 mb-8"
      >
        <span
          className="font-display text-bg leading-none"
          style={{ fontSize: 'clamp(36px, 6vw, 52px)', letterSpacing: '-0.025em' }}
        >
          paradox
        </span>
        {/* '26 pill in c1 */}
        <span
          className="rounded-full px-3 py-1 font-display text-bg text-[20px] leading-none border-[1.5px] border-bg/20"
          style={{ background: 'var(--c1)', color: 'var(--bg)', letterSpacing: '-0.02em' }}
        >
          '26
        </span>
      </motion.div>

      {/* ── Card ── */}
      <motion.div
        variants={stagger(0.08)}
        initial="hidden"
        animate="show"
        className="rounded-2xl bg-bg text-ink border-[1.5px] border-ink p-6 sm:p-8 w-full max-w-[380px]"
        style={{ boxShadow: '6px 6px 0 var(--c1)' }}
      >
        {/* Heading */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65 mb-1">admin access</div>
          <h2
            className="font-display text-ink leading-[0.92]"
            style={{ fontSize: 'clamp(28px, 5vw, 40px)', letterSpacing: '-0.025em' }}
          >
            sign in.
          </h2>
          <p className="font-body text-[13px] opacity-55 mt-1">
            Dashboard access for authorised team only.
          </p>
        </motion.div>

        {/* Form */}
        <form onSubmit={onSubmit} className="mt-6 space-y-3">

          {/* Email */}
          <motion.div variants={fadeUp}>
            <label
              htmlFor="admin-email"
              className="block font-mono text-[10px] tracking-[0.14em] uppercase opacity-65 mb-1.5"
            >
              email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
              placeholder="you@aquaterra.org"
              className="rounded-xl border-[1.5px] border-ink bg-bg px-4 py-3 font-body w-full focus:ring-2 focus:ring-c1 focus:outline-none text-ink placeholder:opacity-30 text-[14px] transition-shadow min-h-[44px]"
            />
          </motion.div>

          {/* Password */}
          <motion.div variants={fadeUp}>
            <label
              htmlFor="admin-password"
              className="block font-mono text-[10px] tracking-[0.14em] uppercase opacity-65 mb-1.5"
            >
              password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="rounded-xl border-[1.5px] border-ink bg-bg px-4 py-3 pr-14 font-body w-full focus:ring-2 focus:ring-c1 focus:outline-none text-ink text-[14px] transition-shadow min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase opacity-40 hover:opacity-80 transition-opacity px-1"
                tabIndex={-1}
              >
                {showPw ? 'hide' : 'show'}
              </button>
            </div>
          </motion.div>

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ x: -8, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="rounded-xl p-3 font-body text-[13px] leading-snug"
                style={{ background: 'color-mix(in srgb, var(--c1) 10%, transparent)', color: 'var(--c1)' }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.div variants={fadeUp} className="pt-1">
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              transition={SPRING}
              className="rounded-full border-[1.5px] border-ink px-5 py-3 font-body font-semibold w-full flex items-center justify-between disabled:opacity-50 transition-opacity text-[15px]"
              style={{ background: 'var(--c1)', color: 'var(--bg)', boxShadow: '4px 4px 0 var(--ink)' }}
            >
              <span>{loading ? 'Authenticating…' : 'Enter dashboard'}</span>
              <motion.span
                animate={loading ? { x: [0, 4, 0] } : { x: 0 }}
                transition={{ repeat: loading ? Infinity : 0, duration: 0.8 }}
              >
                →
              </motion.span>
            </motion.button>
          </motion.div>
        </form>

        {/* Footer note */}
        <motion.div
          variants={fadeUp}
          className="mt-6 pt-5 border-t border-ink/10 font-mono text-[9px] opacity-30 tracking-[0.06em]"
        >
          Secured via Supabase Auth · Sessions expire after 7 days
        </motion.div>
      </motion.div>

      <p className="font-hand text-[14px] opacity-50 mt-3 text-center">don't share this link 🤫</p>

      {/* ── Back to site ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...SPRING, delay: 0.35 }}
        className="mt-6"
      >
        <Link
          to="/paradox"
          className="font-mono text-[11px] tracking-[0.12em] uppercase opacity-40 hover:opacity-80 transition-opacity text-bg"
        >
          ← back to site
        </Link>
      </motion.div>
    </div>
  )
}
