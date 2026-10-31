/**
 * Sample AquaTerra posts - shown as fallback when the backend DB is unavailable.
 * Images are pulled directly from the live Supabase welfare_projects table.
 */
import type { Post } from '../services/api'

export interface SampleAuthor {
  uuid: string
  fullName: string
  school: string
  classGrade: string
  role: 'member' | 'director'
  bio: string
  dept: string
}

export interface SamplePost {
  postId: number
  uuid: string
  body: string
  authorName: string
  authorUuid: string
  authorAvatar?: string
  authorSchool?: string
  authorId?: number
  authorRole?: string
  category: string
  likeCount: number
  commentCount?: number
  isLiked: boolean
  createdAt: string
  images?: { blobUrl: string }[]
  status: 'approved'
  taggedMembers?: { uuid: string; fullName: string; avatarUrl?: string }[]
}

// Real images from Supabase welfare_projects
const F = 'https://framerusercontent.com/images/'
const IMGS = {
  dogs1:    [`${F}QqQKU06p6zl0gfLu43Z9zR7U94.jpg`, `${F}zxdrQgKIn7XF3mFX0S3yX1RtQtY.jpg`, `${F}0YmpnaFWki4mZCFET4eY0BuaUA.jpg`, `${F}NpUbVhMAZFaTN65bU10cApf474I.jpg`],
  dogs2:    [`${F}68gVh8qZdoYOU4bMsQS7DBCDBg.jpg`, `${F}nfu1JQS7Leyx0fV9Und3kVcqbj4.jpg`, `${F}V5kSntHYDb2MCbzrLjSTOGZvu4.jpg`],
  event1:   [`${F}7cke5jXGTbINiYXqP66y7rAA7nk.jpg`, `${F}ACDMHb3E31uWigEGx60XeVBRZlE.jpg`, `${F}Z1Px7Tvgwn4J6BsudugSASPGdew.jpg`, `${F}MfBFPnBgIzeDYbA1teGESlOb7E.jpg`],
  plant:    [`${F}VeRRzbAHwSlLEYwYky0c14gJGqg.jpg`, `${F}yu7QeOhblliJk6bm6Ua8pd89i8U.jpg`, `${F}Y4hnU7KxEPF03vxQ9JpGvWmy1tY.jpg`, `${F}NEA2lv3ibbCFERr28DLeLZfj3w.jpg`],
  workshop: [`${F}AJDNKLdV2RBTvkgbDQ7Hgt5Cmr0.jpg`, `${F}gK7YuPaj3QSs9ygz77oBihLXlz4.jpg`, `${F}6rvFkEnrLYkoCVeRIXYr9ZLC7ug.jpg`, `${F}U9sfTkVFYC2y1yE2DfNDlPho.jpg`],
  health:   [`${F}jBOZKmrRArrbXdvZvD01tL7kA.jpg`, `${F}783vqwOgrPZpGJgf2Jq8LUlRE.jpg`, `${F}TTMQ1LOtbn8SyOKvfRdGcJBxw08.jpg`, `${F}Ic8IhAuIh3k0lZHauAOwow4wcCc.jpg`],
  relief:   [`${F}QQIaD5p43IwrRgkbtUEmm3pyY.jpg`, `${F}6bvPuMB6rFKXKaaTNvLzKErHLI.jpg`, `${F}ElhNHwdXaOYnFBRC63UEpL3ChfY.jpg`, `${F}Lonm8XgSN3UP2FGMtlFjqZBxc.jpg`],
  sports:   [`${F}ipjifurHq0slJWrjAFLPRRzCirI.jpg`, `${F}npI0fQyCGgK7cAgvtG0yxAtnM.jpg`, `${F}Sbw2w0e5jvX2G1msw63IG8Fsyg.jpg`],
  clothes:  [`${F}Z9Wf9ey9mxFQzEj55xorg8talY.jpg`],
  fundraiser: [`${F}SQjMBtqBXoDYifCT5dfgPOjf1Pk.jpg`],
}

const toImages = (urls: string[]) => urls.map(blobUrl => ({ blobUrl }))

