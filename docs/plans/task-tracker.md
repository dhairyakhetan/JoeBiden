# Task tracker: structured plan (answered 2026-10-19, slice 1 in build)

**Owner answers, 2026-10-19:** any active member can create a task; statuses are open, in progress, blocked, done (a
moved due date is logged and still counts as a delay against the first date); the on-time and workload numbers are seen
by HR and super admin plus each HoD for their own team, and a member sees only their own; it lives on a Tasks page for
everyone plus a tab on team pages.

**Assumed (recorded, change by telling me):**
- The person who types a task in is added as its supervisor unless they pick a role for themselves, because they are
  usually the one who assigned it and otherwise could not edit what they just made.
- One role per person per task.
- General tasks stay private even from HR and super admin; the analytics return counts only, never the title of a
  private task.
- Silent spectators cannot comment (a comment is an edit); people who can only see a team task cannot comment either.
- Tasks are never deleted; a task that no longer matters is set to done with a comment.

(Original draft below, kept as written.)

# Task tracker: structured plan (draft, waiting for the owner's confirmation)

Source: three voice notes sent 2026-10-19 between 7:21 and 7:24 PM, transcribed locally (two Whisper models agreed on
the content). Nothing here is built. Per the owner's last note: first structure the idea and remove contradictions
(the newer statement wins), then show the plan, then build.

**One gap first.** The longest note opens with "Now this was all with respect to a task which is team specific", and
the last note says "I have explained to you the idea of the task tracker". So at least one earlier description (what a
task is, how a team task is made, statuses, due dates) was not in the three files. Everything below about those basics is
marked `Assumed:` until that is confirmed.

## 1. What it is, in the owner's words

A place to assign tasks and keep a list of who has what, and, in the long run, to see:

- the delays, and how many times a due date was missed;
- which members usually finish on time and which usually delay;
- how much pressure each member is under (how many tasks are assigned to them);
- how each team is performing.

Tasks are usually assigned per team. Tasks are often assigned over WhatsApp first and then created on the website
afterwards, so the person creating a task is often not the person who assigned it.

## 2. Two kinds of task

| | Team task | General task |
|---|---|---|
| Tied to | one team (and possibly other teams pulled in) | no team; people and teams chosen individually |
| Who can see it | the people on it, plus everyone in the team | only the people on it (performers, supervisors, spectators) |
| Shares | the same description, comments, due date, roles and editing rules | the same |

The owner sees no difference between the two in how you interact with a task, so they are one feature with a
visibility switch, not two features.

## 3. The three roles on every task (team or general)

1. **Performer.** Does the task. This is who it is assigned to.
2. **Supervisor.** Receives the end result. Usually the person who assigned it, even when someone else typed it into the
   website.
3. **Spectator.** Not assigned and not receiving the result, but can see every action and interact if they wish: senior
   management who should be informed, people whose input is wanted, people who just need to know the outcome.
   - Each spectator has a **silent spectator** checkbox. Off by default. Off: they can edit and comment. On: they can see
     everything but cannot make changes.
   - In a team task a silent spectator is the same as not being added at all (the team can see it anyway), but the
     checkbox stays so both kinds behave alike.

Correction made inside the notes: the owner first said senior management would be added as supervisors, then corrected
it to spectators ("I am so sorry, not supervisor, spectator"). Spectators it is.

## 4. Rules

| Question | Rule |
|---|---|
| Who can edit a task | only people on it: performer, supervisor or a non-silent spectator |
| Can everyone in a team be added at once | yes, as spectators, with one action (the "add everyone" option) |
| Team member who is not on the task | can see a team task, cannot edit it |
| General task visibility | performers, supervisors and spectators only; nobody else |
| What appears on a member's profile | tasks they perform and tasks they supervise; tasks they only spectate do not appear |
| Pulling in teams | a general task can pull in several teams; a team task can pull in another team from inside it; picking a team selects its whole membership at once |

## 5. Contradictions and how they were settled

