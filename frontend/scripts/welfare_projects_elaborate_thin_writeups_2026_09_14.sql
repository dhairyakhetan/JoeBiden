-- APPLIED LIVE 2026-09-14 via Supabase MCP (migration name:
-- welfare_projects_elaborate_thin_writeups)
--
-- Owner request: "the short write up and the long write up is very small and
-- weird in a lot of posts... make it a little elaborative without sounding
-- AI, without using em dashes." Reviewed all 548 published rows first
-- (median long_writeup: 568 chars of genuinely specific, well-written
-- prose) before touching anything - confirmed real scope is much narrower
-- than "all 548 are thin". Only ~50 rows sit under 400 chars, and most of
-- those already read fine as short pieces.
--
-- This rewrites the 21 that were actually weak:
--   - 16 rows (1597,1598,1599,1600,1603,1604,1605,1606,1609,1610,1611,1614,
--     1615,1616,1617,1618) are this session's OWN earlier backfill
--     (welfare_projects_backfill_missing_content_2026_09_14.sql) - every one
--     a single formulaic sentence ("On <date>, <N> volunteers ran <X> at
--     <Y>...") repeated almost verbatim across rows, and it used em dashes.
--     Exactly the pattern being complained about.
--   - 5 older rows (1153,1152,1149,1151,1150) read as generic marketing
--     copy ("At AquaTerra, we've always believed in giving children the
--     freedom to express") that never once mentioned the real numbers
--     already sitting on that same row (key_statistic).
--
-- Every replacement is still built only from that row's own columns
-- (header, location, volunteers, date, key_statistic, objective) - no
-- invented specifics, no em dashes, two short paragraphs of plain human
-- sentences instead of one templated line. id 1617 also picks up
-- key_statistic ("25+ kids attended.") derived from its own short_summary,
-- guarded with coalesce/nullif so a second run can never clobber a value
-- someone else has since set by hand.
--
-- Verified live afterward: none of the 21 rows' long_writeup contains an
-- em dash.

update welfare_projects set long_writeup =
  'Five AquaTerra volunteers spent the day at Ektara Foundation running a Teaching English Workshop, walking a group of kids through basic grammar across a series of short classes. The sessions moved between simple exercises and a lot of repetition, the kind that actually sticks.

By the time the volunteers wrapped up, 15 kids had gone through the material, a little more confident with their English than when the day began.'
  where id = 1597;

update welfare_projects set long_writeup =
  'Four AquaTerra volunteers ran a teaching internship at Ektara Foundation, covering the basics of English grammar with a focus on nouns, pronouns and verbs. It was less a one-off session than a hands-on stretch of teaching, with volunteers taking turns at the front of the room.

Fifteen kids came away from it having worked through all three, a small but solid addition to their English lessons.'
  where id = 1598;

update welfare_projects set long_writeup =
  'Four AquaTerra volunteers ran a Mother''s Day card-making session at Disha Foundation, laying out paper, glue and colour for the kids to work with. Between the cutting and the careful lettering, the room stayed busy for most of the afternoon.

Sixteen cards were finished by the end, each one a little different, all of them made for someone''s mother.'
  where id = 1599;

update welfare_projects set long_writeup =
  'Six AquaTerra volunteers set up at Emami City for a sharbat distribution drive, pouring out glasses to anyone looking for relief from the heat. Passersby stopped, drank, and mostly kept moving, which is exactly how a good drive like this should go.

By the end of it, 30 litres of sharbat had gone out, one small, cold break in a long, hot day for a lot of people.'
  where id = 1600;

update welfare_projects set long_writeup =
  'AquaTerra volunteers spent Valentine''s Day at Pather Saathi running a card-making workshop, handing out paper hearts and markers for the children to turn into their own designs. Some kept it simple, others went all in with glitter and colour.

It was a small, cheerful session, the kind built less around any single number and more around the afternoon itself.'
  where id = 1603;

update welfare_projects set long_writeup =
  'AquaTerra set up a custom T-shirt stall at Xaviers University, Kolkata, letting students design and pick up their own shirts on the spot. It was a lighter, campus-facing kind of drive, more about visibility and a bit of fun than a fixed outcome to report.

Students stopped by throughout the day, and the stall gave AquaTerra a chance to be seen and talked to on ground it doesn''t usually cover.'
  where id = 1604;

update welfare_projects set long_writeup =
  'AquaTerra volunteers ran a food distribution drive in Bhawanipore, handing out meals to people in the area who needed one. The approach stayed simple: show up, hand out what there is, and keep the line moving.

It''s the kind of drive that doesn''t need much dressing up. A meal reaching someone who needed it is the whole point.'
  where id = 1605;

update welfare_projects set long_writeup =
  'AquaTerra partnered with Vishwajagriti and Emami to run a fundraising event at Science City, bringing together three different groups under one shared cause. Collaborations like this take more coordination than a solo drive, and this one pulled it off.

The event gave AquaTerra a bigger platform than it usually has on its own, and a chance to fundraise alongside partners who brought their own audience to the table.'
  where id = 1606;

update welfare_projects set long_writeup =
  'AquaTerra ran a Learner''s Den session at Pather Saathi, spending the afternoon passing on information and basic learning to the children there. The format stayed informal, more conversation than lecture.

It was one more session in a long-running relationship with Pather Saathi, the kind of steady, low-key visit that adds up over time even without a headline number attached to it.'
  where id = 1609;

update welfare_projects set long_writeup =
  'Three AquaTerra volunteers ran the Smile Notes Campaign in Bhawanipore, walking the streets and handing passersby a note with an affirmation written on it, a toffee tucked in alongside. Most people paused just long enough to read it and smile before moving on.

By the end of the drive, 100 notes and 100 toffees had changed hands, a hundred small, unexpected moments dropped into an ordinary day.'
  where id = 1610;

update welfare_projects set long_writeup =
  'Eight AquaTerra volunteers took the Smile Notes Campaign to MBA Chaiwala in Lake Town, handing out notes carrying a short affirmation with a toffee attached to each one. With a bigger team out that day, the drive moved through the area quickly.

A hundred notes and a hundred toffees were given out in total, each one a small nudge of encouragement for whoever happened to be walking by.'
  where id = 1611;

update welfare_projects set long_writeup =
  'Five AquaTerra volunteers returned to Ektara Foundation for another English session, this time focused on conjunctions and verbs. The class worked through examples on the board before trying out sentences of their own.

Fifteen kids got through the lesson, leaving with a slightly firmer grip on how to string a sentence together.'
  where id = 1614;

update welfare_projects set long_writeup =
  'Eight AquaTerra volunteers ran a Mother''s Day card-making workshop at Disha Foundation, setting out paper and colour for the kids to make something of their own. With a larger volunteer group on hand, there was time for one-on-one help with the trickier folds and cutouts.

More than 15 handmade cards came out of the session, each one made with a particular mother in mind.'
  where id = 1615;

update welfare_projects set long_writeup =
  'Six AquaTerra volunteers brought the Smile Notes Campaign to Lake Town Footbridge, handing commuters a note with an affirmation and a toffee as they crossed. Most people were in a hurry, but a note and a small treat is easy enough to take on the move.

By the time the drive wrapped, 100 notes and 100 toffees had been handed out, a hundred quick, unexpected moments folded into everyone''s commute.'
  where id = 1616;

update welfare_projects set
  key_statistic = coalesce(nullif(key_statistic, ''), '25+ kids attended.'),
  long_writeup = 'AquaTerra volunteers ran a Digital Safety Workshop at Pather Saathi, walking a group of kids through the basics of staying safe online: what to share, what not to, and how to spot something that doesn''t look right. The topic is less hands-on than a craft session, so the volunteers leaned on examples and questions to keep it engaging.

More than 25 kids attended, coming away with a clearer sense of how to handle themselves on the internet.'
  where id = 1617;

update welfare_projects set long_writeup =
  'Three AquaTerra volunteers ran Tails and Treats at Dobson Lane, walking the area with a stock of biscuits for the dogs and cows that call the street home. It''s a short, simple kind of drive, more about showing up consistently than doing anything elaborate.

Over the hour, more than 10 dogs and cows were fed, a quiet, steady bit of care for the animals that share the neighborhood.'
  where id = 1618;

update welfare_projects set long_writeup =
  'Four AquaTerra volunteers ran the Art Attack drawing competition at National Hindi High School, handing out paper and colours and letting the students loose on whatever they wanted to draw. Some stuck to careful, planned pieces, others filled the page with whatever came to mind first.

Forty children competed in total, turning a school afternoon into a room full of colour and concentration.'
  where id = 1153;

update welfare_projects set long_writeup =
  'Four AquaTerra volunteers ran Pride Binge in Kolkata, an evening built around stories, conversation and solidarity rather than a single scripted programme. The tone stayed open and informal, with volunteers making space for people to talk rather than just be talked at.

The event reached thirty-five children by the end of the evening, part fundraiser, part a chance for the community to spend time together.'
  where id = 1152;

update welfare_projects set long_writeup =
  'Twenty AquaTerra volunteers ran Full House at Madhuvan, an evening of card games organised in partnership with Madhuvan and built entirely around raising funds for the cause. With that many volunteers on hand, the night moved between tables easily, everyone finding a game to join.

By the end of the evening, the drive had raised more than ten thousand rupees, cards and community turned into something the fundraiser could actually use.'
  where id = 1149;

update welfare_projects set long_writeup =
  'Two AquaTerra volunteers ran a science workshop at Pather Sathi''s Sunday School, working through a handful of simple experiments that turned a quiet Sunday into something a lot more hands-on. Between a baking-soda volcano and an egg that mysteriously refused to sink, there was no shortage of questions.

Thirty children went through the session, each experiment giving them a small, concrete answer to hold onto.'
  where id = 1151;

update welfare_projects set long_writeup =
  'Ten AquaTerra volunteers ran the thirteenth Grow Green plantation drive at Calcutta Girls High School, digging in alongside students to get saplings into the ground. With a full team out, the work moved quickly from one patch of soil to the next.

Ninety saplings were planted by the time the drive wrapped up, a small stretch of green added to the school grounds that should keep growing long after the day itself is forgotten.'
  where id = 1150;
