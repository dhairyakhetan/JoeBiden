# AQ experience brief — the adaptive layer

Given by the user 2026-09-03, in 65 numbered sections. This file is the durable
record of it; it governs the *experience architecture*, and sits alongside
`REDESIGN_GUARDRAILS.md`, which governs the *visual system*. Neither overrides
the other. Where they touch, both must be satisfied.

**Status: audit phase.** §63 and §64 forbid coding this blindly. The existing
architecture audit is being produced first
(`design-audit/redesign-2026-09/10-architecture-audit.md`), then an architecture
proposal, then the smallest coherent layer. Nothing below is built yet.

---

## The thesis (§01, §02, §65)

AQ is not one thing, so a conventional sitemap cannot explain it. The site
should stop being

> user → homepage → about → projects → contact

and become

> person → context → intent → interest → experience state → content selection →
> interface composition → story → next action → new signal → updated experience

**The facts stay fixed. The framing changes.** The goal is not to give every
visitor a different website; it is to make the *same* website capable of telling
the right story to different people. Not "AI-powered" — *a website that pays
attention*.

Different arrivals bring different questions, and must not be forced through one
narrative: a student ("how do I join?"), a collaborator ("what does AQ do?"), a
parent ("is this legitimate?"), a young founder ("can I build something here?"),
a volunteer ("what can I join?"), a donor ("what impact is real?"), and the
merely curious ("what is this?").

## Hard prohibitions (§04, §56, §61)

Never build, and never drift toward:

- `"Hey Kanishk!"`, `"We noticed you like entrepreneurship"`, `"Because you
  viewed 3 projects…"`. **Never expose the tracking.** The intelligence is
  invisible; the user should feel the site is unusually relevant, never watched.
- A generic AI chatbot; an AI-generated homepage per visit; infinite random
  layouts; fake personalisation; an overanimated interface; a generic NGO
  dashboard; AI-written impact claims; automatic redesign of the brand identity;
  unstable navigation; LLM-dependent rendering; SEO-hostile client-only content;
  unnecessary profiling.
- **Never infer sensitive characteristics**: religion, politics, health,
  sexuality, race, ethnicity. Never personalise on them.
- No manipulation of vulnerable users, no psychological pressure, **no fabricated
  social proof, no fake urgency**.
- "If a feature sounds impressive but makes the experience worse: do not build
  it."

## The experience state (§05, §30, §31, §33, §34)

One internal model, never rendered:

```
{ visitorType, primaryIntent, secondaryIntent, interests, journeyStage,
  entryContext, previousInteractions, contentAffinity, familiarity,
  confidence, recency }
```

**Experience modes** are behavioural, NOT navigation tabs: `discover`, `explore`,
`participate`, `build`, `impact`, `community`, `collaborate`, `support`. They
**overlap and are weighted** (`{build: .78, participate: .64, community: .43}`) —
never force a visitor into one box.

**Confidence gates the aggression of adaptation:**

| Confidence | What may change |
|---|---|
| low | nothing. The default experience |
| medium | copy and ordering |
| high | stronger contextual adaptation |
| very high | deeper composition changes |

> "The system should prefer being boring over being confidently wrong."

**Stability (§34).** The UI must not change on every mouse move. Once an
experience is established it stays put; it updates only when new explicit intent
appears, confidence crosses a threshold, the journey stage changes, or the user
resets. *Responsive, not nervous.*

## The content graph (§06, §07, §14, §15, §23, §45)

Content objects carry semantic metadata — projects (`themes, people, geography,
year, impact, media, relatedProjects/Events/People/Initiatives, audience,
narrativeWeight, freshness`), people (`role, ageGroup, initiatives, projects,
quotes, media, themes`), events, initiatives. The site should not merely know
"Quirk is a project" but `Quirk → AQ Labs → student entrepreneurship → hardware
→ student founders → related people → related projects`.

- **People are first-class**, not decorative headshots: person → project →
  initiative → event → story → contribution. A map of people doing things, not
  "meet our team."
- **Stories connect by meaning, not chronology.** Replace "latest posts" with
  "if this interested you," and make the relation real.
- **Media carries context** (event, project, people, location, date, theme).
  **Never invent context for an image** — this doubles the guardrails' existing
  rule that a photo belongs to the row it sits in.
- The metaphor is a **network**, not an org chart.

## Composition (§08–§13, §21, §22, §26, §37, §38, §39, §57)

- **The homepage is a different *emphasis* of the same organisation, never a
  different website.** Same for the hero: the AQ identity is stable, the framing
  and CTA move.
- **Adaptation is page-wide or it is incoherent.** If the hero points at AQ Labs
  and the body shows environmental work, the experience has contradicted itself.
  Adaptive surfaces include the announcement bar, nav emphasis, hero + CTA,
  featured story, metrics, project/initiative ordering, event prominence,
  footer CTA, related content, search suggestions, filters, breadcrumbs, and
  application/contact prompts.
- **Navigation stays learnable.** Emphasis may change; labels and destinations
  may not. Never hide essential navigation. Secondary nav becomes contextual
  (inside AQ Labs: ventures / people / how it works / stories / participate).
- **Content density adapts too** — how much, not only what. First-time visitors
  need context; returning and high-intent visitors need less introduction and
  more action.
- **Scroll is narrative progression**, and the sequence itself can reorder by
  mode (`who → why → what → who's doing it → proof → now → where you fit` vs
  `problem → action → people → impact → evidence → next`).
- **Project pages are alive.** They never end in "back to projects"; they end in
  the next meaningful node, chosen by where the person came from.
- **The footer is not a graveyard** — it is the final handoff, and it is
  contextual.
