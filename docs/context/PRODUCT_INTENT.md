# What AquaTerra is trying to do (the decision lens)

**Read this first on any day with work, before the code.** It is the one-page answer to "what is this site for, and
what would the people it serves want?", so the routine can decide how a feature should change without asking. It
holds purpose and judgement, not code. Facts it rests on live in `AQ_CONTEXT.md` (the organisation), `USER_FLOWS.md`
(who does what) and `docs/PRODUCT_PRD.md` (every feature and rule); where they disagree, the PRD wins and this file
gets a dated correction. Written 2026-10-29. Never write a volatile number here: read it from the database.

## The purpose, in one paragraph

AquaTerra is a student-run volunteer community in Kolkata, mostly teenagers on phones. Students arrive for a
certificate or a line on a CV, stay for their friends, and the community's impact is the result of that energy. The
site has two jobs at once. It is the **members' tool** (find a team, get started, do the work, get recognised) and the
organisation's **permanent record and public front door** (what was done, by whom, so a sponsor, a school or a parent
can trust it). A change is good when it makes a member's first week easier, makes the record of who did what cheaper
and more trustworthy, or lets a student leader run a team without needing a director.

## What each person is really trying to do

| who | the job they hire the site for | a good change for them |
| --- | --- | --- |
| a new visitor (14 to 19) | decide in a minute whether this is for them, then join | fewer steps to the apply form, plain words, works from a WhatsApp link on a phone |
| a new member | feel they belong and have something to do this week | an obvious first action, a team, a visible reply to anything they say |
| an active member | recognition: certificate, Letter of Recommendation, a record of what they did | anything that records who led and who showed up, with no extra admin |
| a team lead or HoD | run the team and record what was done, alone | one-tap tools, less waiting on a director, less chasing on WhatsApp |
| a director or HR | approve quickly and keep quality up | a short queue, one clear next step, nothing that needs a spreadsheet |
| a sponsor or school | trust the organisation and ask to work together | honest, sourced facts and delivered work, never charity framing |

## What "working" looks like (read it live, never type it)

Members who do something in their first week. Projects and drives that have an owner and a record. Teams that a HoD
can run without a director. Reports on `/bugs` that get a visible answer fast. A certificate request that ends in a
decision. If a change cannot move one of these, it needs a stronger reason than "it would be nice".

## What it never does (these end an argument)

- No "donate" call to action; sponsorship is an exchange. No "CSR" in copy.
- No points, scores or rankings of people. Recognition is a human decision (the PRD retired the points system; the
  older "Welfare Points" wording in `AQ_CONTEXT.md` is superseded).
- No invented number: a figure is sourced, live, or marked "not yet tracked".
- No real member data in fixtures, logs, PRs or screenshots; many members are minors.
- A screen check is never the real permission: every UI gate has a matching database gate, changed together.
- Do not mix the two framings: students hear ownership, friends and certificates; sponsors hear delivered work.
- Nothing that would reach a parent badly (founder dependency, members leaving). Escalate instead.

## How a feature should change (ask these five, in order)

1. **Whose job does it serve?** Name the person from the table above and the thing they are trying to finish.
2. **Does it save time or add a step?** A new manual step for every member needs a strong reason. Remove an
   intermediary before adding a control; sign-in belongs at the moment of commitment.
3. **Does it make the record better?** Anything that captures who did what, or makes recording easier, is wanted.
4. **Can a teenager on a phone use it in five seconds?** One primary action, their own words, a visible result. If a
   report says "technical", "confusing" or "too much", the fix is fewer words and fewer controls, not a tutorial.
5. **Is it the smaller, reversible version first?** Ship that, record `Assumed:`, and let the next report refine it.

Worked example (2026-10-29): `/bugs` was a table with about twenty controls and internal words. The member's job is
"tell someone it is broken and see it get fixed". So the page became one button to report, three tabs, a card per
report with one plain status, and a big "me too"; leader and routine tools were folded away. The same questions apply
to any page that feels like a spreadsheet.

## When a report and this lens disagree

A report is the newest instruction on taste and flow, so build it when it is additive or reversible and says
`Assumed:` what it replaced. Escalate (section 8.5 of the routine) only when it would break a line in "never does", or
reverse a decision recorded in `docs/context/`, `docs/plans/` or the `DECISIONS_*` files.

## Keeping this true

When an owner correction or a reopened report teaches what the site is for, add a dated line here through a normal PR.
Prefer deleting a stale line to hedging it.
