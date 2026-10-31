/**
 * UPI intent links.
 *
 * Built with encodeURIComponent rather than URLSearchParams on purpose:
 * URLSearchParams encodes a space as `+`, and several UPI apps read that as a
 * literal plus in the payee name and the transaction note. "Team+AquaTerra"
 * shows up on the payer's confirmation screen, and a mangled note breaks the
 * reference-code matching that the whole manual-UPI reconciliation depends on.
 */
import { UPI } from '../config'

export function upiLink(amountInr: number, refCode: string): string {
  const p = [
    `pa=${encodeURIComponent(UPI.vpa)}`,
    `pn=${encodeURIComponent(UPI.payeeName)}`,
    `am=${amountInr.toFixed(2)}`,
    `cu=INR`,
    `tn=${encodeURIComponent(refCode)}`,
  ].join('&')
  return `upi://pay?${p}`
}

/**
 * Instagram's in-app browser frequently refuses to hand a `upi://` link to a
 * UPI app, and it is the primary arrival channel for this audience. When we
 * detect it, the pay card leads with the QR and the copyable VPA instead of the
 * one-tap button, and tells the user how to escape to a real browser.
 *
 * Deliberately a heuristic on the UA string: there is no reliable feature test
 * for "will this hand off a custom scheme", and getting it wrong costs only a
 * reordered card, never a blocked payment.
 */
export function isInAppBrowser(ua: string = navigator.userAgent): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat/i.test(ua)
}

export function isIos(ua: string = navigator.userAgent): boolean {
  return /iPad|iPhone|iPod/.test(ua)
}

/** The escape hatch wording differs by platform because the menu does. */
export function inAppHint(ua: string = navigator.userAgent): string {
  return isIos(ua)
    ? 'For one-tap UPI, open this page in Safari: tap the menu, then Open in browser.'
    : 'For one-tap UPI, open this page in Chrome: tap the menu, then Open in browser.'
}
