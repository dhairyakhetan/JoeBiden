# Design audit — 2026-09-10

> **STATUS: the migration described below has now been executed.**
> Measured against `scripts/audit-design.sh` before and after:
>
> | | before | after |
> |---|---|---|
> | illegal `borderRadius` in JSX | 61 | **18** |
> | retired hard-offset shadows | 55 | **18** |
>
> Executed: the whole overlay/dialog layer, the seven unmigrated public pages,
> the auth funnel middle (`AuthShell`, `RegisterPage`, `PendingApprovalPage`,
> `SettingsPage`), the home rail, the desk `--hod-*` landmine (70 old-spec
> fallbacks stripped), and `--scrim`/`--scrim-blur` tokens introduced and wired
> into the shared shell. Gates green throughout: `tsc` clean, 633/633 tests,
> build exit 0, `audit-design.sh` PASS.
>
> **What is deliberately still outstanding** is listed at the bottom under
> "Remaining, with reasons".

A deep crawl of the whole app (excluding `paradox/**`, which is a deliberately
separate visual system). Five parallel surface audits plus a mechanical
token-drift sweep.

---

## The single finding that explains everything

**The Sept-2026 "rounded minimalism" migration was executed page-by-page and
never finished.** It is not that the app has no design system — it has a very
well documented one (`styles/tokens.css`, `scripts/audit-design.sh`, the
changelogs). It is that roughly half the app was converted to it and half was
not, so the app renders **two eras side by side**:

| | Era A — current (correct) | Era B — retired neubrutalist |
|---|---|---|
| Radius | 999 / 32 / 22 / 14 only | 8, 10, 12, 16, 18, 20, 24 |
| Border | hairline `rgba(10,10,10,.08/.12/.18)` | `2px`/`3px solid var(--ink)` |
| Shadow | soft `--lift-1..4` | `4px 4px 0 var(--ink)`, growing on hover |
| CTA | `--shadow-cta` (the one surviving hard offset) | `3px→5px` offset ladders |

Every "disjoint" complaint traces back to this one split. A member crosses the
boundary constantly — e.g. tapping *share* on a migrated feed card opens a
`ShareModal` with a 3px ink border and a `6px 6px 0` shadow.

### Mechanical drift, counted

| Drift | Count | Worst concentration |
|---|---|---|
| Illegal inline `borderRadius` values | ~90 | `OpportunitiesPage.tsx` (~21, using 8 distinct radii) |
| `2px`/`3px solid` borders | **206** across 71 files | `v6.css` (27), `director.css` (25) |
| Hard offset shadows | **29** (ex-paradox) across 11 files | `v6.css` (9) — the *shared* layer |
| Raw hex literals | **~620** outside `tokens.css` | `BrandPage.tsx` (39), `VolunteerApplicationsParts.tsx` (17*) |
| `:focus-visible` rules | only 80 across 27 files | thin relative to ~200 component files |

\* those 17 are XLS export fills, not screen CSS — not drift.

---

## Where each surface actually stands

### ✅ Already correct — do not touch
- **`AQNav` + `AQFooter`** — the most disciplined code in the app. Both carry
  explicit comments about *removing* the hard offset because the motif is
  reserved. They are on every page; leaving them alone is the right call.
- **The HoD desk** — far better than the owner's complaint implies. 17 of 19
  tabs route through `adminKit` (`AdminLayout`/`AdminTabHeader`/`AdminSkeleton`/
  `EmptyLedger`), and **zero** tabs carry the old 3px/20px/hard-offset spec in
  their own JSX.
- **~11 public pages** already migrated (`AboutPage`, `EquityPolicyPage`,
  `MembersPage`, `DirectoryPage`, `LabsPage`, `JoinPromoPage`, `BlogPostPage`,
  `SchoolsPage`, `ClassesPage`, …), each with a `redesign section NN` header.
- `/login` (rebuilt yesterday), `/choose-team`, `/rejected`,
  `ApprovedWelcomeModal`, `CreatePostModal`, `sheet.css`.

### ❌ Era B — the actual problem

**1. The member-facing overlay layer — the worst offender, because it sits on
top of every other surface.**

Eight distinct panel radii, five border treatments, six shadow styles,
**nine scrim colours × six blur radii**, five close-button styles — all for
one job.

