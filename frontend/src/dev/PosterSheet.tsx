import { useEffect, useState } from 'react'
import PosterStudioModal from '../components/PosterStudioModal'
import { generatePoster, POSTER_TEMPLATE_NAMES, POSTER_HIRING_TEMPLATE_NAMES, type PosterData } from '../components/posterGenerator'

/**
 * /dev/posters: every poster design drawn once from fixture content, as a contact sheet, so the generator's output
 * can be judged without a session or a database. Dev only (App.tsx keeps the import behind import.meta.env.DEV).
 * The photo is drawn on a canvas here, so nothing is fetched.
 */
function fixturePhoto(): string {
  const c = document.createElement('canvas')
  c.width = 1200; c.height = 900
  const g = c.getContext('2d')!
  const sky = g.createLinearGradient(0, 0, 0, 900)
  sky.addColorStop(0, '#8EC5FF'); sky.addColorStop(0.6, '#F7E3B5'); sky.addColorStop(1, '#6C8F4E')
  g.fillStyle = sky; g.fillRect(0, 0, 1200, 900)
  g.fillStyle = '#C98B4A'; g.beginPath(); g.ellipse(600, 560, 260, 200, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#A8692F'; g.beginPath(); g.ellipse(470, 380, 90, 120, -0.4, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.ellipse(730, 380, 90, 120, 0.4, 0, Math.PI * 2); g.fill()
  return c.toDataURL('image/jpeg', 0.85)
}

const BODY = 'Dog drive at Jatindas Park\n\n4 volunteers from AquaTerra went to Jatindas Park and fed the dogs, with biscuits, water and a lot of patting.\n\n📍 Jatindas Park, Kolkata\n\n👥 4 volunteers'

export default function PosterSheet() {
  // ?studio mounts the real modal on the same fixture instead of the contact sheet.
  return new URLSearchParams(window.location.search).has('studio') ? <StudioOnFixture /> : <Sheet />
}

function StudioOnFixture() {
  const photo = fixturePhoto()
  return <PosterStudioModal data={{ body: BODY, authorName: 'Trisha Chatterjee', category: 'welfare', uuid: 'fixture', imageUrl: photo, images: [photo] }} onClose={() => {}} />
}

function Sheet() {
  const [cells, setCells] = useState<{ name: string; url: string; kind: string }[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const photo = fixturePhoto()
      const base: PosterData = { body: BODY, authorName: 'Trisha Chatterjee', authorSchool: 'Test School', category: 'welfare', uuid: 'fixture', imageUrl: photo, images: [photo, photo, photo, photo] }
      const hiring: PosterData = { ...base, body: 'Podcast research and outreach', imageUrl: undefined, images: undefined, category: 'content', hiring: { skills: ['research', 'writing', 'outreach'], commitment: '2-3 hrs/week', deadline: '30 Oct', teamName: 'Content' } }
      const out: { name: string; url: string; kind: string }[] = []
      for (const name of POSTER_TEMPLATE_NAMES) {
        for (const [kind, d] of [['photo', base], ['no photo', { ...base, imageUrl: undefined, images: undefined }]] as const) {
          if (cancelled) return
          try {
            const r = await generatePoster(d, 'post', { template: name, seed: 7 })
            out.push({ name, url: r.dataUrl, kind })
          } catch (e) { out.push({ name, url: '', kind: `${kind} FAILED: ${String(e).slice(0, 60)}` }) }
          setCells([...out])
        }
      }
      for (const name of POSTER_HIRING_TEMPLATE_NAMES) {
        if (cancelled) return
        try { const r = await generatePoster(hiring, 'post', { template: name, seed: 7 }); out.push({ name, url: r.dataUrl, kind: 'hiring' }) } catch (e) { out.push({ name, url: '', kind: `hiring FAILED: ${String(e).slice(0, 60)}` }) }
        setCells([...out])
      }
      setDone(true)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ padding: 16, background: '#ddd', minHeight: '100vh' }}>
      <div data-done={done ? '1' : '0'} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {cells.map((c, i) => (
          <figure key={i} style={{ margin: 0 }}>
            {c.url ? <img src={c.url} alt={`${c.name} ${c.kind}`} style={{ width: '100%', display: 'block', borderRadius: 8 }} /> : <div style={{ aspectRatio: '3 / 4', background: '#fbb', padding: 8 }}>{c.kind}</div>}
            <figcaption style={{ font: '12px monospace', padding: '4px 0' }}>{c.name} · {c.kind}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
