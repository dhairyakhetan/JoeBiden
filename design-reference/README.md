# CODING AGENTS: READ THIS FIRST

> **Repo-specific status note (added when these files were committed to `kaxx4/vercelaq`):**
> This bundle was originally supplied as a chat upload, not a repo file — Prompt 1's
> Phase 9 correctly found it missing and refused to guess at a redesign. It was
> provided mid-session afterward, read in full (including `support.js`/`image-slot.js`,
> confirmed to be design-tool runtime plumbing with no product-relevant logic — safe to
> skip when reimplementing), and used to drive a systematic token/component pass across
> all 38 screens plus one net-new page (`RootsPage.tsx`), landed on `main` as four
> commits ("Design pass 1–4"). These files are committed here so that gate never
> produces a false "missing" result again, and so the real source of truth for design
> tokens/components/motion lives in version control instead of an ephemeral upload.
> `AquaTerra Homepage - Review.dc.html` is a third file included in the original bundle
> that had not yet been read as of the last progress-file update — flagged for a future
> pass, not yet factored into the live implementation.



This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## What you should do — IMPORTANT

**Read `design-consistency-and-engagement-review/project/AquaTerra - Playground.dc.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `design-consistency-and-engagement-review/README.md` — this file
- `design-consistency-and-engagement-review/project/` — the `Design consistency and engagement review` project files (HTML prototypes, assets, components)
