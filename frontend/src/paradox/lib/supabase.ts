// @ts-nocheck
import { createClient } from '@supabase/supabase-js'

/**
 * Paradox 2026 uses its own Supabase project (drvucogrjphctwfealxd) where
 * paradox_* tables live, separate from AquaTerra's project. Production env
 * sets VITE_PARADOX_SUPABASE_URL / VITE_PARADOX_SUPABASE_ANON_KEY; falls back
 * to VITE_SUPABASE_* if those aren't set so a single-project setup still works.
 */
const url =
  import.meta.env.VITE_PARADOX_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  'https://placeholder.supabase.co'
const anon =
  import.meta.env.VITE_PARADOX_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'placeholder-anon-key'

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'paradox-auth',
  },
})
