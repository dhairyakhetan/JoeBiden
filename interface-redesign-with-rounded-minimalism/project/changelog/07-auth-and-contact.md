# 07 · Auth and contact

**Files touched:** `frontend/src/auth/LoginPage.tsx`, `SignupPage.tsx`, the password-reset route,
`frontend/src/public/ContactPage.tsx`, `CollaborationsPage.tsx` (pattern source only),
`frontend/src/components/AQMascot.tsx` (read + reuse), their CSS.
**Design source:** `AquaTerra Feed.dc.html` — `18a` (contact desktop), `18b` (contact phone),
`18c` (auth desktop).
**Prerequisites:** `00`, `13` (stickers). **Read `docs/BRAND_VOICE.md` §6 for the CTA ceiling.**

## Global invariants

1–9 as in `changelog/README.md`, plus the **overlap rule**.
**No gradients on either surface** — the user's brief says so explicitly for contact, and it
applies to auth for consistency.

## 07.0 · The field style — one component, every form in the product

**Underline-only fields.** This is the single most reusable thing in this file: it replaces the
boxed inputs on contact, auth, apply, the composer's detail panel, edit-profile and every desk
editor.

```css
.aq-field       { display: block; }
.aq-field-label {
  display: block;
  font-family: var(--mono); font-size: 8.5px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--ink-3);                     /* 4.6:1 on cream */
  margin-bottom: 9px;
}
.aq-field-input {
  display: block; width: 100%;
  border: none; background: transparent; border-radius: 0;
  padding: 0 0 9px;
  border-bottom: 1.5px solid rgba(10,10,10,0.20);
  font: 400 17px var(--eina); color: var(--ink);
}
.aq-field-input::placeholder { color: rgba(10,10,10,0.42); }   /* 4.6:1 — a real floor */
.aq-field-input:focus-visible {
  outline: none;                            /* the rule IS the focus ring */
  border-bottom-color: var(--ink);
  border-bottom-width: 2px;
}
```

- **17px, never smaller.** Above the 16px iOS zoom floor with a margin.
- **`border-radius: 0` is deliberate and is the one exception to the radius scale** — a line has no
  corners. Note it in a comment so nobody "fixes" it to 22px.
- **On ink** the label goes to `var(--nav-fg-faint)`, the rule to `rgba(244,239,224,.28)`, the text
  to `var(--nav-fg)`, the placeholder to `rgba(244,239,224,.45)`.
  **The placeholder alpha is the one value to watch** — 0.45 on ink is 4.05:1 and **fails** for
  text. **Use 0.55 (`--nav-fg-faint`, 5.6:1) for placeholders on ink.** The mock shows 0.45;
  **the mock is wrong and the spec wins.**
- **Removing the focus outline is only legal because the rule thickens and darkens.** If you drop
  either half of that, put the outline back.

### The error state — this is the gap `00.10` left open

```css
.aq-field[data-invalid] .aq-field-label { color: var(--danger-lift); }
.aq-field[data-invalid] .aq-field-input { border-bottom-color: var(--danger-lift); }
.aq-field-error {
  display: block; margin-top: 8px;
  font-family: var(--mono); font-size: 10.5px; color: var(--danger-lift);
}
```

- **`--danger-lift: #FF6B4D`** — a lightened `--danger`. **On ink, `--danger` (#FF4D2E) measures
  4.1:1 and fails; #FF6B4D measures 5.2:1 and passes.** On cream use `--tomato-ink` (#C6300F,
  6.7:1) instead. **This is a new token and it is the only new colour in the whole redesign** —
  justified because there was no AA-passing danger tone for ink grounds. **Add it to `tokens.css`.**
- **The label, the rule and the message all change together.** One glance, three signals.
- **`aria-invalid="true"` on the input, `aria-describedby` pointing at the message,
  `role="alert"` on the message.**
- **Validate on blur and on submit — never on keystroke.** Telling someone their email is wrong
  while they type the third character is hostile.
