import { captureBox } from './shortcutLogic'
import { acceptScreenshot } from './shrinkImage'

/** 1x1 transparent gif: what a cross-origin image becomes if the browser will not hand it over. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='
const TIMEOUT_MS = 8000

/** Things that must never be in the picture: the report form itself and the toasts. */
function keep(node: Node): boolean {
  if (!(node instanceof Element)) return true
  return !(node.classList.contains('aqm-back') || node.classList.contains('aq-toasts') || node.hasAttribute('data-bug-ignore'))
}

const isSafari = () => /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent)

/**
 * A picture of what the member is looking at, as a PNG file, or null when it cannot be taken.
 *
 * It is the page REDRAWN from its own content (html-to-image), not a pixel capture: a website
 * cannot silently capture a screen. So it is approximate. Fonts, cross-origin images without
 * CORS, video, and anything inside a shadow root (Terra Notes) can differ or be blank, and
 * fixed bars sit where the redraw puts them. The form always lets the member remove it and
 * attach a real screenshot instead. It renders `document.body`: rendering `<html>` fails in
 * Chromium (found by testing; the same options on the body work). Loaded on demand, so none of this is in the entry bundle.
 */
export async function captureViewport(): Promise<File | null> {
  try {
    const { toCanvas } = await import('html-to-image')
    const box = captureBox({ innerWidth: window.innerWidth, innerHeight: window.innerHeight, scrollY: window.scrollY, dpr: window.devicePixelRatio })
    const opts = {
      width: window.innerWidth,
      height: box.renderHeight,
      pixelRatio: box.ratio,
      cacheBust: false,
      imagePlaceholder: BLANK,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
      filter: keep,
    }
    const work = (async () => {
      // Safari draws an SVG foreignObject blank the first time; a throwaway pass warms it up.
      if (isSafari()) await toCanvas(document.body, { ...opts, height: Math.min(box.renderHeight, 64), pixelRatio: 1 })
      return toCanvas(document.body, opts)
    })()
    const full = await Promise.race([work, new Promise<null>(r => setTimeout(() => r(null), TIMEOUT_MS))])
    if (!full) return null

    const out = document.createElement('canvas')
    out.width = full.width
    out.height = Math.max(1, Math.round(box.cropHeight * box.ratio))
    out.getContext('2d')?.drawImage(full, 0, Math.round(box.cropTop * box.ratio), full.width, out.height, 0, 0, out.width, out.height)
    const blob: Blob | null = await new Promise(resolve => out.toBlob(resolve, 'image/png'))
    if (!blob || blob.size < 3000) return null   // a blank frame is smaller than any real page
    const accepted = await acceptScreenshot(new File([blob], 'page.png', { type: 'image/png' }))
    return accepted.ok ? accepted.file : null
  } catch (err) {
    console.warn('[bug report] page capture failed', err)
    return null
  }
}
