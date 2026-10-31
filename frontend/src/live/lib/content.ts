import { PHOTOS } from '../data/photos'
import type { EventStatus, LiveEvent, LiveProgramme } from '../data/content'

/** The two editable tables as the database stores them. Migration: scripts/live_content_2026_10_24.sql (its CHECKs repeat the rules below). */
export interface EventRow {
  slug: string; name: string; edition: string | null; status: EventStatus; when_key: string; date_label: string; blurb: string
  venue: string | null; time_label: string | null; href: string | null; photo_ids: string[]; highlights: string[]
  sort: number; published: boolean
}
export interface ProgrammeRow { name: string; line: string; photo: string | null; photo_alt: string | null; sort: number; published: boolean }

/** Programme photos are files that ship with a deploy, so the choice is a short list, not free text. */
export const PROGRAMME_PHOTOS = ['food', 'edu'] as const

const KNOWN_PHOTO = new Set(PHOTOS.map(p => p.id))

export function rowToEvent(r: EventRow): LiveEvent {
  return {
    slug: r.slug, name: r.name, edition: r.edition ?? undefined, status: r.status, when: r.when_key, dateLabel: r.date_label, blurb: r.blurb,
    venue: r.venue ?? undefined, time: r.time_label ?? undefined, href: r.href ?? undefined,
    // an id the app has no file for is dropped, never rendered as a broken image
    photos: (r.photo_ids ?? []).filter(id => KNOWN_PHOTO.has(id)),
    highlights: r.highlights ?? [],
  }
}
export function rowToProgramme(r: ProgrammeRow): LiveProgramme {
  const photo = r.photo && (PROGRAMME_PHOTOS as readonly string[]).includes(r.photo) ? r.photo : undefined
  return { name: r.name, line: r.line, photo, photoAlt: photo ? (r.photo_alt ?? undefined) : undefined }
}

// ── the editing forms: strings in, a validated row out ──────────────────────────────────────────────────────────────────────────
export interface EventForm {
  slug: string; name: string; edition: string; status: string; whenKey: string; dateLabel: string; blurb: string; venue: string
  timeLabel: string; href: string; photoIds: string; highlights: string; sort: string; published: boolean
}
export type FormErrors<K extends string> = Partial<Record<K, string>>

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const WHEN = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/
const HREF = /^(\/[A-Za-z0-9/_-]*|https:\/\/\S+)$/

const len = (s: string, min: number, max: number) => s.length >= min && s.length <= max
const intOr = (s: string): number | null => (/^-?\d{1,6}$/.test(s.trim()) ? parseInt(s, 10) : s.trim() === '' ? 0 : null)

export function emptyEventForm(): EventForm {
  return { slug: '', name: '', edition: '', status: 'upcoming', whenKey: '', dateLabel: '', blurb: '', venue: '', timeLabel: '', href: '', photoIds: '', highlights: '', sort: '0', published: true }
}
export function eventToForm(r: EventRow): EventForm {
  return {
    slug: r.slug, name: r.name, edition: r.edition ?? '', status: r.status, whenKey: r.when_key, dateLabel: r.date_label, blurb: r.blurb, venue: r.venue ?? '',
    timeLabel: r.time_label ?? '', href: r.href ?? '', photoIds: r.photo_ids.join(', '), highlights: r.highlights.join('\n'), sort: String(r.sort), published: r.published,
  }
}

