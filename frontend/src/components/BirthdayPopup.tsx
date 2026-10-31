import GlyphIcon from './GlyphIcon'
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { useAuth } from '../auth/AuthContext'
import { ConfettiBurst } from './ConfettiBurst'
import useDialog from '../hooks/useDialog'

interface BirthdayEvent {
  postUuid: string
  name: string
  authorId: number
}

// The exact template create_birthday_notice() inserts (birthday_notice_
// board_2026_08_31.sql). APPLIED live 2026-09-10 - the RPC now exists, so this
// component can fire. It will still stay quiet in practice until members opt
// in: `birthday_public` defaults to false and, measured at apply time, 9 of
// 1,379 members had a birthday on file and none had opted in. That is the
// opt-in working, not a fault. Parsing the name straight out of the body
// avoids a second lookup -
// the RPC already composed it server-side, and the post uuid alone is
// enough to link to it (wishes are comments on that post, not a DM to the
// member - see the migration's own header for why).
const BIRTHDAY_BODY_RE = /^🎂 It's (.+?)'s birthday today!/

/**
 * The public half of the birthday feature, LinkedIn-style: when
 * create_birthday_notice() publishes a member's birthday post, everyone
 * currently online sees a brief full-screen celebration (not just a feed
 * card - the user asked for this scale explicitly, overriding the smaller
 * notice-board-only version the original design doc sketched). Wishing
 * happens where the design doc puts it: as a comment on the post itself,
 * reusing the existing comments/likes tables - this component only ever
 * announces, it never invents a second "wish" mechanism.
 *
 * Realtime, not polling: subscribes to INSERTs on `posts` globally and
 * pattern-matches the body. Session-deduped (a re-subscribe or a second tab
 * shouldn't repeat the same post's celebration), skipped for the birthday
 * member's own tab (they already got the private acknowledgement card
 * moments earlier - see ProfilePage.tsx), and skipped while any other
 * overlay is open rather than stacking on top of it.
 */
export default function BirthdayPopup() {
  const { member, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [active, setActive] = useState<BirthdayEvent | null>(null)
  const seenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isAuthenticated) return
    const channel = supabaseCommunity
      .channel('birthday-notices')
      .on(
        'postgres_changes',
        // FILTERED SERVER-SIDE (audit 2026-09-17, efficiency P3). This used to
        // subscribe to every INSERT on `posts` and discard the ~99% that were
        // not birthdays with the regex below - so every post anyone created
        // anywhere pushed a realtime message to every signed-in session, all
        // day, to catch an event that fires at most once per member per year.
        //
        // create_birthday_notice() always inserts with category='content'
        // (scripts/birthday_notice_board_2026_08_31.sql:103-109), so that is a
        // safe narrowing: it cannot miss a birthday notice, and it drops every
        // welfare/events/labs post before it reaches the browser. The regex
        // stays as the actual identity check, because 'content' is not unique
        // to birthdays.
        //
        // The cleaner fix is a dedicated column or table so the filter can be
        // exact rather than merely narrow; that needs a migration and is
        // deferred with the rest of the database work.
        { event: 'INSERT', schema: 'public', table: 'posts', filter: 'category=eq.content' },
        (payload: any) => {
          const row = payload.new
          if (!row || row.status !== 'published') return
          const match = typeof row.body === 'string' ? row.body.match(BIRTHDAY_BODY_RE) : null
          if (!match) return
          if (seenRef.current.has(row.uuid)) return
          if (row.author_id === member?.member_id) return // they already saw the private card
          if (document.body.style.overflow === 'hidden') return // don't stack over an open overlay
          seenRef.current.add(row.uuid)
          setActive({ postUuid: row.uuid, name: match[1], authorId: row.author_id })
        },
      )
      .subscribe()
    return () => { supabaseCommunity.removeChannel(channel) }
  }, [isAuthenticated, member?.member_id])

  // Auto-dismiss - a celebration that outstays its welcome becomes an
  // annoyance, and nobody should have to hunt for a close button on a
  // full-screen overlay that isn't blocking anything important.
  useEffect(() => {
    if (!active) return
    const t = setTimeout(() => setActive(null), 6000)
    return () => clearTimeout(t)
  }, [active])

  const dismiss = () => setActive(null)
  // The overlay claims `aria-modal="true"`, so it owes a keyboard user the four
  // behaviours behind that claim: Escape, a Tab trap, focus moved into the panel
  // and focus handed back to whatever held it when the celebration closes. It
  // appears unprompted over the feed, so without these a keyboard user is
  // stranded behind a dialog they never asked for.
  const panelRef = useDialog(!!active, dismiss)
  const wishThem = () => {
    if (!active) return
    navigate(`/post/${active.postUuid}`)
    setActive(null)
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`${active.name}'s birthday`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismiss}
          style={{
            position: 'fixed', inset: 0, zIndex: 9500, outline: 'none',
            background: 'rgba(10, 10, 10, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          {!reducedMotion && <ConfettiBurst x={typeof window !== 'undefined' ? window.innerWidth / 2 : 0} y={typeof window !== 'undefined' ? window.innerHeight / 2 - 60 : 0} onDone={() => {}} />}
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={reducedMotion ? { duration: 0.15 } : { type: 'spring', duration: 0.4, bounce: 0.35 }}
            style={{
              // rounded-minimalism: 2px ink -> hairline, 6px hard offset ->
              // --lift-4 (modal panel), 24 -> --r-outer (32) on the spine.
              background: 'var(--card)', border: 'var(--hair-2)',
              boxShadow: 'var(--lift-4)', borderRadius: 'var(--r-outer)',
              padding: '32px 28px', maxWidth: 380, width: '100%', textAlign: 'center',
            }}
          >
            <GlyphIcon name="cake" size={72} />
            <h2 className="h-display" style={{ fontSize: 28, margin: '14px 0 6px', lineHeight: 1.05 }}>
              happy birthday, <span style={{ color: 'var(--welfare-ink)' }}>{active.name}</span>!
            </h2>
            <p className="muted" style={{ fontSize: 14, margin: '0 0 20px' }}>
              the whole community's saying it today. add your wish below.
            </p>
            <div className="row gap-2" style={{ justifyContent: 'center' }}>
              <button className="btn btn-sm" onClick={dismiss}>maybe later</button>
              <button className="btn btn-sm btn-primary" onClick={wishThem}>wish them →</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
