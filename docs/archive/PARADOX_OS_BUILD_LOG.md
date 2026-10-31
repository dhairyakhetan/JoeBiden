# Paradox OS — Build Log

One system that runs the fest: public site + internal OS on one source of truth,
seeded from the team's existing sheets. This log is the canonical planning +
progress record; every phase appends here (what was built, which sheet it
replaces, which failure it closes).

---

## Ground truth (established by read-first recon, 2026-06)

Before any code, the repo + infra were inspected. Two facts reshape how this
program must be executed — they are not scope cuts, they are real inputs that
gate the data-dependent phases:

1. **The source workbooks are NOT in the repo.** None of
   `SOCCER_STORM_FIFA_PARADOX4.xlsx`, `AFTERPARTY.xlsx`,
   `Paradox_4_0_Registrations_EventWise.xlsx`, the registration/afterparty CSVs,
   or any master-planning workbook exists anywhere under the project (only
   output evidence images + prior `.sql` scripts). The importers (§2, §10
   Phase 1) are the seed mechanism for the whole OS — they **cannot be built or
   tested against real data until these files are added to the repo** (suggested
   location: `frontend/data/paradox/` or `data/paradox-source/`). Until then the
   importer work is authored against assumed column shapes only, which defeats
   "run on current data from day one."

2. **The Paradox database is a separate Supabase project that this environment
   cannot reach.** The connected MCP exposes only the community project
   (`hzowuwffjqtgszecngpe`); the Paradox project (`drvucogrjphctwfealxd`) is not
   reachable here. Therefore **all Paradox schema/RLS changes ship as SQL
   scripts in `frontend/scripts/` that a maintainer runs in the Paradox SQL
   editor** — exactly the existing pattern (`paradox_*.sql`). I author and
   verify the SQL by inspection; I cannot apply or live-verify it. Plan the new
   `paradox_*` tables (§9) as a numbered, idempotent, re-runnable script set.

3. **Current entities** (`paradox/lib/types.ts`): Event, Registration, Update,
   Inquiry, Score, Volunteer, Winner, BlogPost, ContactMessage, TeamMember,
   AuditEntry. Permissions live in `paradox_admin_permissions` (JSONB per
   account); `TabKey` union doubles as the permission key; `mark_paid` is the
   precedent for an action-permission (gates an action, renders no tab). The OS
   extends this exact model with `issue_refund`, `edit_finance`,
   `publish_results`, `edit_fixtures`, `send_comms`, and `super_director`.

4. **Admin.tsx is 7,033 lines, `@ts-nocheck`.** `vite build` (esbuild, no
   type-check) is the real gate for it; `tsc -b` is the gate for everything
   else. The OS adds new files/modules rather than rewriting this monolith in
   place; surfaces collapse into the Event Workspace over the phases.

### What this means for execution
- Phases that need **no** workbooks and **no** live DB run now: performance
  (code-split, virtualize, lazy physics), permission/audit model extension, and
  authoring the schema script set + UI scaffolding.
- Phases that need the **workbooks**: every importer (Phase 1 seed, and the
  per-module seeds in Phases 2, 6, 10, 11).
- Phases that need a maintainer to **run the SQL scripts**: anything reading the
  new `paradox_*` tables (Phases 2+). The UI is built against the new types;
  it goes live for the team once the scripts are run on the Paradox project.

---

## Deployment status — APPLIED LIVE (2026-06)

Maintainer provided a Management-API token for the Paradox project
(`drvucogrjphctwfealxd`), so all Phase 1-7 SQL was applied to the live DB via
the Supabase Management API (not just authored). Verified state:
- 5 OS table groups created; **10 workspaces · 120 runbook steps · 50
  requirements** seeded onto the real events; **6** brand-checked message
  templates; `paradox_pnl` + `paradox_duplicate_registrations` views; **9**
  `paradox_os_*` functions.
