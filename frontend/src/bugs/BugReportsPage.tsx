import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import { hasLeaderAccess } from '../lib/roles'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { sized } from '../lib/imageUrl'
import { tapScale } from '../lib/motion'
import { celebrate } from '../lib/delight'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import OfflineBanner from '../components/OfflineBanner'
import ImageLightbox from '../components/ImageLightbox'
import { useAnnouncer } from '../components/LiveRegion'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import {
  bugReportService, eventSentence, filterBugs, tabCounts, tabOf, friendlyStatus, shortTitle, pageName, TABS, TYPE_PLAIN, TRACK_PLAIN, kindCounts,
  safeHref, safePageUrl, BUG_LIMITS, canEditDescription, attachmentLabel, awaitingCheck, reworkLabel,
  LANES, laneOf, typeOf, groupDuplicates, demand, sortBugs, firstName, canConfirm, evidenceOf, ago, routineState,
  type BugLane, type BugReport, type BugReportEvent, type BugSeverity, type BugSort, type BugTab, type BugType, type KindFilter, type RoutineRun,
} from '../services/bugReportService'
import { TYPE_LABEL, backStepAction, isClosedOut, nextStepAction, trackIndex, type StepAction } from './bugModel'
import ReportBugModal from './ReportBugModal'
import './BugReports.css'

const KIND_CHIP: Record<KindFilter, string> = { all: 'everything', bug: 'bugs', feature: 'ideas' }
const KINDS: KindFilter[] = ['all', 'bug', 'feature']

