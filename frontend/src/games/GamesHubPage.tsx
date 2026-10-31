import './games.css'
import { Link } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { GAMES } from './games'

/** /games: every mini game as a card. Empty state until the first game is registered in games.ts. */
export default function GamesHubPage() {
  useMeta(pageMetadata.games)
  return (
    <div className="gm-wrap">
      <p className="gm-kicker">mini games</p>
      <h1 className="h-display gm-title">play a little.</h1>
      <p className="gm-sub">Short games from the AquaTerra crew. No sign-in, a couple of minutes each. Your best scores stay in this browser and nobody else sees them.</p>
      {GAMES.length === 0 ? (
        <div className="card gm-empty" role="status">
          <h2 className="h-display">the first games land here soon.</h2>
          <p>We are building them now. Check back, or head to the stories while you wait.</p>
          <Link to="/terranotes" className="btn btn-primary">read Terra Notes →</Link>
        </div>
      ) : (
        <div className="gm-grid">
          {GAMES.map(g => (
            <Link key={g.slug} to={`/games/${g.slug}`} className="card gm-card" style={{ ['--gm-hue' as string]: g.hue }}>
              <h2 className="h-display">{g.title}</h2>
              <p>{g.blurb}</p>
              <span className="gm-play">play →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
