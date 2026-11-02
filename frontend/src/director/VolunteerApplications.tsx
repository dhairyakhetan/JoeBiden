import './VolunteerApplications.css'
import { useState, useEffect, useCallback, Fragment, useRef } from 'react'
import { supabaseCommunity as supabase } from '../lib/supabaseCommunity'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { logAction } from '../lib/auditLog'
import { sanitizeFilterTerm } from '../lib/pgrestEscape'
import {
  AdminLayout, AdminTabHeader, DataToolbar, EmptyLedger,
  AdminSkeleton, AdminErrorState, BulkActionBar, BottomSheet, useIsPhone,
} from './adminKit'
import { ExclamationCircleIcon } from '@heroicons/react/24/outline'

import {
  LABELS, LMAP, UNMARKED_FILTER, buildXlsHtml, formatDate, waHref,
  LabelChip, LabelDots, AppDetail, AppCard,
  type VolApp, type LabelFilterKey,
} from './VolunteerApplicationsParts'

/* REDESIGN 2026-09, section 19, the responsive half.
   ────────────────────────────────────────────────────────────────────────
   EXACTLY TWO LAYOUTS. The seven-column table survives unchanged at
   >= 1025px; below it the same rows render as cards. There is deliberately
   no third layout in between, so a 900px tablet gets the card ledger rather
   than a squeezed table with two columns missing.

   Mirrors MemberDirectory's DESKTOP_TABLE_MQ (section 13) rather than
   adminKit's `useIsPhone`, because the split is at the desktop tier, not the
   phone one. Gating in JS rather than with a paired `display: none` rule
   means only one layout is ever in the DOM: no row's checkbox, status dots
   or disclosure button exists twice under the same accessible name. */
const DESKTOP_TABLE_MQ = '(min-width: 1025px)'
function useIsDeskTable(): boolean {
  const [isDesk, setIsDesk] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_TABLE_MQ).matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(DESKTOP_TABLE_MQ)
    const onChange = () => setIsDesk(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesk
}

/* ── Desk ──────────────────────────────────────────────────────────────── */

