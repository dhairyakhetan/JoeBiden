import './VariationsGallery.css'
import { DEPARTMENTS } from '../lib/departments'

/**
 * DEV ONLY. Routed behind `import.meta.env.DEV` in App.tsx, so this ships as
 * dead code and is tree-shaken out of production.
 *
 * Three candidate answers to one question: where does the 2px ink outline
 * belong now? The current system's rule is "2px ink border on everything".
 * The 2026-09-05 direction brief asks for the opposite: colour and layering
 * carry the structure, and the outline is reserved for emphasis.
 *
 * Every variation below uses the REAL tokens, the REAL fonts and the REAL
 * department hues. Nothing here invents a colour, so what you are comparing is
 * only the outline rule, not a different palette.
 */

const DEPTS = DEPARTMENTS.slice(0, 4)

/** One row of sample data, reused across all three so the only variable is the rule. */
const ROWS = [
  { name: 'Aarav Sen', cls: 'Class 11', team: 'Welfare Projects', when: '18 Aug', status: 'pending' },
  { name: 'Ishita Roy', cls: 'College 2nd Year', team: 'Events', when: '17 Aug', status: 'approved' },
  { name: 'Rohan Das', cls: 'Class 12', team: 'Crftd', when: '17 Aug', status: 'approved' },
  { name: 'Meera Nair', cls: 'College 1st Year', team: 'ShikshAQ', when: '16 Aug', status: 'rejected' },
]

function Panel({ id, name, rule, children }: { id: string; name: string; rule: string; children: React.ReactNode }) {
  return (
    <section className={`vg-panel vg-${id}`}>
      <header className="vg-head">
        <span className="vg-tag">{id.toUpperCase()}</span>
        <h2 className="vg-name">{name}</h2>
        <p className="vg-rule">{rule}</p>
      </header>
      <div className="vg-stage">{children}</div>
    </section>
  )
}

/** The same four components, rendered inside whichever variation wraps them. */
function Specimen() {
  return (
    <>
      {/* 1. a content card */}
      <div className="vg-card">
        <div className="vg-card-top">
          <span className="vg-cat">welfare</span>
          <span className="vg-meta">28d ago</span>
        </div>
        <h3 className="vg-card-t">Smile Notes Campaign</h3>
        <p className="vg-card-b">Volunteers wrote and delivered notes to children across Khidirpur.</p>
        <div className="vg-photo" aria-hidden />
        <div className="vg-card-foot">
          <span className="vg-stat"><b>8</b><i>volunteers</i></span>
          <button className="vg-btn vg-btn-primary" type="button">read →</button>
        </div>
      </div>

      {/* 2. department rows, the one-hue-per-row device */}
      <div className="vg-rows">
        {DEPTS.map(d => (
          <div key={d.name} className="vg-row" style={{ ['--dept' as any]: d.color }}>
            <span className="vg-row-n">{d.name}</span>
            <span className="vg-row-s">{d.stat}</span>
            <span className="vg-row-go" aria-hidden>→</span>
          </div>
        ))}
      </div>

      {/* 3. chips + buttons */}
      <div className="vg-chips">
        <button className="vg-chip is-on" type="button">all</button>
        <button className="vg-chip" type="button">events</button>
        <button className="vg-chip" type="button">welfare</button>
        <button className="vg-btn vg-btn-primary" type="button">post →</button>
      </div>

      {/* 4. the HoD desk table */}
      <div className="vg-table-wrap">
        <table className="vg-table">
          <thead>
            <tr><th>member</th><th>class</th><th>team</th><th className="vg-num">applied</th><th>status</th></tr>
          </thead>
          <tbody>
            {ROWS.map(r => (
              <tr key={r.name} data-status={r.status}>
                <td className="vg-td-n">{r.name}</td>
                <td>{r.cls}</td>
                <td>{r.team}</td>
                <td className="vg-num">{r.when}</td>
                <td><span className={`vg-status is-${r.status}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default function VariationsGallery() {
  return (
    <div className="vg-page">
      <header className="vg-page-head">
        <h1>outline rule · three variations</h1>
        <p>
          Same components, same tokens, same fonts, same department hues. The only
          variable is <b>where the 2px ink outline is allowed</b>.
        </p>
      </header>

      <div className="vg-grid">
        <Panel
          id="a"
          name="Outline as emphasis"
          rule="Outline survives only on the primary CTA, the active pill, and one hero element per screen. Everything else separates by fill and radius."
        >
          <Specimen />
        </Panel>

        <Panel
          id="b"
          name="Outline by layer depth"
          rule="Page-level frames (nav, dock, hero, footer) keep the outline. Content inside them drops it. A clear frame-vs-contents logic."
        >
          <Specimen />
        </Panel>

        <Panel
          id="c"
          name="Outline by surface temperature"
          rule="Outline on paper grounds only. On a hue or ink ground, components separate by fill alone."
        >
          <Specimen />
        </Panel>

        <Panel
          id="now"
          name="Today (for comparison)"
          rule="The current rule: 2px ink border on everything."
        >
          <Specimen />
        </Panel>
      </div>
    </div>
  )
}
