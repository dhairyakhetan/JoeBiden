import { useMemo } from 'react'
import guideHtml from '../../../docs/product-guide-leaders.html?raw'
import { AdminLayout, AdminTabHeader } from './adminKit'
import './ProductGuide.css'

/**
 * HoD desk, reference group: the product guide, for leaders only (owner, 2026-11-02).
 *
 * The page itself is generated, not written here: docs/product-guide-leaders.html is built from the code,
 * frontend/scripts/feature-map/features.json and desk-audit.json by scripts/feature-map/generate.mjs and re-made
 * every session (CLAUDE.md, "The living product guide"). It is the shareable guide PLUS what only leaders should
 * see: a working/partly/retired status on every feature and a flow map and findings for every desk. The shareable
 * docs/product-guide.html never carries any of that. This desk only shows it, in a sandboxed frame so its own styles and
 * script cannot touch the desk and the desk cannot touch them. `allow-scripts` without `allow-same-origin` gives
 * the guide's filters and map their script and nothing else: no cookies, no storage, no access to the session.
 *
 * Gate: a plain leader desk ('leader' in deskAccess.ts), so the route guard, the nav rail and the roles matrix all
 * agree. The guide lists staff desks and who may use them, which is why it is not a public page.
 */
export default function ProductGuide() {
  // One stable string so the frame does not reload when the desk re-renders.
  const doc = useMemo(() => guideHtml, [])
  return (
    <AdminLayout wide>
      <AdminTabHeader
        label="reference"
        title="Product guide"
        subtitle="Everything the site can do, whether it works right now, who it is for, what connects to what, and how every desk behaves. It rebuilds from the code, so it stays current."
      />
      <iframe
        className="pguide-frame"
        title="AquaTerra product guide"
        srcDoc={doc}
        sandbox="allow-scripts"
        loading="lazy"
      />
    </AdminLayout>
  )
}
