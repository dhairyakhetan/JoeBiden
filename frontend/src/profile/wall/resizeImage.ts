// The wall composer's pre-upload resize.
//
// This used to be a self-contained, wall-only canvas resizer, with a comment
// explaining that the general shared helper was the better long-term fix but
// was out of that feature's scope. That helper now exists - `lib/resizeImage.ts`
// - so this is a thin adapter kept only so `WallComposer.tsx` keeps its
// existing import.
//
// Output is unchanged: 1600 px long edge (`MAX_EDGE.wall`), JPEG quality 0.82,
// always re-encoded to JPEG (`forceJpeg`), original returned untouched on any
// failure or when the image is already small enough.

import { MAX_EDGE, resizeImageFile } from '../../lib/resizeImage'

/**
 * Resizes an image file so its longer edge is at most 1600 px, re-encoding to
 * JPEG. Falls back to returning the ORIGINAL file untouched on any failure (a
 * failed resize should never block a member from posting a note) - never
 * throws.
 */
export function resizeImageForWall(file: File): Promise<File> {
  return resizeImageFile(file, { maxEdge: MAX_EDGE.wall, forceJpeg: true })
}
