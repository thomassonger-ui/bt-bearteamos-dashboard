export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const { agentId } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'missing agentId' }, { status: 400 })

    const { error } = await supabase.from('activity_log').insert({
      agent_id:    agentId,
      action_type: 'call_logged',
      description: 'Call logged manually',
      outcome:     'neutral',
    })

    if (error) {
      console.error('[log-call] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[log-call] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
