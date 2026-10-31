export const meta = {
  name: 'aquaterra-site-audit',
  description: 'Exhaustive read-only audit of the AquaTerra site: responsiveness, UX, performance, Supabase integration, interface-details + make-interfaces-feel-better polish (throttled)',
  phases: [
    { title: 'Audit', detail: '10 auditors across 6 dimensions, run in waves of 3' },
    { title: 'Verify', detail: 'adversarially confirm each finding against real code, waved' },
    { title: 'Synthesize', detail: 'compile prioritized report' },
  ],
}

// Run an array of thunks in sequential WAVES of `size`. Each wave is a barrier.
// This caps simultaneous load to throttle token rate and avoid server rate-limits.
async function waved(thunks, size) {
  const out = []
  for (let i = 0; i < thunks.length; i += size) {
    const res = await parallel(thunks.slice(i, i + size))
    out.push(...res)
  }
  return out
}

const CONTEXT = `
PROJECT: AquaTerra — React 19 + Vite 7 + TypeScript + Tailwind v4 + Supabase. A student welfare community site (Kolkata).
Repo root: C:/Users/kanis/Desktop/AquaTerra/LATEST WEB/vercelaq-main
Frontend source: frontend/src

ARCHITECTURE:
- Public marketing site (PublicLayout + AQNav + AQFooter), member area (DashboardLayout: feed/profile/teams/search), director dashboard, and a large self-contained Paradox 2026 event sub-app (frontend/src/paradox/**) which is SECONDARY — only audit it lightly if at all.
- TWO Supabase projects:
  (1) WELFARE legacy — frontend/src/lib/supabase.ts — anon key hardcoded, autoRefreshToken/persistSession false. Tables: welfare_projects, blogs. Read-only public data.
  (2) COMMUNITY — frontend/src/lib/supabaseCommunity.ts — env-based (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Auth + feed + teams + profiles.
- CSS load order (main.tsx): aq-design-system.css -> v6.css -> studio-mode.css -> index.css. v6.css is the current authority for cards/chrome.
- Routing in frontend/src/App.tsx — most pages lazy-loaded; manualChunks vendor splitting in vite.config.ts.

HARD CONSTRAINTS — do NOT report these as issues, they are deliberate decisions:
- The hardcoded anon key in supabase.ts is an anon (public) key, acceptable to ship; do NOT flag it as a leaked secret. (You MAY note RLS-dependence.)
- Generated database.types.ts is intentionally STALE for some columns; code uses 'as any' casts deliberately. Do not flag those casts as bugs unless they cause a real runtime mismatch.
- Do NOT suggest changing the color palette or a Supabase region migration — both are off the table.
- Reduced-motion handling already exists in several places; verify before flagging its absence.

OUTPUT DISCIPLINE: every finding must cite a real file path and line/range you actually read. No speculation. If a concern is already handled in code, do NOT report it. Prefer fewer, real, high-signal findings over volume. Severity: critical = broken/blocks users or data; high = clear defect or major UX/perf loss; medium = noticeable polish/quality gap; low = minor nit.
`

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dimension', 'severity', 'title', 'file', 'line', 'problem', 'recommendation', 'confidence'],
        properties: {
          dimension: { type: 'string', enum: ['responsiveness', 'ux', 'performance', 'supabase', 'interface-details', 'make-interfaces-feel-better', 'accessibility'] },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'string' },
          problem: { type: 'string' },
          recommendation: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'reasoning', 'severity'],
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'refuted', 'partial'] },
    reasoning: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    corrected_recommendation: { type: 'string' },
  },
}

