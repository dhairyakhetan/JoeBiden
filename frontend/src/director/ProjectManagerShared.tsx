// Extracted from ProjectManager.tsx (Phase 6.3 split): shared types, consts,
// pure helpers, and the two presentational sub-components (ImageUploadZone,
// Field). Pure relocation - no logic change.
import Img from '../components/Img'
import Skeleton from '../components/Skeleton'
import { Link } from 'react-router-dom'
import { useState, useRef, useEffect, useId, type ReactNode } from 'react'
import { supabase, OBJ_COLORS, type WelfareProject } from '../lib/supabase'
import { resizeForUpload } from '../lib/resizeImage'
import { useToast } from '../components/Toast'
import { useDebounce } from '../hooks/useDebounce'
import attendanceService from '../services/attendanceService'
import { XMarkIcon } from '@heroicons/react/24/outline'

export type Project = WelfareProject

export const LIST_COLS = 'id,slug,is_draft,header,featured,objective,location,workshop_date,volunteers,main_image,main_image_alt,key_statistic'

export const OBJECTIVES = [
  'Workshop', 'Feeding Dogs', 'Plantation Drive', 'Distribution Drive',
  'Sundarbans Relief', 'Old Age Home Visit', 'Fundraising Event', 'Others',
]

export type ListProject = Pick<Project,
  'id' | 'slug' | 'is_draft' | 'header' | 'featured' | 'objective' |
  'location' | 'workshop_date' | 'volunteers' | 'main_image' | 'main_image_alt' | 'key_statistic'
>

export const BLANK: Omit<Project, 'id'> = {
  slug: '', is_draft: true, header: '', featured: false,
  location: null, key_statistic: null, workshop_date: null,
  objective: null, short_summary: null, long_writeup: null,
  collab_name: null, collab_logo: null,
  image_1: null, image_1_alt: null, label_1: null,
  image_2: null, image_2_alt: null, label_2: null,
  image_3: null, image_3_alt: null, label_3: null,
  image_4: null, image_4_alt: null, label_4: null,
  volunteers: null, instagram_link: null,
  main_image: null, main_image_alt: null, google_drive_link: null,
}


// Short, cute, auto-generated web address - no manual "slug" field for admins
// to think about. Takes the first couple of meaningful words from the
// workshop name and tags on a short random suffix so two similarly-titled
// projects never collide (e.g. "Dog Feeding Drive, Ballygunge" -> "dog-feeding-4kx9").
const SLUG_STOPWORDS = new Set(['a', 'an', 'the', 'of', 'at', 'in', 'on', 'for', 'and', 'to', 'with', 'by'])
function randomTag(): string {
  return Math.random().toString(36).slice(2, 6)
}
export function cuteSlug(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(w => w && !SLUG_STOPWORDS.has(w))
  const base = words.slice(0, 2).join('-').slice(0, 24).replace(/-+$/, '')
  return (base || 'project') + '-' + randomTag()
}

// Translate the raw Postgres error into something an admin can act on. The
// client-side slug check in ProjectModal catches the common case already -
// this is the fallback for races or any other unique-constraint violation.
export function friendlyDbError(error: { message: string; code?: string }): string {
  if (error.code === '23505' || /duplicate key value/i.test(error.message)) {
    return 'that web address (slug) is already used by another project.'
  }
  return error.message
}

// ─── Image uploader ──────────────────────────────────────────────────────────

