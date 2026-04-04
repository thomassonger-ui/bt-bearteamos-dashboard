export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const { rows } = await req.json()
    if (!rows?.length) return NextResponse.json({ error: 'no rows' }, { status: 400 })

    // Get all agents for name matching
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name')

    if (!agents?.length) return NextResponse.json({ error: 'no agents found' }, { status: 500 })

    // Fuzzy match agent name
    const agentList = agents!

    function matchAgent(name: string) {
      const lower = name.toLowerCase().trim()
      const exact = agentList.find(a => a.name.toLowerCase() === lower)
      if (exact) return exact
      const parts = lower.split(/\s+/)
      const partial = agentList.find(a => {
        const aParts = a.name.toLowerCase().split(/\s+/)
        return parts.some(p => aParts.some((ap: string) => ap.startsWith(p) || p.startsWith(ap)))
      })
      return partial || null
    }

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const row of rows) {
      const agentName = row.agent_name || row.agent || row.Agent || row['Agent Name'] || row['agent_name'] || ''
      const salePrice = parseFloat(String(row.sale_price || row.price || row['Sale Price'] || row['sale_price'] || row.Price || '0').replace(/[$,]/g, ''))
      const closeDate = row.close_date || row.closed_date || row['Close Date'] || row['closed_date'] || row.Date || row.date || ''
      const leadName = row.lead_name || row.client || row.Client || row['Client Name'] || row['lead_name'] || row.buyer || row.seller || 'Unknown Client'
      const leadType = (row.lead_type || row.type || row.Type || row['Lead Type'] || '').toLowerCase()
      const rate = parseFloat(row.commission_rate || row.rate || '0.025') || 0.025

      if (!agentName) { skipped++; errors.push(`Row missing agent name`); continue }
      if (!salePrice || salePrice <= 0) { skipped++; errors.push(`${agentName}: invalid price`); continue }

      const agent = matchAgent(agentName)
      if (!agent) { skipped++; errors.push(`${agentName}: no matching agent found`); continue }

      const gci = salePrice * rate
      const parsedDate = closeDate ? new Date(closeDate).toISOString() : new Date().toISOString()

      const { error } = await supabase
        .from('pipeline')
        .insert({
          agent_id: agent.id,
          lead_name: leadName,
          stage: 'closed',
          lead_type: ['buyer', 'seller', 'rental'].includes(leadType) ? leadType : null,
          sale_price: salePrice,
          commission_rate: rate,
          gci,
          closed_date: parsedDate,
          last_contact: parsedDate,
          notes: `Imported closing: $${salePrice.toLocaleString()}`,
        })

      if (error) {
        skipped++
        errors.push(`${agentName}/${leadName}: ${error.message}`)
      } else {
        imported++
      }
    }

    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 10) })
  } catch (err) {
    console.error('[import-closings]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
