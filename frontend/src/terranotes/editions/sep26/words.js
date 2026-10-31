// September 2026's "Words we should bring back" (its home page): each game draws 5 of these at random.
//   say:     how to say it, spelled out (capitals = the stressed part), shown under the word
//   options: the three meanings shown
//   answer:  which option is right (0 = first, 1 = second, 2 = third)
//   meaning: the real definition, shown after a pick (keep it under ~115 characters)
//   hint:    fades in as a "psst." note if nobody answers for 16 seconds
export const WORDS = [
  {
    word: 'Apricity',
    say: 'uh-PRISS-ih-tee',
    options: ['the warmth of the sun in winter', 'a sour aftertaste from citrus', 'a fear of open water'],
    answer: 0,
    meaning: 'Apricity (n.): the warmth of the sun in winter. Recorded in a 1623 dictionary, then almost never used again.',
    hint: "you'd feel it on a park bench in January.",
  },
  {
    word: 'Gloaming',
    say: 'GLOH-ming',
    options: ['a soft glow on wet stone', 'twilight; the fall of dusk', 'a slow-moving river fog'],
    answer: 1,
    meaning: 'Gloaming (n.): twilight, the fall of dusk. Still alive in Scottish speech and old songs.',
    hint: 'it happens every evening, if you look up.',
  },
  {
    word: 'Respair',
    say: 'rih-SPAIR',
    options: ['to repair something twice', 'a spare pair of shoes', 'fresh hope after despair'],
    answer: 2,
    meaning: 'Respair (n.): fresh hope; recovering from despair. Last seen in writing around the 1500s.',
    hint: 'say it straight after the word “despair”.',
  },
  {
    word: 'Curglaff',
    say: 'kur-GLAFF',
    options: ['a loud laugh at a funeral', 'a crooked garden fence', 'the shock of plunging into cold water'],
    answer: 2,
    meaning: 'Curglaff (n.): the shock you feel when you first plunge into cold water. An old Scots word.',
    hint: 'every sea swimmer knows it by the first gasp.',
  },
  {
    word: 'Snowbroth',
    say: 'SNOH-broth',
    options: ['a winter soup of root vegetables', 'freshly melted snow', 'the crunch of boots on ice'],
    answer: 1,
    meaning: 'Snowbroth (n.): freshly melted snow. Shakespeare gives a cold-blooded man “snow-broth” for blood.',
    hint: 'think less soup, more puddle.',
  },
  {
    word: 'Mizzle',
    say: 'MIZ-ul',
    options: ['a very fine, misty rain', 'to chew with your mouth open', 'to doze off by the fire'],
    answer: 0,
    meaning: 'Mizzle (v.): to rain in very fine drops, somewhere between mist and drizzle. Still heard in the West Country.',
    hint: 'squash two kinds of weather together.',
  },
  {
    word: 'Welkin',
    say: 'WEL-kin',
    options: ['a young hare', 'a hand-knitted shawl', 'the sky; the vault of heaven'],
    answer: 2,
    meaning: 'Welkin (n.): the sky, the vault of heaven. From Old English wolcen, “cloud”.',
    hint: 'look up.',
  },
  {
    word: 'Uhtceare',
    say: 'OOHT-chair-uh',
    options: ['a wooden spoon for stirring ale', 'lying awake before dawn, worrying', 'the last boat home at night'],
    answer: 1,
    meaning: 'Uhtceare (n.): lying awake before dawn, full of worry. Old English: uht, the hour before daybreak, and care.',
    hint: 'it tends to happen around 4 a.m.',
  },
  {
    word: 'Hurkle-durkle',
    say: 'HUR-kul-DUR-kul',
    options: ['to stay in bed long after you should be up', 'a game of hopscotch', "a knot that won't come undone"],
    answer: 0,
    meaning: "Hurkle-durkle (v.): to lounge in bed long after it's time to get up. An old Scots word, overdue a comeback.",
    hint: 'you probably did it last Sunday.',
  },
  {
    word: 'Groak',
    say: 'GROHK',
    options: ['the call of a heron', 'a lump of wet clay', "to watch someone eat, hoping they'll share"],
    answer: 2,
    meaning: "Groak (v.): to watch someone eat in silence, hoping they'll offer you some. Dogs never needed the word.",
    hint: 'every dog alive has mastered it.',
  },
  {
    word: 'Ultracrepidarian',
    say: 'ul-truh-krep-ih-DAIR-ee-un',
    options: ['someone who comments on things they know nothing about', 'a very early riser', 'a collector of old shoes'],
    answer: 0,
    meaning: 'Ultracrepidarian (n.): someone who gives opinions beyond their knowledge. William Hazlitt used it in 1819.',
    hint: 'a Roman once told a shoemaker to stick to shoes.',
  },
  {
    word: 'Brabble',
    say: 'BRAB-ul',
    options: ['a pebble polished by the sea', 'to squabble noisily over nothing', 'a small boat for two'],
    answer: 1,
    meaning: 'Brabble (v.): to squabble noisily over trifles. Twelfth Night has a “private brabble” in it.',
    hint: 'two neighbours, one parking spot.',
  },
];
