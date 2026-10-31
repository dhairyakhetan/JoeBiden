import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import type { Plugin } from 'vite'

/**
 * Dev only. Terra Notes shows a team's static web app (the Wisdom Woods demo) in an iframe at a
 * folder address, public/terranotes/editions/.../demo/. Production hosts serve a folder's index.html
 * before any SPA fallback; Vite's dev server does it the other way round and answers with AQ's own
 * index.html, which loads AQ inside the frame. This hands such a folder its own index.html.
 */
const publicFolderIndex = (): Plugin => ({
  name: 'aq-public-folder-index',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url || '').split('?')[0]
      if (!url.startsWith('/terranotes/') || !url.endsWith('/')) return next()
      const file = path.join(__dirname, 'public', decodeURIComponent(url), 'index.html')
      if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file)) return next()
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(fs.readFileSync(file))
    })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), publicFolderIndex()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // The two entry chunks (index ~745kB, ParadoxRoot ~894kB) were large
    // partly because shared vendor libs were duplicated/inlined. Splitting
    // long-lived vendor code into its own chunks (a) shrinks the entry
    // chunks, (b) lets browsers cache vendor separately across deploys
    // (app code changes far more often than React/Supabase), and (c) keeps
    // the heavy paradox-only libs off the main path — they only load when
    // the lazy /paradox route does. Pure build-output change; no runtime
    // or design impact.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // React ecosystem — loaded everywhere, changes rarely.
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('react-router')
          ) return 'vendor-react'
          // framer-motion (v12 splits into motion-dom / motion-utils too).
          if (
            id.includes('framer-motion') ||
            id.includes('motion-dom') ||
            id.includes('motion-utils')
          ) return 'vendor-motion'
          if (id.includes('@supabase')) return 'vendor-supabase'
          // @zxing is the barcode *scanner* — used only by the Paradox admin
          // check-in tab. It used to share a chunk with jsbarcode, which the
          // public per-attendee Ticket page needs, so every paradox visitor
          // downloaded the whole scanner. Split so only the admin route pays.
          if (id.includes('@zxing')) return 'vendor-zxing'
          // jsbarcode renders the ticket barcode (attendee-facing).
          // NOTE: qrcode is intentionally NOT bucketed here — ShareModal (a
          // member-route component) dynamically imports it, so it gets its own
          // tiny async chunk instead of dragging this onto every feed route.
          // (matter-js / poly-decomp / svg-path-commander were listed here but
          // their only consumer, paradox/components/ui/gravity.tsx, was dead
          // code; the files and packages have been removed.)
          if (id.includes('jsbarcode')) return 'vendor-barcode'
        },
      },
    },
  },
})
