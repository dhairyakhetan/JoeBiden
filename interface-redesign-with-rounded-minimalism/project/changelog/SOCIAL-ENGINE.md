# Social engine — where engagement is leaking, and what to do

**Status:** plan, not a changelog. Nothing here is a build instruction yet. Each item names what it
costs (design only / query change / new table) so you can decide before I write it into a numbered
file.

You checked all eight areas. They are not eight problems — they are three, and the third one is the
expensive one.

---

## The three actual problems

**1. The feed has no opinion.** It is reverse-chronological with a category filter. That is a
noticeboard, not a feed. A 14-year-old who joins on a quiet week sees four posts from people they
have never met and concludes the place is empty.

**2. Contribution is invisible after the fact.** The points system was retired on 2026-09-04 and
nothing replaced it. A member can run a drive, get 128 likes, and have no durable mark of it
anywhere. Meanwhile `lib/gridRecipes.pointsTile` still renders a retired metric in five of seven
greeting recipes — so the one place that *does* claim to show contribution is showing a number
nobody maintains.

**3. Nothing leaves the building.** Every social artefact this product creates is visible only to
signed-in members. An NGO run by students recruits by being seen. There is a poster studio behind a
leadership role gate and no outward share card on a normal post.

---

## Feed ranking

**Today:** `latest` only. The sort control offers one option, which is why `01.11` turns those
controls into tabs — a set of one is not a filter.

**Proposal — three tabs, in this order:**

| Tab | Rule | Cost |
|---|---|---|
| **For you** (default) | your teams' posts, then posts by people you have liked before, then everything, each bucket newest-first | query change |
| **Latest** | unchanged, exactly what ships today | free |
| **My teams** | `team_id IN (your teams)` | query change |

**Why "for you" and not an engagement score.** A like-weighted score on a feed this size (248 posts,
~400 members) concentrates attention on five posts and starves everyone else — the opposite of what a
volunteer community needs. Sorting by *relationship* rather than *popularity* means a quiet post from
your own team still reaches you.

**The cheap 80%:** before touching ranking, fix the empty-week problem with a **backfill rule** — when
the newest page returns fewer than 5 posts, append the most-liked posts from the last 30 days under a
divider labelled with existing copy. This is one extra query, no ranking model, and it removes the
"place is empty" impression entirely.

**Do not** add an infinite algorithmic feed. The load-more button with its `aria-live` announcement
is better for this audience and better for accessibility.

---

## Composer

**Today:** `CreatePostModal.tsx` is 74KB. You called it too heavy and you are right.

**Proposal — split by intent, not by field.** Most posts are one of three things, and the composer
currently asks every question for all of them:

1. **A photo and a sentence** ("we did this today") — 90% of posts. Needs: image, body, category.
2. **A write-up** — needs title, body, images, category, tags.
3. **A link** — needs URL, one line, category.

Open on **(1)**, with a single "more" disclosure that reveals title, tagged members, sticker and
link. Same fields, same table, same write. **Design + component split only, no query change.**

**Second fix:** the composer is a modal on desktop and a modal on phone. On phone it should be a
full-screen sheet that keeps a draft in `localStorage` — the current one loses everything if the
browser backgrounds it, which on a cheap Android is often.

**Third fix, the smallest and highest-value:** the compose row's placeholder is
`what did you make today?`. Keep the string, but rotate a **second line** of category-specific
prompts under it when a filter is active ("post a drive recap", "share a lab result"). Copy change,
so it needs your sign-off.

---

## Comments

**Today:** a bottom sheet per card, comments fetched only when the sheet opens, optimistic insert
with rollback, profanity gate. The mechanics are good. The problem is that comments are **invisible
until you tap** — a post with 14 comments and a post with 0 look identical apart from a number.

**Proposal:**
- Show the **most recent comment inline** on the card (`01.15.7`). This is the single biggest
  comment-engagement change available and it is already specced.
  **Cost: one batched query in `useFeedCardBatch`** — do NOT add a per-card fetch, that is the
  N+1 the codebase already fixed once.
- **Reply-to-comment**, one level deep. Currently comments are flat, so a conversation with three
  people is unreadable. **New column (`parent_id`) — needs sign-off.**
- **@mention a member in a comment**, resolving against the existing member search the composer
  already uses. Drives notifications, which drives return visits. **Query reuse, plus a
  notification row.**
- **Keep the profanity gate exactly as it is**, including `BLOCK_MESSAGE`. It is doing real work in
  a product used by minors.