const PUBLIC_PAGES = 'frontend/src/public/*.tsx (HomePage, PublicProjectsPage, PublicProjectDetailPage, BlogListPage, BlogPostPage, AboutPage, FAQPage, SupportPage, ContactPage, CollaborationsPage, OpportunitiesPage, SchoolsPage, ClassesPage, MembersPage, VolunteerHandbookPage, RecruitmentPage, OnboardingPage, QuickLinksPage), frontend/src/components/ProjectCard.tsx, frontend/src/auth/HomeRoute.tsx'
const CHROME = 'frontend/src/components/{AQNav,AQFooter,PublicLayout,DashboardLayout,Modal,Toast,Confirm,Button,Card,Input,TextArea,Spinner,Alert,ShareModal,ImageLightbox}.tsx'
const MEMBER_PAGES = 'frontend/src/feed/{FeedPage,FeedPostCard,CreatePostModal,PostPage,NotificationsPage,SavedPostsPage,MyPostsPage}.tsx, frontend/src/profile/{ProfilePage,EditProfilePage,PublicProfilePage,AchievementsList,AddAchievementModal,EditAchievementModal}.tsx, frontend/src/teams/{TeamsPage,TeamDetailPage,JoinRequestModal}.tsx, frontend/src/search/SearchPage.tsx, frontend/src/auth/{LoginPage,RegisterPage,SettingsPage,PendingApprovalPage}.tsx'
const DIRECTOR = 'frontend/src/director/*.tsx (DirectorDashboard, ProjectManager, VolunteerApplications, AccountApprovals, PostModeration, MemberDirectory, CategoryManagement, DirectorManagement, ContentManager, TeamManagement, AchievementReviews)'
const STYLES = 'frontend/src/styles/{aq-design-system,v6,studio-mode}.css, frontend/src/index.css'
const SERVICES = 'frontend/src/services/*.ts (achievementService, api, directorService, feedService, followService, notificationService, profileService, savedPostsService, schoolService, searchService, teamService), frontend/src/lib/{supabase,supabaseCommunity,roles,authCache,postDocuments}.ts, frontend/src/hooks/*.ts'
const ID_DETAILS = 'C:/Users/kanis/.claude/skills/interface-details/details/{accessibility,browser,button,content-intelligence,easter-egg,form,layout,motion,scroll,toast,typography}.md'
const MIFB = 'C:/Users/kanis/.claude/skills/make-interfaces-feel-better/{SKILL,animations,performance,surfaces,typography}.md'

phase('Audit')