function when(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function SkeletonCard() {
  return (
    <div className="bug-card bug-skel" aria-hidden>
      <div className="v6-skeleton bug-skel-vote" />
      <div className="bug-skel-main">
        <div className="v6-skeleton" style={{ width: '30%', height: 14, borderRadius: 'var(--r-tight)' }} />
        <div className="v6-skeleton" style={{ width: '85%', height: 18, borderRadius: 'var(--r-tight)' }} />
        <div className="v6-skeleton" style={{ width: '45%', height: 12, borderRadius: 'var(--r-tight)' }} />
      </div>
    </div>
  )
}

/**
 * /bugs: what people reported or asked for, and where it got to. Written for a member who saw something wrong
 * or has an idea, not for the routine: one primary button to report, three tabs, a card per report with one plain
 * status, and a big "me too" instead of filing a duplicate. Everything a leader or the routine uses (steps, roadmap
 * lane, type, area, decline) lives behind "leader tools" inside the opened card.
 *
 * The daily routine reads the same table (docs/SHEET_TRIAGE_ROUTINE.md, section 7), fills the type, area, lane and its
 * reading of each report, folds duplicates, and writes the run log shown in the strip at the top.
 *
 * Gating mirrors RLS, not taste: the step buttons are only enabled for leaders and the database refuses a member's
 * update to anything but their own waiting description (scripts/bug_tracker_v2_2026_10_22.sql has the simulated checks).
 */
export default function BugReportsPage() {
  useMeta({ ...pageMetadata.bugs, noIndex: true })
  const { member } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { announce, region } = useAnnouncer()
  const reduce = useReducedMotion()
  const isLeader = hasLeaderAccess(member?.role)

  const [bugs, setBugs] = useState<BugReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<BugTab>('open')
  const [kind, setKind] = useState<KindFilter>('all')
  const [text, setText] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [sort, setSort] = useState<BugSort>('newest')
  const [areaF, setAreaF] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [votes, setVotes] = useState<Set<string>>(new Set())
  const [run, setRun] = useState<RoutineRun | null>(null)
  const [notFixedFor, setNotFixedFor] = useState<string | null>(null)
  const [notFixedText, setNotFixedText] = useState('')
  const [reportOpen, setReportOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [events, setEvents] = useState<Record<string, BugReportEvent[]>>({})
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [declining, setDeclining] = useState<string | null>(null)
  const [declineText, setDeclineText] = useState('')
  const [sendingBack, setSendingBack] = useState<string | null>(null)
  const [sendBackText, setSendBackText] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const lastLoad = useRef(0)
  /** `quiet` refreshes in place with no skeleton, for when the tab comes back into view. */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setIsLoading(true); setError(null) }
    try {
      const [list, mine, last] = await Promise.all([
        bugReportService.list(),
        bugReportService.myVotes().catch(() => null),
        bugReportService.latestRun().catch(() => null),
      ])
      setBugs(list)
      if (mine) setVotes(mine)
      setRun(last)
      lastLoad.current = Date.now()
    } catch (err) {
      console.error('BugReportsPage load error:', err)
      if (!quiet) setError("couldn't load the list.")
    } finally {
      if (!quiet) setIsLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  // The routine ticks boxes overnight and leaders tick them from other devices, so a page left
  // open goes stale. Coming back to the tab refreshes the list in place, at most once a minute.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > 60_000) void load(true)
    }
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    return () => { document.removeEventListener('visibilitychange', onShow); window.removeEventListener('focus', onShow) }
  }, [load])

  const scoped = useMemo(
    () => (mineOnly ? bugs.filter(b => b.reporter_member_id === member?.member_id) : bugs),
    [bugs, mineOnly, member?.member_id],
  )
  // Duplicates the routine linked are folded under the report they repeat; the tabs and counts describe what is shown.
  const folded = useMemo(() => groupDuplicates(scoped), [scoped])
  const base = folded.parents
  const kinds = useMemo(() => kindCounts(base), [base])
  const areasPresent = useMemo(() => Array.from(new Set(base.map(b => b.area).filter((a): a is string => !!a))).sort(), [base])
  const beforeTab = useMemo(() => filterBugs(base, { stage: 'all', kind, text, area: areaF }), [base, kind, text, areaF])
  const counts = useMemo(() => tabCounts(beforeTab), [beforeTab])
  const rows = useMemo(
    () => sortBugs(beforeTab.filter(b => tabOf(b) === tab), sort, folded.also),
    [beforeTab, tab, sort, folded.also],
  )
  const filtersOn = kind !== 'all' || areaF !== '' || text.trim() !== '' || mineOnly

  async function expand(b: BugReport) {
    if (open === b.id) { setOpen(null); return }
    setOpen(b.id)
    try {
      const docs = b.attachments ?? []
      const [ev, signed, signedDocs] = await Promise.all([
        events[b.id] ? Promise.resolve(events[b.id]) : bugReportService.events([b.id]),
        b.screenshots.length && !b.screenshots.every(p => urls[p])
          ? bugReportService.signedUrls(b.screenshots)
          : Promise.resolve({} as Record<string, string>),
        docs.length && !docs.every(p => docUrls[p])
          ? bugReportService.attachmentUrls(docs)
          : Promise.resolve({} as Record<string, string>),
      ])
      setEvents(prev => ({ ...prev, [b.id]: ev }))
      if (Object.keys(signed).length) setUrls(prev => ({ ...prev, ...signed }))
      if (Object.keys(signedDocs).length) setDocUrls(prev => ({ ...prev, ...signedDocs }))
    } catch (err) {
      console.error('BugReportsPage expand error:', err)
      toast.error("couldn't load the details", 'try opening it again.')
    }
  }

  async function change(b: BugReport, patch: Parameters<typeof bugReportService.update>[1], done: string) {
    if (busy.has(b.id)) return
    setBusy(s => new Set(s).add(b.id))
    try {
      const next = await bugReportService.update(b.id, patch)
      setBugs(list => list.map(x => (x.id === b.id ? next : x)))
      if (open === b.id) {
        const ev = await bugReportService.events([b.id])
        setEvents(prev => ({ ...prev, [b.id]: ev }))
      }
      toast.success(done)
    } catch (err) {
      console.error('BugReportsPage update error:', err)
      toast.error("couldn't save that change", 'nothing changed. try again.')
    } finally {
      setBusy(s => { const n = new Set(s); n.delete(b.id); return n })
    }
  }

  async function toggleSolved(b: BugReport, on: boolean) {
    if (!on) {
      const ok = await confirm({
        title: 'send this back for another fix?',
        body: b.verified
          ? 'this removes the verification and puts the report back in the daily routine\'s queue, so it will work on it again.'
          : 'this puts the report back in the daily routine\'s queue, so it will work on it again.',
        confirmLabel: 'send it back',
        danger: b.verified,
      })
      if (!ok) return
    }
    await change(b, { solved: on }, on ? 'marked solved' : 'sent back for another fix')
  }

  /** The second layer of the check: a leader looked at the live site and the fix did not hold. */
  async function sendBack(b: BugReport) {
    const reason = sendBackText.trim()
    if (reason.length < 3) return
    await change(b, { solved: false, rework_note: reason }, 'sent back for another fix')
    setSendingBack(null)
    setSendBackText('')
  }

  async function toggleVote(b: BugReport, el: Element | null) {
    if (!member) return
    const on = votes.has(b.id)
    const bump = (d: number) => setBugs(list => list.map(x => (x.id === b.id ? { ...x, me_too_count: Math.max(0, (x.me_too_count ?? 0) + d) } : x)))
    setVotes(v => { const n = new Set(v); if (on) n.delete(b.id); else n.add(b.id); return n })
    bump(on ? -1 : 1)
    if (!on) celebrate('stars', el)
    try {
      if (on) await bugReportService.unvote(b.id, member.member_id)
      else await bugReportService.vote(b.id, member.member_id)
      toast.success(on ? 'taken back' : 'noted, thanks. you will see it here when it moves.')
    } catch (err) {
      console.error('BugReportsPage vote error:', err)
      setVotes(v => { const n = new Set(v); if (on) n.add(b.id); else n.delete(b.id); return n })
      bump(on ? 1 : -1)
      toast.error("couldn't save that", 'nothing changed. try again.')
    }
  }

  /** "Did this fix it?" for the person who asked. Not fixed sends it back to the routine, like a leader's send-back. */
  async function answerFix(b: BugReport, fixed: boolean) {
    if (busy.has(b.id)) return
    const note = notFixedText.trim()
    if (!fixed && note.length < 3) return
    setBusy(s => new Set(s).add(b.id))
    try {
      await bugReportService.confirm(b.id, fixed, note || undefined)
      await load(true)
      const ev = await bugReportService.events([b.id])
      setEvents(prev => ({ ...prev, [b.id]: ev }))
      setNotFixedFor(null); setNotFixedText('')
      toast.success(fixed ? 'thanks for checking' : 'sent back for another fix')
    } catch (err) {
      console.error('BugReportsPage confirm error:', err)
      toast.error("couldn't save that", 'nothing changed. try again.')
    } finally {
      setBusy(s => { const n = new Set(s); n.delete(b.id); return n })
    }
  }

  /** One click on the tracker: the same updates the three checkboxes used to make, in the same order and with the same checks. */
  async function runStep(b: BugReport, a: StepAction) {
    switch (a.id) {
      case 'take': return change(b, { taken_up: true }, 'marked taken up')
      case 'solve': return toggleSolved(b, true)
      case 'verify': return change(b, { verified: true }, 'verified')
      case 'untake': return change(b, { taken_up: false, closed_no_change: false }, 'un-ticked taken up')
      case 'unsolve': return toggleSolved(b, false)
      case 'unverify': return change(b, { verified: false }, 'verification removed')
    }
  }

  const viewer = { memberId: member?.member_id ?? null, isLeader }

  async function saveEdit(b: BugReport) {
    const text = editText.trim()
    if (text.length < BUG_LIMITS.descriptionMin || text === b.description.trim()) return
    await change(b, { description: text }, 'description updated')
    setEditing(null)
  }

  async function decline(b: BugReport) {
    const reason = declineText.trim()
    if (reason.length < 3) return
    await change(b, { declined_reason: reason }, 'declined')
    setDeclining(null)
    setDeclineText('')
  }

  const pickTab = (t: BugTab) => {
    setTab(t)
    setOpen(null)
    const n = beforeTab.filter(b => tabOf(b) === t).length
    announce(`${n} ${n === 1 ? 'report' : 'reports'}.`)
  }

  const openForm = () => { setFormKey(k => k + 1); setReportOpen(true) }
  const clearFilters = () => { setKind('all'); setAreaF(''); setText(''); setMineOnly(false) }
  const state = routineState(run)

  /** The reporter's "did this fix it?", on the card face so it needs no opening. */
  function renderFixCheck(b: BugReport) {
    if (!canConfirm(b, viewer, votes.has(b.id))) return null
    const isBusy = busy.has(b.id)
    if (b.reporter_confirm === 'fixed') return <p className="bug-thanks">you said this works. thank you.</p>
    return (
      <div className="bug-fixcheck" role="group" aria-label="did this fix it">
        <p className="bug-fixcheck-q">it says this is fixed. did it work for you?</p>
        {notFixedFor === b.id ? (
          <div className="bug-inline-form">
            <input className="input" value={notFixedText} maxLength={500} placeholder="what is still wrong?"
              aria-label="what is still wrong" onChange={e => setNotFixedText(e.target.value)} />
            <button type="button" className="btn btn-primary btn-sm" disabled={notFixedText.trim().length < 3 || isBusy}
              onClick={() => void answerFix(b, false)}>send back</button>
            <button type="button" className="btn btn-sm" onClick={() => { setNotFixedFor(null); setNotFixedText('') }}>cancel</button>
          </div>
        ) : (
          <div className="bug-inline-form">
            <button type="button" className="btn btn-primary btn-sm" disabled={isBusy} onClick={() => void answerFix(b, true)}>yes, it works</button>
            <button type="button" className="btn btn-sm" disabled={isBusy} onClick={() => { setNotFixedFor(b.id); setNotFixedText('') }}>no, still broken</button>
          </div>
        )}
      </div>
    )
  }

  function renderDetail(b: BugReport) {
    const isBusy = busy.has(b.id)
    const mine = b.reporter_member_id === member?.member_id
    const dups = folded.also[b.id] ?? []
    const ev = evidenceOf(b)
    const lane = laneOf(b)
    const stepNext = nextStepAction(b)
    const stepBack = backStepAction(b)
    return (
      <div className="bug-detail-body">
        {editing === b.id ? (
          <div className="bug-edit">
            <textarea className="input bug-textarea" rows={5} value={editText} maxLength={BUG_LIMITS.descriptionMax}
              aria-label="edit the description" autoFocus onChange={e => setEditText(e.target.value)} />
            <p className="bug-hint">{editText.trim().length}/{BUG_LIMITS.descriptionMax}.</p>
            <div className="bug-actions">
              <button type="button" className="btn btn-primary btn-sm" aria-busy={isBusy}
                disabled={isBusy || editText.trim().length < BUG_LIMITS.descriptionMin || editText.trim() === b.description.trim()}
                onClick={() => void saveEdit(b)}>{isBusy ? 'saving...' : 'save'}</button>
              <button type="button" className="btn btn-sm" disabled={isBusy} onClick={() => setEditing(null)}>cancel</button>
            </div>
          </div>
        ) : (
          <>
            {shortTitle(b.description) !== b.description.trim() && <p className="bug-full">{b.description}</p>}
            {canEditDescription(b, viewer) && (
              <div className="bug-actions">
                <button type="button" className="btn btn-sm" disabled={isBusy}
                  onClick={() => { setEditing(b.id); setEditText(b.description) }}>edit what i wrote</button>
              </div>
            )}
          </>
        )}

        {b.screenshots.length > 0 && (
          <ul className="bug-shot-list">
            {b.screenshots.map((p, i) => (
              <li key={p} className="bug-shot">
                {urls[p]
                  ? <button type="button" onClick={() => setLightbox(urls[p])} aria-label={`open screenshot ${i + 1}`}>
                      <img src={sized(urls[p], 'card')} alt={`screenshot ${i + 1} of this report`} loading="lazy" />
                    </button>
                  : <span className="bug-hint">{mine || isLeader ? 'getting the picture' : 'private to the reporter and leaders'}</span>}
              </li>
            ))}
          </ul>
        )}

        {(b.attachments?.length ?? 0) > 0 && (
          <ul className="bug-doc-list" aria-label="documents attached to this report">
            {b.attachments!.map(p => {
              const href = safeHref(docUrls[p])
              return (
                <li key={p} className="bug-doc">
                  {href
                    ? <a className="bug-doc-link" href={href} download rel="noopener noreferrer">{attachmentLabel(p)}</a>
                    : <span className="bug-hint">{attachmentLabel(p)}{mine || isLeader ? ' (getting the link)' : ' (private)'}</span>}
                </li>
              )
            })}
          </ul>
        )}

        {(ev.before || ev.after) && (
          <div className="bug-evidence" aria-label="before and after">
            {ev.before && <figure><img src={sized(ev.before, 'card')} alt="the page before the fix" loading="lazy" /><figcaption>before</figcaption></figure>}
            {ev.after && <figure><img src={sized(ev.after, 'card')} alt="the page after the fix" loading="lazy" /><figcaption>after</figcaption></figure>}
          </div>
        )}

        {!isClosedOut(b) && (
          <ol className="bug-track" aria-label={'progress: ' + friendlyStatus(b).label}>
            {TRACK_PLAIN.map((label, n) => {
              const at = trackIndex(b)
              return (
                <li key={label} className={n < at ? 'is-done' : n === at ? 'is-now' : ''} aria-current={n === at ? 'step' : undefined}>
                  <span className="bug-track-dot" aria-hidden />
                  <span className="bug-track-label">{label}</span>
                </li>
              )
            })}
          </ol>
        )}

        <dl className="bug-facts">
          {b.routine_reading && <div><dt>what we understood</dt><dd>{b.routine_reading}</dd></div>}
          {b.resolution_note && <div><dt>what we did</dt><dd>{b.resolution_note}</dd></div>}
          {b.needs_info_note && <div><dt>our question</dt><dd>{b.needs_info_note}</dd></div>}
          {b.declined_reason && <div><dt>why not</dt><dd>{b.declined_reason}</dd></div>}
          {b.rework_note && reworkLabel(b) && <div><dt>sent back</dt><dd>{b.rework_note}</dd></div>}
          {b.lane_reason && <div><dt>plan</dt><dd>{b.lane_reason}</dd></div>}
          {dups.length > 0 && <div><dt>also asked by</dt><dd>{dups.map(d => firstName(d.reporter_name)).join(', ')}</dd></div>}
          <div><dt>page</dt><dd>{safeHref(b.page_url) ? <a href={safePageUrl(b.page_path, window.location.origin).url} target="_blank" rel="noopener noreferrer">open {pageName(b.page_path)}</a> : pageName(b.page_path)}</dd></div>
          {safeHref(b.fix_pr_url) && <div><dt>the change</dt><dd><a href={safeHref(b.fix_pr_url) as string} target="_blank" rel="noopener noreferrer">see what changed</a></dd></div>}
          {isLeader && b.viewport_w && <div><dt>screen</dt><dd>{b.viewport_w} by {b.viewport_h}, {b.capture_method === 'shortcut' ? 'filed with the shortcut' : 'filed from the form'}</dd></div>}
        </dl>

        {isLeader && awaitingCheck(b) && (
          <div className="bug-fixcheck" role="group" aria-label="check the fix">
            <p className="bug-fixcheck-q">marked fixed. open the live page and check it before you verify.</p>
            {sendingBack === b.id ? (
              <div className="bug-inline-form">
                <input className="input" value={sendBackText} maxLength={500} placeholder="what is still wrong? the routine reads this"
                  aria-label="what is still wrong" onChange={e => setSendBackText(e.target.value)} />
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void sendBack(b)} disabled={sendBackText.trim().length < 3 || isBusy}>send back</button>
                <button type="button" className="btn btn-sm" onClick={() => { setSendingBack(null); setSendBackText('') }}>cancel</button>
              </div>
            ) : (
              <div className="bug-inline-form">
                <button type="button" className="btn btn-primary btn-sm" disabled={isBusy}
                  onClick={() => void change(b, { verified: true }, 'verified')}>fix works, verify</button>
                <button type="button" className="btn btn-sm" disabled={isBusy}
                  onClick={() => { setSendingBack(b.id); setSendBackText('') }}>not fixed, send back</button>
              </div>
            )}
          </div>
        )}

        {isLeader && (
          <details className="bug-tools">
            <summary>leader tools</summary>
            <div className="bug-tools-body">
              {!isClosedOut(b) && (stepNext || stepBack) && (
                <div className="bug-actions">
                  {stepNext && (
                    <button type="button" className="btn btn-primary btn-sm" disabled={isBusy} aria-busy={isBusy}
                      onClick={() => void runStep(b, stepNext)}>{stepNext.label} <span aria-hidden>→</span></button>
                  )}
                  {stepBack && (
                    <button type="button" className="bug-undo" disabled={isBusy} onClick={() => void runStep(b, stepBack)}>{stepBack.label}</button>
                  )}
                </div>
              )}
              <div className="bug-actions">
                <label className="bug-inline">
                  importance
                  <select className="input" value={b.severity} disabled={isBusy}
                    onChange={e => void change(b, { severity: e.target.value as BugSeverity }, 'severity changed')}>
                    <option value="high">high</option>
                    <option value="med">medium</option>
                    <option value="low">low</option>
                  </select>
                </label>
                <label className="bug-inline">
                  roadmap
                  <select className="input" value={lane} disabled={isBusy}
                    onChange={e => void change(b, { lane: e.target.value as BugLane }, 'moved on the roadmap, the routine will leave it there')}>
                    {LANES.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                  </select>
                </label>
                <label className="bug-inline">
                  type
                  <select className="input" value={typeOf(b)} disabled={isBusy}
                    onChange={e => void change(b, { report_type: e.target.value as BugType }, 'type changed')}>
                    {(Object.keys(TYPE_LABEL) as BugType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                </label>
                <label className="bug-inline">
                  area
                  <input className="input" defaultValue={b.area ?? ''} maxLength={80} disabled={isBusy} placeholder="page or feature"
                    onBlur={e => { const v = e.target.value.trim(); if (v !== (b.area ?? '')) void change(b, { area: v || null }, 'area changed') }} />
                </label>
              </div>
              {declining === b.id ? (
                <div className="bug-inline-form">
                  <input className="input" value={declineText} maxLength={500} placeholder="why? the reporter will see this"
                    aria-label="reason for declining" onChange={e => setDeclineText(e.target.value)} />
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => void decline(b)} disabled={declineText.trim().length < 3 || isBusy}>decline</button>
                  <button type="button" className="btn btn-sm" onClick={() => { setDeclining(null); setDeclineText('') }}>cancel</button>
                </div>
              ) : (
                !b.declined_reason && !b.solved && (
                  <div className="bug-actions">
                    <button type="button" className="btn btn-sm" onClick={() => { setDeclining(b.id); setDeclineText('') }}>decline</button>
                  </div>
                )
              )}
            </div>
          </details>
        )}

        <h3 className="bug-log-title">what happened</h3>
        {events[b.id]
          ? (
            <ol className="bug-log">
              {events[b.id].map(e => (
                <li key={e.id}><span className="bug-log-at">{when(e.at)}</span> {eventSentence(e)}</li>
              ))}
            </ol>
          )
          : <div className="v6-skeleton" style={{ width: '60%', height: 12, borderRadius: 'var(--r-tight)' }} aria-label="getting the history" />}
      </div>
    )
  }

  function renderCard(b: BugReport, index: number) {
    const status = friendlyStatus(b)
    const isOpen = open === b.id
    const wanted = demand(b, folded.also)
    const mine = b.reporter_member_id === member?.member_id
    const canVote = !mine && !isClosedOut(b) && !b.solved
    const voted = votes.has(b.id)
    const dups = folded.also[b.id] ?? []
    const type = typeOf(b)
    const who = isLeader ? (b.reporter_name ?? 'unknown') : mine ? 'you' : firstName(b.reporter_name)
    return (
      <motion.article
        key={b.id}
        className={'bug-card tone-' + status.tone + (isOpen ? ' is-open' : '')}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, delay: reduce ? 0 : Math.min(index, 8) * 0.04, ease: [0.2, 0, 0, 1] }}
      >
        <div className="bug-card-row">
          {canVote ? (
            <motion.button
              type="button"
              className={'bug-vote' + (voted ? ' is-on' : '')}
              aria-pressed={voted}
              aria-label={`${voted ? 'take back me too. ' : 'me too. '}${wanted} ${wanted === 1 ? 'person wants' : 'people want'} this`}
              whileTap={reduce ? undefined : tapScale}
              onClick={e => void toggleVote(b, e.currentTarget)}
            >
              <motion.span key={wanted} className="bug-vote-n" initial={reduce ? false : { scale: 1.35 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.35, bounce: 0.4 }}>{wanted}</motion.span>
              <span className="bug-vote-l">{voted ? 'added' : 'me too'}</span>
            </motion.button>
          ) : (
            <div className="bug-vote is-static" aria-label={`${wanted} ${wanted === 1 ? 'person wants' : 'people want'} this`}>
              <span className="bug-vote-n">{wanted}</span>
              <span className="bug-vote-l">{mine ? 'you asked' : 'want this'}</span>
            </div>
          )}

          <button type="button" className="bug-face" aria-expanded={isOpen} onClick={() => void expand(b)}>
            <span className="bug-face-top">
              <span className={'bug-status tone-' + status.tone}>{status.label}</span>
              <span className="bug-tag">{TYPE_PLAIN[type]}</span>
              {b.area && <span className="bug-tag">{b.area}</span>}
              {b.severity === 'high' && !b.solved && !isClosedOut(b) && <span className="bug-tag is-high">important</span>}
            </span>
            <span className="bug-card-title">{shortTitle(b.description)}</span>
            <span className="bug-card-meta">
              {pageName(b.page_path)} · {ago(b.created_at)} · {who}
              {dups.length > 0 && <> · {dups.length} more asked the same</>}
              {(b.screenshots.length > 0 || (b.attachments?.length ?? 0) > 0) && <> · has {b.screenshots.length > 0 ? 'a picture' : 'a file'}</>}
            </span>
            <span className="bug-chev" aria-hidden>{isOpen ? '−' : '+'}</span>
          </button>
        </div>

        {renderFixCheck(b)}

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="detail"
              className="bug-detail"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.24, ease: [0.2, 0, 0, 1] }}
            >
              {renderDetail(b)}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    )
  }

  const emptyCopy: Record<BugTab, { title: string; hint: string }> = {
    open: { title: 'nothing waiting right now.', hint: 'found something odd, or have an idea? tell us. it takes under a minute.' },
    fixed: { title: 'nothing fixed yet.', hint: 'when a report is fixed it shows up here, so you can check it worked.' },
    closed: { title: 'nothing closed.', hint: 'reports we looked at and chose not to change show up here, with the reason.' },
  }

  return (
    <div className="route-enter aq-wrap bug-page">
      <OfflineBanner />
      {region}
      <header className="bug-head">
        <div>
          <p className="bug-kicker">bugs and ideas</p>
          <h1 className="h-display bug-title">help us make aquaterra better.</h1>
          <p className="bug-sub">
            found something broken, or have an idea? add it here. say &quot;me too&quot; on what you also want, and watch it get fixed.
          </p>
        </div>
        <button type="button" className="btn btn-primary bug-report-btn" onClick={openForm}>report a bug or idea</button>
      </header>

      {!isLoading && !error && (
        <section className={'bug-run state-' + state} aria-label="the morning check">
          <span className="bug-run-dot" aria-hidden />
          <div className="bug-run-text">
            {run ? (
              <p className="bug-run-line">
                {state === 'late' ? 'the morning check is running late. ' : ''}
                a helper checks this page every morning. last check {ago(run.started_at)}
                {run.shipped > 0 ? `, ${run.shipped} ${run.shipped === 1 ? 'thing' : 'things'} fixed.` : '.'}
              </p>
            ) : (
              <p className="bug-run-line">a helper checks this page every morning at 7. it has not run yet.</p>
            )}
            {(run?.summary || run?.themes) && (
              <details className="bug-themes">
                <summary>what happened this morning</summary>
                {run?.summary && <p>{run.summary}</p>}
                {run?.themes && <p>people keep asking for: {run.themes}</p>}
              </details>
            )}
          </div>
        </section>
      )}

      {!isLoading && !error && bugs.length > 0 && (
        <div className="bug-controls">
          <div className="bug-tabs" role="tablist" aria-label="show reports that are">
            {TABS.map(t => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                className={'bug-tab' + (tab === t.key ? ' is-on' : '')} onClick={() => pickTab(t.key)}>
                {tab === t.key && <motion.span layoutId="bug-tab-pill" className="bug-tab-pill" transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.4, bounce: 0.18 }} />}
                <span className="bug-tab-label">{t.label} <span className="bug-tab-n">{counts[t.key]}</span></span>
              </button>
            ))}
          </div>

          <div className="bug-find">
            <input className="input bug-search" type="search" value={text} placeholder="search what people reported"
              aria-label="search bugs and ideas" onChange={e => setText(e.target.value)} />
            <button type="button" aria-pressed={mineOnly} className={'bug-chip' + (mineOnly ? ' is-on' : '')}
              onClick={() => setMineOnly(v => !v)}>mine</button>
            <button type="button" aria-pressed={sort === 'wanted'} className={'bug-chip' + (sort === 'wanted' ? ' is-on' : '')}
              onClick={() => setSort(sort === 'wanted' ? 'newest' : 'wanted')}>most wanted</button>
            <button type="button" aria-expanded={showMore} className={'bug-chip' + (showMore || kind !== 'all' || areaF ? ' is-on' : '')}
              onClick={() => setShowMore(v => !v)}>more</button>
          </div>

          {showMore && (
            <div className="bug-more">
              <div className="bug-chips" role="group" aria-label="show">
                {KINDS.map(k => (
                  <button key={k} type="button" aria-pressed={kind === k} className={'bug-chip' + (kind === k ? ' is-on' : '')}
                    onClick={() => setKind(k)}>{KIND_CHIP[k]} {kinds[k]}</button>
                ))}
              </div>
              {areasPresent.length > 0 && (
                <select className="input bug-area" aria-label="only this part of the site" value={areaF} onChange={e => setAreaF(e.target.value)}>
                  <option value="">every part of the site</option>
                  {areasPresent.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading && <div className="bug-skels">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>}

      {!isLoading && error && (
        <ErrorState message={error} hint="check your connection and try again." onRetry={() => void load()} variant="block" />
      )}

      {!isLoading && !error && bugs.length === 0 && (
        <EmptyState
          title="nothing reported yet."
          hint="if something is broken, or you want something new, tell us. you can attach a screenshot."
          action={<button type="button" className="btn btn-primary" onClick={openForm}>report a bug or idea</button>}
        />
      )}

      {!isLoading && !error && bugs.length > 0 && rows.length === 0 && (
        <EmptyState
          title={filtersOn ? 'nothing matches that.' : emptyCopy[tab].title}
          hint={filtersOn ? 'try a different word, or clear the filters.' : emptyCopy[tab].hint}
          action={filtersOn
            ? <button type="button" className="btn btn-primary" onClick={clearFilters}>clear filters</button>
            : <button type="button" className="btn btn-primary" onClick={openForm}>report a bug or idea</button>}
        />
      )}

      {!isLoading && !error && rows.length > 0 && (
        <div className="bug-list" role="list" aria-label={`${tab} reports`}>
          {rows.map((b, i) => <div key={b.id} role="listitem">{renderCard(b, i)}</div>)}
        </div>
      )}

      <details className="bug-tip">
        <summary>tip: report from any page</summary>
        <p>
          press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> on a computer, or press and hold with two fingers on a
          phone. it takes a picture of the page for you.
        </p>
      </details>

      <ReportBugModal
        key={formKey}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        initial={{ pageUrl: window.location.origin + '/' }}
        onSubmitted={() => { void load(true) }}
      />
      <ImageLightbox src={lightbox} alt="bug report screenshot" onClose={() => setLightbox(null)} />
    </div>
  )
}
