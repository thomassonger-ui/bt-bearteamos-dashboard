// POST /api/hot-leads-transfer
// Admin-only: transfer a hot lead to a specific agent's pipeline.
// Sets is_hot_lead = false, updates agent_id, sets stage to 'new_lead'.

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
      const { data: { user } } = await sb.auth.getUser(token)
      if (user?.email) {
        const adminEmails = (
          process.env.ADMIN_EMAILS ?? 'thomas.songer@gmail.com,tom@bearteam.com,bethanne@bearteam.com,veronica@bearteam.com'
        ).split(',').map(e => e.trim().toLowerCase())
        if (adminEmails.includes(user.email.toLowerCase())) return true
      }
    } catch {}
  }
  return false
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!svcKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  let leadId: string, agentId: string
  try {
    const body = await req.json()
    leadId = body.leadId
    agentId = body.agentId
    if (!leadId || !agentId) throw new Error('missing fields')
  } catch {
    return NextResponse.json({ error: 'leadId and agentId required' }, { status: 400 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, svcKey)

  const { error } = await supabase
    .from('pipeline')
    .update({
      agent_id: agentId,
      is_hot_lead: false,
      stage: 'new_lead',
      last_contact: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (error) {
    console.error('[hot-leads-transfer] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[hot-leads-transfer] Lead ${leadId} transferred to agent ${agentId}`)
  return NextResponse.json({ ok: true })
}
