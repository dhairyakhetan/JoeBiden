# 01 · Home / Feed

**Files touched:** `frontend/src/public/HomePage.tsx`, `frontend/src/feed/FeedPostCard.tsx`, `frontend/src/styles/routes/home.css`, `frontend/src/styles/routes/feed.css`
**Prerequisite:** `00-global-tokens-and-primitives.md` must be landed and verified first. Every
token named here is defined there.

## Global invariants (restated — do not skip)

1. **No new colours.** Every hex below already exists in `src/styles/tokens.css`.
2. **No new fonts, no new weights.** NeutralFace · Eina01 · JetBrains Mono · Instrument Serif.
3. **No copy changes.** Every user-facing string stays byte-identical, lowercase and trailing
   periods included.
4. **No route changes.**
5. **No Supabase changes.** No query, `select()` list, filter, service signature or return shape.
6. **No new dependencies.**
7. **Hit targets >= 44x44**, except the one documented 40px feed-footer exception, restated where it
   applies. Text contrast >= 4.5:1, or >= 3:1 for type >= 24px. `:focus-visible` stays
   `3px solid var(--grape)` at `outline-offset: 2px`.
8. **`prefers-reduced-motion` coverage must not regress.** Delete an animation, delete its
   reduced-motion line too.
9. **Do not touch `src/paradox/**`.**

## The concentric rule (restated — this is the spine of the whole redesign)

One number, two subtractions. It must hold **exactly**, everywhere, and it is checkable:

    outer radius  32px   with 10px padding  ->  inner radius  22px    (32 - 10)
    inner radius  22px   with  8px padding  ->  tight radius  14px    (22 -  8)

Tokens: `--r-outer: 32px` · `--r-inner: 22px` (= `--r-photo`) · `--r-tight: 14px` ·
`--pad-card: 10px` · `--pad-inner: 8px` · `--r-pill: 999px`.

It must hold at all nine of these:

1. **Photo inside a card** — card 32, padding 10, photo 22.
2. **Well or inset inside a card** — card 32, padding 10, well 22.
3. **Nav segment and its inner capsule** — bar 999, inner capsule 999, notch radius 20 against a
   56px bar leaving a 16px waist (see `02-global-chrome.md`).
4. **Bento tile inside a rail card** — rail 32, padding 10, tile 22. A chip inside that tile is 14.
5. **Modal and its inner sections** — modal 32, padding 10, section 22.
6. **Input inside a form card** — card 32, padding 10, input 22.
7. **Square avatar** — 14 when it sits inside a 22 well; 22 when it sits directly inside a 32 card.
8. **Table row inside a table container** — container 32, padding 10, row 22, cell chip 14.
9. **Three levels: device edge -> page shell -> card** — shell 32 inside the viewport, card 22 when
   the shell has 10px of padding. On phones where the shell is edge-to-edge with no padding, the
   card takes 32 directly, because 32 - 0 = 32.

**A radius that is not 999, 32, 22 or 14 is a bug.** If you write one, stop and ask.


**Design source:** `AquaTerra Feed.dc.html` — `1a` (phone), `1b` (desktop), `1c` (card before/after),
`3b` (the five rail cards, current version — `2b` is superseded, ignore it).

**What is NOT in this file:** the nav and the bottom tab bar. They are chrome, they render on every
route, and they live in `02-global-chrome.md`. `1a` and `1b` show them for context only — do not
build them from this file.

---

## 01.0 · Two live bugs to fix first

Both are already covered in `00`; restated because they are visible on this exact page and you will
chase ghosts without them.

- `styles/routes/home.css` uses `var(--poster-gutter)` for the feed-list gap in three places and
  the token is **defined nowhere**. The mobile feed currently has no gap and the cards touch.
  `00.18` adds `--poster-gutter: 12px` to `tokens.css`. Confirm it resolves before continuing.
- `styles/routes/feed.css` uses `var(--r-photo)` for `.feed-card-media` and the token is **defined
  nowhere**, so the photo currently has no radius at all. `00.1` adds `--r-photo: 22px`. Confirm.

## 01.1 · Page shell

**File:** `frontend/src/styles/routes/home.css`

- **SET** `.home-shell` `grid-template-columns`: `260px minmax(0, 1fr) 300px` -> `260px minmax(0, 1fr) 300px` (unchanged; confirm)
- **SET** `.home-shell` `gap`: `24px` -> `20px`
- **KEEP** `.home-shell` `max-width: var(--frame-max)` and `padding: 24px var(--page-px) 64px`
- **DELETE** the entire `.home-3col` rule block. Grep `home-3col` across `src/**`: it has **no
  callers**. It is a second, competing three-column definition (`280px minmax(0,620px) 320px`,
  `gap: 24px`, `max-width: 1280px`) that has drifted away from `.home-shell` and exists only to
  confuse the next person. Delete `.home-3col`, `.home-side`, `.home-side::-webkit-scrollbar`,
  `.home-side::-webkit-scrollbar-thumb` and `.side-link` **only after confirming with grep that
  each has no caller.**
- **SET** `.home-shell { --r-row: 16px; --r-rail: 24px; }` -> `.home-shell { --r-row: 22px; --r-rail: 32px; }`
  These are the two "values with no token" the file's own comment admits to. They now land on the scale.
- **DELETE** `--r-row` and `--r-rail` afterwards **if** you can replace every use with
  `var(--r-inner)` and `var(--r-outer)` respectively. Two names for one number is how the radius
  spread happened. Do this as a find-replace within `home.css` only.

## 01.2 · Rail card shell

**File:** `frontend/src/styles/routes/home.css`

- **SET** `.rail-card` `border`: `var(--bd)` -> `var(--hair-2)`
- **SET** `.rail-card` `box-shadow`: `var(--sh-sm)` -> `var(--lift-1)`
- **SET** `.rail-card` `border-radius`: `var(--r-outer)` -> `var(--r-outer)` (unchanged token, now 32px)
- **SET** `.rail-card` `padding`: `16px` -> `var(--pad-card)` (10px)
- **SET** `.rail-card` `gap`: `10px` -> `8px`
- **DELETE** the `.home-shell .rail-card` override block entirely (`background: #fff; border-radius: var(--r-rail); box-shadow: none`).
  Its three declarations are now identical to the base rule's, so it is pure noise. `background: #fff`
  in particular must go — it is a raw hex where `var(--card)` belongs.
- **CONSEQUENCE:** `.rail-card` now has 10px of padding, not 16px. Every direct child inside it that
  previously relied on the card's 16px padding for its own inset must be re-checked. The rail cards
  in `HomePage.tsx` that pass `style={{ padding: '16px 16px 14px' }}` inline (there are three: notice
  board, open roles, quick links) must have that inline `padding` **DELETED** so the class value wins.
- **ADD** a header sub-rule, because every rail card now has one and they are currently three
  different hand-rolled inline blocks:
  ```css
  .rail-card > .rail-h { padding: 6px var(--pad-inner) 12px; margin: 0; }
  ```
  and **DELETE** the inline `style={{ marginBottom: 12 }}` / `{{ marginBottom: 14 }}` on the three
  `.rail-h` elements in `HomePage.tsx`.

## 01.3 · Left rail · profile block

**Design:** `3b`, first tile. **File:** `frontend/src/public/HomePage.tsx`, `LeftRail`.

The block becomes an **ink** card with three stat tiles, one of which is the hero.

- **SET** the wrapper `<div className="rail-card rail-id">`: **DELETE** its inline
  `style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}`.
- **ADD** to that wrapper: `style={{ background: 'var(--ink)', borderColor: 'var(--ink)' }}`
- **SET** the `.rail-id-row` button's inner `.rail-id-name`: `fontSize: 15` -> **DELETE the inline
  fontSize** and **SET** in `home.css`: `.rail-id-name { font-size: 18px }` -> `font-size: 19px; font-weight: 900; letter-spacing: -0.035em; line-height: 1; color: var(--paper);`
