/**
 * The canonical cohort vocabulary for `members.class_grade`.
 *
 * WHY THIS IS A SHARED CONSTANT NOW
 *
 * `/register` has always written from a fixed picker. `/profile/edit` was a
 * free-text `<input>`. So every member could, and did, type whatever they liked
 * the moment they edited their profile - and most of the roster had arrived
 * through the HR workbook import as bare numbers anyway. The column ended up
 * holding 63 distinct values for nine real cohorts, and the public /classes
 * page showed "11" and "Class 11" as two separate cohorts, five spellings of
 * Class 11 in total. Found 2026-09-18 while verifying the audit migration.
 *
 * Display-side grouping is handled in SQL by `class_cohort_counts()` (see
 * scripts/class_cohort_normalise_2026_09_18.sql) so no existing member row has
 * to be rewritten. THIS file is the other half: it stops new bad values being
 * written, by giving both surfaces the same list.
 *
 * ORDER IS THE PICKER ORDER. School years ascending, then college years, then
 * the escape hatch last.
 */
export const CLASS_OPTIONS = [
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
  'College 1st Year',
  'College 2nd Year',
  'College 3rd Year',
  'College 4th Year',
  'Other',
] as const

export type ClassOption = (typeof CLASS_OPTIONS)[number]

/**
 * The options to show a member who already has a value stored.
 *
 * If their current value is not in the canonical list - and for most of the
 * roster it is not, because the import wrote bare numbers, and 44 members are
 * in Class 7 or 8 which the picker has never offered - it is prepended so the
 * editor does not silently force them to change their answer just to save an
 * unrelated field. That would be a data-loss bug wearing a tidy-up costume.
 */
export function classOptionsFor(current?: string | null): string[] {
  const v = (current || '').trim()
  if (!v || (CLASS_OPTIONS as readonly string[]).includes(v)) return [...CLASS_OPTIONS]
  return [v, ...CLASS_OPTIONS]
}
