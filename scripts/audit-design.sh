#!/usr/bin/env bash
# Design-system audit. Exits non-zero on any violation.
#
# WHAT THIS CAN AND CANNOT SEE (2026-09-07). It is grep, not a parser:
#   * It now skips WHOLE comment blocks, continuation lines included, by
#     reading each hit's source file and tracking /* */ state
#     (scripts/lib/strip-comments.awk). It also honours an `audit-ok` marker in
#     the comment above a line, for hits a human has already adjudicated.
#   * It cannot resolve a computed ground. That is why rule 4 is gone: contrast
#     is now measured, not grepped, by frontend/scripts/lint-accent-tokens.mjs.
#   * A hit is still evidence, not a verdict. Read it before you change code.
#
# FIVE BUGS FOUND AND FIXED HERE, in two passes, after a review found the
# script was being ignored because its output could not be trusted:
#   1. the comment filter NEVER FIRED. grep -rn prints "path:line:content", so
#      the old `grep -v '^\s*//'` tested the file PATH, never the code.
#   2. the five "undefined --x token" rules flagged every USE of a token
#      without ever checking whether it was defined. Four of the five tokens
#      are defined in tokens.css, so they failed permanently on correct code.
#   3. (2026-09-07, second pass) the v2 comment filter still could not see a
#      CONTINUATION line, which is where rules 2, 10 and 11 got their entire
#      hit list — prose about a bug, reported as the bug.
#   4. rule 5b's alpha class was INVERTED: it fired on the safe range.
#   5. rule 17 had no left word boundary, so `min-width:` and `max-width:`
#      counted as "a fixed width".
#   Rules 6 (typefaces) and 14 (dependencies) additionally contradicted
#   DESIGN.md itself — see the notes on each.
#     A gate nobody trusts is worse than no gate.
# Verbatim from interface-redesign-with-rounded-minimalism/project/changelog/AUDIT.md.
# Scope: frontend/src, EXCLUDING frontend/src/paradox (untouched by the redesign).
set -uo pipefail
SRC="frontend/src"
EX="--exclude-dir=paradox --exclude-dir=node_modules"
FAIL=0

fail () { echo "FAIL  $1"; FAIL=1; }
pass () { echo "ok    $1"; }
note () { echo "note  $1"; }
check_ignore () { note "$1"; }
# The comment filter has now been wrong twice. v1 (`grep -v '^\s*//'`) tested
# the file PATH, because grep -rn prints "path:line:content". v2 stripped that
# prefix but could still only see a line that OPENS with // or * - so every
# CONTINUATION line of a block comment was still reported as code, which is
# where rules 2, 10 and 11 got their entire hit list from. v3 (below) reads the
# actual source file and tracks /* */ state, so a whole comment block is a
# comment block. See scripts/lib/strip-comments.awk.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# EXEMPTIONS. A hit is dropped when the line itself, or the comment block
# immediately above it, contains the marker `audit-ok`. AUDIT.md already allows
# "a flagged line with a comment explaining why it is legal" as a resolution;
# this makes that resolution machine-readable instead of a human re-reading the
# same twenty adjudicated lines every run. Write it as
# `audit-ok: <rule> - <why>` and keep the reason honest.
strip_comments () { awk -f "$HERE/lib/strip-comments.awk" || true; }

check () { # check <label> <pattern>
  local hits; hits=$(grep -rniE $EX "$2" "$SRC" 2>/dev/null | strip_comments)
  if [ -n "$hits" ]; then fail "$1"; echo "$hits" | head -20 | sed 's/^/        /'; else pass "$1"; fi
}

# BUG 2: the "undefined --x token" rules flagged every USE of a token, without
# ever checking whether it is defined. --r-card, --r-photo and --rust are all
# defined in tokens.css today, so those three fired on correct code forever.
# A use is only a defect if tokens.css does not define the token.
TOKENS="$SRC/styles/tokens.css"
check_token () { # check_token <token-name-without-dashes>
  if grep -qE "^[[:space:]]*--$1:" "$TOKENS" 2>/dev/null; then
    pass "--$1 is defined in tokens.css"
  else
    local hits; hits=$(grep -rniE $EX "var\(--$1\)" "$SRC" 2>/dev/null | strip_comments)
    if [ -n "$hits" ]; then fail "undefined --$1"; echo "$hits" | head -20 | sed 's/^/        /'; else pass "--$1 unused and undefined"; fi
  fi
}

