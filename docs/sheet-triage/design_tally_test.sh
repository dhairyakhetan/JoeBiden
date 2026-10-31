#!/usr/bin/env bash
# Self test for design_tally.sh: a clean diff passes, each banned pattern is caught, comments and tests are ignored.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"
pass=0; failn=0
expect() { # expect <name> <diff file> <wanted exit> [wanted substring]
  local out rc
  out="$(TALLY_DIFF_FILE="$2" bash "$HERE/design_tally.sh")"; rc=$?
  if [ "$rc" = "$3" ] && { [ -z "${4:-}" ] || printf '%s' "$out" | grep -qF -- "$4"; }; then pass=$((pass+1)); else failn=$((failn+1)); echo "FAILED: $1 (exit $rc, wanted $3 ${4:-})"; printf '%s\n' "$out" | head -8; fi
}
mk() { printf '+++ b/%s\n@@ -0,0 +1 @@\n+%s\n' "$1" "$2" > "$T/$3"; }

mk frontend/src/x/A.css '.a { border-radius: var(--r-inner); border: var(--hair-2); box-shadow: var(--lift-1); color: var(--ink); }' good.diff
expect "clean css passes" "$T/good.diff" 0 "no FAIL"
mk frontend/src/x/A.css '.a { border-radius: 12px; }' r.diff;                      expect "off-scale radius" "$T/r.diff" 1 "G1 off-scale radius"
mk frontend/src/x/A.tsx "<div style={{ borderRadius: 10 }} />" ri.diff;            expect "off-scale inline radius" "$T/ri.diff" 1 "G1 off-scale radius"
mk frontend/src/x/A.css '.a { border-radius: 999px; }' ok999.diff;                 expect "999 allowed" "$T/ok999.diff" 0
mk frontend/src/x/A.css '.a { border-radius: 22px; border-radius: 14px; border-radius: 32px; }' okscale.diff; expect "scale allowed" "$T/okscale.diff" 0
mk frontend/src/x/A.css '.a { border: 2px solid var(--ink); }' b.diff;            expect "2px ink border" "$T/b.diff" 1 "G2 hard ink border"
mk frontend/src/x/A.css '.a { box-shadow: 4px 4px 0 0 var(--ink); }' s.diff;       expect "offset shadow warns" "$T/s.diff" 0 "G3 hard offset shadow"
mk frontend/src/x/A.css '.a { background: #ff00aa; }' h.diff;                      expect "hex literal" "$T/h.diff" 1 "G4 hex colour literal"
mk frontend/src/x/A.css '.a { color: var(--rust); }' u.diff;                       expect "undefined token" "$T/u.diff" 1 "G4 undefined token"
mk frontend/src/x/A.css '.a { color: var(--welfare); }' t.diff;                    expect "accent as text" "$T/t.diff" 1 "accent used as text colour"
mk frontend/src/x/A.css '.a { color: var(--welfare-ink); }' ti.diff;               expect "ink partner ok" "$T/ti.diff" 0 "no FAIL"
mk frontend/src/x/A.css '.a { text-transform: lowercase; }' l.diff;                expect "lowercase" "$T/l.diff" 1 "G6 text-transform"
mk frontend/src/x/A.tsx 'toast.success("done — saved")' d.diff;                    expect "em dash" "$T/d.diff" 1 "G17 em dash"
mk frontend/src/x/A.tsx '// an em dash — in a comment is fine' c.diff;             expect "comment ignored" "$T/c.diff" 0 "no FAIL"
mk frontend/src/x/A.tsx '<img src={url} alt="" />' i.diff;                         expect "raw img warns" "$T/i.diff" 0 "G15"
mk frontend/src/x/A.tsx '<img src={sized(url, "card")} alt="" />' i2.diff;         expect "sized img is fine" "$T/i2.diff" 0 "ok    G15"
printf '' > "$T/empty.diff";                                                      expect "empty diff" "$T/empty.diff" 0 "nothing to judge"

