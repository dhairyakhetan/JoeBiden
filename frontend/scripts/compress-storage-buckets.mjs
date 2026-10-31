/**
 * AquaTerra storage-quota remediation (2026-09-08).
 *
 * Supabase Storage usage is 1.258 GB against a Free-tier 1 GB cap, and
 * Supabase enforces `exceed_storage_size_quota` as a PROJECT-WIDE PostgREST
 * block, not just a Storage-API block - it broke reads on welfare_projects,
 * blogs, teams and job_openings too (confirmed in the 2026-09-08 build log:
 * all four returned HTTP 402 from the anon REST endpoint).
 *
 * 1.25 GB of the 1.258 GB total (99%) sits in two PRIVATE buckets used by the
 * Paradox photobooth kiosk (not this repo's code - an external app writes to
 * them directly): `photobooth-raw-photos` (1,831 JPEGs, ~699 MB) and
 * `photobooth-print-sheets` (522 PDFs, ~550 MB). Everything a live member
 * actually sees (post-images, project-images, avatars) is ~39 MB combined and
 * is deliberately NOT touched by this script.
 *
 * This script recompresses those two buckets IN PLACE:
 *   - raw JPEGs: re-encoded via sharp/mozjpeg, capped at 2000px longest side
 *   - print-sheet PDFs: recompressed via Ghostscript (`-dPDFSETTINGS=/ebook`,
 *     ~150dpi image downsampling - plenty for an archived print-sheet copy)
 *
 * This is LOSSY and IRREVERSIBLE. Originals are not kept anywhere. Always run
 * --dry-run first and read the projected savings before running for real.
 *
 * Requires service-role key (bypasses RLS / private-bucket policies) and a
 * local Ghostscript install (this machine has one at
 * C:\Program Files\gs\gs10.07.1\bin\gswin64c.exe - override via GS_BIN if
 * yours lives elsewhere).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/compress-storage-buckets.mjs --dry-run
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/compress-storage-buckets.mjs
 *
 * Get the service key from:
 *   Supabase Dashboard -> Project Settings -> API -> service_role key
 * Never commit it, never paste it into chat - pass it inline on the command
 * line only, same convention as scripts/seed-teams.mjs.
 */

import { createClient } from '@supabase/supabase-js'
import { serviceKey, SERVICE_KEY_ENV_NAME } from './serviceKey.mjs'
import sharp from 'sharp'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

const SUPABASE_URL = 'https://hzowuwffjqtgszecngpe.supabase.co'
const SERVICE_KEY = serviceKey()
const DRY_RUN = process.argv.includes('--dry-run')
const CONCURRENCY = 6