export const BUCKET = 'project-images'
export const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function uploadImage(original: File): Promise<string> {
  // Drive photos come straight off a phone - this is the call site that put a
  // 3840 px / 1.5 MB hero into a 342 px tile on /projects. Cap at 1920 px long
  // edge (lib/resizeImage.ts). Never throws: the original is uploaded if the
  // resize fails, so a browser quirk can't cost an admin their photo.
  const file = await resizeForUpload(original, 'project')
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '86400', upsert: false })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export function ImageUploadZone({
  value, alt, onUrlChange, onAltChange, label, hint, compact, onUploadingChange,
}: {
  value: string | null
  alt?: string | null
  onUrlChange: (url: string | null) => void
  onAltChange?: (alt: string | null) => void
  label: string
  hint?: string
  compact?: boolean
  // Lets the parent form know an upload is in flight, so it can hold off
  // "Save" until every image has actually finished uploading - otherwise a
  // save that fires mid-upload silently ships without the photo just dropped.
  onUploadingChange?: (uploading: boolean) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const file = files[0]
    if (!file.type.startsWith('image/')) { setError('That’s not an image file - use JPG, PNG or WebP.'); return }
    if (file.size > MAX_SIZE) { setError('Too big - keep it under 5 MB.'); return }
    setError(null); setUploading(true); onUploadingChange?.(true)
    try {
      const url = await uploadImage(file)
      onUrlChange(url)
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally { setUploading(false); onUploadingChange?.(false) }
  }

  const h = compact ? 100 : 170

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && <span className="pm-label">{label}</span>}
      {hint && <span className="pm-hint" style={{ marginTop: -4 }}>{hint}</span>}

      {value ? (
        <div style={{ position: 'relative', borderRadius: 'var(--r-tight)', overflow: 'hidden', border: 'var(--hod-border-w) solid var(--hod-border)', boxShadow: 'var(--lift-1)' }}>
          <Img ctx="thumb" src={value} alt={alt ?? ''} style={{ width: '100%', height: h, objectFit: 'cover', display: 'block' }} />
          <span className="pm-img-ok">✓ uploaded</span>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, transparent 50%)', display: 'flex', alignItems: 'flex-end', padding: 10, gap: 8 }}>
            <button type="button" className="pm-img-btn" onClick={() => inputRef.current?.click()}>Replace</button>
            <button type="button" className="pm-img-btn pm-img-btn-danger" onClick={() => onUrlChange(null)}>Remove</button>
          </div>
        </div>
      ) : (
        // A real <button>, not a <div onClick>: the only file input is
        // visually hidden, so without this the drop zone was the sole way to
        // upload and it could not be reached or fired from a keyboard.
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          aria-label={label ? `Upload ${label}` : 'Upload image'}
          style={{
            height: h, borderRadius: 'var(--r-tight)', cursor: 'pointer',
            width: '100%', font: 'inherit', color: 'inherit', margin: 0,
            // Dashed ink border - same "empty ledger slot" treatment as
            // `.ledger-empty` (border-w dashed hod-border), mint on drag.
            // audit-ok: dashed - a drag-and-drop upload target
            border: `2px dashed ${dragOver ? 'var(--welfare)' : 'var(--hod-border)'}`,
            background: dragOver ? 'color-mix(in srgb, var(--welfare) 8%, transparent)' : 'var(--hod-surface-1)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'border-color 0.15s, background 0.15s', textAlign: 'center', padding: 10,
          }}>
          {uploading ? (
            <>
              <span className="pm-spinner" />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--welfare-ink)' }}>Uploading…</span>
            </>
          ) : (
            <>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={dragOver ? 'var(--welfare)' : 'var(--ink-3)'} strokeWidth="1.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: dragOver ? 'var(--welfare)' : 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {dragOver ? 'Drop to upload' : 'Drop image or click to browse'}
              </span>
              {!compact && <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)', opacity: 0.8 }}>JPG · PNG · WebP, up to 5 MB</span>}
            </>
          )}
        </button>
      )}

      {/* Hidden from sight but not from the accessibility tree - `display: none`
          here plus a div trigger left no keyboard path to a file picker. */}
      <input ref={inputRef} type="file" accept="image/*" tabIndex={-1} aria-hidden
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />

      {onAltChange && (
        <div className="pm-field" style={{ gap: 4 }}>
          <input className="input pm-input" placeholder="Describe the photo (for screen readers)" value={alt ?? ''}
            onChange={e => onAltChange(e.target.value || null)} style={{ fontSize: 12 }} />
          <span className="pm-hint">Alt text - a short description for visually-impaired visitors & SEO.</span>
        </div>
      )}

      {error && <span role="alert" className="pm-err">⚠ {error}</span>}
    </div>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────
