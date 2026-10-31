import { useState } from 'react'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { TerraThonDiscoDiwali } from '../terrathon/admin/DiscoDiwali'
import { AdminShell } from '../live/admin/AdminShell'
import { LiveAdminHome } from '../live/admin/AdminHome'
import { LiveAdminEnquiries } from '../live/admin/Enquiries'
import { LiveAdminContent } from '../live/admin/Content'

/**
 * DEV-ONLY: the AquaTerra.live admin pages against a stateful in-memory database. Route: /dev/admin?page=home|disco|enquiries|content
 *
 * Mounts the real pages with no session and no network, so the whole admin can be exercised in a browser: add, edit, hide, tick off,
 * export. It swaps `supabaseCommunity.from()` for a small fake that keeps rows in memory and answers like PostgREST does (eq filters,
 * order, `select` after a write, a unique violation on a duplicate key, `[]` for a write it will not do).
 *
 * FAILURE INJECTION, because an admin that only works when everything works is not an admin:
 *   ?fail=write   every insert, update and upsert is refused with "permission denied" (a leader whose role was just removed)
 *   ?fail=read    every select fails (the database is unreachable)
 *   ?fail=silent  every write matches zero rows, which is what RLS does to a non-leader (no error, nothing changed)
 *
 * It never ships: App.tsx wraps the import() in `import.meta.env.DEV`, so Rollup drops the chunk.
 */
const iso = (d: number) => new Date(Date.UTC(2026, 9, d, 10, 0, 0)).toISOString()
const reg = (n: number, o: Record<string, unknown>) => ({
  id: `r${n}`, dd_id: `DD26-${['K3X7', 'M2P9', 'Q8W4', 'T6B3', 'H5N2', 'C9R7', 'V4Y6', 'F7D8'][n % 8]}`, school: null, phase: 'early_bird', amount: 450, paid: true, attended: false,
  notes: null, created_by: 'desk', created_at: iso(10 + n), updated_at: iso(10 + n), instagram: null, ig_close_friend: false, dob: null, ...o,
})
const ev = (slug: string, o: Record<string, unknown>) => ({ slug, edition: null, venue: null, time_label: null, href: null, photo_ids: [], highlights: [], sort: 0, published: true, ...o })

function seed(): Record<string, any[]> {
  return {
    disco_diwali_registrations: [
      reg(1, { name: 'Riya Das', phone: '+919830011111', instagram: 'riya.das', ig_close_friend: true, dob: '2008-05-14', school: 'South Point' }),
      reg(2, { name: 'Karan Mehta', phone: '+919830022222', instagram: 'karan_m', ig_close_friend: false, dob: '2007-11-02' }),
      reg(3, { name: 'Aanya Rao', phone: '+919830033333', instagram: 'aanya.rao', ig_close_friend: false }),
      reg(4, { name: 'Zoya Khan', phone: '+919830044444', attended: true, notes: 'cash' }),
      reg(5, { name: 'Dev Sharma', phone: '+919830055555', instagram: 'dev.sharma', ig_close_friend: true, paid: false }),
      reg(6, { name: 'Mira Bose', phone: '+919830066666', dob: '2009-01-30' }),
    ],
    disco_diwali_settings: [{ key: 'dd_phases', value: [
      { key: 'terrathon_special', label: 'TerraThon Special', amount: 550, opensAt: null, closedManually: true },
      { key: 'early_bird', label: 'Early Bird', amount: 450, opensAt: '2026-10-22', closedManually: false },
    ] }],
    live_enquiries: [
      { id: 'q1', created_at: iso(20), name: 'Ishaan Roy', contact: 'ishaan@example.com', topic: 'sponsor', message: 'We run a cafe near the venue and would like to sponsor a night.', handled: false },
      { id: 'q2', created_at: iso(21), name: 'Tara Sen', contact: '+919830077777', topic: 'tickets', message: 'Is there a group rate for ten people?', handled: false },
      { id: 'q3', created_at: iso(22), name: 'Old Message', contact: '+919830088888', topic: 'other', message: 'Already answered long ago, thanks.', handled: true },
    ],
    live_events: [
      ev('disco-diwali-2026', { name: 'Disco Diwali', edition: 'The Masquerade Sangeet Edition', status: 'upcoming', when_key: '2026-11-10', date_label: '10 November 2026', blurb: 'A masquerade night.', venue: '60, Chowringhee Banquets', time_label: '4:30 PM onwards', href: '/live/disco-diwali', photo_ids: ['booth'] }),
      ev('terrathon-2026', { name: 'TerraThon', edition: 'Cricket, pickleball and FIFA', status: 'past', when_key: '2026-10-02', date_label: '2 to 4 October 2026', blurb: 'The sports festival.', sort: 10 }),
    ],
    live_programmes: [
      { name: 'Pather Sathi', line: 'A Sunday school for children.', photo: null, photo_alt: null, sort: 0, published: true },
      { name: 'Food distribution', line: 'Meals and drives.', photo: 'food', photo_alt: 'A volunteer.', sort: 10, published: true },
    ],
  }
}