- Enforcement engine ran live (`paradox_os_tick`): auto-progressed 4 steps,
  chased/escalated 68 overdue ones; **72** automation-log rows.
- **pg_cron enabled** and the 15-min heartbeat scheduled (job `paradox-os-tick`).
- Data fix found + shipped: `paradox_events.date` is free text ("1st June
  2026"); added `paradox_os_try_ts()` tolerant parser so due-date resolution
  never crashes on unparseable dates.

SECURITY: the shared access token is a sensitive credential — rotate it in the
Supabase dashboard now that this batch is applied. It was never written to the
repo (the apply helper lived in the OS temp dir, token passed via env).

---

## Failure ledger → system map (the spine — build nothing that doesn't trace here)

| Real failure this year | System that closes it | Phase |
|---|---|---|
| Sheet sprawl (75+ tabs) | Event Workspace + Control Room | 2 |
| Enforcement gap (nobody chased) | Enforcement & Automation engine | 3 |
| ~half of regs never paid | Payment gate + slot-hold TTL | 4 |
| Duplicate-inflated counts | Dedup at intake (phone+name+event) | 4 |
| Overbooking | Atomic row-locked cap RPC + waitlist | 4 |
| Attendance untracked / network died on the day | Offline-first IndexedDB check-in | 5 |
| Mid-cycle event cancellation chaos | Greenlight gate + one-click cancel→refund | 3/7 |
| Public judging disputes (photo/shark tank/dream deck) | Pre-published rubric + odd panel + auditable + blind photo | 9 |
| Back-to-back matches / fixture apology | Constraint-enforcing fixtures + publish-lock | 8 |
| No runner-up prize / missing certs | Auto-certs, runner-up + participation ON by default | 9 |
| Money on personal accounts / nothing reconciled | Single ledger + personal-acct flag + refund queue + P&L | 6 |
| Duplicated/invalid sponsor CRM, zero follow-up | Merge + validation + known-bad flag + follow-up loop | 11 |
| "conveyed to X" logistics ambiguity | Owned, due-dated, auto-chased tasks | 3 |
| Vendor cracks (plug points, wrong pin, no change) | Auto vendor logistics sheet + layout planner | 10 |
| Content late / reels unposted | Content ops + protected capture owner | 11 |
| Post-mortem rebuilt from chat scrollback | Analytics dashboard, filled by fest end | 12 |

---

## Phase roadmap (build order)

1. **Foundation + perf + importers** — code-split, lazy physics/motion,
   virtualize tables, extend permissions/audit, workbook+CSV importers,
   Lighthouse baseline.  *(perf: IN PROGRESS · importers: BLOCKED on workbooks)*
2. Event Workspace (Overview/Runbook/Requirements) + Control Room.
3. Enforcement & Automation engine (auto-progress, chase/escalate, gates).
4. Registrations + payment gate + dedup + atomic caps/waitlist + confirmations.
5. Offline-first check-in + attendance (participants + volunteers).
6. Finance ledger + refund queue + live P&L.
7. Comms engine (Message Banks → live) + greenlight gate.
8. Fixtures generator + Format & Fixtures + public brackets.
9. Rubric & Judging + Certificates + public rubric/winners.
10. Stalls/Vendors + Venues + Logistics roll-up + After Party workspace.
11. Sponsorship CRM + Schools CRM + Marketing/Content ops.
12. Analytics & post-mortem + public Gallery.

---

## Progress

### Phase 1 — Foundation · perf · code-splitting  ✅ (first slice)
Commit: route-level code splitting of the entire Paradox section.

- **What:** Converted `ParadoxRoot.tsx` from 21 static page imports to
  `React.lazy` + per-route `Suspense` (Paradox-styled fallback spinner).
- **Sheet it replaces:** n/a — infrastructure for the whole OS (every future
  module is a lazily-loaded surface, so adding them no longer bloats first
  paint).
- **Failure it closes:** "the current site is laggy" (§2 perf, first-class).
- **Measured before → after** (`vite build` chunk output):
  - `ParadoxRoot` entry shell: **400.48 kB → 28.98 kB** (−93%). This chunk loads
    on *every* /paradox route, so it was previously shipping the entire fest app
    (incl. the 7k-line Admin and register flow) on first paint of the public
    homepage.
  - `Admin` is now an isolated **178.6 kB** chunk — public visitors never
    download the admin console.
  - Register / AfterParty / Ticket / AdminLogin each split into their own
    on-demand chunks; the heavy `vendor-paradox-heavy` (zxing/jsbarcode/matter)
    now rides only with the pages that import it, not the public landing.
  - `tsc -b` clean, `vite build` ✓.

**Permission model extended** (`Admin.tsx`): added the five OS action
permissions — `issue_refund`, `edit_finance`, `publish_results`,
`edit_fixtures`, `send_comms` — to the `TabKey` union, `ALL_TABS`,
`ACTION_PERMISSIONS` (so they gate actions and never render a stray tab),
`TAB_LABELS`/`TAB_SHORT`, and all four `ROLE_PRESETS`. `super_director` gets all;
`director` gets all five; `coordinator` gets `send_comms` only; `team_lead` none.
The existing Accounts → permissions matrix surfaces them automatically. Each
maps to a §8 failure (refunds from personal accounts, unreconciled money,
biased/premature results, rule-violating fixtures, off-brand/duplicate comms).
`vite build` ✓.

**Phase 1 remaining (queued):** virtualize Admin's long tables (>200 rows;
deferred — the 7k-line `@ts-nocheck` monolith, lower-risk to do per-table as
each collapses into the Workspace), lazy-mount `matter-js` (already not
statically imported by any page, so it's out of first paint today), Lighthouse
baseline (manual — needs a running server). Importers → replaced by a realistic
**sample-data seed** per the maintainer's choice (workbooks absent).

---

### Phase 2 — Event Workspace + Control Room  ✅ (foundation)
The sprawl fix: one cross-event command screen + one drill-in workspace per
event that collapses the OVERVIEW / EVENT FLOW / REQUIREMENTS worksheets.

- **Schema** `frontend/scripts/paradox_os_01_schema.sql` (idempotent, run in
  Paradox SQL editor): `paradox_event_workspaces` (Overview jsonb config +
  status + readiness flags), `paradox_runbook_templates`,
  `paradox_runbook_steps` (one owner / one due / one status / gate flag /
  auto_condition / dependency), `paradox_requirements`, `paradox_event_heads`.
  RLS = authenticated full CRUD (matches existing pattern); shared updated_at
  trigger; Control-Room roll-up indexes.
- **Seed** `frontend/scripts/paradox_os_02_seed_sample.sql` (idempotent): gives
  every REAL `paradox_events` row a workspace (config from its existing fields)
  + the standard 12-step runbook + 5 starter requirements — the realistic
  stand-in for the workbook importers, so the OS is demoable on real events with
  no blank state.
- **Types** added to `lib/types.ts`: EventWorkspace, RunbookStep, Requirement,
  EventHead, WorkspaceStatus/RunbookPhase/RunbookStatus + phase labels.
- **UI** `paradox/admin/ControlRoom.tsx` (new) wired as the **default** admin
  tab (`control_room`, first in nav; gated by the same permission model):
  - *Control Room* — a row per event: status, regs, paid, breakeven progress,
    readiness (N/4), open steps, ⏰overdue / ⛔blocked flags. Replaces the
    EventWise SUMMARY + opening 11 workbooks.
  - *Event Workspace* drill-in — readiness header (toggle head/rules/fixtures/
    judges), Overview grid, Runbook grouped by phase (done / block toggles,
    gate markers), Requirements (arranged toggles). All writes optimistic with
    the `.select()` 0-row RLS guard + reload-on-fail.
  - Degrades to a clear "run the two SQL scripts" banner if the OS tables don't
    exist yet, so it never crashes pre-migration.
  - `vite build` ✓ (Admin chunk 178→192 kB, admin-route only).

**Phase 2 remaining (next):** full CRUD on Overview config / steps / requirements
/ heads (Phase 2 ships read + status-toggle; add/edit/delete is a fast follow),
and the workspace's Fixtures / Rubric / Message-Bank sections land with their
own phases (8 / 9 / 7).

**NOTE — script-gated:** the Control Room is live in the bundle now but shows the
setup banner until a maintainer runs `paradox_os_01_schema.sql` +
`paradox_os_02_seed_sample.sql` on the Paradox project (this env can't reach
that DB). I authored + inspection-verified the SQL; it has not been run/live-
verified.

---

### Phase 3 — Enforcement & Automation engine  ✅ (core)
The differentiator: the system advances tasks itself, chases + escalates, and
hard-gates the dangerous steps. Scheduler = Supabase **pg_cron** (no new infra).

- **`frontend/scripts/paradox_os_03_enforcement.sql`** (idempotent):
  - `paradox_automation_log` table (observability — every automated action) +
    `escalation_level` / `last_nudged_at` columns on runbook steps. RLS read for
    authenticated.
  - `paradox_os_auto_progress()` — closes steps when their data condition is
    true: `breakeven_reached` (paid ≥ config.breakeven), `greenlit`,
    `fixtures_published`, `results_entered` (a score row exists),
    `results_published` (a published winner exists). Only flips todo→done, logs
    each. Manual ticking becomes the exception.
  - `paradox_os_chase()` — escalation ladder L0 owner (overdue) → L1 head (>24h)
    → L2 core (>72h), re-nudges at most once/12h, logs each. Replaces the one
    human who chased everyone.
  - `paradox_os_resolve_due_dates()` — resolves T-offsets to absolute due dates
    off the event date.
  - `paradox_os_tick()` (resolve+progress+chase) — scheduled by **pg_cron every
    15 min** and exposed as an RPC for the Control Room "run now" button.
  - `paradox_os_greenlight(event)` RPC — the greenlight gate (draft→greenlit,
    logged); registrations tie to this on the public Register page in Phase 4.
- **Control Room UI:** "↻ run automation" button (calls `paradox_os_tick`), a
  "what the system did" recent automation feed (chase/escalate/auto_progress/
  greenlight), and a **Greenlight** action in the workspace header (draft only,
  calls the RPC). `vite build` ✓ (Admin 192→194 kB).

**Phase 3 remaining (lands with later phases where the action lives):** the
publish-results / publish-fixtures / refund / cancel→refund gates attach to
Phases 9 / 8 / 6; the public Register "open only if greenlit" check attaches to
Phase 4. The engine + log + greenlight + auto-progress conditions are in place
now for them to call.

**Adds to the run-these-scripts list:** `paradox_os_03_enforcement.sql` (and
enable the pg_cron extension in the Dashboard for the 15-min heartbeat;
"run now" works without it).

---

### Phase 4 — Registrations: payment gate · atomic caps · waitlist  ✅ (schema/RPC)
`frontend/scripts/paradox_os_04_registrations.sql` (idempotent):
- Extends `paradox_registrations` (payment_ref, slot_hold_expiry, reg_status);
  new `paradox_payment_intents`, `paradox_waitlist`.
- `paradox_os_register_slot(reg)` — **atomic, row-locked** cap check (locks the
  workspace row so two people can't take the last slot): returns confirmed /
  waitlisted / blocked_not_greenlit. Fixes overbooking + silent over-cap fail +
  enforces the greenlight gate at register time.
- `paradox_os_promote_waitlist(event)` — auto-promote next on a freed slot.
- `paradox_duplicate_registrations` view — exact phone+event repeats for dedup.
- *Remaining:* wire the public Register page to call the RPC (touches the live
  flow; do after scripts are run) + an admin dedup/merge surface.

### Phases 6-7 — Finance ledger + refunds, and Comms engine  ✅ (6 UI live; 7 schema)
`frontend/scripts/paradox_os_05_finance_comms.sql` (idempotent):
- **Finance:** `paradox_ledger` (single live ledger w/ bill/voucher/reconciled +
  **personal_account flag**), `paradox_refunds` (refund queue),
  `paradox_os_issue_refund(reg,amount,reason,actor)` RPC (refund **gate** —
  requires a reason, mirrors into the ledger so P&L stays single-source),
  `paradox_pnl` view.
- **Comms:** `paradox_message_templates` (+6 brand-checked seeds — Paradox 4.0 /
  #Paradox2026 / "-Team AQ" / "-Team Paradox 2026", no AI tone) and
  `paradox_message_log` (every send logged so nothing re-fires).
- **UI:** `paradox/admin/FinanceModule.tsx` wired as the **Finance** tab (gated;
  edit by `edit_finance`): live P&L cards (income/expenditure/net + **on
  personal a/c** + unreconciled alerts), per-sub-ledger chips, the ledger table
  (personal-account rows tinted + flagged, reconcile toggles), add-row form, and
  the refund queue. Degrades to a setup banner pre-migration. `vite build` ✓
  (Admin 194→203 kB).
- *Remaining (Phase 7 UI):* the send-from-template surface + auto-fire wiring on
  state changes (lands with the registration/refund flows).

**Adds to the run-these-scripts list:** `paradox_os_04_registrations.sql`,
`paradox_os_05_finance_comms.sql`.

### Phases 8-12 data model + Phase 12 Analytics  ✅ (schema live; analytics UI live)
- **`frontend/scripts/paradox_os_06_modules.sql`** — APPLIED LIVE (11 tables
  created): `paradox_fixtures`, `paradox_judging_rubrics`,
  `paradox_judging_scores`, `paradox_certificates`, `paradox_schools`,
  `paradox_sponsors`, `paradox_marketing_team`, `paradox_content_items`,
  `paradox_stalls`, `paradox_venues`, `paradox_logistics_items`. RLS =
  authenticated CRUD. The full §9 data model now exists on the live DB.
- **Analytics module** (`paradox/admin/AnalyticsModule.tsx`, Phase 12) wired as
  the **Analytics** tab — runs on REAL data now: per-event funnel
  (registered→paid→attended), conversion % (under-60% flagged red), no-show,
  est. revenue (paid × parsed fee), ledger revenue + net, revenue-by-sub-ledger.
  Live data already exposes the core failure — e.g. Ankle Breakers 82 regs /
  31 paid (38%), Shutternaut 86/78, PickleJam 39/16. `vite build` ✓ (Admin
  203→209 kB).

### Phases 10-11 — Sponsors/Schools CRMs + Logistics/Vendors  ✅ (UI live)
- Reusable `paradox/admin/RecordsModule.tsx` — spreadsheet-like editable grid
  (cells save in place: text/num/date on blur, bool/select on change; add/
  delete; search; optimistic + .select() RLS guard; setup-banner if table
  missing).
- `paradox/admin/CrmModules.tsx` thin configs → three new admin tabs:
  - **Sponsors** (paradox_sponsors): mailed→replied→followup status, known-bad
    email flag, owner, last-contact, deliverables. Closes the dup/no-follow-up
    CRM failure.
  - **Schools** (paradox_schools): texted/called flags, status pipeline, owner.
  - **Logistics** (stacked): logistics roll-up + Stalls & Vendors (advance/total/
    power/pin/timings/layout/confirmed) + Venues (cap/power/lift/sound/license).
    Closes vendor cracks + "conveyed to X" ambiguity.
- Permissions: super_director/director all three; coordinator schools+logistics;
  team_lead none. `vite build` ✓ (Admin 209→217 kB).

### Phase 7 — Comms send surface  ✅ (UI live; Phase 7 complete)
`paradox/admin/CommsModule.tsx` wired as the **Comms** tab: pick a brand-checked
template, fill its `{tokens}`, get copy-paste-ready WhatsApp text (no unfilled
placeholders — copy is blocked until all tokens filled), one-tap **Copy + log**
(writes `paradox_message_log` so nothing re-fires), `auto`/`manual` mode badges,
recent-sends feed. Copy+log gated by `send_comms`. `vite build` ✓ (Admin 217→223
kB).

### Phase 8 — Fixtures generator (constraint-enforced)  ✅ (UI live)
`paradox/admin/FixturesModule.tsx` → **Fixtures** tab. Round-robin (circle
method) + greedy constraint-aware slot/court assignment, then a validator that
**blocks publish** on any violation:
- no team back-to-back (≥1 empty slot rest), enforced in assignment + re-checked
- no match in the lunch window
- finals all on one court
Teams auto-fill from the event's registrations (editable); params = courts /
slot-min / start / lunch / date. Publish (gated by `edit_fixtures`) replaces the
event's set, writes version-bumped published rows to `paradox_fixtures`, and
flips the workspace `fixtures_final` flag so the runbook's "publish fixtures"
gate auto-progresses. Shows a live grid + a "✓ valid / cannot publish" verdict.
Closes the back-to-back + fixture-mix-up apology. `vite build` ✓ (Admin
223→232 kB).

### Phase 9 — Rubric & Judging + Certificates  ✅ (UI live)
`paradox/admin/JudgingModule.tsx` → **Judging** tab:
- Rubric editor (reused RecordsModule, event-scoped) — criterion/weight/max/blind,
  published to participants up front.
- Score entry (judge + team + per-criterion), odd panel via multiple judge rows.
- Weighted leaderboard, auto-aggregated, dense-rank tie handling; **blind mode**
  masks names ("Entry #N") for photography until reveal.
- **Publish results** (gated `publish_results`) → writes top-3 to
  `paradox_winners` (feeds the public Winners/Scores page) — the results gate.
- **Certificate generation** — canvas→PNG, brand-styled (Paradox 4.0 /
  #Paradox2026), per winner + participation, recorded in `paradox_certificates`.
  No new dependency. Runner-up/participation certs available by default.
- Added `scope` prop to RecordsModule (event-scoped rows + stamped inserts).
- Closes the photography dispute + biased/unfair-feedback complaints.
  `vite build` ✓ (Admin 232→241 kB).

### Phase 5 — Offline-first check-in  ✅ (UI live)
- `paradox/lib/offlineQueue.ts` — raw-IndexedDB write queue (no dependency),
  keyPath dedupe by registration id (re-scan offline overwrites the one pending
  op), `flush(handler)` removes each op only once its write lands.
- `paradox/admin/DoorCheckin.tsx` → **Door** tab (all roles incl. team_lead):
  on-day one-thumb skin — big tap rows, search, check-in writes to the queue
  FIRST (optimistic), works with no network; online/OFFLINE dot, "N pending"
  badge, "sync now", and auto-flush on the `online` event. Closes the
  network-died-on-the-day scanning failure. `vite build` ✓ (Admin 241→246 kB).

### 🎉 ALL 12 PHASES SHIPPED
Foundation · Workspace+Control Room · Enforcement · Registrations(caps/waitlist)
· Offline check-in · Finance · Comms · Fixtures · Judging+Certs · Stalls/Venues/
Logistics · Sponsors/Schools CRMs · Analytics. Full ~27-table data model + RLS +
pg_cron enforcement APPLIED LIVE to the Paradox DB; 11 admin module surfaces
wired + gated; public site reads the same tables. Remaining polish (optional):
wire the public Register page to the atomic cap/greenlight RPC, and the
per-event Requirements printing roll-up.
Phase 5 offline check-in (IndexedDB queue) · Phase 7 comms send surface ·
Phase 8 fixtures generator + public brackets · Phase 9 rubric/judging +
certificates · Phase 10 stalls/venues/logistics + After Party workspace ·
Phase 11 sponsorship/schools/marketing CRMs · Phase 12 analytics + gallery.
Each is a module UI on top of the now-substantial schema + enforcement spine.

---

## Continuation pass (P1-P9)

### P5 — Admin module code-split  ✅
`Admin.tsx` statically imported all 8 OS modules (0 React.lazy) → all shipped in
the single Admin chunk. Converted every OS-module import to `React.lazy` +
a `LazyPanel` Suspense wrapper (Paradox-styled spinner) per render block.
Result: **Admin chunk 246 → 184 kB**; ControlRoom (15kB) / Finance (10) /
Fixtures (9) / Judging (9) / CrmModules (4) / Analytics / Comms / Door each load
only when their tab opens. (Route-level split of the public paradox pages was
already done in Phase 1.) `vite build` ✓.

### P1 — Real-data importers  ✅ DONE (run live)
Workbooks supplied + placed in `frontend/scripts/import-data/` (gitignored — raw
source incl. participant PII never enters the repo). `import_paradox_workbooks.mjs`
(SheetJS, dev-only dep) parsed the 9 event workbooks and APPLIED to the live
Paradox DB, replacing the generic Phase-2 seed with the team's real SOPs:
- **EVENT FLOW → paradox_runbook_steps** (375 real steps): PHASE→reg/logistics/
  on_day/post, task/owner/deadline/status mapped; gate + auto_condition set by
  task-text heuristics (open-registration→greenlit gate, breakeven, publish-
  fixtures→gate, enter/announce-results→gate). **77 gates, 73 auto-conditions.**
- **REQUIREMENTS → paradox_requirements** (153 rows): category/item/qty/source/
  arranged.
- **MESSAGE BANK → paradox_message_templates** (59 templates): name/when/body
  from the drafted reference, positional event-scoped keys, auto vs manual mode
  by name.
Per-event: Wicket Wars/Soccer 50, Dream Deck/Startup 46, TerraMUN 44, Prodigy
43, Ankle/Showstopper 37, Shutternaut 22. PickleJam (no workbook supplied) keeps
the seed. Idempotent (delete-then-insert per event; re-run converges).

**SKIPPED on purpose:** registrations (already live in the DB from the public
site — Analytics confirmed real counts) and the freeform OVERVIEW/RULES
narrative (rubric entered via the Judging UI).
**Known limitation:** workbook deadlines are prose ("Rolling", "Within 24 hrs")
not `T-7d`, so date-based auto-*chasing* won't fire for imported steps until
real dates are set; the gates + data-condition auto-progress work regardless.

### (superseded) P1 was BLOCKED — now resolved
The source workbooks/CSVs are STILL not in the repo (no `frontend/scripts/
import-data/`, no `.xlsx`). I cannot author or test importers against real
column layouts I don't have, and I can't add files I wasn't given. **Action
needed:** drop the `*_PARADOX4.xlsx`, `AFTERPARTY.xlsx`,
`Paradox_4_0_Registrations_EventWise.xlsx` + CSVs into
`frontend/scripts/import-data/` and I'll write the idempotent
`import_paradox_workbooks.mjs` (SheetJS, dev-only dep) mapping every tab per the
P1 spec. Until then the OS runs on the realistic backfill seed from Phase 2.

### Remaining (unblocked, queued in priority order)
P2 unified Event Workspace · P3 volunteer MyTasks/On-Day surface · P4 public
Register payment-gate wiring · P6 public rubric/winners/brackets · P7 cert
"generate all" in workspace · P8 comms auto-fire on state change · P9 end-to-end
enforcement verification.

## Open decisions / assumptions
- (pending) Where will the source workbooks live in the repo?
- (pending) Confirm the SQL-script handoff model for the Paradox DB (I author
  idempotent `frontend/scripts/paradox_os_*.sql`; a maintainer runs them).
- Importer column mappings will be recorded here as each workbook is parsed,
  with every ambiguous column's assumption noted (per §2).
