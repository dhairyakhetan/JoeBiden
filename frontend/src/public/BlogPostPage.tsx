import Img from '../components/Img'
import './BlogPostPage.css'
// The blog page now renders on the post page's layout classes (.pp-*), so it
// pulls in that stylesheet directly rather than duplicating the rules.
import '../feed/PostPage.css'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import { supabase, Blog, relativeDate } from '../lib/supabase'
import { BLOG_FROM_POST_COLS, BLOG_LIST_FROM_POST_COLS, blogFromPost } from '../lib/blogFromPost'
import { useAuth } from '../auth/AuthContext'
import { hasLeaderAccess } from '../lib/roles'
import { safeExternalHref } from '../lib/safeUrl'
import BlogStudioModal from '../components/BlogStudioModal'
import { useMeta, DEFAULT_OG_IMAGE } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd, PUBLISHER_LD } from '../hooks/useJsonLd'
import { useToast } from '../components/Toast'
import { Reveal, RevealGroup } from '../components/Reveal'

// Word-boundary truncation for the meta description: a raw `.slice()` on the
// article body chops mid-word and reads like a cut-off CMS field. Collapse
// whitespace, then trim back to the last full word + an ellipsis.
function metaTrim(s: string, max = 158) {
  const clean = (s || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '').trimEnd() + '…'
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const { member } = useAuth()
  const toast = useToast()
  const canMakeGraphic = hasLeaderAccess(member?.role)
  const [showStudio, setShowStudio] = useState(false)
  const [blog, setBlog] = useState<Blog | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  /** The read FAILED, as opposed to the slug genuinely not existing. */
  const [loadError, setLoadError] = useState(false)
  const [more, setMore] = useState<Pick<Blog, 'slug' | 'headliner' | 'featured_image' | 'featured_image_alt' | 'minutes_of_read'>[]>([])

  useEffect(() => {
    if (!slug) return
    // Item 4.2: blogs live in `posts` now. The SHAPE is unchanged - see
    // lib/blogFromPost.ts for why the adapter exists rather than this file
    // being rewritten around post-native field names.
    supabase
      .from('posts')
      .select(BLOG_FROM_POST_COLS)
      .eq('slug', slug)
      .eq('source_kind', 'blog')
      // NO status filter here, deliberately - and the comment that used to sit
      // here was wrong about its own code. It claimed this "renders for a
      // director previewing it", but a client-side `.eq('status','published')`
      // is ANDed into the query: RLS can only NARROW a result set, never
      // re-admit a row the client already excluded. So the filter 404'd every
      // draft and every scheduled post for everyone, including the author and
      // the director, and broke the desk's "preview the live page" link.
      //
      // RLS is the correct and sufficient gate: `posts_select` is
      // `status = 'published' OR author_id = me OR is_director()`. An anonymous
      // visitor gets zero rows for a draft (the not-found branch, which is
      // right), while its author and a director can still preview it.
      // Soft delete: the posts SELECT policy has no deleted_at condition, so a
      // direct table read serves deleted rows. post_feed_view filters it in the
      // view body, which is why the feed never showed this.
      .is('deleted_at', null)
      .single()
      .then(({ data, error }) => {
        // PGRST116 is "no rows from .single()", the only genuine 404 here.
        // Any other error is a failure - a network blip, a 500, RLS - and
        // calling it "Post not found." told a reader an essay had been taken
        // down when it had not. Same distinction PublicProjectDetailPage
        // already draws.
        if (error || !data) {
          const missing = !error || (error as { code?: string }).code === 'PGRST116'
          if (missing) setNotFound(true); else setLoadError(true)
          setLoading(false); return
        }
        setBlog(blogFromPost(data as never))
        setLoading(false)

        // "More from AquaTerra" - most recent OTHER posts, newest first. With
        // only ~13 posts total there's no meaningful topic-similarity signal
        // to mine (unlike the welfare-projects page's objective match), so
        // "recent" is the honest, non-random choice rather than inventing a
        // fake relevance score off a handful of rows.
        supabase
          .from('posts')
          .select(BLOG_LIST_FROM_POST_COLS)
          .eq('source_kind', 'blog')
          .eq('status', 'published')
          .is('deleted_at', null)
          .neq('slug', slug)
          .order('published_at', { ascending: false })
          .limit(3)
          .then(({ data: rel }) => setMore((rel || []).map(r => blogFromPost(r as never))))
      })
  }, [slug])

  // Per-route SEO - title/excerpt/cover + Article OG tags from the loaded post.
  useMeta({
    title: blog ? `${blog.headliner} | AquaTerra Groundwork Diaries` : 'Groundwork Diaries | AquaTerra',
    description: blog
      ? (metaTrim((blog.body || '').replace(/[#>*_`]/g, ''))
         || `${blog.headliner}, a field story from AquaTerra's Groundwork Diaries, by the students who were there in Kolkata.`)
      : "student stories from AquaTerra's Groundwork Diaries: welfare, climate and community work, written from the ground in Kolkata.",
    image: blog?.featured_image || '',
    imageAlt: blog?.featured_image_alt || (blog ? `${blog.headliner} - AquaTerra blog cover` : undefined),
    type: 'article',
    author: blog?.written_by || undefined,
    publishDate: blog?.published_date || undefined,
  })

  // BlogPosting + breadcrumb structured data - rich-result eligibility on each
  // post (skipped until the post has loaded).
  const canonical = `https://www.ngoaquaterra.com/blog/${slug}`
  useJsonLd('blog-posting', blog ? {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: blog.headliner,
    description: (blog.body || '').replace(/[#>*_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200),
    image: blog.featured_image || DEFAULT_OG_IMAGE,
    author: { '@type': 'Person', name: blog.written_by || 'AquaTerra' },
    publisher: PUBLISHER_LD,
    datePublished: blog.published_date || undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    url: canonical,
  } : null)
  useJsonLd('blog-breadcrumb', blog ? breadcrumbLd([
    ['Home', '/'], ['Blog', '/blog'], [blog.headliner, `/blog/${slug}`],
  ]) : null)

  if (loading) {
    return (
      <div className="route-enter" aria-busy="true" role="status" style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(24px,4vw,40px) var(--page-px,24px)' }}>
        <span className="sr-only">loading the post…</span>
        <div className="v6-skeleton sk-pill" style={{ width: 200, height: 20, marginBottom: 24 }} />
        <div className="v6-skeleton" style={{ width: '92%', height: 38, marginBottom: 10, borderRadius: 'var(--r-tight)' }} />
        <div className="v6-skeleton" style={{ width: '64%', height: 38, marginBottom: 24, borderRadius: 'var(--r-tight)' }} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28 }}>
          <div className="v6-skeleton sk-circle" style={{ width: 40, height: 40 }} />
          <div className="v6-skeleton" style={{ width: 130, height: 14 }} />
        </div>
        <div className="v6-skeleton" style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--r-inner)', marginBottom: 28 }} />
        {[0,1,2,3,4,5].map(i => (
          <div key={i} className="v6-skeleton" style={{ width: i % 3 === 2 ? '68%' : '100%', height: 16, marginBottom: 12, borderRadius: 'var(--r-tight)' }} />
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="route-enter container" style={{ textAlign: 'center', padding: 'clamp(44px, 8vw, 80px) var(--page-px,24px) clamp(32px, 5vw, 56px)' }}>
        <h1 className="h-display" style={{ fontSize: 40, marginBottom: 12 }}>this essay didn’t load.</h1>
        <p className="muted" style={{ marginBottom: 20 }}>it hasn’t been taken down - the page just couldn’t be fetched.</p>
        <div className="row gap-2" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>try again</button>
          <Link to="/blog" className="btn">← All Posts</Link>
        </div>
      </div>
    )
  }

  if (notFound || !blog) {
    return (
      <div className="route-enter container" style={{ textAlign: 'center', padding: 'clamp(44px, 8vw, 80px) var(--page-px,24px) clamp(32px, 5vw, 56px)' }}>
        <h1 className="h-display" style={{ fontSize: 40, marginBottom: 16 }}>Post not found.</h1>
        <Link to="/blog" className="btn">← All Posts</Link>
      </div>
    )
  }

  return (
    // A blog IS a post here — same primitive, same mirrored feed entry — so it
    // now uses the post page's own layout classes (.pp-*) instead of a parallel
    // magazine-cover design. Sharing the stylesheet is what keeps the two in
    // step; a visual copy would drift the first time either is touched.
    <div className="route-enter post-page-root">
      <div className="pp-layout">
      <aside className="pp-side">
        <div className="pp-side-inner">
        <div className="pp-topbar">
          <Link to="/blog" className="mono xs upper" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textDecoration: 'none' }}>
            ← Groundwork Diaries
          </Link>
          {canMakeGraphic && (
            <button
              className="btn btn-sm"
              onClick={() => setShowStudio(true)}
              title="Generate an Instagram graphic for this blog post"
              aria-label="Generate Instagram graphic"
              style={{ background: 'var(--grape)', color: '#fff', border: 'none', fontWeight: 800, gap: 6, display: 'inline-flex', alignItems: 'center', boxShadow: '0 2px 8px rgba(126,91,255,0.3)', transition: 'transform 0.12s var(--ease-out)' }}
              onMouseDown={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)')}
              onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
              onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="3.4" />
                <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
              </svg>
              <span className="mono" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.02em' }}>graphic</span>
            </button>
          )}
        </div>

        <span className="sticker sticker--diecut pp-cat" style={{ background: 'var(--welfare)', color: 'var(--ink)' }}>
          groundwork diaries
        </span>

        <h1 className="pp-title">{blog.headliner}</h1>

        {/* Same chip rail the post page uses for its structured metadata. */}
        <div className="pp-meta-row">
          {blog.published_date && (
            <span className="pp-chip">
              <span className="pp-chip-ic">🗓</span>
              <i>published</i> {relativeDate(blog.published_date)}
            </span>
          )}
          {blog.minutes_of_read && (
            <span className="pp-chip">
              <span className="pp-chip-ic">⏱</span>
              <i>read</i> {blog.minutes_of_read} min
            </span>
          )}
        </div>

        {/* Audit pass, 2026-09-06: was `&type=people` - SearchPage reads
            `kind` from the URL, never `type` (its own generated links use
            `kind=members`, e.g. below in ClassesPage.tsx), so this landed
            on the unfiltered "all" tab instead of a people-only view. */}
        {blog.written_by && (
          <Link to={`/search?q=${encodeURIComponent(blog.written_by)}&kind=members`} className="pp-author">
            <span style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: 'var(--welfare)', color: 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--display)', fontWeight: 800, fontSize: 13,
            }}>
              {blog.written_by.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </span>
            <span>
              <span className="pp-author-name">{blog.written_by}</span>
              {blog.author_instagram && (
                <span className="mono xs pp-author-school">{blog.author_instagram}</span>
              )}
            </span>
          </Link>
        )}
        </div>
      </aside>

      {/* <div>, not <main> — PublicLayout already provides the page's one
          <main id="main-content">. */}
      <div className="pp-main">
        {/* Cover art now sits in the article column as the lead image, the way
            a post's photo does, rather than as a full-bleed masthead. */}
        {blog.featured_image && (
          <div className="pp-media">
            <Img
              ctx="cover"
              className="pp-img"
              src={blog.featured_image}
              alt={blog.featured_image_alt || `${blog.headliner} - AquaTerra blog cover`}
              eager
            />
          </div>
        )}
        <article className="pp-body">
        {blog.body ? (
          // Body copy is the reading voice - --eina, not --serif. The serif
          // accent font is reserved for the pullquote below (one deliberate
          // register shift), matching the rest of the app's type system.
          // §12.2's editorial measure: 400 17px/1.72, text-wrap: pretty.
          <div style={{ fontWeight: 400, fontSize: 17, lineHeight: 1.72, color: 'var(--ink-2)', fontFamily: 'var(--eina)', textWrap: 'pretty' } as React.CSSProperties}>
            {(() => {
              let plainSeen = 0
              return blog.body.split('\n\n').map((para, i) => {
                if (para.startsWith('## ')) {
                  return <h2 key={i} className="h-display" style={{ fontSize: 'clamp(22px,3vw,32px)', margin: '40px 0 16px', color: 'var(--ink)', fontFamily: 'var(--display)' }}>{para.replace('## ', '')}</h2>
                }
                if (para.startsWith('> ')) {
                  return (
                    <blockquote key={i} style={{
                      borderLeft: '3px solid var(--welfare)', paddingLeft: 22, margin: '28px 0',
                      fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'clamp(20px, 3vw, 24px)',
                      lineHeight: 1.4, color: 'var(--ink)',
                    }}>
                      {para.replace('> ', '')}
                    </blockquote>
                  )
                }
                // Line breaks INSIDE a paragraph mean two different things
                // depending on where the text came from, and getting it wrong
                // wrecks the post either way:
                //
                //  - Prose pasted from .docx is hard-wrapped at ~90-100 chars.
                //    Those breaks are an artifact of the export. Honouring them
                //    would ladder the essay down the page at the original
                //    column width; collapsing them to spaces is correct.
                //  - Poems ("Syntax Error", "My mind at 3am", "Cross It Anyway",
                //    "Beyond Mortal") break lines deliberately. Collapsing those
                //    runs the verse together as prose, which is what this page
                //    was doing to every poem in the Diaries.
                //
                // Median line length separates them cleanly: a hard-wrap sits
                // near the wrap column, a verse line is short. Anything under
                // 65 chars is treated as intentional and kept as <br />.
                const lines = para.split('\n')
                const isVerse = lines.length > 1 &&
                  lines.filter(l => l.trim().length > 65).length <= lines.length / 3
                const render = (text: string) => isVerse
                  ? text.split('\n').map((l, li, arr) => (
                      <span key={li}>{l}{li < arr.length - 1 ? <br /> : null}</span>
                    ))
                  : text.replace(/\n/g, ' ')

                // Drop-cap the opening letter of the very first plain paragraph only.
                const isOpener = plainSeen === 0
                plainSeen++
                // Only drop-cap an actual letter. One post opens on "- What if…"
                // and the cap rendered a giant floating hyphen.
                if (isOpener && /^[A-Za-z]/.test(para)) {
                  return (
                    <p key={i} style={{ marginBottom: 20 }}>
                      <span style={{
                        float: 'left', fontFamily: 'var(--display)', fontWeight: 900,
                        fontSize: 64, lineHeight: 0.82, margin: '4px 6px 0 0', color: 'var(--accent-ink)',
                      }}>{para[0]}</span>
                      {render(para.slice(1))}
                    </p>
                  )
                }
                return <p key={i} style={{ marginBottom: 20 }}>{render(para)}</p>
              })
            })()}
          </div>
        ) : (
          // THE EXCEPTION, not the default. This comment used to say "every
          // blog post today has an empty body", which was true when the
          // Instagram-era rows were all there was. Since the 4.2 fold 33 of
          // the 36 essays carry a real `article_body` and render the layout
          // above; three do not, and they land here.
          //
          // The dead-end case is the point: /blog/blog-11 is published, in the
          // sitemap and linked from the index, and with no `author_url` it
          // served a sentence and nothing to do next. There is always an exit
          // now - Instagram when we have the link, the index otherwise.
          <div className="card" style={{ padding: 'clamp(28px,5vw,40px) clamp(20px,4vw,32px)', textAlign: 'center' }}>
            <span className="sticker sticker-mint sticker--diecut" style={{ display: 'inline-flex', marginBottom: 16, ['--sticker-ground' as string]: 'var(--card)' }}>★ posted to instagram</span>
            <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 19, color: 'var(--ink-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
              This story lives on AquaTerra's Instagram - the full write-up hasn't made it to the blog yet.
            </p>
            {blog.author_url ? (
              <a href={safeExternalHref(blog.author_url)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Read on Instagram →
              </a>
            ) : (
              <Link to="/blog" className="btn btn-primary">read the other essays →</Link>
            )}
          </div>
        )}

        <div style={{ borderTop: 'var(--hair)', marginTop: 60, paddingTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <Link to="/blog" className="mono xs upper muted" style={{ fontWeight: 700, textDecoration: 'none', color: 'var(--ink-3)' }}>
              ← All posts
            </Link>
            <button
              className="btn btn-sm btn-ghost"
              aria-label="Share this post"
              onClick={async () => {
                const url = window.location.href
                if (typeof navigator.share === 'function') { navigator.share({ url, title: blog.headliner }).catch(() => {}); return }
                // Desktop has no share sheet, so the fallback is a copy - and a
                // silent copy is indistinguishable from a dead button. Report both
                // outcomes through the toast, same wording as WhatsAppTemplates.
                try {
                  await navigator.clipboard.writeText(url)
                  toast.success('link copied')
                } catch {
                  toast.error('couldn’t copy that.', 'your browser blocked clipboard access - select and copy the address bar manually.')
                }
              }}
            >
              ↗ share
            </button>
          </div>
          {/* Bridge: if this post is about a kind of drive, point at the real projects. */}
          {(() => {
            const KW = ['plantation', 'distribution', 'workshop', 'sundarbans', 'feeding', 'fundrais', 'old age']
            const match = KW.find(k => (blog.headliner || '').toLowerCase().includes(k))
            return (
              <div style={{ marginTop: 16 }}>
                <Link to={match ? `/projects?q=${encodeURIComponent(match)}` : '/projects'} className="aq-thread-link" style={{ letterSpacing: '0.04em' }}>
                  {match ? 'see the projects this was written about →' : "browse what we've been building →"}
                </Link>
              </div>
            )
          })()}
        </div>
        </article>
      </div>
      </div>

      {/* ── MORE FROM AQUATERRA - most recent other posts (see fetch above
           for why "recent" rather than a fabricated relevance score) ── */}
      {more.length > 0 && (
        <div style={{ borderTop: 'var(--hair-2)', padding: 'clamp(32px,5vw,56px) 0 clamp(48px,6vw,72px)' }}>
          <div className="container" style={{ maxWidth: 900 }}>
            <span className="sticker sticker-mint sticker--diecut" style={{ display: 'inline-flex', fontSize: 10, marginBottom: 18, ['--sticker-ground' as string]: 'var(--bg)' }}>
              ★ MORE FROM AQUATERRA
            </span>
            <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {more.map((b, i) => (
                <Reveal key={b.slug} delay={i * 0.05}>
                  <Link to={`/blog/${b.slug}`} className="blog-more-card">
                    <div className="blog-more-img">
                      {b.featured_image ? (
                        <Img ctx="card" src={b.featured_image} alt={b.featured_image_alt || b.headliner} loading="lazy" decoding="async" />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'var(--bg-2)' }} />
                      )}
                    </div>
                    <div style={{ padding: '12px 14px 14px' }}>
                      <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 15, lineHeight: 1.25 }}>{b.headliner}</div>
                      {b.minutes_of_read && <div className="mono xs muted" style={{ marginTop: 6 }}>{b.minutes_of_read} min read</div>}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </RevealGroup>
          </div>
        </div>
      )}

      {/* Blog graphic studio modal (portal) */}
      {showStudio && blog && createPortal(
        <BlogStudioModal
          data={{
            title: blog.headliner,
            author: blog.written_by,
            readMinutes: blog.minutes_of_read,
            imageUrl: blog.featured_image,
            category: 'content',
            slug: blog.slug,
          }}
          onClose={() => setShowStudio(false)}
        />,
        document.body
      )}

    </div>
  )
}
