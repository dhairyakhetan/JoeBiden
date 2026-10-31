# TESTS — what to run, and what each one proves

**Three layers.** The audit is mechanical, the checklist is human, the probes are measured. **None
substitutes for another**, and each exists because a specific class of defect got past the others
during the design of this handoff.

---

## Layer 1 · `scripts/audit-design.sh` — mechanical

Full script in `AUDIT.md`. **22 rules. Run on every commit.**

```bash
chmod +x scripts/audit-design.sh && ./scripts/audit-design.sh
```

Catches: illegal radii · hand-added hexes · undefined tokens · sub-floor paper alphas ·
accent-as-text · paper-on-grape/teal · a fifth typeface · the offset motif outside its two homes ·
outline on images · dashed borders · hard-coded statistics · the four disputed drives values ·
`pointsTile` · banned copy · new dependencies · **a git check that `feedShape.ts` is unmodified** ·
the retired nudge · **fixed width without `box-sizing`** · **clipping flex rows** ·
**scrollers without overscroll containment** · reduced-motion coverage.

**Exit non-zero blocks the commit.** Rule 4 may flag a legitimate accent-on-ink usage — **a
flagged line with a comment explaining why it is legal is an acceptable resolution.** The point is
that the decision was conscious.

---

## Layer 2 · `ACCEPTANCE.md` — the human checklist

**For the four risks a grep cannot see:** missing states, broken Supabase wiring, the
"do not clean this up" list, and stalling instead of reporting.

Copy the relevant block into the PR. **An unticked line is a blocker.** "N/A" needs a reason.

---

## Layer 3 · DOM probes — measured, not eyeballed

**Every one of these exists because the defect it catches survived a screenshot review during this
project.** Run in the browser console on each surface, at **375px and 1180px**.

### 3.1 · Horizontal clipping

**Found the "new this week" strip clipping its third card irrecoverably.**

```js
[...document.querySelectorAll('*')].filter(e => {
  const s = getComputedStyle(e);
  if (e.scrollWidth <= e.clientWidth + 2 || !e.clientWidth) return false;
  if (s.overflowX !== 'hidden' && s.overflowX !== 'clip') return false;
  // Ignore rows whose overflow is only a decorative absolute child.
  const flow = [...e.children].filter(c => getComputedStyle(c).position !== 'absolute');
  if (!flow.length) return false;
  return Math.max(...flow.map(c => c.getBoundingClientRect().right)) > e.getBoundingClientRect().right + 1;
}).map(e => ({ over: e.scrollWidth - e.clientWidth, text: e.textContent.trim().slice(0, 40) }));
```

**Must return `[]`.** The absolute-child filter matters: **a bleeding decorative circle clipped by
`overflow: hidden` is the intended effect** and must not be "fixed".

### 3.2 · Text over decoration

**Found four times: a portrait over a name, badges over a headline, stickers over a CTA on all 22
routes, and a pinboard label escaping its note.**

```js
const hit = (a,b) => Math.min(a.right,b.right)-Math.max(a.left,b.left) > 0
                  && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top) > 0;
const deco = [...document.querySelectorAll('*')].filter(e => getComputedStyle(e).position === 'absolute');
[...document.querySelectorAll('h1,h2,h3,h4,p,b,span')].filter(t => t.children.length === 0 && t.textContent.trim())
  .flatMap(t => deco.filter(d => !d.contains(t) && !t.contains(d) && hit(t.getBoundingClientRect(), d.getBoundingClientRect()))
    .map(d => ({ text: t.textContent.trim().slice(0,30), over: d.className || d.tagName })));
```

**Two known false positives — verify before acting:**
- **A rotated ancestor** inflates every descendant's bounding box (~50px on the fanned hiring
  cards). Boxes intersect; glyphs do not. **Confirm with a `Range` over the text node.**
- **Stacked avatars** overlap by `-8px` deliberately.

### 3.3 · Contrast, computed

```js
const lum = c => { const [r,g,b] = c.match(/\d+/g).map(n => { n/=255; return n<=.03928?n/12.92:((n+.055)/1.055)**2.4 }); return .2126*r+.7152*g+.0722*b };
const ratio = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return (x+.05)/(y+.05) };
[...document.querySelectorAll('*')].filter(e => e.children.length===0 && e.textContent.trim()).map(e => {
  const s = getComputedStyle(e); let p = e, bg = 'rgba(0,0,0,0)';
  while (p && bg.includes('rgba(0, 0, 0, 0)')) { bg = getComputedStyle(p).backgroundColor; p = p.parentElement; }
  const size = parseFloat(s.fontSize), weight = +s.fontWeight;
  const floor = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
  const r = ratio(s.color, bg);
  return r < floor ? { text: e.textContent.trim().slice(0,26), ratio: +r.toFixed(2), floor, size } : null;
}).filter(Boolean);
```

**Must return `[]`.** This is the probe that caught paper-on-grape at **3.78:1**, paper-on-teal at
**3.32:1**, the Paradox banner's CTA at **3.16:1 on all 22 public routes**, and — twice —
**alpha-ink labels on welfare at 3.28:1.**