echo "── 1 · radii ─────────────────────────────────────────"
check "illegal border-radius" \
  'border-radius:[[:space:]]*(4|5|8|10|12|16|18|20|24|26|28|30|36|40)px'
# Companion for React's camelCase inline-style form (`style={{ borderRadius: 10 }}`
# or `style={{ borderRadius: '10px' }}`) - grep does not parse JSX, so
# `border-radius:` above never matches `borderRadius:`, and a live violation
# written as an inline style passes the kebab-case rule silently. .tsx only:
# camelCase JSX does not exist in .css. The trailing group requires a
# non-digit/quote/brace/space (or end of line) after the value so "40" cannot
# match inside e.g. "140" the way bug #5 in the file header describes for
# rule 17.
#
# This check is new (2026-09-07) and, like rule 7's box-shadow companion below,
# its first run surfaced a backlog of PRE-EXISTING inline-style radii the old
# kebab-case-only pattern could never see - not new violations from today's
# fix pass, they were always there. Reported as WARN, not FAIL, for the same
# reason rule 7 warns instead of fails on its own backlog: this gate should not
# retroactively block every future build on debt nobody introduced today. Clear
# each with an `audit-ok` comment (or a real fix) as it is adjudicated.
HITS=$(grep -rniE $EX "borderRadius:[[:space:]]*['\"]?(4|5|8|10|12|16|18|20|24|26|28|30|36|40)(px)?['\"]?([,}]|[[:space:]]|$)" "$SRC" --include=*.tsx \
  | strip_comments || true)
if [ -n "$HITS" ]; then
  echo "WARN  $(echo "$HITS" | wc -l | tr -d ' ') illegal border-radius values in camelCase JSX (pre-existing backlog) — retire or mark audit-ok per site"
  echo "$HITS" | head -20 | sed 's/^/        /'
else
  pass "illegal border-radius (camelCase JSX)"
fi

echo "── 2 · colour literals ───────────────────────────────"
check "hand-added desk hexes"      '#(c0341f|0b7d57|8a6d00|1769a8)'
check "the orange that is not tomato" '#FF7A1A'
check "the mint that is in no palette"  'rgba\(0,[[:space:]]*229,[[:space:]]*160'
check_token "rust"
check_token "font-hand"
check_token "r-photo"
check_token "r-card"
check_token "poster-gutter"

echo "── 3 · paper-on-ink alphas ───────────────────────────"
# `(^|[^-a-zA-Z])color:` and an rgba() that follows IMMEDIATELY: the old
# pattern's `color:[^;]*rgba(` matched `border-color:`, `background-color:` and
# `caret-color:`, and in JSX (no semicolons between properties) it matched a
# `color:` on one property and an rgba() on a LATER one. Three of its four hits
# were borders. This rule is about TEXT.
check "sub-floor paper alpha on text" \
  '(^|[^-a-zA-Z])color:[[:space:]]*.?rgba\(244,[[:space:]]*239,[[:space:]]*224,[[:space:]]*(0)?\.(0|1|2|3|4|5[0-4])'

# ── 4 · accent-as-text on light grounds ───────────────
# DELETED 2026-09-07. This was a bare grep with no exemption model and no
# ground resolution: it reported ~171 lines, of which about 105 were ever real,
# and it flagged `border-color`/`caret-color`/`background` as "text colour".
# It is now implemented properly by frontend/scripts/lint-accent-tokens.mjs,
# which resolves var()/color-mix()/rgba() chains, computes the real contrast
# ratio against the resolved ground, and carries an exemption baseline
# (frontend/scripts/accent-lint-baseline.json). Run that, not this. Two
# implementations of one rule is how this rule got re-broken six times.

