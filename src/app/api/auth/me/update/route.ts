export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.replace('Bearer ', '').trim()
    if (!accessToken) return NextResponse.json({ error: 'no_token' }, { status: 401 })

    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await anonClient.auth.getUser(accessToken)
    if (error || !user) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })

    const updates = await req.json()
    const allowed = ['name', 'phone', 'onboarded', 'onboarding_stage']
    const safe: Record<string, unknown> = {}
    for (const k of allowed) { if (k in updates) safe[k] = updates[k] }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error: updateErr } = await admin
      .from('agents')
      .update(safe)
      .eq('auth_user_id', user.id)

    if (updateErr) {
      console.error('[auth/me/update]', updateErr.message)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auth/me/update]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
