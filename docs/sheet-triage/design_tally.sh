#!/usr/bin/env bash
# Mechanical design guardrail check over the lines a change ADDS (docs/context/DESIGN_GUARDRAILS.md, G1 to G6, G9, G15 to G17).
# It never reads the whole tree: legacy leftovers are other reports' work. It only judges the diff.
# The diff includes new files you have not staged yet (an untracked component is the most common thing to miss).
#
#   bash docs/sheet-triage/design_tally.sh            diff of the working tree and branch against origin/main
#   TALLY_BASE=<ref> bash ...                         a different base
#   TALLY_DIFF_FILE=<file> bash ...                   judge a saved unified diff (used by the self test)
#   TALLY_BLOCK=1 bash ...                            also print the `Guardrail tally:` block for the PR body
#
# Exit 0 = no FAIL (WARN lines still need a human look), exit 1 = at least one FAIL,
# exit 2 = the check could not run (base ref missing). Exit 2 is never a pass: fetch the base and run it again.
# A FAIL is a guardrail breach unless the PR body records a documented exception for it.
set -uo pipefail

BASE="${TALLY_BASE:-origin/main}"
SRC_EXT='css|tsx?|jsx?|json'
if [ -n "${TALLY_DIFF_FILE:-}" ]; then
  DIFF="$(cat "$TALLY_DIFF_FILE")"
else
  if ! git rev-parse --verify -q "$BASE^{commit}" >/dev/null; then
    echo "ERROR base '$BASE' not found, so nothing was judged. Run: git fetch origin main"
    exit 2
  fi
  MB="$(git merge-base "$BASE" HEAD)" || { echo "ERROR no merge base with '$BASE', so nothing was judged."; exit 2; }
  DIFF="$(git diff -U0 "$MB" -- 'frontend/src' ':!frontend/src/paradox' ':!frontend/src/terranotes' ':!frontend/src/live' ':!frontend/src/styles/tokens.css' ':!*.test.ts' ':!*.test.tsx')"
  # New files that are not staged yet do not appear in `git diff`; add them as if every line were added.
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    DIFF="$DIFF"$'\n'"+++ b/$f"$'\n'"$(sed 's/^/+/' "$f")"
  done < <(git ls-files --others --exclude-standard -- 'frontend/src' \
             | grep -E "\.($SRC_EXT)$" | grep -vE '^frontend/src/(paradox|terranotes|live)/|/tokens\.css$|\.test\.tsx?$' || true)
fi

# "file<TAB>line" for every added line, skipping the file header lines.
ADDED="$(printf '%s\n' "$DIFF" | awk '
  /^\+\+\+ b\// { f = substr($0, 7); next }
  /^\+\+\+ /    { next }
  /^\+/         { print f "\t" substr($0, 2) }
')"

FAIL=0
declare -A GSTATE=()      # guardrail id -> ok | WARN | FAIL, the worst seen
fail() { echo "FAIL  $1"; FAIL=1; mark "$1" FAIL; }
warn() { echo "WARN  $1"; mark "$1" WARN; }
ok()   { echo "ok    $1"; mark "$1" ok; }
mark() { # mark <label> <state>: record the worst state for each G-number named in the label
  local g
  for g in $(printf '%s' "$1" | grep -oE 'G[0-9]+'); do
    case "${GSTATE[$g]:-}:$2" in
      FAIL:*|*:FAIL) GSTATE[$g]=FAIL ;;
      WARN:*|*:WARN) GSTATE[$g]=WARN ;;
      *) GSTATE[$g]=ok ;;
    esac
  done
}

# report <level> <label> <hits>
report() {
  local level="$1" label="$2" hits="$3"
  if [ -n "$hits" ]; then
    if [ "$level" = fail ]; then fail "$label"; else warn "$label"; fi
    printf '%s\n' "$hits" | head -6 | sed 's/^/        /'
  else
    ok "$label"
  fi
}

