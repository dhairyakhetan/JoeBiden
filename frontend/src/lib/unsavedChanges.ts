// changelog/11-system-states.md §11.9 state 10 — the unsaved-changes guard.
//
// This file is ONLY the decision: "given what the member typed, what the form
// is doing, and whether anything else already saved it — should leaving cost a
// confirm?" The hook that wires it to React Router and `beforeunload` lives in
// `hooks/useUnsavedChanges.ts`; the decision is here so it can be unit-tested
// without a DOM, which matters more than usual: the failure mode of a guard is
// not "it breaks", it is "it nags", and a nagging guard gets ripped out.
//
// The whole design is biased towards NOT prompting. Every rule below exists to
// close a false positive.

/** A form's values, flattened. Only these shapes ever get compared. */
export type FieldValue = string | number | boolean | null | undefined | readonly (string | number)[]
export type FormSnapshot = Readonly<Record<string, FieldValue>>

/**
 * Normalise one value so that "the member focused the field and left" and
 * "the member typed two spaces" both read as untouched.
 *
 * - strings are trimmed (whitespace is not content)
 * - '' / null / undefined / false / 0-length arrays all collapse to ''
 * - arrays compare by content and order
 */
function normalise(v: FieldValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'boolean') return v ? 'true' : ''
  if (typeof v === 'number') return String(v)
  return v.length ? v.map(x => String(x)).join('') : ''
}

/**
 * True when `current` differs from `initial` in at least one field.
 *
 * Compares the union of both key sets, so a field that only appears once a
 * mode is opened (the composer's blog body, say) still counts. A key present
 * in one and absent in the other is only dirty if the present one has content
 * — `{}` vs `{ title: '' }` is not a change anybody made.
 */
export function isDirty(current: FormSnapshot, initial: FormSnapshot): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(initial)])
  for (const k of keys) {
    if (normalise(current[k]) !== normalise(initial[k])) return true
  }
  return false
}

export interface GuardInput {
  /** Does the form differ from where it started? Usually `isDirty(...)`. */
  dirty: boolean
  /** A write is in flight. Leaving mid-write is the submit's problem, not the guard's. */
  submitting?: boolean
  /** The write resolved. Never prompt after a successful submit — §11.9 state 7 owns that exit. */
  submitted?: boolean
  /**
   * Something else already persisted this content and will restore it on the
   * next open — the composer's `useComposerDraft` localStorage draft is the
   * one real case. If the text is coming back, warning about losing it is a
   * lie. Set this from the persistence layer's own status, never from a guess.
   */
  persisted?: boolean
  /**
   * Content that `persisted` does NOT cover, even when it is true. The
   * composer's draft deliberately never stores image blobs or attachments, so
   * a member who attached three photos and taps the scrim really does lose
   * them. This is the escape hatch that keeps `persisted` honest instead of
   * making it a blanket "never prompt".
   */
  unpersistable?: boolean
  /** Caller-side kill switch (sheet closed, feature off). */
  enabled?: boolean
}

/**
 * The single rule. Prompt only when there is something to lose.
 *
 * Order matters: `submitted` and `submitting` win over everything, then the
 * persistence exemption, and `unpersistable` re-opens it.
 */
export function shouldGuard(input: GuardInput): boolean {
  const { dirty, submitting, submitted, persisted, unpersistable, enabled = true } = input
  if (!enabled) return false
  if (submitted) return false
  if (submitting) return false
  if (unpersistable) return true
  if (!dirty) return false
  if (persisted) return false
  return true
}

/**
 * The copy. One sentence, lowercase, no exclamation mark (docs/BRAND_VOICE.md
 * §1.2) — and it names what is actually lost rather than asking the abstract
 * "are you sure?" that a member cannot answer.
 */
export const UNSAVED_TITLE = 'leave without saving?'
export const UNSAVED_BODY = "what you've typed here isn't saved yet. leaving loses it."
export const UNSAVED_CONFIRM = 'leave it'
export const UNSAVED_CANCEL = 'keep writing'
