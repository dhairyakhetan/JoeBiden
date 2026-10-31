// ──────────────────────────────────────────────────────────────────────────
// Director · Blog Drafts
// ──────────────────────────────────────────────────────────────────────────
// Blogs written in the composer land in `posts` with status='pending_review',
// which is what makes them drafts. Publishing is the leader action that flips
// that status (and stamps published_at, or scheduled_for) — so this tab is the
// only place that happens.
//
// The cover used to be a HARD requirement here, and the two paragraphs that
// justified it were both wrong by 2026-09-12:
//   - mirror_blog_to_post() no longer exists. Blogs are not mirrored rows any
//     more; the 4.2 fold made them ordinary `posts` rows, and the only triggers
//     left on the table are update_updated_at, requeue_post_on_author_revision,
//     cleanup_notifications_for_deleted_post and posts_fill_article_excerpt.
//   - a coverless blog does not render "a blank card". feed/cards/parts.tsx's
//     CardPhoto is `if (!url) return null`, and nine of the twenty-two already
//     published blogs carry no cover and render fine.
// Meanwhile all fourteen pending drafts have no cover, so the disabled button
// meant every essay in this desk was unpublishable, and the only route out was
// hand-pasting an image URL fourteen times into a tab with no uploader.
// The cover is now a warning, not a gate: the `needs cover` tag and the note
// stay, because an essay reads better with one and a leader should be nudged.
//
// Styling goes through the desk vocabulary (.card / .panel-h / .qrow / .qname /
// .qsub / .qtag / .iconbtn) rather than hand-rolled inline styles - inline wins
// over the cascade, which is what forced earlier tabs to be reworked.
//
// 20.12: "draft / published toggle, and a preview that renders 12.2's real
// layout." Reported, not guessed around - blogService.ts has no unpublish /
// listPublished call, only the one-way publishDraft below, and this file's
// RULES forbid adding a new Supabase call shape to invent one. The existing
// publish/schedule control (the checkmark button) is therefore the desk's
// only draft<->published control. The preview half IS fixed here: see the
// "preview live page" link below.
// ──────────────────────────────────────────────────────────────────────────

