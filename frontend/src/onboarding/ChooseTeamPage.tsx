import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { teamService } from '../services/teamService'
import { jobOpenings, JobOpening } from '../lib/jobOpenings'
import {
  DEPARTMENTS,
  Department,
  normDeptName,
  isDarkDepartmentFill,
} from '../lib/departments'
import { fadeInUp, staggerContainer, tapScale } from '../lib/motion'
import { useToast } from '../components/Toast'
import Skeleton from '../components/Skeleton'
import './ChooseTeam.css'

/**
 * "choose your team" — the post-APPROVAL nudge.
 *
 * WHEN: a member's first authenticated visit after a director flips their
 * `members.status` from `pending_approval` to `active`
 * (director/AccountApprovals.tsx -> directorService.approveMember). It is NOT
 * part of registration: /register only collects name/class/phone and its own
 * effect routes a pending member straight to /pending.
 *
 * IT IS A NUDGE, NOT A GATE. Skipping is a first-class action in the header,
 * the page is a normal route reachable again at any time, and nothing here is
 * reachable that the member could not already reach (/teams, /opportunities
 * and team_join_requests are all already open to an active member — the
 * gating below mirrors RLS exactly, it does not widen it).
 */

// ── "seen" marking ─────────────────────────────────────────────────────────
// Durable-first, with a localStorage mirror.
//
// There is NO existing column on `members` that means this (verified live
// 2026-09-07 against information_schema.columns — the row carries
// approved_at/last_login/join_reason and nothing about onboarding nudges), so
// scripts/members_team_nudge_seen_2026_09_07.sql adds
// `members.team_nudge_seen_at`. THAT MIGRATION HAS NOT BEEN RUN. Everything
// below feature-detects it: if the column is absent the durable write fails
// with 42703 (undefined_column) and we degrade to the localStorage flag alone,
// which is exactly the behaviour the existing OpeningPickerModal already has.
//
// Marking-as-seen is deliberately best-effort and does NOT toast: it is
// invisible bookkeeping around the member's real action, in the same spirit as
// notificationService.create(). The member-visible mutations on this page
// (ask-to-join) get the full pending / success / explicit-error treatment.
export const teamChoiceSeenKey = (memberUuid: string) => `aq_team_choice_seen_${memberUuid}`

type MemberLike = { uuid: string; status?: string | null; team_nudge_seen_at?: string | null } | null

export function shouldShowTeamChoiceNudge(member: MemberLike): boolean {
  if (!member || member.status !== 'active') return false
  // Durable marker wins when the column exists and is set.
  if (member.team_nudge_seen_at) return false
  try {
    return localStorage.getItem(teamChoiceSeenKey(member.uuid)) !== '1'
  } catch {
    // private mode — show it; a repeat nudge is better than a silent skip.
    return true
  }
}

export async function markTeamChoiceSeen(memberUuid: string): Promise<void> {
  try { localStorage.setItem(teamChoiceSeenKey(memberUuid), '1') } catch { /* private mode */ }
  try {
    const { error } = await (supabaseCommunity as any)
      .from('members')
      .update({ team_nudge_seen_at: new Date().toISOString() })
      .eq('uuid', memberUuid)
    // 42703 = column does not exist -> the migration has not been run yet.
    // Anything else is also non-fatal here; the local flag already covers it.
    if (error && error.code !== '42703') {
      console.warn('[ChooseTeam] durable seen-marker failed:', error.message)
    }
  } catch (e: any) {
    console.warn('[ChooseTeam] durable seen-marker threw:', e?.message)
  }
}