echo "── 5 · paper text on grape or teal ───────────────────"
check "paper on grape/teal (3.78:1 / 3.32:1)" \
  '(7E5BFF|12909C)[^"}]{0,120}color:[^;]*(#F4EFE0|#FFF|var\(--paper\))'

echo "── 5b · dark ALPHA text on an accent fill ────────────"
check "alpha ink as text on an accent" \
  '(1B8A5A|FF4D8C|7E5BFF|12909C|FF4D2E|3DA9FC|FFC700)[^"}]{0,140}color:[^;]*rgba\(10,[[:space:]]*10,[[:space:]]*10,[[:space:]]*(0)?\.[0-9]'
# INVERTED, fixed 2026-09-07. The old alpha class was `[0-2]`, i.e. it fired on
# rgba(10,10,10,0.0x-0.2x) - a barely-tinted pill on a light ground, where ink
# text has MORE contrast, not less. The defect this rule is named for is the
# opposite: a pill dark enough that ink text sinks into it. Flag from .35 up.
check "ink on a translucent dark pill" \
  'background:[^;]*rgba\(10,[[:space:]]*10,[[:space:]]*10,[[:space:]]*(0)?\.(3[5-9]|[4-9])[^;]*;[[:space:]]*color:[^;]*(--ink|#0A0A0A)'

echo "── 6 · typefaces ─────────────────────────────────────"
# REWRITTEN 2026-09-07. The old pattern was
#   font-family:[^;]*(Caveat|Inter|Roboto|Arial|Helvetica|Fraunces|system-ui)
# and it was wrong three ways:
#   * Caveat is SANCTIONED. DESIGN.md §0.1 was amended by the project owner on
#     2026-09-06: Caveat is a fifth face on member- and public-facing surfaces
#     and is banned ONLY on the director/* desk. The old rule banned it
#     everywhere, i.e. it contradicted the document it claims to enforce.
#   * `system-ui`/`sans-serif` as the LAST resort in `var(--display),system-ui,
#     sans-serif` is a fallback, not a typeface choice. Banning a fallback asks
#     for a stack with no fallback.
#   * it matched inside strings that are not app CSS at all (the .xls export in
#     director/VolunteerApplicationsParts.tsx writes Arial for Excel).
# So: a banned family is only banned when it is the FIRST family named, and
# Caveat is only banned on the desk.
check "a genuinely foreign face"   "font-family:[[:space:]]*['\"]?(Inter|Roboto|Fraunces|Helvetica|Arial|system-ui)['\"]?[,;]"
CAVEAT_DESK=$(grep -rniE $EX "font-family:[^;]*Caveat" "$SRC/director" 2>/dev/null | strip_comments)
if [ -n "$CAVEAT_DESK" ]; then
  fail "Caveat on the HoD desk (DESIGN.md §0.1 - sanctioned everywhere EXCEPT director/*)"
  echo "$CAVEAT_DESK" | head -20 | sed 's/^/        /'
else
  pass "Caveat stays off the desk"
fi

echo "── 7 · the retired motif ─────────────────────────────"
# SPLIT 2026-09-07 into a gate and an advisory, because one grep cannot tell a
# stamped sticker from a card and this rule was failing on both:
#   * On the HoD desk there is no sticker exception at all. CLAUDE.md and
#     changelog 06.1 are unambiguous - soft hairline borders and soft lifts, so
#     ANY hard offset under director/ is a defect. That FAILS.
#   * On the public front-end the motif is retired card-by-card, section by
#     section, by the changelog. Whether a given surface is a card (retire) or
#     a sticker/primary button (keep) is a design decision per surface, not
#     something a grep can settle - and the exclusion list is selector-based,
#     so it misses any rule whose box-shadow sits on a later line. Those are
#     reported as WARN with the full list, and cleared with `audit-ok` as each
#     is adjudicated.
OFFSETS_CSS=$(grep -rnE $EX 'box-shadow:[[:space:]]*[0-9]+px[[:space:]]+[0-9]+px[[:space:]]+0' "$SRC" \
  | strip_comments | grep -viE '(btn-primary|sticker|dock-send|adm-|aq-dock)' || true)
