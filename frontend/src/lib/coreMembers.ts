import { useEffect, useState } from 'react'
import coreMemberService, { type CoreMember } from '../services/coreMemberService'

/**
 * Who carries the AQ Core badge, read once per page load and shared by every
 * badge on the page (profile, member lists, the desk). Small (one row per
 * core member), public, and a failed read just shows no badges: the badge is
 * decoration around a page, not its content.
 */
let cache: Promise<CoreMember[]> | null = null
const listeners = new Set<() => void>()

function load(): Promise<CoreMember[]> {
  if (!cache) cache = coreMemberService.getCoreTeam().catch(() => { cache = null; return [] })
  return cache
}

/** Call after adding or removing someone so every badge on the page updates. */
export function refreshCoreMembers(): void {
  cache = null
  void load().then(() => listeners.forEach(l => l()))
}

export interface CoreSets { ready: boolean; ids: Set<number>; uuids: Set<string> }

export function useCoreMembers(): CoreSets {
  const [state, setState] = useState<CoreSets>({ ready: false, ids: new Set(), uuids: new Set() })
  useEffect(() => {
    let live = true
    const pull = () => load().then(list => {
      if (live) setState({ ready: true, ids: new Set(list.map(m => m.memberId)), uuids: new Set(list.map(m => m.uuid)) })
    })
    listeners.add(pull)
    void pull()
    return () => { live = false; listeners.delete(pull) }
  }, [])
  return state
}

/**
 * Turns whatever was pasted from the Google Sheet (a column, a row, commas,
 * semicolons, "Name <email>") into a clean, de-duplicated, lowercased list of
 * email addresses. Anything that is not an email is ignored.
 */
export function parseEmailList(text: string): string[] {
  const found = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []
  return [...new Set(found.map(e => e.toLowerCase()))]
}
