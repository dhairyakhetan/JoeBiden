# AquaTerra — Brand Voice, Positioning & SEO Content Bible

**Status:** Source of truth for all public-facing SEO/marketing copy.
**Owner:** Brand + SEO content lead. **Last synthesized:** 2026-07-23.
**Downstream:** Content agents rewriting per-page `<title>` / meta description / OG copy
(`frontend/src/lib/metaConfig.ts`), page hero copy, and `frontend/public/llms.txt`.

---

## 0. How to read this document (read first)

This file was synthesized from **two** kinds of input, and the difference matters:

1. **Nine internal strategy documents** (`AQ Content dump/*.md`) — growth plans, operating
   model, revenue streams, customer analysis, market gap, values. **Several are INTERNAL
   and their sensitive content is deliberately excluded from every public-facing section
   below.** See §7 for exactly what was withheld and why.
2. **The live product's existing voice** — `frontend/index.html` head, `useMeta.ts`,
   `lib/metaConfig.ts`, `public/llms.txt`, and the public page components
   (`HomePage`, `AboutPage`, `ProjectsPage`, `OpportunitiesPage`, `RootsPage`, etc.).

**Two voices, one brand — do not confuse them.** The `aq-master-brief.md` describes AquaTerra's
**Instagram** voice: pure Hinglish, lowercase-only, "ngl/lowkey," a hard **"never explain what
AQ is"** rule, and a **ban on describing the org**. That voice is correct *for captions and reels*.
It is **wrong for SEO copy**, whose entire job is the opposite: to be discoverable, to name the
org, the place, and what it does, so a crawler and a searching parent/student can find it. The
**public web voice** — the one this document governs — is the live site's register: still bold,
still warm, still lowercase-leaning and specific, but it **does** state plainly that AquaTerra is a
student-led NGO in Kolkata. When downstream agents pull tone from the master brief, keep the
*attitude* (specific, self-aware, un-preachy, proof-first) and drop the *concealment* rules.

---

## 1. Voice & Tone Guide

### 1.1 Core personality (5 adjectives)

1. **Self-aware & chaotic-good** — "started in Kolkata. got out of hand." We admit we're a slightly
   unhinged group of teenagers who somehow ship real work. We never pretend to be a polished institution.
2. **Proof-first (specific over abstract)** — every claim carries a name, a number, a place, or a date.
   "15,000 bananas," "16 students, a WhatsApp group, and a Sundarbans trip with no budget." Abstraction
   is the enemy; a real detail is the brand's fingerprint.
3. **Warm, never preachy** — we lead with the work, not with guilt or inspiration. No "make a
   difference!!" No sunset-quote energy. An open door, not a sales pitch.
4. **Confidently understated** — the flex is casual. We drop "512+ projects" like it's nothing and let
   the reader be impressed on their own. Brutalist confidence: hard borders, bold heads, zero hedging.
5. **Kolkata-rooted & youthful** — the city, the heat, the monsoon, the student-life texture are load-
   bearing. Written by teenagers, for teenagers, in Kolkata. Est. June 2021 and it shows.

### 1.2 Sounds like / never sounds like

| ✅ AquaTerra sounds like | ❌ AquaTerra never sounds like |
|---|---|
| "started in Kolkata. got out of hand." | "AquaTerra is a premier youth organisation dedicated to…" |
| "1,200+ members. 8 departments. still student-run. still Kolkata." | "Join our team and make a difference today! 🌍💚" |
| "profits fund the welfare drives. that's the whole business model." | "Your generous donation empowers underserved communities." |
| "real responsibility from day one. pick a team, apply in two minutes." | "Applications now open! Don't miss this opportunity!!" |
| "self-funded, always — zero donations, zero external funding, since day one." | "We humbly seek your support to continue our noble mission." |
| "16 students, no budget, no experience, and a WhatsApp group." | "Founded by visionary young leaders committed to excellence." |
| "come build with us." / "say hi." | "Get involved in our impactful initiatives and synergies." |
| "students learn best when trusted with real work." | "We provide enriching experiential learning opportunities." |

