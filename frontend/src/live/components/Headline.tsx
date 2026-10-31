import type { ElementType } from 'react'

/** The hub's signature headline: blackletter display type, with the last word in the section's accent colour. */
export function Headline({ text, as: Tag = 'h2', className = '', id }: { text: string; as?: ElementType; className?: string; id?: string }) {
  const words = text.trim().split(/\s+/)
  const last = words.pop() ?? ''
  return (
    <Tag id={id} className={'lv-h ' + className}>
      {words.length > 0 && <>{words.join(' ')} </>}
      <em>{last}</em>
    </Tag>
  )
}

/** A numbered chapter marker, for example "01 / Who are we?". */
export function Kicker({ children }: { children: string }) {
  return <p className="lv-kicker">{children}</p>
}
