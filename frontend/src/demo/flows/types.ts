import type { ReactNode } from 'react'
import type { Member } from '../runtime/fakeIdentity'
import type { TableHandler } from '../runtime/queryBuilder'

/** A tiny in-memory store each flow instance owns for the lifetime of one
 *  mount. "Writes resolve optimistically against in-memory fixture state
 *  only and are discarded on exit" (19.1) - this IS that state. A fresh one
 *  is created per DemoProvider mount (see DemoFlowPage.tsx) and simply
 *  falls out of scope - no persistence, nothing to clear on the way out. */
export class FixtureStore {
  private tables = new Map<string, unknown[]>()

  seed(table: string, rows: unknown[]) {
    this.tables.set(table, [...rows])
  }

  rows(table: string): unknown[] {
    return this.tables.get(table) ?? []
  }

  insert(table: string, row: unknown) {
    const list = this.tables.get(table) ?? []
    list.unshift(row)
    this.tables.set(table, list)
  }
}

export interface DemoStepContext {
  /** The element `findTarget` last resolved - handlers act on it directly
   *  rather than re-querying, so "Do it for me" and manual completion agree
   *  on exactly which node is in play even if a re-render swapped it. */
  target: HTMLElement
  member: Member
  store: FixtureStore
}

export interface DemoStep {
  id: string
  /** 900/20-21px instruction line. */
  title: string
  /** One sentence of explanation. */
  body: string
  /** Sub-line under the two buttons. Defaults to a generic "or do it
   *  yourself" - "or tap the arrow yourself" (19's approved string) is
   *  reserved for a step whose spotlit control literally is an arrow
   *  button, so it isn't misapplied to a text field or a chip row. */
  manualHint?: string
  /** Finds the real DOM node to spotlight. Returns null when it isn't
   *  mounted yet (e.g. a modal that a previous step must open first) -
   *  CoachMark polls this every frame rather than caching a stale node. */
  findTarget: () => HTMLElement | null
  /** Performs the REAL interaction - fills the field, clicks the button -
   *  never just advances the counter. Whatever it does must fire the exact
   *  same completion signal a manual click/keystroke would. */
  doItForMe: (ctx: DemoStepContext) => void | Promise<void>
  /**
   * Polls for this step's own completion condition (a chip's aria-checked,
   * a field's value length, a dialog's content changing...). Called once
   * per animation frame while the step is active - target is null exactly
   * when findTarget() didn't find anything THIS frame, which is normal for
   * one frame around any re-render and is NOT the same as "lost" (CoachMark
   * only declares a target lost after a real grace period).
   *
   * Most steps only need to check `target` when it's non-null (the common
   * case: a chip's aria-checked, a field's value length). A few genuinely
   * need to run even when target is null, because the real control they
   * watch unmounts the INSTANT it succeeds with no intermediate state to
   * catch - applyForRole.tsx's submit step is exactly this: the parent
   * closes the whole dialog inside the same synchronous handler that marks
   * success, so by the time any frame could observe the dialog's content,
   * it is simply gone. That step's isComplete ignores `target` entirely and
   * checks a DIFFERENT, stable element instead (the opening card's "applied"
   * badge) - which is the general pattern: when the spotlit control can't
   * survive its own success, watch something else that does.
   *
   * Never a timer either way - always a real state change on a real
   * control, so manual and "Do it for me" complete through the identical
   * signal.
   */
  isComplete: (target: HTMLElement | null) => boolean
}

export interface DemoEndCard {
  kicker: string
  headline: ReactNode
  body: string
}

export interface DemoFlow {
  id: string
  name: string
  /** Exact wording from 19.4's table, e.g. "about a minute". */
  durationLabel: string
  steps: DemoStep[]
  /** The role the fake member holds while this flow runs. Every flow but
   *  the three HoD ones uses 'member' - see 19.4: "The provider swaps the
   *  fake member's role for those flows and the ribbon states it." */
  role: Member['role']
  roleBorrowed: boolean
  /**
   * Does this flow's Backdrop REPLACE the public chrome?
   *
   * Distinct from `roleBorrowed`, which is about identity. A flow can borrow a
   * role and still stand on a normal public page: `hodPostOpening` borrows an
   * HoD but its backdrop is `teams/TeamDetailPage`, a public route that is
   * supposed to keep its nav and footer. DemoFlowPage used to strip the chrome
   * whenever a role was borrowed, so that flow ran against a page missing the
   * furniture it normally has.
   *
   * True only for the flows whose backdrop IS the HoD desk.
   */
  hidesPublicChrome?: boolean
  buildMember: () => Member
  buildHandlers: (ctx: { member: Member; store: FixtureStore }) => Record<string, TableHandler>
  /** The real app tree this flow's steps spotlight. */
  Backdrop: () => ReactNode
  endCard: DemoEndCard
}

export interface FlowListing {
  id: string
  name: string
  steps: number
  durationLabel: string
  /** Only a 'ready' flow is linked from the launcher; the rest are visible
   *  (19.4 lists all eleven) but inert - see DemoLauncherPage.tsx. */
  status: 'ready' | 'soon'
  hue: string
}
