// One-off maintenance screen: shrink the drive photos ALREADY in the bucket.
//
// WHY THIS EXISTS AS A PAGE AND NOT A SCRIPT
// `lib/resizeImage.ts` fixed every FUTURE upload, but it does nothing for the
// files already stored. Fixing those needs three things at once: a canvas to
// downscale with, and write access to the bucket, and no service-role key
// anywhere near the repo. A Node script would need `sharp` (a new dependency)
// AND the service-role key (which must never be checked in or pasted). Doing it
// in the browser needs neither: the canvas is right here, and a super admin's
// OWN session already has write access to `project-images` — it is the same
// permission `ProjectManager`'s uploader uses. So the blast radius is exactly
// the permission the person running it already had.
//
// WHY THE STORED FILE HAS TO CHANGE AT ALL, rather than resizing at render
// time: Supabase's transform endpoint (`/storage/v1/render/image/...`) returns
// `403 FeatureNotEnabled` on this project — Storage Image Transformation is a
// paid add-on and is not on. Re-confirmed live 2026-09-07. `sized()` therefore
// cannot help a Supabase-hosted image, and the only lever left is the bytes.
//
// SAFETY, in the order it matters:
//  1. DRY RUN FIRST, always. Nothing is written until you press Apply, and
//     Apply only ever touches rows you can see the numbers for.
//  2. THE ORIGINAL IS COPIED to `_originals/<name>` BEFORE the overwrite, and
//     a file whose backup copy fails is SKIPPED, not overwritten. Every change
//     is reversible by copying back.
//  3. THE PATH NEVER CHANGES, so not one database row is touched. `main_image`
//     and friends keep pointing exactly where they pointed. If every upload
//     here failed, the site would be unchanged.
//  4. A re-encode that comes out LARGER is skipped — `resizeImageFile` already
//     returns the original in that case, and we compare sizes again here.
//
// DEV-ONLY: routed under `import.meta.env.DEV` in App.tsx, so it is not in the
// production bundle. It is a maintenance tool, not a product surface.

import { useCallback, useMemo, useState } from 'react'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { useAuth } from '../auth/AuthContext'
import { isSuperAdmin } from '../lib/roles'
import { MAX_EDGE, resizeImageFile } from '../lib/resizeImage'

const BUCKET = 'project-images'
const BACKUP_PREFIX = '_originals'

/** Files at or under this are already fine; re-encoding them buys nothing. */
const ALREADY_SMALL = 200 * 1024

type Row = {
  name: string
  before: number
  after: number | null
  status: 'measured' | 'skipped-small' | 'skipped-nogain' | 'done' | 'failed'
  note?: string
}

function kb(n: number): string {
  return n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(2) + ' MB' : Math.round(n / 1024) + ' kB'
}

