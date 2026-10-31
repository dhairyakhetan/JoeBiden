// @ts-nocheck
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { Event, Score } from '../lib/types'
import { fadeUp, stagger, SPRING } from '../lib/motion'
import { EVENT_IS_OVER } from '../lib/eventFacts'

// Event filter pill active colors (cycling)
const FILTER_ACTIVE_COLORS = [
  'bg-ink text-bg',
  'bg-c1 text-bg',
  'bg-c2 text-ink',
  'bg-c3 text-ink',
  'bg-c1 text-bg',
]

export function ScoresPage() {
  const [events, setEvents] = useState<Event[] | null>(null)
  const [scores, setScores] = useState<Score[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeEvent, setActiveEvent] = useState<string>('all')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [{ data: ev }, { data: sc }] = await Promise.all([
        supabase
          .from('paradox_events')
          .select('id, name, slug, date, category')
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('paradox_scores')
          .select('*')
          .order('event_name')
          .order('position', { ascending: true, nullsFirst: false }),
      ])
      if (!mounted) return
      setEvents((ev as Event[]) ?? [])
      setScores((sc as Score[]) ?? [])
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Group scores by event_id (stable — survives event renames, deduplicates properly)
  const grouped: Record<string, Score[]> = {}
  if (scores) {
    for (const s of scores) {
      const key = s.event_id
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(s)
    }
  }
  const groupKeys = Object.keys(grouped)

  // Resolve a human-readable name from event_id
  function getEventName(id: string): string {
    const ev = events?.find((e) => e.id === id)
    if (ev) return ev.name
    return grouped[id]?.[0]?.event_name ?? id
  }

  // Filtered group keys based on activeEvent (now stores event_id)
  const visibleKeys = activeEvent === 'all' ? groupKeys : groupKeys.filter((k) => k === activeEvent)

  function rankStyle(pos: number | null): { color: string; opacity: number } {
    if (pos === 1) return { color: 'var(--c2)', opacity: 1 }
    if (pos === 2) return { color: 'var(--c3)', opacity: 1 }
    if (pos === 3) return { color: 'var(--c3)', opacity: 1 }
    return { color: 'currentColor', opacity: 0.35 }
  }

  function rankLabel(pos: number | null, fallback: number): string {
    if (pos === 1) return '01'
    if (pos === 2) return '02'
    if (pos === 3) return '03'
    return String(fallback + 1).padStart(2, '0')
  }

  const filterKeys = ['all', ...groupKeys]

  return (
    <div className="min-h-[100dvh] bg-bg text-ink" style={{ position: 'relative', zIndex: 1 }}>

      {/* ── Header ── */}
      <motion.header
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="bg-ink text-bg px-4 sm:px-8 pt-7 pb-5 border-b-[1.5px] border-bg/10"
      >
        <div className="max-w-[1280px] mx-auto">
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65">/scores</div>
          <h1
            className="font-display text-bg leading-[0.9] mt-1"
            style={{
              fontSize: 'clamp(34px, 6.6vw, 76px)',
              letterSpacing: '-0.025em',
              textWrap: 'balance',
            }}
          >
            scores.
          </h1>
          <p className="font-body text-[13px] opacity-55 mt-2 tabular-nums">
            {/* "updated live" was still on screen two months after the event
                wrapped, next to a footer that said WRAPPED. */}
            <span className="tabular-nums">{scores?.length ?? 0}</span> entries ·{' '}
            {EVENT_IS_OVER ? 'final' : 'updated live'}
          </p>

          {/* Event filter pills */}
          {!loading && groupKeys.length > 0 && (
            <div
              className="flex gap-2 flex-nowrap overflow-x-auto -mx-4 sm:-mx-8 px-4 sm:px-8 pb-1 mt-5 scrollbar-none"
              style={{ WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}
            >
              {filterKeys.map((key, idx) => {
                const active = activeEvent === key
                const activeColor = FILTER_ACTIVE_COLORS[idx % FILTER_ACTIVE_COLORS.length]
                return (
                  <motion.button
                    key={key}
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING}
                    onClick={() => setActiveEvent(key)}
                    className={`shrink-0 rounded-full border-[1.5px] border-bg/30 px-3.5 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors ${
                      active
                        ? `${activeColor} border-transparent`
                        : 'bg-transparent text-bg/60'
                    }`}
                  >
                    {key === 'all' ? 'ALL' : getEventName(key)}
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      </motion.header>

      {/* ── Body ── */}
      {loading ? (
        <div className="px-4 sm:px-8 lg:px-12 max-w-[1280px] mx-auto py-6 space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="animate-pulse bg-ink/10 h-7 w-1/2 rounded-xl" />
              <div className="animate-pulse bg-ink/10 h-14 rounded-xl" />
              <div className="animate-pulse bg-ink/10 h-14 rounded-xl" />
              <div className="animate-pulse bg-ink/10 h-14 rounded-xl" />
            </div>
          ))}
        </div>
      ) : !scores || scores.length === 0 ? (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-24 text-center">
          <h2
            className="font-display opacity-15 leading-none"
            style={{
              fontSize: 'clamp(34px, 6.6vw, 76px)',
              letterSpacing: '-0.025em',
              textWrap: 'balance',
            }}
          >
            {EVENT_IS_OVER ? 'scores not published.' : 'no scores yet.'}
          </h2>
          <p className="font-mono text-[11px] opacity-40 uppercase tracking-[0.1em] mt-3">
            {EVENT_IS_OVER
              ? 'paradox 2026 has wrapped — scores were not posted here.'
              : 'results will appear here during the event.'}
          </p>
        </div>
      ) : (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 py-5 sm:py-6 space-y-5 sm:space-y-8">
          {visibleKeys.map((evId) => {
            const rows = grouped[evId]
            const firstRound = rows[0]?.round
            return (
              <section key={evId}>
                {/* Event name header */}
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-60px' }}
                  className="flex items-baseline justify-between gap-3 mb-3"
                >
                  <h2
                    className="font-display leading-tight"
                    style={{
                      fontSize: 'clamp(20px, 3vw, 32px)',
                      letterSpacing: '-0.02em',
                      textWrap: 'balance',
                    }}
                  >
                    {getEventName(evId)}
                  </h2>
                  {firstRound ? (
                    <span className="font-mono text-[10px] opacity-55 uppercase tracking-wider shrink-0">
                      {firstRound}
                    </span>
                  ) : null}
                </motion.div>

                {/* Score rows */}
                <motion.ul
                  variants={stagger(0.06)}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-60px' }}
                  className="space-y-2"
                >
                  {rows.map((s, i) => {
                    const pos = s.position
                    const isPodium = pos === 1 || pos === 2 || pos === 3
                    const rs = rankStyle(pos)
                    return (
                      <motion.li
                        key={s.id}
                        variants={fadeUp}
                        transition={SPRING}
                        className="rounded-xl border-[1.5px] border-ink/20 flex items-center gap-4 px-4 py-3 bg-bg"
                        style={isPodium ? { boxShadow: '3px 3px 0 var(--ink)', borderColor: 'var(--ink)' } : undefined}
                      >
                        {/* Rank number */}
                        <span
                          className="font-display tabular-nums shrink-0"
                          style={{
                            fontSize: isPodium ? '32px' : '20px',
                            lineHeight: 1,
                            color: rs.color,
                            opacity: rs.opacity,
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {rankLabel(pos, i)}
                        </span>

                        {/* Team info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-body text-[15px] sm:text-[16px] font-semibold leading-none truncate">
                            {s.team_name}
                          </div>
                          <div className="font-mono text-[11px] mt-1 truncate opacity-70">
                            {s.school}
                          </div>
                        </div>

                        {/* Score */}
                        <span className="font-mono text-[14px] font-bold tabular-nums shrink-0 text-right" style={{ opacity: 0.85 }}>
                          {s.score}
                        </span>
                      </motion.li>
                    )
                  })}
                </motion.ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