export type ModalTab = 'basics' | 'content' | 'images' | 'links'

// A labelled field with a description line and optional inline error.
//
// This used to render the label as a bare <span> with no `htmlFor` and no id on
// the control, so every control in the project editor was announced as
// "edit text, blank". It now generates the id itself and hands it to the child
// through a render prop, the same contract as `components/Field.tsx` (which
// isn't reused here only because this one carries the desk's own
// `.pm-field` / `.pm-label` / `.pm-req` / `.pm-hint` / `.pm-err` chrome).
//
// `group` is for the two call sites whose child is not a single form control
// (the category chip row and the collaboration-logo uploader): a <label> may
// only point at one control, so those render a labelled `role="group"` instead.
export function Field({ label, hint, required, error, children, span2, group }: {
  label: string
  hint?: string
  required?: boolean
  error?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
  span2?: boolean
  group?: boolean
}) {
  const id = useId()
  const msgId = `${id}-msg`
  const describedBy = error || hint ? msgId : undefined
  const labelBody = <>{label}{required && <b className="pm-req"> required</b>}</>

  return (
    <div className={'pm-field' + (span2 ? ' pm-span-2' : '')}
      {...(group ? { role: 'group', 'aria-labelledby': id, 'aria-describedby': describedBy } : {})}>
      {group
        ? <span className="pm-label" id={id}>{labelBody}</span>
        : <label className="pm-label" htmlFor={id}>{labelBody}</label>}
      {children(id, describedBy)}
      {error
        ? <span className="pm-err" id={msgId}>⚠ {error}</span>
        : hint && <span className="pm-hint" id={msgId}>{hint}</span>}
    </div>
  )
}

// useModalA11y now lives in adminKit (single definition for the whole desk);
// re-exported here so existing importers (ProjectModal) keep working.
export { useModalA11y } from './adminKit'

