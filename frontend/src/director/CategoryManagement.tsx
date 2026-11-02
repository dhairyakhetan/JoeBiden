import Img from '../components/Img'
import { useState, useEffect, useMemo } from 'react'
import directorService, { Director, ScopeAssignments, ScopeTeam } from '../services/directorService'
import { useAuth } from '../auth/AuthContext'
import {
  AdminLayout, AdminTabHeader, DataToolbar, EmptyLedger,
  AdminSkeleton, AdminErrorState,
} from './adminKit'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import '../styles/routes/director-people.css'
import { isSuperAdmin as isSuperAdminRole } from '../lib/roles'

const initials = (name: string) => (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)

const CategoryManagement = () => {
  const { member } = useAuth()
  const confirm = useConfirm()
  const toast = useToast()
  const isSuperAdmin = isSuperAdminRole(member?.role)

  const [directors, setDirectors] = useState<Director[]>([])
  // Team scopes. Loaded on their own so a failure here never takes the
  // HoD list down with it.
  const [scopeTeams, setScopeTeams] = useState<ScopeTeam[]>([])
  const [scopeAssignments, setScopeAssignments] = useState<ScopeAssignments>({})
  const [scopeError, setScopeError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedDirector, setSelectedDirector] = useState<number | null>(null)
  // Per-assignment busy keys (`memberId:category`) - deliberately NOT one
  // desk-wide `isAssigning` flag, which used to freeze every other HoD's
  // chips while a single assignment was in flight.
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const isBusy = (memberId: number, cat: string) => busy.has(`${memberId}:${cat}`)
  const setBusyKey = (key: string, on: boolean) => setBusy(prev => {
    const next = new Set(prev)
    if (on) next.add(key); else next.delete(key)
    return next
  })

  const fetchData = async () => {
    setLoadError(null)
    try {
      const directorsRes = await directorService.getAllDirectors()
      if (directorsRes.success) setDirectors(directorsRes.data.directors)
    } catch (err: any) {
      const msg = err?.message || err?.error_description || JSON.stringify(err)
      setLoadError(msg)
      toast.error('moderators didn’t load.', msg)
    }
    finally { setIsLoading(false) }
    try {
      const scopesRes = await directorService.getScopeAssignments()
      if (scopesRes.success) { setScopeTeams(scopesRes.data.teams); setScopeAssignments(scopesRes.data.assignments); setScopeError(null) }
    } catch (err: any) {
      setScopeError(err?.message || 'could not load team assignments')
    }
  }

  useEffect(() => { fetchData() }, [])

  const teamName = (teamId: number) => scopeTeams.find(t => t.teamId === teamId)?.name || 'Team'
  // Per-director team ids, derived from the one scopes read.
  const teamsByMember = useMemo(() => {
    const m = new Map<number, number[]>()
    for (const [teamId, people] of Object.entries(scopeAssignments)) {
      for (const person of people) m.set(person.memberId, [...(m.get(person.memberId) ?? []), Number(teamId)])
    }
    return m
  }, [scopeAssignments])

  const handleAssignTeam = async (memberId: number, teamId: number) => {
    const key = `${memberId}:team:${teamId}`
    setBusyKey(key, true)
    try {
      const result = await directorService.assignScope(memberId, teamId)
      if (result.success) { toast.success(`Assigned ${teamName(teamId)}`); await fetchData() }
    } catch (e: any) {
      toast.error('couldn’t assign that team.', e?.message ?? 'try again.')
    }
    finally { setBusyKey(key, false); setSelectedDirector(null) }
  }

  const handleUnassignTeam = async (memberId: number, teamId: number) => {
    if (!(await confirm({ title: 'Remove team assignment?', body: `Remove ${teamName(teamId)} from this HoD? They stop moderating posts tagged to that team.`, confirmLabel: 'Remove', danger: true }))) return
    const key = `${memberId}:team:${teamId}`
    setBusyKey(key, true)
    try {
      const result = await directorService.unassignScope(memberId, teamId)
      if (result.success) { toast.success(`Removed ${teamName(teamId)} assignment`); await fetchData() }
    } catch (e: any) {
      toast.error('couldn’t remove that team.', e?.message ?? 'try again.')
    }
    finally { setBusyKey(key, false) }
  }

  const visibleDirectors = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return directors
    return directors.filter(d =>
      d.fullName.toLowerCase().includes(term) ||
      d.email.toLowerCase().includes(term) ||
      (teamsByMember.get(d.memberId) ?? []).some(id => teamName(id).toLowerCase().includes(term)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teamName reads scopeTeams
  }, [directors, search, teamsByMember, scopeTeams])

  return (
    <AdminLayout>
      <div style={{ paddingBottom: 64, maxWidth: 860 }}>
        <AdminTabHeader
          label="Moderation"
          title="Who moderates which team"
          subtitle={isSuperAdmin ? 'Assign HoDs to the teams whose posts they moderate. A HoD with no team sees the whole queue.' : 'View your team assignments (only a super admin or HR changes them).'}
        />

        <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search HoD, email or team…" />

        {isLoading ? (
          <AdminSkeleton rows={4} />
        ) : loadError ? (
          <AdminErrorState message={`Could not load HoDs - ${loadError}`} onRetry={() => { setIsLoading(true); fetchData() }} />
        ) : (
          <>
            {/* Directors list */}
            <div className="card" style={{ marginBottom: 16, padding: 0 }}>
              <div className="panel-h">
                <b>HoDs &amp; assignments</b>
                <span className="mono xs muted adm-nums">{visibleDirectors.length} {visibleDirectors.length === 1 ? 'HoD' : 'HoDs'}</span>
              </div>
              {visibleDirectors.length === 0 ? (
                <EmptyLedger
                  message={search ? 'nothing matches that search' : 'no HoDs found'}
                  sub={search ? 'Try a different name, email or team.' : 'HoDs you can assign to teams will appear here.'}
                />
              ) : visibleDirectors.map(director => (
                <div key={director.memberId} className="cat-row">
                  <div className="cat-row-top">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div className="people-av" style={{ width: 36, height: 36, fontSize: 12, background: 'var(--accent)' }} aria-hidden>
                        {director.avatarUrl ? <Img ctx="avatar" src={director.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initials(director.fullName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>{director.fullName}</div>
                        <div className="mdir-line">{director.email}</div>
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <button onClick={() => setSelectedDirector(selectedDirector === director.memberId ? null : director.memberId)}
                        className="btn btn-sm" style={{ fontSize: 11 }}
                        aria-expanded={selectedDirector === director.memberId}>
                        {selectedDirector === director.memberId ? 'Cancel' : '+ Assign'}
                      </button>
                    )}
                  </div>

                  {/* Teams this HoD moderates (director_scopes). */}
                  {/* A plain HoD only reads their OWN scope rows (RLS), so for every
                      other HoD "no teams" would be a lie: say it for HR / super
                      admin, and for the viewer's own row. */}
                  {(teamsByMember.get(director.memberId) ?? []).length === 0 && (isSuperAdmin || director.memberId === member?.member_id) && (
                    <span className="cat-none">No teams assigned: sees the whole queue</span>
                  )}
                  {(teamsByMember.get(director.memberId) ?? []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {(teamsByMember.get(director.memberId) ?? []).map(teamId => {
                        const rowBusy = isBusy(director.memberId, `team:${teamId}`)
                        return (
                          <span key={teamId} className="cat-sticker" style={{ ['--cc' as any]: 'var(--accent)' }} aria-busy={rowBusy || undefined}>
                            {teamName(teamId)}
                            {isSuperAdmin && (
                              <button
                                className="cat-sticker-x"
                                onClick={() => handleUnassignTeam(director.memberId, teamId)}
                                disabled={rowBusy}
                                aria-label={`Remove ${teamName(teamId)} team assignment`}
                              >{rowBusy ? '…' : '✕'}</button>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Assign tray */}
                  {selectedDirector === director.memberId && (
                    <div className="cat-tray">
                      {scopeTeams.length > 0 && (
                        <>
                          <div className="cat-tray-label">Select a team to assign</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {scopeTeams.filter(t => !(teamsByMember.get(director.memberId) ?? []).includes(t.teamId)).map(t => {
                              const rowBusy = isBusy(director.memberId, `team:${t.teamId}`)
                              return (
                                <button key={t.teamId} onClick={() => handleAssignTeam(director.memberId, t.teamId)} disabled={rowBusy}
                                  className="cat-pick" style={{ ['--cc' as any]: 'var(--accent)' }}>
                                  <span className="adm-swatch" style={{ ['--sw' as any]: 'var(--accent)' }} aria-hidden />
                                  {rowBusy ? 'assigning…' : t.name}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                      {scopeError && <div className="cat-none" style={{ marginTop: 8 }}>Teams could not be loaded: {scopeError}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Teams overview. A plain HoD only reads their own scope rows (RLS), so
                the per-team "No HoDs" state would lie for them: super admin and HR only. */}
            {isSuperAdmin && scopeTeams.length > 0 && (
              <div className="card" style={{ padding: 0, marginBottom: 16 }}>
                <div className="panel-h"><b>teams overview</b><span className="mono xs muted adm-nums">{scopeTeams.length} teams</span></div>
                <div className="adm-grid cat-grid" style={{ padding: '16px 18px' }}>
                  {scopeTeams.map(t => {
                    const people = scopeAssignments[t.teamId] ?? []
                    return (
                      <div key={t.teamId} className="cat-card" style={{ ['--cc' as any]: 'var(--accent)' }}>
                        <div className="cat-card-head">{t.name}</div>
                        {people.length === 0 ? (
                          <p className="cat-none" style={{ margin: 0 }}>No HoDs</p>
                        ) : people.map(person => (
                          <div key={person.memberId} className="cat-hod">
                            <div className="people-av" style={{ width: 24, height: 24, fontSize: 9, background: 'var(--accent)' }} aria-hidden>
                              {person.avatarUrl ? <Img ctx="avatar" src={person.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initials(person.fullName)}
                            </div>
                            <span className="cat-hod-name">{person.fullName}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </>
        )}
      </div>
    </AdminLayout>
  )
}

export default CategoryManagement
