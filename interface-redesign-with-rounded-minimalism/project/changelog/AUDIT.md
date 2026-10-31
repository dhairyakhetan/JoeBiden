# AUDIT — the grep script

Run before every commit that touches a designed surface. **Every rule below is mechanical: it
either passes or it does not, and no judgement is involved.**

Save as `scripts/audit-design.sh`, `chmod +x`, run from the repo root.

```bash
#!/usr/bin/env bash
# Design-system audit. Exits non-zero on any violation.
# Scope: frontend/src, EXCLUDING frontend/src/paradox (untouched by the redesign).
set -uo pipefail
SRC="frontend/src"
EX="--exclude-dir=paradox --exclude-dir=node_modules"
FAIL=0

fail () { echo "FAIL  $1"; FAIL=1; }
pass () { echo "ok    $1"; }
check () { # check <label> <pattern>
  local hits; hits=$(grep -rniE $EX "$2" "$SRC" 2>/dev/null | grep -v '^\s*//' || true)
  if [ -n "$hits" ]; then fail "$1"; echo "$hits" | head -20 | sed 's/^/        /'; else pass "$1"; fi
}

echo "── 1 · radii ─────────────────────────────────────────"
# Only 999 / 32 / 22 / 14 are legal, plus documented 6px and 18px exceptions.
check "illegal border-radius" \
  'border-radius:[[:space:]]*(4|5|8|10|12|16|18|20|24|26|28|30|36|40)px'

echo "── 2 · colour literals ───────────────────────────────"
# Every hex must come from tokens.css. These four were hand-added in the desk.
check "hand-added desk hexes"      '#(c0341f|0b7d57|8a6d00|1769a8)'
check "the orange that is not tomato" '#FF7A1A'
check "the mint that is in no palette"  'rgba\(0,[[:space:]]*229,[[:space:]]*160'
check "undefined --rust token"      'var\(--rust\)'
check "undefined --font-hand"       'var\(--font-hand\)'
check "undefined --r-photo"         'var\(--r-photo\)'
check "undefined --r-card"          'var\(--r-card\)'
check "undefined --poster-gutter"   'var\(--poster-gutter\)'

echo "── 3 · paper-on-ink alphas ───────────────────────────"
# Legal text rungs: 1.00 / .82 / .78 / .72 / .60 / .55. Below .55 fails AA.
check "sub-floor paper alpha on text" \
  'color:[^;]*rgba\(244,[[:space:]]*239,[[:space:]]*224,[[:space:]]*(0)?\.(0|1|2|3|4|5[0-4])'

echo "── 4 · accent-as-text on light grounds ───────────────"
# Saturated accents fail as text on cream/white. Use the *-ink partner.
check "accent used as text colour" \
  'color:[[:space:]]*(var\(--(welfare|lemon|sky|tomato|pink|grape|ops)\)|#(1B8A5A|FFC700|3DA9FC|FF4D2E|FF4D8C|7E5BFF|12909C))'

echo "── 5 · paper text on grape or teal ───────────────────"
check "paper on grape/teal (3.78:1 / 3.32:1)" \
  '(7E5BFF|12909C)[^"}]{0,120}color:[^;]*(#F4EFE0|#FFF|var\(--paper\))'

echo "── 5b · dark ALPHA text on an accent fill ────────────"
# Full-opacity ink is only 4.55:1 on welfare/grape. There is NO alpha headroom.
check "alpha ink as text on an accent" \
  '(1B8A5A|FF4D8C|7E5BFF|12909C|FF4D2E|3DA9FC|FFC700)[^"}]{0,140}color:[^;]*rgba\(10,[[:space:]]*10,[[:space:]]*10,[[:space:]]*(0)?\.[0-9]'
# A translucent dark overlay on an accent also lightens it.
check "ink on a translucent dark pill" \
  'background:[^;]*rgba\(10,[[:space:]]*10,[[:space:]]*10,[[:space:]]*(0)?\.[0-2][^;]*;[[:space:]]*color:[^;]*(--ink|#0A0A0A)'

echo "── 6 · typefaces ─────────────────────────────────────"
check "a fifth typeface" \
  "font-family:[^;]*(Caveat|Inter|Roboto|Arial|Helvetica|Fraunces|system-ui)"

echo "── 7 · the retired motif ─────────────────────────────"
# Hard offset shadow survives ONLY on .btn-primary and stamped stickers.
HITS=$(grep -rnE $EX 'box-shadow:[[:space:]]*[0-9]+px[[:space:]]+[0-9]+px[[:space:]]+0' "$SRC" \
  | grep -viE '(btn-primary|sticker|dock-send|adm-|aq-dock)' || true)
[ -n "$HITS" ] && { fail "offset shadow outside btn-primary/sticker"; echo "$HITS" | head -20 | sed 's/^/        /'; } || pass "offset shadow scoped correctly"

echo "── 8 · outline on images ─────────────────────────────"
# outline ignores border-radius: draws a square across rounded corners.
check "outline on an img" 'img[^{]*\{[^}]*outline'

echo "── 9 · dashed borders ────────────────────────────────"
check "dashed border (retired, except the live marker)" \
  'border:[^;]*dashed'

echo "── 10 · hard-coded public statistics ─────────────────"
# Every public number comes from ORG_FACTS. See 21-org-facts.md.
HITS=$(grep -rnE $EX "['\"`][[:space:]]*[0-9],?[0-9]{3}\+" "$SRC" --include=*.tsx | grep -v orgFacts || true)
[ -n "$HITS" ] && { fail "hard-coded statistic in a component"; echo "$HITS" | head -20 | sed 's/^/        /'; } || pass "no hard-coded statistics"

