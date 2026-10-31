// Shared framer-motion primitives for the front-end (public/member-facing)
// surfaces only - see components/OpeningQuestionBuilder.tsx and the .admin
// CSS layer in styles/v6.css for the HoD desk's deliberately calmer,
// motion-light treatment. framer-motion is already a real dependency
// (heavily used in paradox/*, sparingly on the main site) - this file is
// the "build once, reuse everywhere" toolkit so every surface that wants a
// tap-scale, a staggered entrance, or a scroll reveal doesn't re-derive its
// own spring config. See components/Reveal.tsx and components/CountUp.tsx
// for the components built on top of these.

// Apple's duration/bounce form rather than raw stiffness/damping: two coupled
// physics constants are hard to reason about and easy to get wrong (the old
// springPop was stiffness 400 against damping 15 — a pronounced wobble that
// nobody had chosen on purpose). duration + bounce says what you actually mean.
// Keep bounce in the 0.1–0.3 range; above that it reads as a toy.
export const springPop = { type: 'spring' as const, duration: 0.4, bounce: 0.28 }
export const springSoft = { type: 'spring' as const, duration: 0.5, bounce: 0.1 }

// Press feedback for any tappable element - pass as `whileTap`. Always
// 0.96 - anything below 0.95 reads as exaggerated (make-interfaces-feel-
// better skill, "Scale on Press").
export const tapScale = { scale: 0.96 }

// A single item fading/sliding up into place.
// `transform` rather than the `y` shorthand: framer-motion's x/y/scale props
// run through requestAnimationFrame on the main thread, and this variant fires
// on route entry — exactly when the browser is busy parsing a freshly
// code-split chunk. The full transform string is composited off-thread and
// stays smooth under that load. 280ms keeps it under the 300ms UI ceiling.
export const fadeInUp = {
  hidden: { opacity: 0, transform: 'translateY(16px)' },
  visible: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.28, ease: [0.2, 0, 0, 1] as const } },
}

// Wrap a list's container in this (variants={staggerContainer}, initial="hidden",
// animate/whileInView="visible") and each child in fadeInUp - children reveal
// one after another instead of all at once.
export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
}

// A value popping into existence (new comment arriving, a badge appearing).
export const popIn = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: springPop },
  exit: { opacity: 0, scale: 0.85, transition: { duration: 0.15 } },
}

// The like-burst sequence - a quick overshoot-and-settle, distinct from the
// plain tap-scale so "you just liked this" reads as a small celebration
// rather than a button press. Unlike (removing a like) deliberately does NOT
// use this - the asymmetry is the point (see the motion plan).
//
// Toned down from [1, 1.5, 0.9, 1.15, 1] over 450ms. A 50% overshoot with a
// double bounce is celebration-grade motion, and this fires on the most-pressed
// control in the feed — the frequency table's whole point is that what delights
// once a week grates twenty times a day. One overshoot, one small settle, and
// under 300ms so it's finished before the next tap.
//
// Nudged 2026-09-12 (owner: "needs more life") without re-opening that
// restraint argument - still one overshoot, still under 300ms. A small
// rotate wiggle alongside the scale reads as more alive than a scale bump
// would on its own, and costs nothing extra on repeat taps since it's over
// before the next one lands.
// The standard modal open/close timing: backdrop fades in `modalBackdropTransition`
// duration, panel animates in `modalPanelTransition` duration, both on the same
// ease curve as fadeInUp. Six modals (AddAchievementModal, EditAchievementModal,
// AddMemberModal, PostFocusModal, CvCard, MemberOfMonthClaimCard) had copy-pasted
// this exact pair of transition objects; only the timing is shared here - each
// modal's own `initial`/`animate`/`exit` position values (centered scale-pop vs.
// bottom-sheet slide-up) stay per call site, since those genuinely differ by shape.
export const modalBackdropTransition = { duration: 0.18, ease: [0.2, 0, 0, 1] as const }
export const modalPanelTransition = { duration: 0.22, ease: [0.2, 0, 0, 1] as const }

export const likeBurst = {
  scale: [1, 1.26, 0.96, 1],
  rotate: [0, -8, 4, 0],
  transition: { duration: 0.3, times: [0, 0.4, 0.7, 1] },
}
