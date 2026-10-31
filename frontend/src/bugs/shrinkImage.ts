import { BUG_IMAGE_TYPES, BUG_LIMITS, shrinkTarget } from './bugModel'

/** Anything under this is uploaded as it is (a phone screenshot is usually 1 to 3 MB). */
const KEEP_AS_IS_BYTES = 1.5 * 1024 * 1024
const MAX_EDGE = 1600

export type AcceptResult =
  | { ok: true; file: File }
  | { ok: false; reason: string }

/**
 * Takes a file the member picked, pasted or captured and returns one the bucket will
 * accept: an allowed type, at most 5 MB. Big images are redrawn at 1600px on the long edge
 * as WebP, which keeps text in a screenshot readable and is a fraction of the size.
 * The bucket enforces the same limits; this just says no before the upload starts.
 */
export async function acceptScreenshot(file: File): Promise<AcceptResult> {
  if (!(BUG_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: 'only png, jpeg or webp images can be attached.' }
  }
  if (file.size <= KEEP_AS_IS_BYTES) return { ok: true, file }
  try {
    const bitmap = await createImageBitmap(file)
    const target = shrinkTarget(bitmap.width, bitmap.height, MAX_EDGE) ?? { w: bitmap.width, h: bitmap.height }
    const canvas = document.createElement('canvas')
    canvas.width = target.w
    canvas.height = target.h
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, target.w, target.h)
    bitmap.close?.()
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85))
    if (blob && blob.size <= BUG_LIMITS.maxScreenshotBytes) {
      return { ok: true, file: new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' }) }
    }
  } catch {
    // fall through to the size check on the original
  }
  if (file.size <= BUG_LIMITS.maxScreenshotBytes) return { ok: true, file }
  return { ok: false, reason: 'that image is over 5 MB even after shrinking. try a smaller screenshot.' }
}
