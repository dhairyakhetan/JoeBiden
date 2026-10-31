import { useCallback, useEffect, useMemo, useState } from 'react'
import { LinkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useToast } from '../components/Toast'
import { referralService } from '../services/referralService'
import { jobOpenings, type JobOpening } from '../lib/jobOpenings'
import GatedButton from '../components/GatedButton'
import {
  REFERRAL_NOTE_MAX,
  REFERRAL_TTL_DAYS,
  ROLE_REFERRAL_TTL_DAYS,
  buildReferralLink,
  validateNote,
  whatsappShareUrl,
  type Referral,
} from '../lib/referrals'

/**
 * R1, the referrer's side: mint a link, write one line, send it.
 *
 * Design reference AQ Referrals.dc.html card R1. The canvas headline is
 * "bring someone in." and the note field is labelled "a line from you, shown
 * on their sign-in screen".
 *
 * ── THE NOTE IS SHOWN TO AN HoD, NOT TO THE INVITEE ──
 * The canvas prints the note on the invitee's sign-in screen next to the
 * referrer's name. Neither ships. `referrals` SELECT is
 * `referrer_id = current_member_id() OR is_director()`, so the invitee cannot
 * read the row, and there is no opt-in-to-be-named column that would let us
 * print who sent it even if they could. The note is a recommendation the HoD
 * reads beside the application, which is the half of the canvas's claim that
 * is both true and useful. The field label says so, rather than promising the
 * invitee will see it.
 */
export default function InviteComposer({ onCreated }: { onCreated: (r: Referral) => void }) {
  const toast = useToast()

  const [note, setNote] = useState('')
  const [openings, setOpenings] = useState<JobOpening[]>([])
  const [openingUuid, setOpeningUuid] = useState('')
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    jobOpenings.getOpen()
      .then(list => { if (!cancelled) setOpenings(list) })
      // An openings list that fails to load costs the member the role picker,
      // not the invite. No toast: they did not ask for this list.
      .catch(() => { if (!cancelled) setOpenings([]) })
    return () => { cancelled = true }
  }, [])

  const noteError = useMemo(() => validateNote(note), [note])
  const ttl = openingUuid ? ROLE_REFERRAL_TTL_DAYS : REFERRAL_TTL_DAYS

  const mint = useCallback(async () => {
    if (noteError) { toast.error(noteError); return }
    setBusy(true)
    setCopied(false)
    try {
      const openingId = openingUuid ? await referralService.resolveOpeningId(openingUuid) : null
      const referral = await referralService.create({ note, openingId })
      const url = buildReferralLink({
        origin: window.location.origin,
        referralId: referral.id,
        openingUuid: openingUuid || null,
      })
      setLink(url)
      onCreated(referral)
      toast.success('Your invite link is ready.', `It works for ${ttl} days.`)
    } catch (err) {
      toast.error('Could not make that link.', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }, [note, noteError, openingUuid, onCreated, toast, ttl])

  const copy = useCallback(async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Link copied.')
    } catch {
      toast.error('Could not copy.', 'Select the link and copy it by hand.')
    }
  }, [link, toast])

  return (
    <section className="aq-ref-card" aria-labelledby="aq-ref-compose-h">
      <h2 id="aq-ref-compose-h" className="aq-ref-h">bring someone in.</h2>
      <p className="aq-ref-lede">
        Your link travels with your name attached to it in our records, so the team you
        pick reads their application first. It is read no faster than anyone else's.
      </p>

      <label className="aq-ref-label" htmlFor="aq-ref-role">a role, if you have one in mind</label>
      <select
        id="aq-ref-role"
        className="aq-ref-select"
        value={openingUuid}
        onChange={e => { setOpeningUuid(e.target.value); setLink(null) }}
        disabled={busy}
      >
        <option value="">any team, open invite</option>
        {openings.map(o => (
          <option key={o.id} value={o.id}>{o.title}{o.teamName ? ` · ${o.teamName}` : ''}</option>
        ))}
      </select>

      <label className="aq-ref-label" htmlFor="aq-ref-note">
        a line from you, read by the HoD next to their application
      </label>
      <textarea
        id="aq-ref-note"
        className="aq-ref-note"
        rows={3}
        value={note}
        maxLength={REFERRAL_NOTE_MAX + 40}
        onChange={e => { setNote(e.target.value); setLink(null) }}
        placeholder="You'd be good at the design side of this."
        disabled={busy}
        aria-describedby="aq-ref-note-count"
      />
      <div id="aq-ref-note-count" className={`aq-ref-count${noteError ? ' is-over' : ''}`}>
        optional · {note.length}/{REFERRAL_NOTE_MAX}
      </div>

      {/* §11.9 state 11: `mint` already refuses with `noteError` as a toast,
          but the button was disabled so it could never be pressed and the
          message never appeared. Same string, said in place. */}
      <GatedButton type="button" className="aq-ref-btn aq-ref-btn-primary" onClick={mint} disabled={busy} reason={noteError || null}>
        {busy ? 'making your link…' : link ? 'make another link' : 'make my invite link'}
      </GatedButton>

      {link && (
        <div className="aq-ref-linkbox">
          <div className="aq-ref-linkrow">
            <LinkIcon width={14} height={14} strokeWidth={1.8} aria-hidden="true" />
            <code className="aq-ref-link">{link}</code>
          </div>
          <div className="aq-ref-linkmeta">expires in {ttl} days</div>
          <div className="aq-ref-linkactions">
            <button type="button" className="aq-ref-btn aq-ref-btn-ghost" onClick={copy}>
              {copied
                ? <><CheckIcon width={14} height={14} strokeWidth={2.5} aria-hidden="true" /> copied</>
                : 'copy link'}
            </button>
            <a
              className="aq-ref-btn aq-ref-btn-ghost"
              href={whatsappShareUrl(link)}
              target="_blank"
              rel="noopener noreferrer"
            >
              send on whatsapp
            </a>
          </div>
        </div>
      )}
    </section>
  )
}
