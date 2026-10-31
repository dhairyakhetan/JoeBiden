// @ts-nocheck
import { useState } from 'react'
import { motion } from 'framer-motion'
import { fadeUp, stagger, SPRING } from '../lib/motion'

const TEAM_CONTACTS = [
  { name: 'Kanishk Agarwal',      phone: '9073455396', starred: true },
  { name: 'Geetika Agarwal',      phone: '9073823009', starred: true },
  { name: 'Aastha Saluja',        phone: '8910353970', starred: false },
  { name: 'Ananya Dassani',       phone: '9073939766', starred: false },
  { name: 'Dainya Jha',           phone: '9830194184', starred: false },
  { name: 'Ishanvi Saha',         phone: '9831898255', starred: false },
  { name: 'Khushal Jhunjhunwala', phone: '9874285807', starred: false },
  { name: 'Krish Goenka',         phone: '9073455396', starred: false },
  { name: 'Pratyaksh Singhania',  phone: '9830554654', starred: false },
  { name: 'Rachit',               phone: '9051640900', starred: false },
  { name: 'Raghav Kedia',         phone: '6289219997', starred: false },
  { name: 'Vaibhav Sharma',       phone: '9748679979', starred: false },
  { name: 'Yuthika Sikaria',      phone: '8585074715', starred: false },
]

function ContactPersonCard({ person }: { person: (typeof TEAM_CONTACTS)[0] }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.a
      href={`https://wa.me/91${person.phone}`}
      target="_blank"
      rel="noreferrer"
      variants={fadeUp}
      whileTap={{ scale: 0.96 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: '16px',
        border: '1.5px solid var(--bg)',
        padding: '16px',
        minHeight: '120px',
        textDecoration: 'none',
        background: hovered ? '#25D366' : 'var(--bg)',
        color: 'var(--ink)',
        boxShadow: hovered ? '5px 5px 0 var(--bg)' : '3px 3px 0 var(--bg)',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'background-color 0.18s, box-shadow 0.18s, transform 0.18s',
      }}
    >
      <div>
        {person.starred && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--c1)', marginBottom: 5, textTransform: 'uppercase' }}>
            ★ lead
          </div>
        )}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(15px, 2vw, 19px)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            wordBreak: 'break-word',
          }}
        >
          {person.name}
        </div>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          opacity: 0.65,
          marginTop: 10,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.04em',
        }}
      >
        +91 {person.phone}
      </div>
    </motion.a>
  )
}

export function TeamPage() {
  return (
    <div className="min-h-[100dvh] bg-bg" style={{ position: 'relative', zIndex: 1 }}>

      {/* ── Header ── */}
      <motion.header
        variants={stagger(0.07)}
        initial="hidden"
        animate="show"
        className="bg-bg px-4 sm:px-8 py-6 sm:py-14 border-b-[1.5px] border-ink"
      >
        <motion.div variants={fadeUp} className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65">
          /team
        </motion.div>
        <motion.h1
          variants={fadeUp}
          className="font-display text-ink mt-2 leading-[0.92]"
          style={{
            fontSize: 'clamp(34px, 6.6vw, 76px)',
            letterSpacing: '-0.025em',
            textWrap: 'balance',
          }}
        >
          our team.
        </motion.h1>
        <motion.p
          variants={fadeUp}
          className="font-body text-[15px] opacity-65 mt-2"
          style={{ textWrap: 'pretty' }}
        >
          the people behind paradox 2026.
        </motion.p>
      </motion.header>

      {/* ── Team Contact Grid ── */}
      <section className="bg-ink text-bg px-4 sm:px-8 lg:px-12 pt-6 pb-7 sm:pt-14 sm:pb-16">
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-65 mb-2"
          >
            team contact
          </motion.div>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="font-body text-[14px] opacity-60 mb-6"
            style={{ textWrap: 'pretty' }}
          >
            reach any of us directly on whatsapp.
          </motion.p>

          <motion.div
            variants={stagger(0.06)}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3"
          >
            {TEAM_CONTACTS.map((person) => (
              <ContactPersonCard key={person.name} person={person} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Join CTA ── */}
      <motion.section
        variants={stagger(0.07)}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="bg-c1 text-bg px-4 sm:px-8 py-6 sm:py-14 border-t-[1.5px] border-ink"
      >
        <motion.div variants={fadeUp} className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-75 mb-2">
          [ volunteer ]
        </motion.div>
        <motion.h2
          variants={fadeUp}
          className="font-display text-bg leading-[0.92]"
          style={{
            fontSize: 'clamp(34px, 6.6vw, 76px)',
            letterSpacing: '-0.025em',
            textWrap: 'balance',
          }}
        >
          want in?
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="font-body text-[15px] opacity-80 mt-3 max-w-sm"
          style={{ textWrap: 'pretty' }}
        >
          Volunteer at Paradox 2026 — reach us on Instagram.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-6">
          <motion.a
            href="https://instagram.com/ngo.aquaterra"
            target="_blank"
            rel="noreferrer"
            whileTap={{ scale: 0.96 }}
            whileHover={{ y: -2, transition: SPRING }}
            transition={SPRING}
            className="rounded-full border-[1.5px] border-bg px-5 font-body font-semibold bg-bg text-ink inline-flex items-center gap-2"
            style={{
              minHeight: '48px',
              boxShadow: '4px 4px 0 var(--ink)',
              transitionProperty: 'transform, box-shadow',
            }}
          >
            @ngo.aquaterra →
          </motion.a>
        </motion.div>
      </motion.section>
    </div>
  )
}
