interface DemoRibbonProps {
  flowName: string
  stepIndex: number
  totalSteps: number
  /** 19.4: "The three HoD flows demo a role the visitor does not have. The
   *  ribbon must say so." Left undefined for the eight member-role flows. */
  borrowedRoleLabel?: string
  onLeave: () => void
}

/**
 * The persistent lemon band. Non-negotiable per 19.2: never dismissible,
 * always visible on every step of every flow, role="status" so it's
 * announced on entry. This is the one piece of UI a visitor can never be
 * without while a demo is mounted - see DemoFlowPage.tsx for where it's
 * rendered relative to the coach mark and the real app tree.
 *
 * Two copy widths, both from 19's approved strings list verbatim:
 * `demo · nothing is saved` (phone, mock 21a) and
 * `demo · you are looking at made-up people · nothing is saved` (desktop,
 * mock 21b) - swapped by CSS media query (.demo-ribbon-short /
 * .demo-ribbon-long), not JS, so there's no layout thrash on resize.
 * Same split for the leave button: `Leave` / `Leave the demo`.
 */
export default function DemoRibbon({ flowName, stepIndex, totalSteps, borrowedRoleLabel, onLeave }: DemoRibbonProps) {
  return (
    <div className="demo-ribbon" role="status">
      <span className="demo-ribbon-dot" aria-hidden="true" />
      <span className="demo-ribbon-text mono up">
        <span className="demo-ribbon-short">demo · nothing is saved</span>
        <span className="demo-ribbon-long">demo · you are looking at made-up people · nothing is saved</span>
        {borrowedRoleLabel && (
          <span className="demo-ribbon-role"> · you are a {borrowedRoleLabel} in this walkthrough</span>
        )}
      </span>
      <span className="demo-ribbon-progress mono demo-ribbon-long">
        {flowName} · step {stepIndex + 1} of {totalSteps}
      </span>
      <button type="button" className="demo-ribbon-leave" onClick={onLeave}>
        <span className="demo-ribbon-short">Leave</span>
        <span className="demo-ribbon-long">Leave the demo</span>
      </button>
    </div>
  )
}
