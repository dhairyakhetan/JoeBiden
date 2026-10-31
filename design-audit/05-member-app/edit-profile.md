# Edit Profile — `/profile/edit`

**File:** `profile/EditProfilePage.tsx` (332 lines), `EditProfilePage.css`.

## What this page is

**Intent:** updating your name, contact details, school, bio, or photo.

## What's genuinely working

Avatar upload persists the URL server-side and refreshes the auth context immediately, so the nav-bar avatar updates in the same interaction instead of requiring a reload. The bio field is profanity-checked before save with a hard block (correctly reasoned elsewhere in the codebase: bio publishes with no review queue, so this is the only gate). The birthday field's helper text is precise and accurate: "hidden from other members by default — share it from settings," which correctly describes the real toggle on `/settings`.

## Findings

### P1 — The email field is a normal, fully editable input, directly contradicting the policy stated on Register
`RegisterPage.tsx` tells every new member, in its own words: *"signed in as {member?.email} — that part's locked to your google account."* Email is the OAuth-derived identity and isn't meant to be user-editable. This page, though, renders `email` as an ordinary text input (`<input name="email" type="email" value={formData.email} onChange={handleChange}>`) with no `disabled` state, no lock icon, and no explanatory copy — visually identical to every genuinely-editable field around it. A member who "fixes" a typo here and saves will either have the change silently discarded server-side (confusing — the form says "profile updated ✓" while nothing changed) or, if the backend does accept it, drift out of sync with the Google identity that authenticates them. Either outcome is bad, and the field's own affordance gives no hint that it's not like its neighbors. Match Register's treatment: show the email as locked/read-only text with the same "that part's locked to your google account" explanation.
