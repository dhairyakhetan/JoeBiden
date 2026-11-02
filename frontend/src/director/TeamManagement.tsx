import { orderTeamsAsTree } from '../lib/teamOrder'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import teamService from '../services/teamService'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { useToast } from '../components/Toast'
import Img from '../components/Img'
import { I } from '../components/v6Shared'
import {
  useModalA11y,
  AdminLayout, AdminTabHeader, DataToolbar, EmptyLedger, FilterPill,
  AdminSkeleton, AdminErrorState, AdminRow, AdminRowActions, StatusStamp,
} from './adminKit'
import { checkText, BLOCK_MESSAGE } from '../lib/profanityFilter'
import '../styles/routes/director-people.css'
import './ProjectModal.css'
import { ImageUploadZone } from './ProjectManagerShared'
import { CAT_COLORS, count } from '../lib/uiHelpers'
import Field from '../components/Field'
import { CATEGORY_SLUGS } from '../lib/categories'
import { useConfirm } from '../components/Confirm'
import { useAuth } from '../auth/AuthContext'
import { isSuperAdmin as isSuperAdminRole } from '../lib/roles'
import { PencilSquareIcon, TrashIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

// Was hardcoded independently here and in directorService.ts's
// getCategoryAssignments(), the two silently drifting out of sync with
// each other. Both now import the one canonical list from lib/categories.ts.
const CATEGORIES: readonly string[] = CATEGORY_SLUGS

/** Toast title for the half-failed create: the team row is in, the creator's own
 *  membership is not. */
const createdButNotJoinedMessage = (teamName: string) =>
  `${teamName} was created, but we couldn’t add you to it.`

type Team = { uuid: string; name: string; category: string; description: string; memberCount: number; logoUrl?: string; bannerUrl?: string }


// ── Team form modal ──────────────────────────────────────────────────────────
function TeamFormModal({
  team,
  onClose,
  onSaved,
}: {
  team: Team | null   // null = creating new
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !team
  const [name, setName]       = useState(team?.name || '')
  const [desc, setDesc]       = useState(team?.description || '')
  // Categories are retired from the form, but teams.category is NOT NULL with a
  // CHECK on the five legacy values, so keep the existing value on edit and use
  // the old default on create. Never shown, never editable here.
  const cat = team?.category || 'welfare'
  const [saving, setSaving]   = useState(false)
  // The team picture. Only sent on save when it differs from what loaded, so
  // saving a rename never rewrites (or clears) a picture someone else set.
  const [banner, setBanner]   = useState<string | null>(team?.bannerUrl || null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const { success, error: toastError } = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  useModalA11y(true, panelRef, onClose, saving)

  const accent = CAT_COLORS[cat] || 'var(--welfare)'
  const labelSt: React.CSSProperties = {
    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    color: 'var(--ink-3)', display: 'block', marginBottom: 6,
  }
  // Width/type only - surface, border, radius come from the desk's shared
  // `.input`/`.textarea` rules (3px ink border, brutalist), not inline styles.
  const inputSt: React.CSSProperties = {
    width: '100%', fontFamily: 'var(--sans)', fontSize: 14,
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Team name is required'); return }
    // Teams publish immediately with no review queue - both tiers hard-block.
    if ((await checkText(name)).severity !== 'clean' || (await checkText(desc)).severity !== 'clean') {
      setError(BLOCK_MESSAGE); toastError(BLOCK_MESSAGE); return
    }
    setSaving(true); setError(null)
    try {
      if (isNew) {
        const result = await teamService.createTeam({ name: name.trim(), description: desc.trim(), category: cat })
        // The legacy "mirror to public Supabase project" write that lived
        // here is gone - TeamsPage and teamService both already read
        // from supabaseCommunity, so the second project was just an
        // orphan write nobody consumed. See audit dated 2026-05.
        if (result.success) {
          // Auto-add the creator to the roster. 'lead' retired 2026-09-15
          // (owner decision: directors/HoDs are the only leadership tier,
          // team-scoped or otherwise) - the creator is already a director/HoD
          // to have reached this desk at all, so a plain 'member' row here
          // grants nothing extra and loses nothing.
          //
          // From here the team EXISTS. If adding the creator fails we must not
          // say "could not create team" (a retry would make a duplicate), so
          // this step has its own catch, reports the real state, and closes the
          // form instead of leaving Create armed.
          try {
            const { data: { session } } = await supabaseCommunity.auth.getSession()
            if (session?.user) {
              // get_own_member() (SECURITY DEFINER RPC), not a raw
              // `.eq('auth_uid', ...)` filter - `authenticated` lost SELECT on
              // members.auth_uid (scripts/members_pii_lockdown_stage2_revoke.sql).
              const { data: creatorMember } = await supabaseCommunity
                .rpc('get_own_member' as never)
                .maybeSingle()

              if (creatorMember) {
                const { data: newTeam } = await supabaseCommunity
                  .from('teams')
                  .select('team_id')
                  .eq('uuid', result.data.team.uuid)
                  .single()

                if (newTeam?.team_id) {
                  await supabaseCommunity
                    .from('team_members')
                    .insert({
                      team_id: newTeam.team_id,
                      member_id: (creatorMember as any).member_id,
                      role: 'member',
                      is_active: true,
                    })
                    .throwOnError()
                }
              }
            }
          } catch (addErr: any) {
            toastError(
              createdButNotJoinedMessage(name.trim()),
              (addErr?.message || 'adding you to it failed.') + ' Open the team to add yourself.',
            )
            onSaved(); onClose()
            return
          }
        }
      } else {
        const bannerChanged = banner !== (team.bannerUrl || null)
        await teamService.updateTeam(team.uuid, {
          name: name.trim(), description: desc.trim(), category: cat,
          ...(bannerChanged ? { bannerUrl: banner } : {}),
        })
      }
      success(isNew ? 'Team created' : 'Team updated')
      onSaved(); onClose()
    } catch (e: any) {
      const msg = e?.message || 'Failed to save team'
      setError(msg); toastError(isNew ? 'Could not create team' : 'Could not update team', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      {/* `overflow: hidden` with no max-height clipped the panel to whatever
          the viewport allowed and gave it nowhere to scroll, so on a phone in
          landscape (667x375) or any viewport under ~600px tall the save and
          cancel buttons were cut off and unreachable - the only escape was
          Escape or the scrim, both of which discard the form. The panel is now
          capped at the viewport with its body scrolling inside, and the
          coloured header stays put while it does. */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={isNew ? 'New team' : 'Edit team'} onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 520, maxHeight: 'calc(100dvh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        {/* Colored header */}
        <div style={{ background: accent, padding: '20px 24px', color: '#0A0A0A', flex: 'none' }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 22 }}>
            {isNew ? 'new team' : `edit · ${team.name}`}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 2, opacity: 0.7 }}>
            {isNew ? 'fill in the details and create' : 'update team info'}
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {error && (
            <div role="alert" className="adm-alert">
              <ExclamationCircleIcon strokeWidth={1.8} aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <Field label="Team name" required labelStyle={labelSt}>
            {id => (
              <input
                id={id}
                className="input"
                style={{ ...inputSt, fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16 }}
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Welfare Team"
                maxLength={60}
              />
            )}
          </Field>

          {/* Description */}
          <Field label={<>Description <span style={{ opacity: 0.5, fontWeight: 400 }}>(shown on team page)</span></>} labelStyle={labelSt}>
            {id => (
              <>
                <textarea
                  id={id}
                  className="textarea"
                  style={{ ...inputSt, minHeight: 100, resize: 'vertical' }}
                  value={desc} onChange={e => setDesc(e.target.value)}
                  placeholder="What does this team do? What's the vibe? What should people know before joining?"
                  maxLength={500}
                />
                <div style={{ fontFamily: 'var(--code)', fontSize: 10, color: desc.length > 450 ? 'var(--rust)' : 'var(--ink-3)', textAlign: 'right', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  {desc.length}/500
                </div>
              </>
            )}
          </Field>

          {/* Team picture. Edit only: a new team has no row to attach it to
              until it is created, and it can be added right after. */}
          {!isNew && (
            <ImageUploadZone
              value={banner}
              alt={`${team.name} team picture`}
              onUrlChange={setBanner}
              onUploadingChange={setUploading}
              label="Team picture"
              hint="Shown on the Teams page and this team's page. JPG, PNG or WebP, under 5 MB."
              compact
            />
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button
              className="btn btn-primary btn-sm"
              style={{ flex: 1, justifyContent: 'center', background: accent, color: '#0A0A0A', borderRadius: 999, minHeight: 46, whiteSpace: 'nowrap' }}
              disabled={saving || uploading || !name.trim()}
              onClick={handleSave}
            >
              {saving ? 'saving…' : uploading ? 'uploading picture…' : isNew ? '✓ create team' : '✓ save changes'}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={saving} style={{ borderRadius: 999, minHeight: 46, whiteSpace: 'nowrap' }}>cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TeamManagement() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [editing, setEditing] = useState<Team | null | 'new'>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const confirm = useConfirm()
  const { success, error: toastError } = useToast()
  const { member: currentMember } = useAuth()
  // Deleting a team is a hard delete (members, scopes pointing at it go too), so
  // it is super admin / HR only in the UI. Mirrors who should hold the power.
  const canDeleteTeam = isSuperAdminRole(currentMember?.role)

  // CLAUDE.md's strict convention: every destructive action goes through the
  // shared `useConfirm()`. This desk used to hand-roll its own delete dialog -
  // a second confirm implementation. `holdMs` is kept: Confirm.tsx's own
  // docstring names delete-a-team as one of exactly three hold call sites.
  const handleDeleteTeam = async (team: Team) => {
    if (!canDeleteTeam) { toastError('only a super admin or HR can delete a team.'); return }
    const ok = await confirm({
      title: 'delete team?',
      body: `This permanently deletes ${team.name}. Everyone is taken off its roster, and any HoD scope that points at this team is removed too. This cannot be undone. Posts are not deleted.`,
      confirmLabel: 'delete it',
      danger: true,
      holdMs: 1200,
    })
    if (!ok) return
    setDeletingId(team.uuid)
    try {
      await teamService.deleteTeam(team.uuid)
      success('Team deleted')
      fetchTeams()
    } catch (e: any) {
      toastError('couldn’t delete the team.', e?.message || 'Failed to delete team')
    } finally {
      setDeletingId(null)
    }
  }

  const fetchTeams = async () => {
    setLoading(true); setError(null)
    try {
      const result = await teamService.getTeams({ limit: 100 })
      if (result.success) setTeams(result.data || [])
      else setError('Failed to load teams')
    } catch (e: any) {
      setError(`Could not load teams - ${e?.message || String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTeams() }, [])

  const filtered = teams.filter(t => {
    const matchCat = catFilter === 'all' || t.category === catFilter
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <AdminLayout>
      <div style={{ paddingBottom: 80 }}>
        <AdminTabHeader
          label="Teams"
          title="Team management"
          count={teams.length}
          subtitle="Create and edit the org's teams."
          actions={
            <button className="btn btn-sm btn-primary" onClick={() => setEditing('new')}>
              <I.plus /> Create team
            </button>
          }
        />

      {/* One toolbar - search + category filters (was a hand-rolled search box
          plus a loose chip row). */}
      <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search teams…">
        <div className="adm-hscroll">
          {['all', ...CATEGORIES].map(c => (
            <FilterPill key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>
              {c !== 'all' && (
                <span className="adm-swatch" style={{ ['--sw' as any]: CAT_COLORS[c] || 'var(--welfare)' }} aria-hidden />
              )}
              {c}
            </FilterPill>
          ))}
        </div>
      </DataToolbar>

      {/* Team list */}
      {loading ? (
        <AdminSkeleton rows={4} />
      ) : error ? (
        <AdminErrorState message={error} onRetry={fetchTeams} />
      ) : filtered.length === 0 ? (
        <>
          <EmptyLedger
            message={search ? 'no matches' : 'no teams yet'}
            sub={search ? 'Try a different search term.' : 'Create the first team to get started.'}
          />
          {!search && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
                <I.plus /> Create first team
              </button>
            </div>
          )}
        </>
      ) : (
        orderTeamsAsTree(filtered).map(({ team, insideName }) => {
          const accent = CAT_COLORS[team.category] || 'var(--welfare)'
          return (
            <AdminRow
              key={team.uuid}
              stamp={<StatusStamp label={team.category} tone="custom" color={accent} />}
              primary={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div className="adm-avatar is-square" aria-hidden>
                    {team.logoUrl
                      ? <Img ctx="thumb" src={team.logoUrl} alt="" loading="lazy" />
                      : <div className="adm-avatar-fallback" style={{ background: accent }}>{team.name.slice(0, 2).toUpperCase()}</div>}
                  </div>
                  <span>{team.name}</span>
                </div>
              }
              secondary={(insideName ? `inside ${insideName} · ` : '') + (team.description || 'No description yet.')}
              meta={<span className="adm-nums">{count(team.memberCount || 0, 'member')}</span>}
              actions={
                <>
                  <button
                    className="adm-actpill"
                    onClick={() => navigate(`/teams/${team.uuid}`)}
                    title="View team page"
                    aria-label={`View ${team.name}`}
                  >
                    view
                  </button>
                  <AdminRowActions sheetTitle={team.name}>
                    <button className="adm-actpill" onClick={() => setEditing(team)} title="Edit team">
                      <PencilSquareIcon width={13} height={13} strokeWidth={2} aria-hidden /> edit
                    </button>
                    {canDeleteTeam && (
                      <button className="adm-actpill is-danger" disabled={deletingId === team.uuid} onClick={() => handleDeleteTeam(team)} title="Delete team">
                        <TrashIcon width={13} height={13} strokeWidth={2} aria-hidden /> {deletingId === team.uuid ? 'deleting…' : 'delete'}
                      </button>
                    )}
                  </AdminRowActions>
                </>
              }
            />
          )
        })
      )}

      {/* Modals */}
      {editing !== null && (
        <TeamFormModal
          team={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={fetchTeams}
        />
      )}
      </div>
    </AdminLayout>
  )
}
