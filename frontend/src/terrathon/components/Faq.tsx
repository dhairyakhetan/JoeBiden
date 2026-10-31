import { useState } from 'react'

/**
 * The FAQ, in one place.
 *
 * It used to sit on each of the three sport pages, which meant three copies of
 * the same answers to keep in step and three places for someone to find a
 * different one. It is on the home page now, at the bottom, where a visitor who
 * has read the sports and the schedule and still has a question will look.
 *
 * Panels are always in the DOM and hidden with `hidden="until-found"` so the
 * browser's own find-in-page can reach the answers. They were unmounted while
 * closed, which meant Ctrl+F found nothing for "refund" or "late" on the one
 * screen that answers both. See the ref callback below for why the attribute is
 * set imperatively rather than through JSX.
 */
const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'How do I pay?',
    a: 'You do not pay on this website. Once you register, AquaTerra messages you on WhatsApp within 24 hours with the payment QR code. Pay that, and your QR entry pass follows once we have confirmed it.',
  },
  {
    q: 'When is my slot confirmed?',
    a: 'Once we have messaged you on WhatsApp and you have paid. Submitting the form is not the same as being confirmed. It puts you on the list and starts the conversation.',
  },
  {
    q: 'Can I get a refund?',
    a: 'No. Entry fees are non-refundable once your slot is confirmed. The one exception is if AquaTerra cancels a sport, in which case every confirmed team is refunded in full.',
  },
  {
    q: 'Can I swap a player later?',
    a: 'Yes, before the registration deadline. Message us on WhatsApp with the change and we will update your entry.',
  },
  {
    q: 'What if we are late on the day?',
    a: 'Walkovers and penalties are in place, so do not be late. Every sport publishes its own reporting time on its page and on the schedule, and that is the time to work back from, not the match time.',
  },
  {
    q: 'Who can play?',
    a: 'Anyone born on or after 1 January 2005. That applies to every member of a team, not only the person who registers, and we check ID at the gate.',
  },
  {
    q: 'Do I need a full team to register?',
    a: 'No. One person registers with their own details. We collect the rest of your team over WhatsApp afterwards, so you do not need everyone’s details in front of you now.',
  },
  {
    q: 'What do I need to bring?',
    a: 'Your school or college ID, and your QR entry pass, which lands on WhatsApp once you are confirmed. Pickleball players are encouraged to bring their own paddles.',
  },
  {
    q: 'Where does the money go?',
    a: 'Into the welfare projects Team AquaTerra runs through the year. We are a registered NGO, 12A and 80G certified.',
  },
]

/**
 * Which questions a surface shows.
 *
 * All nine belong on Contact, which exists to answer questions. The home page
 * was rendering the identical nine, so the same strings were published on two
 * routes and half of them again in the rules. Three surfaces carrying one
 * answer is three places for it to drift, and the refund line is the one that
 * must never drift.
 *
 * The home page now takes only the questions that stop someone registering:
 * how they pay, when they are actually in, and whether they get their money
 * back. The rest are a click away on a page built for them.
 */
export interface FaqProps {
  /** Question text to show, in this order. Omit for all of them. */
  only?: string[]
}

export function TerraThonFaq({ only }: FaqProps = {}) {
  // First panel open on arrival, not a blank accordion: a visitor scrolling
  // down should see one answer is right there rather than a row of closed bars.
  const [open, setOpen] = useState<number | null>(0)

  // Filtered off the canonical list rather than passed in as content, so a
  // subset can never say something the full set does not. An unknown question
  // is dropped rather than rendered empty, and the order asked for is the
  // order shown, since a shortened list is a ranking.
  const items = only
    ? only.map((q) => FAQ.find((f) => f.q === q)).filter((f): f is (typeof FAQ)[number] => !!f)
    : FAQ

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((f, i) => (
        <div
          key={f.q}
          className="tt-card"
          style={{
            padding: 0, overflow: 'hidden',
            borderColor: open === i ? 'var(--tt-hot)' : undefined,
            background: open === i ? 'rgba(242, 239, 227, 0.04)' : undefined,
            transitionProperty: 'border-color, background-color',
            transitionDuration: '180ms',
            transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, padding: '16px 18px', background: 'none', border: 'none',
              color: 'var(--tt-text)', font: 'inherit', fontSize: 'var(--tt-fs-body)', fontWeight: 600,
              textAlign: 'left', cursor: 'pointer', minHeight: 56,
            }}
          >
            {f.q}
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" aria-hidden="true"
              style={{
                flex: '0 0 auto', color: open === i ? 'var(--tt-hot)' : 'var(--tt-ink-3)',
                transform: open === i ? 'rotate(180deg)' : 'none',
                transitionProperty: 'transform, color', transitionDuration: '220ms',
                transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
              }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {/* Two reasons this is a ref callback rather than JSX or an effect,
              both found by watching it fail:
              1. React types `hidden` as a BOOLEAN attribute, so passing the
                 string through JSX renders `hidden=""` and the panel goes back
                 to being unfindable. It has to be set with setAttribute.
              2. `beforematch` fires just before the browser reveals a panel
                 during find-in-page, so the chevron and aria-expanded follow it
                 instead of lying. It is not a React synthetic event. */}
          <p
            ref={(el) => {
              if (!el) return
              if (open === i) el.removeAttribute('hidden')
              else el.setAttribute('hidden', 'until-found')
              const onMatch = () => setOpen(i)
              el.addEventListener('beforematch', onMatch)
              return () => el.removeEventListener('beforematch', onMatch)
            }}
            style={{ margin: 0, padding: '0 18px 18px', fontSize: 'var(--tt-fs-body)', lineHeight: 1.7, color: 'var(--tt-muted)' }}
          >
            {f.a}
          </p>
        </div>
      ))}
    </div>
  )
}
