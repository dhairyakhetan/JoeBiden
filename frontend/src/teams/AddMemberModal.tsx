import Portal from '../components/Portal'
import Img from '../components/Img'
import './AddMemberModal.css'
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { modalBackdropTransition, modalPanelTransition } from '../lib/motion'
import teamService from '../services/teamService'
import { useDebounce } from '../hooks/useDebounce'
import feedService from '../services/feedService'
import { useToast } from '../components/Toast'
import { getInitials, hashColor } from '../lib/uiHelpers'
import useDialog from '../hooks/useDialog'
import Field from '../components/Field'
import GatedButton from '../components/GatedButton'

interface SearchedMember {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl?: string
  classGrade?: string
  role: string | null
}

// 'lead' team-membership role retired 2026-09-15 (owner decision: directors/
// HoDs are the only leadership tier, team-scoped or otherwise) - a selected
// member has no per-team role to pick anymore, see
// scripts/retire_lead_role_2026_09_15.sql.
type SelectedMember = SearchedMember

interface AddMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  teamUuid: string
  existingMemberIds: number[]
  /** Set on a sub-department page: members are added to that sub-department (and to the parent team if needed). */
  subTeam?: { uuid: string; name: string }
}

const AddMemberModal = ({ isOpen, onClose, onSuccess, teamUuid, existingMemberIds, subTeam }: AddMemberModalProps) => {
  const { success: toastSuccess, error: toastError } = useToast()
  const shouldReduceMotion = useReducedMotion()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchedMember[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<SelectedMember[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const debouncedSearch = useDebounce(searchQuery, 300)
  const existingIdsRef = useRef(existingMemberIds)
  const selectedIdsRef = useRef<number[]>([])
  existingIdsRef.current = existingMemberIds
  selectedIdsRef.current = selectedMembers.map(m => m.memberId)

  const searchInputRef = useRef<HTMLInputElement>(null)
  // useDialog parks focus on the panel first; the timeout below then moves it
  // to the search field, which is where this dialog's task actually starts.
  // Overlay-layer migration below: the panel's 20px radius + 2px ink border +
  // the 2px ink footer rule became --r-outer / --hair-2 plus --lift-4 depth, and
  // the 12px inputs and 1.5px --line-2 edges moved onto --r-tight / --hair-3.
  const panelRef = useDialog(isOpen, onClose, { closeOnEscape: !isSubmitting })

  useEffect(() => {
    if (isOpen) setTimeout(() => searchInputRef.current?.focus(), 80)
    else { setSearchQuery(''); setSearchResults([]); setSelectedMembers([]) }
  }, [isOpen])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (debouncedSearch.length < 2) { setSearchResults([]); return }
      setIsSearching(true)
      try {
        const response = await feedService.searchMembers(debouncedSearch)
        if (cancelled) return
        if (response.success) {
          setSearchResults(
            response.data.members.filter(
              (m: SearchedMember) =>
                !existingIdsRef.current.includes(m.memberId) &&
                !selectedIdsRef.current.includes(m.memberId)
            )
          )
        }
      } catch { } finally { if (!cancelled) setIsSearching(false) }
    }
    run()
    return () => { cancelled = true }
  }, [debouncedSearch])

  const handleAddToSelection = (member: SearchedMember) => {
    setSelectedMembers(prev => [...prev, member])
    setSearchQuery('')
    setSearchResults([])
    searchInputRef.current?.focus()
  }

  const handleRemoveFromSelection = (memberId: number) => {
    setSelectedMembers(prev => prev.filter(m => m.memberId !== memberId))
  }

  const handleSave = async () => {
    if (selectedMembers.length === 0) { toastError('Select at least one member first'); return }
    setIsSubmitting(true)
    try {
      if (subTeam) {
        const { added } = await teamService.addMembersToSubTeam(teamUuid, subTeam.uuid, selectedMembers.map(m => m.memberId))
        toastSuccess(`${added} member${added !== 1 ? 's' : ''} added`)
        onSuccess()
        onClose()
        return
      }
      const result = await teamService.addMembersBulk(
        teamUuid,
        selectedMembers.map(m => ({ memberId: m.memberId, role: 'member' as const }))
      )
      if (result.success) {
        const { added, failed } = result.data
        if (failed?.length > 0 && added?.length === 0) {
          toastError(`Failed to add ${failed.length} member${failed.length !== 1 ? 's' : ''}`)
        } else {
          toastSuccess(
            `${added?.length || selectedMembers.length} member${(added?.length || selectedMembers.length) !== 1 ? 's' : ''} added ✓`,
            failed?.length > 0 ? `${failed.length} could not be added` : undefined
          )
          onSuccess()
          onClose()
        }
      } else {
        toastError(result.message || 'Failed to add members')
      }
    } catch {
      toastError('that didn’t stick. try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const labelSt: React.CSSProperties = {
    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--ink-3)', display: 'block', marginBottom: 6,
  }
  const inputSt: React.CSSProperties = {
    width: '100%', padding: '10px 12px',
    background: 'var(--bg-2)', border: 'var(--hair-3)',
    borderRadius: 'var(--r-tight)', color: 'var(--ink)',
    fontFamily: 'var(--sans)', fontSize: 16, outline: 'none',
  }

  return (
    <Portal>
    <AnimatePresence>
      {isOpen && (
    <motion.div
      role="presentation"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={modalBackdropTransition}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 16px' }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Add members"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        transition={modalPanelTransition}
        style={{ width: '100%', maxWidth: 500, background: 'var(--card)', borderRadius: 'var(--r-outer)', border: 'var(--hair-2)', boxShadow: 'var(--lift-4)', maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none' }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20 }}>{subTeam ? `add to ${subTeam.name}` : 'add members'}</div>
          {/* Was unlabelled ("multiplication x") and measured 34x34. */}
          <button onClick={onClose} aria-label="Close" title="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1, padding: 0, minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '-8px', borderRadius: 'var(--r-tight)' }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
          {/* Search */}
          <Field label="Search members" labelStyle={labelSt} style={{ marginBottom: 12 }}>
            {id => (
            <div style={{ position: 'relative' }}>
              <input
                id={id}
                ref={searchInputRef}
                style={inputSt}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Name or email…"
                autoComplete="off"
              />
              {isSearching && (
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>...</span>
              )}
            </div>
            )}
          </Field>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div style={{ border: 'var(--hair-2)', borderRadius: 'var(--r-tight)', background: 'var(--bg-3)', marginBottom: 16, overflow: 'hidden' }}>
              {searchResults.map(member => (
                <button
                  key={member.memberId}
                  onClick={() => handleAddToSelection(member)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="avatar" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0, background: hashColor(member.fullName), overflow: 'hidden' }}>
                    {member.avatarUrl
                      ? <Img ctx="avatar" src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                      : getInitials(member.fullName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.fullName}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.classGrade || ''}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--welfare-ink)', fontWeight: 700 }}>+ add</span>
                </button>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>No members found for "{searchQuery}"</p>
          )}

          {/* Selected members */}
          {selectedMembers.length > 0 && (
            <div>
              <label style={{ ...labelSt, marginBottom: 10 }}>
                Selected ({selectedMembers.length}) - tap role to toggle
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedMembers.map(member => (
                  <div
                    key={member.memberId}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'color-mix(in srgb, var(--welfare) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--welfare) 26%, transparent)', borderRadius: 'var(--r-tight)' }}
                  >
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 12, flexShrink: 0, background: hashColor(member.fullName), overflow: 'hidden' }}>
                      {member.avatarUrl
                        ? <Img ctx="avatar" src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        : getInitials(member.fullName)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.fullName}</div>
                    </div>
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => handleRemoveFromSelection(member.memberId)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16, padding: 0, minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-tight)', lineHeight: 1, flexShrink: 0, transition: 'color 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}
                      aria-label={`Remove ${member.fullName}`}
                      title={`Remove ${member.fullName}`}
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedMembers.length === 0 && searchQuery.length < 2 && (
            <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
              Search by name or email to find members to add.
            </p>
          )}
        </div>

        {/* Sticky footer with Save button */}
        <div style={{ padding: '14px 24px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))', borderTop: 'var(--hair)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn" style={{ flex: 1, justifyContent: 'center' }} disabled={isSubmitting}>
            cancel
          </button>
          {/* §11.9 state 11 */}
          <GatedButton
            onClick={handleSave}
            disabled={isSubmitting}
            reason={selectedMembers.length === 0 ? 'pick at least one member.' : null}
            className="btn btn-primary"
            style={{ flex: 2, justifyContent: 'center' }}
          >
            {isSubmitting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                saving…
              </span>
            ) : selectedMembers.length > 0
              ? `save ${selectedMembers.length} member${selectedMembers.length !== 1 ? 's' : ''} →`
              : 'save members →'
            }
          </GatedButton>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
    </Portal>
  )
}

export default AddMemberModal
