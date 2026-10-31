/**
 * One of the copper stickers from the AquaTerra design engine (calendar, pin, heart, star, diya): photographed-metal art on a
 * transparent ground. Decorative, so it is hidden from assistive tech. `rot` tilts it; `float` bobs it gently.
 */
export type StickerName = 'calendar' | 'pin' | 'heart' | 'star' | 'diya'
const RATIO: Record<StickerName, number> = { calendar: 374 / 400, pin: 519 / 400, heart: 352 / 400, star: 1, diya: 246 / 400 }

export function Sticker({ name, size = 96, rot = 0, float = true, className = '' }: { name: StickerName; size?: number | string; rot?: number; float?: boolean; className?: string }) {
  const w = typeof size === 'number' ? `${size}px` : size
  return (
    <span className={'lv-stk ' + (float ? 'is-float ' : '') + className} style={{ width: w, ['--rot' as string]: `${rot}deg`, aspectRatio: `1 / ${RATIO[name]}` }} aria-hidden>
      <img src={`/live/stickers/${name}.webp`} alt="" width={400} height={Math.round(400 * RATIO[name])} loading="lazy" decoding="async" />
    </span>
  )
}
