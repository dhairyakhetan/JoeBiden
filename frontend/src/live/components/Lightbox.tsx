import useDialog from '../../hooks/useDialog'
import { photo, photoSrc } from '../data/photos'

/** A photo, large, with its description and a way to ask for it to come down. Esc, the backdrop and Close all dismiss it. */
export function Lightbox({ id, onClose, onPrev, onNext, takedown }: { id: string; onClose: () => void; onPrev?: () => void; onNext?: () => void; takedown?: string }) {
  const ref = useDialog(true, onClose)
  const p = photo(id)
  return (
    <div className="lv-lightbox" role="presentation" onClick={onClose}>
      <div ref={ref} className="lv-lightbox-panel" role="dialog" aria-modal="true" aria-label="Photo" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <img src={photoSrc(id, 'm')} alt={p.alt} />
        <p>{p.alt}</p>
        <div className="lv-actions">
          {onPrev && <button type="button" className="lv-btn lv-btn-line lv-btn-sm" onClick={onPrev}>Previous</button>}
          {onNext && <button type="button" className="lv-btn lv-btn-line lv-btn-sm" onClick={onNext}>Next</button>}
          {takedown && <a className="lv-btn lv-btn-line lv-btn-sm" href={takedown} target="_blank" rel="noopener noreferrer">Ask to remove this photo</a>}
          <button type="button" className="lv-btn lv-btn-gold lv-btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
