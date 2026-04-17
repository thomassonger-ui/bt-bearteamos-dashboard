import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS ?? 'tom@bearteam.com,bethanne@bearteam.com')
  .split(',').map(e => e.trim().toLowerCase())

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Verify the caller is a super admin via their JWT — not via client-supplied email
async function verifySuperAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') ?? ''
  const accessToken = authHeader.replace('Bearer ', '').trim()
  if (!accessToken) return false

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error } = await anonClient.auth.getUser(accessToken)
  if (error || !user) return false

  return SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')
}

export async function POST(req: NextRequest) {
  const isSuperAdmin = await verifySuperAdmin(req)
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { action, email } = await req.json()

  if (!email || !action) {
    return NextResponse.json({ error: 'Missing email or action' }, { status: 400 })
  }

  try {
    if (action === 'invite') {
      const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
      })
      if (error) {
        if (error.message.toLowerCase().includes('rate limit') || error.message.toLowerCase().includes('email')) {
          const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: false,
            user_metadata: {},
          })
          if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })
          const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
            type: 'invite',
            email,
            options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding` },
          })
          const link = linkData?.properties?.action_link ?? null
          return NextResponse.json({
            ok: true,
            rateLimit: true,
            message: `Email rate limited — user created. Send this link manually: ${link ?? '(generate in Supabase dashboard)'}`,
          })
        }
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true, message: `Invite sent to ${email}` })
    }

    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })
    const user = users.find((u) => u.email === email)
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    if (action === 'reset') {
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, message: `Password reset sent to ${email}` })
    }

    if (action === 'revoke') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { ban_duration: '87600h' })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, message: `Access revoked for ${email}` })
    }

    if (action === 'restore') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { ban_duration: 'none' })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, message: `Access restored for ${email}` })
    }

    if (action === 'delete') {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ ok: true, message: `${email} permanently deleted` })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const isSuperAdmin = await verifySuperAdmin(req)
  if (!isSuperAdmin) {
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
