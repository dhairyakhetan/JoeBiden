import Img from '../components/Img'
import './ProjectManager.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, normalizeObj, OBJ_COLORS } from '../lib/supabase'
import { useConfirm } from '../components/Confirm'
import { useToast } from '../components/Toast'
import { bustProjectsCache } from '../lib/projectsCache'
import { withRetry } from '../lib/asyncUtils'
import {
  AdminLayout, AdminTabHeader, DataToolbar, FilterPill, EmptyLedger, AdminSkeleton, AdminErrorState,
} from './adminKit'
import { logAction } from '../lib/auditLog'
import { LIST_COLS, OBJECTIVES, friendlyDbError, canGoLive, HERO_REQUIRED_MESSAGE, type ListProject, type Project } from './ProjectManagerShared'
import ProjectModal from './ProjectModal'
import {
  ArrowPathIcon, CameraIcon, MapPinIcon, PencilSquareIcon,
  ArrowTopRightOnSquareIcon, TrashIcon,
} from '@heroicons/react/24/outline'

// Module-scoped list cache (mutable) - kept here, not in the shared module,
// because ESM bindings can't be reassigned across modules.
let _listCache: ListProject[] | null = null

// ─── Main component ─────────────────────────────────────────────────────────
export default function ProjectManager() {
  const [projects, setProjects] = useState<ListProject[]>(_listCache ?? [])
  const [loading, setLoading] = useState(!_listCache)
  const [search, setSearch] = useState('')
  const [filterObj, setFilterObj] = useState('All')
  const [filterDraft, setFilterDraft] = useState<'all' | 'draft' | 'live'>('all')
  const [editing, setEditing] = useState<Partial<Project> | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  // Every sibling desk in director/ falls back to AdminErrorState + Retry on a
  // failed fetch (20.0's rule: "AdminErrorState with onRetry - never a second
  // error component"); this one only toasted and left `projects` at whatever
  // it already was - on a first-ever failed load that's `[]`, which then
  // rendered as "no projects yet" and invited creating a duplicate instead of
  // saying the fetch itself failed. The toast stays too: a background Refresh
  // failure with a cached list still on screen deserves the lighter signal -
  // AdminErrorState only takes over the panel when there is nothing to show.
  const [loadError, setLoadError] = useState<string | null>(null)
  const confirm = useConfirm()
  const toast = useToast()
  // The query builder takes no AbortSignal, so a sequence number stands in:
  // only the newest load may write state or the module cache.
  const loadSeq = useRef(0)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const load = useCallback(async () => {
    const seq = ++loadSeq.current
    setLoading(true)
    setLoadError(null)
    const { data, error } = await withRetry(async () => supabase
      .from('welfare_projects')
      .select(LIST_COLS)
      .order('id', { ascending: false }))
    if (seq !== loadSeq.current || !mounted.current) return // a newer load owns the result
    if (error) {
      toast.error('projects didn’t load.')
      setLoadError(error.message || 'projects didn’t load.')
      setLoading(false)
      return
    }
    const rows = (data ?? []) as ListProject[]
    _listCache = rows
    setProjects(rows)
    setLoading(false)
  }, [toast])

  useEffect(() => { if (!_listCache) load() }, [load])

  const filtered = projects.filter(p => {
    if (filterDraft === 'draft' && !p.is_draft) return false
    if (filterDraft === 'live'  && p.is_draft)  return false
    if (filterObj !== 'All' && p.objective !== filterObj) return false
    if (search) {
      const q = search.toLowerCase()
      return (p.header ?? '').toLowerCase().includes(q) || (p.location ?? '').toLowerCase().includes(q) || (p.slug ?? '').toLowerCase().includes(q)
    }
    return true
  })

  // 558 projects rendered as 558 table rows put ~11,400 nodes in the document
  // on every visit to this tab — measured live. Nobody scrolls 558 rows; they
  // search or filter, and both still run across the WHOLE list above before
  // this cap applies, so nothing becomes unreachable. Reset the cap whenever
  // the query changes so a new search always starts from the top.
  const PAGE = 60
  const [shown, setShown] = useState(PAGE)
  useEffect(() => { setShown(PAGE) }, [search, filterObj, filterDraft])
  const visible = filtered.slice(0, shown)

  // Escape hatch for "no projects match these filters" - adminKit's EmptyLedger
  // `action` slot exists for exactly this case (see its own comment): a list
  // filtered down to zero must not read as "there is no work" when the work is
  // simply filtered away.
  const clearFilters = () => { setSearch(''); setFilterObj('All'); setFilterDraft('all') }

  const handleSave = async (data: Partial<Project>) => {
    const { id, ...rest } = data as Project
    if (id) {
      // `.select()` so an RLS-blocked (or otherwise no-op) write surfaces as
      // a real error instead of silently doing nothing - PostgREST returns
      // no error + zero rows when a write matches nothing.
      const { data: rows, error } = await supabase.from('welfare_projects').update(rest).eq('id', id).select('id')
      if (error) { toast.error('Save failed: ' + friendlyDbError(error)); return }
      if (!rows || rows.length === 0) { toast.error("Save failed - you may not have permission to edit this project."); return }
      bustProjectsCache()
      logAction('project_edited', 'welfare_project', id, { header: rest.header })
      toast.success('Project updated')
    } else {
      const { data: created, error } = await supabase.from('welfare_projects').insert(rest).select('id')
      if (error) { toast.error('Create failed: ' + friendlyDbError(error)); return }
      bustProjectsCache()
      logAction('project_created', 'welfare_project', (created as any)?.[0]?.id, { header: rest.header })
      toast.success('Project created')
    }
    setEditing(null); setAddingNew(false)
    _listCache = null; load()
  }

  const toggleFeatured = async (p: ListProject) => {
    if (togglingId === p.id) return
    setTogglingId(p.id)
    try {
      // `.select()` verifies the write actually matched a row - without it, an
      // RLS-blocked update returns no error + zero rows, and the UI would flip
      // local state as if it worked even though nothing changed in the DB (it
      // then silently reverts on the next reload).
      const { data: rows, error } = await supabase.from('welfare_projects').update({ featured: !p.featured }).eq('id', p.id).select('id')
      if (error) { toast.error('Failed: ' + friendlyDbError(error)); return }
      if (!rows || rows.length === 0) { toast.error("couldn't save: you may not have permission."); return }
      bustProjectsCache()
      logAction(!p.featured ? 'project_featured' : 'project_unfeatured', 'welfare_project', p.id, { header: p.header })
      const updated = projects.map(x => x.id === p.id ? { ...x, featured: !p.featured } : x)
      _listCache = updated; setProjects(updated)
      toast.success(!p.featured ? 'Project featured' : 'Removed from featured')
    } finally {
      setTogglingId(null)
    }
  }

  const toggleDraft = async (p: ListProject) => {
    if (togglingId === p.id) return
    const publishing = !!p.is_draft
    // Same hero-image rule the edit modal enforces: a blank card must not go public.
    if (publishing && !canGoLive(p)) { toast.error(HERO_REQUIRED_MESSAGE); return }
    const ok = await confirm(publishing
      ? { title: 'Publish this write-up?', body: `"${p.header}" becomes public on the Projects page and in the feed.`, confirmLabel: 'Publish' }
      : { title: 'Move to drafts?', body: `"${p.header}" disappears from the public Projects page until you publish it again.`, confirmLabel: 'Unpublish', danger: true })
    if (!ok) return
    setTogglingId(p.id)
    try {
      const { data: rows, error } = await supabase.from('welfare_projects').update({ is_draft: !p.is_draft }).eq('id', p.id).select('id')
      if (error) { toast.error('Failed: ' + friendlyDbError(error)); return }
      if (!rows || rows.length === 0) { toast.error("couldn't save: you may not have permission."); return }
      bustProjectsCache()
      logAction(publishing ? 'project_published' : 'project_unpublished', 'welfare_project', p.id, { header: p.header })
      const updated = projects.map(x => x.id === p.id ? { ...x, is_draft: !p.is_draft } : x)
      _listCache = updated; setProjects(updated)
      toast.success(!p.is_draft ? 'Project moved to drafts' : 'Project published')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (p: ListProject) => {
    // drive_attendance.welfare_project_id is ON DELETE CASCADE - deleting a
    // project here silently takes every check-in/attendance row for that
    // drive with it, which DriveManagement's desk (the only other place
    // that reads/writes drive_attendance) has no way to warn about since
    // it never sees this delete happen. Found in the HoD-desk audit: the
    // confirm copy said nothing about it. A cheap count first so the
    // warning only fires when there's actually something to lose.
    const { count } = await supabase.from('drive_attendance').select('id', { count: 'exact', head: true }).eq('welfare_project_id', p.id)
    const attendanceWarning = count && count > 0
      ? ` This also permanently deletes ${count} attendance/check-in record${count === 1 ? '' : 's'} for this drive.`
      : ''
    const yes = await confirm({ title: 'Delete project?', body: `"${p.header}" will be permanently deleted.${attendanceWarning}`, confirmLabel: 'Delete', danger: true })
    if (!yes) return
    const { data: rows, error } = await supabase.from('welfare_projects').delete().eq('id', p.id).select('id')
    if (error) { toast.error('Delete failed: ' + friendlyDbError(error)); return }
    if (!rows || rows.length === 0) { toast.error("couldn't delete that: you may not have permission."); return }
    bustProjectsCache()
    logAction('project_deleted', 'welfare_project', p.id, { header: p.header })
    toast.success('Project deleted')
    const updated = projects.filter(x => x.id !== p.id)
    _listCache = updated; setProjects(updated)
  }

  const live  = projects.filter(p => !p.is_draft).length
  const draft = projects.filter(p =>  p.is_draft).length
  const feat  = projects.filter(p =>  p.featured).length

  return (
    <AdminLayout>
      <div style={{ paddingBottom: 80 }}>

      {/* Same header treatment as every sibling tab - this desk used to render
          its own bare <div>, at a different max-width, which read as a visible
          layout jump the moment you switched tabs. */}
      {/* /director/drives (a separate leader-level desk over these same rows)
          was deleted 2026-09-12 per owner request; "who runs it on the day"
          moved into this modal's Basics tab (DriveLeadField) instead of a
          standalone desk, which narrows who can assign a lead to
          super_admin only - see that component's own note. */}
      <AdminTabHeader
        label="Drive Write-ups"
        title="Drive write-ups"
        count={projects.length}
        subtitle="The published story of a drive: photos, numbers, feature and draft state. Open a project's Basics tab to assign who runs it on the day."
      />

      {/* Stats bar - one bold-bordered strip with dividers instead of four
          separate floating cards + a Refresh button adrift on its own. */}
      {/* `hod-card` routes the strip through the desk's brutalist panel recipe
          (3px ink border, hard offset shadow) - its higher specificity beats
          .pm-statbar's leftover soft border/shadow without touching that sheet. */}
      <div className="hod-card pm-statbar">
        {/* `--lemon-ink` (not a hand-picked gold hex) - the same contrast-safe
            "ink" pairing `.pm-status-pill.is-draft` already uses for this exact
            status, so the stat number and the row pill agree on what "draft"
            looks like instead of introducing a second, uncoordinated gold. */}
        {[
          { label: 'Total',    val: projects.length, color: 'var(--ink)' },
          { label: 'Live',     val: live,            color: 'var(--welfare)' },
          { label: 'Draft',    val: draft,           color: 'var(--lemon-ink)' },
          { label: 'Featured', val: feat,            color: 'var(--pink)' },
        ].map(s => (
          <div key={s.label} className="pm-stat">
            <div className="pm-stat-label">{s.label}</div>
            <div className="pm-stat-val" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
        {/* The ↻ was interface chrome, not copy - it becomes a heroicon and
            the word "Refresh" stays. Still clears `_listCache` and reloads.
            Below 1025px this leaves the strip's right edge and becomes a
            full-width footer button under the 2 by 2 stat grid. */}
        <button className="btn btn-sm pm-refresh" onClick={() => { _listCache = null; load() }} disabled={loading}>
          {loading ? 'loading…' : <><ArrowPathIcon width={14} height={14} strokeWidth={2} aria-hidden /> Refresh</>}
        </button>
      </div>

      {/* Controls - the shared DataToolbar (search + scrolling filter pills +
          right-aligned primary action), replacing this desk's hand-rolled
          input/chip rows. Status is a plain pill row; objective keeps its own
          category colour, which the generic pill can't express, so those stay
          `.pm-obj-chip` inside the toolbar's filter slot. */}
      <DataToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search title, location, slug…"
        actions={
          <button className="btn accent pm-new-btn" onClick={() => setAddingNew(true)}>+ New Project</button>
        }
      >
        <span className="pm-filter-label">Status</span>
        {([['all', 'All'], ['live', 'Live'], ['draft', 'Draft']] as const).map(([v, label]) => (
          <FilterPill key={v} active={filterDraft === v} onClick={() => setFilterDraft(v)}>{label}</FilterPill>
        ))}
        <span className="pm-filter-sep" aria-hidden />
        <span className="pm-filter-label">Objective</span>
        <FilterPill active={filterObj === 'All'} onClick={() => setFilterObj('All')}>All</FilterPill>
        {OBJECTIVES.map(o => {
          const on = filterObj === o
          const col = OBJ_COLORS[o] || 'var(--welfare)'
          return (
            <button key={o} type="button" onClick={() => setFilterObj(o)} aria-pressed={on}
              className={'pm-obj-chip pm-obj-filter' + (on ? ' is-active' : '')}
              style={on ? { '--oc': col } as React.CSSProperties : undefined}>
              {/* Eight objectives in eight hues, and an inactive chip carried
                  none of them - the colour only appeared once you had already
                  chosen. The active state stays a full fill. */}
              {!on && <span className="adm-swatch" style={{ ['--sw' as any]: col }} aria-hidden />}
              {o}
            </button>
          )
        })}
      </DataToolbar>

      {/* Table */}
      {loading ? (
        <AdminSkeleton rows={6} />
      ) : loadError && projects.length === 0 ? (
        // Only takes over the whole panel when there is truly nothing cached
        // to show - see the comment on `loadError`'s declaration above.
        <AdminErrorState message={loadError} onRetry={load} />
      ) : filtered.length === 0 ? (
        <>
          <EmptyLedger
            message={projects.length === 0 ? 'no projects yet' : 'no projects match these filters'}
            sub={projects.length === 0 ? 'Create your first welfare project to get started.' : 'Try a different search, status, or objective filter.'}
            action={projects.length > 0
              ? <button type="button" className="btn btn-sm pm-showmore" onClick={clearFilters}>clear filters</button>
              : undefined}
          />
          {projects.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button className="btn accent pm-new-btn" onClick={() => setAddingNew(true)}>+ New Project</button>
            </div>
          )}
        </>
      ) : (
        <div className="hod-card pm-tablecard">
          {/* ── The phone card ledger, < 1025px ──────────────────────────
              Nine fixed columns total roughly 750px; that does not become a
              390px screen by scrolling sideways. Same `visible.map`, same
              handlers, one data path - every field here is inside LIST_COLS,
              because the list query never fetches one that is not.

              Three bands. Band 1 is identity and takes the tap that opens the
              edit modal, exactly as the table row does. Bands 2 and 3 hold the
              facts and the five controls that already `stopPropagation`, so
              they sit visually outside the tappable area they opt out of. */}
          <div className="pm-ledger">
            {visible.map(p => {
              const rowAccent = p.objective ? (OBJ_COLORS[normalizeObj(p.objective)] || OBJ_COLORS['Others']) : 'var(--line-2)'
              return (
                <article key={p.id} className="pm-lcard" style={{ ['--pm-accent' as any]: rowAccent }}>
                  <button type="button" className="pm-lcard-ident" onClick={() => setEditing(p)}>
                    {p.main_image
                      ? <Img ctx="avatar" src={p.main_image} alt={p.main_image_alt ?? ''} loading="lazy" className="pm-lcard-thumb" />
                      : <span className="pm-lcard-thumb is-empty" aria-hidden><CameraIcon width={20} height={20} strokeWidth={1.6} /></span>}
                    <span className="pm-lcard-ident-text">
                      <span className="pm-lcard-title">{p.header}</span>
                      <span className="pm-sub">
                        {p.location
                          ? <><MapPinIcon width={12} height={12} strokeWidth={1.8} aria-hidden /> {p.location}</>
                          : <span className="pm-sub-slug">{p.slug}</span>}
                      </span>
                    </span>
                  </button>

                  <div className="pm-lcard-facts">
                    {p.objective
                      ? <span className="pm-tag" style={{ ['--tc' as string]: rowAccent }}>{p.objective}</span>
                      : <span className="pm-dash">-</span>}
                    <span className="pm-lcard-fact adm-nums">
                      {p.workshop_date ? new Date(p.workshop_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                    </span>
                    <span className="pm-lcard-fact adm-nums">
                      {p.volunteers != null ? `${p.volunteers} vol.` : '-'}
                    </span>
                    <button onClick={() => toggleFeatured(p)}
                      className={'pm-star-btn' + (p.featured ? ' is-on' : '')}
                      disabled={togglingId === p.id}
                      title={p.featured ? 'Unfeature' : 'Feature'}
                      aria-label={p.featured ? 'Unfeature' : 'Feature'}>★</button>
                  </div>

                  <div className="pm-lcard-acts">
                    <button onClick={() => toggleDraft(p)}
                      className={'pm-status-pill ' + (p.is_draft ? 'is-draft' : 'is-live')}
                      disabled={togglingId === p.id}>
                      {p.is_draft ? 'DRAFT' : 'LIVE'}
                    </button>
                    <span className="pm-lcard-spacer" />
                    <button className="iconbtn" onClick={() => setEditing(p)} title="Edit project" aria-label="Edit project">
                      <PencilSquareIcon width={16} height={16} strokeWidth={2} aria-hidden />
                    </button>
                    <a href={`/projects/${p.slug}`} target="_blank" rel="noopener noreferrer"
                      title={p.is_draft ? 'Open public page (unpublished)' : 'Open public page'}
                      aria-label={p.is_draft ? 'Open public page (unpublished)' : 'Open public page'}
                      className={'iconbtn' + (p.is_draft ? ' is-dim' : '')} style={{ textDecoration: 'none' }}>
                      <ArrowTopRightOnSquareIcon width={16} height={16} strokeWidth={2} aria-hidden />
                    </a>
                    <button className="iconbtn no" onClick={() => handleDelete(p)} title="Delete project" aria-label="Delete project">
                      <TrashIcon width={16} height={16} strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="pm-tablewrap">
            {/* table-layout: fixed + an explicit colgroup - without this the
                browser distributes width by content-guessing, which handed a
                single ★ button the same ~90px as the multi-line Title column
                and left every narrow control floating in acres of empty
                cell space. Widths below are sized to what each column
                actually holds, not auto-guessed. A slim leading accent column
                carries the project's own category colour - replaces the
                flat alternating-stripe zebra with a real at-a-glance signal,
                same trick the public feed cards use (a coloured left edge). */}
            {/* All nine columns are percentage-widths (summing to 100%), not a mix
                of px + one flexible %. `table-layout: fixed` only stretches a
                table to its container when every column's width already adds
                up to 100% - a table with fixed px columns left a real, measured
                strip of dead space to the right of the card instead of filling
                it. Percentages (proportioned from the desk's ~1000-1180px
                desktop width, where this table exclusively renders - see the
                1025px cutoff below) reflow with the container instead of
                assuming one fixed width. */}
            <table className="pm-table">
              <colgroup>
                <col style={{ width: '0.5%' }} />
                <col style={{ width: '6.5%' }} />
                <col style={{ width: '33%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '5.5%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '5.5%' }} />
                <col style={{ width: '18%' }} />
              </colgroup>
              <thead>
                <tr className="pm-headrow">
                  {['','','Title','Objective','Date','Vol.','Status','★',''].map((h, i) => (
                    <th key={i} className={'pm-th' + (i >= 5 && i <= 7 ? ' pm-th-c' : '')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  const rowAccent = p.objective ? (OBJ_COLORS[normalizeObj(p.objective)] || OBJ_COLORS['Others']) : 'var(--line-2)'
                  return (
                  <tr key={p.id} className="pm-row" style={{ '--pm-accent': rowAccent } as React.CSSProperties}
                    onClick={() => setEditing(p)}>
                    {/* The accent cell itself carries the colour (not a
                        height:100% child div - percentage heights on a table
                        cell's child don't reliably resolve; a <td> always
                        spans its row's full height on its own). */}
                    <td className="pm-accent-cell" style={{ background: rowAccent }} />
                    <td className="pm-td">
                      {p.main_image
                        ? <Img ctx="avatar" src={p.main_image} alt={p.main_image_alt ?? ''} loading="lazy" className="pm-thumb" />
                        : <div className="pm-thumb pm-thumb-empty"><CameraIcon width={18} height={18} strokeWidth={1.6} aria-hidden /></div>}
                    </td>
                    <td className="pm-td pm-td-clip">
                      <div className="pm-title">{p.header}</div>
                      {/* Slug + location on one line (was two) - the slug is
                          auto-generated now, not something an admin edits, so
                          it doesn't need its own prominent row; folding it in
                          with location cuts the row down from 3 lines to 2. */}
                      <div className="pm-sub">
                        {p.location
                          ? <><MapPinIcon width={12} height={12} strokeWidth={1.8} aria-hidden /> {p.location}</>
                          : <span className="pm-sub-slug">{p.slug}</span>}
                      </div>
                    </td>
                    <td className="pm-td pm-td-clip">
                      {/* Solid fill + dark text - matches the chip convention
                          used everywhere else on the site (category pills,
                          status badges); the old translucent-tint version was
                          the one pale, uncommitted-looking chip in the app. */}
                      {p.objective
                        ? <span className="pm-tag" style={{ ['--tc' as string]: rowAccent }}>{p.objective}</span>
                        : <span className="pm-dash">-</span>}
                    </td>
                    <td className="pm-td pm-td-date adm-nums">
                      {p.workshop_date ? new Date(p.workshop_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                    </td>
                    <td className="pm-td pm-td-num adm-nums">
                      {p.volunteers ?? '-'}
                    </td>
                    <td className="pm-td pm-td-c" onClick={e => e.stopPropagation()}>
                      {/* Status pill - muted tint + saturated text, the same
                          adm-badge success/warn vocabulary the rest of the HoD
                          desk uses (see ContentManager's STATUS_STYLE). This
                          used to be a bright solid var(--lemon)/var(--welfare)
                          fill with dark-ink text - the public front-end's
                          "sticker" pill language, not this desk's. */}
                      <button onClick={() => toggleDraft(p)}
                        className={'pm-status-pill ' + (p.is_draft ? 'is-draft' : 'is-live')}
                        disabled={togglingId === p.id}>
                        {p.is_draft ? 'DRAFT' : 'LIVE'}
                      </button>
                    </td>
                    <td className="pm-td pm-td-c pm-td-tight" onClick={e => e.stopPropagation()}>
                      {/* Featured star - was a bare unicode glyph with only an
                          opacity toggle (no background/border/hover), so it read
                          as a stray character rather than a button. */}
                      <button onClick={() => toggleFeatured(p)}
                        className={'pm-star-btn' + (p.featured ? ' is-on' : '')}
                        disabled={togglingId === p.id}
                        title={p.featured ? 'Unfeature' : 'Feature'}
                        aria-label={p.featured ? 'Unfeature' : 'Feature'}>★</button>
                    </td>
                    <td className="pm-td" onClick={e => e.stopPropagation()}>
                      <div className="pm-rowacts">
                        {/* Shared `.iconbtn` vocabulary (3px ink border) instead of
                            the soft pm-ghost-btn ghosts. */}
                        <button className="iconbtn" onClick={() => setEditing(p)} title="Edit project" aria-label="Edit project">
                          <PencilSquareIcon width={15} height={15} strokeWidth={2} aria-hidden />
                        </button>
                        {/* On a DRAFT the public link dims but keeps its href:
                            the page exists at that slug unpublished, and
                            hiding the link removes the only way to check it
                            before publishing. */}
                        <a href={`/projects/${p.slug}`} target="_blank" rel="noopener noreferrer"
                          title={p.is_draft ? 'Open public page (unpublished)' : 'Open public page'}
                          aria-label={p.is_draft ? 'Open public page (unpublished)' : 'Open public page'}
                          className={'iconbtn' + (p.is_draft ? ' is-dim' : '')} style={{ textDecoration: 'none' }}>
                          <ArrowTopRightOnSquareIcon width={15} height={15} strokeWidth={2} aria-hidden />
                        </a>
                        <button className="iconbtn no" onClick={() => handleDelete(p)} title="Delete project" aria-label="Delete project">
                          <TrashIcon width={15} height={15} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {visible.length < filtered.length && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 2px' }}>
              <button className="btn btn-sm pm-showmore" onClick={() => setShown(s => s + PAGE)}>
                show {Math.min(PAGE, filtered.length - visible.length)} more
              </button>
            </div>
          )}
          {/* Says what's on screen AND what the filter matched, so the cap can
              never be mistaken for "that's all there is". */}
          <div className="pm-tablefoot adm-nums">
            showing {visible.length} of {filtered.length}
            {filtered.length !== projects.length ? ` matched · ${projects.length} total` : ' projects'}
          </div>
        </div>
      )}

      {addingNew && (
        <ProjectModal initial={{}} existingSlugs={projects.map(p => p.slug)} onSave={handleSave} onClose={() => setAddingNew(false)} />
      )}
      {editing && (
        <ProjectModal
          initial={editing}
          existingSlugs={projects.filter(p => p.id !== editing.id).map(p => p.slug)}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {/* `.pm-ghost-btn` and friends live in ProjectManager.css - a single
          source of truth shared with the modal, which used to carry its own
          duplicate copy that won the cascade whenever it was mounted. */}
      </div>
    </AdminLayout>
  )
}