# Regressions found by stress test, 2026-10-22: each of these was once missed, or once failed a correct line.
mk frontend/src/x/A.css '.a { background-color: var(--welfare); }' bgfill.diff;      expect "fill with an accent is the rule, not a breach" "$T/bgfill.diff" 0 "no FAIL"
mk frontend/src/x/A.css '.a { border-color: var(--teal); }' bcol.diff;               expect "border-color accent is an edge" "$T/bcol.diff" 0 "no FAIL"
mk frontend/src/x/A.tsx "<div style={{ borderColor: 'var(--teal)' }} />" bcol2.diff;  expect "borderColor accent is an edge" "$T/bcol2.diff" 0 "no FAIL"
mk frontend/src/x/A.css '.a { border-radius: 0 12px 12px 0; }' r1.diff;             expect "radius with a leading 0" "$T/r1.diff" 1 "G1"
mk frontend/src/x/A.css '.a { border-top-left-radius: 12px; }' r2.diff;              expect "corner longhand" "$T/r2.diff" 1 "G1"
mk frontend/src/x/A.css '.a { border-radius: 0.75rem; }' r3.diff;                    expect "rem radius" "$T/r3.diff" 1 "G1"
mk frontend/src/x/A.css '.a { border-radius: 41px; }' r4.diff;                       expect "radius not in the old list" "$T/r4.diff" 1 "G1"
mk frontend/src/x/A.tsx '<div style={{ borderRadius: "12px" }} />' r5.diff;          expect "double quoted inline radius" "$T/r5.diff" 1 "G1"
mk frontend/src/x/A.tsx '<div style={{ borderRadius: 10, padding: 8 }} />' r6.diff;  expect "bad radius before another prop" "$T/r6.diff" 1 "G1"
mk frontend/src/x/A.tsx '<div style={{ borderRadius: 22, padding: 8 }} />' r7.diff; expect "good radius before another prop" "$T/r7.diff" 0 "no FAIL"
mk frontend/src/x/A.css '.a { border-radius: var(--r-inner) 50% 6px 0; }' r8.diff;  expect "var, percent and documented 6px pass" "$T/r8.diff" 0 "no FAIL"
mk frontend/src/x/A.css '.a { border-radius: 2rem; }' r9.diff;                       expect "2rem is 32px" "$T/r9.diff" 0 "no FAIL"
mk frontend/src/x/A.jsx '<div style={{ borderRadius: 12 }} />' rj.diff;              expect "jsx is judged" "$T/rj.diff" 1 "G1"
mk frontend/src/x/A.css '.a { border: 2px solid #0a0a0a; }' bl.diff;                 expect "lowercase ink hex border" "$T/bl.diff" 1 "G2 hard ink border"
mk frontend/src/x/A.tsx "<div style={{ boxShadow: '4px 4px 0 0 var(--ink)' }} />" bs1.diff; expect "camelCase hard shadow" "$T/bs1.diff" 0 "WARN  G3"
mk frontend/src/x/A.css '.a { box-shadow: -4px 4px 0 0 var(--ink); }' bs2.diff;      expect "negative offset hard shadow" "$T/bs2.diff" 0 "WARN  G3"
mk frontend/src/x/A.css '.a { box-shadow: 0 0 0 1px var(--hair); }' bs3.diff;         expect "hairline ring is not a hard shadow" "$T/bs3.diff" 0 "ok    G3"
mk frontend/src/x/A.css '.a { box-shadow: 0 4px 12px rgba(10,10,10,.1); }' bs4.diff;  expect "soft lift is not a hard shadow" "$T/bs4.diff" 0 "ok    G3"
mk frontend/src/x/A.tsx "<div style={{ textTransform: 'lowercase' }} />" tt.diff;    expect "camelCase lowercase" "$T/tt.diff" 1 "G6 text-transform"
mk frontend/src/x/A.css '.a { background: #0a0a0a80; }' hx8.diff;                    expect "8 digit hex" "$T/hx8.diff" 1 "G4 hex"
mk frontend/src/x/A.css '.a { background: #fffa; }' hx4.diff;                        expect "4 digit hex" "$T/hx4.diff" 1 "G4 hex"
mk frontend/src/x/A.tsx '<a href="#add">x</a>' anc.diff;                             expect "an anchor that looks like hex is not a colour" "$T/anc.diff" 0 "no FAIL"
mk frontend/src/x/A.css '.a { background: rgb(255, 0, 0); }' rgb.diff;               expect "rgb literal warns" "$T/rgb.diff" 0 "WARN  G4 rgb"
mk frontend/src/x/A.css '.a { background: rgba(10, 10, 10, .1); }' rgbi.diff;         expect "ink alpha is a token value" "$T/rgbi.diff" 0 "ok    G4 rgb"
mk frontend/src/x/A.css '.a { font-family: Arial, sans-serif; }' ff.diff;            expect "literal font family warns" "$T/ff.diff" 0 "WARN  G6 literal font-family"
mk frontend/src/x/A.css '.a { font-family: var(--eina); }' ff2.diff;                 expect "font token passes" "$T/ff2.diff" 0 "ok    G6 literal font-family"
mk frontend/src/x/A.css ".a::after { content: '—'; }" ed.diff;                        expect "em dash in a css content string" "$T/ed.diff" 1 "G17 em dash"
mk frontend/src/x/A.tsx '  src={url}' im.diff;                                       expect "multi-line img src warns" "$T/im.diff" 0 "WARN  G15"
mk frontend/src/x/A.css '.a:hover { transform: rotate(3deg); }' ro.diff;             expect "rotate warns" "$T/ro.diff" 0 "WARN  G16 rotate"
mk frontend/src/x/A.css '.a:active { transform: scale(0.9); }' sc.diff;              expect "scale 0.9 warns" "$T/sc.diff" 0 "WARN  G16 scale"
mk frontend/src/x/A.css '.a:active { transform: scale(0.96); }' sc2.diff;            expect "scale 0.96 passes" "$T/sc2.diff" 0 "ok    G16 scale"
mk frontend/src/x/A.css '.a { font-variant-numeric: tabular-nums; }' tn.diff;        expect "tabular-nums warns" "$T/tn.diff" 0 "WARN  G6 tabular"
mk frontend/src/x/A.css '@media (max-width: 820px) { .a { color: var(--ink); } }' mq.diff;      expect "a media query is not a hand-rolled width" "$T/mq.diff" 0 "ok    G9"
mk frontend/src/x/A.css '.a { max-width: 1100px; }' mw.diff;                           expect "a hand-rolled max-width warns" "$T/mw.diff" 0 "WARN  G9"
mk frontend/src/x/A.css '@keyframes s { to { transform: rotate(360deg); } }' sp.diff;  expect "a spinner is not a tilt" "$T/sp.diff" 0 "ok    G16 rotate"

