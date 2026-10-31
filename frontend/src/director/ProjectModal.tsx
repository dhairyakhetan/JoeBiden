// Extracted from ProjectManager.tsx (Phase 6.3 split): the create/edit modal.
// Pure relocation - props-driven ({initial, existingSlugs, onSave, onClose}).
import Img from '../components/Img'
import './ProjectModal.css'
import { useState, useEffect, useRef } from 'react'
import { supabase, normalizeObj, OBJ_COLORS } from '../lib/supabase'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { withRetry } from '../lib/asyncUtils'
import {
  BLANK, cuteSlug, useModalA11y,
  BasicsTab, ContentTab, ImagesTab, LinksTab,
  type ModalTab, type Project,
} from './ProjectManagerShared'

export default function ProjectModal({
  initial, existingSlugs, onSave, onClose,
}: {
  initial: Partial<Project>
  // Every OTHER project's slug (the current one, if editing, is excluded by
  // the caller) - lets the form warn about a collision before the DB does.
  existingSlugs: string[]
  onSave: (data: Partial<Project>) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<Partial<Project>>({ ...BLANK, ...initial })
  const [tab, setTab] = useState<ModalTab>('basics')
  const [saving, setSaving] = useState(false)
  const [loadingFull, setLoadingFull] = useState(!!initial.id)
  // If the full-row fetch fails, the form is still only seeded from the list
  // row's partial column set - saving in that state would silently null out
  // every field the list doesn't carry (write-up, extra photos, links...).
  // Block editing entirely until it either succeeds or the admin retries.
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  // How many image uploads are currently in flight across every zone in this
  // form - Save is held until this drops back to 0, so it never ships with a
  // photo that hadn't actually finished uploading yet.
  const [uploadingCount, setUploadingCount] = useState(0)
  const bumpUploading = (active: boolean) => setUploadingCount(c => Math.max(0, c + (active ? 1 : -1)))
  // Which tabs have their "advanced / optional" section expanded. Progressive
  // disclosure: each tab shows only its essentials until you ask for more.
  const [adv, setAdv] = useState<Set<ModalTab>>(new Set())
  const toggleAdv = (t: ModalTab) => setAdv(s => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n })
  const toast = useToast()
  const confirm = useConfirm()
  const [dirty, setDirty] = useState(false)
  // Discard-guard: a stray backdrop tap or ✕ must not silently throw away
  // unsaved edits to an 11-field form with image uploads.
  const requestClose = async () => {
    if (!dirty || saving) { onClose(); return }
    const ok = await confirm({ title: 'Discard changes?', body: 'You have unsaved edits to this project. Close without saving?', confirmLabel: 'Discard', danger: true })
    if (ok) onClose()
  }
  const panelRef = useRef<HTMLDivElement>(null)
  useModalA11y(true, panelRef, () => { void requestClose() }, saving)

  useEffect(() => {
    if (!initial.id) return
    setLoadingFull(true); setLoadError(false)
    withRetry(async () => supabase.from('welfare_projects').select('*').eq('id', initial.id).single())
      .then(({ data, error }) => {
        if (error) { toast.error('project didn’t load.'); setLoadError(true); setLoadingFull(false); return }
        if (data) {
          setForm(data)
          // Auto-expand any optional section that already holds data, so editing
          // never hides content behind a collapsed reveal.
          const open = new Set<ModalTab>()
          if (data.location || data.volunteers || data.key_statistic) open.add('basics')
          if (data.long_writeup || data.collab_name || data.collab_logo) open.add('content')
          if (data.image_1 || data.image_2 || data.image_3 || data.image_4) open.add('images')
          if (open.size) setAdv(open)
        }
        setLoadingFull(false)
      })
  }, [initial.id, loadAttempt]) // eslint-disable-line react-hooks/exhaustive-deps

  // (body scroll-lock now comes from useModalA11y above — the local copy here
  // reset overflow to '' rather than its previous value, which unlocked the
  // page early when this modal was opened over another.)

  const set = (k: keyof Project, v: unknown) => { setDirty(true); setForm(f => ({ ...f, [k]: v })) }
  const touch = (k: string) => setTouched(t => (t.has(k) ? t : new Set(t).add(k)))

  const handleHeaderChange = (v: string) => {
    set('header', v)
    // The web address is auto-generated and never shown - only worth
    // (re)deriving for a project that hasn't been created yet. An existing
    // project's slug is permanently fixed once live (changing it would break
    // whatever's already bookmarked/shared/linked).
    if (!initial.id) set('slug', cuteSlug(v))
  }

  // ── Validation ──
  const headerErr = touched.has('header') && !form.header?.trim() ? 'give the project a title.' : ''

  const handleSave = async () => {
    if (!form.header?.trim()) {
      setTouched(new Set(['header']))
      setTab('basics')
      toast.error('give the project a title.')
      return
    }
    // A LIVE project with no hero image mirrors into the feed as an empty grey
    // card: post_feed_view's image fallback is
    // `post_images -> wp.main_image -> b.featured_image`, and a project has no
    // post_images rows, so main_image is the only thing standing between this
    // project and a blank card. Blogs are already gated on exactly this
    // (mirror_blog_to_post + publish_due_scheduled_posts both require
    // featured_image); welfare projects had no equivalent check, which is why
    // 57 live projects currently render imageless. Enforced here rather than in
    // the trigger so the author gets told, instead of the project silently
    // never appearing in the feed.
    if (!form.is_draft && !form.main_image) {
      setTab('images')
      toast.error('add a hero image before going live - without one this renders as a blank card in the feed.')
      return
    }
    // Belt-and-suspenders: the random suffix makes a collision astronomically
    // unlikely, but since there's no field left for an admin to fix it by
    // hand, silently reroll a fresh one instead of ever surfacing an error.
    let finalForm = form
    if (!initial.id) {
      let slug = (form.slug ?? '').trim() || cuteSlug(form.header)
      let attempts = 0
      while (existingSlugs.includes(slug) && attempts < 5) { slug = cuteSlug(form.header); attempts++ }
      finalForm = { ...form, slug }
    }
    setSaving(true)
    try { await onSave(finalForm) }
    finally { setSaving(false) }
  }

  // ── Readiness checklist (what makes a strong live project) ──
  const checklist: [string, boolean][] = [
    ['Title', !!form.header?.trim()],
    ['Objective', !!form.objective],
    ['Date', !!form.workshop_date],
    ['Hero image', !!form.main_image],
    ['Summary', !!form.short_summary?.trim()],
  ]
  const readyCount = checklist.filter(([, d]) => d).length
  const readyPct = Math.round((readyCount / checklist.length) * 100)
  const allReady = readyCount === checklist.length

  // ── Per-tab "has content" dots ──
  const tabFilled: Record<ModalTab, boolean> = {
    basics: !!(form.objective || form.location || form.workshop_date || form.volunteers || form.key_statistic),
    content: !!(form.short_summary || form.long_writeup || form.collab_name),
    images: !!(form.main_image || form.image_1 || form.image_2 || form.image_3 || form.image_4),
    links: !!(form.instagram_link || form.google_drive_link),
  }


  // Category accent - ties the editor's chrome to the project's own color,
  // matching how the public card/detail pages render it. Falls back to the
  // brand mint when no objective is picked yet.
  const accent = form.objective ? (OBJ_COLORS[normalizeObj(form.objective)] || OBJ_COLORS['Others']) : 'var(--welfare)'

  const TABS: { key: ModalTab; label: string; icon: string }[] = [
    { key: 'basics',  label: 'Basics',  icon: '◎' },
    { key: 'content', label: 'Content', icon: '✎' },
    { key: 'images',  label: 'Images',  icon: '◫' },
    { key: 'links',   label: 'Links',   icon: '↗' },
  ]

  return (
    <div className="pm-overlay" onClick={e => { if (e.target === e.currentTarget) requestClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={initial.id ? 'Edit project' : 'New project'} className="pm-modal">

        {/* Sidebar */}
        <div className="pm-sidebar">
          <div style={{ marginBottom: 16 }}>
            <div className="pm-label" style={{ color: 'var(--welfare-ink)', marginBottom: 8 }}>
              {initial.id ? '✎ Editing' : '+ New project'}
            </div>

            {/* Live mini-preview of the project card - top stripe uses the
                project's own category color, same as the public card. */}
            <div className="pm-preview" style={{ '--accent': accent } as React.CSSProperties}>
              <div className="pm-preview-img">
                {form.main_image
                  ? <Img ctx="thumb" src={form.main_image} alt="" />
                  : <span className="pm-preview-noimg">no image yet</span>}
                {form.objective && <span className="pm-preview-tag">{form.objective}</span>}
              </div>
              <div className="pm-preview-body">
                <div className="pm-preview-title">{form.header?.trim() || 'Untitled project'}</div>
                {form.location && <div className="pm-preview-loc">📍 {form.location}</div>}
              </div>
            </div>
          </div>

          {/* Readiness */}
          <div className="pm-ready">
            <div className="pm-ready-head">
              <span>{allReady ? '✓ Ready to publish' : 'Readiness'}</span>
              <span style={{ color: allReady ? 'var(--welfare)' : 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{readyCount}/{checklist.length}</span>
            </div>
            <div className="pm-ready-bar"><span style={{ ['--pct' as string]: readyPct / 100, background: allReady ? 'var(--welfare)' : 'var(--lemon)' }} /></div>
            <div className="pm-ready-list">
              {checklist.map(([label, done]) => (
                <div key={label} className={'pm-ready-item' + (done ? ' done' : '')}>
                  <span className="pm-ready-tick">{done ? '✓' : '○'}</span>{label}
                </div>
              ))}
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, marginTop: 16 }}>
            {TABS.map(t => (
              <button key={t.key}
                onClick={() => setTab(t.key)}
                className={`pm-tab${tab === t.key ? ' pm-tab-active' : ''}`}>
                <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{t.icon}</span>
                {t.label}
                {tabFilled[t.key] && <span className="pm-tab-dot" />}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', gap: 8, flexDirection: 'column', marginTop: 16 }}>
            <span className="pm-hint" style={{ marginBottom: 2 }}>{form.is_draft ? 'Draft - hidden from the public site.' : 'Live - visible to everyone.'}</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <label className="pm-toggle">
                <input type="checkbox" checked={!(form.is_draft ?? true)} onChange={e => set('is_draft', !e.target.checked)} />
                <span className="pm-toggle-dot" style={{ '--tc': 'var(--welfare)' } as React.CSSProperties} />
                <span>{form.is_draft ? 'Draft' : 'Live'}</span>
              </label>
              <label className="pm-toggle">
                <input type="checkbox" checked={form.featured ?? false} onChange={e => set('featured', e.target.checked)} />
                <span className="pm-toggle-dot" style={{ '--tc': 'var(--lemon)' } as React.CSSProperties} />
                <span>Featured</span>
              </label>
            </div>
          </div>
        </div>

        {/* Content area - minHeight:0 lets the body scroll instead of pushing the
            footer past the modal edge (flexbox min-height:auto bug). */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>

          {/* Top bar - title (mobile) + always-present close affordance */}
          <div className="pm-topbar">
            <span className="pm-topbar-title">{initial.id ? '✎ Edit project' : '+ New project'}</span>
            <button type="button" className="pm-close" onClick={requestClose} aria-label="Close" title="Close" disabled={saving}>✕</button>
          </div>

          {/* Mobile tab bar (sidebar hidden on mobile) */}
          <div className="pm-mobile-tabs">
            {TABS.map(t => (
              <button key={t.key}
                onClick={() => setTab(t.key)}
                className={`pm-mtab${tab === t.key ? ' pm-mtab-active' : ''}`}>
                {t.label}
                {tabFilled[t.key] && <span className="pm-tab-dot" />}
              </button>
            ))}
            <span className="pm-mobile-ready">{readyCount}/{checklist.length} ready</span>
          </div>

          {/* Mobile-only publish controls - these live in the sidebar on desktop,
              which is hidden on mobile, so surface them here or they're unreachable. */}
          <div className="pm-mobile-controls">
            <label className="pm-toggle">
              <input type="checkbox" checked={!(form.is_draft ?? true)} onChange={e => set('is_draft', !e.target.checked)} />
              <span className="pm-toggle-dot" style={{ '--tc': 'var(--welfare)' } as React.CSSProperties} />
              <span>{form.is_draft ? 'Draft' : 'Live'}</span>
            </label>
            <label className="pm-toggle">
              <input type="checkbox" checked={form.featured ?? false} onChange={e => set('featured', e.target.checked)} />
              <span className="pm-toggle-dot" style={{ '--tc': 'var(--lemon)' } as React.CSSProperties} />
              <span>Featured</span>
            </label>
          </div>

          {/* Body */}
          {loadingFull ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>loading…</div>
          ) : loadError ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--hod-danger)' }}>⚠ Couldn't load this project's full details</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-3)', maxWidth: 340, lineHeight: 1.5 }}>
                Editing now could overwrite content that never loaded - the write-up, extra photos, and links aren't in yet. Retry before making changes.
              </span>
              <button className="btn accent" style={{ padding: '9px 22px', fontSize: 13, fontWeight: 700 }} onClick={() => setLoadAttempt(a => a + 1)}>
                ↻ Retry
              </button>
            </div>
          ) : (
            <div className="pm-body">

              {tab === 'basics' && (
                <BasicsTab form={form} set={set} adv={adv} toggleAdv={toggleAdv}
                  headerErr={headerErr} onHeaderChange={handleHeaderChange} onTouch={touch} />
              )}
              {tab === 'content' && (
                <ContentTab form={form} set={set} adv={adv} toggleAdv={toggleAdv} bumpUploading={bumpUploading} />
              )}
              {tab === 'images' && (
                <ImagesTab form={form} set={set} adv={adv} toggleAdv={toggleAdv} bumpUploading={bumpUploading} />
              )}
              {tab === 'links' && <LinksTab form={form} set={set} />}
            </div>
          )}

          {/* Footer */}
          <div className="pm-footer">
            <span className="pm-footer-status">
              {allReady ? <span style={{ color: 'var(--welfare-ink)' }}>✓ All set</span> : `${readyCount}/${checklist.length} essentials added`}
            </span>
            {/* Shared desk `.btn` (brutalist border) instead of the soft pm-ghost-btn ghost. */}
            <button className="btn" onClick={requestClose} disabled={saving} style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700 }}>Cancel</button>
            <button className="btn accent" style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700 }}
              onClick={handleSave} disabled={saving || loadingFull || loadError || uploadingCount > 0}
              title={uploadingCount > 0 ? 'Waiting for photo upload(s) to finish' : undefined}>
              {saving ? 'Saving…' : uploadingCount > 0 ? 'Uploading photo…' : initial.id ? 'Save changes' : 'Create project'}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}

