// @ts-nocheck
export const pad = (n: number) => String(n).padStart(2, '0')

export function timeUntil(targetISO: string) {
  const target = new Date(targetISO).getTime()
  let diff = Math.max(0, target - Date.now())
  const d = Math.floor(diff / 86400000); diff -= d * 86400000
  const h = Math.floor(diff / 3600000);  diff -= h * 3600000
  const m = Math.floor(diff / 60000);    diff -= m * 60000
  const s = Math.floor(diff / 1000)
  return { d, h, m, s }
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export const PARADOX_TARGET = '2026-06-01T09:00:00+05:30'

export function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ')
}

/**
 * Turn a kebab-case event slug into a readable display string.
 * "pickle-ball" -> "pickle ball" (CSS uppercase makes it "PICKLE BALL")
 * The slug is informational — it tells users what the underlying game is
 * even though the event has a branded name (e.g. "Pickle Jam"). Showing
 * the formatted slug as a secondary tag preserves the dual identity.
 */
export function formatSlug(slug?: string | null): string {
  if (!slug) return ''
  return slug.replace(/[-_]/g, ' ').trim()
}

// shadcn-compatible cn helper
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
