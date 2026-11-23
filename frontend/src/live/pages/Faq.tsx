import { useMeta } from '../../hooks/useMeta'
import { pageMetadata } from '../../lib/metaConfig'
import { LIVE, NEXT_EVENT } from '../config'
import { faqFor } from '../lib/faq'
import { useEventPhase } from '../lib/hooks'
import { Headline, Kicker } from '../components/Headline'
import { ContactLine } from '../components/ContactLine'

export function LiveFaq() {
  useMeta(pageMetadata.liveFaq)
  /** Short, plain answers, in the tense the night is in (lib/faq.ts). */
  const QA = faqFor(useEventPhase(NEXT_EVENT.date))
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
