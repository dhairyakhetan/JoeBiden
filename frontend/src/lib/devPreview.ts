// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY preview session.
//
// Lets a developer render the authed / HOD-desk / profile surfaces on localhost
// WITHOUT a real Google login, purely to design and fix those pages. It fakes an
// authenticated `members` row client-side; it does NOT create a Supabase session,
// so any RLS-protected data still won't load - that's fine, the point is layout.
//
// HARD-GATED to `import.meta.env.DEV`: in a production build every function here
// returns null immediately, so this ships as dead code and can never affect real
// auth. Toggle with a URL param on localhost:
//   ?dev=super_admin | hod | director | member   → enable that role
//   ?dev=off                                      → disable
// The choice persists in localStorage until turned off.
// ─────────────────────────────────────────────────────────────────────────────
import type { Database } from './database.types'

type Member = Database['public']['Tables']['members']['Row']

const KEY = 'aq_dev_preview_role'
// 'lead' retired 2026-09-15 - see scripts/retire_lead_role_2026_09_15.sql.
const VALID = ['super_admin', 'hod', 'director', 'member']

/** Active preview role (DEV only), reading the ?dev= param then localStorage. */
export function resolveDevPreviewRole(): string | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  try {
    const p = new URLSearchParams(window.location.search).get('dev')
    if (p === 'off') { localStorage.removeItem(KEY); return null }
    if (p && VALID.includes(p)) { localStorage.setItem(KEY, p); return p }
    const stored = localStorage.getItem(KEY)
    return stored && VALID.includes(stored) ? stored : null
  } catch {
    return null
  }
}

/** A synthetic, fully-formed active members row for the given role. */
export function makeDevPreviewMember(role: string): Member {
  const now = new Date().toISOString()
  return {
    member_id: 999999,
    uuid: '00000000-0000-4000-8000-000000000dev',
    auth_uid: '00000000-0000-4000-8000-0000000d3v01',
    google_id: null,
    email: 'dev-preview@aquaterra.local',
    full_name: 'Dev Preview',
    avatar_url: null,
    class_grade: '12',
    // Synthetic and plausible on purpose: without it isRegistrationComplete() is false
    // and ProtectedRoute bounces every desk route to /register.
    phone: '9000000000',
    join_reason: null,
    role,
    status: 'active',
    rejection_note: null,
    approved_by: null,
    approved_at: now,
    last_login: now,
    is_active: true,
    created_at: now,
    updated_at: now,
    bio: null,
    school_id: null,
  } as unknown as Member
}