# Companion for React's camelCase inline-style form (`style={{ boxShadow: '2px 2px 0 0
# var(--ink)' }}`) - the kebab-case pattern above never matches `boxShadow:`, so a hard
# offset written as an inline style passed this gate silently. .tsx only: camelCase JSX
# does not exist in .css. Same exemption filter as the kebab-case hits, on the same
# assumption that already applies to it (className and style sitting on the matched line).
OFFSETS_JSX=$(grep -rnE $EX "boxShadow:[[:space:]]*['\"\`][[:space:]]*[0-9]+px[[:space:]]+[0-9]+px[[:space:]]+0" "$SRC" --include=*.tsx \
  | strip_comments | grep -viE '(btn-primary|sticker|dock-send|adm-|aq-dock)' || true)
OFFSETS=$(printf '%s\n%s\n' "$OFFSETS_CSS" "$OFFSETS_JSX" | grep . || true)
DESK_OFFSETS=$(echo "$OFFSETS" | grep -E '(/director/|routes/director)' || true)
PUB_OFFSETS=$(echo "$OFFSETS" | grep -vE '(/director/|routes/director)' | grep . || true)
if [ -n "$DESK_OFFSETS" ]; then
  fail "hard offset shadow on the HoD desk (no sticker exception there)"
  echo "$DESK_OFFSETS" | head -20 | sed 's/^/        /'
else
  pass "no hard offset shadow on the desk"
fi
if [ -n "$PUB_OFFSETS" ]; then
  echo "WARN  $(echo "$PUB_OFFSETS" | wc -l | tr -d ' ') offset shadows left on the front-end — retire or mark audit-ok per surface"
  echo "$PUB_OFFSETS" | head -30 | sed 's/^/        /'
else
  pass "offset shadow scoped correctly on the front-end"
fi

echo "── 8 · outline on images ─────────────────────────────"
# `outline: none` is the FIX for this rule, not a violation of it - the rule is
# "outline ignores border-radius", and removing the outline is how you comply.
# The old pattern reported the three lines that had already been fixed.
check "outline on an img" 'img[^{]*\{[^}]*outline:[[:space:]]*[^n[:space:];}]'

echo "── 9 · dashed borders ────────────────────────────────"
check "dashed border (retired, except the live marker)" \
  'border:[^;]*dashed'

echo "── 10 · hard-coded public statistics ─────────────────"
HITS=$(grep -rnE $EX "['\"\`][[:space:]]*[0-9],?[0-9]{3}\+" "$SRC" --include=*.tsx | strip_comments | grep -v orgFacts || true)
[ -n "$HITS" ] && { fail "hard-coded statistic in a component"; echo "$HITS" | head -20 | sed 's/^/        /'; } || pass "no hard-coded statistics"

echo "── 11 · the four disputed drives values ──────────────"
check "a disputed drives figure" "(450|512|534|550)\+"

echo "── 12 · the retired points metric ────────────────────"
check "pointsTile (system retired 2026-09-04)" 'pointsTile'

echo "── 13 · banned copy (BRAND_VOICE §1.2) ───────────────"
# LabsPage.tsx is EXCLUDED, and only from this one rule.
#
# changelog/12-secondary-pages.md §12.3: "Every description is the team's own
# submission. Do not edit, tighten or fix." LabsPage's own header (:38-40)
# states the governing principle the same way: the no-em-dash rule, and by
# extension every copy rule here, "governs copy WE write."
#
# This rule greps for words BRAND_VOICE §1.2 bans from AquaTerra's own voice.
# LabsPage.tsx:142 contains "By empowering youth to..." inside a Labs team's
# VERBATIM submitted project description. It is a real hit on the pattern and a
# false positive on the rule: those are somebody else's words, quoted, and
# rewriting them to pass an audit would be the audit corrupting the record it
# was built to protect. Reported, not edited (DESIGN.md §11).
#
# Keep this exclusion scoped to rule 13. LabsPage is still audited by every
# other rule in this file, and this line does NOT license writing banned words
# into any copy the project authors itself.
BANNED_HITS=$(grep -rniE $EX --exclude=LabsPage.tsx \
  "(empower|noble mission|underserved|make a difference|synergy|holistic)" \
  "$SRC" 2>/dev/null | grep -v '^\s*//' || true)
