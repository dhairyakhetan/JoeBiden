# Delight pass: animation, interaction and play

Owner brief, 2026-10-21: "make as many fun animations interactions gamifications new", then "plan it out across with intent and execute and test it".

## Decisions (owner answers)

| Question | Answer | Consequence |
|---|---|---|
| Persistence | Visual only | No new tables, no scores stored, nothing to migrate. Anything that looks like progress is derived from data the app already reads. |
| Audience | Members and public visitors | Public pages get play too. Members are students, many under 18, so there are **no rankings of people**. Nobody is shown ahead of anyone. |
| Surfaces | Profile, tasks and drives, feed, public site and mini games | One slice each, below. |
| Intensity | Maximum fun | Confetti, hearts, sparkle and bounce on real moments. The cost is bundle size and noise, so the next two sections are not optional. |

## Intent

A moment earns an effect when something **finished** or something **arrived**: a task done, a drive checked in, a post published, a milestone crossed, a game won. Effects do not decorate idle state. Frequency decides intensity: a like is tiny, a published post is medium, a milestone is big.

## Rules every slice follows

1. **One switch.** `lib/delight.ts` is the only place that decides whether an effect runs. It returns false under `prefers-reduced-motion` or when the member turned effects off in Settings ("fun effects"). Slices call `celebrate()`, never roll their own.
2. **Lazy by default.** The eager bundle has about 7.6 KB of headroom (budget 683.6 KB, now 676.0). The listener that receives `celebrate()` events is under 1 KB; the renderer loads on the first event. Games are code-split per game. Nothing in this pass may raise the eager budget without a recorded reason.
3. **CSS keyframes, not framer, for particles.** Particles are transform and opacity only, removed on `animationend`, capped per burst. Framer stays for component entrances through `lib/motion.ts`.
4. **`tapScale` stays 0.96.** Overshoot stays inside `springPop` (bounce 0.1 to 0.3).
5. **Mutation convention is unchanged.** An effect never replaces the toast. It plays after success, never before, and never on a failed write.
6. **Tests.** Pure logic (effects switch, level and badge derivation, game rules) gets Vitest cases. Every visual slice is checked in a real browser at 390 and 1440, signed in and out, with reduced motion on and off.

## Slices (one PR each, merged on green CI)

| # | Slice | What ships |
|---|---|---|
| A | Delight kit | `lib/delight.ts` (switch, `celebrate`), `CelebrationLayer` (confetti, hearts, stars), Settings toggle, tests |
| B | Tasks and drives | Task done: check burst and a progress ring that fills. Whole list done: confetti. Drive check-in and attendance complete: stars |
| C | Feed | Like sends hearts that rise from the button. Post published: confetti. Saved: bookmark flip |
| D | Profile | Level ring and badge shelf derived from existing counts (drives, hours, posts, tasks done). Badges unlock with a flip the first time they are seen on this device |
| E | Public site | Magnetic primary buttons, sticker wiggle, scroll-progress ribbon, hero cursor sparkle on fine pointers only |
| F | Mini games | The `/games` hub is empty (`GAMES = []`). Three games, each code-split: Drive Sorter (sort items into the right bin), Streak Tap (reaction time, personal best kept in this browser only), Sticker Match (memory) |

## Out of scope on purpose

Leaderboards of people, public points, anything written to the database, sounds, and anything in the HoD desk (it stays motion-light by design, see `CLAUDE.md`).

## Verification per slice

`npm test`, `npm run lint`, `tsc -b`, then `npm run build` for any slice that adds a chunk (budget and prerender), then browser screenshots and an interaction script at 390 and 1440 with reduced motion on and off.
