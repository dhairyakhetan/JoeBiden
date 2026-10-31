-- TerraThon FIFA: full rules text (organisers' list, 2026-09-29).
-- Supersedes the short rules_md seeded in terrathon_schema_2026_09_21.sql.
-- Note: the old text said EA FC 27; the organisers' list says EA SPORTS FC 26.
-- Status: APPLIED LIVE 2026-09-29.
update public.terrathon_events set rules_md = $rules$## Who can play

- Born on or after **1 January 2005**.
- Age is verified by ID. Present a valid ID on request.
- Registration is solo. All matches are 1v1.

## Platform and settings

- **PS5**, EA SPORTS FC 26.
- Gameplay mode: Competitive. Match speed: Normal. Weather: Clear. Injuries: Off. Handball: Off.
- The official tournament console settings apply to every match.
- Custom squads, edited player ratings and modified game settings are prohibited.

## Format and fixtures

- Single elimination. Every game is a knockout.
- The organisers draw the fixtures before the tournament starts. They alone set the schedule and bracket.
- Rounds: Round of 16, Quarter Finals, Semi Finals, Grand Final.
- Round of 16 and Quarter Finals: **6-minute halves**. Semi Finals and Grand Final: **8-minute halves**.
- A match tied at full time goes to Extra Time, then Penalty Shootouts.
- Follow the match schedule the organisers provide.

## Team selection

- On the day, each participant draws a chit for their team from the approved pool. Both participants must be present for the draw.
- Each participant receives one team. Teams cannot be changed, exchanged or redrawn unless the organisers authorise it. Draw results are final and binding.
- Approved team pool: Arsenal, Borussia Dortmund, Bayern Munich, PSG, Real Madrid, FC Barcelona, Al Nassr, Al Hilal, Liverpool, Chelsea, Manchester City, Manchester United, Atlético Madrid.
- The organisers may set a separate pool for the Semi Finals and Grand Final. They announce it immediately before that round, and the same chit draw applies.

## Reporting and walkovers

- Report to the venue at least **10 minutes** before your scheduled match.
- More than **5 minutes late** after the scheduled match time is a loss by walkover, and the opponent advances. Late arrival can also lead to disqualification.
- No refund is issued for a walkover.

## Equipment

- Bring your own controller, connect it and test it before the match.
- You are responsible for your equipment working. The organisers are not liable for faults in personal equipment.

## During the match

- Tactical changes and squad management are allowed before kickoff.
- Each participant gets a maximum of **3 pauses** per match. Pause only in neutral situations, never to disrupt an active attack. Misusing pauses can lead to warnings, match forfeiture or disqualification.
- No outside assistance or coaching while a match is in progress.

## Conduct

- Abusive language, harassment, threats, cheating and unsportsmanlike behaviour are prohibited.
- Exploiting glitches, bugs, software vulnerabilities or unintended game mechanics leads to disciplinary action.
- Match-fixing, collusion and intentionally losing are prohibited.
- The organisers may issue warnings, match forfeitures or disqualifications, depending on severity.

## Property damage

- A participant who damages tournament or venue property (consoles, monitors, furniture, wiring, accessories, decorations, infrastructure) is fully liable.
- The organisers may charge repair or replacement costs to that participant, and may remove them from the tournament without refund.

## Technical issues

- After an interruption, hardware fault, power outage or game crash, the organisers may restart, continue or reschedule the match, and decide how to restore the match state. Their technical rulings are final.

## Organisers' authority

- The organisers may amend rules, schedules, match settings, team pools or format when needed.
- The organisers resolve anything the rules do not cover. Their decisions are final, binding and non-negotiable.
- Any additional rules go out in the participants' WhatsApp group.
- Participating means you have read, understood and agreed to these rules. Non-compliance can lead to penalties, forfeiture or disqualification.

## Prize pool

**₹2,500**: winner ₹1,500, runner-up ₹1,000.
$rules$ where slug = 'fifa';
