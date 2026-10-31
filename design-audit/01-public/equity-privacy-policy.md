# Equity Policy & Privacy Policy — `/equity-policy`, `/privacy-policy`

**Files:** `public/EquityPolicyPage.tsx`, `public/PrivacyPolicyPage.tsx` (shares `EquityPolicyPage.css`, adds `PrivacyPolicyPage.css` for tables).

## What these pages are

**Intent:** a member (or their parent) checking what they've agreed to, or what data the org holds, before or after joining.

## What's genuinely working — worth citing at length

The Privacy Policy is the single most disciplined piece of copy found anywhere in this audit. Its own file comment states the method: written from what the code actually does (Google OAuth fields, the specific analytics scripts loaded in `index.html`/`main.tsx`, the specific event names in `funnel.ts`), not from a boilerplate template — and explicitly leaves two things blank rather than inventing plausible-sounding filler: a named grievance contact, and whether session recording should run for minors at all. The comment names the alternative directly: *"a privacy policy that drifts from the code is worse than none."* That is exactly the standard this whole audit is trying to hold every page to, and here the codebase already holds itself to it. Nothing to fix here except the two gaps the page itself already names, which are the org's calls, not a design defect.

The Equity Policy is reproduced verbatim from an HR source document by design (its comment is explicit: this is governance text members are bound by and a document used in real moderation decisions, not editorial copy to improve) — correctly out of scope for a copy pass.

## Findings

### P1 (safety/privacy, not visual) — Five named HR team members' personal phone numbers are published on an unauthenticated, publicly indexable page
`EquityPolicyPage.tsx`'s `HR_TEAM` array renders five real names next to real personal mobile numbers as `tel:` links, on a page with no auth gate and its own breadcrumb JSON-LD (i.e., intended to be crawled and found). Given the org's own stated membership age range (14–25) and its own Equity Policy's core principles ("Do not share private messages, personal information... without consent," "Direct Messaging: do not text or call another member privately without their prior permission"), publishing individual members' personal numbers to the open internet sits in tension with the values the same document states. This isn't a rendering bug — the `tel:` link implementation itself is good UX — but it's worth a deliberate decision from the org: a shared HR inbox/WhatsApp community link would serve the same "how do I reach HR" intent without exposing personal numbers to anyone who finds the page, indexed or not.

### P2 — No cross-link between the two policy pages from the Equity Policy side
`PrivacyPolicyPage` links to `/equity-policy` at the bottom ("read the equity policy →"), but `EquityPolicyPage` has no reciprocal link to the Privacy Policy. A member reading about conduct expectations who wonders "what do they actually do with my data" has no signposted path there.
