/**
 * Local/non-Vercel static server for the built dist/.
 *
 * NOT the deploy path. Vercel serves dist/ directly (vercel.json
 * outputDirectory) and applies its own `headers` block. This file exists for
 * `npm start`: serving a production build on a plain Node host, or locally when
 * you want the real build rather than the dev server.
 *
 * It used to set exactly ONE header (COOP) while vercel.json set six, so the
 * same bytes served through here had no CSP, no X-Frame-Options, no nosniff and
 * no Referrer-Policy. Anyone reasoning about the app's security posture from
 * vercel.json would have been wrong about this path. The headers below are kept
 * deliberately IN STEP with vercel.json - if you change one, change the other.
 * Audit 2026-09-17, security P3.
 */
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Mirrors the `headers` block in /vercel.json for the `/(.*)` source.
// Keep these two lists identical.
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Google OAuth opens a popup and needs to talk back to the opener.
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.clarity.ms https://*.clarity.ms",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clarity.ms https://accounts.google.com",
    "frame-src 'self' https://accounts.google.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join('; '),
};

app.use((req, res, next) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
  next();
});

// Hashed assets and fonts are immutable; everything else revalidates. Same
// intent as vercel.json's per-path Cache-Control rules.
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders(res, filePath) {
    if (/[\\/](assets|fonts)[\\/]/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(svg|png|jpg|jpeg|webp|avif|ico|woff2?|mp4|webm|mov|m4v)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000');
    }
  },
}));

// SPA fallback — serve index.html for all non-file routes.
// Never cached: it is the document every client-only route resolves to, so a
// cached copy pins users to a stale asset manifest after a deploy.
app.get('/{*splat}', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
