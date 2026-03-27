// ─── IN-MEMORY RATE LIMITER ───────────────────────────────────────────────────
// Simple per-key sliding window. Resets on server restart.
// Not distributed — sufficient for single-instance / Vercel serverless.

const map = new Map<string, { count: number; time: number }>()

export function rateLimit(key: string, limit = 20, windowMs = 60000): boolean {
  const now = Date.now()
  const entry = map.get(key)

  if (!entry || now - entry.time > windowMs) {
    map.set(key, { count: 1, time: now })
    return true
  }

  if (entry.count >= limit) return false

  entry.count++
  return true
}
