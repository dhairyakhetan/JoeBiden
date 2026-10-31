import './TeamsStructure.css'
import OrgHero from '../components/OrgHero'
import NowHiring from './NowHiring'
import { departmentsPhrase, capitalise } from '../lib/orgFigures'
import { useDepartmentCount } from '../hooks/useDepartmentCount'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'

// /teams is the department structure itself (owner, 2026-10-18): the same chart the About page opens with,
// so there is one place to see every department, every team inside it and every person, not a list that
// repeats a picture two taps away. The old category filter and card grid are gone; each department's own
// page (/teams/:uuid) and its sub-team pages are unchanged and reached from the chart.
export default function TeamsPage() {
  useMeta(pageMetadata.teams)
  useJsonLd('teams-breadcrumb', breadcrumbLd([['Home', '/'], ['Teams', '/teams']]))
  const departments = useDepartmentCount()
  return (
    <div className="route-enter">
      <section className="tm-hero bleed-under-nav" data-nav-tint="ink">
        <div className="tm-grid" aria-hidden />
        <div className="tm-inner">
          <div className="tm-head">
            <div>
              <div className="tm-kicker">★ the teams</div>
              <h1 className="tm-h1">every team,<br /><span className="tm-h1-em">one picture.</span></h1>
            </div>
            <p className="tm-lead">
              {capitalise(departmentsPhrase(departments))}, and every team inside them. Tap a department to see what is inside it and who is on it.
            </p>
          </div>

          <OrgHero />

          <NowHiring />
        </div>
      </section>
    </div>
  )
}
