import Img from '../components/Img'
import { useState, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { I } from '../components/v6Shared'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import Skeleton from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { sanitizeFilterTerm } from '../lib/pgrestEscape'
import { setAuthIntent } from '../lib/authIntent'
import { APPROVAL_TIME } from '../lib/orgFacts'
import './MembersPage.css'

interface MemberRow {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl?: string
  role: string
  schoolName?: string
  createdAt?: string
}

const PAGE_SIZE = 30

// The skeleton has to arrive at the same geometry the real tile does, or the
// grid jumps when data lands (ACCEPTANCE §B). The previous 160/26 pair
// matched nothing: measured, a `.mem-card` is 183px tall on desktop and
// 139px at =<380px (v6.css shrinks .avatar from 84px to 36px there), at a
// 32px radius. So the height cannot be one number - it comes from
// `--mem-skel-h` in MembersPage.css, which carries the same breakpoint as
// the card, and both skeleton blocks below read these two constants so they
// cannot drift from each other again.
const MEM_CARD_H = 'var(--mem-skel-h)'
const MEM_CARD_R = 32

export default function MembersPage() {
  useMeta(pageMetadata.members)
  useJsonLd('members-breadcrumb', breadcrumbLd([['Home', '/'], ['Members', '/members']]))
  const { member: currentMember } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [q, setQ] = useState(() => searchParams.get('q') ?? '')
  const [role, setRole] = useState(() => searchParams.get('role') ?? 'all')

  const [members, setMembers] = useState<MemberRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Sync URL state for shareable filters
  useEffect(() => {
    const next: Record<string, string> = {}
    if (q) next.q = q
    if (role !== 'all') next.role = role
    setSearchParams(next, { replace: true })
  }, [q, role, setSearchParams])

  const fetchMembers = async (currentQ: string, currentRole: string, currentPage: number) => {
    // page 1 = a fresh filter/first load (full skeleton); page > 1 = infinite
    // scroll appending onto the existing list (small "loading more" indicator).
    const append = currentPage > 1
    if (append) setIsLoadingMore(true); else setLoading(true)
    setError(null)
    try {
      const from = (currentPage - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let query = supabaseCommunity
        .from('members')
        .select(
          // No class_grade. The card renders a name, a school and a role and
          // nothing else, so selecting it only shipped 1,327 students' class
          // to every anonymous visitor for a field this page never drew.
          // It is also what let `class_grade` be revoked from anon entirely.
          'member_id, uuid, full_name, avatar_url, role, created_at, schools (name)',
          { count: 'exact' }
        )
        .eq('status', 'active')
        // `member_id` is the tiebreaker, and it is not optional here.
        // `created_at` is massively non-unique on live data - single timestamps
        // are shared by 300, 299, 299, 187 and 150 active rows, so most of the
        // 1,317 members sit inside a handful of ties. With no unique secondary
        // key Postgres may order a tied block differently on each execution,
        // and offset paging then repeats some members and silently skips
        // others across page boundaries. directorService.getMemberDirectory
        // already documents and fixes exactly this; the public page never got
        // the same treatment.
        .order('created_at', { ascending: false })
        .order('member_id', { ascending: true })
        .range(from, to)

      const sanitizedQ = sanitizeFilterTerm(currentQ)
      if (sanitizedQ) query = query.ilike('full_name', `%${sanitizedQ}%`)
      if (currentRole !== 'all') query = query.eq('role', currentRole)

      const { data, count, error: dbError } = await query
      if (dbError) throw dbError

      const rows: MemberRow[] = (data ?? []).map((m: any) => ({
        memberId: m.member_id,
        uuid: m.uuid,
        fullName: m.full_name,
        avatarUrl: m.avatar_url ?? undefined,
        role: m.role ?? 'member',
        schoolName: m.schools?.name ?? undefined,
        createdAt: m.created_at ?? undefined,
      }))
      setMembers(prev => append ? [...prev, ...rows] : rows)
      setTotal(count ?? 0)
    } catch (e: any) {
      // A WRITTEN sentence, never `e.message`. PostgREST speaks Postgres -
      // "permission denied for view member_directory_view", "JWT expired",
      // "duplicate key value violates unique constraint" - and this string is
      // rendered as the page's headline to 14-19 year olds, next to a hint
      // that then contradicts it.
      console.error('[MembersPage] load failed:', e)
      const raw = String(e?.message ?? '')
      setError(/jwt|expired|PGRST301/i.test(raw)
        ? 'your session timed out. sign in again to see the directory.'
        : "we couldn't load the member list.")
      if (!append) { setMembers([]); setTotal(0) }
    } finally {
      if (append) setIsLoadingMore(false); else setLoading(false)
    }
  }

  const hasMore = members.length < total

  // Infinite scroll - bump the page when the sentinel scrolls into view.
  //
  // `loading`/`isLoadingMore` used to sit directly in this effect's own
  // dependency array. Every true->false flip at the end of a page load
  // re-ran the effect, tearing down the observer and creating a fresh one -
  // and `observe()` reports the CURRENT intersection state immediately, so
  // if the sentinel was still inside the 400px rootMargin (routine on a
  // short results list or a tall screen) the new observer fired again right
  // away with no further scrolling, cascading through every remaining page
  // back-to-back. Same bug class already found and fixed once in
  // MemberDirectory.tsx and HomePage.tsx. Fixed the same way: refs read
  // inside the callback instead of dependencies that recreate the observer.
  const loadingRef = useRef(loading)
  loadingRef.current = loading
  const isLoadingMoreRef = useRef(isLoadingMore)
  isLoadingMoreRef.current = isLoadingMore
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && !loadingRef.current && !isLoadingMoreRef.current) {
        setPage(p => p + 1)
      }
    }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore])

  // Debounced fetch on filter change
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => fetchMembers(q, role, page), q ? 250 : 0)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [q, role, page])

  // /profile/:uuid is the self-view (no follow button); /member/:uuid is the
  // public view - only route to /profile when the viewer IS this member.
  const profilePath = (uuid: string) => currentMember?.uuid === uuid ? `/profile/${uuid}` : `/member/${uuid}`


  // Matches the roles that actually exist in live data (confirmed against
  // the HoD desk's own MemberDirectory, which lists all five real roles).
  // 'director' previously sat here as if it were populated - per this
  // project's own architecture notes the live membership has 0 director-role
  // members (hod/director are the same tier, different title; 'hod' is the
  // role value actually used) and 15 super_admin, so tapping "Directors"
  // filtered to a role with nobody in it while the org's actual top tier
  // had no public filter that surfaced them at all.
  const ROLE_FILTERS: Array<[string, string]> = [
    ['all', 'All'],
    ['member', 'Members'],
    ['hod', 'HoDs'],
    ['super_admin', 'Leadership'],
  ]

  return (
    <div className="route-enter">
      <section className="mem-hero">
        <div className="container">
          <span className="sticker sticker-mint wobble sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ DIRECTORY</span>
          <h1 className="h-display mem-h1">
            the <span className="underline-doodle mem-h1-serif">people</span>.
          </h1>
          <p className="muted mem-total">
            {total > 0 ? `${total} active member${total !== 1 ? 's' : ''}` : 'AquaTerra members'}
          </p>
        </div>
      </section>

      <div className="container mem-body">
        {/* Search bar */}
        <div className="mem-search">
          <span className="mem-search-icon"><I.search /></span>
          <input
            placeholder="search by name..."
            value={q}
            onChange={e => { setPage(1); setQ(e.target.value) }}
            autoComplete="off"
            aria-label="Search members by name"
          />
          {q && (
            <button
              className="btn btn-sm mem-search-clear"
              onClick={() => { setQ(''); setPage(1) }}
            >
              clear
            </button>
          )}
        </div>

        {/* Role filters */}
        <div className="mem-filters">
          {ROLE_FILTERS.map(([k, l]) => (
            <button
              key={k}
              className={'chip ' + (role === k ? 'chip-active' : '')}
              onClick={() => { setPage(1); setRole(k) }}
              aria-pressed={role === k}
            >
              {l}
            </button>
          ))}
        </div>

        {/* A failed fetch was a dead end - ErrorState has always supported a
            retry, it just was not wired (ACCEPTANCE §B). */}
        {error && <ErrorState message={error} onRetry={() => fetchMembers(q, role, 1)} className="mb-4" />}

        {loading ? (
          <div className="stag mem-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} variant="block" height={MEM_CARD_H} radius={MEM_CARD_R} />
            ))}
          </div>
        ) : members.length === 0 ? (
          <EmptyState
            title="no members match."
            hint="try a different name or role filter."
            action={
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => { setQ(''); setRole('all'); setPage(1) }}
              >
                clear filters
              </button>
            }
          />
        ) : (
          <>
            <div className="stag mem-grid">
              {members.map(m => {
                const color = hashColor(m.fullName)
                return (
                  // A real <Link>, not a button: /members is in the sitemap
                  // and every tile is a destination, so it needs an href for
                  // middle-click, open-in-new-tab, copy-link and crawlers
                  // (UX-GAPS #20). Keyboard behaviour is unchanged - an
                  // anchor with an href is natively focusable and
                  // Enter-activated.
                  <Link
                    key={m.uuid}
                    to={profilePath(m.uuid)}
                    className="card card-hover mem-card"
                  >
                    <div className="avatar avatar-lg mem-avatar" style={{ background: color }}>
                      {m.avatarUrl
                        ? <Img ctx="avatar" src={m.avatarUrl} alt="" referrerPolicy="no-referrer" />
                        : getInitials(m.fullName)}
                    </div>
                    <div className="mem-name">{m.fullName}</div>
                    {m.schoolName && <div className="mono xs muted mem-school">{m.schoolName}</div>}
                    <span className={'role role-' + m.role + ' mem-role'}>{m.role}</span>
                  </Link>
                )
              })}
            </div>

            {/* Infinite scroll: sentinel + loading-more state + end marker */}
            <div ref={sentinelRef} style={{ height: 1 }} aria-hidden />
            {isLoadingMore && (
              <div className="stag mem-grid" style={{ marginTop: 12 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} variant="block" height={MEM_CARD_H} radius={MEM_CARD_R} />
                ))}
              </div>
            )}
            {!hasMore && members.length > PAGE_SIZE && (
              <div className="mono xs muted mem-end">
                that&apos;s everyone · {total} member{total !== 1 ? 's' : ''}
              </div>
            )}

            {!currentMember && (
              <div className="mem-join">
                <div className="h-display mem-join-h">
                  want to join AquaTerra?
                </div>
                <p className="mem-join-p">
                  apply in 2 minutes. usually replies {APPROVAL_TIME}.
                </p>
                <Link to="/login" className="btn btn-primary" onClick={() => setAuthIntent({ kind: 'apply' })}>Show up with us →</Link>
              </div>
            )}

            {/* No screen is a dead end. The roll of people answers "who", and
                the obvious next question is "doing what, where" - which is the
                map, section 30. One lateral exit, placed after the list rather
                than in front of it. */}
            <Link to="/directory" className="mem-exit">
              <span className="mem-exit-h">the whole map</span>
              <span className="mem-exit-p">
                Every department, every kind of work and every year of it, on one page.
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
