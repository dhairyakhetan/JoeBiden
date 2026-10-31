// Phase 1 (token unification): tokens.css is the single source of truth for
// every design token and MUST load first. v6.css is the class layer (it now
// includes the 23 live tail classes ported out of the deleted aq-design-system.css).
// index.css carries Tailwind (for /paradox) + a few utilities and loads last.
// aq-design-system.css (competing wrong-hue :root palette) and studio-mode.css
// (dead - scoped to body[data-mode="studio"], never set) have both been deleted.
import './styles/tokens.css'
import './styles/v6.css'
import ReactDOM from 'react-dom/client'
import { inject } from '@vercel/analytics'
import { injectSpeedInsights } from '@vercel/speed-insights'
import App from './App'
import './index.css'
import { installGlobalErrorTracking } from './lib/errorTracking'

inject()
injectSpeedInsights()
// Catches what ErrorBoundary.tsx structurally cannot: async errors that
// bubble to `window` instead of through React's render/commit phases.
installGlobalErrorTracking()

// scripts/prerender-meta.mjs bakes real JSON-LD (BreadcrumbList, and
// BlogPosting/Article on a blog/project page) into <head> as
// `<script data-prerender="...">`, for a crawler that fetches the static
// file directly and never runs this bundle. React never touches <head> -
// `createRoot(root).render()` below only replaces #root's children - so once
// this script IS running, those tags just sit there forever. Meanwhile
// hooks/useJsonLd.ts injects its OWN `data-jsonld-id` copy of the same
// breadcrumb (and more) on nearly every one of those same routes, and its
// dedup only checks its own attribute, never `data-prerender`. Net result: a
// hydrated session on any prerendered route carries the SAME BreadcrumbList
// twice, and on a blog/project page a duplicate BlogPosting/Article too -
// confirmed live via a full SEO audit, 2026-09-24. Duplicate/conflicting
// structured data is flagged as an error by Google's Rich Results Test, not
// just redundant, so this needs a real fix, not a shrug.
//
// The static Organization/WebSite/Dataset blocks in index.html are NOT
// touched here - they carry no `data-prerender` attribute (see that
// comment's own note that useJsonLd never touches them either), and they are
// meant to persist for the life of the session, same as the rest of
// index.html's hand-tuned <head>.
document.querySelectorAll('script[data-prerender]').forEach(el => el.remove())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
)
