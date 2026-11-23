#!/usr/bin/env node
/**
 * compute-topic-facts.mjs: the numbers and drive lists behind every /impact/<slug> page.
 *
 * Run: node scripts/compute-topic-facts.mjs   (part of `npm run build`, right after compute-org-facts)
 * Reads: src/lib/topics/topicDefs.json, and welfare_projects (is_draft = false) through the public key.
 * Writes: src/lib/topics/facts/<slug>.json  (count, volunteers, dates, years, places, the drives themselves)
 *         src/lib/topics/factsIndex.json    (one small line per topic, for the hub and the project-page cards)
 *
 * Same rules as compute-org-facts.mjs: no number on a topic page is typed by hand. Every page's prose writes
 * {count}, {volunteers}, {firstYear} and so on, and the page fills them from these files, so a new drive written
 * up on the desk shows on the right pages at the next deploy.
 *
 * FAILS SOFT. No key, a network failure, or an implausibly small result keeps the committed files as they are
 * and says so. An SEO enhancement must never fail a deploy, and a half-empty fetch must never shrink every page.
 *
 * TOPIC_DUMP=<path> also writes the full rows (summaries, objectives) matched to each topic, for whoever writes
 * the page copy. That file holds nothing private (it is the same public table) but is not shipped.
 */
import './loadEnv.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const TOPICS_DIR = join(__dir, '../src/lib/topics')
const DEFS = JSON.parse(readFileSync(join(TOPICS_DIR, 'topicDefs.json'), 'utf8'))

const DB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hzowuwffjqtgszecngpe.supabase.co'
const DB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const MIN_PLAUSIBLE_ROWS = 100
const DRIVE_LIST_CAP = 120

const COLUMNS = 'slug,header,location,workshop_date,volunteers,short_summary,objective,key_statistic,collab_name,main_image,main_image_alt'
const STORY_PHOTOS_PER_YEAR = 8

async function fetchRows() {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${DB_URL}/rest/v1/welfare_projects?select=${COLUMNS}&is_draft=eq.false&order=workshop_date.desc.nullslast`, {
      headers: { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}`, Range: `${offset}-${offset + 999}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`)
    const page = await res.json()
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows
}

const clean = s => String(s || '').replace(/\s+/g, ' ').trim()

/** "Pather Sathi " and "Pather Saathi" are one place; "AIM FOUNDATION" and "Aim Foundation" too. */
function placeKey(loc) {
  return clean(loc).toLowerCase().replace(/saathi/g, 'sathi').replace(/ektara/g, 'ek tara').replace(/aim 2 foundation/, 'aim foundation')
}
function placeLabel(key) {
  const fixed = { 'aim foundation': 'AIM Foundation', 'ek tara': 'Ek Tara' }
  if (fixed[key]) return fixed[key]
  return key.replace(/\b[a-z]/g, c => c.toUpperCase())
}

export function matches(def, row) {
  const m = def.match || {}
  if (m.all) return true
  if (m.blog && !m.header && !m.location && !m.text) return false
  if (m.year) return row.workshop_date ? new Date(row.workshop_date).getUTCFullYear() === m.year : false
  if (m.month) return row.workshop_date ? row.workshop_date.slice(0, 7) === m.month : false
  if (m.header && new RegExp(m.header, 'i').test(clean(row.header))) return true
  if (m.location && new RegExp(m.location, 'i').test(clean(row.location))) return true
  if (m.text && new RegExp(m.text, 'i').test(`${clean(row.header)} ${clean(row.short_summary)} ${clean(row.objective)}`)) return true
  return false
}

function summarise(rows) {
  const dated = rows.filter(r => r.workshop_date).map(r => r.workshop_date).sort()
  const byYear = {}
  const places = new Map()
  for (const r of rows) {
    if (r.workshop_date) { const y = new Date(r.workshop_date).getUTCFullYear(); byYear[y] = (byYear[y] || 0) + 1 }
    const k = placeKey(r.location)
    if (k) places.set(k, (places.get(k) || 0) + 1)
  }
  const topPlaces = [...places.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ name: placeLabel(k), count: n }))
  return {
    count: rows.length,
    volunteers: rows.reduce((s, r) => s + (Number(r.volunteers) || 0), 0),
    firstDate: dated[0]?.slice(0, 10) || null,
    lastDate: dated[dated.length - 1]?.slice(0, 10) || null,
    byYear,
    placesCount: places.size,
    topPlaces,
  }
}