| File | What it does |
|---|---|
| `components/Confirm.tsx:207,263,272,373,407` | The app's most-used dialog. 2px ink panel; buttons hand-roll `3px→5px` offsets instead of `.btn-primary` |
| `components/ShareModal.tsx:218-220` | `borderRadius: 20` + `3px solid ink` + `6px 6px 0` — three violations in three consecutive lines |
| `components/OpeningPickerModal.tsx:130-131` | 3px ink + `8px 8px 0` — the heaviest overlay in the codebase |
| `components/Toast.tsx:144,149` | 2px ink + `--shadow-cta` (a CTA/sticker-only token) |
| `styles/v6.css:3733-3735,3763,3779` | `.aqm-panel`, the shared `Modal.tsx` shell — **one fix here migrates several dialogs at once** |
| `components/WelcomeOverlay.css:89-92,108` | `4px→6px→2px` offset ladder. Header says it was *redesigned 2026-09-09* — i.e. redesigned onto the retired system. Clearest proof the overlay layer's target was never updated. |
| `components/BirthdayPopup.tsx:122-123` | 2px ink, `6px 6px 0`, `borderRadius: 24` (on no scale at all) |

**2. The middle of the auth funnel — now the most jarring seam in the app,
because `/login` moved and nothing after it did.**

- `auth/RegisterPage.css:131` — the page **turns ink-black** immediately after
  the new white sign-in card. One deleted line kills the whiplash.
- `auth/PendingApprovalPage.tsx:38-39` — every masonry card is 2px ink +
  `2px 2px 0` hard offset, plus ~10 raw hex literals. This is where a new
  member *waits, sometimes for days* — highest-leverage single file in the funnel.
- `components/AuthShell.css:16` — `2px solid ink` column rule on the one shared
  auth shell.
- `auth/SettingsPage.tsx:93,215` — `borderRadius: 12`, a wrong `var(--r, 14px)`
  fallback (`--r` actually resolves to 22).

**3. Public pages never migrated** — and they are the *highest-intent* ones:
`OpportunitiesPage`, `OpeningDetailPage`, `RootsPage` (Crftd),
`VolunteerHandbookPage`, `QuickLinksPage`, `CollaborationsPage`,
`PrivacyPolicyPage`. `OpeningDetailPage` is reachable straight from Google, so
it is a likely first impression.

Also: **six distinct hero patterns across ~22 public pages** (ink slab, photo
scrim, stat strip, compact card, rule-and-eyebrow, and no hero at all). After
the border/shadow split, this is the loudest "different app" signal.

**4. A landmine on the desk (invisible today).** `ProjectModal.css:14-18`,
`ProjectManager.css:11`, `director-people.css:42,56,99,133` preserve the
*entire pre-reversal spec* as CSS custom-property fallbacks —
`var(--hod-border-w, 3px)`, `var(--hod-radius, 20px)`,
`var(--hod-shadow, 4px 4px 0 0 var(--ink))`. Nothing renders wrong now, but
rename or rescope any one `--hod-*` token and three tabs snap back to the
2026-07 brutalist look.

---

## Real defects (not taste — these are bugs)

| # | `file:line` | Defect |
|---|---|---|
| D1 | `components/OpeningQuestionBuilder.tsx:64-65` | Move-up/down buttons are **19px tall** — under half the 44px touch floor and under the 32px absolute floor |
| D2 | `profile/AddAchievementModal.tsx:257`, `profile/EditAchievementModal.tsx:284` | Remove-image buttons **28×28** |
| D3 | `director/SopManagement.tsx:247`, `director/TeamManagement.tsx:125`, `teams/detail/OpeningEditModal.tsx:165` | Declare `role="dialog" aria-modal="true"` but sit outside the `useDialog` focus-trap hook 28 other files use — claiming modality without inertness |
| D4 | `public/BrandPage.css:286,324` | `text-transform: lowercase` on `var(--display)` — **NeutralFace has no lowercase glyphs**, so this renders wrong or falls back |
| D5 | `public/AboutPage.css:699` | `--welfare` on `#302F2D` = **3.06:1**, fails AA (already documented as knowingly unresolved) |
| D6 | `public/HomePage.tsx:542` | `×` remove button with no `aria-label` |
| D7 | `auth/PendingApprovalPage.tsx` | **No sign-out / "wrong account" escape.** A member who signs in with the wrong Google account is stuck |
| D8 | `auth/RegisterPage.tsx:191-196` | Back button navigates to `/`, but `ProtectedRoute:87-91` bounces them straight back to `/register` — a loop, not an exit |

---

## Fix order (by pixels-changed per edit)

1. **`styles/v6.css`** — `.aqm-panel` + the 9 hard offsets + 27 2px borders in
   the shared layer. Highest fan-out in the app.
2. **`components/Confirm.tsx` + `components/Toast.tsx`** — every mutation in
   the app routes through these two.
3. **`auth/PendingApprovalPage.tsx`** — pure find-replace, no layout risk, and
   it is where new members spend the most time.
4. **`auth/RegisterPage.css:131`** — one line, kills the black-page whiplash.
5. **`ShareModal` / `OpeningPickerModal` / `BirthdayPopup` / `WelcomeOverlay`.**
6. **`OpportunitiesPage` + `OpeningDetailPage`** — highest-intent public pages.
7. Strip every `--hod-*` fallback on the desk (defuses the landmine).
8. Introduce `--scrim` + `--scrim-blur` tokens and collapse the 9×6 scrim matrix.

