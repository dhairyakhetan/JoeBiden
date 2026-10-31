// Site-wide settings and copy, the same in every edition (an edition's own content is in src/editions/<id>/): the one
// place for the site's own address and its outside links.
// Leave a text field '' and the design's placeholder shows instead.
export const SITE = {
  instagram: 'ngo.aquaterra', // Aquaterra's handle, without the @ (phone menu)
  // the magazine's own site: its link previews, sitemap and llms.txt are built from this address (env SITE_URL overrides
  // it at build). Inside AQ's website, AQ's build decides the address (embed/aq/scripts/prerender.mjs).
  url: 'https://terranotes-aq.vercel.app',
  website: 'https://www.ngoaquaterra.com', // Aquaterra's main site (llms.txt; the magazine also lives there, at /terranotes)
  footerNote: 'Kolkata · est. 2021 · 1,300+ members', // a line about Aquaterra (llms.txt and the copy for crawlers)
};