if [ -n "$BANNED_HITS" ]; then
  fail "banned word"; echo "$BANNED_HITS" | head -20 | sed 's/^/        /'
else
  pass "banned word (LabsPage.tsx excluded — §12.3, verbatim team submissions)"
fi

echo "── 14 · new dependencies ─────────────────────────────"
# framer-motion REMOVED from this list 2026-09-07. DESIGN.md §0.4 bans NEW
# dependencies - "everything is hand-rolled or already in package.json".
# framer-motion predates the redesign, is the documented motion toolkit
# (CLAUDE.md, lib/motion.ts), is already inside the modulepreload budget
# DESIGN.md §"the motion budget" measures, and is imported by 68 files. A rule
# that fails on the toolkit the design document tells you to use is not
# enforcing that document. What is still banned is adding a SECOND one.
check "a new animation library" \
  "from[[:space:]]*['\"](gsap|lottie|react-spring|animejs|popmotion|motion/react)"

# 2026-09-11, SECOND owner decision (ACCEPTANCE.md §E records it in full).
# Two things that §E had frozen were authorised, because in both cases the
# freeze was protecting an error rather than a behaviour:
#
#   (a) rule 3's body band moved 240-600 -> 120-600. Measured across all 586
#       live rows, ZERO fell in 240-600 while 311 sit at 120-179 - the floor
#       made the colour block impossible rather than rare, and the catalogue
#       then recorded C02 as unpopulatable because of the threshold we chose.
#       Rule 3 keeps both caps, so reach changed and behaviour did not: the
#       other 30 assertions in feedShape.test.ts pass unmodified.
#
#   (b) C06 and family 03's record cards now render `extras` + `MetaRow`, so a
#       blog or a figures-only drive can use them without silently losing
#       like/bookmark/comment/share. That is a card change, not a chooser
#       change, but it reverses a documented design note so it is recorded.
#
# Consequent test edits: the `none` list loses C02/C04/C06 (C01 stays - it
# needs an image aspect ratio and nothing stores width/height), and the C06
# data test is renamed and inverted.
#
# These checks compare the WORKING TREE to HEAD, so they go green once the
# authorised change is committed. That is the intended shape of this gate: it
# stops an unreviewed edit sitting in a working tree, and ACCEPTANCE.md plus
# the commit message are what carry the decision afterwards. A third exception
# means editing this block again, deliberately.
echo "── 15 · the feedShape boundary ───────────────────────"
if git diff --quiet HEAD -- "$SRC/lib/feedShape.ts" 2>/dev/null; then
  pass "feedShape.ts unmodified"
else
  # 2026-09-07: the owner authorised a COMMENT-ONLY edit here. SHAPE_CATALOGUE's
  # dataNotes were factually wrong - they claimed `posts` has no image columns
  # when 504 of 585 rows carry one, which sent four shapes to the wrong
  # diagnosis. ACCEPTANCE.md §E's binding requirement is the NEXT check (the
  # test passing unmodified), which still holds. So this reports whether the
  # diff is comment-only, and only fails if real code moved.
  # The 2026-09-11 allowance is TWO named lines and nothing else: rule 3's
  # body band, and the rule string that prints it. Written as literal patterns
  # so anything else in this file still fails, and so widening it again means
  # editing this line on purpose.
  if git diff -U0 HEAD -- "$SRC/lib/feedShape.ts" 2>/dev/null        | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)'        | grep -vE "images >= 1 && hue && len >= (120|240) && len <= 600"        | grep -vE "rule: '05\.3 image, mapped hue, body (120|240) to 600'"        | grep -qvE "^[+-][[:space:]]*(\*|//|/\*)|dataNote:"; then
    fail "feedShape.ts has NON-COMMENT changes — §E allows comments only"
  else
    note "feedShape.ts modified within the authorised set (2026-09-07 comments, 2026-09-11 rule-3 band) - ACCEPTANCE.md §E"
  fi
fi
if git diff --quiet HEAD -- "$SRC/lib/feedShape.test.ts" 2>/dev/null; then
  pass "feedShape.test.ts unmodified"