// ─── Drive lead assignment ───────────────────────────────────────────────────
// Relocated from the standalone /director/drives desk (deleted 2026-09-12,
// owner request) into the one other desk over the SAME welfare_projects
// rows. Self-fetches the current lead via attendanceService.getDrive rather
// than taking it as a prop, since ProjectModal's list-row `initial` doesn't
// carry drive_lead_member_id/attendance_completed_at (LIST_COLS never
// selected them - this field only needs them once a project is already
// being edited, not for every row in the table).
//
// NOTE for whoever reads this next: deleting the /director/drives desk
// narrows who can assign a lead from "any HoD/director" (that desk's
// privilege: 'leader') to "super_admin only" (ProjectManager's privilege:
// 'super', since this field now lives inside it). That is a real,
// deliberate narrowing of who can do this, not an oversight - flagged
// here because welfare_projects' own RLS still allows any director/hod to
// write drive_lead_member_id; the route gate is what actually changed.
export function DriveLeadField({ projectId }: { projectId: number }) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [driveLeadMemberId, setDriveLeadMemberId] = useState<number | null>(null)
  const [attendanceCompletedAt, setAttendanceCompletedAt] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ member_id: number; full_name: string; avatar_url: string | null }[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const debounced = useDebounce(query, 300)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    attendanceService.getDrive(projectId)
      .then(res => {
        if (cancelled) return
        setDriveLeadMemberId(res.data.driveLeadMemberId)
        setAttendanceCompletedAt(res.data.attendanceCompletedAt)
        setQuery(res.data.leadName || '')
      })
      .catch(() => { if (!cancelled) toast.error('couldn’t load the drive lead.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (debounced.trim().length < 2) { setResults([]); return }
      try {
        const res = await attendanceService.searchMembers(debounced.trim())
        if (!cancelled) setResults(res.data)
      } catch { /* assist only - a failed search shouldn't block manual retyping */ }
    }
    run()
    return () => { cancelled = true }
  }, [debounced])

  const pick = async (m: { member_id: number; full_name: string }) => {
    setSaving(true); setOpen(false)
    try {
      await attendanceService.assignLead(projectId, m.member_id)
      setQuery(m.full_name)
      setDriveLeadMemberId(m.member_id)
      toast.success(`${m.full_name} is now the lead for this drive`)
    } catch (e: any) {
      toast.error('couldn’t assign that lead.', e?.message || 'try again.')
    } finally {
      setSaving(false)
    }
  }

  const clear = async () => {
    setSaving(true)
    try {
      await attendanceService.assignLead(projectId, null)
      setQuery('')
      setDriveLeadMemberId(null)
      toast.success('lead cleared')
    } catch (e: any) {
      toast.error('couldn’t clear that.', e?.message || 'try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Field label="Drive lead" group>
        {() => <Skeleton variant="line" width={160} height={16} />}
      </Field>
    )
  }

  const signedOff = !!attendanceCompletedAt
  if (signedOff && !reassigning) {
    return (
      <Field label="Drive lead" group hint="Who runs check-in on the day. This drive's attendance is already signed off - reassigning after that is rare.">
        {() => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{query || 'not recorded'}</span>
            <button type="button" className="pm-img-btn" onClick={() => setReassigning(true)}>change</button>
          </div>
        )}
      </Field>
    )
  }

  return (
    <Field label="Drive lead" group hint="Two letters to search. Setting a lead is what turns the paper sheet into a real check-in.">
      {(id) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id={id}
              className="input pm-input"
              style={{ flex: '1 1 auto', minWidth: 0 }}
              value={query}
              disabled={saving}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder="assign a lead…"
            />
            {driveLeadMemberId != null && (
              <button type="button" className="pm-img-btn pm-img-btn-danger" disabled={saving} onClick={clear}
                title="clear the assigned lead" aria-label="clear the assigned lead"
                style={{ width: 36, height: 36, flex: 'none', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <XMarkIcon width={14} height={14} strokeWidth={2.4} aria-hidden />
              </button>
            )}
            {driveLeadMemberId != null && (
              <Link className="btn btn-sm" to={`/drive/${projectId}/check-in`} style={{ flex: 'none', whiteSpace: 'nowrap' }}>
                open sheet →
              </Link>
            )}
          </div>
          {open && results.length > 0 && (
            <div role="listbox" className="card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
              {results.map(m => (
                <button
                  key={m.member_id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={e => { e.preventDefault(); pick(m) }}
                  onClick={() => pick(m)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0 12px', minHeight: 40, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--sans)', color: 'var(--ink)' }}
                >
                  {m.full_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Field>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Modal form sections (stage 3A split out of ProjectModal.tsx).
   ─────────────────────────────────────────────────────────────────────────
   ProjectModal was the largest single file on the desk; its four tab bodies
   are pure presentation over `form` + `set`, so they live here as their own
   components. ProjectModal keeps the state, validation and save logic.
   ═══════════════════════════════════════════════════════════════════════ */

/** What every tab body needs: the form, a setter, and the advanced-reveal state. */
export interface TabProps {
  form: Partial<Project>
  set: (k: keyof Project, v: unknown) => void
  adv: Set<ModalTab>
  toggleAdv: (t: ModalTab) => void
  bumpUploading: (active: boolean) => void
}

/** The progressive-disclosure reveal that opens a tab's optional fields. */
function AdvToggle({ open, onClick, openLabel, shutLabel }: {
  open: boolean; onClick: () => void; openLabel: string; shutLabel: string
}) {
  return (
    <button type="button" className={'pm-adv-toggle' + (open ? ' pm-adv-open' : '')}
      onClick={onClick} aria-expanded={open}>
      <span className="pm-adv-chev">⌄</span>{open ? openLabel : shutLabel}
    </button>
  )
}

export function BasicsTab({
  form, set, adv, toggleAdv, headerErr, onHeaderChange, onTouch,
}: Omit<TabProps, 'bumpUploading'> & {
  headerErr: string
  onHeaderChange: (v: string) => void
  onTouch: (k: string) => void
}) {
  const open = adv.has('basics')
  return (
    <div className="pm-grid">
      {/* Essentials - the three things every project needs. */}
      <Field label="Title" required error={headerErr} span2
        hint="The card title and page headline. Be specific - name the activity + place.">
        {(id, db) => (
          <input id={id} aria-describedby={db} className={'input pm-input' + (headerErr ? ' pm-input-error' : '')} value={form.header ?? ''}
            onChange={e => onHeaderChange(e.target.value)} onBlur={() => onTouch('header')}
            placeholder="e.g. Dog Feeding Drive, Ballygunge" />
        )}
      </Field>

      {/* Colour-coded chip picker - every other category picker on this site
          (CreatePostModal / OpeningFormModal) is a chip row, not a select. */}
      <Field label="Category" group hint="Sets the accent colour & groups the project.">
        {() => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {OBJECTIVES.map(o => {
            const on = form.objective === o
            const col = OBJ_COLORS[o] || 'var(--welfare)'
            return (
              <button key={o} type="button" onClick={() => set('objective', on ? null : o)}
                className="pm-obj-chip"
                style={on
                  ? { background: col, borderColor: col, color: '#fff' }
                  : { background: 'var(--card)', borderColor: 'var(--hod-border)', color: 'var(--ink-2)' }}>
                {o}
              </button>
            )
          })}
        </div>
        )}
      </Field>

      <Field label="Date" hint="Sorts projects (newest first) & shows on the card.">
        {(id, db) => <input id={id} aria-describedby={db} className="input pm-input" type="date" value={form.workshop_date ?? ''} onChange={e => set('workshop_date', e.target.value || null)} />}
      </Field>

      {/* Who runs check-in on the day - only meaningful once the project
          exists (drive_lead_member_id lives on the row itself, not the
          unsaved form). Absent entirely on "+ New project" until saved once. */}
      {form.id != null && <div className="pm-span-2"><DriveLeadField projectId={form.id} /></div>}

      {/* Everything else is optional - tucked away until asked for. */}
      <div className="pm-span-2">
        <AdvToggle open={open} onClick={() => toggleAdv('basics')}
          openLabel="Hide extra details" shutLabel="More details - location, volunteers, stat" />
      </div>

      {open && (
        <>
          <Field label="Location" hint="Shown under the title on the card & detail page.">
            {(id, db) => <input id={id} aria-describedby={db} className="input pm-input" value={form.location ?? ''} onChange={e => set('location', e.target.value || null)} placeholder="e.g. Ballygunge, Kolkata" />}
          </Field>

          <Field label="Volunteers" hint="Headline count shown on the card.">
            {(id, db) => <input id={id} aria-describedby={db} className="input pm-input" type="number" min={0} value={form.volunteers ?? ''} onChange={e => set('volunteers', e.target.value ? parseInt(e.target.value) : null)} placeholder="e.g. 24" />}
          </Field>

          <Field label="Key statistic" span2 hint="One punchy outcome shown on the card.">
            {(id, db) => <input id={id} aria-describedby={db} className="input pm-input" value={form.key_statistic ?? ''} onChange={e => set('key_statistic', e.target.value || null)} placeholder="e.g. 200 meals served · 50 saplings planted" />}
          </Field>
        </>
      )}
    </div>
  )
}

export function ContentTab({ form, set, adv, toggleAdv, bumpUploading }: TabProps) {
  const open = adv.has('content')
  const summaryLen = (form.short_summary ?? '').length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Essential - the one line that sells the project on the card. */}
      <Field label="Short summary"
        hint={`1–2 sentences shown on the card & as the page intro. ${summaryLen}/180 characters${summaryLen > 180 ? ' - a bit long' : ''}.`}>
        {(id, db) => <textarea id={id} aria-describedby={db} className="input pm-input" rows={3} value={form.short_summary ?? ''} onChange={e => set('short_summary', e.target.value || null)} placeholder="e.g. Volunteers fed 60 street dogs across Ballygunge and set up three feeding points for the monsoon." style={{ resize: 'vertical' }} />}
      </Field>

      <AdvToggle open={open} onClick={() => toggleAdv('content')}
        openLabel="Hide write-up & partner" shutLabel="Add the full write-up & a partner" />

      {open && (
        <>
          <Field label="Full write-up" hint="The full story on the detail page - context, what happened, the impact. Markdown supported (## headings, **bold**, - lists).">
            {/* --code, not --mono: this holds the director's own lowercase
                markdown prose, and --mono is NeutralFace (caps-only glyphs) -
                it would render every word typed here as if shouted. */}
            {(id, db) => <textarea id={id} aria-describedby={db} className="input pm-input" rows={11} value={form.long_writeup ?? ''} onChange={e => set('long_writeup', e.target.value || null)} placeholder={'## The drive\nWhat we set out to do…\n\n## Impact\n- 60 dogs fed\n- 3 feeding points set up'} style={{ resize: 'vertical', fontFamily: 'var(--code)', fontSize: 13 }} />}
          </Field>

          <Field label="Collaboration name" hint="Partner organisation credited on the project (optional).">
            {(id, db) => <input id={id} aria-describedby={db} className="input pm-input" value={form.collab_name ?? ''} onChange={e => set('collab_name', e.target.value || null)} placeholder="e.g. Goonj · Calcutta Rescue" />}
          </Field>

          <Field label="Collaboration logo" group hint="Partner's logo, shown beside their name.">
            {() => <ImageUploadZone value={form.collab_logo ?? null} label="" onUrlChange={url => set('collab_logo', url)} onUploadingChange={bumpUploading} compact />}
          </Field>
        </>
      )}
    </div>
  )
}

export function ImagesTab({ form, set, adv, toggleAdv, bumpUploading }: TabProps) {
  const open = adv.has('images')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ImageUploadZone
        value={form.main_image ?? null}
        alt={form.main_image_alt}
        onUrlChange={url => set('main_image', url)}
        onAltChange={alt => set('main_image_alt', alt)}
        onUploadingChange={bumpUploading}
        label="Hero image"
        hint="The headline photo - used as the card thumbnail and the detail-page banner. Best at landscape 4:3, at least 1200px wide." />

      <AdvToggle open={open} onClick={() => toggleAdv('images')}
        openLabel="Hide gallery photos" shutLabel="Add gallery photos (up to 4)" />

      {open && (
        <div>
          <span className="pm-hint" style={{ display: 'block', marginBottom: 14 }}>Extra photos shown in the detail-page gallery. Add a caption to each.</span>
          {/* `.adm-grid` (not a bare inline gridTemplateColumns) so the desk's
              phone rule can flatten it to a single stacked column. */}
          <div className="adm-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {([1, 2, 3, 4] as const).map(n => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ImageUploadZone
                  value={(form as any)[`image_${n}`] ?? null}
                  alt={(form as any)[`image_${n}_alt`]}
                  onUrlChange={url => set(`image_${n}` as any, url)}
                  onAltChange={alt => set(`image_${n}_alt` as any, alt)}
                  onUploadingChange={bumpUploading}
                  label={`Photo ${n}`} compact />
                <input className="input pm-input" placeholder="Caption (optional)"
                  value={(form as any)[`label_${n}`] ?? ''}
                  onChange={e => set(`label_${n}` as any, e.target.value || null)}
                  style={{ fontSize: 12 }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function LinksTab({ form, set }: Pick<TabProps, 'form' | 'set'>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Field label="Instagram link" hint="Link to the project's Instagram post or reel. Shows a ‘View on Instagram’ button.">
        {(id, db) => <input id={id} aria-describedby={db} className="input pm-input" value={form.instagram_link ?? ''} onChange={e => set('instagram_link', e.target.value || null)} placeholder="https://instagram.com/p/…" />}
      </Field>
      <Field label="Google Drive link" hint="Public Drive folder with the full photo set (optional).">
        {(id, db) => <input id={id} aria-describedby={db} className="input pm-input" value={form.google_drive_link ?? ''} onChange={e => set('google_drive_link', e.target.value || null)} placeholder="https://drive.google.com/…" />}
      </Field>
    </div>
  )
}

