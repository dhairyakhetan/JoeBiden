import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withRetry } from '../lib/asyncUtils'
import { COLLAB_TYPES } from '../public/CollaborationsPage'
import {
  AdminLayout, AdminTabHeader, DataToolbar, EmptyLedger, FilterPill,
  StatusStamp, AdminSkeleton, AdminRow, AdminErrorState, BulkActionBar,
  BottomSheet, useIsPhone, useRowSelection, type StampTone,
} from './adminKit'
import { getCached, setCached } from '../lib/swrCache'
import { useToast } from '../components/Toast'
import {
  ChevronDownIcon, ChevronUpIcon, ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

// Collaboration + contact form submissions both live in the welfare/legacy
// Supabase project (the public site writes them there). This tab surfaces them
// in the HoD desk so directors can read enquiries without leaving the app.
//
// Shapes mirror the inserts in CollaborationsPage / ContactPage. Both tables
// now carry a `status text default 'new'` column (contact_submissions got it
// via migration 017 - collaboration_submissions already had it) so directors
// can track follow-up instead of this being a read-only list.
//
// The desk-standard structure applies: header → toolbar → skeleton/error/
// empty/rows. The submitted message is long-form, so it lives behind the row's
// expand toggle rather than being dumped inline on every row.
// §20.6 (UX-GAPS.md item 21): 'in_progress' sits between 'new' and
// 'contacted' - it marks "someone has claimed this and is replying" so a
// second HoD opening the same enquiry can see that before they also start
// replying. Both tables' `status` column is plain unconstrained `text`
// (verified live - no CHECK constraint), so this is a pure frontend enum
// addition: no migration needed. 'new'/'contacted'/'closed' and their
// labels are UNCHANGED - this only inserts one value, it doesn't rename the
// three that already ship, which would be a copy change these desks don't
// get to make.
//
// NOT DONE: the changelog also asks for "in progress... with the claimer's
// name." Neither table has a column to hold who claimed it (only
// id/created_at/.../message/status) - attributing the status change to a
// person needs a new `claimed_by` column, which is a real Supabase schema
// change and out of this pass's invariants (no Supabase changes). Reported,
// not built: the status value ships, the attribution doesn't.
type SubmissionStatus = 'new' | 'in_progress' | 'contacted' | 'closed'
type CollabRow = {
  id: number
  org_name: string
  contact_name: string
  email: string
  phone: string | null
  collab_type: string | null
  message: string
  created_at: string
  status: SubmissionStatus
}
type ContactRow = {
  id: number
  name: string
  email: string
  phone: string | null
  role: string | null
  message: string
  created_at: string
  status: SubmissionStatus
}

const STATUS_TONE: Record<SubmissionStatus, StampTone> = {
  new: 'pending', in_progress: 'custom', contacted: 'custom', closed: 'approved',
}

/**
 * Shell tint only. The select stays a native `<select>` with its capitalised
 * option labels untouched - the tint just lets a row's status read without
 * opening the menu, which is the whole job of a triage list.
 */
const STATUS_TINT: Record<SubmissionStatus, string> = {
  new: 'color-mix(in srgb, var(--lemon) 26%, var(--card))',
  in_progress: 'color-mix(in srgb, var(--events) 22%, var(--card))',
  contacted: 'color-mix(in srgb, var(--sky) 22%, var(--card))',
  closed: 'color-mix(in srgb, var(--welfare) 22%, var(--card))',
}

type Kind = 'collab' | 'contact'

/** One flat shape both tables render through - the row markup is identical. */
type Row = {
  id: number
  title: string
  tag: string | null
  who: string | null
  email: string
  phone: string | null
  message: string
  created_at: string
  status: SubmissionStatus
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return iso }
}

/**
 * One labelled row inside the bordered contact panel. Labels, values, the
 * mailto and the tel link are all unchanged; only the shape is - three
 * baseline-aligned lines with a hand-set 64px label column became a real
 * definition list with hairline dividers and a 56px column, which is the
 * same `.adm-fields` panel the rest of the desk uses.
 */
function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="adm-fieldrow">
      <dt>{label}</dt>
      <dd>
        {href
          ? <a href={href} style={{ color: 'var(--ink)', textDecoration: 'underline', wordBreak: 'break-word' }}>{value}</a>
          : <span style={{ color: 'var(--ink-2)', wordBreak: 'break-word' }}>{value}</span>}
      </dd>
    </div>
  )
}

