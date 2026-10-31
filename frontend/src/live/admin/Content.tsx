import { cloneElement, isValidElement, useCallback, useEffect, useId, useState } from 'react'
import { useMeta } from '../../hooks/useMeta'
import useDialog from '../../hooks/useDialog'
import { useToast } from '../../components/Toast'
import { PHOTOS } from '../data/photos'
import {
  PROGRAMME_PHOTOS, emptyEventForm, emptyProgrammeForm, eventToForm, programmeToForm, validateEventForm, validateProgrammeForm,
  type EventForm, type EventRow, type FormErrors, type ProgrammeForm, type ProgrammeRow,
} from '../lib/content'
import { fetchAllEvents, fetchAllProgrammes, saveEvent, saveProgramme } from '../lib/contentApi'
import { forgetContentCache } from '../lib/useContent'

type Editing =
  | { kind: 'event'; isNew: boolean; form: EventForm }
  | { kind: 'programme'; isNew: boolean; form: ProgrammeForm }

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  const id = useId()
  const control = isValidElement<{ id?: string; 'aria-invalid'?: boolean }>(children)
    ? cloneElement(children, { id: children.props.id ?? id, 'aria-invalid': error ? true : undefined })
    : children
  const forId = isValidElement<{ id?: string }>(children) ? (children.props.id ?? id) : undefined
  return (
    <div>
      <label className="tt-label" htmlFor={forId}>{label}</label>
      {control}
      {hint && !error && <div style={{ marginTop: 4, fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>{hint}</div>}
      {error && <div role="alert" style={{ marginTop: 4, fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-danger)' }}>{error}</div>}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useDialog(true, onClose)
  return (
    <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(10,10,10,0.6)', display: 'grid', placeItems: 'center', padding: 12, overflowY: 'auto' }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="tt-card tt-card--raised" style={{ width: 'min(620px, 100%)', maxHeight: '94dvh', overflowY: 'auto', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="tt-btn tt-btn--quiet" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Edit the nights and the programmes the public site shows. Nothing is removed: untick Published and it leaves the site. */
export function LiveAdminContent() {
  useMeta({ title: 'Content | AquaTerra.live admin', description: 'Edit AquaTerra.live nights and programmes.', path: '/live/admin/content', noIndex: true })
  const { success, error: toastError } = useToast()
  const [events, setEvents] = useState<EventRow[] | null>(null)
  const [programmes, setProgrammes] = useState<ProgrammeRow[] | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [editing, setEditing] = useState<Editing | null>(null)
  const [errors, setErrors] = useState<FormErrors<string>>({})
  const [busy, setBusy] = useState(false)

  const fetchAll = useCallback(() => {
    Promise.all([fetchAllEvents(), fetchAllProgrammes()])
      .then(([e, p]) => { setEvents(e); setProgrammes(p); setState('ok') })
      .catch((err: any) => setState(/relation|does not exist|schema cache/i.test(String(err?.message)) ? 'missing' : 'error'))
  }, [])
  useEffect(fetchAll, [fetchAll])
  const reload = () => { setState('loading'); fetchAll() }

  const open = (e: Editing) => { setErrors({}); setEditing(e) }

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!editing || busy) return
    setBusy(true)
    try {
      if (editing.kind === 'event') {
        const taken = editing.isNew ? (events ?? []).map(e => e.slug) : []
        const r = validateEventForm(editing.form, taken)
        if (!r.ok) { setErrors(r.errors); return }
        await saveEvent(r.row, editing.isNew)
      } else {
        const taken = editing.isNew ? (programmes ?? []).map(p => p.name) : []
        const r = validateProgrammeForm(editing.form, taken)
        if (!r.ok) { setErrors(r.errors); return }
        await saveProgramme(r.row, editing.isNew)
      }
      forgetContentCache()
      success('Saved', 'The public site shows it on the next page load.')
      setEditing(null)
      reload()
    } catch (err: any) {
      toastError("Couldn't save", err?.message ?? 'Try again.')
    } finally {
      setBusy(false)
    }
  }

  const togglePublished = async (kind: 'event' | 'programme', row: EventRow | ProgrammeRow) => {
    try {
      if (kind === 'event') await saveEvent({ ...(row as EventRow), published: !row.published }, false)
      else await saveProgramme({ ...(row as ProgrammeRow), published: !row.published }, false)
      forgetContentCache()
      success(row.published ? 'Hidden from the site' : 'Back on the site')
      reload()
    } catch (err: any) {
      toastError("Couldn't save", err?.message ?? 'Try again.')
    }
  }

  const ef = editing?.kind === 'event' ? editing.form : null
  const pf = editing?.kind === 'programme' ? editing.form : null
  const setE = (patch: Partial<EventForm>) => editing?.kind === 'event' && setEditing({ ...editing, form: { ...editing.form, ...patch } })
  const setP = (patch: Partial<ProgrammeForm>) => editing?.kind === 'programme' && setEditing({ ...editing, form: { ...editing.form, ...patch } })

  return (
    <div className="tt-wrap tt-page" style={{ maxWidth: 1000 }}>
      <header style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div><div className="tt-kicker">AquaTerra.live admin</div><h1>Content</h1></div>
        <button type="button" className="tt-btn tt-btn--quiet" style={{ marginLeft: 'auto' }} onClick={reload}>Refresh</button>
      </header>
      <p style={{ color: 'var(--tt-muted)', maxWidth: '62ch', marginTop: 0 }}>
        The nights and programmes on the public site. Untick Published to hide one; nothing is removed. The countdown date and the ticket
        link live in the code (<code>live/config.ts</code>). Photos are files, so a new photo needs the developer.
      </p>

      {state === 'loading' && <div className="tt-card" role="status" aria-label="Loading">Loading…</div>}
      {state === 'missing' && <div className="tt-card" role="alert"><h2>Content tables are not set up yet.</h2><p>Run <code>scripts/live_content_2026_10_24.sql</code>. Until then the site shows its built-in content.</p></div>}
      {state === 'error' && <div className="tt-card" role="alert"><h2>Couldn&apos;t load the content.</h2><p>Your account may not have permission. Try Refresh.</p></div>}

      {state === 'ok' && events && programmes && (
        <>
          <section aria-labelledby="ct-ev" style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h2 id="ct-ev" style={{ margin: 0 }}>The nights ({events.length})</h2>
              <button type="button" className="tt-btn" style={{ marginLeft: 'auto' }} onClick={() => open({ kind: 'event', isNew: true, form: emptyEventForm() })}>Add a night</button>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {events.map(r => (
                <li key={r.slug} className="tt-card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', opacity: r.published ? 1 : 0.6 }}>
                  <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <strong>{r.name}{r.edition ? `, ${r.edition}` : ''}</strong>
                    <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>{r.date_label} · {r.status} · /{r.slug}{r.published ? '' : ' · hidden'}</div>
                  </div>
                  <button type="button" className="tt-btn tt-btn--quiet" onClick={() => open({ kind: 'event', isNew: false, form: eventToForm(r) })}>Edit</button>
                  <button type="button" className="tt-btn tt-btn--quiet" aria-pressed={!r.published} onClick={() => void togglePublished('event', r)}>{r.published ? 'Hide' : 'Show'}</button>
                </li>
              ))}
              {events.length === 0 && <li className="tt-card">No nights yet. The site is showing its built-in list.</li>}
            </ul>
          </section>

          <section aria-labelledby="ct-pr">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <h2 id="ct-pr" style={{ margin: 0 }}>The programmes ({programmes.length})</h2>
              <button type="button" className="tt-btn" style={{ marginLeft: 'auto' }} onClick={() => open({ kind: 'programme', isNew: true, form: emptyProgrammeForm() })}>Add a programme</button>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {programmes.map(r => (
                <li key={r.name} className="tt-card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', opacity: r.published ? 1 : 0.6 }}>
                  <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                    <strong>{r.name}</strong>
                    <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>{r.line}{r.published ? '' : ' · hidden'}</div>
                  </div>
                  <button type="button" className="tt-btn tt-btn--quiet" onClick={() => open({ kind: 'programme', isNew: false, form: programmeToForm(r) })}>Edit</button>
                  <button type="button" className="tt-btn tt-btn--quiet" aria-pressed={!r.published} onClick={() => void togglePublished('programme', r)}>{r.published ? 'Hide' : 'Show'}</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {ef && editing?.kind === 'event' && (
        <Modal title={editing.isNew ? 'Add a night' : `Edit ${ef.name || ef.slug}`} onClose={() => setEditing(null)}>
          <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 12 }}>
            <Field label="Page address" error={errors.slug} hint="Becomes /live/events/<this>. Fixed once saved."><input className="tt-input" value={ef.slug} disabled={!editing.isNew} onChange={e => setE({ slug: e.target.value })} placeholder="disco-diwali-2027" /></Field>
            <Field label="Name" error={errors.name}><input className="tt-input" value={ef.name} onChange={e => setE({ name: e.target.value })} maxLength={80} /></Field>
            <Field label="Edition (optional)" error={errors.edition}><input className="tt-input" value={ef.edition} onChange={e => setE({ edition: e.target.value })} maxLength={80} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Status" error={errors.status}><select className="tt-select" value={ef.status} onChange={e => setE({ status: e.target.value })}><option value="upcoming">Upcoming</option><option value="past">Past</option></select></Field>
              <Field label="Sort key" error={errors.whenKey} hint="2026-11-10, 2025-10 or 2024"><input className="tt-input" value={ef.whenKey} onChange={e => setE({ whenKey: e.target.value })} /></Field>
            </div>
            <Field label="Date, in words" error={errors.dateLabel}><input className="tt-input" value={ef.dateLabel} onChange={e => setE({ dateLabel: e.target.value })} maxLength={60} /></Field>
            <Field label="About the night" error={errors.blurb} hint="One or two sentences. No rupee figures."><textarea className="tt-textarea" rows={3} value={ef.blurb} onChange={e => setE({ blurb: e.target.value })} maxLength={400} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Venue (optional)" error={errors.venue}><input className="tt-input" value={ef.venue} onChange={e => setE({ venue: e.target.value })} maxLength={80} /></Field>
              <Field label="Time (optional)" error={errors.timeLabel}><input className="tt-input" value={ef.timeLabel} onChange={e => setE({ timeLabel: e.target.value })} maxLength={40} /></Field>
            </div>
            <Field label="Link (optional)" error={errors.href} hint="A page on this site, or a full https:// link"><input className="tt-input" value={ef.href} onChange={e => setE({ href: e.target.value })} placeholder="/live/disco-diwali" autoCapitalize="none" /></Field>
            <Field label="Photos (optional)" error={errors.photoIds} hint={`Ids, separated by commas. Available: ${PHOTOS.map(p => p.id).join(', ')}`}><textarea className="tt-textarea" rows={2} value={ef.photoIds} onChange={e => setE({ photoIds: e.target.value })} /></Field>
            <Field label="Good to know (optional)" error={errors.highlights} hint="One line each, up to 8"><textarea className="tt-textarea" rows={3} value={ef.highlights} onChange={e => setE({ highlights: e.target.value })} /></Field>
            <div style={{ display: 'flex', gap: 14, alignItems: 'end', flexWrap: 'wrap' }}>
              <Field label="Order" error={errors.sort} hint="Lower shows first"><input className="tt-input" style={{ width: 110 }} inputMode="numeric" value={ef.sort} onChange={e => setE({ sort: e.target.value })} /></Field>
              <label className="tt-check"><input type="checkbox" checked={ef.published} onChange={e => setE({ published: e.target.checked })} /><span>Published</span></label>
            </div>
            <button type="submit" className="tt-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </form>
        </Modal>
      )}

      {pf && editing?.kind === 'programme' && (
        <Modal title={editing.isNew ? 'Add a programme' : `Edit ${pf.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 12 }}>
            <Field label="Name" error={errors.name} hint={editing.isNew ? undefined : 'Fixed once saved.'}><input className="tt-input" value={pf.name} disabled={!editing.isNew} onChange={e => setP({ name: e.target.value })} maxLength={60} /></Field>
            <Field label="What it is, in a line" error={errors.line} hint="Programme names only. No rupee figures."><input className="tt-input" value={pf.line} onChange={e => setP({ line: e.target.value })} maxLength={200} /></Field>
            <Field label="Photo (optional)" error={errors.photo}>
              <select className="tt-select" value={pf.photo} onChange={e => setP({ photo: e.target.value })}>
                <option value="">No photo</option>
                {PROGRAMME_PHOTOS.map(p => <option key={p} value={p}>{p === 'food' ? 'Food distribution volunteer' : 'Sundarbans learning session'}</option>)}
              </select>
            </Field>
            {pf.photo && <Field label="Describe the photo" error={errors.photoAlt} hint="For people who cannot see it"><input className="tt-input" value={pf.photoAlt} onChange={e => setP({ photoAlt: e.target.value })} maxLength={200} /></Field>}
            <div style={{ display: 'flex', gap: 14, alignItems: 'end', flexWrap: 'wrap' }}>
              <Field label="Order" error={errors.sort} hint="Lower shows first"><input className="tt-input" style={{ width: 110 }} inputMode="numeric" value={pf.sort} onChange={e => setP({ sort: e.target.value })} /></Field>
              <label className="tt-check"><input type="checkbox" checked={pf.published} onChange={e => setP({ published: e.target.checked })} /><span>Published</span></label>
            </div>
            <button type="submit" className="tt-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
