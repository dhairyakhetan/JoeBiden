-- TerraThon cricket: full rules text (organisers' list, 2026-09-29).
-- Supersedes the shorter rules_md seeded in terrathon_schema_2026_09_21.sql.
-- Changes vs the old text: 5-over innings with a 15-minute fielding limit, 8-player
-- squad, jerseys, reporting, equipment, bowler limits (one bowler may bowl 2 overs,
-- non-consecutive), powerplay call rules, wide/no-ball final-over exception, ceiling
-- net detail, live overthrows, conduct, prohibited items. "No appeals" became
-- "improper appeals are penalised".
-- Status: APPLIED LIVE 2026-09-29.
update public.terrathon_events set rules_md = $rules$## Who can play

Born on or after **1 January 2005**. Every member of your team has to meet this, verified by a **DigiLocker Aadhaar ID**. Failing to produce the ID on time leads to immediate disqualification in case of disputes.

## Format

- One innings per team, straight knockout.
- **5 overs** per innings. The fielding team must complete its overs within **15 minutes**. Delays caused by the batting team are also counted. Penalties are at the organizers' discretion.
- **8 players** per team.
- All members of a team wear the **same jersey colour**.
- The entire team reports **at least 20 minutes before its match**. Delays are penalized at the organizers' discretion.
- Bring your own bats, gloves and other equipment.

## Bowling

- Only full-arm bowling is allowed. No underarm, standing or sling-action deliveries. Bowlers must take a run-up. Chucking is not allowed.
- A minimum of **4 bowlers** must bowl in each match. Only one bowler may bowl 2 overs, and those overs must be non-consecutive.

## Powerplay

- Each team gets **one Powerplay over** per match, in which all runs count double.
- The last over cannot be the Powerplay.
- It must be called before the bowler for that over is selected. If the batting team does not call it, the penultimate over becomes the Powerplay by default.

## Scoring

- **Wides and no balls:** each counts as a delivery and awards **3 runs**. In the final over they are not legal deliveries and award only 1 run, per standard cricket rules.
- **Ceiling net:** if the ball touches the ceiling net and a fielder catches it directly afterwards, the batter is out. If the ball touches the net on either side wall before the catch, the batter is not out.
- **Overthrows** are live. Batters may run extra runs off overthrows, boundaries and extras, and all valid runs count.

## Conduct

- The umpire's decision is final. Appeals made in a non-sporting or inappropriate manner are not entertained and lead to penalization.
- Any physical or verbal abuse leads to immediate disqualification or heavy penalties at the organizers' discretion. Their decision is final.
- E-cigarettes, vapes, alcohol and any similar intoxicating substances are strictly prohibited. Any violation leads to immediate confiscation.

## Prize pool

**₹7,500**: winner ₹4,500, runner-up ₹3,000.
$rules$ where slug = 'cricket';
