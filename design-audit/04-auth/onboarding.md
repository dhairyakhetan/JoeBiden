# Onboarding — `/welcome`

**File:** `public/OnboardingPage.tsx` (811 lines), `OnboardingPage.css`.

## What this page is

**Intent:** a guided, illustrated tour for someone who wants a slower, more visual explanation than the login page's three-line pitch gives — but only if they already know the URL.

## What's genuinely working — the most visually confident page in the whole audit

Five steps, each pairing a short text column with its own small, continuously-animated illustration: bobbing wordmark letters with drifting sparkles, an auto-liking mock feed card with hearts that float and fade, six member avatars orbiting a "you" node, a form that types and checks itself, and a confetti-and-stamp "approved" burst. Every one of `prefers-reduced-motion`'s callers is honored per-animation, not with one blanket switch. The page also fixes two real, specific accuracy bugs found nowhere else in this pass: it used to claim "six categories" when the app has five (comment traces this to matching `PostModeration`'s actual `CATEGORIES` array), and it used to promise approval "within 48 hours" while five other surfaces said a week — now pulled from the same centralized `APPROVAL_TIME` constant as everywhere else.

This is worth calling out directly against the "more energy, less AI-slop" direction: this is what that looks like already built and shipped in this codebase — bold flat color, continuous purposeful motion, a confident illustrated voice, zero hedging. It's the reference point, not a gap.

## Intent-driven affordance audit

### P1 — The single most energetic, on-brand page in the product has no door into it
Per the routing documentation, `/welcome` is deliberately unlisted: not in the nav, not in the footer, not in `sitemap.xml`, not in `metaConfig`. The only way anyone reaches it is a direct URL someone hands them. That means the page that best demonstrates the tone this audit (and the brand direction) wants more of everywhere else is systematically the least-seen page in the app. A prospective member deciding whether to join sees the comparatively restrained Login page's three-line pitch, not this. Strongly worth surfacing this — a "take the tour" link from Login's footnote, or from the nav's mega-menu "get involved" column, or auto-offered to a first-time visitor before Login — rather than leaving it fully undiscoverable.