import Img from '../components/Img'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { listDrafts, publishDraft, setDraftCover, deleteDraft, type BlogDraft } from '../services/blogService'
import feedService from '../services/feedService'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { AdminLayout, AdminTabHeader, EmptyLedger, AdminSkeleton, AdminErrorState } from './adminKit'
import {
  ChevronDownIcon, ChevronUpIcon, CheckIcon, TrashIcon, PhotoIcon, ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'

export default function BlogDrafts() {
  const { success, error: toastError } = useToast()
  const confirm = useConfirm()

  const [rows, setRows] = useState<BlogDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [coverDraft, setCoverDraft] = useState<Record<number, string>>({})
  const [scheduleAt, setScheduleAt] = useState<Record<number, string>>({})
  // Cover upload (2026-09-14, owner request: "option to upload an image
  // instead of a file url"). Reuses feedService.uploadImages - the same
  // resize-then-Supabase-Storage-upload path post composition already uses,
  // not a new upload pipeline - it just happens to land in the
  // `post-images` bucket, which is fine for a cover image too.
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null)
    try {
      setRows(await listDrafts())
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load blog drafts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onSaveCover = async (row: BlogDraft) => {
    const url = (coverDraft[row.id] ?? '').trim()
    setBusyId(row.id)
    try {
      await setDraftCover(row.id, url || null)
      setRows(prev => prev.map(r => (r.id === row.id ? { ...r, featured_image: url || null } : r)))
      success('cover saved.')
    } catch (e: any) {
      toastError('cover didn’t save.', e?.message)
    } finally { setBusyId(null) }
  }

  const onPickCoverFile = (rowId: number) => {
    setUploadTargetId(rowId)
    fileInputRef.current?.click()
  }

  const onCoverFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const rowId = uploadTargetId
    e.target.value = '' // let picking the same file twice re-fire onChange
    if (!file || rowId == null) return
    setUploadingId(rowId)
    try {
      const { data } = await feedService.uploadImages([file])
      const url = data.images[0]?.url
      if (!url) throw new Error('upload returned no URL')
      setCoverDraft(p => ({ ...p, [rowId]: url }))
      await setDraftCover(rowId, url)
      setRows(prev => prev.map(r => (r.id === rowId ? { ...r, featured_image: url } : r)))
      success('cover uploaded.')
    } catch (e: any) {
      toastError('cover upload failed.', e?.message)
    } finally {
      setUploadingId(null)
      setUploadTargetId(null)
    }
  }

  const onPublish = async (row: BlogDraft) => {
    const when = (scheduleAt[row.id] ?? '').trim()
    const scheduled = !!when
    if (scheduled && new Date(when).getTime() <= Date.now()) {
      toastError('pick a time in the future.', 'a scheduled date has to be ahead of now.')
      return
    }
    const ok = await confirm({
      title: scheduled ? 'Schedule this blog?' : 'Publish this blog?',
      body: scheduled
        ? `"${row.headliner}" will go live on ${new Date(when).toLocaleString()}.`
        : `"${row.headliner}" goes live immediately at /blog/${row.slug}.`,
      confirmLabel: scheduled ? 'Schedule' : 'Publish',
    })
    if (!ok) return

    setBusyId(row.id)
    try {
      await publishDraft(row.id, { publishAt: scheduled ? new Date(when).toISOString() : null })
      setRows(prev => prev.filter(r => r.id !== row.id))
      success(scheduled ? 'Scheduled ✓' : 'Published ✓',
              scheduled ? 'It will appear on the blog automatically.' : `Live at /blog/${row.slug}`)
    } catch (e: any) {
      toastError('couldn’t publish that.', e?.message)
    } finally { setBusyId(null) }
  }

  const onDelete = async (row: BlogDraft) => {
    const ok = await confirm({
      title: 'Delete this draft?',
      // Soft delete (posts.deleted_at), same as every other post deletion here.
      // Not describing it as permanent, because it isn't - and telling a student
      // their writing is gone forever when a super admin can still restore the
      // row is the kind of small lie this codebase keeps deciding not to tell.
      body: `"${row.headliner}" will be removed from the desk and the feed. You can't undo this from here.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setBusyId(row.id)
    try {
      await deleteDraft(row.id)
      setRows(prev => prev.filter(r => r.id !== row.id))
      success('draft deleted.')
    } catch (e: any) {
      toastError('couldn’t delete that.', e?.message)
    } finally { setBusyId(null) }
  }

  return (
    <AdminLayout>
      <AdminTabHeader
        title="Blog Drafts"
        subtitle="Blogs submitted from the composer. Add a cover, then publish or schedule."
        count={rows.length}
      />

      {/* One shared hidden input, targeted per-row via uploadTargetId/
          fileInputRef - avoids mounting fourteen separate file inputs. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onCoverFileChosen}
        style={{ display: 'none' }}
        aria-hidden
      />

      {loading ? (
        <AdminSkeleton rows={3} />
      ) : loadError ? (
        <AdminErrorState message={loadError} onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyLedger
          message="No blog drafts waiting."
          sub="Anything written through the composer's blog mode lands here first."
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {rows.map(row => {
            const isOpen = openId === row.id
            const busy = busyId === row.id
            const cover = coverDraft[row.id] ?? row.featured_image ?? ''
            const hasCover = !!(row.featured_image || '').trim()
            return (
              <div key={row.id} className="panel-h">
                <div className="qrow">
                  <div
                    style={{
                      width: 46, height: 46, flexShrink: 0, borderRadius: 'var(--r-tight)', overflow: 'hidden',
                      // audit-ok: dashed - the no-cover DROPZONE state
                      border: hasCover ? 'var(--hod-border-w) solid var(--hod-border)' : '2px dashed color-mix(in srgb, var(--ink) 34%, transparent)',
                      background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--ink-3)',
                    }}
                    aria-hidden
                  >
                    {row.featured_image
                      ? <Img ctx="thumb" src={row.featured_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <PhotoIcon width={20} height={20} strokeWidth={1.8} />}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="qname">{row.headliner}</div>
                    <div className="qsub">
                      {row.written_by || 'unknown author'}
                      {row.minutes_of_read ? ` · ${row.minutes_of_read} min` : ''}
                      {row.created_at ? ` · ${new Date(row.created_at).toLocaleDateString()}` : ''}
                    </div>
                  </div>

                  <span className="qtag" style={{ '--cc': hasCover ? 'var(--welfare)' : 'var(--tomato)' } as React.CSSProperties}>
                    {hasCover ? 'ready' : 'needs cover'}
                  </span>

                  <button
                    className="iconbtn"
                    onClick={() => setOpenId(isOpen ? null : row.id)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? 'Hide article' : 'Read article'}
                    title={isOpen ? 'Hide article' : 'Read article'}
                  >
                    {isOpen
                      ? <ChevronUpIcon width={17} height={17} strokeWidth={2.2} aria-hidden />
                      : <ChevronDownIcon width={17} height={17} strokeWidth={2.2} aria-hidden />}
                  </button>
                  <button
                    className="iconbtn ok"
                    disabled={busy}
                    onClick={() => onPublish(row)}
                    aria-label="Publish"
                    title={hasCover
                      ? 'Publish or schedule'
                      : 'Publish or schedule (no cover: the card will be text-only)'}
                  >
                    <CheckIcon width={17} height={17} strokeWidth={2.4} aria-hidden />
                  </button>
                  <button
                    className="iconbtn no"
                    disabled={busy}
                    onClick={() => onDelete(row)}
                    aria-label="Delete draft"
                    title="Delete draft"
                  >
                    <TrashIcon width={17} height={17} strokeWidth={2} aria-hidden />
                  </button>
                </div>

                {!hasCover && (
                  <p className="adm-note" style={{ padding: '0 14px 12px', marginTop: -4 }}>
                    no cover yet. you can still publish - the feed card just goes out text-only.
                  </p>
                )}

                {isOpen && (
                  <div style={{ padding: '0 14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <label style={{ flex: '1 1 320px', minWidth: 0 }}>
                        <span className="mono" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>
                          Cover image URL
                        </span>
                        <input
                          className="input"
                          value={cover}
                          placeholder="https://…"
                          onChange={e => setCoverDraft(p => ({ ...p, [row.id]: e.target.value }))}
                        />
                      </label>
                      <button className="btn btn-sm" disabled={busy} onClick={() => onSaveCover(row)}>
                        save cover
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={uploadingId === row.id}
                        onClick={() => onPickCoverFile(row.id)}
                      >
                        {uploadingId === row.id ? 'uploading…' : 'or upload image'}
                      </button>
                      <label style={{ flex: '0 1 230px' }}>
                        <span className="mono" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>
                          Schedule (optional)
                        </span>
                        <input
                          className="input"
                          type="datetime-local"
                          value={scheduleAt[row.id] ?? ''}
                          onChange={e => setScheduleAt(p => ({ ...p, [row.id]: e.target.value }))}
                        />
                      </label>
                    </div>

                    <div>
                      <span className="mono" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>
                        Submitted text
                      </span>
                      <div style={{ background: 'var(--bg-2)', border: 'var(--hair-2)', borderRadius: 'var(--r-inner)', padding: 14, maxHeight: 320, overflowY: 'auto' }}>
                        {(row.body || '').split('\n\n').filter(Boolean).map((para, i) => (
                          <p key={i} style={{ fontFamily: 'var(--eina)', fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)', margin: '0 0 12px' }}>
                            {para}
                          </p>
                        ))}
                        {!row.body && <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>No article text.</p>}
                      </div>
                    </div>

                    {/* 20.12's preview rule: reuse the real renderer or skip it, never
                        approximate it (03.2.6). The plain paragraphs above are the raw
                        submitted text for a quick read, not a page preview - THIS is the
                        preview, and it's the actual live route, not a re-implementation.
                        listDrafts()'s own read policy already grants leaders the full
                        table (see services/blogService.ts), so /blog/:slug resolves for
                        a director even before published_date is set. Opens in a new tab
                        so the drafts queue and its scroll position aren't lost. */}
                    <Link
                      to={`/blog/${row.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                      style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      preview live page <ArrowTopRightOnSquareIcon width={13} height={13} strokeWidth={1.8} aria-hidden />
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
