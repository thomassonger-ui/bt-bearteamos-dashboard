// POST /api/hot-leads-csv
// Admin-only CSV upload for ByOwner / FSBO hot leads.
// Parses CSV server-side, inserts into pipeline via service role key (bypasses RLS),
// then runs Tracerfy skip trace on each inserted lead to populate name/phone/email.

export const dynamic = 'force-dynamic'
export const maxDuration = 120 // allow time for skip trace API calls

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { skipTraceAddress } from '@/lib/skipTrace'

const DEFAULT_AGENT_ID = '02c850ac-b7ba-4649-859d-8a8fae805ac8' // Tom Songer

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  // Primary: httpOnly bt_admin cookie (set at login)
  const adminCookie = req.cookies.get('bt_admin')?.value
  if (adminCookie === 'true') return true
  // Secondary: JWT Bearer (may be expired after 1hr)
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (token) {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      const sb = createClient(url, anon)
      const { data } = await sb.auth.getUser(token)
      if (data?.user?.email) {
        const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
        if (adminEmails.includes(data.user.email)) return true
      }
    } catch {}
  }
  return false
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!svcKey) {
    return NextResponse.json({ error: 'Server config error: SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, svcKey)

  let body: { leads?: Array<Record<string, string>> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsedLeads = body.leads ?? []
  if (!parsedLeads.length) {
    return NextResponse.json({ inserted: 0, skipped: 0, message: 'No leads in payload' })
  }

  let inserted = 0
  let skipped = 0
  let firstError: string | null = null
  const now = new Date().toISOString()

  // Track which leads were successfully inserted so we can run skip trace
  const insertedLeads: Array<{ id: string; address: string; city: string; zip: string | null }> = []

  for (const lead of parsedLeads) {
    // Check for duplicate by source_id / URL
    const sourceId = lead.url || lead.source_id || `upload_${Date.now()}_${Math.random()}`
    if (lead.url) {
      const { data: existing } = await supabase
        .from('pipeline')
        .select('id')
        .eq('source_id', sourceId)
        .limit(1)
      if (existing && existing.length > 0) { skipped++; continue }
    }

    const insertRow = {
      agent_id: DEFAULT_AGENT_ID,
      lead_name: (lead.title || lead.address || 'Unknown').slice(0, 100),
      stage: 'new_lead',
      last_contact: now,
      lead_source: lead.source || 'manual_upload',
      urgency: 'normal',
      arv: lead.price ? parseFloat(lead.price.replace(/[$,]/g, '')) || null : null,
      property_address: lead.location || lead.address || null,
      zip_code: lead.zip || null,
      phone: lead.phone || null,
      email: lead.email || null,
      notes: lead.description || null,
      source_url: lead.url || null,
      source_id: sourceId,
      scraped_at: now,
      is_hot_lead: true,
    }

    const { data: insertedRow, error } = await supabase
      .from('pipeline')
      .insert(insertRow)
      .select('id')
      .single()

    if (error) {
      skipped++
      if (!firstError) firstError = error.message
    } else if (insertedRow) {
      inserted++
      // Queue for skip trace if we have enough address info
      const addr = insertRow.property_address || insertRow.lead_name || ''
      if (addr && /\d/.test(addr)) { // has street number
        insertedLeads.push({
          id: insertedRow.id,
          address: addr,
          city: 'Orlando',
          zip: insertRow.zip_code,
        })
      }
    }
  }

  // ─── Run skip trace asynchronously on inserted leads ───────────────────────
  // Fire-and-forget — don't block the response waiting for Tracerfy
  if (insertedLeads.length > 0 && process.env.TRACERFY_API_KEY) {
    ;(async () => {
      for (const lead of insertedLeads) {
        try {
          // Parse city from address if possible: "123 Main St, Orlando, FL 32801"
          let streetAddr = lead.address
          let city = lead.city
          const addrMatch = lead.address.match(/^(.+?),\s*([A-Za-z\s]+),?\s*FL\b/i)
          if (addrMatch) {
            streetAddr = addrMatch[1].trim()
            city = addrMatch[2].trim()
          }

          const trace = await skipTraceAddress(streetAddr, city, 'FL', lead.zip ?? undefined)
          if (trace) {
            await supabase
              .from('pipeline')
              .update({
                lead_name: trace.owner_name,
                phone: trace.phone1,
                email: trace.email,
              })
              .eq('id', lead.id)
            console.log(`[hot-leads-csv] Skip traced ${lead.id}: ${trace.owner_name}`)
          }
        } catch (err) {
          console.error(`[hot-leads-csv] Skip trace failed for ${lead.id}:`, err)
        }
      }
    })()
  }

  return NextResponse.json({
    inserted,
    skipped,
    skippedTraced: insertedLeads.length,
    message: `Imported ${inserted} leads${skipped > 0 ? `, ${skipped} skipped` : ''}${insertedLeads.length > 0 ? `. Skip trace running for ${insertedLeads.length} lead${insertedLeads.length !== 1 ? 's' : ''}.` : ''}`,
    ...(firstError ? { dbError: firstError } : {}),
  })
}
