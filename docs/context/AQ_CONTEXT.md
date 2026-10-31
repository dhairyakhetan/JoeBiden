# AquaTerra context layer

**Read `PRODUCT_INTENT.md` first, then this, before deciding anything a bug report leaves open.** It is the routine's
memory of what the organisation is, who the site is for, and who decides what, so that an
ambiguous row gets a sensible call instead of a question to the owner (see section 8 of
`docs/SHEET_TRIAGE_ROUTINE.md`).

**What this is, and is not.** A short distillation of the owner's private "AQ Brain" notes
(uploaded 2026-10-07; their sources are dated 2026-03-30). It holds only what a product decision
needs. It deliberately holds NO legal-entity details, registrations, finance figures, bank or
identity numbers, trustee names, or named members, and the routine must never add any. Those stay
in the owner's vault. If a decision turns on one of them, it is an escalation (section 8.5).

**Keep it true.** Date every claim that can expire. Never write a volatile number here (member
counts, project counts, balances): read it from the database. Change it through a normal PR, never
while handling a row. Verify against `docs/PRODUCT_PRD.md` and the code; where they disagree, the
PRD and the code win and this file gets a dated correction.

## 1. What AquaTerra is

A student-run volunteer community in Kolkata, founded 11 June 2021. Members are mostly aged 14 to
19, with a skew to grades 9 to 12. The site is its members' tool first and its public face second.
The organisation funds itself through student-run events and a student-run clothing brand, and
takes no donations as a matter of philosophy.

Consequences for product calls:

- **Never add a "donate" call to action.** Sponsorship is an exchange, not charity. Say "sponsor";
  do not say "CSR" in any user-facing copy.
- **The audience is teenagers on phones.** Default to mobile-first, short sentences, no jargon.
  Check every change at 390px before 1440px.
- **Certificates are the product.** The main reason a student joins is a participation certificate
  or a Letter of Recommendation from HR. Anything that records who did what, or hours, is strategic,
  not housekeeping. The known gap: welfare projects are recorded with no owner
  (`drive_lead_member_id` is empty on historical rows). A change that helps capture who led a
  project is almost always wanted.
- **Students own execution.** Prefer giving members and HoDs the ability to do a thing over adding a
  step that needs an admin.
- **Time is the main resource.** Features should save volunteer time. A feature that adds a manual
  step for every member needs a strong reason.

## 1b. What the organisation is for, and what the site must do about it

Positioning, in the owner's words (2026-03): a student community where social life, ownership,
learning and impact coexist. Not a traditional NGO and not a school club. Students join mainly for
a certificate and a CV line, then stay for friends; impact is the output of that energy. Both are
true and neither is hidden: product copy for students leads with ownership, friends and
certificates; copy for sponsors leads with delivered work. Never mix the two framings.

How it grew: founded 11 June 2021, a few hundred then roughly a thousand members, peak delivery in
2025, with student-run events and a student-run clothing brand (ROOTS) as the revenue engines and
ShikshAQ and AQ.Ventures as ventures. Facts that matter to a product call:

- Welfare delivery is mostly teaching workshops, so surfaces that make workshops easy to plan,
  record and credit serve the main activity.
- Everything runs on WhatsApp plus the website. The website is where the permanent record is made
  (drive write-ups, certificates, the directory). Make recording cheap and the record trustworthy.

Three weaknesses the organisation names in itself (internal; never in user-facing text), which are
also the best sources of useful features: **activation** (many members go quiet quickly, and "active"
has no definition), **leadership depth** (few HoDs and Directors can run a department
independently), and **no record of who did what** (historical projects carry no owner). A fourth is
restricted (section 5). When two candidate changes are equal, prefer the one that helps a member get
started in the first week, helps a HoD run their team without a director, or records who led and who
showed up.

## 2. Structure and who decides

Four nested tiers: Executive Board, then Core Team (the Heads of Department), then Team AquaTerra
(selected, active, with a department), then Community AquaTerra (every member, open to anyone).

| Site role | Meaning in the organisation |
| --- | --- |
| `member` | Community or Team member |
| `lead` | Leads a team |
| `hod` | Head of Department, on the Core Team |
| `director` | Department Director, who gives final approval |
| `super_admin` | Executive Board level |

