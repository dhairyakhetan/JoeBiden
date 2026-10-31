import { useEffect, useRef, useState } from 'react'
import './HiStrip.css'

/**
 * HiStrip — the "kids saying hi" video ribbon.
 *
 * Eight short clips from a winter drive are pre-stitched into ONE wide reel
 * (public/hi/hi-reel.mp4, 2560×320, ~570KB). Two things matter here:
 *
 *  - The frames are SQUARE. The first version used 9:16 tiles, which at the
 *    strip's height came out ~61px wide on screen — too narrow to make out a
 *    single face, so it read as a smear of colour instead of kids waving.
 *  - It's one stitched video, not eight elements. Eight <video> tags would mean
 *    eight decoders, which phones handle badly; this is a single decoder and the
 *    motion is a plain CSS transform, so it stays cheap even in the header.
 *
 * The track holds two copies of the strip and translates by exactly -50%, which
 * lands copy #2 precisely where copy #1 started — a seamless loop with no jump.
 *
 * Behaviour:
 *  - autoplay requires muted + playsInline; both are set (and `controls` never is)
 *  - paused whenever it's off-screen or the tab is hidden, so it costs nothing
 *    while you're reading the rest of the page
 *  - prefers-reduced-motion → no scroll, no playback, just the poster still
 */
export default function HiStrip({
  height,
  label = 'Students and kids from AquaTerra drives waving hello',
}: {
  /** CSS height of the ribbon. Defaults to a thin mobile bar / taller on desktop. */
  height?: number | string
  label?: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // Only decode while actually on screen and the tab is focused.
  useEffect(() => {
    if (reduced) return
    const host = hostRef.current
    if (!host) return

    let onScreen = false
    const sync = () => {
      const shouldPlay = onScreen && !document.hidden
      videoRefs.current.forEach(v => {
        if (!v) return
        if (shouldPlay) v.play().catch(() => { /* autoplay blocked — poster stands in */ })
        else v.pause()
      })
    }
    const io = new IntersectionObserver(entries => {
      onScreen = entries.some(e => e.isIntersecting)
      sync()
    }, { rootMargin: '200px' })
    io.observe(host)
    document.addEventListener('visibilitychange', sync)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [reduced])

  const h = height ?? undefined

  return (
    <div
      ref={hostRef}
      className="hi-strip"
      style={h ? ({ ['--hi-h' as any]: typeof h === 'number' ? `${h}px` : h }) : undefined}
      role="img"
      aria-label={label}
    >
      <div className={'hi-strip-track' + (reduced ? ' is-still' : '')}>
        {reduced ? (
          <>
            <img src="/hi/hi-reel.jpg" alt="" aria-hidden />
            <img src="/hi/hi-reel.jpg" alt="" aria-hidden />
          </>
        ) : (
          // Two copies so the -50% translate seams perfectly. Both are real
          // videos — pairing a video with a still would scroll a frozen frame
          // next to a moving one. They start together and loop on the same
          // 1.7s cycle; any drift is invisible on a reel of unrelated clips.
          [0, 1].map(i => (
            <video
              key={i}
              ref={el => { videoRefs.current[i] = el }}
              src="/hi/hi-reel.mp4"
              poster="/hi/hi-reel.jpg"
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden
            />
          ))
        )}
      </div>
    </div>
  )
}
