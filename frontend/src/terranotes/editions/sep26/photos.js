// September 2026's photo wall (its home page) and its "See every photo" viewer, in order (there are 5 spots).
//   photo: put the picture in public/editions/<edition id>/photos/ and write its path, e.g. '/editions/sep26/photos/terrace.jpg'
//   tint:  colour shown in its place until there is a photo
// Leave caption '' and the design's placeholder shows instead; with no place, the viewer just says "Highlight 01".

export const PHOTOS = [
  { photo: '/editions/sep26/photos/notes-wall.webp', caption: 'a whole wall of notes, pegged up to dry', place: '', tint: '#6F8468' },
  { photo: '/editions/sep26/photos/mist.jpg', caption: 'clouds rolling down through the pines', place: '', tint: '#5E7F8C' },
  { photo: '/editions/sep26/photos/sea.webp', caption: 'the sky going pink over the water', place: '', tint: '#A7765A' },
  { photo: '/editions/sep26/photos/sunset-steps.jpeg', caption: 'the sun dropping behind the steps', place: '', tint: '#8A8F6A' },
  { photo: '/editions/sep26/photos/flyover-storm.jpg', caption: 'a storm parked over the flyover', place: '', tint: '#4F6B78' },
];
