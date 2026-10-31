/**
 * Session flags for the first-run modals, kept in their own module so reading
 * one does not drag a component into the eager bundle.
 *
 * FirstRunController is statically imported by App.tsx, and it needs this key
 * BEFORE deciding whether to render ApprovedWelcomeModal at all. While the key
 * was a named export of that modal, importing it also imported the modal, which
 * imports framer-motion, ConfettiBurst and SuccessCheck - so the celebration UI
 * for a just-approved member sat on the eager critical path of every single
 * page load. It was the last edge keeping the 127KB vendor-motion chunk
 * `modulepreload`ed sitewide. Audit 2026-09-17, efficiency P2.
 *
 * A constant has no dependencies, so it can be read freely. The component is
 * lazy. Keep it that way: do not re-export the component from here.
 */

/** Set once a just-approved member has seen (and dismissed) the welcome. */
export const APPROVED_WELCOME_FLAG_KEY = 'aq_just_approved'
