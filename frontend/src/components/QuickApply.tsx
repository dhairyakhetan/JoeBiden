import './QuickApply.css'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useToast } from './Toast'
import { jobOpenings, type JobOpening } from '../lib/jobOpenings'
import ApplyModal from '../public/ApplyModal'

/**
 * One tap from any role card to the apply form: no role page in between. Signed-out visitors are sent to sign in
 * (they sign in only when they press send); someone who already applied is told so.
 * The button sits above the card's stretched link, so pressing it never also opens the role page.
 */
export default function QuickApply({ op, className = '' }: { op: JobOpening; className?: string }) {
  const { member } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)

  // The form opens at once, for signed-in and signed-out visitors alike. Whether this member already applied is checked
  // in the background; if so the form closes with a note instead of making them fill it in.
  function go(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
    if (member) {
      jobOpenings.hasApplied(op.id, member.member_id)
        .then(applied => { if (applied) { setOpen(false); toast.info('you already applied for this role.') } })
        .catch(() => { /* the form's own submit reports a duplicate */ })
    }
  }

  return (
    <>
      <button type="button" className={'quick-apply ' + className} onClick={go} aria-label={`apply for ${op.title}`}>
        apply <span aria-hidden>↗</span>
      </button>
      {open && <ApplyModal op={op} member={member ?? null} onClose={() => setOpen(false)} onApplied={() => setOpen(false)} />}
    </>
  )
}
