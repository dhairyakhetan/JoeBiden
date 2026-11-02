import { useEffect, useState } from 'react'
import memberOfMonthService, { currentPeriod, type MemberOfMonthPick } from '../services/memberOfMonthService'
import { Link } from 'react-router-dom'
import MomLemonCard from '../components/MomLemonCard'
import { useAuth } from '../auth/AuthContext'

/**
 * changelog/22-social-engine.md §22.4's second placement: "the honoured
 * member's own profile." `HomePage.tsx`'s right rail already reads
 * `getCurrentForAllTeams()` for the same card - this filters that same read
 * down to picks belonging to THIS member, for the current calendar month
 * only (same "do not fall back to last month's without saying so" rule the
 * rail applies), and renders the shared `MomLemonCard` with no outbound
 * link - "go see their profile" is circular when this already IS their
 * profile.
 *
 * Mounted on both `ProfilePage.tsx` (the member's own view) and
 * `PublicProfilePage.tsx` (anyone else viewing them) - a recognition that
 * only the owner can see is not really surfaced. Takes the member's `uuid`
 * (every caller already has one) rather than a numeric member_id, so
 * PublicProfilePage.tsx doesn't need an extra query just to resolve one -
 * `MemberOfMonthPick` already carries `memberUuid` alongside `memberId`.
 *
 * Decoration around the profile, not required content: a failed read hides
 * the card rather than throwing a toast over someone who came to read a
 * profile.
 *
 * SIGNED-IN VIEWERS ONLY. `member_of_the_month` grants nothing to `anon`
 * (scripts/member_of_the_month_2026_09_05.sql: "the display surface is
 * signed-in only"), so a signed-out visitor to a public profile used to fire a
 * read that was always going to be refused. The page hid the badge correctly,
 * but the service logged every refusal: 161 `client_error_logs` rows across 99
 * sessions between 29 Sep and 8 Oct, none of them a real fault. TeamDetailPage
 * already gates the same read the same way.
 */
export default function MemberOfMonthProfileBadge({ uuid }: { uuid: string }) {
  const { isAuthenticated } = useAuth()
  const [picks, setPicks] = useState<MemberOfMonthPick[] | undefined>(undefined)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    memberOfMonthService.getCurrentForAllTeams()
      .then(all => {
        if (cancelled) return
        setPicks(all.filter(p => p.memberUuid === uuid && p.period === currentPeriod()))
      })
      .catch(() => { if (!cancelled) setPicks([]) })
    return () => { cancelled = true }
  }, [uuid, isAuthenticated])

  if (!isAuthenticated || !picks || picks.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {picks.map(p => <MomLemonCard key={p.teamId} mom={p} linkToProfile={false} />)}
      <Link to="/honours" className="aq-thread-link">all honours →</Link>
    </div>
  )
}
