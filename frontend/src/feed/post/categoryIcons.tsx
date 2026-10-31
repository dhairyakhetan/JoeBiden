// Category glyphs for the composer and the post detail page.
//
// Section 03 step 1 asks for an `Icon` field on `CategoryFilter.tsx`'s
// CATEGORIES. That file is owned by another surface (post moderation reads it
// too), so the mapping lives here instead, keyed on the SAME `value` strings
// CategoryFilter already exports. Nothing about the write path changes: these
// are render-time glyphs only, and `CategoryFilter.emoji` is left untouched so
// every existing reader keeps working.
//
// Icons are @heroicons/react/24/outline, per the redesign icon rule. Never
// substitute a hand-drawn SVG here.
import {
  BellIcon,
  HeartIcon,
  PencilSquareIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'

type IconCmp = React.ComponentType<React.SVGProps<SVGSVGElement>>

export const CATEGORY_ICON: Record<string, IconCmp> = {
  '': Squares2X2Icon,
  events: BellIcon,
  welfare: HeartIcon,
  content: PencilSquareIcon,
  operations: WrenchScrewdriverIcon,
  labs: BeakerIcon,
}

export const getCategoryIcon = (value: string): IconCmp =>
  CATEGORY_ICON[value] || Squares2X2Icon
