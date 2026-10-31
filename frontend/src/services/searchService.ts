import { supabaseCommunity } from '../lib/supabaseCommunity'
// Welfare projects live in the SAME community database as everything else.
// (They used to live in a separate "CMS" Supabase project; since the 2026-07
// consolidation `lib/supabase.ts` is just an `as any`-typed alias of
// `supabaseCommunity`. The alias is kept so existing importers - this file,
// PublicProjectsPage, BlogListPage, ProjectManager - keep working unchanged.)
import { supabase as supabaseWelfare, normalizeObj } from '../lib/supabase'
import { sanitizeFilterTerm } from '../lib/pgrestEscape'
import { withRetry } from '../lib/asyncUtils'
import { withFunctionLogging } from '../lib/functionLog'

export interface SearchPerson {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl?: string
  classGrade?: string
  role: string | null
}

export interface SearchProject {
  uuid: string
  title: string
  description: string
  category: string
  status: string
  coverImageUrl?: string
  memberCount: number
}

export interface SearchTeam {
  uuid: string
  name: string
  description: string
  category: string
  logoUrl?: string
  memberCount: number
}

export interface SearchSchool {
  uuid: string
  name: string
  shortName?: string
  logoUrl?: string
  location?: string
  memberCount: number
}

export interface SearchPost {
  postId: number
  uuid: string
  body: string
  authorName: string
  authorUuid: string
  createdAt: string
  category: string
  likeCount: number
  commentCount: number
  images: { url?: string; blobUrl?: string; displayOrder?: number }[]
}

// redesign 08.2's fifth result kind ("opening", verb "Apply"). Not mirrored
// into `posts` the way welfare_projects/blogs are (jobOpenings.ts's own
// `linkedOpening` batch matches a post to its opening by post uuid, but that
// only covers openings that were announced via a post - an opening created
// without one was previously unsearchable). This is a NEW branch on an
// EXISTING, already-publicly-read table (job_openings; see lib/jobOpenings.ts)
// - read-only, additive, no schema change.
export interface SearchOpening {
  id: string
  title: string
  description: string
  category: string
  teamName?: string
}

// `class_grade` is stored as free-text on `members` (no normalised
// classes table exists). Class search derives buckets by grouping
// matching `class_grade` values client-side and surfacing each as a
// SearchClass row with a member count.
export interface SearchClass {
  /** Doubles as both stable key and display name - class_grade string. */
  uuid: string
  name: string
  memberCount: number
}

export interface SearchResults {
  people: SearchPerson[]
  projects: SearchProject[]
  teams: SearchTeam[]
  schools: SearchSchool[]
  classes: SearchClass[]
  posts: SearchPost[]
  openings: SearchOpening[]
}

export interface SearchResponse {
  success: boolean
  data: {
    query: string
    type: string
    totalCount: number
    results: SearchResults
  }
  // Per-branch failure messages, e.g. "people: permission denied". Present
  // whenever any branch errored - even alongside success:true, since other
  // branches may have returned real data. SearchPage surfaces this instead
  // of showing a confident zero-result page for what was actually an outage.
  errors?: string[]
}

export interface QuickSearchSuggestion {
  uuid: string
  name: string
  type: 'person' | 'project' | 'team'
  image?: string
}

export interface QuickSearchResponse {
  success: boolean
  data: {
    suggestions: QuickSearchSuggestion[]
  }
}

// redesign 08.1's category browse discs and 08.3's "when" filter. Both are
// facets layered onto the existing branches below, never a new table/RPC:
//   - `category` narrows to ONE of the live 5-value vocabulary
//     (lib/categories.ts CATEGORY_SLUGS) and only applies to `posts` -
//     `welfare_projects.objective` (the "projects"/drive branch's own
//     category-ish field) is free text normalised client-side by
//     `normalizeObj`, NOT the same 5-slug enum, so it is deliberately left
//     unfiltered here rather than guessing a mapping between the two.
//   - `when` narrows by date and applies to both `posts` (created_at) and
//     `projects` (workshop_date), since both already carry a real date column.
export interface SearchOpts {
  category?: string
  when?: 'anytime' | 'year' | 'month'
}

function sinceIso(when: SearchOpts['when']): string | null {
  if (!when || when === 'anytime') return null
  const d = new Date()
  if (when === 'year') d.setFullYear(d.getFullYear() - 1)
  else d.setMonth(d.getMonth() - 1)
  return d.toISOString()
}

