import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd } from '../hooks/useJsonLd'
import { CountOnView, GrowBar, PhotoMosaic, TiltLink, useReducedMotionPref, type Photo } from '../components/impact/fx'
import { TOPICS, TOPIC_BY_SLUG, TOPIC_INDEX, topicPath } from '../lib/topics/topicKit'
import { EXPLORERS, QUIZ, MAP_PINS, scoreQuiz, normalisePlace, monthKey, monthLabel, shuffle, yearStats, type DriveLite } from '../lib/topics/exploreKit'
import Img from '../components/Img'
import './PillarPage.css'
import './TopicPage.css'
import './ExplorePage.css'

/**
 * The explorers: /impact/explore (index) and /impact/explore/<timeline|calculator|quiz|places>. Every number is
 * computed in the browser from facts/_all.json (every drive written up, regenerated each build), so nothing here
 * is typed by hand. The quiz is the one editorial piece: which series suits which answer (exploreKit.ts).
 */
const loadAll = () => import('../lib/topics/facts/_all.json').then(m => (m.default as unknown) as DriveLite[])

function useDrives() {
  const [drives, setDrives] = useState<DriveLite[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => { let live = true; loadAll().then(d => { if (live) setDrives(d) }).catch(() => { if (live) setError(true) }); return () => { live = false } }, [])
  return { drives, error }
}

const toPhoto = (d: DriveLite): Photo => ({ slug: d.s, title: d.t, img: d.i!, date: d.d, place: d.p })

function Shell({ slug, children }: { slug: string; children: React.ReactNode }) {
  const ex = EXPLORERS.find(e => e.slug === slug)!
  return (
    <div className="route-enter pl-page">
      <section className="pl-hero">
        <div className="container">
          <nav className="tp-crumb mono xs upper" aria-label="breadcrumb">
            <Link to="/impact">how we give back</Link> <span aria-hidden>/</span> <Link to="/impact/explore">explore</Link>
          </nav>
          <h1 className="giant pl-h1">{ex.h1Lead} <span className="underline-doodle pl-accent tp-accent">{ex.h1Accent}</span>.</h1>
          <p className="pl-lede">{ex.lede}</p>
        </div>
      </section>
      <div className="container pl-body">
        {children}
        <section className="card pl-more" aria-labelledby="ex-more-h">
          <h2 id="ex-more-h" className="mono xs upper muted pl-more-h">more ways to explore</h2>
          <div className="pl-more-grid">
            {EXPLORERS.filter(e => e.slug !== slug).map(e => <Link key={e.slug} to={`/impact/explore/${e.slug}`} className="pl-more-a"><span>{e.label}</span></Link>)}
            <Link to="/impact/stories" className="pl-more-a"><span>photo stories</span></Link>
            <Link to="/impact#library" className="pl-more-a"><span>the impact library</span></Link>
          </div>
          <Link to="/join" className="btn btn-primary pl-join">join the work →</Link>
        </section>
      </div>
    </div>
  )
}

function Loading({ error }: { error: boolean }) {
  return error
    ? <p className="pl-p" role="alert">could not load the drives just now. refresh to try again.</p>
    : <div className="ex-loading" role="status" aria-label="Loading drives" />
}

