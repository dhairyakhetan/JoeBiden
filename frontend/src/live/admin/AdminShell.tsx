import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import '../../terrathon/terrathon.css'
import { Background } from '../../terrathon/components/Background'

/**
 * The frame for every /live/admin page. It is TerraThon's own admin frame, unchanged: the same `tt-root` night-sky tokens, the same
 * two display faces and the same background, so the live admin and the TerraThon admin are one look. The only addition is a row of
 * links between the live admin pages, built from TerraThon's own button classes.
 * The sign-in gate sits INSIDE this, so even the "please sign in" panel matches the desks behind it.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="tt-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bungee&display=swap" />
      <Background />
      <div className="tt-content">
        <nav className="tt-wrap" aria-label="Live admin" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 16 }}>
          <strong className="tt-kicker" style={{ marginRight: 'auto' }}>AquaTerra.live admin</strong>
          <NavLink to="/live/admin" end className="tt-btn tt-btn--quiet">Admin home</NavLink>
          <NavLink to="/live/admin/disco-diwali" className="tt-btn tt-btn--quiet">Disco Diwali desk</NavLink>
          <NavLink to="/live/admin/enquiries" className="tt-btn tt-btn--quiet">Enquiries</NavLink>
          <NavLink to="/live/admin/content" className="tt-btn tt-btn--quiet">Content</NavLink>
          <Link to="/live" className="tt-btn tt-btn--quiet">Public site</Link>
        </nav>
        {children}
      </div>
    </div>
  )
}