- **SET** the avatar in that row: `width: 44, height: 44, fontSize: 15` -> `width: 52, height: 52, fontSize: 18`
- **SET** the handle line `@{member.uuid?.slice(0, 8)}`: **KEEP the string**, and **SET** its class
  from `mono xs muted` -> `mono xs` with `style={{ color: 'rgba(244,239,224,0.55)' }}`.
  `muted` resolves to `--ink-3` (#5A5A55) which is invisible on ink.
- **SET** the chevron SVG's `style={{ opacity: 0.3 }}` -> `style={{ opacity: 1, color: 'rgba(244,239,224,0.45)' }}`
- **REPLACE** the `.rail-id-stats` grid. **SET** in `home.css`:
  ```css
  .rail-id-stats {
    display: grid;
    grid-template-columns: 1fr 1.35fr 1fr;   /* the hero column is wider */
    gap: var(--pad-inner);
    padding: 0;                               /* was 14px 16px 16px */
    border-top: none;                         /* was 1px dashed var(--line) */
    margin-top: 0;                            /* was 12px */
  }
  .rail-id-stats > div {
    display: block;                            /* was flex/column/center */
    align-items: initial;
    border-radius: var(--r-inner);             /* 22 inside the 32 card at 10px padding */
    padding: 13px 12px;
    background: rgba(244,239,224,0.09);        /* quiet tiles: paper at 9% on ink */
  }
  .rail-id-stats > div.is-hero {
    background: var(--tomato);                 /* the hero tile, full saturation */
    position: relative;
    overflow: hidden;
  }
  /* the one bleeding shape. A circle, ink at 11%, cropped by the tile. */
  .rail-id-stats > div.is-hero::after {
    content: "";
    position: absolute;
    right: -26px; bottom: -30px;
    width: 96px; height: 96px;
    border-radius: var(--r-pill);
    background: rgba(10,10,10,0.11);
    pointer-events: none;
  }
  .rail-id-stats b {
    display: block;
    font-family: var(--display);
    font-size: 24px; font-weight: 900; line-height: 1;
    color: var(--paper);
    font-variant-numeric: tabular-nums;
    position: relative;
  }
  .rail-id-stats > div.is-hero b { font-size: 30px; color: var(--ink); }
  .rail-id-stats span {
    display: block;
    font-family: var(--mono);
    font-size: 9px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.05em;
    color: rgba(244,239,224,0.55);
    margin-top: 6px;
    position: relative;
  }
  .rail-id-stats > div.is-hero span { color: rgba(10,10,10,0.66); }
  ```
- **ADD** `className="is-hero"` to the **likes** `<div>` (the middle one). Reason: posts and teams are
  counts of what the member did administratively; likes is the only number that reflects other
  people responding to them, and it is the one worth making the subject.
- **SET** the likes label string: `likes` -> `likes`. **KEEP the string.** Do not change it to
  "likes earned" — the design mock shows that longer label but the copy freeze wins. If you want it
  changed, ask.
- **DELETE** the inline `style={{ fontVariantNumeric: 'tabular-nums' }}` on all three `<b>` elements
  (the class rule above supplies it).
- **DELETE** the inline `style={{ marginTop: 0 }}` on `.rail-id-stats`.
- **KEEP** the `{userPostCount ?? '–'}` / `{userLikeCount ?? '–'}` / `{userTeamCount ?? '–'}`
  fallbacks exactly. An en-dash for "not yet loaded" is correct; a zero would be a claim.
- **DELETE** the unused `.rail-id-cover` and `.rail-id-body` rules from `home.css` **only after
  grepping** — the current `LeftRail` renders neither.

## 01.4 · Left rail · guest "join the chaos" card

**File:** `frontend/src/public/HomePage.tsx`, `LeftRail`, the `) : (` branch.

- **DELETE** the `<span className="deco star" aria-hidden style={{ top: -12, right: -8, width: 24, height: 24 }} />`
  element. (`00.13` deletes the `.deco` system.)
- **SET** the wrapper's inline `border: '2px solid #0A0A0A'` -> `border: 'none'`
- **SET** the wrapper's inline `background: '#0A0A0A'` -> `background: 'var(--ink)'` (raw hex -> token)
- **SET** the wrapper's inline `color: '#ffffff'` -> `color: 'var(--paper)'`
- **SET** `overflow: 'visible'` -> **DELETE** it (nothing overflows now that the star is gone)
- **KEEP** the `<span className="sticker">★ kolkata, 2021</span>` exactly, including
  `transform: 'rotate(-3deg)'`. **SET** that rotation to `rotate(-2.5deg)` to match `00.8`.
- **SET** the sticker's inline `background: 'var(--welfare)'` -> `background: 'var(--lemon)'`.
  Reason: welfare green means "the welfare vertical" everywhere else in the product, and this
  sticker is not about welfare. Lemon is the sticker colour per `00.8`.
- **ADD** to the sticker's inline style: `border: '2px solid var(--ink)', boxShadow: '2px 2px 0 0 var(--ink)'`
- **KEEP** the display line `join the <em>chaos</em>.` and the Instrument Serif italic treatment on
  "chaos" in `var(--welfare)` — this is the one serif flourish on the surface and it stays.
- **SET** the paragraph's inline `color: 'rgba(255,255,255,0.6)'` -> `color: 'rgba(244,239,224,0.66)'`.
  Reason: pure white at 60% on ink measures 4.1:1 and fails AA for 13px body. Paper at 66% clears it.
- **KEEP** the string `Usually replies within a week. free forever.`
- **KEEP** the `<Link to="/login" className="btn btn-sm btn-primary">Join the work →</Link>`. It is
  a primary CTA, so it keeps the hard offset per `00.6`.

## 01.5 · Left rail · browse / category tiles

**Design:** `3b`, second tile. **File:** `HomePage.tsx` `LeftRail` + `home.css`.

- **KEEP** the `CATS` array in `HomePage.tsx` exactly: six entries, same order, same `k` slugs,
  same `l` labels, same icons. **KEEP** the `color` field. **DELETE** the `bg` field from all six
  entries and delete every read of it — the tint is now computed in CSS from a single alpha, not
  hand-written per entry as `rgba(27,138,90,0.13)` etc. Those six hard-coded rgba strings are the
  palette written a second time and they will drift.
- **SET** `.rail-cat-grid` in `home.css`:
  ```css
  .rail-cat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: 66px;
    gap: var(--pad-inner);
  }
  ```
- **SET** `.rail-cat-tile`:
  ```css
  .rail-cat-tile {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;      /* was center */
    gap: 0;                        /* was 6px; space-between owns it now */
    padding: 11px 13px;            /* was 14px 10px 12px */
    border: none;                  /* was 2px solid transparent */
    border-radius: var(--r-inner); /* 22, was var(--r-photo) which was undefined */
    background: color-mix(in srgb, var(--cc) 22%, transparent);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: background 0.18s var(--ease-out), transform 0.14s var(--ease-out);
  }
  .rail-cat-tile:hover  { background: color-mix(in srgb, var(--cc) 30%, transparent); transform: none; }
  .rail-cat-tile:active { transform: scale(0.96); }
  /* labs is the one hue that needs more alpha to read at all — #FFC700 at 22%
     over cream is almost invisible. This is not a special case for taste, it is
     luminance: lemon is the only accent lighter than the paper it sits on. */
  .rail-cat-tile.cat-labs { background: color-mix(in srgb, var(--c-labs) 30%, transparent); }
  .rail-cat-tile.cat-labs:hover { background: color-mix(in srgb, var(--c-labs) 38%, transparent); }
  ```
- **DELETE** `.rail-cat-tile:hover { transform: translateY(-1px); background: var(--bg-3); }` — replaced above.
- **SET** the ACTIVE tile. **DELETE** the inline `style` object on the `<button className="rail-cat-tile">`
  in `HomePage.tsx` entirely (the four-property `background`/`color`/`borderColor`/`boxShadow`
  ternary block). **ADD** instead: `className={'rail-cat-tile cat-' + (c.k || 'all') + (isActive ? ' is-hero' : '')}`
  and `style={{ ['--cc']: c.color }}`. Then in `home.css`:
  ```css
  .rail-cat-tile.is-hero {
    background: var(--cc);              /* full saturation — one hero per card */
    color: var(--ink);
  }
  .rail-cat-tile.is-hero::after {       /* the one bleeding shape */
    content: "";
    position: absolute;
    left: -20px; top: -32px;
    width: 88px; height: 88px;
    border-radius: var(--r-pill);
    background: rgba(10,10,10,0.10);
    pointer-events: none;
  }
  .rail-cat-tile.cat-all { --cc: var(--welfare); }
  ```
- **SET** the "All" tile to span both columns and read as a bar, because it is the reset and not a
  peer of the five verticals:
  ```css
  .rail-cat-tile.cat-all {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 12px 15px;
  }
  .rail-cat-tile.cat-all .rail-cat-tile-icon { display: none; }
  ```
  **KEEP the label string `All`.** Do not change it to "everything" — the mock shows that, the copy
  freeze wins. Ask if you want it.
- **SET** `.rail-cat-tile-label`: `font-size: 11px` -> `font-size: 11px` (confirm), and
  **KEEP** `font-family: var(--display); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em`.
  **SET** `font-weight`: `700` -> `800`.
- **SET** `.rail-cat-tile-icon`: **DELETE** `font-size: 22px` and `width/height: 28px`; **SET**
  `width: 19px; height: 19px;` and **SET** the nested `svg` rule from `22px !important` -> `19px`
  (and **DELETE** the `!important`).
- **DELETE** `.rail-cat-tile:hover .rail-cat-tile-icon { transform: scale(1.15); }` — icons no
  longer scale on hover; the tile's fill deepening carries it.
- **SET** the icon colour: **DELETE** the inline `style={{ color: isActive ? '#0A0A0A' : c.color }}`
  on the icon span. **ADD** in CSS: `.rail-cat-tile-icon { color: var(--cc-ink, var(--cc)); }` and
  `.rail-cat-tile.is-hero .rail-cat-tile-icon { color: var(--ink); }`. Then set `--cc-ink` per tile:
  ```css
  .rail-cat-tile.cat-welfare    { --cc-ink: var(--welfare-ink); }
  .rail-cat-tile.cat-events     { --cc-ink: var(--sky-ink); }
  .rail-cat-tile.cat-labs       { --cc-ink: var(--lemon-ink); }
  .rail-cat-tile.cat-operations { --cc-ink: var(--ops); }      /* #12909C already clears AA */
  .rail-cat-tile.cat-content    { --cc-ink: var(--grape-ink); }
  ```
  **This matters for accessibility, not looks.** The raw hues fail 4.5:1 as glyph colour on a light
  ground (`tokens.css` documents each measurement); the `*-ink` partners are the same hue darkened
  until they pass.
- **SET** `.rail-cat-tile-badge`: **DELETE** the rule entirely, and **DELETE** the
  `{isActive && <span className="rail-cat-tile-badge">{postCount}</span>}` element. The count now
  renders in the "All" bar's right slot only. Reason: it read as a notification badge on a filter,
  and it was clipped by `overflow: hidden` at the old `scale(1.04)`.
- **ADD** the count to the "All" tile: `{c.k === '' && <span className="mono rail-cat-count">{postCount}</span>}`
  with `.rail-cat-count { font-size: 11.5px; font-weight: 800; color: rgba(10,10,10,0.62); }`
- **KEEP** the `.rail-cats-sticker` "pick one" die-cut. **SET** its `background` from
  `var(--welfare)` -> `var(--lemon)` (same reason as 01.4), and **ADD**
  `border: 2px solid var(--ink); box-shadow: 2px 2px 0 0 var(--ink);`, and **DELETE**
  `--keyline-bg` / `box-shadow: var(--keyline)` — the keyline system is replaced by the plain
  ink border + offset that `00.8` standardises for all stickers.
- **SET** its `transform: rotate(-3deg)` -> `rotate(-2.5deg)`
- **KEEP** the string `pick one` and the `aria-hidden="true"`.

## 01.6 · Left rail · log out

**File:** `home.css`

- **SET** `.rail-logout-btn` `border-radius`: `var(--r-inner)` -> `var(--r-pill)`
- **KEEP** `min-height: 44px`, the mono uppercase type, and the string `log out →`
- **SET** `:hover` `background`: `var(--bg-3)` -> `var(--bg-2)`

## 01.7 · Right rail · notice board

**Design:** `3b`, third tile. **File:** `HomePage.tsx` `RightRail` + `home.css`.

The three pins stop being three equal rows and become a hero card with a peeking stack.

- **DELETE** the inline `style={{ padding: '16px 16px 14px' }}` on the notice-board `.rail-card`.
- **KEEP** the `<Mascot character="tuk" pose="sleep" size={26} />` in the header, and **KEEP** the
  string `notice board`.
- **SET** the header label's inline style: **DELETE** `fontFamily: 'var(--display)', fontWeight: 800, fontSize: 13`
  and **ADD** a class `rail-card-title` with:
  ```css
  .rail-card-title {
    font-family: var(--display);
    font-size: 14px; font-weight: 800; letter-spacing: -0.02em;
    display: inline-flex; align-items: center; gap: 6px;
  }
  ```
  Apply the same class to the "open roles" and "quick links" headers, deleting their identical
  inline style objects too. Three copies of one declaration is how they drift.
- **REPLACE** the pins loop. The **first** notice renders as the hero, the rest as stubs:
  - Hero (`idx === 0`): a `<Link>` with class `rail-notice-hero`, background = the category hue at
    full saturation, containing (a) a mono uppercase line `pin {idx+1} of {notices.length} · {category}`,
    (b) the title in NeutralFace, (c) a mono meta line `by {authorName}`.
  - Stubs (`idx > 0`): a `<Link>` with class `rail-notice-stub`, rendering as a shallow strip
    peeking out from under the hero. Only its hue is visible; no text.
  ```css
  .rail-notice-hero {
    position: relative; display: block; overflow: hidden;
    border-radius: var(--r-inner);
    padding: 15px;
    text-decoration: none;
    background: var(--cc);
  }
  .rail-notice-hero::after {           /* the one bleeding shape */
    content: ""; position: absolute; right: -32px; top: -36px;
    width: 112px; height: 112px; border-radius: var(--r-pill);
    background: rgba(10,10,10,0.10); pointer-events: none;
  }
  .rail-notice-hero > * { position: relative; }
  .rail-notice-eyebrow {
    font-family: var(--mono); font-size: 9px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.06em;
    color: rgba(10,10,10,0.62);
  }
  .rail-notice-title {
    font-family: var(--display); font-size: 18px; font-weight: 900;
    letter-spacing: -0.03em; line-height: 1.1; margin-top: 9px;
    color: var(--ink);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .rail-notice-meta {
    font-family: var(--mono); font-size: 10px; margin-top: 8px;
    color: rgba(10,10,10,0.62);
  }
  /* the stack. Each stub is pulled up under the card above it and only its
     bottom edge shows, so three pins read as a deck of three. */
  .rail-notice-stub {
    display: block; height: 22px;
    margin: -9px 9px 0;
    border-radius: 0 0 var(--r-inner) var(--r-inner);
    background: color-mix(in srgb, var(--cc) 22%, transparent);
  }
  .rail-notice-stub + .rail-notice-stub { height: 19px; margin: -9px 18px 0; }
  ```
- **ADD** a dot indicator under the stack, three 4px-tall pills, the first 20px wide and ink, the
  rest 6px wide at 20% ink. Class `rail-notice-dots`. It is not a control — add `aria-hidden`.
- **KEEP** the empty state strings exactly: `nothing pinned yet - click edit to add posts.` and
  `nothing posted yet.` **SET** their inline `fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)'`
  into a shared class `rail-empty` with the same three values, and reuse it for the open-roles empty
  state (`no openings right now`) which currently repeats it inline.
- **SET** the loading skeletons: `style={{ height: 46, borderRadius: 16 }}` -> `style={{ height: 46, borderRadius: 22 }}`
  for the first and **SET** the array from `[0, 1, 2]` -> `[0]`. One skeleton, because one hero
  card loads. Three skeletons for one card plus two 22px strips misrepresents the layout.
- **DELETE** `.rail-evrow`, `.rail-evrow-cap`, `.rail-evrow-info`, `.rail-evrow-title`,
  `.rail-evrow-meta` from `home.css` **after** confirming with grep that the notice board was
  their only caller.
- **KEEP** the `taped` class on the card **only if** grep finds a `.taped` rule. If it exists,
  **DELETE** the rule and the class — the scrapbook tape strip is part of the removed decorative
  layer (`00.13`).
- **KEEP** `NoticeBoardEditModal` behaviour and every string in it. **SET** its container
  `borderRadius: 20` -> `32`, `border: '2px solid var(--ink)'` -> `var(--hair-2)`,
  `boxShadow: '6px 6px 0 var(--ink)'` -> `var(--lift-4)`. **SET** each pinned-item card inside it
  from `borderRadius: 14, border: '2px solid var(--ink)', boxShadow: '2px 2px 0 0 var(--ink)'` ->
  `borderRadius: 22, border: 'none', background: 'var(--bg)'`. **SET** the search-results container
  `borderRadius: 14, border: '2px solid var(--line-2)'` -> `borderRadius: 22, border: 'none', background: 'var(--bg)'`.
  **SET** `inputSt.borderRadius` `14` -> `22` and `inputSt.border` `'2px solid var(--ink)'` -> `'var(--hair-3)'`.
  **SET** the `addingTitle` panel's `background: 'rgba(0,229,160,0.05)'` -> `'color-mix(in srgb, var(--welfare) 8%, transparent)'`.
  **`rgba(0,229,160,...)` is a mint that exists in no token** — it is a hand-added colour and violates
  invariant 1. Same bug the file's own comment flags elsewhere.

## 01.8 · Right rail · open roles

**Design:** `3b`, fourth tile. **File:** `HomePage.tsx` `RightRail` + `home.css`.

- **DELETE** the inline `style={{ padding: '16px 16px 14px' }}`.
- **KEEP** the strings `open roles`, `all`, `view all openings →`, `no openings right now`.
- **SET** the header's right-hand element: **KEEP** `<Link to="/opportunities" className="linktab rail-h-link">all</Link>`.
  **ADD** beside it a mono count `{railOpenRoles.length} live` **only if** you can source the number
  without a new query — `jobOpenings.getOpen()` already returns the full array before `.slice(0,3)`,
  so capture its length into state first. **If that is not clean, omit the count entirely.** Do not
  render a figure you had to invent.
- **SET** the roles loop so the **first** role is the hero:
  ```css
  .rail-role {
    display: flex; align-items: center; gap: 11px;
    min-height: 44px; padding: 13px 14px;
    border-radius: var(--r-inner);          /* 22, was var(--r-row) = 16 */
    border: none;                            /* was var(--bd) = 2px solid ink */
    background: color-mix(in srgb, var(--rc) 22%, transparent);
    text-decoration: none;
    transition: background 0.16s var(--ease-out);
  }
  .rail-role:hover  { background: color-mix(in srgb, var(--rc) 30%, transparent); transform: none; }
  .rail-role:active { transform: scale(0.98); }
  .rail-role.is-hero {
    display: block; position: relative; overflow: hidden;
    padding: 14px 15px;
    background: var(--rc);
  }
  .rail-role.is-hero::after {
    content: ""; position: absolute; right: -30px; bottom: -34px;
    width: 104px; height: 104px; border-radius: var(--r-pill);
    background: rgba(10,10,10,0.10); pointer-events: none;
  }
  .rail-role.is-hero .rail-role-title {
    font-family: var(--display); font-size: 17px; font-weight: 900;
    letter-spacing: -0.03em; line-height: 1.14;
    white-space: normal;                     /* the hero may wrap to two lines */
    max-width: 78%;                          /* clear of the corner sticker */
    position: relative;
  }
  .rail-role.is-hero .rail-role-meta { color: rgba(10,10,10,0.66); position: relative; }
  .rail-role.is-hero .rail-role-dot,
  .rail-role.is-hero .rail-role-arrow { display: none; }
  ```
- **DELETE** `.rail-role:hover { transform: translateY(-2px); box-shadow: 3px 3px 0 0 var(--ink); }`
  and `.rail-role:active { ... box-shadow: 1px 1px 0 0 var(--ink); }` — replaced above.
- **SET** the non-hero rows' trailing affordance: **DELETE** the `.rail-role-arrow` `→` glyph and
  **ADD** a 32px white circle containing a 14px arrow-out-of-box icon:
  ```css
  .rail-role-go {
    width: 32px; height: 32px; border-radius: var(--r-pill);
    background: var(--card); display: grid; place-items: center; flex: none;
  }
  ```
  **DELETE** `.rail-role-arrow` and `.rail-role:hover .rail-role-arrow` from `home.css`.
- **SET** `.rail-role-dot`: **DELETE** the `box-shadow: 0 0 0 3px color-mix(...)` halo. The tile is
  now tinted with the same hue, so a halo of that hue on that tint is invisible work.
- **SET** `.rail-role-title`: `font-family: var(--display)` -> `font-family: var(--eina)`,
  `font-size: 13px` -> `14px`, `font-weight: 700` -> `700` (confirm).
  Reason: NeutralFace is caps-only, so a role title in it renders as shouting; the codebase already
  notes this problem in `AQNav.css`.
- **SET** `.rail-role-meta` `color`: `var(--ink-3)` -> `var(--rc-ink)`, and set `--rc-ink` per
  category on the row from the `*-ink` partners exactly as in 01.5. **KEEP** `font-family: var(--mono)`,
  `font-size: 10px`, `text-transform: uppercase`.
- **ADD** the closing-soon sticker to the hero **only when a deadline exists and is within 7 days**.
  Markup: a `<span className="sticker rail-role-sticker">closes {short day}</span>`, positioned
  `top: 11px; right: 12px; transform: rotate(2deg)`, background `var(--tomato)`, ink text, 2px ink
  border, `2px 2px 0` offset. **The deadline field already exists** — `FeedPostCard.tsx` reads
  `op.deadline` for hiring cards. **If `jobOpenings.getOpen()` does not return it, omit the sticker.
  Do not add it to the query.**
- **SET** the "view all openings →" link: `className="btn btn-sm"` -> keep, but **SET** its inline
  style `width: '100%', marginTop: 10, justifyContent: 'center', fontSize: 11, fontFamily: 'var(--mono)'`
  -> **ADD** a class `rail-card-cta`:
  ```css
  .rail-card-cta {
    display: flex; align-items: center; justify-content: center;
    min-height: 44px; margin-top: var(--pad-inner);
    border-radius: var(--r-pill);
    background: var(--ink); color: var(--paper);
    border: none; box-shadow: none;
    font-family: var(--mono); font-size: 11px; font-weight: 800;
    letter-spacing: 0.05em; text-transform: uppercase;
    text-decoration: none;
  }
  ```
- **SET** the loading skeletons `borderRadius: 16` -> `22`.

## 01.9 · Right rail · quick links

**Design:** `3b`, fifth tile. **File:** `HomePage.tsx` `RightRail` + `home.css`.

- **DELETE** the inline `style={{ padding: '16px 16px 14px' }}`.
- **DELETE** the header row entirely — the `<span>quick links</span>` label and the
  `<Link to="/links">all</Link>`. Reason: the tiles are self-labelling, and the card is now the
  last thing in the rail, so a header for six labelled tiles is a label for labels. **This deletes
  the strings `quick links` and that `all` link.** It is the only string deletion in this file —
  if you would rather keep them, keep them and skip this instruction.
- **KEEP** the `RAIL_QUICK_LINKS` array: same six entries, same order, same `to` paths, same
  labels (`Projects`, `Teams`, `Blog`, `Members`, `Open Roles`, `About`), same `c` hues.
- **SET** `.rail-quicklink-pair` -> rename to `.rail-quicklink-grid` and:
  ```css
  .rail-quicklink-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: 82px;
    gap: var(--pad-inner);
  }
  ```
  **DELETE** the old `.rail-quicklink-pair` and the pre-existing unused `.rail-quicklink-grid` /
  `.launchgrid` rules **after grepping** for callers.
- **SET** `.rail-quicklink`:
  ```css
  .rail-quicklink {
    display: flex; flex-direction: column; justify-content: space-between;
    gap: 0;                                  /* was 8px */
    min-height: 44px;                         /* the 82px row already clears it */
    padding: 13px;
    border-radius: var(--r-inner);           /* 22, was var(--r-tight) = 10 */
    border: none;                             /* was var(--bd) = 2px solid ink */
    box-shadow: none;                         /* was 2px 2px 0 var(--ink) */
    background: color-mix(in srgb, var(--qc) 22%, transparent);
    text-decoration: none;
    font-family: var(--display);
    font-weight: 900;                         /* was 700 */
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.01em;
    color: var(--ink);
  }
  .rail-quicklink svg { width: 20px; height: 20px; color: var(--qc-ink); }
  ```
  Set `--qc` and `--qc-ink` per link inline from the array's `c` value and its `*-ink` partner.
- **DELETE** `.rail-quicklink-dot` and the `<span className="rail-quicklink-dot">` element. The
  tile's own tint now carries the hue; a dot of the same hue on that tint is redundant.
- **ADD** an icon to each of the six entries. **This is the one place this file adds content.** Six
  20px stroke icons at `stroke-width: 2.2`, `stroke-linecap/linejoin: round`, from the existing
  `I.*` set in `components/v6Shared.tsx`. **See 01.19 for the full mapping** — `Blog` is `I.pen`,
  `Open Roles` is `I.star`, `About` is `I.globe`. `Projects`, `Teams` and `Members` have no match;
  01.19 gives three options and names the right one. **Do not hand-write an inline SVG here.**
- **SET** the spans: `Projects` spans 2 columns; `Teams`, `Blog`, `Members`, `Open Roles` span 1;
  `About` spans 2 and is the **hero**:
  ```css
  .rail-quicklink.is-wide { grid-column: span 2; }
  .rail-quicklink.is-hero {
    grid-column: span 2;
    position: relative; overflow: hidden;
    flex-direction: row; align-items: center; gap: 13px;
    padding: 13px 15px;
    background: var(--ink);
    color: var(--paper);
  }
  .rail-quicklink.is-hero::after {
    content: ""; position: absolute; right: -24px; top: -30px;
    width: 96px; height: 96px; border-radius: var(--r-pill);
    background: rgba(244,239,224,0.07); pointer-events: none;
  }
  .rail-quicklink.is-hero > * { position: relative; }
  .rail-quicklink.is-hero svg { color: var(--lemon); }
  ```
- **ADD** to the About hero only: the logo at 32px with `filter: brightness(0) invert(1)`, and a
  mono sub-line. **The sub-line must come from `lib/orgFacts.ts`** — it already holds the founding
  facts. Do **not** hard-code `kolkata · since 2021`; read it. If `orgFacts` does not expose it,
  omit the sub-line.
- **KEEP** the `.rail-foot` footer strings `aquaterra · open access`, `· v7 ·`, `made with care`
  exactly. **Do not bump the version string to v8** — that is a product decision, not a design one.

## 01.10 · Centre column · the greeting block

**Design:** `1b`, top of centre column. **File:** `HomePage.tsx` + `components/AdaptiveGrid`.

- **KEEP** `AdaptiveGrid` mounted exactly as it is, with the same `ctx`, `eyebrow`, `greeting`,
  `line` and `sticker` props. **KEEP** the `isActive &&` gate — the block is absent for guests.
- **KEEP** every string in `HI_LINES` and the `timeOfDayWord` / `greeting` construction, including
  the `.toUpperCase()` (NeutralFace has no lowercase glyphs).
- **KEEP** `<Mascot character="nolen" pose={hi.recipeId === 'G33' ? 'sleep' : 'idle'} size={44} />`
  and the `.home-hi-mascot` positioning rules.
- **AdaptiveGrid is imported and never modified** per the file's own comment. So the only changes
  available from this document are the placement rules in `home.css`:
  - **SET** `.home-center > .aqg-block` `margin-bottom`: `2px` -> `0` (the column's gap owns it)
  - **SET** `@media (min-width: 1025px) { .home-center .aqg-grid { grid-auto-rows: 84px } }` -> `grid-auto-rows: 84px` (unchanged; confirm)
  - **KEEP** `.home-center .aqg-head { padding-right: 70px }` and its 600px variant
- **DO NOT** restyle the block's tiles from here. `AdaptiveGrid` and `lib/gridRecipes.ts` own them
  and they are outside this file's scope. **Log this as unresolved:** the block's radii will be
  whatever `AdaptiveGrid` hard-codes, which is probably not 32/22/14, and the concentric rule
  therefore does **not** hold inside it after this pass. It needs its own file.
- **KEEP** the known defect noted in the source: five of seven recipes still render a "your points"
  tile from `lib/gridRecipes.pointsTile` although the points system was retired 2026-09-04. **It is
  not this file's to fix.** Do not delete `pointsTile` here.

## 01.11 · Centre column · masthead

**File:** `HomePage.tsx` + `home.css`

- **KEEP** `<h1 className="sr-only">AquaTerra, a student-led NGO and community in Kolkata</h1>` exactly.
- **KEEP** the `<h2>` and its string `the <em>feed</em>.` with Instrument Serif italic on "feed" in
  `var(--welfare)`.
- **DELETE** the `className="underline-doodle"` from the `feed` span, and **DELETE** the
  `.underline-doodle` rule from `v6.css` after grepping for other callers. It is part of the
  decorative layer removed in `00.13`.
- **DELETE** the two `<span className="deco star">` / `<span className="deco ring">` elements from
  `.home-feed-head`, and **DELETE** the now-pointless `style={{ position: 'relative' }}` on the
  `<header>` (nothing is absolutely positioned inside it any more).
- **SET** `.home-feed-title` `font-size`: `44px` -> `52px`; **ADD** `font-weight: 900; letter-spacing: -0.045em; line-height: 0.9;`
- **SET** the 600px variant `.home-feed-title { font-size: 36px }` -> `font-size: 56px`.
  **Yes, larger on the phone than the old desktop value.** This is the moticket / Weezy reference:
  the page title is the loudest thing on a phone screen and there is nothing competing with it in a
  single column. Verify it does not wrap to three lines at 320px; if it does, use `clamp(44px, 14vw, 56px)`.
- **KEEP** `.home-feed-meta` exactly — mono, 10px, 700, uppercase, `--ink-3`, and the frozen string
  `{filter || 'everything'} · {sort} · {n} posts`.
- **SET** `.home-feed-actions`: the two controls become `.tab` rather than `.chip`, because they are
  a sort selector (one of a set), not filters. **SET** `className={'chip ' + (sort === 'latest' ? 'chip-active' : '')}`
  -> `className={'tab ' + (sort === 'latest' ? 'on' : '')}`. **KEEP** the `<I.pulse />` icon and the
  string `latest`. **KEEP** the openings `<Link className="chip">` as a chip — it is a destination,
  not a sort — and **DELETE** its inline `style` object (`00.7` gives `.chip` the flex/gap/align it needs).
- **KEEP** `@media (max-width: 600px) { .home-feed-actions { display: none } }`. The row is
  genuinely redundant on a phone.

## 01.12 · Centre column · compose row

**File:** `HomePage.tsx` + `home.css`

- **SET** `.home-compose` `padding`: `13px` -> `var(--pad-card)` (10px)
- **SET** `.home-compose` `border-radius`: `var(--r-rail)` -> `var(--r-outer)`
- **SET** `.home-compose` `gap`: `11px` -> `0`
- **ADD** an inner row so the concentric rule holds — the current markup puts the avatar, the
  prompt and the buttons as direct children of the card, so there is no 22px layer at all:
  ```css
  .home-compose-row {
    display: flex; align-items: center; gap: 11px;
    background: var(--bg);                    /* cream inset in a white card = layer L2 */
    border-radius: var(--r-inner);            /* 22 */
    padding: 9px 9px 9px 12px;
  }
  ```
  Wrap the avatar, the `.home-compose-input` button and the `.row.gap-1` cluster in this div.
- **SET** `.home-compose-input`: **DELETE** `background: var(--paper)`, `border: var(--bd)` and
  `border-radius: var(--r-pill)`. It now sits **on** the cream row rather than being its own inset,
  so it becomes plain text: `background: transparent; border: none; padding: 0;`
  **KEEP** `flex: 1 1 auto; min-width: 0; min-height: 46px; text-align: left; color: var(--ink-3); font-family: var(--eina); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`
  **SET** `font-size`: `14px` -> `14.5px`
  **KEEP** the string `what did you make today?`
- **DELETE** `.home-compose-input:active { background: var(--bg-3); }` — there is no longer a filled
  surface to darken. **ADD** `.home-compose-row:active { background: var(--bg-2); }` instead, so the
  whole row responds.
- **SET** the two ghost icon buttons (camera, link): **KEEP** both elements and both `aria-label`s.
  **SET** their class `btn btn-sm btn-ghost` -> `btn btn-sm btn-ghost home-compose-icon` with:
  ```css
  .home-compose-icon {
    width: 40px; height: 40px; min-width: 40px; padding: 0;
    border-radius: var(--r-pill);
    background: var(--card);                  /* white pill on the cream row = layer L3 */
    border: none; box-shadow: none;
    display: grid; place-items: center;
  }
  ```
  **40px, not 44.** This is the same considered trade the feed footer documents: the row holds an
  avatar, a flexible prompt and three controls, and 3 x 44 plus gaps overflows a 375px card. 40px
  still clears WCAG 2.5.8 AA (24px). **Do not "fix" it to 44 without removing a control.**
- **DELETE** `@media (max-width: 600px) { .home-compose .row.gap-1 .btn-ghost { display: none } }`.
  With the icons at 40px in a 22px row the phone now has room, and hiding them meant the phone's
  only route to photo-attach was the modal.
- **KEEP** the `Post` button as `btn btn-sm btn-primary` with its `<I.plus />` and its
  `data-mascot-target="compose"` attribute. It keeps the hard offset per `00.6`. **KEEP** the string `Post`.
- **SET** `.home-compose` mobile rule `margin: 0 var(--page-px)` -> unchanged (confirm).
- **KEEP** `.home-shell .btn.btn-sm { min-height: 44px }` and `.home-compose .btn-sm { min-width: 44px }`
  — but **SET** the second to exclude the two icon buttons:
  `.home-compose .btn-sm:not(.home-compose-icon) { min-width: 44px; }`

## 01.13 · Centre column · mobile category chips

**File:** `HomePage.tsx` + `home.css`

- **KEEP** `.home-mobile-cats` as a horizontal scroller with hidden scrollbars, and **KEEP** the
  `CATS.map` loop and all six labels.
- **SET** each button's class `'chip ' + (filter === c.k ? 'chip-active' : '')` -> unchanged, and
  **ADD** a hue dot child: `<span className="chip-dot" style={{ background: c.color }} />` for the
  five category chips (not for `All`). `00.7` defines `.chip-dot`.
- **SET** `gap`: `6px` -> `8px`
- **ADD** `.home-mobile-cats { padding-bottom: 2px; }` and **KEEP** the `var(--page-px)` horizontal padding.
- **ADD** a count to the active `All` chip only, matching 01.5: `{c.k === '' && <span className="mono">{postCount}</span>}`.

## 01.14 · Centre column · error and sample-preview notices

**File:** `HomePage.tsx`

- **SET** the `feedError` block: replace all three `var(--rust)` references with `var(--danger)`.
  **`--rust` is defined nowhere**, so the error banner currently has no red at all — see `00.4`.
- **SET** its `borderRadius`: `18` -> `22`
- **SET** its `border`: `2px solid color-mix(in srgb, var(--danger) 45%, transparent)` -> `1px solid color-mix(in srgb, var(--danger) 38%, transparent)`
- **KEEP** `role="alert"`, the string `{feedError}`, and the `retry` button with its
  `.home-inline-action` 44px hit area.
- **SET** the `usingSamplePreview` notice `borderRadius`: `18` -> `22`
- **KEEP** its `2px dashed color-mix(in srgb, var(--welfare) 55%, transparent)` border. **This is
  one of the two places dashed survives** (`00.12`): the dash means "these posts are not real",
  which is exactly what it is saying.
- **KEEP** both strings: `★ sample preview. these are example posts.` and `Join AquaTerra →`.

## 01.15 · The feed card

**Design:** `1a` / `1c` right-hand side. **Files:** `feed/FeedPostCard.tsx`, `styles/routes/feed.css`.

The single biggest structural change: **the photo moves above the author row.** Today the card reads
author -> photo -> title. It becomes photo -> author -> title, so the scroll is a column of images
with their attribution beneath, which is what makes it read as a feed rather than as a list of
records.

### 01.15.1 · The card shell

- **SET** `.feed-card` `border`: `3px solid var(--ink)` -> `var(--hair-2)`
- **SET** `.feed-card` `border-radius`: `20px` -> `var(--r-outer)` (32px)
- **SET** `.feed-card` `box-shadow`: `3px 3px 0 0 var(--ink)` -> `var(--lift-2)`
- **ADD** `.feed-card { padding: var(--pad-card); }` (10px) — the card now has real padding and the
  photo/body/footer sit inside it.
- **DELETE** `.feed-card::before` entirely — the 6px category "cap" bar down the left edge. The
  category is now stated by a pill over the photo and, on text posts, by a pill in the author row.
  A coloured spine on a 32px-radius card cannot follow the corner and reads as a rendering artefact.
- **DELETE** `.feed-card { overflow: visible !important; }`. With the cap bar and the corner
  stickers gone, nothing needs to escape, and `overflow: hidden` is what makes the 32px radius clip
  correctly. **SET** `overflow`: `visible` -> `hidden`.
- **SET** `.feed-card:hover`: `transform: translate(-2px,-2px); box-shadow: var(--sh-lg)` ->
  `box-shadow: var(--lift-3)` with **no transform**.
- **DELETE** `.feed-card.ftilt-a`, `.ftilt-b`, their `:hover` rule and their reduced-motion line
  (also in `00.14`), and **DELETE** the `ftilt` class assignment in `src/**`.
- **KEEP** `@keyframes feedCardIn` and the 5-card stagger, and **KEEP** its reduced-motion disable.
- **KEEP** the `style={{ ['--cc']: CAT_COLORS[post.category] }}` on the `<article>` — the hue is
  still needed, just consumed differently.
- **KEEP** `className={'feed-card' + (!visible ? ' aq-animations-paused' : '')}` and the
  IntersectionObserver that drives it.

### 01.15.2 · Reorder the children

In `FeedPostCard.tsx`'s returned `<article>`, the child order becomes:

1. `.feed-card-media` (was 2nd)
2. `.feed-card-head` (was 1st)
3. the linked-opening notice (unchanged position, now 3rd)
4. `.feed-card-body`
5. the top-comment well (**new**, see 01.15.7)
6. `.feed-card-foot`

**Move the JSX blocks; do not rewrite them.** Every handler, every `stopPropagation`, every
`aria-*` attribute and every string travels with its block unchanged.

**One exception:** when `post.images` is empty (a text-only post) there is no media block, so the
author row is the first child. Handle it with `:first-child` selectors, not a second markup path.

### 01.15.3 · Media

- **SET** `.feed-card-media` `margin`: `8px` -> `0` (the card's own 10px padding is the inset now)
- **SET** `.feed-card-media` `border-radius`: `var(--r-photo)` -> `var(--r-inner)` (22px, and
  `--r-photo` is now an alias of it so either resolves — prefer `--r-inner`)
- **DELETE** `.feed-card-media` `border: 2px solid var(--ink)`
- **SET** `.feed-card-media` `aspect-ratio`: `16/10` -> `4/3`
- **SET** the 720px variant `aspect-ratio: 4/3` -> **DELETE** the rule (the base is now 4/3)
- **KEEP** the 600px variant `aspect-ratio: 3/4 !important; height: auto !important` **and remove
  its `!important`s** — with the 640px `height: 200px` rule gone (see next item) there is nothing
  left to fight.
- **DELETE** any `.feed-card-media { height: 200px }` at the 640px breakpoint if grep finds one.
- **DELETE** `.feed-card-media img { outline: 1px solid rgba(255,255,255,0.1); outline-offset: -1px; }`
  and `[data-theme="light"] .feed-card-media img { outline-color: rgba(0,0,0,0.1); }` (also `00.15`).
  **An outline does not follow `border-radius`** — these draw a square box across the photo's
  rounded corners, which is a visible defect at 22px.
- **KEEP** the `eager={seed === 0}` LCP hint on the first card's image. **This is load-bearing for
  performance** — the feed has no hero, so card 0's photo is the page's LCP element.
- **KEEP** the one-image vs two-image branch, the `isMobile ? '1fr' : '1fr 1fr'` grid, the
  `blobUrl || url` normalisation, both `alt` constructions, `className="no-long-press"`, and the
  lightbox `onClick` handlers with their `stopPropagation`.
- **ADD** the sticker overlay, positioned inside the media:
  ```css
  .feed-card-sticker {
    position: absolute; top: 11px; left: 11px;
    transform: rotate(-2.5deg);
    background: var(--lemon); color: var(--ink);
    font-family: var(--display); font-size: 10.5px; font-weight: 800;
    letter-spacing: 0.03em;
    padding: 6px 12px; border-radius: var(--r-pill);
    border: 2px solid var(--ink); box-shadow: 2px 2px 0 0 var(--ink);
    z-index: 2;
  }
  ```
  **Render it only when the post actually has a sticker value.** `ARCHITECTURE.md`'s data model
  lists `sticker` on Post. **If the `Post` type as it exists in `services/api.ts` has no `sticker`
  field, do not render this and do not add the field.** Log it as unresolved.
- **ADD** the category pill overlay, bottom-left of the media:
  ```css
  .feed-card-cat-float {
    position: absolute; bottom: 11px; left: 11px;
    display: inline-flex; align-items: center; gap: 7px;
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border-radius: var(--r-pill); padding: 6px 12px;
    font-family: var(--eina); font-size: 11.5px; font-weight: 700;
    color: var(--ink);
    z-index: 2;
  }
  ```
  containing a `.chip-dot` at `background: var(--cc)` plus `{post.category}`.
  **This is the second blur in the product.** The nav glass is the other. It is justified here for
  the same reason: the pill sits on unpredictable photography and needs to stay legible without a
  solid block. Contrast: ink on white-at-90%-over-photo clears 4.5:1 in every case because the
  scrim is near-opaque.

### 01.15.4 · Author row

- **SET** `.feed-card-head` `padding`: `12px 16px 6px` -> `12px var(--pad-inner) 10px`
- **SET** the avatar's inline `width: 38, height: 38, fontSize: 14` -> `width: 34, height: 34, fontSize: 12`
- **KEEP** the `isOfficialAccount()` branch, the `referrerPolicy="no-referrer"`, the `getInitials`
  fallback and the `hashColor` background.
- **SET** the official-account avatar's image: `/logo.png` -> `/stamp-ink.png`. `logo.png` is
  **1332x225**, a horizontal wordmark; at `width: 100%` inside a 34px circle it paints about **5px
  tall**. `public/stamp-ink.png` is the square 256x256 mark. **This is a shipped bug** — grep
  `logo.png` across `src/**` and fix every instance sitting in a square or circular container.
  See `02.4` for the full note.
- **SET** the initials colour to `var(--ink)` unconditionally. **Do not pick it per hue.**
  `hashColor` returns any of six accent hues, and white initials fail AA on two of them
  (`--grape` 4.35:1 and `--ops` 3.82:1 at 9-13px). Solid ink passes on all six — grape 5.1,
  ops 6.6, lemon 16.1, sky 8.5, welfare 4.55, tomato 5.99. See the inverse contrast rule in `00.4`.
  This applies to every avatar in the product: card head, comment sheet, tagged stack, rail
  profile block, compose row.
- **KEEP** `<VerifiedTick />` and its `isOfficialAccount` gate.
- **SET** the author-name inline style `fontWeight: 800, fontSize: 14` -> `fontWeight: 700, fontSize: 13.5`
- **KEEP** the meta line's construction `{authorSchool && \`${authorSchool} · \`}{timeAgo(createdAt)}`
  and its `mono xs muted` classes.
- **SET** the category chip in the head: **KEEP** `<span className={'chip cat-' + post.category}>{post.category}</span>`
  **only when the post has no media** (text-only posts, where the float pill has nowhere to sit).
  When media exists, **DELETE** it from the head — it is already on the photo, and rendering both is
  the same fact twice.
- **ADD** a `⋮` overflow button to the head's right edge, 34px, transparent, three ink-3 dots.
  **It must do something or not exist.** The source comment says "⋮ removed - no action defined yet".
  If you have no action for it, **do not add it** — log as unresolved. Do not ship a dead control.
- **KEEP** the whole head as a `<button>` routing to `profilePath`, including the
  `member?.uuid === post.authorUuid` self-vs-public branch. That branch is a real bug fix documented
  in the source; do not simplify it.

### 01.15.5 · Body

- **SET** `.feed-card-body` `padding`: `10px 16px 0` -> `0 var(--pad-inner)`
- **SET** `.feed-card-title` `font-size`: `18.5px` -> `19px`; `font-weight`: `800` -> `700`;
  `letter-spacing`: `-0.015em` -> `-0.02em`; `line-height`: `1.3` -> `1.28`
- **KEEP** `font-family: var(--eina) !important` **and remove the `!important`** if nothing
  overrides it after `00`. Eina for card titles is deliberate and documented; the `!important` was
  defensive.
- **ADD** `text-wrap: pretty` to `.feed-card-title`.
- **SET** the 640px and 720px variants `.feed-card-title { font-size: 15px }` -> **DELETE both**.
  19px is the value at every width; a card's internals do not change at a breakpoint (this is the
  rule `home.css`'s own Section 16 comment states and these two rules break).
- **KEEP** the `<h2 className="h-display feed-card-title">` level. It is semantically correct — each
  card is an `<article>` under the route's single `<h1>`.
- **KEEP** the inner `<Link to={\`/post/${post.uuid}\`}>` with its modified-click passthrough and
  its `e.preventDefault()` on a plain click. **This is the card's only keyboard-reachable route
  into the post.** Do not replace it with a div.
- **KEEP** the `headline` / `rest` word-boundary split `useMemo` **exactly as written**, including
  the `LIMIT = 120`, the sentence-boundary search and the `> 40` guards. It fixes a real live defect
  (mid-word cuts across two type styles) and the reasoning is in the source comment.
- **SET** `.feed-card-snippet` `font-size`: `14px` -> `14.5px`; **KEEP** `line-height: 1.6`,
  `color: var(--ink-2)`, `-webkit-line-clamp: 3`. **ADD** `text-wrap: pretty`.
- **KEEP** the `sourceType === 'welfare_project'` summary block and its whole duplicate-detection
  `norm()` logic. It prevents the same sentence rendering twice.
- **SET** the stat pills. **DELETE** the inline style object and **ADD** a class:
  ```css
  .feed-stat {
    display: inline-flex; align-items: baseline; gap: 6px;
    background: var(--bg);                   /* cream, was var(--lemon) */
    color: var(--ink);
    border: none;                             /* was 1.5px solid var(--ink) */
    border-radius: var(--r-pill);
    padding: 6px 12px;
  }
  .feed-stat b {
    font-family: var(--display); font-weight: 900; font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
  .feed-stat span {
    font-family: var(--mono); font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
    color: var(--ink-3);
  }
  ```
  **Why they lose the lemon fill:** lemon is the sticker colour, and a card with a lemon sticker
  and three lemon stat pills has no hierarchy — the sticker stops being special. Cream recedes and
  lets the sticker win. **SET** the container `gap`: `6px` -> `7px`, `marginTop`: `8px` -> `11px`.
- **SET** the link CTA `.feed-link-cta` -> a well, not a pill. The reference treats a link as a
  small card with a thumbnail:
  ```css
  .feed-link-cta {
    display: flex; align-items: center; gap: 11px;
    margin-top: 12px; padding: 9px;
    background: var(--bg);                   /* was var(--bg-2) */
    border: none;                             /* was 1.5px solid var(--line-2) */
    border-radius: var(--r-inner);           /* 22, was 999 */
    text-decoration: none; color: var(--ink);
    max-width: 100%;
  }
  .feed-link-cta:hover { background: var(--bg-2); transform: none; }
  .feed-link-thumb {
    width: 52px; height: 52px; border-radius: var(--r-tight);   /* 14 inside the 22 well */
    background: var(--tomato);
    display: grid; place-items: center; flex: none;
  }
  .feed-link-title {
    font-family: var(--eina); font-size: 13px; font-weight: 700;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .feed-link-host {
    font-family: var(--mono); font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.05em;
    color: var(--ink-3); margin-top: 3px;
  }
  ```
  **DELETE** `.feed-link-cta:hover { background: var(--welfare); border-color: var(--welfare); color: #0A0A0A; transform: translateY(-1px); }`
  — turning an entire link card welfare-green on hover asserted a category the link does not have.
  **KEEP** `safeExternalHref()`, `target="_blank"`, `rel="noopener noreferrer"` and the
  `stopPropagation`. **KEEP** the title fallback `linkTitle || linkUrl.replace(/^https?:\/\//, '').slice(0, 40)`,
  and put the host string in `.feed-link-host`.
- **SET** the linked-opening "no longer accepting applications" notice: its inline
  `background: 'rgba(255,122,26,0.1)'`, `border: '1px solid rgba(255,122,26,0.3)'` and
  `color: '#FF7A1A'` all use **`#FF7A1A`, which is in no token** — a hand-added orange, violating
  invariant 1. **SET** all three to `var(--danger)`: background `var(--danger-tint)`, border
  `1px solid color-mix(in srgb, var(--danger) 30%, transparent)`, color `var(--danger)`.
  **SET** `borderRadius: 8` -> `22`, and `margin: '0 16px 0'` -> `'0 var(--pad-inner) 10px'`.
  **KEEP** the string `This role is no longer accepting applications.` and the `⚠` glyph.

### 01.15.6 · Tagged members

- **ADD** an avatar-stack row after the stat pills, rendering up to 3 tagged members plus a
  `+N` overflow circle, then a mono line `with {n} others`.
- **Use `.avatar-stacked` from `00.9`** (2px `--card` ring, `-8px` overlap). Circles are 24px,
  `font-size: 9px`, `font-weight: 800`.
- **The data must already be there.** `ARCHITECTURE.md` defines `post_tags`. **If the `Post` type
  in `services/api.ts` does not carry tagged members, do not render this and do not add the query.**
  Log as unresolved. Rendering an empty stack is worse than no stack.

### 01.15.7 · Top comment well

- **ADD** a cream well after the body, showing the single most-recent comment and a link to the rest:
  ```css
  .feed-top-comment {
    margin: 12px var(--pad-inner) 0;
    background: var(--bg);
    border-radius: var(--r-inner);           /* 22 */
    padding: 10px 12px;
  }
  ```
  containing a 24px avatar, the author name at `700 11.5px` Eina, a mono `timeAgo`, the body at
  `400 12.5px/1.5` Eina in `--ink-2`, and below it a button
  `view all {sheetCount} comments →` at `700 11px` Eina in `var(--welfare-ink)`.
- **The button must open the existing comment sheet** — reuse `setShowCommentSheet(true)`. Do not
  build a second comment surface.
- **Render nothing when `sheetCount === 0`.** No "be the first to comment" prompt in the card; the
  empty state already lives inside the sheet.
- **Data:** the card currently fetches comments **only when the sheet opens**
  (`useEffect` gated on `showCommentSheet`). To show a top comment at rest you need one comment per
  card at list level. **Do not add a per-card fetch — that is the N+1 the codebase already fought
  and fixed with `useFeedCardBatch`.** Either (a) the feed query already returns a preview comment,
  in which case use it, or (b) extend `hooks/useFeedCardBatch.ts` to batch one comment per post id
  in a single query, matching how it already batches saved-state and linked openings.
  **(b) touches a query, so it needs sign-off before you write it.** Until then, **omit the well
  entirely** and log it as unresolved. Do not fake it.

### 01.15.8 · Footer / action row

- **SET** `.feed-card-foot` `padding`: `8px 12px 6px` -> `8px 2px 0`
- **SET** `.feed-card-foot` `border-top`: `2px dashed var(--line)` -> `var(--hair)`
- **SET** `.feed-card-foot` `margin-top`: `8px` -> `12px`
- **SET** `.feed-card-foot` `gap`: `6px` -> `2px`
- **SET** `.feed-card-foot .btn`: **KEEP** `min-width: 44px; min-height: 44px`. **SET**
  `padding: 10px` -> `0 11px`, `gap: 6px` -> `7px`. **ADD** `border: none; background: transparent; box-shadow: none; border-radius: var(--r-pill);`
- **SET** `.like-btn--on`: `background: var(--tomato) !important; color: #fff !important` ->
  `background: transparent !important; color: var(--tomato-ink) !important`, and **SET**
  `.like-icon-on svg { color: var(--tomato) }` (unchanged) and **DELETE**
  `.like-btn--on .like-icon-on svg { color: #fff }`.
  **Why:** a filled tomato capsule was the loudest object on the card, so a liked post looked like
  an alert. The filled heart plus the count in `--tomato-ink` (5.45:1, passes AA) says the same
  thing quietly. **KEEP** the entire two-icon cross-fade mechanism, the `scale(0.96)` press and
  `tabular-nums` on `.like-count` — it is correct and it avoids a layout shift.
- **KEEP** the comment button, the share button, the attachment-count button (with its
  `aria-label` pluralisation), the `<span style={{ flex: 1 }} />` spacer and the bookmark button,
  in that order, with every handler intact.
- **SET** the bookmark button's inline `color: bookmarked ? 'var(--lemon)' : undefined` ->
  `color: bookmarked ? 'var(--lemon-ink)' : 'var(--ink-2)'`. Raw `--lemon` (#FFC700) as a glyph
  colour on white is 1.61:1 and effectively invisible; `--lemon-ink` is 5.92:1. **KEEP** the
  `transform: scale(1.08)` when bookmarked and the `bookmark-pop` keyframe.
- **KEEP** `aria-pressed={bookmarked}` and the optimistic-then-confirm toast ordering in
  `handleBookmark` exactly. The comment explaining why the toast fires **after** the write is a
  real bug fix.
- **SET** the poster-studio button (leadership only): **KEEP** the `canMakePoster` role gate, the
  element, the `aria-label` and the string `poster`. **SET** its inline
  `boxShadow: '0 2px 8px rgba(126,91,255,0.3)'` -> `boxShadow: 'none'` and
  `background: 'var(--grape)', color: '#fff'` -> `background: 'var(--grape)', color: '#FFFFFF'`
  (white on grape at >=19px bold is the one allowed white-on-hue case; this label is 11px, so
  **SET** it to `fontSize: 11.5, fontWeight: 800` and verify — grape #7E5BFF against white is
  4.33:1, which **fails** for 11px text. **SET** `background` to `var(--grape-ink)` (#6B44E8) so
  white text clears AA.) **DELETE** the three `onMouseDown`/`onMouseUp`/`onMouseLeave` inline
  transform handlers and replace with a CSS `:active { transform: scale(0.96) }` rule.
- **SET** the 760px override block: **KEEP** the `min-height: 40px; min-width: 40px` floor and its
  documented reasoning (five actions in a 375px card). **DELETE** every `!important` in that block
  — with the base rules above there is nothing left to override. **SET**
  `border-top-width: 1.5px !important` -> **DELETE** (the base `--hair` is 1px).
- **SET** the 640px block's `.feed-card-foot { padding: 0 10px 2px; flex-wrap: wrap; row-gap: 4px }`
  -> **DELETE the whole rule.** The 760px block already handles the phone and sets `nowrap`;
  these two rules contradict each other and 640 wins on source order, which is why the row wraps
  on some phones and not others.
- **SET** the 640px `.feed-card-body { padding: 8px 14px 0 }` and `.feed-card-head { padding: 10px 14px 0 }`
  -> **DELETE both.** Card internals do not change at a breakpoint.

### 01.15.9 · Comment sheet, share modal, poster studio, focus modal

All four are portals rendered from the card. **Their behaviour is entirely unchanged.** Style only:

- **SET** the comment sheet panel `borderRadius: '20px 20px 0 0'` -> `'32px 32px 0 0'`,
  `border: '2px solid var(--ink)'` -> `'none'`, and **ADD** `boxShadow: 'var(--lift-4)'`.
- **SET** its header `borderBottom: '2px solid var(--line)'` -> `var(--hair)`.
- **SET** the close button's `minWidth: 40, minHeight: 40` -> `44, 44` and `borderRadius: 10` -> `999`.
  **The 40px here is not the documented footer exception** — the sheet header has room, and the
  audit lists the modal × as a P0 hit-target failure.
- **SET** the post-snippet context block `borderBottom: '1px solid var(--line)'` -> `var(--hair)`
  and **KEEP** `background: 'var(--bg-2)'`.
- **SET** each comment row's `borderBottom: '1px solid var(--line)'` -> `var(--hair)`.
- **SET** the comment input `border: '2px solid var(--line-2)'` -> `var(--hair-3)`,
  `borderRadius: 999` -> keep, `background: 'var(--bg-2)'` -> `var(--bg)`. **KEEP `fontSize: 16`**
  — the comment in the source is right, it suppresses iOS focus-zoom.
- **SET** its focus/blur `borderColor` handlers from `var(--welfare)` -> `var(--ink)`.
- **SET** the input container's `borderTop: '2px solid var(--line)'` -> `var(--hair)`. **KEEP**
  `paddingBottom: 'max(12px, env(safe-area-inset-bottom))'`.
- **KEEP** every string: `comments`, `no comments yet.`, `be the first to say something.`,
  `say something...`, `view full post →`, `Log in`, `to leave a comment.`
- **KEEP** the optimistic `tempComment` insert, the profanity `checkText` gate with `BLOCK_MESSAGE`,
  the rollback on failure and the `isTemp` 0.55 opacity.
- **SET** the comment-sheet avatar hue selection: it currently hand-rolls a hash over
  `['var(--welfare)','var(--pink)','var(--lemon)','var(--grape)','var(--tomato)','var(--sky)']`
  **twice**, in two places, with two different implementations, while `lib/uiHelpers.hashColor`
  already exists and is used by the card head. **DELETE both local implementations and call
  `hashColor`.** Same for the two local `getInitials`-equivalent `.split(' ').map(n => n[0])`
  chains and the local `timeAgoLocal` — `uiHelpers` exports `getInitials` and `timeAgo`.
- **KEEP** `<ImageLightbox>` and `<PostFocusModal>` always-mounted with `isOpen` driving
  `AnimatePresence`. **Do not conditionally mount them** — the exit animation needs them mounted.

### 01.15.10 · Hiring-card branch

- **KEEP** the `sourceType === 'job_opening'` early return that renders `<HiringCard>` instead of a
  post card, with the same `metaBits` construction and the same `safeExternalHref` fallback to
  `/opportunities`.
- `components/HiringCard.tsx` is **not** restyled by this file. Log it as unresolved — it will look
  like the old language next to the new cards. It belongs with `10-projects-and-opportunities.md`.

## 01.16 · Feed list and mobile edge treatment

**File:** `styles/routes/feed.css` + `home.css`

- **SET** `.home-feed-list` `gap`: `var(--poster-gutter)` -> unchanged (now resolves to 12px per `00.18`)
- **DELETE** the 640px block `.home-feed-list { gap: 20px; padding: 0 var(--page-px) !important; }`
  — it duplicates the mobile rule further down the file with a different gap, and `!important`
  fights it. **KEEP** the later `@media (max-width: 600px)` rules that set
  `.home-feed-list { padding: 0 var(--page-px); gap: var(--poster-gutter) }` and **DELETE their
  `!important`s** once the 640px block is gone.
- **DELETE** `.home-feed-list .feed-card { border-radius: var(--r-outer) !important; animation-duration: 0.2s; }`
  at 640px. The radius is now the base value at every width, and a shorter entrance on phones is an
  arbitrary difference.
- **DELETE the entire `@media (max-width: 640px)` "edge-to-edge post cards" block** that sets
  `.post-feed .aq-post-card { border-radius: 0 !important; border: none !important; border-bottom: 1px solid var(--line) !important; box-shadow: none !important; background: var(--card) !important; }`
  plus `.post-in` padding and `.post-card-img-wrap` negative margins. **Grep `aq-post-card` and
  `post-feed` first** — if they have no callers, delete the `.post-feed` rules too. These describe a
  full-bleed borderless phone card, which is the opposite of the design: cards float on cream with a
  visible gutter at every width, because the gutter is what makes a stack of photos read as
  separate posts.
- **DELETE** `.post-list-row`, `.post-list-thumb`, `.post-card-row`, `.post-card-thumb`,
  `.thumb-flag`, `.post-card-body`, `.post-card-title`, `.post-card-snippet`, `.post-card-hero`,
  `.post-card-mini` from `feed.css`. The file's own comment says these "have no current callers".
  **Grep each to confirm, then delete.** They are ~90 lines of an older card system that will be
  mistaken for the live one.
- **KEEP** `.feed-mobile-fab` **only if** `02-global-chrome.md`'s bottom nav does not carry a
  compose button. The design in `3a` puts compose in the bottom bar, which makes the FAB a second
  control for one action. **Coordinate with `02` and delete one of them.** Until `02` lands, keep
  the FAB and **SET** its `box-shadow: 3px 3px 0 0 var(--ink)` -> `var(--sh)` (2px 2px 0) and
  **KEEP** its `border: 2px solid var(--ink)` — it is a primary CTA, so the motif is correct.
- **KEEP** `.dot` and the five `.cat-dot-*` rules. **SET** them to be the source of `.chip-dot`'s
  colour rather than a parallel system: grep and unify on one class name. Both exist and both mean
  "a 6–8px circle in a category hue".

## 01.17 · Feed list states

**File:** `HomePage.tsx`

- **SET** the loading skeleton cards: **KEEP** three of them. **SET** the inline
  `style={{ padding: 20, ... gap: 12 }}` -> `style={{ padding: 'var(--pad-card)' }}` and rebuild the
  interior to match the new card order: a 4/3 `var(--r-inner)` block first, then a 34px circle with
  two bars, then a title bar. **SET** `borderRadius: '50%'` on the avatar block -> keep. **SET** the
  media block's `height: 160, borderRadius: 18` -> `aspectRatio: '4/3', height: 'auto', borderRadius: 22`.
  **SET** every `background: 'var(--line)'` -> `background: 'var(--bg-2)'` (see `00.16`).
  **A skeleton whose shape does not match what loads is worse than a spinner** — the current one
  puts the avatar first, which is no longer where it goes.
- **KEEP** `<EmptyState icon="✍️" title="nothing here yet." hint="try another filter - or post the first one." />`
  exactly, including the emoji. `components/EmptyState.tsx` is restyled in `11-system-states.md`, not here.
- **KEEP** the load-more sentinel-as-button pattern, the `disabled={isLoadingMore}` state, the
  strings `loading…` / `load more →`, and the `sr-only role="status" aria-live="polite"`
  announcement. **This is a real accessibility feature** — do not replace the button with a bare div.
- **SET** the load-more button `className="btn btn-ghost btn-sm"` -> `className="rail-card-cta"`
  (the ink pill from 01.8), and **DELETE** its `style={{ width: '100%' }}`.
- **KEEP** the end-of-feed block: `<Mascot character="bhoot" pose="idle" size={44} />`, the
  `<span className="sticker sticker-ghost">★ that's all for now</span>` and
  `more posts coming · refresh in a sec`. **SET** `.home-feed-end` `padding`: `30px 0 0` -> `36px 0 8px`.
  **KEEP** `.sticker-ghost` if it exists as a variant; if it only exists to cancel the sticker's
  border and shadow, **DELETE the class** — `00.8` makes those the sticker's identity.

## 01.18 · Responsive

**File:** `home.css`

- **KEEP** exactly three tiers: `>1024` three panes · `601–1024` two panes (right rail hidden) ·
  `<=600` one pane (both rails hidden, chips scroll).
- **DELETE** the duplicate `@media (max-width: 600px)` blocks. There are currently **four separate
  600px blocks** in `home.css`, plus a fifth for `.home-feed-actions`. Merge them into one, keeping
  every declaration, and delete the `!important`s that only existed to win between them.
- **SET** `@media (max-width: 1024px) { .home-shell { grid-template-columns: 240px minmax(0,1fr) } }`
  -> `250px minmax(0,1fr)`
- **KEEP** `.home-left { display: none }` and `.home-right { display: none }` at their tiers, and
  **KEEP** `.home-mobile-cats { display: flex }` at 600.
- **CONFIRM** that with both rails hidden, the phone still reaches browse (via `.home-mobile-cats`),
  the profile (via the bottom nav in `02`), notices, open roles and quick links.
  **Notices, open roles and quick links have NO mobile route after the rails hide.** That is the
  state today and this pass does not change it, but it is a real gap — log it, and raise it when
  `02-global-chrome.md` is designed, because the bottom nav is where they would live.

## 01.19 · Icons — the product already has a set. Use it.

**File:** `frontend/src/components/v6Shared.tsx`

It exports `I`, a 25-glyph icon object, plus `VerifiedTick`, `LikeButton`, `isOfficialAccount`,
`Star`, `Burst`, `Marquee` and `PostImage`. `HomePage.tsx` and `FeedPostCard.tsx` both already
import from it.

**Rule: never draw a new glyph if `I` has one.** Every icon this file asks you to render must be a
call into `I`, not a hand-written `<svg>`. The available keys are:

`heart(filled)` · `comment` · `share` · `search` · `plus` · `bell` · `back` · `close` · `check` ·
`more` · `star` · `fire` · `sparkles` · `bookmark` · `camera` · `link` · `flag` · `globe` ·
`rocket` · `pulse` · `gear` · `pen` · `bolt` · `wave` · `hash`

Mapping for everything this file touches:

| Where | Use |
|---|---|
| feed card like | `<LikeButton>` — **do not rebuild it.** It already owns the cross-fade, the burst, the particles, the `CountUp` and the reduced-motion gate |
| feed card comment / share / bookmark | `I.comment` · `I.share` · `I.bookmark` |
| feed card `⋮` overflow | `I.more` |
| verified author | `<VerifiedTick />` — a sky circle with an ink check, **not** a starburst |
| compose photo / link / post | `I.camera` · `I.link` · `I.plus` |
| feed sort "latest" | `I.pulse` |
| feed header "openings" | `I.star` |
| browse: all / events / welfare / labs / ops / content | `I.sparkles` · `I.flag` · `I.heart(false)` · `I.bolt` · `I.gear` · `I.pen` — **exactly what the `CATS` array already specifies.** Do not substitute. |
| quick links: Blog | `I.pen` |
| quick links: Open Roles | `I.star` |
| quick links: About | `I.globe` |
| nav search / notifications | `I.search` · `I.bell` |

**Note that `I` hard-codes its own `width`/`height`** (18px for the first group, 16px for the
second). The tile sizes in this file ask for 19–20px. **Do not edit `v6Shared.tsx` to change them** —
wrap the call and scale via the parent instead:
```css
.rail-cat-tile-icon svg,
.rail-quicklink svg { width: 19px; height: 19px; }
```

### Three glyphs `I` does not have

`Projects` (folder), `Teams` / `Members` (people) and `home` (the bottom-nav feed tab) have **no
match**. Pick one and apply it consistently:

- **(a)** Reuse the nearest existing key — `I.globe` for Projects, `I.wave` for Teams, `I.hash` for
  Members. Cheapest, ships today, slightly arbitrary.
- **(b)** Add `folder`, `people` and `home` to `I` in `v6Shared.tsx`, matching the set's existing
  construction exactly: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`,
  `strokeWidth="2.2"`, no `stroke-linecap`/`linejoin` (the set does not use them). Three new keys,
  and the set stays the single source.
- **(c)** Ship those tiles label-only, no glyph.

**(b) is the right answer** and it is a 12-line change, but it edits a shared component, so get
sign-off first. Until then use **(a)**. **Do not hand-write inline SVGs at the call site** — that is
how a 25-icon set becomes a 60-icon sprawl.

## A note on strings in this file

Two forms of string instruction appear here, and the difference matters:

- **A quoted string** was read verbatim out of the source file named in that section. Type it exactly.
- **"KEEP whatever string ships today"** means it was **not** read. Open the file, use what is
  there, leave it byte-identical, and **do not retype it from this document.**

**Copy in the design mocks is illustrative unless a section quotes it.** The mocks needed plausible
sentences to lay out. Strings this file's mocks invented, which must **not** be built:

`friday morning` · `MORNING, ANANYA.` · `You are down for a drive this week. Everything else can
wait.` · `next drive` · `Topsia · Sat 9am` · `hours` · `likes earned` · `for you` · `my teams` ·
`★ first drive` · `with 3 others` · `view all 14 comments →` · `Nine open roles · winter cohort` ·
`Applications for the winter cohort close on Sunday.` · `Sixty kids in the Sundarbans now have a
full set of workbooks.` and its body · `closes sun` · `4 applied` · `Welfare drive coordinator` ·
`Instagram editor` · `ShikshAQ tutor · class 6` · `all 9 openings →` · `About AquaTerra` ·
`kolkata · since 2021` · `pin 1 of 3 · welfare` · `Sundarbans relief recap` ·
`Paradox volunteer briefing` · `everything` · `2 need you`.

The strings this file **does** quote and which you can trust are the ones it marks **KEEP** with a
value: `what did you make today?`, `All`, `pick one`, `log out →`, `open roles`, `all`,
`view all openings →`, `no openings right now`, `notice board`,
`nothing pinned yet - click edit to add posts.`, `nothing posted yet.`, `quick links`,
`Projects`/`Teams`/`Blog`/`Members`/`Open Roles`/`About`, `aquaterra · open access`, `· v7 ·`,
`made with care`, `the <em>feed</em>.`, `latest`, `★ sample preview. these are example posts.`,
`Join AquaTerra →`, `nothing here yet.`, `try another filter - or post the first one.`,
`loading…`, `load more →`, `★ that's all for now`, `more posts coming · refresh in a sec`,
`join the <em>chaos</em>.`, `★ kolkata, 2021`, `Usually replies within a week. free forever.`,
`Join the work →`, `This role is no longer accepting applications.`, `Post`, and every comment-sheet
string listed in 01.15.9 — those were read from `FeedPostCard.tsx` and `HomePage.tsx`.

**If an instruction quotes a string and the file disagrees, the file wins.** Report the mismatch;
do not reconcile it by editing either one. No section of this file authorises a copy change.

## Unresolved after this file

Report each of these back rather than guessing:

1. **Sticker data** — does `Post` in `services/api.ts` carry a `sticker` field? If not, `.feed-card-sticker` renders nothing.
2. **Tagged members** — does `Post` carry tagged members? If not, 01.15.6 is skipped.
3. **Top comment** — does the feed query return a preview comment? If not, 01.15.7 is skipped pending sign-off on batching it.
4. **Role deadline** — does `jobOpenings.getOpen()` return `deadline`? If not, the closing-soon sticker is skipped.
5. **Open-roles count** — is the full count available without a new query?
6. **`⋮` overflow menu** — is there an action for it yet? If not, it is not built.
6b. **Three missing glyphs** — `folder`, `people`, `home` are not in `I`. Option (b) in 01.19 needs sign-off; until then use (a).
7. **AdaptiveGrid** — its tiles keep their own radii, so the concentric rule does not hold inside the greeting block. Needs its own file.
8. **HiringCard** — unstyled by this pass, will look like the old language.
9. **Mobile access to notices / open roles / quick links** — no route once the rails hide.
10. **`pointsTile`** — still rendering a retired metric in five of seven greeting recipes.
