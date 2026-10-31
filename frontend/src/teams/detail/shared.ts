// Shared types/helpers used across TeamDetailPage.tsx and its split-out tab
// components (teams/detail/*Tab.tsx) and modals. Split out of the original
// 2074-line TeamDetailPage.tsx so each tab file can import just what it
// needs instead of everything living in one file.
import { CustomQuestion } from '../../lib/jobOpenings'

export const initials = (name: string) => (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2)

// ── Team Openings ────────────────────────────────────────────────────────────
export type WelfareProjectLite = {
  slug: string
  header: string
  main_image: string | null
  main_image_alt: string | null
  objective: string | null
  workshop_date: string | null
}

export type OpeningStatus = 'open' | 'paused' | 'closed' | 'deleted'

export type TeamOpening = {
  id: string
  title: string
  description: string
  skills: string[]
  commitment: string
  category: string
  status: OpeningStatus
  createdAt: string
  createdByName: string
  createdByRole: string
  customQuestions: CustomQuestion[]
  /** ISO timestamp, or null/undefined when the role has no deadline. */
  deadline?: string | null
}

// Derive a simple "is open" boolean from status for UI purposes
export function isOpenStatus(status: OpeningStatus) { return status === 'open' }

/**
 * A standing ("always open") role: open, with no deadline. The existing logic
 * only ever pauses a role whose deadline has passed (lib/jobOpenings.ts), so a
 * role with no deadline never expires. Leaving the deadline blank IS how a
 * permanent role is posted; there is no separate flag.
 */
export function isAlwaysOpen(op: { status: OpeningStatus; deadline?: string | null }) {
  return isOpenStatus(op.status) && !op.deadline
}

export const STATUS_BADGE: Record<OpeningStatus, { label: string; color: string }> = {
  open:    { label: 'Open',    color: 'var(--welfare)' },
  paused:  { label: 'Paused',  color: 'var(--lemon)' },
  closed:  { label: 'Closed',  color: 'var(--ink-3)' },
  deleted: { label: 'Deleted', color: 'var(--danger)' },
}
