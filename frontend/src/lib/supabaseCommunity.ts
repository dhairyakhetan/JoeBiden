import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase community environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)')
}

// createClient throws synchronously on an empty URL, which would crash the
// app at import time before React can mount. Fall back to a placeholder so
// the app still renders (requests will simply fail) when env vars are unset.
export const supabaseCommunity = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
)
