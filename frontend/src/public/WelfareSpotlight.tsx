import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Img from '../components/Img'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { postStreamHref } from '../components/PostStreamCard'

/**
 * "Recent welfare drives" band on /projects: the latest welfare drives that
 * carry real photos, with a plain call to join the next one. Reads the same
 * post_feed_view the stream below reads, so it never disagrees with it, and
 * renders nothing at all until it has at least three photographed drives
 * (a half-empty promo band is worse than none).
 */
type SpotRow = {
  post_id: number; uuid: string; body: string; created_at: string
  images: { url?: string; blobUrl?: string }[] | null
  source_type?: string | null; source_slug?: string | null
}
type Spot = { uuid: string; title: string; place: string | null; vols: number | null; date: string; img: string; href: string }

const firstLine = (b: string) => (b || '').split('\n').map(s => s.trim()).find(Boolean) || 'Welfare drive'
const grab = (b: string, mark: string) => {
  const line = (b || '').split('\n').find(l => l.trim().startsWith(mark))
  return line ? line.replace(mark, '').trim() : null
}
function toSpot(r: SpotRow): Spot | null {
  const im = r.images?.[0]
  const img = im?.blobUrl || im?.url
  if (!img) return null
  const volText = grab(r.body, '👥')
  const vols = volText ? Number.parseInt(volText, 10) : NaN
  return {
    uuid: r.uuid,
    title: firstLine(r.body),
    place: grab(r.body, '📍'),
    vols: Number.isFinite(vols) ? vols : null,
    date: new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    img,
    href: postStreamHref({ uuid: r.uuid, sourceType: r.source_type ?? undefined, sourceSlug: r.source_slug ?? undefined }),
  }
}

export default function WelfareSpotlight({ onSeeAll }: { onSeeAll: () => void }) {
  const [spots, setSpots] = useState<Spot[]>([])
  useEffect(() => {
    let cancelled = false
    supabaseCommunity
      .from('post_feed_view')
      .select('post_id,uuid,body,created_at,images,source_type,source_slug')
      .eq('status', 'published').eq('category', 'welfare')
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        const out = (data as unknown as SpotRow[]).map(toSpot).filter((s): s is Spot => !!s).slice(0, 6)
        setSpots(out)
      })
    return () => { cancelled = true }
  }, [])
  if (spots.length < 3) return null
  return (
    <section className="wspot" aria-labelledby="wspot-h">
      <div className="container">
        <div className="wspot-head">
          <div>
            <span className="wspot-kick">welfare · what we did lately</span>
            <h2 id="wspot-h" className="wspot-h">students on the ground, <span className="wspot-serif">this season.</span></h2>
          </div>
          <div className="wspot-cta">
            <button type="button" className="btn btn-ghost" onClick={onSeeAll}>see every drive</button>
            <Link to="/login" className="btn btn-primary">join the next drive</Link>
          </div>
        </div>
        <ul className="wspot-rail">
          {spots.map(s => (
            <li key={s.uuid} className="wspot-card">
              <Link to={s.href} className="wspot-link">
                <Img ctx="card" src={s.img} alt={s.title} className="wspot-img" />
                <span className="wspot-scrim" aria-hidden />
                <span className="wspot-body">
                  <span className="wspot-meta">{s.date}{s.vols ? ` · ${s.vols} volunteers` : ''}</span>
                  <span className="wspot-title">{s.title}</span>
                  {s.place && <span className="wspot-place">{s.place}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
