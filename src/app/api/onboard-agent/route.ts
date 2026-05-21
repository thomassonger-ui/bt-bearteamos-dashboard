export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/requireUser'

// Service-role client — admin auth operations (invite, createUser, generateLink)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bearteam-os-dashboard.vercel.app'

/** Lowercase, dot-separated, no special chars — matches old onboard-agent format */
function generateUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.')
}

/**
 * POST /api/onboard-agent
 *
 * Onboards a recruit into a real agent in one call:
 *   1. Look up the lead by id
 *   2. Invite the agent via Supabase Auth (sends branded invite email,
 *      pre-fills name + phone in user_metadata for /onboarding screen 2)
 *   3. Create the matching row in `agents` table, linked via auth_user_id
 *   4. Mark the lead as converted (closed_won + onboarded_at)
 *
 * Body: { leadId: string, role?: 'Buyer Agent' | 'Listing Agent' | 'Admin' }
 *
 * Auth: requires admin session (bt_admin cookie)
 */
export async function POST(req: NextRequest) {
  const authError = requireAdmin(req)
  if (authError) return authError

  try {
    const { leadId, role } = await req.json()
    if (!leadId) return NextResponse.json({ error: 'missing leadId' }, { status: 400 })

    const admin = getAdminClient()

    // ── 1. Fetch the recruit lead ────────────────────────────────────────────
    const { data: lead, error: leadErr } = await admin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()
    if (leadErr || !lead) {
      return NextResponse.json({ error: 'lead not found' }, { status: 404 })
    }
    if (!lead.email) {
      return NextResponse.json(
        { error: 'lead has no email — cannot send invite' },
        { status: 400 }
      )
    }

    const email = lead.email.toLowerCase().trim()
    const agentRole = role || 'Buyer Agent'

    // ── 2. Block duplicates ──────────────────────────────────────────────────
    const { data: existingAgent } = await admin
      .from('agents')
      .select('id, name, email')
      .eq('email', email)
      .maybeSingle()
    if (existingAgent) {
      return NextResponse.json(
        { error: `Agent with email ${email} already exists (${existingAgent.name})` },
        { status: 409 }
      )
    }

    // ── 3. Invite the agent via Supabase Auth ────────────────────────────────
    // Pre-fill name + phone + role into user_metadata so /onboarding screen 2
    // doesn't show empty fields.
    const userMetadata = {
      name: lead.name,
      phone: lead.phone ?? '',
      role: agentRole,
    }

    let authUserId: string | null = null
    let inviteNote: string | undefined

    const { data: invited, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${SITE_URL}/onboarding`,
        data: userMetadata,
      })

    if (inviteErr) {
      // Common case: Supabase email rate limit — fall back to createUser +
      // generateLink so onboarding still proceeds (admin must forward the
      // link manually).
      const msg = inviteErr.message.toLowerCase()
      if (msg.includes('rate limit') || msg.includes('email')) {
        const { data: created, error: createErr } =
          await admin.auth.admin.createUser({
            email,
            email_confirm: false,
            user_metadata: userMetadata,
          })
        if (createErr || !created.user) {
          return NextResponse.json({ error: createErr?.message ?? 'createUser failed' }, { status: 400 })
        }
        authUserId = created.user.id

        const { data: linkData } = await admin.auth.admin.generateLink({
          type: 'invite',
          email,
          options: {
            redirectTo: `${SITE_URL}/onboarding`,
            data: userMetadata,
          },
        })
        inviteNote = `Email rate limited — user created. Send this link manually to ${email}: ${linkData?.properties?.action_link ?? '(use Supabase dashboard)'}`
      } else {
        return NextResponse.json({ error: inviteErr.message }, { status: 400 })
      }
    } else {
      authUserId = invited.user?.id ?? null
    }

    if (!authUserId) {
      return NextResponse.json({ error: 'no auth user id returned' }, { status: 500 })
    }

    // ── 4. Create the agents row, linked to the auth user ────────────────────
    // Generate username (kept for back-compat with existing schema — may be NOT NULL)
    const username = generateUsername(lead.name)

    // Check username collision and append a digit if needed
    let finalUsername = username
    let suffix = 1
    while (true) {
      const { data: existingUsername } = await admin
        .from('agents')
        .select('id')
        .eq('username', finalUsername)
        .maybeSingle()
      if (!existingUsername) break
      finalUsername = `${username}${suffix}`
      suffix++
      if (suffix > 99) break
    }

    const { data: agent, error: agentErr } = await admin
      .from('agents')
      .insert({
        name: lead.name,
        email,
        phone: lead.phone ?? null,
        username: finalUsername,
        auth_user_id: authUserId,
        stage: 'Onboarding',
        onboarding_stage: 0,
        onboarded: false,
        last_active: new Date().toISOString(),
        inactivity_streak: 0,
        missed_streak: 0,
        performance_score: 0,
        start_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (agentErr || !agent) {
      // Roll back the auth user so we don't leave orphans
      await admin.auth.admin.deleteUser(authUserId).catch(() => {})
      console.error('[onboard-agent] agents insert error:', agentErr?.message)
      return NextResponse.json(
        { error: `failed to create agent row: ${agentErr?.message}` },
        { status: 500 }
      )
    }

    // ── 5. Mark the lead as converted ────────────────────────────────────────
    await admin
      .from('leads')
      .update({
        stage: 'closed_won',
        onboarded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)

    // ── 6. Activity log ──────────────────────────────────────────────────────
    await admin.from('activity_log').insert({
      agent_id: agent.id,
      action_type: 'agent_onboarded',
      description: `New agent onboarded via Onboard This Recruit: ${lead.name} (${agentRole}). Invite sent to ${email}.`,
      outcome: 'success',
    })

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        role: agentRole,
        auth_user_id: authUserId,
      },
      inviteSent: !inviteNote,
      inviteNote,
      message: inviteNote
        ? `Agent record created, but email was rate-limited. Forward the manual link.`
        : `Invite email sent to ${agent.name} at ${email}. They'll set their password and confirm their profile.`,
    })
  } catch (err) {
    console.error('[onboard-agent] unexpected:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
