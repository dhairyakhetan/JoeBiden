// Shared parsing helpers for the post-detail route. Split out of PostPage.tsx
// (structural pass) so both the header (title/meta chips) and the body
// (highlights/body text) sub-components can use them without importing
// from each other.

export type PostMeta = { label: string; value: string }

// Most posts are structured: a title on line 1, then a block of "Key: value"
// metadata lines (Type / Location / Impact / Volunteers …), then a free-form
// narrative. The old page crammed all of that into the <h1>. This pulls the
// three apart so each can be presented properly. Plain prose posts (no metadata)
// fall through to title = first line, body = the rest.
export function parsePost(raw: string): { title: string; meta: PostMeta[]; body: string } {
  const lines = (raw || '').replace(/\r/g, '').split('\n')
  const title = (lines[0] || '').trim()
  const meta: PostMeta[] = []
  const metaRe = /^([A-Za-z][A-Za-z /&]{1,22}):\s*(.+)$/
  let i = 1
  for (; i < lines.length; i++) {
    const ln = lines[i]
    if (!ln.trim()) { if (meta.length) { i++; break } continue } // blank line closes the meta block
    const m = ln.match(metaRe)
    if (m) meta.push({ label: m[1].trim(), value: m[2].trim() })
    else break
  }
  const body = lines.slice(i).join('\n').trim()
  // A single long sentence with no structure reads badly as a giant headline -
  // lead with it as body instead.
  if (!meta.length && !body && title.length > 90) return { title: '', meta: [], body: title }
  return { title, meta, body }
}

export const META_ICON: Record<string, string> = {
  location: '📍', volunteers: '👥', date: '🗓', type: '✦', school: '🏫', impact: '★',
}