export function validateEventForm(f: EventForm, takenSlugs: string[] = []): { ok: true; row: EventRow } | { ok: false; errors: FormErrors<keyof EventForm> } {
  const e: FormErrors<keyof EventForm> = {}
  const slug = f.slug.trim(), name = f.name.trim(), edition = f.edition.trim(), whenKey = f.whenKey.trim(), dateLabel = f.dateLabel.trim()
  const blurb = f.blurb.trim(), venue = f.venue.trim(), timeLabel = f.timeLabel.trim(), href = f.href.trim()
  if (!SLUG.test(slug) || !len(slug, 3, 60)) e.slug = 'Use 3 to 60 lowercase letters, numbers and single dashes, like disco-diwali-2026.'
  else if (takenSlugs.includes(slug)) e.slug = 'Another night already uses that address.'
  if (!len(name, 1, 80)) e.name = 'Give the night a name (up to 80 characters).'
  if (edition && !len(edition, 1, 80)) e.edition = 'Keep the edition under 80 characters.'
  if (f.status !== 'upcoming' && f.status !== 'past') e.status = 'Choose upcoming or past.'
  if (!WHEN.test(whenKey)) e.whenKey = 'Use 2026-11-10, 2025-10 or 2024. It sorts the list.'
  if (!len(dateLabel, 1, 60)) e.dateLabel = 'Say when, in words people read (up to 60 characters).'
  if (!len(blurb, 1, 400)) e.blurb = 'Write one or two sentences (up to 400 characters).'
  if (venue && !len(venue, 1, 80)) e.venue = 'Keep the venue under 80 characters.'
  if (timeLabel && !len(timeLabel, 1, 40)) e.timeLabel = 'Keep the time under 40 characters.'
  if (href && !HREF.test(href)) e.href = 'Use a page on this site like /live/disco-diwali, or a full https:// link.'
  const ids = f.photoIds.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
  const unknown = ids.filter(id => !KNOWN_PHOTO.has(id))
  if (unknown.length) e.photoIds = `No photo called ${unknown.join(', ')}. Photos are files that ship with the site; ask the developer to add one.`
  else if (ids.length > 24) e.photoIds = 'Up to 24 photos.'
  const highlights = f.highlights.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  if (highlights.length > 8) e.highlights = 'Up to 8 lines.'
  else if (highlights.some(h => h.length > 160)) e.highlights = 'Keep each line under 160 characters.'
  // a rupee figure on this site is the owner's one standing no
  if (/₹|\brs\.?\s?\d|\binr\b|\b\d[\d,]*\s?(rupees|lakh|crore)\b/i.test([blurb, ...highlights].join(' '))) e.blurb = e.blurb ?? 'No rupee figures on this site. Name the programme, not the amount.'
  const sort = intOr(f.sort)
  if (sort === null) e.sort = 'A whole number. Lower shows first.'
  if (Object.keys(e).length) return { ok: false, errors: e }
  return { ok: true, row: { slug, name, edition: edition || null, status: f.status as EventStatus, when_key: whenKey, date_label: dateLabel, blurb, venue: venue || null, time_label: timeLabel || null, href: href || null, photo_ids: ids, highlights, sort: sort ?? 0, published: f.published } }
}

export interface ProgrammeForm { name: string; line: string; photo: string; photoAlt: string; sort: string; published: boolean }
export const emptyProgrammeForm = (): ProgrammeForm => ({ name: '', line: '', photo: '', photoAlt: '', sort: '0', published: true })
export const programmeToForm = (r: ProgrammeRow): ProgrammeForm => ({ name: r.name, line: r.line, photo: r.photo ?? '', photoAlt: r.photo_alt ?? '', sort: String(r.sort), published: r.published })

export function validateProgrammeForm(f: ProgrammeForm, takenNames: string[] = []): { ok: true; row: ProgrammeRow } | { ok: false; errors: FormErrors<keyof ProgrammeForm> } {
  const e: FormErrors<keyof ProgrammeForm> = {}
  const name = f.name.trim(), line = f.line.trim(), alt = f.photoAlt.trim()
  if (!len(name, 1, 60)) e.name = 'Give the programme a name (up to 60 characters).'
  else if (takenNames.includes(name)) e.name = 'A programme with that name already exists.'
  if (!len(line, 1, 200)) e.line = 'Say what it is in a line (up to 200 characters).'
  if (f.photo && !(PROGRAMME_PHOTOS as readonly string[]).includes(f.photo)) e.photo = 'Choose one of the available photos.'
  if (f.photo && !len(alt, 1, 200)) e.photoAlt = 'Describe the photo for people who cannot see it (up to 200 characters).'
  if (/₹|\brs\.?\s?\d|\binr\b|\b\d[\d,]*\s?(rupees|lakh|crore)\b/i.test(line)) e.line = e.line ?? 'No rupee figures on this site. Name the programme, not the amount.'
  const sort = intOr(f.sort)
  if (sort === null) e.sort = 'A whole number. Lower shows first.'
  if (Object.keys(e).length) return { ok: false, errors: e }
  return { ok: true, row: { name, line, photo: f.photo || null, photo_alt: f.photo ? alt : null, sort: sort ?? 0, published: f.published } }
}
