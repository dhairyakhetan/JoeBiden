// @ts-nocheck
import { motion } from 'framer-motion'
import { fadeUp, stagger, SPRING, MotionLink } from '../lib/motion'
// Note: bottom marquee uses CSS animation (not Framer Motion) to prevent stalls on re-renders

export function Footer() {
  return (
    <footer
      className="bg-ink text-bg relative overflow-hidden border-t-[1.5px] border-ink"
      style={{ position: 'relative', zIndex: 1 }}
    >
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 lg:px-12 pt-10 pb-8
        lg:grid lg:grid-cols-[1fr_auto] lg:gap-16 lg:items-end relative">

        <div>
          {/* Big display CTA */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            <div
              className="font-display text-bg leading-[0.88]"
              style={{ fontSize: 'clamp(36px, 8vw, 80px)' }}
            >
              thank you,
            </div>
            <div
              className="font-display text-c1 leading-[0.88]"
              style={{ fontSize: 'clamp(36px, 8vw, 80px)' }}
            >
              kolkata.
            </div>
            <p className="font-mono text-[11px] tracking-[0.12em] uppercase opacity-40 mt-3">
              Jun 1–6, 2026 · Wrapped.
            </p>
          </motion.div>

          {/* 3-column links */}
          <motion.div
            variants={stagger(0.07)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-5 font-mono text-[11px] tracking-[0.06em]"
          >
            <motion.div variants={fadeUp} className="space-y-1">
              <div className="opacity-40 text-[10px] uppercase tracking-[0.14em] mb-2">Follow</div>
              <motion.a
                href="https://instagram.com/ngo.aquaterra" target="_blank" rel="noreferrer"
                whileTap={{ scale: 0.96 }} transition={SPRING}
                className="block py-1 hover:text-c2 transition-colors"
              >
                @ngo.aquaterra ↗
              </motion.a>
              <motion.a
                href="https://wa.me/919748679979" target="_blank" rel="noreferrer"
                whileTap={{ scale: 0.96 }} transition={SPRING}
                className="block py-1 hover:text-c2 transition-colors"
              >
                WhatsApp ↗
              </motion.a>
            </motion.div>

            <motion.div variants={fadeUp} className="space-y-1">
              <div className="opacity-40 text-[10px] uppercase tracking-[0.14em] mb-2">Reach out</div>
              <motion.a
                href="mailto:ngo.aquaterra@gmail.com"
                whileTap={{ scale: 0.96 }} transition={SPRING}
                className="block py-1 hover:text-c2 transition-colors normal-case leading-relaxed"
              >
                ngo.aquaterra<br />@gmail.com
              </motion.a>
            </motion.div>

            <motion.div variants={fadeUp} className="space-y-1 col-span-2 sm:col-span-1">
              <div className="opacity-40 text-[10px] uppercase tracking-[0.14em] mb-2">Get involved</div>
              <MotionLink to="/paradox/sponsor" whileTap={{ scale: 0.96 }} transition={SPRING}
                className="block py-1 hover:text-c2 transition-colors">Become a Sponsor</MotionLink>
              <MotionLink to="/paradox/team" whileTap={{ scale: 0.96 }} transition={SPRING}
                className="block py-1 hover:text-c2 transition-colors">Our Team</MotionLink>
              <MotionLink to="/paradox/blog" whileTap={{ scale: 0.96 }} transition={SPRING}
                className="block py-1 hover:text-c2 transition-colors">Blog</MotionLink>
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom-right info */}
        <div className="mt-8 lg:mt-0 pt-5 lg:pt-0 border-t lg:border-t-0 border-bg/10
          font-mono text-[10px] tracking-[0.06em] opacity-35
          flex lg:flex-col justify-between lg:justify-end items-center lg:items-end
          flex-col sm:flex-row gap-1 sm:gap-4 lg:gap-1.5 lg:text-right">
          <span>© 2026 AquaTerra</span>
          <span className="hidden lg:inline opacity-70">all proceeds to charity · 80G</span>
          <span className="hidden lg:inline opacity-70">4th edition of Paradox</span>
          {/* Admin link removed from the public footer — reached by URL only. */}
        </div>
      </div>

      {/* Bottom marquee strip */}
      <div className="border-t-[1.5px] border-bg/10 overflow-hidden py-2.5 select-none">
        <div
          className="flex gap-8 whitespace-nowrap w-max"
          style={{ animation: 'marquee 20s linear infinite' }}
        >
          {Array.from({ length: 2 }).flatMap(() => [
            'PARADOX 2026', '★', 'THANK YOU KOLKATA', '★', 'JUN 1–6', '★',
            'KOLKATA', '★', '₹51K PRIZES', '★', '80G CERTIFIED', '★',
            'ALL PROCEEDS TO CHARITY', '★', 'SEE YOU NEXT YEAR', '★',
          ]).map((item, i) => (
            <span key={i} className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-30">
              {item}
            </span>
          ))}
        </div>
      </div>
    </footer>
  )
}
