import { FONT } from '../styles/fonts.js';

// A plain placeholder box where AQ's nav bar will be, drawn only on the magazine's own site while it shows AQ's look
// (src/host.js AQ_LOOK; ?aq=0 hides it), so the pages can be checked as they will sit inside AQ's website. Inside AQ
// this is not drawn: AQ's real nav is there.
//
// FOR CLAUDE IN AQ'S WEBSITE REPO, when integrating the magazine:
//   1. Nothing to build here. Keep AQ's own nav (<AQNav>) and phone dock (<MobileMenuBar>) on /terranotes pages as on
//      every other page: PublicLayout.tsx already draws them; do NOT hide them for /terranotes.
//   2. The magazine leaves room for the nav itself: its own header is hidden but keeps its box (80px on laptops, 64px
//      on phones) at the top of every page, under AQ's fixed nav. So <main> must NOT add AQ's usual nav padding on
//      /terranotes pages (PublicLayout.tsx skips it there today: keep it that way).
//   3. The magazine's "← Back to home" pill sits a little under the nav, at top: var(--nav-h) + 30px. Keep AQ setting
//      --nav-h on :root (70px, 62px at ≤760px) to the nav's real height, or the pill will overlap it.
//   4. AQ's phone dock covers the foot of the screen; the magazine has no footer of its own, so AQ's footer should
//      keep its usual room for the dock (isBottomNavHidden() must stay false for /terranotes).
//   5. Check it: `npm run dev`, open /terranotes and an article at 1440px and 390px; the pill and the page's top
//      should sit just under AQ's nav, nothing hidden behind it.
// Don't edit this file in AQ's repo: it comes from the TerraNotes repo (tools/export-aq.mjs).
export default function AqNavSlot() {
  return (
    <div role="presentation" style={{ position: "fixed", left: "0", right: "0", top: "0", zIndex: "60", height: "70px", boxSizing: "border-box", padding: "8px 12px", pointerEvents: "none" }}>
      <div style={{ height: "100%", boxSizing: "border-box", border: "2px dashed var(--slotLine)", borderRadius: "999px", background: "var(--cream)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT.mono, fontSize: "11px", letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--muted)" }}>
        AQ’s nav bar goes here
      </div>
    </div>
  );
}
