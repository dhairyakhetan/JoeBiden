# 16 · Profile Wall

**Status:** the only genuinely NEW feature in this redesign. Everything else restyles something
that exists. **This one needs a table, a service, RLS policies and a UI.**
**Files touched:** `frontend/src/profile/` (new `Wall` components), `ProfilePage.tsx`,
`PublicProfilePage.tsx`, a new `services/wallService.ts`, `frontend/src/lib/profanity.ts` (reuse).
**Design source:** `AquaTerra Feed.dc.html` — `20a` (someone else's wall), `20b` (your own: empty
state, composer, removal).
**Prerequisites:** `00`, `04` (profile `7a`), `13` (stickers), `03.5` (the composer patterns).

## Global invariants

1–9 as in `changelog/README.md`, **except invariant 5** — this file necessarily adds a table.
Everything else holds: no new colours, no new fonts, no new dependencies, 44px targets, the
contrast ladder, the overlap rule.

## 16.0 · The schema — approved 2026-09-05

```sql
create table profile_notes (
  id           uuid primary key default gen_random_uuid(),
  recipient_uuid uuid not null references members(uuid) on delete cascade,
  author_uuid    uuid not null references members(uuid) on delete cascade,
  body         text not null check (char_length(body) <= 280),
  image_url    text,
  label        text,                          -- one of a fixed set, nullable
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,                   -- SOFT DELETE
  deleted_by   uuid references members(uuid)  -- recipient or author
);
create index on profile_notes (recipient_uuid, created_at desc) where deleted_at is null;

alter table members add column wall_enabled boolean not null default true;
```

### The soft delete is load-bearing, not a nicety

**`deleted_at`, never `DELETE`.** A hard delete means an abusive note vanishes before anyone can
act on it — the recipient deletes it, and then there is no record for a HoD, a parent or a school
to see. **Keep removed notes for 30 days.**

The UI says `hidden from your wall · kept for 30 days` so the recipient knows the removal is
effective *and* that they have not destroyed evidence.

### RLS, stated because the wiring must not be guessed

- **select:** `deleted_at is null` **and** the recipient's `wall_enabled = true`. Public — visitors
  included, per your decision.
- **insert:** any authenticated, approved member. `author_uuid = auth.uid()`. Recipient must have
  `wall_enabled = true`.
- **update (soft delete only):** `auth.uid()` is the recipient **or** the author.
  **Nobody may edit `body` after insert.** An editable public note is a different, worse feature.
- **`wall_enabled`** is writable only by its owner.

**When `wall_enabled` flips to false the notes are not deleted** — they stop being served. Turning
the wall back on restores them. **This must be true or the off-switch becomes a destructive
action, and people will not use a safety control that destroys things.**

## 16.1 · The layout — a pinboard that cannot overlap its own text

**The reference is a scattered collage with real overlap. I am not building it that way, and the
reason is in `changelog/README.md`'s overlap rule** — absolutely-positioned decoration over
auto-height content has produced a defect three times in this redesign (`7a`, `8a`, `12a`).

**So the scatter is manufactured from four variables inside a CSS-columns flow:**

1. **tint** — one of seven hues at 26–34% over cream
2. **size** — body at 13.5px / 14px / 17px serif, which changes the note's height
3. **label side** — the hash pill sits left or right, overhanging by 5px
4. **rotation** — the pill only, from `13`'s fixed ten-value set, **hashed from the note id** so it
   never changes between renders

```css
.wall-board { columns: 2; column-gap: 8px; }
.wall-note  { break-inside: avoid; margin-bottom: 8px;
              display: flex; flex-direction: column;      /* NOT position: relative */
              border-radius: var(--r-inner); padding: 15px 14px; }
.wall-label {                                             /* the hash pill */
  align-self: flex-start;                                 /* or flex-end for the right variant */
  margin: -7px 0 0 -5px;                                  /* or -7px -5px 0 0 */
  width: fit-content;
  border-radius: var(--r-pill); padding: 4px 10px;
  border: var(--bd-ink); transform: rotate(var(--rot));
}
```
**One column below 480px.** Three on desktop.

- **The note body is never rotated.** Rotation is chrome (`13`).
- **NOTHING IN THE BOARD IS `position: absolute`. This is a hard rule with a specific reason.**
  An earlier draft made the hash pill `position: absolute` on a `position: relative` note.
  **That is broken in a multi-column layout:** each note is a direct child of a *fragmentainer*,
  and an absolutely-positioned child does not reliably resolve against it — measured, the
  right-side pill resolved against the **multicol container** instead and, with only `right` set
  and no `left`, its shrink-to-fit width collapsed to the container's. It rendered **293×515px
  over a 175×173px note and covered eighteen text nodes down the whole column.**
  The left-side pills looked fine, but only because `left` happened to resolve to the same
  origin — luck, not geometry, and it breaks the moment a note reflows into the other column.
  **So the pill is a static first child.** It is sized by its own text, it overhangs via negative
  margins, and it **cannot escape its note under any reflow.**
  **Do not "simplify" this back to absolute positioning.**
