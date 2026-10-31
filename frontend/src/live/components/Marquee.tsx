/**
 * A slow ticker of short lines. `ticker` is the red hairline strip that closes an editorial page; the default is the big
 * blackletter band. The second copy is for the seamless loop only, so it is hidden from assistive tech.
 */
export function Marquee({ items, ticker = false }: { items: string[]; ticker?: boolean }) {
  const row = (hidden: boolean) => (
    <ul className="lv-marquee-row" aria-hidden={hidden || undefined}>
      {items.map((t, i) => <li key={i}>{t}<span aria-hidden> ✦ </span></li>)}
    </ul>
  )
  return <div className={'lv-marquee' + (ticker ? ' is-ticker' : '')}>{row(false)}{row(true)}</div>
}
