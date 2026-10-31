/**
 * The AquaTerra.live photo library. Files live in public/live/photos as `<id>-s.webp` (360 wide, 3:4 crop, for the arc and
 * thumbnails) and `<id>-m.webp` (up to 960 wide, natural aspect, for panels and the lightbox).
 *
 * Every photo shows real guests. The owner confirmed on 2026-10-24 that consent is verified for all of them, so `consent` is
 * 'confirmed'. The Vault still offers a one-tap takedown on every photo. Alt text describes the scene and never names anyone.
 * Years are only stated where the frame proves one (the photo booth's clapperboard reads 22/10/25).
 */
export interface LivePhoto {
  id: string
  alt: string
  /** Which night it belongs to, as far as the frame can tell. */
  event: 'disco-diwali' | 'disco-diwali-2025' | 'summer-aq-turns-five'
  consent: 'confirmed' | 'confirmed'
  /** True when the frame is landscape and loses most of its width in the 3:4 thumbnail. */
  wide?: boolean
}

export const PHOTOS: LivePhoto[] = [
  { id: 'booth', event: 'disco-diwali-2025', consent: 'confirmed', wide: true, alt: 'Guests in masks and festive wear posing at the Disco Diwali photo booth, a black and silver balloon arch over a red curtain, with a clapperboard sign.' },
  { id: 'drapes', event: 'disco-diwali', consent: 'confirmed', alt: 'A red drape canopy strung with fairy lights over a courtyard and a red carpet, guests photographing each other.' },
  { id: 'friends', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'Three smiling friends in saris and kurtas under fairy lights and hanging stars at dusk.' },
  { id: 'greenfloor', event: 'disco-diwali', consent: 'confirmed', alt: 'A packed dance floor in green and yellow light beside a silver tinsel pillar, hanging cards overhead.' },
  { id: 'pillar', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'Dancers in colourful outfits beside a tall silver tinsel pillar in a purple-lit hall.' },
  { id: 'teal', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'A crowd dancing in a purple-lit hall, one guest in a teal kurta, silver tinsel pillar behind.' },
  { id: 'chandelier', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'A hot-pink and violet ceiling with a chandelier and a silver star balloon over the crowd.' },
  { id: 'greenboys', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'A close, energetic crowd under green light, a tinsel curtain and a chandelier above.' },
  { id: 'pinkglare', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'Two guests with their backs to the camera in pink glare, one filming on a phone.' },
  { id: 'balloon', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'A guest lifted on shoulders reaching for a star balloon under magenta stage light.' },
  { id: 'cardsgreen', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'Dancers with arms raised in a hall hung with playing cards and chandeliers, green light.' },
  { id: 'blueblur', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'Motion-blurred dancers with raised arms in deep blue light.' },
  { id: 'cardspurple', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'A crowd in a purple-lit hall under hanging cards and a crystal chandelier.' },
  { id: 'darkcrowd', event: 'disco-diwali', consent: 'confirmed', wide: true, alt: 'A dark, dense crowd under star balloons and a silver tinsel pillar.' },
  { id: 'pinkphone', event: 'disco-diwali', consent: 'confirmed', alt: 'A pink and violet lit hall ceiling, a guest filming on a phone below.' },
  // The Summer AQ turns five. Faceless or crowd shots only; the gossip board, which carries written guest notes, is deliberately left out.
  { id: 'summer-banner', event: 'summer-aq-turns-five', consent: 'confirmed', wide: true, alt: 'A hand-painted kraft banner reading The Summer AQ turns FIVE, with shells, a starfish and a mermaid tail, hung on a fishing net.' },
  { id: 'summer-dance', event: 'summer-aq-turns-five', consent: 'confirmed', wide: true, alt: 'A banquet hall under hanging star lights and chandeliers, a guest dancing on a marble floor with a crowd watching.' },
  { id: 'summer-lanterns', event: 'summer-aq-turns-five', consent: 'confirmed', alt: 'A courtyard under a net with teal drapes, red and white paper lanterns and silver stars, a crowd below.' },
  { id: 'summer-stars', event: 'summer-aq-turns-five', consent: 'confirmed', wide: true, alt: 'A night courtyard strung with hanging star and fairy lights, no people in frame.' },
]

const BY_ID = new Map(PHOTOS.map(p => [p.id, p]))

/** The finished campaign art from the AquaTerra design engine. The date poster's Bhai Dooj line was confirmed correct by the owner on 2026-10-24. */
/** Files: public/live/posters/<id>.webp, 600 wide, 4:5. */
export interface LivePoster { id: string; alt: string; label: string }
export const POSTERS: LivePoster[] = [
  { id: 'announce', label: 'The announcement, October', alt: 'The Disco Diwali announcement poster: the hand-lettered title, The Masquerade Sangeet Edition, and a copper mask on a navy and gold lotus-diya ground.' },
  { id: 'happening', label: 'The teaser, October', alt: 'A poster reading It is happening, with three fanned cards, two of them blurred behind question marks, under string lights.' },
  { id: 'date', label: 'Block your calendar', alt: 'A poster that says to block your calendar, with a drawn calendar card showing Tuesday 10 November 2026.' },
  { id: 'charity', label: 'All for charity', alt: 'A poster headed All for charity with the edition line and the Disco Diwali title as a footer mark.' },
  { id: 'location', label: 'The location', alt: 'A poster revealing the venue, a tilted map card with a red pin and a copper mask lying across its corner.' },
]
export const posterSrc = (id: string): string => `/live/posters/${id}.webp`

export const photoSrc = (id: string, size: 's' | 'm' = 'm'): string => `/live/photos/${id}-${size}.webp`
export const photo = (id: string): LivePhoto => {
  const p = BY_ID.get(id)
  if (!p) throw new Error(`Unknown live photo: ${id}`)
  return p
}

/** The order the hero arc shows them in: alternating warm and cool so no two neighbours share a colour cast. */
export const ARC_IDS = [
  'pillar', 'greenfloor', 'chandelier', 'friends', 'blueblur', 'drapes', 'pinkphone', 'booth',
  'cardsgreen', 'balloon', 'darkcrowd', 'teal', 'cardspurple', 'greenboys', 'pinkglare',
] as const