export default function VolunteerApplications() {
  const { success, error: toastError } = useToast()
  const confirm = useConfirm()
  const [apps, setApps] = useState<VolApp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // A FAILED infinite-scroll append, distinct from `error`: the whole-page
  // error render is gated on `apps.length === 0`, so a page-2 failure showed
  // nothing at all and left the sentinel's spinner saying "loading page 2 of
  // 7" forever - the observer only re-fires when intersection CHANGES, and the
  // sentinel never left the viewport. This turns the sentinel into a retry.
  const [appendError, setAppendError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [markingId, setMarkingId] = useState<number | null>(null)
  const [exporting, setExporting] = useState(false)
  // Presentation only: the phone bulk sheet, and the inline record of a
  // partial batch failure.
  const [bulkOpen, setBulkOpen] = useState(false)
  const [batchFailure, setBatchFailure] = useState<string | null>(null)
  const isPhone = useIsPhone()
  const isDeskTable = useIsDeskTable()
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [liveOn, setLiveOn] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [batchWorking, setBatchWorking] = useState(false)
  const [labelFilter, setLabelFilter] = useState<LabelFilterKey | null>(null)
  const [copied, setCopied] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)
  // Bumped on every fresh (non-append) load. A response whose generation is no
  // longer current belongs to an old filter and is dropped, so a filter change
  // during a load-more can never append old-filter rows.
  const genRef = useRef(0)
  const pageRef = useRef(1)
  const PAGE = 20

  // Refs so fetchApps always reads the latest filter values without needing to be recreated
  const filterRef = useRef(filter)
  const searchRef = useRef(search)
  const labelFilterRef = useRef(labelFilter)
  filterRef.current = filter
  searchRef.current = search
  labelFilterRef.current = labelFilter

  const fetchApps = useCallback(async (pg: number, append = false, retry = 0) => {
    // Capture current filter values at call time (before any await)
    const currentFilter = filterRef.current
    // Sanitized before interpolation into .or() below - `,`/`()` are filter
    // grammar and would 400 (or worse, reshape) the request.
    const currentSearch = sanitizeFilterTerm(searchRef.current.toLowerCase())
    const currentLabelFilter = labelFilterRef.current
    if (!append && retry === 0) genRef.current += 1
    const gen = genRef.current

    if (!append) setLoading(true)
    setError(null); setAppendError(null)
    try {
      const start = (pg - 1) * PAGE
      const end   = pg * PAGE - 1

      let query = supabase
        .from('volunteer_applications')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(start, end)

      // Push filters to DB - avoids downloading the whole table
      if (currentFilter === 'pending')  query = query.or('reviewed.is.null,reviewed.eq.false')
      if (currentFilter === 'reviewed') query = query.eq('reviewed', true)
      if (currentLabelFilter === 'unmarked') query = query.is('vol_label' as any, null)
      else if (currentLabelFilter)           query = query.eq('vol_label' as any, currentLabelFilter)
      if (currentSearch)                query = query.or(`full_name.ilike.%${currentSearch}%,email.ilike.%${currentSearch}%`)

      const { data, error: err, count } = await query
      if (gen !== genRef.current) return // superseded by a newer filter/reload
      if (err) throw err
      const slice = (data || []) as VolApp[]
      const rowTotal = count ?? 0
      setTotal(rowTotal)
      if (append) setApps(prev => [...prev, ...slice])
      else        setApps(slice)
      setHasMore(pg * PAGE < rowTotal)
      setLoading(false)
    } catch (e: any) {
      if (gen !== genRef.current) return
      const msg: string = e?.message || String(e)
      // Supabase auth-lock contention (realtime + fetch racing on startup) - transient, retry
      if (retry < 3 && (msg.includes('stole') || msg.toLowerCase().includes('lock'))) {
        setTimeout(() => fetchApps(pg, append, retry + 1), 700)
        return
      }
      if (append) setAppendError(msg)
      else setError(`Failed to load applications - ${msg}`)
      setLoading(false)
    }
  }, []) // stable reference - reads filter state from refs above

  useEffect(() => { setPage(1); pageRef.current = 1; setSelected(new Set()); fetchApps(1) }, [filter, search, labelFilter, fetchApps])

  // Infinite scroll: fire next page when sentinel enters the viewport
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingMoreRef.current) {
        loadingMoreRef.current = true
        // Side effect out of the setState updater (it ran twice under StrictMode).
        const next = pageRef.current + 1
        pageRef.current = next
        setPage(next)
        fetchApps(next, true).finally(() => { loadingMoreRef.current = false })
      }
    }, { rootMargin: '120px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, fetchApps])

  useEffect(() => {
    const channel = supabase
      .channel('vol-apps-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'volunteer_applications' }, payload => {
        const row = payload.new as VolApp
        setApps(prev => prev.some(a => a.id === row.id)
          ? prev.map(a => a.id === row.id ? { ...a, ...row } : a)
          : prev)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'volunteer_applications' }, () =>
        setNewCount(n => n + 1))
      .subscribe(status => setLiveOn(status === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(channel) }
  }, [])

  const copyPhone = async (id: number, phone: string) => {
    try {
      await navigator.clipboard.writeText(phone)
      setCopiedId(id)
      setTimeout(() => setCopiedId(c => c === id ? null : c), 1500)
    } catch {
      toastError('couldn’t copy that.', 'Clipboard access was blocked.')
    }
  }

  const loadNew = () => { setNewCount(0); setPage(1); pageRef.current = 1; fetchApps(1) }

  const markReviewed = async (id: number, reviewed: boolean) => {
    setMarkingId(id)
    const { data: upd, error: err } = await supabase.from('volunteer_applications').update({ reviewed }).eq('id', id).select('id')
    setMarkingId(null)
    if (err || !upd || upd.length === 0) {
      const msg = err?.message || 'no row was updated (check permissions)'
      setError(`Failed to update - ${msg}`); toastError('that didn’t save.', msg); return
    }
    setApps(prev => prev.map(a => a.id === id ? { ...a, reviewed } : a))
    success(reviewed ? 'Marked as reviewed' : 'Marked as not reviewed')
  }

  const updateApp = async (id: number, patch: Partial<VolApp>) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    const { data, error: err } = await supabase
      .from('volunteer_applications').update(patch as any).eq('id', id).select('id')
    if (err || !data || data.length === 0) {
      const msg = err?.message || 'no row updated (check permissions)'
      setError(`Couldn't save - ${msg}`)
      toastError("Couldn't save change", msg)
      const { data: fresh } = await supabase.from('volunteer_applications').select('*').eq('id', id).maybeSingle()
      if (fresh) setApps(prev => prev.map(a => a.id === id ? (fresh as VolApp) : a))
      return
    }
    success('Saved')
  }

  const setLabel = (id: number, label: string | null, prevLabel: string | null = null) => {
    const patch: Partial<VolApp> = { vol_label: label }
    if (label === 'texted') patch.texted = true
    else if (prevLabel === 'texted') patch.texted = false
    updateApp(id, patch)
  }

  const copySelected = async () => {
    const rows = apps.filter(a => selected.has(a.id))
    const text = rows.map(a => {
      const school = [a.college, a.year_of_study].filter(Boolean).join(', ')
      return [a.full_name, a.email, a.phone ?? '', a.instagram_handle ?? '', school].filter(Boolean).join('\t')
    }).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      toastError('couldn’t copy that.', 'Clipboard access was blocked.')
    }
  }

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toggleSelectAll = () =>
    setSelected(selected.size === apps.length ? new Set() : new Set(apps.map(a => a.id)))

  const batchSetLabel = async (label: string | null) => {
    setBatchWorking(true)
    setBatchFailure(null)
    const ids = Array.from(selected)
    const before = new Map(apps.filter(a => selected.has(a.id)).map(a => [a.id, a.vol_label ?? null]))
    setApps(prev => prev.map(a => selected.has(a.id) ? { ...a, vol_label: label } : a))
    // .select('id') so a policy that filters the row out (zero rows, no error)
    // counts as a failure instead of looking like success.
    const results = await Promise.all(ids.map(id =>
      supabase.from('volunteer_applications').update({ vol_label: label } as any).eq('id', id).select('id')
    ))
    const failedIds = ids.filter((_, i) => results[i].error || !results[i].data || results[i].data!.length === 0)
    setSelected(new Set())
    setBatchWorking(false)
    if (failedIds.length > 0) {
      // Roll the rows that did not save back to what they were, then reload
      // from page 1 so the list is the database's truth.
      setApps(prev => prev.map(a => failedIds.includes(a.id) ? { ...a, vol_label: before.get(a.id) ?? null } : a))
      toastError(`${failedIds.length} of ${ids.length} couldn't be updated`, 'The list has been reloaded.')
      setBatchFailure(`${failedIds.length} of ${ids.length} couldn't be updated. The list was reloaded to show the current state.`)
      setPage(1); pageRef.current = 1
      fetchApps(1)
    } else {
      success(label ? `Labelled ${ids.length} as "${label}"` : `Cleared labels on ${ids.length}`)
    }
  }

  const exportXLS = async () => {
    if (!(await confirm({
      title: 'Export applicants?',
      body: 'This downloads a spreadsheet with names, emails and phone numbers. Keep it private and delete it when you are done. The export is recorded in the activity log.',
      confirmLabel: 'Export',
    }))) return
    setExporting(true)
    setError(null)
    try {
      let exportQuery = supabase
        .from('volunteer_applications').select('*').order('created_at', { ascending: false })
      if (filter === 'pending')  exportQuery = exportQuery.or('reviewed.is.null,reviewed.eq.false')
      if (filter === 'reviewed') exportQuery = exportQuery.eq('reviewed', true)
      if (labelFilter === 'unmarked') exportQuery = exportQuery.is('vol_label' as any, null)
      else if (labelFilter)           exportQuery = exportQuery.eq('vol_label' as any, labelFilter)
      const q = sanitizeFilterTerm(search.toLowerCase())
      if (q) {
        exportQuery = exportQuery.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      }
      const { data, error: err } = await exportQuery
      if (err) throw err

      // Filename spells out the category filter too (not just pending/all/
      // reviewed) so a category-scoped export is visibly distinct.
      const labelSlug = labelFilter ? `-${labelFilter}` : ''
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob(['﻿' + buildXlsHtml((data || []) as VolApp[])], { type: 'application/vnd.ms-excel;charset=utf-8' }))
      a.download = `aq-vol-apps-${filter}${labelSlug}-${new Date().toISOString().slice(0, 10)}.xls`
      a.click()
      URL.revokeObjectURL(a.href)
      logAction('volunteer_applications_exported', 'volunteer_applications', undefined, {
        rows: (data || []).length, review_filter: filter, label_filter: labelFilter ?? 'all', searched: !!q,
      })
      success('exported.')
    } catch (e: any) {
      const msg = e?.message || String(e)
      setError(`Export failed - ${msg}`)
      toastError('export didn’t build.', msg)
    } finally {
      setExporting(false)
    }
  }

  const allSelected = apps.length > 0 && selected.size === apps.length
  const exportLabel = labelFilter ? (labelFilter === 'unmarked' ? 'Unmarked' : LMAP[labelFilter]?.name) : null

  return (
    <AdminLayout>
      <div style={{ paddingBottom: 80 }}>

        <AdminTabHeader
          label="Recruitment"
          title="Volunteer applications"
          count={total}
          subtitle="Volunteer-interest leads for outreach. New members join through Google sign-in; this list is for following up with people who showed interest."
          actions={liveOn ? (
            <span className="mono vol-live" title="Live - edits appear automatically">
              <span className="vol-live-dot" />live
            </span>
          ) : undefined}
        />

        {/* One shared toolbar: search, the review-state chips, this desk's
            five pipeline chips, and the export action. */}
        <DataToolbar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Search by name or email…"
          actions={
            <button className="btn btn-sm" onClick={exportXLS}
              disabled={exporting || loading || total === 0}
              title={`Export ${filter} applications${exportLabel ? ` - ${exportLabel}` : ''} as colour-coded Excel (${total} row${total === 1 ? '' : 's'})`}
              style={{ whiteSpace: 'nowrap' }}>
              {exporting ? 'exporting…' : exportLabel ? `⬇ Export ${exportLabel} XLS` : '⬇ Export XLS'}
            </button>
          }
        >
          {(['pending', 'all', 'reviewed'] as const).map(f => (
            <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={'adm-pill' + (filter === f ? ' is-active' : '')}>
              {f === 'pending' ? '★ pending' : f}
            </button>
          ))}
          <span className="vol-legend-label">Status key</span>
          <LabelChip color={UNMARKED_FILTER.color} name={UNMARKED_FILTER.name} dashed hollow
            active={labelFilter === 'unmarked'}
            onClick={() => setLabelFilter(labelFilter === 'unmarked' ? null : 'unmarked')} />
          {LABELS.map(l => (
            <LabelChip key={l.key} color={l.color} name={l.name} active={labelFilter === l.key}
              onClick={() => setLabelFilter(labelFilter === l.key ? null : l.key)} />
          ))}
        </DataToolbar>

        {/* The export takes the FILTERED set, not the page on screen, and names
            the filter in the filename. Both facts lived only in a hover title,
            which a phone cannot show at all. The row count and the three
            disabled conditions read from the same values the button's own
            `disabled` already uses; nothing is recomputed here. */}
        <p className="adm-note is-quiet" style={{ margin: '0 0 12px' }}>
          exports {total} row{total === 1 ? '' : 's'} in the current filter, not just the page on screen.
          {' '}unavailable while exporting, while the list is loading, or with nothing to export.
        </p>

        {batchFailure && (
          <div role="alert" className="adm-alert">
            <ExclamationCircleIcon strokeWidth={1.8} aria-hidden />
            <span>{batchFailure}</span>
          </div>
        )}

        {newCount > 0 && (
          <button onClick={loadNew} className="btn btn-sm"
            style={{ width: '100%', marginBottom: 12, justifyContent: 'center', background: 'var(--accent-bg)', borderColor: 'var(--accent-br)', color: 'var(--accent)' }}>
            ↻ {newCount} new application{newCount > 1 ? 's' : ''} - load
          </button>
        )}

        {loading ? (
          <AdminSkeleton rows={6} />
        ) : error && apps.length === 0 ? (
          <AdminErrorState message={error} onRetry={() => { setPage(1); fetchApps(1) }} />
        ) : apps.length === 0 ? (
          <EmptyLedger
            message={filter === 'pending' ? 'all caught up' : 'nothing here'}
            sub={filter === 'pending' ? 'No pending volunteer applications.' : 'No applications match your filters.'}
            action={
              /* Only on the filtered pair. "all caught up" is a real state of
                 the world; "nothing here" is a state the reader created, and
                 an empty ledger that offers no way back out of the filter
                 reads as "there is no work" when the work is simply hidden. */
              filter !== 'pending' || search || labelFilter ? (
                <button
                  type="button"
                  className="adm-actpill"
                  onClick={() => { setSearch(''); setFilter('pending'); setLabelFilter(null) }}
                >clear filters</button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Brutalist panel shell (.card + .panel-h) - the table itself
                scrolls inside .vol-tablewrap so the 3px-ink shell never
                scrolls its own border away. Desktop tier only: below 1025px
                the card ledger in the other branch replaces all of it. */}
            {isDeskTable ? (
            <div className="card" style={{ padding: 0 }}>
              <div className="panel-h">
                <b>application ledger</b>
                <span className="mono xs muted adm-nums">{total} row{total === 1 ? '' : 's'}</span>
              </div>
            <div className="vol-tablewrap">
              <table className="vol-table">
                <thead>
                  <tr className="vol-headrow">
                    <th className="vol-th vol-th-check">
                      <input type="checkbox" className="vol-check" checked={allSelected}
                        ref={el => { if (el) el.indeterminate = selected.size > 0 && !allSelected }}
                        onChange={toggleSelectAll} aria-label="Select all rows" />
                    </th>
                    <th className="vol-th vol-th-num">#</th>
                    <th className="vol-th">Name</th>
                    <th className="vol-th">College / Year</th>
                    <th className="vol-th">Applied</th>
                    <th className="vol-th vol-th-status">Status</th>
                    <th className="vol-th vol-th-chev" />
                  </tr>
                </thead>
                <tbody>
                  {apps.map((app, idx) => {
                    const isOpen    = expanded === app.id
                    const rowNum    = (page - 1) * PAGE + idx + 1
                    const isChecked = selected.has(app.id)
                    const lc        = app.vol_label ? LMAP[app.vol_label]?.color : undefined
                    const open      = () => setExpanded(isOpen ? null : app.id)

                    return (
                      <Fragment key={app.id}>
                        <tr
                          className={'vol-row'
                            + (isOpen ? ' is-open' : '')
                            + (lc ? ' is-labelled' : '')
                            + (isChecked ? ' is-checked' : '')}
                          style={lc ? { ['--lc' as any]: lc } : undefined}
                        >
                          <td className="vol-td vol-td-check">
                            <input type="checkbox" className="vol-check" checked={isChecked}
                              onChange={() => toggleSelect(app.id)}
                              onClick={e => e.stopPropagation()}
                              aria-label={`Select ${app.full_name}`} />
                          </td>

                          {/* # + pending dot.
                              REDESIGN 2026-09. This cell used to be TWO
                              different controls wearing the same clothes: a
                              wa.me link when the applicant had a phone, and an
                              expand button when they did not, with no visual
                              difference at all. github.md calls it "the desk's
                              worst hidden affordance", and because this is a
                              WhatsApp-outreach desk the phone case is the
                              majority, which meant the row's ONLY keyboard-
                              reachable expand control rendered in the minority
                              branch. A keyboard user could not open most rows.

                              The number is now always the expand button. The
                              WhatsApp action is not lost: it is the labelled
                              "WA" chip beside the applicant's name, one cell
                              over, which already existed and says what it does. */}
                          <td className="vol-td vol-td-num">
                            <div className="vol-numcell">
                              <div className={'vol-pending-dot' + (!app.reviewed ? ' is-pending' : '')} />
                              <button
                                type="button"
                                onClick={open}
                                className="vol-rownum adm-nums"
                                aria-expanded={isOpen}
                                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${app.full_name}`}
                                style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                              >{rowNum}</button>
                            </div>
                          </td>

                          <td className="vol-td" style={{ maxWidth: 240 }} onClick={open}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div className="qname vol-cell-clip">{app.full_name}</div>
                              {app.phone && (
                                <a href={waHref(app.phone)} target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()} title={`WhatsApp ${app.full_name}`}
                                  className="vol-wa-btn">
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                  </svg>
                                  WA
                                </a>
                              )}
                            </div>
                            <div className="qsub vol-cell-clip">{app.email}</div>
                          </td>

                          <td className="vol-td" style={{ maxWidth: 180 }} onClick={open}>
                            <div className="vol-college">{app.college || <span style={{ color: 'var(--ink-3)' }}>-</span>}</div>
                            {app.year_of_study && <div className="vol-year">{app.year_of_study}</div>}
                          </td>

                          <td className="vol-td vol-applied adm-nums" onClick={open}>
                            {formatDate(app.created_at)}
                          </td>

                          <td className="vol-td vol-td-status">
                            <LabelDots current={app.vol_label} onSet={key => setLabel(app.id, key, app.vol_label)} />
                          </td>

                          <td className="vol-td vol-td-chev" onClick={open}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                              className="vol-chev" style={{ transform: isOpen ? 'rotate(180deg)' : undefined }} aria-hidden>
                              <path d="m6 9 6 6 6-6"/>
                            </svg>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr>
                            <td colSpan={7} className={'vol-detail-cell' + (lc ? ' is-labelled' : '')}
                              style={lc ? { ['--lc' as any]: lc } : undefined}>
                              <AppDetail
                                app={app}
                                copiedId={copiedId}
                                onCopyPhone={copyPhone}
                                onUpdate={updateApp}
                                onMarkReviewed={markReviewed}
                                marking={markingId === app.id}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </div>
            ) : (
              /* ── The card ledger, < 1025px ────────────────────────────
                 Same `apps.map`, same handlers, one data path: nothing here
                 fetches or writes anything the table does not. Fields keep
                 the table's order - select, row number, name and email,
                 college and year, applied, status, disclosure - and the two
                 `.panel-h` strings become a plain caption row, because a
                 3px-ink shell wrapping 2px-ink cards is two frames for one
                 list. */
              <>
                <div className="vol-ledger-cap">
                  <b>application ledger</b>
                  <span className="mono xs muted adm-nums">{total} row{total === 1 ? '' : 's'}</span>
                </div>

                {/* Select-all has no header row to live in down here. It
                    becomes a named 44px control whose visible text is also
                    its accessible name, and it still means "every LOADED
                    row" (`apps.length`), never all of `total`. */}
                <label className="vol-selectall">
                  <input type="checkbox" className="vol-check" checked={allSelected}
                    ref={el => { if (el) el.indeterminate = selected.size > 0 && !allSelected }}
                    onChange={toggleSelectAll} />
                  <span>{selected.size === 0
                    ? `select all ${apps.length}`
                    : `${selected.size} of ${apps.length}`}</span>
                </label>

                <div className="adm-ledger">
                  {apps.map((app, idx) => (
                    <AppCard
                      key={app.id}
                      app={app}
                      rowNum={(page - 1) * PAGE + idx + 1}
                      isChecked={selected.has(app.id)}
                      isOpen={expanded === app.id}
                      marking={markingId === app.id}
                      copiedId={copiedId}
                      onToggleSelect={() => toggleSelect(app.id)}
                      onOpen={() => setExpanded(expanded === app.id ? null : app.id)}
                      onSetLabel={key => setLabel(app.id, key, app.vol_label)}
                      onCopyPhone={copyPhone}
                      onUpdate={updateApp}
                      onMarkReviewed={markReviewed}
                    />
                  ))}
                </div>
              </>
            )}

            {hasMore && (
              <div ref={sentinelRef} style={{ minHeight: 64, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', justifyContent: 'center', padding: appendError ? '12px 0' : 0 }}>
                {appendError ? (
                  // The spinner used to keep spinning here forever. It now says
                  // what happened and offers the retry the observer cannot
                  // perform on its own.
                  <>
                    <span className="adm-note" role="status">
                      page {page} of {Math.max(1, Math.ceil(total / PAGE))} didn’t load - {appendError}
                    </span>
                    <button className="btn btn-sm" onClick={() => { loadingMoreRef.current = true; fetchApps(page, true).finally(() => { loadingMoreRef.current = false }) }}>
                      try again
                    </button>
                  </>
                ) : (
                  <>
                    <div className="vol-spinner" />
                    {/* Derived from `total` and PAGE, never counted: an unlabelled
                        spinner at the foot of an infinite list says nothing about
                        how much is left. */}
                    <span className="adm-note is-quiet" role="status">
                      loading page {page + 1} of {Math.max(1, Math.ceil(total / PAGE))}
                    </span>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Batch action bar - shared shell (count/clear/positioning) from adminKit;
            the label dots + copy button are this desk's own actions. */}
        {/* Five naked colour dots labelling up to twenty rows at once, with no
            names, no row context and no undo. They stay exactly as they are
            from 601px up, where there is room and a mouse to hover them. On a
            phone they become one button opening a NAMED sheet whose title
            states the count and whose rows carry the label names. Same
            `batchSetLabel`; no second write path. `⧉ copy` stays inline. */}
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())} busy={batchWorking}>
          {isPhone ? (
            <button disabled={batchWorking} onClick={() => setBulkOpen(true)} className="vol-bulk-btn">label…</button>
          ) : (
            <>
              {LABELS.map(l => (
                <button key={l.key} disabled={batchWorking} onClick={() => batchSetLabel(l.key)}
                  className="vol-bulk-dot" style={{ ['--lc' as any]: l.color }}
                  title={`Mark all as: ${l.name}`} aria-label={`Mark all as: ${l.name}`} />
              ))}
              <button disabled={batchWorking} onClick={() => batchSetLabel(null)} className="vol-bulk-btn">clear</button>
              <div className="vol-bulk-sep" />
            </>
          )}
          <button onClick={copySelected} className={'vol-bulk-btn' + (copied ? ' is-done' : '')}
            title="Copy name, email and phone for each selected row (tab-separated)">
            {copied ? '✓ copied' : '⧉ copy'}
          </button>
        </BulkActionBar>

        <BottomSheet open={bulkOpen} onClose={() => setBulkOpen(false)} title={`Label ${selected.size} applications`}>
          <p className="adm-note" style={{ marginTop: 0 }}>this writes vol_label on every selected row</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {LABELS.map(l => (
              <button key={l.key} className="adm-sheet-opt" disabled={batchWorking}
                onClick={() => { setBulkOpen(false); batchSetLabel(l.key) }}>
                <span className="adm-swatch" style={{ ['--sw' as any]: l.color, width: 13, height: 13 }} aria-hidden />
                <span style={{ flex: '1 1 auto', minWidth: 0 }}>{l.name}</span>
              </button>
            ))}
            <div style={{ height: 2, background: 'rgba(10,10,10,.18)', margin: '4px 0' }} aria-hidden />
            <button className="adm-sheet-opt" disabled={batchWorking}
              onClick={() => { setBulkOpen(false); batchSetLabel(null) }}>clear</button>
          </div>
        </BottomSheet>

      </div>
    </AdminLayout>
  )
}
