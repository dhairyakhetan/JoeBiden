import type { CSSProperties } from 'react'
import { photoSrc } from '../data/photos'

/**
 * A photograph with film grain over it. An <img> cannot hold a pseudo-element, so the picture sits in a figure and the grain is the
 * figure's ::after (see .lv-photo in live.css). `wipe` reveals it with a clip-path when it scrolls into view.
 */
export function Photo({ id, size = 'm', alt = '', className = '', wipe = false, style, width, height }: {
  id: string; size?: 's' | 'm'; alt?: string; className?: string; wipe?: boolean; style?: CSSProperties; width?: number; height?: number
}) {
  return (
    <figure className={'lv-photo ' + (wipe ? 'lv-wipe ' : '') + className} style={style}>
      <img src={photoSrc(id, size)} width={width ?? (size === 's' ? 360 : 960)} height={height ?? (size === 's' ? 480 : 720)} alt={alt} loading="lazy" decoding="async" />
    </figure>
  )
}