if (!SERVICE_KEY) {
  console.error('\n\u274c  SUPABASE_SERVICE_KEY environment variable is required.')
  console.error('   Run: SUPABASE_SERVICE_KEY=<key> node scripts/compress-storage-buckets.mjs [--dry-run]\n')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// Ghostscript ships as gswin64c.exe on Windows, not `gs` - point at the known
// install path on this machine; override with GS_BIN elsewhere.
const GS_BIN = process.env.GS_BIN || 'C:\\Program Files\\gs\\gs10.07.1\\bin\\gswin64c.exe'

const JPEG_MAX_DIM = 2000
const JPEG_QUALITY = 74

// Biggest-usage-first. post-images/project-images/avatars are public,
// member-facing content and deliberately excluded from this pass.
const TARGETS = [
  { bucket: 'photobooth-raw-photos', kind: 'jpeg' },
  { bucket: 'photobooth-print-sheets', kind: 'pdf' },
]

function mapLimit(items, limit, fn) {
  return new Promise((resolve, reject) => {
    const results = new Array(items.length)
    let next = 0
    let active = 0
    let done = 0
    let rejected = false
    function kick() {
      if (rejected) return
      while (active < limit && next < items.length) {
        const i = next++
        active++
        fn(items[i], i).then(r => {
          results[i] = r
          active--
          done++
          if (done === items.length) resolve(results)
          else kick()
        }).catch(e => { rejected = true; reject(e) })
      }
    }
    if (items.length === 0) resolve(results)
    else kick()
  })
}

// Every object in both buckets lives at exactly `<session-uuid>/<file>`
// (confirmed via storage.objects depth query - no outliers), so this only
// ever needs to walk one folder level deep.
async function listAllObjects(bucket) {
  const out = []
  const { data: top, error } = await db.storage.from(bucket).list('', { limit: 1000 })
  if (error) throw new Error(`list(${bucket}): ${error.message}`)
  for (const entry of top) {
    if (entry.id === null) {
      const { data: inner, error: innerErr } = await db.storage.from(bucket).list(entry.name, { limit: 1000 })
      if (innerErr) throw new Error(`list(${bucket}/${entry.name}): ${innerErr.message}`)
      for (const f of inner) out.push(`${entry.name}/${f.name}`)
    } else {
      out.push(entry.name)
    }
  }
  return out
}

async function compressJpeg(bytes) {
  return sharp(bytes)
    .rotate()
    .resize({ width: JPEG_MAX_DIM, height: JPEG_MAX_DIM, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}

async function compressPdf(bytes) {
  const dir = await mkdtemp(join(tmpdir(), 'aq-pdfcompress-'))
  const inPath = join(dir, 'in.pdf')
  const outPath = join(dir, 'out.pdf')
  try {
    await writeFile(inPath, bytes)
    await execFileAsync(GS_BIN, [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      '-dPDFSETTINGS=/ebook',
      '-dNOPAUSE', '-dBATCH', '-dQUIET',
      `-sOutputFile=${outPath}`,
      inPath,
    ])
    return await readFile(outPath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function fmtMB(bytes) { return (bytes / 1024 / 1024).toFixed(2) }

async function run() {
  console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== LIVE RUN (will overwrite objects in place) ===')

  let totalBefore = 0
  let totalAfter = 0
  let ok = 0, skipped = 0, failed = 0
  const failures = []

  for (const { bucket, kind } of TARGETS) {
    console.log(`\n--- ${bucket} ---`)
    const paths = await listAllObjects(bucket)
    console.log(`${paths.length} objects found`)
    let processed = 0

    await mapLimit(paths, CONCURRENCY, async (path) => {
      try {
        const { data: blob, error: dlErr } = await db.storage.from(bucket).download(path)
        if (dlErr) throw new Error(`download: ${dlErr.message}`)
        const original = Buffer.from(await blob.arrayBuffer())

        const compressed = kind === 'jpeg' ? await compressJpeg(original) : await compressPdf(original)

        totalBefore += original.length
        const useCompressed = compressed.length < original.length
        totalAfter += useCompressed ? compressed.length : original.length

        if (!useCompressed) {
          skipped++
        } else if (!DRY_RUN) {
          const { error: upErr } = await db.storage.from(bucket).update(path, compressed, {
            contentType: kind === 'jpeg' ? 'image/jpeg' : 'application/pdf',
            upsert: true,
          })
          if (upErr) throw new Error(`upload: ${upErr.message}`)
          ok++
        } else {
          ok++
        }
      } catch (e) {
        failed++
        failures.push(`${bucket}/${path}: ${e.message}`)
      } finally {
        processed++
        if (processed % 100 === 0) console.log(`  ${processed}/${paths.length} processed...`)
      }
    })
  }

  console.log('\n=== SUMMARY ===')
  console.log(`objects compressed: ${ok}, skipped (already smaller): ${skipped}, failed: ${failed}`)
  console.log(`before: ${fmtMB(totalBefore)} MB`)
  console.log(`after:  ${fmtMB(totalAfter)} MB`)
  console.log(`saved:  ${fmtMB(totalBefore - totalAfter)} MB (${(100 * (1 - totalAfter / totalBefore)).toFixed(1)}%)`)
  if (failures.length) {
    console.log(`\nfailures (${failures.length}):`)
    for (const f of failures.slice(0, 20)) console.log(`  ${f}`)
    if (failures.length > 20) console.log(`  ...and ${failures.length - 20} more`)
  }
  if (DRY_RUN) console.log('\nDry run only - nothing was written. Re-run without --dry-run to apply.')
}

run().catch(e => { console.error(e); process.exit(1) })