/* ── timeline ─────────────────────────────────────────────────────────── */
function Timeline() {
  const { drives, error } = useDrives()
  const reduced = useReducedMotionPref()
  const months = useMemo(() => {
    if (!drives) return []
    const set = new Set(drives.map(d => monthKey(d.d)))
    const sorted = [...set].sort()
    const out: string[] = []
    let [y, m] = sorted[0].split('-').map(Number)
    const [ly, lm] = sorted[sorted.length - 1].split('-').map(Number)
    while (y < ly || (y === ly && m <= lm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++ } }
    return out
  }, [drives])
  const [i, setI] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const idx = i ?? Math.max(0, months.length - 1)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!playing) return
    timer.current = window.setInterval(() => setI(prev => { const n = (prev ?? 0) + 1; if (n >= months.length) { setPlaying(false); return months.length - 1 } return n }), 700)
    return () => window.clearInterval(timer.current)
  }, [playing, months.length])
  if (!drives || !months.length) return <Loading error={error} />
  const cur = months[idx]
  const upTo = drives.filter(d => monthKey(d.d) <= cur)
  const inMonth = drives.filter(d => monthKey(d.d) === cur)
  const turnouts = upTo.reduce((s, d) => s + d.v, 0)
  const maxPerMonth = Math.max(...months.map(mk => drives.filter(d => monthKey(d.d) === mk).length))
  return (
    <>
      <section className="card ex-panel" aria-labelledby="tl-h">
        <h2 id="tl-h" className="h-display pl-h2">{monthLabel(cur)}</h2>
        <div className="ex-controls">
          <label className="ex-range-l" htmlFor="tl-range">move through the months</label>
          <input id="tl-range" type="range" min={0} max={months.length - 1} value={idx} onChange={e => { setPlaying(false); setI(Number(e.target.value)) }}
            aria-valuetext={`${monthLabel(cur)}: ${inMonth.length} drives that month, ${upTo.length} so far`} className="ex-range" />
          {!reduced && <button type="button" className="btn btn-sm" onClick={() => { if (idx >= months.length - 1) setI(0); setPlaying(p => !p) }} aria-pressed={playing}>{playing ? 'pause' : 'play from the start'}</button>}
        </div>
        <ol className="ex-spark" aria-hidden>
          {months.map((mk, k) => {
            const n = drives.filter(d => monthKey(d.d) === mk).length
            return <li key={mk} className={k === idx ? 'is-cur' : k < idx ? 'is-past' : ''} style={{ height: `${8 + (n / maxPerMonth) * 56}px` }} onClick={() => { setPlaying(false); setI(k) }} />
          })}
        </ol>
        <dl className="ex-tally" aria-live="polite">
          <div><dt>drives that month</dt><dd>{inMonth.length}</dd></div>
          <div><dt>drives so far</dt><dd>{upTo.length.toLocaleString('en-IN')}</dd></div>
          <div><dt>volunteer turnouts so far</dt><dd>{turnouts.toLocaleString('en-IN')}</dd></div>
        </dl>
      </section>
      {inMonth.length > 0 ? (
        <section aria-labelledby="tl-m-h">
          <h2 id="tl-m-h" className="h-display pl-h2">what happened in {monthLabel(cur)}</h2>
          <PhotoMosaic photos={inMonth.filter(d => d.i).map(toPhoto)} label={`photos from ${monthLabel(cur)}`} initial={9} />
          <ul className="tp-drive-list ex-month-list">
            {inMonth.map(d => <li key={d.s}><Link to={`/projects/${d.s}`} className="tp-drive"><span className="tp-drive-t">{d.t}</span><span className="tp-drive-m">{d.p || 'Kolkata'}</span></Link></li>)}
          </ul>
        </section>
      ) : <p className="pl-p">no drives were written up that month.</p>}
    </>
  )
}