else
  # The blanket "any edit is a fail" version of this rule was protecting an
  # ERROR. C03 is the most reachable content shape in the catalogue (504 of 585
  # rows carry one image), and the `records the shapes the real table cannot
  # populate` assertion listed it as unpopulatable. That made a correct fix to
  # feedShape.ts unshippable: correcting the value broke a test asserting
  # something false. The owner unfroze exactly this one assertion on
  # 2026-09-07; ACCEPTANCE.md §E records it.
  #
  # So the rule is now specific rather than absolute. Every changed line must
  # be a comment or the `none` expectation itself — a changed assertion
  # anywhere else, or a new/removed test, still fails. This cannot be widened
  # by accident: adding a second exception means editing this rule again.
  # 2026-09-11 allowance, same shape as the 2026-09-07 one: the C06 data
  # assertions (that shape is reachable now) and the two test NAMES that
  # described the old state. Every other assertion still has to be untouched.
  tf_changed=$(git diff -U0 HEAD -- "$SRC/lib/feedShape.test.ts" 2>/dev/null     | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)'     | grep -vE "^[+-][[:space:]]*(//|\*|/\*)"     | grep -vE "^[+-][[:space:]]*$"     | grep -vE "expect\(none\)\.toEqual\("     | grep -vE "expect\(c06\.(data|dataNote)\)\.(toBe|toContain)\("     | grep -vE "it\('says why C06 long read (has no data|is now reachable)'"     | grep -vE "it\('rule 3 needs a mapped hue, a picture and a (120|240) to 600 body'"     | grep -vE "^[+-][[:space:]]*[})]+;?[[:space:]]*$" || true)
  if [ -n "$tf_changed" ]; then
    fail "feedShape.test.ts changed outside the one authorised assertion — behaviour changed"
    printf '%s
' "$tf_changed" | sed 's/^/     /'
  elif git diff HEAD -- "$SRC/lib/feedShape.test.ts" 2>/dev/null | grep -qE "^\+.*expect\(none\)\.toEqual\(.*'C03'"; then
    fail "feedShape.test.ts still pins C03 as unpopulatable — that is the error the unfreeze existed to correct"
  else
    note "feedShape.test.ts modified within the authorised set (2026-09-07 C03 unfreeze, 2026-09-11 C02/C04/C06 reach) - ACCEPTANCE.md §E"
  fi
fi

echo "── 16 · the retired nudge ────────────────────────────"
check "aq-contact-nudge (retired in 14)" 'aq-contact-nudge'

echo "── 17 · fixed width without box-sizing ───────────────"
# `(^|[^-])width:` 2026-09-07: the old pattern had no left boundary, so it
# matched `min-width:` and `max-width:` too. min-width + padding is not the
# content-box overflow bug this rule exists for — a min-width is a floor and the
# box is still free to grow. Six of the seven hits were min-width; the seventh
# was a `@media (max-width: 900px)` query.
HITS=$(grep -rnE $EX '(^|[^-])width:[[:space:]]*[0-9]+px[^;}"]*;[^;}"]*padding' "$SRC" \
  | strip_comments | grep -v 'box-sizing' || true)
[ -n "$HITS" ] && { fail "fixed width + padding with no box-sizing"; echo "$HITS" | head -20 | sed 's/^/        /'; } || pass "no unsized fixed-width boxes"

echo "── 18 · horizontal strips must scroll, not clip ──────"
HITS=$(grep -rnE $EX 'display:[[:space:]]*.?flex.?[^}"]*overflow(-x)?:[[:space:]]*.?hidden' "$SRC" || true)
[ -n "$HITS" ] && { echo "WARN  flex row with hidden overflow — confirm nothing in-flow is clipped"; echo "$HITS" | head -10 | sed 's/^/        /'; } || pass "no clipping flex rows"