const PK: Record<string, string> = { disco_diwali_registrations: 'id', disco_diwali_settings: 'key', live_enquiries: 'id', live_events: 'slug', live_programmes: 'name' }

function install(fail: string | null) {
  const tables = seed()
  ;(window as any).__fakeDb = tables
  ;(supabaseCommunity as any).from = (name: string) => {
    const rows = tables[name] ?? (tables[name] = [])
    let op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
    let payload: any = null
    let cols: string | null = null
    let single = false
    let orderCol: string | null = null
    let asc = true
    const filters: [string, unknown][] = []
    const project = (r: any) => (cols && cols !== '*' && !cols.includes('(') ? Object.fromEntries(cols.split(',').map(c => c.trim()).map(c => [c, r[c]])) : { ...r })
    const matches = (r: any) => filters.every(([c, v]) => r[c] === v)
    const run = () => {
      if (fail === 'read' && op === 'select' && cols !== null && !payload) return { data: null, error: { message: 'FetchError: database unreachable' } }
      if (op !== 'select' && fail === 'write') return { data: null, error: { message: 'permission denied for table ' + name, code: '42501' } }
      if (op === 'insert') {
        const pk = PK[name]
        const row = { ...(name === 'disco_diwali_registrations' ? { id: `n${Math.random().toString(36).slice(2, 8)}`, paid: true, attended: false, notes: null, school: null, ig_close_friend: false } : {}), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload }
        if (rows.some(r => r[pk] === row[pk])) return { data: null, error: { message: `duplicate key value violates unique constraint "${name}_pkey"`, code: '23505' } }
        if (fail === 'silent') return { data: single ? null : [], error: null }
        rows.unshift(row)
        return { data: single ? project(row) : [project(row)], error: null }
      }
      if (op === 'update') {
        if (fail === 'silent') return { data: [], error: null }
        const hit = rows.filter(matches); hit.forEach(r => Object.assign(r, payload))
        return { data: hit.map(project), error: null }
      }
      if (op === 'upsert') {
        if (fail === 'silent') return { data: [], error: null }
        const pk = PK[name]; const i = rows.findIndex(r => r[pk] === payload[pk]); if (i >= 0) rows[i] = { ...rows[i], ...payload }; else rows.push(payload)
        return { data: [project(payload)], error: null }
      }
      if (op === 'delete') {
        if (fail === 'silent') return { data: [], error: null }
        const hit = rows.filter(matches); hit.forEach(r => rows.splice(rows.indexOf(r), 1))
        return { data: hit.map(project), error: null }
      }
      let out = rows.filter(matches).map(project)
      if (orderCol) { const c = orderCol; out = out.sort((a: any, b: any) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)) }
      return { data: out, error: null }
    }
    const b: any = {
      select: (c?: string) => { cols = c ?? '*'; return b }, limit: () => b,
      order: (c: string, o?: { ascending?: boolean }) => { orderCol = c; asc = o?.ascending !== false; return b },
      single: () => { single = true; return b },
      insert: (p: any) => { op = 'insert'; payload = p; return b },
      update: (p: any) => { op = 'update'; payload = p; return b },
      upsert: (p: any) => { op = 'upsert'; payload = p; return b },
      delete: () => { op = 'delete'; return b },
      eq: (c: string, v: unknown) => { filters.push([c, v]); return b },
      match: (o: Record<string, unknown>) => { Object.entries(o).forEach(([c, v]) => filters.push([c, v])); return b },
      then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
    }
    return b
  }
}

export default function AdminSurfaces() {
  const q = new URLSearchParams(window.location.search)
  const page = q.get('page') ?? 'home'
  // installed once, during the first render, before any page's first read
  useState(() => { install(q.get('fail')); return true })
  if (page === 'disco') return <AdminShell><TerraThonDiscoDiwali /></AdminShell>
  const Page = page === 'enquiries' ? LiveAdminEnquiries : page === 'content' ? LiveAdminContent : LiveAdminHome
  return <AdminShell><Page /></AdminShell>
}
