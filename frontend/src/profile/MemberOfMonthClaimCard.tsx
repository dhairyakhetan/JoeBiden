import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { modalBackdropTransition, modalPanelTransition } from '../lib/motion'
import { StarIcon } from '@heroicons/react/24/outline'
import Img from '../components/Img'
import ShareModal from '../components/ShareModal'
import { useToast } from '../components/Toast'
import useDialog from '../hooks/useDialog'
import memberOfMonthService, { formatPeriod, type MemberOfMonthPick } from '../services/memberOfMonthService'
import feedService from '../services/feedService'
import { generatePoster, type PosterData } from '../components/posterGenerator'
import { checkText } from '../lib/profanityFilter'
import '../styles/routes/profile.css'
import GatedButton from '../components/GatedButton'

/**
 * FR11-b · the winner's own step: upload a photo, and the app builds the
 * poster + feed post + share sheet for you.
 *
 * Own profile only, matching HoursAndCertificateCard/CvCard's own idioms
 * (`.card`, `.pf-*` classes) — hides itself entirely when there is nothing to
 * claim, same convention as HoursAndCertificateCard hiding at zero drives.
 * Reached two ways per the brief: from the "you're the pick" notification's
 * link (`/profile/me`) and from the member's own profile directly.
 *
 * Pipeline once a photo is chosen (see runPipeline):
 *   1. upload the raw photo (feedService.uploadImages — same bucket/path
 *      every post image already uses, no new storage plumbing)
 *   2. submit it via submit_mom_photo() RPC (memberOfMonthService.submitPhoto)
 *      — this is the ONLY path that can set photo_url; see the migration for
 *      why a plain member can't just UPDATE the row themselves
 *   3. generate a poster from it — reuses PosterStudioModal's own
 *      generatePoster()/PosterData, not a second image generator
 *   4. upload the generated poster PNG and create a feed post with it
 *      (feedService.createPost — same path any member's post goes through,
 *      including the same pending_review gate for a non-leader winner; see
 *      the report for why that's an accepted trade-off, not an oversight)
 *   5. hand off to the shared ShareModal (link / story card / poster studio),
 *      exactly how PostPage/FeedPostCard already open it
 */

type Step = 'idle' | 'uploading' | 'saving' | 'generating' | 'posting' | 'done'

const STEP_LABEL: Record<Step, string> = {
  idle: '',
  uploading: 'uploading your photo…',
  saving: 'recording it…',
  generating: 'designing your poster…',
  posting: 'posting to the feed…',
  done: 'all set ✓',
}

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',')
  const mime = /data:(.*?);base64/.exec(header)?.[1] || 'image/png'
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

interface DoneState {
  postUuid: string
  posterDataUrl: string
  rawPhotoUrl: string
  storyData: { type: 'post'; title: string; body: string; authorName: string; category: string; uuid: string; imageUrl: string }
  posterData: PosterData
}

