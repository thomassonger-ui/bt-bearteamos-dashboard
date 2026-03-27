// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy singleton — initialized on first use, not at module load time.
// This prevents "supabaseUrl is required" during Next.js static build.
// We use `any` as the Database generic so all .from() calls return usable types
// without requiring a generated schema file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: SupabaseClient<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabase(): SupabaseClient<any> {
  if (!_supabase) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _supabase = createClient<any>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _supabase
}
