import { Suspense, useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { lazyWithRetry as lazy } from '../lib/lazyWithRetry'
import { EVENT } from './config'
import { usePublicEvents } from './lib/hooks'
import { Background } from './components/Background'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'

import './terrathon.css'

// ── Route-level code splitting ───────────────────────────────────────────────
// TerraThon rides the repo's bundle budget: the eager critical path is capped at
// 700 KB and any single lazy chunk at 200 KB. The whole section is already lazy
// behind /terrathon/*, and each page splits again so that a captain opening a
// sport page never downloads the admin console, the Excel writer or the zxing
// scanner. Pages are named exports, hence the `.then` shim.
const HomePage     = lazy(() => import('./pages/Home').then((m) => ({ default: m.TerraThonHome })))
const SportPage    = lazy(() => import('./pages/Sport').then((m) => ({ default: m.TerraThonSport })))
const RegisterPage = lazy(() => import('./pages/Register').then((m) => ({ default: m.TerraThonRegister })))
const SchedulePage = lazy(() => import('./pages/Schedule').then((m) => ({ default: m.TerraThonSchedule })))
const ContactPage  = lazy(() => import('./pages/Contact').then((m) => ({ default: m.TerraThonContact })))
const RulesPage    = lazy(() => import('./pages/Rules').then((m) => ({ default: m.TerraThonRules })))
const TicketPage   = lazy(() => import('./pages/Ticket').then((m) => ({ default: m.TerraThonTicket })))
const NotFoundPage = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.TerraThonNotFound })))
const AdminGate    = lazy(() => import('./admin/AdminGate').then((m) => ({ default: m.AdminGate })))
const AdminPage    = lazy(() => import('./admin/Dashboard').then((m) => ({ default: m.TerraThonAdmin })))
const CheckinPage  = lazy(() => import('./admin/Checkin').then((m) => ({ default: m.TerraThonCheckin })))
const PrintPage    = lazy(() => import('./admin/Print').then((m) => ({ default: m.TerraThonPrint })))
const DiscoDiwaliPage = lazy(() => import('./admin/DiscoDiwali').then((m) => ({ default: m.TerraThonDiscoDiwali })))

function RouteFallback() {
  return (
    <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }} role="status" aria-label="Loading">
      <div
        style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '3px solid rgba(242,243,240,0.14)', borderTopColor: 'var(--tt-volt)',
          animation: 'spin 0.7s linear infinite',
        }}
      />
    </div>
  )
}

/**
 * The desk's gate now lives in admin/AdminGate.tsx, with TerraThon's own
 * sign-in panel rather than a bounce to /login. Read the header there for why
 * the password is checked by Supabase and not in the browser.
 */

function TerraThonRoutes() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith(`${EVENT.base}/admin`)
  const { events, loading, error, reload } = usePublicEvents()

  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  const feed = { events, loading, error, reload }

  return (
    <>
      {!isAdmin && <Nav events={events} />}
      <div className="tt-content">
        <Suspense fallback={<RouteFallback />}>
          <Routes location={location}>
            <Route index element={<HomePage {...feed} />} />
            <Route path="register" element={<RegisterPage {...feed} />} />
            <Route path="register/:sport" element={<RegisterPage {...feed} />} />
            <Route path="schedule" element={<SchedulePage {...feed} />} />
            {/* The sign-up form's one required tick links here, so this must
                stay a real page: a consent tick that links nowhere is not
                consent. Anchored per sport (#cricket) from that link. */}
            <Route path="rules" element={<RulesPage {...feed} />} />
            {/* Contact is driven entirely by config.ts, not the events feed. */}
            <Route path="contact" element={<ContactPage />} />
            <Route path="t/:token" element={<TicketPage />} />
            <Route path="admin" element={<AdminGate><AdminPage /></AdminGate>} />
            <Route path="admin/checkin" element={<AdminGate><CheckinPage /></AdminGate>} />
            <Route path="admin/print" element={<AdminGate><PrintPage /></AdminGate>} />
            <Route path="admin/disco-diwali" element={<AdminGate><DiscoDiwaliPage /></AdminGate>} />
            {/* Kept last so it cannot shadow the fixed paths above. */}
            <Route path=":sport" element={<SportPage {...feed} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        {!isAdmin && <Footer />}
      </div>
    </>
  )
}

export default function TerraThonRoot() {
  // Two third-party faces, both from the campaign poster.
  //
  // The body, code and serif voices are still AquaTerra's own self-hosted
  // faces. The display pair changed on 2026-09-21: Bebas Neue is a tall
  // CONDENSED scoreboard face and the poster is set in a wide, heavy one, so
  // the site and the thing on Instagram did not look like the same event.
  //
  //   Archivo Black  the wordmark and every headline. One weight, wide caps.
  //   Bungee         the poster's chunky second voice: kickers, chips, the
  //                  line under a lockup. One weight.
  //
  // Both replace Bebas rather than adding to it, and they are still scoped to
  // this section, so nothing else on ngoaquaterra.com pays for them.
  //
  // Archivo Black is MUCH wider than Bebas at the same size. That is the trap
  // CLAUDE.md documents for font-token swaps, so the display sizes in
  // terrathon.css came down with this change and the section was swept for
  // scrollWidth over clientWidth afterwards rather than eyeballed.
  //
  // Injected here rather than in index.html so the request only happens for
  // someone who actually opens /terrathon, and `display=swap` so a slow font
  // never holds up first paint.
  return (
    <div className="tt-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bungee&display=swap"
      />
      <Background />
      <TerraThonRoutes />
    </div>
  )
}
