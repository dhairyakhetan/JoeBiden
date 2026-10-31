import { supabaseCommunity } from '../../lib/supabaseCommunity'
import type { EventRow, ProgrammeRow } from './content'

const db = supabaseCommunity as any

/**
 * The columns the PUBLIC site reads, spelled out. Never `select('*')` on these tables from a public page: the table is readable by
 * anyone, so a column added later (an editor's name, a note to self) would be published the moment it appears. `updated_by` is also
 * scrubbed to null by a database trigger, so even a hand-edit cannot put an identity there.
 */
export const EVENT_PUBLIC_COLS = 'slug,name,edition,status,when_key,date_label,blurb,venue,time_label,href,photo_ids,highlights,sort,published'
export const PROGRAMME_PUBLIC_COLS = 'name,line,photo,photo_alt,sort,published'
const NO_ROWS = 'The database did not accept that. Your account may not have permission.'

/** Public reads. `published` is filtered here too: a signed-in leader's policy returns every row, and the public site must not. */
export async function fetchPublishedEvents(): Promise<EventRow[]> {
  const { data, error } = await db.from('live_events').select(EVENT_PUBLIC_COLS).eq('published', true).order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []) as EventRow[]
}
export async function fetchPublishedProgrammes(): Promise<ProgrammeRow[]> {
  const { data, error } = await db.from('live_programmes').select(PROGRAMME_PUBLIC_COLS).eq('published', true).order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProgrammeRow[]
}

/** Admin reads: everything, drafts included. RLS lets only a leader see the unpublished ones. Same explicit columns. */
export async function fetchAllEvents(): Promise<EventRow[]> {
  const { data, error } = await db.from('live_events').select(EVENT_PUBLIC_COLS).order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []) as EventRow[]
}
export async function fetchAllProgrammes(): Promise<ProgrammeRow[]> {
  const { data, error } = await db.from('live_programmes').select(PROGRAMME_PUBLIC_COLS).order('sort', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProgrammeRow[]
}

/** Insert or update one night. Nothing is ever removed: a leader unpublishes. Throws on error; the page owns the feedback. No editor identity is sent: the table is public-readable. */
export async function saveEvent(row: EventRow, isNew: boolean): Promise<void> {
  const body = { ...row }
  if (isNew) {
    const { error } = await db.from('live_events').insert(body)
    if (error) throw error
    return
  }
  const { slug, ...rest } = body
  const { data, error } = await db.from('live_events').update(rest).eq('slug', slug).select('slug')
  if (error) throw error
  if (!data || data.length === 0) throw new Error(NO_ROWS)
}
export async function saveProgramme(row: ProgrammeRow, isNew: boolean): Promise<void> {
  const body = { ...row }
  if (isNew) {
    const { error } = await db.from('live_programmes').insert(body)
    if (error) throw error
    return
  }
  const { name, ...rest } = body
  const { data, error } = await db.from('live_programmes').update(rest).eq('name', name).select('name')
  if (error) throw error
  if (!data || data.length === 0) throw new Error(NO_ROWS)
}
