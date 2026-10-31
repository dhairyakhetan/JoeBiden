// Client-side, canvas-based downscale BEFORE upload.
//
// THE PROBLEM (companion to `sized()` in ./imageUrl.ts): sized() can only
// rewrite `framerusercontent.com` URLs - every other host, Supabase storage
// included, is passed through untouched by deliberate design. Uploads have
// since moved from Framer to Supabase storage, so nothing right-sizes them at
// render time any more: a drive photo uploaded from a phone lands at 3840 px /
// ~1.5 MB and is painted into a 342 px tile. Supabase's own transform endpoint
// (`/storage/v1/render/image/...`) returns 403 on this project - Storage Image
// Transformation is a paid add-on and is NOT enabled - so display-time
// resizing is not available to us at all.
//
// THE FIX: shrink the file in the browser at upload time. Free, no new
// dependency (plain <canvas> + createImageBitmap), and it fixes every future
// upload. It does nothing for the files already in the bucket.
//
// This file is the shared, parameterised version of what
// `profile/wall/resizeImage.ts` did wall-only; that module now delegates here
// and keeps its exact previous output (1600 px long edge, JPEG q0.82, always
// re-encoded to JPEG).
//
// The dimension maths is kept as pure exported functions so it can be unit
// tested under vitest's `environment: 'node'` - the canvas half cannot be.

export type ResizeContext = 'avatar' | 'yearbook' | 'wall' | 'post' | 'project'

/**
 * Max longer-edge px per upload context. Chosen from what the UI actually
 * renders, mirroring the ~2x-CSS-size logic of `sized()`'s own ladder:
 *
 *  avatar   512 - avatars render at 40 px almost everywhere and at ~256 px at
 *                 their largest (the profile hero), so 512 is already 2x the
 *                 biggest real display size. `sized()` uses 192 for its
 *                 `avatar` context, but that is a render-time cap on one
 *                 <img>; this is the single stored original, which also feeds
 *                 the profile hero, so it gets the larger of the two.
 *  yearbook 1200 - yearbook photos are a portrait card in a grid and an
 *                 export list; nothing displays them above ~600 px CSS.
 *  wall     1600 - unchanged from the shipped wall composer (matches
 *                 `sized()`'s `cover` ceiling).
 *  post     1920 - post images are the feed card (`card`, ~640 px CSS) but are
 *                 ALSO openable in the lightbox, which `sized()` treats as
 *                 `full` (2000). 1920 keeps a full-HD lightbox honest while
 *                 still cutting a 4000 px phone photo roughly in half per edge
 *                 (~4x the pixels).
 *  project  1920 - same reasoning: a drive photo is a `.pbento-tile` hero
 *                 (`cover`) and is lightboxable. This is the cap that the
 *                 measured 3840 px / 1.5 MB hero would have hit.
 */
export const MAX_EDGE: Record<ResizeContext, number> = {
  avatar: 512,
  yearbook: 1200,
  wall: 1600,
  post: 1920,
  project: 1920,
}

/** JPEG quality used when we re-encode. Matches the shipped wall value. */
export const JPEG_QUALITY = 0.82

/**
 * Formats we will decode + re-encode. Everything else passes through:
 *  - `image/gif` would lose its animation entirely (canvas draws one frame).
 *  - `image/svg+xml` is vector; rasterising it is strictly worse.
 *  - non-`image/*` (PDF, PPTX, ...) is not ours to touch.
 */
export function isResizableType(type: string): boolean {
  if (!type.startsWith('image/')) return false
  return type !== 'image/gif' && type !== 'image/svg+xml'
}

/**
 * Pure dimension maths. Returns the target size, or `null` when the file
 * should be left exactly as it is.
 *
 * NEVER UPSCALES: if the long edge is already at or under the cap, this
 * returns null and the caller returns the original File untouched - we do not
 * re-encode for no size gain (and so never quietly degrade an already-small
 * image by round-tripping it through JPEG).
 */
