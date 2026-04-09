const ENV_SCHEMA = [
  "INTERNAL_API_TOKEN",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
] as const

export type EnvKey = typeof ENV_SCHEMA[number] | string

export function validateEnv(): void {
  const missing = ENV_SCHEMA.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Check your .env file.`
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
