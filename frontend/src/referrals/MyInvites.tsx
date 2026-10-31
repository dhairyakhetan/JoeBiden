import { useCallback, useState } from 'react'
import { count } from '../lib/uiHelpers'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { referralService } from '../services/referralService'
import Skeleton from '../components/Skeleton'
import {
  REFERRAL_STATE_COPY,
  REFERRAL_STEPS,
  daysLeft,
  deriveReferralState,
  type Referral,
  type ReferralState,
} from '../lib/referrals'

/**
 * R2, the referrer's tracker: what happened to each link they sent.
 *
 * Design reference AQ Referrals.dc.html card R2 ("your invites."), with two
 * deliberate departures, both forced by the live RLS policies:
 *
 *   1. THE TRACKER NEVER NAMES THE INVITEE. The canvas rows read "Avantika
 *      Keswani, applied 2 days ago". There is no join from a referral to the
 *      person who used it, and the 2026-09-05 grant did not create one:
 *      `referrals` has no invitee column, and `members.referred_by` records
 *      WHO referred a member, never WHICH link they followed. A referrer with
 *      two open invites and one new member cannot be told which of the two
 *      rows earned them, because the database does not know either. A row is
 *      identified by what the referrer wrote on it, which is the note and the
 *      role, and by when they sent it.
 *
 *   2. THE FOURTH STEP IS NOT A CONTROL. `referrals` UPDATE is `is_director()`
 *      on USING and WITH CHECK, so a member cannot move their own referral to
 *      accepted. The four steps render as a progress track with the reached
 *      ones filled, and `approved` carries the words "only an HoD can set
 *      this" in its hint. Nothing on this screen is clickable that would
 *      imply otherwise. The single destructive control is `withdraw`, which
 *      maps to the DELETE policy the member really does hold.
 *
 * Click counts come from `referral_clicks`, whose SELECT is the referrer of
 * that referral or a leader. They are shown here and on the HoD desk, and
 * nowhere public. There is no public click counter.
 */

function stepIndex(state: ReferralState): number {
  const i = REFERRAL_STEPS.indexOf(state)
  // `expired` is not a step. It sits off the track and dims the whole row.
  return i === -1 ? 0 : i
}

export default function MyInvites({
  invites,
  loading,
  loadFailed,
  onChanged,
}: {
  invites: Referral[]
  loading: boolean
  /** The load FAILED, as opposed to the member having no invites. */
  loadFailed?: boolean
  onChanged: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [busyId, setBusyId] = useState<string | null>(null)

  const withdraw = useCallback(async (r: Referral) => {
    const ok = await confirm({
      title: 'withdraw this invite?',
      body: 'The link stops working straight away. Anyone who already applied through it keeps their application.',
      confirmLabel: 'withdraw it',
      danger: true,
    })
    if (!ok) return
    setBusyId(r.id)
    try {
      await referralService.remove(r.id)
      toast.success('Invite withdrawn.')
      onChanged()
    } catch (err) {
      toast.error('Could not withdraw that invite.', err instanceof Error ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }, [confirm, onChanged, toast])

  if (loading) {
    return (
      <ul className="aq-ref-list" role="status" aria-busy="true">
        <span className="sr-only">loading your invites…</span>
        {[0, 1].map(i => (
          <li key={i} className="aq-ref-row" aria-hidden="true" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="aq-ref-rowhead">
              <Skeleton variant="line" width={90} height={13} />
              <Skeleton variant="pill" width={64} height={20} />
            </div>
            <Skeleton variant="line" width="70%" height={22} style={{ marginTop: 12 }} />
            <div className="aq-ref-rowfoot" style={{ marginTop: 14 }}>
              <Skeleton variant="line" width={110} height={12} />
              <Skeleton variant="pill" width={76} height={28} />
            </div>
          </li>
        ))}
      </ul>
    )
  }

  if (loadFailed && !invites.length) {
    // Not "no invites yet" - that reads as a fact about the member and invites
    // them to mint a duplicate of a link they may already have sent.
    return (
      <p className="aq-ref-empty" role="alert">
        couldn’t load your invites. That’s a connection problem, not an empty
        list - don’t make a new one yet.
      </p>
    )
  }

  if (!invites.length) {
    return (
      <p className="aq-ref-empty">
        no invites yet. Make one above and send it to one person you would actually vouch for.
      </p>
    )
  }

  return (
    <ul className="aq-ref-list">
      {invites.map(r => {
        const state = deriveReferralState(r)
        const reached = stepIndex(state)
        const left = daysLeft(r.expiresAt)
        const busy = busyId === r.id
        return (
          <li key={r.id} className={`aq-ref-row${state === 'expired' ? ' is-expired' : ''}${busy ? ' is-busy' : ''}`}>
            <div className="aq-ref-rowhead">
              <span className="aq-ref-rowtitle">
                {r.openingId !== null ? 'role invite' : 'open invite'}
              </span>
              <span className="aq-ref-state" title={REFERRAL_STATE_COPY[state].hint}>
                {REFERRAL_STATE_COPY[state].label}
              </span>
            </div>

            {r.note && <p className="aq-ref-rownote">{r.note}</p>}

            {/* The track. Non-interactive by design: see note 2 above. */}
            <ol className="aq-ref-track" aria-label={`progress: ${REFERRAL_STATE_COPY[state].label}`}>
              {REFERRAL_STEPS.map((s, i) => (
                <li
                  key={s}
                  className={`aq-ref-step${state !== 'expired' && i <= reached ? ' is-on' : ''}`}
                  title={REFERRAL_STATE_COPY[s].hint}
                >
                  {REFERRAL_STATE_COPY[s].label}
                </li>
              ))}
            </ol>

            <div className="aq-ref-rowfoot">
              <span className="aq-ref-meta">
                {state === 'expired'
                  ? 'expired'
                  : left !== null
                    ? `${count(left, 'day')} left`
                    : 'no expiry'}
                {' · '}
                {r.clicks === 1 ? '1 open' : `${r.clicks} opens`}
              </span>
              <button
                type="button"
                className="aq-ref-btn aq-ref-btn-quiet"
                onClick={() => void withdraw(r)}
                disabled={busy}
              >
                {busy ? 'withdrawing…' : 'withdraw'}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
