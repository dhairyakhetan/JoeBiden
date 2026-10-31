# One design language, everywhere (plan)

Owner, 2026-10-19: the entire site should feel intentionally designed and cohesive at every breakpoint, richer and
more playful with motion, not vibe-coded. When shown two cards side by side: "the one on the right is better, the
left is the old design language."

## The language (already in `styles/tokens.css`; this plan only enforces it)

| Thing | Rule |
|---|---|
| Surfaces | Rounded and soft. Radius scale 999 / 32 / 22 / 14 and nothing else (the three documented 6px exceptions aside). |
| Edges | Hairline: `--hair` inside a card, `--hair-2` a card's own edge, `--hair-3` an input's edge. No 2px ink borders. |
| Depth | Soft lifts: `--lift-1` at rest, `--lift-3` on hover, `--lift-4` for modals. |
| Hard offset shadow | Only `.btn-primary` and `.sticker` (design handoff 00.6). Nothing else. |
| Fill | Category hue as a fill with ink text, plus one corner disc at 10% ink. Never a hue as text on cream. |
| Type | `--display` headlines and numbers, `--eina` sentences, `--mono` uppercase labels only, `--code` for identifiers (emails, numbers, handles, slugs). NeutralFace is caps-only. |
| Motion | `lib/motion.ts` and `Reveal` / `CountUp` / `SuccessCheck`. Press is `tapScale` (0.96). Lifts are `translateY(-2px)`, never a diagonal translate. Honour `prefers-reduced-motion`. |
| Breakpoints | 600 (phone), 760 (page padding and stacks), 1024 (desk table, tablet), 1440 (checked width). The CSS uses these four for most rules; new rules pick from them. |
| States | Loading is skeletons shaped like the content, never the word "loading". A permission is neutral, a gap in a record is red. |
| Emoji | Not as icons (DESIGN.md). |

## Done on 2026-10-19

- Open roles card and the feed "we're hiring" card: category fill, no empty image slot, soft lift.
- Tabs, Toggle, ErrorState retry, team and handbook dividers, home peek cards, film strip, org chart panel.
- Desk home: one slab, one set of counts. Members table: identifiers in `--code`, quiet copy buttons.
- `/tasks`: tiles that count up, status edge, avatar stacks, one-tap done.
- Poster studio: two-pane, honest design list, headline not the whole post.
- Public department lists skip hidden teams (`PUBLIC_DEPARTMENTS`).

## Worklist still open (counted by grep, not by eye)

Files still carrying the old marks (`2px solid var(--ink)`, offset shadows). Several are deliberate (`MomLemonCard`
follows the owner's poster; `.sticker`, `.btn-primary`), so each needs a look rather than a sweep:

1. `styles/v6.css` (29 hits) and `styles/routes/director.css` (11): shared rules; check which are the two allowed
   surfaces and which are leftovers.
2. `components/ProfileNudgeCard.css`, `HowItWorks.css`, `OpeningsStrip.css` (a marquee band), `auth/LoginPage.css`,
   `auth/PendingApprovalPage.css`, `styles/routes/projects.css`, `profile.css`.
3. ~~Off-scale radii~~ done 2026-10-19: the inline `borderRadius` values in the profile, team and feed files now use `--r-tight` or `--r-inner`. `components/TerraThonBanner.tsx` keeps its own 16px (a self-contained banner).
4. Rotated elements: `v6.css` (26), `BrandPage.css`, `projects.css`, `AboutPage.css`, `SignInReceipt.css`,
   `NotFoundPage.tsx`, `TerraThonBanner.tsx`. Rotation is part of the sticker motif; keep it on stickers only.
5. Motion: counted properly, most public pages already animate (`Reveal`, the `.stag` CSS stagger, `SuccessCheck`); a grep for `Reveal` alone undercounts. Checked again 2026-10-20: the policies, notifications, saved posts and my posts all carry `route-enter` (a page-level fade-and-rise), so no page is without an entrance; only their lists are static. The desks stay motion-light on purpose.
6. Footer: on a phone it is about three quarters of a short page (measured on `/opportunities` at 390). A proposal, not a defect: fold the link groups into one compact block and merge the welcome letter and the Paradox promo.

## Gutter audit, 2026-10-20 (measured, not eyeballed)

Left and right inset of every block directly under `<main>` on 18 public routes, at 390 and 1440, on the dev server.
The shared geometry is `.container` (`--frame-max` 1280, `padding: 0 var(--page-px)`): content edge 104px at 1440, 16px on a phone. Findings:

- Fixed: `/games` hand-rolled `.gm-wrap` (1100px, 20px side padding), a third gutter, now on `--frame-max` and `--page-px`. The footer thesis card
  had the browser's 40px `<figure>` margin and sat inset from every other footer block (fixed in the same session).
- Resolved, deliberate: the home page's 24px phone block is the logged-out intro gate, a centred 420px column in a padded wrapper.
- Resolved, my error: `/policies` and `/terms` are not routes, so the odd 240px and 99px insets I first reported were the not-found page. The real policy pages (`/equity-policy`, `/privacy-policy`) sit on the shared gutter.
- Converted 2026-10-20 to hairlines and soft lifts: `.card-hover`, `.marquee`, `.avatar`, `.role`, `.stat`, `.menu`, `.toast`, `.modal`, `.iconbtn`, `.drawer` (v6.css), the profile wall surfaces, and the desk's triage total and export chips. Left on purpose: focus outlines, the primary send buttons (they follow `.btn-primary`), the CV sheet, and `/brand`.
- `/brand` is a specimen sheet with negative right insets from its rotated and bleeding specimens: expected, not a defect.
- No route has horizontal overflow at either width.

## Method for the rest

1. Pick one shared rule or component, change it, look at it at 390 and 1440 in `/dev/*` or a mocked page.
2. `npm test`, `npm run lint`, `npm run build` (the eager bundle budget is 683.6 KB; the owner allowed raising it
   by up to about 25 KB if a change needs it, and the PR must say so).
3. One PR per theme, merged on green CI, deploy checked.

## Answered 2026-10-20 (owner)

- Hiring cards: confirmed the new design after a hard refresh (the screenshot was a stale cache).
- The opportunities card fan stays: the one deliberate tilt on a content card, straightens on hover.
- Dead `.post-card`, `.mob-nav`, `.mobile-tabbar`, `.guest-banner` and `.pulse-strip` rule blocks deleted from v6.css (86 lines; eager bundle 674.7 to 672.5 KB). Grouped selectors that still name a dead class were left, since a dead name in a list is a no-op.
- Team totals stay as built: per-team monthly counts, no per-person rows, no live figure.

## Open for the owner

- `CLAUDE.md` described the public surfaces as neubrutalist. The owner's answer above makes the rounded language the
  target everywhere, so that paragraph was amended in the same change as this plan.
- Answered 2026-10-20 (owner): `.btn-primary` keeps its hard shadow (with `.sticker`, the only two surfaces), and the
  phone footer gets compacted as proposed in worklist item 6: link groups folded into one block, welcome letter and
  Paradox promo merged. The footer change is not built yet.
