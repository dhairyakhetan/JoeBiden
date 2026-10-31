# 22 · Social engine — the eight surfaces

**Files touched:** `frontend/src/services/notificationService.ts`,
`frontend/src/public/NotificationsPage.tsx`, `frontend/src/feed/` (tabs, the pending state,
comments), `frontend/src/profile/`, `frontend/src/lib/metaConfig.ts`, `frontend/src/hooks/useMeta.ts`.
**Design source:** `AquaTerra Feed.dc.html` — `23a` (the four free ones), `23b` (the five that cost).
**Prerequisites:** `00`, `13`, `15`, `03`, `11`. **Read `SOCIAL-ENGINE.md` first** — it is the
reasoning; this is the specification.

## Global invariants

1–9 as in `changelog/README.md`. **Two items here need schema and are marked so.** Everything
else works against the existing tables.

## 22.0 · Build order, and why

**Grouped by cost, because that is what decides the order.**

| # | surface | cost | build |
|---|---|---|---|
| **1** | **post pending state** | free | **FIRST — it is a duty, not a feature** |
| 2 | notifications | free (service exists) | second |
| 3 | new this week | free | third |
| 4 | Member of the Month, surfaced | free | third |
| 5 | for-you tab | one query change | fourth |
| 6 | replies + @mentions | **a column** | needs sign-off |
| 7 | streaks + firsts | attendance data | needs sign-off |
| 8 | outward share card | **prerendering** | infrastructure decision |

**Items 1–4 are not new features so much as existing work that never got a surface.** Member of
the Month is picked in the desk every month and then goes nowhere. The approval date is already
stamped on every member. `notificationService` is already written.

---

## 22.1 · The post pending state — the duty

**`UX-GAPS.md` item 18. This is the clearest failure in the product.**

A member posts. The post enters the moderation queue. **The member is told nothing.** Their post
is invisible to everyone and they have no way to know that, so they conclude the app ate it or
that nobody cared.

**Fix it before any growth feature.** Six of the eight below are optional. This one is the
difference between a queue and a black hole.

### The card

- **On the author's own feed and on their profile**, a pending post renders as a normal C07 card
  (`15.10`) **with a lemon-tinted banner above the body**, at `var(--r-inner)` inside the card:
  - a clock glyph in `var(--lemon-ink)`
  - **`Waiting for a HoD`** at `800 12.5px`
  - **`only you can see this · usually within a day`** in mono `9.5px`
- **NO like or comment count.** There is nothing to count yet, and a `0` reads as rejection.
  **This is rule 4 from `15.0` applied to a state rather than a figure.**
- **Edit and Delete ARE live**, in the footer where the engagement row would be. The only person
  who can act on this post right now is its author. `Delete` in `var(--danger-ink)`.
- **A pending post never appears in anyone else's feed.** That is the chooser's business, not this
  file's — **verify it, do not implement it.**

### What this needs from the data

**The post must expose its own moderation status to its author.** `15.0` and `03.7` both flag
this as unresolved: **is there a readable field?** If not, this is a one-column change
(`posts.status` or similar) and **it is the single highest-value schema change in this document.**

**Do not fake it** by inferring pending-ness from absence in the feed. A member whose post was
*rejected* must not see "waiting" forever.

### Rejected

**Also missing, and worse.** A rejected post currently disappears silently.
- **A tomato-tinted banner**: `Not published` + the HoD's reason if one exists, or
  `a HoD did not publish this` if not.
- **`Edit and resubmit`** as the primary action. **A rejection with no path forward is a
  dead end**, and for a 14-year-old it reads as being told off by an invisible authority.
- **Needs the same field, plus somewhere to put a reason.** If the desk does not capture one,
  **do not invent a UI for it** — say so.

---

## 22.2 · Notifications

**Six kinds. Every one has a destination. `SOCIAL-ENGINE.md` is emphatic: no notification without
a destination.**