- **CSS columns reorder visually.** Acceptable here — a pinboard is not a ranked list — but the
  notes must carry timestamps so recency is still legible.

### Note variants

| the note has | treatment |
|---|---|
| body + label | tinted hue at radius 22, hash pill overhanging |
| body, no label | tinted hue, no pill |
| body + image | **white card** (32/10) with the image at radius 14 and the body beneath |
| a long body | serif italic at 17px — **the one place besides `15.9` the serif carries a sentence** |

**The image note is a white card, not a tint.** A photo on a tinted ground fights it, and the
white card also gives the image a defined edge — the same reasoning as `15.9`'s nesting.

**Every note carries the author's avatar, name and age.** A wall of anonymous notes is a different
and much worse feature.

## 16.2 · The empty state — where the off-switch lives

**This is the most important screen in the file and it is the one design decision I made
unilaterally.**

You chose an open wall with no gate beyond the profanity filter. The accepted risk is that
**nothing sits between a stranger's image and a public profile** — `checkText` cannot inspect a
picture. Given that, **the off-switch must be discoverable before it is needed.**

- **SET** the empty state inside a white card: a 52px lemon disc with a speech-bubble glyph, a
  `900 19px` line, and **three sentences that are the entire policy in plain words**:
  *"Anyone at AquaTerra can leave you a note. You can delete any of them, and you can turn the
  wall off."*
- **Directly beneath it, in the same card, the `Wall is on` toggle** with the sub-line
  `visible to everyone, including visitors`.
- **The toggle is a real `<button role="switch" aria-checked>`**, 46×28 with a 22px knob, 44px hit
  area. Welfare when on, `rgba(10,10,10,.14)` when off.
- **The toggle also appears in profile settings** — but the empty state is where a member *meets*
  it, and a control you meet before you need it is a different control from one you go hunting for.

**When the wall is off**, your own profile shows the same card with the toggle off and one line
saying notes are hidden, not deleted. **Visitors see no tab at all.**

## 16.3 · The composer

- **Opens as a bottom sheet** on phone, reusing `03.2.1`'s shell and `03.1`'s ink dock.
- **SET** the header `A note for {first name}` and a 38px close.
- **SET** the body field into a cream radius-22 well: `400 17px/1.5`, auto-grow, no border.
  **17px, above the iOS zoom floor.**
- **SET the 280 counter** as `00`'s length bar — welfare fill, mono `{n}/280`, **turning
  `--danger-lift` and disabling send past the limit.** The cap is a DB check constraint, so the
  UI must not allow a submit that will fail.
- **SET the label row**: a mono `label` caption then stamped chips plus `none`.
  **DECIDED 2026-09-05: the label set is exactly `lib/categories.ts`'s five slugs. Nothing new.**
  Import them; do not hard-code a list, and do not add social labels like `#firstdrive`.
  Free-text labels are not available — a free-text field on a public wall is a moderation surface
  nobody is watching.
  **The mock shows `#firstdrive`, `#welcome` and `#thankyou`; those are now wrong.** Use the five
  category slugs with a `#` prefix.
- **SET one image button** on the dock. **One image, not many** — `image_url` is singular.
- **The dock's centre reads `everyone can see this`.** The wall is public to visitors and the
  person writing should know that *before* they write. **This is not decoration; it is the consent
  moment for the openness you chose.**
- **SET the send as `Pin it`**, stamped welfare.
- **KEEP the profanity gate**: `checkText` on submit, `BLOCK_MESSAGE` verbatim. **On submit, never
  on keystroke.**
- **Draft autosave: no.** Unlike the post composer, a wall note is short and one-shot. A restored
  draft addressed to someone you have since navigated away from is worse than losing 48 characters.

## 16.4 · Notifications

**A note with no notification is a note nobody reads.** Per `SOCIAL-ENGINE.md`:

- **`someone left a note on your wall`** — deep-links to the wall, **not** to a notification
  detail. Every notification must have a destination.
- **Batch:** if three arrive within an hour, one row saying so. Do not send three.
- **No notification to the author.** They know.

## 16.5 · The wall tab on the profile

- **A third tab** in `7a`'s row: `Achievements` · `Posts` · `Wall {n}`.
- **The count excludes soft-deleted notes.**
- **On your own profile the tab renders even at zero** (so you can find the off-switch).
  **On someone else's it renders only if they have notes and `wall_enabled`** — an empty wall on
  a stranger's profile is an invitation to be the first, which sounds nice but in practice means
  every profile prompts a stranger to post.
