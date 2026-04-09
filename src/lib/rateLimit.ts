// ─── IN-MEMORY RATE LIMITER ─────────────────────────────────────────────────
// Simple per-key sliding window. Resets on server restart.
// Not distributed — sufficient for single-instance / Vercel serverless.

import { NextRequest } from "next/server"

const map = new Map<string, { count: number; time: number }>()

const ROUTE_LIMITS: Record<string, number> = {
  "/api/leads/upload": 10,
  "/api/campaigns/send-step": 20,
  "/api/email/test": 5,
}

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

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

export function checkRateLimit(
  route: string,
  ip: string
): { allowed: boolean; retryAfterMs: number } {
  const limit = ROUTE_LIMITS[route] ?? 20
  const key = `${route}:${ip}`
  const now = Date.now()
  const entry = map.get(key)

  if (!entry || now - entry.time > 60000) {
    map.set(key, { count: 1, time: now })
    return { allowed: true, retryAfterMs: 0 }
  }
  if (entry.count >= limit) {
    const retryAfterMs = 60000 - (now - entry.time)
    return { allowed: false, retryAfterMs }
  }
  entry.count++
  return { allowed: true, retryAfterMs: 0 }
}