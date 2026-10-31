# Crftd (Roots) — `/crftd`

**File:** `public/RootsPage.tsx` (245 lines, no dedicated CSS).

## What this page is

**Intent:** someone interested in buying AquaTerra's streetwear line, or evaluating whether "profits fund welfare work" is a real, credible business model.

## Current design

A grape-hued hero with headline stats (₹4L+ raised, 3 drops shipped, 100% profit→mission), a "the drops" product grid with real prices and stock status, "how it works," a lookbook, a cost breakdown + size guide, a drop calendar, and a closing collab CTA. A file-level comment explains the design intent clearly: there's no in-app commerce backend, so — deliberately — the page should route interest to a collab CTA rather than fake a cart/checkout.

## Intent-driven affordance audit

### P0 — Product cards present real prices and an "in-stock" status, then structurally block the one action that status implies
Two of the three drops are marked `status: 'in-stock'` and shown with a price (₹1,299, ₹549) and a `btn-primary`-styled button reading "shop soon" — but that button carries `disabled` and `cursor: not-allowed` unconditionally. A visitor reading "Kolkata Hoodie · in stock · ₹1,299" next to a primary-colored button will read it as a live product they can buy right now; clicking does nothing, with no tooltip, no waitlist, no explanation. The page's own file comment states the *intent* correctly (avoid a fake checkout) — but the rendered result still looks fully transactional (real price, "in-stock" language, primary-button styling) with only the click silently switched off. That's the affordance-audit failure mode exactly: the visual promise ("buy this") has no path behind it, and nothing on the card tells the visitor why. Either soften the presentation until there's a real path to transact (drop the "in-stock" label and price prominence, or relabel clearly as "coming soon" / "notify me on Instagram"), or wire the button to whatever real channel exists today (DM, waitlist form) instead of a dead disabled state.

### P1 — Cost breakdown and size guide build purchase-consideration confidence for a purchase that can't happen yet
Both sections answer real pre-purchase questions ("which size fits," "is this price fair") — useful once there's a way to buy, but currently sitting right below a dead-end CTA. Not wrong to keep them ready, but worth sequencing after a real purchase path exists rather than before it, so the page isn't building confidence toward an action it then can't deliver.

### P2 — "shipping now" status on the drop calendar implies an active, joinable order pipeline
Drops 02 and 03 show `status: 'live'` with the note "shipping now" — language that reads as an ongoing sale a new visitor could still join, when (given the disabled buy buttons above) these appear to be already-executed physical distribution rounds. Consider "sold this round" / "next round: TBA" phrasing to avoid implying a sale the visitor can enter.
