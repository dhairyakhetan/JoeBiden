# C-29 privacy copy: draft for Kanishk, NOT published (4 Nov 2026)

Held on purpose. The brief says to confirm the reveal rule against the code and the database before publishing, and to stop and report if it is not as stated. It is not.

## What the check found

1. **Phone reveals are not limited to HR and Super Admin, and not all are logged.** The Members desk reveal (HR and Super Admin) writes a row to `contact_access_log`. A second path does not: the database function `get_team_member_contacts(member_ids, team_id)` returns **email and phone** to any Director or HoD (`is_director()`), and to a team lead for their own team's members and pending applicants. It writes no log row. The Team applications screen calls it. So "only HR and Super Admin can reveal your number, and each reveal is logged" is false today.
2. **LinkedIn is not private from other members.** Signed-in members can read `linkedin`; only signed-out visitors cannot. Instagram is closed to everyone but the owner and the desk.

## Decision needed

Either (a) change `get_team_member_contacts` so only HR and Super Admin get a number and each call writes to `contact_access_log` (this takes a number away from HoDs and team leads who may use it to reach applicants), or (b) keep the access and word the policy to match what happens. Nothing was changed.

## Text ready to publish once the reveal rule is settled

**Privacy policy, who can see what**
> Your name, photo, school, role, bio, teams and approved posts are visible to anyone, including people who are not signed in, on the members list, your public profile and the class pages. You can switch your profile to hidden in Settings, Privacy. After that, people who are not signed in see only your name; signed-in members, teams and projects are unchanged.
>
> Your email, phone number, guardian's phone number and Instagram are never shown on your profile. LinkedIn, if you add it, is shown to signed-in members only. [REVEAL SENTENCE HELD: "Phone and WhatsApp reveals are limited to HR and Super Admin and each reveal is logged." Publish only once the rule above is true.]

**Privacy policy, grievances** (replaces the "to be filled in" placeholder; both links are live now)
> For any grievance, use the [grievance form](/grievance) (signed-in members) or contact the HR team listed on the [Equity Policy](/equity-policy) page. We usually respond within 7 days.

**Settings, WhatsApp** [HELD with the reveal sentence]
> Only HR and Super Admin can reveal your number, and each reveal is logged.

**Settings, Privacy.** Done: the "coming in a future update" line is replaced by the real switch (PR for step 5).

No removal or deletion promise is made anywhere beyond the switch.
