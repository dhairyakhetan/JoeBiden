import './CoreBadge.css'

/**
 * The AQ Core badge (bug tracker 081395e9). One look everywhere it appears:
 * profiles, the member list, the HoD desk and the Core Team page.
 */
export default function CoreBadge({ size = 'sm', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  return (
    <span
      className={`aq-core-badge aq-core-badge--${size} ${className}`.trim()}
      title="AQ Core: one of AquaTerra's core members"
    >
      AQ Core
    </span>
  )
}