export function targetDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  const longEdge = Math.max(width, height)
  if (longEdge <= maxEdge) return null
  const scale = maxEdge / longEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * The output mime type for a given input.
 *
 * A PNG is resized but stays a PNG: re-encoding a logo or a screenshot with
 * flat colour + transparency into lossy JPEG would visibly hurt it (ringing on
 * hard edges) and would drop its alpha to black. The dimension cut alone is
 * where nearly all the bytes come from anyway. `forceJpeg` exists solely for
 * the wall composer, whose shipped behaviour already converted everything to
 * JPEG and must not change.
 */
export function outputType(inputType: string, forceJpeg: boolean): string {
  if (forceJpeg) return 'image/jpeg'
  if (inputType === 'image/png') return 'image/png'
  return 'image/jpeg'
}

function renameFor(name: string, mime: string): string {
  const ext = mime === 'image/png' ? '.png' : '.jpg'
  return name.replace(/\.[^./\\]+$/, '') + ext
}

type Drawable = CanvasImageSource & { width: number; height: number }

/**
 * Decode a File to something drawable.
 *
 * ORIENTATION: canvas re-encoding drops EXIF, so a phone photo shot in
 * portrait comes back rotated unless the decoder bakes the orientation in.
 * `createImageBitmap(file, { imageOrientation: 'from-image' })` does exactly
 * that. Older engines throw on the option (and older still lack
 * createImageBitmap altogether), so we degrade: option -> plain bitmap ->
 * <img>, which applies EXIF orientation itself in every current browser.
 */
async function decodeToDrawable(file: File): Promise<Drawable | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* option unsupported or format undecodable - try without options */
    }
    try {
      return await createImageBitmap(file)
    } catch {
      // fall through to the <img> path below (some browsers can't decode
      // every format via createImageBitmap, e.g. certain HEIC variants)
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

export interface ResizeOptions {
  /** Long-edge cap in px. Prefer passing `MAX_EDGE[context]`. */
  maxEdge: number
  /** Always emit JPEG, even for PNG input. Wall-composer compatibility only. */
  forceJpeg?: boolean
  /** JPEG quality. Defaults to JPEG_QUALITY (0.82). */
  quality?: number
}

/**
 * Downscale `file` so its longer edge is at most `maxEdge`.
 *
 * NEVER THROWS, and NEVER LOSES THE UPLOAD: every failure path - an
 * undecodable type, a browser without canvas, an out-of-memory
 * `toBlob`, a re-encode that came out *larger* than the original - returns
 * the ORIGINAL File. A resize problem must never turn into a failed post,
 * a lost avatar or a dropped drive photo; shipping the big file is the
 * strictly better failure mode.
 *
 * No toasts here by design: `services/*` and `lib/*` throw and stay silent,
 * components own user-facing feedback (and there is nothing worth telling the
 * user about a successful transparent resize).
 */
export async function resizeImageFile(file: File, opts: ResizeOptions): Promise<File> {
  const { maxEdge, forceJpeg = false, quality = JPEG_QUALITY } = opts
  if (!isResizableType(file.type)) return file
  if (typeof document === 'undefined') return file

  try {
    const drawable = await decodeToDrawable(file)
    if (!drawable) return file

    const target = targetDimensions(drawable.width, drawable.height, maxEdge)
    if (!target) {
      if ('close' in drawable) (drawable as ImageBitmap).close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(drawable, 0, 0, target.width, target.height)
    if ('close' in drawable) (drawable as ImageBitmap).close()

    const mime = outputType(file.type, forceJpeg)
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, mime, quality),
    )
    if (!blob) return file
    // A PNG re-encode can legitimately come out bigger than the original
    // (different encoder, no palette). If it did, the original wins.
    if (blob.size >= file.size && !forceJpeg) return file

    return new File([blob], renameFor(file.name, mime), {
      type: mime,
      lastModified: Date.now(),
    })
  } catch (err) {
    console.warn('[resizeImageFile] resize failed, uploading original file:', err)
    return file
  }
}

/** Convenience wrapper: `resizeForUpload(file, 'post')`. */
export function resizeForUpload(file: File, context: ResizeContext): Promise<File> {
  return resizeImageFile(file, {
    maxEdge: MAX_EDGE[context],
    forceJpeg: context === 'wall',
  })
}
