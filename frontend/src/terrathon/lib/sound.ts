/**
 * The success sound. PRD 6.5 (P1).
 *
 * ONE REAL RECORDING, ALL THREE SPORTS (2026-09-21). This replaced three
 * synthesised Web Audio cues -- a bat crack, a paddle rally, a chant pulse --
 * on a direct call from the organisers: the moment a captain finishes
 * registering should sound like a crowd, not like a sport. The three cues were
 * cheaper (zero bytes, no licence) but they read as sound effects, and a
 * synthesised cheer never convinces anyone.
 *
 * WHY AN <audio> ELEMENT AND NOT A DECODED BUFFER. A decoded AudioBuffer would
 * have to download and decode the whole file before the first sample plays,
 * which on a phone on the venue wifi is exactly the wrong tradeoff for a cue
 * that must land the instant the screen appears. An element streams and starts
 * on the first buffered frame.
 *
 * WHY IT IS CUT SHORT. The source runs about ten seconds. Ten seconds of
 * applause on a confirmation screen stops being a celebration and becomes
 * something you look for the mute button for, so playback fades out over the
 * last 700ms of a PLAY_MS window and stops. The file is not re-encoded; the
 * trim lives here so the asset stays whatever the organisers hand over.
 *
 * iOS Safari blocks audio that starts outside a user gesture, and the success
 * moment fires AFTER a network round trip, by which point the gesture has
 * expired. `unlock()` is therefore called synchronously on the submit tap: it
 * primes the element with a muted play/pause while the gesture is still live,
 * so playback a second later is allowed. It is also the only thing that
 * triggers the download, so a visitor who only browses never pays for it.
 *
 * Defaults ON (2026-09-21, reversing the 2026-09-19 call to default it off).
 * The sound only ever fires on the success screen, after someone has pressed
 * Register, so it cannot ambush a reader who is only browsing: the one moment
 * it plays is the moment they were expecting something to happen.
 *
 * An explicit opt-out still wins. The store holds '1' or '0', and only a
 * literal '0' turns it off, so someone who has muted it stays muted while
 * everyone who has never touched the control now gets the sound.
 */

// v2, bumped with the default flip on 2026-09-21.
//
// Flipping isSoundOn() to default ON was not enough on its own. Every browser
// that had already loaded the section under the old default carried a stored
// '0', either because someone tried the toggle or because the control wrote
// one, and an explicit '0' still wins. Those opt-outs were recorded against a
// different default, so the people holding them never actually chose silence
// over sound; they were silent already. A new key discards exactly those and
// leaves the real decision to be made once, under the new default.
const STORE_KEY = 'tt_sound_on_v2'

const SRC = '/terrathon/cheer.mp3'

/** How much of the cheer actually plays, including the fade. */
const PLAY_MS = 4200
const FADE_MS = 700
/** The check-in desk's much shorter cut. */
const ADMIT_MS = 900
/** Well under a phone speaker's ceiling: this is a confirmation, not a goal. */
const PEAK = 0.55

let el: HTMLAudioElement | null = null
let timers: number[] = []

function audio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
  if (el) return el
  try {
    el = new Audio(SRC)
    el.preload = 'auto'
    el.volume = PEAK
  } catch {
    return null
  }
  return el
}

function clearTimers(): void {
  for (const t of timers) window.clearTimeout(t)
  timers = []
}

export function isSoundOn(): boolean {
  // Absent means ON. Reading `=== '1'` would have made every fresh visitor a
  // muted one, which is the behaviour this reverses. The catch still returns
  // the default rather than false: private mode should sound like normal mode,
  // not like someone chose to mute.
  try { return localStorage.getItem(STORE_KEY) !== '0' } catch { return true }
}

export function setSoundOn(on: boolean): void {
  try { localStorage.setItem(STORE_KEY, on ? '1' : '0') } catch { /* private mode */ }
  if (on) unlock()
  else stop()
}

/** Call from inside a real user gesture (the submit tap). Safe to call often. */
export function unlock(): void {
  const a = audio()
  if (!a) return
  try {
    a.muted = true
    const p = a.play()
    if (p && typeof p.then === 'function') {
      void p.then(() => { a.pause(); a.currentTime = 0; a.muted = false })
        .catch(() => { a.muted = false })
    } else {
      a.pause(); a.currentTime = 0; a.muted = false
    }
  } catch {
    a.muted = false
  }
}

/** Cut it off early, e.g. when someone mutes mid-cheer or leaves the screen. */
export function stop(): void {
  clearTimers()
  if (!el) return
  try { el.pause(); el.currentTime = 0; el.volume = PEAK } catch { /* nothing to stop */ }
}

/**
 * The same cheer for cricket, pickleball and FIFA. The argument is kept so
 * every call site stays unchanged and so a per-sport clip can be reintroduced
 * here alone if the organisers ever record three.
 */
export function playSuccess(_sport?: unknown): void {
  play(PLAY_MS, PEAK)
}

/**
 * The gate desk's version: the same cheer, cut to under a second and quieter.
 * A check-in scan happens once per arriving player, sometimes seconds apart,
 * and a four-second crowd for each one turns a celebration into a nuisance for
 * the volunteer holding the phone. Registration happens once per captain, so
 * that one gets the full cheer.
 */
export function playAdmit(): void {
  play(ADMIT_MS, PEAK * 0.6)
}

function play(runMs: number, peak: number): void {
  if (!isSoundOn()) return
  const a = audio()
  if (!a) return
  try {
    clearTimers()
    a.currentTime = 0
    a.volume = peak
    a.muted = false
    const p = a.play()
    if (p && typeof p.then === 'function') p.catch(() => { /* still blocked; silence is fine */ })

    // Fade rather than a hard stop: an applause track chopped mid-clap is more
    // noticeable than the applause itself.
    const fade = Math.min(FADE_MS, runMs * 0.5)
    const steps = 14
    for (let i = 1; i <= steps; i++) {
      timers.push(window.setTimeout(() => {
        if (el) el.volume = Math.max(0, peak * (1 - i / steps))
      }, runMs - fade + (fade / steps) * i))
    }
    timers.push(window.setTimeout(stop, runMs + 40))
  } catch {
    // A failed celebration must never surface as an error on a successful
    // registration. Same reasoning as notificationService.create being
    // deliberately non-throwing.
  }
}

/** Named for call sites where a bare `stop` would read ambiguously. */
export { stop as stopSound }
