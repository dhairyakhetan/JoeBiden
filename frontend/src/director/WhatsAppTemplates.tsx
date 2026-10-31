import { useEffect, useMemo, useState } from 'react'
import sopTemplateService, { SopTemplate } from '../services/sopTemplateService'
import { hasLeaderAccess } from '../lib/roles'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { AdminRow, AdminRowActions, EmptyLedger, AdminSkeleton, AdminErrorState } from './adminKit'
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'

/**
 * The pre-composed WhatsApp script browser (handoff/20-sops-and-todos.md
 * §4.5): "a copy-to-clipboard template list on the HR desk, because that is
 * how they are used. One tap, `copied` inline, name substituted."
 * Deliberately a sibling of SopManagement, not part of it - see that file's
 * own header comment and sopTemplateService.ts's. No `AdminLayout`/
 * `AdminTabHeader` here on purpose - this renders as a section inside a
 * parent desk screen, which owns its own header/layout chrome.
 *
 * `{{name}}` in a template body is substituted with the "recipient name"
 * field below at copy time - the field is local UI state only, never saved.
 */

const NAME_TOKEN = /\{\{\s*name\s*\}\}/g

export default function WhatsAppTemplates() {
  const { member } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const canManage = hasLeaderAccess(member?.role)

  const [templates, setTemplates] = useState<SopTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recipientName, setRecipientName] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftBody, setDraftBody] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchTemplates = async () => {
    setLoading(true); setError(null)
    try {
      const result = await sopTemplateService.list()
      if (result.success) setTemplates(result.data)
    } catch (e: any) {
      setError(e?.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchTemplates() }, [])

  const substituted = useMemo(() => {
    const name = recipientName.trim()
    return new Map(templates.map(t => [t.id, name ? t.body.replace(NAME_TOKEN, name) : t.body]))
  }, [templates, recipientName])

  const handleCopy = async (t: SopTemplate) => {
    const text = substituted.get(t.id) || t.body
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(t.id)
      setTimeout(() => setCopiedId(id => (id === t.id ? null : id)), 1600)
    } catch {
      toast.error('couldn’t copy that.', 'your browser blocked clipboard access - select and copy the text manually.')
      // The instruction the toast gives is only actionable if the text is on
      // screen. A blocked clipboard therefore opens the row it failed on -
      // the one new behaviour on this desk, and the only thing that makes
      // "select and copy the text manually" true.
      setExpandedId(t.id)
    }
  }

  const startEdit = (t: SopTemplate) => { setEditingId(t.id); setDraftBody(t.body) }
  const cancelEdit = () => { setEditingId(null); setDraftBody('') }

  const saveEdit = async (t: SopTemplate) => {
    setSaving(true)
    try {
      const result = await sopTemplateService.update(t.id, { departmentSlug: t.departmentSlug, label: t.label, body: draftBody })
      if (result.success) {
        setTemplates(prev => prev.map(x => (x.id === t.id ? result.data : x)))
        toast.success('template updated')
        cancelEdit()
      }
    } catch (e: any) {
      toast.error('couldn’t save that.', e?.message || 'try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: SopTemplate) => {
    if (!(await confirm({ title: 'delete this template?', body: `"${t.label}" will be permanently removed.`, confirmLabel: 'delete it', danger: true }))) return
    try {
      await sopTemplateService.remove(t.id)
      setTemplates(prev => prev.filter(x => x.id !== t.id))
      toast.success('template deleted')
    } catch (e: any) {
      toast.error('couldn’t delete that.', e?.message || 'try again.')
    }
  }

  if (loading) return <AdminSkeleton rows={3} />
  if (error) return <AdminErrorState message={error} onRetry={fetchTemplates} />
  if (templates.length === 0) {
    return (
      <EmptyLedger
        message="no templates yet"
        sub={canManage ? 'add rows to sop_templates to seed the recruitment scripts here.' : 'nothing here yet - check back soon.'}
      />
    )
  }

  return (
    <div>
      {/* The recipient name does two invisible things: it substitutes into
          EVERY template below at copy time, and it is never persisted. Both
          now say so in words, and the substituted name shows up in each
          collapsed preview so a lead can confirm it landed without opening
          anything. The label string is unchanged, parenthetical included. */}
      <div className="adm-block is-welfare" style={{ marginTop: 0, marginBottom: 14 }}>
        <label htmlFor="wa-recipient-name" className="mono xs upper" style={{ display: 'block', fontWeight: 700, marginBottom: 6, color: 'var(--ink-3)' }}>
          recipient name <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional - fills in any {'{{name}}'} in the text below)</span>
        </label>
        <input
          id="wa-recipient-name"
          className="input"
          style={{ width: '100%', maxWidth: 320, minHeight: 46 }}
          value={recipientName}
          onChange={e => setRecipientName(e.target.value)}
          placeholder="e.g. Priyasha"
        />
        <p className="adm-note">substituted in every template below, at copy time. never saved.</p>
      </div>

      {templates.map(t => {
        const isEditing = editingId === t.id
        const isOpen = expandedId === t.id
        const preview = (substituted.get(t.id) || t.body).split('\n').find(l => l.trim()) || ''
        return (
          <AdminRow
            key={t.id}
            primary={t.label}
            secondary={preview.length > 90 ? preview.slice(0, 87) + '...' : preview}
            onToggleExpand={() => setExpandedId(isOpen ? null : t.id)}
            expanded={isOpen ? (
              isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onClick={e => e.stopPropagation()}>
                  {/* --code, not --mono: this holds the director's own
                      lowercase message text, and --mono is NeutralFace
                      (caps-only glyphs) - it would render it as shouted. */}
                  <textarea
                    className="textarea"
                    style={{ width: '100%', minHeight: 160, resize: 'vertical', fontFamily: 'var(--code)', fontSize: 13 }}
                    value={draftBody}
                    onChange={e => setDraftBody(e.target.value)}
                    maxLength={4000}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-primary" disabled={saving || !draftBody.trim()} onClick={() => saveEdit(t)}>
                      {saving ? 'saving...' : '✓ save'}
                    </button>
                    <button className="btn btn-sm btn-ghost" disabled={saving} onClick={cancelEdit}>cancel</button>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'var(--code)', fontSize: 13 }}>
                  {substituted.get(t.id) || t.body}
                </p>
              )
            ) : undefined}
            actions={
              <>
                {/* Copy is the entire point of this desk and it was buried in
                    an actions sheet behind a "⋯". It is the card's filled
                    primary now. Both label strings and the 1600ms swap are
                    unchanged. */}
                <button className="btn btn-sm adm-approve wa-copy" onClick={() => handleCopy(t)}>
                  {copiedId === t.id ? 'copied ✓' : '⧉ copy'}
                </button>
                <AdminRowActions sheetTitle={t.label}>
                  {canManage && !isEditing && (
                    <button className="adm-actpill" onClick={() => { setExpandedId(t.id); startEdit(t) }}>
                      <PencilSquareIcon width={13} height={13} strokeWidth={2} aria-hidden /> edit
                    </button>
                  )}
                  {canManage && (
                    <button className="adm-actpill is-danger" onClick={() => handleDelete(t)}>
                      <TrashIcon width={13} height={13} strokeWidth={2} aria-hidden /> delete
                    </button>
                  )}
                </AdminRowActions>
              </>
            }
          />
        )
      })}
    </div>
  )
}