- **The sticky `leave {name} a note…` bar** appears only on someone else's wall, and only when
  `wall_enabled`. It replaces the bottom nav on that route, as `03.4` does for the post detail.

## States

- **Loading:** two columns of tinted radius-22 skeletons at varying heights. **Match the real
  geometry** (`06.7`).
- **Empty, own:** `16.2`.
- **Empty, other:** the tab does not render.
- **Wall off, own:** the card with the toggle off and the "hidden, not deleted" line.
- **Wall off, other:** no tab.
- **Note removed:** a tomato-tinted radius-22 banner — `Note removed` /
  `hidden from your wall · kept for 30 days` / **`Undo`**. **Optimistic, with the undo, per
  `06.6.3`.** No confirm dialog: the action is reversible, so a confirm is friction without safety.
- **Profanity blocked:** `BLOCK_MESSAGE` in the composer, **text preserved**.
- **Image upload failed:** retry on the thumbnail badge (`03.2.3`), body preserved.
- **Offline:** the composer keeps the text and says it will send when back. **Do not silently drop.**
- **Author's account deleted:** `on delete cascade` removes their notes. **Confirm that is
  desired** — the alternative is keeping the note with a "former member" author.

## Verification

1. **`deleted_at`, never a hard `DELETE`.** Removed notes still queryable for 30 days.
2. **`wall_enabled = false` hides, never deletes.** Toggling back restores every note.
3. **Nobody can edit `body` after insert** — verify by policy, not by UI.
4. **280 enforced in the DB and blocked in the UI** before submit.
5. **Nothing overlaps a note's text**, and **nothing in the board is `position: absolute`.**
   Verify by measuring **every** pill's rect against **every** note's text — including the
   left-side ones, which passed by accident in the first draft. Then reflow the board (change the
   column count, lengthen a note) and measure again.
6. Pill rotation is hashed from the note id — **stable across renders and reloads.**
7. Ink text on every tint; the hues are at 26–34% over cream, so **verify each against 4.5:1**.
8. `role="switch"` + `aria-checked` on the toggle, 44px hit area.
9. The composer states `everyone can see this` before submit.
10. Profanity gate fires on submit with text preserved.
11. Radii only 999 / 32 / 22 / 14.
12. Zero horizontal overflow at 375px and 360px; one column below 480px.

## A note on strings

**Approved (bulk):** `Wall` · `leave Riya a note…` · `A note for Riya` · `label` · `none` ·
`Pin it` · `everyone can see this` · `nothing on your wall yet.` ·
`Anyone at AquaTerra can leave you a note. You can delete any of them, and you can turn the wall
off.` · `Wall is on` · `visible to everyone, including visitors` · `Note removed` ·
`hidden from your wall · kept for 30 days` · `Undo` · `8 more notes` · `someone left a note on
your wall` · every note body and hash label in the mock.

**KEEP verbatim:** `BLOCK_MESSAGE` and everything else `lib/profanity.ts` produces.

**One emoji appears in the mock** (`welcome to ops, officially 🫡`) as *user-authored content*.
**That is fine and unavoidable — members will type emoji.** But **no emoji in any AquaTerra-authored
string on this surface**; `BRAND_VOICE.md` §1.2 bans emoji spam, and `15.4` records that the
birthday 🎂 is the single legal exception because it comes from a database template.

## Unresolved after this file

1. **Does the 30-day retention need a cron/edge function to purge**, or is it a manual query?
   Nothing in the app does scheduled work today.
2. ~~Who can see a soft-deleted note?~~ **RESOLVED 2026-09-05: HoDs can review removed notes.**
   This makes the 30-day retention useful rather than merely cautious. It needs:
   - **a desk** — removed wall notes belong in `the queue` group (`17.1`), beside post moderation
   - **an RLS select policy** for `deleted_at is not null` scoped to `hasLeaderAccess`
   - **a column showing who removed it** (`deleted_by`) — recipient vs author is the whole signal:
     an author deleting their own note is a change of mind, a recipient deleting one is a report
   - **no notification to the author** that their note was removed or reviewed
   **This is a sixth desk in a five-glyph group.** It is a child of post moderation, not a
   sibling — the rail cap in `17.1` holds.
3. **Is `on delete cascade` right for a departed author's notes**, or should the note survive with
   a "former member" attribution?
4. ~~The closed label set~~ **RESOLVED: `lib/categories.ts`'s five slugs, nothing added.**
5. **Image storage.** `DESIGN.md` §4 records 50–100 MB uploads with no client-side resize. **A wall
   image must be resized before upload** — if that helper does not exist, **this is the third
   surface to need it** and it should be built once.
6. **Rate limiting.** You declined a gate, and I am not adding one. But **an insert with no rate
   limit is a spam vector** — worth one line in the RLS policy or a DB trigger, and it is invisible
   to the design either way. Say the word.
