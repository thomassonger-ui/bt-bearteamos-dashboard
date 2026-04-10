import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPER_ADMIN = 'tom@bearteam.com'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  const { action, email, callerEmail } = await req.json()

  if (callerEmail !== SUPER_ADMIN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (!email || !action) {
    return NextResponse.json({ error: 'Missing email or action' }, { status: 400 })
  }

  try {
    if (action === 'invite') {
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, message: `Invite sent to ${email}` })
    }

    // Look up user by email
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })
    const user = users.find((u) => u.email === email)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (action === 'reset') {
      const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      // Also send via Supabase built-in reset
      await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
      })
      return NextResponse.json({ ok: true, message: `Password reset sent to ${email}` })
    }

    if (action === 'revoke') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        ban_duration: '87600h', // 10 years = effectively permanent
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, message: `Access revoked for ${email}` })
    }

    if (action === 'restore') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        ban_duration: 'none',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, message: `Access restored for ${email}` })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const callerEmail = req.nextUrl.searchParams.get('callerEmail')
  if (callerEmail !== SUPER_ADMIN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mapped = users.map((u) => ({
    id: u.id,
    email: u.email,
    status: u.banned_until ? 'revoked' : u.confirmed_at ? 'active' : 'invited',
    last_login: u.last_sign_in_at,
    created_at: u.created_at,
  }))

  return NextResponse.json({ users: mapped })
}
