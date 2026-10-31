/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   design-probe.js · the audit that can see the page
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   WHY THIS EXISTS

   `scripts/audit-design.sh` is grep. It reads source. It found none of the
   three worst design defects this project has shipped, and could not have:

     1. C04's photo stack drew 388x485 images inside a 190px box with
        `overflow: visible`, so three photographs painted straight over the
        cards above and below it. Every token in that CSS was legal.
     2. The first fix for it centred three ~147px photos in a 555px container,
        leaving 204px of dead space either side. Every token still legal.
     3. C02 was documented as shipping and was missing from `SHAPED_SHAPES`,
        so the design never rendered at all. Source-level, but about agreement
        between two files rather than about any one line.

   (3) is now a static gate - audit-design.sh rule 21. (1) and (2) are LAYOUT.
   They only exist once a browser has computed a box, and no amount of reading
   CSS can produce one. The measurement here is the only kind of evidence that
   settles them.

   It also exists because of a failure mode on the reporting side: an audit
   that measures `body.scrollWidth`, tap-target sizes and accessible names will
   report a clean pass on a page whose photographs are painting over each
   other. Passing the checks you happen to have is not the same as the design
   being right, and a report that does not say which it means is worse than no
   report. Every section below is written to answer "does this LOOK right",
   and the limits section at the bottom says plainly what it still cannot see.

   ── how to run it ─────────────────────────────────────────────────────────
   There is no headless browser in this project's devDependencies and this file
   does not add one. Paste the file into the page instead:

     * DevTools console on any route, or
     * the Claude Browser pane's `javascript_tool`, or
     * `await import('/scripts/design-probe.js')` is NOT how it works - it is a
       plain expression file, not a module. Paste it whole.

   It returns a plain object. `probe().report` is the human summary;
   `probe().findings` is the machine-readable list, worst first.

   ── what counts as a finding, and what is only a note ─────────────────────
   Anything that changes what a reader sees is a finding. Anything that is a
   judgement call at the current data volume is a note, stated rather than
   silently dropped - a probe that quietly discards its uncertain results is
   how (1) and (2) both survived review.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

