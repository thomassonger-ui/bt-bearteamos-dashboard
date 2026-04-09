export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { access_token } = await req.json()
    if (!access_token) return NextResponse.json({ error: 'no_token' }, { status: 400 })

    // Verify the Supabase token is valid
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabase.auth.getUser(access_token)
    if (error || !user) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })

    // Check if admin (you — tom@bearteam.com)
    const adminEmails = (process.env.ADMIN_EMAILS ?? 'thomas.songer@gmail.com,tom@bearteam.com').split(',')
    const is_admin = adminEmails.some(e => e.trim().toLowerCase() === user.email?.toLowerCase())

    // Set the legacy session cookie so middleware lets them through
    const sessionToken = process.env.SESSION_TOKEN ?? ''
    const res = NextResponse.json({ ok: true, is_admin })
    res.cookies.set('bt_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch (err) {
    console.error('[auth/session]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