- **Copy the pattern from `CollaborationsPage.tsx`.** It is the one form in the product that
  already does per-field errors properly (`fieldErrors`, `role="alert"`, `aria-invalid`).
  **Do not invent a second pattern.** Lift its logic, restyle its output.

## 07.1 · Contact — the person is the design

**Design:** `18a`, `18b`. **DELETE any gradient on this page.**

- **SET** the page as one white card (32/10) split
  `grid-template-columns: minmax(0,1fr) minmax(0,460px)` with the **form pane in ink at radius 22**.
  Ink inside white is concentric, and it makes the form the object rather than the page.
- **Left pane:** mono kicker → display headline with a serif second line → one paragraph → the
  **person card** → contact pills → socials.
- **The person card** is a cream radius-22 well: a 72px hue avatar, the name at
  `900 20px var(--display)`, the role in mono uppercase. **This is the page's argument** — a named
  human answers, not a queue.
- **Contact pills** are white radius-999 with `var(--hair-2)`, `min-height: 46px`, a glyph + the
  actual address. **Show the real address as text**, not "email us" — a student on a phone may want
  to copy it.
- **Socials** are 46px discs; the primary one is ink-filled, the rest white with a hairline.
  **Use the slug from the codebase** — `BRAND_VOICE.md` §3 flags the LinkedIn slug as **conflicting
  and blocking** (`aquaterrango` vs `ngo-aquaterra`). **Until confirmed, link only the socials
  whose handles are certain.**
- **Right pane, in ink:** a mono kicker → the **interest chip group** → four underline fields →
  a full-width welfare submit.
- **The chip group is `role="group"` with `aria-labelledby` pointing at the kicker.**
  `CollaborationsPage` already does exactly this — **keep its markup pattern.**
  Selected chip = full `var(--welfare)` with ink text and a tick; unselected = transparent with a
  `rgba(244,239,224,.28)` hairline.
- **KEEP `COLLAB_TYPES`** if the chips are the same taxonomy. **Do not invent a parallel list.**
- **SET** the submit to `min-height: 54px`, `var(--welfare)`, **`border: 2px solid var(--paper)`**
  — the offset shadow does not work on ink, so the paper keyline is the ink-ground equivalent of
  `.btn-primary`. **Note this as the ink variant in `00.6`.**
- **The reassurance line under the submit** (`no newsletter, no follow-up sequence`) is worth more
  than it looks: it is the objection a 16-year-old actually has.

### Contact states

- **Submitting:** the button reads its busy label, the form is `aria-busy`, fields disabled.
- **Success:** **replace the form pane** with a welfare-filled radius-22 panel: a tick disc, one
  line confirming, and the expected reply time from `orgFacts` (**never hard-coded**).
  **Do not clear the form and leave it looking untouched** — that reads as failure.
- **Server rejection:** keep every entered value, show a form-level message above the fields.
- **Network failure:** keep the values, offer retry. **Never lose typed text.**
- **KEEP** the existing success/error strings if any exist.

## 07.2 · Auth — the door changes every visit

**Design:** `18c`. Applies to login, signup and reset.

- **SET** the shell as a white card (32/10) split
  `minmax(0,1fr) minmax(0,440px)`, `min-height: 620px`, with the **art panel at radius 22**.
- **Right pane:** the square mark (`stamp-ink.png`, **not `logo.png`** — `02.4`) → a display
  greeting with a serif word → one line → fields → primary → `or` divider → Google → footer link.
- **`Log in` / `Apply to join →` are the labels.** §6 bans `JOIN NOW`.
  **`Apply to join` is accurate** — membership needs approval, so `Sign up` would misdescribe it.
- **The password field gets a reveal toggle**, 44px hit area, `aria-pressed`, and its label row
  carries `forgot?` as a link in `var(--welfare-ink)`.

### The randomised art panel — seeded, not random

**"Unique every visit" must not mean unpredictable.**

