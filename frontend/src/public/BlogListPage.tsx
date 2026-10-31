import Img from '../components/Img'
import './BlogListPage.css'
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase, Blog, relativeDate } from '../lib/supabase'
import { BLOG_LIST_FROM_POST_COLS, blogFromPost } from '../lib/blogFromPost'
import { getCached, setCached } from '../lib/swrCache'
import { sized } from '../lib/imageUrl'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd, itemListLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { Reveal, RevealGroup } from '../components/Reveal'

const CARD_COLORS = ['var(--welfare)', 'var(--lemon)', 'var(--pink)', 'var(--sky)', 'var(--welfare)', 'var(--lemon)']
// The six tag chips restyled as stamped stickers (12.1) - the hue classes
// pair 1:1 with CARD_COLORS above (welfare -> mint, lemon -> lemon, pink ->
// pink, sky -> sky) so a tag's colour never disagrees with a card's.
const TAG_STICKER_HUES = ['sticker-mint', 'sticker-lemon', 'sticker-pink', 'sticker-sky', 'sticker-grape', 'sticker-tomato']

// The lead story - a large 2-col cover card for the newest post. Ken-Burns
// hover zoom, a serif-italic headline, and an author row up front.
function LeadStoryCard({ b }: { b: Blog }) {
  const href = b.slug ? `/blog/${b.slug}` : (b.author_url || null)
  const isExternal = !b.slug && !!b.author_url

  const inner = (
    <div className={'card bl-lead' + (b.featured_image ? ' bl-lead--img' : '')} style={{ padding: 0, overflow: 'hidden', cursor: href ? 'pointer' : 'default' }}>
      {b.featured_image && (
        <div className="bl-lead-imgwrap" style={{ position: 'relative', minHeight: 260 }}>
          <Img
            className="bl-lead-img"
            src={sized(b.featured_image, 'cover')}
            alt={b.featured_image_alt || b.headliner}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }}
          />
          <span className="sticker sticker-mint sticker--diecut" style={{ position: 'absolute', top: 14, left: 14, ['--sticker-ground' as string]: 'var(--paper)' }}>★ latest</span>
        </div>
      )}
      {/* Coverless lead. Nine of the twenty-two published essays carry no cover
          image, and on 2026-09-12 the NEWEST one ("White Nights") was among
          them - so the lead card rendered as a plain white block while every
          regular card beneath it got a saturated colour header. The hierarchy
          inverted: the story we were promoting looked like the least important
          thing on the page, and the "★ latest" sticker vanished with the image
          block it lived inside. This is the same colour-band fallback BlogCard
          already uses, at lead scale, so the lead reads as the lead whether or
          not an editor has attached a photo. */}
      {!b.featured_image && (
        <div className="bl-lead-band" style={{ background: CARD_COLORS[0], padding: '16px 18px', borderBottom: 'var(--hair)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span className="sticker sticker-mint sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--paper)' }}>★ latest</span>
          {/* Full ink on the accent fill, not an alpha - same reasoning as
              BlogCard's fallback header below: rgba on --welfare drops under
              the contrast floor. */}
          <span className="mono xs upper" style={{ fontWeight: 700, color: 'var(--ink)' }}>
            groundwork diaries
          </span>
        </div>
      )}
      <div style={{ padding: 'clamp(20px, 4vw, 34px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="mono xs upper" style={{ fontWeight: 700, color: 'var(--welfare-ink)', marginBottom: 10 }}>
          ★ {b.published_date ? relativeDate(b.published_date) : 'fresh off the press'}
          {b.minutes_of_read && ` · ${b.minutes_of_read} min read`}
        </div>
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 'clamp(26px, 4vw, 40px)', lineHeight: 1.02, letterSpacing: '-0.02em', margin: '0 0 14px', color: 'var(--ink)', textWrap: 'balance' } as React.CSSProperties}>
          {b.headliner.split(' ').slice(0, -1).join(' ')}{' '}
          <span className="underline-doodle" style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400 }}>{b.headliner.split(' ').slice(-1)}</span>
        </h2>
        {b.written_by && (
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: 'var(--lemon)', color: 'var(--ink)', flexShrink: 0 }}>
              {b.written_by.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span className="mono xs upper muted" style={{ fontWeight: 700 }}>by {b.written_by}</span>
          </div>
        )}
        {href && (
          <div style={{ marginTop: 18 }}>
            <span className="btn btn-sm btn-primary" style={{ pointerEvents: 'none' }}>read the story {isExternal ? '↗' : '→'}</span>
          </div>
        )}
      </div>
    </div>
  )

  if (!href) return inner
  if (isExternal) return <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{inner}</a>
  return <Link to={href} style={{ textDecoration: 'none' }}>{inner}</Link>
}

