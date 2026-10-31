import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Sticker } from '../components/Sticker'
import { splitHeadline } from '../lib/authTokens'
import type { AuthHero as AuthHeroData } from '../lib/authHero'
import './AuthHero.css'

/**
 * The contextual hero above LoginPage's sign-in card - see LoginPage.tsx for
 * how `hero` and `navKey` are produced. This component only renders what
 * `resolveAuthHero()` (lib/authHero.ts) hands it; it makes no auth-related
 * decisions of its own.
 *
 * `navKey` should be a value that changes whenever the intent could have
 * changed - LoginPage passes `location.key` plus the resolved hero's kind, so
 * a second `setAuthIntent()` + re-navigate to /login while already sitting on
 * it (same route, new intent) still replays the transition instead of
 * silently reusing the old card.
 */
export default function AuthHero({ hero, navKey }: { hero: AuthHeroData; navKey: string }) {
  const reduceMotion = useReducedMotion()
  const segments = splitHeadline(hero.sentence, hero.emphasis)

  const vars = {
    '--ah-bg': hero.tone.bg,
    '--ah-ink': hero.tone.ink,
  } as CSSProperties

  return (
    <div className="ah-root" data-flat={hero.tone.flat ? 'true' : undefined}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={navKey}
          className="ah-card"
          style={vars}
          initial={reduceMotion ? false : { opacity: 0, transform: 'translateY(10px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(-6px)' }}
          transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        >
          <div className="ah-top">
            {hero.eyebrow && <span className="ah-eyebrow">{hero.eyebrow}</span>}

            {hero.fragmentWord && (
              <Sticker
                shape="ribbon"
                hue={hero.tone.hue ?? 'ink'}
                rotate={-6}
                size={92}
                type="status"
                className="ah-frag"
              >
                {hero.fragmentWord}
              </Sticker>
            )}
            {hero.fragmentNumeral && (
              <Sticker
                shape="circle"
                hue={hero.tone.hue ?? 'lemon'}
                rotate={-6}
                size={80}
                numeral={hero.fragmentNumeral}
                className="ah-frag"
              />
            )}
          </div>

          <p className="ah-sentence">
            {segments.map((seg, i) => (
              <span key={i} className={seg.strong ? undefined : 'ah-muted'}>
                {seg.text}
              </span>
            ))}
          </p>

          <p className="ah-subline">{hero.subline}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
