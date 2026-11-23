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
    title: 'AquaTerra | Student-Run NGO Giving Back in Kolkata',
    description: `a student-run NGO in Kolkata. ${MEMBERS} teenagers raise their own money and give it back: ${DRIVES} welfare drives, free exam papers, sport and sessions with kids. free to join.`,
    image: '',
    path: '/',
  },
  about: {
    title: 'About AquaTerra | Student-Run, Self-Funded NGO in Kolkata',
    description: `how 16 students in Kolkata built a registered NGO that raises its own money and gives it back. now ${MEMBERS} teenagers and ${DRIVES} welfare drives since June 2021.`,
    image: '',
    path: '/about',
  },
  projects: {
    title: 'Every Welfare Drive Since 2021 | AquaTerra Projects, Kolkata',
    description: `${DRIVES} student-run welfare drives and workshops, each written up with photos: stray dog feeding, food and clothes drives, plantations, Sundarbans relief, kids' sessions.`,
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
    title: 'Groundwork Diaries | Stories From AquaTerra Drives, Kolkata',
    description: 'first-hand stories from AquaTerra drives: Sundarbans relief trips, plantation days, sessions with kids and the late-night event builds that pay for them.',
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
    title: 'Start an AquaTerra Chapter at Your School · Kolkata',
    description: 'students run AquaTerra chapters at their own Kolkata schools: welfare drives, events and real leadership, all free. here is how a campus joins the network.',
    image: '',
    path: '/schools',
  },
  classes: {
    title: 'Students Teaching Students · Free Peer Classes | AquaTerra',
    description: "free peer classes where AquaTerra students teach students, plus everyone grouped by the class they joined with. part of how Kolkata's student-run NGO gives back.",
    image: '',
    path: '/classes',
  },
  crftd: {
    title: 'Crftd | Student Streetwear That Funds Welfare · AquaTerra',
    description: "Crftd is AquaTerra's student-run streetwear label, designed, printed and sold by students in Kolkata. it is one of the two ways the NGO pays for its welfare drives.",
    image: '',
    path: '/crftd',
  },
  collaborations: {
    title: 'Partner With AquaTerra | Schools, NGOs & Brands in Kolkata',
    description: `run drives with us, host a session for kids, co-host an event or sponsor one. AquaTerra has worked with partner organisations on ${DRIVES} drives since 2021.`,
    image: '',
    path: '/collaborations',
  },
  contact: {
    title: 'Contact AquaTerra | Partnerships, Drives, Press · Kolkata',
    description: 'partner organisations, schools, press, parents or students: write to AquaTerra, the student-run NGO in Kolkata. a student reads every message and replies.',
    image: '',
    path: '/contact',
  },
  faq: {
    title: 'AquaTerra FAQ | Joining, Donations, Drives and How It Works',
    description: `who can join (students ${ORG_FACTS.ageRange}), why there are no fees and no donations, how drives are run and funded, and how Kolkata's student-run NGO works.`,
    image: '',
    path: '/faq',
  },
  opportunities: {
    title: 'Volunteer Roles for Students in Kolkata | AquaTerra',
    description: "open roles across AquaTerra's student-run teams in Kolkata: welfare, events, education, design and more. real responsibility from day one, free, two minutes to apply.",
    image: '',
    path: '/opportunities',
  },
  support: {
    title: 'Support AquaTerra | We Take No Donations, Here Is How to Help',
    description: "AquaTerra is self-funded and takes no donations. help the work instead: join a drive, come to an event, buy from Crftd, partner with us or spread the word in Kolkata.",
    image: '',
    path: '/support',
  },
  // The "giving back" pillar pages (owner, 15 Nov 2026). Their body copy lives in
  // lib/pillarContent.ts; these are only the head tags. Titles front-load the
  // topic a person would search for, then the brand.
  impact: {
    title: 'How AquaTerra Gives Back | Welfare, Donations & Free Education',
    description: `self-funded, zero donations: ${MEMBERS} Kolkata students earn the money and give it back through ${DRIVES} welfare drives, free exam papers, sport and sessions with kids.`,
    image: '',
    path: '/impact',
  },
  shikshaq: {
    title: 'ShikshAQ | Free Exam Papers, Built by Students · AquaTerra',
    description: 'ShikshAQ is the free education platform built by AquaTerra students in Kolkata: free exam papers for any student, and a free way to find a teacher. no membership needed.',
    image: '',
    path: '/shikshaq',
  },
  sports: {
    title: 'Sport at AquaTerra | Charity Tournaments for Kolkata Students',
    description: 'open cricket, pickleball and FIFA tournaments run by students in Kolkata. TerraThon and Paradox bring school and college teams together, and entry fees fund welfare.',
    image: '',
    path: '/sports',
  },
  ai: {
    title: 'How AquaTerra Trains Its Teams to Use AI | Student NGO, Kolkata',
    description: 'AquaTerra trains student members to use AI well: workshops, AI in the daily running of an NGO, real projects built with it, and sessions teaching kids to use AI safely.',
    image: '',
    path: '/ai',
  },
  thankYou: {
    title: 'Thanks, we got your message · AquaTerra',
    description: 'Your message reached AquaTerra. A student on the team reads every enquiry, and you will hear back: here is what happens next.',
    image: '',
    path: '/thank-you',
  },
  privacyPolicy: {
    title: 'Privacy Policy · AquaTerra',
    description: 'what AquaTerra collects when you join, who can see it, what we never do with it and how to have it deleted. written for students, in plain language.',
    image: '',
    path: '/privacy-policy',
  },
  terms: {
    title: 'Terms of Use · AquaTerra',
    description: 'the rules for using the AquaTerra site, in plain words: who can join, what you can post, how to get something taken down.',
    image: '',
    path: '/terms',
  },
  directory: {
    // Kept in step with public/DirectoryPage.tsx, which now READS this entry
    // instead of passing useMeta an inline object. Before 2026-09-17 it did
    // both, so the prerendered <title> and the one a JS client saw were
    // different strings on the same URL (audit, SEO P2).
    title: 'The AQ Map | Everything AquaTerra Does, One Page',
    description: `every part of AquaTerra on one page: ${departmentsPhrase()} run by students, ${DRIVES} welfare drives, the impact library, open roles and ${yearsPhrase()} of work.`,
    image: '',
    path: '/directory',
  },
  // ── AquaTerra.live (the events hub) ─────────────────────────────────────────
  // Plan: docs/plans/aquaterra-live.md. Descriptions say what the visitor gets and when, never a figure.
  live: {
    title: 'AquaTerra.live | Fundraising Nights That Pay for Welfare, Kolkata',
    description: "the home of AquaTerra's fundraising nights in Kolkata: Disco Diwali, The Starry Night, TerraThon and Paradox. every ticket pays for the NGO's welfare drives.",
    image: '',
    path: '/live',
  },
  liveDisco: {
    title: 'Disco Diwali 2026 | The Masquerade Sangeet Edition, Kolkata',
    description: "AquaTerra's masquerade sangeet night for charity, held 10 November 2026 in Kolkata. student-run, and every ticket funded the NGO's welfare drives.",
    image: '',
    path: '/live/disco-diwali',
  },
  liveEvents: {
    title: 'Every AquaTerra Fundraising Night | Kolkata Events',
    description: 'every fundraising night AquaTerra has thrown in Kolkata, from Disco Diwali to TerraThon, and what each one paid for.',
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
    title: 'Why AquaTerra Hosts Events | The Nights That Fund the Work',
    description: 'AquaTerra has no grants, no parent company and takes no donations. its student-run nights are how the welfare drives, ShikshAQ and sessions with kids get paid for.',
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
    title: 'FAQ | AquaTerra.live Fundraising Nights',
    description: 'When and where Disco Diwali 2026 took place, how the tickets worked, the dress code and where the money from AquaTerra nights goes. Short answers from the events team.',
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
    title: 'TerraThon 2026 | Charity Cricket, Pickleball & FIFA, Kolkata',
    description: "AquaTerra's three-sport charity tournament, held 2 to 4 October 2026: cricket, pickleball and FIFA for school and college teams. entry fees funded welfare drives.",
    image: '',
    path: '/terrathon',
  },
  terrathonCricket: {
    title: 'TerraThon Cricket 2026 | Charity Tournament, Kolkata',
    description: 'knockout cricket on turf, 3 and 4 October 2026, for school and college teams in Kolkata. entry fees funded AquaTerra welfare work.',
    image: '',
    path: '/terrathon/cricket',
  },
  terrathonPickleball: {
    title: 'TerraThon Pickleball 2026 | Charity Doubles, Kolkata',
    description: 'doubles pickleball on 2 October 2026, league into knockouts, run by AquaTerra students in Kolkata. entry fees funded welfare work.',
    image: '',
    path: '/terrathon/pickleball',
  },
  terrathonFifa: {
    title: 'TerraThon FIFA 2026 | Charity Esports League, Kolkata',
    description: 'a solo FIFA league on 3 October 2026, run by AquaTerra students in Kolkata. one player, one controller, and entry fees that funded welfare work.',
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
    title: 'Join AquaTerra | Free Student Volunteering in Kolkata',
    description: `join ${MEMBERS} students running welfare drives, events and free education in Kolkata: logged hours, a certificate on request, ${departmentsPhrase()}. free, two minutes to apply.`,
    image: '',
    path: '/join',
  },
  games: {
    title: 'Mini Games · AquaTerra',
    description: 'short games made by AquaTerra students in Kolkata: no sign-in, a couple of minutes each.',
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
    title: 'Volunteer Handbook | How Volunteering at AquaTerra Works',
    description: 'how volunteering at AquaTerra works: show up for a drive, join a team, grow into real responsibility. student-run in Kolkata, free, no experience needed.',
    image: '',
    path: '/volunteer',
  },
  login: {
    // Titled for sign-UP, not sign-in. This page is the only way to join
    // AquaTerra (a first-time Google sign-in creates the account), so a title
    // reading "Log In" told search results and shared links the opposite of
    // what the page is for.
    title: 'Sign In to AquaTerra | Join With Google',
    description: 'joining AquaTerra takes one tap: sign in with Google and your account is created. free, student-run, Kolkata.',
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
    title: `${ORG_FACTS.departmentsActive} Student-Run Teams Behind AquaTerra · Kolkata`,
    description: `${departmentsPhrase()}, all run by students: welfare, events, Crftd, ShikshAQ, marketing and more. find the team that fits what you want to build, from day one.`,
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
    title: 'The Students Who Run AquaTerra · Kolkata',
    description: `${MEMBERS} students aged ${ORG_FACTS.ageRange} run AquaTerra: the people behind ${DRIVES} welfare drives, the events that fund them and the free education work.`,
    image: '',
    path: '/members',
  },
  coreTeam: {
    title: 'AQ Core | AquaTerra Core Team, Kolkata',
    description: 'The core members of AquaTerra, the students who carry the work week to week.',
    image: '',
    path: '/core-team',
  },
  quickLinks: {
    title: 'Quick Links | Every AquaTerra Page in One Place',
    description: 'every AquaTerra link in one place: how we give back, projects, ShikshAQ, Crftd, teams, the handbook, plus Instagram, LinkedIn and WhatsApp.',
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
    // Paradox 2026 has ended; this is the archive page every closed /paradox path lands on (pages/Archive.tsx).
    title: 'Paradox 2026: That’s a Wrap | AquaTerra Student Fest, Kolkata',
    description: "Paradox 2026, AquaTerra's student-run fest of sport, business, creative and cultural events, ran 1 to 6 June 2026 in Kolkata. read the story, meet the team, see the blog.",
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
    description: 'Meet the student team that organised Paradox 2026, AquaTerra\'s fest of sport, business, creative and cultural events in Kolkata.',
    image: '',
    path: '/paradox/team',
  },
  paradoxStory: {
    title: 'The Story of Paradox 2026 | AquaTerra Student Fest, Kolkata',
    description: "how a team of AquaTerra students built Paradox 2026, a six-day fest of sport, business, creative and cultural events in Kolkata, 1 to 6 June 2026. proceeds fund welfare.",
    image: '',
    path: '/paradox/story',
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