- **Twelve compositions**, each a fixed tuple: **hue × mascot × sticker pair × ghost-letter
  placement**. Enumerate them in a const array. **The panel is never assembled from independent
  random choices** — that produces the occasional ugly or illegible combination, and it makes bugs
  impossible to reproduce.
- **Pick by seed:** `Math.floor(Date.now() / 864e5) % 12` gives one per day, or a per-load
  `Math.random()` if you want it per visit. **Show the index** (`composition 3 of 12`) in the
  corner, so a screenshot is reproducible.
- **Every composition must be checked once** for contrast: the two stickers and the kicker sit on
  the panel hue, and **ink text on all seven hues passes** (`README` invariant 7) — but the
  **paper stickers on lemon** need care, so **paper stickers are only legal on welfare, tomato,
  grape, teal and ink.**
- **The ghost letters** are `AQ` at `900 52px` in `rgba(10,10,10,.12)` — decoration, `aria-hidden`.
- **The die-cut keyline on each sticker is `0 0 0 3px <panel hue>`** — it changes per composition,
  which is exactly the die-cut rule from `13` (the ring is the colour of what it lies on).

### The eyes

- **Two `translate()` values on one shared rAF loop**, clamped to a small radius (~7px):
  ```
  dx = clamp((pointerX - eyeCx) / 40, -7, 7)
  dy = clamp((pointerY - eyeCy) / 40, -7, 7)
  ```
- **One loop for both eyes**, one `pointermove` listener on the panel, **`passive: true`**.
- **Desktop only.** On touch there is no cursor: **the eyes rest at centre and the gyro path is
  NOT used here.** `14`'s footer already asks for motion permission; **asking twice, on the login
  page, before the user has an account, is hostile.** The mascot simply looks ahead.
- **`prefers-reduced-motion`: eyes fixed at centre, no loop started.**
- **The mascot comes from the existing `AQMascot` set** (nolen / tuk / bhoot). **Read that component
  before building** — if its characters already have eye elements, drive those; if not, the panel
  composes its own eye discs over the silhouette. **Do not draw a new character.**
- **The whole art panel is `aria-hidden="true"`.** It is atmosphere. A screen reader gets the form.

### Auth states

- **Invalid credentials:** a form-level message above the fields, **both fields keep their values**,
  and the password is **not** cleared. Clearing it is a habit from banking, not a kindness.
- **Field errors:** `07.0`'s error state.
- **Submitting:** button busy, fields disabled, `aria-busy`.
- **Rate limited:** say so plainly and say when to retry.
- **Awaiting approval** (signup): a lemon radius-22 panel replacing the form —
  **this is the state that matters most on this surface.** A student who applies and sees nothing
  assumes it failed. Say what happens next and roughly when.
- **Reset link sent / expired / already used:** three distinct states, all needed. `UX-GAPS.md`
  lists password reset as designed nowhere.
- **OAuth failure:** a message, and the email form still available.

## 07.3 · What to delete

- **DELETE every gradient** on contact (explicit in the brief) and on auth.
- **DELETE boxed input styling** wherever `07.0` replaces it.
- **DELETE any `logo.png` in a circular slot** — it is a 1332×225 wordmark and renders ~5px tall
  (`02.4`). Use `stamp-ink.png` / `stamp-white.png`.
- **DELETE the hard ink border + offset shadow** from the auth and contact card shells (`00.6`).
  They survive only on `.btn-primary` and stamped stickers.
- **DELETE any "Sign up" label** in favour of `Apply to join` — **but only if membership really is
  approval-gated.** `06` shows an account-approvals desk, so it is.

## Verification

1. **Every field is underline-only, 17px, with `border-radius: 0`** and a mono uppercase label.
2. **Focus:** rule thickens to 2px and darkens to `var(--ink)`/`var(--nav-fg)`. Never a removed
   outline without that.
