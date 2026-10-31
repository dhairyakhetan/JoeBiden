// Client-side, keyword-only category suggestion for the composer (03.2.5).
// No model call, no network request, no new dependency - just a map from
// words the member already typed to the category they most likely mean.
//
// Mismatch, reported not guessed: 03.2.5 says "KEEP all six category labels
// and slugs from lib/categories.ts" and "opening the full six", but
// `lib/categories.ts`'s CATEGORY_SLUGS (the live, DB-CHECK-constrained list)
// has exactly FIVE: events, welfare, content, operations, labs. There is no
// sixth category anywhere in the schema or the UI. This module - and the
// chip row that consumes it - works off the real five, not an invented sixth.
import { CATEGORY_SLUGS, type CategorySlug } from '../../lib/categories'

// Seeded from the same five labels/slugs - one keyword list per category,
// covering how a student would actually describe that kind of post.
const KEYWORDS: Record<CategorySlug, string[]> = {
  events: ['event', 'workshop', 'session', 'meetup', 'orientation', 'fest', 'celebration', 'anniversary', 'gathering', 'quiz', 'competition'],
  welfare: ['drive', 'donat', 'volunteer', 'welfare', 'ration', 'blanket', 'meal', 'feed', 'clothes', 'shelter', 'orphanage', 'old age', 'slum', 'medical camp', 'blood'],
  content: ['post', 'reel', 'video', 'design', 'poster', 'caption', 'instagram', 'social media', 'graphic', 'edit', 'content', 'shoot'],
  operations: ['meeting', 'logistics', 'budget', 'plan', 'coordinat', 'sponsor', 'permission', 'vendor', 'admin', 'operations', 'schedule'],
  labs: ['workshop', 'skill', 'training', 'teach', 'class', 'curriculum', 'lab', 'shikshaq', 'lesson', 'tutor'],
}

export interface CategorySuggestion {
  suggested: CategorySlug | null
  /** Up to 2 runner-up categories, for the hairline alternate chips. */
  alternates: CategorySlug[]
}

/** Score every category by how many of its keywords appear in `text`. */
function scoreAll(text: string): Array<{ slug: CategorySlug; score: number }> {
  const t = text.toLowerCase()
  return CATEGORY_SLUGS.map(slug => {
    const hits = KEYWORDS[slug].filter(kw => t.includes(kw)).length
    return { slug, score: hits }
  })
}

export function suggestCategory(text: string): CategorySuggestion {
  const trimmed = (text || '').trim()
  if (trimmed.length < 6) return { suggested: null, alternates: [] }

  const scored = scoreAll(trimmed).filter(s => s.score > 0).sort((a, b) => b.score - a.score)
  if (scored.length === 0) return { suggested: null, alternates: [] }

  const [top, ...rest] = scored
  return {
    suggested: top.slug,
    alternates: rest.slice(0, 2).map(s => s.slug),
  }
}
