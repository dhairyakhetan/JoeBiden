import './CreateTeamPostModal.css'
import { useState, useMemo, useEffect } from 'react'
import Modal from '../components/Modal'
import TextArea from '../components/TextArea'
import Button from '../components/Button'
import Avatar from '../components/Avatar'
import Input from '../components/Input'
import teamService, { TeamMember, SubTeam } from '../services/teamService'
import { getRoleLabel } from '../lib/roles'
import { categories } from '../feed/CategoryFilter'
import { useToast } from '../components/Toast'
import Field from '../components/Field'

interface CreateTeamPostModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  teamUuid: string
  teamName: string
  teamCategory: string
  members: TeamMember[]
}

const CreateTeamPostModal = ({
  isOpen,
  onClose,
  onSuccess,
  teamUuid,
  teamName,
  teamCategory,
  members
}: CreateTeamPostModalProps) => {
  const toast = useToast()
  const [category, setCategory] = useState(teamCategory)
  const [body, setBody] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Optional sub-department tag (e.g. "Instagram" within Social Media) — only
  // shown when the team actually has sub-teams (sub_teams_hierarchy_2026_09_17.sql).
  const [subTeams, setSubTeams] = useState<SubTeam[]>([])
  const [selectedSubTeamUuid, setSelectedSubTeamUuid] = useState('')

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    teamService.getSubTeams(teamUuid).then(st => { if (!cancelled) setSubTeams(st) }).catch(() => {})
    return () => { cancelled = true }
  }, [isOpen, teamUuid])

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members
    const query = memberSearch.toLowerCase()
    return members.filter(m =>
      m.fullName.toLowerCase().includes(query) ||
      // email is no longer fetched on public team reads (getTeam) — guard so
      // searching never trips on undefined. Name search remains the useful path.
      (m.email ?? '').toLowerCase().includes(query)
    )
  }, [members, memberSearch])

  const allSelected = members.length > 0 && selectedMemberIds.length === members.length

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedMemberIds([])
    } else {
      setSelectedMemberIds(members.map(m => m.memberId))
    }
  }

  const handleToggleMember = (memberId: number) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  const handleSubmit = async () => {
    if (!body.trim()) {
      setError('write something first.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const result = await teamService.createTeamPost(teamUuid, {
        category,
        body: body.trim(),
        taggedMemberIds: selectedMemberIds,
        subTeamUuid: selectedSubTeamUuid || undefined
      })

      if (result.success) {
        toast.success('Post created')
        onSuccess()
        handleClose()
      } else {
        setError(result.message || 'post didn’t save. your text is still here.')
      }
    } catch (err: any) {
      // Services throw plain Errors (no Axios in the request path) - read
      // err.message, not the legacy err.response?.data?.message shape.
      setError('An error occurred while creating the post')
      toast.error('post didn’t save. your text is still here.')
      console.error('Create team post error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setBody('')
    setCategory(teamCategory)
    setSelectedMemberIds([])
    setMemberSearch('')
    setSelectedSubTeamUuid('')
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Create Post for ${teamName}`} size="lg" fullScreenMobile>
      <div className="ctp-shell">
        {/* Scrollable Content */}
        <div className="ctp-body">
          {error && (
            <div role="alert" className="ctp-error">
              {error}
            </div>
          )}

          {/* Category Selector */}
          <Field label="Category" labelClassName="ctp-caption">
            {id => (
              <select
                id={id}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="ctp-select"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {/* Sub-department tag — only when this team actually has sub-teams. */}
          {subTeams.length > 0 && (
            <Field label="Sub-team (optional)" labelClassName="ctp-caption">
              {id => (
                <select
                  id={id}
                  value={selectedSubTeamUuid}
                  onChange={(e) => setSelectedSubTeamUuid(e.target.value)}
                  className="ctp-select"
                >
                  <option value="">None</option>
                  {subTeams.map((st) => (
                    <option key={st.uuid} value={st.uuid}>{st.name}</option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {/* Post Body */}
          <TextArea
            label="Post Content"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your post..."
            rows={4}
            required
          />

          {/* Member Selection — checkbox list; each row is its own wrapping
              <label>, so this caption names the group instead. */}
          <div role="group" aria-labelledby="ctp-tag-cap">
            <div className="ctp-tag-head">
              <span id="ctp-tag-cap" className="ctp-caption">
                Tag Members ({selectedMemberIds.length} selected)
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="ctp-selectall"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Member Search */}
            {/* Placeholder-only before: Input renders a <label> only when the
                `label` prop is passed, and none was. `aria-label` names it
                without rendering a second visible label the picker doesn't have. */}
            <Input
              aria-label="Search members"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members..."
              className="ctp-search"
            />

            {/* Member List */}
            <div className="ctp-list">
              {filteredMembers.length === 0 ? (
                <p className="ctp-empty">
                  {memberSearch ? 'No members found' : 'No team members'}
                </p>
              ) : (
                filteredMembers.map((member) => (
                  <label
                    key={member.memberId}
                    className="ctp-row"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(member.memberId)}
                      onChange={() => handleToggleMember(member.memberId)}
                      className="ctp-check"
                    />
                    <Avatar
                      src={member.avatarUrl}
                      name={member.fullName}
                      size="sm"
                    />
                    <div className="ctp-row-main">
                      <p className="ctp-name">{member.fullName}</p>
                      <p className="ctp-role">{getRoleLabel(member.orgRole)}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Fixed Footer - Outside scrollable area */}
        <div className="ctp-foot">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={isSubmitting}
            /* Was `!body.trim()`, which made handleSubmit's own
               setError('write something first.') into the role="alert" banner
               unreachable: a dead button and no explanation. */
            disabled={isSubmitting}
           
          >
            Create Post
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default CreateTeamPostModal
