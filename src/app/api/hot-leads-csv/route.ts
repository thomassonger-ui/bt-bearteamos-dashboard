export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_AGENT_ID = 'e424ecf9-ce0d-4e7f-85e9-286dd9f66e1e'

// Uses the service role key — bypasses RLS, server-side only
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Verify the caller is an admin via their JWT
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return false
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error } = await anonClient.auth.getUser(token)
  if (error || !user) return false
  const adminEmails = (process.env.ADMIN_EMAILS ?? 'thomas.songer@gmail.com,tom@bearteam.com,bethanne@bearteam.com,veronica@bearteam.com')
    .split(',').map(e => e.trim().toLowerCase())
  return adminEmails.includes(user.email?.toLowerCase() ?? '')
}

export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdmin(req)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const { leads } = await req.json()
    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 })
    }

    const db = getServiceClient()
    let added = 0
    let skipped = 0

    for (const lead of leads) {
      // Check for duplicate source_id first
      if (lead.source_id) {
        const { data: existing } = await db
          .from('pipeline')
          .select('id')
          .eq('source_id', lead.source_id)
          .limit(1)
        if (existing && existing.length > 0) { skipped++; continue }
      }

      const { error } = await db.from('pipeline').insert({
        agent_id: DEFAULT_AGENT_ID,
        lead_name: lead.lead_name,
        stage: 'new_lead',
        last_contact: new Date().toISOString(),
        lead_source: lead.lead_source ?? 'manual_upload',
        urgency: 'normal',
        arv: lead.arv ?? null,
        property_address: lead.property_address ?? null,
        zip_code: lead.zip_code ?? null,
        phone: lead.phone ?? null,
        email: lead.email ?? null,
        notes: lead.notes ?? null,
        source_url: lead.source_url ?? null,
        source_id: lead.source_id ?? null,
        scraped_at: new Date().toISOString(),
        is_hot_lead: true,
      })

      if (!error) added++
      else {
        console.error('[hot-leads-csv] insert error:', error.message)
        skipped++
      }
    }

    return NextResponse.json({ ok: true, added, skipped })
  } catch (err) {
    console.error('[hot-leads-csv]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