function BlogCard({ b, index }: { b: Blog; index: number }) {
  const href = b.slug ? `/blog/${b.slug}` : (b.author_url || null)
  const isExternal = !b.slug && !!b.author_url
  const rot = index % 2 ? 0.8 : -0.8
  const color = CARD_COLORS[index % CARD_COLORS.length]

  const inner = (
    <div className="card card-hover" style={{ padding: 0, overflow: 'hidden', ['--card-rot' as any]: `${rot}deg`, cursor: href ? 'pointer' : 'default' }}>
      {b.featured_image && (
        <div style={{ height: 196, overflow: 'hidden', borderBottom: 'var(--hair)', position: 'relative' }}>
          <Img ctx="card" src={b.featured_image} alt={b.featured_image_alt || b.headliner} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" decoding="async" />
          {/* Editorial index - badge in the card's accent colour. Card-shell
              blanket transform (12.1): hairline + lift, not an ink border +
              hard offset (00.6). */}
          <span style={{ position: 'absolute', top: 12, left: 12, background: color, color: 'var(--ink)', fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12, letterSpacing: '0.02em', padding: '4px 10px', borderRadius: 'var(--r-tight)', border: 'var(--hair-2)', boxShadow: 'var(--lift-1)' }}>
            № {String(index + 1).padStart(2, '0')}
          </span>
          {b.minutes_of_read && (
            <span style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(10,10,10,0.82)', color: '#fff', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 10, letterSpacing: '0.04em', padding: '4px 9px', borderRadius: 999, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
              {b.minutes_of_read} min
            </span>
          )}
        </div>
      )}
      {!b.featured_image && (
        <div style={{ background: color, padding: '28px 24px 22px', borderBottom: 'var(--hair)', color: 'var(--ink)', position: 'relative' }}>
          <span style={{ position: 'absolute', top: 14, right: 14, background: 'var(--ink)', color, fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 12, letterSpacing: '0.02em', padding: '4px 10px', borderRadius: 'var(--r-tight)' }}>
            № {String(index + 1).padStart(2, '0')}
          </span>
          {/* Was opacity: 0.6, which on the --welfare cards (indices 0 and 4)
              resolves to the guardrails' documented rgba(10,10,10,.6) on welfare
              green, 2.79:1 at about 11px. Raising it to 0.8 only moved it to
              3.77:1 - still short. `color` here is a saturated accent fill, and
              DESIGN.md §2 admits no alpha on one: full ink is 4.55:1 on the
              worst hue in the rotation (--welfare) and better on the rest. */}
          <div className="mono xs upper" style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            ★ {b.published_date ? relativeDate(b.published_date) : 'essay'}
            {b.minutes_of_read && ` · ${b.minutes_of_read} min read`}
          </div>
          <h2 className="h-display" style={{ fontSize: 'clamp(23px, 5vw, 32px)', lineHeight: 1.0, letterSpacing: '-0.02em', paddingRight: 40 }}>{b.headliner}</h2>
        </div>
      )}
      <div style={{ padding: 'clamp(12px, 3.5vw, 18px)' }}>
        {b.featured_image && (
          <h2 style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 'clamp(21px, 5vw, 26px)', lineHeight: 1.04, letterSpacing: '-0.02em', margin: '0 0 8px', color: 'var(--ink)', textWrap: 'balance' } as React.CSSProperties}>{b.headliner}</h2>
        )}
        {b.written_by && (
          <div className="mono xs upper muted" style={{ fontWeight: 700 }}>by {b.written_by}</div>
        )}
        {/* Was the whole card at opacity: 0.55, which took the muted byline to
            2.51:1. The state is carried in text instead. */}
        {!href && (
          <div style={{ marginTop: 8 }}><span className="chip" style={{ fontSize: 10 }}>link unavailable</span></div>
        )}
        {b.featured_image && b.published_date && (
          <div className="mono xs muted" style={{ marginTop: 4 }}>{relativeDate(b.published_date)}</div>
        )}
        {href && (
          <div style={{ marginTop: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: color, color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '7px 14px', borderRadius: 999, border: 'var(--hair-2)', boxShadow: 'var(--lift-1)' }}>
              read {isExternal ? '↗' : '→'}
            </span>
          </div>
        )}
      </div>
    </div>
  )

  if (!href) return <div key={b.id}>{inner}</div>
  if (isExternal) return <a key={b.id} href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{inner}</a>
  return <Link key={b.id} to={href} style={{ textDecoration: 'none' }}>{inner}</Link>
}

