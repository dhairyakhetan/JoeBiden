// ─────────────────────────────────────────────────────────────────────────
// Fabricates the ONE thing a guided demo needs before a single real screen
// will mount: a plain object shaped like a members row, and a plain object
// shaped like a Supabase session. Neither ever touches supabase.auth - see
// changelog/19-guided-demos.md §19.1 rule 2: "The provider never calls
// supabase.auth. It supplies a plain object shaped like a member."
//
// The session's access/refresh tokens are deliberately NOT valid JWTs - see
// demoShadow.ts's header for why that is a real second safety layer, not
// just flavour text.
// ─────────────────────────────────────────────────────────────────────────
import type { Database } from '../../lib/database.types'

export type Member = Database['public']['Tables']['members']['Row']

/** Every uuid/id below lives in this one fixed namespace so a stray real
 *  query for one of them (should the shadow ever miss a call shape) can
 *  never coincide with a real row. */
export const DEMO_AUTH_UID = '00000000-0000-4000-8000-00000000d3d0'

let memberSeq = 900000

export interface FakeMemberOptions {
  fullName: string
  role: Member['role']
  classGrade?: string | null
  avatarUrl?: string | null
  bio?: string | null
}

/** A fully-formed `members` row - every column the live schema actually has
 *  (lib/database.types.ts), not the older subset lib/devPreview.ts uses,
 *  since that helper predates several columns and casts through `unknown`
 *  to paper over the gap. This one is a real, complete Member with no cast. */
export function buildFakeMember(opts: FakeMemberOptions): Member {
  const now = new Date().toISOString()
  const memberId = memberSeq++
  return {
    member_id: memberId,
    member_no: memberId,
    uuid: `00000000-0000-4000-9000-${String(memberId).padStart(12, '0')}`,
    auth_uid: DEMO_AUTH_UID,
    google_id: null,
    email: 'demo@example.invalid',
    full_name: opts.fullName,
    avatar_url: opts.avatarUrl ?? null,
    class_grade: opts.classGrade ?? '11',
    contacted_at: null,
    phone: null,
    join_reason: null,
    role: opts.role,
    status: 'active',
    rejection_note: null,
    approved_by: null,
    approved_at: now,
    last_login: now,
    is_active: true,
    created_at: now,
    updated_at: now,
    bio: opts.bio ?? null,
    school_id: null,
    birthday: null,
    birthday_public: false,
    break_start: null,
    break_end: null,
    break_reason: null,
    instagram: null,
    linkedin: null,
    referred_by: null,
    // Six columns this builder had drifted behind on. They were invisible until
    // lib/database.types.ts was regenerated against the live schema on
    // 2026-09-12 - the stale types had no idea these existed, so "a fully-formed
    // members row with no cast" was quietly incomplete, which is exactly the
    // thing this function's own comment promises it is not.
    guardian_phone: null,
    last_birthday_notice_year: null,
    profile_nudge_dismiss_count: 0,
    profile_nudge_snoozed_until: null,
    team_nudge_seen_at: null,
    // Three more columns from the same drift class as the comment above —
    // added by the removed-account self-service-appeal feature. A demo
    // member is never a removed account, so all three are the "not removed" state.
    deleted_at: null,
    deleted_by: null,
    previously_removed: false,
    // Demo members have a wall so the profile walkthrough has something to show.
    wall_enabled: true,
  }
}

/** Shaped like the object `supabase-js`'s `auth.getSession()`/`getUser()`
 *  resolve - only the fields any code in this app actually reads
 *  (`session.user.id`, mainly). `access_token`/`refresh_token` are garbage
 *  strings, not JWTs: if any request ever escaped the shadow in
 *  demoShadow.ts and reached the real Supabase project, signature
 *  verification fails and PostgREST/GoTrue reject it with 401 before RLS is
 *  ever evaluated - a stronger outcome than the real anon key would give,
 *  which is a valid credential and would proceed to RLS. See demoShadow.ts. */
export function buildFakeSession(member: Member) {
  const nowSec = Math.floor(Date.now() / 1000)
  const user = {
    id: member.auth_uid as string,
    aud: 'authenticated',
    role: 'authenticated',
    email: member.email,
    app_metadata: {},
    user_metadata: { full_name: member.full_name },
    created_at: member.created_at,
  }
  return {
    access_token: `demo-not-a-jwt.${member.uuid}`,
    refresh_token: `demo-not-a-jwt-refresh.${member.uuid}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSec + 3600,
    user,
  }
}
