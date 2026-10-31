# AquaTerra Canonical Design Spec (audit reference)

Extracted from the Claude Design handoff (design-reference/*.dc.html). The Playground
is the single canonical direction. This file is the DIFF TARGET for the launch-readiness
audit. It is a scratch reference for the audit pass — not shipped design doc.

## 1. TOKENS (:root, exact)
Background: --bg #F4EFE0 (warm cream, page base) · --bg-2 #EDE6D0 · --bg-3 #E2D9BD · --card #FFFFFF (raised cards ONLY)
Ink: --ink #0A0A0A · --ink-2 #2A2A28 · --ink-3 #5A5A55 (muted)
Lines: --line rgba(0,0,0,0.18) (dashed dividers) · --line-2 rgba(0,0,0,0.32)
Category hues (one per vertical, NEVER reuse):
  welfare #1B8A5A (green) · events #3DA9FC (sky) · labs #FFC700 (lemon) · ops/operations #12909C (teal) · content #7E5BFF (grape)
Named palette: --accent #1B8A5A (=welfare) · --sky #3DA9FC · --lemon #FFC700 · --tomato #FF4D2E (like/alert) · --teal #12909C · --grape #7E5BFF · --pink #FF4D8C (accent only)
Duplicate aliases flagged to delete: --mint (=welfare green), --accent2 (=events). NOTE: code uses --mint pervasively; deleting is high-churn/low-value — treat as OPTIONAL, keep working.
Fonts: --display 'NeutralFace' · --eina 'Eina01' · --serif 'Instrument Serif' (italic flourish, colored --accent) · --mono 'JetBrains Mono'
No spacing/radius/shadow :root vars — values are ad-hoc; scales below are targets.

## 2. TYPOGRAPHY
NeutralFace = display/headlines/numbers (700-900). Eina01 = body (400-800). JetBrains Mono = labels/meta/counts (400/700/800). Instrument Serif = single italic flourish word, always --accent.
Scale: Display XL clamp(44px,7vw,86px)/900/-0.045em/.9 · Feed title 40-78px/800-900/-0.04em · Section head clamp(30px,4.4vw,46px)/800/-0.03em · Card title 17.5px/800 (Eina) · Body 14px/400/1.6 (Eina) · Meta 10-11px/700/.05em (mono)
Rules: body never <13px; mono labels never <10px; titles tight negative tracking; lowercase UI labels + trailing period on page titles.

## 3. COLOR = MEANING
.cat-welfare{--cc:var(--welfare)} … .cat-ops/.cat-operations{--cc:var(--ops)} .cat-content{--cc:var(--content)}. Chips: background var(--cc); color #0A0A0A.
Contrast (WCAG AA): ink text on green/sky/lemon/tomato/teal; WHITE text ONLY on grape at large sizes. ops teal must be #12909C (darkened for AA).
Slug drift: both `ops` and `operations` exist — must both map to teal.

## 4. COMPONENTS (neubrutalist)
Motif: every raised surface = solid ink border + HARD OFFSET shadow `Npx Npx 0 0 var(--ink)`, never soft blur. Blur ONLY on glass nav (.nav-in).
Border two-tier: 2px = secondary (chips, inputs, tiles, buttons, rails, notices). 3px = primary/structural (feed cards, team cards, panels, modals, heroes, form cards). NO 1px/1.5px structural borders (1.5px only on glass nav border / avatar ring).
Radius: 8 (inputs/square chips) · 14 (tiles/notices) · 20 (cards/rails) · 999 (pills/buttons) · 22 (modals) · 24 (page hero).
Shadow scale (offset): rest-sm 2px2px0 · rest-lg 4px4px0 · hover 6px6px0 + translate(-3,-3) · active 1-2px pressed + scale(.97) · glass nav blur(20px) saturate(1.7) + soft.
Buttons .btn: pad 10px17px, sans 700 13px, 2px ink, radius 999, bg --card. Hover translate(-2,-2)+3px3px0. Active translate(0)+scale(.97). .btn-primary bg --accent color #0A0A0A. Disabled opacity .45. Loading spinner+opacity.75. Focus 3px grape 2px offset.
Chips .chip: pad 6px12px, 2px ink, radius 999, mono 700 11px upper. .on bg --accent. .cat fill --cc.
Stickers .sticker: display 800 10.5px, pad 6px12px, radius 999, bg --lemon color #0A0A0A, rotate(-3deg), wob animation. Tilts ≤3°.
Inputs .input/.textarea/.sel: pad 11px14px, bg --bg, 2px ink, radius 12, eina 15px. Focus box-shadow 3px3px0 --accent (no blur).
Modals .modal: white, 3px ink, radius 22, 8px8px0, max-w 480, max-h 88vh, modalIn spring. .modal-x close 36×36 — SHOULD be ≥44×44 (P0 hit target).
Avatars .avatar: 40×40 circle, display 800 13px, ring box-shadow 0 0 0 2px --ink. Profile .pav 92×92 3px ink + 4px white ring.
Toggle .tggl: 46×27 pill 2px ink, .on bg --accent. Needs role=switch/aria-checked.
Tabs .tab: 2px ink radius 999 display 700 13px, .on bg ink color bg.
Nav .nav-in: the ONE glass exception — rgba(255,255,255,.42) blur(20px) saturate(1.7), 1.5px border, soft shadow, radius 999. Icon buttons 44×44.

## 5. HOD DESK (admin) — separate visual language
.admin scope re-tokens .card/.btn/.input to flat --hod-* (shade elevation, no hard offset shadow, no rotation, no sticker pills). All 14 director tabs + management-only TeamDetail/Opportunities parts must route through .card/.hod-card under .admin, never hand-rolled hard-shadow inline styles.

## 6. P0 / P1 CHECKLIST (verify in current code)
P0: no soft-blur shadow override layer (blur only nav); one-hue-per-category intact; 2px/3px borders (no 1/1.5px structural); AA contrast (ink on saturated, white only on grape large); GLOBAL :focus-visible 3px grape 2px offset; ≥44×44 hit targets (nav icons, act buttons, modal ×, bottom-nav); per-route <title>+meta desc; one <h1>/page; semantic header/nav/main/footer; router one-URL-per-screen + Back; auth/role guards; modal focus-trap + return-focus + aria-modal + Esc.
P1: 8-step 4px spacing scale (4/8/12/15/18/22/32/52); shared empty/loading/error components; prefers-reduced-motion wraps all infinite/decorative motion (spin/wob/marquee/drift/twinkle/pulsedot); toggle role=switch, tabs tab/tabpanel, accordion aria-expanded, feed items <article>; lowercase warm microcopy; toast role=status live region + queue (not single-toast).
Motion: press 120-140ms · hover 160-180ms · page-in 380ms · stagger 60ms. Enter cubic-bezier(.2,0,0,1); spring cubic-bezier(.34,1.56,.64,1); linear only marquee/star-spin.
Responsive breakpoints (consolidate onto these 5): container max 1320 (feed)/1060 (narrow); 3-col shell 230/1fr/264.
  >1080 full 3-col + glass nav + mega-menu + right rail · ≤1080 right rail hides, shell 2-col 210/1fr, grids 3→2 · ≤760 single col, top nav collapses, BOTTOM NAV appears, chips horizontal scroll · ≤420 stat rows 4→2, hero tightens · ≤340 everything single col.
Do NOT ship demo shortcuts: any-credentials login, artificial 1.6s setTimeout loaders, Date.now() ids, 40ms setInterval count-ups (use rAF/CSS), imperative body-appended confetti/toast.

## 7. SCREEN INVENTORY (38) — per-page audit checklist
Public: Home/Feed, About, Blog, BlogPost, Teams, TeamDetail, Members, PublicProfile, Projects, ProjectDetail, Openings/Opportunities, Recruitment, EverythingWeDo, Collaborations, Schools, Classes, Roots, FAQ, Support, Contact, QuickLinks, BrandPage(design-language, noindex).
Authed: Profile, Settings, Notifications, Saved, MyPosts, PostPage, Search, HOD Desk.
Recruitment/onboarding: Login, Register, Onboarding, Handbook, Pending, Rejected, VolunteerThankYou.
System: 404/NotFound.
Overlays/modals: quick-menu, mega-menu, mobile drawer, mobile bottom nav, floating compose, toast host, island TOC, lightbox; modals: CreatePost, DesignStudio, Add/EditAchievement, CreateTeam, JoinRequest, AddMember, CreateTeamPost, Share, Confirm, ApplicantReview, Enquiry, EditPost, Project.
