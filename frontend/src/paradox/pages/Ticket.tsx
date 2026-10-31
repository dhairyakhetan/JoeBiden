// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import JsBarcode from 'jsbarcode'
import { supabase } from '../lib/supabase'
import type { Registration } from '../lib/types'
import { fadeUp, stagger, SPRING, MotionLink } from '../lib/motion'

type Joined = Registration & {
  paradox_events?: { date: string | null; time: string | null; venue: string | null } | null
}

export function TicketPage() {
  const { token } = useParams<{ token: string }>()
  const [reg, setReg] = useState<Joined | null>(null)
  const [loading, setLoading] = useState(true)
  const [pollCount, setPollCount] = useState(0)
  const barcodeRef = useRef<SVGSVGElement | null>(null)

  const fetchReg = useCallback(async () => {
    if (!token) return
    const { data } = await supabase
      .from('paradox_registrations')
      .select('*, paradox_events ( date, time, venue )')
      .eq('token', token)
      .single()
    setReg((data as Joined) ?? null)
    setLoading(false)
  }, [token])

  useEffect(() => { fetchReg() }, [fetchReg])

  // Auto-poll every 30s while payment is pending
  useEffect(() => {
    if (!reg || reg.paid) return
    const id = setInterval(() => {
      fetchReg()
      setPollCount((n) => n + 1)
    }, 30_000)
    return () => clearInterval(id)
  }, [reg, fetchReg])

  useEffect(() => {
    if (!reg || !reg.paid || !barcodeRef.current) return
    JsBarcode(barcodeRef.current, reg.reg_id, {
      format: 'CODE128',
      lineColor: '#181818',
      background: '#FBF5E6',
      width: 2,
      height: 56,
      displayValue: false,
      margin: 0,
    })
  }, [reg])

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg text-ink py-6 px-6">
        <div className="w-full max-w-[420px] mx-auto space-y-3">
          <div className="animate-pulse bg-ink/10 h-12" />
          <div className="animate-pulse bg-ink/10 h-48" />
          <div className="animate-pulse bg-ink/10 h-12" />
        </div>
      </div>
    )
  }

  if (!reg) {
    return (
      <div className="min-h-[100dvh] bg-bg text-ink flex items-center justify-center px-5">
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-60">/ticket</div>
          <h1 className="font-display text-[36px] leading-[0.95] tracking-tight text-balance mt-1">
            ticket not <span className="text-c1">found.</span>
          </h1>
          <p className="font-body text-[14px] mt-3 opacity-75 text-pretty">
            That link doesn't match any registration.
          </p>
          <MotionLink
            to="/paradox"
            whileTap={{ scale: 0.96 }}
            transition={{ ...SPRING }}
            className="inline-block mt-5 btn-pill btn-pill-primary"
          >
            Back to paradox →
          </MotionLink>
        </div>
      </div>
    )
  }

  if (!reg.paid) {
    return (
      <div className="min-h-[100dvh] bg-bg text-ink py-8 px-5">
        <div className="max-w-sm mx-auto">
          {/* Header */}
          <div className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-60">/pending</div>
          <h1 className="font-display text-[34px] leading-[0.95] tracking-tight text-balance mt-1">
            one step left.
          </h1>

          {/* Reg summary card */}
          <div className="rounded-2xl border-[1.5px] border-ink mt-5 p-5 space-y-2">
            <div className="font-mono text-[10px] uppercase opacity-55">your registration</div>
            <div className="font-display text-[22px] leading-tight">{reg.name}</div>
            <div className="font-display text-[16px] opacity-70">{reg.event_name}</div>
            <div className="font-mono text-[11px] tabular-nums opacity-60 pt-1 border-t border-ink/10">
              Reg ID: <strong>{reg.reg_id}</strong>
            </div>
          </div>

          {/* Payment instructions — we no longer publish a UPI ID on-page.
              The event POC sends payment details via WhatsApp once your
              registration is confirmed (usually within an hour or two). */}
          <div
            className="bg-c2 border-[1.5px] border-ink rounded-2xl mt-4 p-4"
            style={{ boxShadow: '3px 3px 0 var(--ink)' }}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] mb-3">★ payment</div>
            <div className="font-display text-[22px] leading-tight">{reg.event_name}</div>
            <p className="font-body text-[14px] mt-3 leading-relaxed text-pretty">
              <strong>Payment details will be sent via WhatsApp</strong> once
              your registration is confirmed. Our POC will reach out shortly —
              keep an eye on your messages.
            </p>
            <div className="mt-2 font-mono text-[11px] opacity-60">
              Reference: {reg.reg_id}
            </div>
          </div>

          {/* Status / auto-refresh indicator */}
          <div className="mt-5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <motion.span
                animate={{ scale: [1, 1.8, 1], opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inline-flex h-full w-full rounded-full bg-c1"
              />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-c1" />
            </span>
            <span className="font-mono text-[11px] opacity-60">
              Checking for confirmation{pollCount > 0 ? ` · checked ${pollCount} time${pollCount > 1 ? 's' : ''}` : ' · auto-checks every 30s'}
            </span>
          </div>

          <div className="mt-2 font-body text-[13px] opacity-55 text-pretty">
            Your barcode ticket will appear here automatically once payment is confirmed. Usually within a few hours on event day.
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
              onClick={() => { setLoading(true); fetchReg() }}
              className="w-full min-h-[48px] border-[1.5px] border-ink font-mono text-[12px] uppercase tracking-[0.08em] hover:bg-ink hover:text-bg transition-colors"
            >
              Check now ↻
            </motion.button>
            <MotionLink
              to="/paradox"
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
              className="w-full min-h-[48px] flex items-center justify-center bg-ink text-bg font-body font-bold"
            >
              Back to paradox →
            </MotionLink>
          </div>
        </div>
      </div>
    )
  }

  const date = reg.paradox_events?.date ?? 'TBA'
  const time = reg.paradox_events?.time ?? 'TBA'
  const venue = reg.paradox_events?.venue ?? 'TBA'

  return (
    <div className="min-h-[100dvh] bg-bg text-ink py-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: #FBF5E6; }
        }
      `}</style>

      <div id="print-root" className="w-full max-w-[420px] mx-auto p-6">
        {/* Ticket card — spring entrance with slight rotation */}
        <motion.div
          initial={{ scale: 0.88, opacity: 0, rotate: -2 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="bg-bg border-[2px] border-ink shadow-[5px_5px_0_#181818]"
        >
          <div className="bg-ink text-bg p-3 px-5 flex justify-between items-baseline">
            <span className="font-display text-[22px] leading-none tracking-tight">
              paradox<span className="text-c1">★</span>
            </span>
            <span className="font-mono text-[10px] tracking-[0.16em] opacity-80">2026 · JUN 1–6</span>
          </div>

          <div className="p-5">
            <div className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-60">PARTICIPANT</div>
            <div className="font-display text-[36px] leading-[0.95] tracking-tight text-balance mt-1">
              {reg.name}
            </div>
            <div className="font-display text-[22px] leading-tight tracking-tight text-balance mt-3">
              {reg.event_name}
            </div>

            {/* Staggered ticket detail rows */}
            <motion.div
              variants={stagger(0.07)}
              initial="hidden"
              animate="show"
              className="mt-3"
            >
              <motion.div
                variants={fadeUp}
                className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] opacity-75"
              >
                {date !== 'TBA' && <span>{date}</span>}
                {time !== 'TBA' && <span>{time}</span>}
                {venue !== 'TBA' && <span>{venue}</span>}
                {date === 'TBA' && time === 'TBA' && venue === 'TBA' && (
                  <span className="opacity-50 italic">venue & time to be announced</span>
                )}
              </motion.div>
              {/* School is nullable as of the form refresh that dropped the
                  input — only render the row when there's something to show
                  so the ticket doesn't have a blank gap underneath. */}
              {reg.school && (
                <motion.div
                  variants={fadeUp}
                  className="font-mono text-[11px] opacity-60 mt-1"
                >
                  {reg.school}
                </motion.div>
              )}
            </motion.div>

            <div className="border-t-[1.5px] border-dashed border-ink my-4" />

            <div className="flex justify-center">
              <svg ref={barcodeRef} />
            </div>
            <div className="font-mono text-[12px] tracking-[0.12em] tabular-nums text-center mt-2">
              {reg.reg_id}
            </div>
          </div>

          <div className="bg-c2 p-2 px-5 border-t-[1.5px] border-ink flex justify-between items-center">
            <span className="font-mono text-[10px] tracking-[0.12em]">ngoaquaterra.com/paradox</span>
            {reg.attended && (
              <span className="font-mono text-[10px] tracking-[0.12em] bg-ink text-c2 px-1.5 py-0.5">
                ✓ ATTENDED
              </span>
            )}
          </div>
        </motion.div>

        <div className="no-print mt-5">
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={{ ...SPRING }}
            onClick={() => window.print()}
            className="bg-ink text-bg p-3.5 w-full min-h-[44px] flex justify-between items-center font-body font-bold"
          >
            <span>Print / Save as PDF</span>
            <span className="font-mono text-[11px] opacity-80">⌘P</span>
          </motion.button>
          <Link
            to="/paradox"
            className="mt-3 block text-center font-mono text-[11px] tracking-[0.12em] uppercase opacity-60"
          >
            ← back to paradox
          </Link>
        </div>
      </div>
    </div>
  )
}
