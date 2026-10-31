/**
 * CreateLauncher - the "+" create trigger. Two shells share one behaviour:
 *   `nav` - a "Create" pill in the desktop top-actions row
 *   `fab` - the circular + in the mobile bottom tab bar
 * Pressing it goes STRAIGHT to the post composer (no intermediate menu).
 * Achievements are created from the profile page, not here.
 */

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

type LauncherVariant = 'nav' | 'fab'

interface CreateLauncherProps {
  variant: LauncherVariant
  onPost: () => void
  /** No longer used - achievements are added from the profile. Kept optional so
      existing call sites don't need to change. */
  onAchievement?: () => void
}

export default function CreateLauncher({ variant, onPost }: CreateLauncherProps) {
  if (variant === 'fab') {
    return (
      <button className="aq-tab-fab" onClick={onPost} aria-label="Create a post" title="Create a post" data-mascot-target="compose">
        {/* Pulse ring, decorative. aria-hidden so the label stays the only
            thing a screen reader announces; pointer-events are off in CSS so
            it never steals the tap. */}
        <span className="aq-tab-fab-ring" aria-hidden="true" />
        <PlusIcon />
      </button>
    )
  }
  return (
    <button className="btn btn-sm btn-primary aq-post-btn" onClick={onPost} aria-label="Create a post" data-mascot-target="compose">
      <PlusIcon />
      <span className="aq-post-label">Create</span>
    </button>
  )
}
