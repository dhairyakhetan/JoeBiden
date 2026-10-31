import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { modalBackdropTransition, modalPanelTransition } from '../lib/motion'
import { DocumentTextIcon, AcademicCapIcon } from '@heroicons/react/24/outline'
import cvService, { type CvRecord, type CvEducation } from '../services/cvService'
import { buildCvContact, buildCvSections, cvFileName, formatCvYearRange, present, type CvIdentity } from '../lib/cv'
import { getRoleLabel } from '../lib/roles'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import Field from '../components/Field'
import { checkText, BLOCK_MESSAGE } from '../lib/profanityFilter'
import useDialog from '../hooks/useDialog'
import { FOUNDED_YEAR } from '../lib/orgFacts'
import '../styles/routes/profile.css'
import GatedButton from '../components/GatedButton'

/**
 * FR9 (user, 2026-09-05): "geneate CV button".
 *
 * Own profile only. Composes a CV out of the AquaTerra record the app already
 * holds — tenure, teams, verified hours, approved achievements, role — shows it
 * as a preview the member can read before committing, and hands it to the
 * browser's print pipeline to save as a PDF. Same mechanism BrandPage's
 * "export to PDF" already uses; no PDF library is installed and none is added.
 *
 * The rule that governs every line below: **nothing is invented.** All the
 * omit-when-empty logic lives in `lib/cv.ts` and is unit-tested there, so this
 * file renders exactly what it is handed and never fills a gap. A member with
 * no teams, no achievements and no counted drives gets a short, true CV rather
 * than a padded one.
 *
 * Unlike HoursAndCertificateCard this card does NOT hide itself when the
 * member has no drives — a CV is still worth generating from tenure and teams
 * alone, and it simply carries no hours section in that case.
 *
 * Education (2026-09-05): the one place this file also WRITES. `member_education`
 * (scripts/member_education_2026_09_05.sql) is a member's own schooling/college
 * history — add/edit/remove, own rows only (RLS), no approval workflow. It is
 * managed here as its own always-visible card (not gated behind "generate my
 * CV"), and included as a new section by lib/cv.ts's buildCvSections. Every
 * mutation follows the house feedback pattern: toast.success/error and, for
 * delete, useConfirm() first (components/Confirm.tsx, components/Toast.tsx).
 */

interface CvMember {
  member_id: number
  full_name?: string | null
  role?: string | null
  class_grade?: string | null
  email?: string | null
  phone?: string | null
  bio?: string | null
  instagram?: string | null
  linkedin?: string | null
  created_at?: string | null
}

const EDU_LBL: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--display)',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--ink-3)',
  marginBottom: 6,
}

/** Local editor state for the add/edit education form. Years are kept as
 *  strings while editing (controlled <input type="number"> values are
 *  strings) and parsed to number|null only at submit time. */
interface EduFormState {
  /** null while adding a new entry; the row's id while editing an existing one. */
  id: number | null
  institution: string
  credential: string
  startYear: string
  endYear: string
  /** UI-only convenience: true clears+disables End year. Never itself stored —
   *  both "ongoing" and "unspecified" persist identically as endYear: null,
   *  so re-opening an entry for edit never infers this checkbox from data
   *  that can't actually distinguish the two (see startEditEdu below). */
  ongoing: boolean
  grade: string
}

const blankEduForm: EduFormState = { id: null, institution: '', credential: '', startYear: '', endYear: '', ongoing: false, grade: '' }

/** Highest start_year first, id descending as a tiebreaker — mirrors
 *  cvService.getEducation's own ORDER BY exactly, so a locally-patched list
 *  (after an add/edit) never disagrees with a fresh fetch. */
function sortEducation(list: CvEducation[]): CvEducation[] {
  return [...list].sort((a, b) => {
    const ay = a.startYear ?? -Infinity
    const by = b.startYear ?? -Infinity
    if (ay !== by) return by - ay
    return b.id - a.id
  })
}

/** The compact "Institution · years · grade" line for the editable list —
 *  the management-UI analogue of what lib/cv.ts's buildCvSections renders
 *  onto the printed sheet, but kept local since this is presentation only. */
function eduMetaLine(edu: CvEducation): string {
  const gradeNote = present(edu.grade)
  return [present(edu.credential), formatCvYearRange(edu.startYear, edu.endYear), gradeNote ? `Grade: ${gradeNote}` : null]
    .filter((p): p is string => !!p)
    .join(' · ')
}

