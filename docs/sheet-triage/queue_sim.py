"""Simulates the tracker side of the daily run and tests it. Run: python3 docs/sheet-triage/queue_sim.py

The routine itself is instructions, not code, so this models the decisions that must not drift:
  - the probe decides whether to do any work at all (the biggest token saver),
  - the order of work (sent-back first, then demand, severity, bugs before features, oldest first),
  - duplicates fold under the oldest report and add to its demand,
  - the newest request wins a conflict unless an owner decision is recorded,
  - the safety valve stops shipping (40 items, two reverts, two red main runs),
  - the run row text stays short enough for the tool and the page,
  - a leader's lane is never moved by the routine.
It mirrors frontend/src/bugs/bugModel.ts (sortBugs, groupDuplicates, demand), which has its own unit tests.
"""
from dataclasses import dataclass, field
from typing import Optional

SEV = {'high': 0, 'med': 1, 'low': 2}


@dataclass
class R:
    id: str
    created: int
    severity: str = 'med'
    kind: str = 'bug'
    me_too: int = 0
    dup_of: Optional[str] = None
    rework: int = 0
    taken_up: bool = False
    solved: bool = False
    closed: bool = False
    declined: bool = False
    note: Optional[str] = None
    claimed_hours_ago: float = 0
    lane: str = 'later'
    lane_locked: bool = False


def open_untaken(rs):
    return [r for r in rs if not r.taken_up and not r.solved and not r.closed and not r.declined]


def died_midway(rs):
    return [r for r in rs if r.taken_up and not r.solved and not r.closed and not r.declined
            and r.note is None and r.claimed_hours_ago > 6]


def probe(rs, checks_green=True, open_routine_prs=0):
    """True when the run must do work. An unmerged PR from an earlier run is work too: it does not show up in
    bug_reports, so a probe that only counted reports would stop early past it. (The Google Sheet was retired on
    2026-10-24 and is no longer part of the probe.)"""
    return bool(open_untaken(rs) or died_midway(rs)) or not checks_green or open_routine_prs > 0


def fold(rs):
    ids = {r.id for r in rs}
    also, parents = {}, []
    for r in rs:
        if r.dup_of and r.dup_of != r.id and r.dup_of in ids:
            also.setdefault(r.dup_of, []).append(r)
        else:
            parents.append(r)
    return parents, also


def demand(r, also):
    return 1 + r.me_too + sum(1 + d.me_too for d in also.get(r.id, []))


def order(rs):
    parents, also = fold(rs)
    return sorted(parents, key=lambda r: (
        0 if r.rework > 0 else 1,
        -demand(r, also),
        SEV[r.severity],
        0 if r.kind == 'bug' else 1,
        r.created,
    ))


def valve(items, reverts, red_in_a_row, limit=40, context_left=1.0, tool_failures_in_a_row=0):
    """How many of `items` may still be shipped before the safety valve trips, and why."""
    if context_left < 0.15:
        return 0, 'context budget low'
    if tool_failures_in_a_row >= 3:
        return 0, 'a tool failed three times in a row'
    if reverts >= 2:
        return 0, 'two reverts in one run'
    if red_in_a_row >= 2:
        return 0, 'two red main runs in a row'
    if items > limit:
        return limit, 'run limit of 40'
    return items, None


def newest_wins(older, newer, older_is_owner_decision=False, newer_crosses_8_5=False):
    if older_is_owner_decision or newer_crosses_8_5:
        return 'escalate'
    return newer


def routine_sets_lane(r, new_lane):
    return r.lane if r.lane_locked else new_lane


def run_summary_ok(s):
    return len(s) <= 300 and not any(ch in s for ch in ('—', '–')) and 'token' not in s.lower()


# ── tests ──────────────────────────────────────────────────────────────────────────────────
passed = failed = 0


def check(name, cond):
    global passed, failed
    if cond:
        passed += 1
    else:
        failed += 1
        print('FAIL', name)


solved = R('s', 1, taken_up=True, solved=True)
closed = R('c', 2, taken_up=True, closed=True)
declined = R('d', 3, declined=True)
claimed_fresh = R('f', 4, taken_up=True, claimed_hours_ago=1)
claimed_dead = R('x', 5, taken_up=True, claimed_hours_ago=9)
claimed_noted = R('n', 6, taken_up=True, claimed_hours_ago=30, note='needs a decision')
new = R('a', 7)

