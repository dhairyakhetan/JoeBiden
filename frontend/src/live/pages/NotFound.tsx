import { Link } from 'react-router-dom'
import { useMeta } from '../../hooks/useMeta'
import { LIVE } from '../config'
import { Headline } from '../components/Headline'

export function LiveNotFound() {
  useMeta({ title: 'Not found | AquaTerra.live', description: 'That page is not part of AquaTerra.live.', path: LIVE.base, noIndex: true })
  return (
    <main id="lv-main" className="lv-main lv-page">
      <Headline as="h1" text="Nothing on this wall." />
      <p className="lv-lede">That page does not exist here.</p>
      <Link className="lv-btn lv-btn-red" to={LIVE.base}>Back to the start</Link>
    </main>
  )
}
