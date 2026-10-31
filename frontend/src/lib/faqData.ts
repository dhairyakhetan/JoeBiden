// Single source of truth for FAQ content shown on both /faq and /volunteer.
// The two pages used to hand-maintain separate arrays that answered several
// of the same questions ("is there a fee," "how does approval work") in
// different wording - not contradictory today, but the same failure shape
// that already caused a real, documented drift bug once (see orgFacts.ts:
// founding-year and approval-time claims disagreeing across pages before
// being centralized there). Consolidating here closes that risk before it
// repeats.
//
// `context` marks which page(s) a question belongs on:
//  - 'faq'      -> FAQPage only
//  - 'handbook' -> VolunteerHandbookPage only
//  - 'both'     -> genuinely the same question on both pages (fee, approval
//                  time) - one wording, shown on both.
import { APPROVAL_TIME, ORG_FACTS, displayCount } from './orgFacts'
import { yearsPhrase, capitalise } from './orgFigures'

const DRIVES = displayCount(ORG_FACTS.drivesWrittenUp)
const MEMBERS = displayCount(ORG_FACTS.membersTotal)

export type FaqContext = 'faq' | 'handbook' | 'both'

export interface FaqEntry {
  id: string
  q: string
  a: string
  context: FaqContext
  // FAQPage-only grouping: is this a question for someone still deciding
  // whether to join, or someone already inside asking about mechanics?
  cluster?: 'joining' | 'inside'
}

export const FAQ_DATA: FaqEntry[] = [
  // ── shared (both pages) - genuinely the same question, same scope ──
  { id: 'fee', q: 'Is there any fee?', a: 'No. AquaTerra is free to join and always will be. We fund ourselves through student-run events and Crftd merchandise. Zero donations, zero fees.', context: 'both', cluster: 'joining' },

  // ── FAQ-only ──
  { id: 'who-can-join', q: 'Who can join?', a: `Students aged ${ORG_FACTS.ageRange}, primarily based in Kolkata. No experience needed. No resume required. Nobody here had one when they started.`, context: 'faq', cluster: 'joining' },
  { id: 'community-vs-team', q: 'What is the difference between Community AQ and Team AQ?', a: `Community AQ is the full member base (${MEMBERS} people). Anyone can volunteer for welfare drives and community activities. Team AQ (150-200 members) is the active core: selected via application, assigned to specific departments, expected to show up consistently.`, context: 'faq', cluster: 'joining' },
  { id: 'what-will-i-do', q: 'What will I actually do?', a: 'Depends on your department. Events team runs Paradox, Disco Diwali, and Starry Nights. Welfare team runs teaching workshops and Sundarbans relief trips. Social Media team runs the Instagram and content. Collabs team handles school and NGO partnerships. Crftd handles the streetwear brand. You pick what fits you.', context: 'faq', cluster: 'joining' },
  // Approval TIME (the number itself) is deliberately NOT re-typed here -
  // both this short FAQ answer and the handbook's longer one below pull
  // APPROVAL_TIME from the same constant, so the one figure that's already
  // caused a real drift bug (24h vs a week vs "usually a week") can't drift
  // again even though the two answers differ in scope/depth (this one is a
  // quick timing answer; the handbook's covers what happens after approval)
  // - not merged into one 'both' entry, since the handbook's version has
  // real extra detail (community platform access, additional screening for
  // Labs/Director-track) a merge would have silently dropped.
  { id: 'approval-time', q: 'How long does approval take?', a: `Usually ${APPROVAL_TIME}. An HoD reviews your application personally.`, context: 'faq', cluster: 'joining' },
  { id: 'certificate', q: 'Do I get a certificate?', a: 'Yes. HR issues participation certificates based on hours contributed. High contributors and Heads of Departments get Letters of Recommendation. These are real documents, not templates.', context: 'faq', cluster: 'inside' },
  { id: 'multiple-departments', q: 'Can I be part of multiple departments?', a: 'Yes. Many members contribute across departments at the same time. The system is flexible. If you want to run welfare drives and also design Crftd merch, you can.', context: 'faq', cluster: 'inside' },
  // REMOVED 2026-09-04 (decision 12, REDESIGN_FEATURE_REQUESTS.md): the
  // 'welfare-points' entry read `You earn ${POINTS_SENTENCE}`. The welfare
  // points system is retired, so the FAQ can no longer promise it. Deleted
  // rather than reworded: there is no replacement answer to give.
  { id: 'leadership-structure', q: 'How does the leadership structure work?', a: 'Community to Team AQ to Head of Department to Core to Executive Board. Progression is based on performance and consistency, not seniority. A class 10 student can lead a department if they show up.', context: 'faq', cluster: 'inside' },
  { id: 'what-is-crftd', q: 'What is Crftd?', a: "Crftd is AQ's student-run streetwear brand. Members design, produce, and sell the merchandise. Profits go back into funding AQ's welfare projects and events.", context: 'faq', cluster: 'inside' },

  // ── Handbook-only ──
  { id: 'what-is-aquaterra', q: 'What is AquaTerra?', a: `AquaTerra is a student-led NGO based in Kolkata, registered under DARPAN (REG: ${ORG_FACTS.darpanReg}). We run welfare drives for animals and communities, organise cultural events, and build technology projects - all driven entirely by volunteers aged ${ORG_FACTS.ageRange}. We started in 2021 with a dog feeding drive in South Kolkata. ${capitalise(yearsPhrase())} later we've run ${DRIVES} welfare projects and drives, and grown to ${MEMBERS} members across Kolkata's schools.`, context: 'handbook' },
  { id: 'darpan-registered', q: 'Is AquaTerra registered with the government?', a: 'Yes. AquaTerra is certified by DARPAN, an initiative of NITI Aayog, Govt. of India. Our registration number is AAFTT2300ME20251.', context: 'handbook' },
  { id: 'where-operate', q: 'Where does AquaTerra primarily operate?', a: 'AquaTerra is based in Kolkata and runs most on-ground drives across South and Central Kolkata. Our tech and content arms (AQ Tech, Prism Media) operate remotely and are open to volunteers outside Kolkata.', context: 'handbook' },
  { id: 'prior-experience', q: 'Do I need prior experience to volunteer?', a: "No. We don't require prior experience, specific skills, or any kind of portfolio. We do ask that you're serious about showing up. We have limited spots and we're looking for people who want to do real work, not pad a resume.", context: 'handbook' },
  { id: 'time-commitment', q: "What's the time commitment?", a: "Minimum 4–6 hours per month. Most active volunteers put in 10–15 hours. Drives are usually on weekends. Virtual coordination happens on WhatsApp throughout the week. We understand you have school and exams - we expect genuine effort and communication when you can't make it.", context: 'handbook' },
  { id: 'what-do-i-get', q: 'What do I get out of it?', a: `Real experience doing real things. You'll work alongside directors who've run hundreds of welfare drives. You'll build relationships with ${MEMBERS} members from across Kolkata's schools. You'll be credited for every project you contribute to. We're not going to tell you it looks good on a college application - it probably does, but that's not why we're here.`, context: 'handbook' },
  { id: 'approval-process', q: 'How does the approval process work?', a: `Apply via this website. A director reviews your application personally, usually ${APPROVAL_TIME}. If approved, you'll get access to the AquaTerra community platform where you can see all internal posts, team updates, and initiatives. Some departments (especially Labs and Director-track roles) have additional screening.`, context: 'handbook' },
]

export function faqFor(page: 'faq' | 'handbook'): FaqEntry[] {
  return FAQ_DATA.filter(e => e.context === page || e.context === 'both')
}