**Hard don'ts:** exclamation-mark stacking, emoji spam (🌍🌱💚), corporate NGO-speak ("empower,"
"noble mission," "underserved," "synergy," "holistic"), guilt/pity framing of beneficiaries, generic
inspiration, and — for SEO copy specifically — sentences so vague they'd fit any NGO on earth.
The "Real Person Test": if a line has no name, number, place, or date, it isn't ready.

### 1.3 The three (four) typographic registers → voice mapping

The site speaks in layered type. Each register carries a distinct job — content agents writing OG/hero
copy should know which one they're filling:

| Register | Type treatment | Voice job | Examples from live site |
|---|---|---|---|
| **UPPERCASE display head** | `--display`, weight 900, uppercase, tight tracking | The loud, structural statement. The thing you'd shout. | `STUDENT / KOLKATA / NGO.` · `REAL WORK.` · `ROOTS.` |
| **lowercase italic serif accent** | `--serif` (Instrument Serif), italic, colored | The human, emotional beat inside a head — one or two words that soften the shout. | *real impact.* · *chaos* · *values* · *the drives* · *lane* · *hi* |
| **Sentence-case body** | `--eina`, lowercase-leaning | The plain-spoken explanation. Where facts actually live. Short sentences. Punchlines breathe. | "students own execution. not just participation." |
| **mono label / kicker** | `--mono` (JetBrains Mono), uppercase, tracked, often with ★ | The tag, sticker, timestamp, category pill — the scrapbook margin notes. | `★ EST. JUNE 2021` · `SINCE JUNE 2021 · KOLKATA` · `★ the story` |

**For meta copy:** a `<title>` behaves like the **display head** (bold, names the thing, front-loads the
keyword). A meta **description** behaves like **sentence-case body** (plain, specific, one human detail +
the facts). OG titles may borrow the serif-accent trick — the homepage OG title already does:
"AquaTerra | started in Kolkata. got out of hand."

### 1.4 Tone calibration per audience

The web serves several readers at once. Keep the same *personality*; shift the *emphasis*.

