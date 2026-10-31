import { useEffect, useRef, useState } from 'react'
import { CANONICAL_ORIGIN } from '../hooks/useMeta'
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import { useModalA11y } from '../hooks/useDialog'
import {
  AdminLayout, AdminTabHeader, DataToolbar, EmptyLedger, FilterPill,
  AdminSkeleton, AdminErrorState, AdminRow, StatusStamp,
} from './adminKit'
import { useToast } from '../components/Toast'
import feedService from '../services/feedService'
import yearbookService, { YearbookEntry } from '../services/yearbookService'
import { useDebounce } from '../hooks/useDebounce'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { sized } from '../lib/imageUrl'
import PosterStudioModal from '../components/PosterStudioModal'
import type { PosterData } from '../components/posterGenerator'
import '../styles/routes/director-people.css'

const CURRENT_EDITION = new Date().getFullYear()

/**
 * The yearbook desk - a director/HR picks members for this year's edition,
 * each gets a notification (yearbookService.inviteMembers) prompting them
 * to `/yearbook`. Submitted entries export straight into the existing
 * Instagram poster generator (components/posterGenerator.ts /
 * PosterStudioModal.tsx) - a yearbook entry is just fed in as PosterData,
 * no new export machinery needed.
 */
export default function YearbookManagement() {
  const toast = useToast()
  // Escape, the Tab trap, focus-in/focus-restore and the body scroll-lock for
  // the invite picker, from the app's one shared implementation.
  const pickerRef = useRef<HTMLDivElement | null>(null)
  const [entries, setEntries] = useState<YearbookEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'invited' | 'submitted' | 'skipped'>('all')

  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [results, setResults] = useState<{ memberId: number; uuid: string; fullName: string; avatarUrl?: string }[]>([])
  // The results area was a bare `{results.map(...)}`: a search in flight, a
  // search that matched nobody and a search that FAILED all rendered the same
  // empty box, so HR read a thrown query as "that student isn't a member."
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  /** Bumped by "try again" - re-runs the effect without changing the query. */
  const [searchRetry, setSearchRetry] = useState(0)
  const [selected, setSelected] = useState<Map<number, string>>(new Map()) // memberId -> fullName
  const [inviting, setInviting] = useState(false)
  useModalA11y(pickerOpen, pickerRef, () => setPickerOpen(false), inviting)

  const [posterData, setPosterData] = useState<PosterData | null>(null)

  const load = () => {
    setLoading(true); setLoadError(null)
    yearbookService.listForEdition(CURRENT_EDITION)
      .then(setEntries)
      .catch(e => setLoadError(e?.message || 'Something went wrong.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  useEffect(() => {
    if (!pickerOpen || !debouncedSearch.trim()) { setResults([]); setSearchState('idle'); return }
    let cancelled = false
    setSearchState('loading')
    feedService.searchMembers(debouncedSearch)
      .then(r => {
        if (cancelled) return
        // A `success: false` payload used to fall through silently, leaving the
        // previous query's results on screen under the new search text.
        if (r.success) { setResults(r.data.members); setSearchState('done') }
        else { setResults([]); setSearchState('error') }
      })
      .catch(() => { if (!cancelled) { setResults([]); setSearchState('error') } })
    return () => { cancelled = true }
  }, [pickerOpen, debouncedSearch, searchRetry])

  const toggleSelect = (memberId: number, fullName: string) => {
    setSelected(prev => {
      const next = new Map(prev)
      if (next.has(memberId)) next.delete(memberId); else next.set(memberId, fullName)
      return next
    })
  }

  const handleInvite = async () => {
    if (selected.size === 0) return
    setInviting(true)
    try {
      const result = await yearbookService.inviteMembers(Array.from(selected.keys()), CURRENT_EDITION)
      toast.success(`invited ${result.invited}${result.alreadyInvited ? `, ${result.alreadyInvited} already on the list` : ''}.`)
      setSelected(new Map()); setSearch(''); setResults([]); setPickerOpen(false)
      load()
    } catch (e: any) {
      toast.error('couldn’t send those invites.', e?.message || 'try again.')
    } finally {
      setInviting(false)
    }
  }

  const copyHrPrompt = async () => {
    // The URL is built from CANONICAL_ORIGIN, not typed. It read
    // "aquaterra.org/yearbook" - a domain this organisation does not own - and
    // HR pastes this message to students, who would land nowhere.
    const text = `hey! you're in this year's AquaTerra yearbook 🎉 head to the website (you'll see a notification) and take two minutes to pick a photo and write a one-line quote - ${CANONICAL_ORIGIN}/yearbook`
    // The success toast used to sit OUTSIDE the try, so a rejected clipboard
    // write (no permission, insecure context, Safari without a user gesture)
    // still reported "copied" and HR pasted whatever was on the clipboard
    // before.
    try {
      await navigator.clipboard.writeText(text)
      toast.success('copied - paste it wherever.')
    } catch {
      toast.error("couldn't copy that.", 'Your browser blocked clipboard access - select the message and copy it by hand.')
    }
  }

  const openExport = (entry: YearbookEntry) => {
    const photo = entry.useOwnAvatar ? entry.memberAvatarUrl : entry.photoUrl
    setPosterData({
      body: entry.quote || '',
      authorName: entry.memberName || 'AquaTerra member',
      imageUrl: photo || undefined,
    })
  }

  const filtered = entries.filter(e => statusFilter === 'all' || e.status === statusFilter)
  const submittedCount = entries.filter(e => e.status === 'submitted').length

  return (
    <AdminLayout>
      <AdminTabHeader
        label="Yearbook"
        title={`${CURRENT_EDITION} yearbook`}
        subtitle={`${entries.length} invited · ${submittedCount} submitted`}
        actions={<button className="btn btn-sm btn-primary yb-invite" onClick={() => setPickerOpen(true)}>+ invite members</button>}
      />

      {/* This desk's entire job is a completion rate, and the rate was one
          unemphasised clause in the subtitle. The bar is derived from the SAME
          two numbers - nothing new is fetched, so it can never show a figure
          the desk did not measure - and it is absent, not zero-width, before
          anyone has been invited. */}
      {entries.length > 0 && (
        <div
          className="adm-progress"
          role="img"
          aria-label={`${submittedCount} of ${entries.length} invited members have submitted`}
        >
          <i style={{ width: `${Math.round((submittedCount / entries.length) * 100)}%` }} />
        </div>
      )}

      <div className="row gap-2" style={{ margin: '14px 0 16px' }}>
        {/* The 📋 was interface chrome, not copy - the settled rule is that
            emoji inside frozen human copy stays and emoji used as chrome
            becomes a heroicon. The 🎉 in the invite message below is the
            other half of that rule and is untouched. */}
        <button className="btn btn-sm yb-copy" onClick={copyHrPrompt}>
          <ClipboardDocumentIcon width={15} height={15} strokeWidth={1.8} aria-hidden /> copy invite message
        </button>
      </div>

      <DataToolbar>
        <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>all</FilterPill>
        <FilterPill active={statusFilter === 'invited'} onClick={() => setStatusFilter('invited')}>invited</FilterPill>
        <FilterPill active={statusFilter === 'submitted'} onClick={() => setStatusFilter('submitted')}>submitted</FilterPill>
        <FilterPill active={statusFilter === 'skipped'} onClick={() => setStatusFilter('skipped')}>skipped</FilterPill>
      </DataToolbar>

      {loading ? (
        <AdminSkeleton rows={5} />
      ) : loadError ? (
        <AdminErrorState message={`Could not load the yearbook - ${loadError}`} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyLedger message="nobody here yet" sub="invite members to start this year's yearbook." />
      ) : (
        filtered.map(entry => (
          <AdminRow
            key={entry.id}
            // A skipped entry is CLOSED, not failed: nobody is waiting on it
            // and there is nothing to chase, so it steps back out of the scan
            // rather than sitting at full weight beside live work.
            className={entry.status === 'skipped' ? 'yb-skipped' : undefined}
            stamp={<StatusStamp label={entry.status} tone={entry.status === 'submitted' ? 'approved' : entry.status === 'skipped' ? 'rejected' : 'pending'} />}
            primary={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="people-av" style={{ width: 28, height: 28, fontSize: 11, background: hashColor(entry.memberName || '') }}>
                  {entry.memberAvatarUrl
                    ? <img src={sized(entry.memberAvatarUrl, 'avatar')} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : getInitials(entry.memberName || '?')}
                </div>
                {entry.memberName}
              </div>
            }
            secondary={
              entry.quote
                // The one thing on this desk anyone actually READS, set as
                // reading type instead of 12.5px scanning type. The literal
                // quote marks are already in the string; no CSS quotes.
                ? <span className="adm-quote">{`"${entry.quote}"`}</span>
                : entry.status === 'invited' ? 'waiting on them' : undefined
            }
            meta={entry.status === 'submitted' ? <span className="yb-ready">ready to export</span> : ''}
            actions={entry.status === 'submitted' ? (
              <button className="btn btn-sm btn-primary yb-export" onClick={() => openExport(entry)}>export →</button>
            ) : undefined}
          />
        ))
      )}

      {pickerOpen && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) setPickerOpen(false) }}>
          {/* The panel declared aria-modal="true", which tells assistive tech
              the rest of the page is inert, while Tab walked straight out into
              it and Escape did nothing. useModalA11y is the shared primitive
              that makes the claim true; `inviting` doubles as the busy flag so
              Escape cannot dismiss mid-write. */}
          <div ref={pickerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Invite members to the yearbook" className="modal">
            <div className="modal-head">
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, margin: 0 }}>invite to the yearbook</h3>
              <button className="btn btn-sm" onClick={() => setPickerOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="modal-body">
              <input className="input" style={{ width: '100%', marginBottom: 12 }} placeholder="search members by name…" aria-label="Search members by name" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
              {selected.size > 0 && (
                <div className="row gap-2" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
                  {Array.from(selected.entries()).map(([id, name]) => (
                    // Was a <span onClick>: not focusable, no role, no key
                    // handler, so a keyboard user could select a member for the
                    // yearbook but never deselect one.
                    <button
                      key={id}
                      type="button"
                      className="chip chip-active yb-chip"
                      onClick={() => toggleSelect(id, name)}
                      aria-label={`Remove ${name} from the invite list`}
                      style={{ cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                    >{name} ✕</button>
                  ))}
                </div>
              )}
              <div style={{ maxHeight: 260, overflowY: 'auto' }} aria-live="polite" aria-busy={searchState === 'loading'}>
                {searchState === 'idle' && (
                  <p className="muted" style={{ fontSize: 13, padding: '12px 6px', margin: 0 }}>type a name to find members.</p>
                )}
                {searchState === 'loading' && (
                  <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 8 }} aria-hidden="true">
                    {[1, 2, 3].map(i => <div key={i} className="v6-skeleton" style={{ height: 30, borderRadius: 'var(--r-tight)', animationDelay: `${i * 0.08}s` }} />)}
                  </div>
                )}
                {searchState === 'error' && (
                  <div style={{ padding: '12px 6px' }}>
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>that search didn’t run. this isn’t “no such member.”</p>
                    <button type="button" className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setSearchRetry(n => n + 1)}>try again</button>
                  </div>
                )}
                {searchState === 'done' && results.length === 0 && (
                  <p className="muted" style={{ fontSize: 13, padding: '12px 6px', margin: 0 }}>no members match “{debouncedSearch.trim()}”.</p>
                )}
                {/* Gated: without this the PREVIOUS query's members stayed
                    on screen underneath the loading skeleton and the error
                    text, so HR could select a member the current search had
                    nothing to do with. */}
                {searchState === 'done' && results.map(m => (
                  // Was a <div onClick>: the entire member picker was
                  // mouse-only. A button with aria-pressed also announces the
                  // selected state, which the bare check glyph never did.
                  <button
                    key={m.memberId}
                    type="button"
                    onClick={() => toggleSelect(m.memberId, m.fullName)}
                    aria-pressed={selected.has(m.memberId)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', cursor: 'pointer', borderRadius: 'var(--r-tight)', background: selected.has(m.memberId) ? 'var(--bg-2)' : 'transparent', width: '100%', border: 'none', textAlign: 'left', font: 'inherit', color: 'inherit', minHeight: 44 }}
                  >
                    <div className="people-av" style={{ width: 30, height: 30, fontSize: 11, background: hashColor(m.fullName) }}>
                      {m.avatarUrl ? <img src={sized(m.avatarUrl, 'avatar')} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : getInitials(m.fullName)}
                    </div>
                    <span style={{ flex: 1 }}>{m.fullName}</span>
                    {selected.has(m.memberId) && <span aria-hidden>✓</span>}
                  </button>
                ))}
              </div>
              <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-sm" onClick={() => setPickerOpen(false)} disabled={inviting}>cancel</button>
                <button className="btn btn-sm btn-primary" onClick={handleInvite} disabled={inviting || selected.size === 0}>
                  {inviting ? 'inviting…' : `invite ${selected.size || ''}`.trim()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {posterData && <PosterStudioModal data={posterData} onClose={() => setPosterData(null)} />}
    </AdminLayout>
  )
}
