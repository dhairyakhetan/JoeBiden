// September 2026's notebook ruling, for everything here that writes on it. look.css draws it: the first line's tile
// starts `start` px down the page sheet, one line every `gap` px, and the red margin line stands `margin` px from the
// left (these numbers mirror look.css). Diary.jsx and "Meet the team" (TEAM_FIT below) both take them from here.
export const RULE = { web: { start: 128, gap: 32, margin: 104 }, phone: { start: 104, gap: 28, margin: 14 } };

// "Meet the team" written on that ruling: overrides for the PHONE / WEB tables in shared/TeamSection.jsx (merged one
// level deep, so a key here only changes the values it names). Text starts clear of the margin, every line height is
// the ruling's (or a whole number of rules), and shared/TeamSection.jsx drops each block's first baseline on a ruled
// line (lib/ruled.js, as the diary does), so the rest of its lines follow. Tops are where a block starts roughly: the
// fit moves it by less than half a rule. No ink divider over the section: the page's own lines do that job. The legend
// (as in every edition: web two by two, phone one column) puts a team every two rules (tap targets stay 44px). Only September reads this.
export const TEAM_FIT = {
  web: {
    rule: { display: 'none' },
    title: { left: '128px', top: '20px', lineHeight: '64px' },
    count: { top: '26px', lineHeight: '32px' },
    blurb: { left: '128px', top: '172px', lineHeight: '32px' },
    note: { left: '128px', top: '348px', lineHeight: '32px', transform: 'none' },
    legend: { left: '118px', top: '428px', gridAutoRows: '64px' },
    extra: { left: 128, top: 572, width: 430, size: 28 },
    face: { role: '10px', roleSpacing: '1.2px', half: 62, name: '14px' }, // the type sizes September came out with (the shared ones grew later)
    // compact (Oct 2026, the owner's ask: the whole section on a laptop's screen): six faces a row, smaller, closer rows
    faces: { rows: [[624, 762, 900, 1038, 1176, 1314], [693, 831, 969, 1107, 1245]], sizes: [92, 82, 96, 86, 90, 94, 84, 88, 80], nudgeX: [-6, 5, -3, 7, -5, 4, 2, -7, 6, -4], nudgeY: [0, 14, -8, 6, 16, -6, 10, -10, 4, 14, -4], top: 92, rowH: 168 },
    minHeight: 640,
  },
  phone: {
    rule: { display: 'none' },
    title: { left: '28px', top: '22px', lineHeight: '56px' },
    blurb: { left: '28px', top: '146px', width: '334px', lineHeight: '28px' },
    note: { left: '28px', top: '324px', width: '330px', lineHeight: '28px', transform: 'none' },
    legend: { left: '20px', top: '394px', gridAutoRows: '56px' },
    extra: { left: 204, top: 400, width: 170, size: 21 },
    // compact (Oct 2026, the owner's ask): four faces a row then three, smaller, closer rows
    faces: { top: 640, rows: [[54, 148, 242, 336], [101, 195, 289]], sizes: [72, 64, 76, 66, 70, 74, 64, 68], nudgeX: [0], nudgeY: [0, 10, -6, 6, 12, -4, 8, -8, 2, 10, -2], rowH: 136 },
    count: { fontSize: '9px', letterSpacing: '1.6px' }, chip: { fontSize: '9.5px', letterSpacing: '1.2px' }, face: { role: '8px', roleSpacing: '0.6px', half: 47, name: '8.5px', gap: '6px' }, // as September came out; the face's label box fits the closer columns
  },
};
