export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_AGENT_ID = 'e424ecf9-ce0d-4e7f-85e9-286dd9f66e1e'

// Uses the service role key — bypasses RLS, server-side only
function getServiceClient() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('[hot-leads-csv] MISSING ENV VAR — NEXT_PUBLIC_SUPABASE_URL:', !!url, ' SUPABASE_SERVICE_ROLE_KEY:', !!key)
    return null
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Verify the caller is an admin.
// Checks the httpOnly bt_admin cookie (set server-side on login, never expires with the JWT).
// Falls back to JWT Bearer token check as secondary.
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  // Primary: httpOnly bt_admin cookie (set by /api/auth/session on login)
  const adminCookie = req.cookies.get('bt_admin')?.value
  if (adminCookie === 'true') {
    console.log('[hot-leads-csv] Admin verified via bt_admin cookie')
    return true
  }

  // Secondary: JWT Bearer token (may be expired — cookie preferred)
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (token) {
    try {
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user }, error } = await anonClient.auth.getUser(token)
      if (!error && user) {
        const adminEmails = (
          process.env.ADMIN_EMAILS ?? 'thomas.songer@gmail.com,tom@bearteam.com,bethanne@bearteam.com,veronica@bearteam.com'
        ).split(',').map(e => e.trim().toLowerCase())
        if (adminEmails.includes(user.email?.toLowerCase() ?? '')) {
          console.log('[hot-leads-csv] Admin verified via JWT:', user.email)
          return true
        }
      }
    } catch { /* fall through */ }
  }

  console.warn('[hot-leads-csv] Auth failed — no valid bt_admin cookie or JWT')
  return false
}

export async function POST(req: NextRequest) {
  console.log('[hot-leads-csv] POST received')

  const isAdmin = await verifyAdmin(req)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized — please log out and log back in' }, { status: 403 })
  }

  const db = getServiceClient()
  if (!db) {
    return NextResponse.json(
      { error: 'Server config error — SUPABASE_SERVICE_ROLE_KEY is not set in Vercel environment variables' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { leads } = body
    console.log('[hot-leads-csv] Leads received:', Array.isArray(leads) ? leads.length : 'not array')

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided', added: 0, skipped: 0 }, { status: 400 })
    }

    let added = 0
    let skipped = 0
    let firstError: string | null = null

    for (const lead of leads) {
      // Skip duplicates by source_id
      if (lead.source_id) {
        const { data: existing } = await db
          .from('pipeline')
          .select('id')
          .eq('source_id', lead.source_id)
          .limit(1)
        if (existing && existing.length > 0) { skipped++; continue }
      }

      const { error } = await db.from('pipeline').insert({
        agent_id:         DEFAULT_AGENT_ID,
        lead_name:        lead.lead_name,
        stage:            'new_lead',
        last_contact:     new Date().toISOString(),
        lead_source:      lead.lead_source ?? 'manual_upload',
        urgency:          'normal',
        arv:              lead.arv ?? null,
        property_address: lead.property_address ?? null,
        zip_code:         lead.zip_code ?? null,
        phone:            lead.phone ?? null,
        email:            lead.email ?? null,
        notes:            lead.notes ?? null,
        source_url:       lead.source_url ?? null,
        source_id:        lead.source_id ?? null,
        scraped_at:       new Date().toISOString(),
        is_hot_lead:      true,
      })

      if (!error) {
        added++
      } else {
        console.error('[hot-leads-csv] Insert error:', error.message, '| lead:', lead.lead_name)
        if (!firstError) firstError = error.message
        skipped++
      }
    }

    console.log(`[hot-leads-csv] Done — added: ${added}, skipped: ${skipped}`)
    return NextResponse.json({
      ok: true,
      added,
      skipped,
      ...(firstError ? { firstError } : {}),
    })
  } catch (err) {
    console.error('[hot-leads-csv] Caught exception:', err)
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 })
  }
}
