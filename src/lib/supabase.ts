import { createClient } from '@supabase/supabase-js'

// Lazy singleton — initialized on first use, not at module load time.
// This prevents "supabaseUrl is required" during Next.js static build.
let _supabase: ReturnType<typeof createClient> | null = null

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabase
}
