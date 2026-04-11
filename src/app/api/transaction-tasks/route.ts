import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

// ─── Critical Deadline Tracker (offsets from Effective Date) ─────────────────
// Based on BearTeam Transaction Checklist PDF — Section 2
const TX_DEADLINES: { day: number; title: string; description: string }[] = [
  {
    day: 3,
    title: 'EMD Due',
    description: 'Earnest Money Deposit must be delivered to escrow/title today.',
  },
  {
    day: 5,
    title: 'Loan Application Due',
    description: 'Buyer must submit completed loan application to lender today.',
  },
  {
    day: 10,
    title: 'Inspection Period Ends',
    description: 'Inspection period closes at end of day. Buyer must complete all inspections and decide to proceed, negotiate, or terminate.',
  },
  {
    day: 11,
    title: 'Repair Requests Due',
    description: 'Any repair requests or credits must be submitted to the seller in writing by end of day.',
  },
  {
    day: 13,
    title: 'Seller Repair Response Deadline',
    description: 'Seller must respond to buyer repair requests by end of day. No response = rejection.',
  },
  {
    day: 10,
    title: 'Order Appraisal',
    description: 'Lender should order the appraisal by today (estimated Day 10).',
  },
  {
    day: 21,
    title: 'Appraisal Expected',
    description: 'Appraisal report expected from lender. Follow up if not received.',
  },
]

function addDays(isoOrDate: string, days: number): string {
  const d = new Date(isoOrDate)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { leadId, agentId, effectiveDate } = body as {
      leadId: string
      agentId: string
      effectiveDate: string // YYYY-MM-DD or ISO
    }

    if (!leadId || !agentId || !effectiveDate) {
      return NextResponse.json({ error: 'Missing leadId, agentId, or effectiveDate' }, { status: 400 })
    }

    const supabase = getSupabase()

    // ── 1. Delete any existing tx_deadline tasks for this lead (idempotent) ──
    const { error: delError } = await supabase
      .from('tasks')
      .delete()
      .eq('agent_id', agentId)
      .eq('source_rule', 'tx_deadline')
      .eq('source_ref', leadId)

    if (delError) {
      console.error('[tx-tasks] delete error:', delError.message)
    }

    // ── 2. Build tasks from effective date offsets ────────────────────────────
    const now = new Date().toISOString()
    const tasks = TX_DEADLINES.map(dl => ({
      agent_id: agentId,
      type: 'transaction',
      title: dl.title,
      description: dl.description,
      status: 'pending' as const,
      due_date: addDays(effectiveDate, dl.day),
      source_rule: 'tx_deadline',
      source_ref: leadId,
      created_at: now,
    }))

    // ── 3. Add close-relative tasks if target_close_date is set ──────────────
    const { data: lead } = await supabase
      .from('pipeline')
      .select('target_close_date')
      .eq('id', leadId)
      .single()

    if (lead?.target_close_date) {
      tasks.push({
        agent_id: agentId,
        type: 'transaction',
        title: 'Closing Disclosure Review',
        description: 'Review Closing Disclosure with buyer — required 3 business days before closing.',
        status: 'pending',
        due_date: addDays(lead.target_close_date, -3),
        source_rule: 'tx_deadline',
        source_ref: leadId,
        created_at: now,
      })
      tasks.push({
        agent_id: agentId,
        type: 'transaction',
        title: 'Final Walkthrough',
        description: 'Conduct final walkthrough of the property the day before closing to verify condition.',
        status: 'pending',
        due_date: addDays(lead.target_close_date, -1),
        source_rule: 'tx_deadline',
        source_ref: leadId,
        created_at: now,
      })
    }

    // ── 4. Insert all tasks ───────────────────────────────────────────────────
    const { error: insertError } = await supabase.from('tasks').insert(tasks)
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, tasksCreated: tasks.length })
  } catch (err) {
    console.error('[tx-tasks] unexpected error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