async function runSearch(query: string, type: string, limit: number, opts: SearchOpts = {}): Promise<SearchResponse> {
  const results: SearchResults = {
    people: [],
    projects: [],
    teams: [],
    schools: [],
    classes: [],
    posts: [],
    openings: [],
  }
  const errors: string[] = []
  let totalCount = 0

  // Strip PostgREST filter metacharacters before interpolating into
  // .ilike / .or filters. `%` and `_` are LIKE wildcards; `,` and `()`
  // are how .or() delimits + groups its filter list - an unescaped one
  // produces a malformed filter and 400s the request, and because all
  // branches run in one Promise.all a single bad branch rejects the
  // whole search. (Same guard directorService/MembersPage apply - shared
  // helper in lib/pgrestEscape.ts, which also strips backslashes.)
  const q = sanitizeFilterTerm(query)
  // A category/when facet with no text term is 08.1's "browse" mode (the
  // disc grid before anyone types anything) - still a real, single-branch
  // query, just without an .ilike term. Only bail out empty when there is
  // truly nothing to search FOR.
  const browsing = Boolean(opts.category || opts.when)
  if (!q && !browsing) {
    return { success: true, data: { query, type, totalCount: 0, results } }
  }
  const since = sinceIso(opts.when)

  // Phase 4/5 mirror every published welfare_projects (and job_openings) row
  // into `posts`, so a term matching a project's header would match BOTH the
  // direct welfare_projects search below AND its own mirrored post - the same
  // drive twice. Exclude welfare-project mirrors from the posts branch via the
  // view's own `source_type` column (one filter) - the "projects" branch
  // already shows that content richer. Job-opening mirrors and native posts
  // still search normally.
  //
  // Blogs are NOT mirrors any more. The 4.2 fold (2026-09-12) made them
  // ordinary `posts` rows with source_kind='blog', retired the `blogs` table
  // and deleted mirror_blog_to_post, so there is no second row to de-duplicate
  // against - they search exactly like a native post, with the article text
  // included (see the .or below).
  //
  // NOTE: this replaces an earlier approach that pre-fetched every mirror
  // post's uuid and passed them as a `NOT IN (…)` list - with 500+ welfare
  // projects that built a ~20 KB query string that overflowed the request
  // URL limit and silently failed the entire posts search. `source_type` is
  // O(1) on the URL and correct.

  const queries: PromiseLike<void>[] = []

  // People/classes/teams/schools have no `category`/`when` facet (no column
  // that maps cleanly onto either - see the SearchOpts comment above), so
  // they stay text-search-only and simply sit out a category/when browse.
  if ((type === 'all' || type === 'people') && q) {
    queries.push(
      supabaseCommunity.from('members')
        // No email/phone — this ships to every logged-in searcher; member
        // contact PII must not leak through people-search (see H3/audit).
        .select('member_id, uuid, full_name, avatar_url, class_grade, role')
        .eq('status', 'active')
        // Match name OR class_grade so "Class 11" / "Grade 10" surfaces
        // members in that grade - supports the class-card click-through.
        .or(`full_name.ilike.%${q}%,class_grade.ilike.%${q}%`)
        .limit(limit)
        .then(({ data, error }) => {
          if (error) { errors.push(`people: ${error.message}`); return }
          if (data) {
            results.people = data.map(m => ({
              memberId: m.member_id,
              uuid: m.uuid,
              fullName: m.full_name,
              avatarUrl: m.avatar_url ?? undefined,
              classGrade: m.class_grade ?? undefined,
              role: m.role
            }))
            totalCount += data.length
          }
        })
    )
  }

  // Class search - `members.class_grade` is free-text (no `classes` table
  // exists). Derive class buckets by fetching matching grades and grouping
  // client-side, then surface each as a SearchClass row with a count.
  if ((type === 'all' || type === 'classes') && q) {
    queries.push(
      supabaseCommunity.from('members')
        .select('class_grade')
        .eq('status', 'active')
        .not('class_grade', 'is', null)
        .ilike('class_grade', `%${q}%`)
        .limit(500)
        .then(({ data, error }) => {
          if (error) { errors.push(`classes: ${error.message}`); return }
          if (!data) return
          const counts = new Map<string, number>()
          for (const row of data) {
            const grade = (row as any).class_grade as string | null
            if (!grade) continue
            counts.set(grade, (counts.get(grade) ?? 0) + 1)
          }
          results.classes = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([name, memberCount]) => ({ uuid: name, name, memberCount }))
          totalCount += results.classes.length
        })
    )
  }

  if ((type === 'all' || type === 'teams') && q) {
    queries.push(
      supabaseCommunity.from('teams')
        // team_members(count) - same embedded-count pattern teamService uses
        // for real rosters, replacing the old hardcoded memberCount: 0.
        .select('uuid, name, description, category, logo_url, team_members(count)')
        .eq('is_active', true)
        // Roster count excludes soft-removed members, matching teamService.
        .eq('team_members.is_active', true)
        .ilike('name', `%${q}%`)
        .limit(limit)
        .then(({ data, error }) => {
          if (error) { errors.push(`teams: ${error.message}`); return }
          if (data) {
            results.teams = data.map((t: any) => ({
              uuid: t.uuid,
              name: t.name,
              description: t.description ?? '',
              category: t.category,
              logoUrl: t.logo_url ?? undefined,
              memberCount: t.team_members?.[0]?.count || 0,
            }))
            totalCount += data.length
          }
        })
    )
  }

  if ((type === 'all' || type === 'schools') && q) {
    queries.push(
      supabaseCommunity.from('schools')
        // NOT `members(count)`: tried the same embedded-count pattern as
        // teams, live-tested it, and it 42501s - "permission denied for
        // table members" - even for a query that only counts. The PII-lockdown
        // grant on `members` only covers direct/explicit-column selects
        // (what MembersPage does), not a `count(*)` aggregate reached via a
        // reverse FK embed from another table. Real fix is a grant change or
        // an RPC; until then keep the old (honest, if unhelpful) 0 rather
        // than a query that fails outright for every school search.
        .select('uuid, name, short_name, logo_url, location')
        .ilike('name', `%${q}%`)
        .limit(limit)
        .then(({ data, error }) => {
          if (error) { errors.push(`schools: ${error.message}`); return }
          if (data) {
            results.schools = data.map((s: any) => ({
              uuid: s.uuid,
              name: s.name,
              shortName: s.short_name ?? undefined,
              logoUrl: s.logo_url ?? undefined,
              location: s.location ?? undefined,
              memberCount: 0,
            }))
            totalCount += data.length
          }
        })
    )
  }

  if ((type === 'all' || type === 'posts') && (q || browsing)) {
    let postsQuery = supabaseCommunity.from('post_feed_view')
      .select('post_id,uuid,body,author_name,author_uuid,created_at,category,like_count,comment_count,images')
      .eq('status', 'published')
    // Exclude welfare-project mirrors only when the 'projects' branch below
    // is ALSO running (type === 'all') - they'd otherwise show up twice,
    // once here and once "shown richer under projects". A caller asking for
    // type === 'posts' specifically gets nothing else back at all, so
    // excluding welfare mirrors here left PublicProjectsPage's own search
    // bar (which searches exactly this content, calling type: 'posts')
    // matching zero rows for every query - "no posts match your search" on
    // a query that plainly had a matching drive in the unfiltered grid.
    // `.neq` alone would drop NULLs, so OR in the null case.
    if (type === 'all') postsQuery = postsQuery.or('source_type.is.null,source_type.neq.welfare_project')
    // Match the post body OR its author's name, so searching a member
    // surfaces their posts too, not just their profile. Skipped entirely in
    // pure browse mode (a disc tap with no typed query) - an empty %% ilike
    // would match every row and make the category filter pointless.
    // `article_body` as well as `body`. After the 4.2 fold a blog's `body` is
    // the ~630-character generated feed excerpt, so a phrase 3,000 characters
    // into an essay was unfindable even though the essay is a row in the same
    // table (33 essays, averaging 2,969 characters). The column is exposed on
    // post_feed_view for exactly this filter and is NOT in any select list -
    // PostgREST lets a filter reference a column the query does not select, so
    // the feed still ships only the excerpt.
    if (q) postsQuery = postsQuery.or(`body.ilike.%${q}%,article_body.ilike.%${q}%,author_name.ilike.%${q}%`)
    // 08.1's disc browse: `posts.category` is the real 5-value column
    // (director_categories/posts_category_check - lib/categories.ts).
    if (opts.category) postsQuery = postsQuery.eq('category', opts.category)
    if (since) postsQuery = postsQuery.gte('created_at', since)
    queries.push(
      postsQuery
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data, error }) => {
          if (error) { errors.push(`posts: ${error.message}`); return }
          if (data) {
            results.posts = data.map((p: any) => ({
              postId: p.post_id,
              uuid: p.uuid,
              body: p.body,
              authorName: p.author_name,
              authorUuid: p.author_uuid,
              createdAt: p.created_at,
              category: p.category,
              likeCount: p.like_count || 0,
              commentCount: p.comment_count || 0,
              images: p.images || [],
            }))
            totalCount += data.length
          }
        })
    )
  }

  // Welfare projects search - uses the LEGACY welfare Supabase project
  // (welfare_projects table) since that's where the public-facing
  // projects already live. Slug is used as the linkable id because
  // /projects/:slug is how PublicProjectsPage routes them. No `category`
  // facet here (see the SearchOpts comment above) - only `q` and `when`
  // (workshop_date is a real column, so a date-range browse is honest).
  if ((type === 'all' || type === 'projects') && (q || since)) {
    let projectsQuery = supabaseWelfare.from('welfare_projects')
      .select('id, slug, header, objective, main_image, workshop_date')
      .eq('is_draft', false)
    if (q) projectsQuery = projectsQuery.or(`header.ilike.%${q}%,objective.ilike.%${q}%`)
    if (since) projectsQuery = projectsQuery.gte('workshop_date', since)
    queries.push(
      projectsQuery
        .order('workshop_date', { ascending: false })
        .limit(limit)
        .then(({ data, error }: any) => {
          if (error) { errors.push(`projects: ${error.message}`); return }
          if (data) {
            results.projects = data.map((p: any) => ({
              uuid: p.slug,
              title: p.header,
              description: p.objective ?? '',
              // `objective` on live data is a free-ish text field, not the
              // clean OBJECTIVES enum - normalizeObj buckets it into a short
              // Title Case label instead of dumping a raw sentence into the
              // card's uppercase mono eyebrow.
              category: normalizeObj(p.objective),
              status: 'active',
              coverImageUrl: p.main_image ?? undefined,
              memberCount: 0,
            }))
            totalCount += data.length
          }
        })
    )
  }

  // Open roles - a NEW branch on an existing, already-publicly-readable
  // table (see lib/jobOpenings.ts's own public listing query). Answers 08's
  // Unresolved #6 ("are openings searchable?") - they were not, before this.
  // Text-search only, same as teams/schools: no category/when facet.
  if ((type === 'all' || type === 'openings') && q) {
    queries.push(
      supabaseCommunity.from('job_openings')
        .select('id, title, description, category, team_name')
        .eq('status', 'open')
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(limit)
        .then(({ data, error }) => {
          if (error) { errors.push(`openings: ${error.message}`); return }
          if (data) {
            results.openings = data.map((o: any) => ({
              id: o.id,
              title: o.title,
              description: o.description ?? '',
              category: o.category,
              teamName: o.team_name ?? undefined,
            }))
            totalCount += data.length
          }
        })
    )
  }

  await Promise.all(queries)

  return {
    success: errors.length === 0,
    data: {
      query,
      type,
      totalCount,
      results
    },
    ...(errors.length > 0 ? { errors } : {}),
  }
}

