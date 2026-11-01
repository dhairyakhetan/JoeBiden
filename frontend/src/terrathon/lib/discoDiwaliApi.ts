/**
 * Disco Diwali data access. Same contract as lib/api.ts: every function throws
 * on error and never toasts; the calling component owns the feedback.
 *
 * Both tables sit behind `is_director() or is_super_admin()` RLS. PostgREST
 * reports a row RLS hides as "zero rows matched", not as an error, so every
 * write asks for the id back and treats an empty answer as a refusal. Without
 * that, a signed-in non-leader would see a success toast for a write that never
 * happened.
 */
import { supabaseCommunity } from '../../lib/supabaseCommunity'
import { generateDdId, DD_SETTINGS_PHASES, type DiscoReg } from './discoDiwali'

const db = supabaseCommunity as any

/** The column ships in scripts/disco_diwali_instagram_2026_10_24.sql. Until that runs, say so instead of a bare Postgres error. */
function igError(e: any): Error {
  const msg = String(e?.message ?? '')
  return /instagram|ig_close_friend|name_changed|\bdob\b/i.test(msg) && /column|schema cache/i.test(msg)
    ? new Error('Instagram, Close Friends and date of birth need the database update (scripts/disco_diwali_instagram_2026_10_24.sql). Save without them, or run it first.')
    : e
}

const NO_ROWS = 'The database did not accept that. Your account may not have permission.'

export async function listDiscoRegs(): Promise<DiscoReg[]> {
  const { data, error } = await db
    .from('disco_diwali_registrations')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DiscoReg[]
}

/** All settings as key to value. Missing keys simply are not in the map. */
export async function listDiscoSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await db.from('disco_diwali_settings').select('key, value')
  if (error) throw error
  const out: Record<string, unknown> = {}
  for (const r of (data ?? []) as Array<{ key: string; value: unknown }>) out[r.key] = r.value
  return out
}

export async function saveDiscoSetting(key: string, value: unknown): Promise<void> {
  const { data, error } = await db
    .from('disco_diwali_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select('key')
  if (error) throw error
  if (!data || data.length === 0) throw new Error(NO_ROWS)
}

export const savePhases = (phases: unknown) => saveDiscoSetting(DD_SETTINGS_PHASES, phases)

export interface NewDiscoReg {
  name: string
  phone: string
  school: string | null
  /** Normalised handle (no @) or null. Left out of the insert when empty so an unmigrated table still works. */
  instagram?: string | null
  /** Date of birth, yyyy-mm-dd, or null. Left out of the insert when empty. */
  dob?: string | null
  /** Already added to Close Friends. Left out of the insert unless true. */
  igCloseFriend?: boolean
  /** Name was changed after booking. Left out of the insert unless true. */
  nameChanged?: boolean
  phase: string
  amount: number | null
  /** A cash walk-in is paid, stamped "cash" in the notes and ticked in on the spot. */
  cashWalkIn: boolean
  createdBy: string | null
}

/**
 * Insert with a fresh random ID. Retries only on a unique violation (23505) on
 * dd_id, up to 5 times: 28^4 IDs make a clash rare but not impossible, and any
 * other failure (RLS, a missing table, the network) should surface at once.
 */
export async function addDiscoReg(input: NewDiscoReg): Promise<DiscoReg> {
  let last: any = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db
      .from('disco_diwali_registrations')
      .insert({
        dd_id: generateDdId(),
        name: input.name,
        phone: input.phone,
        school: input.school,
        ...(input.instagram ? { instagram: input.instagram } : {}),
        ...(input.dob ? { dob: input.dob } : {}),
        ...(input.igCloseFriend && input.instagram ? { ig_close_friend: true } : {}),
        ...(input.nameChanged ? { name_changed: true } : {}),
        phase: input.phase,
        amount: input.amount,
        paid: true,
        attended: input.cashWalkIn,
        notes: input.cashWalkIn ? 'cash' : null,
        created_by: input.createdBy,
      })
      .select()
      .single()
    if (data) return data as DiscoReg
    last = error ?? new Error('Unknown insert failure')
    if (last?.code !== '23505') break
  }
  throw igError(last)
}

export async function updateDiscoReg(
  id: string,
  patch: Partial<Pick<DiscoReg, 'name' | 'phone' | 'school' | 'instagram' | 'ig_close_friend' | 'name_changed' | 'dob' | 'phase' | 'amount' | 'paid' | 'attended' | 'notes'>>,
): Promise<void> {
  const { data, error } = await db
    .from('disco_diwali_registrations')
    .update(patch)
    .eq('id', id)
    .select('id')
  if (error) throw igError(error)
  if (!data || data.length === 0) throw new Error(NO_ROWS)
}

export async function deleteDiscoReg(id: string): Promise<void> {
  const { data, error } = await db
    .from('disco_diwali_registrations')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new Error(NO_ROWS)
}