export default function CvCard({ member }: { member: CvMember }) {
  const toast = useToast()
  const confirm = useConfirm()
  const shouldReduceMotion = useReducedMotion()
  const [record, setRecord] = useState<CvRecord | null>(null)
  const [open, setOpen] = useState(false)
  const [building, setBuilding] = useState(false)

  // ── Education: own list, managed independently of the generate/preview
  // flow above so a member can build it up over time, not just mid-print. ──
  const [education, setEducation] = useState<CvEducation[]>([])
  const [loadingEducation, setLoadingEducation] = useState(true)
  const [eduForm, setEduForm] = useState<EduFormState | null>(null)
  const [savingEdu, setSavingEdu] = useState(false)
  const [eduError, setEduError] = useState<string | null>(null)
  const [deletingEduId, setDeletingEduId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingEducation(true)
    cvService.getEducation(member.member_id)
      .then(rows => { if (!cancelled) setEducation(rows) })
      .catch((e: any) => { if (!cancelled) toast.error("couldn't load your education.", e?.message || 'try again.') })
      .finally(() => { if (!cancelled) setLoadingEducation(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.member_id])

  const openAddEdu = () => { setEduError(null); setEduForm({ ...blankEduForm }) }

  const startEditEdu = (edu: CvEducation) => {
    setEduError(null)
    setEduForm({
      id: edu.id,
      institution: edu.institution,
      credential: edu.credential ?? '',
      startYear: edu.startYear != null ? String(edu.startYear) : '',
      endYear: edu.endYear != null ? String(edu.endYear) : '',
      ongoing: false,
      grade: edu.grade ?? '',
    })
  }

  const cancelEduForm = () => { setEduForm(null); setEduError(null) }

  const submitEduForm = async () => {
    if (!eduForm) return
    const institution = eduForm.institution.trim()
    if (!institution) { setEduError('School or college name is required.'); return }

    const startYear = eduForm.startYear.trim() ? Number(eduForm.startYear) : null
    const endYear = eduForm.ongoing ? null : (eduForm.endYear.trim() ? Number(eduForm.endYear) : null)
    if (startYear != null && !Number.isInteger(startYear)) { setEduError('Start year must be a whole number.'); return }
    if (endYear != null && !Number.isInteger(endYear)) { setEduError('End year must be a whole number.'); return }
    if (startYear != null && endYear != null && endYear < startYear) {
      setEduError('End year cannot be before start year.')
      return
    }

    // Same policy as AddAchievementModal: only the hard 'block' tier stops
    // the submit (this content is never public — own CV / leaders reading
    // their own record only — so the lighter of this app's two profanity
    // policies is the appropriate one here, not bio's stricter "any tier").
    const credential = eduForm.credential.trim() || null
    const grade = eduForm.grade.trim() || null
    for (const text of [institution, credential, grade]) {
      if (text && (await checkText(text)).severity === 'block') {
        setEduError(BLOCK_MESSAGE); toast.error(BLOCK_MESSAGE); return
      }
    }

    setSavingEdu(true); setEduError(null)
    try {
      const input = { institution, credential, startYear, endYear, grade }
      if (eduForm.id != null) {
        const updated = await cvService.updateEducation(eduForm.id, input)
        setEducation(list => sortEducation(list.map(e => (e.id === updated.id ? updated : e))))
        toast.success('education entry updated.')
      } else {
        const created = await cvService.addEducation(member.member_id, input)
        setEducation(list => sortEducation([...list, created]))
        toast.success('added to your CV.')
      }
      setEduForm(null)
    } catch (e: any) {
      const msg = e?.message || 'try again.'
      setEduError(msg)
      toast.error("couldn't save that.", msg)
    } finally {
      setSavingEdu(false)
    }
  }

  const handleDeleteEdu = async (edu: CvEducation) => {
    const ok = await confirm({
      title: `Delete "${edu.institution}"?`,
      body: 'This removes it from your CV permanently.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setDeletingEduId(edu.id)
    try {
      await cvService.deleteEducation(edu.id)
      setEducation(list => list.filter(e => e.id !== edu.id))
      if (eduForm?.id === edu.id) setEduForm(null)
      toast.success('education entry removed.')
    } catch (e: any) {
      toast.error("couldn't delete that.", e?.message || 'try again.')
    } finally {
      setDeletingEduId(null)
    }
  }

  const close = useCallback(() => setOpen(false), [])
  const panelRef = useDialog(open, close)

  const identity: CvIdentity = {
    fullName: present(member.full_name) ?? 'AquaTerra member',
    roleLabel: member.role ? getRoleLabel(member.role) : null,
    classGrade: member.class_grade,
    email: member.email,
    phone: member.phone,
    bio: member.bio,
    instagram: member.instagram,
    linkedin: member.linkedin,
    joinedAt: member.created_at,
  }

  const build = async () => {
    setBuilding(true)
    try {
      const data = await cvService.getRecord(member.member_id)
      setRecord(data)
      setOpen(true)
    } catch (e: any) {
      toast.error("couldn't build your CV.", e?.message || 'try again.')
    } finally {
      setBuilding(false)
    }
  }

  // The print pipeline, exactly as BrandPage does it: flag the body so the
  // @media print rules in profile.css can drop the whole app except the sheet,
  // open the dialog, then clear the flag. `document.title` is swapped for the
  // duration because every browser uses it as the suggested PDF filename.
  const print = useCallback(() => {
    const previousTitle = document.title
    document.title = cvFileName(identity.fullName)
    document.body.classList.add('cv-printing')
    window.setTimeout(() => {
      window.print()
      document.body.classList.remove('cv-printing')
      document.title = previousTitle
      // No success toast here. window.print() resolves the same way whether
      // the member printed or pressed Cancel - the API reports no outcome - so
      // "CV sent to your printer" was asserted on every Cancel too, and its
      // subtitle told them to choose "save as PDF" in a dialog that had
      // already closed. The print dialog is its own feedback.
    }, 120)
  }, [identity.fullName])

  // A dialog that is torn down mid-print must not leave the app hidden.
  useEffect(() => () => { document.body.classList.remove('cv-printing') }, [])

  const contact = buildCvContact(identity)
  const sections = record ? buildCvSections(identity, record) : []

  return (
    <>
      <div className="card">
        <div className="pf-label-row">
          <span className="pf-label">your education</span>
          <AcademicCapIcon className="pf-label-aside" width={15} height={15} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="pf-sub pf-sub-prose">
          School, college, whatever you want on record — editable only by you, and
          included as a section in your generated CV below.
        </p>

        {loadingEducation ? (
          <p className="pf-sub" style={{ marginTop: 12 }}>loading…</p>
        ) : (
          <>
            {education.length === 0 && !eduForm && (
              <p className="pf-sub" style={{ marginTop: 12 }}>Nothing added yet.</p>
            )}
            {education.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {education.map(edu => {
                  const meta = eduMetaLine(edu)
                  return (
                    <div key={edu.id} className="pf-edu-row">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--eina)', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{edu.institution}</div>
                        {meta && <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-2)', marginTop: 2 }}>{meta}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button type="button" className="btn btn-sm" onClick={() => startEditEdu(edu)} aria-label={`Edit ${edu.institution}`} title="Edit">✎</button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleDeleteEdu(edu)}
                          disabled={deletingEduId === edu.id}
                          aria-label={`Delete ${edu.institution}`}
                          title="Delete"
                        >
                          {deletingEduId === edu.id ? '…' : '✕'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {eduForm ? (
          <div style={{ border: 'var(--hair-2)', borderRadius: 'var(--r-inner)', padding: 14, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Field label="School / college name" required labelStyle={EDU_LBL}>
              {id => (
                <input
                  id={id}
                  className="input"
                  value={eduForm.institution}
                  onChange={e => setEduForm(f => f && { ...f, institution: e.target.value })}
                  placeholder="e.g. La Martiniere for Boys"
                />
              )}
            </Field>
            <Field label="Class / grade or degree" labelStyle={EDU_LBL}>
              {id => (
                <input
                  id={id}
                  className="input"
                  value={eduForm.credential}
                  onChange={e => setEduForm(f => f && { ...f, credential: e.target.value })}
                  placeholder="e.g. Class 12, or B.Tech Computer Science"
                />
              )}
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Start year" labelStyle={EDU_LBL}>
                {id => (
                  <input
                    id={id}
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={1950}
                    max={2100}
                    value={eduForm.startYear}
                    onChange={e => setEduForm(f => f && { ...f, startYear: e.target.value })}
                    placeholder="2018"
                  />
                )}
              </Field>
              <Field label="End year" labelStyle={EDU_LBL}>
                {id => eduForm.ongoing ? (
                  <div className="input" style={{ color: 'var(--ink-3)', fontStyle: 'italic', cursor: 'default' }}>Ongoing</div>
                ) : (
                  <input
                    id={id}
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={1950}
                    max={2100}
                    value={eduForm.endYear}
                    onChange={e => setEduForm(f => f && { ...f, endYear: e.target.value })}
                    placeholder="2022"
                  />
                )}
              </Field>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', width: 'fit-content' }}>
              <input
                type="checkbox"
                checked={eduForm.ongoing}
                onChange={e => setEduForm(f => f && { ...f, ongoing: e.target.checked, endYear: e.target.checked ? '' : f.endYear })}
                style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <span style={{ fontFamily: 'var(--display)', fontSize: 12, color: 'var(--ink-2)' }}>Currently studying here</span>
            </label>
            <Field label="Marks / grade" hint="optional — shown on your CV only if you fill this in." labelStyle={EDU_LBL}>
              {id => (
                <input
                  id={id}
                  className="input"
                  value={eduForm.grade}
                  onChange={e => setEduForm(f => f && { ...f, grade: e.target.value })}
                  placeholder="e.g. 92%, or 8.7 CGPA"
                />
              )}
            </Field>
            {eduError && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--danger)' }}>{eduError}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-sm" onClick={cancelEduForm} disabled={savingEdu}>cancel</button>
              {/* §11.9 state 11: institution is the one required field and
                  nothing said so - the button just sat there greyed out. */}
              <GatedButton
                type="button"
                className="btn btn-sm btn-primary"
                onClick={submitEduForm}
                disabled={savingEdu}
                reason={eduForm.institution.trim() ? null : 'add the school or college name first.'}
              >
                {savingEdu ? 'saving…' : (eduForm.id != null ? 'save changes' : 'add entry')}
              </GatedButton>
            </div>
          </div>
        ) : (
          <div className="pf-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-sm" onClick={openAddEdu}>+ add education</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="pf-label-row">
          <span className="pf-label">your CV</span>
          <DocumentTextIcon className="pf-label-aside" width={15} height={15} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <p className="pf-sub pf-sub-prose">
          Built from your AquaTerra record: how long you have been here, your education,
          your teams, the hours you have logged and the achievements an HoD has approved.
          Nothing else.
        </p>
        <div className="pf-actions">
          <button type="button" className="btn btn-primary" disabled={building} onClick={build}>
            {building ? 'building…' : 'generate my CV'}
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && record && (
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
                aria-label="Your CV"
                tabIndex={-1}
                className="modal pf-modal cv-modal"
                onClick={e => e.stopPropagation()}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 4 }}
                transition={modalPanelTransition}
                style={{ maxWidth: 680, width: '100%', outline: 'none' }}
              >
                <div className="modal-head">
                  <span style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
                    Your CV
                  </span>
                  <button className="pf-modal-close" onClick={close} aria-label="Close" title="Close">✕</button>
                </div>

                <div className="modal-body">
                  <article className="cv-sheet">
                    <header className="cv-head">
                      <h1 className="cv-name">{identity.fullName}</h1>
                      {identity.roleLabel && <p className="cv-role">{identity.roleLabel} · AquaTerra</p>}
                      {contact.length > 0 && (
                        <dl className="cv-contact">
                          {contact.map(line => (
                            <div key={line.label} className="cv-contact-row">
                              <dt>{line.label}</dt>
                              <dd>{line.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </header>

                    {sections.map(section => (
                      <section key={section.key} className="cv-section">
                        <h2 className="cv-heading">{section.heading}</h2>
                        {section.entries.map((entry, i) => (
                          <div key={`${section.key}-${i}`} className="cv-entry">
                            <p className="cv-entry-title">{entry.title}</p>
                            {entry.meta && <p className="cv-entry-meta">{entry.meta}</p>}
                            {entry.body && <p className="cv-entry-body">{entry.body}</p>}
                          </div>
                        ))}
                      </section>
                    ))}

                    <footer className="cv-foot">
                      Generated from this member's AquaTerra record. AquaTerra is a
                      student-run volunteer organisation in Kolkata, founded {FOUNDED_YEAR}.
                      Hours, teams and achievements shown here are held on record and can be
                      confirmed by AquaTerra.
                    </footer>
                  </article>

                  {sections.length === 0 && (
                    <p className="pf-sub pf-sub-prose cv-empty-note" style={{ marginTop: 12 }}>
                      Your record is still empty, so this CV is only your name and contact
                      details. Join a team, log a drive, add an achievement or add your
                      education above and generate it again.
                    </p>
                  )}
                </div>

                <div className="pf-actions" style={{ padding: '0 20px 20px' }}>
                  <button type="button" className="btn btn-primary" onClick={print}>
                    print / save as PDF
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={close}>
                    close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
