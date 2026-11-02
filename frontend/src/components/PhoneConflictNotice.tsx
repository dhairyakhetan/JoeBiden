import {
  HR_WHATSAPP_DISPLAY,
  HR_WHATSAPP_URL,
  PHONE_CONFLICT_ACTION,
  PHONE_CONFLICT_HEADLINE,
  registeredEmailLine,
} from '../lib/phoneConflict'

/**
 * The "this number belongs to another account" panel, shown under the phone
 * field on registration. Copy lives in lib/phoneConflict.ts so the toast
 * versions elsewhere say exactly the same thing.
 */
export default function PhoneConflictNotice({
  maskedEmail,
  id,
}: {
  maskedEmail: string | null
  id?: string
}) {
  const emailLine = registeredEmailLine(maskedEmail)
  return (
    <div id={id} role="alert" style={{ marginTop: 10 }}>
      <span className="field-error" style={{ display: 'block' }}>{PHONE_CONFLICT_HEADLINE}</span>
      {emailLine && (
        <p className="code" style={{ margin: '8px 0 0', fontWeight: 700, overflowWrap: 'anywhere' }}>{emailLine}</p>
      )}
      <p style={{ margin: '8px 0 0', fontWeight: 600 }}>{PHONE_CONFLICT_ACTION}</p>
      <p className="mono xs muted" style={{ margin: '8px 0 0', textTransform: 'none' }}>
        or, if you&rsquo;re unable to access the registered email id, contact the HR Team (
        <a href={HR_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{HR_WHATSAPP_DISPLAY}</a>
        ) to get your registered email id updated.
      </p>
    </div>
  )
}
