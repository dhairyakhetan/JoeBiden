---
tags: [frontend, components]
---

# Component Library

~80 files in `components/`, plus `director/adminKit.tsx` for the desk. Reuse
before you build — several of these exist specifically because a hand-rolled
version broke something.

## Primitives

`Button` · `Input` · `TextArea` · `Field` · `Toggle` · `Tabs` · `Card` ·
`Badge` · `Modal` · `Alert` · `Spinner` · `Skeleton` · `EmptyState` ·
`ErrorState` · `Avatar` · `Img`

> [!important] `Img` and `sized()` are not optional
> Every `<img>` rendering a remote image must go through `sized(url, context)`.
> See [[Image Pipeline]].

## Layout and chrome

| Component | Role |
|---|---|
| `PublicLayout` | `AQNav` + `AQFooter` shell for public routes |
| `DashboardLayout` | member/desk shell; owns the single `<main id="main-content">` |
| `AQNav` / `AQFooter` / `MobileMenuBar` | navigation |
| `Breadcrumbs` | public wayfinding |
| `ErrorBoundary` | outermost wrapper in `App.tsx` |
| `DynamicIslandTOC` | long-page table of contents |

Note: because `DashboardLayout` renders the `<main>`, `DirectorDashboard`'s main
column is a **`<div>`, not a `<main>`** — do not add a second landmark.

## Feed and content

`PostStreamCard` · `FeedPostCard` · `PostFocusModal` · `CreatePostModal` ·
`CreateLauncher` · `CategoryFilter` · `ImageLightbox` · `ShareModal` ·
`RelatedTicker` · `HiStrip` · `OpeningsStrip` · `HiringCard` · `HowItWorks` ·
`HomeIntro` · `ContactNudge` · `ParadoxBanner`

## The four generative studios

A distinctive part of this codebase: content-authoring modals paired with a
generator module.

| Modal | Generator | Produces |
|---|---|---|
| `BlogStudioModal` + `BlogBlockEditor` | `blogGenerator.ts` | blog drafts |
| `PosterStudioModal` | `posterGenerator.ts` | posters |
| `CarouselStudioModal` | `carouselGenerator.ts` | carousels |
| — | `StoryGenerator.ts` | stories |
| `TemplatePicker` | — | starting templates for the above |

## Feedback primitives — required on every mutation

| Component | Hook | Use |
|---|---|---|
| `Toast.tsx` | `useToast()` → `toast.success/error/info` | every outcome |
| `Confirm.tsx` | `useConfirm()` (promise-based) | before **any** destructive action |

Both providers wrap the app in `App.tsx`. See [[Motion and Feedback]].

## Motion and delight

`Reveal` (scroll reveal, `whileInView`) · `CountUp` / `StatCountUp` (rolling
numbers) · `SuccessCheck` (self-drawing checkmark for submit-success) ·
`ConfettiBurst` · `SparklesText` · `AnimatedGradientBackground` ·
`ProgressiveFluxLoader` · `WelcomeOverlay` · `ApprovedWelcomeModal` ·
`FirstRunController`

`ApprovedWelcomeModal` fires when a newly approved member returns — the payoff at
the end of [[Flow - Signup and Approval]].

## Auth surfaces

`AuthShell` · `AuthFeaturePanel` — the split-panel login/register chrome.

## Hiring

`OpeningPickerModal` · `OpeningQuestionBuilder` — the latter builds the
`custom_questions` jsonb consumed by the former. No schema validation on either
side; see [[job_openings]].

## Shared helpers

`v6Shared.tsx` — shared bits of the v6 design system in component form.
`uiHelpers.ts`, `emptyJokes.ts` (copy for empty states), `orgFacts.ts` (the
canonical org statistics used across marketing copy and `metaConfig`).

## Hooks (`hooks/`)

| Hook | Purpose |
|---|---|
| `useMeta` | per-route `<title>`, meta, OG tags — see [[SEO and Meta]] |
| `useJsonLd` | structured data |
| `useDialog` | focus trap + a11y; exports `useModalA11y`, `MODAL_FOCUSABLE` |
| `useMobile` | breakpoint detection |
| `useDebounce` | search input |
| `useFeedCardBatch` | batched per-card data (likes, saves, docs) so a feed of 10 cards is not 10× N queries |

## The desk kit

`director/adminKit.tsx` (576 lines) is a **separate** kit for `.admin` surfaces —
`AdminRow`, `StatusStamp`, `BulkActionBar`, `useUndoableAction`, `BottomSheet`,
`AdminSkeleton` and more. Do not use public-side `Card`/`Badge` inside the desk,
or vice versa. See [[HoD Desk Overview]].

## Where to browse them

`/dev/components` (`dev/ComponentGallery.tsx`) — DEV-only, tree-shaken out of
production, gated by `import.meta.env.DEV` in `App.tsx`.

Related: [[Two Design Languages]] · [[Motion and Feedback]] · [[Image Pipeline]]