echo "── 19 · scrollers need overscroll containment ────────"
# Was a count comparison (`16 files scroll, only 15 contain`), which told you a
# file was missing but never which one, and would have passed if an unrelated
# file had gained the property. Now it names the offenders.
# The file list comes from grep -rn | strip_comments, not grep -rl: HomePage.tsx
# only *mentions* `overflow-x: auto` in a comment explaining the rule, and -l
# cannot tell prose from code.
MISSING=""
for f in $(grep -rnE $EX 'overflow-x:[[:space:]]*auto' "$SRC" | strip_comments | cut -d: -f1 | sort -u); do
  grep -q 'overscroll-behavior-x' "$f" || MISSING="$MISSING$f
"
done
if [ -n "$MISSING" ]; then
  fail "horizontal scroller without overscroll-behavior-x"; printf "$MISSING" | sed 's/^/        /'
else
  pass "horizontal scrollers contain overscroll"
fi

echo "── 20 · reduced motion coverage ──────────────────────"
RM=$(grep -rl $EX 'prefers-reduced-motion' "$SRC" | wc -l | tr -d ' ')
[ "$RM" -lt 3 ] && fail "only $RM files handle prefers-reduced-motion" || pass "$RM files handle reduced motion"

echo "── 22 · Tailwind classes that never load ─────────────"
# WHY THIS RULE EXISTS
#
# Tailwind is NOT in the main bundle. It was moved to
# `src/paradox/tailwind.css`, which only the lazily-mounted ParadoxRoot
# imports. So a Tailwind utility written anywhere outside `paradox/` resolves
# to NOTHING - the class attribute is there, the rule is not, and the element
# renders unstyled.
#
# It fails silently and it looks like a design problem rather than a missing
# stylesheet, which is why it kept happening. Three instances were live on
# 2026-09-12, found only because one of them was audited by hand:
#   auth/SettingsPage.tsx        the two-column layout never happened
#   public/CollaborationsPage    paired fields never paired, and had no gap
#   teams/CreateTeamPostModal    styled ENTIRELY in Tailwind, so entirely
#                                unstyled - no scroll cap, no borders, footer
#                                never reversed, buttons never full-width
# `components/Modal.tsx` already documented the failure mode in a comment; a
# comment is not a gate.
#
# The pattern targets a RESPONSIVE PREFIX (`sm:` `md:` `lg:` `xl:` inside a
# className), because that is unambiguous - no hand-written CSS class in this
# project contains a colon - and every one of the three real instances carried
# one. A bare `flex` or `gap-2` is NOT flagged: v6.css defines its own `.row`,
# `.col`, `.gap-2/3/4/6/8`, `.flex-1`, `.flex-wrap`, `.items-start`, and
# guessing which bare utilities are Tailwind's would produce false positives on
# the project's own classes.
HITS=$(grep -rnE $EX --include=*.tsx 'className="[^"]*\b(sm|md|lg|xl):[a-z-]' "$SRC" \
  | grep -v "$SRC/paradox/" | strip_comments || true)
if [ -n "$HITS" ]; then
  fail "Tailwind responsive class outside paradox/ - it will not load"
  echo "$HITS" | head -20 | sed 's/^/        /'
else
  pass "no Tailwind responsive classes outside paradox/"
fi

