import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import { I } from '../components/v6Shared'
import { useNavigate } from 'react-router-dom'
import { safeExternalHref } from '../lib/safeUrl'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import notificationService, { NotificationRow, NotificationType } from '../services/notificationService'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'

// 08.5 asks for "a 32px avatar or kind glyph". `notifications` (schema atop
// this file) carries no actor avatar column - it's a title/subtitle/link
// row, not a joined actor - so there is nothing to show but the glyph. Never
// an empty box either way: every row always renders one of these.
// The three emoji that used to sit here (💬, 🛡, 📌) are AquaTerra-authored
// chrome, which ACCEPTANCE §F allows no emoji in - they come from the app's
// own SVG glyph set instead. The remaining entries are typographic marks,
// not emoji, and are unchanged.
const ICON_FOR_TYPE: Record<NotificationType, ReactNode> = {
  like: '♥',
  comment: I.comment(),
  tag: '@',
  follow: '+',
  new_post: I.flag(),
  post_approved: '✓',
  post_rejected: '✗',
  team_invite: I.flag(),
  team_join_request: '⤵',
  team_join_accepted: '✓',
  system: '★',
  // changelog/16-profile-wall.md - added so `Record<NotificationType, …>`
  // still covers every member of the union; not part of 08's own restyle.
  wall_note: I.bookmark(),
  break_set: I.flag(),
}

// 22.2's leading circle: "an avatar for a person, a hue disc with a glyph for
// a system event." `notifications` carries no actor reference at all (no
// actor_id/actor_avatar column - confirmed live, see notificationService.ts's
// header comment), so a real per-person avatar isn't buildable without a
// schema change. This ships the achievable half: every row gets a hue disc
// (previously one flat neutral circle for every type), which at least makes
// the kind visually legible at a glance rather than uniform grey.
const HUE_FOR_TYPE: Record<NotificationType, string> = {
  like: 'var(--pink)',
  comment: 'var(--sky)',
  tag: 'var(--grape)',
  follow: 'var(--lemon)',
  new_post: 'var(--grape)',
  post_approved: 'var(--welfare)',
  post_rejected: 'var(--tomato)',
  team_invite: 'var(--grape)',
  team_join_request: 'var(--sky)',
  team_join_accepted: 'var(--welfare)',
  system: 'var(--ink)',
  wall_note: 'var(--lemon)',
  break_set: 'var(--sky)',
}
// Ink passes contrast on every one of the fills above except plain --ink
// itself (system), which needs paper - see tokens.css's measured table.
const PAPER_ON_HUE: Set<NotificationType> = new Set(['system'])

const FILTER_LABEL: Array<[string, string]> = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['like', '♥ Likes'],
  ['comment', 'Comments'],
  ['tag', '@ Tags'],
  ['follow', '+ Follows'],
  ['new_post', 'New posts'],
]

// redesign 08.5: "group by day with a mono uppercase today / yesterday /
// date header." Rows arrive newest-first (notificationService.list()'s own
// .order('created_at', {ascending:false})), so a single sequential pass -
// starting a new group whenever the label changes - preserves that order
// with no extra sort.
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (dt: Date) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
function groupByDay(rows: NotificationRow[]): Array<{ label: string; rows: NotificationRow[] }> {
  const groups: Array<{ label: string; rows: NotificationRow[] }> = []
  for (const r of rows) {
    const label = dayLabel(r.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.rows.push(r)
    else groups.push({ label, rows: [r] })
  }
  return groups
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 60)    return 'just now'
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  if (d < 604800) return `${Math.floor(d / 86400)}d ago`
  if (d < 2592000) return `${Math.floor(d / 604800)}wk ago`
  if (d < 31536000) return `${Math.floor(d / 2592000)}mo ago`
  return `${Math.floor(d / 31536000)}y ago`
}

