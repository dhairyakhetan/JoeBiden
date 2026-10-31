/**
 * Delete the retired photobooth objects from Supabase Storage.
 *
 * WHY THIS EXISTS
 * ---------------
 * The photobooth feature is gone. No file under frontend/src mentions it, the
 * buckets are private, and the policies that once let anyone read or write them
 * were closed in the 2026-09-18 audit. What is left is 2,357 objects, most of
 * them photographs of students, sitting in a bucket nobody looks at.
 *
 * Measured live 2026-09-19:
 *
 *   photobooth-raw-photos     1,831 objects   217 MB   643 session folders
 *   photobooth-print-sheets     522 objects    40 MB   522 folders
 *   photobooth-assets             4 objects    70 kB     3 folders
 *
 * Nothing newer than 2026-08-22 in any of them.
 *
 * WHY NOT JUST `delete from storage.objects`
 * ------------------------------------------
 * Because that deletes the ROW and leaves the actual file behind in the storage
 * backend, so you free nothing and end up with orphans that are harder to find
 * than what you started with. The Storage API removes both. Hence a script
 * rather than a line of SQL.
 *
 * SAFETY
 * ------
 * Dry run by default. It prints what it would delete and exits. Deleting needs
 * an explicit --confirm, and even then `photobooth-assets` is left alone unless
 * you also pass --include-assets: four files at 70 kB spanning three folders
 * are frame and overlay templates, not student photographs, and they cost
 * nothing to keep.
 *
 * THIS IS IRREVERSIBLE. There is no recycle bin. Take a copy first if any of
 * it might be wanted.
 *
 * USAGE
 * -----
 *   cd frontend
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/delete-photobooth-objects.mjs
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/delete-photobooth-objects.mjs --confirm
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/delete-photobooth-objects.mjs --confirm --include-assets
 */

import { createClient } from '@supabase/supabase-js'
import { serviceKey, SERVICE_KEY_ENV_NAME } from './serviceKey.mjs'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hzowuwffjqtgszecngpe.supabase.co'
const KEY = serviceKey()

const CONFIRM        = process.argv.includes('--confirm')
const INCLUDE_ASSETS = process.argv.includes('--include-assets')

// Ordered so the big photo buckets go first and `photobooth-assets` is opt-in.
const PHOTO_BUCKETS = ['photobooth-raw-photos', 'photobooth-print-sheets']
const ASSET_BUCKET  = 'photobooth-assets'

if (!KEY) {
  console.error(`\n❌  ${SERVICE_KEY_ENV_NAME} is required (listing and deleting both need it: the buckets are private).`)
  console.error('   See scripts/ROTATE_SERVICE_KEY.md.\n')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } })

/** Every object path in a bucket, walked one folder at a time. */
async function listAll(bucket, prefix = '', acc = []) {
  const PAGE = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await db.storage.from(bucket).list(prefix, {
      limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
    if (!data || data.length === 0) break

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // A row with no `id` is a folder placeholder, not an object. Recurse.
      if (entry.id === null || entry.id === undefined) await listAll(bucket, path, acc)
      else acc.push(path)
    }

    if (data.length < PAGE) break
    offset += PAGE
  }
  return acc
}

async function removeAll(bucket, paths) {
  const BATCH = 100        // the API rejects very large arrays
  let removed = 0
  for (let i = 0; i < paths.length; i += BATCH) {
    const slice = paths.slice(i, i + BATCH)
    const { error } = await db.storage.from(bucket).remove(slice)
    if (error) throw new Error(`remove from ${bucket}: ${error.message}`)
    removed += slice.length
    process.stdout.write(`\r   ${bucket}: ${removed}/${paths.length}`)
  }
  process.stdout.write('\n')
  return removed
}

const buckets = INCLUDE_ASSETS ? [...PHOTO_BUCKETS, ASSET_BUCKET] : PHOTO_BUCKETS

console.log(`\nphotobooth cleanup  ${CONFIRM ? '— DELETING' : '(dry run)'}`)
console.log(`buckets: ${buckets.join(', ')}`)
if (!INCLUDE_ASSETS) console.log(`(${ASSET_BUCKET} left alone; pass --include-assets to include it)`)
console.log('')

const plan = []
let total = 0
for (const bucket of buckets) {
  const paths = await listAll(bucket)
  plan.push([bucket, paths])
  total += paths.length
  // Counts only. Object paths embed session identifiers, so they are not printed.
  console.log(`  ${bucket.padEnd(26)} ${String(paths.length).padStart(5)} objects`)
}
console.log(`  ${''.padEnd(26)} ${String(total).padStart(5)} total\n`)

if (!CONFIRM) {
  console.log('Dry run only. Nothing was deleted.')
  console.log('Re-run with --confirm to delete. THIS CANNOT BE UNDONE.\n')
  process.exit(0)
}

if (total === 0) {
  console.log('Nothing to delete.\n')
  process.exit(0)
}

for (const [bucket, paths] of plan) {
  if (paths.length) await removeAll(bucket, paths)
}

// Verify by re-listing rather than trusting the delete calls' return values.
console.log('\nverifying...')
let leftover = 0
for (const bucket of buckets) {
  const remaining = await listAll(bucket)
  leftover += remaining.length
  console.log(`  ${bucket.padEnd(26)} ${String(remaining.length).padStart(5)} remaining`)
}

if (leftover === 0) {
  console.log('\n✅  All listed photobooth objects are gone.\n')
} else {
  console.log(`\n⚠  ${leftover} object(s) still present. Re-run, or check bucket policies.\n`)
  process.exit(1)
}