**Defects D1-D8 should go first regardless** — they are small, unambiguous, and
some are genuine accessibility failures.

---

## Do NOT "fix" these — documented deliberate decisions

- `AboutPage.css:93,182-184`, `EquityPolicyPage.css:114` — `var(--welfare)`/
  `var(--lemon)` carrying text with `accent-lint-ok` comments and measured
  ratios. These sit on **ink**, where the display hue clears AA and the
  `*-ink` partner does not. The `*-ink` rule is a light-ground rule only.
- `styles/tokens.css:139-146` — `--sh-*` definitions are kept on purpose; it is
  the *call sites* that are drift.
- `sheet.css` — the `.28` no-blur scrim is documented (the page already dims
  to `.5` separately, so a heavier scrim would double up).
- `v6.css:3459-3489` — `.aqc-dialog`'s asymmetric `32px 32px 0 0` on phone is
  the deliberate sheet-vs-card split.
- `director.css:266` (18px checkbox), `director.css:1491-1541` and
  `PublicProjectDetailPage.css:121-122` (6px jigsaw notches) — the three
  documented radius exceptions.
- `Toast.tsx:68-79` — white surface + hue accent stripe is a documented
  contrast decision.
- `director/VolunteerApplicationsParts.tsx:44-64` — the hex literals are XLS
  export fills, one carrying an explicit `// audit-ok`.
- `LoginPage.css:12-15` — `/login` deliberately bypasses `AuthShell`; the fix
  is to bring register forward, not to re-route login.

---

## Self-criticism from yesterday's work

- `components/ApprovedWelcomeModal.tsx:78,80` — the envelope uses
  `borderRadius: '18px 18px 0 0'`. Defensible under the poster system's
  "physical-object chrome is exempt" clause, but it is **undocumented**, so the
  next audit will flag it. Add the comment.
- `auth/LoginPage.css:252-253` — `.lg-step-n` hand-rolls
  `border: 2px solid var(--ink)` + `box-shadow: 0 0 0 2px var(--card)`. That is
  the `--keyline` pattern written by hand on something that is not a
  `.btn-primary` or `.sticker`. Should use `--keyline`.

---

## Remaining, with reasons (2026-09-10)

The 18 offset shadows and 18 JSX radii still reported are **not** an unfinished
sweep — each was left on purpose:

**Legal survivors (the rule permits these).**
`HomePage.tsx:299` and `AboutTab.tsx:108` are `.sticker` surfaces, and the
sticker is one of the two places a 2px ink border and a hard offset are still
correct. `v6.css:1729/1733` are the toast's `--welfare`/`--tomato` accent
offsets, not ink chrome.

**Opt-in themes, not defaults.**
`v6.css:983-984` (`[data-density="compact"]`) and `v6.css:1546`
(`body[data-shadow="hard"]`) only apply when a member deliberately turns them
on. `data-shadow="hard"` exists precisely to give people the old look back;
converting it would delete the feature.

**Print, where hairlines are wrong.**
`profile.css .cv-sheet` / `.cv-head` keep their 2px ink edge, now marked
`audit-ok`. The CV is a print artifact (`@media print`, `CvCard.tsx`), and the
poster system's own print rule is "no hairlines that vanish on paper". The
retired-2px rule is a *screen* rule.

**`BrandPage` — deliberate, needs a product decision.**
Five of the remaining offsets are on `/brand`, the brand-spec showcase, whose
job is to *display* the house style. Some of it demonstrates the old motif on
purpose (it even ships `.bp-inkpair-fail` chips that break the contrast rule as
a labelled demonstration). Restyling it wholesale is a content decision, not a
token swap.

**Geometry, not drift.**
Several 3–7px radii survive on 6–9px-wide accent cap-bars, where a 14px radius
is geometrically impossible.

**One real item genuinely deferred.**
`AboutPage.css:699` — `--welfare` on the `#302F2D` receipt slab measures
3.06:1. It stays in `scripts/accent-lint-baseline.json` because **both**
candidate colours fail there (`--welfare-ink` is 2.42:1, i.e. the "fix"
measures worse); it needs the double-tint structural change, not a colour swap.

## Tooling fix shipped alongside

`scripts/lint-accent-tokens.mjs` had a real blind spot: the ink-ground
heuristic ran **before** the `accent-lint-ok` pragma check, and for CSS its
selector slice reached back to the previous `}` — so any justification comment
that merely mentioned `var(--ink)` silently disabled the contrast check for the
rule beneath it, putting that declaration in *no* bucket at all.

Fixed by checking the pragma first and stripping comments before the heuristic.
The moment it landed it surfaced **three exemptions that had been swallowed**
and **one genuine violation that had been hidden** (`styles/footer.css:207`,
since reviewed, measured and given a proper ledgered exemption).
