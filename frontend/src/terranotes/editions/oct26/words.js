// October 2026's "Words we should bring back" (its home page): words of Durga Pujo, Diwali and how the festive season
// feels. Each game draws
// 5 of these at random.
//   say:     how to say it, spelled out (capitals = the stressed part), shown under the word
//   options: the three meanings shown
//   answer:  which option is right (0 = first, 1 = second, 2 = third)
//   meaning: the real definition, shown after a pick (keep it under ~115 characters)
//   hint:    fades in as a "psst." note if nobody answers for 16 seconds
export const WORDS = [
  {
    word: 'Shiuli',
    say: 'SHIU-lee',
    options: ['night jasmine that falls at dawn', 'a sweet made of rice and jaggery', 'the first rain of autumn'],
    answer: 0,
    meaning: 'Shiuli (n.): night-flowering jasmine, white with an orange stem. It falls by dawn, and means Pujo is near.',
    hint: 'you find it on the ground, not on the tree.',
  },
  {
    word: 'Dhunuchi',
    say: 'DHOO-noo-chee',
    options: ['a clay incense burner people dance with', 'the stick used to play the dhak', 'a paper lantern'],
    answer: 0,
    meaning: 'Dhunuchi (n.): a clay burner of coconut husk and incense, held while dancing to the dhak at the evening arati.',
    hint: 'there is smoke, and there is dancing.',
  },
  {
    word: 'Kash',
    say: 'KAASH',
    options: ['white grass flowers that bloom in autumn', 'the bell rung during arati', 'a festive red sari border'],
    answer: 0,
    meaning: 'Kash (n.): tall grass whose white plumes cover the riverbanks in autumn; it also crowns the dhak.',
    hint: 'look at the riverbank, and at the top of the drum.',
  },
  {
    word: 'Bhasan',
    say: 'BHAA-shaan',
    options: ['the immersion of the idol on the last day', 'the queue outside a famous pandal', 'a mid-night snack'],
    answer: 0,
    meaning: 'Bhasan (n.): the immersion of the idol in the river on Dashami, with drums, dancing and a little heartbreak.',
    hint: 'it happens at the river, on the last day.',
  },
  {
    word: 'Alpana',
    say: 'AAL-po-naa',
    options: ['patterns painted on the floor with rice paste', 'a kind of clay lamp', 'the chant on Mahalaya'],
    answer: 0,
    meaning: 'Alpana (n.): white patterns painted by hand on floors and doorsteps with rice paste, for festivals.',
    hint: 'you step around it, never on it.',
  },
  {
    word: 'Prodip',
    say: 'PRO-deep',
    options: ['a small clay oil lamp', 'a firecracker that whistles', 'a garland of marigolds'],
    answer: 0,
    meaning: 'Prodip (n.): a little clay lamp with a cotton wick; Diwali night lines every ledge and doorstep with them.',
    hint: 'it has a wick, and it glows.',
  },
  {
    word: 'Phuljhari',
    say: 'PHOOL-jhaa-ree',
    options: ['a hand-held sparkler', 'a sweet shaped like a flower', 'a paper lantern'],
    answer: 0,
    meaning: 'Phuljhari (n.): a sparkler: a wire that throws "falling flowers" of sparks while you write your name in the air.',
    hint: 'hold it at arm’s length.',
  },
  {
    word: 'Bijoya',
    say: 'BI-jo-yaa',
    options: ['the greetings and sweets after Dashami', 'the first day of Pujo', 'the drummer’s rhythm'],
    answer: 0,
    meaning: 'Bijoya (n.): after Dashami: touching elders’ feet, hugs, and far too many sweets. "Subho Bijoya!"',
    hint: 'it comes after the goodbye, with sweets.',
  },
  {
    word: 'Mon kemon',
    say: 'MON KE-mon',
    options: ['the ache of missing something', 'a festival song', 'the smell of incense'],
    answer: 0,
    meaning: 'Mon kemon (n.): that heavy, homesick feeling, like the morning after Dashami when the pandals come down.',
    hint: 'you feel it when the lights come down.',
  },
];
