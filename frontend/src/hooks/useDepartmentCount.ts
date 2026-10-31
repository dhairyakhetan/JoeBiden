import { useEffect, useState } from 'react'
import teamService from '../services/teamService'
import { ORG_FACTS } from '../lib/orgFacts'
import { countDepartments } from '../lib/orgFigures'

// One read for the whole page load, shared by every caller. The build-time figure shows until it lands
// (and stays if the read fails), so copy never waits on the network and never shows a blank.
let pending: Promise<number> | null = null

function load(): Promise<number> {
  if (!pending) {
    // An empty tree is a failed or blocked read, not an org with no departments: fall back like an error does.
    pending = teamService.getDepartmentTree().then(tree => countDepartments(tree) || ORG_FACTS.departmentsActive).catch(() => {
      pending = null
      return ORG_FACTS.departmentsActive
    })
  }
  return pending
}

/** The live number of top-level departments, the same one the department chart draws. */
export function useDepartmentCount(): number {
  const [n, setN] = useState(ORG_FACTS.departmentsActive)
  useEffect(() => {
    let cancelled = false
    load().then(v => { if (!cancelled) setN(v) })
    return () => { cancelled = true }
  }, [])
  return n
}
