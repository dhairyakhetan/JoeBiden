import './SettingsPage.css'
import { useState } from 'react'
import { effectsEnabled, setEffectsEnabled, celebrate } from '../lib/delight'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import Toggle from '../components/Toggle'
import ContactNumberFields from '../components/ContactNumberFields'
import profileService from '../services/profileService'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'

export default function SettingsPage() {
  useMeta(pageMetadata.settings)
  const [tab, setTab] = useState('account')
  const [fx, setFx] = useState(() => effectsEnabled())
  const { member, logout, refreshMember } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [savingBirthdayPublic, setSavingBirthdayPublic] = useState(false)
  const [savingPublicProfile, setSavingPublicProfile] = useState(false)

  const handleTogglePublicProfile = async (next: boolean) => {
    setSavingPublicProfile(true)
    try {
      await profileService.setPublicProfile(next)
      await refreshMember()
      toast.success(next ? 'your profile is visible to everyone again.' : 'people who aren\'t signed in now see only your name.')
    } catch (e: any) {
      toast.error(e?.message || 'couldn\'t change that. try again.')
    } finally {
      setSavingPublicProfile(false)
    }
  }

  const handleToggleBirthdayPublic = async (next: boolean) => {
    setSavingBirthdayPublic(true)
    try {
      await profileService.updateProfile({ birthdayPublic: next })
      await refreshMember()
      toast.success(next ? 'birthday shared with the community.' : 'birthday hidden again.')
    } catch (e: any) {
      toast.error("that didn't save.", e?.message)
    } finally {
      setSavingBirthdayPublic(false)
    }
  }

  // Replaces the native `window.alert(...)` deactivate dialog. Native
  // alert/confirm break the brutalist visual language + can be blocked
  // by some iOS gestures + can't carry the "danger zone" red treatment.
  const handleDeactivate = () => {
    toast.info(
      'Message a Director to deactivate',
      'They will process the request within 48 hours.',
    )
  }

  // Replaces the native `window.confirm(...)` permanent-delete prompt.
  // Uses the danger variant - tomato red CTA to match the surrounding
  // danger-zone styling.
  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete account permanently?',
      body: 'This is irreversible. To permanently delete your account, email aquaterrakolkata@gmail.com with your account email. We process all deletion requests within 30 days.',
      confirmLabel: 'Open email',
      cancelLabel: 'Cancel',
      danger: true,
    })
    if (ok) {
      window.open('mailto:aquaterrakolkata@gmail.com?subject=Account Deletion Request')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const tabs = ['account', 'profile', 'privacy', 'appearance', 'danger']

  return (
    <div className="route-enter aq-wrap" style={{ paddingTop: 'clamp(28px,5vw,48px)', paddingBottom: 80 }}>
      <span className="sticker sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ SETTINGS</span>
      <h1 className="h-display" style={{ fontSize: 'clamp(52px, 8vw, 84px)', margin: '12px 0 32px', lineHeight: 0.9 }}>
        you<span style={{ color: 'var(--welfare-ink)' }}>.</span>
      </h1>
      <div className="settings-layout">
        <aside className="settings-nav">
          {tabs.map(t => (
            <button
              key={t}
              className={'settings-link ' + (tab === t ? 'active' : '')}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </aside>
        <section className="card" style={{ padding: 28 }}>
          {tab === 'account' && (
            <div className="col gap-3">
              <h3 className="h-display" style={{ fontSize: 28, margin: 0 }}>account.</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>
                Update your name, school, and contact details from your profile editor.
              </p>
              {/* 2026-09-10: radius 12 was off the 999/32/22/14 spine, and the
                  2px border was already being neutered by v6.css's
                  `.card { border-width: 1px !important }` - so the file said one
                  thing and the browser rendered another. Both stated honestly now. */}
              <div className="card" style={{ padding: '14px 18px', background: 'var(--bg-2)', border: 'var(--hair-2)', borderRadius: 'var(--r-tight)' }}>
                <div className="mono xs upper muted" style={{ marginBottom: 4 }}>logged in as</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{member?.full_name}</div>
                <div className="mono xs muted">{member?.email}</div>
              </div>
              <Link to="/profile/edit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                edit profile →
              </Link>

              {/* Contact numbers live HERE rather than in the profile editor
                  because they are not profile content: they are never shown
                  on a profile, and `members.phone` / `members.guardian_phone`
                  are both UPDATE-only for the authenticated role (no SELECT
                  grant — verified live 2026-09-07), so they are the one part
                  of "your details" the member cannot simply see listed.

                  The member must be able to CHANGE their number, and must
                  have a genuine alternative to giving their own at all: on a
                  platform whose members are 14–19, a guardian's number is an
                  equally-weighted option, not a fallback. Both affordances
                  are the same component the in-feed profile nudge uses, so
                  the two can never drift apart. */}
              <div style={{ borderTop: '1px solid var(--line)', margin: '10px 0 2px' }} />
              <h4 className="h-display" style={{ fontSize: 20, margin: 0 }}>whatsapp number.</h4>
              <p style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                this is how AquaTerra reaches you about drives and events. give your own
                number or a parent/guardian&rsquo;s — either works, and you can change it
                whenever you like.
              </p>
              <ContactNumberFields />
            </div>
          )}
          {tab === 'profile' && (
            <div className="col gap-3">
              <h3 className="h-display" style={{ fontSize: 28, margin: 0 }}>profile.</h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>
                Edit your bio, avatar, and public profile from the profile editor.
              </p>
              <Link to="/profile/edit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                edit profile →
              </Link>
            </div>
          )}
          {tab === 'privacy' && (
            <div className="col gap-3">
              <h3 className="h-display" style={{ fontSize: 28, margin: 0 }}>privacy.</h3>
              <p className="muted">All AquaTerra posts are public by design. That's the point. But you control your profile.</p>

              {/* flexWrap so the switch's reason line (§11.9 state 11) drops
                  to its own row instead of squeezing the switch. */}
              <div className="card" style={{ padding: '16px 18px', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>share my birthday with the community</div>
                  <p style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: 46 + 'ch' }}>
                    off by default for every member - you're opting in. when on, other members can see your birthday.
                  </p>
                </div>
                {/* §11.9 state 11. The sentence below the switch was already
                    here and is unchanged - it has just moved INTO the switch as
                    its `reason`, which is what makes it reachable: a natively
                    `disabled` switch is out of the tab order, so a keyboard or
                    screen-reader user could never get to the control the
                    sentence was explaining. `savingBirthdayPublic` stays a
                    plain `disabled` - being mid-save is not an eligibility
                    rule, it is a busy state. */}
                <Toggle
                  checked={!!member?.birthday_public}
                  onChange={handleToggleBirthdayPublic}
                  disabled={savingBirthdayPublic}
                  reason={!member?.birthday ? (
                    <>set your birthday on the <Link to="/profile/edit" style={{ color: 'var(--welfare-ink)', textDecoration: 'underline' }}>profile editor</Link> first.</>
                  ) : null}
                  ariaLabel="share my birthday with the community"
                />
              </div>

              <div className="card" style={{ padding: '16px 18px', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>show my profile to people who aren't signed in</div>
                  <p style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: 52 + 'ch' }}>
                    on: anyone can see your photo, bio, class and school on your public profile. off: people who aren't signed in see only your name.
                    signed-in members still see your full profile, and teams and projects still list you by name.
                  </p>
                </div>
                <Toggle
                  checked={(member as any)?.public_profile !== false}
                  onChange={handleTogglePublicProfile}
                  disabled={savingPublicProfile}
                  ariaLabel="show my profile to people who aren't signed in"
                />
              </div>
            </div>
          )}
          {tab === 'appearance' && (
            <div className="col gap-2">
              <h3 className="h-display" style={{ fontSize: 28, margin: 0 }}>appearance.</h3>
              {/* Only one theme actually ships (paper-bold light) and there is no
                  theme switcher wired anywhere in the app, so the old disabled
                  "Night Mode"/"Mint Fresh" cards were dead placeholder controls
                  (title="Coming soon" + "SOON" chip). Per the no-coming-soon rule
                  they're removed: the live theme is shown as a plain status card,
                  and future themes are described in honest prose - the accepted
                  pattern here, matching the alerts/privacy tabs - rather than
                  dangled as buttons that do nothing. */}
              <p className="muted">AquaTerra runs in one look - paper-bold light mode. That's the only design this app ships in for now.</p>
              <div className="row gap-2 flex-wrap" style={{ marginTop: 8 }}>
                <div className="card" style={{ padding: '12px 18px', background: 'var(--bg)', color: 'var(--ink)', border: 'var(--hair-2)' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>Paper Bold</div>
                  <div className="mono xs upper" style={{ marginTop: 4, opacity: 0.6 }}>active</div>
                </div>
              </div>

              {/* Celebrations (confetti, hearts, sparkles) after finishing something. Off by this switch or by the device's
                  reduced-motion setting; lib/delight.ts is the only place that decides. */}
              <div className="card" style={{ padding: '16px 18px', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>fun effects</div>
                  <p style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: 46 + 'ch' }}>
                    confetti, hearts and sparkles when you finish a task, like a post or hit a milestone. turns itself off if your device asks for reduced motion.
                  </p>
                </div>
                <Toggle
                  checked={fx}
                  onChange={next => {
                    setEffectsEnabled(next)
                    setFx(next)
                    if (next) celebrate('stars', { x: window.innerWidth / 2, y: 220 })
                  }}
                  ariaLabel="fun effects"
                />
              </div>
            </div>
          )}
          {tab === 'danger' && (
            <div className="col gap-3">
              <h3 className="h-display" style={{ fontSize: 28, margin: 0, color: 'var(--tomato-ink)' }}>danger zone.</h3>
              {/* Tomato-bordered danger-zone card - visually quarantines the
                  destructive actions from the rest of settings. */}
              {/* 2026-09-10: the radius said `var(--r, 14px)`, but --r resolves
                  to --r-md = 22 - the fallback described a value this never
                  rendered. Stated directly now. The 2px --tomato edge STAYS: the
                  retired-motif rule is about 2px INK chrome, and this is a
                  semantic danger quarantine, not decoration. */}
              <div className="col gap-3" style={{ border: '2px solid var(--tomato)', borderRadius: 'var(--r-inner)', padding: 20, background: 'rgba(255,77,46,0.04)' }}>
                <button className="btn" onClick={handleLogout}>log out</button>
                <button
                  className="btn"
                  style={{ borderColor: 'var(--tomato)', color: 'var(--tomato-ink)' }}
                  onClick={handleDeactivate}
                >
                  deactivate account
                </button>
                <button
                  className="btn"
                  style={{ background: 'var(--tomato)', color: '#fff', border: 'none' }}
                  onClick={handleDelete}
                >
                  delete account permanently
                </button>
                <p className="small muted">deleting is irreversible. your posts stay (anonymized). your profile and private data is wiped within 30 days.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
