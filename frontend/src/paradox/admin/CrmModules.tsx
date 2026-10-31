// @ts-nocheck
// ─── Paradox OS · Phases 10-11 — Sponsors / Schools CRMs + Logistics/Vendors ──
// Thin column configs over the reusable RecordsModule grid. Closes: duplicated/
// invalid sponsor CRM with zero follow-up, untracked school outreach, vendor
// cracks (plug/pin/timings), and "conveyed to X" logistics ambiguity.
import { RecordsModule } from './RecordsModule'

export function SponsorsModule({ canEdit = true }) {
  return (
    <div className="px-4 sm:px-6 py-4">
      <RecordsModule
        canEdit={canEdit} table="paradox_sponsors" title="Sponsorship CRM"
        subtitle="mailed → replied → follow-up · flag known-bad emails · nobody slips"
        searchKeys={['company', 'contact_name', 'email', 'tier', 'status', 'owner']}
        columns={[
          { key: 'company', label: 'Company' },
          { key: 'contact_name', label: 'Contact' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'tier', label: 'Tier' },
          { key: 'status', label: 'Status', type: 'select', options: ['prospect', 'mailed', 'replied', 'followup', 'closed', 'dead'] },
          { key: 'owner', label: 'Owner' },
          { key: 'known_bad', label: 'Bad email?', type: 'bool' },
          { key: 'last_contact', label: 'Last contact', type: 'date' },
          { key: 'deliverables', label: 'Deliverables' },
          { key: 'remarks', label: 'Remarks' },
        ]}
      />
    </div>
  )
}

export function SchoolsModule({ canEdit = true }) {
  return (
    <div className="px-4 sm:px-6 py-4">
      <RecordsModule
        canEdit={canEdit} table="paradox_schools" title="Schools CRM"
        subtitle="per-school outreach · texted / called / committed · owned"
        searchKeys={['name', 'category', 'contact_name', 'status', 'owner']}
        columns={[
          { key: 'name', label: 'School' },
          { key: 'category', label: 'Category' },
          { key: 'contact_name', label: 'Contact' },
          { key: 'contact_phone', label: 'Phone' },
          { key: 'owner', label: 'Owner' },
          { key: 'status', label: 'Status', type: 'select', options: ['prospect', 'contacted', 'committed', 'declined'] },
          { key: 'texted', label: 'Texted', type: 'bool' },
          { key: 'called', label: 'Called', type: 'bool' },
          { key: 'remarks', label: 'Remarks' },
        ]}
      />
    </div>
  )
}

export function LogisticsModule({ canEdit = true }) {
  return (
    <div className="px-4 sm:px-6 py-4 flex flex-col gap-8">
      <RecordsModule
        canEdit={canEdit} table="paradox_logistics_items" title="Logistics roll-up"
        subtitle="cross-event procurement & printing · one owner · due · status"
        searchKeys={['item', 'category', 'owner', 'source']}
        columns={[
          { key: 'item', label: 'Item' },
          { key: 'category', label: 'Category' },
          { key: 'qty', label: 'Qty' },
          { key: 'source', label: 'Source', type: 'select', options: ['print_internal', 'buy', 'borrow', 'vendor'] },
          { key: 'owner', label: 'Owner' },
          { key: 'due_at', label: 'Due', type: 'date' },
          { key: 'status', label: 'Status', type: 'select', options: ['todo', 'blocked', 'done'] },
        ]}
      />
      <RecordsModule
        canEdit={canEdit} table="paradox_stalls" title="Stalls & Vendors"
        subtitle="advance/total · power · pin · timings · layout — the vendor cracks"
        searchKeys={['name', 'vendor_contact']}
        columns={[
          { key: 'name', label: 'Stall' },
          { key: 'vendor_contact', label: 'Vendor contact' },
          { key: 'advance', label: 'Advance', type: 'num' },
          { key: 'total', label: 'Total', type: 'num' },
          { key: 'power_needs', label: 'Power' },
          { key: 'location_pin', label: 'Pin' },
          { key: 'timings', label: 'Timings' },
          { key: 'layout_slot', label: 'Layout' },
          { key: 'confirmed', label: 'Confirmed', type: 'bool' },
        ]}
      />
      <RecordsModule
        canEdit={canEdit} table="paradox_venues" title="Venues"
        subtitle="capacity · power · lift · sound · license"
        searchKeys={['name', 'status']}
        columns={[
          { key: 'name', label: 'Venue' },
          { key: 'capacity', label: 'Cap', type: 'num' },
          { key: 'est_cost', label: 'Est. cost', type: 'num' },
          { key: 'power_load', label: 'Power' },
          { key: 'has_lift', label: 'Lift', type: 'bool' },
          { key: 'has_sound', label: 'Sound', type: 'bool' },
          { key: 'availability', label: 'Availability' },
          { key: 'license_status', label: 'License' },
          { key: 'status', label: 'Status', type: 'select', options: ['prospect', 'held', 'confirmed', 'dropped'] },
        ]}
      />
    </div>
  )
}
