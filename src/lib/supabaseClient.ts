import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Note: Ensure the URL is just the base URL (e.g., https://xyz.supabase.co)
// and doesn't include /rest/v1/ at the end for the client to work correctly.
const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '')

export const supabase = createClient(cleanUrl, supabaseAnonKey)
