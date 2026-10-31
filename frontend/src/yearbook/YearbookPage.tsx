import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import Img from '../components/Img'
import Field from '../components/Field'
import yearbookService, { YearbookEntry } from '../services/yearbookService'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { useMeta } from '../hooks/useMeta'
import ErrorState from '../components/ErrorState'

const CURRENT_EDITION = new Date().getFullYear()
const QUOTE_MAX = 140

/**
 * Member-side yearbook submission - reachable from the notification a
 * director's invite fires (yearbookService.inviteMembers). Not gated behind
 * ProtectedRoute's requireActive beyond the normal auth check; a member who
 * isn't invited just sees an honest "not on this year's list" state rather
 * than a broken form.
 */
export default function YearbookPage() {
  useMeta({ title: `${CURRENT_EDITION} Yearbook | AquaTerra`, description: 'Submit your photo and quote for this year’s AquaTerra yearbook.', url: '/yearbook' })
  const { member } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [entry, setEntry] = useState<YearbookEntry | null | undefined>(undefined) // undefined = loading
  const [loadError, setLoadError] = useState<string | null>(null)
  const [useOwnAvatar, setUseOwnAvatar] = useState(true)
  const [newPhotoFile, setNewPhotoFile] = useState<File | null>(null)
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null)
  const [quote, setQuote] = useState('')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  const loadEntry = () => {
    setLoadError(null)
    yearbookService.getMyEntry(CURRENT_EDITION)
      .then(e => {
        setEntry(e)
        if (e) {
          setUseOwnAvatar(e.useOwnAvatar)
          setQuote(e.quote || '')
        }
      })
      // 11.4: distinguish a real fetch failure from "not invited" (also a
      // resolved `null`, but not an error) - a static "couldn't load this"
      // with no retry previously covered both.
      .catch((e: any) => { console.error('[YearbookPage] load failed:', e); setEntry(null); setLoadError("something went wrong loading your entry.") })
  }

  useEffect(loadEntry, [])

  const handleFile = (file: File | null) => {
    setNewPhotoFile(file)
    if (newPhotoPreview) URL.revokeObjectURL(newPhotoPreview)
    setNewPhotoPreview(file ? URL.createObjectURL(file) : null)
  }

  const handleSubmit = async () => {
    if (!quote.trim()) { toast.error('add a one-line quote first.'); return }
    setSaving(true)
    try {
      let photoUrl: string | undefined
      if (!useOwnAvatar) {
        if (newPhotoFile) {
          photoUrl = await yearbookService.uploadPhoto(newPhotoFile)
        } else if (entry?.photoUrl) {
          photoUrl = entry.photoUrl // re-submitting without picking a new file keeps the old one
        } else {
          toast.error('pick a photo, or switch to using your profile picture.')
          setSaving(false)
          return
        }
      }
      await yearbookService.submitEntry(CURRENT_EDITION, { useOwnAvatar, photoUrl, quote: quote.trim() })
      const fresh = await yearbookService.getMyEntry(CURRENT_EDITION)
      setEntry(fresh)
      setEditing(false)
      toast.success('you’re in the yearbook.')
    } catch (e: any) {
      toast.error('couldn’t save that.', e?.message || 'try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    const ok = await confirm({
      title: 'sit this one out?',
      body: 'you can change your mind and submit later, any time before the yearbook is exported.',
      confirmLabel: 'skip this year',
    })
    if (!ok) return
    try {
      await yearbookService.skipEntry(CURRENT_EDITION)
      setEntry(await yearbookService.getMyEntry(CURRENT_EDITION))
      toast.success('no worries, maybe next year.')
    } catch (e: any) {
      toast.error('couldn’t save that.', e?.message || 'try again.')
    }
  }

  const previewUrl = newPhotoPreview || (useOwnAvatar ? member?.avatar_url : entry?.photoUrl) || null

  if (entry === undefined) {
    return (
      <div className="aq-wrap" aria-busy="true" role="status" style={{ paddingTop: 80, textAlign: 'center' }}>
        <span className="sr-only">loading your yearbook entry…</span>
        <div className="v6-skeleton" style={{ height: 40, maxWidth: 300, margin: '0 auto', borderRadius: 'var(--r-pill)' }} />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="route-enter aq-wrap" style={{ paddingTop: 'clamp(44px, 8vw, 80px)', paddingBottom: 60, maxWidth: 480 }}>
        <ErrorState message="couldn't load this." hint={loadError} onRetry={loadEntry} variant="block" />
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="route-enter aq-wrap" style={{ paddingTop: 'clamp(44px, 8vw, 80px)', paddingBottom: 60, textAlign: 'center' }}>
        {/* An h1, not a div. The invited branch below has one; this branch is
            the WHOLE page for anyone not on the list, and it was rendering a
            document with no heading at all - so a screen reader landed on
            /yearbook with nothing to announce and no way to tell what page it
            was on. Same visual treatment, correct document outline. */}
        <h1 className="h-display" style={{ fontSize: 32, margin: 0 }}>not on this year's list.</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          the {CURRENT_EDITION} yearbook is invite-based. ask HR if you think that's a mix-up.
        </p>
      </div>
    )
  }

  const showForm = editing || entry.status === 'invited'

  return (
    <div className="route-enter aq-wrap" style={{ paddingTop: 'clamp(24px,5vw,40px)', paddingBottom: 60, maxWidth: 480 }}>
      <span className="sticker sticker-lemon sticker--diecut" style={{ marginBottom: 12, display: 'inline-flex', ['--sticker-ground' as string]: 'var(--bg)' }}>★ {CURRENT_EDITION} YEARBOOK</span>
      <h1 className="h-display" style={{ fontSize: 'clamp(32px, 6vw, 44px)', margin: '10px 0 6px', lineHeight: 0.95 }}>
        {entry.status === 'submitted' && !editing ? "you're in."
          : entry.status === 'skipped' && !editing ? 'maybe next year.'
          : 'pick your photo.'}
      </h1>
      <p className="muted" style={{ fontSize: 14, marginBottom: 24 }}>
        {entry.status === 'submitted' && !editing
          ? 'you can still edit this any time before the yearbook is exported.'
          : entry.status === 'skipped' && !editing
          ? "you're still welcome to join in, whenever you're ready."
          : 'your current profile picture, or upload one made for this. one line, whatever you want people to remember.'}
      </p>

      {entry.status === 'skipped' && !editing ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p className="muted">you sat this one out. change your mind any time before the yearbook is exported.</p>
          <button className="btn btn-sm btn-primary" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>submit a photo &amp; quote</button>
        </div>
      ) : showForm ? (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <div className="avatar avatar-xl" style={{ background: hashColor(member?.full_name || ''), border: 'var(--hair-2)', overflow: 'hidden' }}>
              {previewUrl
                ? <Img ctx="avatar" src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                : getInitials(member?.full_name || 'U')}
            </div>
          </div>

          <div className="row gap-2" style={{ justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <button type="button" aria-pressed={useOwnAvatar} className={'chip' + (useOwnAvatar ? ' chip-active' : '')} onClick={() => setUseOwnAvatar(true)}>use my profile picture</button>
            <button type="button" aria-pressed={!useOwnAvatar} className={'chip' + (!useOwnAvatar ? ' chip-active' : '')} onClick={() => { setUseOwnAvatar(false); fileInputRef.current?.click() }}>upload a new one</button>
          </div>
          {/* Rendered unconditionally and hidden with CSS, not conditionally
              mounted. While it was mounted on `!useOwnAvatar`, the chip above
              called `fileInputRef.current?.click()` in the same tick that first
              set `useOwnAvatar` to false - the ref was still null, so the file
              picker never opened on the first press and the control had to be
              activated twice. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            aria-label="Upload a yearbook photo"
            onChange={e => handleFile(e.target.files?.[0] || null)}
            style={{ display: !useOwnAvatar ? 'block' : 'none', margin: '0 auto 16px', fontSize: 12 }}
          />

          <Field label="your quote" labelClassName="mono xs upper muted" labelStyle={{ display: 'block', marginBottom: 4 }} style={{ marginBottom: 4 }}>
            {id => (
              <textarea
                id={id}
                className="textarea"
                style={{ width: '100%' }}
                rows={2}
                maxLength={QUOTE_MAX}
                value={quote}
                onChange={e => setQuote(e.target.value)}
                placeholder="e.g. showed up for every dog feeding drive since 2023."
              />
            )}
          </Field>
          <div className="mono xs muted" style={{ textAlign: 'right', marginBottom: 16 }}>{quote.length}/{QUOTE_MAX}</div>

          <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
            {entry.status !== 'invited' && <button className="btn btn-sm" onClick={() => setEditing(false)} disabled={saving}>cancel</button>}
            {entry.status === 'invited' && <button className="btn btn-sm" onClick={handleSkip} disabled={saving}>skip this year</button>}
            <button className="btn btn-sm btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'saving…' : '✓ submit'}</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <div className="avatar avatar-xl" style={{ background: hashColor(member?.full_name || ''), border: 'var(--hair-2)', overflow: 'hidden' }}>
              {previewUrl
                ? <Img ctx="avatar" src={previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                : getInitials(member?.full_name || 'U')}
            </div>
          </div>
          <p style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--welfare-ink)' }}>"{entry.quote}"</p>
          <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>edit entry</button>
        </div>
      )}
    </div>
  )
}