---

## Recognition — the gap left by retiring points

**Today:** points retired, achievements exist, Member of the Month exists as an HoD desk.

**Do not bring points back.** A leaderboard in a volunteer org rewards the loudest, not the most
useful, and you already decided that once.

**Proposal — three durable, non-competitive marks:**

1. **Streaks, but of *showing up*, not of posting.** "3 drives this term" is a fact about
   contribution. "12-day posting streak" is a fact about being online. Source it from
   `drives`/attendance, which already exists — the Drives desk assigns leads and tracks
   "real attendance vs still on paper".
2. **Firsts.** A sticker on the card for a member's first post, first drive, first team lead. This
   is what the `sticker` field on Post is for, and it is why `01.15.3` specs the sticker overlay.
   **Blocked on: does `Post` actually carry `sticker`?** — unresolved item 1 in `01`.
3. **Member of the Month, surfaced.** It is picked in the desk and then, as far as I can tell, goes
   nowhere on the public side. Put it in the right rail and on the profile. **Free — the data is
   already written.**

**And delete `pointsTile`.** Five of seven greeting recipes still render a retired metric. That is
worse than showing nothing.

---

## Notifications

**Today:** `notificationService` exists, a route exists, an unread dot is specced into both navs
(`02.4`, `02.6`).

**The question is not the surface, it is what earns a notification.** Proposal, in priority order:

1. someone commented on your post — **highest return-rate driver, and it exists today**
2. someone tagged you in a post — needs `post_tags` to fire one
3. your post was approved / rejected by a HoD — **this one is a duty, not engagement.** A member
   whose post sits in a queue for four days with no signal is the clearest failure in the product.
4. your team posted something
5. a drive you are down for is tomorrow
6. a role you saved closes in 2 days

**Deliberately not proposed:** "X liked your post" as an individual notification. At 128 likes on
one post that is 128 notifications. Batch it to a daily digest or omit it.

**One hard rule:** no notification without a destination. Every row must deep-link to the thing.

---

## Discovery

**Today:** a search page, a members directory, teams. All three are *lookup* tools — they work if
you already know what you want.

**Proposal:**
- **"People in your school"** on the profile and in the right rail. School is already on the member
  record and shown on every feed card. It is the strongest natural affinity in this product and it
  is currently unused as a discovery axis. **Free.**
- **Team pages as destinations, not directories.** A team page should show its drives, its members
  and its posts — the belonging problem you flagged. Its data all exists.
- **A "new members this week" strip.** Welcoming someone is the cheapest engagement act available
  and there is currently no surface for it. **Free — approvals already stamp a date.**

---

## Outward sharing

**Today:** a share button per card, and a poster studio behind `canMakePoster` (leadership only).

**Proposal:** a **public post page with real Open Graph tags** so a shared link renders as a card
with the photo, the title and the category. Right now a shared AquaTerra link is a bare URL, which
is why nothing spreads.

- `hooks/useMeta.ts` and `lib/metaConfig.ts` already exist, so the mechanism is there.
- **The catch:** this is a Vite SPA, so OG tags set client-side are not read by crawlers. It needs
  either prerendering for `/post/:uuid` or a small edge function. **That is an infrastructure
  decision, not a design one** — flag it and decide before I spec it.
- **Open the poster studio to everyone** for their own posts. It is the best asset this product
  makes and it is gated to the smallest group.

---

## What I would do first, in order

1. **Delete `pointsTile`.** One deletion, removes a lie from the most-visited surface. Free.
2. **Inline top comment** (`01.15.7`). One batched query. Biggest visible change per unit of work.
3. **Post approved / rejected notification.** A duty, not a growth feature.
4. **Backfill rule for quiet weeks.** One query, removes the "empty place" impression.
5. **Composer split.** Design work, no data work.
6. **For-you tab.** Query change, real product decision.
7. **OG tags on the post page.** Needs an infrastructure call first.

---

## Questions I need answered before any of this becomes a changelog file

1. Does `Post` carry `sticker` and tagged members? (Also unresolved in `01`.)
2. Is a `parent_id` on comments acceptable, or do comments stay flat?
3. Is attendance data good enough to build "3 drives this term" on, or is it still mostly on paper?
4. Can `/post/:uuid` be prerendered, or is client-side OG all we get?
5. Should the poster studio open up, or is the leadership gate deliberate?
6. Is Member of the Month currently surfaced anywhere public? I could not find it.
