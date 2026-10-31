import { useNow } from '../lib/hooks'
import { countdownTo, pad2 } from '../lib/countdown'

/** Days, hours, minutes and seconds to the start of `date` in India. Says so plainly once it has begun. */
export function Countdown({ date, compact = false }: { date: string; compact?: boolean }) {
  const now = useNow(1000)
  const { parts, done } = countdownTo(date, now)
  if (done) return <p className="lv-count-done">It is on. See you there.</p>
  const cells: [number, string][] = [[parts.days, 'days'], [parts.hours, 'hrs'], [parts.minutes, 'min'], [parts.seconds, 'sec']]
  return (
    <div className={'lv-count' + (compact ? ' is-compact' : '')} role="timer" aria-label={`${parts.days} days ${parts.hours} hours to go`}>
      {cells.map(([n, label]) => (
        <div key={label} className="lv-count-cell">
          <span className="lv-count-n">{label === 'days' ? n : pad2(n)}</span>
          <span className="lv-count-l">{label}</span>
        </div>
      ))}
    </div>
  )
}
