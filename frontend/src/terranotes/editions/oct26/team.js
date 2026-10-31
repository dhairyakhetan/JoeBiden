// October 2026's team (September's to start) ("Meet the team", shared/TeamSection.jsx), in the order their faces
// appear. The faces lay themselves out, so add or remove freely.
//   name, role: shown under the face and on the profile card
//   photo:     put the picture in public/team/ and write its path, e.g. '/team/ananya.webp' (square, ~400px, WebP: faces
//              show small, so a big original only slows the page down)
//   team:      one of the keys in TEAMS, or a list for someone in two, e.g. ['design', 'writing'] (the first sets their colour;
//              their face fades between the two every so often, or with steady: true keeps the first unless the legend picks the other)
//   bio:       2 lines for the pop-up when someone taps the face
//   instagram: handle without the @
//   credit:    (optional) their own line in place of the team's "what we made" line on their profile
//   crown:     (optional) true = a little crown on their photo in the profile pop-up
//   flip:      (optional) a second picture, e.g. '/team/priyam-flip.webp': tapping their photo in the profile pop-up turns
//              it over to this one, and back (their face in the section keeps the usual photo)
//   badge:     (optional) { img, text }: a small picture in the pop-up's corner; the text shows on hover / tap
//              (pictures in public/badges/)
// Leave a field '' and the design's placeholder shows instead.

// label: the legend and profile tag. made: what the team made; credit: the same as a sentence, shown on its members' profiles (writers also get "their articles").
export const TEAMS = {
  heads: { label: 'Heads', color: '#12B76A', made: 'keep everyone on track', credit: 'Keeps everyone on track' },
  design: { label: 'Design team', color: '#2F6BFF', made: 'made the layout and style of this website, along with its other design elements', credit: 'Made the layout and style of this website, along with its other design elements' },
  writing: { label: 'Writing team', color: '#F0214A', made: 'wrote the articles on this website', credit: 'Wrote the articles on this website' },
  tech: { label: 'Tech team', color: '#9B5CFF', made: 'made this website', credit: 'Made this website' },
};

// Mixed on purpose: the order sets where each face sits, so teams end up spread around the section.
export const MEMBERS = [
  { name: 'Aarav Agarwal', role: 'Head of department', team: 'heads', photo: '/team/aarav.webp', bio: 'tharki buddha', instagram: 'aaravagarwal2010' },
  { name: 'Sara Abedin', role: 'Writing team', team: 'writing', photo: '/team/sara.webp', bio: 'I love turning little thoughts and feelings into poetry especially when it turns into something other people can enjoy!', instagram: 'saraabe1in' },
  { name: 'Dhairya Khetan', role: 'Tech team', team: 'tech', photo: '/team/dhairya.webp', bio: 'One man army', instagram: 'dhairyakhetan', credit: 'Made this entire website alone', crown: true, badge: { img: '/badges/barca-crest.webp', text: 'born culer' } },
  { name: 'Pahal Sethi', role: 'Writing team', team: 'writing', photo: '/team/pahal.webp', bio: 'Writing, Creating, and Romanticising the little things. Mentally somewhere in New York.', instagram: 'pahalsethi' },
  { name: 'Anoushka Chandak', role: 'Design & writing team', team: ['design', 'writing'], photo: '/team/anoushka.webp', bio: 'i love yapping 😌', instagram: 'anoushka.aaaaa' },
  { name: 'Hiya Khara', role: 'Head of department', team: 'heads', photo: '/team/hiya.webp', bio: 'I live on Starbucks ;)', instagram: 'hiyakhara' },
  { name: 'Ahel Sarkar', role: 'Writing team', team: 'writing', photo: '/team/ahel.webp', bio: 'Find me a new fandom to get into, and I will bring to you a thesis on it. Also some poems and stuff.', instagram: 'ahelsarkar' },
  { name: 'Syeda Tashirun Nabi', role: 'Design team', team: 'design', photo: '/team/syeda.webp', bio: 'Fueled by Diet Coke and questionable layout choices', instagram: 'tashirun.hq' },
  { name: 'Priyam Agarwal', role: 'Tech team', team: 'tech', photo: '/team/priyam.webp', flip: '/team/priyam-flip.webp', bio: 'Hey, I’m Priyam! I’m into tech, maths, and quant finance, and I like messing around with new ideas and building random stuff. Mostly just curious and figuring things out as I go :)', instagram: 'priyamagarwal3', badge: { img: '/badges/barca-crest.webp', text: 'born culer' } },
  { name: 'Dhriti Agarwal', role: 'Writing team', team: 'writing', photo: '/team/dhriti.webp', bio: "I'm a student of class 11 flowing through life and accounts!!", instagram: 'wtf__dhriti' },
  { name: 'Divya Rathi', role: 'Design & writing team', team: ['design', 'writing'], photo: '/team/divya.webp', bio: 'probably drinking coffee or already five cups in.', instagram: '' },
  { name: 'Ashwika Tripathi', role: 'Head of department', team: ['heads', 'writing'], steady: true, photo: '/team/ashwika.webp', bio: 'Just here to make things happen.', instagram: 'theashwika' },
  { name: 'Diti Shah', role: 'Writing team', team: 'writing', photo: '/team/diti.webp', bio: 'Hii…this is Diti Shah', instagram: '_ditishah' },
  { name: 'Ayushi Khemka', role: 'Design team', team: 'design', photo: '/team/ayushi.webp', bio: 'Designing my life one questionable decision at a time.', instagram: '' },
  { name: 'Bhavishya Agarwal', role: 'Tech team', team: 'tech', photo: '/team/bhavishya.webp', bio: 'I like Claude', instagram: 'bhavishya.idk' },
  { name: 'Priyadarshini Hazra', role: 'Writing team', team: 'writing', photo: '/team/priyadarshini.webp', bio: 'Writing things I’d want to read myself.', instagram: 'pr1yadxrshini_' },
  { name: 'Rishavi Banerjee', role: 'Writing team', team: 'writing', photo: '/team/rishavi.webp', bio: 'Writer at heart, storyteller by nature, finding meaning in every word', instagram: 'the_awful_moon' },
];
