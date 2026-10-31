# WORKFLOW — how to build this without breaking it

**Read `START-HERE.md` first.** This document is the process; that one is the map.

---

## The loop, per file

```
1  READ       START-HERE → README → the file → its "Unresolved" section
2  READ       UX-GAPS.md's "must not be cleaned up" list
3  OPEN       AquaTerra Feed.dc.html at the turn the file names
4  GREP       the code the file touches. Confirm the instruction matches reality
5  REPORT     any mismatch. Do NOT reconcile it silently
6  BUILD      one file, one PR
7  TEST       TESTS.md layers 1-3, at 375px AND 1180px
8  CHECK      the ACCEPTANCE.md block for that file
9  ANSWER     the file's Unresolved items in the PR — by reporting, not guessing
```

**Step 5 is the one that matters most.** These instructions were written against a codebase read
at one moment in time. **If an instruction contradicts the code, the code wins.**

---

## Nine rules for the whole build

### 1 · One file, one PR
23 build files. **A PR touching three of them cannot be reviewed against a checklist.**

### 2 · Never widen access
Route guards, `superOnly`, `canApproveMembers`, `hasLeaderAccess` vs `isSuperAdmin` — **these
mirror RLS policies, not UI preference.** A restyle that changes who can see something is a
security change wearing a design change's clothes.

### 3 · Never add a query to make a design work
If a figure is unavailable, render the documented fallback: **the live marker, or omit the
element.** Never a `0`. Never a second fetch. `useFeedCardBatch` exists because the N+1 was
already fixed once.

### 4 · Never invent a number
`BRAND_VOICE.md` §3: *never invent, round up, or "improve" a number.* Everything public comes from
`ORG_FACTS` (`21`). **Rounding is always down.**

### 5 · Delete the flattening overrides before restyling
`v6.css` has `!important` rules that cancel the design (`.sticker { box-shadow: none !important }`
being the clearest). **Grep for the callers, delete the override, then restyle.** Restyling on top
of an override produces a change you cannot see.

### 6 · Measure, do not look
**Clipping, contrast and overlap were all measured defects in this project that looked completely
fine in screenshots.** Four rounds of review were spent on absolutely-positioned decoration over
auto-height content, and one on a card that occupied 116px while declaring 96px.
**TESTS.md layer 3.**

### 7 · Report unresolved items, do not guess
Several are data questions where a guess puts a false claim on a public page about a real
registered NGO whose members are 14 to 19 years old. **"I do not know" is a complete answer.
An invented number is not.**

### 8 · Keep the comments
The codebase's comments explain *why* — the paper-vs-digital attendance problem, the retired
points system, why `PostFocusModal` stays mounted, why `birthday_public` never shows an age.
**Deleting a comment while restyling deletes the only record of a decision.**

### 9 · The design doc is the reference, the changelog is the instruction
Where they disagree, **the changelog wins** — it was written after reading the code, the mock was
drawn before. Several mocks contain copy that the changelog explicitly retires.

---

## Where the boundaries are

| boundary | rule |
|---|---|
| `lib/feedShape.ts` | **byte-identical.** `15` changes how cards look, never which renders. A git check enforces it |
| `feedShape.test.ts` | **passes unmodified.** Editing a test means behaviour changed |
| `src/paradox/**` | **untouched.** Not in scope, not in the audit |
| `@media print` in `profile.css` | **do not enter.** The CV print pipeline is tested and fragile (`04.5`) |
| `/equity` body text | **verbatim from an HR document.** Restyle the container only |
| `/labs` descriptions | **the teams' own words**, including `404-Idea Not Found`. Correct nothing |
| `lib/profanity.ts` | **`BLOCK_MESSAGE` verbatim.** It protects minors |
| every Supabase call | **shape, columns, filters and return type unchanged.** One exception: `16` |

---

## Three things to build before anything visual

**All three are independent of the redesign and each removes a class of problem:**

1. **`21-org-facts.md`** — compute every public statistic. **Kills the four-value drives conflict
   permanently** rather than fixing it once.
2. **The 13 shipped bugs in `UX-GAPS.md`** — small diffs, immediate wins, zero design risk. Several
   have product-wide reach: `--rust` is undefined and used in **five** places, so the feed's error
   banner has no red and `BreakModal`'s required-field asterisk is **invisible**.
3. **`22.1`, the post pending state** — **a duty, not a feature.** A member posts, it enters the
   queue, and they are told nothing. **Blocked on one question:** does `posts` expose a readable
   moderation status to its author?

---

## When you are stuck

| situation | do this |
|---|---|
| an instruction contradicts the code | **the code wins.** Report it |
| a required field or table does not exist | **stop.** Report it. Do not fake the data |
| a design needs a query that does not exist | **omit the element.** Report it |
| a string in the file differs from the live one | **keep the live one.** Report the difference |
| the audit flags something you believe is correct | **comment the line explaining why**, and keep it |
| you cannot make a layout work without absolute positioning | **you can.** Reserve space instead — README's overlap rule |
| an "Unresolved" item blocks you | **report and move to the next file.** Do not stall the build |

---

## Definition of done, per file

- [ ] `audit-design.sh` passes
- [ ] TESTS.md 3.1–3.5 return empty at **375px and 1180px**
- [ ] the `ACCEPTANCE.md` block is fully ticked
- [ ] the flow tests touching this surface pass **as a real role, including a scoped HoD**
- [ ] all six page states exist (`11`), not just the happy path
- [ ] screenshots at both widths attached
- [ ] **every "Unresolved" item is answered or explicitly reported as unknown**
- [ ] no Supabase call changed shape
- [ ] no comment deleted that explained a decision

---

## Definition of done, whole project

- [ ] all 23 build files landed
- [ ] the 13 shipped bugs fixed
- [ ] `ORG_FACTS` generated; **no statistic literal anywhere**
- [ ] the four disputed drives values appear **nowhere**
- [ ] `pointsTile` deleted from all seven recipes
- [ ] a member can always tell whether their post is live, pending or rejected
- [ ] **zero horizontal overflow on every route at 375px and 360px**
- [ ] every contrast probe returns empty
- [ ] reduced motion removes all ambient motion on every surface
- [ ] all eleven demo flows perform **zero writes**
- [ ] `feedShape.ts` and its test are untouched
- [ ] every file's Unresolved list is answered, in writing
