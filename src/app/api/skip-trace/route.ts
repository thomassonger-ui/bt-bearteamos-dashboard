import { NextRequest, NextResponse } from 'next/server'
import { skipTraceAddress } from '@/lib/skipTrace'
import { getSupabase } from '@/lib/supabase'

// POST /api/skip-trace
// Called server-side after a lead is accepted.
// Looks up owner contact info via Tracerfy and writes back to Supabase.

export async function POST(req: NextRequest) {
  try {
    const { leadId, address, city, zip } = await req.json()

    if (!leadId || !address) {
      return NextResponse.json({ error: 'leadId and address are required' }, { status: 400 })
    }

    // Call Tracerfy — TRACERFY_API_KEY is only available server-side
    const trace = await skipTraceAddress(address, city ?? 'Orlando', 'FL', zip ?? undefined)

    if (!trace) {
      return NextResponse.json({ ok: true, hit: false, message: 'No results found' })
    }

    // Write enriched data back to Supabase
    const updates: Record<string, string> = {}
    if (trace.owner_name) updates.lead_name  = trace.owner_name
    if (trace.phone1)     updates.phone      = trace.phone1
    if (trace.email)      updates.email      = trace.email

    if (Object.keys(updates).length > 0) {
      const { error } = await getSupabase()
        .from('pipeline')
        .update(updates)
        .eq('id', leadId)

      if (error) {
        console.error('[skip-trace] Supabase update failed:', error.message)
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
      }
    }

    return NextResponse.json({
      ok: true,
      hit: true,
      owner_name: trace.owner_name,
      phone: trace.phone1,
      email: trace.email,
    })
  } catch (err) {
    console.error('[skip-trace] Route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
