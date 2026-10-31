import { Link } from 'react-router-dom'
import { EVENT } from '../config'
import { SportIcon } from '../components/SportIcons'

export function TerraThonNotFound() {
  return (
    <div className="tt-wrap tt-page" style={{ textAlign: 'center' }}>
      {/* The only place the set is not sitting beside bold text. It is a big
          quiet mark held at 60% opacity, and the 2.5 default would render a
          6.7px stroke at this size and stop being quiet. */}
      <SportIcon name="whistle" size={64} strokeWidth={1.6} color="var(--tt-cyan)" style={{ opacity: 0.6 }} />
      <h1 style={{ fontSize: 56, textTransform: 'uppercase', marginTop: 16, lineHeight: 1 }}>Out of play</h1>
      <p style={{ margin: '14px auto 26px', maxWidth: 440, fontSize: 'var(--tt-fs-body)', lineHeight: 1.65, color: 'var(--tt-muted)' }}>
        That page is not part of TerraThon. The three sports, the schedule and the team are all one
        tap away.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link to={EVENT.base} className="tt-btn">Back to TerraThon</Link>
        <Link to={`${EVENT.base}/register`} className="tt-btn tt-btn--ghost">Register</Link>
      </div>
    </div>
  )
}
