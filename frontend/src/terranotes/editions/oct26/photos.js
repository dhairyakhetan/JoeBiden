// October 2026's photo wall (its home page) and its "See every photo" viewer: readers' photos, SHOW of them at a time.
//   photo: put the picture in public/editions/<edition id>/photos/ and write its path, e.g. '/editions/oct26/photos/terrace.webp'
//   tint:  colour shown in its place until there is a photo
// Leave caption '' and the design's placeholder shows instead; with no place, the viewer just says "Highlight 01".
// The wall has 5 spots: SHOW of these hang there (and in the viewer), picked at random by lib/photoPick.js, kept for a
// few hours like the opening animation, and picked again on a hard refresh.

export const SHOW = 5;

export const PHOTOS = [
  { photo: '/editions/oct26/photos/city-dusk.webp', caption: 'City at dusk', place: '', tint: '#FFB400' },
  { photo: '/editions/oct26/photos/sea-sunset.webp', caption: 'Sunset at sea', place: '', tint: '#FF4F8B' },
  { photo: '/editions/oct26/photos/misty-hills.webp', caption: 'Mist on the hills', place: '', tint: '#FF7A2F' },
  { photo: '/editions/oct26/photos/setu-sunset.webp', caption: 'Sun under the bridge', place: '', tint: '#18C7B8' },
  { photo: '/editions/oct26/photos/kindness.webp', caption: 'A small kindness', place: '', tint: '#B6E04B' },
  { photo: '/editions/oct26/photos/window-seat.webp', caption: 'Window seat', place: '', tint: '#FFB400' },
  { photo: '/editions/oct26/photos/sun-through-leaves.webp', caption: 'Sun through the leaves', place: '', tint: '#FF4F8B' },
  { photo: '/editions/oct26/photos/full-moon.webp', caption: 'Full moon', place: '', tint: '#FF7A2F' },
  { photo: '/editions/oct26/photos/beach-clouds.webp', caption: 'Clouds over the sea', place: '', tint: '#18C7B8' },
  { photo: '/editions/oct26/photos/howrah-bridge.webp', caption: 'Howrah Bridge, blue hour', place: '', tint: '#B6E04B' },
  { photo: '/editions/oct26/photos/sky-on-fire.webp', caption: 'Sky on fire', place: '', tint: '#FFB400' },
  { photo: '/editions/oct26/photos/afternoon-clouds.webp', caption: 'Afternoon clouds', place: '', tint: '#FF4F8B' },
  { photo: '/editions/oct26/photos/blue-skyline.webp', caption: 'Blue skyline', place: '', tint: '#FF7A2F' },
  { photo: '/editions/oct26/photos/palms-at-sunset.webp', caption: 'Palms at sunset', place: '', tint: '#18C7B8' },
  { photo: '/editions/oct26/photos/silver-lining.webp', caption: 'Silver lining', place: '', tint: '#B6E04B' },
  { photo: '/editions/oct26/photos/wall-of-notes.webp', caption: 'A wall of notes', place: '', tint: '#FFB400' },
  { photo: '/editions/oct26/photos/night-flight.webp', caption: 'Night flight', place: '', tint: '#FF4F8B' },
  { photo: '/editions/oct26/photos/maa-kali.webp', caption: 'Maa Kali', place: '', tint: '#FF7A2F' },
  { photo: '/editions/oct26/photos/festive-lights.webp', caption: 'Lights on the drive', place: '', tint: '#18C7B8' },
  { photo: '/editions/oct26/photos/pink-sky.webp', caption: 'Pink sky over the city', place: '', tint: '#B6E04B' },
];