echo "── 11 · the four disputed drives values ──────────────"
check "a disputed drives figure" "(450|512|534|550)\+"

echo "── 12 · the retired points metric ────────────────────"
check "pointsTile (system retired 2026-09-04)" 'pointsTile'

echo "── 13 · banned copy (BRAND_VOICE §1.2) ───────────────"
check "banned word" \
  "(empower|noble mission|underserved|make a difference|synergy|holistic)"

echo "── 14 · new dependencies ─────────────────────────────"
check "animation library import" \
  "from[[:space:]]*['\"](framer-motion|gsap|lottie|react-spring)"

echo "── 15 · the feedShape boundary ───────────────────────"
if git diff --quiet HEAD -- "$SRC/lib/feedShape.ts" 2>/dev/null; then
  pass "feedShape.ts unmodified"
else
  fail "feedShape.ts was modified — 15-post-cards.md forbids this"
fi
if git diff --quiet HEAD -- "$SRC/lib/feedShape.test.ts" 2>/dev/null; then
  pass "feedShape.test.ts unmodified"
else
  fail "feedShape.test.ts was modified — if a test needed editing, behaviour changed"
fi

echo "── 16 · the retired nudge ────────────────────────────"
check "aq-contact-nudge (retired in 14)" 'aq-contact-nudge'

echo "── 17 · fixed width without box-sizing ───────────────"
# A fixed width + padding under content-box overflows its container.
HITS=$(grep -rnE $EX 'width:[[:space:]]*[0-9]+px[^;}"]*;[^;}"]*padding' "$SRC" \
  | grep -v 'box-sizing' || true)
[ -n "$HITS" ] && { fail "fixed width + padding with no box-sizing"; echo "$HITS" | head -20 | sed 's/^/        /'; } || pass "no unsized fixed-width boxes"

echo "── 18 · horizontal strips must scroll, not clip ──────"
# A row of fixed-width children with overflow:hidden makes the excess unreachable.
HITS=$(grep -rnE $EX 'display:[[:space:]]*.?flex.?[^}"]*overflow(-x)?:[[:space:]]*.?hidden' "$SRC" || true)
[ -n "$HITS" ] && { echo "WARN  flex row with hidden overflow — confirm nothing in-flow is clipped"; echo "$HITS" | head -10 | sed 's/^/        /'; } || pass "no clipping flex rows"

echo "── 19 · scrollers need overscroll containment ────────"
SCROLL=$(grep -rlE $EX 'overflow-x:[[:space:]]*auto' "$SRC" | wc -l | tr -d ' ')
CONTAIN=$(grep -rlE $EX 'overscroll-behavior-x' "$SRC" | wc -l | tr -d ' ')
[ "$SCROLL" -gt "$CONTAIN" ] && fail "$SCROLL files scroll horizontally, only $CONTAIN contain overscroll" || pass "horizontal scrollers contain overscroll"

echo "── 20 · reduced motion coverage ──────────────────────"
RM=$(grep -rl $EX 'prefers-reduced-motion' "$SRC" | wc -l | tr -d ' ')
[ "$RM" -lt 3 ] && fail "only $RM files handle prefers-reduced-motion" || pass "$RM files handle reduced motion"

echo
[ $FAIL -eq 0 ] && echo "PASS — no violations" || echo "FAILED — fix the above"
exit $FAIL
```

## What this catches, mapped to the risks you named

**Rules 17–19 came from a real defect found in review**, not from theory: a 96px card with 10px
horizontal padding occupies 116px, and three of them silently overflowed a 336px row that was
`overflow: hidden`. The card was unreachable. See `README.md`.

| your risk | caught by |
|---|---|
| invariants ignored, things redesigned | 1, 2, 6, 7, 9 |
| the concentric rule not surviving | **1** |
| contrast rules lost | **3, 4, 5, 5b** |
| strings rewritten | **13** (banned words) + the acceptance checklist |
| `feedShape.ts` boundary crossed | **15** — a git-level check, not a grep |
| Supabase wiring broken | *not greppable* — see `ACCEPTANCE.md` |
| pretty pages built, states skipped | *not greppable* — see `ACCEPTANCE.md` |
| "don't clean this up" list missed | **partly 12, 16** + the acceptance checklist |
| stalling on unresolved questions | *not greppable* — process, see `ACCEPTANCE.md` |

**Four of the nine risks are not mechanically detectable.** That is what `ACCEPTANCE.md` is for —
greps catch what a machine can see, and a checklist catches the rest.

## Two things this script deliberately does NOT do

1. **It does not check for missing states.** A page with no error state greps identically to one
   that has it. **Only a checklist catches an absence.**
2. **It does not read intent.** Rule 4 will flag a legitimate accent-on-ink usage. **A flagged line
   with a comment explaining why it is legal is an acceptable resolution** — the point is that the
   decision was made consciously, not that the pattern never appears.
