# Design rules for a change that must look native

> **Superseded in scope by `docs/context/DESIGN_GUARDRAILS.md`** (2026-10-22): the full guardrail checklist, the design
> history, the complaint decoder and the screenshot-reading method. This file stays as the short component list.

Built 2026-10-08 from a read-only pass over `styles/tokens.css`, `components/`, `lib/motion.ts`,
`lib/imageUrl.ts` and `CLAUDE.md`. **`CLAUDE.md` and `styles/tokens.css` are the authority; this file
is a working summary.** `tokens.css` is read-only for the routine (the token layer belongs to the
redesign lead).

## Two languages, and they have drifted from the prose

- **Desk** (`director/*`, the `.admin` scope, `styles/routes/director.css`): rounded minimalism.
  Radii only from the scale 999 / 32 / 22 / 14 (`--r-outer`, `--r-inner`, `--r-tight`), hairline
  edges, soft lifts (`--lift-1` to `--lift-4`), no motion. Route new containers through `.card` /
  `.hod-card` and rows through `.panel-h`, `.qrow`, `.qtag`, `.iconbtn`; never hand-roll a style,
  because inline `style` beats the cascade.
- **Public and member** (`public/*`, `feed/*`, `profile/*`, `teams/*`, `bugs/*`): the brand's
  louder system. `CLAUDE.md` describes hard 2px ink borders and hard offset shadows; the pass found
  `tokens.css` now sets the default edge to a 1px hairline and limits hard offsets to the primary
  button, stickers and one hero card per screen. **Read `tokens.css` and a neighbouring page before
  you style anything**, and copy what the neighbour does.
- `paradox/*` and `terranotes/*` are their own systems. Do not unify them.

## Components to reuse

| component | use for |
| --- | --- |
| `useToast()` (`components/Toast.tsx`) | the result of every mutation: `success`, `error`, `info` |
| `useConfirm()` (`components/Confirm.tsx`) | before any destructive action; promise based; say what cannot be undone |
| `Modal` | dialogs; `fullScreenMobile` for forms; footer via `Modal.Footer` |
| `Field` | every labelled control, with `hint` and `error` linked by `aria-describedby` |
| `EmptyState`, `ErrorState` | nothing here yet; a fetch failed (`onRetry` re-runs the loader, never reloads the page) |
| `Img` and `sized(url, ctx)` | every `<img>`; `ctx` is avatar, thumb, card, cover or full |
| `Reveal`, `lib/motion.ts` | public-page motion; `tapScale` is always 0.96 |
| `useAnnouncer()` (`LiveRegion`) | announce filter results to screen readers |
| `OfflineBanner` | connectivity that persists (a toast would expire) |
| `ImageLightbox` | full-screen image |

## Rules that bite

1. **Every `<img>` through `sized()` or `Img`.** It only rewrites Framer CDN URLs and passes other hosts through. This was the biggest real performance bug in the project.
2. **Every mutation: pending state, success toast, error toast** (never a silent console log). Services throw; the component toasts. Never toast inside `services/*.ts`.
3. **Reduced motion is the caller's job.** `lib/motion.ts` variants do not check it; use `useReducedMotion()`.
4. **`--mono` is NeutralFace: capitals only, no tabular figures, and wider than the old font.** Lowercase text on it shouts. Use `--code` where the glyphs are the content (paths, slugs, emails, digit columns, user text, `<select>` values). After any font-token change compare `scrollWidth` with `clientWidth`.
5. **Text colour uses the `-ink` partner** (`--welfare-ink`, not `--welfare`); display hues are fills.
6. **The accent-lint ledger is keyed by line number** (`scripts/accent-lint-baseline.json`). Inserting a line above a tracked rule makes `npm run lint` fail twice. Re-point the entry in the same commit. The list may only shrink.
7. **Shared components are not Tailwind.** Use the `.aqm-*` and token classes.
8. **Route and tab gating match the database.** `ProtectedRoute` props and the desk's `superOnly` flag change together.

## Checklist before shipping a UI change

1. Check 390px first, then 320, 1024 and 1440.
2. States: loading, empty, error, populated with long real-looking copy. Do not trim copy to fit.
3. Every image sized, with `alt`.
4. Every mutation has pending, success and error feedback; destructive ones confirm.
5. Every input in a `Field`.
6. Tokens only: radii from the scale, shadows per language, `-ink` for text.
7. Motion honours reduced motion; none on the desk.
8. Run from `frontend/`: `npx tsc -b`, `npm test`, `npm run lint`, `npm run build`, then look at it in a browser (`/dev/desk`, `/dev/bugs`, `/dev/authed`, `/dev/gallery` need no credentials).
9. `git checkout frontend/public/sitemap.xml` after a build, and stage explicit paths.
10. No real member names, emails, phones or photos anywhere in fixtures, tests, logs or PRs.
