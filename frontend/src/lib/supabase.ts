// AquaTerra's welfare_projects / blogs / form-submission tables used to live in a
// SEPARATE Supabase project (the MK Cycles ecommerce DB) reached via an anon
// "CMS" client. They have since been CONSOLIDATED into the community project
// (2026-07), so this module no longer creates its own client — `supabase` is now
// just an alias for the authenticated community client. Every existing importer
// (`import { supabase } from '../lib/supabase'`, incl. the `cmsSupabase` /
// `supabaseWelfare` aliases) keeps working unchanged, but now hits the community
// DB: public reads stay public, and welfare_projects/blogs writes carry the
// director's auth session so RLS gates them on is_director() (community DB).
//
// Typed as SupabaseClient<any> to preserve the prior behavior exactly — this
// client was ALWAYS untyped-schema (createClient with no Database generic), so
// `.from('welfare_projects')` works for any table while query RESPONSES stay
// typed (data: any, error: PostgrestError). A bare `as any` would instead make
// every destructured `{ data, error }` implicitly any. These 5 tables aren't in
// the community client's generated types yet; regenerate database.types.ts to tighten.
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseCommunity } from './supabaseCommunity'

export const supabase: SupabaseClient<any> = supabaseCommunity as any

export interface WelfareProject {
  id: number
  slug: string
  is_draft: boolean
  header: string
  featured: boolean
  location: string | null
  key_statistic: string | null
  workshop_date: string | null
  objective: string | null
  short_summary: string | null
  long_writeup: string | null
  collab_name: string | null
  collab_logo: string | null
  image_1: string | null; image_1_alt: string | null; label_1: string | null
  image_2: string | null; image_2_alt: string | null; label_2: string | null
  image_3: string | null; image_3_alt: string | null; label_3: string | null
  image_4: string | null; image_4_alt: string | null; label_4: string | null
  volunteers: number | null
  instagram_link: string | null
  main_image: string | null
  main_image_alt: string | null
  google_drive_link: string | null
}

export interface Blog {
  id: number
  slug: string
  headliner: string
  featured_image: string | null
  featured_image_alt: string | null
  written_by: string | null
  published_date: string | null
  minutes_of_read: number | null
  body: string | null
  author_url: string | null
  author_instagram: string | null
}

export const normalizeObj = (o: string | null): string => {
  if (!o) return 'Others'
  const map: Record<string, string> = {
    'feeding dogs': 'Feeding Dogs', 'workshop': 'Workshop',
    'distribution drive': 'Distribution Drive', 'plantation drive': 'Plantation Drive',
    'fundraising event': 'Fundraising Event', 'sundarbans relief': 'Sundarbans Relief',
    'old age home visit': 'Old Age Home Visit',
  }
  const t = o.trim()
  return map[t.toLowerCase()] ?? t.replace(/\b\w/g, l => l.toUpperCase())
}

export const OBJ_COLORS: Record<string, string> = {
  'Workshop':           '#3e8bc2',
  'Feeding Dogs':       '#e08c3c',
  'Plantation Drive':   '#255c3b',
  'Distribution Drive': '#7c4dbc',
  'Sundarbans Relief':  '#1a6b6b',
  'Old Age Home Visit': '#b04060',
  'Fundraising Event':  '#cc3333',
  'Others':             '#666666',
}

// Maps a normalized welfare_project objective to the department/team category
// it belongs to - shared by PublicProjectDetailPage (breadcrumb + related
// team link) and TeamDetailPage (the team's related-projects ticker), so a
// project and the team that ran it always agree on which category they're in.
export const OBJ_CAT_MAP: Record<string, string> = {
  'Workshop': 'welfare',
  'Feeding Dogs': 'welfare',
  'Plantation Drive': 'welfare',
  'Distribution Drive': 'welfare',
  'Sundarbans Relief': 'welfare',
  'Old Age Home Visit': 'welfare',
  'Fundraising Event': 'events',
  'Others': 'operations',
}

export const relativeDate = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (days < 1) return 'today'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
