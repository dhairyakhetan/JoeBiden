"""Renders the daily briefing and tests it. Run: python3 docs/sheet-triage/briefing_sim.py

The routine builds the same two strings from its check results:
  chat  - always sent, as the run's final message
  push  - sent ONLY when should_push() is True; at most 200 chars, lead with the action

Rules under test (see docs/SHEET_TRIAGE_ROUTINE.md, section 5b):
  green idle day     -> one chat line, no push (plus one line if bug reports wait for approval, one if fixes wait for a check)
  alert                -> push names the check and the number that tripped it
  row handled          -> push names the row and its PR
  step could not run   -> never reads as green
  Monday               -> digest push even when green
  open questions       -> chat says how many and the drafted block follows; one push even when green
  alert already pushed   -> a check marked known is still listed in chat, but never pushes again until it changes
  no em dashes anywhere, push <= 200 chars, green chat line <= 160 chars
"""
import datetime

CHECKS = ["deploy", "runtime_errors", "main_ci", "members_privs", "members_acl",
          "client_errors", "mom", "post_teams", "feed_view",
          "bug_tracker", "bug_stuck", "backlog", "run_log", "bug_secrets", "hiring_scope", "advisors"]

# health_checks.sql H1..H12 in order, so a query added there cannot be left without a line in the briefing.
H_CHECKS = ["members_privs", "members_acl", "client_errors", "mom", "post_teams", "feed_view",
            "bug_tracker", "bug_stuck", "backlog", "run_log", "bug_secrets", "hiring_scope"]

LABEL = {"deploy": "Production deploy", "runtime_errors": "Runtime errors", "main_ci": "CI on main",
         "members_privs": "Members privileges", "members_acl": "Members table grant",
         "client_errors": "Client errors", "mom": "Member of the Month rules",
         "post_teams": "Post tags", "feed_view": "Public feed", "advisors": "Security advisors",
         "bug_tracker": "Bug tracker guarantees", "bug_stuck": "Bug tracker stuck reports",
         "backlog": "Bug tracker bookkeeping", "run_log": "Daily run log", "bug_secrets": "Screenshot tokens",
         "hiring_scope": "Hiring visibility"}

def plural(n, word):
    return f"{n} {word}" if n == 1 else f"{n} {word}s"

def short(text, n=80):
    return text if len(text) <= n else text[: max(n - 3, 0)].rstrip() + "..."

def verdict(r):
    if any(c["state"] == "skipped" for c in r["checks"]):
        return "INCOMPLETE"
    if any(c["state"] == "alert" for c in r["checks"]):
        return "ALERT"
    return "GREEN"

def fresh(r):
    """Non-ok checks that were not already pushed (owner rule 2026-10-18: once, then only on change). A skipped
    step is never known, and a known alert whose detail changed arrives here as a new, unmarked check."""
    return [c for c in r["checks"] if c["state"] != "ok" and not c.get("known")]

def should_push(r, today):
    return (bool(fresh(r)) or bool(r["rows"]) or bool(r.get("questions")) or today.weekday() == 0)

def chat(r, today):
    v, ran = verdict(r), sum(c["state"] != "skipped" for c in r["checks"])
    head = f"AQ daily {today.isoformat()}: {v}, {plural(len(r['rows']), 'row')}, {ran}/{len(r['checks'])} checks"
    waiting = r.get("waiting", 0)
    wait_line = f"- {plural(waiting, 'bug report')} waiting for a leader to approve {'it' if waiting == 1 else 'them'} for fixing." if waiting else None
    check = r.get("awaiting_check", 0)
    check_line = f"- {check} {'fix' if check == 1 else 'fixes'} waiting for a leader to check on the live site." if check else None
    notes = [x for x in (wait_line, check_line) if x]
    questions = r.get("questions") or []
    q_line = f"- {plural(len(questions), 'open question')} for the owner, drafted below." if questions else None
    if v == "GREEN" and not r["rows"] and not questions:
        return head + "." + "".join("\n" + x for x in notes)
    lines = [head + "."]
    for c in r["checks"]:
        if c["state"] != "ok":
            who = "NEEDS YOU" if c.get("needs_owner") else "ROUTINE IS ON IT"
            seen = " (already reported, no new push)" if c.get("known") else ""
            lines.append(f"- {LABEL[c['name']]}: {c['state'].upper()}, {c['detail']} [{who}]{seen}")
    for row in r["rows"]:
        lines.append(f"- row {row['key']}: {row['status']}, {row['pr']}")
    lines.extend(notes)
    if q_line:
        lines.append(q_line)
    return "\n".join(lines)


