export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function generateUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.')
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

export async function POST(req: Request) {
  try {
    const { leadId, role } = await req.json()
    if (!leadId) return NextResponse.json({ error: 'missing leadId' }, { status: 400 })

    // Get the recruit lead
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()
    if (leadErr || !lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

    // Generate credentials
    const username = generateUsername(lead.name)
    const password = generatePassword()
    const agentRole = role || 'Buyer Agent'

    // Check username collision
    const { data: existing } = await supabase
      .from('agents')
      .select('id')
      .eq('username', username)
      .limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: `Username "${username}" already exists` }, { status: 409 })
    }

    // Create agent
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .insert({
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || null,
        username,
        stage: 'Onboarding',
        onboarding_stage: 0,
        last_active: new Date().toISOString(),
        inactivity_streak: 0,
        missed_streak: 0,
        performance_score: 0,
        start_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (agentErr || !agent) {
      console.error('[onboard-agent] create error:', agentErr?.message)
      return NextResponse.json({ error: 'failed to create agent' }, { status: 500 })
    }

    // Mark lead as converted
    await supabase
      .from('leads')
      .update({ stage: 'closed_won', onboarded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', leadId)

    // Log activity
    await supabase.from('activity_log').insert({
      agent_id: agent.id,
      action_type: 'agent_onboarded',
      description: `New agent onboarded: ${lead.name} (${agentRole}). Username: ${username}`,
      outcome: 'success',
    })

    // Send welcome email via Resend
    if (lead.email && process.env.RESEND_API_KEY) {
      const firstName = lead.name.split(' ')[0]
      const dashboardUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://bearteam-os-dashboard.vercel.app'

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Tom Songer <tom@bearteamrealestate.com>',
          to: [lead.email],
          subject: `Welcome to Bear Team Real Estate, ${firstName}!`,
          text: `${firstName},

Welcome to Bear Team. I'm glad you're here.

Your BearTeamOS account is ready. Here are your login credentials:

Dashboard: ${dashboardUrl}/login
Username: ${username}
Password: ${password}

Your first step is to log in and complete your onboarding tasks. The system will guide you through everything — MLS setup, Academy enrollment, and your first pipeline contacts.

I'll be reaching out to schedule your Week 1 check-in. In the meantime, my door is always open.

407-758-8102 | thomas.songer@gmail.com

Looking forward to building something great with you.

Tom Songer
Team Lead | Bear Team Real Estate
Orlando, FL`,
        }),
      })
    }

    return NextResponse.json({
      success: true,
      agent: { id: agent.id, name: agent.name, username },
      credentials: { username, password },
    })
  } catch (err) {
    console.error('[onboard-agent] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
