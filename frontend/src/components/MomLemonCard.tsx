import { Link } from 'react-router-dom'
import Img from './Img'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { formatPeriod, type MemberOfMonthPick } from '../services/memberOfMonthService'
import './MomLemonCard.css'

interface MomLemonCardProps {
  mom: MemberOfMonthPick
  /**
   * Defaults to true (links out to the member's profile, per the home rail's
   * "See their month" placement). Pass false on the honoured member's OWN
   * profile (changelog/22-social-engine.md §22.4's second placement) - a
   * "go see them" link back to the page you are already on is circular, so
   * that instance renders as a static card with no outbound CTA instead.
   */
  linkToProfile?: boolean
}

/**
 * The one lemon-card presentation for changelog/22-social-engine.md §22.4:
 * a var(--r-outer) lemon fill with the poster's faint grid, a tilted ink-bordered
 * photo with the pink MoM burst, the mono "★ member of the month" kicker, the
 * name at 900/23px/var(--display), period and team as ink pills, and the
 * citation in a white card. It mirrors the Member of the Month story poster.
 * Shared by public/HomePage.tsx's right-rail (and phone) instance and the
 * profile placement below it, so there is exactly one card, not two forks of
 * one - see README.md's "if you end up with two X, one of them is wrong."
 *
 * Full-opacity `var(--ink)` throughout, never an alpha of it - the lemon
 * fill is exactly the saturated-hue case README.md's contrast note calls
 * out by name ("the MotM card's period line").
 *
 * `See what he did` / `See what she did` is the gendered pattern `15.4`
 * already flagged once (`Wish her`, itself only sample copy in the unrouted
 * feed/cards/CardCatalogue.tsx dev surface - see the PR report) - this uses
 * the neutral `See their month` everywhere the card appears, per 22.4.
 */
export default function MomLemonCard({ mom, linkToProfile = true }: MomLemonCardProps) {
  const body = (
    <>
      <span className="mono mom-lemon-kicker">★ member of the month</span>
      {/* The poster's photo card: a tilted square with an ink border, and the
          pink "MoM" burst on its corner (components/StoryGenerator sMemberOfMonth). */}
      <div className="mom-lemon-photo">
        <div className="avatar mom-lemon-avatar" style={{ background: hashColor(mom.memberName), overflow: 'hidden' }}>
          {mom.memberAvatarUrl
            ? <Img ctx="avatar" src={mom.memberAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
            : getInitials(mom.memberName)}
        </div>
        <span className="mom-lemon-burst" aria-hidden>MoM</span>
      </div>
      <div className="mom-lemon-name">{mom.memberName}</div>
      <div className="mom-lemon-pills">
        <span className="mono mom-lemon-pill">{formatPeriod(mom.period)}</span>
        <span className="mono mom-lemon-pill">{mom.teamName}</span>
      </div>
      {mom.citation && <p className="mom-lemon-citation">{mom.citation}</p>}
    </>
  )

  if (!linkToProfile) {
    // The honoured member's own profile (changelog/22.4's second placement): a
    // static card with no outbound CTA. The poster's pink MoM burst on the photo
    // is the celebration; the old corner Sticker here doubled it and is gone.
    return <div className="mom-lemon">{body}</div>
  }

  return (
    <Link to={`/member/${mom.memberUuid}`} className="mom-lemon">
      {body}
      <span className="mom-lemon-cta">See their month →</span>
    </Link>
  )
}
