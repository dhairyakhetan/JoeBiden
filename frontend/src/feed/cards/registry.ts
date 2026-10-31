/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SECTION 10 · the registry
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Shape id to component. `Record<CardShape, ComponentType<CardProps>>` is
   exhaustive by type, so adding a 31st shape to the union without adding a
   component here is a compile error rather than a runtime blank.

   This is what makes section 10 step 5 possible: a dispatcher calls
   chooseCardShape, looks the result up here, and renders it. Nothing else in
   the app needs to know 30 component names.

   Kept separate from index.ts so FeedCard can import the registry without
   importing the barrel that re-exports FeedCard.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import type { ComponentType } from 'react'
import type { CardShape } from '../../lib/feedShape'
import type { CardProps } from './types'

import { CardOffline, CardPinned, CardSkeleton } from './family00Chrome'
import { CardBirthday, CardBreak, CardWelcome } from './family01Moments'
import { CardCountdown, CardOpening, CardPoll, CardReferral, CardVolunteerAsk } from './family02Asks'
import {
  CardAchievement, CardCertificate, CardClass, CardDrive, CardDrop, CardProject, CardProjectDone,
} from './family03Records'
import { CardLongRead } from './family04Editorial'
import {
  CardCollection, CardColourBlock, CardHero, CardQuote, CardStandard, CardText,
} from './family05Posts'
import { CardMilestone, CardRoundup, CardSpotlight } from './family06Digest'
import { CardCaughtUp, CardCompact } from './family07Fallback'

export const CARD_COMPONENTS: Record<CardShape, ComponentType<CardProps>> = {
  C01: CardHero,
  C02: CardColourBlock,
  C03: CardStandard,
  C04: CardCollection,
  C05: CardQuote,
  C06: CardLongRead,
  C07: CardText,
  C08: CardPinned,
  C09: CardDrive,
  C10: CardProject,
  C11: CardProjectDone,
  C12: CardAchievement,
  C13: CardCertificate,
  C14: CardWelcome,
  C15: CardBirthday,
  C16: CardBreak,
  C17: CardSpotlight,
  C18: CardReferral,
  C19: CardOpening,
  C20: CardClass,
  C21: CardDrop,
  C22: CardRoundup,
  C23: CardOffline,
  C24: CardSkeleton,
  C25: CardCompact,
  C26: CardPoll,
  C27: CardCountdown,
  C28: CardMilestone,
  C29: CardCaughtUp,
  C30: CardVolunteerAsk,
}