# Git mode: an unstaged new file must be judged, and a missing base must be an error, never a pass.
G="$(mktemp -d)"
( cd "$G" && git init -q -b main . && git config user.email t@t && git config user.name t \
  && mkdir -p frontend/src && echo '.ok{color:var(--ink)}' > frontend/src/ok.css && git add -A && git commit -q -m base \
  && git checkout -q -b work && printf 'export const A = () => <div style={{ borderRadius: 12 }} />;\n' > frontend/src/New.tsx )
out="$(cd "$G" && TALLY_BASE=main bash "$HERE/design_tally.sh")"; rc=$?
if [ "$rc" = 1 ] && printf '%s' "$out" | grep -qF "G1"; then pass=$((pass+1)); else failn=$((failn+1)); echo "FAILED: untracked new file was not judged (exit $rc)"; fi
out="$(cd "$G" && TALLY_BASE=no-such-ref bash "$HERE/design_tally.sh")"; rc=$?
if [ "$rc" = 2 ] && printf '%s' "$out" | grep -qF "ERROR"; then pass=$((pass+1)); else failn=$((failn+1)); echo "FAILED: a missing base must exit 2 (exit $rc)"; fi
out="$(TALLY_BLOCK=1 TALLY_DIFF_FILE="$T/good.diff" bash "$HERE/design_tally.sh")"; rc=$?
if [ "$rc" = 0 ] && printf '%s' "$out" | grep -qF -- "- G1: ok (script)" && printf '%s' "$out" | grep -qF -- "- G21: TODO"; then pass=$((pass+1)); else failn=$((failn+1)); echo "FAILED: TALLY_BLOCK output"; fi
rm -rf "$G"

echo "design_tally_test: $pass passed, $failn failed"
rm -rf "$T"
[ "$failn" -eq 0 ]
