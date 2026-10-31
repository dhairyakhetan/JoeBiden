// AquaTerra.live guest function. NOT DEPLOYED. Needs frontend/scripts/live_guest_2026_10_24.sql applied first.
//
//   supabase functions deploy live-guest --no-verify-jwt
//
// Guests are not Supabase users, so the function is called without a JWT and does its own auth: a booking ID PLUS the phone
// number the ticket was booked with. It runs with the service role, so it is the only door to disco_diwali_registrations, and it
// returns the guest's own name, status and songs and nothing else. It never returns a list, a phone number or another guest.
//
// Actions (POST JSON { action, ... }):
//   login        { ddId, phone }            -> { token, guest }
//   me           { token }                  -> { guest }
//   setDob       { token, dob }             -> { guest }
//   addSong      { token, title }           -> { guest }
//   removeSong   { token, songId }          -> { guest }
//   logout       { token }                  -> { ok }
//
// NOTE 2026-10-25: the date of birth is now a free-text note in the database (disco_diwali_dob_free_text). `setDob` below still checks for
// a YYYY-MM-DD date; when this function is wired up, decide whether a guest-entered DOB should stay a strict date (it feeds the sun sign) and
// keep that check, or accept text like the desk does.
//
// Every refusal is a plain JSON { error, code } with the right status, and a wrong ID and a wrong phone give the SAME answer, so
// the function cannot be used to find out which booking IDs exist.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SONG_CUTOFF = Date.parse('2026-11-09T18:00:00+05:30') // edits close 9 Nov, 6 pm IST
const SONGS_PER_GUEST = 2
const FAILS = 5 // failed logins ...
const WINDOW_MIN = 10 // ... per window, per IP and per booking ID, then a cooldown

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
const fail = (status: number, code: string, error: string) => json({ error, code }, status)

async function sha256(s: string): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')
}
const last10 = (s: string) => s.replace(/\D/g, '').slice(-10)
const DD_ID = /^DD26-[A-Z0-9]{4}$/

async function guestFor(regId: string) {
  const { data: r } = await db.from('disco_diwali_registrations').select('id, dd_id, name, attended, dob').eq('id', regId).single()
  if (!r) return null
  const { data: songs } = await db.from('live_guest_songs').select('id, title, status').eq('reg_id', regId).order('created_at')
  return {
    ddId: r.dd_id, name: r.name, status: r.attended ? 'checked_in' : 'confirmed',
    dob: r.dob ?? null, songs: songs ?? [], songsOpen: Date.now() < SONG_CUTOFF, songLimit: SONGS_PER_GUEST,
  }
}

async function session(token: unknown): Promise<string | null> {
  if (typeof token !== 'string' || token.length < 40) return null
  const { data } = await db.from('live_guest_sessions').select('reg_id, expires_at').eq('token_hash', await sha256(token)).maybeSingle()
  if (!data || Date.parse(data.expires_at) < Date.now()) return null
  return data.reg_id
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail(405, 'method', 'POST only.')
  let b: any
  try { b = await req.json() } catch { return fail(400, 'bad_json', 'Send JSON.') }

  if (b.action === 'login') {
    const ddId = String(b.ddId ?? '').trim().toUpperCase()
    const phone = last10(String(b.phone ?? ''))
    const ip = await sha256((req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim())
    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString()
    const [byIp, byId] = await Promise.all([
      db.from('live_login_attempts').select('id', { count: 'exact', head: true }).eq('ip_hash', ip).eq('ok', false).gte('at', since),
      db.from('live_login_attempts').select('id', { count: 'exact', head: true }).eq('dd_id', ddId).eq('ok', false).gte('at', since),
    ])
    if ((byIp.count ?? 0) >= FAILS || (byId.count ?? 0) >= FAILS) return fail(429, 'cooldown', 'Too many tries. Wait ten minutes and try again.')
    const refuse = async () => {
      await db.from('live_login_attempts').insert({ ip_hash: ip, dd_id: DD_ID.test(ddId) ? ddId : null, ok: false })
      return fail(401, 'no_match', 'That ID and number do not match a booking.')
    }
    if (!DD_ID.test(ddId) || phone.length !== 10) return refuse()
    const { data: reg } = await db.from('disco_diwali_registrations').select('id, phone, paid').eq('dd_id', ddId).maybeSingle()
    if (!reg || !reg.paid || last10(reg.phone) !== phone) return refuse()
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const token = [...bytes].map(x => x.toString(16).padStart(2, '0')).join('')
    await db.from('live_guest_sessions').insert({ token_hash: await sha256(token), reg_id: reg.id })
    await db.from('live_login_attempts').insert({ ip_hash: ip, dd_id: ddId, ok: true })
    return json({ token, guest: await guestFor(reg.id) })
  }

  const regId = await session(b.token)
  if (!regId) return fail(401, 'session', 'Please sign in again.')

  if (b.action === 'me') return json({ guest: await guestFor(regId) })
  if (b.action === 'logout') {
    await db.from('live_guest_sessions').delete().eq('token_hash', await sha256(b.token))
    return json({ ok: true })
  }

  if (b.action === 'setDob') {
    const dob = String(b.dob ?? '')
    const t = Date.parse(dob)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || !Number.isFinite(t) || t > Date.now() || t < Date.parse('1900-01-01')) {
      return fail(400, 'bad_dob', 'That date does not look right.')
    }
    await db.from('disco_diwali_registrations').update({ dob }).eq('id', regId)
    return json({ guest: await guestFor(regId) })
  }

  if (b.action === 'addSong' || b.action === 'removeSong') {
    if (Date.now() >= SONG_CUTOFF) return fail(409, 'closed', 'Song requests closed on 9 November at 6 pm.')
    if (b.action === 'removeSong') {
      await db.from('live_guest_songs').delete().eq('id', String(b.songId ?? '')).eq('reg_id', regId)
      return json({ guest: await guestFor(regId) })
    }
    const title = String(b.title ?? '').trim().replace(/\s+/g, ' ')
    if (title.length < 2 || title.length > 80 || /https?:|www\./i.test(title)) return fail(400, 'bad_title', 'Give a song name, 2 to 80 characters, no links.')
    const { data: blocked } = await db.from('live_blocked_words').select('word')
    const lower = title.toLowerCase()
    if ((blocked ?? []).some((w: { word: string }) => lower.includes(w.word))) return fail(400, 'blocked', 'Please pick a different song.')
    const { count } = await db.from('live_guest_songs').select('id', { count: 'exact', head: true }).eq('reg_id', regId)
    if ((count ?? 0) >= SONGS_PER_GUEST) return fail(409, 'limit', `You can request ${SONGS_PER_GUEST} songs. Remove one to add another.`)
    await db.from('live_guest_songs').insert({ reg_id: regId, title })
    return json({ guest: await guestFor(regId) })
  }

  return fail(400, 'unknown_action', 'Unknown action.')
})