// All sample-author uuids carry the `sample-` prefix so they can never
// collide with a real v4 uuid coming back from the API. The format
// already differs visibly but the prefix is belt-and-braces. Only
// referenced within this file (verified by grep across the codebase).
export const SAMPLE_AUTHORS: Record<string, SampleAuthor> = {
  'sample-priyasha-uuid': { uuid: 'sample-priyasha-uuid', fullName: 'Priyasha Chatterjee', school: 'South Point High School', classGrade: 'Class 11', role: 'member', bio: 'Welfare team. I show up every weekend. Mainly for the dogs.', dept: 'welfare' },
  'sample-arjun-uuid':    { uuid: 'sample-arjun-uuid',    fullName: 'Arjun Mehta',          school: 'La Martiniere for Boys',  classGrade: 'Class 12', role: 'director', bio: 'Events Director @ AquaTerra. Reverie 2024 lead. Making noise for four years.', dept: 'events' },
  'sample-ishaan-uuid':   { uuid: 'sample-ishaan-uuid',   fullName: 'Ishaan Roy',            school: 'Heritage School Kolkata', classGrade: 'Class 11', role: 'member', bio: 'AQ Tech - building tools for people who do real things.', dept: 'labs' },
  'sample-ananya-uuid':   { uuid: 'sample-ananya-uuid',   fullName: 'Ananya Sen',            school: 'Loreto House',            classGrade: 'Class 12', role: 'director', bio: 'Welfare Director. 8 medical camps this year. Target was 10. We\'re hitting 12.', dept: 'welfare' },
  'sample-rhea-uuid':     { uuid: 'sample-rhea-uuid',     fullName: 'Rhea Bose',             school: 'Modern High School',      classGrade: 'Class 10', role: 'member', bio: 'Prism Media - I document what the welfare team does and try not to cry.', dept: 'content' },
  'sample-kabir-uuid':    { uuid: 'sample-kabir-uuid',    fullName: 'Kabir Dasgupta',        school: 'DPS Ruby Park',           classGrade: 'Class 12', role: 'director', bio: 'Operations Director. Batch approvals, logistics, the stuff nobody sees.', dept: 'operations' },
  'sample-tanya-uuid':    { uuid: 'sample-tanya-uuid',    fullName: 'Tanya Agarwal',         school: 'Calcutta International School', classGrade: 'Class 11', role: 'member', bio: 'Plantation drives and welfare. 4,200+ saplings since 2022 - still counting.', dept: 'welfare' },
  'sample-soham-uuid':    { uuid: 'sample-soham-uuid',    fullName: 'Soham Bhadra',          school: "St. Xavier's Collegiate School", classGrade: 'Class 10', role: 'member', bio: 'Events team. Workshop facilitator at Pather Sathi. I get nervous every time.', dept: 'events' },
  'sample-devansh-uuid':  { uuid: 'sample-devansh-uuid',  fullName: 'Devansh Saha',          school: 'The Newtown School',      classGrade: 'Class 12', role: 'member', bio: 'Relief operations and welfare. Sundarbans trip changed how I think about outreach.', dept: 'welfare' },
  'sample-priya-uuid':    { uuid: 'sample-priya-uuid',    fullName: 'Priya Ghosh',           school: 'Mahadevi Birla World Academy', classGrade: 'Class 11', role: 'member', bio: 'Events team. Fundraiser specialist. I make spreadsheets no one reads.', dept: 'events' },
}

