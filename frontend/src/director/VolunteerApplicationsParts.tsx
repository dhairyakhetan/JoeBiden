// Volunteer-applications desk - types, constants and the presentational
// pieces of the row ledger. Split out of VolunteerApplications.tsx (stage 3A),
// which was the largest file on the HoD desk; that file keeps the data
// fetching, mutations and layout, this one holds everything it renders with.

import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

export interface VolApp {
  id: number
  created_at: string
  full_name: string
  email: string
  phone: string | null
  age: number | null
  college: string | null
  year_of_study: string | null
  interests: string[]
  availability: string | null
  why_aquaterra: string
  previous_experience: string | null
  instagram_handle: string | null
  reviewed: boolean | null
  review_note: string | null
  texted: boolean
  texted_by: string | null
  added: boolean
  vol_label: string | null
}

export type LabelKey = 'texted' | 'joined' | 'repeated' | 'in_aq' | 'expired'
// 'unmarked' is a client-side-only pseudo-label (vol_label IS NULL) - it's
// a real, DB-backed CHECK-constrained column that only accepts the five
// LabelKey values, so "unmarked" can never be assigned/written, only
// filtered/exported on. Keep it out of LABELS (which drives the per-row
// assign buttons and batch-label actions) and only add it to the filter
// chip row below.
export type LabelFilterKey = LabelKey | 'unmarked'

// This desk's five-way pipeline vocabulary is deliberately NOT the shared
// pending/approved/rejected `StatusStamp` - these are lead states, not
// verdicts, so they keep their own colour system. Each colour is handed to
// CSS as `--lc`; see VolunteerApplications.css.
export const LABELS: { key: LabelKey; name: string; color: string; xlsBg: string }[] = [
  { key: 'texted',   name: 'Texted',             color: '#FFC700', xlsBg: '#FFFACC' },
  { key: 'joined',   name: 'Joined',              color: '#00E5A0', xlsBg: '#CCFAEC' },
  // audit-ok: Pop Orange, and it is paired with an .xls background - these
  // colours are written into an Excel export, not onto a desk surface.
  { key: 'repeated', name: 'Repeated name',       color: '#FF7A1A', xlsBg: '#FFE8D6' },
  { key: 'in_aq',    name: 'Already in AQ',       color: '#7E5BFF', xlsBg: '#EEE5FF' },
  { key: 'expired',  name: 'Expired / passed',    color: '#E05C5C', xlsBg: '#FFE5E5' },
]
export const LMAP = Object.fromEntries(LABELS.map(l => [l.key, l]))
export const UNMARKED_FILTER = { key: 'unmarked' as const, name: 'Unmarked', color: '#8A8F99' }

const INTEREST_COLORS: Record<string, string> = {
  'Animal Welfare': '#00E5A0',
  'Plantation / Environment': '#7BCB6A',
  'Community Relief': '#FF7A1A',   // audit-ok: Pop Orange, export/legend fill
  'Events & Culture': '#FF6BD6',
  'Content Creation': '#FFC700',
  'Technology (AQ Tech)': '#3DA9FC',
  'Media (Prism)': '#7E5BFF',
  'Operations / HR': 'var(--danger)',
  'Finance': '#3DA9FC',
}

export const formatDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

/** Indian mobile → wa.me link (strips punctuation, normalises the country code). */
export const waHref = (phone: string) =>
  `https://wa.me/${phone.replace(/\D/g, '').replace(/^0/, '91').replace(/^(?!91)(\d{10})$/, '91$1')}`

