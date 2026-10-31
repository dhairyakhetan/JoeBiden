// ─────────────────────────────────────────────────────────────────────────
// "Do it for me" performs the REAL interaction (19.2): it fills the field,
// clicks the button, and lets the app respond - never a shortcut that skips
// straight to the next step. These are the two DOM-level primitives every
// flow's doItForMe needs to do that against a React-controlled element from
// outside React.
// ─────────────────────────────────────────────────────────────────────────

/** Sets a controlled <input>/<textarea>'s value the way a real keystroke
 *  would, so React's own onChange fires and the component's state actually
 *  updates. Assigning `.value` directly does not do this - React tracks the
 *  native setter, so a plain assignment is invisible to it; the fix is to
 *  call the native prototype's setter first, then dispatch the input event
 *  React is listening for. */
export function setReactFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/** A real click, not a handler call - so hover/active states, analytics
 *  hooks and event delegation all see the identical thing a pointer would
 *  produce. */
export function clickElement(el: HTMLElement) {
  el.click()
}

/** Finds a button-like descendant whose visible text contains `text`
 *  (case-insensitive). Used to pick a specific category chip / option out
 *  of a row without needing a selector the real component doesn't expose. */
export function findByText(root: ParentNode, selector: string, text: string): HTMLElement | null {
  const needle = text.trim().toLowerCase()
  const candidates = root.querySelectorAll<HTMLElement>(selector)
  for (const el of candidates) {
    if ((el.textContent || '').trim().toLowerCase().includes(needle)) return el
  }
  return null
}

/**
 * A short settle delay for "Do it for me" - gives React one paint cycle to
 * react to a click/input before the next lookup runs, without resorting to a
 * timer as the actual completion signal (isComplete still polls the real DOM
 * state).
 *
 * RACED AGAINST A TIMER, not a bare rAF. This used to be
 * `new Promise(resolve => requestAnimationFrame(() => resolve()))`, which
 * never resolves at all in a surface the browser has stopped painting - a
 * background or occluded tab, an embedded webview, battery saver, an
 * automation surface. Every `doItForMe` that awaits this would then hang
 * forever: the button stays on "doing it…", the real interaction never
 * happens, and the step cannot be completed by hand either because the member
 * is looking at a spinner that will never stop.
 *
 * Whichever arrives first wins. When frames flow this behaves exactly as
 * before (one paint, ~16ms); when they do not, the timer keeps the flow
 * moving. See CoachMark's WATCHDOG_MS for the same fix on the other half of
 * this engine - these were the only two places the demo assumed frames.
 */
export function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    let done = false
    const finish = () => { if (!done) { done = true; resolve() } }
    requestAnimationFrame(finish)
    setTimeout(finish, 60)
  })
}