/* ── calculator ───────────────────────────────────────────────────────── */
function Calculator() {
  const { drives, error } = useDrives()
  const series = TOPICS.filter(t => t.group === 'series')
  const [pick, setPick] = useState('all')
  const years = useMemo(() => drives ? [...new Set(drives.map(d => Number(d.d.slice(0, 4))))].sort() : [], [drives])
  const [from, setFrom] = useState<number | null>(null)
  const [to, setTo] = useState<number | null>(null)
  if (!drives) return <Loading error={error} />
  const f = from ?? years[0]
  const tt = to ?? years[years.length - 1]
  const lo = Math.min(f, tt), hi = Math.max(f, tt)
  const def = pick === 'all' ? null : TOPIC_BY_SLUG[pick]
  const sel = drives.filter(d => { const y = Number(d.d.slice(0, 4)); return y >= lo && y <= hi && (!def || d.k === pick) })
  const turnouts = sel.reduce((s, d) => s + d.v, 0)
  const places = new Map<string, number>()
  for (const d of sel) { const k = normalisePlace(d.p); if (k) places.set(k, (places.get(k) || 0) + 1) }
  const top = [...places.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const busiest = top[0]?.[1] || 1
  return (
    <>
      <section className="card ex-panel" aria-labelledby="calc-h">
        <h2 id="calc-h" className="h-display pl-h2">pick a series and a stretch of years</h2>
        <div className="ex-form">
          <label>series
            <select value={pick} onChange={e => setPick(e.target.value)}>
              <option value="all">every drive</option>
              {series.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
            </select>
          </label>
          <label>from
            <select value={f} onChange={e => setFrom(Number(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
          </label>
          <label>to
            <select value={tt} onChange={e => setTo(Number(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
          </label>
        </div>
        <div className="pl-stats tp-stats ex-result" aria-live="polite">
          <div className="card pl-stat"><div className="h-display pl-stat-n"><CountOnView key={`d${pick}${lo}${hi}`} value={sel.length} /></div><div className="pl-stat-l">drives</div></div>
          <div className="card pl-stat"><div className="h-display pl-stat-n"><CountOnView key={`v${pick}${lo}${hi}`} value={turnouts} /></div><div className="pl-stat-l">volunteer turnouts</div></div>
          <div className="card pl-stat"><div className="h-display pl-stat-n"><CountOnView key={`p${pick}${lo}${hi}`} value={places.size} /></div><div className="pl-stat-l">places</div></div>
          <div className="card pl-stat"><div className="h-display pl-stat-n"><CountOnView key={`i${pick}${lo}${hi}`} value={sel.filter(d => d.i).length} /></div><div className="pl-stat-l">drives with photos</div></div>
        </div>
        <p className="pl-p ex-note">counted live from every drive written up on the site. a volunteer turnout is one person at one drive, so someone who came to five drives counts five times.</p>
      </section>
      {top.length > 0 && (
        <section className="card tp-places ex-panel" aria-labelledby="calc-p-h">
          <h2 id="calc-p-h" className="mono xs upper muted tp-small-h">where most of them happened</h2>
          <ul className="ex-bars">
            {top.map(([name, n]) => <li key={name}><span className="ex-bars-l">{name}</span><GrowBar key={name + n} pct={(n / busiest) * 100} fill="var(--welfare)" /><span className="tp-bar-n">{n}</span></li>)}
          </ul>
          {def && <Link to={topicPath(def.slug)} className="btn btn-sm">read about {def.label} →</Link>}
        </section>
      )}
      <PhotoMosaic photos={sel.filter(d => d.i).slice(-24).reverse().map(toPhoto)} label="photos from the drives you picked" initial={9} />
    </>
  )
}

/* ── quiz ─────────────────────────────────────────────────────────────── */
function Quiz() {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const done = Object.keys(answers).length === QUIZ.length
  const result = done ? scoreQuiz(answers) : []
  const resultRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (done) resultRef.current?.focus() }, [done])
  return (
    <>
      <ol className="ex-quiz">
        {QUIZ.map((q, qi) => (
          <li key={qi} className="card ex-q">
            <fieldset>
              <legend className="h-display ex-q-h">{qi + 1}. {q.q}</legend>
              <div className="ex-opts">
                {q.options.map((o, oi) => (
                  <label key={oi} className={`ex-opt${answers[qi] === oi ? ' is-on' : ''}`}>
                    <input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers(a => ({ ...a, [qi]: oi }))} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      {done && (
        <div ref={resultRef} tabIndex={-1} className="card ex-result-card" aria-live="polite">
          <p className="mono xs upper muted" style={{ fontWeight: 700, margin: 0 }}>your drives</p>
          <h2 className="h-display pl-h2">start with {TOPIC_BY_SLUG[result[0]]?.label.split(':')[0].toLowerCase()}.</h2>
          <div className="tp-rel-grid">
            {result.slice(0, 3).map(slug => {
              const t = TOPIC_BY_SLUG[slug]
              return t && (
                <TiltLink key={slug} to={topicPath(slug)} className="card tp-rel">
                  <span className="tp-rel-t">{t.label}</span>
                  {TOPIC_INDEX[slug] && <span className="tp-rel-n">{TOPIC_INDEX[slug].count} drives so far</span>}
                </TiltLink>
              )
            })}
          </div>
          <div className="pl-links">
            <button type="button" className="btn btn-sm" onClick={() => setAnswers({})}>take it again</button>
            <Link to="/join" className="btn btn-sm btn-primary">join and pick your first drive →</Link>
          </div>
        </div>
      )}
    </>
  )
}

/* ── places ───────────────────────────────────────────────────────────── */
function Places() {
  const { drives, error } = useDrives()
  const [open, setOpen] = useState<string | null>(null)
  const list = useMemo(() => {
    if (!drives) return []
    const m = new Map<string, DriveLite[]>()
    for (const d of drives) { const k = normalisePlace(d.p); if (!k || k === 'Kolkata') continue; if (!m.has(k)) m.set(k, []); m.get(k)!.push(d) }
    return [...m.entries()].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length)
  }, [drives])
  if (!drives) return <Loading error={error} />
  const max = list[0]?.[1].length || 1
  const sel = open ? list.find(([k]) => k === open) : null
  return (
    <>
      <section className="card ex-panel" aria-labelledby="pl-h">
        <h2 id="pl-h" className="h-display pl-h2">{list.length} places we have been back to</h2>
        <p className="pl-p">bigger bubbles, more drives. tap one to see what happened there.</p>
        <ul className="ex-bubbles">
          {list.map(([name, ds], k) => {
            const size = 44 + Math.round(Math.sqrt(ds.length / max) * 96)
            return (
              <li key={name}>
                <button type="button" className={`ex-bubble-btn${open === name ? ' is-on' : ''}`} aria-pressed={open === name}
                  onClick={() => setOpen(open === name ? null : name)} aria-label={`${name}: ${ds.length} drives`}>
                  <span className={`ex-bubble ex-b${k % 5}`} style={{ width: size, height: size }} aria-hidden><span className="ex-bubble-n">{ds.length}</span></span>
                  <span className="ex-bubble-t" aria-hidden>{name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      {sel && (
        <section aria-labelledby="pl-sel-h" className="ex-sel">
          <h2 id="pl-sel-h" className="h-display pl-h2">{sel[0]}: {sel[1].length} drives</h2>
          <PhotoMosaic photos={sel[1].filter(d => d.i).map(toPhoto)} label={`photos from ${sel[0]}`} initial={9} />
          <ul className="tp-drive-list">
            {sel[1].map(d => <li key={d.s}><Link to={`/projects/${d.s}`} className="tp-drive"><span className="tp-drive-t">{d.t}</span><span className="tp-drive-m">{monthLabel(monthKey(d.d))}</span></Link></li>)}
          </ul>
        </section>
      )}
    </>
  )
}

/* ── map ──────────────────────────────────────────────────────────────── */
const TOPIC_FACTS = import.meta.glob<{ drives: { slug: string; title: string; img?: string; alt?: string; date: string | null; place: string | null }[] }>('../lib/topics/facts/*.json', { import: 'default' })

function KolkataMap() {
  const [open, setOpen] = useState<string | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  useEffect(() => {
    if (!open) { setPhotos([]); return }
    let live = true
    TOPIC_FACTS[`../lib/topics/facts/${open}.json`]?.().then(f => { if (live) setPhotos(f.drives.filter(d => d.img).map(d => ({ slug: d.slug, title: d.title, img: d.img!, alt: d.alt, date: d.date, place: d.place }))) })
    return () => { live = false }
  }, [open])
  const max = Math.max(...MAP_PINS.map(p => TOPIC_INDEX[p.slug]?.count || 1))
  const sel = MAP_PINS.find(p => p.slug === open)
  return (
    <>
      <section className="card ex-panel" aria-labelledby="map-h">
        <h2 id="map-h" className="h-display pl-h2">tap a neighbourhood</h2>
        <div className="ex-map">
          <svg viewBox="0 0 100 100" className="ex-map-svg" aria-hidden>
            <path d="M8 4 C 20 20, 30 30, 30 48 S 22 80, 30 98" className="ex-river" />
            <text x="31" y="52" className="ex-river-t">Hooghly</text>
            <path d="M90 80 L 97 92" className="ex-sund" />
            <text x="60" y="96" className="ex-river-t">to the Sundarbans ↘</text>
          </svg>
          {MAP_PINS.map(p => {
            const n = TOPIC_INDEX[p.slug]?.count || 0
            const size = 28 + Math.round(Math.sqrt(n / max) * 34)
            return (
              <button key={p.slug} type="button" className={`ex-pin${open === p.slug ? ' is-on' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%`, width: size, height: size }}
                aria-pressed={open === p.slug} aria-label={`${p.name}: ${n} drives`} onClick={() => setOpen(open === p.slug ? null : p.slug)}>
                <span aria-hidden>{n}</span>
                <span className="ex-pin-t" aria-hidden>{p.name}</span>
              </button>
            )
          })}
        </div>
        <p className="pl-p ex-note">drawn by hand, not to scale. the Sundarbans trips have <Link to="/impact/sundarbans" className="tp-inline">their own page</Link>.</p>
      </section>
      {sel && (
        <section aria-labelledby="map-sel-h" className="ex-sel">
          <div className="tp-photos-h">
            <h2 id="map-sel-h" className="h-display pl-h2">{sel.name}</h2>
            <Link to={topicPath(sel.slug)} className="btn btn-sm tp-story-btn">everything in {sel.name} →</Link>
          </div>
          <PhotoMosaic photos={photos} label={`photos from ${sel.name}`} initial={9} />
        </section>
      )}
    </>
  )
}

/* ── compare two years ─────────────────────────────────────────────────── */
function Compare() {
  const { drives, error } = useDrives()
  const years = useMemo(() => drives ? [...new Set(drives.map(d => Number(d.d.slice(0, 4))))].sort() : [], [drives])
  const [a, setA] = useState<number | null>(null)
  const [b, setB] = useState<number | null>(null)
  if (!drives) return <Loading error={error} />
  const ya = a ?? years[years.length - 2], yb = b ?? years[years.length - 1]
  const cols = [yearStats(drives, ya), yearStats(drives, yb)]
  const top = Math.max(1, ...cols.map(c => c.count))
  return (
    <section className="card ex-panel" aria-labelledby="cmp-h">
      <h2 id="cmp-h" className="h-display pl-h2">{ya} or {yb}?</h2>
      <div className="ex-form">
        <label>first year<select value={ya} onChange={e => setA(Number(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
        <label>second year<select value={yb} onChange={e => setB(Number(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
      </div>
      <div className="ex-cmp">
        {cols.map((c, ci) => (
          <div key={ci} className="ex-cmp-col">
            <h3 className="h-display ex-cmp-y">{c.year}</h3>
            <dl className="ex-cmp-dl">
              <div><dt>drives</dt><dd><CountOnView key={`c${c.year}`} value={c.count} /></dd></div>
              <div><dt>volunteer turnouts</dt><dd><CountOnView key={`v${c.year}`} value={c.turnouts} /></dd></div>
              <div><dt>places</dt><dd><CountOnView key={`p${c.year}`} value={c.places} /></dd></div>
            </dl>
            <GrowBar key={`g${c.year}`} pct={(c.count / top) * 100} fill={ci ? 'var(--sky)' : 'var(--welfare)'} />
            {c.topSeries.length > 0 && <p className="pl-p ex-cmp-s">ran most: {c.topSeries.map(([k, n]) => `${TOPIC_BY_SLUG[k]?.label.split(':')[0] || k} (${n})`).join(', ')}</p>}
            <PhotoMosaic photos={c.drives.filter(d => d.i).slice(0, 6).map(toPhoto)} label={`photos from ${c.year}`} initial={6} />
            <Link to={topicPath(`year-${c.year}`)} className="btn btn-sm">all of {c.year} →</Link>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── surprise me ───────────────────────────────────────────────────────── */
function Surprise() {
  const { drives, error } = useDrives()
  const pool = useMemo(() => drives ? shuffle(drives.filter(d => d.i)) : [], [drives])
  const [i, setI] = useState(0)
  const btn = useRef<HTMLButtonElement>(null)
  if (!drives) return <Loading error={error} />
  const d = pool[i % pool.length]
  if (!d) return null
  return (
    <section className="ex-surprise" aria-live="polite">
      <article key={d.s} className="card ex-surprise-card">
        <Img src={d.i!} alt={d.t} ctx="full" className="ex-surprise-img" />
        <div className="ex-surprise-body">
          <p className="mono xs upper muted" style={{ fontWeight: 700, margin: 0 }}>{monthLabel(monthKey(d.d))}{d.p ? ` · ${d.p}` : ''}</p>
          <h2 className="h-display pl-h2">{d.t}</h2>
          <div className="pl-links">
            <Link to={`/projects/${d.s}`} className="btn btn-sm">read this drive →</Link>
            {d.k && <Link to={topicPath(d.k)} className="btn btn-sm">more like this →</Link>}
          </div>
        </div>
      </article>
      <button ref={btn} type="button" className="btn btn-primary ex-surprise-btn" onClick={() => setI(n => n + 1)}>🎲 another one</button>
      <p className="pl-p ex-note">{(i % pool.length) + 1} of {pool.length} drives with photos, in a random order.</p>
    </section>
  )
}

/* ── memory game ───────────────────────────────────────────────────────── */
function Memory() {
  const { drives, error } = useDrives()
  const [seed, setSeed] = useState(0)
  const deck = useMemo(() => {
    if (!drives) return []
    const picks = shuffle(drives.filter(d => d.i)).slice(0, 6)
    return shuffle(picks.flatMap(d => [{ key: `${d.s}-a`, d }, { key: `${d.s}-b`, d }]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drives, seed])
  const [up, setUp] = useState<number[]>([])
  const [found, setFound] = useState<Set<string>>(new Set())
  const [moves, setMoves] = useState(0)
  const busy = up.length === 2
  useEffect(() => {
    if (up.length !== 2) return
    const [x, y] = up
    const t = window.setTimeout(() => {
      if (deck[x].d.s === deck[y].d.s) setFound(f => new Set(f).add(deck[x].d.s))
      setUp([])
    }, deck[x].d.s === deck[y].d.s ? 350 : 900)
    return () => window.clearTimeout(t)
  }, [up, deck])
  if (!drives) return <Loading error={error} />
  const done = found.size === 6
  const flip = (k: number) => {
    if (busy || up.includes(k) || found.has(deck[k].d.s)) return
    if (up.length === 1) setMoves(m => m + 1)
    setUp(u => [...u, k])
  }
  const restart = () => { setSeed(n => n + 1); setUp([]); setFound(new Set()); setMoves(0) }
  return (
    <section className="card ex-panel" aria-labelledby="mem-h">
      <div className="tp-photos-h">
        <h2 id="mem-h" className="h-display pl-h2">{done ? `all six pairs, in ${moves} moves` : `${found.size} of 6 pairs found`}</h2>
        <button type="button" className="btn btn-sm" onClick={restart}>new cards</button>
      </div>
      <p className="pl-p ex-note" aria-live="polite">{moves} {moves === 1 ? 'move' : 'moves'}</p>
      <ul className="ex-mem">
        {deck.map((c, k) => {
          const shown = up.includes(k) || found.has(c.d.s)
          return (
            <li key={c.key}>
              <button type="button" className={`ex-mem-card${shown ? ' is-up' : ''}${found.has(c.d.s) ? ' is-found' : ''}`} onClick={() => flip(k)}
                aria-label={shown ? `card ${k + 1}: ${c.d.t}` : `card ${k + 1}, face down`} aria-pressed={shown}>
                <span className="ex-mem-back" aria-hidden>AQ</span>
                <span className="ex-mem-face" aria-hidden><Img src={c.d.i!} alt="" ctx="thumb" eager /></span>
              </button>
            </li>
          )
        })}
      </ul>
      {done && (
        <div className="ex-result-card">
          <h3 className="h-display pl-h2">the drives behind your pairs</h3>
          <ul className="tp-drive-list">
            {[...new Map(deck.map(c => [c.d.s, c.d])).values()].map(d => <li key={d.s}><Link to={`/projects/${d.s}`} className="tp-drive"><span className="tp-drive-t">{d.t}</span><span className="tp-drive-m">{monthLabel(monthKey(d.d))}</span></Link></li>)}
          </ul>
        </div>
      )}
    </section>
  )
}

function Index() {
  return (
    <div className="ex-index">
      {EXPLORERS.map(e => (
        <TiltLink key={e.slug} to={`/impact/explore/${e.slug}`} className="card ex-card">
          <span className="ex-card-emoji" aria-hidden>{e.icon}</span>
          <span className="tp-rel-t">{e.label}</span>
          <span className="pl-p" style={{ margin: 0 }}>{e.blurb}</span>
        </TiltLink>
      ))}
      <TiltLink to="/impact/stories" className="card ex-card"><span className="ex-card-emoji" aria-hidden>📸</span><span className="tp-rel-t">photo stories</span><span className="pl-p" style={{ margin: 0 }}>each drive series, year by year, in its own photos.</span></TiltLink>
    </div>
  )
}

export default function ExplorePage() {
  const { '*': splat = '' } = useParams()
  const slug = splat.replace(/^explore\/?/, '').replace(/\/+$/, '') || 'index'
  const ex = EXPLORERS.find(e => e.slug === slug) || (slug === 'index' ? EXPLORERS_INDEX : null)
  useMeta({ title: ex ? ex.title : 'Not found · AquaTerra', description: ex?.description, path: slug === 'index' ? '/impact/explore' : `/impact/explore/${slug}`, noIndex: !ex })
  useJsonLd(`explore-${slug}`, ex ? {
    '@context': 'https://schema.org', '@type': slug === 'index' ? 'CollectionPage' : 'WebApplication', name: ex.title, description: ex.description,
    url: `https://www.ngoaquaterra.com${slug === 'index' ? '/impact/explore' : `/impact/explore/${slug}`}`,
    ...(slug === 'index' ? {} : { applicationCategory: 'EducationalApplication', operatingSystem: 'Any', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' } }),
    publisher: { '@type': 'Organization', name: 'NGO AquaTerra', url: 'https://www.ngoaquaterra.com/' },
  } : null)
  if (!ex) {
    return <div className="route-enter container pl-body" style={{ paddingTop: 64 }}><h1 className="h-display pl-h2">that explorer is not here.</h1><Link to="/impact/explore" className="btn btn-primary">all explorers →</Link></div>
  }
  if (slug === 'index') {
    return (
      <div className="route-enter pl-page">
        <section className="pl-hero"><div className="container">
          <nav className="tp-crumb mono xs upper" aria-label="breadcrumb"><Link to="/impact">how we give back</Link></nav>
          <h1 className="giant pl-h1">explore the <span className="underline-doodle pl-accent tp-accent">work</span>.</h1>
          <p className="pl-lede">{EXPLORERS_INDEX.description}</p>
        </div></section>
        <div className="container pl-body"><Index /></div>
      </div>
    )
  }
  return (
    <Shell slug={slug}>
      {slug === 'timeline' && <Timeline />}
      {slug === 'calculator' && <Calculator />}
      {slug === 'quiz' && <Quiz />}
      {slug === 'places' && <Places />}
      {slug === 'map' && <KolkataMap />}
      {slug === 'compare' && <Compare />}
      {slug === 'surprise' && <Surprise />}
      {slug === 'memory' && <Memory />}
    </Shell>
  )
}

const EXPLORERS_INDEX = {
  slug: 'index', title: 'Explore AquaTerra\'s Drives | Timeline, Calculator, Quiz · AquaTerra',
  description: 'play with every drive AquaTerra has written up since 2021: scrub through the months, add up any series, find the drive that suits you, and tap through the places we keep going back to.',
}