echo "── 21 · a shipped card shape must carry the card contract ─"
# WHY THIS RULE EXISTS, and what it would have caught.
#
# On 2026-09-11 the live feed showed three or four card designs where the
# library has thirty. The cause was not the chooser. `SHAPED_SHAPES`
# (feed/feedItemFromPost.ts) is the set of shapes the dispatcher will actually
# render; anything outside it falls through to the legacy FeedPostCard layout,
# silently. C02's doc block in that same file said "IN as of 2026-09-11" and
# the set did not list it - so every row the chooser sent to C02 rendered as
# something else and the design never appeared. Prose and code disagreed, and
# nothing was checking.
#
# The second half is the reason shapes get held OUT of that set in the first
# place: `extras` (types.ts) carries six host-resolved blocks - the welfare
# rail, stat pills, the link CTA, the documents chip, the closed-role notice.
# A card that does not render `{extras}` drops all six with no error, and the
# reader loses content the row actually had. C04, C06, C11, then C01 and C02
# each had to be brought up to that contract before they were let in. A shape
# added to the set without it is a silent regression by construction.
#
# This is a SOURCE check, and it is honest about its limit: it proves a shape
# is reachable and contract-complete. It cannot prove the result looks right.
# That takes a browser - see frontend/scripts/design-probe.js.
FIF="$SRC/feed/feedItemFromPost.ts"
REG="$SRC/feed/cards/registry.ts"
if [ -f "$FIF" ] && [ -f "$REG" ]; then
  SET_LINE=$(grep -E 'export const SHAPED_SHAPES' "$FIF")
  SHIPPED=$(printf '%s' "$SET_LINE" | grep -oE "'C[0-9]{2}'" | tr -d "'" | sort -u)
  # THE ONE EXEMPTION, and why it is not a hole. C25 (CardCompact) is the group
  # card: a name, a verb and a time per row, deliberately. It carries no extras
  # because a row that HAS any must never reach it - and that is enforced, not
  # hoped for. `isGroupable` (feedItemFromPost.ts) rejects a row with a
  # sourceType, an image, stats, documents, tagged members or a linkUrl, which
  # is exactly the set `extras` is built from. So the guarantee this gate exists
  # to make holds for C25 through a different mechanism, and the gate below
  # checks that mechanism is still there rather than just waving C25 through.
  if grep -qE 'function isGroupable' "$FIF" \
     && grep -A 12 'function isGroupable' "$FIF" | grep -q 'linkUrl' \
     && grep -A 12 'function isGroupable' "$FIF" | grep -q 'documents'; then
    pass "C25's extras exemption is still backed by isGroupable"
  else
    fail "C25 is exempt from the extras rule only because isGroupable filters those rows - that filter is gone or changed"
  fi

  MISSING_EXTRAS=""
  for s in $SHIPPED; do
    [ "$s" = "C25" ] && continue
    COMP=$(grep -E "^[[:space:]]*$s:" "$REG" | sed -E "s/^[[:space:]]*$s:[[:space:]]*([A-Za-z0-9_]+).*/\1/")
    [ -z "$COMP" ] && { MISSING_EXTRAS="$MISSING_EXTRAS$s has no component in registry.ts
"; continue; }
    # The destructured param list, up to the closing brace of the pattern.
    SIG=$(grep -hE "export function $COMP\(\{[^)]*" $SRC/feed/cards/family*.tsx | head -1)
    [ -z "$SIG" ] && { MISSING_EXTRAS="$MISSING_EXTRAS$s ($COMP) not found in family*.tsx
"; continue; }
    printf '%s' "$SIG" | grep -q 'extras' \
      || MISSING_EXTRAS="$MISSING_EXTRAS$s ($COMP) is in SHAPED_SHAPES but does not take extras
"
  done
  if [ -n "$MISSING_EXTRAS" ]; then
    fail "a shipped shape drops the host's extras"; printf '%s' "$MISSING_EXTRAS" | sed 's/^/        /'
  else
    pass "every shape in SHAPED_SHAPES renders extras ($(printf '%s' "$SHIPPED" | wc -w | tr -d ' ') shapes)"
  fi

  # Prose that claims a shape ships must agree with the set. The doc block
  # writes "  C02              IN as of ..." / "  C01 / C02        ... came IN".
  CLAIMED=$(grep -E '^\s*\*\s+C[0-9]{2}(\s*/\s*C[0-9]{2})?\s+(IN|.*came IN)' "$FIF" \
    | grep -oE 'C[0-9]{2}' | sort -u)
  DRIFT=""
  for s in $CLAIMED; do
    printf '%s' "$SHIPPED" | grep -qx "$s" || DRIFT="$DRIFT$s is documented as shipping and is NOT in SHAPED_SHAPES
"
  done
  if [ -n "$DRIFT" ]; then
    fail "SHAPED_SHAPES prose disagrees with the set"; printf '%s' "$DRIFT" | sed 's/^/        /'
  else
    pass "SHAPED_SHAPES prose and set agree"
  fi
else
  note "feedItemFromPost.ts / registry.ts not found - shape contract gate skipped"
fi

echo
[ $FAIL -eq 0 ] && echo "PASS — no violations" || echo "FAILED — fix the above"
exit $FAIL
