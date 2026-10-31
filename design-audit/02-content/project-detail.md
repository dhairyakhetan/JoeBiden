# Project Detail — `/projects/:slug`

**File:** `public/PublicProjectDetailPage.tsx` (644 lines), `PublicProjectDetailPage.css`.

## What this page is

**Intent:** someone who clicked into a specific drive (from the directory, a share link, or search) wanting the full story, photos, and a path to get involved themselves.

## Current design

A sticky auto-playing image carousel (pausable, with thumbnails) alongside a scrolling info column (stat rail, summary, partner/photo links, long writeup), a quiet contextual bridge line into `/volunteer`, an 8-tile "similar projects" grid, and a closing CTA.

**Working well, and some of the most careful engineering in the audit:** the related-projects grid is trimmed to a full-row multiple of the *actually rendered* column count (measured via `ResizeObserver`, not assumed), so the last row never hangs with an uneven gap. The two-stage related-content query (exact objective match, case-insensitively — the comment notes real casing drift like "Workshop" vs. "workshop" was silently splitting matches — then backfilled with recent projects if the exact-match pool is too thin) is a thoughtful compromise between relevance and never showing an anemic 1-2-card section. The carousel data memoization is keyed to primitive fields specifically to stop the poster-studio modal from appearing to "refresh itself" on unrelated re-renders — and the comment correctly identifies this had to be hoisted above the loading/notFound early returns to avoid a real conditional-hook crash. This is exemplary defensive React engineering, not just decoration.

## Findings

Nothing rises to a P0/P1 intent-affordance fault on this page — the "quiet bridge" line to `/volunteer`, the stat-rail linking `volunteers →` to `/members`, and the closing dual CTA (join / browse more) all correctly route the reader's likely next intents. One thing worth independent verification, carried from the Projects Directory audit: this page's own comment documents a past global `v6.css` override that silently flattened `.cat-events`/`.cat-labs`/`.cat-ops` to sky and `.cat-welfare`/`.cat-content` to mint, and works around it with an inline style rather than the `.chip.cat-*` classes. A direct search of the current stylesheets didn't turn up that specific rule, so it may already be resolved — but since the workaround is still here, it likely wasn't confirmed safe to remove. Worth a dedicated pass to confirm no `.cat-*`-only (non-inline-styled) category chip elsewhere in the app is quietly showing the wrong hue.
