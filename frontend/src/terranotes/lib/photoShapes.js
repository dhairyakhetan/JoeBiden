import { useEffect, useState } from 'react';

// Each photo's shape (width / height) once its image has loaded, null until then, clamped to min…max so a very tall
// or wide photo can't wreck the layout. The photo wall frames and the viewer size themselves from it.
// photos: [{ photo }] (e.g. the edition's photo wall; keep the array stable).
export function usePhotoShapes(min, max, photos) {
  const [shapes, setShapes] = useState(() => photos.map(() => null));
  useEffect(() => {
    let live = true;
    photos.forEach((p, i) => {
      if (!p.photo) return;
      const img = new Image();
      img.onload = () => live && img.naturalHeight && setShapes((s) => s.map((v, k) => (k === i ? Math.min(max, Math.max(min, img.naturalWidth / img.naturalHeight)) : v)));
      img.src = p.photo;
    });
    return () => { live = false; };
  }, [min, max, photos]);
  return shapes;
}

// A wall photo's frame {w, h} in px: the photo at its own shape inside maxW × maxH, at least minW wide (a very tall
// photo gets cropped a little). No shape yet: the whole box.
export function fitFrame(shape, maxW, maxH, minW) {
  if (!shape) return { w: maxW, h: maxH };
  const w = Math.max(minW, Math.min(maxW, maxH * shape));
  return { w: Math.round(w), h: Math.round(Math.min(maxH, w / shape)) };
}
