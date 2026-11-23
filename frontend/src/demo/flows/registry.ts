import type { DemoFlow, FlowListing } from './types'
import postToFeed from './postToFeed'
import applyForRole from './applyForRole'
import signUpDrive from './signUpDrive'
import wallNote from './wallNote'
import generateCv from './generateCv'
import takeABreak from './takeABreak'
import searchDiscovery from './searchDiscovery'
import hodApproveAccount from './hodApproveAccount'
import hodModeratePost from './hodModeratePost'
import hodPostOpening from './hodPostOpening'

/** Real, working flows - the walkthroughs from 19.4 (ten since 20 Nov 2026, when "Request a certificate" was retired:
 *  requesting moved to its own page, /certificates, which reads live HoDs and teams the demo's fake store does not model), each built against this file's
 *  own verification checklist (zero network writes, no Supabase token,
 *  ribbon on every step, both completion paths tested). See this pass's
 *  final report for the per-flow network/token verification detail and the
 *  handful of step-count deviations from the spec's own table (documented
 *  inline in FLOW_LISTINGS below, and in each such flow's own header
 *  comment) where the real screen had fewer genuine clickable moments than
 *  19.4 assumed. */
export const FLOWS: Record<string, DemoFlow> = {
  [postToFeed.id]: postToFeed,
  [applyForRole.id]: applyForRole,
  [signUpDrive.id]: signUpDrive,
  [wallNote.id]: wallNote,
  [generateCv.id]: generateCv,
  [takeABreak.id]: takeABreak,
  [searchDiscovery.id]: searchDiscovery,
  [hodApproveAccount.id]: hodApproveAccount,
  [hodModeratePost.id]: hodModeratePost,
  [hodPostOpening.id]: hodPostOpening,
}

/**
 * The walkthroughs from 19.4, in the spec's own priority order, with
 * duration labels from that table - step counts are copied from 19.4 EXCEPT
 * the three noted inline below, where the count was corrected downward
 * after building and testing the real screen (never upward: nothing here
 * invents a step the real UI doesn't have). All are `ready` - every
 * one has a module in `FLOWS` above. `status` is kept on this type (rather
 * than deleted now that nothing is `soon`) since it is what lets the
 * launcher's list stay honest the next time a twelfth flow is added ahead
 * of being built.
 */
export const FLOW_LISTINGS: FlowListing[] = [
  { id: 'post-to-feed', name: 'Post something to the feed', steps: 4, durationLabel: 'about a minute', status: 'ready', hue: 'var(--welfare)' },
  { id: 'apply-for-role', name: 'Apply for a role', steps: 5, durationLabel: 'about two minutes', status: 'ready', hue: 'var(--tomato, #FF4D2E)' },
  { id: 'sign-up-drive', name: 'Sign up for a drive', steps: 3, durationLabel: 'under a minute', status: 'ready', hue: 'var(--lemon)' },
  { id: 'search-discovery', name: 'Search and discovery', steps: 3, durationLabel: 'under a minute', status: 'ready', hue: 'var(--sky, #3DA9FC)' },
  { id: 'wall-note', name: "Leave a note on someone's wall", steps: 3, durationLabel: 'under a minute', status: 'ready', hue: 'var(--grape, #7E5BFF)' },
  { id: 'generate-cv', name: 'Generate a CV', steps: 3, durationLabel: 'under a minute', status: 'ready', hue: 'var(--tomato, #FF4D2E)' },
  { id: 'take-a-break', name: 'Take a break and come back', steps: 3, durationLabel: 'under a minute', status: 'ready', hue: 'var(--lemon)' },
  // Spec table (19.4) says 4 steps; built and verified as 3, same reasoning
  // as the other desk flows here - see hodApproveAccount.tsx's own header.
  { id: 'hod-approve-account', name: 'HR approves an account', steps: 3, durationLabel: 'about a minute', status: 'ready', hue: 'var(--sky, #3DA9FC)' },
  // Spec table (19.4) says 4 steps; built and verified as 3 - see
  // hodModeratePost.tsx's own header for why (same reasoning as the other
  // AdminRow-based desk flows in this file).
  { id: 'hod-moderate-post', name: 'A HoD moderates a post', steps: 3, durationLabel: 'about a minute', status: 'ready', hue: 'var(--grape, #7E5BFF)' },
  { id: 'hod-post-opening', name: 'A HoD posts an opening', steps: 4, durationLabel: 'about a minute', status: 'ready', hue: 'var(--welfare)' },
]

export function getFlow(id: string): DemoFlow | undefined {
  return FLOWS[id]
}