// ── department icons ───────────────────────────────────────────────────────
// One simple line icon per department, matching the codebase's existing inline
// currentColor SVG approach (components/v6Shared.tsx `I`). No new dependency,
// and deliberately NOT emoji — DESIGN.md forbids emoji-as-icons.
const S = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const DEPT_ICON: Record<string, ReactElement> = {
  // Events — a marquee/tent
  'Events': <svg {...S} aria-hidden><path d="M12 3v3" /><path d="M3 11c0-3.3 4-5 9-5s9 1.7 9 5" /><path d="M3 11h18v9H3z" /><path d="M9 20v-5h6v5" /></svg>,
  // Welfare Projects — a sprout
  'Welfare Projects': <svg {...S} aria-hidden><path d="M12 21v-8" /><path d="M12 13C12 9 9 7 5 7c0 4 3 6 7 6z" /><path d="M12 13c0-3 2.5-5 6-5 0 3-2.5 5-6 5z" /></svg>,
  // Social Media — a broadcast signal
  'Social Media': <svg {...S} aria-hidden><circle cx="12" cy="12" r="2.5" /><path d="M7.5 7.5a6.4 6.4 0 000 9" /><path d="M16.5 16.5a6.4 6.4 0 000-9" /><path d="M4.6 4.6a10.4 10.4 0 000 14.8" /><path d="M19.4 19.4a10.4 10.4 0 000-14.8" /></svg>,
  // Collabs — two linked rings
  'Collabs': <svg {...S} aria-hidden><circle cx="8.5" cy="12" r="4.5" /><circle cx="15.5" cy="12" r="4.5" /></svg>,
  // Crftd — a t-shirt
  'Crftd': <svg {...S} aria-hidden><path d="M8 4l-5 3 2.5 4L8 10v10h8V10l2.5 1L21 7l-5-3" /><path d="M8 4a4 4 0 008 0" /></svg>,
  // AQ.Ventures — an upward trajectory
  'AQ.Ventures': <svg {...S} aria-hidden><path d="M4 20L20 4" /><path d="M13 4h7v7" /><path d="M4 14l3 3" /><path d="M8 19l1.5 1.5" /></svg>,
  // ShikshAQ — an open book
  'ShikshAQ': <svg {...S} aria-hidden><path d="M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5" /><path d="M12 6.5C13.5 5 16 4.5 20 5v13c-4-.5-6.5 0-8 1.5" /><path d="M12 6.5v13" /></svg>,
  // Human Resources — people
  'Human Resources': <svg {...S} aria-hidden><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0111 0" /><path d="M16 5.6a3.2 3.2 0 010 4.8" /><path d="M17.5 14.4A5.5 5.5 0 0120.5 20" /></svg>,
}

// ── department <-> live team matching ──────────────────────────────────────
// `teams` rows carry a free-text name ("Welfare Team", "Socials"), not a
// foreign key into DEPARTMENTS, so match the way lib/departments.ts does
// internally: exact normalised name, then a word-boundary-safe prefix match
// (which is what pairs the live "Welfare Team" with "Welfare Projects").
interface LiveTeam { team_id: number; uuid: string; name: string }

function teamForDepartment(dept: Department, teams: LiveTeam[]): LiveTeam | undefined {
  const d = normDeptName(dept.name)
  const exact = teams.find(t => normDeptName(t.name) === d)
  if (exact) return exact
  return teams.find(t => {
    const n = normDeptName(t.name)
    return n.startsWith(d + ' ') || d.startsWith(n + ' ')
  })
}

// Openings are matched to a department by team_name first (the reliable
// signal when set), then by the department's `category`. Category is
// many-to-one across the eight departments, so it is a fallback only.
function openingsForDepartment(dept: Department, teams: LiveTeam[], open: JobOpening[]): JobOpening[] {
  const team = teamForDepartment(dept, teams)
  return open.filter(o => {
    if (o.teamName && team) return normDeptName(o.teamName) === normDeptName(team.name)
    if (o.teamName) return normDeptName(o.teamName) === normDeptName(dept.name)
    return o.category === dept.category
  })
}

type Membership = 'none' | 'member' | 'pending'

