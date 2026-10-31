import { useState } from 'react';
import { track } from '../lib/analytics.js';
import { FONT } from '../styles/fonts.js';

// The end of an article page (both layouts, under the "words by" box): one Share button. It opens the phone's own share
// sheet (navigator.share: WhatsApp, Instagram, messages…); where there is none (most laptops) it copies the link.
// The link is the page's own address, so inside AQ's website it shares AQ's.
export default function PassItOn({ a, web }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${location.origin}${location.pathname}`;
    if (navigator.share) {
      try { await navigator.share({ title: a.title, text: a.dek, url }); track('Shared', { article: a.slug, method: 'share sheet' }); } catch { /* closed: fine */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2200); track('Shared', { article: a.slug, method: 'copy link' }); } catch { /* no clipboard: fine */ }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: web ? "18px" : "14px", marginTop: web ? "18px" : "16px" }}>
      <button type="button" className="press btn" onClick={share} style={{ "--c": "var(--yellow)", fontFamily: FONT.mono, fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", fontSize: web ? "12px" : "11px", minHeight: "44px", padding: "0 18px", flexShrink: "0", background: "var(--ink)", color: "var(--card)", border: "2px solid var(--ink)", boxShadow: "4px 4px 0 var(--yellow)", cursor: "pointer" }}>{copied ? 'Link copied ✓' : 'Share ↗'}</button>
      <span style={{ fontFamily: FONT.hand, fontSize: web ? "22px" : "19px", lineHeight: "1.1", color: "var(--hand)" }}>{copied ? 'paste it anywhere' : 'liked it? send it to someone'}</span>
    </div>
  );
}
