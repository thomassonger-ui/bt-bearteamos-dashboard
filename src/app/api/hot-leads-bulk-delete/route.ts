// POST /api/hot-leads-bulk-delete
// Admin-only: delete hot leads by ID array.

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
    return NextResponse.json({ error: 'Server config error: SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  let ids: string[]
  try {
    const body = await req.json()
    ids = body.ids
    if (!Array.isArray(ids) || ids.length === 0) throw new Error('empty')
  } catch {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, svcKey)

  const { error } = await supabase
    .from('pipeline')
    .delete()
    .in('id', ids)

  if (error) {
    console.error('[hot-leads-bulk-delete] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[hot-leads-bulk-delete] Deleted ${ids.length} leads`)
  return NextResponse.json({ ok: true, deleted: ids.length })
}