# check <level> <label> <regex> [file filter regex] [grep mode] [drop regex]; prints up to 6 offending lines.
# Comment-only lines (// , *, /*, {/*) are skipped so prose that names a banned thing does not trip it.
# An optional sixth argument drops lines that match it (for known false positives such as href="#add").
check() {
  local level="$1" label="$2" pat="$3" files="${4:-.}" mode="${5:--E}" drop="${6:-}" hits
  hits="$(printf '%s\n' "$ADDED" | awk -F'\t' -v ff="$files" '$1 ~ ff { print }' | LC_ALL=C.UTF-8 grep "$mode" -- "$pat" | grep -vE $'\t[[:space:]]*(//|\\*|/\\*|\\{/\\*)' || true)"
  if [ -n "$hits" ] && [ -n "$drop" ]; then hits="$(printf '%s\n' "$hits" | grep -vE -- "$drop" || true)"; fi
  report "$level" "$label" "$hits"
}

# Radius values, any property spelling (border-radius, borderRadius, border-top-left-radius, borderTopLeftRadius),
# any unit (px, rem, em, a bare number in inline styles), shorthand with several values. Allowed: 0, 6, 14, 18, 22, 32,
# 999 and up (pill), percentages (a circle) and anything through var(). 6 and 18 are the documented exceptions.
radius_hits() {
  printf '%s\n' "$ADDED" | awk -F'\t' '
    $1 !~ /\.(css|tsx?|jsx?)$/ { next }
    $2 ~ /^[ \t]*(\/\/|\*|\/\*|\{\/\*)/ { next }
    {
      s = $2; bad = ""
      while (match(s, /[Bb]order[A-Za-z-]*[Rr]adius[ \t]*:[^;}]*/)) {
        d = substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH)
        sub(/^[^:]*:/, "", d); gsub(/var\([^)]*\)/, "", d); sub(/,.*/, "", d)
        while (match(d, /[0-9]*\.?[0-9]+(px|rem|em|%)?/)) {
          tok = substr(d, RSTART, RLENGTH); d = substr(d, RSTART + RLENGTH)
          if (tok ~ /%$/) continue
          v = tok + 0
          if (tok ~ /(rem|em)$/) v = v * 16
          if (v == 0 || v == 6 || v == 14 || v == 18 || v == 22 || v == 32 || v >= 999) continue
          bad = tok
        }
      }
      if (bad != "") print $1 "\t" $2
    }'
}

if [ -z "$ADDED" ]; then echo "ok    no added lines under frontend/src (nothing to judge)"; exit 0; fi

CODE='\.(css|tsx?|jsx?)$'
# G1 radii: 999 / 32 / 22 / 14 only (6 and 18 are documented exceptions and are not flagged).
report fail "G1 off-scale radius" "$(radius_hits)"
# G2 edges: no 2px or 3px ink borders (hex in any case).
check fail "G2 hard ink border" 'border[A-Za-z-]*:[[:space:]]*.?(2|3)px solid (var\(--ink\)|#0A0A0A|#000)' "$CODE" -iE
check warn "G2 border width 2px or more" 'border[A-Za-z-]*:[[:space:]]*.?(2|3|4)px solid' "$CODE"
# G3 hard offset shadow, written either way (box-shadow or boxShadow), negative offsets included. A ring (0 0 0 1px) is fine.
check warn "G3 hard offset shadow (allowed only on .btn-primary and .sticker)" \
  "[Bb]ox-?[Ss]hadow:[[:space:]]*.?((-?[1-9][0-9.]*px -?[0-9.]+(px)?|-?[0-9.]+(px)? -?[1-9][0-9.]*px) 0([^.0-9]|\$))" "$CODE"
# G4 colour literals (3, 4, 6 and 8 digit hex, rgb and hsl) and undefined tokens. Anchors such as href="#add" are not colours.
check fail "G4 hex colour literal (use a token)" '#([0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{3})\b' "$CODE" -E \
  "(href|to|id|htmlFor|hash|aria-[a-z]+|querySelector[A-Za-z]*|getElementById|scrollTo|location)[=:(][[:space:]]*[{'\"\`]*#"
