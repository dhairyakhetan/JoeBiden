/**
 * The rules that apply to every sport, in one place.
 *
 * They used to live as JSX inside the rules page. The sign-up form now shows
 * them too, in a dialog, and two hand-kept copies of a rule people are asked
 * to agree to is exactly the kind of thing that quietly diverges: someone
 * corrects the refund line on one screen and not the other, and the entrant
 * has agreed to whichever one they happened to read.
 *
 * Per-sport rules are NOT here. They come from `rules_md` on the events row,
 * so the desk can correct one the week of the event without a deploy.
 */

export interface GeneralRule {
  /** Rendered bold, when the rule has a clause that carries the weight. */
  strong?: string
  rest: string
}

export const GENERAL_RULES: GeneralRule[] = [
  {
    strong: 'Born on or after 1 January 2005.',
    rest: ' This applies to every member of a team, not only the person who registers.',
  },
  { rest: 'Carry your school or college ID on the day. Entry can be refused without it.' },
  { rest: "Report at the time listed for your sport, not at the match time. Walkovers and penalties apply to teams who are late." },
  {
    // The flow changed on 2026-09-21 and this string did not follow it. It
    // still asked people to send an unprompted screenshot to a named number,
    // which is the retired pay-first flow; AquaTerra now messages them with a
    // QR and confirms by hand. This is the text behind the consent tick, so
    // until now the thing an entrant agreed to was not the thing that happens.
    rest: 'Your slot is confirmed once payment is made and we confirm it, not when the form is submitted. We message you on WhatsApp with the payment QR after you register.',
  },
  // The carve-out is not decoration. The FAQ already promised it, and this
  // list is the document gated behind the consent tick, so until now the
  // version an entrant actually had to agree to was the stricter, wronger one:
  // flatly non-refundable, no exception. Whichever of the two someone happened
  // to read decided what they believed they had agreed to.
  {
    rest: 'The entry fee is non-refundable once your slot is confirmed. The one exception is if we cancel a sport, in which case every confirmed team is refunded in full.',
  },
  { rest: 'You can swap a player before the registration deadline. Message us and we will update your entry.' },
  { rest: 'Misconduct, foul language or a physical altercation leads to immediate disqualification.' },
  { rest: "The umpire's, referee's or organiser's decision is final." },
]