| # | trigger | copy pattern | priority |
|---|---|---|---|
| 1 | **your post was approved** | `Your post is up.` + `{name} approved it.` | **the duty** |
| 2 | **your post was rejected** | `A HoD did not publish your post.` | **the duty** |
| 3 | someone commented on your post | `{name} commented: "{first 40 chars}"` | highest return driver, **exists today** |
| 4 | someone tagged you | `{name} tagged you in a post` | needs `post_tags` to fire |
| 5 | a drive you're down for is tomorrow | `{place} drive is tomorrow` + `{time}, you're down for it` | needs a scheduled job |
| 6 | **likes, as ONE daily digest** | `{n} people liked` + `your {topic} post` | **never one per like** |

### The row

```css
.notif-row {
  display: flex; align-items: center; gap: 11px;
  min-height: 44px; padding: 12px;
  border-radius: var(--r-inner);
  background: var(--bg);            /* read */
  text-decoration: none;
}
.notif-row[data-unread] { background: rgba(27,138,90,.16); }   /* welfare tint */
```

- **34px leading circle**: an avatar for a person, a hue disc with a glyph for a system event.
- **The sentence is one line at `400 13.5px/1.42`** with the subject in `800`. Mono timestamp
  beneath at `9px`.
- **An 8px welfare dot on the right for unread.** Not a colour change alone — a dot is
  independently perceivable.
- **Approval is the only kind that gets a tinted ground even once read.** It is the one the member
  has been waiting for.

### The rules that matter

- **Likes are a digest.** 128 likes must not be 128 rows. **One row per post per day, at most.**
- **Batch by kind and object.** Three comments on one post is one row saying so.
- **Deliberately NOT notified:** an individual like, a follow, "someone viewed your profile",
  anything from the org account to everyone. **A notification list that cries wolf gets muted, and
  then the approval notification — the one that matters — is muted too.**
- **The unread dot in both navs** (`02.4`, `02.6`) reads a single count.
- **`Mark all read` is one call**, optimistic, no confirm.
- **`aria-live="polite"`** on the count.

---

## 22.3 · New this week

**Free — approvals already stamp a date.**

- A horizontal strip of **96px cards** on the feed's right rail (desktop) and as a section in the
  feed (phone): 44px avatar, name, school, and a **`Say hi` ink pill**.
- **`box-sizing: border-box` on every card, and the row is `overflow-x: auto` — not `hidden`.**
  This is not a detail: at 96px + `padding: 12px 10px` under `content-box` a card occupies
  **116px**, so three overflow a 336px row and the third is clipped with no way to reach it. At the
  cap of 6, **three would be invisible and `Say hi` — the reason this section exists — would be
  unusable for most of the list.**
  Add `scroll-snap-type: x proximity`, `scroll-snap-align: start`, and
  **`overscroll-behavior-x: contain`** so a swipe does not trigger back-navigation.
  **Verify by comparing `scrollWidth` to `clientWidth`, not by looking at it.**
- **`Say hi` opens the comment composer on their welcome card (C14, `15.5`)**, or their wall
  (`16`) if C14 has aged out. **It does not open a DM** — there is no DM in this product and
  inventing one here would be a whole feature.
- **Cap at 6, one week window.** If nobody joined, **the section does not render** — an empty
  "new this week" is worse than none.
- **Welcoming someone is the cheapest engagement act available** and there is currently no surface
  for it at all.

---

## 22.4 · Member of the Month, surfaced

**Free. The data is already written every month and goes nowhere.**

- **A lemon card** at `var(--r-outer)`: 58px ink avatar, the mono `★ member of the month` kicker,
  the name at `900 23px var(--display)`, and `{month} {year} · {team}` in mono.
- **`See what he did` / `See what she did`** — **gendered, and the codebase already has this
  problem** (`15.4` flags `Wish her`). **Use `See their month` instead**, and raise the existing
  gendered string separately.
- **Placement:** the feed's right rail, and the honoured member's own profile.
- **If no pick exists for the current month, do not render it.** Do not fall back to last month's
  without saying so.
- `HomePage.tsx` already has a `rail-role` MotM block reading `mom.memberName` and
  `formatPeriod(mom.period)` — **so the read exists. This is a restyle plus a second placement,
  not new plumbing.**

---

## 22.5 · The for-you tab

**One query change. `01.11` already turns the sort control into tabs, because a set of one is not
a filter.**

| tab | rule | cost |
|---|---|---|
| **For you** (default) | your teams' posts → then authors you have liked before → then everything, each bucket newest-first | query change |
| **Latest** | unchanged, exactly what ships today | free |
| **My teams** | `team_id IN (your teams)` | query change |

- **Sort by relationship, not popularity.** On 586 posts an engagement score concentrates attention
  on five and starves everyone else — the opposite of what a volunteer community needs.
- **Not an infinite algorithmic feed.** The load-more button with its `aria-live` announcement
  stays (`01`).
- **The cheap 80% first:** the **backfill rule**. When the newest page returns fewer than 5 posts,
  append the most-liked posts from the last 30 days under a divider. **One extra query, no ranking
  model, and it removes the "this place is empty" impression on a quiet week** — which is the real
  problem the for-you tab is trying to solve.
- **Tabs are `role="tablist"`** with proper `aria-selected`, 44px minimum, and the selection
  **persists in the URL** so a shared link lands on the same tab.

---

## 22.6 · Replies and @mentions — **needs a column**

- **One level deep only.** `03.5.1` has the bubble and the 34px indent.
- **Until `parent_id` exists:** `reply` **prefills the composer with `@name` and posts flat.**
  Useful on its own, costs nothing, and ships today.
- **@mention resolves against the member search the composer already uses** (`03.2.6`). **Do not
  add a second search implementation.**
- A mention **fires notification kind 4** and renders as `.aq-comment-mention` — `800` weight on
  `rgba(10,10,10,.07)` at radius 6.
- **Do not build threading deeper than one level.** Two levels on a 390px screen leaves ~250px of
  text width.

---

## 22.7 · Recognition after points — **needs attendance data**

**The points system was retired 2026-09-04 and nothing replaced it.**

**Do not bring points back.** A leaderboard in a volunteer org rewards the loudest, not the most
useful. You decided that once already.

**Three durable, non-competitive marks:**

1. **Streaks of showing up, not of posting.** `3 drives · mar – sep 2026` is a fact about
   contribution; a 12-day posting streak is a fact about being online.
   **Source: `certificateService.getHoursSummary`, which already returns `driveCount`,
   `earliestDate` and `latestDate`.** So the read exists.
   **But `HomePage.tsx` warns `drive_attendance` holds ZERO rows before 2026-08-31** — digital
   check-in went live then, and everything prior was on paper. **So a low count means "no digital
   record", not "has not volunteered", and the label must never imply otherwise.**
2. **Firsts.** A stamped sticker for a first post, first drive, first team lead. **Blocked on
   whether `Post` carries `sticker`** — unresolved since `01`.
3. **Member of the Month** — 22.4.

**And delete `pointsTile`.** It renders a retired metric in five of seven greeting recipes. **That
is worse than showing nothing**, and it is a one-line deletion.

**No leaderboard. No ranking. No comparison between members. Anywhere.**

---

## 22.8 · The outward share card — **an infrastructure decision**

**Right now a shared AquaTerra link renders as a bare URL. That is why nothing spreads.**

- **Design at 1.91:1** — what every platform crops an OG image to. Designing at that ratio means
  the card is never cropped by someone else's algorithm.
- **Composition:** the post's photo, a two-stop scrim to `.86`, a stamped category sticker
  top-left, the title at `900 19px` uppercase with `text-wrap: balance`, and a mono footer line
  with the square mark: `aquaterra · student-run · kolkata`.
- **Use `stamp-white.png`**, never `logo.png` (`02.4`).

### The catch, and it is not solvable in CSS

**This is a Vite SPA.** `hooks/useMeta.ts` and `lib/metaConfig.ts` exist, but **OG tags set
client-side are not read by crawlers.** It needs either prerendering for `/post/:uuid` or a small
edge function.

**That is an infrastructure decision, not a design one. Flag it and decide before building.**

**Two things that ARE free today:**
1. **Open the poster studio to everyone for their own posts.** It is gated behind `canMakePoster`
   (leadership only) and it is the best asset this product makes. **Opening a gate is a one-line
   change.**
2. **Generate the card as a downloadable image** from the existing poster machinery. A member
   sharing it to their own Instagram story does not need OG tags at all — **and given
   `BRAND_VOICE.md` describes an Instagram-first org, that may be the higher-value half.**

---

## Contrast note for every hue block in this file

**All label and sub-line text on a welfare, pink or grape ground is full-opacity `var(--ink)`.**
Not `rgba(10,10,10,.7)`, not `.66`. Those measure **3.28:1** and **3.1:1** on welfare.
This applies to the recognition tile's `drives` / `mar – sep 2026`, the MotM card's period line,
and the share card's category sticker. See `README.md` invariant 7.

## States

- **Notifications, empty:** `nothing yet.` in a cream well with **no action** — there is nothing
  to do about having no notifications.
- **Notifications, loading:** three row-shaped skeletons at the real geometry.
- **New this week, empty:** section absent.
- **MotM, no pick:** card absent.
- **For-you, thin:** the backfill rule fires. **Never an empty feed on a quiet week.**
- **Pending post, author view:** 22.1.
- **Rejected post, author view:** 22.1, with a path forward.

## Verification

1. **A member can always tell whether their post is live, pending or rejected.** Test all three.
2. **A rejected post offers a path forward.** No dead ends.
3. **No pending post appears in another member's feed.**
4. **128 likes produce ONE notification**, not 128.
5. Every notification row deep-links to its object.
6. Unread state is a dot plus a tint, not colour alone.
7. `role="tablist"` on the feed tabs; selection survives a share.
8. **The backfill fires when the newest page returns < 5 posts.**
9. **No leaderboard, no ranking, no member-to-member comparison anywhere.**
10. `pointsTile` is deleted from all seven recipes.
11. Any drive-count label reads as attendance, **never** implying pre-2026-08-31 drives are counted.
12. The share card is 1.91:1 and uses `stamp-white.png`.
13. `See their month` is not gendered.

## Unresolved

1. **Is there a readable moderation status on `posts`?** **The highest-value schema question in
   this document** — 22.1 depends on it entirely.
2. **Does the desk capture a rejection reason?** If not, the rejected banner has nothing to show.
3. **`parent_id` on comments** — approve, or replies stay flat?
4. **`sticker` on `Post`** — still open since `01`. Blocks the "firsts".
5. **Is there any scheduled-job capability?** Notification 5 (drive tomorrow) and the wall's 30-day
   purge (`16`) both need one, and **nothing in the app does scheduled work today.**
6. **Can `/post/:uuid` be prerendered**, or is a downloadable image the whole answer?
7. **Should the poster studio open to everyone?** A one-line gate change with real upside.
8. **Is `drive_attendance` reliable enough to build streaks on**, or is it still mostly paper?