| Audience | Their search intent / question | Dial up | Dial down | Register lean |
|---|---|---|---|---|
| **Prospective student volunteers (14–19)** | "is this cool / real / for me?" | FOMO, real member proof, "do real things now," low-friction ("apply in 2 min") | any hint of "school program" or lecture | chaotic-good, lowercase, serif accents |
| **Parents** | "is this safe, legit, worth my kid's time?" | DARPAN registration, "free / zero fees," real skills & leadership, since 2021 | slang, "unhinged," irony that reads as unserious | plain body + credibility kickers |
| **Donors / sponsors** | "is this credible and self-sustaining?" | self-funded model, scale (members, projects), DARPAN, transparency | begging, guilt, "donate now" (we don't take donations — see §7) | confident, factual, understated |
| **School / college / NGO partners** | "can we collaborate, is this organised?" | reach across schools, departments, track record, "open to partnerships" | internal chaos jokes, informality | professional-warm, specific |
| **Press / media** | "what's the story here?" | the contradiction (teenagers running real operations), founding story, named milestones, quotable stats | marketing fluff, unverifiable superlatives | proof-first, quotable, dated |

---

## 2. Positioning & Messaging (PUBLIC)

### 2.1 One-line positioning statement
**AquaTerra is a student-run NGO in Kolkata where teenagers take ownership of real welfare,
climate, and education work — a community where doing real work and having a social life are the
same thing.**

### 2.2 Elevator pitch (≤50 words)
Founded by 16 students in Kolkata in June 2021, AquaTerra is a DARPAN-registered, self-funded NGO
run entirely by teenagers. 1,200+ members run real welfare, climate, and education projects across
eight student-led departments — plus a streetwear label, an education platform, and a marketing
agency. Zero fees, open access.

### 2.3 Core value propositions
1. **Real responsibility, now.** You don't wait for college or a job to do meaningful work — a class-10
   student can be managing logistics for a Sundarbans relief drive within months.
2. **Learning by doing, not by watching.** Execution skills, communication, ownership — gained through
   actual projects with actual stakes, not worksheets or simulations.
3. **Social life *and* impact, not a trade-off.** It's built to be fun and social first; the impact and
   the skills come *because* people keep showing up, not despite it.
4. **A real ecosystem, not a single activity.** NGO welfare work + ROOTS (streetwear) + ShikshAQ
   (education platform) + AQ.Ventures (marketing agency) + Paradox (fest) — many places to build.
5. **Legit and self-sustaining.** DARPAN-registered, self-funded since day one, zero donations, zero
   fees to join.

### 2.4 Differentiators — the real market-gap argument
Pulled from `AquaTerra_Market_Gap.md`. AquaTerra isn't "another volunteering option" — it fills a
**structural gap** for 14–19-year-olds in Kolkata and positions as a **new category**:

- **vs. traditional / student-led NGOs:** those are impact-first but low-engagement, and give younger
  members little real ownership — participation becomes inconsistent and résumé-driven. AquaTerra makes
  ownership the point and keeps it social.
- **vs. school clubs:** those are structured, institution-controlled, and leave almost no room for
  independent execution or real decision-making. AquaTerra is student-*run*, not student-*supervised*.
- **The gap it closes:** everywhere else, "being productive" and "hanging out with friends" are separate.
  AquaTerra is the category where **social life, ownership, learning, and real impact coexist** — it
  converts idle time + social energy into structured impact + learning.

**Public framing rule:** we say "impact + community + real ownership." We do **not** publicly say
"impact is a byproduct" or "built for students first" (the honest internal framing in
`AquaTerra_Customers.md`) — that's true internally but reads cynically in public. See §7.

---

## 3. Canonical Facts Sheet — ACCURACY IS NON-NEGOTIABLE

This is a real, registered NGO. **Never invent, round up, or "improve" a number.** Where sources
conflict, BOTH numbers are shown and the conflict is flagged — a downstream agent must pick using the
"VERDICT" column, and treat every **NEEDS HUMAN CONFIRMATION** as blocking for that specific stat.

### 3.1 Identity & registration

| Fact | Value | Sources | Verdict |
|---|---|---|---|
| Founded | **11 June 2021** (Instagram launch) | Journey doc, AboutPage, llms.txt | ✅ USE. "Founded June 2021" / "student-run since 2021." |
| Founding size | **16 students** | Journey doc, AboutPage | ✅ USE. |
| Location | **Kolkata, West Bengal, India** | all sources | ✅ USE. |
| Registration | **DARPAN, Reg. No. AAFTT2300ME20251** (NITI Aayog, Govt. of India) | master brief, llms.txt, index.html, AboutPage | ✅ USE the reg number verbatim. |
| "certified" vs "registered" | site uses both | AboutPage says both "certified" and "registered" | ⚠️ PREFER **"DARPAN-registered"** (technically accurate — DARPAN is a registration portal, not a certification). "DARPAN certified" is acceptable brand shorthand already live, but registered is safer for press/parents. |
| Founders (named, public) | **Krish Goenka** (Founder), **Kanishk Agarwal** (Co-founder) | index.html JSON-LD | ✅ Public via structured data. Note AboutPage keeps founders anonymous ("the founders, June 2021"); either is fine — don't invent bios beyond the JSON-LD. |
| Funding model | **Self-funded; zero donations; zero external funding; free to join (zero fees)** | Revenue doc, AboutPage, SupportPage, llms.txt | ✅ USE the *fact*. Do NOT publish the revenue *mechanism* (event/ROOTS split) — see §7. |

### 3.2 Scale & impact stats — **the conflict table**

| Metric | Candidate values (with source) | VERDICT |
|---|---|---|
| **Active members** | 850+ (master brief, growth plan — Mar 2025) · ~1,100 (Journey/Operating model, 2025) · **1,200+** (live site: index.html, AboutPage, metaConfig, llms.txt, 2026) | ⚠️ **USE 1,200+** for current public copy (site-wide consistent; plausible growth 850→1,100→1,200+). NOTE: the strategy docs only explicitly support up to **~1,100 (2025)**; "1,200+" is site-asserted for 2026 and not corroborated in the docs. Safe to use because the whole live site already commits to it — but flag if a human wants a doc-backed number, use "1,100+". Always pair with **ages 14–19**. |
| **Projects / drives completed** | 450+ (index.html JSON-LD `Dataset`) · **512+** (master brief, growth plan, metaConfig, AboutPage body) · 534+ (AboutPage hero + marquee) · 500+ ("milestone," Journey 2025) | ⚠️ **NEEDS HUMAN CONFIRMATION — 512 vs 534.** The strategy docs clearly support **512+** (two docs). **534+** appears only on the live site hero/marquee (likely a newer count). **450+** in the JSON-LD `Dataset` is stale and should be retired regardless. RECOMMEND: standardize on **512+** unless a human confirms 534+ is the current true count; then use 534+ everywhere and delete 450+/512+ mismatches. Do NOT ship three different numbers across the site. |
| **Kids reached (workshops)** | 3,500+ (all sources agree) | ✅ USE **3,500+ children reached in educational workshops.** |
| **Saplings / trees planted** | 4,000+ (all sources agree) | ✅ USE **4,000+ saplings planted.** |
| **Medical checkups** | 1,600+ (master brief, llms.txt, index.html) | ✅ USE **1,600+ medical checkups** (Sundarbans). |
| **Bananas distributed** | **15,000+ bananas** (master brief, llms.txt, index.html JSON-LD, AboutPage) | ✅ USE **"15,000+ bananas distributed."** ⚠️ It is **bananas, NOT "meals."** If any surface says "15,000+ meals served," that is an error — correct it to bananas. (The brand even jokes "not a typo.") |
| **Stray dogs fed** | 1,500+ (master brief) · 1,200+ (index.html JSON-LD) | ⚠️ **NEEDS HUMAN CONFIRMATION — 1,200 vs 1,500.** Strategy doc says 1,500+; live JSON-LD says 1,200+. Pick one; don't publish both. |
| **Clothes distributed / recycled** | 2,500+ kg (master brief) · 950+ kg (index.html JSON-LD) | ⚠️ **NEEDS HUMAN CONFIRMATION — 950 vs 2,500 kg.** Large discrepancy; do not publish until confirmed. |
| **Sundarbans relief trips** | 8 trips (master brief, llms.txt), most recent Dec 2025 | ✅ USE **8 Sundarbans relief trips** (most recent Dec 2025). |
| **"Campaigns and projects"** | 500+ (master brief, separate line from "512+ projects") | ⚠️ Likely double-counts the projects figure. Do NOT publish "500+ campaigns" as a *separate* stat alongside "512+ projects" — reads as inflation. NEEDS HUMAN CONFIRMATION whether these are distinct. |

### 3.3 Structure & sub-brands

| Fact | Value | Verdict |
|---|---|---|
| **Departments** | Live site + llms.txt say **"8 departments"** and enumerate: Events, Welfare, Social Media, Collabs, ROOTS, AQ.Ventures, ShikshAQ, Human Resources. | ⚠️ Framing note, not a hard error. `AquaTerra_Operating_Model.md` groups the 3 ventures (ROOTS/AQ.Ventures/ShikshAQ) under one **"Startups"** umbrella → internally it's ~6 depts + 3 ventures + a Finance director (no dept). The public "8 departments" is defensible if ventures count as departments. **USE the llms.txt enumeration of 8** for consistency; don't invent a 9th. |
| **ROOTS** | Student-run streetwear label; profits fund welfare drives. IG `@roots.aquaterra`. | ✅ Public. |
| **ShikshAQ** | Student-built tuition/education discovery platform; launched 2026. IG `@shikshaq.in`. | ✅ Public. |
| **AQ.Ventures** | Free marketing agency built by members for student businesses. IG `@ventures.aquaterra`. | ✅ Public. (Currently non-revenue — that detail is internal; §7.) |
| **Paradox** | Annual student-led competitive fest (sport/business/creative/cultural). Proceeds fund welfare. **Paradox 2026** is the upcoming edition (own sub-app). | ✅ Public. ⚠️ See date conflict below. |
| **Paradox 3.0 date & scale** | June **2025**, 300 attendees (master brief) · card on AboutPage says "300 attendees · **Jun 2024** · ₹1L+" | ⚠️ **NEEDS HUMAN CONFIRMATION — Jun 2024 vs Jun 2025.** Attendee count (300) agrees; the year conflicts. Don't cite the year publicly until confirmed. |
| Other events | Disco Diwali (1.0 Oct 2024, 2.0 Oct 2025), The Starry Night(s) (Dec 2024 Christmas carnival). Both 2024 fundraisers crossed 6-digit INR revenue. | ✅ Names + months are safe; the *revenue* figure is borderline-internal — "crossed six figures" is OK to imply scale, but don't publish exact fundraiser P&L. |

### 3.4 Links & handles

| Channel | Value | Verdict |
|---|---|---|
| Canonical domain | https://www.ngoaquaterra.com | ✅ |
| Instagram (main) | https://www.instagram.com/ngo.aquaterra/ | ✅ USE. |
| **LinkedIn** | `in.linkedin.com/company/aquaterrango` (llms.txt + index.html agree) vs `linkedin.com/company/ngo-aquaterra` (flagged alternate) | ⚠️ **NEEDS HUMAN CONFIRMATION.** The code is internally consistent on **`aquaterrango`**, so use that if forced — but a second slug (`ngo-aquaterra`) is in circulation. Confirm which is the real live company page before publishing/linking; a dead LinkedIn URL in structured data hurts trust. |
| Email | ngo.aquaterra@gmail.com | ✅ (already public in JSON-LD). |
| Instagram followers/post counts | 3,222 followers / 323 posts (master brief) | ❌ INTERNAL & stale — never publish as a stat. |

---

## 4. SEO Keyword Themes

**No keyword-tool access.** I have no Search Console, Ahrefs, or Keyword Planner data in this
environment, so **there are no search-volume, difficulty, or CPC numbers here and none should be
invented.** These clusters are derived from what the strategy/customer docs say the audience actually
searches for and cares about, plus the existing `<meta name="keywords">` and `metaConfig` themes.
Treat them as *topic targets to validate*, not as ranked keywords.

**Audience-search reality (from the docs):** the primary audience is students 14–19 (skew grades 9–12)
in Kolkata; their stated motivations are **CV/profile-building, social life, and skill-building**
(`AquaTerra_Customers.md`). Parents and partners search for **legitimacy** signals. So the keyword
strategy must serve both "cool student thing" intent and "is this legit" intent.

### 4.1 Primary topic clusters
1. **Student volunteering / NGO in Kolkata** — the core geo + category cluster.
2. **Youth / teen-led organisations in India** — "NGO for teenagers," "student-run NGO."
3. **Student leadership & real-world skills** — "leadership opportunities for students," "extracurriculars
   class 9–12," "profile / CV building for school students."
4. **Specific programs** — ROOTS (student streetwear), ShikshAQ (tuition/education platform), AQ.Ventures
   (student marketing agency), Paradox (student fest Kolkata).
5. **Cause / project themes** — Sundarbans relief, tree plantation drives, stray-animal welfare,
   educational workshops for underprivileged children, environmental/climate action Kolkata.

### 4.2 Grouped by search intent

**Informational** (blog, about, projects, faq, teams, schools, classes):
- "student volunteering Kolkata", "student-run NGO Kolkata", "NGO for teenagers India",
  "youth-led NGO Kolkata", "how do students do volunteer work in Kolkata",
  "extracurricular activities for class 9–12 Kolkata", "student leadership opportunities India",
  "Sundarbans relief work", "tree plantation drive Kolkata", "environmental NGO Kolkata",
  "how to build your CV/profile as a student".

**Navigational** (home, roots, and brand-name captures):
- "AquaTerra", "NGO AquaTerra", "ngo.aquaterra", "AquaTerra Kolkata", "ROOTS AquaTerra",
  "ShikshAQ", "AQ.Ventures", "Paradox fest Kolkata", "AquaTerra Sundarbans".

**Transactional / action** (opportunities, volunteer, contact, support, collaborations, paradox register):
- "join student NGO Kolkata", "volunteer opportunities for students Kolkata",
  "how to join AquaTerra", "student internship NGO Kolkata", "student community to join Kolkata",
  "NGO partnership Kolkata schools", "Paradox 2026 register/tickets", "student streetwear India" (ROOTS).

**On-page keyword hygiene (from `aq-master-brief.md` §Algorithm + existing meta):** naturally weave
"Kolkata NGO," "student volunteers," "teen-led," "Sundarbans relief," "youth community" into copy —
front-load the geo + category in titles, keep descriptions ~150–160 chars, one real detail per
description, never keyword-stuff.

---

## 5. Per-Page Content Brief Table

One row per public route. This is the hand-off spec — each content agent expands its row into the actual
`<title>` / description / OG copy. **Primary audience** drives the tone dial (§1.4); **keyword theme**
drives the title's front-loaded phrase; **emotional / CTA note** drives the description's human beat.
All facts must obey §3 (respect every ⚠️ flag).

| Route | Page purpose | Primary audience | Target keyword theme | Emotional / CTA note |
|---|---|---|---|---|
| `/` | The front door — what AquaTerra is, live feed, the ecosystem at a glance | Prospective students (parents secondary) | "student-led community / NGO Kolkata" (navigational + informational) | Curiosity + FOMO: "started in Kolkata, got out of hand." Soft "join the chaos" — never hard-sell. |
| `/about` | The origin story, the model, the milestones, DARPAN legitimacy | Students + parents + press | "youth leadership / student-run NGO story Kolkata" (informational) | Pride without preaching: 16 students → 1,200+, "students learn best when trusted with real work." Legitimacy for parents (DARPAN, self-funded). |
| `/projects` | The proof — every welfare/climate/education drive since 2021 | Students, donors, partners, press | "student-led projects / welfare drives Kolkata" (informational) | Volume-as-flex: 512+ (⚠️ confirm vs 534) drives, real photos, "real execution, real impact." |
| `/blog` | Student stories, project recaps, youth-leadership writing | Students + press (SEO long-tail) | "student stories / youth leadership insights Kolkata" (informational) | First-person, specific, human. The place curiosity gets satisfied. |
| `/teams` | The eight student-led departments and what each runs | Prospective students choosing a lane; partners | "student-led teams / departments Kolkata NGO" (informational) | "find where you fit." Show real responsibility per department. |
| `/opportunities` | Open roles + general application; the front of the funnel | Prospective students (14–19) | "student opportunities / volunteering Kolkata" (transactional) | Low-friction, high-agency: "real responsibility from day one. apply in two minutes." Open door, not a pitch. |
| `/members` | The people — student leaders running real work | Prospective students (aspiration) + press | "student leaders / community members Kolkata" (informational/navigational) | Identity aspiration: "these are people my age doing real things." |
| `/contact` | Partnerships, collabs, general inquiries | Partners, press, parents | "contact AquaTerra / partnerships Kolkata" (transactional/navigational) | Human + open: "say hi. we read everything." No corporate contact-form coldness. |
| `/faq` | Answers about joining, membership, how the work happens | Prospective students + parents | "how to join AquaTerra / membership FAQ" (informational/transactional) | Reassuring, plain-spoken, honest. Parents' legitimacy questions answered here. |
| `/support` | Ways to support the work (note: NOT donations) | Donors, partners, well-wishers | "support student-led NGO Kolkata" (transactional) | Honest about the model: self-funded, no donations — support = ROOTS, partnerships, spreading the word. Never beg. |
| `/collaborations` | School / college / NGO partnership pitch | School & NGO partners | "NGO collaborations / school partnerships Kolkata" (transactional) | Professional-warm, organised, "open to partnerships." Credibility forward. |
| `/volunteer` | The volunteer handbook — how membership actually works | Prospective + new students | "volunteer handbook / join student NGO Kolkata" (transactional/informational) | Practical + inviting: what you'll do, how you join, what ownership means. |
| `/links` | Hub of key destinations (linktree-style) | Existing + prospective students | "AquaTerra quick links" (navigational) | Utility page — clear, functional, low personality. |
| `/schools` | The campus network / school map | Students (find their school), school partners | "AquaTerra schools network Kolkata" (informational/navigational) | "bring AQ to your campus." Belonging + expansion. Thin internal links — worth strengthening. |
| `/classes` | Class cohorts / student-teaching-students learning programs | Students, parents | "student learning cohorts / classes AquaTerra" (informational) | "students teaching students." Peer-learning warmth. Near-orphan route — needs internal links. |
| `/roots` | The ROOTS streetwear label; every purchase funds a drive | Students (buyers) + supporters | "ROOTS student streetwear India / AquaTerra merch" (transactional/navigational) | "every fit funds a drive. profits fund the welfare — that's the whole business model." Product + purpose, no guilt. |

---

## 6. Voice quick-reference (for the content agents' muscle memory)

- **Front-load the keyword + geo in every `<title>`;** keep the AquaTerra brand and a human hook.
  Live pattern: `"[What it is] | [angle] · AquaTerra"` — e.g. `"ROOTS | Student-Run Streetwear · AquaTerra"`.
- **Descriptions: one real detail + the facts, ~150–160 chars, sentence case,** lowercase-leaning is fine.
- **Numbers are the brand.** Use §3 values exactly; never round up; never publish a flagged stat unconfirmed.
- **Lowercase for warmth, UPPERCASE for the shout, italic serif for the human beat, mono for the tag.**
- **CTA ceiling:** "come build with us," "join the chaos," "apply in two minutes," "say hi." Never
  "JOIN NOW!!" or "Donate today."
- **Kill on sight:** "empower," "noble mission," "underserved," "make a difference," emoji spam, and any
  sentence that would fit any NGO on earth.

---

## 7. INTERNAL — deliberately kept OUT of public messaging

The following came from the strategy docs and is **true and useful internally but must never leak into
public meta tags, hero copy, or `llms.txt`.** Downstream content agents: do not surface any of this.

1. **Revenue mechanics** (`AquaTerra_Revenue_Streams.md`): the ~90% events / ~10% ROOTS split; the
   ~80% ticket / ~20% sponsorship breakdown; exact fundraiser P&L. **Public message is only the outcome:**
   "self-funded, zero donations." Never the money machine.
2. **Operating model / org chart** (`AquaTerra_Operating_Model.md`): Exec Board (~10) ⊂ Core (30–40) ⊂
   Team AQ (150–200) ⊂ Community (~1,100); decision/approval flow; WhatsApp group infrastructure; welfare-
   points redemption; certificate-type mechanics. (Certificates *as a member benefit* are fine to mention;
   the internal issuance system is not.)
3. **Strategic-layer candor** (`AquaTerra_Strategic_Layer.md`): "unfair advantage," the **FOMO / herd-
   effect** engineering, "socially acceptable justification ('I'm doing something productive')," and —
   critically — the **self-identified weaknesses** (member activation / high inactivity, thin leadership
   depth, capital constraints, founder dependency). These are candid internal SWOT items; publishing any
   would be self-sabotage.
4. **Customer framing** (`AquaTerra_Customers.md`): that **CV/profile-building is the "primary driver,"**
   that participation is often "resume-driven," and that **"impact is a byproduct… built for students
   first, not for others."** This is honest internal positioning but reads cynically in public. Public copy
   leads with *real impact + ownership + community* and treats the profile/skills benefit as a genuine
   outcome, not the cynical hook.
5. **Instagram content-ops** (`aq-master-brief.md`, `Strategic Growth & Virality Plan`): follower/engagement
   metrics, the algorithm playbook, content calendar, banned-phrase list, quiz/DM-automation tactics, the
   "recruit without recruiting / bury the NGO label" funnel strategy. All internal marketing ops.

**Note on the two proposal/asset files in the dump** (`AquaTerra_Emami_CSR_Proposal_Revised.docx`,
`A4 - 40.pdf`): not parsed for this document; a CSR proposal is by nature a private sponsor document —
treat any figures in it as internal until independently confirmed against §3.

---

*Everything in §§1–6 is cleared for public-facing use subject to the §3 accuracy flags. §7 is internal-
only. When a stat is flagged NEEDS HUMAN CONFIRMATION, that flag is blocking for that stat — leave it out
rather than guess.*
