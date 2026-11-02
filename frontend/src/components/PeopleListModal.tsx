import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import useDialog from '../hooks/useDialog'
import Img from './Img'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { profilePath } from '../lib/profilePath'

export interface PersonRow { uuid: string; fullName: string; avatarUrl?: string; role?: string }

/**
 * A sheet listing people ("followers", "following"). The follower and following figures on a profile used to be dead
 * numbers: the list functions existed in followService and nothing called them. Each row links to that person.
 */
export default function PeopleListModal({ title, load, viewerUuid, onClose }: {
  title: string
  load: () => Promise<PersonRow[]>
  viewerUuid?: string | null
  onClose: () => void
}) {
  const [rows, setRows] = useState<PersonRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const panelRef = useDialog(true, onClose)

  useEffect(() => {
    let live = true
    load().then(r => { if (live) setRows(r) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: 'var(--card)', borderRadius: 'var(--r-outer)', overflow: 'hidden', border: 'var(--hair-2)', boxShadow: 'var(--lift-4)' }}>
        <div style={{ padding: '16px 20px', borderBottom: 'var(--hair)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 20, letterSpacing: '-0.02em' }}>{title}</div>
          <button type="button" className="btn btn-sm btn-ghost" style={{ minHeight: 44 }} onClick={onClose}>Close</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 8 }}>
          {rows === null && !failed && <div className="mono xs muted" style={{ padding: 20 }}>loading…</div>}
          {failed && <div className="mono xs muted" style={{ padding: 20 }}>couldn’t load this list. try again in a moment.</div>}
          {rows && rows.length === 0 && <div className="mono xs muted" style={{ padding: 20 }}>no one yet.</div>}
          {rows && rows.map(p => (
            <Link key={p.uuid} to={profilePath(viewerUuid, p.uuid)} onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', minHeight: 52, borderRadius: 'var(--r-inner)', textDecoration: 'none', color: 'inherit' }}>
              <span className="avatar" style={{ background: hashColor(p.fullName || p.uuid), overflow: 'hidden', width: 36, height: 36, fontSize: 12, flexShrink: 0 }} aria-hidden>
                {p.avatarUrl ? <Img ctx="avatar" src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : getInitials(p.fullName || 'U')}
              </span>
              <span style={{ fontWeight: 700, fontSize: 15, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.fullName}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
