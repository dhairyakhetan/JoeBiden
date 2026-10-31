# Settings — `/settings`

**File:** `auth/SettingsPage.tsx` (209 lines), `SettingsPage.css`.

## What this page is

**Intent:** a member managing their account, checking on notification/privacy controls, or leaving.

## What's genuinely working

Two specific, named anti-slop decisions stand out. First, native `window.alert`/`window.confirm` were deliberately replaced with themed dialogs, with the reasoning given directly in comments: native browser dialogs "break the brutalist visual language," "can be blocked by some iOS gestures," and can't carry the danger-red treatment the surrounding UI uses — a real, specific rationale, not a generic "use nicer modals" note. Second, and more relevant to the anti-slop direction specifically: the Notifications, Privacy, and Appearance tabs used to have disabled toggle controls with "Coming soon" tooltips and "SOON" chips — the exact kind of dead affordance this whole audit flags elsewhere (buttons that invite a click they can't fulfill). The comment names the fix as "the no-coming-soon rule": those dead toggles are gone, replaced with honest prose stating plainly what isn't built yet. That's the anti-slop instinct in its purest form — not just "less decoration," but "no fake controls."

## Findings

### P2 — "Deactivate" and "delete" look like ordinary in-app buttons but both trigger a manual, multi-day, email-based process
Both buttons are styled identically to every other action button in the app — same shape, same weight, same hover behavior — but neither one actually does anything in-app: "deactivate" only shows a toast asking the member to message a director, and "delete" opens a `mailto:` link to request deletion by email, processed within 30 days. Nothing about the button itself signals that pressing it starts a multi-day, out-of-app process rather than an immediate action — a member could reasonably expect "delete account permanently" to actually delete something, or at least open a form, not their email client. This may well be a deliberate human-reviewed policy (consistent with the org's broader "a real person reviews everything" ethos, like `APPROVAL_TIME`), but the affordance doesn't communicate that at the point of the click — a short line under each button ("opens your email app," "a director handles this manually") would close the gap cheaply.

### P2 — Two of six tabs ("account" and "profile") show nearly identical content
Both render a one-sentence description and the same "edit profile →" button pointing at the same destination. Not harmful, just a thin distinction that could be one tab instead of two.
