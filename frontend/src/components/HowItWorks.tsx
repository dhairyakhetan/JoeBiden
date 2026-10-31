import './HowItWorks.css'

/**
 * The numbered "here's what happens next" explainer.
 *
 * This started as one-off markup on the login page, where prospective members
 * were bouncing — not because the button was hard to find, but because they
 * couldn't tell what pressing it would commit them to. Showing the whole path,
 * including the part where a human approves them, fixed that.
 *
 * The same question is asked all over the app ("I applied — now what?", "does
 * my post go live immediately?", "who reads this form?") and was mostly going
 * unanswered, so the pattern lives here now instead of being retyped per page.
 *
 * Rules of the format, learned from the login version:
 *  • Three steps. Four reads as a form to dread; two isn't a process.
 *  • Every step is something that HAPPENS, not something to read about.
 *  • Name the human in the loop and the wait, because that's the actual
 *    anxiety. Never promise a turnaround the org hasn't committed to — pull
 *    those from lib/orgFacts.ts rather than typing a new number here.
 *  • It follows the action it explains; it never replaces the button.
 */

export interface HowItWorksStep {
  /** What happens — imperative or plain statement, no trailing period. */
  title: string
  /** The reassuring half: how long, who does it, where the answer lands. */
  detail: string
}

interface HowItWorksProps {
  steps: HowItWorksStep[]
  /** Names the list for screen readers, e.g. "How joining a team works". */
  label: string
  /** Accent for the numerals. Defaults to the welfare green used on login. */
  accent?: string
  /** `plain` drops the dashed top rule, for when it sits inside its own card. */
  variant?: 'ruled' | 'plain'
  className?: string
}

const HowItWorks = ({ steps, label, accent, variant = 'ruled', className }: HowItWorksProps) => (
  <ol
    className={`hiw hiw-${variant}${className ? ' ' + className : ''}`}
    aria-label={label}
    style={accent ? ({ ['--hiw-accent' as string]: accent }) : undefined}
  >
    {steps.map((s, i) => (
      <li key={s.title}>
        {/* aria-hidden: the <ol> already conveys order to assistive tech, so
            announcing "1" before every title just doubles it up. */}
        <span className="hiw-n" aria-hidden>{i + 1}</span>
        <span className="hiw-t">{s.title}</span>
        <span className="hiw-d">{s.detail}</span>
      </li>
    ))}
  </ol>
)

export default HowItWorks