const searchServiceImpl = {
  async search(query: string, type: string = 'all', limit: number = 10, opts: SearchOpts = {}): Promise<SearchResponse> {
    if (!query && !opts.category && !opts.when) {
      return { success: true, data: { query, type, totalCount: 0, results: { people: [], projects: [], teams: [], schools: [], classes: [], posts: [], openings: [] } } }
    }
    // withRetry re-runs this whole closure (fresh requests, not a re-await of
    // the same hung promises) on a timeout - the cold-load failure mode here
    // is a request that hangs rather than throws. Same wrapper jobOpenings.ts
    // uses for the same reason.
    return withRetry(() => runSearch(query, type, limit, opts))
  },

  async quickSearch(query: string, limit: number = 5): Promise<QuickSearchResponse> {
    const suggestions: QuickSearchSuggestion[] = []

    if (!query) {
      return { success: true, data: { suggestions } }
    }

    // Same metachar strip as search() - keeps LIKE wildcards from
    // corrupting matches on queries containing % or _.
    const q = sanitizeFilterTerm(query)
    if (!q) {
      return { success: true, data: { suggestions } }
    }

    const [peopleRes, teamsRes] = await withRetry(() => Promise.all([
      supabaseCommunity.from('members')
        .select('uuid, full_name, avatar_url')
        // quickSearch used to skip this filter entirely, so pending,
        // rejected and suspended accounts surfaced in the ⌘K suggestion
        // list - a rejected applicant was searchable by name from the nav.
        .eq('status', 'active')
        .ilike('full_name', `%${q}%`)
        .limit(limit),
      supabaseCommunity.from('teams')
        .select('uuid, name, logo_url')
        .ilike('name', `%${q}%`)
        .limit(limit)
    ]))

    if (peopleRes.data) {
      suggestions.push(...peopleRes.data.map(m => ({
        uuid: m.uuid,
        name: m.full_name,
        type: 'person' as const,
        image: m.avatar_url ?? undefined
      })))
    }

    if (teamsRes.data) {
      suggestions.push(...teamsRes.data.map(t => ({
        uuid: t.uuid,
        name: t.name,
        type: 'team' as const,
        image: t.logo_url ?? undefined
      })))
    }

    return {
      success: true,
      data: {
        suggestions: suggestions.slice(0, limit * 2)
      }
    }
  }
}

export const searchService = withFunctionLogging('searchService', searchServiceImpl)

export default searchService
