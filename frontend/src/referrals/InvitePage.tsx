import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../components/Toast'
import { referralService } from '../services/referralService'
import { REFERRAL_TIERS, badgeTier, nextTierGap, type Referral } from '../lib/referrals'
import InviteComposer from './InviteComposer'
import MyInvites from './MyInvites'
import './referrals.css'

/**
 * `/invite` — the referrer's whole surface. Section 15, cards R1 and R2 of
 * AQ Referrals.dc.html, on one page: mint a link, see what happened to the
 * ones already sent, see your tier.
 *
 * ── THE BADGE FIGURE IS NOT INVENTED ──
 * "N members brought in" needs `select count(*) from members where
 * referred_by = me`. That read is LIVE as of 2026-09-05: `authenticated` now
 * holds SELECT on `members.referred_by` (checked against
 * `information_schema.column_privileges`, not assumed from a .sql file), so
 * the badge is a real number rather than the dashed marker it shipped as.
 *
 * `broughtInCount()` still returns null rather than 0 when the read fails for
 * any reason, and null still renders the dashed live marker. That branch is
 * not dead code waiting on a grant any more; it is the rule that a figure with
 * no source is never printed. A zero is a claim, and `1,247` is on this
 * project's record as what happens when a plausible figure gets typed in
 * instead.
 *
 * ── NO COUNT THAT READS AS PRESSURE ──
 * The tier line describes the member's own record and stops there. There is
 * no "N people are waiting", no leaderboard and no countdown.
 */
export default function InvitePage() {
  const toast = useToast()
  const [invites, setInvites] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [brought, setBrought] = useState<number | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const [mine, count] = await Promise.all([
        referralService.listMine(),
        referralService.broughtInCount(),
      ])
      setInvites(mine)
      setBrought(count)
    } catch (err) {
      // The toast disappears; what STAYS on screen was "no invites yet. Make
      // one above" - which reads as a fact about the member and invites them
      // to mint a duplicate of a link they may already have sent.
      setLoadFailed(true)
      toast.error('Could not load your invites.', err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void load() }, [load])

  const onCreated = useCallback((r: Referral) => {
    setInvites(prev => [r, ...prev])
  }, [])

  const tier = badgeTier(brought)
  const gap = nextTierGap(brought)

  return (
    <main className="aq-ref-page route-enter">
      <p className="aq-ref-kicker">referrals</p>
      <h1 className="aq-ref-title">members bring members.</h1>
      <p className="aq-ref-lede">
        Any approved member can invite, as often as they like. Send one person a link and
        write a line about why. An HoD reads that line next to their application.
      </p>

      <InviteComposer onCreated={onCreated} />

      <section className="aq-ref-card" aria-labelledby="aq-ref-badge-h">
        <h2 id="aq-ref-badge-h" className="aq-ref-h2">your badge</h2>
        {tier === null || brought === null ? (
          <p className="aq-ref-badgeline">
            <span className="aq-ref-live">live</span>
            {' '}your count is read at render and is not available yet.
          </p>
        ) : (
          <p className="aq-ref-badgeline">
            <span className="aq-ref-tier">tier {tier}</span>
            {' '}you have brought in {brought === 1 ? '1 member' : `${brought} members`}
            {gap !== null ? `, ${gap} more for the next tier` : ', the top tier'}
          </p>
        )}
        <p className="aq-ref-fine">
          tiers are at {REFERRAL_TIERS.join(', ')} members. They are the only reward, so there
          is nothing to farm.
        </p>
      </section>

      <section className="aq-ref-card" aria-labelledby="aq-ref-list-h">
        <h2 id="aq-ref-list-h" className="aq-ref-h2">your invites</h2>
        <p className="aq-ref-fine">
          Opens are counted from the link itself. Whether someone applied, and whether they
          were approved, is set by the HoD who reads the application.
        </p>
        <MyInvites invites={invites} loading={loading} loadFailed={loadFailed} onChanged={() => void load()} />
      </section>
    </main>
  )
}
