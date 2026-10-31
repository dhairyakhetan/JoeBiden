# Support — `/support`

**File:** `public/SupportPage.tsx` (91 lines, no dedicated CSS file — shared classes + inline styles only).

## What this page is

**Intent:** a visitor who wants to help the org, arriving with an unstated assumption that "support" probably means money.

## Current design

A hero, four equal cards ("join as a volunteer," "buy from Crftd," "collaborate," "spread the word" — each colour-coded, numbered, with its own CTA), and a closing note explaining AquaTerra takes no monetary donations and is self-funded.

**Working well:** each card's CTA correctly distinguishes internal navigation (`→`) from an external link (`↗` on the Instagram card, with `target="_blank" rel="noopener noreferrer"`) — a small, consistent affordance convention that tells the user what kind of action they're about to take before they take it.

## Intent-driven affordance audit

### P1 — The page's single most important clarification ("we don't take money") is the very last thing on the page
A visitor arriving at a page titled "support the work" is very likely carrying the assumption that support means a donation. The page spends its entire first screen and four cards on alternative ways to help *without stating that money isn't one of the options* — that fact only appears in a note below all four cards. Someone who reads card 1 ("join as a volunteer") and leaves satisfied, or who bounces before scrolling to the note, still doesn't know AquaTerra doesn't take donations. Move the no-donations clarification (or a compressed one-line version of it) into the hero, right under the subhead — it resets the visitor's primary assumption *before* they read the options, instead of correcting it after.
