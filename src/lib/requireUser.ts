import { NextRequest, NextResponse } from 'next/server'

/**
 * Cookie-based auth gate for API routes called from the browser.
 *
 * Verifies the httpOnly `bt_session` cookie set by /api/auth/session after
 * Supabase Auth succeeds. Cookie is sent automatically by browser fetch()
 * on same-origin requests — no client code changes needed.
 *
 * Use for routes mutating data or burning paid APIs (OpenAI, SendGrid,
 * Tracerfy) that are reachable from logged-in pages.
 *
 * Returns NextResponse on failure (caller should early-return it),
 * or null on success.
 */
export function requireUser(req: NextRequest): NextResponse | null {
  const expected = process.env.SESSION_TOKEN
  if (!expected) {
    console.error('[requireUser] SESSION_TOKEN is not configured')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }
  const provided = req.cookies.get('bt_session')?.value
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

/**
 * Same as requireUser, but additionally requires the `bt_admin` cookie —
 * set by /api/auth/session only when the logged-in user's email is in
 * ADMIN_EMAILS or SUPER_ADMIN_EMAILS.
 *
 * Use for routes that create accounts, bulk-import data, or otherwise
 * should be limited to brokerage staff.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const userCheck = requireUser(req)
  if (userCheck) return userCheck
  const isAdmin = req.cookies.get('bt_admin')?.value === 'true'
  if (!isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return null
}

/**
 * Accepts EITHER the bt_session cookie OR Bearer INTERNAL_API_KEY.
 *
 * Use for routes that are called from both the browser (UI buttons) and
 * server-side / external automation. /api/send-email is the canonical
 * case — agents click "Send" in the AI Writer (cookie path), but cron
 * jobs and integrations may also hit it (bearer path).
 */
export function requireUserOrInternal(req: NextRequest): NextResponse | null {
  // Try cookie first (cheap, most common path)
  const expectedSession = process.env.SESSION_TOKEN
  const sessionCookie = req.cookies.get('bt_session')?.value
  if (expectedSession && sessionCookie === expectedSession) return null

  // Fall back to bearer
  const expectedKey = process.env.INTERNAL_API_KEY
  if (expectedKey) {
    const header = req.headers.get('authorization') ?? ''
    const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (provided === expectedKey) return null
  }

  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}
