# Filter for `grep -rn` output ("path:line:content").
#
# Drops a hit when the SOURCE line is inside a comment, or is exempted with an
# `audit-ok` marker. This exists because the audit's comment filter has been
# wrong twice: v1 (`grep -v '^\s*//'`) tested the file PATH, since grep prints
# the path first; v2 stripped that prefix but could only see a line that OPENS
# with // or *, so every CONTINUATION line of a block comment was still
# reported as code. Rules 2, 10 and 11 got their entire hit list that way.
#
# So: read the actual file, track /* */ state, and mark whole comment blocks.
#
# `audit-ok` exemption: a marker inside a comment exempts the code lines below
# it up to the next BLANK line; a marker on a code line exempts that line only.
# AUDIT.md already accepts "a flagged line with a comment explaining why it is
# legal" as a resolution — this makes that resolution machine-readable, so the
# same adjudicated lines are not re-litigated on every run. Write it as
# `audit-ok: <what> — <why>` and keep the reason honest.

function scan(f,   inblk, n, line, t, tmp, p, started, iscm, blockmark) {
  n = 0; inblk = 0; blockmark = 0
  while ((getline line < f) > 0) {
    n++
    started = inblk
    tmp = line
    while (1) {
      if (!inblk) { p = index(tmp, "/*"); if (p == 0) break; inblk = 1; tmp = substr(tmp, p + 2) }
      else        { p = index(tmp, "*/"); if (p == 0) break; inblk = 0; tmp = substr(tmp, p + 2) }
    }
    t = line
    sub(/^[ \t]+/, "", t)
    iscm = (started || substr(t, 1, 2) == "//" || substr(t, 1, 2) == "/*" || substr(t, 1, 1) == "*")
    if (iscm) CM[f ":" n] = 1
    if (t == "") blockmark = 0
    else if (iscm) { if (line ~ /audit-ok/) blockmark = 1 }
    else if (line ~ /audit-ok/ || blockmark) CM[f ":" n] = 1
  }
  close(f)
  SEEN[f] = 1
}
{
  line = $0
  if (match(line, /^[^:]*:[0-9]+:/) == 0) { print; next }
  key = substr(line, 1, RLENGTH - 1)
  n = split(key, parts, ":")
  ln = parts[n]
  f = substr(key, 1, length(key) - length(ln) - 1)
  if (!(f in SEEN)) scan(f)
  if (!((f ":" ln) in CM)) print
}
