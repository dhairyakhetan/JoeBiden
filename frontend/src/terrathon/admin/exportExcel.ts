/**
 * Excel export, ADM-08. Four sheets: MASTER, CRICKET, PICKLEBALL, FIFA.
 *
 * Written against `fflate`, which this repo already ships (see
 * components/carouselGenerator.ts), rather than pulling in ExcelJS. An .xlsx is
 * a zip of XML parts, and the subset needed here (inline strings, one style
 * for the header, a frozen top row and an autofilter) is a few hundred lines.
 * ExcelJS would have added roughly half a megabyte to a lazy chunk with a
 * 200 KB budget, to do the same job.
 *
 * The export reads the database directly rather than the on-screen table, so it
 * works as a backup even when something in the UI is filtered or broken, and it
 * is the reason the Google Sheet mirror could be cut.
 *
 * Filename carries CONFIDENTIAL because the file holds minors' phone numbers
 * and it will end up in someone's Downloads folder.
 */
import { zipSync, strToU8 } from 'fflate'
import type { AdminRow } from '../lib/api'
import { statusLabel, istDateTime } from '../lib/format'

const HEADERS = [
  'Ref Code', 'Registered (IST)', 'Event', 'Team', 'Captain', 'Age', 'Class', 'School',
  'WhatsApp', 'Email', 'Roster', 'Players', 'Messaged', 'Paid', 'Amount (₹)',
  'UTR', 'Status', 'Last Check-in', 'Notes', 'Source', 'Last Updated (IST)',
]

const WIDTHS = [14, 18, 12, 22, 20, 6, 10, 26, 16, 26, 40, 9, 11, 8, 12, 18, 16, 18, 30, 10, 18]

type Cell = string | number | boolean | null

function colName(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** XML text escaping. Control characters are stripped: Excel rejects the file otherwise. */
// Built with the RegExp constructor so the SOURCE of this file stays pure
// ASCII. A character-class literal here would contain real control bytes,
// which trips no-irregular-whitespace and is invisible in review.
// Matching control characters is the POINT: Excel refuses to open a file whose
// inline strings contain them, and a note pasted out of a PDF routinely does.
// Stripping them is the fix, so the rule is switched off knowingly.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = new RegExp('[\u0000-\u0008\u000B\u000C\u000E-\u001F]', 'g')

function esc(v: string): string {
  return v
    .replace(CONTROL_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cellXml(ref: string, v: Cell, header: boolean): string {
  const style = header ? ' s="1"' : ''
  if (v === null || v === undefined || v === '') return `<c r="${ref}"${style}/>`
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`
  if (typeof v === 'boolean') return `<c r="${ref}"${style} t="b"><v>${v ? 1 : 0}</v></c>`
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`
}

function sheetXml(rows: Cell[][]): string {
  const lastCol = colName(HEADERS.length - 1)
  const cols = WIDTHS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
  const body = rows
    .map((row, r) => {
      const cells = row.map((v, c) => cellXml(`${colName(c)}${r + 1}`, v, r === 0)).join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${body}</sheetData>
<autoFilter ref="A1:${lastCol}${Math.max(1, rows.length)}"/>
</worksheet>`
}

function toRow(r: AdminRow): Cell[] {
  return [
    r.ref_code,
    istDateTime(r.created_at),
    r.event_name,
    r.team_name ?? '',
    r.captain_name,
    r.age ?? '',
    r.class_label ?? '',
    r.school ?? '',
    r.phone,
    r.email ?? '',
    r.roster.join(', '),
    1 + r.roster.length,
    r.wa_texted_by != null,
    r.paid,
    r.amount_paid_inr ?? '',
    r.utr ?? '',
    statusLabel(r),
    r.last_checkin ? istDateTime(r.last_checkin) : '',
    r.notes ?? '',
    r.source,
    istDateTime(r.updated_at),
  ]
}

const SHEETS = ['MASTER', 'CRICKET', 'PICKLEBALL', 'FIFA'] as const

export function buildWorkbook(rows: AdminRow[]): Uint8Array {
  const sheets: Cell[][][] = [
    [HEADERS, ...rows.map(toRow)],
    [HEADERS, ...rows.filter((r) => r.event_slug === 'cricket').map(toRow)],
    [HEADERS, ...rows.filter((r) => r.event_slug === 'pickleball').map(toRow)],
    [HEADERS, ...rows.filter((r) => r.event_slug === 'fifa').map(toRow)],
  ]

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${SHEETS.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${SHEETS.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${SHEETS.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${SHEETS.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  // Two cell formats: 0 is the default, 1 is the bold header on a volt fill.
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC4FF3D"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
</styleSheet>`

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
    'xl/styles.xml': strToU8(styles),
  }
  sheets.forEach((rowsForSheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(rowsForSheet))
  })

  return zipSync(files, { level: 6 })
}

export function exportFilename(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const d = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
  const t = `${p(now.getHours())}${p(now.getMinutes())}`
  return `TerraThon26_Registrations_CONFIDENTIAL_${d}_${t}.xlsx`
}

export function downloadWorkbook(rows: AdminRow[]): void {
  const bytes = buildWorkbook(rows)
  // `.buffer` is typed ArrayBufferLike, which TS will not accept as a BlobPart
  // because it could in principle be a SharedArrayBuffer. fflate never returns
  // one, so the cast is safe and keeps us off a copy of the whole workbook.
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = exportFilename()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
