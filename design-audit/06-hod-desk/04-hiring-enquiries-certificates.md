# HoD Desk — Hiring Responses, Form Responses, Certificate Requests

**Files:** `director/HiringResponses.tsx` (268 lines), `director/FormResponses.tsx` (326 lines), `director/CertificateRequests.tsx` (176 lines).

## What these desks are

**Intent:** reviewing applications to any team's open roles, reading enquiries/collaboration requests from the public site, and deciding whether to issue a certificate, Letter of Recommendation, or Letter of Volunteering.

## What's genuinely working

**CertificateRequests** states the desk's core integrity principle directly in its own file comment: *"There is no automatic LoR — every decision here is a director's, never a threshold check."* Hours and drive counts shown alongside each request are pulled from the real roster at the moment the member asked, not a typed guess — the comment is explicit about this too. That's the same anti-fabrication discipline seen on `DirectorLanding` and `PostModeration`, applied here to the desk that issues real credentials students use externally (college applications, resumes) — arguably the highest-stakes place in the app for a number or a document to be wrong.

**HiringResponses** aggregates every application to every team's openings into one screen specifically because a director previously had to open each team individually to review hiring org-wide — the same "surface it in one place instead of forcing N page visits" instinct as `FormResponses`' collab+contact aggregation and `CategoryManagement`'s dual pivot.

**FormResponses** caches collaboration/contact submissions with a measured, stated reason (the legacy Supabase project they live in is cross-region, ~450-500ms per query) so a repeat visit paints instantly instead of re-paying that cost, and its status-update path explicitly checks for a **silently-denied RLS write** (`.select('id')` + a zero-row check) rather than trusting a non-error response — a real, specific defense against a false-success toast that several other desks in this audit also independently reached for.

## Findings

No faults found on any of the three. All three correctly keep long-form content (an applicant's message, a request's decision note) behind an expand toggle so the list stays scannable, use per-row busy state so one action never freezes the rest of the queue, and gate bulk actions to the selection rather than the whole list. This trio, together with the moderation queues and the desk shell, forms a genuinely consistent, well-reasoned admin surface — the strongest section of the entire audit.
