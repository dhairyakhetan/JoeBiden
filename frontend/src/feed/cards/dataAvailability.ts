/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   The corrected data-availability table
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   WHY THIS FILE EXISTS INSTEAD OF AN EDIT TO `SHAPE_CATALOGUE`.

   `SHAPE_CATALOGUE` lives in `lib/feedShape.ts`, and ACCEPTANCE §E requires
   that file to be BYTE-IDENTICAL. Its `data` / `dataNote` fields are stale:
   they were written against a `posts` table with no image columns, and the
   live feed view has had `images` and `stats` for some time. Correcting them
   in place and honouring §E are mutually exclusive. Overriding them from a
   file this task owns is the only way to do both, so that is what this is.
   The conflict is reported rather than resolved silently.

   MEASURED 2026-09-06 against `post_feed_view` on the live project
   (`hzowuwffjqtgszecngpe`), counted not sampled:

     584 rows total, 2 distinct authors
     504 rows carry exactly 1 image; 0 carry 2; 0 carry 3 or more
      80 rows carry no image
       0 rows have a body between 240 and 600 characters
     540 bodies are under 180 characters; 44 are over 600; 0 exceed 900
     543 rows carry a non-empty `stats` array
     548 rows are mirrored `welfare_project`s; 0 are `job_opening`s
     no width/height column exists anywhere on the view

   The three corrections that matter, and why each one was wrong:

   - **C03 was `none`, "posts has no image columns at all". It is `live`, and
     it is the single most reachable content shape at 504 rows.** The note
     predates `post_feed_view.images`. Anyone reading the old note would
     conclude the feed cannot show a photo, which is the opposite of true.
   - **C02 was `none` for the same reason. It is still unreachable, but for a
     DIFFERENT reason**: it needs a body of 240-600 characters and no row has
     one. Right answer, wrong cause - and the cause is what a future reader
     acts on.
   - **C04 stays `none` and now has the real number**: 0 of 584 rows carry
     three images, so it is dead at the data, not at the schema.
   - **C01 stays `none`**: it needs `aspect >= 1.2`, and image dimensions exist
     nowhere in the app - not on the view, not on the `Post` type, not in
     `lib/imageUrl.ts`. This is the only shape blocked by a missing FIELD
     rather than by missing ROWS.
   - **`stats` is not `[]` on every row.** 543 of 584 carry one, so figures
     sourced from `stats` resolve for most of the feed rather than always
     rendering the live marker.

   Rule 4 is untouched by all of this: where a figure is genuinely absent the
   card still renders the dashed live marker and never a zero.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { SHAPE_CATALOGUE, type CardShape, type ShapeDataState, type ShapeEntry } from '../../lib/feedShape'

/** When the measurements behind this file were taken. */
export const MEASURED_AT = '2026-09-06'

export interface DataCorrection {
  data: ShapeDataState
  dataNote: string
  /** What it would take to reach this shape. `null` when it already ships. */
  blockedBy: string | null
}

/**
 * Only the shapes whose entry in `SHAPE_CATALOGUE` is wrong or incomplete.
 * A shape absent from this map keeps its catalogue entry verbatim, with
 * `blockedBy` derived from its own `data` state.
 */
export const DATA_CORRECTIONS: Partial<Record<CardShape, DataCorrection>> = {
  C01: {
    data: 'none',
    dataNote: 'STALE NOTE CORRECTED. posts DOES have images (post_feed_view.images, 504 of 584 rows carry exactly one). C01 is blocked by aspect >= 1.2 instead: no width/height is stored anywhere in the app, so the ratio cannot be known. The only shape blocked by a missing field rather than missing rows',
    blockedBy: 'image dimensions — a width/height pair on the image record (nothing in the app stores one)',
  },
  C02: {
    data: 'none',
    dataNote: 'STALE NOTE CORRECTED. Not blocked by images (504 rows carry one) but by body length: 0 of 584 bodies fall in the 240-600 window this rule needs. 540 are under 180 and 44 are over 600',
    blockedBy: 'a post with a body of 240-600 characters — the shape works, the rows do not exist',
  },
  C03: {
    data: 'live',
    dataNote: 'STALE NOTE CORRECTED — this was marked "no data can reach it". It is the most reachable content shape in the feed: 504 of 584 rows carry exactly one image and fall through rules 1-3 to land here',
    blockedBy: null,
  },
  C04: {
    data: 'none',
    dataNote: 'STALE NOTE CORRECTED as to cause. Images exist; three on one row do not. 0 of 584 rows carry 2 images, let alone 3. Dead at the data, not at the schema',
    blockedBy: 'a post carrying 3 or more images — the column supports it, no row uses it',
  },
  C05: {
    data: 'live',
    dataNote: '56 of 584 rows are imageless with a body under 180 characters and land here',
    blockedBy: null,
  },
  C07: {
    data: 'live',
    dataNote: '24 of 584 rows are imageless with a body of 180 or more and land here',
    blockedBy: null,
  },
  C11: {
    data: 'live',
    dataNote: 'CORRECTED: the catalogue-wide claim that stats is [] on every row is stale — 543 of 584 rows carry a non-empty stats array, so a key figure resolves for most of the feed rather than always rendering the live marker',
    blockedBy: null,
  },
  C25: {
    data: 'live',
    dataNote: 'the feed has 2 distinct authors, so AUTHOR_CAP fires constantly. NOTE: one post per card renders this with a count of 1. It needs the grouping in feed/cards/feedCompose.ts to be the card it is designed to be',
    blockedBy: null,
  },
}

/** What each still-unreachable shape would need. Keyed only where the
    catalogue's own note does not already say it plainly. */
const BLOCKED_BY: Partial<Record<CardShape, string>> = {
  C06: 'a blogs row over 3 min read time — reachable from blogs, never from posts (0 of 584 bodies exceed 900 characters)',
  C10: 'a target/progress pair on welfare_projects — the row exists, the figure does not',
  C13: 'hours and drive-count columns on certificate_requests',
  C17: 'a weekly per-team join aggregate endpoint',
  C20: 'a classes table',
  C21: 'a products table',
  C22: 'a weekly aggregate endpoint (4 figures)',
  C23: 'an offline post queue in the client',
  C26: 'a poll_options column on posts',
  C27: 'a record of a confirmed place on an event',
  C28: 'a watched counter with a crossing event',
  C30: 'a filled/needed pair on welfare_projects — volunteers is prose',
}

export interface ResolvedShapeEntry extends ShapeEntry {
  /** True when this entry's data state was corrected here. */
  corrected: boolean
  /** What it would take to reach the shape, or null when it already ships. */
  blockedBy: string | null
}

/**
 * `SHAPE_CATALOGUE` with the corrections applied. The catalogue page renders
 * this, never the raw array — the whole point of the data column is that a
 * future designer can trust it.
 */
export const RESOLVED_CATALOGUE: readonly ResolvedShapeEntry[] = SHAPE_CATALOGUE.map(entry => {
  const fix = DATA_CORRECTIONS[entry.id]
  const data = fix?.data ?? entry.data
  return {
    ...entry,
    data,
    dataNote: fix?.dataNote ?? entry.dataNote,
    corrected: !!fix && (fix.data !== entry.data || fix.dataNote !== entry.dataNote),
    blockedBy: fix ? fix.blockedBy : data === 'live' ? null : BLOCKED_BY[entry.id] ?? entry.dataNote,
  }
})

export function resolvedEntry(id: CardShape): ResolvedShapeEntry {
  return RESOLVED_CATALOGUE.find(e => e.id === id)!
}