/** Colour-coded Excel export. Pure string building - kept out of the component. */
export function buildXlsHtml(rows: VolApp[]): string {
  const esc = (s: unknown) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const hdrs = ['#','Submitted','Name','Email','Phone','Age','College','Year','Interests',
    'Availability','Why AquaTerra','Experience','Instagram','Status','Reviewed','Texted by','Added']
  // audit-ok: Arial here is written into an Excel .xls export, which renders
  // in Excel with Excel's own fonts. It is not app CSS.
  const thS = 'padding:7px 11px;background:#111111;color:#FFFFFF;font-family:Arial;font-size:10pt;font-weight:700;border:1px solid #333;white-space:nowrap;'
  const thead = `<tr>${hdrs.map(h => `<th style="${thS}">${h}</th>`).join('')}</tr>`

  const tbody = rows.map((a, i) => {
    const meta = a.vol_label ? LMAP[a.vol_label] : null
    const bg   = meta?.xlsBg || '#FFFFFF'
    const td   = (v: unknown, extra = '') =>
      // audit-ok: same .xls export as above.
      `<td style="padding:5px 10px;font-family:Arial;font-size:9pt;border:1px solid #D0D0D0;background:${bg};${extra}">${esc(v)}</td>`
    return `<tr>
      ${td(i + 1)}${td(formatDate(a.created_at))}${td(a.full_name)}${td(a.email)}
      ${td(a.phone ?? '')}${td(a.age ?? '')}${td(a.college ?? '')}${td(a.year_of_study ?? '')}
      ${td((a.interests ?? []).join('; '))}${td(a.availability ?? '')}${td(a.why_aquaterra)}
      ${td(a.previous_experience ?? '')}${td(a.instagram_handle ?? '')}
      ${td(meta?.name ?? '-', meta ? `color:${meta.color};font-weight:700;` : 'color:#999;')}
      ${td(a.reviewed ? 'Yes' : 'No')}${td(a.texted_by ?? '')}${td(a.added ? 'Yes' : 'No')}
    </tr>`
  }).join('')

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>table{border-collapse:collapse}td,th{white-space:nowrap}</style></head>
<body><table>${thead}${tbody}</table></body></html>`
}

/* ── Presentational pieces ─────────────────────────────────────────────── */

/** Filter chip for one pipeline label (or the "unmarked" pseudo-label). */
export function LabelChip({ color, name, active, dashed, hollow, onClick }: {
  color: string; name: string; active: boolean; dashed?: boolean; hollow?: boolean; onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} title={`Filter by: ${name}`}
      className={'vol-chip' + (active ? ' is-on' : '') + (dashed ? ' is-dashed' : '')}
      style={{ ['--lc' as any]: color }}>
      <span className={'vol-chip-swatch' + (hollow ? ' is-hollow' : '')} />
      {name}
    </button>
  )
}

/**
 * The five assign-dots in a row's Status cell.
 *
 * REDESIGN 2026-09, section 19. Two things about this control were invisible.
 * The five names lived only in `title` and `aria-label`, and a phone has no
 * hover, so the person tapping could not read any of them; and tapping the
 * ACTIVE dot clears the label, which nothing said. Both are now on the page:
 * the block is captioned, the active dot carries a check glyph, and a mono
 * line names the current label and the clear gesture.
 *
 * `onSet(active ? null : l.key)` is unchanged, `unmarked` is still absent from
 * `LABELS` and therefore still unwritable, and both accessible names stay.
 */
export function LabelDots({ current, onSet }: { current: string | null; onSet: (key: LabelKey | null) => void }) {
  const currentName = LABELS.find(l => l.key === current)?.name
  return (
    <div className="vol-dotblock">
      <span className="vol-dotblock-label">Status</span>
      <div className="vol-dots">
        {LABELS.map(l => {
          const active = current === l.key
          return (
            <button key={l.key} type="button"
              onClick={e => { e.stopPropagation(); onSet(active ? null : l.key) }}
              className={'vol-dot' + (active ? ' is-on' : '')}
              style={{ ['--lc' as any]: l.color }}
              title={active ? `Clear: ${l.name}` : l.name}
              aria-label={active ? `Clear: ${l.name}` : l.name}
              aria-pressed={active}
            >
              <span className="vol-dot-face" aria-hidden>{active ? '✓' : ''}</span>
            </button>
          )
        })}
      </div>
      <p className="adm-note">
        {currentName ? `${currentName}. tap again to clear.` : 'no label yet. tap one to set it.'}
      </p>
    </div>
  )
}

/** The expanded detail panel under an opened row. */
export function AppDetail({ app, copiedId, onCopyPhone, onUpdate, onMarkReviewed, marking }: {
  app: VolApp
  copiedId: number | null
  onCopyPhone: (id: number, phone: string) => void
  onUpdate: (id: number, patch: Partial<VolApp>) => void
  onMarkReviewed: (id: number, reviewed: boolean) => void
  marking: boolean
}) {
  const isPending = !app.reviewed
  return (
    <>
      <div className="adm-grid vol-detail-grid">
        <div>
          <div className="vol-detail-h">Contact</div>
          <div className="vol-detail-body">
            <a href={`mailto:${app.email}`} style={{ color: 'var(--accent-ink)' }}>{app.email}</a>
            {app.phone && (
              <>
                <br />
                <button type="button" className="vol-copybtn"
                  title="Copy name, email, phone, instagram and school, tab separated, for pasting into a sheet"
                  onClick={e => { e.stopPropagation(); onCopyPhone(app.id, app.phone!) }}>
                  {app.phone}
                  <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: copiedId === app.id ? 'var(--welfare)' : 'var(--ink-3)', opacity: copiedId === app.id ? 1 : 0.55 }}>
                    {copiedId === app.id ? '✓ copied' : '⧉ copy'}
                  </span>
                </button>
              </>
            )}
            {app.instagram_handle && <><br />@{app.instagram_handle}</>}
          </div>
        </div>
        <div>
          <div className="vol-detail-h">Background</div>
          <div className="vol-detail-body">
            {app.age && <>{app.age} years old<br /></>}
            {app.college && <>{app.college}<br /></>}
            {app.year_of_study && <>{app.year_of_study}<br /></>}
            {app.availability && <>Available: {app.availability}</>}
          </div>
        </div>
        <div>
          <div className="vol-detail-h">Applied</div>
          <div className="vol-detail-body adm-nums">{formatDate(app.created_at)}</div>
        </div>
      </div>

      {app.interests?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="vol-detail-h" style={{ marginBottom: 8 }}>Interests</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {app.interests.map(i => (
              <span key={i} className="qtag" style={{ ['--cc' as any]: INTEREST_COLORS[i] }}>{i}</span>
            ))}
          </div>
        </div>
      )}

      <div className="vol-panel">
        <div className="vol-detail-h">Why AquaTerra</div>
        <p className="vol-quote">"{app.why_aquaterra}"</p>
      </div>

      {app.previous_experience && (
        <div className="vol-panel">
          <div className="vol-detail-h">Previous Experience</div>
          <p className="vol-prose">{app.previous_experience}</p>
        </div>
      )}

      <div className="vol-panel">
        <div className="vol-detail-h" style={{ marginBottom: 10 }}>Outreach</div>
        <div className="vol-outreach">
          <label onClick={e => e.stopPropagation()} style={{ color: app.texted ? 'var(--sky)' : undefined }}>
            <input type="checkbox" checked={!!app.texted} style={{ accentColor: 'var(--sky)' }}
              onChange={e => onUpdate(app.id, e.target.checked
                ? { texted: true, vol_label: 'texted' }
                : { texted: false, vol_label: app.vol_label === 'texted' ? null : app.vol_label })} />
            {app.texted ? '✓ texted' : 'texted?'}
          </label>
          <label onClick={e => e.stopPropagation()} style={{ color: app.added ? 'var(--welfare)' : undefined }}>
            <input type="checkbox" checked={!!app.added} style={{ accentColor: 'var(--welfare)' }}
              onChange={e => onUpdate(app.id, { added: e.target.checked })} />
            {app.added ? '✓ added' : '✕ not added'}
          </label>
        </div>
        {/* These are NOT two independent switches: ticking `texted?` also
            writes vol_label 'texted', and unticking clears it only while it
            still reads texted. That coupling is why the row's status dots can
            change under you here, and nothing said so. */}
        <p className="adm-note">ticking texted? also sets the status label to texted. unticking clears it only while it still reads texted.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {isPending ? (
          <button onClick={e => { e.stopPropagation(); onMarkReviewed(app.id, true) }}
            disabled={marking} className="btn btn-sm adm-approve">
            {marking ? '…' : '✓ mark as reviewed'}
          </button>
        ) : (
          <button onClick={e => { e.stopPropagation(); onMarkReviewed(app.id, false) }}
            disabled={marking} className="btn btn-sm" style={{ color: 'var(--ink-3)' }}>
            {marking ? '…' : '↩ mark as pending'}
          </button>
        )}
        <a href={`mailto:${app.email}?subject=Your AquaTerra volunteer application&body=Hi ${app.full_name.split(' ')[0]},%0A%0A`}
          className="btn btn-sm" onClick={e => e.stopPropagation()} style={{ textDecoration: 'none' }}>
          ✉ Email applicant
        </a>
      </div>
    </>
  )
}


/**
 * One application as a card - the ledger that renders below 1025px.
 *
 * REDESIGN 2026-09, section 19, the responsive half. The desk is a
 * seven-column table that hid two columns below 560px and scrolled the rest
 * sideways, so a 390px phone showed a checkbox, a row number, a name and five
 * dots. This is the same `apps.map`, the same handlers and the same one data
 * path - no second fetch, no second write - restacked into the table's own
 * field order: select, row number, name and email, college and year, applied,
 * status, disclosure.
 *
 * The row number is NOT a control here. That was the desk's worst hidden
 * affordance (a wa.me link when a phone existed, a plain expand button when
 * not, identical either way); it is already fixed in the table and it stays
 * fixed here. The number is a corner label, WhatsApp is the labelled "WA"
 * chip beside the name, and the expand is the full-width `.adm-disclose`
 * button at the foot of the card.
 */
export function AppCard({
  app, rowNum, isChecked, isOpen, marking, copiedId,
  onToggleSelect, onOpen, onSetLabel, onCopyPhone, onUpdate, onMarkReviewed,
}: {
  app: VolApp
  rowNum: number
  isChecked: boolean
  isOpen: boolean
  marking: boolean
  copiedId: number | null
  onToggleSelect: () => void
  onOpen: () => void
  onSetLabel: (key: LabelKey | null) => void
  onCopyPhone: (id: number, phone: string) => void
  onUpdate: (id: number, patch: Partial<VolApp>) => void
  onMarkReviewed: (id: number, reviewed: boolean) => void
}) {
  const lc = app.vol_label ? LMAP[app.vol_label]?.color : undefined
  const detailId = `vol-card-detail-${app.id}`
  return (
    <article
      className={'adm-lcard vol-lcard'
        + (isChecked ? ' is-checked' : '')
        + (marking ? ' is-busy' : '')}
      style={lc ? { ['--lc' as any]: lc } : undefined}
      aria-busy={marking || undefined}
    >
      <div className="adm-lcard-head vol-lcard-head">
        <label className="vol-lcard-check">
          <input type="checkbox" className="vol-check" checked={isChecked}
            onChange={onToggleSelect} aria-label={`Select ${app.full_name}`} />
        </label>

        <div className="vol-lcard-ident">
          <div className="vol-lcard-nameline">
            {/* Same rule as the table's `.vol-pending-dot`: shown when the
                application has not been reviewed. */}
            {!app.reviewed && <span className="vol-lcard-pending" aria-hidden />}
            <span className="qname vol-cell-clip">{app.full_name}</span>
            {app.phone && (
              <a href={waHref(app.phone)} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} title={`WhatsApp ${app.full_name}`}
                className="vol-wa-btn">WA</a>
            )}
          </div>
          <div className="qsub vol-cell-clip">{app.email}</div>
        </div>

        <span className="adm-lcard-no adm-nums">#{rowNum}</span>
      </div>

      <div className="adm-lcard-facts">
        <span className="vol-college">{app.college || '-'}</span>
        {app.year_of_study && <span className="vol-year">{app.year_of_study}</span>}
        <span className="vol-applied adm-nums vol-lcard-when">{formatDate(app.created_at)}</span>
      </div>

      <div className="vol-lcard-status">
        <LabelDots current={app.vol_label} onSet={onSetLabel} />
      </div>

      <button type="button" className="adm-disclose" onClick={onOpen}
        aria-expanded={isOpen} aria-controls={detailId}>
        the whole application
        {isOpen ? <ChevronUpIcon strokeWidth={2.2} aria-hidden /> : <ChevronDownIcon strokeWidth={2.2} aria-hidden />}
      </button>

      {isOpen && (
        <div className="vol-lcard-detail" id={detailId}>
          <AppDetail
            app={app}
            copiedId={copiedId}
            onCopyPhone={onCopyPhone}
            onUpdate={onUpdate}
            onMarkReviewed={onMarkReviewed}
            marking={marking}
          />
        </div>
      )}
    </article>
  )
}