export default function ReencodeImages() {
  const { member } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'dry' | 'applied'>('idle')
  const [log, setLog] = useState<string[]>([])

  const say = useCallback((s: string) => setLog(l => [...l, s]), [])

  const totals = useMemo(() => {
    const measured = rows.filter(r => r.after != null)
    const before = measured.reduce((a, r) => a + r.before, 0)
    const after = measured.reduce((a, r) => a + (r.after ?? 0), 0)
    return { before, after, saved: before - after, n: measured.length }
  }, [rows])

  /** Download + downscale every object, WITHOUT writing anything. */
  const dryRun = useCallback(async () => {
    setBusy(true); setRows([]); setLog([]); setPhase('dry')
    try {
      const { data: objects, error } = await supabaseCommunity
        .storage.from(BUCKET).list('', { limit: 1000 })
      if (error) throw error

      // `_originals/` is the backup folder this tool writes; never re-encode
      // a backup, or a second run would shrink the very copy kept for undo.
      const files = (objects || []).filter(o => o.name && !o.name.startsWith(BACKUP_PREFIX) && o.id)
      say(`${files.length} object(s) in ${BUCKET}`)

      const out: Row[] = []
      for (const o of files) {
        const before = Number((o.metadata as Record<string, unknown> | null)?.size ?? 0)
        if (before > 0 && before <= ALREADY_SMALL) {
          out.push({ name: o.name, before, after: null, status: 'skipped-small' })
          setRows([...out]); continue
        }
        try {
          const { data: blob, error: dlErr } = await supabaseCommunity.storage.from(BUCKET).download(o.name)
          if (dlErr || !blob) throw dlErr || new Error('no body')
          const asFile = new File([blob], o.name, { type: blob.type || 'image/jpeg' })
          const shrunk = await resizeImageFile(asFile, { maxEdge: MAX_EDGE.project, forceJpeg: true })
          // resizeImageFile returns the ORIGINAL object when it could not do
          // better, so identity is the honest "no gain" signal.
          const gained = shrunk !== asFile && shrunk.size < asFile.size
          out.push({
            name: o.name,
            before: asFile.size,
            after: shrunk.size,
            status: gained ? 'measured' : 'skipped-nogain',
          })
        } catch (e) {
          out.push({ name: o.name, before, after: null, status: 'failed', note: String((e as Error)?.message || e) })
        }
        setRows([...out])
      }
      say('dry run complete — nothing was written')
    } catch (e) {
      say('FAILED: ' + String((e as Error)?.message || e))
    } finally { setBusy(false) }
  }, [say])

  /** Back up, then overwrite in place. Same path, so no DB row moves. */
  const apply = useCallback(async () => {
    setBusy(true); setPhase('applied')
    try {
      const todo = rows.filter(r => r.status === 'measured')
      say(`applying to ${todo.length} file(s)`)
      const next = [...rows]
      for (const r of todo) {
        const i = next.findIndex(x => x.name === r.name)
        try {
          const { data: blob, error: dlErr } = await supabaseCommunity.storage.from(BUCKET).download(r.name)
          if (dlErr || !blob) throw dlErr || new Error('download failed')

          // Back up FIRST. `upsert: false` so a re-run cannot overwrite a good
          // backup with an already-shrunk file — that would destroy the undo.
          const { error: bkErr } = await supabaseCommunity.storage.from(BUCKET)
            .upload(`${BACKUP_PREFIX}/${r.name}`, blob, { upsert: false, contentType: blob.type || 'image/jpeg' })
          const backedUp = !bkErr || /exists/i.test(bkErr.message)
          if (!backedUp) throw new Error('backup failed, refusing to overwrite: ' + bkErr.message)

          const asFile = new File([blob], r.name, { type: blob.type || 'image/jpeg' })
          const shrunk = await resizeImageFile(asFile, { maxEdge: MAX_EDGE.project, forceJpeg: true })
          if (shrunk === asFile || shrunk.size >= asFile.size) {
            next[i] = { ...r, status: 'skipped-nogain' }; setRows([...next]); continue
          }

          // Same path, new bytes. The extension may now disagree with the
          // format (a .png holding JPEG), which is fine and deliberate:
          // browsers honour Content-Type, not the extension, and keeping the
          // path identical is what makes this a zero-database-write change.
          const { error: upErr } = await supabaseCommunity.storage.from(BUCKET)
            .upload(r.name, shrunk, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
          if (upErr) throw upErr

          next[i] = { ...r, after: shrunk.size, status: 'done' }
        } catch (e) {
          next[i] = { ...r, status: 'failed', note: String((e as Error)?.message || e) }
        }
        setRows([...next])
      }
      say('apply complete')
    } catch (e) {
      say('FAILED: ' + String((e as Error)?.message || e))
    } finally { setBusy(false) }
  }, [rows, say])

  if (!member || !isSuperAdmin(member.role)) {
    return <main style={{ padding: 24, fontFamily: 'monospace' }}>super admin only.</main>
  }

  return (
    <main style={{ padding: 24, fontFamily: 'monospace', fontSize: 13, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20 }}>re-encode stored drive photos</h1>
      <p style={{ lineHeight: 1.6 }}>
        Shrinks images already in <code>{BUCKET}</code>. Originals are copied to
        {' '}<code>{BACKUP_PREFIX}/</code> before anything is overwritten, and the object
        path never changes, so no database row is touched.
      </p>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
        <button onClick={dryRun} disabled={busy} style={{ minHeight: 44, padding: '0 16px' }}>
          {busy && phase === 'dry' ? 'measuring…' : '1 · dry run (writes nothing)'}
        </button>
        <button
          onClick={apply}
          disabled={busy || !rows.some(r => r.status === 'measured')}
          style={{ minHeight: 44, padding: '0 16px' }}
        >
          2 · apply to {rows.filter(r => r.status === 'measured').length} file(s)
        </button>
      </div>

      {totals.n > 0 && (
        <p>
          <b>{totals.n}</b> file(s) would shrink: {kb(totals.before)} → {kb(totals.after)}
          {' '}(<b>saves {kb(totals.saved)}</b>,{' '}
          {Math.round((totals.saved / Math.max(totals.before, 1)) * 100)}%)
        </p>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ textAlign: 'left' }}><th>file</th><th>before</th><th>after</th><th>status</th></tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.name} style={{ borderTop: '1px solid #ddd' }}>
              <td style={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</td>
              <td>{kb(r.before)}</td>
              <td>{r.after == null ? '—' : kb(r.after)}</td>
              <td>{r.status}{r.note ? ` (${r.note})` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <pre style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>
    </main>
  )
}
