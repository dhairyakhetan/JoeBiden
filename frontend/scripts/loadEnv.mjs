/**
 * Load frontend/.env into process.env for the build-time Node scripts.
 *
 * WHY THIS EXISTS
 *
 * Vite loads .env for the CLIENT bundle, but the build chain also runs four
 * plain Node scripts (compute-org-facts, generate-sitemap, verify-sitemap,
 * prerender-meta) and those get whatever the shell exported, which locally is
 * nothing. That gap used to be papered over by a literal Supabase anon key
 * hardcoded in two of the scripts - a legacy `eyJ...` JWT, tracked in git, for
 * the live project, that nobody was rotating. Removing it (audit 2026-09-17)
 * fixed the credential problem and immediately broke local builds: every fetch
 * SKIPPED, the sitemap shrank to static-only, and only the shrink guard stopped
 * a 620 to 42 URL collapse from shipping.
 *
 * So: read the .env file that is already on disk and already gitignored.
 * No new dependency (process.loadEnvFile is native from Node 20.12), no
 * credential in the repo, and local builds behave like Vercel builds.
 *
 * Env that is ALREADY set always wins, so CI and Vercel are untouched - there
 * is no .env file there anyway, and the call is a no-op when the file is absent.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env')

/** Keys a build script may legitimately read from .env. */
const ALLOWED = [
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY',
  'VITE_CMS_SUPABASE_URL', 'VITE_CMS_SUPABASE_ANON_KEY',
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'VITE_PARADOX_SUPABASE_URL', 'VITE_PARADOX_SUPABASE_ANON_KEY',
  'SITE_URL',
]

let loaded = false

export function loadLocalEnv() {
  if (loaded) return
  loaded = true
  if (!existsSync(ENV_PATH)) return          // Vercel / CI: nothing to do

  // Snapshot what the shell already set - those values must win.
  const preset = new Map(ALLOWED.filter(k => process.env[k]).map(k => [k, process.env[k]]))
  try {
    process.loadEnvFile(ENV_PATH)
  } catch {
    return                                    // unreadable or malformed: carry on keyless
  }
  for (const [k, v] of preset) process.env[k] = v

  // Deliberately stripped: the service-role key. Nothing that imports this
  // loader has any business bypassing RLS, and each build script is its own
  // Node process, so this cannot affect a script that does not import it.
  //
  // compute-org-facts.mjs is the one step that genuinely wants a service key,
  // and it must NOT import this file. It reads process.env itself and warns when
  // the key is absent - which is always, locally: it looks for
  // SUPABASE_SERVICE_ROLE_KEY while .env defines SUPABASE_SERVICE_KEY. That
  // name mismatch is a known finding, left alone here because it is entangled
  // with the pending key rotation.
  delete process.env.SUPABASE_SERVICE_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
}

loadLocalEnv()