def render_questions(questions):
    """The drafted, ready-to-ask block that follows the briefing. At most four questions, each with two to
    four options and the recommended one first (owner rule 2026-10-13)."""
    if len(questions) > 4:
        raise ValueError("at most four questions per batch")
    out = []
    for i, q in enumerate(questions, 1):
        opts = q["options"]
        if not 2 <= len(opts) <= 4:
            raise ValueError("each question needs two to four options")
        out.append(f"Q{i} [{q['header']}] {q['question']}")
        for j, o in enumerate(opts, 1):
            tag = " (Recommended)" if o.get("recommended") else ""
            out.append(f"  {j}. {o['label']}{tag}: {o['why']}")
    return "\n".join(out)

def push(r, today):
    if not should_push(r, today):
        return None
    bad = fresh(r)
    if bad:
        bad.sort(key=lambda c: not c.get("needs_owner"))   # owner actions lead
        c = bad[0]
        lead = "Needs you" if c.get("needs_owner") else "Alert"
        extra = f" (+{len(bad)-1} more)" if len(bad) > 1 else ""
        tail = f"{extra}. Details in chat."
        head = f"{lead}: {LABEL[c['name']]} {c['state']}, "
        return head + short(c["detail"], 200 - len(head) - len(tail)) + tail
    questions = r.get("questions") or []
    if questions:
        n = len(questions)
        head = f"Questions: {n} waiting for you ("
        tail = "). Details in chat."
        heads = ", ".join(q["header"] for q in questions)
        return head + short(heads, 200 - len(head) - len(tail)) + tail
    if r["rows"]:
        row = r["rows"][0]
        extra = f" (+{len(r['rows'])-1} more)" if len(r["rows"]) > 1 else ""
        tail = f", {row['pr']}{extra}."
        head = f"Row {row['status'].lower()}: "
        return head + short(row["title"], 200 - len(head) - len(tail)) + tail
    need = r["open_human"] + r.get("waiting", 0) + r.get("awaiting_check", 0) + len(r.get("questions") or []) + sum(
        1 for c in r["checks"] if c["state"] != "ok" and c.get("needs_owner"))
    return f"Weekly: {r['week_rows']} rows done, all checks green, {need} need you."[:200]

def mk(states=None, rows=None):
    states = states or {}
    checks = [{"name": n, "state": states.get(n, ("ok", ""))[0],
               "detail": states.get(n, ("ok", ""))[1],
                "needs_owner": len(states.get(n, ())) > 2 and states[n][2],
               "known": len(states.get(n, ())) > 3 and states[n][3]} for n in CHECKS]
    return {"checks": checks, "rows": rows or [], "week_rows": 3, "open_human": 0, "waiting": 0, "questions": []}

TUE, MON = datetime.date(2026, 10, 6), datetime.date(2026, 10, 5)

