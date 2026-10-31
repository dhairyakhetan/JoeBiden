# HoD Desk — Director Management, Volunteer Applications

**Files:** `director/DirectorManagement.tsx` (267 lines), `director/VolunteerApplications.tsx` (477 lines, + `VolunteerApplicationsParts.tsx` not individually read) — both super-admin-only.

## What these desks are

**Intent:** promoting/demoting HoDs and changing access-critical roles, and reviewing the historical backlog of volunteer-interest leads from before self-registration was retired.

## What's genuinely working

**DirectorManagement** correctly treats every mutation here as irreversible-feeling and gates all of them behind an explicit confirm rather than an undo toast — the comment states the reasoning plainly: a role change takes effect server-side immediately, so there's nothing to "cancel" inside a 5-second window the way an optimistic post-approval has. Promoting a member to HoD auto-assigns a default category (operations) so they can immediately review posts, and if that specific step fails, the page says so without failing the whole promotion — a real partial-failure case handled honestly instead of silently swallowed.

**VolunteerApplications** is labeled honestly as a historical archive, not an active queue — its own subtitle states directly that "the public intake form is retired (join is Google sign-in)," so nobody mistakes this for a live pipeline. Its real-time subscription surfaces new rows as a dismissible "N new applications — load" banner rather than silently reordering the table underneath an admin mid-scroll or mid-read. The batch label-action was fixed from fire-and-forget to actually checking every result, with the comment naming the exact prior failure: "a failed batch looked identical to a successful one."

## Findings

### P2 — A director's role change dropdown can demote or reassign, but can't promote to Super Admin
`DirectorManagement`'s per-row role `<select>` for an existing HoD/director only offers `HoD` and `Director` as options, even though the underlying `handleChangeRole` function accepts `super_admin` as a valid value (and the separate "→ remove" button already handles demotion to member). There's no way to promote an existing director straight to super admin from this list — presumably intentional friction for the most sensitive role change, but worth confirming that's a deliberate choice rather than an oversight, since the code path to do it already exists one level down.
