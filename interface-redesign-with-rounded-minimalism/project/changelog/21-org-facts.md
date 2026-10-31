# 21 · orgFacts — every public number, computed

**Files touched:** `frontend/src/lib/orgFacts.ts`, a new `scripts/compute-org-facts.mjs`,
`frontend/index.html` (JSON-LD), `frontend/src/lib/metaConfig.ts`, and **every surface that
currently hard-codes a statistic.**
**Prerequisites:** none. **This can be built first, independently of the redesign.**

## Global invariants

1–9 as in `changelog/README.md`. **Two notes specific to this file:**

- **Invariant 3 (no copy changes) still applies.** This file changes where a *number* comes from,
  never the sentence around it. `15,000+ bananas` stays `bananas`.
- **Invariant 5 (no Supabase changes) is honoured** — this file only **reads**, and it reads at
  build time from a script that never ships to the client.

## 21.0 · Why this file exists

`docs/BRAND_VOICE.md` §3 flags six statistics as **NEEDS HUMAN CONFIRMATION**. The worst is the
drives count, which currently ships **four different values on one site**:

| value | where |
|---|---|
| `450+` | `frontend/index.html` JSON-LD `Dataset` |
| `512+` | `lib/metaConfig.ts`, `AboutPage` body, two strategy docs |
| `534+` | `AboutPage` hero, the marquee |
| `550+` | the live `Marquee` component |

**Confirming a number by hand fixes it once and it drifts again.** The instruction here is
different: **derive every public statistic from the database, at build time, into one file.**

**The rule this file establishes:** *no public-facing statistic may be written as a literal in a
component. Ever.* If a number is worth showing, it is worth computing.

## 21.1 · The shape

```js
// frontend/src/lib/orgFacts.ts  — GENERATED. Do not edit by hand.
// Written by scripts/compute-org-facts.mjs. Regenerate, do not patch.
export const ORG_FACTS = {
  generatedAt: '2026-09-05T16:00:00Z',
  drivesWrittenUp:    2031,   // welfare_projects, count(*)
  drivesWithPhoto:    2031,   // welfare_projects where main_image is not null
  membersTotal:       1200,   // members where status = 'approved'
  postsPublished:      586,   // posts where published
  teamsActive:           8,   // teams, count(*)
  schoolsRepresented:   18,   // count(distinct school) on approved members
  foundedOn:  '2021-06-11',   // CONSTANT — not derivable
  darpanReg:  'AAFTT2300ME20251', // CONSTANT
  ageRange:   '14–19',        // CONSTANT
};
```

### Two kinds of fact, and they must not be mixed

1. **Computed** — read from the database. Regenerated on every build.
2. **Constant** — a founding date, a registration number, an age range. **These live in the same
   file but in a clearly separated block**, because they can never be derived and must never be
   "recomputed" to something wrong.

**Every computed fact carries the query that produced it as a comment.** A number with no
provenance is the problem this file exists to solve.

## 21.2 · The script

`scripts/compute-org-facts.mjs`, run in CI before the build:

1. Connect with the **service-role key from the environment**. **Never commit a key**, and this
   script must never ship to the client bundle.
2. Run one `count` query per computed fact. **`head: true`, `count: 'exact'`** — do not fetch rows
   to count them.
3. **Round DOWN to a sensible display figure**, never up. 2,031 → `2,000+`. 1,247 → `1,200+`.
   **Rounding up is the exact behaviour §3 forbids** ("never invent, round up, or 'improve' a
   number"). Rounding down means the real figure always exceeds the claim.
4. Write the file. **Fail the build on error** — a stale `orgFacts` is better than a wrong one, so
   if a query fails, **leave the previous file in place and exit non-zero.** Do not write zeros.
5. **Log a diff.** If a figure moved more than 20% since the last run, print it loudly. That is
   either real growth or a broken query, and both are worth a human's attention.

## 21.3 · What each blocked stat becomes

| blocked stat | resolution |
|---|---|
| **drives / projects** | `ORG_FACTS.drivesWrittenUp`. **Delete `450+`, `512+`, `534+` and `550+` from every file.** |
| **stray dogs fed** | **Not derivable** — there is no table. Either a constant a human sets once, or **it does not ship.** |
| **clothes distributed (kg)** | Same. Not derivable. |
| **Paradox 3.0's year** | Not derivable from the main schema. A constant, or read from `src/paradox/` if it holds a date. |
| **LinkedIn slug** | Not a statistic. **A human confirms the URL once** and it goes in the constants block. |
| **"500+ campaigns"** | **Delete it.** It has no query behind it, and §3 says it reads as inflation next to the projects count. |

**Three of the six are not derivable**, and that is the useful finding: they are claims with no
system of record. **A claim with no system of record either becomes a constant a named human owns,
or it stops being published.** There is no third option that is honest.

## 21.4 · Enforcement

- **The audit script (`AUDIT.md`) greps for bare statistics in components.** A four-digit number
  followed by `+` in a `.tsx` file is a failure.
- **`index.html`'s JSON-LD must be generated too**, or it drifts again — it is the file that
  currently holds the stalest value.
- **`metaConfig.ts` imports from `ORG_FACTS`.** No literals in meta descriptions.

## 21.5 · What this does NOT solve

**Rounding is a display decision and it must be centralised too**, or one surface says `2,000+`
and another says `2,031`. Add one helper:

```js
export const displayCount = (n) => n >= 1000
  ? `${Math.floor(n / 100) * 100 / 1000}`.replace(/\.0$/, '') + 'k+'
  : `${Math.floor(n / 10) * 10}+`;
```

**Decide the format once and use it everywhere.** `2,000+` and `2k+` are both fine; a site using
both is not.

## Verification

1. **No `.tsx` file contains a hard-coded public statistic.** Enforced by the audit script.
2. `ORG_FACTS.generatedAt` is within one build of now.
3. The four drives values appear **nowhere** in the repo.
4. Every computed fact carries its query as a comment.
5. Constants are in a separate, labelled block.
6. A failing query leaves the old file and fails the build. **Test this deliberately.**
7. `index.html`'s JSON-LD is generated, not authored.
8. One rounding helper, used by every surface.

## Unresolved

1. **Does CI exist?** If there is no build pipeline, this becomes a script a human runs and commits
   — still far better than four literals, but say which it is.
2. **Who owns the three non-derivable claims** (dogs, clothes, Paradox's date)? A named person, or
   they stop being published.
3. **`membersTotal`** — is `1,200+` the count of approved members, or of everyone who ever
   registered? These differ, and §3 pairs the figure with "ages 14–19", which implies active
   members.
4. **`drivesWrittenUp` is not the same claim as "drives completed."** 2,031 rows exist; whether
   all 2,031 happened is a different question. **`10` labels this `written up` deliberately.**
   Confirm which claim you want to make.
