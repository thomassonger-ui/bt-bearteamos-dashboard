// POST /api/skip-trace-bulk
// Admin-only: runs Tracerfy skip trace on all hot leads that are missing phone/email.
// Call this after a CSV upload or manually from the Hot Leads admin panel.

export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { skipTraceAddress } from '@/lib/skipTrace'

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const adminCookie = req.cookies.get('bt_admin')?.value
  if (adminCookie === 'true') return true
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (token) {
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data } = await sb.auth.getUser(token)
      if (data?.user?.email) {
        const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
        if (adminEmails.includes(data.user.email)) return true
      }
    } catch {}
  }
  return false
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.TRACERFY_API_KEY) {
    return NextResponse.json({ error: 'TRACERFY_API_KEY not configured' }, { status: 500 })
  }

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = svcKey
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, svcKey)
    : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  // Get all hot leads missing phone/email with an address we can trace
  const { data: leads, error: fetchErr } = await supabase
    .from('pipeline')
    .select('id, lead_name, property_address, zip_code, phone, email')
    .eq('is_hot_lead', true)
    .or('phone.is.null,phone.eq.')
    .limit(50) // Tracerfy credits — cap at 50 per bulk run

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ ok: true, traced: 0, message: 'All leads already have contact info.' })
  }

  let traced = 0
  let missed = 0
  let errors = 0

  for (const lead of leads) {
    // Determine best address to trace
    const rawAddr = lead.property_address || lead.lead_name || ''
    if (!rawAddr || !/\d/.test(rawAddr)) {
      missed++
      continue // no street number — can't trace
    }

    try {
      let streetAddr = rawAddr
      let city = 'Orlando'
      const match = rawAddr.match(/^(.+?),\s*([A-Za-z\s]+),?\s*FL\b/i)
      if (match) {
        streetAddr = match[1].trim()
        city = match[2].trim()
      }

      const result = await skipTraceAddress(streetAddr, city, 'FL', lead.zip_code ?? undefined)

      if (result) {
        await supabase
          .from('pipeline')
          .update({
            lead_name: result.owner_name,
            phone: result.phone1,
            email: result.email,
          })
          .eq('id', lead.id)
        traced++
      } else {
        missed++
      }
    } catch {
      errors++
    }
  }

  return NextResponse.json({
    ok: true,
    total: leads.length,
    traced,
    missed,
    errors,
    message: `Skip trace complete: ${traced} found, ${missed} no-hit, ${errors} error${errors !== 1 ? 's' : ''}.`,
  })
}
