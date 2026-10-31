import { useEffect, useRef, useState } from 'react'
import type { AdminRow } from '../lib/api'
import { EVENT } from '../config'
import { waNumber } from '../lib/format'

/**
 * The QR entry ticket, ADM-04 / PRD 7.6.
 *
 * 1080x1350 portrait, which fills a WhatsApp image preview rather than being
 * cropped to a square. Drawn with the Canvas 2D API rather than screenshotting
 * a DOM node, because canvas output is pixel-identical across phones while
 * html2canvas-style capture is at the mercy of whatever font and DPI the
 * admin's device happens to have.
 *
 * The QR is DARK ON A LIGHT PLATE even though the ticket is dark. Light-on-dark
 * QR codes fail on a meaningful share of scanners, and the one place that must
 * never be clever is the thing a volunteer points a phone at in a queue.
 *
 * The code encodes only `/terrathon/t/<token>`, a random UUID with no relation
 * to the reference code, so a leaked ref code cannot be turned into a working
 * ticket, and the image carries no phone number or school.
 */
interface Props {
  row: AdminRow
  /** Pre-formatted event dates. The admin feed knows them; the row does not. */
  dates: string
  /** Reporting time, when the venue has confirmed one. */
  reportTime?: string | null
  venue?: string | null
  onClose: () => void
  onSent: () => void
}

const W = 1080
const H = 1350

async function drawTicket(
  row: AdminRow,
  qrDataUrl: string,
  meta: { dates: string; reportTime?: string | null; venue?: string | null },
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Wait for the real faces, or the ticket renders in a fallback font at a
  // different width and the layout shifts.
  try {
    await Promise.all([
      (document as any).fonts?.load('400 96px "Archivo Black"'),
      (document as any).fonts?.load('400 58px "JetBrains Mono"'),
      (document as any).fonts?.load('600 40px Inter'),
      (document as any).fonts?.ready,
    ])
  } catch { /* fall back to whatever is available */ }

  // The campaign's own faces, not Teko. This ticket is the thing a participant
  // keeps on their phone, so it has to look like the poster the rest of the
  // section was rebuilt to: Archivo Black for display, JetBrains for the code.
  const display = (size: number) => `400 ${size}px "Archivo Black", system-ui, sans-serif`
  const mono = (size: number) => `400 ${size}px "JetBrains Mono", ui-monospace, monospace`
  const inter = (size: number, weight = 400) => `${weight} ${size}px Inter, system-ui, sans-serif`

  // The campaign palette. The old acid green and cyan belong to no part of it.
  const NIGHT = '#05060A'
  const CREAM = '#F2EFE3'
  const GREEN = '#24CB7E'
  const ORCHID = '#DD6CEE'
  const MUTED = 'rgba(242,239,227,0.66)'

  ctx.fillStyle = NIGHT
  ctx.fillRect(0, 0, W, H)

  // Orchid wash, not a green pitch glow. The poster's ground is a night sky.
  const glow = ctx.createRadialGradient(W / 2, -120, 40, W / 2, 380, 760)
  glow.addColorStop(0, 'rgba(221,108,238,0.22)')
  glow.addColorStop(1, 'rgba(5,6,10,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 700)

  // Wordmark band
  ctx.fillStyle = CREAM
  ctx.font = display(68)
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('TERRATHON', 72, 122)
  ctx.fillStyle = GREEN
  ctx.font = mono(34)
  ctx.fillText('2026', 72, 172)

  ctx.strokeStyle = 'rgba(242,243,240,0.16)'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(72, 208); ctx.lineTo(W - 72, 208); ctx.stroke()

  // Sport + team
  ctx.fillStyle = CREAM
  ctx.font = display(84)
  ctx.fillText(row.event_name.toUpperCase(), 72, 316)

  ctx.fillStyle = GREEN
  ctx.font = display(48)
  const title = (row.team_name || row.captain_name).toUpperCase()
  ctx.fillText(title.length > 22 ? `${title.slice(0, 21)}…` : title, 72, 392)

  ctx.fillStyle = MUTED
  ctx.font = inter(28)
  const players = 1 + row.roster.length
  ctx.fillText(`Captain: ${row.captain_name}`, 72, 444)
  ctx.fillText(row.team_name ? `Players: ${players}` : 'Solo entry', 72, 486)

  ctx.fillStyle = CREAM
  ctx.font = inter(30, 600)
  ctx.fillText(meta.dates, 72, 534)
  ctx.fillStyle = MUTED
  ctx.font = inter(26)
  const line2 = [meta.reportTime ? `Report by ${meta.reportTime}` : null, meta.venue].filter(Boolean).join(' · ')
  if (line2) ctx.fillText(line2, 72, 572)

  // Perforation
  ctx.setLineDash([14, 12])
  ctx.strokeStyle = 'rgba(221,108,238,0.55)'
  ctx.beginPath(); ctx.moveTo(0, 600); ctx.lineTo(W, 600); ctx.stroke()
  ctx.setLineDash([])
  // Stub notches
  ctx.fillStyle = NIGHT
  ctx.beginPath(); ctx.arc(0, 600, 26, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(W, 600, 26, 0, Math.PI * 2); ctx.fill()

  // QR on a light plate. 540 at 628, not 560 at 652: the three lines below the
  // plate are stacked from its bottom while the handle was placed from the
  // canvas bottom, and at the old size they met. The code landed at y=1288 and
  // the handle at 1294, printing "@aquaterra.live" straight through
  // "TT26-FIF-001" on every ticket the desk has sent.
  const plate = 540
  const px = (W - plate) / 2
  const py = 628
  ctx.fillStyle = CREAM
  ctx.fillRect(px, py, plate, plate)

  const img = new Image()
  img.src = qrDataUrl
  await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res() })
  if (img.width) ctx.drawImage(img, px + 20, py + 20, plate - 40, plate - 40)

  // Everything below the plate is stacked from the plate, so the three lines
  // cannot collide with each other whatever the canvas height is.
  const footTop = py + plate
  ctx.textAlign = 'center'

  ctx.fillStyle = ORCHID
  ctx.font = mono(52)
  ctx.fillText(row.ref_code, W / 2, footTop + 64)

  ctx.fillStyle = MUTED
  ctx.font = inter(26)
  ctx.fillText('One scan per day. Carry your school ID.', W / 2, footTop + 112)

  ctx.fillStyle = GREEN
  ctx.font = inter(24, 600)
  ctx.fillText('@aquaterra.live', W / 2, footTop + 156)
  ctx.textAlign = 'left'

  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'))
}