export default function MemberOfMonthClaimCard({ memberId }: { memberId: number }) {
  const toast = useToast()
  const shouldReduceMotion = useReducedMotion()
  const [pick, setPick] = useState<MemberOfMonthPick | null>(null)
  const [loading, setLoading] = useState(true)

  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [done, setDone] = useState<DoneState | null>(null)
  const [showShare, setShowShare] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const row = await memberOfMonthService.getMyUnclaimedPick(memberId)
      setPick(row)
    } catch { /* the card hides itself on failure rather than showing a broken shell */ }
    finally { setLoading(false) }
  }, [memberId])
  useEffect(() => { load() }, [load])

  const close = useCallback(() => {
    if (step !== 'idle' && step !== 'done') return // don't let Escape/backdrop abandon an in-flight upload
    setOpen(false)
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setStep('idle')
    setDone(null)
  }, [step, previewUrl])

  // Stood down while the share sheet is stacked on top — same relationship
  // ShareModal itself has with PosterStudioModal (one live focus/Escape trap
  // at a time).
  const panelRef = useDialog(open && !showShare, close)

  const handlePickFile = (f: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  const runPipeline = async () => {
    if (!file || !pick) return
    try {
      setStep('uploading')
      const uploadRes = await feedService.uploadImages([file])
      const rawPhotoUrl = uploadRes.data.images[0].url

      setStep('saving')
      const saved = await memberOfMonthService.submitPhoto(pick.id, rawPhotoUrl)

      setStep('generating')
      const posterData: PosterData = {
        body: `Member of the Month - ${saved.teamName}\n${formatPeriod(saved.period)}${saved.citation ? `\n\n${saved.citation}` : ''}`,
        authorName: saved.memberName,
        category: saved.teamCategory,
        uuid: String(saved.id),
        imageUrl: rawPhotoUrl,
      }
      const poster = await generatePoster(posterData, 'post')
      const posterFile = dataUrlToFile(poster.dataUrl, `mom-${saved.id}.png`)

      setStep('posting')
      const posterUpload = await feedService.uploadImages([posterFile])
      const posterPublicUrl = posterUpload.data.images[0].url

      const caption = `🏆 ${saved.memberName} is ${saved.teamName}'s Member of the Month for ${formatPeriod(saved.period)}!${saved.citation ? `\n\n${saved.citation}` : ''}`
      // Same obscenity gate every other post-creation surface applies to
      // user-typed text (the citation, here) — flagged text still posts, but
      // held for a moderator, exactly like CreatePostModal's own rule.
      const filterResult = await checkText(caption)
      const forceReview = filterResult.severity !== 'clean'

      const postResult = await feedService.createPost({
        category: saved.teamCategory,
        body: caption,
        imageUrls: [posterPublicUrl],
        forceReview,
      })
      const postUuid = postResult.data.post.uuid

      setStep('done')
      setDone({
        postUuid,
        posterDataUrl: poster.dataUrl,
        rawPhotoUrl,
        storyData: {
          type: 'post', title: caption.slice(0, 100), body: caption,
          authorName: saved.memberName, category: saved.teamCategory,
          uuid: postUuid, imageUrl: rawPhotoUrl,
        },
        posterData,
      })
      toast.success(
        forceReview ? 'Photo saved - your post is awaiting a quick review.' : 'Photo saved - your post is live!',
        'Your poster is ready to share.',
      )
      setPick(null) // getMyUnclaimedPick would no longer return this row anyway — reflect it now
    } catch (e: any) {
      toast.error("couldn't finish that.", e?.message || 'try again.')
      setStep('idle')
    }
  }

  if (loading || !pick) return null

  const busy = step !== 'idle' && step !== 'done'

  return (
    <>
      <div className="card">
        <div className="pf-label-row">
          <span className="pf-label">member of the month</span>
          <StarIcon className="pf-label-aside" width={15} height={15} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="pf-sub pf-sub-prose">
          You're <strong style={{ color: 'var(--ink)' }}>{pick.teamName}</strong>'s pick for {formatPeriod(pick.period)}
          {pick.citation ? ` — "${pick.citation}"` : ''}. Upload a photo and we'll build your poster and feed post.
        </p>
        <div className="pf-actions">
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            + upload your photo
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="modal-back pf-modal-back"
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={modalBackdropTransition}
            >
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Upload your member of the month photo"
                tabIndex={-1}
                className="modal pf-modal"
                onClick={e => e.stopPropagation()}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
                transition={modalPanelTransition}
                style={{ maxWidth: 460, width: '100%', outline: 'none' }}
              >
                <div className="modal-head">
                  <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                    {step === 'done' ? 'You’re all set' : 'Upload your photo'}
                  </span>
                  <button className="pf-modal-close" onClick={close} disabled={busy} aria-label="Close" title="Close">✕</button>
                </div>

                <div className="modal-body">
                  {step === 'done' && done ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center' }}>
                      <div style={{ width: '100%', maxWidth: 240, aspectRatio: '4/5', borderRadius: 14, overflow: 'hidden', border: 'var(--hair-2)' }}>
                        <Img src={done.posterDataUrl} alt="Your member of the month poster" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <p className="pf-sub pf-sub-prose">Your poster and post are ready. Share it to Instagram, or grab the link.</p>
                      <div className="pf-actions">
                        <button type="button" className="btn btn-primary" onClick={() => setShowShare(true)}>
                          share it →
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={close}>close</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <p className="pf-sub pf-sub-prose" style={{ margin: 0 }}>
                        A clear photo of you — this becomes your {pick.teamName} recognition poster and feed post.
                      </p>

                      <div
                        style={{
                          width: '100%', aspectRatio: '4/5', maxHeight: 260, borderRadius: 14,
                          // audit-ok: dashed - a photo DROPZONE, which is what a dashed box may mean
                          border: '2px dashed var(--line)', background: 'var(--bg-2)',
                          display: 'grid', placeItems: 'center', overflow: 'hidden', cursor: busy ? 'default' : 'pointer',
                        }}
                        onClick={() => !busy && fileInputRef.current?.click()}
                      >
                        {previewUrl ? (
                          <Img src={previewUrl} alt="Selected photo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span className="mono xs muted">tap to choose a photo</span>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => handlePickFile(e.target.files?.[0] || null)}
                        disabled={busy}
                      />

                      {busy && (
                        <p className="mono xs" style={{ color: 'var(--welfare-ink)', textAlign: 'center' }}>{STEP_LABEL[step]}</p>
                      )}

                      <div className="pf-actions">
                        {/* §11.9 state 11 */}
                        <GatedButton type="button" className="btn btn-primary" disabled={busy} reason={file ? null : 'choose a photo first.'} onClick={runPipeline}>
                          {busy ? 'working…' : 'use this photo →'}
                        </GatedButton>
                        {!busy && <button type="button" className="btn btn-ghost" onClick={close}>cancel</button>}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {showShare && done && createPortal(
        <ShareModal
          url={`${window.location.origin}/post/${done.postUuid}`}
          storyData={done.storyData}
          posterData={done.posterData}
          onClose={() => setShowShare(false)}
        />,
        document.body,
      )}
    </>
  )
}
