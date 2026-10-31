# AquaTerra Design Audit — Framework

Source: `vercelaq-main` (React 19 + Vite + Supabase, no API server, RLS-authorized). This audit reads the live `frontend/src` code — not the earlier handoff mockups (`design-reference/`) or the prior written audits (`docs/*AUDIT*`, `AQ ECOSYSTEM/07 Improve/*`). Where this audit's findings overlap with those, it says so; where the live code has since diverged, this audit describes what is actually shipping today.

Every page gets its own file under `design-audit/<phase>/<page-slug>.md`. Each file uses this structure:

1. **What this page is** — route, component file(s), who sees it, and the user's actual intent arriving here.
2. **Current design** — layout, key components, states (loading/empty/error), what's genuinely working.
3. **Intent-driven affordance audit** — the primary lens for this project (see below).
4. **Faults** — concrete, cited to file/line-ish detail. Severity-tagged P0 (broken/blocking/harmful) / P1 (real friction) / P2 (polish).
5. **Improvements** — specific, actionable, tied to a fault. Not generic advice.

## The primary lens: intent-driven UX affordances

Every audited page is checked against these questions, in this order:

1. **What is the user's intent when they land here?** Named explicitly (e.g. "decide whether to apply for this role," not "view opening"). A page can serve more than one intent (a first-time visitor vs. a returning member) — name each.
2. **Does the page's visual hierarchy lead with the action that serves that intent?** The primary CTA should be the most visually dominant interactive element, not just present somewhere on the page. Check what actually wins the eye first (size, contrast, position) against what the user came to do.
3. **Do affordances look like what they do?** Buttons look pressable, links look navigable, expandable rows look expandable, drag handles look draggable, disabled states look disabled (not just dimmed-and-ambiguous). Flag anywhere a clickable thing doesn't read as clickable, or a static thing invites a click it can't fulfill.
4. **Is every affordance earning its place, and is anything missing?** Flag controls that don't map to a real intent (dead weight, competing CTAs). Flag intents with no clear path (a want the user has here that the page gives no button for).
5. **Does copy on controls match the user's goal, not the system's internal verb?** "Apply now" beats "Submit"; "See who's going" beats "View." Flag generic/system-centric labels.
6. **Do secondary and tertiary actions stay visually subordinate?** A page with 4 equally-weighted buttons has no primary action. Flag flat hierarchies.

Every other design dimension (below) is checked too, but intent-driven affordance is the lead finding for each page, not an afterthought.

## Supporting checks (every page)

- **Design-system adherence** — against `styles/tokens.css` (the real token set) and the two intentional design languages (neubrutalist public/member surface vs. brutalist `.admin` HoD desk vs. Paradox's own system — see `Two Design Languages.md`). Flag drift *within* a language, not the existence of two languages (that's deliberate).
- **Accessibility** — contrast (tokens.css already documents which hues need the `-ink` variant for text use — flag any raw hue used as text color), focus states, hit-target size (44×44 min), semantic structure, alt text.
- **Responsive behavior** — breakpoints per `HANDOFF-SPEC.md` (1080/760/420/340) and what actually happens to the affordance hierarchy on mobile (not just "does it fit").
- **States** — loading, empty, error, success are evaluated as real states, not just the happy path.
- **Copy** — clarity, tone, redundancy. Not rewritten here; flagged.
- **Motion** — per `Motion and Feedback.md`; flag missing reduced-motion guards, or motion that fights the primary CTA for attention.

## Severity legend

- **P0** — broken, misleading, or actively works against the user's intent (dead-end, invisible affordance for a required action, contrast failure on required text).
- **P1** — real friction: correct but harder than it should be, hierarchy is flat, copy is unclear, secondary path is missing.
- **P2** — polish: consistent with the system but could be sharper.

## Scope note

Paradox (`/paradox/*`) is excluded from this audit's domain — it's a separate sub-app with its own design language, nav, auth and footer. Nothing under `frontend/src/paradox/` is covered.
