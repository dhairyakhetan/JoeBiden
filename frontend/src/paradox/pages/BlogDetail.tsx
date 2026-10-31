// @ts-nocheck
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import type { BlogPost } from '../lib/types'
import { fadeUp, stagger, fadeIn, SPRING, SPRING_SOFT, MotionLink } from '../lib/motion'

function readMins(body: string) {
  return Math.max(2, Math.ceil(body.split(' ').length / 200))
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Pick white or ink text based on hex luminance */
function textOnColor(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#181818' : '#ffffff'
}

/** Minimal markdown renderer: **bold**, # headings, blank-line paragraphs */
function renderBody(raw: string) {
  const paras = raw.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  return paras.map((para, i) => {
    const trimmed = para.trim()
    // Heading: starts with **Text** on its own line (no other content)
    const headingMatch = trimmed.match(/^\*\*(.+)\*\*$/)
    if (headingMatch) {
      return (
        <motion.h3
          key={i}
          variants={fadeUp}
          className="font-display mt-8 mb-2 text-ink"
          style={{
            fontSize: 'clamp(18px, 2.5vw, 22px)',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            textWrap: 'balance',
          }}
        >
          {headingMatch[1]}
        </motion.h3>
      )
    }
    // Regular paragraph — inline bold parsing
    const parts = trimmed.split(/(\*\*[^*]+\*\*)/)
    return (
      <motion.p
        key={i}
        variants={fadeUp}
        className="font-body text-[16px] sm:text-[17px] leading-[1.75] mb-5 text-ink/90"
        style={{ textWrap: 'pretty' }}
      >
        {parts.map((part, j) => {
          const boldMatch = part.match(/^\*\*(.+)\*\*$/)
          return boldMatch
            ? <strong key={j} className="font-semibold text-ink">{boldMatch[1]}</strong>
            : <span key={j}>{part}</span>
        })}
      </motion.p>
    )
  })
}

export function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    supabase
      .from('paradox_blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setPost((data as BlogPost) ?? null)
        setLoading(false)
        if (data) {
          // Guard against double-increment: in React StrictMode (dev)
          // useEffect mounts twice, and a fast remount in prod can still
          // fire the increment twice if the user nav's away and back. A
          // sessionStorage flag keyed by post id makes one view = one bump
          // per browser session, which is the intent.
          const id = (data as BlogPost).id
          const viewedKey = `paradox_blog_viewed_${id}`
          try {
            if (sessionStorage.getItem(viewedKey)) return
            sessionStorage.setItem(viewedKey, '1')
          } catch {}
          supabase
            .from('paradox_blog_posts')
            .update({ views: ((data as BlogPost).views ?? 0) + 1 })
            .eq('id', id)
            .then(() => {})
        }
      })
    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-bg text-ink px-4 sm:px-5 pt-7 sm:pt-10 max-w-[68ch] mx-auto space-y-3">
        <div className="animate-pulse bg-ink/8 h-[44px] w-24 rounded-2xl" />
        <div className="animate-pulse bg-ink/8 h-16 w-3/4 rounded-2xl" />
        <div className="animate-pulse bg-ink/8 h-4 w-1/3 rounded-2xl" />
        <div className="mt-8 space-y-3">
          {[1, 0.9, 0.8, 1, 0.7, 0.85, 0.6].map((w, i) => (
            <div
              key={i}
              className="animate-pulse bg-ink/8 h-4 rounded-2xl"
              style={{ width: `${w * 100}%` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div
        className="min-h-[100dvh] bg-bg text-ink px-4 sm:px-5 py-16 text-center"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65">/404</div>
        <h1
          className="font-display mt-1"
          style={{
            fontSize: 'clamp(34px, 6.6vw, 76px)',
            letterSpacing: '-0.025em',
            lineHeight: 0.95,
            textWrap: 'balance',
          }}
        >
          post not found.
        </h1>
        <MotionLink
          to="/paradox/blog"
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
          className="inline-flex items-center mt-6 rounded-full border-[1.5px] border-ink px-5 font-mono text-[12px] tracking-[0.1em] uppercase bg-transparent hover:bg-ink hover:text-bg"
          style={{
            minHeight: '44px',
            transitionProperty: 'background-color, color',
            transitionDuration: '150ms',
          }}
        >
          ← back to blog
        </MotionLink>
      </div>
    )
  }

  // Use hex cover color directly (DB stores hex like #FF3EA5)
  const coverHex = (post.cover_color && post.cover_color.startsWith('#'))
    ? post.cover_color
    : '#181818'
  const coverTextColor = textOnColor(coverHex)

  return (
    <div className="min-h-[100dvh] bg-bg text-ink" style={{ position: 'relative', zIndex: 1 }}>
      {/* Full-bleed colored article header */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={SPRING}
        style={{ backgroundColor: coverHex, color: coverTextColor }}
        className="px-4 py-8 sm:px-8 sm:py-10 lg:py-14 border-b-[1.5px] border-ink"
      >
        <div className="sm:max-w-3xl sm:mx-auto">
          {/* Back link — proper tappable area */}
          <MotionLink
            to="/paradox/blog"
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
            className="font-mono text-[11px] tracking-[0.18em] uppercase hover:underline inline-flex items-center"
            style={{
              opacity: 0.7,
              color: coverTextColor,
              minHeight: '44px',
              transitionProperty: 'opacity',
              transitionDuration: '150ms',
            }}
          >
            ← blog
          </MotionLink>

          {/* Category pill */}
          {post.tag && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...SPRING, delay: 0.08 }}
              className="mt-3 inline-block rounded-full border-[1.5px] px-4 py-1 font-mono text-[10px] tracking-[0.18em] uppercase"
              style={{ borderColor: `${coverTextColor}40`, color: coverTextColor }}
            >
              {post.tag}
            </motion.span>
          )}

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.1 }}
            className="font-display mt-3"
            style={{
              fontSize: 'clamp(30px, 5vw, 58px)',
              letterSpacing: '-0.025em',
              lineHeight: 0.95,
              color: coverTextColor,
              textWrap: 'balance',
            }}
          >
            {post.title}
          </motion.h1>

          {/* Excerpt */}
          {post.excerpt && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              transition={{ ...SPRING_SOFT, delay: 0.18 }}
              className="font-body text-[16px] mt-3 leading-relaxed max-w-xl"
              style={{ color: coverTextColor, textWrap: 'pretty' }}
            >
              {post.excerpt}
            </motion.p>
          )}

          {/* Meta */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.65 }}
            transition={{ ...SPRING_SOFT, delay: 0.22 }}
            className="font-mono text-[11px] mt-4 tabular-nums"
            style={{ color: coverTextColor }}
          >
            by {post.author ?? 'paradox crew'} · {fmtDate(post.published_at)} · {readMins(post.body)} min read · {post.views} views
          </motion.div>
        </div>
      </motion.div>

      {/* Body */}
      <div className="max-w-[68ch] mx-auto px-4 sm:px-8">
        <motion.div
          variants={stagger(0.05)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          className="py-7 sm:py-10"
        >
          {renderBody(post.body)}
        </motion.div>

        {/* Footer CTA */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="border-t-[1.5px] border-ink py-7 sm:py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5"
        >
          <div>
            <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65">more from paradox</div>
            <div
              className="font-display mt-1"
              style={{
                fontSize: 'clamp(20px, 3.5vw, 28px)',
                letterSpacing: '-0.025em',
                lineHeight: 1.05,
                textWrap: 'balance',
              }}
            >
              see what else is going on.
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <MotionLink
              to="/paradox/blog"
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
              className="rounded-full border-[1.5px] border-ink px-5 font-body font-semibold bg-transparent text-ink hover:bg-ink hover:text-bg text-center inline-flex items-center justify-center"
              style={{
                minHeight: '44px',
                transitionProperty: 'background-color, color',
                transitionDuration: '150ms',
              }}
            >
              ← all posts
            </MotionLink>
            <motion.a
              whileTap={{ scale: 0.96 }}
              href="https://instagram.com/ngo.aquaterra"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border-[1.5px] border-ink px-5 font-body font-semibold bg-ink text-bg text-center inline-flex items-center justify-center"
              style={{
                minHeight: '44px',
                boxShadow: '4px 4px 0 var(--c1)',
              }}
            >
              follow →
            </motion.a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