/** Published Groundwork Diaries posts (blog mirrors), for the reading pages. Fails soft to []. */
async function fetchBlogPosts() {
  try {
    const res = await fetch(`${DB_URL}/rest/v1/posts?select=slug,title,published_at,article_body,body&status=eq.published&source_kind=eq.blog&deleted_at=is.null&order=published_at.desc`, {
      headers: { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}` }, signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return []
    return (await res.json()).filter(p => p.slug && p.title)
  } catch { return [] }
}
const blogMatch = (def, p) => !!def.match?.blog && new RegExp(def.match.blog, 'i').test(`${clean(p.title)} ${clean(p.article_body || p.body).slice(0, 600)}`)

async function main() {
  if (!DB_KEY) { console.warn('⚠ topic facts: no Supabase key, keeping the committed files'); return }
  let rows
  try { rows = await fetchRows() } catch (e) { console.warn(`⚠ topic facts: fetch failed (${e.message}), keeping the committed files`); return }
  if (rows.length < MIN_PLAUSIBLE_ROWS) { console.warn(`⚠ topic facts: only ${rows.length} rows, implausible, keeping the committed files`); return }

  mkdirSync(join(TOPICS_DIR, 'facts'), { recursive: true })
  const blogPosts = await fetchBlogPosts()
  const index = {}
  const dump = {}
  for (const def of DEFS.topics) {
    const hit = rows.filter(r => matches(def, r))
    const s = summarise(hit)
    const facts = {
      slug: def.slug,
      generatedAt: new Date().toISOString(),
      ...s,
      drives: hit.slice(0, DRIVE_LIST_CAP).map(r => ({
        slug: r.slug, title: clean(r.header), date: r.workshop_date ? r.workshop_date.slice(0, 10) : null, place: clean(r.location) || null,
        // The drive's own cover photo, already public on its write-up. Pages run it through sized() before showing it.
        ...(r.main_image ? { img: r.main_image, alt: clean(r.main_image_alt) || clean(r.header) } : {}),
      })),
      // Reading pages (match.blog): the member blog posts on that theme, newest first.
      ...(def.match?.blog ? { posts: blogPosts.filter(p => blogMatch(def, p)).map(p => ({
        slug: p.slug, title: clean(p.title), date: p.published_at ? p.published_at.slice(0, 10) : null, excerpt: clean(p.article_body || p.body).slice(0, 200),
      })) } : {}),
    }
    writeFileSync(join(TOPICS_DIR, 'facts', `${def.slug}.json`), JSON.stringify(facts) + '\n')
    index[def.slug] = {
      count: s.count, volunteers: s.volunteers,
      firstYear: s.firstDate ? Number(s.firstDate.slice(0, 4)) : null,
      lastYear: s.lastDate ? Number(s.lastDate.slice(0, 4)) : null,
    }
    dump[def.slug] = hit.map(r => ({ ...r, header: clean(r.header), short_summary: clean(r.short_summary).slice(0, 400), objective: clean(r.objective).slice(0, 300) }))
  }
  // Photo stories (/impact/stories/<slug>): the source topic's drives grouped by year, oldest year first, each year
  // carrying up to STORY_PHOTOS_PER_YEAR drives that have a photo, with the drive's own one-line summary as caption.
  mkdirSync(join(TOPICS_DIR, 'facts', 'stories'), { recursive: true })
  for (const st of DEFS.stories || []) {
    const def = DEFS.topics.find(t => t.slug === st.topic)
    if (!def) { console.warn(`  ⚠ story ${st.slug}: no topic ${st.topic}`); continue }
    const hit = rows.filter(r => matches(def, r))
    const byYear = new Map()
    for (const r of hit) {
      if (!r.workshop_date) continue
      const y = new Date(r.workshop_date).getUTCFullYear()
      if (!byYear.has(y)) byYear.set(y, [])
      byYear.get(y).push(r)
    }
    const chapters = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, rs]) => ({
      year,
      count: rs.length,
      volunteers: rs.reduce((s2, r) => s2 + (Number(r.volunteers) || 0), 0),
      photos: rs.filter(r => r.main_image).slice(0, STORY_PHOTOS_PER_YEAR).map(r => ({
        slug: r.slug, title: clean(r.header), date: r.workshop_date.slice(0, 10), place: clean(r.location) || null,
        img: r.main_image, alt: clean(r.main_image_alt) || clean(r.header), caption: clean(r.short_summary).slice(0, 220),
      })),
    }))
    writeFileSync(join(TOPICS_DIR, 'facts', 'stories', `${st.slug}.json`), JSON.stringify({ slug: st.slug, topic: st.topic, generatedAt: new Date().toISOString(), ...summarise(hit), chapters }) + '\n')
  }

  // Story gallery index: one cover photo and the headline numbers per story, so /impact/stories loads one small file.
  const storyIndex = (DEFS.stories || []).map(st => {
    const def = DEFS.topics.find(t => t.slug === st.topic)
    const hit = def ? rows.filter(r => matches(def, r)) : []
    const cover = hit.find(r => r.main_image)
    const sm = summarise(hit)
    return { slug: st.slug, label: st.label, topic: st.topic, count: sm.count, firstYear: sm.firstDate ? Number(sm.firstDate.slice(0, 4)) : null, lastYear: sm.lastDate ? Number(sm.lastDate.slice(0, 4)) : null, ...(cover ? { img: cover.main_image, alt: clean(cover.main_image_alt) || clean(cover.header) } : {}) }
  })
  writeFileSync(join(TOPICS_DIR, 'facts', 'stories', '_index.json'), JSON.stringify(storyIndex) + '\n')

  // Every drive in one compact list, for the explorers (timeline, calculator, places). Short keys keep it small:
  // s slug, t title, d date, p place, v volunteers, i photo, k the first drive-series topic it belongs to.
  const seriesDefs = DEFS.topics.filter(t => t.group === 'series')
  const all = rows.filter(r => r.workshop_date).map(r => {
    const k = seriesDefs.find(t => matches(t, r))?.slug
    return { s: r.slug, t: clean(r.header), d: r.workshop_date.slice(0, 10), p: clean(r.location) || null, v: Number(r.volunteers) || 0, ...(r.main_image ? { i: r.main_image } : {}), ...(k ? { k } : {}) }
  })
  writeFileSync(join(TOPICS_DIR, 'facts', '_all.json'), JSON.stringify(all) + '\n')

  // Totals for pages that compare one thing with the whole (by-the-numbers, where-we-work).
  index._all = { ...summarise(rows), byYear: undefined, topPlaces: undefined }
  delete index._all.byYear; delete index._all.topPlaces
  writeFileSync(join(TOPICS_DIR, 'factsIndex.json'), JSON.stringify(index, null, 1) + '\n')
  console.log(`✓ topic facts: ${DEFS.topics.length} topics from ${rows.length} drives`)
  if (process.env.TOPIC_DUMP) { writeFileSync(process.env.TOPIC_DUMP, JSON.stringify(dump, null, 1)); console.log(`  dump → ${process.env.TOPIC_DUMP}`) }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
