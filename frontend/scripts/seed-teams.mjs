/**
 * AquaTerra Teams Seed Script
 * Requires service-role key (bypasses RLS).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> node scripts/seed-teams.mjs
 *
 * Get the service key from:
 *   Supabase Dashboard → Project Settings → API → service_role key
 */

import { createClient } from '@supabase/supabase-js'
import { serviceKey, SERVICE_KEY_ENV_NAME } from './serviceKey.mjs'

const SUPABASE_URL = 'https://hzowuwffjqtgszecngpe.supabase.co'
const SERVICE_KEY  = serviceKey()

if (!SERVICE_KEY) {
  console.error(`\n❌  ${SERVICE_KEY_ENV_NAME} environment variable is required.`)
  console.error(`   Run: ${SERVICE_KEY_ENV_NAME}=<key> node scripts/seed-teams.mjs\n`)
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false }
})

// ── Real AQ teams from the organisation manifesto ────────────────────────────
const TEAMS = [
  {
    name: 'Events Team',
    category: 'events',
    description: 'Paradox. Disco Diwali. Starry Nights. Every fundraiser AQ has ever run. Paradox 3.0 had 300 attendees and crossed 6-digit revenue in a single night. This team conceptualises, funds, and manages logistics for every AQ event from a 20-person meetup to a 300-person concert. If something happened and people showed up, Events ran it.',
  },
  {
    name: 'Welfare Team',
    category: 'welfare',
    description: '3,500+ kids reached in structured teaching workshops since 2021. 8 Sundarbans relief trips with food, medicine, and clothing. Dog feeding drives across Ballygunge, Tiljala, and Park Circus every month. 4,000+ saplings planted. 15,000+ bananas distributed. This is the impact core of AQ. Every welfare drive, distribution run, and medical camp started here.',
  },
  {
    name: 'Social Media',
    category: 'content',
    description: 'Instagram, LinkedIn, and the website. 3,200+ followers on @ngo.aquaterra. Reels, carousels, long-form copy, strategy, and design. Not a school club\'s social media. A real brand account built by students who understand audience, tone, and distribution. The team handles AQ\'s entire digital identity.',
  },
  {
    name: 'Collabs Team',
    category: 'operations',
    description: 'School collaborations, college tie-ups, NGO partnerships, inter-city outreach. AQ grows through peer networks and institutional relationships. This team builds those partnerships from scratch. They write the decks, send the emails, run the calls, and convert interest into actual on-ground collaboration.',
  },
  {
    name: 'ROOTS',
    category: 'content',
    description: 'Student-run streetwear brand under AQ. Design, production, sales. Profits fund AQ welfare projects and events. The brand is real, the product is real, and the revenue is real. ROOTS drops limited collections, handles its own supply chain, and operates as a student-run business inside AQ.',
  },
  {
    name: 'AQ.Ventures',
    category: 'operations',
    description: 'A free marketing agency for student-run businesses. Real clients, real briefs, real deliverables. Members get marketing experience before college by working on actual campaigns for student entrepreneurs in Kolkata. Strategy, design, social, and content — all built by the team.',
  },
  {
    name: 'ShikshAQ',
    category: 'labs',
    description: 'A tuition discovery platform built by AQ members for Kolkata students looking for quality tutors. Launched in 2026. Product, design, content, and growth managed entirely by the team. Still early. The product is live. The team is small, the scope is large.',
  },
  {
    name: 'Human Resources',
    category: 'operations',
    description: 'Recruitment, onboarding, certificates, and Letters of Recommendation. HR runs the intake pipeline for 850+ active members. They\'re the first people new joiners meet when they apply. They manage applications, schedule interviews, write certs, and keep the org\'s membership data clean.',
  },
]

async function seed() {
  console.log('\n🌱  AquaTerra Teams Seed\n')

  // 1. Find an admin member to set as creator
  const { data: admin } = await db
    .from('members')
    .select('member_id, full_name')
    .in('role', ['super_admin', 'director'])
    .eq('status', 'active')
    .order('member_id')
    .limit(1)
    .single()

  const creatorId = admin?.member_id || null
  console.log(`   Creator: ${admin ? `${admin.full_name} (id=${creatorId})` : 'null (no admin found)'}`)

  // 2. Delete all existing teams + dependents
  console.log('\n   Removing old teams...')
  const { data: existing } = await db.from('teams').select('team_id')
  const ids = (existing || []).map(t => t.team_id)

  if (ids.length) {
    await db.from('team_join_requests').delete().in('team_id', ids)
    await db.from('team_members').delete().in('team_id', ids)
    await db.from('teams').delete().in('team_id', ids)
    console.log(`   Deleted ${ids.length} old team(s)`)
  } else {
    console.log('   No existing teams found')
  }

  // 3. Insert new teams
  console.log('\n   Inserting 8 AQ teams...')
  const inserts = TEAMS.map(t => ({ ...t, is_active: true, created_by: creatorId }))
  const { data: inserted, error } = await db.from('teams').insert(inserts).select('team_id, name, category')

  if (error) {
    console.error('\n❌  Insert failed:', error.message)
    process.exit(1)
  }

  console.log('\n✅  Done! Teams created:\n')
  inserted.forEach(t => console.log(`   [${t.team_id}] ${t.name} (${t.category})`))
  console.log('')
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1) })
