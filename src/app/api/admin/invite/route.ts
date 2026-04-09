export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS, only used server-side
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  try {
    const { name, email, phone } = await req.json()
    if (!name || !email) {
      return NextResponse.json({ error: 'name and email required' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bearteam-os-dashboard.vercel.app'

    // Invite via Supabase Auth — sends magic link email automatically
    const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${dashboardUrl}/onboarding`,
      data: { name, phone: phone ?? '' },
    })

    if (inviteErr) {
      console.error('[admin/invite] invite error:', inviteErr.message)
      return NextResponse.json({ error: inviteErr.message }, { status: 500 })
    }

    const authUserId = inviteData.user.id

    // Pre-create agent row (or update if email already exists)
    const { error: upsertErr } = await supabase
      .from('agents')
      .upsert({
        name,
        email,
        phone: phone ?? null,
        auth_user_id: authUserId,
        invited_at: new Date().toISOString(),
        onboarded: false,
        stage: 'Onboarding',
        onboarding_stage: 0,
        last_active: new Date().toISOString(),
        inactivity_streak: 0,
        missed_streak: 0,
        performance_score: 0,
        start_date: new Date().toISOString(),
      }, { onConflict: 'email' })

    if (upsertErr) {
      console.error('[admin/invite] upsert error:', upsertErr.message)
      // Don't fail — auth invite already sent
    }

    return NextResponse.json({ success: true, userId: authUserId })
  } catch (err) {
    console.error('[admin/invite] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