// 22.2: "batch by kind and object - three comments on one post is one row
// saying so." Likes and comments are the two kinds this app can actually
// receive in volume on one object; both collapse by (type, link) within the
// loaded page into one synthetic display row rather than flooding the list
// with duplicates. 'like' rows are already deduped to ~one stored row per
// (member, post) per rolling day by create_notification()'s own 24h window
// (see notificationService.withLikeDigests, called after this in load()),
// so in practice this rarely has more than one 'like' row per link to fold -
// but 'comment' has NO such server-side dedupe (every comment is still its
// own row, unchanged, "exists today" per spec), so this is where the rule
// actually does its work. Every other notification type is untouched.
const DIGESTABLE: NotificationType[] = ['like', 'comment']
function rollupDigestable(rows: NotificationRow[]): NotificationRow[] {
  const byKey = new Map<string, NotificationRow[]>()
  for (const r of rows) {
    if (!DIGESTABLE.includes(r.type)) continue
    const key = `${r.type}:${r.link ?? `id:${r.id}`}`
    const arr = byKey.get(key)
    if (arr) arr.push(r); else byKey.set(key, [r])
  }
  const seen = new Set<string>()
  const out: NotificationRow[] = []
  for (const r of rows) {
    if (!DIGESTABLE.includes(r.type)) { out.push(r); continue }
    const key = `${r.type}:${r.link ?? `id:${r.id}`}`
    if (seen.has(key)) continue
    seen.add(key)
    const group = byKey.get(key)!
    if (group.length === 1) { out.push(r); continue }
    const latest = group[0]
    out.push({
      ...latest,
      id: `rollup:${key}`,
      title: r.type === 'like' ? `${group.length} people liked` : `${group.length} people commented`,
      subtitle: r.type === 'like' ? 'your post' : 'on your post',
      isRead: group.every(g => g.isRead),
    })
  }
  return out
}