def test():
    n = 0
    def ok(cond, msg):
        nonlocal n; n += 1
        assert cond, msg
    # 1 green idle Tuesday: one line, no push
    r = mk(); c = chat(r, TUE)
    ok("\n" not in c and len(c) <= 160 and "GREEN" in c, "green line")
    ok(push(r, TUE) is None, "no push on green idle")
    # 2 green idle Monday: digest push
    p = push(mk(), MON)
    ok(p and p.startswith("Weekly") and len(p) <= 200, "monday digest")
    # 3 alert: number in push, verdict ALERT, chat lists it
    r = mk({"members_privs": ("alert", "31/9 became 32/8, closed set lost instagram")})
    ok(verdict(r) == "ALERT" and "Members privileges" in push(r, TUE) and "32/8" in push(r, TUE), "alert push")
    ok("Members privileges: ALERT" in chat(r, TUE) and "ROUTINE IS ON IT" in chat(r, TUE), "alert chat")
    ok(push(r, TUE).startswith("Alert:"), "routine-owned alert is not 'Needs you'")
    # 3b owner action leads the push even when listed second
    r = mk({"main_ci": ("alert", "red on 6255f4f", False), "advisors": ("alert", "new function exposed to anon", True)})
    ok(push(r, TUE).startswith("Needs you: Security advisors"), "owner action first")
    ok("(+1 more)" in push(r, TUE), "mentions the rest")
    ok("1 row" not in chat(mk(), TUE) and "0 rows" in chat(mk(), TUE), "plural zero")
    # 4 skipped step is never green
    r = mk({"deploy": ("skipped", "Vercel tool did not load")})
    ok(verdict(r) == "INCOMPLETE" and "GREEN" not in chat(r, TUE) and push(r, TUE), "skipped is loud")
    ok("15/16 checks" in chat(r, TUE), "ran count")
    # 5 row handled on a green night: push names row and PR
    r = mk(rows=[{"key": "abc1234567", "status": "Merged and live", "title": "fix sticker", "pr": "PR 50"}])
    p = push(r, TUE)
    ok("fix sticker" in p and "PR 50" in p and "row abc1234567" in chat(r, TUE), "row push")
    ok("1 row," in chat(r, TUE), "singular row")
    # 6 many alerts: truncates to 200, mentions the rest
    r = mk({n_: ("alert", "x" * 90) for n_ in CHECKS[:4]})
    p = push(r, TUE)
    ok(len(p) <= 200 and p.endswith("Details in chat."), "pointer survives a long detail")
    r1 = mk({"deploy": ("alert", "y" * 400)})
    ok(len(push(r1, TUE)) <= 200 and push(r1, TUE).endswith("Details in chat."), "single huge detail")
    r2 = mk(rows=[{"key": "k", "status": "Done", "title": "t" * 400, "pr": "PR 9"}])
    ok(len(push(r2, TUE)) <= 200 and push(r2, TUE).endswith("PR 9."), "huge row title")
    # 6b reports waiting on a leader are visible, but never push on their own
    w = mk(); w["waiting"] = 2
    ok("2 bug reports waiting for a leader to approve them for fixing." in chat(w, TUE), "waiting line")
    ok(push(w, TUE) is None, "waiting alone never pushes")
    w1 = mk(); w1["waiting"] = 1
    ok("1 bug report waiting for a leader to approve it" in chat(w1, TUE), "waiting singular")
    mw = mk(); mw["waiting"] = 2; mw["open_human"] = 1
    ok(push(mw, MON) == "Weekly: 3 rows done, all checks green, 3 need you.", "monday digest counts waiting")
    # 6b2 fixes the routine marked solved that no leader has checked yet: visible, never a push on their own
    a = mk(); a["awaiting_check"] = 3
    ok("3 fixes waiting for a leader to check on the live site." in chat(a, TUE), "awaiting-check line")
    ok(push(a, TUE) is None, "awaiting check alone never pushes")
    a1 = mk(); a1["awaiting_check"] = 1
    ok("1 fix waiting for a leader to check on the live site." in chat(a1, TUE), "awaiting-check singular")
    both = mk(); both["waiting"] = 1; both["awaiting_check"] = 2
    ok(chat(both, TUE).count("\n") == 2, "both notes show, one line each")
    am = mk(); am["awaiting_check"] = 2; am["open_human"] = 1
    ok(push(am, MON) == "Weekly: 3 rows done, all checks green, 3 need you.", "monday digest counts fixes awaiting a check")
    # 6c open questions: drafted block, one push, never silent, never more than four
    qs = [{"header": "Digital Mag", "question": "Keep both nested?", "options": [
              {"label": "Keep both", "why": "matches the HR tree", "recommended": True}, {"label": "Only one", "why": "smaller change"}]},
          {"header": "Chart people", "question": "Who sees the people row?", "options": [
              {"label": "Members only", "why": "many are minors", "recommended": True}, {"label": "Everyone", "why": "matches team pages"}]}]
    q = mk(); q["questions"] = qs
    ok("2 open questions for the owner, drafted below." in chat(q, TUE), "questions line")
    ok(verdict(q) == "GREEN", "questions alone are not an alert")
    pq = push(q, TUE)
    ok(pq == "Questions: 2 waiting for you (Digital Mag, Chart people). Details in chat.", "questions push")
    ok(push(mk(), TUE) is None, "no questions, no push")
    q1 = mk(); q1["questions"] = qs[:1]
    ok("1 open question for the owner" in chat(q1, TUE), "singular question")
    ok(push(dict(q, checks=mk({"deploy": ("alert", "red")})["checks"]), TUE).startswith("Alert:"), "an alert outranks questions in the push")
    qm = mk(); qm["questions"] = qs
    ok(push(qm, MON) == "Questions: 2 waiting for you (Digital Mag, Chart people). Details in chat.", "questions lead on a green Monday")
    long_q = mk(); long_q["questions"] = [dict(qs[0], header="h" * 120)] * 4
    ok(len(push(long_q, TUE)) <= 200 and push(long_q, TUE).endswith("Details in chat."), "long headers are cut")
    block = render_questions(qs)
    ok(block.splitlines()[0] == "Q1 [Digital Mag] Keep both nested?" and "1. Keep both (Recommended): matches the HR tree" in block, "block shape")
    ok("—" not in block, "no em dash in the block")
    try:
        render_questions(qs * 3); ok(False, "more than four questions must be refused")
    except ValueError:
        ok(True, "five questions refused")
    try:
        render_questions([dict(qs[0], options=qs[0]["options"][:1])]); ok(False, "one option must be refused")
    except ValueError:
        ok(True, "one option refused")
    # 6d an alert that was already pushed is listed again but does not push again (owner rule 2026-10-18)
    k = mk({"advisors": ("alert", "aq_accounts RLS no policy, 32 INFO", True, True)})
    ok(verdict(k) == "ALERT" and "Security advisors: ALERT" in chat(k, TUE), "a known alert still shows in chat")
    ok("already reported, no new push" in chat(k, TUE), "chat says it was already reported")
    ok(push(k, TUE) is None, "a known alert alone does not push")
    ok(push(k, MON) == "Weekly: 3 rows done, all checks green, 1 need you.", "monday digest counts a known owner alert")
    k2 = mk({"advisors": ("alert", "same", True, True), "main_ci": ("alert", "red on abc1234", False, False)})
    ok(push(k2, TUE).startswith("Alert: CI on main"), "a new alert pushes and names itself, not the known one")
    ok("(+1 more)" not in push(k2, TUE), "known alerts are not counted as more")
    k3 = mk({"advisors": ("alert", "count rose to 33", True, False)})
    ok(push(k3, TUE).startswith("Needs you: Security advisors"), "a changed alert is unmarked and pushes again")
    k4 = mk({"advisors": ("alert", "same", True, True), "deploy": ("skipped", "tool did not load", False, False)})
    ok(verdict(k4) == "INCOMPLETE" and push(k4, TUE), "a skipped step always pushes")
    # 7 no em dashes in any output
    for rr in (mk(), r, mk(rows=[{"key": "k", "status": "Done", "title": "t", "pr": "p"}])):
        for d in (TUE, MON):
            ok("—" not in chat(rr, d) and "—" not in (push(rr, d) or ""), "em dash")
    # 8 every check has a label, and health_checks.sql has exactly one briefing line per query (drift guard)
    ok(all(c in LABEL for c in CHECKS), "every check has a label")
    ok(set(H_CHECKS) <= set(CHECKS), "every H check is a briefing check")
    import os, re
    sql = os.path.join(os.path.dirname(os.path.abspath(__file__)), "health_checks.sql")
    heads = re.findall(r"^-- H(\d+)\.", open(sql, encoding="utf-8").read(), re.M)
    ok(len(heads) == len(H_CHECKS) and [int(h) for h in heads] == list(range(1, len(H_CHECKS) + 1)),
       f"health_checks.sql has H{heads} but the briefing knows {len(H_CHECKS)} H checks: add the label and the name")
    # 9 the run log alarm and the token check reach the owner with a real name
    rl = mk({"run_log": ("alert", "no run since 40 hours ago", False)})
    ok(push(rl, TUE).startswith("Alert: Daily run log alert,"), "a missed night is pushed by name")
    bs = mk({"bug_secrets": ("alert", "anon can read read tokens", True)})
    ok(push(bs, TUE).startswith("Needs you: Screenshot tokens alert,"), "a token exposure is an owner action")
    print(f"{n}/{n} assertions pass")

if __name__ == "__main__":
    test()