export const SAMPLE_POSTS: SamplePost[] = [
  {
    postId: 9001, uuid: 'sample-post-1',
    authorName: 'Priyasha Chatterjee', authorUuid: 'sample-priyasha-uuid', authorSchool: 'South Point High School',
    category: 'welfare', likeCount: 47, isLiked: false,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    images: toImages(IMGS.dogs1), status: 'approved',
    body: `Just wrapped the Tollygunge dog feeding drive - 38 dogs fed across 4 streets this morning. Huge thanks to everyone who showed up at 7am on a Sunday. Brought extra kibble this time because last week three of the regulars didn't eat. All three showed up today. That's why we do this.

Team: Arjun, Sneha, Rohan, Tanya, me. Next drive is next Saturday, same spot, 7:30am. Tag anyone who wants to join.`,
  },
  {
    postId: 9002, uuid: 'sample-post-2',
    authorName: 'Arjun Mehta', authorUuid: 'sample-arjun-uuid', authorSchool: 'La Martiniere for Boys',
    category: 'events', likeCount: 83, isLiked: false,
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    images: toImages(IMGS.event1), status: 'approved',
    body: `Reverie 2024 final attendance count: 847 people. We were expecting 600.

This was our biggest event yet - four years of AquaTerra and we somehow pulled off a cultural fest with live performances, a welfare exhibition, fundraising stalls, and a short film screening, all within a ₹40,000 budget. The film won a regional award last month. The welfare stall raised ₹18,400 for our medical camp fund.

Thank you to everyone on the Events team who didn't sleep for three days. You know who you are.`,
  },
  {
    postId: 9003, uuid: 'sample-post-3',
    authorName: 'Ishaan Roy', authorUuid: 'sample-ishaan-uuid', authorSchool: 'Heritage School Kolkata',
    category: 'labs', likeCount: 29, isLiked: false,
    createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    images: undefined, status: 'approved',
    body: `AQ Tech shipped the first internal build of the volunteer attendance tracker today. It's bare - just check-in/check-out, drive tagging, and a CSV export - but it works on mobile and it doesn't crash.

Problem we're solving: right now attendance is tracked on WhatsApp screenshots and a shared Google Sheet that nobody trusts. We'll pilot this on the next 3 welfare drives and see what breaks.

If you're on the Labs team and want to help with the backend, ping me. We're using Node + Postgres and it's nothing fancy.`,
  },
  {
    postId: 9004, uuid: 'sample-post-4',
    authorName: 'Ananya Sen', authorUuid: 'sample-ananya-uuid', authorSchool: 'Loreto House',
    category: 'welfare', likeCount: 61, isLiked: false,
    createdAt: new Date(Date.now() - 1.5 * 86400 * 1000).toISOString(),
    images: toImages(IMGS.health), status: 'approved',
    body: `Medical camp at Behala - 34 stray dogs vaccinated (anti-rabies + distemper), 12 treated for mange, 3 emergency cases referred to Dr. Sinha's clinic. Dr. Ghosh and her team volunteered their entire Sunday for this. We covered their fuel costs and lunch.

This is our 8th camp this year. Target was 10. We're going to hit 12.

If anyone has contacts at other vet clinics who might want to partner, please reach out. We can't scale this without more medical professionals who believe in what we're doing.`,
  },
  {
    postId: 9005, uuid: 'sample-post-5',
    authorName: 'Rhea Bose', authorUuid: 'sample-rhea-uuid', authorSchool: 'Modern High School',
    category: 'content', likeCount: 38, isLiked: false,
    createdAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
    images: toImages([IMGS.dogs2[0]]), status: 'approved',
    body: `New Groundwork Diaries post is live: "He Barks, I Heal" - Ashwika's piece on the Behala medical camp and what it feels like to hold a dog that's never been touched gently before.

It's the best thing we've published this year. Go read it. Link on the blog page.

Prism Media is also looking for photographers for the next welfare drive. You don't need experience - just show up with a phone and a willingness to get your shoes dirty.`,
  },
  {
    postId: 9006, uuid: 'sample-post-6',
    authorName: 'Kabir Dasgupta', authorUuid: 'sample-kabir-uuid', authorSchool: 'DPS Ruby Park',
    category: 'operations', likeCount: 22, isLiked: false,
    createdAt: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
    images: undefined, status: 'approved',
    body: `New member applications for April batch: 214 received, 89 shortlisted, 51 approved. We sent rejections today - always the worst part of this job. If you applied and didn't hear back, it means either we're at capacity in your preferred department or we had concerns about availability.

For approved members: onboarding call is next Friday at 6pm. Check your email. You'll need to join at least one drive in your first two weeks to keep your spot.

Retention from last batch was 78%. That's our highest yet.`,
  },
  {
    postId: 9007, uuid: 'sample-post-7',
    authorName: 'Tanya Agarwal', authorUuid: 'sample-tanya-uuid', authorSchool: 'Calcutta International School',
    category: 'welfare', likeCount: 54, isLiked: false,
    createdAt: new Date(Date.now() - 4 * 86400 * 1000).toISOString(),
    images: toImages(IMGS.plant), status: 'approved',
    body: `Tree plantation drive wrap - Rabindra Sarobar today. 120 saplings planted. Species mix: neem, peepal, krishnachura, gulmohar. Local municipality gave us a NOC and two staff members to help dig. First time that's happened.

Sapling survival rate from our March drive is currently at 68%. We check every three weeks. The ones that didn't make it were in areas with heavy foot traffic.

Total: 4,200+ saplings planted since 2022. Running count is on the website.`,
  },
  {
    postId: 9008, uuid: 'sample-post-8',
    authorName: 'Soham Bhadra', authorUuid: 'sample-soham-uuid', authorSchool: "St. Xavier's Collegiate School",
    category: 'events', likeCount: 44, isLiked: false,
    createdAt: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
    images: toImages(IMGS.workshop), status: 'approved',
    body: `Workshop recap: public speaking for Class 8–10 students at Pather Sathi. 35 kids, 2.5 hours, three rounds of 2-minute speeches on topics they drew from a hat.

Highlights: a 13-year-old talked about what it's like to not have a father. Nobody expected that. The room went very quiet. Then everyone clapped for 30 seconds.

This is our third session at this school. The principal asked if we could run one every month. We said yes. If you want to facilitate, DM me.`,
  },
  {
    postId: 9009, uuid: 'sample-post-9',
    authorName: 'Devansh Saha', authorUuid: 'sample-devansh-uuid', authorSchool: 'The Newtown School',
    category: 'welfare', likeCount: 36, isLiked: false,
    createdAt: new Date(Date.now() - 6 * 86400 * 1000).toISOString(),
    images: toImages(IMGS.relief), status: 'approved',
    body: `Mukti Sundarbans relief drive done. We reached 3 villages - Gosaba, Satjelia, Bali - with dry ration kits (rice, dal, oil, salt) for 140 families. The road into Gosaba was half-submerged. We waded the last 600m.

This was our first post-cyclone response. We were on the ground within 72 hours of Remal making landfall. Learning a lot about what rapid response actually requires vs what we thought it would.

Full trip report going on Prism Media this week.`,
  },
  {
    postId: 9010, uuid: 'sample-post-10',
    authorName: 'Priya Ghosh', authorUuid: 'sample-priya-uuid', authorSchool: 'Mahadevi Birla World Academy',
    category: 'events', likeCount: 51, isLiked: false,
    createdAt: new Date(Date.now() - 7 * 86400 * 1000).toISOString(),
    images: toImages(IMGS.sports), status: 'approved',
    body: `Turf Wars sports fundraiser - final numbers: ₹24,300 raised across 6 hours of football, cricket, and badminton. 80+ participants, 12 teams.

All proceeds go to the Behala medical camp fund. We're ₹6,000 short of covering the next camp - if anyone wants to close that gap, the support page is live.

Special mention to Kabir for getting the ground booked at zero cost. Genuinely no idea how he does it.`,
  },
]