const auditors = [
  { label: 'responsive:public+chrome', prompt: `${CONTEXT}\n\nROLE: Responsiveness auditor for the PUBLIC marketing site + shared chrome.\nREAD: ${PUBLIC_PAGES}, ${CHROME}, and ${STYLES} (grep the CSS for @media, clamp, overflow, min-width, vw, flex-wrap, grid-template).\nCHECK FOR: horizontal-scroll / overflow traps on mobile (fixed px widths, unwrapped flex rows, wide tables/grids), missing or wrong breakpoints, non-fluid type, elements that overlap/clip < 380px, touch targets < 44px on mobile, sticky headers that eat the viewport, images without responsive sizing, multi-col grids stuck at fixed minmax too large for 320-375px. Verify against the actual CSS media queries. Dimension = 'responsiveness'.` },
  { label: 'responsive:member+director', prompt: `${CONTEXT}\n\nROLE: Responsiveness auditor for the MEMBER area + DIRECTOR dashboard.\nREAD: ${MEMBER_PAGES}, ${DIRECTOR}, and relevant parts of ${STYLES}.\nCHECK FOR: data tables that overflow on phones (director lists, volunteer applications), modals that exceed viewport / aren't scrollable on small screens, feed cards and forms that break < 380px, fixed-width sidebars, dashboard layouts that don't collapse, inputs/buttons below 44px touch target. Dimension = 'responsiveness'.` },
  { label: 'ux:public-flows', prompt: `${CONTEXT}\n\nROLE: UX / interaction auditor for the PUBLIC marketing site.\nREAD: ${PUBLIC_PAGES}, ${CHROME}.\nCHECK FOR: missing or weak loading/empty/error states; dead-ends in flows (apply / recruitment / contact); inconsistent navigation or CTA labels; confusing IA; broken back/scroll behavior; forms with poor validation feedback or no success confirmation; duplicate-submit risk on buttons; unclear active states; misleading link vs button semantics. Dimension = 'ux'.` },
  { label: 'ux:member+director-flows', prompt: `${CONTEXT}\n\nROLE: UX / interaction auditor for the MEMBER area + DIRECTOR dashboard.\nREAD: ${MEMBER_PAGES}, ${DIRECTOR}.\nCHECK FOR: feed/post/create flows (CreatePostModal), profile edit, team join, search — missing loading/empty/error/skeleton states, optimistic-update gaps, no confirmation on destructive actions (delete/moderate/reject), silent failures, missing disabled/pending states on submit buttons, pagination/infinite-scroll edge cases. Dimension = 'ux'.` },
  { label: 'perf:bundle+render', prompt: `${CONTEXT}\n\nROLE: Front-end performance auditor (bundle, render, images).\nREAD: frontend/src/App.tsx, frontend/vite.config.ts, frontend/src/main.tsx, the largest components (frontend/src/public/HomePage.tsx, frontend/src/public/OnboardingPage.tsx, frontend/src/feed/CreatePostModal.tsx, frontend/src/feed/FeedPostCard.tsx, frontend/src/director/VolunteerApplications.tsx, frontend/src/components/AQNav.tsx), and ${PUBLIC_PAGES}.\nCHECK FOR: components that should be code-split but aren't; heavy libs (framer-motion, matter-js, xlsx, zxing) on the main path; images without loading=lazy / width+height / responsive srcset; lists without windowing where large; React re-render anti-patterns (missing memo/useMemo/useCallback on hot paths, unstable keys, inline object/array props to memoized children, context value churn); overuse of will-change / heavy backdrop-filter. Dimension = 'performance'.` },
  { label: 'perf:supabase-queries', prompt: `${CONTEXT}\n\nROLE: Data-fetching performance auditor (Supabase query efficiency).\nREAD: ${SERVICES}, and the data-fetching effects in PublicProjectsPage, PublicProjectDetailPage, BlogListPage, FeedPage, FeedPostCard, TeamDetailPage, SearchPage, ProfilePage.\nCHECK FOR: N+1 query patterns (per-row fetches in a loop/map), over-fetching (select('*') where few columns render), missing pagination/.range/.limit on large tables, count:'exact' on hot paths where estimated would do, sequential awaits that should be Promise.all, refetch-on-every-render, missing caching/dedupe, client-side filtering of large result sets that should be server-side. Dimension = 'performance'.` },
  { label: 'supabase:integration', prompt: `${CONTEXT}\n\nROLE: Supabase integration-correctness auditor.\nREAD: ${SERVICES}, frontend/src/lib/supabase.ts, frontend/src/lib/supabaseCommunity.ts, frontend/src/auth/AuthContext.tsx (if present), and data wiring in pages.\nCHECK FOR: unhandled query errors (destructuring data without checking error), data-shape mismatches that break render, the two-client boundary used incorrectly (welfare vs community), missing env-var guards (community client returns '' keys -> silent failure), draft/visibility filters missing (is_draft not filtered on a public list), inconsistent error surfacing, race conditions on auth/session, missing retries/timeouts on critical reads, RLS assumptions that would break public reads. Do NOT flag the deliberate anon-key/stale-types items from CONTEXT. Dimension = 'supabase'.` },
  { label: 'interface-details', prompt: `${CONTEXT}\n\nROLE: interface-details auditor. FIRST read the skill criteria: ${ID_DETAILS} (read ALL of them).\nTHEN audit the real UI against them across ${CHROME}, ${PUBLIC_PAGES}, key member pages, and ${STYLES}.\nCHECK: button hit areas & cursor semantics & duplicate-submit prevention; form input types/keyboards/labels/paste; toast/feedback/loading status; motion (interruptible transitions, no jank); typography overflow/truncation/formatting; scroll anchoring & overscroll; accessibility focus rings & reduced motion & SR support; layout border-radius/optical alignment/spacing; browser favicon/theme-color/meta/PWA; content-intelligence smart defaults; easter-egg/personality. Report concrete gaps with file:line. Dimension = 'interface-details'.` },
  { label: 'make-interfaces-feel-better', prompt: `${CONTEXT}\n\nROLE: make-interfaces-feel-better auditor. FIRST read the skill criteria: ${MIFB} (read SKILL.md + animations.md + performance.md + surfaces.md + typography.md).\nTHEN audit across ${CHROME}, ${PUBLIC_PAGES}, ${MEMBER_PAGES}, and ${STYLES}.\nCHECK the 16 principles: concentric border radius; optical vs geometric alignment; shadows over hard borders; interruptible animations (transitions not keyframes for state); split+staggered enter animations; subtle exits; tabular-nums on dynamic numbers; font smoothing on root; text-wrap balance on headings / pretty on body; subtle 1px image outlines (pure black/white only); scale(0.96) on press; never transition:all; will-change only on transform/opacity/filter; min 40x40 hit areas; AnimatePresence initial={false}. Report concrete gaps with file:line. Dimension = 'make-interfaces-feel-better'.` },
  { label: 'accessibility', prompt: `${CONTEXT}\n\nROLE: Accessibility auditor (cross-cutting, WCAG-minded).\nREAD: ${CHROME}, ${PUBLIC_PAGES}, ${MEMBER_PAGES}, and ${STYLES}.\nCHECK FOR: missing :focus-visible / focus traps in modals; images without alt; icon-only buttons without aria-label; non-semantic clickable divs (should be button/a); form inputs without associated labels; color-contrast risks (low-opacity text over images/gradients — check the magazine card overlays); missing prefers-reduced-motion coverage on animated elements; heading order; keyboard operability of custom controls (dropdowns, toggles, carousels); the new featured ticker pausing/operability for keyboard + reduced motion. Dimension = 'accessibility'.` },
]

// Waves of 3 -> ~4 sequential barriers. Spreads token rate well under the burst limit.
const auditResults = await waved(
  auditors.map(a => () => agent(a.prompt, { label: a.label, phase: 'Audit', schema: FINDINGS_SCHEMA })),
  3
)