**It must composite alpha up the whole ancestor stack.** The alpha-ink failures are invisible to a
naive check: `color: rgba(10,10,10,.7)` on `background: #1B8A5A` looks like dark-on-mid-green and
reads as obviously fine. **Only the computed composite reveals 3.28:1.** Three separate review
passes measured this wrong before getting it right.

### 3.4 · Radii

```js
const OK = ['999px','32px','22px','14px','6px','18px','50%','0px'];
[...document.querySelectorAll('*')].filter(e => {
  const r = getComputedStyle(e).borderRadius;
  return r && r !== '0px' && !r.split(/[\s/]+/).every(v => OK.includes(v));
}).map(e => ({ r: getComputedStyle(e).borderRadius, el: e.className || e.tagName }));
```

### 3.5 · Hit targets

```js
[...document.querySelectorAll('button,a,[role="button"],[role="switch"],input,select')].map(e => {
  const b = e.getBoundingClientRect();
  return (b.width && b.height && (b.width < 44 || b.height < 44))
    ? { el: e.textContent.trim().slice(0,22) || e.tagName, w: Math.round(b.width), h: Math.round(b.height) } : null;
}).filter(Boolean);
```

**Documented exceptions, each justified at its call site:** dock buttons **42px** (`03.1`), rail
glyphs **48px** (`17.1`), comment-foot buttons **32px** in a 44px row (`03.5.1`), `sm` stickers
which are die-cut-only (`13.3`).

### 3.6 · Layout shift during the load burst

```js
new PerformanceObserver(l => l.getEntries().forEach(e => !e.hadRecentInput && console.log('CLS', e.value)))
  .observe({ type: 'layout-shift', buffered: true });
```

**Must log nothing.** `18.2` animates `transform` from a settled DOM precisely so CLS is **0**.

### 3.7 · Reduced motion

```js
// DevTools → Rendering → Emulate prefers-reduced-motion: reduce
[...document.querySelectorAll('*')].filter(e => {
  const s = getComputedStyle(e);
  return (s.animationName !== 'none' && s.animationDuration !== '0s')
      || (s.transitionDuration !== '0s' && s.transitionProperty !== 'none');
}).length;
```

**Must be 0 for ambient motion.** `18`'s floors say reduced motion **removes**, not slows.

### 3.8 · No hard-coded statistics

```js
[...document.body.innerText.matchAll(/\b\d{1,3},?\d{3}\+/g)].map(m => m[0]);
```

Cross-check every hit against `ORG_FACTS` (`21`). **`450+`, `512+`, `534+` and `550+` must never
appear.**

---

## Layer 4 · Flow tests — by hand, signed in

**No probe catches these. They are the ones that break silently.**

| # | flow | the assertion that matters |
|---|---|---|
| 1 | post → queue → approved | **the author can see it is pending at every moment** (`22.1`) |
| 2 | post → queue → **rejected** | **there is a path forward, not a dead end** |
| 3 | comment → profanity gate | `BLOCK_MESSAGE` fires **on submit**, text preserved |
| 4 | like → fail the network | optimistic state rolls back, toast fires **after** the write |
| 5 | approve a member as a **scoped** HoD | counts and lists are scoped, not global (`06.4.1`) |
| 6 | bulk approve → undo | the undo actually reverses it |
| 7 | request a certificate | all **three** document types still exist (`04.5`) |
| 8 | generate a CV → print | `document.title` swaps, `cv-printing` applies, print CSS untouched |
| 9 | take a break → return | the date does not shift a day (the `'T00:00:00'` suffix) |
| 10 | wall note → recipient deletes | **soft delete**; `deleted_at` set, row retained (`16`) |
| 11 | turn the wall off → back on | **every note returns.** Off must never destroy |
| 12 | apply for a role | field-level errors render; a network failure keeps the draft |
| 13 | search → filter → open | the sheet's peek bar shows the live filter summary |
| 14 | run a demo end to end | **zero network writes.** Watch the tab for all eleven flows |
| 15 | log in as a plain member | **no desk route is reachable.** Guards mirror RLS exactly |

---

## Layer 5 · The data tests

| # | assertion | why |
|---|---|---|
| 1 | `feedShape.test.ts` passes **unmodified** | if a test needed editing, behaviour changed |
| 2 | `compute-org-facts.mjs` fails the build on a query error | a stale number beats a wrong one (`21.2`) |
| 3 | rounding is always **down** | rounding up is what `BRAND_VOICE.md` §3 forbids |
| 4 | no card renders `0` where the figure was `null` | rule 4 in `15.0` — a zero is a claim |
| 5 | no card borrows an image from another row | rule 2 in `15.0` |
| 6 | C15 renders no age · C16 no `break_reason` · C14 no like | each is a decision, not a style |
| 7 | every C25 row has an `href` | a collapsed row you cannot open is worse than a card |

---

## The order to run them

1. **`audit-design.sh`** — seconds, and it fails fast.
2. **3.1 → 3.5** on the surface you changed, at **375px and 1180px**.
3. **`ACCEPTANCE.md`** block for that file.
4. **The flow tests that touch it** (layer 4).
5. **3.6 / 3.7** only if you touched motion.
6. **Layer 5** if you touched cards or statistics.

**A screenshot proves nothing about clipping, contrast or overlap.** All three were measured
defects in this project that looked completely fine in review. **Measure.**