(function probe() {
  const findings = []
  const notes = []
  const add = (severity, area, detail, extra) =>
    findings.push(Object.assign({ severity, area, detail }, extra || {}))

  /* The card elements, resolved correctly.
     ────────────────────────────────────────────────────────────────────────
     `data-card-shape` sits on a `display: contents` wrapper, whose
     getBoundingClientRect is 0x0 - so measuring against IT reports every
     descendant of every card as escaping by thousands of pixels. That is not
     hypothetical: it is exactly what the first run of this check did, and the
     output was pure noise. Always resolve to the painted element. */
  const cards = [...document.querySelectorAll('[data-card-shape]')]
    .map(w => ({
      shape: w.getAttribute('data-card-shape'),
      rule: w.getAttribute('data-card-rule'),
      el: w.querySelector('article.aqc') || (w.offsetWidth ? w : null),
    }))
    .filter(c => c.el)

  // ── 1 · does anything paint outside its own card ──────────────────────────
  // The check that would have caught the photo stack. A child whose box
  // extends past its card's box is painting on a neighbour, and `overflow:
  // visible` (which .aqc sets deliberately, for the quote seal and the
  // overhanging author pill) means nothing stops it.
  const ESCAPE_TOLERANCE = 4 // px. Sub-pixel rounding and hairline borders.
  for (const c of cards) {
    const cb = c.el.getBoundingClientRect()
    let worst = { px: 0 }
    for (const el of c.el.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const cs = getComputedStyle(el)
      // A fixed/absolute overlay anchored outside the card is intentional
      // chrome (the seal, the overhang), not a spill. Only fixed is exempt:
      // an absolutely positioned child is still laid out against the card.
      if (cs.position === 'fixed') continue
      const over = Math.max(
        cb.top - r.top, r.bottom - cb.bottom,
        cb.left - r.left, r.right - cb.right,
      )
      if (over > worst.px) {
        worst = {
          px: Math.round(over),
          el: el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 40),
        }
      }
    }
    if (worst.px > ESCAPE_TOLERANCE) {
      add('high', 'overflow',
        `${c.shape}: a child paints ${worst.px}px outside the card`,
        { shape: c.shape, culprit: worst.el })
    }
  }

  // ── 2 · is the page actually showing more than one design ─────────────────
  // The complaint this file was written after was "I only see 3-4". A feed of
  // one repeated card is a design failure even when every card is perfect.
  const shapes = cards.map(c => c.shape)
  const distinct = [...new Set(shapes)]
  let longestRun = shapes.length ? 1 : 0
  let run = 1
  for (let i = 1; i < shapes.length; i++) {
    if (shapes[i] === shapes[i - 1]) { run++; longestRun = Math.max(longestRun, run) }
    else run = 1
  }
  if (shapes.length >= 6 && distinct.length < 4) {
    add('high', 'variety',
      `${shapes.length} cards render only ${distinct.length} designs (${distinct.join(', ')})`)
  }
  if (longestRun > 2) {
    add('medium', 'variety', `the same design runs ${longestRun} times in a row`)
  }
  // Repeats inside the window feedCompose.varyRuns is supposed to enforce.
  const WINDOW = 2
  for (let i = 1; i < shapes.length; i++) {
    const back = shapes.slice(Math.max(0, i - WINDOW), i)
    if (back.includes(shapes[i])) {
      notes.push(`${shapes[i]} repeats within ${WINDOW} at position ${i} - varyRuns found no alternative the row could feed, which is legal but visible`)
    }
  }

  // ── 3 · does the content fill the box it was given ────────────────────────
  // The second C04 defect: correct, contained, and mostly empty. A photo
  // device that uses less than this much of its container is huddling.
  const FILL_FLOOR = 0.7
  for (const stack of document.querySelectorAll('.aqc-stack')) {
    const sb = stack.getBoundingClientRect()
    const items = [...stack.querySelectorAll('.aqc-stack-item')].map(e => e.getBoundingClientRect())
    if (!items.length || !sb.width) continue
    const used = (Math.max(...items.map(r => r.right)) - Math.min(...items.map(r => r.left))) / sb.width
    if (used < FILL_FLOOR) {
      add('medium', 'fill',
        `a photo stack uses ${Math.round(used * 100)}% of its width - ${Math.round(sb.width * (1 - used))}px sits empty`)
    }
    // The other end of the same dial: photos so overlapped that the stack
    // stops reading as more than one photo.
    if (items.length > 1) {
      const overlap = (items[0].right - items[1].left) / items[0].width
      if (overlap > 0.45) {
        add('low', 'fill',
          `photo stack overlap is ${Math.round(overlap * 100)}% - the flanking photos are mostly hidden`)
      }
    }
  }

  // ── 4 · is the type readable on the ground it actually landed on ──────────
  // Not "is the token legal" (audit-design.sh rule 4 does that) but "what is
  // the COMPUTED colour against the COMPUTED ground". This is the check that
  // catches ink type landing on an ink-filled block because a category was
  // unmapped and the hue fell back.
  const lum = rgb => {
    const f = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) })
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]
  }
  const parse = s => {
    const m = String(s).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map(v => parseFloat(v))
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }
  }
  /** Walk up for the first opaque background - what the text is really on. */
  const groundOf = el => {
    let n = el
    while (n && n !== document.documentElement) {
      const bg = parse(getComputedStyle(n).backgroundColor)
      if (bg && bg.a >= 0.95) return bg.rgb
      n = n.parentElement
    }
    return [255, 255, 255]
  }
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }
  const seenContrast = new Set()
  for (const c of cards) {
    for (const el of c.el.querySelectorAll('h1,h2,h3,h4,p,span,a,button,li')) {
      const txt = (el.textContent || '').trim()
      if (!txt || el.children.length) continue
      const cs = getComputedStyle(el)
      // Text painted over a photograph has no computed ground to measure -
      // its legibility comes from a gradient scrim. Said out loud rather than
      // scored wrongly, which would be worse than not scoring it.
      if (el.closest('[data-over-photo], .aqc-hero-caption')) continue
      const fg = parse(cs.color)
      if (!fg || fg.a < 0.95) continue
      const size = parseFloat(cs.fontSize)
      const bold = parseInt(cs.fontWeight, 10) >= 700
      const large = size >= 24 || (size >= 18.66 && bold)
      const floor = large ? 3 : 4.5
      const r = ratio(fg.rgb, groundOf(el))
      const key = `${c.shape}|${cs.color}|${Math.round(size)}`
      if (r < floor && !seenContrast.has(key)) {
        seenContrast.add(key)
        add(r < floor - 1.5 ? 'high' : 'medium', 'contrast',
          `${c.shape}: ${Math.round(size)}px text at ${r.toFixed(2)}:1 (floor ${floor}) - "${txt.slice(0, 40)}"`)
      }
    }
  }

  // ── 5 · the page must not scroll sideways, at any width ───────────────────
  const sideways = document.body.scrollWidth - document.documentElement.clientWidth
  if (sideways > 1) {
    const wide = [...document.querySelectorAll('body *')].filter(el => {
      const r = el.getBoundingClientRect()
      return r.right > document.documentElement.clientWidth + 1 && r.width > 0
    }).slice(0, 5).map(el => el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 30))
    add('high', 'overflow', `the page scrolls ${sideways}px sideways`, { widest: wide })
  }

  /* ── 6 · every photo through the CDN resize ───────────────────────────────
     CLAUDE.md's single biggest historical performance bug: a multi-MB original
     shipped for a 40px avatar. `sized()` is the rule; this is whether it held.

     THE POLICY IS NOT "every remote image carries a width param", and the
     first version of this check assumed it was - it looked for `?width=` and
     duly reported every correctly-sized image on the page as a defect. Read
     lib/imageUrl.ts: `sized()` rewrites FRAMER urls only, with
     `scale-down-to=`, and returns a Supabase storage URL untouched on purpose,
     because this project does not have Supabase image transforms enabled.

     So the Framer half is a finding (the rule exists and can be broken) and
     the Supabase half is a note carrying its own reason (the rule does not
     exist yet, and saying "20 images bypass sized()" about it is a false
     alarm that trains a reader to ignore this section). */
  const remote = [...document.querySelectorAll('img')]
    .map(i => i.currentSrc || i.src || '')
    .filter(Boolean)
  const framerUnsized = remote.filter(u =>
    u.includes('framerusercontent.com/images/') && !u.includes('scale-down-to='))
  if (framerUnsized.length) {
    add('medium', 'images', `${framerUnsized.length} Framer images bypass sized()`,
      { sample: framerUnsized.slice(0, 3).map(u => u.slice(0, 90)) })
  }
  const supabaseOriginals = remote.filter(u => u.includes('supabase.co/storage'))
  if (supabaseOriginals.length) {
    notes.push(`${supabaseOriginals.length} Supabase storage images ship at their original size - sized() leaves them alone because image transforms are not enabled on this project, so this is a known cost, not a regression`)
  }

  /* ── 6b · the document has exactly one h1, and the order does not skip ────
     Added 2026-09-12 after /yearbook was found rendering its entire
     not-invited state - the whole page for anyone not on the list - inside a
     `div.h-display`, so the document had NO heading at all and a screen reader
     had nothing to announce on arrival.

     This is deliberately a RENDERED check rather than a grep: the heading that
     matters is the one that survives the route's branches, and a page can have
     an <h1> in source that only the other branch renders. */
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter(h => (h.textContent || '').trim() && h.getBoundingClientRect().height > 0)
  const h1s = headings.filter(h => h.tagName === 'H1')
  if (h1s.length === 0) {
    add('medium', 'headings', 'the page renders no h1 at all')
  } else if (h1s.length > 1) {
    add('low', 'headings', `${h1s.length} h1 elements - a document should have one`,
      { sample: h1s.slice(0, 3).map(h => (h.textContent || '').trim().slice(0, 40)) })
  }
  for (let i = 1; i < headings.length; i++) {
    const prev = +headings[i - 1].tagName[1]
    const cur = +headings[i].tagName[1]
    if (cur > prev + 1) {
      add('low', 'headings',
        `heading order skips h${prev} -> h${cur} ("${(headings[i].textContent || '').trim().slice(0, 40)}")`)
      break // one report per run; the first skip is the one to fix
    }
  }

  // ── 7 · tap targets ───────────────────────────────────────────────────────
  const small = [...document.querySelectorAll('button,a,[role="button"],input,select')]
    .filter(el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44)
    })
  if (small.length) {
    add('low', 'targets', `${small.length} controls under 44px`,
      { sample: small.slice(0, 5).map(el => `${el.tagName.toLowerCase()}.${String(el.className || '').slice(0, 26)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`) })
  }

  const order = { high: 0, medium: 1, low: 2 }
  findings.sort((a, b) => order[a.severity] - order[b.severity])

  return {
    where: location.pathname,
    viewport: `${innerWidth}x${innerHeight}`,
    cards: { count: cards.length, shapes, distinct, longestRun },
    findings,
    notes,
    report: findings.length
      ? `${findings.length} finding(s): ` + findings.map(f => `[${f.severity}] ${f.detail}`).join(' | ')
      : `clean at ${innerWidth}px across ${cards.length} cards / ${distinct.length} designs`,
    /* STATED LIMITS. Read these before quoting a clean result.
       - It cannot judge whether a design is GOOD, only whether it is intact,
         varied, filled, legible and contained. Taste is not measurable here.
       - It sees one viewport per run. Run it at 390 and at 1280 at minimum;
         the stack defect looked different at each.
       - It sees what is MOUNTED. A feed that lazy-loads below the fold is only
         audited as far as it has rendered.
       - Text over photography is skipped by the contrast check by design
         (section 4) - the scrim is the mechanism and it has no computed
         ground. Look at those with your eyes. */
    limits: [
      'intactness, not taste',
      'one viewport per run - use 390 and 1280',
      'only what is mounted',
      'text over photos is skipped by the contrast check - look at it',
    ],
  }
})()