const COLLAB_CACHE_KEY = 'aq_form_collabs_v1'
const CONTACT_CACHE_KEY = 'aq_form_contacts_v1'

export default function FormResponses() {
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('collab')
  // Hydrate from cache synchronously - the legacy welfare project these
  // tables live in is cross-region (~450-500ms per query measured), so a
  // repeat visit this session should paint instantly instead of paying that
  // round-trip again behind a blocking skeleton every single time.
  const cachedCollabs = getCached<CollabRow[]>(COLLAB_CACHE_KEY)
  const cachedContacts = getCached<ContactRow[]>(CONTACT_CACHE_KEY)
  const [collabs, setCollabs] = useState<CollabRow[]>(cachedCollabs ?? [])
  const [contacts, setContacts] = useState<ContactRow[]>(cachedContacts ?? [])
  const [loading, setLoading] = useState(cachedCollabs === null && cachedContacts === null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SubmissionStatus>('all')
  // §20.6: "COLLAB_TYPES from CollaborationsPage drives the type filter."
  // Only collaboration submissions carry a bounded `collab_type` vocabulary -
  // contact_submissions' `role` is free text, so this filter only applies
  // (and only renders) while `kind === 'collab'`.
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Per-row busy, keyed `kind:id` - one row's status write never blocks another.
  const [busy, setBusy] = useState<Set<string>>(new Set())
  // The cache strip's two states. `hadCache` is read once, at mount, from the
  // same synchronous read the rows are painted from, so the strip can never
  // claim a cache that was not actually used.
  const hadCache = cachedCollabs !== null || cachedContacts !== null
  const [revalidating, setRevalidating] = useState(hadCache)
  const [staleFailed, setStaleFailed] = useState(false)
  // A denied write reverts the row optimistically and silently. The toast is
  // gone in five seconds; this panel stays beside the row that changed back.
  const [writeError, setWriteError] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const isPhone = useIsPhone()

  useEffect(() => {
    let active = true
    ;(async () => {
      const [c, k] = await withRetry(async () => Promise.all([
        // Bounded: these tables only grow - cap at the 200 most recent rather
        // than shipping the full history to the browser on every desk visit.
        supabase.from('collaboration_submissions').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('contact_submissions').select('*').order('created_at', { ascending: false }).limit(200),
      ]))
      if (!active) return
      // Both failing usually means the tables don't grant read access yet.
      // On a cache hit, keep showing the stale data rather than an error -
      // this is a background revalidation, not the user's first load.
      if (c.error && k.error) {
        if (cachedCollabs === null && cachedContacts === null) {
          setError("the form tables may not allow read access for this role yet.")
        } else {
          // Cache hit: the stale rows stay on screen, so the desk has to say
          // out loud that they are stale rather than looking freshly loaded.
          setStaleFailed(true)
        }
      } else {
        // ONE of the two failing is the dangerous case, and it used to land
        // here. `?? []` turned the failed side's null into an empty list, that
        // empty list was committed AND written to the cache, and setError(null)
        // cleared every failure surface - so a broken `contact_submissions`
        // read rendered "no messages yet - New submissions from the public site
        // will appear here automatically" with no error and no retry, while
        // real enquiries went unanswered.
        //
        // Each side is now handled on its own: a side that errored keeps
        // whatever it had, never overwrites the cache, and raises the stale
        // strip so the desk says out loud that it is not showing fresh data.
        if (!c.error) {
          const nextCollabs = (c.data as CollabRow[] | null) ?? []
          setCollabs(nextCollabs)
          setCached(COLLAB_CACHE_KEY, nextCollabs)
        }
        if (!k.error) {
          const nextContacts = (k.data as ContactRow[] | null) ?? []
          setContacts(nextContacts)
          setCached(CONTACT_CACHE_KEY, nextContacts)
        }
        const partial = !!c.error || !!k.error
        // A first load with nothing cached and one side down has nothing to be
        // stale ABOUT - that is a real error, not stale data.
        const nothingCached = cachedCollabs === null && cachedContacts === null
        setError(partial && nothingCached
          ? 'one of the form tables would not load. Some responses may be missing.'
          : null)
        setStaleFailed(partial && !nothingCached)
      }
      setLoading(false)
      setRevalidating(false)
    })()
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  const updateStatus = async (row: Row, status: SubmissionStatus) => {
    const key = `${kind}:${row.id}`
    const table = kind === 'collab' ? 'collaboration_submissions' : 'contact_submissions'
    const prevCollabs = collabs
    const prevContacts = contacts
    const nextCollabs = prevCollabs.map(c => c.id === row.id ? { ...c, status } : c)
    const nextContacts = prevContacts.map(c => c.id === row.id ? { ...c, status } : c)

    setBusy(prev => new Set(prev).add(key))
    setWriteError(null)
    if (kind === 'collab') setCollabs(nextCollabs); else setContacts(nextContacts)

    // .select('id') + 0-row check so a silently-denied write (e.g. missing RLS
    // UPDATE grant) surfaces as an error instead of a false-success toast.
    const { data: updated, error: e } = await supabase.from(table).update({ status }).eq('id', row.id).select('id')
    setBusy(prev => { const next = new Set(prev); next.delete(key); return next })
    if (e || !updated || updated.length === 0) {
      if (kind === 'collab') setCollabs(prevCollabs); else setContacts(prevContacts)
      toast.error('status didn’t change.', e?.message || 'You may not have permission.')
      setWriteError(`${row.title}: status didn’t change. ${e?.message || 'You may not have permission.'}`)
    } else {
      if (kind === 'collab') setCached(COLLAB_CACHE_KEY, nextCollabs)
      else setCached(CONTACT_CACHE_KEY, nextContacts)
      setWriteError(null)
      toast.success('status updated.')
    }
  }

  const toggleExpand = (key: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const allRows = useMemo<Row[]>(() => (
    kind === 'collab'
      ? collabs.map(r => ({
        id: r.id, title: r.org_name, tag: r.collab_type, who: r.contact_name,
        email: r.email, phone: r.phone, message: r.message, created_at: r.created_at, status: r.status,
      }))
      : contacts.map(r => ({
        id: r.id, title: r.name, tag: r.role, who: null,
        email: r.email, phone: r.phone, message: r.message, created_at: r.created_at, status: r.status,
      }))
  ), [kind, collabs, contacts])

  const term = search.trim().toLowerCase()
  // Memoised so useRowSelection's items identity is stable between renders
  // (it clears the selection on identity change - wanted on filter/tab change,
  // not on every render).
  const rows = useMemo(() => allRows
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    // Only meaningful for collab rows (see typeFilter's own comment) - a
    // stale collab-type selection left over from the other tab must never
    // silently filter out every contact row.
    .filter(r => kind !== 'collab' || typeFilter === 'all' || r.tag === typeFilter)
    .filter(r => !term
      || r.title.toLowerCase().includes(term)
      || r.email.toLowerCase().includes(term)
      || (r.who || '').toLowerCase().includes(term)
      || r.message.toLowerCase().includes(term)),
    [allRows, statusFilter, typeFilter, kind, term])

  // Selection is keyed `kind:id` (collab and contact ids are separate numeric
  // spaces); switching tab yields a fresh array and clears the selection.
  const selectItems = useMemo(() => rows.map(r => ({ id: `${kind}:${r.id}` })), [rows, kind])
  const selection = useRowSelection(selectItems)
  const [bulkBusy, setBulkBusy] = useState(false)

  const bulkSetStatus = async (status: SubmissionStatus) => {
    const targets = rows.filter(r => selection.isSelected(`${kind}:${r.id}`))
    if (targets.length === 0) return
    const ids = targets.map(t => t.id)
    selection.clear()
    const table = kind === 'collab' ? 'collaboration_submissions' : 'contact_submissions'
    const prevCollabs = collabs, prevContacts = contacts
    const nextCollabs = collabs.map(c => ids.includes(c.id) ? { ...c, status } : c)
    const nextContacts = contacts.map(c => ids.includes(c.id) ? { ...c, status } : c)
    setBulkBusy(true)
    setWriteError(null)
    if (kind === 'collab') setCollabs(nextCollabs); else setContacts(nextContacts)
    const { data: updated, error: e } = await supabase.from(table).update({ status }).in('id', ids).select('id')
    setBulkBusy(false)
    if (e || !updated || updated.length === 0) {
      if (kind === 'collab') setCollabs(prevCollabs); else setContacts(prevContacts)
      toast.error('couldn’t update those.', e?.message || 'You may not have permission.')
      setWriteError(`${targets.length} rows changed back. ${e?.message || 'You may not have permission.'}`)
    } else {
      if (kind === 'collab') setCached(COLLAB_CACHE_KEY, nextCollabs); else setCached(CONTACT_CACHE_KEY, nextContacts)
      toast.success(`Marked ${targets.length} ${status}`)
    }
  }

  const tabs: { key: Kind; label: string; count: number }[] = [
    { key: 'collab', label: 'Collaborations', count: collabs.length },
    { key: 'contact', label: 'Contact', count: contacts.length },
  ]

  return (
    <AdminLayout>
      <AdminTabHeader
        label="Enquiries"
        title="Form responses"
        subtitle="Collaboration requests and contact messages from the public site."
        count={collabs.length + contacts.length}
      />

      {/* The kind tabs swap the DATA SOURCE - two different tables with two
          separate numeric id spaces - so they are a mode switch, not a filter
          of one list, and must not look like the status pills below them.
          Labels and their counts are unchanged. */}
      <div className="adm-seg" role="group" aria-label="Table" style={{ marginBottom: 12 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            className={kind === t.key ? 'is-active' : ''}
            aria-pressed={kind === t.key}
            onClick={() => setKind(t.key)}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search name, email, or message…">
        <div className="adm-hscroll">
          <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>all</FilterPill>
          {(['new', 'in_progress', 'contacted', 'closed'] as const).map(s => (
            <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s === 'in_progress' ? 'in progress' : s}</FilterPill>
          ))}
        </div>
      </DataToolbar>

      {/* §20.6: COLLAB_TYPES imported from CollaborationsPage, not retyped.
          Only for the collab tab - contact_submissions has no equivalent
          bounded vocabulary to filter by.
          Deliberately a SIBLING of DataToolbar, not a second child inside it:
          `.adm-toolbar-filters` is itself a flex item with a content-based
          (not zero) default min-width, so a second non-shrinking `.adm-hscroll`
          sharing that flex line pushed the whole page 76px wider at 1280px
          instead of scrolling internally. As an ordinary block here, under
          `.adm-layout`'s own fixed max-width, it gets a real width ceiling and
          scrolls inside itself the way every other `.adm-hscroll` does. */}
      {/* It stays a sibling - see above, moving it into the toolbar is the bug
          that comment records - but it no longer LOOKS like a continuation of
          the status row above it. Two identical `.adm-hscroll` rows of
          `.adm-pill` stacked directly on top of each other read as one
          undifferentiated wall, which on a phone was the fourth and fifth
          control row before a single enquiry. The label says which question
          this row answers, and the margins move out of inline styles so the
          desk's own ≤600px rules can compact them. */}
      {kind === 'collab' && (
        <div className="fr-typefilter">
          <span className="mono xs upper muted" style={{ fontWeight: 700, flex: 'none' }}>type</span>
          <div className="adm-hscroll">
            <FilterPill active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>all types</FilterPill>
            {COLLAB_TYPES.map(t => (
              <FilterPill key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>{t}</FilterPill>
            ))}
          </div>
        </div>
      )}

      {/* The cache strip. These two tables live in a cross-region project
          measured at 450 to 500ms a query, so the desk paints from a session
          cache first and revalidates behind it - and when that revalidation
          fails it KEEPS the cached rows rather than blanking a working view.
          Both of those are deliberate, and until now neither was visible: a
          director could read rows of unknown age with no indication at all. */}
      {!loading && !error && (revalidating || staleFailed) && (
        <div className={'adm-cachestrip' + (staleFailed ? ' is-stale' : '')} role="status">
          <span className="adm-cachering" aria-hidden />
          <span>
            {staleFailed
              ? "showing this session's copy · the refresh failed, so these rows may be out of date"
              : "showing this session's copy · checking the welfare project for new ones"}
          </span>
        </div>
      )}

      {writeError && (
        <div role="alert" className="adm-alert">
          <ExclamationCircleIcon strokeWidth={1.8} aria-hidden />
          <span>{writeError}</span>
        </div>
      )}

      {loading ? (
        <AdminSkeleton rows={4} />
      ) : error ? (
        <AdminErrorState
          message={`Couldn't load enquiries - ${error}`}
          onRetry={() => { setError(null); setLoading(true); setReloadKey(k => k + 1) }}
        />
      ) : rows.length === 0 ? (
        <EmptyLedger
          message={allRows.length === 0
            ? `no ${kind === 'collab' ? 'collaboration requests' : 'messages'} yet`
            : 'nothing matches'}
          sub={allRows.length === 0
            ? 'New submissions from the public site will appear here automatically.'
            : 'Try a different search, status or type filter.'}
        />
      ) : (
        rows.map(r => {
          const key = `${kind}:${r.id}`
          const isOpen = expanded.has(key)
          return (
            <AdminRow
              key={key}
              busy={busy.has(key)}
              selected={selection.isSelected(key)}
              onSelect={() => selection.toggle(key)}
              stamp={<StatusStamp label={r.status === 'in_progress' ? 'in progress' : r.status} tone={STATUS_TONE[r.status]} color={r.status === 'contacted' ? 'var(--sky)' : r.status === 'in_progress' ? 'var(--events)' : undefined} />}
              primary={r.title}
              secondary={
                <>
                  {r.who && <>{r.who} · </>}
                  {r.email}
                  {r.phone && <> · {r.phone}</>}
                  {r.tag && (
                    <div className="adm-lcard-facts">
                      <span className="qtag" style={{ ['--cc' as any]: 'var(--paper)' }}>{r.tag}</span>
                    </div>
                  )}
                  {/* Was the tail of this same run-on line: an email, a phone
                      number, a role and then "read message ▾", with the only
                      cue that the row opens being the last fragment of the
                      sentence. Both word pairs are unchanged. */}
                  <button
                    type="button"
                    className="adm-disclose"
                    aria-expanded={isOpen}
                    onClick={e => { e.stopPropagation(); toggleExpand(key) }}
                  >
                    {isOpen ? 'hide message' : 'read message'}
                    {isOpen
                      ? <ChevronUpIcon strokeWidth={2.2} aria-hidden />
                      : <ChevronDownIcon strokeWidth={2.2} aria-hidden />}
                  </button>
                </>
              }
              meta={fmtDate(r.created_at)}
              onToggleExpand={() => toggleExpand(key)}
              expanded={isOpen ? (
                <>
                  <dl className="adm-fields" style={{ margin: '0 0 10px' }}>
                    {r.who && <Field label="Contact" value={r.who} />}
                    <Field label="Email" value={r.email} href={`mailto:${r.email}`} />
                    {r.phone && <Field label="Phone" value={r.phone} href={`tel:${r.phone}`} />}
                  </dl>
                  <div className="mono xs upper" style={{ fontWeight: 700, marginBottom: 6, color: 'var(--ink-3)' }}>message</div>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>{r.message}</p>
                </>
              ) : undefined}
              actions={
                <span className="adm-selectpill sop-statuspill" style={{ ['--tint' as any]: STATUS_TINT[r.status] }}>
                  <select
                    value={r.status}
                    onChange={e => updateStatus(r, e.target.value as SubmissionStatus)}
                    aria-label={`Status for ${r.title}`}
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In progress</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                  </select>
                  <ChevronDownIcon width={12} height={12} strokeWidth={2.2} aria-hidden />
                </span>
              }
            />
          )
        })
      )}

      {/* Two irreversible bulk verbs plus a count chip and a clear button do
          not fit 390px, so on a phone they collapse to one control opening a
          sheet whose TITLE states how many rows are about to change. The
          strings and the single write path are unchanged. */}
      <BulkActionBar count={selection.count} onClear={selection.clear} busy={bulkBusy}>
        {isPhone ? (
          <button className="btn btn-sm" onClick={() => setBulkOpen(true)}>mark…</button>
        ) : (
          <>
            <button className="btn btn-sm" onClick={() => bulkSetStatus('in_progress')}>mark in progress</button>
            <button className="btn btn-sm" onClick={() => bulkSetStatus('contacted')}>mark contacted</button>
            <button className="btn btn-sm adm-approve" onClick={() => bulkSetStatus('closed')}>mark closed</button>
          </>
        )}
      </BulkActionBar>

      <BottomSheet open={bulkOpen} onClose={() => setBulkOpen(false)} title={`Mark ${selection.count} enquiries`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="adm-sheet-opt" onClick={() => { setBulkOpen(false); bulkSetStatus('in_progress') }}>mark in progress</button>
          <button className="adm-sheet-opt" onClick={() => { setBulkOpen(false); bulkSetStatus('contacted') }}>mark contacted</button>
          <button className="adm-sheet-opt" onClick={() => { setBulkOpen(false); bulkSetStatus('closed') }}>mark closed</button>
        </div>
      </BottomSheet>
    </AdminLayout>
  )
}
