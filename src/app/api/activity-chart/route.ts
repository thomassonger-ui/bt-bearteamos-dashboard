export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Returns array of 13 weekly buckets (90 days) with calls and closings
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId')
    if (!agentId) return NextResponse.json({ error: 'missing agentId' }, { status: 400 })

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    // Calls from activity_log
    const { data: callRows } = await supabase
      .from('activity_log')
      .select('created_at')
      .eq('agent_id', agentId)
      .eq('action_type', 'call_logged')
      .gte('created_at', since)

    // Closings from pipeline
    const { data: closedRows } = await supabase
      .from('pipeline')
      .select('last_contact')
      .eq('agent_id', agentId)
      .eq('stage', 'closed')
      .gte('last_contact', since)

    // Build 13 weekly buckets
    const now = Date.now()
    const buckets: { week: string; calls: number; closings: number; target: number }[] = []

    for (let i = 12; i >= 0; i--) {
      const weekEnd   = new Date(now - i * 7 * 24 * 60 * 60 * 1000)
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
      const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      const calls = (callRows ?? []).filter((r: { created_at: string }) => {
        const d = new Date(r.created_at).getTime()
        return d >= weekStart.getTime() && d < weekEnd.getTime()
      }).length

      const closings = (closedRows ?? []).filter((r: { last_contact: string }) => {
        const d = new Date(r.last_contact).getTime()
        return d >= weekStart.getTime() && d < weekEnd.getTime()
      }).length

      buckets.push({ week: label, calls, closings, target: 35 })
    }

    return NextResponse.json({ buckets })
  } catch (err) {
    console.error('[activity-chart]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
