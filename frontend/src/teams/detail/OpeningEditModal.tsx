// Split out of TeamDetailPage.tsx (leader-only opening create/edit form) -
// was already a proper hooks-compliant component taking only props, so this
// move is a pure relocation with no behavior change.
import Portal from '../../components/Portal'
import { useState } from 'react'
import teamService from '../../services/teamService'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/Confirm'
import { supabaseCommunity } from '../../lib/supabaseCommunity'
import { CustomQuestion } from '../../lib/jobOpenings'
import { OpeningQuestionBuilder } from '../../components/OpeningQuestionBuilder'
import useDialog from '../../hooks/useDialog'
import Field from '../../components/Field'
import { OpeningStatus, TeamOpening } from './shared'

export default function OpeningEditModal({
  opening, teamName, teamUuid, teamCategory, member, onClose, onSaved,
}: {
  opening: TeamOpening | 'new'
  teamName?: string
  teamUuid?: string
  teamCategory?: string
  member: { fullName: string; role: string } | null
  onClose: () => void
  onSaved: () => void
}) {
  const { success: toastSuccess, error: toastError } = useToast()
  const confirm = useConfirm()
  const isNew = opening === 'new'
  const existing = isNew ? null : opening as TeamOpening
  const [oTitle, setOTitle]   = useState(existing?.title || '')
  const [oDesc, setODesc]     = useState(existing?.description || '')
  const [oSkills, setOSkills] = useState(existing?.skills.join(', ') || '')
  const [oCommit, setOCommit] = useState(existing?.commitment || '')
  const [oStatus, setOStatus] = useState<OpeningStatus>(existing?.status || 'open')
  const [questions, setQuestions] = useState<CustomQuestion[]>(existing?.customQuestions || [])
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [touched, setTouched] = useState({ title: false, desc: false })

  const labelSt: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 6 }
  // Inputs onto the control hairline + --r-tight, matching .input in v6.css.
  const inputSt: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-2)', border: 'var(--hair-3)', borderRadius: 'var(--r-tight)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 16, outline: 'none' }

  const handleSave = async () => {
    // Mark both fields as touched so red borders appear
    setTouched({ title: true, desc: true })
    if (!oTitle.trim() && !oDesc.trim()) {
      toastError('Role title and description are required')
      return
    }
    if (!oTitle.trim()) { toastError('Role title is required'); return }
    if (!oDesc.trim())  { toastError('needs a description.'); return }
    if (questions.some(q => !q.label.trim())) { toastError('every question needs a label.'); return }
    setSaving(true)
    try {
      if (isNew) {
        const skills = oSkills.split(',').map(s => s.trim()).filter(Boolean)
        const category = teamCategory || 'welfare'

        // Auto-announce every new opening as a feed post - a role posted only
        // to the Openings tab was easy to miss; the feed is where people
        // actually look. Post first (so we have a uuid to link), then create
        // the opening with linked_post_id set - same order/pattern
        // CreatePostModal uses for a post-authored opening, just reversed.
        // Best-effort: if the post fails to create, the opening still saves
        // (it's still visible on the Openings tab) - just say so.
        let linkedPostId: string | undefined
        let postFailed = false
        if (teamUuid) {
          try {
            const bodyLines = [
              `we're looking for a ${oTitle.trim()}.`,
              '',
              oDesc.trim(),
            ]
            if (oCommit.trim()) bodyLines.push('', `time commitment: ${oCommit.trim()}`)
            if (skills.length) bodyLines.push('', `skills: ${skills.join(', ')}`)
            bodyLines.push('', 'apply from the Openings tab →')
            const postResult = await teamService.createTeamPost(teamUuid, {
              category,
              body: bodyLines.join('\n'),
            })
            linkedPostId = postResult?.data?.post?.uuid
          } catch (postErr) {
            console.error('[OpeningEditModal] auto-post for new opening failed', postErr)
            postFailed = true
          }
        }

        // Cast: custom_questions predates the generated database.types (see
        // scripts/job_openings_custom_application_form_2026_07.sql).
        const { error } = await (supabaseCommunity as any).from('job_openings').insert({
          title: oTitle.trim(),
          description: oDesc.trim(),
          category,
          team_name: teamName || '',
          skills,
          commitment: oCommit.trim() || null,
          status: oStatus,
          created_by_name: member?.fullName || teamName || 'Team',
          created_by_role: member?.role || 'hod',
          linked_post_id: linkedPostId,
          custom_questions: questions,
        })
        if (error) throw error
        toastSuccess(
          'Opening posted!',
          linkedPostId ? 'Live on the Openings tab and announced in the feed.'
            : postFailed ? "It's on the Openings tab - the feed announcement didn't go through."
            : 'It\'s now visible on the Openings tab.'
        )
      } else {
        const { error } = await (supabaseCommunity as any).from('job_openings').update({
          title: oTitle.trim(),
          description: oDesc.trim(),
          category: teamCategory || existing?.category || 'welfare',
          skills: oSkills.split(',').map(s => s.trim()).filter(Boolean),
          commitment: oCommit.trim() || null,
          status: oStatus,
          custom_questions: questions,
        }).eq('id', existing!.id)
        if (error) throw error
        toastSuccess('Opening updated.')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      toastError(e?.message || 'Failed to save opening')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existing) return
    const ok = await confirm({
      title: 'Remove this opening?',
      body: `"${existing.title}" will be removed from the Openings tab. This can't be undone.`,
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    setDeleting(true)
    try {
      const { error } = await supabaseCommunity.from('job_openings').update({ status: 'deleted' }).eq('id', existing.id)
      if (error) throw error
      toastSuccess('Opening removed.')
      onSaved()
      onClose()
    } catch (e: any) {
      toastError(e?.message || 'Failed to delete opening')
    } finally {
      setDeleting(false)
    }
  }

  const statusOptions: { value: OpeningStatus; label: string; color: string }[] = [
    { value: 'open',   label: '● Open',   color: 'var(--welfare)' },
    { value: 'paused', label: '⏸ Paused', color: 'var(--lemon)' },
    { value: 'closed', label: '○ Closed', color: 'var(--ink-3)' },
  ]

  const panelRef = useDialog(true, onClose, { closeOnEscape: !saving && !deleting })

  return (
    <Portal>
<div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 16px' }}>
      {/* Leader-only management surface - flat HoD-desk chrome via the same
          var(--hod-*, fallback) pattern ProjectManager.tsx uses (this modal
          isn't wrapped in DirectorDashboard's .admin scope, so the tokens
          need an explicit fallback to resolve here), not the public
          neubrutalist hard-shadow treatment. */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={isNew ? 'Add opening' : 'Edit opening'} tabIndex={-1} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: 'var(--hod-surface-1, var(--card))', borderRadius: 'var(--hod-radius, var(--r-outer))', padding: 24, border: '1px solid var(--hod-border, var(--line-2))', boxShadow: 'var(--hod-shadow-md, 0 10px 30px rgba(0,0,0,0.16))', maxHeight: '90dvh', overflowY: 'auto', outline: 'none' }}>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>
          {isNew ? 'add opening' : 'edit opening'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field
            label="Role title"
            required
            labelStyle={labelSt}
            error={touched.title && !oTitle.trim() ? 'Required' : undefined}
          >
            {(id, describedBy) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={touched.title && !oTitle.trim() || undefined}
                style={{ ...inputSt, borderColor: touched.title && !oTitle.trim() ? 'var(--danger)' : undefined }}
                value={oTitle}
                onChange={e => { setOTitle(e.target.value); setTouched(t => ({ ...t, title: true })) }}
                placeholder="e.g. Social Media Manager"
              />
            )}
          </Field>
          <Field
            label="Description"
            required
            labelStyle={labelSt}
            error={touched.desc && !oDesc.trim() ? 'Required' : undefined}
          >
            {(id, describedBy) => (
              <textarea
                id={id}
                aria-describedby={describedBy}
                aria-invalid={touched.desc && !oDesc.trim() || undefined}
                style={{ ...inputSt, minHeight: 100, resize: 'vertical', borderColor: touched.desc && !oDesc.trim() ? 'var(--danger)' : undefined }}
                value={oDesc}
                onChange={e => { setODesc(e.target.value); setTouched(t => ({ ...t, desc: true })) }}
                placeholder="What will this person do? What's expected?"
              />
            )}
          </Field>
          <Field label={<>Skills <span style={{ opacity: 0.5, fontWeight: 400 }}>(comma separated)</span></>} labelStyle={labelSt}>
            {id => <input id={id} style={inputSt} value={oSkills} onChange={e => setOSkills(e.target.value)} placeholder="e.g. Canva, Excel, Communication" />}
          </Field>
          <Field label="Time commitment" labelStyle={labelSt}>
            {id => <input id={id} style={inputSt} value={oCommit} onChange={e => setOCommit(e.target.value)} placeholder="e.g. 2-3 hrs/week" />}
          </Field>
          {/* Button group — role="group", not a label. */}
          <div role="group" aria-labelledby="op-status-cap">
            <span id="op-status-cap" style={labelSt}>Status</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {statusOptions.map(opt => (
                <button key={opt.value} onClick={() => setOStatus(opt.value)} className="btn btn-sm"
                  style={{ background: oStatus === opt.value ? opt.color : 'var(--bg-2)', color: 'var(--ink)', borderColor: oStatus === opt.value ? opt.color : 'transparent' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom application questions - HoD-defined fields the applicant
              fills in on the Apply form (text, long text, or a file upload),
              in addition to the built-in message field. */}
          <OpeningQuestionBuilder questions={questions} onChange={setQuestions} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            className="btn btn-sm btn-primary"
            style={{
              flex: 1, justifyContent: 'center',
              opacity: saving || deleting ? 0.7 : 1,
            }}
            disabled={saving || deleting}
            onClick={handleSave}
          >
            {saving ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 11, height: 11, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                saving…
              </span>
            ) : isNew ? 'post opening →' : 'save changes →'}
          </button>
          {!isNew && (
            <button className="btn btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger-tint)' }} onClick={handleDelete} disabled={deleting || saving}>
              {deleting ? '…' : 'delete'}
            </button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={saving || deleting}>cancel</button>
        </div>
      </div>
    </div>
</Portal>
  )
}