check warn "G4 rgb, rgba or hsl literal (use a token; rgba(10,10,10,a) is the ink alpha)" '\b(rgb|hsla?)\(|\brgba\((?!10,[[:space:]]*10,[[:space:]]*10)' "$CODE" -P
check fail "G4 undefined token" 'var\(--(rust|font-hand|r-photo|r-card|poster-gutter)\)'
# G5 contrast: a saturated hue used as TEXT colour. background-color, border-color and borderColor are fills and edges, not text.
check fail "G4/G5 accent used as text colour (use the -ink partner)" "(^|[^-[:alnum:]])color:[[:space:]]*['\"]?var\(--(welfare|lemon|sky|tomato|pink|grape|ops|teal)\)" "$CODE"
check warn "G5 alpha ink as text (no contrast headroom on accent fills)" '(^|[^-[:alnum:]])color:[[:space:]]*rgba\(10,[[:space:]]*10,[[:space:]]*10,[[:space:]]*0?\.[0-9]+\)' "$CODE"
# G6 type: caps-only NeutralFace must never be lowercased; a literal font family bypasses the five tokens;
# tabular-nums does nothing on NeutralFace (use --code for digit columns).
check fail "G6 text-transform: lowercase" 'text(-t|T)ransform:[[:space:]]*.?lowercase' "$CODE"
check warn "G6 literal font-family (use --display, --sans, --mono, --eina, --serif or --code)" "font-?[Ff]amily:\\s*+['\"]?+(?!var\(|inherit)" "$CODE" -P
check warn "G6 tabular-nums (a no-op on NeutralFace; digit columns need --code)" 'tabular-nums' "$CODE"
# G9 hand-rolled page width (blocks sit on .container).
check warn "G9 hand-rolled max-width in css (use .container / --frame-max)" '(^|[^-(a-z])max-width:[[:space:]]*[0-9]{3,4}px' '\.css$'
# G15 images: every <img> goes through sized() or Img. The second pattern catches a multi-line JSX tag.
check warn "G15 <img> with a raw src (use sized() or Img)" '<img[^>]*src=\{(?!\s*sized\()' '\.tsx$' -P
check warn "G15 bare src={...} line (a multi-line <img>? use sized() or Img)" '^\S+\s+src=\{(?!\s*sized\()' '\.tsx$' -P
# G16 motion: press is scale 0.96 and no lower; rotation belongs to the sticker motif and the tilted tiles only.
check warn "G16 scale below 0.96 (tapScale is 0.96, never lower)" 'scale\(0?\.([0-8][0-9]*|9([0-5][0-9]*)?)\)' "$CODE"
check warn "G16 rotate (only the sticker motif and the tilted tiles may tilt)" 'rotate\((?!360deg|0deg)' "$CODE" -P
# G17 copy: no em dash in added text (any source file, css content strings included), no emoji as chrome.
check fail "G17 em dash in added text" '—' "\.($SRC_EXT)\$"
check warn "G17 en dash in added text (a range such as 3 to 5 reads better as words)" '–' "\.($SRC_EXT)\$"
check warn "G17 emoji in added text (fine only in frozen human copy)" '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' '\.tsx$' -P
# G7/G8 heuristics worth a look.
check warn "G7 position: fixed (portal it if it sits inside a card or a transformed ancestor)" 'position:[[:space:]]*.?fixed' "$CODE"
check warn "G8 interactive minHeight under 44" 'minHeight:[[:space:]]*(2[0-9]|3[0-9]|40|41|42|43)[,} ]' '\.tsx$'

echo
if [ "${TALLY_BLOCK:-0}" = 1 ]; then
  st() { case "${GSTATE[$1]:-}" in ok) echo "ok (script)";; WARN) echo "TODO (script warned: read it)";; FAIL) echo "FAIL (fix or record an exception)";; *) echo "TODO";; esac; }
  echo "Guardrail tally: (replace every TODO with ok, n/a (reason) or exception (reason); an unticked row blocks the merge)"
  for g in G1 G2 G3 G4 G5 G6 G9 G15 G16 G17; do echo "- $g: $(st $g)"; done
  for g in G7 G8 G10 G11 G12 G13 G14 G18 G19 G20 G21 G22; do echo "- $g: TODO (needs eyes or a read)"; done
  echo
fi
if [ "$FAIL" -ne 0 ]; then echo "design tally: FAIL (fix the lines above or record a documented exception in the PR)"; exit 1; fi
echo "design tally: no FAIL. Read the WARN lines, then look at the screenshots (G6 to G10, G12 to G14 and G21 need eyes)."
exit 0