export default function NotificationsPage() {
  useMeta(pageMetadata.notifications)
  const { member } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [unreadCount, setUnreadCount] = useState(0)
  const [markingAll, setMarkingAll] = useState(false)
  const [tick, setTick] = useState(0)

  // Refresh "X minutes ago" labels every minute
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const result = await notificationService.list({ limit: 100 })
      setRows(result.items)
      setUnreadCount(result.totalUnread)
      // Real like counts are decoration, not blocking content - paint the
      // list first, then patch in the digest once the one batched query
      // against post_feed_view lands. Merged by id into whatever `rows` is
      // BY THEN (not the snapshot captured here) so a mark-read the member
      // triggers while this is in flight can't be clobbered when it resolves.
      // A failure here just leaves the original, less-precise rows in place.
      notificationService.withLikeDigests(result.items)
        .then(enriched => {
          const deltas = new Map(enriched.map(r => [r.id, r]))
          setRows(prev => prev.map(r => {
            const d = deltas.get(r.id)
            return d ? { ...r, title: d.title, subtitle: d.subtitle } : r
          }))
        })
        .catch(() => {})
    } catch (e: any) {
      console.error('[NotificationsPage] load failed:', e)
      setFetchError('Could not load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!member?.member_id) return
    load()
  }, [member?.member_id, load])

  // "Mark all read" is an explicit user action, not a silent timer - it used
  // to auto-mark everything read 1.5s after landing on the page, which meant
  // notifications could be flipped to read before the member ever actually
  // saw them (e.g. a quick tab-through). Marking read never removes rows,
  // only their unread state - same optimistic-update-with-rollback shape as
  // before, just triggered by a click instead of a timer.
  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return
    setMarkingAll(true)
    const prevRows = rows
    const prevUnread = unreadCount
    setRows(prev => prev.map(r => ({ ...r, isRead: true })))
    setUnreadCount(0)
    try {
      await notificationService.markAllRead()
      toast.success('marked all as read')
    } catch (e: any) {
      setRows(prevRows)
      setUnreadCount(prevUnread)
      toast.error("Couldn't mark notifications as read", e?.message)
    } finally {
      setMarkingAll(false)
    }
  }

  // Opening a single notification marks just that one read. notificationService
  // .markRead() existed but had zero call sites, so the only way to clear the
  // bell was the "mark all read" button - meaning the badge stayed red after a
  // member had actually read everything, which trains people to ignore it.
  // Optimistic with rollback, matching handleMarkAllRead above. Fire-and-forget
  // on the navigation path: a failed read-flag must not block opening the item.
  const markOneRead = (id: string) => {
    // A digest row (rollupDigestable's synthetic `rollup:{type}:{link}` id)
    // doesn't exist in the DB, so marking IT read must fan out to every real
    // row it folded together - otherwise clicking "3 people commented" left
    // all three still unread underneath, and the badge never moved. The key
    // can only ever collapse a group when `link` is real and shared (a
    // linkless row's key falls back to a per-row-unique `id:{r.id}`, which
    // never matches another row, so rollupDigestable never groups it above
    // length 1) - so parsing it back apart here is safe.
    if (id.startsWith('rollup:')) {
      const key = id.slice('rollup:'.length)
      const sep = key.indexOf(':')
      const kind = key.slice(0, sep)
      const link = key.slice(sep + 1)
      const group = rows.filter(r => r.type === kind && r.link === link && !r.isRead)
      if (group.length === 0) return
      const groupIds = new Set(group.map(g => g.id))
      setRows(prev => prev.map(r => (groupIds.has(r.id) ? { ...r, isRead: true } : r)))
      setUnreadCount(c => Math.max(0, c - group.length))
      notificationService.markManyRead(group.map(g => g.id)).catch(() => {
        setRows(prev => prev.map(r => (groupIds.has(r.id) ? { ...r, isRead: false } : r)))
        setUnreadCount(c => c + group.length)
      })
      return
    }
    const target = rows.find(r => r.id === id)
    if (!target || target.isRead) return
    setRows(prev => prev.map(r => (r.id === id ? { ...r, isRead: true } : r)))
    setUnreadCount(c => Math.max(0, c - 1))
    notificationService.markRead(id).catch(() => {
      setRows(prev => prev.map(r => (r.id === id ? { ...r, isRead: false } : r)))
      setUnreadCount(c => c + 1)
    })
  }

  const toggleNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedNotes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    let src = rows
    if (filter === 'unread') src = rows.filter(r => !r.isRead)
    else if (filter !== 'all') src = rows.filter(r => r.type === filter)
    // Re-derive timeAgo each tick so labels stay fresh
    void tick
    return rollupDigestable(src)
  }, [rows, filter, tick])

  const groups = useMemo(() => groupByDay(filtered), [filtered])

  return (
    <div className="route-enter aq-wrap" style={{ paddingTop: 'clamp(28px, 4vw, 48px)', paddingBottom: 80 }}>
      <span className="sticker sticker-mint wobble sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ NOTIFICATIONS</span>
      <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 className="h-display" style={{ fontSize: 'clamp(44px, 7vw, 72px)', margin: '12px 0 20px', lineHeight: 0.95 }}>
          what's new<span style={{ color: 'var(--pink-ink)' }}>.</span>
          {/* Always mounted (not conditionally rendered) so the live region
              exists in the DOM before its content changes - a region that
              only appears once unreadCount goes from 0 to 1 is not
              guaranteed to have that first announcement picked up. */}
          {/* A badge, not loose red words. As plain text at `vertical-align:
              middle` this sat mid-cap-height beside the heading's full stop,
              which NeutralFace draws as a solid SQUARE at display size - and
              in --pink-ink (#C4185C) against this count's --danger (#C4231A),
              two reds close enough to look like one broken glyph. Reported as
              "looks weird/incomplete". Filling it makes the cluster read as
              punctuation followed by a count, which is what it is.
              --bg on --danger measures 6.6:1. */}
          <span
            aria-live="polite"
            aria-atomic="true"
            style={{
              marginLeft: unreadCount > 0 ? 14 : 0,
              display: 'inline-block',
              padding: unreadCount > 0 ? '4px 10px 3px' : 0,
              borderRadius: 999,
              background: unreadCount > 0 ? 'var(--danger)' : 'transparent',
              // --tomato as text on cream measures 2.93:1 and fails; --danger
              // is the palette's only red that clears AA on this ground, and
              // it carries cream type comfortably as a fill.
              color: unreadCount > 0 ? 'var(--bg)' : 'transparent',
              fontSize: 14,
              fontWeight: 700,
              // --code, not --mono: --mono is NeutralFace, which has no
              // tabular figures, so the count jumped width as it changed.
              fontFamily: 'var(--code)',
              verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {unreadCount > 0 ? `${unreadCount} new` : ''}
          </span>
        </h1>
        <button className="btn btn-sm" onClick={handleMarkAllRead} disabled={unreadCount === 0 || markingAll} style={{ marginBottom: 20 }}>
          {markingAll ? 'marking…' : 'mark all read'}
        </button>
      </div>

      {fetchError && (
        // An error state needs a retry, not just a message (ACCEPTANCE §B) -
        // same shape as SearchPage's `.aqs-well`, wired to the stable `load`
        // callback above. --tomato as text measured 3.3:1 here and failed;
        // --danger-ink is the sanctioned red for words.
        <div role="alert" style={{
          marginBottom: 16,
          padding: '12px 16px',
          borderRadius: 'var(--r-inner)',
          background: 'var(--danger-tint)',
          border: 'var(--hair-3)',
          color: 'var(--danger-ink)',
          fontSize: 14,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span>{fetchError}</span>
          <button type="button" className="btn btn-sm" onClick={load}>try again</button>
        </div>
      )}

      <div className="row gap-2 flex-wrap" style={{ marginBottom: 20 }}>
        {FILTER_LABEL.map(([k, l]) => (
          <button key={k} className={'chip ' + (filter === k ? 'chip-active' : '')} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      {loading ? (
        // 22.2 states: "three row-shaped skeletons at the real geometry."
        <div className="card" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => (
            <div key={i} className="v6-skeleton" style={{ height: 44, borderRadius: 'var(--r-inner)', animationDelay: `${i * 0.06}s` }} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          {filtered.length === 0 ? (
            // 22.2 states: the default (all) empty state is "`nothing yet.` in
            // a cream well with no action - there is nothing to do about
            // having no notifications." A non-default filter turning up empty
            // is a different situation (not addressed by that line), so it
            // keeps its own, pre-existing copy rather than being folded in.
            <div className="notif-empty-well mono xs muted">
              {filter === 'all' ? 'nothing yet.' : 'nothing matches this filter.'}
            </div>
          ) : (
            groups.map(group => (
              <div key={group.label}>
                <div
                  className="mono xs upper muted"
                  style={{ fontWeight: 800, padding: '10px 10px 6px', letterSpacing: '0.06em' }}
                >
                  {group.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {group.rows.map(n => {
                    const isExpanded = expandedNotes.has(n.id)
                    const hasLongNote = Boolean(n.fullNote)
                    const icon = ICON_FOR_TYPE[n.type] ?? '★'
                    // Hoisted out of the JSX so the keyboard handler runs exactly the
                    // same code path as the pointer handler.
                    const activate = () => {
                      // Mark read even when there's nowhere to go - a linkless
                      // notification is still one the member has now seen.
                      markOneRead(n.id)
                      if (!n.link) return
                      // Internal links (/post, /profile, /teams…) route client-side —
                      // a full window.location reload tore down and re-downloaded the
                      // whole SPA on the app's highest-frequency re-engagement tap.
                      // n.link is DB-sourced, so validate the scheme before ever
                      // handing it to window.location (blocks javascript:/forged links).
                      if (n.link.startsWith('/')) { navigate(n.link); return }
                      const safe = safeExternalHref(n.link)
                      if (safe) window.location.href = safe
                    }
                    // 22.2: "approval is the only kind that gets a tinted
                    // ground even once read - it is the one the member has
                    // been waiting for." Every other kind's tint is purely
                    // the unread signal.
                    const tinted = !n.isRead || n.type === 'post_approved'
                    const sentenceText = `${n.title}${n.subtitle ? ' ' + n.subtitle : ''}`
                    const hue = HUE_FOR_TYPE[n.type] ?? 'var(--ink)'
                    return (
                      <div
                        key={n.id}
                        className="notif-row"
                        data-unread={tinted ? '' : undefined}
                        role="button"
                        tabIndex={0}
                        aria-label={`${sentenceText}${n.isRead ? '' : ', unread'}`}
                        style={{ cursor: n.link ? 'pointer' : 'default' }}
                        onClick={activate}
                        onKeyDown={e => {
                          // Only the row itself acts on Enter/Space; the nested
                          // "read more" button keeps its own behaviour.
                          if (e.target !== e.currentTarget) return
                          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate() }
                        }}
                      >
                        {/* 34px leading circle (22.2): a hue disc + glyph for
                            every row. `notifications` carries no actor
                            reference at all - no actor_id/actor_avatar column,
                            confirmed against the live schema - so a real
                            per-person avatar isn't buildable here without a
                            new column; see notificationService.ts. */}
                        <div
                          className="notif-mark"
                          style={{ background: hue, color: PAPER_ON_HUE.has(n.type) ? 'var(--paper)' : 'var(--ink)' }}
                        >
                          {icon}
                        </div>
                        <div className="notif-body">
                          {/* One flowing sentence: the subject (title) at 800,
                              the rest (subtitle) at 400, truncated to a single
                              line - except once expanded to read a full
                              rejection/wall-note reason, which wraps freely. */}
                          <div className="notif-sentence" style={isExpanded && hasLongNote ? { whiteSpace: 'normal' } : undefined}>
                            <span className="notif-subject">{n.title}</span>
                            {isExpanded && hasLongNote ? ` ${n.fullNote}` : n.subtitle ? ` ${n.subtitle}` : ''}
                            {hasLongNote && (
                              <button
                                type="button"
                                className="notif-readmore mono"
                                onClick={(e) => toggleNote(n.id, e)}
                              >
                                {isExpanded ? ' show less ←' : ' read more →'}
                              </button>
                            )}
                          </div>
                          <div className="mono notif-time">{timeAgo(n.createdAt)}</div>
                        </div>
                        {/* 8px unread dot, ALWAYS alongside the background
                            tint above - never colour alone (22.2). Reflects
                            true unread state, not the approval-only tint. */}
                        {!n.isRead && <span className="notif-dot" aria-hidden="true" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