- **The engine composes only approved components** (Hero, StoryCard, PersonCard,
  ProjectCard, EventCard, Metric, Timeline, Quote, ImageGrid, CTA, Navigation).
  If a new component is needed it is **flagged for approval, never silently
  invented** — this is the same rule as the guardrails' "never invent an icon."
- Components carry behavioural metadata (`purpose, allowedExperiences,
  requiredData, preferredContexts, avoidContexts, priority, density,
  mobileBehaviour, desktopBehaviour, variationRules`), turning the design system
  into a **grammar**: constraints and relationships, not just parts. A component
  may not render where its required data is missing.
- **The renderer is deterministic.** No LLM in the render path. AI is for
  semantic tagging, classification, relationship discovery and editorial
  assistance only.

## Recommendation (§27, §28, §29, §46, §47, §48, §49)

- Every major page decides "what next?", weighing intent + current content +
  history + interest + journey stage + freshness — and **must remain
  explainable**.
- **No filter bubbles.** Roughly **70% relevant / 20% adjacent / 10%
  unexpected**, configurable. Cross-pollination is part of AQ.
- **A serendipity layer with reasons**: "you came for AQ Labs, you might want to
  see what happened in the Sunderbans" — surfaced because both are young people
  solving a real problem, not because a shuffle said so.
- Breadcrumbs follow the *contextual* path, not a corporate hierarchy: the same
  object can be reached as `AQ Labs → student ventures → Quirk` or
  `Stories → student builders → Quirk`.
- **Remember the session** (recently viewed, intent, entry context, search,
  themes, completed actions) so the site stops re-explaining what has been read.
  Returning context is fine; *"welcome back, we saw you visited 17 times"* is
  absolutely not.

## Search (§19, §20)

Search runs on the graph, not on keywords. "students who built things" resolves
to student + building + venture + AQ Labs. Results reorder by intent. **Never
fabricate relevance — every recommendation needs a traceable reason.**

## Entry context and social (§17, §18, §41, §42, §43)

- Social is the **discovery layer**; the site is context, depth, archive and
  action. An Instagram post must land in the contextualised experience, not the
  homepage — that destroys context.
- Ingested social content becomes a **discovery node pointing at** a story /
  project / person / event / initiative. Never a duplicate.
- Entry context (direct, search, Instagram, LinkedIn, WhatsApp, event QR,
  campaign, referral) is a **signal, not a truth** — referrers are not to be
  blindly trusted.
- **Events and campaigns evolve**: before → during → after. Stop asking people to
  participate in something that already happened.

## Impact data (§44)

Do not dump `850+ / 512+ / 3,500+ / 4,000+` into a stats strip and call it
impact. Every number connects to projects, photographs, people, geography and
stories. **The number is evidence, not decoration.** This compounds the
guardrails' rule that a figure without a source renders as a dashed `live`
marker.

## Non-negotiable engineering constraints (§50, §51, §52, §53, §54, §55)

- **Accessibility is not downstream of personalisation.** Every composition keeps
  semantic HTML, heading hierarchy, keyboard navigation, focus states, contrast,
  touch targets, alt text, reduced motion and readable type.
- **Mobile is not desktop-but-narrower.** Every component declares its own mobile
  behaviour; a desktop composition may become a different sequence on mobile.
  Same experience, different physical expression.
- **Performance:** render the stable experience first, resolve context, then
  progressively enhance. Never `LLM request → wait → page`. Cache and precompute.
- **SEO is critical and adaptation must not damage it.** Important content stays
  in crawlable HTML; no fake URLs per variation; no duplicate-content chaos. The
  adaptive layer changes presentation and priority — canonical content stays
  structured. (AquaTerra prerenders 17 static + 576 dynamic routes today; that
  must survive.)
- **Analytics separates inference from fact.** `inferred_interest` is not
  `user_interest`. Explicit actions weigh more than inferred ones.
- **Experiments** measure meaningful engagement, discovery, participation,
  applications, contact and support — **never time-on-site alone.** Someone
  finding what they need in 30 seconds is a better outcome than 8 minutes of
  wandering.

## Tone (§24)

Real young people built something real: texture, personality, photography,
imperfection where appropriate — on top of an extremely disciplined system.
Avoid excessive gradients, random 3D, fake AI aesthetics, childish animation,
corporate "impact" language, motivational quotes, **endless rounded cards**, and
over-designed dashboards.

> **Noted tension, resolved:** the visual brief asks for "rounded vibes" while
> §24 warns against "endless rounded cards." Reading: radius is a *system* (the
> 20/28/40 scale with the 26/18 concentric pair), and the personality comes from
> photography, stickers, real copy and texture — not from rounding everything
> until it reads as a template. Where the two conflict, §24 wins.

## Deliverables owed before implementation (§64)

1 existing architecture audit · 2 current IA · 3 proposed content graph ·
4 content schemas · 5 intent schema · 6 experience state model · 7 experience
profiles · 8 component inventory · 9 component metadata system · 10 design
reference system · 11 guardrail system · 12 recommendation engine ·
13 adaptive composition architecture · 14 social ingestion architecture ·
15 analytics model · 16 debug inspector · 17 SEO strategy · 18 accessibility
strategy · 19 performance strategy · 20 phased roadmap · 21 risks ·
22 what explicitly should NOT be built.

## Phasing (§62)

1 content foundation (models) → 2 content graph (relationships) → 3 intent index
(deterministic) → 4 contextual content (recommendations, ordering, CTAs,
headlines) → 5 experience profiles → 6 composition (controlled reordering) →
7 adaptive UI (component variation) → 8 social integration → 9 experimentation →
10 one-of-one experiences.

## The debug inspector (§35)

Development-only. Shows current experience, weighted intents, entry context,
current content, next recommendation, **the reason**, and confidence. Without
it the system is not debuggable, and per §27 every recommendation must be
explainable anyway.
