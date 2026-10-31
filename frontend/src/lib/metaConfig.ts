import { ORG_FACTS, displayCount } from './orgFacts'
import { departmentsPhrase, yearsPhrase } from './orgFigures'

// Every count below is `displayCount(ORG_FACTS.*)`, never a retyped literal —
// changelog/21-org-facts.md §21.4: "metaConfig.ts imports from ORG_FACTS. No
// literals in meta descriptions." Two of these descriptions (`faq`, `members`)
// previously said "students aged 14-25", which was a copy drift from the
// site's actual "14-19" audience (BRAND_VOICE.md §3) — fixed here by routing
// through the same ORG_FACTS.ageRange constant everything else uses.
const DRIVES = displayCount(ORG_FACTS.drivesWrittenUp)
const MEMBERS = displayCount(ORG_FACTS.membersTotal)

export interface MetaConfig {
  title: string
  description: string
  image?: string
  path: string
  type?: 'website' | 'article' | 'profile'
}

export const pageMetadata: Record<string, MetaConfig> = {
  home: {
    title: 'AquaTerra | Student-Run NGO & Community in Kolkata',
    description: `a student-run NGO in Kolkata where ${MEMBERS} teenagers run real welfare, climate and education work. ${DRIVES} drives since 2021. self-funded, free to join.`,
    image: '',
    path: '/',
  },
  about: {
    title: 'About AquaTerra | 16 Students, One Kolkata NGO',
    description: `how 16 students in Kolkata built a DARPAN-registered, self-funded NGO. now ${MEMBERS} teenagers running real welfare, climate and education work since June 2021.`,
    image: '',
    path: '/about',
  },
  projects: {
    title: 'Projects & Drives Since 2021 · AquaTerra Kolkata',
    description: `${DRIVES} student-run welfare drives, workshops and events, all documented since 2021: ${displayCount(ORG_FACTS.saplingsPlanted)} saplings, ${ORG_FACTS.sundarbansTrips} Sundarbans trips, ${displayCount(ORG_FACTS.bananasDistributed)} bananas. real work, from Kolkata.`,
    image: '',
    path: '/projects',
  },
  projectDetail: {
    title: '{projectName} | Student-Led Project',
    description: '{projectName}: A student-led project by AquaTerra bringing real impact to Kolkata. {projectDescription}. Led by young people taking ownership of community work.',
    image: '{projectImage}',
    path: '/projects/:slug',
  },
  blog: {
    title: 'Groundwork Diaries | AquaTerra Student Blog, Kolkata',
    description: 'student stories from the ground (Sundarbans trips, plantation drives, the late-night event builds) written by the AquaTerra members who were actually there.',
    image: '',
    path: '/blog',
  },
  blogPost: {
    title: '{postTitle} | AquaTerra Student Community',
    description: '{postExcerpt}',
    image: '{postImage}',
    path: '/blog/:slug',
    type: 'article',
  },
  schools: {
    title: 'Schools Network · Kolkata Campuses | AquaTerra',
    description: 'AquaTerra grows one campus at a time. Students run chapters at their own schools across Kolkata: real drives, real events, real leadership. Bring AQ to yours.',
    image: '',
    path: '/schools',
  },
  classes: {
    title: 'Class Cohorts · Students Teaching Students | AquaTerra',
    description: "Everyone at AquaTerra, grouped by the class they joined with, plus peer tutoring where students teach students. Free always, from Kolkata's student-run NGO.",
    image: '',
    path: '/classes',
  },
  crftd: {
    title: 'Crftd | Student-Run Streetwear · AquaTerra',
    description: "Crftd is AquaTerra's student-run streetwear label: designed, printed and sold by students in Kolkata. Every rupee of profit funds a welfare drive.",
    image: '',
    path: '/crftd',
  },
  collaborations: {
    title: 'Partnerships & Collaborations · Kolkata | AquaTerra',
    description: 'Partner with AquaTerra, a student-run NGO in Kolkata: co-host events, sponsor drives, share resources, or run joint welfare work with schools, NGOs and brands.',
    image: '',
    path: '/collaborations',
  },
  contact: {
    title: 'Contact AquaTerra | Partnerships, Collabs & Press',
    description: 'partnerships, school and NGO collabs, press, or just curious about a student-run NGO in Kolkata, say hi. we read everything and usually reply within a week.',
    image: '',
    path: '/contact',
  },
  faq: {
    title: 'AquaTerra FAQ | How to Join, Fees & How It Works',
    description: `answers on joining AquaTerra: who can join (students ${ORG_FACTS.ageRange}), the zero fees, certificates, and how a student-run NGO in Kolkata actually works.`,
    image: '',
    path: '/faq',
  },
  opportunities: {
    title: 'Student Volunteer Opportunities · Kolkata | AquaTerra',
    description: "Open volunteer roles at AquaTerra, Kolkata's student-run NGO. Real responsibility from day one: pick a team, apply in two minutes. Unpaid, zero fees.",
    image: '',
    path: '/opportunities',
  },
  support: {
    title: 'Support AquaTerra | No Donations, Real Ways to Help',
    description: "AquaTerra takes zero donations. it's a self-funded, student-run NGO. support the work instead: buy from Crftd, collaborate, or just spread the word in Kolkata.",
    image: '',
    path: '/support',
  },
  thankYou: {
    title: 'Thanks, we got your message · AquaTerra',
    description: 'Your message reached AquaTerra. A student on the team reads every enquiry, and you will hear back: here is what happens next.',
    image: '',
    path: '/thank-you',
  },
  privacyPolicy: {
    title: 'Privacy Policy · AquaTerra Kolkata',
    description: 'What AquaTerra collects when you join, who else can see it, what we never do with it, and how to have your data deleted. Written for students, in plain language.',
    image: '',
    path: '/privacy-policy',
  },
  accounts: {
    title: 'Open Books | Every Rupee In, Every Rupee Out · AquaTerra',
    description: 'The full FY ledger for AquaTerra, Kolkata: every rupee in and every rupee out, grouped by category and by month, with nothing summarised out of view.',
    image: '',
    path: '/accounts',
  },
  directory: {
    // Kept in step with public/DirectoryPage.tsx, which now READS this entry
    // instead of passing useMeta an inline object. Before 2026-09-17 it did
    // both, so the prerendered <title> and the one a JS client saw were
    // different strings on the same URL (audit, SEO P2).
    title: 'The AQ Map | Everything AquaTerra Does, and Every Way In',
    description: `every part of AquaTerra on one page: ${departmentsPhrase()} run by students, ${DRIVES} projects, the open roles, and ${yearsPhrase()} of it. pick the way in that suits you.`,
    image: '',
    path: '/directory',
  },
  // ── AquaTerra.live (the events hub) ─────────────────────────────────────────
  // Plan: docs/plans/aquaterra-live.md. Descriptions say what the visitor gets and when, never a figure.
  live: {
    title: 'AquaTerra.live | Party With a Purpose, Kolkata',
    description: "The home of every fundraising night AquaTerra throws in Kolkata: TerraThon, Starry Night, Disco Diwali and Paradox. Next up: Disco Diwali, The Masquerade Sangeet Edition, 10 November 2026.",
    image: '',
    path: '/live',
  },
  liveDisco: {
    title: 'Disco Diwali 2026 | The Masquerade Sangeet Edition, Kolkata',
    description: 'A masquerade sangeet night under the Diwali sky, all for charity. 10 November 2026, Kolkata. Count down, get your ticket and bring a mask. By AquaTerra.',
    image: '',
    path: '/live/disco-diwali',
  },
  liveEvents: {
    title: 'The Nights | Every AquaTerra Fundraising Event, Kolkata',
    description: 'Every fundraising night AquaTerra has thrown in Kolkata, from Disco Diwali to TerraThon, the next one first.',
    image: '',
    path: '/live/events',
  },
  liveVault: {
    title: 'The Vault | Photos From AquaTerra Nights',
    description: 'Photos from past AquaTerra fundraising nights in Kolkata. Every picture can be asked to come down.',
    image: '',
    path: '/live/vault',
  },
  liveWhy: {
    title: 'Why We Host | A Party That Pays | AquaTerra.live',
    description: 'AquaTerra has no grants and no parent company. The nights are how the programmes get paid for.',
    image: '',
    path: '/live/why',
  },
  liveCompany: {
    title: 'Good Company | Sponsors, Stalls and Partners | AquaTerra.live',
    description: 'The sponsors, stalls and partners behind AquaTerra nights, and how to be part of the next one.',
    image: '',
    path: '/live/company',
  },
  liveCrew: {
    title: 'The Crew | Who Makes the Night | AquaTerra.live',
    description: 'AquaTerra nights are built by student volunteers in Kolkata. Names appear with consent.',
    image: '',
    path: '/live/crew',
  },
  liveFaq: {
    title: 'FAQ | AquaTerra.live Disco Diwali',
    description: 'How to get a Disco Diwali ticket, when and where it is, what to wear and where the money goes. Short answers from the AquaTerra events team.',
    image: '',
    path: '/live/faq',
  },
  liveContact: {
    title: 'Contact | AquaTerra.live',
    description: 'Tickets, timings, sponsorship, a stall or press. Call or WhatsApp the AquaTerra events team in Kolkata.',
    image: '',
    path: '/live/contact',
  },
  // ── TerraThon 2026 ─────────────────────────────────────────────────────────
  // Four prerendered heads, because this audience arrives almost entirely from
  // an Instagram or WhatsApp link straight to a sport page. Without these, the
  // SPA fallback serves the homepage's head and every share preview reads
  // "AquaTerra | Student-Run NGO" instead of the sport someone is being invited
  // to play. Descriptions lead with the concrete ask: fee, format, dates.
  terrathon: {
    title: 'TerraThon 2026 | Cricket, Pickleball & FIFA in Kolkata',
    description: "Team AquaTerra's three-sport fundraiser, 2 to 4 October. Cricket, Pickleball and FIFA, open to school and college teams across Kolkata. Entry fees fund our welfare projects.",
    image: '',
    path: '/terrathon',
  },
  terrathonCricket: {
    title: 'TerraThon Cricket 2026 | Kolkata Student Tournament',
    description: 'Knockout cricket on turf, 3 and 4 October. Enter a team, play for a prize pool, and fund AquaTerra welfare work in Kolkata. Registration closes the night before.',
    image: '',
    path: '/terrathon/cricket',
  },
  terrathonPickleball: {
    title: 'TerraThon Pickleball 2026 | Doubles, Kolkata',
    description: 'Doubles pickleball on 2 October, league into knockouts. Grab a partner, take a court, and fund AquaTerra welfare work in Kolkata.',
    image: '',
    path: '/terrathon/pickleball',
  },
  terrathonFifa: {
    title: 'TerraThon FIFA 2026 | Solo Esports, Kolkata',
    description: 'Solo FIFA league on 3 October. One player, one controller, a prize pool, and entry fees that fund AquaTerra welfare work in Kolkata.',
    image: '',
    path: '/terrathon/fifa',
  },
  terrathonSchedule: {
    title: 'TerraThon 2026 Schedule | 2 to 4 October, Kolkata',
    description: 'Every fixture across the three days. Pickleball on Friday 2 October, Cricket on Saturday 3 and Sunday 4, FIFA on Saturday 3. Report times and venues as they are confirmed.',
    image: '',
    path: '/terrathon/schedule',
  },
  terrathonRules: {
    title: 'TerraThon 2026 Rules | Cricket, Pickleball and FIFA',
    description: 'The general rules and each sport’s own, for TerraThon 2026 in Kolkata. Born on or after 1 January 2005, report at the time listed for your sport, and entry fees are refunded only if we cancel a sport.',
    path: '/terrathon/rules',
  },
  terrathonContact: {
    title: 'TerraThon 2026 Contact | Ask the Organisers',
    description: 'Reach the students running TerraThon 2026 directly on WhatsApp, phone or email for questions about entries, fixtures, payment or your team.',
    image: '',
    path: '/terrathon/contact',
  },
  // The four below carry `noIndex` in prerender-meta.mjs's route table: a
  // registration form has nothing to index. They are prerendered anyway, and
  // that is the whole point. These are the links that go in an Instagram bio
  // and get pasted into WhatsApp groups, and a link preview fetcher reads the
  // file on disk, not the SPA. Without them every shared sign-up link previewed
  // as "AquaTerra | Student-Led Community & NGO in Kolkata" — the generic
  // homepage card, on the single most-shared URL of the entire campaign.
  terrathonRegister: {
    title: 'Register for TerraThon 2026 | Cricket, Pickleball, FIFA',
    description: 'Takes under a minute: name, date of birth, number and your sport. No team list needed now. We message you on WhatsApp with the payment QR, and your team names follow after that. Entry fees fund AquaTerra welfare work in Kolkata.',
    image: '',
    path: '/terrathon/register',
  },
  // The three figures below are transcribed from `terrathon_events`, which is
  // the value the page itself renders. They must be checked against it, by
  // hand, whenever a fee or a pot changes.
  //
  // That is a real hazard, and it has already bitten once. config.ts keeps
  // event data OUT of the codebase on purpose, so the team can change a fee
  // from the desk without a redeploy. These strings are the one place that
  // decision leaks: a link preview is read off a prerendered file on disk, so
  // it cannot read the database at build time and cannot update without a
  // deploy. On 2026-09-21 the cricket card advertised a ₹9,000 pot against a
  // real 7,500 and pickleball ₹6,000 against a real 5,000, on the two links
  // the comment above calls the most-shared URLs of the campaign. Corrected
  // here to match the database.
  //
  // Drifted again on 2026-09-21: the cricket fee moved from 2,400 to 2,100
  // at the desk and this string kept advertising the old one.
  //
  // If a fee or pot changes, change it here in the same commit, or drop the figure
  // from the description entirely rather than let it go stale again.
  terrathonRegisterCricket: {
    title: 'Enter a Cricket Team | TerraThon 2026, Kolkata',
    description: '₹2,100 a team for knockout cricket on 3 and 4 October, playing for a ₹7,500 pot. One person registers; send the squad list on WhatsApp afterwards.',
    image: '',
    path: '/terrathon/register/cricket',
  },
  terrathonRegisterPickleball: {
    title: 'Enter a Pickleball Pair | TerraThon 2026, Kolkata',
    description: '₹750 a pair for doubles pickleball on 2 October, league into knockouts, playing for a ₹5,000 pot. Grab a partner and take a court.',
    image: '',
    path: '/terrathon/register/pickleball',
  },
  terrathonRegisterFifa: {
    title: 'Enter the FIFA League | TerraThon 2026, Kolkata',
    description: '₹350 a player for the solo FIFA league on 3 October, playing for a ₹2,500 pot. One player, one controller, register in under a minute.',
    image: '',
    path: '/terrathon/register/fifa',
  },
  join: {
    // Read by public/JoinPromoPage.tsx. See the note on `directory`.
    title: 'Join AquaTerra · Student-Run NGO in Kolkata',
    description: `What you get for showing up: logged hours, a certificate on request, ${departmentsPhrase()} and three student-run ventures. Two minutes to apply, no fees, ever.`,
    image: '',
    path: '/join',
  },
  games: {
    title: 'Mini Games · AquaTerra',
    description: 'Short games from the AquaTerra crew: no sign-in, a couple of minutes each.',
    image: '',
    path: '/games',
  },
  equityPolicy: {
    title: 'Equity Policy · AquaTerra Community',
    description: 'AquaTerra’s community Equity Policy: the behaviour expected of every member across our WhatsApp communities, how concerns are reported, and what happens when the policy is broken.',
    image: '',
    path: '/equity-policy',
  },
  volunteer: {
    title: 'Volunteer Handbook · Join AquaTerra, Kolkata',
    description: 'How volunteering at AquaTerra works: show up for a drive, join a team, grow into real responsibility. Student-run in Kolkata, zero fees, no experience needed.',
    image: '',
    path: '/volunteer',
  },
  login: {
    // Titled for sign-UP, not sign-in. This page is the only way to join
    // AquaTerra (a first-time Google sign-in creates the account), so a title
    // reading "Log In" told search results and shared links the opposite of
    // what the page is for.
    title: 'Join AquaTerra | Sign Up with Google',
    description: 'Joining AquaTerra takes one tap: sign in with Google and your account is created. No separate sign-up form, no fees. Student-run NGO in Kolkata.',
    image: '',
    path: '/login',
  },
  register: {
    title: 'Join AquaTerra | Register Now',
    description: 'Create your account and join the AquaTerra community today.',
    image: '',
    path: '/register',
  },
  settings: {
    title: 'Settings | AquaTerra',
    description: 'Manage your AquaTerra account settings and preferences.',
    image: '',
    path: '/settings',
  },
  pendingApproval: {
    title: 'Pending Approval | AquaTerra',
    description: 'Your AquaTerra account is pending approval. Check back soon!',
    image: '',
    path: '/pending',
  },
  rejected: {
    title: 'Application Status | AquaTerra',
    description: 'Your AquaTerra application status.',
    image: '',
    path: '/rejected',
  },
  bugs: {
    title: 'Bugs and requests | AquaTerra',
    description: 'Report something that is broken on the AquaTerra site, or ask for something new, and follow what happens to it.',
    image: '',
    path: '/bugs',
  },
  tasks: {
    title: 'Tasks | AquaTerra',
    description: 'Who is doing what on AquaTerra: your tasks, the ones you supervise or follow, and your teams\' tasks.',
    image: '',
    path: '/tasks',
  },
  myPosts: {
    title: 'My Posts | Your Work on AquaTerra',
    description: 'Your posts: updates on student-led projects and real community work with AquaTerra.',
    image: '',
    path: '/my-posts',
  },
  savedPosts: {
    title: 'Saved Posts | AquaTerra',
    description: 'Your saved posts and bookmarks from AquaTerra community members and projects.',
    image: '',
    path: '/saved',
  },
  notifications: {
    title: 'Notifications | Stay Connected',
    description: 'Stay updated with your AquaTerra community notifications and activity updates.',
    image: '',
    path: '/notifications',
  },
  calendar: {
    title: 'Calendar | AquaTerra',
    description: 'Drives, breaks, deadlines and birthdays: everything happening at AquaTerra, in one place.',
    image: '',
    path: '/calendar',
  },
  profile: {
    title: 'My Profile | AquaTerra Community',
    description: 'View and edit your AquaTerra profile. Share what you have built with the community.',
    image: '{userAvatar}',
    path: '/profile',
    type: 'profile',
  },
  editProfile: {
    title: 'Edit Profile | Customize Your AquaTerra',
    description: 'Update your AquaTerra community profile information and share your student leadership story.',
    image: '',
    path: '/profile/edit',
  },
  publicProfile: {
    title: '{userName} | AquaTerra Student Leader',
    description: '{userName}, AquaTerra member: a student leader running real projects and community work in Kolkata.',
    image: '{userAvatar}',
    path: '/member/:uuid',
    type: 'profile',
  },
  post: {
    title: '{postTitle} | Student Community Post',
    description: '{postExcerpt}',
    image: '{postImage}',
    path: '/post/:uuid',
    type: 'article',
  },
  teams: {
    title: `${ORG_FACTS.departmentsActive} Student-Led Departments · AquaTerra Kolkata`,
    description: `${departmentsPhrase()}, all run by students: events, welfare, Crftd, ShikshAQ and more. real ownership from day one. find the lane that fits what you want to build. Kolkata.`,
    image: '',
    path: '/teams',
  },
  teamDetail: {
    title: '{teamName} | AquaTerra Student Team',
    description: '{teamName}, AquaTerra\'s {category} team: a student-led group running real projects in Kolkata.',
    image: '{teamImage}',
    path: '/teams/:uuid',
  },
  members: {
    title: 'Members & Student Leaders · AquaTerra Kolkata',
    description: `${MEMBERS} students aged ${ORG_FACTS.ageRange} run AquaTerra: the people behind every drive, event and workshop in Kolkata. meet the members building real things since 2021.`,
    image: '',
    path: '/members',
  },
  quickLinks: {
    title: 'Quick Links | AquaTerra · Every Page, One Place',
    description: 'Every AquaTerra link in one place: projects, Crftd, ShikshAQ, teams, the volunteer handbook, plus our Instagram, LinkedIn and WhatsApp. Kolkata student-run NGO.',
    image: '',
    path: '/links',
  },
  search: {
    title: 'Search AquaTerra | Find Members, Projects & Teams',
    description: 'Search AquaTerra: discover student leaders, youth-led projects, community teams, and impact initiatives across our Kolkata community.',
    image: '',
    path: '/search',
  },
  directorDashboard: {
    title: 'Director Dashboard | Manage Student Community',
    description: 'Manage and monitor AquaTerra community activities. Oversee student-led projects, teams, and member engagement.',
    image: '',
    path: '/director/dashboard',
  },
  accountApprovals: {
    title: 'Account Approvals | Onboard Student Leaders',
    description: 'Review and approve new AquaTerra member accounts. Build our student-led community.',
    image: '',
    path: '/director/approvals',
  },
  postModeration: {
    title: 'Post Moderation | Community Management',
    description: 'Review and moderate posts on the AquaTerra student community platform.',
    image: '',
    path: '/director/moderation',
  },
  memberDirectory: {
    title: 'Member Directory | Student Leaders',
    description: 'Browse and manage AquaTerra student leaders and community members.',
    image: '',
    path: '/director/members',
  },
  categoryManagement: {
    title: 'Category Management | Community Organization',
    description: 'Manage post categories and tags for student-led projects and community content.',
    image: '',
    path: '/director/categories',
  },
  notFound: {
    title: 'Page Not Found | AquaTerra',
    description: 'The page you\'re looking for doesn\'t exist.',
    image: '',
    path: '*',
  },
  // Paradox 2026 Pages
  paradoxHome: {
    title: 'Paradox 2026 | Student-Led Competitive Fest Kolkata',
    description: 'Paradox 2026 - AquaTerra\'s student-led competitive fest: sport, business, creative & cultural events across one week in Kolkata. Every rupee funds welfare projects.',
    image: '',
    path: '/paradox',
  },
  paradoxRegister: {
    title: 'Register for Paradox 2026 | Student-Led Competitive Fest',
    description: 'Register for Paradox 2026: AquaTerra\'s student-led competitive fest in Kolkata. Sport, business, creative & cultural events. Free to enter, proceeds to welfare.',
    image: '',
    path: '/paradox/register',
  },
  paradoxEvents: {
    title: 'Events | Paradox 2026 Student-Led Competitive Fest',
    description: 'Paradox 2026 events: sport, business, creative and cultural competitions at AquaTerra\'s student-led competitive fest in Kolkata.',
    image: '',
    path: '/paradox/events',
  },
  paradoxEventDetail: {
    title: '{eventName} | Paradox 2026',
    description: '{eventDescription}',
    image: '{eventImage}',
    path: '/paradox/events/:id',
  },
  paradoxBlog: {
    title: 'Blog | Paradox 2026 Student-Led Competitive Fest',
    description: 'Updates, recaps and behind-the-scenes from Paradox 2026, AquaTerra\'s student-led competitive fest in Kolkata.',
    image: '',
    path: '/paradox/blog',
  },
  paradoxBlogDetail: {
    title: '{blogTitle} | Paradox 2026 Blog',
    description: '{blogExcerpt}',
    image: '{blogImage}',
    path: '/paradox/blog/:id',
  },
  paradoxTeam: {
    title: 'Team | Meet Paradox 2026 Student Leaders',
    description: 'Meet the student-led team organising Paradox 2026, AquaTerra\'s competitive fest in Kolkata.',
    image: '',
    path: '/paradox/team',
  },
  paradoxSponsors: {
    title: 'Sponsors | Paradox 2026',
    description: 'Partners and sponsors supporting Paradox 2026, AquaTerra\'s student-led competitive fest.',
    image: '',
    path: '/paradox/sponsor',
  },
  paradoxTickets: {
    title: 'Get Tickets | Paradox 2026 Competitive Fest',
    description: 'Get your ticket for Paradox 2026, the student-led competitive fest in Kolkata.',
    image: '',
    path: '/paradox/ticket',
  },
  paradoxVolunteer: {
    title: 'Volunteer | Join Paradox 2026 Team',
    description: 'Become a volunteer for Paradox 2026 and help organise AquaTerra\'s student-led competitive fest.',
    image: '',
    path: '/paradox/volunteer',
  },
  paradoxScores: {
    title: 'Scores | Paradox 2026 Rankings',
    description: 'View competition scores and rankings from Paradox 2026, AquaTerra\'s student-led competitive fest.',
    image: '',
    path: '/paradox/scores',
  },
  paradoxUpdates: {
    title: 'Updates | Paradox 2026 News',
    description: 'Latest updates about Paradox 2026, AquaTerra\'s student-led competitive fest.',
    image: '',
    path: '/paradox/updates',
  },
  paradoxContact: {
    title: 'Contact | Paradox 2026 Team',
    description: 'Get in touch with the Paradox 2026 student leadership team. Questions about AquaTerra\'s student-led competitive fest.',
    image: '',
    path: '/paradox/contact',
  },
}

export const getMetaData = (pageKey: string): MetaConfig => {
  return pageMetadata[pageKey] || pageMetadata.home
}

export const DEFAULT_OG_IMAGE = ''
