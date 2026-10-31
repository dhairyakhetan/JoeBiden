import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMeta } from '../../hooks/useMeta'
import { listDiscoRegs } from '../../terrathon/lib/discoDiwaliApi'
import { closeFriendsToAdd, type DiscoReg } from '../../terrathon/lib/discoDiwali'
import { rupees } from '../../terrathon/lib/format'
import { listEnquiries } from '../lib/enquiries'

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="tt-card" style={{ padding: 14, minWidth: 0 }}>
      <div className="tt-kicker">{label}</div>
      <div className="tt-num" style={{ fontSize: 34, lineHeight: 1.05, marginTop: 4 }}>{value}</div>
      {note && <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)', marginTop: 2 }}>{note}</div>}
    </div>
  )
}

/** Where a leader starts: how the night is shaping up, and one tap into each job. Counts come from the real tables, never typed. */
export function LiveAdminHome() {
  useMeta({ title: 'Admin | AquaTerra.live', description: 'AquaTerra.live admin.', path: '/live/admin', noIndex: true })
  const [regs, setRegs] = useState<DiscoReg[] | null>(null)
  const [regsErr, setRegsErr] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    listDiscoRegs().then(r => { if (alive) setRegs(r) }).catch(() => { if (alive) setRegsErr(true) })
    listEnquiries().then(r => { if (alive) setOpen(r.filter(x => !x.handled).length) }).catch(() => { /* the table may not exist yet: the card says so */ })
    return () => { alive = false }
  }, [])

  const s = useMemo(() => {
    const r = regs ?? []
    return {
      total: r.length,
      paid: r.filter(x => x.paid).length,
      in: r.filter(x => x.attended).length,
      collected: r.filter(x => x.paid).reduce((n, x) => n + (x.amount ?? 0), 0),
      insta: r.filter(x => !!x.instagram).length,
      cfTodo: closeFriendsToAdd(r).length,
      dob: r.filter(x => !!x.dob).length,
    }
  }, [regs])

  return (
    <div className="tt-wrap tt-page" style={{ maxWidth: 1100 }}>
      <header style={{ marginBottom: 18 }}>
        <div className="tt-kicker">AquaTerra.live admin</div>
        <h1>The night, at a glance</h1>
      </header>

      {regsErr && <div className="tt-card" role="alert" style={{ marginBottom: 16 }}>Couldn&apos;t load the ticket numbers. Your account may not have permission, or the connection dropped.</div>}

      <section aria-label="Disco Diwali numbers" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 24 }}>
        <Stat label="Tickets" value={regs ? s.total : '…'} note={regs ? `${s.paid} paid` : undefined} />
        <Stat label="Checked in" value={regs ? s.in : '…'} />
        <Stat label="Collected" value={regs ? rupees(s.collected) : '…'} note="paid tickets, internal" />
        <Stat label="Instagram handles" value={regs ? s.insta : '…'} note={regs ? `${s.cfTodo} still to add to close friends` : undefined} />
        <Stat label="Dates of birth" value={regs ? s.dob : '…'} />
      </section>

      <h2 style={{ marginBottom: 10 }}>Jobs</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        <li className="tt-card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 28 }}>Log tickets</h3>
          <p style={{ margin: 0, color: 'var(--tt-muted)' }}>The entry form: name, number, Instagram, date of birth. Built for one thumb.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="tt-btn" to="/live/admin/disco-diwali?fast=1">Open fast entry</Link>
            <Link className="tt-btn tt-btn--quiet" to="/live/admin/disco-diwali?catchup=1">Catch up older tickets</Link>
            <Link className="tt-btn tt-btn--quiet" to="/live/admin/disco-diwali">The full desk</Link>
          </div>
        </li>
        <li className="tt-card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 28 }}>At the door</h3>
          <p style={{ margin: 0, color: 'var(--tt-muted)' }}>Search, tick people in, see who is unpaid or cash.</p>
          <div><Link className="tt-btn" to="/live/admin/disco-diwali?checkin=1">Check-in mode</Link></div>
        </li>
        <li className="tt-card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 28 }}>Close friends</h3>
          <p style={{ margin: 0, color: 'var(--tt-muted)' }}>{regs ? `${s.cfTodo} people gave a handle and are not yet added.` : 'Everyone with a handle who is not yet added.'}</p>
          <div><Link className="tt-btn" to="/live/admin/disco-diwali?filter=closefriends">Work the checklist</Link></div>
        </li>
        <li className="tt-card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 28 }}>Enquiries</h3>
          <p style={{ margin: 0, color: 'var(--tt-muted)' }}>{open === null ? 'Messages from the contact form.' : `${open} not yet handled.`}</p>
          <div><Link className="tt-btn tt-btn--quiet" to="/live/admin/enquiries">Open the inbox</Link></div>
        </li>
        <li className="tt-card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 28 }}>Site content</h3>
          <p style={{ margin: 0, color: 'var(--tt-muted)' }}>The nights and programmes on the public site. Add, edit, hide.</p>
          <div><Link className="tt-btn tt-btn--quiet" to="/live/admin/content">Edit content</Link></div>
        </li>
        <li className="tt-card" style={{ display: 'grid', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 28 }}>TerraThon</h3>
          <p style={{ margin: 0, color: 'var(--tt-muted)' }}>Registrations, check-in and printouts for the sports festival.</p>
          <div><Link className="tt-btn tt-btn--quiet" to="/terrathon/admin">TerraThon admin</Link></div>
        </li>
      </ul>
    </div>
  )
}
