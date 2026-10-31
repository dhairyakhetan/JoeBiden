import { Suspense, useEffect, type ComponentType, type ReactElement, type ReactNode } from 'react'
import { Link, Routes, Route, useLocation } from 'react-router-dom'
import { lazyWithRetry as lazy } from '../lib/lazyWithRetry'
import { LIVE } from './config'
import { Loader } from './components/Loader'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'
import './live.css'

// Each page splits again, so a visitor on the home page never downloads the FAQ, the Vault or the admin.
const page = <T extends string>(load: () => Promise<Record<T, any>>, name: T) => lazy(() => load().then(m => ({ default: m[name] })))
const Home = page(() => import('./pages/Home'), 'LiveHome')
const Disco = page(() => import('./pages/DiscoDiwali'), 'LiveDiscoDiwali')
const Events = page(() => import('./pages/Events'), 'LiveEvents')
const EventDetail = page(() => import('./pages/EventDetail'), 'LiveEventDetail')
const Vault = page(() => import('./pages/Vault'), 'LiveVault')
const Why = page(() => import('./pages/Why'), 'LiveWhy')
const Company = page(() => import('./pages/Company'), 'LiveCompany')
const Crew = page(() => import('./pages/Crew'), 'LiveCrew')
const Faq = page(() => import('./pages/Faq'), 'LiveFaq')
const Contact = page(() => import('./pages/Contact'), 'LiveContact')
const NotFound = page(() => import('./pages/NotFound'), 'LiveNotFound')
// admin: behind the same sign-in the TerraThon desk uses (a real Supabase session on a leader account; RLS is the boundary)
const AdminShell = page(() => import('./admin/AdminShell'), 'AdminShell') as unknown as ComponentType<{ children: ReactNode }>
const AdminGate = page(() => import('../terrathon/admin/AdminGate'), 'AdminGate') as unknown as ComponentType<{ children: ReactNode; brand?: 'terrathon' | 'live' }>
const AdminHome = page(() => import('./admin/AdminHome'), 'LiveAdminHome')
const AdminDisco = page(() => import('../terrathon/admin/DiscoDiwali'), 'TerraThonDiscoDiwali')
const AdminEnquiries = page(() => import('./admin/Enquiries'), 'LiveAdminEnquiries')
const AdminContent = page(() => import('./admin/Content'), 'LiveAdminContent')

function RouteFallback() {
  return <div className="lv-fallback" role="status" aria-label="Loading"><span className="lv-spinner" aria-hidden /></div>
}

const guarded = (el: ReactElement) => <AdminShell><AdminGate brand="live">{el}</AdminGate></AdminShell>

function LiveRoutes() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  // the admin has its own bar and tokens: no public nav, footer, loader or grain
  const admin = pathname.startsWith(`${LIVE.base}/admin`)
  return (
    <>
      {!admin && <a className="lv-skip" href="#lv-main">Skip to content</a>}
      {!admin && <Nav />}
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="disco-diwali" element={<Disco />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:slug" element={<EventDetail />} />
          <Route path="vault" element={<Vault />} />
          <Route path="why" element={<Why />} />
          <Route path="company" element={<Company />} />
          <Route path="crew" element={<Crew />} />
          <Route path="faq" element={<Faq />} />
          <Route path="contact" element={<Contact />} />
          <Route path="admin" element={guarded(<AdminHome />)} />
          <Route path="admin/disco-diwali" element={guarded(<AdminDisco />)} />
          <Route path="admin/enquiries" element={guarded(<AdminEnquiries />)} />
          <Route path="admin/content" element={guarded(<AdminContent />)} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {!admin && <Footer />}
    </>
  )
}

/**
 * AquaTerra.live: the events hub. Its own system (cream paper, black ink, red and gold, blackletter display type, grain, sections
 * that flip tone), scoped to `.lv-root`, like Paradox and Terra Notes. Plan and decisions: docs/plans/aquaterra-live.md.
 * Fonts are injected here, not in index.html, so only someone who opens /live pays for them.
 */
export default function LiveRoot() {
  const { pathname } = useLocation()
  const admin = pathname.startsWith(`${LIVE.base}/admin`)
  return (
    <div className="lv-root" data-event="disco">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&family=Pirata+One&family=Anton&family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
      />
      {!admin && <Loader />}
      {!admin && <div className="lv-grain" aria-hidden />}
      <LiveRoutes />
      <Link to={LIVE.base} className="lv-sr-only">AquaTerra.live home</Link>
    </div>
  )
}
