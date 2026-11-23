import { ASK, DISCO, NEXT_EVENT } from '../config'
import { ANNOUNCE_HANDLE, type EventPhase } from './eventPhase'

export interface QA { q: string; a: string }

/**
 * The FAQ, in the tense the night is in. Before and on the day it answers how to book and where to go; once the night is over the
 * date, ticket and venue answers move to the past tense, the lineup question goes (nothing true left to say), and the answers that
 * still help (where the money goes, photo takedowns, who to ask) stay word for word. Only settled facts; no attendance, no money
 * raised, no next date.
 */
export function faqFor(phase: EventPhase): QA[] {
  const past = phase === 'past'
  const name = NEXT_EVENT.name
  const full = `${name}, ${NEXT_EVENT.edition},`
  const time = DISCO.time ? `, from ${DISCO.time.replace(/ onwards$/, '')}` : ''
  const timeOn = DISCO.time ? `, from ${DISCO.time}` : ''
  const venue = DISCO.venueName ?? NEXT_EVENT.venue
  const list: (QA | false)[] = [
    {
      q: 'What is AquaTerra.live?',
      a: 'It is where AquaTerra hosts every fundraising event it runs. The nights pay for our welfare work, and this site keeps the story of each one.',
    },
    past
      ? {
          q: `How did ${name} tickets work?`,
          a: `Guests messaged ${ASK.name} on WhatsApp, paid by UPI, and got a booking ID like DD26-XXXX to show at the door. The next night will be announced on Instagram, ${ANNOUNCE_HANDLE}.`,
        }
      : {
          q: `How do I get a ${name} ticket?`,
          a: `Message ${ASK.name} on WhatsApp and pay by UPI. Once the payment is confirmed the team sends you a booking ID that looks like DD26-XXXX. Show that ID at the door.`,
        },
    past
      ? {
          q: 'When and where was it?',
          a: `${full} took place on ${NEXT_EVENT.dateLabel}${time}, at ${venue} in Kolkata. Photos from the nights are in the Vault.`,
        }
      : {
          q: 'When and where is it?',
          a: `${full} is on ${NEXT_EVENT.dateLabel}${timeOn}, at ${venue} in Kolkata.`,
        },
    past
      ? { q: 'What was the dress code?', a: 'It was a masquerade, so the dress code was a mask.' }
      : { q: 'What should I wear?', a: 'It is a masquerade, so bring a mask. The full dress code goes up here once the team confirms it.' },
    {
      q: 'Where does the money go?',
      a: 'AquaTerra is a youth-led NGO with no grants and no parent company. Event money pays for the drives and welfare programmes. A plain breakdown by programme will be published on this site.',
    },
    !past && {
      q: 'Who is performing?',
      a: `The lineup has not been announced. When it is, it goes on the ${name} page first.`,
    },
    {
      q: 'Can I get a photo of me taken down?',
      a: 'Yes. Open the photo in the Vault and tap "Ask to remove this photo", or message the team. It comes down, no questions asked.',
    },
    {
      q: 'Something else?',
      a: `Ask ${ASK.name}. The contact page has the number, and a real person answers.`,
    },
  ]
  return list.filter((x): x is QA => x !== false)
}
