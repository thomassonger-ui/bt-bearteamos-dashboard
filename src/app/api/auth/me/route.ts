export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const accessToken = authHeader.replace('Bearer ', '').trim()

    if (!accessToken) {
      return NextResponse.json({ error: 'no_token' }, { status: 401 })
    }

    // Verify token and get user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabase.auth.getUser(accessToken)

    if (error || !user) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
    }

    // Look up agent profile
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: agent } = await admin
      .from('agents')
      .select('id, name, email, phone, stage, onboarding_stage, onboarded')
      .eq('auth_user_id', user.id)
      .single()

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: agent?.name ?? user.user_metadata?.name ?? '',
      phone: agent?.phone ?? '',
      agentId: agent?.id ?? null,
      onboarded: agent?.onboarded ?? false,
      onboarding_stage: agent?.onboarding_stage ?? 0,
    })
  } catch (err) {
    console.error('[auth/me]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
