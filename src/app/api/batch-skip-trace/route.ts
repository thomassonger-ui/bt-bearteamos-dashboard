import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { skipTraceAddress } from '@/lib/skipTrace'

export async function POST(req: NextRequest) {
  // Simple auth guard — require a secret token
  const { secret } = await req.json().catch(() => ({}))
  if (secret !== 'bt-batch-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all pipeline leads missing phone or email
  const { data: leads, error } = await getSupabase()
    .from('pipeline')
    .select('id, lead_name, property_address, zip_code, phone, email')
    .or('phone.is.null,phone.eq.')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads || leads.length === 0) return NextResponse.json({ ok: true, processed: 0, message: 'No leads to process' })

  const results: { id: string; address: string; hit: boolean; phone?: string; email?: string; error?: string }[] = []

  for (const lead of leads) {
    const addrSource = lead.lead_name || lead.property_address || ''
    if (!addrSource) {
      results.push({ id: lead.id, address: '', hit: false, error: 'no address' })
      continue
    }

    // Parse street / city from address string
    const addrMatch = addrSource.match(/^(.+)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*),?\s*FL\b/i)
    let streetAddress = addrSource
    let city = 'Orlando'
    if (addrMatch) {
      streetAddress = addrMatch[1].trim()
      city = addrMatch[2].trim()
    }

    try {
      const trace = await skipTraceAddress(streetAddress, city, 'FL', lead.zip_code ?? undefined)
      if (!trace) {
        results.push({ id: lead.id, address: addrSource, hit: false })
        continue
      }

      const updates: Record<string, string> = {}
      if (trace.owner_name) updates.lead_name = trace.owner_name
      if (trace.phone1)     updates.phone     = trace.phone1
      if (trace.email)      updates.email     = trace.email

      if (Object.keys(updates).length > 0) {
        await getSupabase().from('pipeline').update(updates).eq('id', lead.id)
      }

      results.push({ id: lead.id, address: addrSource, hit: true, phone: trace.phone1, email: trace.email })
    } catch (err) {
      results.push({ id: lead.id, address: addrSource, hit: false, error: String(err) })
    }
  }

  return NextResponse.json({ ok: true, processed: leads.length, results })
}
