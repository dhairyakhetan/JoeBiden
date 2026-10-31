import { supabaseCommunity } from './supabaseCommunity'

// community_audit_logs has RLS with a SELECT policy for super_admin only and
// NO insert policy - the frontend could never write to it directly. This
// wraps the log_action() SECURITY DEFINER RPC (see
// scripts/log_action_and_hr_set_member_break_2026_09_12.sql), which stamps
// member_id from the CALLER's own session server-side, so a log row can
// never be forged to name someone else.
//
// Fire-and-forget + non-throwing, same convention as notificationService's
// own create() - a failed audit write must never block the action it is
// merely recording. Callers do not await this in any way that could delay
// their own success path; they just call it and move on.
export function logAction(action: string, entityType?: string, entityId?: number, details?: Record<string, unknown>): void {
  supabaseCommunity
    .rpc('log_action' as never, {
      p_action: action,
      p_entity_type: entityType ?? null,
      p_entity_id: entityId ?? null,
      p_details: details ?? null,
    } as never)
    .then(({ error }: any) => {
      if (error) console.warn('[auditLog] failed to record', action, error)
    })
}
