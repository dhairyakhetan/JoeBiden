// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/utils'
import { fadeUp, stagger, fadeIn, SPRING } from '../lib/motion'
import type { Update } from '../lib/types'

type TagFilter = 'all' | 'announcement' | 'score' | 'winner' | 'reminder' | 'venue_change'

const TAGS: { key: TagFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'score', label: 'SCORE' },
  { key: 'winner', label: 'WINNER' },
  { key: 'announcement', label: 'ANNOUNCEMENT' },
  { key: 'reminder', label: 'REMINDER' },
  { key: 'venue_change', label: 'VENUE CHANGE' },
]

// Active filter pill colors cycle through design tokens
const ACTIVE_COLORS: string[] = [
  'bg-bg text-ink',
  'bg-c3 text-ink',
  'bg-c1 text-bg',
  'bg-c2 text-ink',
  'bg-c1 text-bg',
  'bg-c1 text-bg',
]

const TAG_COLORS: Record<string, { cls: string }> = {
  announcement: { cls: 'bg-bg/15 text-bg' },
  score:        { cls: 'bg-c3/80 text-ink' },
  winner:       { cls: 'bg-c1 text-bg' },
  reminder:     { cls: 'bg-c2 text-ink' },
  venue_change: { cls: 'bg-c1 text-bg' },
}

function tagPillCls(tag: string): string {
  return (TAG_COLORS[tag] ?? { cls: 'bg-bg/15 text-bg' }).cls
}

export function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([])
  const [selectedTag, setSelectedTag] = useState<TagFilter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('paradox_updates')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setUpdates((data as Update[]) ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    if (selectedTag === 'all') return updates
    return updates.filter((u) => u.tag === selectedTag)
  }, [updates, selectedTag])

  return (
    <div className="min-h-[100dvh] bg-ink text-bg" style={{ position: 'relative', zIndex: 1 }}>

      {/* ── Header ── */}
      <div className="bg-ink text-bg px-4 sm:px-8 pt-7 pb-5">
        <div className="max-w-[1280px] mx-auto">
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65">/updates</div>

          {/* Live pulsing dot + Boldonse heading in c2 */}
          <div className="flex items-center gap-3 mt-1">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-c2 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-c2" />
            </span>
            <h1
              className="font-display leading-[0.9]"
              style={{
                fontSize: 'clamp(34px, 6.6vw, 76px)',
                letterSpacing: '-0.025em',
                color: 'var(--c2)',
                textWrap: 'balance',
              }}
            >
              updates.
            </h1>
          </div>

          {/* Filter tag pills */}
          <motion.div
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
            className="flex gap-2 flex-nowrap overflow-x-auto -mx-4 sm:-mx-8 px-4 sm:px-8 pb-1 mt-5 scrollbar-none"
            style={{ WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}
          >
            {TAGS.map((t, idx) => {
              const active = selectedTag === t.key
              const activeColor = ACTIVE_COLORS[idx % ACTIVE_COLORS.length]
              return (
                <motion.button
                  key={t.key}
                  variants={fadeIn}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING}
                  onClick={() => setSelectedTag(t.key)}
                  className={`shrink-0 rounded-full border-[1.5px] border-bg/30 px-3.5 py-1.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors ${
                    active
                      ? `${activeColor} border-transparent`
                      : 'bg-transparent text-bg/60'
                  }`}
                >
                  {t.label}
                </motion.button>
              )
            })}
          </motion.div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="py-5 px-4 sm:px-8 lg:px-12">
        <div className="max-w-[1280px] mx-auto">
          {loading ? (
            <motion.div
              variants={stagger(0.08)}
              initial="hidden"
              animate="show"
              className="space-y-3"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="rounded-2xl border-[1.5px] border-bg/15 p-4 space-y-2"
                >
                  <div className="animate-pulse bg-bg/10 h-5 w-24 rounded-full" />
                  <div className="animate-pulse bg-bg/10 h-6 w-3/4 rounded-lg" />
                  <div className="animate-pulse bg-bg/10 h-4 w-full rounded-lg" />
                  <div className="animate-pulse bg-bg/10 h-4 w-2/3 rounded-lg" />
                </motion.div>
              ))}
            </motion.div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <h2
                className="font-display opacity-15 leading-none"
                style={{
                  fontSize: 'clamp(34px, 6.6vw, 76px)',
                  letterSpacing: '-0.025em',
                  textWrap: 'balance',
                }}
              >
                nothing yet.
              </h2>
              <p className="font-mono text-[11px] tracking-[0.12em] uppercase opacity-40 mt-3">
                check back during the event.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={selectedTag}
                variants={stagger(0.07)}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {filtered.map((u) => (
                  <motion.article
                    key={u.id}
                    layout
                    variants={fadeUp}
                    exit={{ opacity: 0, y: -6, transition: { type: 'spring', stiffness: 300, damping: 28 } }}
                    className="rounded-2xl border-[1.5px] border-bg/15 p-4"
                    style={{ boxShadow: u.pinned ? '4px 4px 0 var(--c2)' : 'none' }}
                  >
                    {/* Top row: tag pill, pinned star, timestamp */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <motion.span
                        variants={fadeIn}
                        className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] uppercase ${tagPillCls(u.tag)}`}
                      >
                        {u.tag.replace('_', ' ')}
                      </motion.span>
                      {u.pinned && (
                        <motion.span
                          variants={fadeIn}
                          className="shrink-0 font-mono text-[10px] tracking-[0.08em] uppercase"
                          style={{ color: 'var(--c2)' }}
                        >
                          ★ pinned
                        </motion.span>
                      )}
                      <span className="font-mono text-[10px] opacity-45 ml-auto tabular-nums shrink-0">
                        {timeAgo(u.created_at)}
                      </span>
                    </div>

                    {/* Title — font-body for legibility on short phrases */}
                    <h2
                      className="font-body text-[15px] font-semibold leading-snug mt-2"
                      style={{ textWrap: 'balance' }}
                    >
                      {u.title}
                    </h2>

                    {/* Body */}
                    <p
                      className="font-body text-[13px] opacity-70 mt-1.5"
                      style={{ lineHeight: 1.55, textWrap: 'pretty' }}
                    >
                      {u.body}
                    </p>

                    {/* Event name badge */}
                    {u.event_name && (
                      <span className="rounded-full border-[1.5px] border-bg/20 text-bg px-2.5 py-0.5 font-mono text-[9px] tracking-[0.08em] uppercase mt-2 inline-block opacity-70">
                        {u.event_name}
                      </span>
                    )}
                  </motion.article>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
