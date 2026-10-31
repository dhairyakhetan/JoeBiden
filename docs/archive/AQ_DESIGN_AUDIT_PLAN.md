# AquaTerra design audit + execution plan (2026-07)

Goal: make every page a faithful, vibrant, compact, neat Y2K-brutalist duplicate of the handoff
prototype (`design-reference/AquaTerra - Playground.dc.html`). Source of 6 parallel page-cluster audits.
Checklist below — `[x]` = done + verified, `[~]` = in progress, `[ ]` = todo.

## SYSTEM-LEVEL (v6.css — fixes many pages at once)
- [x] Restore dashed dividers by default (scoped flatten rule to seamless mode). `bb14ebf`
- [x] 3px brutalist card borders — `.admin .card` wins its 3px over the global 2px cap. `bb14ebf`
- [x] Category-hue aliases + `--teal`. `bb14ebf`
- [x] Flourish kit global utilities — `.stag`, `.deco.*` (+keyframes), `.linktab`, `.underline-doodle`, `.taped`. `bb14ebf`
- [~] Mobile: SearchPage + Members h-scroll guards done (`9f6713a`). REMAINING: section-padding clamp, 760/767 unify, dead `.mtb-item` cleanup.
- [ ] Chip/tab/stat/role brutalist forms — DEFERRED (conflicting existing rules; needs care).

## FOOTER — [x] DONE `83be917` (contained card + lemon CTA + wordmark + dashed bar).

## DIRECTORY / PROJECTS
- [x] Grid `.pcard` → white brutalist card + category-hued no-image fallback. `4f4431f`
- [x] `.stag` stagger on drive grids. `9f6713a`
- [ ] Bold bordered directory search; featured-band tape+tilt.
- [ ] Project detail: 4-up colored stat rail; hero №-sticker; brutalist similar tiles; stat-pull display font.

## TEAMS — [x] card 3px+tilt, ink-ring avatars, banner border `3c739c7`. [ ] team-detail hero card+emoji watermark.

## COMPOSE / HIRING / AUTH / PROFILE
- [x] Compose modal brutalist shell + bordered close btn. `6c7f01b`
- [x] Openings → responsive grid + stagger. `9f6713a`
- [ ] Compose: tinted category chips, author row, toolbar dashed divider.
- [ ] Login forgot-password + dashed-tomato error; Register label htmlFor; Profile achgrid rotated sticker grid.

## HOME / FEED — [ ] feed card alt tilt; featured-drives strip; feed-foot 2px dashed; nav nested backdrop-filter.

## BLOG / ABOUT / CONTACT / COLLAB / MEMBERS / FAQ
- [x] Members card ink border; FAQ compact hover-lift. `6c7f01b`
- [x] Blog drop-cap accent; About avatar rings; Contact textarea 16px. `26efcad`
- [ ] Blog mag-lead 2-col + framed hero + skeleton; Contact postcard tilt/2-col; Collab logowall hover-flood;
  About timeline hierarchy.

## Routing — [x] /recruitment → /login `2106c92`.

## ALSO DONE (later batches)
- [x] Compose category chips pre-tinted rainbow row. `d54e354`
- [x] Profile achievements → rotated sticker grid (straighten+lift on hover). `3aaf4b2`
- [x] Login error → dashed-tomato token. `cdaa33d`
- [x] Register label htmlFor; directory bold search; mobile section paddings→clamp. `6b69a65`
- [x] Nav de-frost (drop nested backdrop-filter); feed-foot 2px dashed. `a906c02`
- [x] Collab logo-wall hover (rotate+scale+wash); Contact postcard tilt+8px shadow. `8a661ec`

## PREVIOUSLY REMAINING — now DONE
- [x] Blog magazine lead: 2-col grid already existed; added the cover-story weight (7px→10px hard
  shadow + 3px border). Skeleton loader + accent drop-cap done earlier. `<blog commit>`
- [x] Team-detail hero → emoji watermark + white chip. `3d1ed95`
- [x] Directory FeaturedDrives band: card tilt + 3px border + heavier shadow. `f8b97a6`
- [x] Feed card alternating rest tilt — via independent CSS `rotate` property (composes cleanly). `79dac1a`
- [x] Compose author identity row. `be6893f`
- [x] `.role` 2px + `.stat` hover-lift `905560e`; `.chip-active` → green accent `d767bd5`
  (`.tab` folder→pill = moot, dead CSS).
- [x] Mobile: 760/767 breakpoint unified + touch rule retargeted to `.aq-tab-item`. `a9db8f1`
- [x] **Mobile menu now matches handoff**: full-screen cream drawer + full-bleed ink-bordered bottom bar. `0c9937a`
- About timeline left as-is (data is only {year,text}; a title/snippet split would fabricate structure).
- Login "forgot password?" — a FEATURE (needs supabase.auth.resetPasswordForEmail), out of a design pass's scope.

## VERIFY — [x] tsc+build clean every batch; visual checks on footer/directory/faq/teams/opportunities/contact/home.
