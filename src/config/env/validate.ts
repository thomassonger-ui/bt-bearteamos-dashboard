/**
 * Env schema for BearTeamOS. Used to fail fast at boot or per-call
 * (via getEnv) if a required variable is missing.
 *
 * REQUIRED: app will not function without these — boot-time validation.
 * OPTIONAL: code paths gate on presence, defaults are provided in code.
 *
 * Keep in sync with .env.example and the Vercel project settings.
 */

const REQUIRED_ENV = [
  // Supabase
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  // Auth/session
  "SESSION_TOKEN",
  "INTERNAL_API_KEY",
  // Email
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  // AI
  "OPENAI_API_KEY",
  // Skip-trace (core hot-lead flow)
  "TRACERFY_API_KEY",
  // Agent invite redirect target
  "NEXT_PUBLIC_SITE_URL",
] as const

const OPTIONAL_ENV = [
  "ADMIN_EMAILS",          // default in lib/admins.ts
  "SUPER_ADMIN_EMAILS",    // default in lib/admins.ts
  "SENDGRID_FROM_NAME",    // default 'Tom Songer'
  "NEXT_PUBLIC_APP_URL",   // default vercel.app URL
  "APIFY_API_TOKEN",       // only for hot-leads-webhook + scrape paths
  "RESEND_API_KEY",        // only for onboard-agent welcome email
] as const

export type EnvKey =
  | typeof REQUIRED_ENV[number]
  | typeof OPTIONAL_ENV[number]
  | string

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Check your .env file or Vercel project settings.`
    )
  }
}

export function getEnv(key: EnvKey): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Environment variable "${key}" is not set.`)
  }
  return value
}
