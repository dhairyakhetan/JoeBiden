// @ts-nocheck
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Hardcoded fallback — shown immediately while the DB fetch resolves.
 *  Admin can override this at any time via the Settings tab in /paradox/admin.
 *  The DB value (key = 'whatsapp_group_url') takes precedence once loaded.
 */
export const WHATSAPP_GROUP_FALLBACK = 'https://chat.whatsapp.com/D7zCdGtBZJ80DgASfij5bB'

export function useWhatsAppGroup(): string {
  const [url, setUrl] = useState(WHATSAPP_GROUP_FALLBACK)

  useEffect(() => {
    supabase
      .from('paradox_site_settings')
      .select('value')
      .eq('key', 'whatsapp_group_url')
      .single()
      .then(({ data }) => {
        if (data?.value && typeof data.value === 'string' && data.value.startsWith('http')) {
          setUrl(data.value)
        }
      })
  }, [])

  return url
}
