/**
 * Add-to-calendar (.ics). PRD 6.5 item 6.
 *
 * Hand-rolled rather than pulled from a package: the spec surface we need is
 * about fifteen lines, and a calendar file is one of the few places where a
 * dependency's opinion about line folding or escaping can silently produce a
 * file that Apple Calendar rejects without saying why.
 *
 * All-day events are used deliberately. Match windows are not confirmed yet
 * (blocker B2), and an all-day entry on the right date is honest, where a
 * guessed 10am-to-6pm block would be a fabricated commitment in someone's
 * calendar.
 */
import type { PublicEvent } from './types'

function yyyymmdd(isoDate: string): string {
  return isoDate.replace(/-/g, '')
}

function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** RFC 5545: escape backslash, semicolon, comma and newline in TEXT values. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/**
 * Lines longer than 75 octets must be folded with a leading space.
 *
 * Counted in OCTETS, not in JS string length, and the difference is not
 * academic. RFC 5545 measures the limit in UTF-8 bytes and separately forbids
 * splitting a multi-octet sequence. Slicing by `string.length` measures UTF-16
 * code units, which happens to agree for anything in the Basic Multilingual
 * Plane, so accented letters and Bengali script came out fine and hid the
 * problem. A character outside it, an emoji in a venue name being the likely
 * one here, is a surrogate PAIR: cut between the halves and each line ends up
 * carrying a lone surrogate, which is not valid UTF-16, and the calendar app
 * shows a replacement character or rejects the file.
 *
 * So: walk by code point, never split one, and count what each actually costs
 * in UTF-8.
 */
function utf8Len(ch: string): number {
  const cp = ch.codePointAt(0) as number
  if (cp < 0x80) return 1
  if (cp < 0x800) return 2
  if (cp < 0x10000) return 3
  return 4
}

function fold(line: string): string {
  // Fast path, and note it measures OCTETS rather than testing for ASCII. A
  // line already inside the limit needs no folding whatever it is encoded
  // from, so there is nothing to decide. The earlier version of this line
  // asked the question with /[^\x00-\x7F]/, which is both a weaker check and
  // a no-control-regex lint error.
  if (new TextEncoder().encode(line).length <= 73) return line

  const out: string[] = []
  let cur = ''
  let bytes = 0
  // 73 on the first line and 72 after it, because a continuation line spends
  // one of its 75 octets on the leading space, and the original left a further
  // octet of headroom against the CRLF.
  let budget = 73

  // Array.from iterates by code point, so a surrogate pair arrives whole and
  // can never be cut in half.
  for (const ch of Array.from(line)) {
    const n = utf8Len(ch)
    if (bytes + n > budget) {
      out.push(cur)
      cur = ''
      bytes = 0
      budget = 72
    }
    cur += ch
    bytes += n
  }
  if (cur) out.push(cur)

  return out.map((l, i) => (i === 0 ? l : ' ' + l)).join('\r\n')
}

export function buildIcs(event: PublicEvent, refCode: string): string {
  if (!event.day_first) return ''
  const start = event.day_first
  // DTEND on an all-day VEVENT is exclusive, so it is the day AFTER the last.
  const end = addDays(event.day_last || event.day_first, 1)
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  // No reference code in the DESCRIPTION. It is a back-office identifier, the
  // confirmation screen stopped showing it on 2026-09-21, and a calendar entry
  // that quotes it just puts it back in front of the participant by another
  // door. It stays in UID below, which is invisible to the reader and is what
  // lets a calendar recognise a re-import as the same event rather than a
  // duplicate.
  const desc = [
    event.report_time ? `Report by ${event.report_time}.` : 'Reporting time will be confirmed in the event group.',
    'Show your QR entry pass at the gate and carry your school or college ID.',
  ].join(' ')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Team AquaTerra//TerraThon 2026//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${refCode}@terrathon.ngoaquaterra.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${yyyymmdd(start)}`,
    `DTEND;VALUE=DATE:${yyyymmdd(end)}`,
    fold(`SUMMARY:${esc(`TerraThon 2026: ${event.display_name}`)}`),
    fold(`DESCRIPTION:${esc(desc)}`),
    event.venue ? fold(`LOCATION:${esc(event.venue)}`) : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return lines.join('\r\n')
}

export function downloadIcs(event: PublicEvent, refCode: string): void {
  const text = buildIcs(event, refCode)
  if (!text) return
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `TerraThon26_${event.display_name}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick: Safari needs the URL to survive the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