3. **Errors:** label + rule + message all in `--danger-lift` on ink or `--tomato-ink` on cream,
   with `aria-invalid`, `aria-describedby` and `role="alert"`.
4. **Validation fires on blur and submit, never on keystroke.**
5. **Placeholders on ink are 0.55 alpha, not 0.45.**
6. The art panel is `aria-hidden`; the eyes do not run on touch or under reduced motion.
7. **The composition index is displayed** and the set is a fixed enumeration of twelve.
8. Paper stickers never on lemon or sky.
9. **No gradient anywhere on either page.**
10. No form loses typed values on any failure path.
11. `stamp-*.png` in every square slot; never `logo.png`.
12. Radii only 999 / 32 / 22 / 14 / **0 (field rules)**. Zero horizontal overflow at 375px, 360px.

## A note on strings

**Approved (bulk):** `★ kolkata · replies within a week` · `say something. a person reads it.` ·
`Not a ticket queue. Kanishk runs collaborations and answers most of what comes in himself.` ·
`co-founder · collaborations` · `★ or find us here` · `★ what's this about` ·
`a collaboration` / `joining a team` / `school or college` / `press` / `something else` ·
`your name` `your organisation` `email` `what would you like to do` · `optional` ·
`who are you?` `where do we reply?` `a sentence is enough` ·
`that address looks incomplete.` · `Send it` · `no newsletter, no follow-up sequence` ·
`welcome back.` · `1,200+ of us. Free, always.` · `password` · `forgot?` · `Log in` · `or` ·
`Continue with Google` · `New here?` · `Apply to join →` · `★ student run` ·
`composition 3 of 12` · `★ nolen is watching your cursor` · `15,000+ bananas` · `zero fees`.

**Read from source, keep byte-identical:** every `COLLAB_TYPES` value, every existing
`ContactPage` label and `<option>`, every auth error string, and `CERTIFICATE_WAIT_TIME`-style
facts from `orgFacts`.

**`Kanishk Agarwal` is a real named person** and §3 clears him as public (co-founder, in JSON-LD).
**But putting a real teenager's name and inbox on a public contact page is a consent question, not
a design one.** Confirm with him before shipping. If not, use the role without the name —
though that loses the page's entire argument.

## Contrast — placeholders are not exempt

**Corrected after review.** An earlier draft of this file used `rgba(244,239,224,0.45)` for the
underline fields' placeholders (`who are you?`, `where do we reply?`, `a sentence is enough`) and
for the `optional` suffix. **That measures 4.06:1 on ink and fails.**

**Use `var(--nav-fg-faint)` (0.55, 5.6:1).** The six-rung ladder in `README.md` invariant 7 is
exhaustive and **placeholder text is not exempt from it** — it is the text a user reads while
typing, on a form where getting it wrong loses an application.

**Underline-only fields make this worse, not better:** with no filled input box, the placeholder
sits directly on the panel ground with nothing to lift it. **Verify every placeholder on both auth
panels and on the contact panel.**

## Unresolved after this file

1. **Does Kanishk consent to being named on /contact?** If not, who does — or does the page use a
   role only?
2. **`hello@aquaterra.org.in`** — is that the real address? I invented the local part.
3. **The LinkedIn slug is blocked** (§3). Which is right?
4. **Is there a WhatsApp contact number that is safe to publish?** A personal number on a public
   page for a minor-staffed org needs a deliberate decision.
5. **Does `AQMascot` expose per-character eye elements**, or is each character a single shape?
   Decides whether the eyes are driven or composed.
6. **Is signup approval-gated in all cases**, or can some accounts self-serve? Decides
   `Apply to join` vs `Sign up`.
7. **Does a password-reset route exist at all?** `UX-GAPS.md` says it is designed nowhere; it may
   also be **built** nowhere.
8. **`--danger-lift` is the one new colour in the redesign.** Confirm you accept it, or tell me to
   use `--lemon` for errors on ink instead (12.1:1, but yellow does not read as an error).