let all = []
auditResults.filter(Boolean).forEach((r, idx) => {
  ;(r.findings || []).forEach((f, j) => all.push({ ...f, _id: `${idx}-${j}`, _src: auditors[idx] ? auditors[idx].label : 'unknown' }))
})

const sevRank = { critical: 4, high: 3, medium: 2, low: 1 }
const byKey = new Map()
for (const f of all) {
  const key = `${(f.file || '').toLowerCase().trim()}|${(f.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 50)}`
  const prev = byKey.get(key)
  if (!prev || (sevRank[f.severity] || 0) > (sevRank[prev.severity] || 0)) byKey.set(key, f)
}
const deduped = [...byKey.values()]
log(`Audit complete: ${all.length} raw findings -> ${deduped.length} after dedup. Verifying medium+...`)

phase('Verify')

const toVerify = deduped.filter(f => (sevRank[f.severity] || 0) >= 2)
const lowNits = deduped.filter(f => (sevRank[f.severity] || 0) < 2).map(f => ({ ...f, verdict: 'unverified' }))

const verified = await waved(
  toVerify.map(f => () =>
    agent(
      `${CONTEXT}\n\nROLE: Adversarial verifier. A prior auditor reported the finding below. REFUTE it unless the code clearly proves it real. Open the cited file, read the actual code around the cited line (and related code), and decide.\n\nFINDING:\n- dimension: ${f.dimension}\n- severity: ${f.severity}\n- title: ${f.title}\n- file: ${f.file}\n- line: ${f.line}\n- problem: ${f.problem}\n- recommendation: ${f.recommendation}\n\nRules: verdict='refuted' if the code already handles this, the file/line doesn't support it, it's a deliberate CONTEXT decision, or it's too speculative. verdict='partial' if real but overstated (set corrected severity). verdict='confirmed' only if you can point to the exact code that proves the defect. Re-rate severity honestly. If confirmed/partial, give a tightened recommendation.`,
      { label: `verify:${(f.file || '').split('/').pop()}:${f._id}`, phase: 'Verify', schema: VERDICT_SCHEMA }
    ).then(v => ({ ...f, verdict: v ? v.verdict : 'refuted', verify_reasoning: v ? v.reasoning : '', severity: v && v.severity ? v.severity : f.severity, corrected_recommendation: v ? v.corrected_recommendation : '' }))
  ),
  4
)

const confirmed = verified.filter(Boolean).filter(v => v.verdict === 'confirmed' || v.verdict === 'partial')
const refuted = verified.filter(Boolean).filter(v => v.verdict === 'refuted')
log(`Verification: ${confirmed.length} confirmed/partial, ${refuted.length} refuted, ${lowNits.length} low nits.`)

phase('Synthesize')

const finalReport = await agent(
  `${CONTEXT}\n\nROLE: Lead synthesizer. Below is the VERIFIED findings dataset (JSON) from an exhaustive 6-dimension audit of the AquaTerra site. Produce the final audit report as clean Markdown for the user.\n\nVERIFIED + PARTIAL FINDINGS:\n${JSON.stringify(confirmed, null, 2)}\n\nLOW-SEVERITY NITS (unverified, include briefly):\n${JSON.stringify(lowNits.map(n => ({ dimension: n.dimension, title: n.title, file: n.file, line: n.line })), null, 2)}\n\nREQUIREMENTS:\n1. Open with a 4-6 line executive summary: overall health, count by severity, biggest theme per dimension.\n2. A section PER DIMENSION in this order: Responsiveness, UX, Performance, Supabase Integration, Accessibility, Interface Details, Make-Interfaces-Feel-Better. Within each, list confirmed/partial findings ordered by severity. For EACH: a bold one-line title with severity tag, the file:line, the problem (1-2 lines), a concrete fix. Use clickable markdown links [file.tsx:line](path:line) for every file reference.\n3. For the two skill dimensions (Interface Details, Make-Interfaces-Feel-Better), present findings as a Markdown table with **Before** and **After** columns grouped by principle.\n4. End with a 'Top 10 fixes ranked by impact/effort' table (# | Fix | Dimension | Severity | Effort).\n5. Be faithful: do not invent findings beyond the dataset; if a dimension has zero confirmed findings, say so plainly. Keep it scannable.\n\nReturn ONLY the Markdown report.`,
  { label: 'synthesize', phase: 'Synthesize' }
)

return {
  counts: { raw: all.length, deduped: deduped.length, verified_confirmed: confirmed.length, refuted: refuted.length, low_nits: lowNits.length },
  report: finalReport,
  confirmed,
}
