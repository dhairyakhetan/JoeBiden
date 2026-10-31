import { useMeta } from '../../hooks/useMeta'
import { pageMetadata } from '../../lib/metaConfig'
import { ASK, LIVE } from '../config'
import { Headline, Kicker } from '../components/Headline'
import { ContactLine } from '../components/ContactLine'

/** Short, plain answers. Only what is settled is answered; anything else says who to ask, never a guess. */
const QA: { q: string; a: string }[] = [
  {
    q: 'What is AquaTerra.live?',
    a: 'It is where AquaTerra hosts every fundraising event it runs. The nights pay for our welfare work, and this site keeps the story of each one.',
  },
  {
    q: 'How do I get a Disco Diwali ticket?',
    a: `Message ${ASK.name} on WhatsApp and pay by UPI. Once the payment is confirmed the team sends you a booking ID that looks like DD26-XXXX. Show that ID at the door.`,
  },
  {
    q: 'When and where is it?',
    a: 'Disco Diwali, The Masquerade Sangeet Edition, is on 10 November 2026, from 4:30 PM onwards, at 60, Chowringhee Banquets in Kolkata.',
  },
  {
    q: 'What should I wear?',
    a: 'It is a masquerade, so bring a mask. The full dress code goes up here once the team confirms it.',
  },
  {
    q: 'Where does the money go?',
    a: 'AquaTerra is a youth-led NGO with no grants and no parent company. Event money pays for the drives and welfare programmes. A plain breakdown by programme will be published on this site.',
  },
  {
    q: 'Who is performing?',
    a: 'The lineup has not been announced. When it is, it goes on the Disco Diwali page first.',
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

export function LiveFaq() {
  useMeta(pageMetadata.liveFaq)
  return (
    <main id="lv-main" className="lv-main lv-page">
      <Kicker>Before you head out</Kicker>
      <Headline as="h1" text="Short answers, no fine print." />
      <div className="lv-faq">
        {QA.map(item => (
          <details key={item.q} className="lv-faq-item">
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
      <ContactLine message="Hi, I have a question about AquaTerra.live." />
      <p className="lv-fine"><a className="lv-link" href={LIVE.mainSite}>Back to AquaTerra</a></p>
    </main>
  )
}
