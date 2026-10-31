/**
 * The service-role key, read under ONE name, so rotating it is a single step.
 *
 * WHY THIS EXISTS
 * ---------------
 * Four scripts need a service-role key and they disagreed on what to call it:
 *
 *   SUPABASE_SERVICE_KEY        .env, seed-teams, compress-storage-buckets
 *   SUPABASE_SERVICE_ROLE_KEY   compute-org-facts, hr-import
 *
 * That was not cosmetic. `.env` defines the first name, so compute-org-facts
 * looked for the second and never found it, and silently skipped regenerating
 * ORG_FACTS on every local build. loadEnv.mjs already documented the mismatch
 * and left it alone as "entangled with the pending key rotation". This is that
 * untangling.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` wins because it is Supabase's own name for it and
 * it says what the key actually is. The old name still works, with a warning,
 * so nothing breaks before the rotation happens.
 *
 * ROTATING THE KEY
 * ----------------
 * See ROTATE_SERVICE_KEY.md. The short version, once this file is in place:
 *
 *   1. Supabase Dashboard -> Project Settings -> API -> roll the service_role key
 *   2. In frontend/.env, set SUPABASE_SERVICE_ROLE_KEY=<the new value>
 *   3. DELETE the old SUPABASE_SERVICE_KEY line
 *
 * Nothing else changes. Step 3 is what makes the leaked value stop being
 * referenced by anything in the repo.
 *
 * NEVER import this from a script that also imports loadEnv.mjs. That loader
 * deliberately strips both names from process.env, because nothing in the build
 * chain should be able to bypass RLS. The four scripts below do not import it.
 */

let warned = false

/**
 * @returns {string | undefined} the key, or undefined when neither name is set.
 *   Callers decide whether that is fatal: seed-teams and compress-storage
 *   cannot work without it, compute-org-facts warns and skips.
 */
export function serviceKey() {
  const current = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (current) return current

  const legacy = process.env.SUPABASE_SERVICE_KEY
  if (legacy) {
    if (!warned) {
      warned = true
      console.warn(
        '\n⚠  Using SUPABASE_SERVICE_KEY, which is the OLD name.\n' +
        '   Rename it to SUPABASE_SERVICE_ROLE_KEY in frontend/.env.\n' +
        '   See scripts/ROTATE_SERVICE_KEY.md.\n'
      )
    }
    return legacy
  }

  return undefined
}

/** The name callers should print in their own "this is required" errors. */
export const SERVICE_KEY_ENV_NAME = 'SUPABASE_SERVICE_ROLE_KEY'
