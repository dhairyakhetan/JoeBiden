import RoleTile from '../components/RoleTile'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import teamService, { type DepartmentTreeTeam } from '../services/teamService'
import { jobOpenings, type JobOpening } from '../lib/jobOpenings'
import { buildStage, groupOpeningsByDepartment } from '../lib/orgStage'
import './NowHiring.css'

/**
 * Every open role on the Teams page, under the department that holds it. The chart above says which departments are
 * hiring; this says for what, with a way to open each role. A failed department read still lists the roles, in one group.
 */
export default function NowHiring() {
  const [ops, setOps] = useState<JobOpening[] | null>(null)
  const [tree, setTree] = useState<DepartmentTreeTeam[] | null>(null)

  useEffect(() => {
    let cancelled = false
    jobOpenings.getOpen().then(r => { if (!cancelled) setOps(r) }).catch(() => { if (!cancelled) setOps([]) })
    teamService.getDepartmentTree().then(t => { if (!cancelled) setTree(t) }).catch(() => { /* flat list below */ })
    return () => { cancelled = true }
  }, [])

  const groups = useMemo(() => {
    if (!ops || ops.length === 0) return []
    return tree
      ? groupOpeningsByDepartment(buildStage(tree, null), ops)
      : [{ uuid: 'rest', name: 'across AquaTerra', items: ops }]
  }, [ops, tree])

  if (!ops || ops.length === 0) return null

  return (
    <section className="tm-hire" aria-labelledby="tm-hire-h">
      <div className="tm-hire-head">
        <h2 id="tm-hire-h" className="tm-hire-title">now hiring</h2>
        <p className="tm-hire-count">{ops.length} {ops.length === 1 ? 'role is' : 'roles are'} open right now.</p>
        <Link to="/opportunities" className="tm-hire-all">see all roles <span aria-hidden>→</span></Link>
      </div>
      <div className="tm-hire-groups">
      {groups.map(g => (
        <div key={g.uuid} className="tm-hire-group" style={{ ['--cols' as string]: Math.min(g.items.length, 3) }}>
          <h3 className="tm-hire-dept">{g.name} <b>{g.items.length}</b></h3>
          <ul className="tm-hire-grid">
            {g.items.map(op => <li key={op.id}><RoleTile op={op} /></li>)}
          </ul>
        </div>
      ))}
      </div>
    </section>
  )
}