# probe and early stop
check('empty day stops early', not probe([solved, closed, declined, claimed_fresh, claimed_noted]))
check('one new report means work', probe([new]))
check('a dead claim means work', probe([claimed_dead]))
check('a fresh claim is not dead', not died_midway([claimed_fresh]))
check('a noted claim is not dead', not died_midway([claimed_noted]))
check('a red check means work even with an empty queue', probe([], checks_green=False))
check('solved, closed and declined are never picked up', open_untaken([solved, closed, declined]) == [])
check('a report sent back by the database is picked up again', open_untaken([R('b', 8, rework=1, taken_up=False)]) != [])

check('an open PR from an earlier run means work', probe([solved], open_routine_prs=1))
check('no open PR, no reports, green: stop early', not probe([solved], open_routine_prs=0))

# order of work
a = R('a', 10, severity='low', me_too=0)
b = R('b', 11, severity='high', me_too=0)
c = R('c', 12, severity='low', me_too=5)
d = R('d', 13, severity='med', rework=1)
e = R('e', 14, severity='high', kind='feature')
f = R('f', 9, severity='high')
got = [r.id for r in order([a, b, c, d, e, f])]
check('sent back first, then most wanted', got[:2] == ['d', 'c'])
check('equal demand: severity, then bug before feature, then oldest', got[2:] == ['f', 'b', 'e', 'a'])

# duplicates fold under the oldest and add to demand
p = R('p', 1, me_too=1)
q = R('q', 2, dup_of='p', me_too=2)
orphan = R('o', 3, dup_of='gone')
parents, also = fold([p, q, orphan])
check('a duplicate folds under its parent', [r.id for r in parents] == ['p', 'o'])
check('an orphan duplicate stays visible', 'o' in [r.id for r in parents])
check('demand adds duplicates and their me toos', demand(p, also) == 1 + 1 + (1 + 2))
check('a folded duplicate raises its parent above a lone report', order([R('l', 0), p, q])[0].id == 'p')
check('a report is never its own duplicate', len(fold([R('z', 1, dup_of='z')])[0]) == 1)

# conflicts
check('newest wins between reports', newest_wins('old', 'new') == 'new')
check('an owner decision is escalated, not overridden', newest_wins('old', 'new', older_is_owner_decision=True) == 'escalate')
check('a newer request that crosses an 8.5 line is escalated', newest_wins('old', 'new', newer_crosses_8_5=True) == 'escalate')

# safety valve
check('under the limit ships everything', valve(12, 0, 0) == (12, None))
check('over 40 stops at 40', valve(55, 0, 0) == (40, 'run limit of 40'))
check('two reverts stop shipping', valve(5, 2, 0) == (0, 'two reverts in one run'))
check('two red mains stop shipping', valve(5, 0, 2) == (0, 'two red main runs in a row'))
check('one revert does not', valve(5, 1, 1) == (5, None))
check('low context stops new clusters', valve(5, 0, 0, context_left=0.1) == (0, 'context budget low'))
check('healthy context does not', valve(5, 0, 0, context_left=0.5) == (5, None))
check('three tool failures in a row stop shipping', valve(5, 0, 0, tool_failures_in_a_row=3) == (0, 'a tool failed three times in a row'))
check('two tool failures do not', valve(5, 0, 0, tool_failures_in_a_row=2) == (5, None))

# leader lane
check('the routine cannot move a locked lane', routine_sets_lane(R('l', 1, lane='next', lane_locked=True), 'today') == 'next')
check('the routine can move an unlocked lane', routine_sets_lane(R('m', 1, lane='later'), 'today') == 'today')

# run row text
check('a plain summary is fine', run_summary_ok('Shipped 3 fixes and queued 2 for tomorrow. All checks green.'))
check('a long summary is refused', not run_summary_ok('x' * 301))
check('an em dash is refused', not run_summary_ok('Shipped one fix — done.'))
check('a token mention is refused', not run_summary_ok('used token abc'))

print(f'queue_sim: {passed} passed, {failed} failed')
raise SystemExit(1 if failed else 0)