// localStorage-based like persistence for sample posts
const LIKE_KEY = 'aq-sample-likes'

export function getSampleLikes(): Record<string, { liked: boolean; count: number }> {
  try { return JSON.parse(localStorage.getItem(LIKE_KEY) || '{}') } catch { return {} }
}

export function toggleSampleLike(uuid: string, currentCount: number, currentLiked: boolean) {
  const likes = getSampleLikes()
  const newLiked = !currentLiked
  const newCount = newLiked ? currentCount + 1 : currentCount - 1
  likes[uuid] = { liked: newLiked, count: newCount }
  localStorage.setItem(LIKE_KEY, JSON.stringify(likes))
  return { liked: newLiked, count: newCount }
}

export function applySampleLikes(posts: SamplePost[]): SamplePost[] {
  const likes = getSampleLikes()
  return posts.map(p => {
    const saved = likes[p.uuid]
    const base: SamplePost = {
      ...p,
      authorId: p.authorId ?? 0,
      authorRole: p.authorRole ?? 'member',
      commentCount: p.commentCount ?? 0,
    }
    if (saved) return { ...base, isLiked: saved.liked, likeCount: saved.count }
    return base
  })
}

// Adapts a SamplePost into the real Post shape that feed/FeedPostCard.tsx
// (the one real, maintained card component) expects, so the guest-empty-feed
// fallback renders through it instead of a hand-rolled duplicate. Sample
// posts are never persisted rows - `postId`/`uuid` here only need to be
// stable and type-shaped, not real; callers must pass FeedPostCard an
// explicit `savedInitial={false}` and `linkedOpening={null}` for these so it
// never self-fetches saved-state/linked-opening against a fake id.
export function sampleToPost(sp: SamplePost): Post & { authorSchool?: string } {
  return {
    postId: sp.postId,
    uuid: sp.uuid,
    category: sp.category,
    body: sp.body,
    status: sp.status,
    createdAt: sp.createdAt,
    authorId: sp.authorId ?? 0,
    authorUuid: sp.authorUuid,
    authorName: sp.authorName,
    authorAvatar: sp.authorAvatar,
    authorSchool: sp.authorSchool,
    authorRole: sp.authorRole ?? 'member',
    likeCount: sp.likeCount,
    commentCount: sp.commentCount ?? 0,
    isLiked: sp.isLiked,
    images: sp.images?.map((img, i) => ({ blobUrl: img.blobUrl, displayOrder: i })),
    taggedMembers: sp.taggedMembers?.map(t => ({ memberId: 0, uuid: t.uuid, fullName: t.fullName, avatarUrl: t.avatarUrl })),
  }
}
