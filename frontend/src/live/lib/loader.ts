import { DISCO } from '../config'

/** What the first-visit loader says. The Disco Diwali page opens on its own line; everywhere else keeps the hub's. */
export function loaderLine(pathname: string): string {
  const p = pathname.replace(/\/+$/, '')
  return p === DISCO.base || p.startsWith(`${DISCO.base}/`) ? 'Masks on.' : 'Turning the lights on'
}
