import { useEffect, useId, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMeta } from '../hooks/useMeta'
import certificateService from '../services/certificateService'
import './certificates.css'

/**
 * `/verify` and `/verify/:code`: anyone, signed in or not, checks the code printed on an AquaTerra certificate or letter.
 *
 * It answers one question: is this code real, and for whom. It shows only the holder's name, the name of the document and the
 * issue date (never hours, teams, text or anything HoDs said). A school or employer compares that name with the paper in their
 * hand. The code is long and random, so it cannot be guessed; many members are minors, which is why nothing else is shown.
 */

const CODE_SHAPE = /^AQ-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/

function tidy(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

function fmt(iso: string): string {
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return iso }
}

export default function VerifyCertificatePage() {
  useMeta({ title: 'Verify a certificate | AquaTerra', description: 'Check that a certificate or letter from AquaTerra is genuine.', image: '', path: '/verify', noIndex: true })
  const { code: param } = useParams()
  const navigate = useNavigate()
  const id = useId()
  const code = tidy(param ?? '')
  const [typed, setTyped] = useState(code)
  const [state, setState] = useState<'idle' | 'loading' | 'genuine' | 'unknown' | 'error'>('idle')
  const [found, setFound] = useState<{ holderName: string; docLabel: string; issuedOn: string } | null>(null)

  useEffect(() => {
    setFound(null)
    if (!code) { setState('idle'); return }
    // A code that cannot be real is answered without asking the database.
    if (!CODE_SHAPE.test(code)) { setState('unknown'); return }
    let live = true
    setState('loading')
    certificateService.verify(code)
      .then(r => { if (!live) return; if (r) { setFound(r); setState('genuine') } else setState('unknown') })
      .catch(() => { if (live) setState('error') })
    return () => { live = false }
  }, [code])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next = tidy(typed)
    if (next) navigate(`/verify/${encodeURIComponent(next)}`)
  }

  return (
    <div className="route-enter cert-page">
      <h1 className="h-display" style={{ fontSize: 'clamp(30px, 6vw, 48px)', margin: 0 }}>verify a document.</h1>
      <p className="cert-lede">
        Every certificate and letter AquaTerra issues carries a code that starts with AQ. Enter it here to check that it is real and
        who it was issued to.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '20px 0' }}>
        <label htmlFor={`${id}-code`} style={{ position: 'absolute', left: -9999 }}>Verification code</label>
        <input id={`${id}-code`} className="cert-field" style={{ flex: '1 1 260px', fontFamily: 'var(--code)' }} value={typed} onChange={e => setTyped(e.target.value)}
          placeholder="AQ-XXXX-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        <button type="submit" className="btn btn-primary" style={{ minHeight: 48 }}>Check</button>
      </form>

      {state === 'loading' && <p className="cert-lede" role="status">checking…</p>}

      {state === 'genuine' && found && (
        <div role="status" className="cert-done" style={{ textAlign: 'left' }}>
          <div className="h-display" style={{ fontSize: 26, marginBottom: 12 }}>this one is genuine.</div>
          <p style={{ margin: '0 0 4px' }}><strong>{found.holderName}</strong></p>
          <p style={{ margin: '0 0 4px' }}>{found.docLabel}</p>
          <p style={{ margin: '0 0 12px' }}>Issued on {fmt(found.issuedOn)} by AquaTerra</p>
          <p className="cert-hint" style={{ margin: 0 }}>Check that the name matches the document you are holding. If it does not, the document is not the one this code was issued for.</p>
        </div>
      )}

      {state === 'unknown' && (
        <p role="alert" className="cert-lede">We could not find that code. Check each character, or ask the person who gave you the document to confirm it. Nothing here says a document is false, only that this code is not one we issued.</p>
      )}
      {state === 'error' && <p role="alert" className="cert-lede">Something went wrong while checking. Try again in a moment.</p>}
    </div>
  )
}
