import Img from '../components/Img'
import './EditProfilePage.css'
import { classOptionsFor } from '../lib/classOptions'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import profileService from '../services/profileService'
import schoolService from '../services/schoolService'
import wallService from '../services/wallService'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { checkText, BLOCK_MESSAGE } from '../lib/profanityFilter'
import { getInitials } from '../lib/uiHelpers'
import AvatarCropModal from '../components/AvatarCropModal'

// The shared `School` from services/api.ts, not a local restatement of it. The
// local one existed only so the service result could be force-cast into shape,
// and that cast is exactly what let the service stop selecting `school_id`
// without a single compile error - while the page called `.toString()` on the
// missing field in three places.
import type { School } from '../services/api'

// 12-secondary-pages.md §12.10 / 11-system-states.md §11.10: the one field
// this form has ever actually required. Lifted onto CollaborationsPage.tsx's
// fieldErrors shape (11.10: "the only correct implementation in the
// codebase - copy it; do not invent a second one") rather than the single
// top-of-form banner this file used before, which named no field. `bio`
// carries the profanity-filter rejection too, once submit resolves it, so
// the person editing sees the block message where the problem actually is.
type ProfileField = 'fullName' | 'bio'

const EditProfilePage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { member: authMember, refreshMember } = useAuth()
  const { success, error: toastError } = useToast()
  const confirm = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarSectionRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    fullName: '', email: '', classGrade: '', phone: '', avatarUrl: '', bio: '', schoolId: '', birthday: ''
  })
  // The saved snapshot, so "is there an unsaved change" (11.9 state 10) can
  // be a real diff rather than a `dirty` flag that never resets after save.
  const savedSnapshot = useRef(formData)
  const [schools, setSchools] = useState<School[]>([])
  const [schoolSearch, setSchoolSearch] = useState('')
  const [showSchoolList, setShowSchoolList] = useState(false)
  const schoolComboRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ProfileField, string>>>({})
  // §16.2's off-switch. `undefined` while unknown (own member row not
  // fetched yet) so the control never renders a wrong resting state.
  const [wallEnabled, setWallEnabled] = useState<boolean | undefined>(undefined)
  const [wallSaving, setWallSaving] = useState(false)

  const isDirty = JSON.stringify(formData) !== JSON.stringify(savedSnapshot.current)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [profileResult, schoolsResult] = await Promise.all([
          profileService.getOwnProfile(),
          // 212 schools live. At limit 100 the picker held an arbitrary
          // (and, before the service gained an .order(), unstable) subset,
          // so a member whose school was in the other half simply could not
          // find it. 500 covers the table with room to grow; if it ever
          // outgrows that, this wants a server-side search rather than a
          // bigger number.
          schoolService.getSchools({ limit: 500 })
        ])
        if (profileResult.success) {
          const { member: p } = profileResult.data
          const next = {
            fullName: p.fullName || '', email: p.email || '',
            classGrade: p.classGrade || '', phone: p.phone || '',
            avatarUrl: p.avatarUrl || '', bio: p.bio || '',
            schoolId: p.schoolId?.toString() || '', birthday: p.birthday || ''
          }
          setFormData(next)
          savedSnapshot.current = next
        }
        // No cast: `School` in services/api.ts now declares schoolId, which is
        // the field this page keys on. The cast is what hid the fact that the
        // service had stopped selecting it.
        if (schoolsResult.success) setSchools(schoolsResult.data)
      } catch { setError('Failed to load profile') }
      finally { setIsLoading(false) }
    }
    fetch()
  }, [])

  // wall_enabled isn't part of profileService.getOwnProfile()'s select list
  // (services/profileService.ts is shared and out of this pass's scope, so
  // its query shape stays untouched per the "no Supabase changes" invariant)
  // - a separate, minimal read of just that one column instead. Defaults to
  // `true` (matching wallService.getWall's own `?? true`) if the column is
  // ever unset or the read fails, so the switch never renders a false "off".
  useEffect(() => {
    if (!authMember?.uuid) return
    let cancelled = false
    supabaseCommunity
      .from('members')
      .select('wall_enabled')
      .eq('uuid', authMember.uuid)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setWallEnabled(((data as any)?.wall_enabled) ?? true) })
      .then(undefined, () => { if (!cancelled) setWallEnabled(true) })
    return () => { cancelled = true }
  }, [authMember?.uuid])

  // Member-of-the-month "upload your photo" link (director/MemberOfMonth.tsx's
  // "copy upload link" action) - `/profile/edit?uploadAvatar=1` is one generic
  // URL, same precedent as `/profile/me?break=1`: it opens the same upload
  // control for whoever is signed in when they click it, no per-member token.
  // `fileInputRef.current?.click()` is a best-effort auto-open only - some
  // browsers refuse to open a file picker outside a direct user gesture, so
  // the banner + scroll-into-view below is what actually guarantees the
  // member can find the control even if the click is silently ignored.
  const wantsAvatarUpload = searchParams.get('uploadAvatar') === '1'
  useEffect(() => {
    if (isLoading || !wantsAvatarUpload) return
    avatarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    fileInputRef.current?.click()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])

  const toggleWallEnabled = async () => {
    if (wallEnabled === undefined || wallSaving) return
    const next = !wallEnabled
    setWallSaving(true)
    setWallEnabled(next) // optimistic - 11.11's ordering rule is about the
    // success MESSAGE, not the state change itself; a toggle control is
    // exactly the "in-place success, the control changes state" case.
    try {
      await wallService.setWallEnabled(next)
    } catch (e: any) {
      setWallEnabled(!next) // roll back
      toastError('couldn’t change that.', e?.message || 'try again.')
    } finally {
      setWallSaving(false)
    }
  }

  // 11.9 state 10 / 12.10's unsaved-changes guard. No beforeunload/confirm-
  // on-close pattern exists anywhere else in the codebase yet (grepped;
  // CreatePostModal.tsx's own comment says the same and reports it as a gap
  // rather than inventing one there) - this is the first, and it only
  // covers what a plain <BrowserRouter> (not a data router - see App.tsx)
  // can actually intercept: closing/refreshing the tab. In-app navigation
  // via the form's own Cancel/back controls is guarded directly below,
  // since those are already onClick handlers this file owns.
  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const guardedNavigate = async (to: string) => {
    if (isDirty) {
      const ok = await confirm({
        title: 'discard your changes?',
        body: 'you have unsaved edits to your profile. leaving now discards them.',
        confirmLabel: 'discard changes',
      })
      if (!ok) return
    }
    navigate(to)
  }

  const validateField = (key: ProfileField, value: string): string | undefined => {
    switch (key) {
      case 'fullName':
        return value.trim() ? undefined : 'Full name is required'
      case 'bio':
        return undefined // resolved async on blur/submit below, not synchronously
    }
  }

  const handleBlur = (key: ProfileField) => {
    const msg = validateField(key, formData[key])
    setFieldErrors(fe => ({ ...fe, [key]: msg }))
  }

  // Sync school search display text when schools or selected schoolId changes
  useEffect(() => {
    if (formData.schoolId && schools.length > 0) {
      const found = schools.find(s => s.schoolId.toString() === formData.schoolId)
      if (found) setSchoolSearch(found.name)
    }
  }, [formData.schoolId, schools])

  // Close school dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (schoolComboRef.current && !schoolComboRef.current.contains(e.target as Node)) {
        setShowSchoolList(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Same rule as ContactPage.set(): clear a field's error the instant it's
    // edited. This only ever REMOVES an error blur/submit already set - it
    // never validates on keystroke, which §11.10 explicitly forbids.
    if (name === 'fullName' || name === 'bio') {
      setFieldErrors(fe => (fe[name as ProfileField] ? { ...fe, [name]: undefined } : fe))
    }
  }

  // Owner report: "profile picture ko crop ya adjust krna ka option nhi hai,
  // it just gets uploaded directly after choosing." A picked file now opens
  // AvatarCropModal instead of uploading immediately; `cropFile` holds the
  // file waiting on that step, and the actual upload moves to
  // `handleCropConfirm` below.
  const [cropFile, setCropFile] = useState<File | null>(null)

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Clear the input on every path. A file input does not fire `change` for
    // the same file twice, so after a rejected type, an over-5MB file, or a
    // FAILED UPLOAD, picking that same photo again did nothing - the member's
    // obvious recovery from "upload failed" was the one action that could not
    // work. `file` is already captured, so this is safe here.
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('that needs to be an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return }
    setError(null)
    setCropFile(file)
  }

  const handleCropConfirm = async (cropped: File) => {
    setCropFile(null)
    setIsUploadingAvatar(true); setError(null)
    try {
      const result = await profileService.uploadAvatar(cropped)
      if (result.success) {
        // uploadAvatar() now persists members.avatar_url itself, so we just
        // need to mirror the new URL in form state and refresh the auth context
        // so the nav-bar avatar updates immediately.
        setFormData(prev => ({ ...prev, avatarUrl: result.data.url }))
        await refreshMember()
        success('new photo up.')
      }
    } catch (e: any) { setError('photo didn’t upload.'); toastError('photo didn’t upload.', e?.message) }
    finally { setIsUploadingAvatar(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setSavedMsg(null)

    // 11.10: "validate on blur and on submit - never on keystroke", and "on
    // submit, focus the first invalid field. Do not just show messages."
    const fe: Partial<Record<ProfileField, string>> = {}
    const nameMsg = validateField('fullName', formData.fullName)
    if (nameMsg) fe.fullName = nameMsg
    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe)
      const order: ProfileField[] = ['fullName', 'bio']
      const firstBad = order.find(k => fe[k])
      if (firstBad) document.getElementById(`ep-${firstBad === 'fullName' ? 'name' : firstBad}`)?.focus()
      return
    }

    setIsSaving(true)
    // Bio publishes immediately with no review queue - both tiers hard-block.
    // Shown on the bio field itself (not just the top banner) so the error
    // sits where the problem is.
    if ((await checkText(formData.bio)).severity !== 'clean') {
      setFieldErrors(prev => ({ ...prev, bio: BLOCK_MESSAGE }))
      document.getElementById('ep-bio')?.focus()
      toastError(BLOCK_MESSAGE)
      setIsSaving(false)
      return
    }
    setFieldErrors({})
    try {
      const result = await profileService.updateProfile({
        // email intentionally excluded - it's locked to the Google identity
        // (see the disabled field above) and was never meant to be part of
        // this write.
        fullName: formData.fullName.trim(),
        classGrade: formData.classGrade.trim(), phone: formData.phone.trim(),
        avatarUrl: formData.avatarUrl, bio: formData.bio.trim(),
        schoolId: formData.schoolId ? parseInt(formData.schoolId) : undefined,
        birthday: formData.birthday || null
      })
      if (result.success) {
        savedSnapshot.current = formData // clears the unsaved-changes guard
        setSavedMsg('profile updated.')
        success('Profile updated ✓')
        await refreshMember()
        setTimeout(() => navigate('/profile/me'), 1400)
      } else { setError('profile didn’t save.'); toastError('profile didn’t save.') }
    } catch (err: any) { const msg = err.response?.data?.message || 'profile didn’t save.'; setError(msg); toastError(msg) }
    finally { setIsSaving(false) }
  }

  if (isLoading) {
    return (
      <div className="route-enter aq-wrap" aria-busy="true" role="status" style={{ paddingTop: 'clamp(24px,5vw,40px)', paddingBottom: 80, maxWidth: 600 }}>
        <span className="sr-only">loading your profile…</span>
        <div className="v6-skeleton" style={{ width: 200, height: 28, marginBottom: 8 }} />
        <div className="v6-skeleton" style={{ width: 260, height: 13, marginBottom: 32 }} />
        <div className="card" style={{ padding: 24 }}>
          {/* Avatar row */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 28 }}>
            <div className="v6-skeleton sk-circle" style={{ width: 80, height: 80 }} />
            <div>
              <div className="v6-skeleton" style={{ width: 120, height: 13, marginBottom: 10 }} />
              <div className="v6-skeleton sk-pill" style={{ width: 96, height: 32 }} />
            </div>
          </div>
          {/* Form fields - underline geometry (11.2: match what replaces it),
              now that the real fields below are .aq-field, not boxed
              .input/.textarea. */}
          <div className="sk-group" aria-hidden="true">
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ marginBottom: 24 }}>
                <div className="v6-skeleton" style={{ width: 80, height: 8, marginBottom: 12, borderRadius: 'var(--r-tight)' }} />
                <div className="v6-skeleton" style={{ width: '100%', height: 20, borderRadius: 0 }} />
              </div>
            ))}
          </div>
          <div className="v6-skeleton sk-pill" style={{ width: '100%', height: 44, marginTop: 8 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="route-enter aq-wrap" style={{ paddingTop: 'clamp(28px,5vw,48px)', paddingBottom: 80, maxWidth: 640 }}>
      <div className="row gap-2" style={{ marginBottom: 24, alignItems: 'center' }}>
        {/* 11.9 state 10: a dirty form guards its own exits. Still a real
            <Link> (right-click / open-in-new-tab / keyboard all keep
            working); the guard only intercepts a plain click. */}
        <Link
          to="/profile/me"
          className="btn btn-sm"
          onClick={e => { if (isDirty) { e.preventDefault(); guardedNavigate('/profile/me') } }}
        >
          ← back
        </Link>
        <h1 className="h-display" style={{ fontSize: 'clamp(36px, 6vw, 56px)', margin: 0, lineHeight: 1, fontWeight: 900, letterSpacing: '-0.045em' }}>
          edit profile<span style={{ color: 'var(--welfare-ink)' }}>.</span>
        </h1>
      </div>

      {/* 04.8: a 4px left accent bar on a 32px-radius card can't follow the
          corner (the same defect as the feed card's category spine, 01.15.1)
          - replaced with a tinted well. */}
      {error && (
        <div role="alert" className="card">
          <div style={{ background: 'var(--danger-tint)', borderRadius: 'var(--r-inner)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, color: 'var(--danger)' }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, flexShrink: 0 }}>✕</button>
          </div>
        </div>
      )}
      {savedMsg && (
        <div className="card">
          <div style={{ background: 'color-mix(in srgb, var(--welfare) 22%, transparent)', borderRadius: 'var(--r-inner)', padding: '12px 16px' }}>
            <span style={{ fontSize: 14, color: 'var(--welfare-ink)', fontWeight: 700 }}>✓ {savedMsg}</span>
          </div>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit}>
          {/* Avatar */}
          <div ref={avatarSectionRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, paddingTop: 8 }}>
            {wantsAvatarUpload && (
              <p className="mono xs" style={{ color: 'var(--welfare-ink)', textAlign: 'center', marginBottom: 12 }}>
                upload a photo below for your Member of the Month story.
              </p>
            )}
            <div style={{ position: 'relative' }}>
              <div className="avatar" style={{ width: 88, height: 88, fontSize: 28, background: 'var(--welfare)', overflow: 'hidden' }}>
                {formData.avatarUrl
                  ? <Img ctx="avatar" src={formData.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                  : getInitials(formData.fullName || 'U')}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} aria-label="Change avatar" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploadingAvatar}
                style={{ position: 'absolute', bottom: -8, right: -8, width: 44, height: 44, borderRadius: 'var(--r-pill)', background: 'var(--ink)', color: 'var(--paper)', display: 'grid', placeItems: 'center', fontSize: 16, border: 'none', cursor: 'pointer', transition: 'transform 0.12s' }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                onMouseUp={e => (e.currentTarget.style.transform = '')}
                aria-label="Change avatar">
                {isUploadingAvatar ? '...' : '↑'}
              </button>
            </div>
            <span className="mono xs muted" style={{ marginTop: 10 }}>click to change photo</span>
          </div>

          {cropFile && (
            <AvatarCropModal
              file={cropFile}
              onCancel={() => setCropFile(null)}
              onConfirm={handleCropConfirm}
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 8px 8px' }}>
            {/* §12.10: fields move onto 07's underline-only `.aq-field` -
                the same class ContactPage.tsx already uses, lifted rather
                than reinventing a "cream well" reading of this section's own
                (self-contradicting) "cream wells... per 07's underline-only
                treatment" line. `border-radius: 0` on the input is the one
                documented exception to the 999/32/22/14 scale (a line has no
                corners) - not a leftover un-migrated radius. */}
            <div className="edit-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div
                className="aq-field"
                data-invalid={fieldErrors.fullName ? true : undefined}
              >
                <label className="aq-field-label" htmlFor="ep-name">
                  full name <span style={{ color: 'var(--welfare-ink)' }}>*</span>
                </label>
                <input
                  id="ep-name"
                  className="aq-field-input"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  onBlur={() => handleBlur('fullName')}
                  placeholder="your full name"
                  required
                  autoComplete="name"
                  aria-invalid={!!fieldErrors.fullName}
                  aria-describedby={fieldErrors.fullName ? 'ep-name-error' : undefined}
                />
                {fieldErrors.fullName && <span id="ep-name-error" role="alert" className="aq-field-error">{fieldErrors.fullName}</span>}
              </div>
              <div className="aq-field">
                <label className="aq-field-label" htmlFor="ep-email">email</label>
                {/* Locked, matching Register's own treatment of this field -
                    email is the Google OAuth identity and isn't meant to be
                    user-editable. This used to render as a normal editable
                    input with no `disabled` state or explanation, directly
                    contradicting Register's "that part's locked to your
                    google account" copy for the same field. */}
                <input id="ep-email" className="aq-field-input" name="email" type="email" value={formData.email} disabled style={{ opacity: 0.55 }} autoComplete="email" />
                <p className="mono xs muted" style={{ marginTop: 8, marginBottom: 0 }}>that part's locked to your google account.</p>
              </div>
            </div>

            <div className="edit-profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="aq-field">
                <label className="aq-field-label" htmlFor="ep-class">class / grade</label>
                {/* A SELECT, not a free-text input (2026-09-18). This field being open
                    text while /register wrote from a fixed picker is how
                    members.class_grade ended up with 63 distinct values for nine
                    real cohorts, and why the public /classes page listed the same
                    cohort up to five times. Same list as /register now.
                    classOptionsFor() prepends the member's existing value when it
                    is not in the canonical list, so nobody is forced to change a
                    correct answer (Class 7 and 8 exist in the data and have never
                    been offered) just to save some other field. */}
                <select id="ep-class" className="aq-field-input" name="classGrade" value={formData.classGrade} onChange={handleChange}>
                  <option value="">select your class or year</option>
                  {classOptionsFor(formData.classGrade).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="aq-field">
                <label className="aq-field-label" htmlFor="ep-phone">phone</label>
                <input id="ep-phone" className="aq-field-input" name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+91 00000 00000" autoComplete="tel" inputMode="tel" />
              </div>
            </div>

            <div className="aq-field">
              <label className="aq-field-label" htmlFor="ep-birthday">birthday</label>
              <input id="ep-birthday" className="aq-field-input" name="birthday" type="date" value={formData.birthday} onChange={handleChange} max={new Date().toISOString().slice(0, 10)} />
              <p className="mono xs muted" style={{ marginTop: 8 }}>
                optional. hidden from other members by default - share it from <Link to="/settings" style={{ color: 'var(--welfare-ink)', textDecoration: 'underline' }}>settings</Link>.
              </p>
            </div>

            <div className="aq-field">
              <label className="aq-field-label" htmlFor="ep-school">school</label>
              <div ref={schoolComboRef} style={{ position: 'relative' }}>
                <input
                  id="ep-school"
                  className="aq-field-input"
                  type="text"
                  autoComplete="off"
                  placeholder="search your school (optional)"
                  value={schoolSearch}
                  onChange={e => {
                    setSchoolSearch(e.target.value)
                    setShowSchoolList(true)
                    // If user clears the field, also clear the selected schoolId
                    if (!e.target.value) setFormData(prev => ({ ...prev, schoolId: '' }))
                  }}
                  onFocus={() => setShowSchoolList(true)}
                />
                {showSchoolList && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    marginTop: 4,
                    maxHeight: 200,
                    overflowY: 'scroll',
                    zIndex: 100,
                    background: 'var(--card)',
                    border: 'var(--hair-2)',
                    borderRadius: 'var(--r-inner)',
                    boxShadow: 'var(--lift-3)',
                  }}>
                    {schools
                      .filter(s => s.name.toLowerCase().includes(schoolSearch.toLowerCase()))
                      .length === 0 ? (
                        <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--ink-3)' }}>
                          no schools match "{schoolSearch}"
                        </div>
                      ) : (
                        schools
                          .filter(s => s.name.toLowerCase().includes(schoolSearch.toLowerCase()))
                          .map(s => (
                            <div
                              key={s.schoolId}
                              onMouseDown={e => {
                                e.preventDefault() // prevent blur before click registers
                                setFormData(prev => ({ ...prev, schoolId: s.schoolId.toString() }))
                                setSchoolSearch(s.name)
                                setShowSchoolList(false)
                              }}
                              style={{
                                padding: '9px 14px',
                                fontSize: 14,
                                cursor: 'pointer',
                                borderBottom: 'var(--hair)',
                                color: formData.schoolId === s.schoolId.toString() ? 'var(--welfare)' : 'var(--ink)',
                                fontWeight: formData.schoolId === s.schoolId.toString() ? 700 : 400,
                                background: 'transparent',
                                transition: 'background 0.1s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              {s.name}
                            </div>
                          ))
                      )
                    }
                  </div>
                )}
              </div>
            </div>

            <div className="aq-field" data-invalid={fieldErrors.bio ? true : undefined}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
                <label className="aq-field-label" htmlFor="ep-bio" style={{ marginBottom: 0 }}>bio</label>
                <span className="mono xs muted" style={{ color: formData.bio.length > 450 ? 'var(--pink-ink)' : undefined }}>
                  {formData.bio.length}/500
                </span>
              </div>
              <textarea
                id="ep-bio"
                className="aq-field-input"
                name="bio"
                value={formData.bio}
                onChange={handleChange as any}
                rows={4}
                maxLength={500}
                placeholder="tell the community about yourself, what you work on at AQ, and what you care about."
                style={{ resize: 'vertical' }}
                aria-invalid={!!fieldErrors.bio}
                aria-describedby={fieldErrors.bio ? 'ep-bio-error' : undefined}
              />
              {fieldErrors.bio && <span id="ep-bio-error" role="alert" className="aq-field-error">{fieldErrors.bio}</span>}
            </div>

            {/* §16.2's off-switch. Lives here per §12.10 ("the wall off-
                switch also lives here"); the wall's own empty state is the
                second named location, in profile/wall/WallTab.tsx - that
                file belongs to 16-profile-wall.md, not this pass's 13 pages,
                so it isn't touched here. */}
            <div className="aq-field">
              <label className="aq-field-label" style={{ marginBottom: 9 }}>your wall</label>
              <button
                type="button"
                role="switch"
                aria-checked={wallEnabled === true}
                disabled={wallEnabled === undefined || wallSaving}
                onClick={toggleWallEnabled}
                className="btn"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10, minHeight: 44,
                  // The base .btn is a nowrap pill sized for short labels
                  // ("cancel", "save changes"). This one's label is a full
                  // sentence, so left it unconstrained it grows to fit the
                  // text on one line - 352px wide at 375px viewport, an 18px
                  // overflow measured live (11.9: "zero horizontal overflow
                  // at 375px and 360px"). width: 100% + textAlign/justify
                  // left + whiteSpace: normal let it fill the field column
                  // and wrap like any other paragraph instead.
                  width: '100%', boxSizing: 'border-box',
                  justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal',
                  background: wallEnabled ? 'var(--welfare)' : 'var(--card)',
                  color: wallEnabled ? '#0A0A0A' : 'var(--ink)',
                }}
              >
                <span aria-hidden="true" style={{
                  width: 30, height: 18, borderRadius: 999, position: 'relative', flexShrink: 0,
                  background: wallEnabled ? 'rgba(10,10,10,0.28)' : 'var(--bg-3)',
                  transition: 'background 0.14s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: wallEnabled ? 14 : 2, width: 14, height: 14,
                    borderRadius: '50%', background: wallEnabled ? '#0A0A0A' : 'var(--ink-3)',
                    transition: 'left 0.14s',
                  }} />
                </span>
                {wallEnabled === undefined ? 'loading…' : wallEnabled ? 'on · anyone can leave you a note' : 'off · nobody can post to your wall'}
              </button>
              <p className="mono xs muted" style={{ marginTop: 8, marginBottom: 0 }}>
                turning it off hides the tab from other members; notes already there stay yours to keep or remove.
              </p>
            </div>

            <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" onClick={() => guardedNavigate('/profile/me')} className="btn">cancel</button>
              <button type="submit" disabled={isSaving} className="btn btn-primary" aria-busy={isSaving}>
                {isSaving ? 'saving...' : 'save changes'}
              </button>
            </div>
          </div>
        </form>
      </div>

    </div>
  )
}

export default EditProfilePage
