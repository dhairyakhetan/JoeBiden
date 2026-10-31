// @ts-nocheck
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { BlogPost } from '../lib/types'
import { fadeUp, stagger, SPRING } from '../lib/motion'

function readMins(body: string) {
  return Math.max(2, Math.ceil(body.split(' ').length / 200))
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function monthAbbr(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
}
function dayNum(iso: string | null) {
  if (!iso) return '—'
  return String(new Date(iso).getDate()).padStart(2, '0')
}

// Cycling bg colors: cream / yellow / purple, then repeat
const CARD_BG = ['var(--bg)', 'var(--c2)', 'var(--c3)']
const CARD_TEXT = ['var(--ink)', 'var(--ink)', '#fff']
// Rotation only applied at sm+ screens; 0 on mobile
const CARD_ROTATE = ['-0.5deg', '0.5deg', '-0.5deg']

export function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    supabase
      .from('paradox_blog_posts')
      .select('*')
      .eq('published', true)
      .order('published_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setFetchError(true)
        else setPosts((data as BlogPost[]) ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-[100dvh] bg-bg text-ink" style={{ position: 'relative', zIndex: 1 }}>
      {/* Page header */}
      <div className="px-4 sm:px-8 py-6 sm:py-14 border-b-[1.5px] border-ink">
        <div className="max-w-[1280px] mx-auto">
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65">/blog</div>
          <h1
            className="font-display mt-1"
            style={{
              fontSize: 'clamp(34px, 6.6vw, 76px)',
              letterSpacing: '-0.025em',
              lineHeight: 0.95,
              textWrap: 'balance',
            }}
          >
            the blog.
          </h1>
          <p
            className="font-body text-[15px] opacity-55 mt-2 max-w-xs"
            style={{ textWrap: 'pretty' }}
          >
            Updates, guides, and behind-the-scenes from AquaTerra and Paradox.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse bg-ink/8 rounded-2xl border-[1.5px] border-ink/20"
              style={{ minHeight: '180px' }}
            />
          ))}
        </div>
      ) : fetchError ? (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-20 text-center">
          <p className="font-mono text-[11px] tracking-[0.12em] uppercase opacity-40 mt-3">
            couldn't load posts — check your connection and refresh.
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-20 text-center">
          <h2
            className="font-display opacity-15 leading-none"
            style={{
              fontSize: 'clamp(34px, 6.6vw, 76px)',
              letterSpacing: '-0.025em',
              textWrap: 'balance',
            }}
          >
            no posts yet.
          </h2>
          <p className="font-mono text-[11px] tracking-[0.12em] uppercase opacity-40 mt-3">
            check back soon.
          </p>
        </div>
      ) : (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 py-8">
          <motion.div
            variants={stagger(0.07)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 pb-12"
          >
            {posts.map((p, i) => {
              const bg = CARD_BG[i % 3]
              const textColor = CARD_TEXT[i % 3]
              const rotateDeg = CARD_ROTATE[i % 3]
              return (
                <motion.article
                  key={p.id}
                  variants={fadeUp}
                  transition={SPRING}
                  whileHover={{ y: -4, boxShadow: '5px 5px 0 var(--ink)' }}
                  whileTap={{ scale: 0.96 }}
                  className="rounded-2xl border-[1.5px] border-ink p-5 blog-card"
                  style={{
                    backgroundColor: bg,
                    color: textColor,
                    ['--blog-rotate' as string]: rotateDeg,
                    boxShadow: '3px 3px 0 var(--ink)',
                    transitionProperty: 'transform, box-shadow',
                  }}
                >
                  <Link to={`/paradox/blog/${p.slug}`} className="block h-full">
                    {/* Date stamp */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="rounded-lg border-[1.5px] border-current/30 px-2 py-1 text-center shrink-0">
                        <div className="font-mono text-[9px] tracking-[0.1em] uppercase opacity-70 tabular-nums">
                          {monthAbbr(p.published_at)}
                        </div>
                        <div
                          className="font-display tabular-nums"
                          style={{ fontSize: '18px', letterSpacing: '-0.025em', lineHeight: 1 }}
                        >
                          {dayNum(p.published_at)}
                        </div>
                      </div>

                      {/* Category pill */}
                      {p.tag && (
                        <span className="rounded-full border-[1.5px] border-current/50 px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase opacity-80">
                          {p.tag}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2
                      className="font-display leading-tight mt-1"
                      style={{
                        fontSize: 'clamp(20px, 2.8vw, 28px)',
                        letterSpacing: '-0.025em',
                        textWrap: 'balance',
                      }}
                    >
                      {p.title}
                    </h2>

                    {/* Excerpt */}
                    {p.excerpt && (
                      <p
                        className="font-body text-[13px] leading-relaxed mt-2 opacity-70 line-clamp-3 lg:line-clamp-2"
                        style={{ textWrap: 'pretty' }}
                      >
                        {p.excerpt}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-current/20">
                      <span className="font-mono text-[10px] opacity-60 tabular-nums">
                        {fmtDate(p.published_at)} · {readMins(p.body)} min
                      </span>
                      <span className="font-mono text-[10px] opacity-70 tracking-[0.08em] uppercase">
                        read →
                      </span>
                    </div>
                  </Link>
                </motion.article>
              )
            })}
          </motion.div>
        </div>
      )}

      {/* Rotation at sm+ only */}
      <style>{`
        @media (min-width: 640px) {
          .blog-card { rotate: var(--blog-rotate, 0deg); }
        }
      `}</style>
    </div>
  )
}
