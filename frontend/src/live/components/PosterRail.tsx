import { POSTERS, posterSrc } from '../data/photos'

/** The real campaign posters in a snap-scrolling rail, each tilted a little differently so it reads as a pinned-up wall. */
export function PosterRail({ className = '' }: { className?: string }) {
  return (
    <ul className={'lv-rail ' + className} aria-label="Disco Diwali posters">
      {POSTERS.map((p, i) => (
        <li key={p.id} className="lv-rail-item" style={{ ['--tilt' as string]: `${[-2.2, 1.6, -1.2, 2.2, -1.8][i % 5]}deg` }}>
          <figure className="lv-photo lv-rail-fig">
            <img src={posterSrc(p.id)} width={600} height={750} alt={p.alt} loading="lazy" decoding="async" />
          </figure>
          <p className="lv-rail-cap">{p.label}</p>
        </li>
      ))}
    </ul>
  )
}