export function TicketModal({ row, dates, reportTime, venue, onClose, onSent }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const ref = useRef<HTMLDialogElement | null>(null)

  const link = `${window.location.origin}${EVENT.base}/t/${row.ticket_token}`
  const filename = `TerraThon26_${row.ref_code}_${(row.team_name || row.captain_name).replace(/[^\w]+/g, '')}.png`

  // Native <dialog> via showModal(), the same approach as
  // components/RulesDialog.tsx: it gives autofocus, Escape, a real focus trap
  // and focus restoration for free, instead of the hand-rolled overlay this
  // used to be, which had no trap and never restored focus to whatever opened
  // it.
  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])

  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose()
  }

  useEffect(() => {
    let alive = true
    if (!row.ticket_token) { setErr('This registration has no ticket yet. Tick Paid first.'); return }
    import('qrcode')
      .then((m) => m.toDataURL(link, { margin: 4, width: 640, errorCorrectionLevel: 'M', color: { dark: '#0B0E11', light: '#F2F3F0' } }))
      .then((qr) => drawTicket(row, qr, { dates, reportTime, venue }))
      .then((b) => {
        if (!alive) return
        if (!b) { setErr('Could not draw the ticket on this device.'); return }
        setBlob(b)
        setPreview(URL.createObjectURL(b))
      })
      .catch(() => { if (alive) setErr('Could not generate the ticket.') })
    return () => { alive = false }
  }, [row, link, dates, reportTime, venue])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const share = async () => {
    if (!blob) return
    const file = new File([blob], filename, { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `TerraThon 2026 entry ticket: ${row.ref_code}` })
        onSent()
        return
      }
    } catch {
      // A cancelled share sheet rejects; fall through to download.
    }
    download()
  }

  // download() and whatsapp() cannot confirm the ticket actually reached the
  // participant, only that a local save or a compose window was triggered, so
  // neither ticks "sent" on its own. This is the same restraint the Feed's
  // openWhatsApp already applies (Dashboard.tsx), for the same reason: opening
  // WhatsApp is not proof a message went out. share() is the one exception,
  // because the real share sheet only resolves after genuine user action.
  const download = () => {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const whatsapp = () => {
    const text = `Hey! Payment confirmed for ${row.team_name || row.captain_name}, TerraThon ${row.event_name}\nYou're in. Here's your entry pass: ${link}\nSave it, you'll need it at the gate.\n-Team AQ`
    window.open(`https://wa.me/${waNumber(row.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  // Not the .tt-dialog skin (RulesDialog's own ink-bordered chrome) since the
  // visible box here is still the existing tt-card. The dialog element itself
  // is reset to a plain, borderless, centred positioning box so only that
  // card shows, same look as before, just with a native focus trap now.
  return (
    <dialog
      ref={ref}
      aria-label={`Entry ticket for ${row.ref_code}`}
      onClose={onClose}
      onClick={onBackdrop}
      style={{
        border: 'none', padding: 16, margin: 'auto', background: 'transparent',
        maxWidth: '100vw', maxHeight: '100vh',
      }}
    >
      <div className="tt-card tt-card--raised" style={{ width: 'min(420px, 100%)', maxHeight: '92dvh', overflowY: 'auto', display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 24, textTransform: 'uppercase' }}>Entry ticket</h2>
          <button type="button" className="tt-btn tt-btn--quiet" style={{ marginLeft: 'auto', minHeight: 40 }} onClick={onClose}>
            Close
          </button>
        </div>

        {err ? (
          <p role="alert" style={{ margin: 0, color: 'var(--tt-danger)', fontSize: 'var(--tt-fs-body)' }}>{err}</p>
        ) : preview ? (
          <img src={preview} alt={`Entry ticket for ${row.ref_code}`} style={{ width: '100%', borderRadius: 'var(--tt-r-in)', display: 'block' }} />
        ) : (
          <div style={{ height: 300, display: 'grid', placeItems: 'center', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }} role="status">
            Drawing ticket…
          </div>
        )}

        {/* The code as selectable text, not only inside the image: a screen
            reader user and anyone typing it at the gate both need it. */}
        <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>
          Reference code: <strong style={{ color: 'var(--tt-cyan)', userSelect: 'all' }}>{row.ref_code}</strong>
        </div>

        <div style={{ display: 'grid', gap: 8 }}>
          <button type="button" className="tt-btn" onClick={share} disabled={!blob}>Share to WhatsApp</button>
          <button type="button" className="tt-btn tt-btn--quiet" onClick={download} disabled={!preview}>Download PNG</button>
          <button type="button" className="tt-btn tt-btn--quiet" onClick={whatsapp}>Send link by WhatsApp text</button>
          <button
            type="button"
            className="tt-btn tt-btn--quiet"
            onClick={() => { void navigator.clipboard?.writeText(link).catch(() => {}) }}
          >
            Copy ticket link
          </button>
          {/* Download and the WhatsApp text link only trigger a local save or
              open a compose window, neither of which confirms delivery, so
              this is the explicit way to record that the ticket actually went
              out through one of them. */}
          <button type="button" className="tt-btn tt-btn--quiet" onClick={onSent}>
            Mark as sent
          </button>
        </div>

        {row.ticket_sent_at && (
          <p style={{ margin: 0, fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>
            Last sent {new Date(row.ticket_sent_at).toLocaleString('en-IN')}
          </p>
        )}
      </div>
    </dialog>
  )
}
