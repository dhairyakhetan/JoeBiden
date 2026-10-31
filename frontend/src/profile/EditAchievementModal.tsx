import Img from '../components/Img'
import { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { modalBackdropTransition, modalPanelTransition } from '../lib/motion'
import { Achievement } from '../services/api'
import achievementService from '../services/achievementService'
import feedService from '../services/feedService'
import { useToast } from '../components/Toast'
import { checkText, BLOCK_MESSAGE } from '../lib/profanityFilter'
import useDialog from '../hooks/useDialog'
import Field from '../components/Field'
import GatedButton from '../components/GatedButton'

interface EditAchievementModalProps {
  isOpen: boolean
  onClose: () => void
  achievement: Achievement
  onAchievementUpdated: () => void
}

const ACHIEVEMENT_TYPES = [
  { value: 'leadership', label: '👑 Leadership' },
  { value: 'academic', label: '📚 Academic' },
  { value: 'competition', label: '🏆 Competition' },
  { value: 'personal_project', label: '💡 Personal Project' },
  { value: 'other', label: '🌟 Other' },
]

const toDateInput = (dateStr?: string | null) => {
  if (!dateStr) return ''
  return dateStr.split('T')[0]
}

const LBL: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--display)',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  marginBottom: 6,
}

const EditAchievementModal = ({ isOpen, onClose, achievement, onAchievementUpdated }: EditAchievementModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const shouldReduceMotion = useReducedMotion()

  const [formData, setFormData] = useState({
    title: achievement.title,
    description: achievement.description || '',
    achievementType: achievement.achievementType,
    startDate: toDateInput(achievement.achievementDate),
    endDate: toDateInput(achievement.achievementEndDate),
    isPresent: !achievement.achievementEndDate,
    proofImage: null as File | null,
  })
  const [imagePreview, setImagePreview] = useState<string | null>(achievement.proofUrl || null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFormData({
      title: achievement.title,
      description: achievement.description || '',
      achievementType: achievement.achievementType,
      startDate: toDateInput(achievement.achievementDate),
      endDate: toDateInput(achievement.achievementEndDate),
      isPresent: !achievement.achievementEndDate,
      proofImage: null,
    })
    setImagePreview(achievement.proofUrl || null)
  }, [achievement])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handlePresentToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, isPresent: e.target.checked, endDate: '' }))
  }

  const handleSupportingImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image must be less than 5MB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    setFormData(prev => ({ ...prev, proofImage: file }))
  }

  const removeSupportingImage = () => {
    setFormData(prev => ({ ...prev, proofImage: null }))
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    if (!formData.title.trim()) { setError('Title is required'); return }
    if (!formData.achievementType) { setError('pick an achievement type.'); return }
    if (!formData.startDate) { setError('Start date is required'); return }
    if (!formData.isPresent && !formData.endDate) { setError('set an end date, or mark it ongoing.'); return }
    if ((await checkText(formData.title)).severity === 'block' || (await checkText(formData.description)).severity === 'block') {
      setError(BLOCK_MESSAGE); toast.error(BLOCK_MESSAGE); return
    }

    setIsSubmitting(true); setError(null)
    try {
      let proofUrl: string | undefined = achievement.proofUrl
      if (formData.proofImage) {
        const uploadResult = await feedService.uploadImages([formData.proofImage])
        if (uploadResult.success) proofUrl = uploadResult.data.images[0].url
        else throw new Error('Failed to upload supporting image')
      } else if (!imagePreview) {
        proofUrl = undefined
      }
      const result = await achievementService.updateAchievement(achievement.uuid, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        achievementType: formData.achievementType,
        achievementDate: formData.startDate,
        achievementEndDate: formData.isPresent ? null : formData.endDate,
        proofUrl,
      })
      if (result.success) {
        toast.success('achievement updated.')
        onAchievementUpdated(); handleClose()
      } else {
        const msg = result.message || 'Failed to update achievement'
        setError(msg); toast.error(msg)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update achievement'
      setError(msg); toast.error(msg)
    } finally { setIsSubmitting(false) }
  }

  const handleClose = () => {
    setFormData({
      title: achievement.title,
      description: achievement.description || '',
      achievementType: achievement.achievementType,
      startDate: toDateInput(achievement.achievementDate),
      endDate: toDateInput(achievement.achievementEndDate),
      isPresent: !achievement.achievementEndDate,
      proofImage: null,
    })
    setImagePreview(achievement.proofUrl || null)
    setError(null); onClose()
  }

  const canSubmit = !!formData.title && !!formData.achievementType && !!formData.startDate && (formData.isPresent || !!formData.endDate)

  const panelRef = useDialog(isOpen, handleClose, { closeOnEscape: !isSubmitting })

  return (
    <AnimatePresence>
      {isOpen && (
    <motion.div
      className="modal-back pf-modal-back"
      onClick={handleClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={modalBackdropTransition}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit achievement"
        tabIndex={-1}
        className="modal pf-modal"
        onClick={e => e.stopPropagation()}
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
        transition={modalPanelTransition}
        style={{ maxWidth: 520, width: '100%', outline: 'none' }}
      >
        {/* Head */}
        <div className="modal-head">
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Edit Achievement
          </span>
          <button className="pf-modal-close" onClick={handleClose} aria-label="Close" title="Close">✕</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Error */}
          {error && (
            <div role="alert" style={{ background: 'rgba(224,92,92,0.12)', border: '1px solid rgba(224,92,92,0.3)', borderRadius: 'var(--r)', padding: '10px 14px', color: 'var(--danger)', fontFamily: 'var(--display)', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              {error}
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, fontSize: 14 }}>✕</button>
            </div>
          )}

          {/* Title */}
          <Field label="Title" required labelStyle={LBL}>
            {id => (
              <input
                id={id}
                className="input"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Regional Science Olympiad Winner"
              />
            )}
          </Field>

          {/* Description */}
          <Field label="Description" labelStyle={LBL}>
            {id => (
              <textarea
                id={id}
                className="input"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your achievement..."
                rows={3}
                style={{ resize: 'vertical', minHeight: 80 }}
              />
            )}
          </Field>

          {/* Type */}
          <Field label="Type" required labelStyle={LBL}>
            {id => (
              <select
                id={id}
                className="input"
                name="achievementType"
                value={formData.achievementType}
                onChange={handleChange}
              >
                <option value="">Select type…</option>
                {ACHIEVEMENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            )}
          </Field>

          {/* Date range */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Start Date" required labelStyle={LBL}>
                {id => <input id={id} className="input" type="date" name="startDate" value={formData.startDate} onChange={handleChange} />}
              </Field>
              <Field label="End Date" required={!formData.isPresent} labelStyle={LBL}>
                {id => formData.isPresent
                  ? <div className="input" style={{ color: 'var(--ink-3)', fontStyle: 'italic', cursor: 'default' }}>Present</div>
                  : <input id={id} className="input" type="date" name="endDate" value={formData.endDate} onChange={handleChange} min={formData.startDate || undefined} />
                }
              </Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: 'fit-content' }}>
              <input
                type="checkbox"
                checked={formData.isPresent}
                onChange={handlePresentToggle}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ fontFamily: 'var(--display)', fontSize: 12, color: 'var(--ink-2)' }}>Currently ongoing (Present)</span>
            </label>
          </div>

          {/* Supporting Image */}
          <div role="group" aria-labelledby="ach-edit-image-cap">
            {/* <span>, not <label>: this caption heads a group (preview +
                hidden file input + upload button), not a single control. */}
            <span id="ach-edit-image-cap" style={LBL}>Supporting Image <span style={{ fontWeight: 400, color: 'var(--ink-3)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></span>
            {imagePreview && (
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Img src={imagePreview} alt="Preview" className="no-long-press" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 'var(--r)', display: 'block', outline: '1px solid rgba(0,0,0,0.1)' }} />
                <button
                  type="button"
                  onClick={removeSupportingImage}
                  style={{ position: 'absolute', top: 8, right: 8, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
                >
                  {/* a11y: the VISIBLE control was 28×28, under the 32px floor -
                      raised to 36×36. It floats over the preview image, so growing
                      it moves no layout. The invisible extension shrinks from -8 to
                      -4 so the total hit area stays exactly 44×44. */}
                  <span aria-hidden style={{ position: 'absolute', inset: -4 }} />
                  ✕
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSupportingImageSelect} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', padding: '10px 16px', borderRadius: 'var(--r)', border: '2px dashed var(--line)', background: 'none', color: 'var(--ink-3)', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.03em', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-3)' }}
            >
              {imagePreview ? '↻ Change Image' : '↑ Upload Image'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
          <button className="btn btn-sm" onClick={handleClose} disabled={isSubmitting}>Cancel</button>
          {/* §11.9 state 11: this was a half-opacity button that said nothing
              about WHICH of the four required answers was still missing. */}
          <GatedButton
            className="btn btn-sm btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            reason={canSubmit ? null : 'fill in the title, the type and the dates first.'}
            style={{ opacity: isSubmitting ? 0.5 : 1 }}
          >
            {isSubmitting ? 'Saving…' : 'Update Achievement'}
          </GatedButton>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  )
}

export default EditAchievementModal
