import { useEffect, useRef, useState } from 'react'
import { referralService } from '../services/referralService'
import { APPROVAL_TIME } from '../lib/orgFacts'
import './referrals.css'

/**
 * R3, the invitee's side: the block that sits on the sign-in screen when
 * someone arrives on `/login?ref=…`.
 *
 * ── WHAT IT DELIBERATELY DOES NOT SAY ──
 * The canvas prints the referrer's initials, their first name, the team they
 * chose and the note they wrote: "Kushal invited you into Media, Design",
 * "kushal's note". None of it ships, for two independent reasons that agree:
 *
 *   • There is no opt-in-to-be-named column on `members`. `lib/authCopy.ts`
 *     made the same call for the same reason and its comment is the record.
 *   • `referrals` SELECT is `referrer_id = current_member_id() OR
 *     is_director()`. A signed-out visitor holding the link cannot read the
 *     row at all, so the name and the note are not merely withheld by policy,
 *     they are unreachable. Anything this component claimed about them would
 *     have to come out of the URL, which is a claim, not a source.
 *
 * So the block says a member sent them here, which is true and is the only
 * part that matters to the person reading it, and leaves the headline to
 * `pickAuthCopy`, whose `referral.ref` and `referral.role` rules already own
 * that string. This component adds the context line under it, never a second
 * headline competing with the first.
 *
 * ── THE CLICK ──
 * Landing here logs one row in `referral_clicks`, whose INSERT is granted to
 * `anon` as well as `authenticated`, because the person following an invite
 * usually has no session yet. The insert is fire and forget: a click that
 * cannot be logged must never block the sign-in they came for. Nothing about
 * the click is rendered. SELECT on that table is the referrer or a leader, so
 * there is no public click counter here or anywhere.
 */
export default function ReferralInviteBanner({ referralId }: { referralId: string | null }) {
  const [logged, setLogged] = useState(false)
  const firedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!referralId) return
    // Guard on the id, not a boolean: a `.includes`-style guard that survives
    // the thing it is guarding is not an idempotency check, and React 18's
    // double-invoked effects in development would otherwise log two clicks.
    if (firedFor.current === referralId) return
    firedFor.current = referralId
    void referralService.recordClick(referralId).then(setLogged)
  }, [referralId])

  if (!referralId) return null
  // `logged` is read only so the promise is not dangling; the block renders
  // the same either way, because a failed click log is not the visitor's
  // problem and must not change what they see.
  void logged

  return (
    <aside className="aq-ref-invite" aria-label="you were invited">
      <span className="aq-ref-invite-tag">invited</span>
      <p className="aq-ref-invite-body">
        A member sent you this link. Their team reads your application first, and an HoD
        approves every member, usually {APPROVAL_TIME}. Same button whether you have an
        account or not.
      </p>
    </aside>
  )
}