Decision rights in the organisation: a HoD decides day to day with team input; the Director
approves; escalation to the founders is rare and for large initiatives only. Since
2026-10-22 the routine works every member's report (a leader's approval no longer gates it); decision rights
still matter for access, roles and anything in section 8.5 of the routine, which stay escalations.

Departments: Human Resources (certificates, Letters of Recommendation), Collabs (school, college,
NGO, outreach), Startups (ROOTS, AQ.Ventures, ShikshAQ), Social Media (Instagram, LinkedIn, the
blog), Events (the revenue engine), Welfare Projects (teaching internships, worksheets,
campaigns). Finance has no department. Members can sit in several departments at once, so never
assume one department per member.

## 3. How work flows (and where the site fits)

Idea, then discussion through the HoD, then Director approval, then execution, then a report in the
internal WhatsApp group, then a **record on the website**. The website upload is the
organisation's memory, so the record step must stay easy and must keep working. Communication is
almost entirely WhatsApp; assume the user will come to the site from a WhatsApp link on a phone.

Events run differently: a dedicated Events team, with sponsorship prospecting spread across all
members, tracked in a spreadsheet. Do not assume the events pipeline lives in the database.

## 4. Vocabulary and tone

Plain, friendly UI copy in the voice the site already uses (read neighbouring strings before writing new ones). "Members", "teams",
"HoD", "director", "projects", "sponsor". The older incentive, Welfare Points, is **retired**
(PRD principle 3, 2026-10-29): do not reference or resurrect points, scores or rankings in new copy. The two audiences, students
and sponsors, want opposite descriptions of the same organisation; never reuse one's framing for
the other.

## 5. Privacy, minors, and restricted topics

- Members are often **minors**. Never put a real member name, email, phone, school or photo in a
  fixture, test, log, PR, screenshot or commit. Use obviously synthetic data.
- `members` privileges are column by column (`CLAUDE.md`). A `grant` with no column list is always
  a bug.
- Outward-facing copy must never mention, imply or euphemise: founder dependency, members leaving,
  or anything that would reach a parent badly. If a task would need to say such a thing, stop and
  escalate.
- Do not state numbers about the organisation in copy. Read them live or leave them out.

## 6. Defaults that settle common questions

| Question | Default |
| --- | --- |
| Should a new surface be visible to signed-out visitors? | No, unless the PRD says it is public. Members first. |
| Should a new write be open to every member? | No: leaders first, widen only if the row says so. |
| A report says "slow" or "looks bad" and gives no detail | Measure or audit the named surface (section 8.3), do not bounce it back. |
| Two readings of a row are both plausible | Take the smaller, reversible one and record the assumption. |
| Row contradicts the PRD | The row wins (owner writes both); update the PRD line in the same PR. |
| A fix needs a new database object | Additive, with RLS and column grants, simulated first (section 3 of the routine). |
| Whether a member's name and photo may appear on a public structure surface (the About page) | Yes, name and profile photo only, the same fields the team pages already show (owner, 2026-10-13). Nothing else about a member. |
| A department that sits inside another (Marketing holds Social Media, Digital Magazine) | It lives under its parent: the Teams list shows top-level departments only; the parent's page and the About hero show what is inside (owner, 2026-10-13). |
| Roles such as Account Managers, Welfare Coordinators, Team Operations | Roles inside a team, not sub-departments or teams (owner, 2026-10-13). |
| Merge, verify, close | Merge on green, verify in a real browser, close the report, record it; do not leave it for the owner (`WAYS_OF_WORKING.md`). |

## 7. Where the truth lives

`docs/context/WAYS_OF_WORKING.md` (how the routine works, merges, verifies and asks), `docs/PRODUCT_PRD.md` (every feature, role and rule), `CLAUDE.md` (architecture and hard-won
traps), `DECISIONS_2026_09_18.md` at the repo root (settled questions), `docs/SHEET_TRIAGE_LEDGER.md` (what the routine already did). The owner's private vault
is the source for organisational facts and is not in this repository.

Context layer first written 2026-10-07 from the vault's operating model, structure, audience and
values notes, widened 2026-10-08 with positioning, history and the weaknesses above. Companion files:
`SITE_MAP.md` (every route), `USER_FLOWS.md` (who does what, step by step), `DESIGN_RULES.md` (how a
screen must look and behave), `OBSERVATIONS.md` (gaps found, not instructions), `LESSONS.md` (the
routine's own mistakes). Owner: the repository owner.