export default function ChooseTeamPage() {
  const { member, refreshMember } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const reduce = useReducedMotion()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [teams, setTeams] = useState<LiveTeam[]>([])
  const [openRoles, setOpenRoles] = useState<JobOpening[]>([])
  const [memberships, setMemberships] = useState<Record<number, Membership>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const memberUuid = member?.uuid
  const memberId = (member as any)?.member_id as number | undefined

  useEffect(() => {
    if (!memberId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([
      supabaseCommunity.from('teams').select('team_id, uuid, name').eq('is_active', true),
      jobOpenings.getOpen(),
      supabaseCommunity.from('team_members').select('team_id').eq('member_id', memberId).eq('is_active', true),
      // RLS: "Members can view their own join requests" (member_id =
      // get_current_member_id()). The .eq mirrors it rather than relying on it.
      supabaseCommunity.from('team_join_requests').select('team_id, status').eq('member_id', memberId).eq('status', 'pending'),
    ])
      .then(([teamsRes, open, mineRes, reqRes]) => {
        if (cancelled) return
        if (teamsRes.error) throw teamsRes.error
        const map: Record<number, Membership> = {}
        for (const r of (reqRes.data || []) as any[]) map[r.team_id] = 'pending'
        for (const r of (mineRes.data || []) as any[]) map[r.team_id] = 'member'
        setTeams((teamsRes.data || []) as LiveTeam[])
        setOpenRoles(open)
        setMemberships(map)
      })
      .catch((e: any) => {
        if (cancelled) return
        console.warn('[ChooseTeam] load failed', e)
        setLoadError("couldn't load the teams just now. check your connection and try again.")
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [memberId])

  const selectedDept = useMemo(
    () => DEPARTMENTS.find(d => d.name === selected) ?? null,
    [selected],
  )
  const selectedTeam = selectedDept ? teamForDepartment(selectedDept, teams) : undefined
  const selectedRoles = selectedDept ? openingsForDepartment(selectedDept, teams, openRoles) : []
  const selectedState: Membership = selectedTeam ? (memberships[selectedTeam.team_id] ?? 'none') : 'none'

  const skip = useCallback(async () => {
    if (memberUuid) await markTeamChoiceSeen(memberUuid)
    navigate('/', { replace: true })
  }, [memberUuid, navigate])

  /**
   * ASK TO JOIN — the real, existing mechanism.
   *
   * teamService.createJoinRequest() inserts a `team_join_requests` row (RLS:
   * member_id = get_current_member_id()) and notifies the team's leads. It does
   * NOT put the member on the roster: team_members INSERT is director/team-lead
   * only, and a lead or director has to approve the request
   * (teamService.approveJoinRequest). Nothing here fakes that.
   */
  const askToJoin = async () => {
    if (!selectedDept || !selectedTeam || submitting) return
    setSubmitting(true)
    setActionError(null)
    try {
      await teamService.createJoinRequest(selectedTeam.uuid, `Asked to join from the welcome screen.`)
      setMemberships(m => ({ ...m, [selectedTeam.team_id]: 'pending' }))
      toast.success('request sent', `${selectedDept.name}'s leads will see it. you can keep browsing.`)
      if (memberUuid) await markTeamChoiceSeen(memberUuid)
      // The member row itself changed (team_nudge_seen_at) — keep context fresh.
      void refreshMember()
    } catch (e: any) {
      const msg = e?.message || 'unknown error'
      setActionError(`couldn't send that request: ${msg}`)
      toast.error("couldn't send that request", msg)
    } finally {
      setSubmitting(false)
    }
  }

  const goToRole = async (id: string) => {
    if (memberUuid) await markTeamChoiceSeen(memberUuid)
    navigate(`/opportunities/${id}`)
  }

  const Wrapper = reduce ? 'div' : motion.div
  const wrapperProps = reduce ? {} : { variants: staggerContainer, initial: 'hidden', animate: 'show' }

  return (
    <div className="ctp route-enter">
      <div className="container">
        <section className="ctp-panel" aria-labelledby="ctp-title">
          <header className="ctp-head">
            <div>
              <p className="ctp-eyebrow">you&apos;re in</p>
              <h1 className="ctp-title" id="ctp-title">pick where you want to start.</h1>
            </div>
            <button type="button" className="ctp-skip" onClick={skip}>
              skip for now
            </button>
          </header>

          {loading ? (
            <div className="ctp-grid" aria-busy="true">
              <Skeleton variant="card" height={116} radius="var(--r-inner)" count={8} label="Loading teams…" />
            </div>
          ) : loadError ? (
            <p className="ctp-error" role="alert" style={{ padding: 14 }}>{loadError}</p>
          ) : (
            <Wrapper className="ctp-grid" {...(wrapperProps as any)}>
              {DEPARTMENTS.map(dept => {
                const dark = isDarkDepartmentFill(dept.color)
                const fg = dark ? 'var(--nav-fg)' : 'var(--ink)'
                const team = teamForDepartment(dept, teams)
                const state: Membership = team ? (memberships[team.team_id] ?? 'none') : 'none'
                const count = openingsForDepartment(dept, teams, openRoles).length
                const chipLabel =
                  state === 'member' ? "you're on this"
                    : state === 'pending' ? 'request pending'
                      : count > 0 ? `${count} open`
                        : dept.kind === 'business' ? 'student business' : 'volunteer team'
                const Tile = reduce ? 'button' : motion.button
                const tileProps = reduce ? {} : { variants: fadeInUp, whileTap: tapScale }
                return (
                  <Tile
                    key={dept.name}
                    type="button"
                    className="ctp-tile"
                    aria-pressed={selected === dept.name}
                    onClick={() => { setActionError(null); setSelected(dept.name) }}
                    style={{ background: dept.color, color: fg }}
                    {...(tileProps as any)}
                  >
                    <span className="ctp-tile-icon">{DEPT_ICON[dept.name]}</span>
                    <span>
                      <span className="ctp-tile-name" style={{ display: 'block', marginBottom: 6 }}>{dept.name}</span>
                      <span
                        className="ctp-tile-chip"
                        style={{
                          background: dark ? 'rgba(244,239,224,0.14)' : 'rgba(10,10,10,0.10)',
                          color: fg,
                        }}
                      >
                        {chipLabel}
                      </span>
                    </span>
                  </Tile>
                )
              })}
            </Wrapper>
          )}

          <p className="ctp-caption">
            {DEPARTMENTS.map(d => d.name.toLowerCase()).join(' · ')}
          </p>

          {/* ── the chosen department ───────────────────────────────── */}
          {selectedDept && (
            <div className="ctp-foot">
              <p className="ctp-foot-line">
                <strong>{selectedDept.name}</strong> — {selectedDept.desc.split('.')[0]}.
              </p>

              {selectedState === 'member' ? (
                <>
                  <p className="ctp-foot-note">you&apos;re already on this team.</p>
                  <button type="button" className="ctp-cta" onClick={() => selectedTeam && navigate(`/teams/${selectedTeam.uuid}`)}>
                    open the team →
                  </button>
                </>
              ) : selectedState === 'pending' ? (
                <p className="ctp-foot-note">your request is with this team&apos;s leads. they&apos;ll get back to you.</p>
              ) : selectedRoles.length > 0 ? (
                <>
                  <p className="ctp-foot-note">
                    {selectedRoles.length} open role{selectedRoles.length === 1 ? '' : 's'} here — open the brief to apply.
                  </p>
                  {selectedRoles.map(role => (
                    <button key={role.id} type="button" className="ctp-role" onClick={() => goToRole(role.id)}>
                      <span>
                        <span className="ctp-role-title" style={{ display: 'block' }}>{role.title}</span>
                        <span className="ctp-role-meta">{role.commitment || 'read the brief'}</span>
                      </span>
                      <span aria-hidden>→</span>
                    </button>
                  ))}
                </>
              ) : !selectedTeam ? (
                <p className="ctp-foot-note">
                  this one isn&apos;t set up to take requests yet — the HR team can point you at it.
                </p>
              ) : (
                <>
                  <p className="ctp-foot-note">
                    nothing is open here right now. ask to join and this team&apos;s leads will see it.
                  </p>
                  <button type="button" className="ctp-cta" onClick={askToJoin} disabled={submitting}>
                    {submitting ? 'sending…' : 'ask to join'}
                  </button>
                </>
              )}

              {actionError && <p className="ctp-error" role="alert">{actionError}</p>}
            </div>
          )}

          {/* ── all open hirings ────────────────────────────────────── */}
          <div className="ctp-band">
            <p className="ctp-band-title">open hirings</p>
            {loading ? (
              <Skeleton variant="line" height={44} radius="var(--r-tight)" count={2} label="Loading open roles…" />
            ) : openRoles.length === 0 ? (
              <>
                <p className="ctp-empty">
                  no roles are open right now. the eight teams above still take requests, and new
                  roles get posted on the openings page.
                </p>
                <button type="button" className="ctp-role" onClick={() => navigate('/opportunities')}>
                  <span className="ctp-role-title">see the openings page</span>
                  <span aria-hidden>→</span>
                </button>
              </>
            ) : (
              <>
                {openRoles.map(role => (
                  <button key={role.id} type="button" className="ctp-role" onClick={() => goToRole(role.id)}>
                    <span>
                      <span className="ctp-role-title" style={{ display: 'block' }}>{role.title}</span>
                      <span className="ctp-role-meta">
                        {role.teamName ? role.teamName : role.category}
                        {role.commitment ? ` · ${role.commitment}` : ''}
                      </span>
                    </span>
                    <span aria-hidden>→</span>
                  </button>
                ))}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
