export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const { access_token } = await req.json()
    if (!access_token) return NextResponse.json({ error: 'no_token' }, { status: 400 })

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await supabase.auth.getUser(access_token)
    if (error || !user) return NextResponse.json({ error: 'invalid_token' }, { status: 401 })

    const email = user.email?.toLowerCase() ?? ''

    // Super admin — full broker access (Bethanne)
    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS ?? 'bethanne@bearteam.com')
      .split(',').map(e => e.trim().toLowerCase())
    const is_super_admin = superAdminEmails.includes(email)

    // Admin — brokerage staff access (Veronica + Tom)
    const adminEmails = (process.env.ADMIN_EMAILS ?? 'thomas.songer@gmail.com,tom@bearteam.com,veronica@bearteam.com')
      .split(',').map(e => e.trim().toLowerCase())
    const is_admin = is_super_admin || adminEmails.includes(email)

    const sessionToken = process.env.SESSION_TOKEN ?? ''
    const res = NextResponse.json({ ok: true, is_admin, is_super_admin })
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
