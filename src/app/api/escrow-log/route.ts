import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { leadId, user, action } = await req.json()
    if (!leadId || !user || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Fetch current log
    const { data, error: fetchError } = await supabase
      .from('pipeline')
      .select('escrow_log')
      .eq('id', leadId)
      .single()

    if (fetchError) throw fetchError

    const currentLog = (data?.escrow_log ?? []) as Array<{ ts: string; user: string; action: string }>
    const newEntry = { ts: new Date().toISOString(), user, action }
    const updatedLog = [...currentLog, newEntry]

    const { error: updateError } = await supabase
      .from('pipeline')
      .update({ escrow_log: updatedLog })
      .eq('id', leadId)

    if (updateError) throw updateError

    return NextResponse.json({ ok: true, entry: newEntry })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
