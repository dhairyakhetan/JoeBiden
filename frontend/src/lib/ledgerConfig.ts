// Open Books (/accounts) — approved copy and the figures that don't come
// from the transaction ledger. PRD §3.3/§3.4/§8: reproduce verbatim, don't
// paraphrase, don't hardcode ledger totals anywhere but here (the balance
// sheet has no underlying rows to derive from — everything else is computed
// from public_ledger at render time in AccountsPage.tsx).

/** public_ledger.fy for the period this page shows. PRD §10 lists selectable prior years as follow-up, not v1. */
export const CURRENT_FY = '2026-27'

/** Expense categories, in the fixed editorial order the PRD requires — welfare first, then event costs, then running costs. Not sorted by amount. */
export const EXPENSE_ORDER: string[] = [
  'Welfare, volunteer and on-ground logistics',
  'Sound, lights and DJ',
  'Venue and decor',
  'Prizes and participant costs',
  'Refunds issued to participants',
  'Technology',
  'Stationery and small furniture',
  'Bank fees',
]

/** Income categories, in fixed order (revenue + other income, combined — used for the month-table filter). */
export const INCOME_ORDER: string[] = [
  'Event ticket sales',
  'Contribution from CRFTD',
]

/** Revenue: money earned directly from something sold to a student (event tickets). */
export const REVENUE_ORDER: string[] = [
  'Event ticket sales',
]

/** Income: earnings that reach AquaTerra through a venture rather than a direct sale (CRFTD's after-cost contribution). */
export const OTHER_INCOME_ORDER: string[] = [
  'Contribution from CRFTD',
]

/** Approved category descriptions, verbatim from accounts-reference.html. */
export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'Welfare, volunteer and on-ground logistics':
    'Travel, food and materials for workshops, drives and campaigns, and the cash volunteers spend on the ground while running them.',
  'Sound, lights and DJ':
    "Sound systems, lighting, the DJ's travel and stay, generators, the electrician and event equipment on rent.",
  'Venue and decor':
    'Ground and hall bookings, staging, decor and umbrellas.',
  'Prizes and participant costs':
    'Prize money, trophies and kit handed to the people who competed.',
  'Refunds issued to participants':
    'Money returned for cancelled entries, duplicate payments and withdrawals.',
  'Technology':
    'Website hosting, the member database, and the tools behind CRFTD, ShikshAq and AQ Labs.',
  'Stationery and small furniture':
    'Printing, stationery, small equipment and workshop supplies.',
  'Bank fees':
    'Charges levied by the bank on transfers and payments.',
  'Event ticket sales':
    'Tickets bought by students for Terrathon and Paradox.',
  'Contribution from CRFTD':
    "CRFTD (formerly ROOTS) runs its own books as a venture. It buys stock, sells it, and pays its own fulfilment costs. Only what it earns after all of that flows into AquaTerra, and that is the figure shown here.",
}

/** PRD §3.3 — not derived from public_ledger rows. One place to update. */
export const BALANCE_SHEET = {
  fundsHeld: 59647,
  owedToSuppliers: -82000,
  netPosition: -22353,
  priorFyClosingBalance: 95053,
} as const

/** PRD §3.3 — assets, explicitly not included in the figures above. */
export const ASSETS: { label: string; description: string; value: number }[] = [
  {
    label: 'Merchandise stock held',
    description: 'Unsold t-shirts and prints sitting in inventory, ready to be sold through CRFTD.',
    value: 90000,
  },
  {
    label: 'Colour printer',
    description: 'Used for marketing collateral and print media, in-house rather than outsourced.',
    value: 35000,
  },
  {
    label: 'DTF printer',
    description: 'Prints CRFTD merchandise directly, which removes a cost that used to go to a third party on every order.',
    value: 9000,
  },
]

export const ASSETS_TOTAL = ASSETS.reduce((sum, a) => sum + a.value, 0)

export const PERIOD_LABEL = { fy: 'FY 2026–27', range: '1 Apr – 28 Aug 2026' }
