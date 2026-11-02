/**
 * HR's list of accounts that share a phone number (owner, 2 Nov 2026).
 *
 * The data comes from the `get_duplicate_phone_groups()` RPC
 * (scripts/members_duplicate_phones_hr_2026_11_02.sql, APPLIED). It returns one
 * flat row per account, already ordered by number then active-first. This file
 * folds those rows into groups and holds the copy, so both are testable
 * without a database.
 */

export interface DuplicatePhoneRow {
  phoneKey: string
  memberId: number
  fullName: string
  email: string
  phone: string
  status: string
  classGrade: string | null
  createdAt: string
}

export interface DuplicatePhoneGroup {
  phoneKey: string
  members: DuplicatePhoneRow[]
}

/** Maps one raw RPC row (snake_case) to the app shape. */
export function toDuplicatePhoneRow(raw: any): DuplicatePhoneRow {
  return {
    phoneKey: String(raw.phone_key),
    memberId: Number(raw.member_id),
    fullName: raw.full_name ?? '',
    email: raw.email ?? '',
    phone: raw.phone ?? '',
    status: raw.status ?? '',
    classGrade: raw.class_grade ?? null,
    createdAt: raw.created_at ?? '',
  }
}

/**
 * Folds flat rows into groups, keeping first-seen group order and row order.
 * A key with fewer than two rows is dropped: the server only sends real
 * duplicates, but a stale or partial page must never show a "group" of one.
 */
export function groupDuplicatePhones(rows: DuplicatePhoneRow[]): DuplicatePhoneGroup[] {
  const byKey = new Map<string, DuplicatePhoneRow[]>()
  for (const r of rows) {
    const list = byKey.get(r.phoneKey)
    if (list) list.push(r)
    else byKey.set(r.phoneKey, [r])
  }
  return [...byKey.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([phoneKey, members]) => ({ phoneKey, members }))
}

/** Case-insensitive match on name, email or the digits of the number. */
export function matchesDuplicateSearch(group: DuplicatePhoneGroup, term: string): boolean {
  const t = term.trim().toLowerCase()
  if (!t) return true
  const digits = t.replace(/\D/g, '')
  return group.members.some(m =>
    m.fullName.toLowerCase().includes(t) ||
    m.email.toLowerCase().includes(t) ||
    (digits.length > 0 && m.phone.replace(/\D/g, '').includes(digits)),
  )
}