| Said first | Said later | Used |
|---|---|---|
| Senior management are supervisors | Senior management are spectators | spectators |
| Non-spectators cannot edit | "an option to add everyone as spectator" | both: edit stays limited to people on the task; one action adds the whole team as spectators |
| Spectators can edit | Silent spectator cannot | non-silent can edit (default), silent cannot |

No unresolved contradiction remains in what I have. Two fragments of audio did not transcribe (they came out as noise on
both models), at the start of the roles explanation and just before "this role should sit with both team-specific and
non-team-specific tasks". The sentences around them are clear, so I do not think a requirement is lost, but if you remember
saying something there, say it again.

## 6. Proposed build (additive, nothing applied)

Reuses what exists: roles and RLS helpers, `teams` and `team_members`, the `/bugs` and director desks' patterns, the
toast and confirm feedback rules, `sized()` for avatars.

**Tables (new, additive):**
- `tasks`: id, title, description, kind (`team` or `general`), team_id (null for general), created_by, due_at, status,
  completed_at, created_at, updated_at. `Assumed:` fields beyond title, description and due date.
- `task_people`: task_id, member_id, role (`performer`, `supervisor`, `spectator`), silent (boolean, spectators only).
- `task_teams`: task_id, team_id, role. Selecting a team writes one row here and expands into `task_people` rows, so a
  later member change in the team does not silently change old tasks.
- `task_comments`: task_id, member_id, body, created_at.
- `task_events`: task_id, actor, kind, note, at. Feeds the delay and on-time numbers (due date moved, completed late).

**Security:** row-level policies carry every rule in section 4, not just the screens (same stance as the bug tracker).
A leader or HR can read everything for the analytics; this is an assumption, see question 3.

**Slices, each shippable on its own:**
1. Tasks, the three roles, visibility and edit rules, comments. Team and general.
2. Pull in whole teams, add everyone as spectators, the silent spectator checkbox.
3. Profile: performing and supervising tasks show on a member's profile.
4. Analytics: on-time rate per member, workload per member, delays and missed due dates, team performance.

## 7. Questions that change the build (the rest I will assume and record)

1. Who can create a task: any member, only leaders, or leads and above?
2. Statuses and delay: is it just open and done, or also in progress and blocked? Does moving a due date count as a delay?
3. Who sees the analytics: super admin and HR, the HoD of each team for their own team, everyone?
4. Where does it live: a Tasks page for everyone plus a tab on team pages (my suggestion), or a leaders-only desk first?


## Status after the 2026-10-19 night shift

Built: slice 1 (tasks, roles, rules, `/tasks`), slice 2 (add a whole team, team page tab), slice 3 (profile tab, performing
and supervising only), and the part of slice 4 that needs no new data access: `tasks/taskStats.ts` (tested) feeds a
"your record" panel on the done tab and a "who is on what" table on the team tab. Both only count tasks the viewer can
already see.

**Decided 2026-10-20 (owner):** build it as proposed below, a counts-only `SECURITY DEFINER` function behind a thin
`public` wrapper. Not built yet: it needs the live database, which was disconnected when this was decided. The three
sub-questions at the end of the paragraph still use their stated defaults (counts per team per month, no per-person rows
for HoDs).

**Was not built, needed the owner:** the organisation-wide numbers for HR and super admin (on-time rate, workload, delays and
team performance across all tasks, counting private tasks without showing them) and "each HoD for their own team".
Proposed shape, for a decision: one `SECURITY DEFINER` function that returns only counts (per team, per month), written
in the `private` schema and exposed through a thin `public` wrapper callable by `authenticated` only, with the wrapper
refusing anyone who is not HR, super admin or a HoD of that team. Questions: does HR and super admin see team tasks'
titles today (the policy says team tasks are visible to the team and the people on them), should HoDs see per-person
rows or only team totals, and is a monthly count enough or is a live figure needed? The wrapper adds one advisor line for
an authenticated-callable `SECURITY DEFINER` function, which is the cost of exposing any RPC.
