import { NextRequest, NextResponse } from 'next/server'
import { skipTraceAddress } from '@/lib/skipTrace'
import { getSupabase } from '@/lib/supabase'

// POST /api/skip-trace
// Called after agent accepts a hot lead.
// Looks up owner contact info via Tracerfy and writes back to Supabase.

export async function POST(req: NextRequest) {
  try {
    const { leadId, address, city, zip } = await req.json()

    if (!leadId || !address) {
      return NextResponse.json({ error: 'leadId and address are required' }, { status: 400 })
    }

    console.log('[skip-trace] Starting trace:', { leadId, address, city, zip })

    // Call Tracerfy
    const trace = await skipTraceAddress(address, city ?? 'Orlando', 'FL', zip ?? undefined)

    if (!trace) {
      console.log('[skip-trace] No hit — address may not be a valid street address:', address)
      return NextResponse.json({ ok: true, hit: false, message: 'No results found', address })
    }

    console.log('[skip-trace] Hit! owner:', trace.owner_name, 'phone:', trace.phone1, 'email:', trace.email)

    // Build update — only include fields with values
    const updates: Record<string, string> = {}
    if (trace.owner_name) updates.lead_name = trace.owner_name
    if (trace.phone1)     updates.phone     = trace.phone1
    if (trace.email)      updates.email     = trace.email

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, hit: true, message: 'Hit but no contact data returned' })
    }

    console.log('[skip-trace] Writing to Supabase:', updates)

    const { error } = await getSupabase()
      .from('pipeline')
      .update(updates)
      .eq('id', leadId)

    if (error) {
      // Log full error detail so we can see exactly which column/constraint is failing
      console.error('[skip-trace] Supabase update failed:', JSON.stringify(error))
      return NextResponse.json({
        error: 'DB update failed',
        detail: error.message,
        code: error.code,
      }, { status: 500 })
    }

    console.log('[skip-trace] Supabase updated successfully for leadId:', leadId)

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