export default function BlogListPage() {
  useMeta(pageMetadata.blog)
  useJsonLd('blog-list-breadcrumb', breadcrumbLd([['Home', '/'], ['Blog', '/blog']]))
  // ItemList mirrors exactly what's rendered below - on-site posts only, in the
  // same newest-first order. Externally-hosted entries (no slug, author_url
  // only) are excluded because they don't resolve to a URL on this site.
  // Stale-while-revalidate: paint the cached blog list instantly on repeat
  // visits (no round-trip wait), then refresh in the background.
  const cached = getCached<Blog[]>('aq_bloglist_v1')
  const [blogs, setBlogs] = useState<Blog[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)
  const [loadError, setLoadError] = useState(false)

  // Pulled out of the effect (11.4: "the retry must actually re-run the
  // fetch, not reload the page") so the error state's retry button can call
  // the exact same loader rather than window.location.reload().
  const loadBlogs = () => {
    setLoading(true)
    setLoadError(false)
    // Item 4.2: blogs live in `posts` now. The row SHAPE handed to the render
    // below is unchanged - see lib/blogFromPost.ts.
    //
    // `status='published'` replaces what `blogs` RLS used to do implicitly. It
    // is the same answer by a shorter route: a blog dated in the future is
    // `scheduled`, so it is absent here AND absent from the feed, which is
    // exactly the disagreement that leaked fourteen essays onto the homepage
    // (see scheduled_blogs_leak_and_source_kind_2026_09_11.sql).
    supabase
      .from('posts')
      // NOTE: deliberately no `article_body` - the list never renders article
      // text, and pulling every article's full body made this query (and the
      // localStorage cache of it) enormous for nothing.
      .select(BLOG_LIST_FROM_POST_COLS)
      .eq('source_kind', 'blog')
      .eq('status', 'published')
      // Deletion is a SOFT delete everywhere in this app, and the posts SELECT
      // policy has no deleted_at condition - `post_feed_view` filters it in the
      // view body, which is why the feed was never affected and a direct table
      // read is. Without this a deleted blog vanishes from the feed and the
      // desk while /blog keeps serving it to the public.
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .then(({ data, error }) => {
        // Distinguish a real fetch failure from a genuinely empty list, so an
        // error doesn't masquerade as "nothing here yet".
        if (error) setLoadError(true)
        else if (data) {
          const rows = data.map(r => blogFromPost(r as never))
          setBlogs(rows); setCached('aq_bloglist_v1', rows)
        }
        setLoading(false)
      })
  }

  useEffect(loadBlogs, [])

  useJsonLd('blog-list-items', itemListLd(
    'AquaTerra Groundwork Diaries',
    blogs.filter(b => b.slug && b.headliner).map(b => ({ name: b.headliner, path: `/blog/${b.slug}` })),
  ))

  return (
    <div className="route-enter container" style={{ padding: 'clamp(28px, 5vw, 48px) var(--page-px,24px) clamp(40px, 6vw, 64px)' }}>
      <span className="sticker sticker-mint wobble sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ groundwork diaries</span>
      <h1 className="h-display" style={{ fontSize: 'clamp(60px, 9vw, 96px)', margin: '12px 0 8px', lineHeight: 0.9 }}>
        the <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--accent-ink)' }}>blog</span>.
      </h1>
      <div className="row" style={{ alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
        <p style={{ fontSize: 18, color: 'var(--ink-2)', margin: 0 }}>stories from the ground. written by the people who were there.</p>
        {/* Magazine masthead strip - decorative editorial kicker, no data dependency. */}
        <span className="mono xs upper muted" style={{ fontWeight: 700, letterSpacing: '0.08em' }}>groundwork quarterly · vol. 06</span>
      </div>

      {loading ? (
        <div aria-busy="true" role="status" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 20 }}>
          <span className="sr-only">loading the blog…</span>
          {[0, 1, 2].map(i => (
            <div key={i} className="card" style={{ height: 280, background: 'var(--bg-2)', animation: 'aq-pulse 1.8s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      ) : loadError && blogs.length === 0 ? (
        // 11.4: a tinted danger well with ink text and a retry that actually
        // re-runs the fetch, not "please refresh the page".
        <ErrorState
          message="couldn’t load the blog."
          hint="something went wrong fetching stories."
          onRetry={loadBlogs}
          variant="block"
        />
      ) : blogs.length === 0 ? (
        // 11.3: every empty state gets a real action, not just a hint that
        // implies one. Instagram is the only "new stories" channel that
        // exists without a backend of its own (see the follow-CTA below).
        <EmptyState
          icon="✍️"
          title="nothing here yet."
          hint="new stories land here as we write them."
          action={
            <a href="https://instagram.com/ngo.aquaterra" target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              @ngo.aquaterra on instagram →
            </a>
          }
        />
      ) : (
        <>
          {/* Lead cover story - the newest post, given the big magazine treatment. */}
          <div style={{ marginBottom: 22 }}>
            <LeadStoryCard b={blogs[0]} />
          </div>

          {blogs.length > 1 && (
            <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: 22 }}>
              {blogs.slice(1).map((b, i) => (
                <Reveal key={b.id} delay={Math.min(i * 0.03, 0.4)}>
                  <BlogCard b={b} index={i} />
                </Reveal>
              ))}
            </RevealGroup>
          )}
        </>
      )}

      {/* Popular tags - decorative editorial strip (matches the prototype),
          each linking into the feed/search so it isn't a dead chip. */}
      {!loading && blogs.length > 0 && (
        <RevealGroup style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 26 }}>
          <span className="mono xs upper muted" style={{ fontWeight: 700 }}>popular tags</span>
          {/* 12.1: chips restyled as stamped stickers - real Links, so each
              gets a >=44px hit area even though the visual pill is smaller
              (13.3). */}
          {['sundarbans', 'winterdrive', 'paradox', 'roots', 'labs', 'fieldnotes'].map((t, i) => (
            <Reveal key={t} delay={i * 0.03}>
              <Link
                to={`/search?q=${t}`}
                className={`sticker ${TAG_STICKER_HUES[i % TAG_STICKER_HUES.length]}`}
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
              >
                #{t}
              </Link>
            </Reveal>
          ))}
        </RevealGroup>
      )}

      {/* No newsletter/email-capture backend exists in this app - styled as a
          "follow us" CTA to the real AquaTerra Instagram instead of inventing
          a fake signup form. */}
      {!loading && blogs.length > 0 && (
        <a
          href="https://instagram.com/ngo.aquaterra"
          target="_blank"
          rel="noopener noreferrer"
          className="card"
          style={{
            display: 'block', marginTop: 56, padding: 'clamp(28px, 5vw, 44px)',
            background: 'var(--ink)', color: 'var(--bg)', textDecoration: 'none',
            textAlign: 'center',
          }}
        >
          {/* accent-lint-ok: measured in-browser, the ground here is the ink slab (#0A0A0A), not cream. The display hue clears AA on ink (welfare 4.55:1, lemon 15.1:1) and its --*-ink partner does NOT (3.20:1 / 3.36:1) - swapping it made this worse and was reverted. The ground is on an ancestor element, so a static checker cannot see it. */}
          <div className="mono xs upper" style={{ fontWeight: 700, color: 'var(--lemon)', marginBottom: 10, letterSpacing: '0.08em' }}>★ stay in the loop</div>
          <div className="h-display" style={{ fontSize: 'clamp(28px, 5vw, 44px)', color: 'var(--bg)', lineHeight: 1.02 }}>
            {/* accent-lint-ok: measured in-browser, the ground here is the ink slab (#0A0A0A), not cream. The display hue clears AA on ink (welfare 4.55:1, lemon 15.1:1) and its --*-ink partner does NOT (3.20:1 / 3.36:1) - swapping it made this worse and was reverted. The ground is on an ancestor element, so a static checker cannot see it. */}
            follow the <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--welfare)' }}>drives</span> as they happen.
          </div>
          <span className="btn btn-primary" style={{ marginTop: 20, pointerEvents: 'none' }}>@ngo.aquaterra on instagram →</span>
        </a>
      )}
    </div>
  )
}
