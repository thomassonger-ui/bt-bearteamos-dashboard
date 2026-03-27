export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VALID_STAGES = ['new_lead','contacted','appointment_set','under_contract','closed']

export async function POST(req: Request) {
  try {
    const { messages, agentId } = await req.json()
    if (!agentId || !messages?.length) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 })
    }

    const { data: pipeline } = await supabase
      .from('pipeline')
      .select('id, lead_name, stage')
      .eq('agent_id', agentId)
      .order('last_contact', { ascending: false })
      .limit(20)

    const pipelineList = pipeline?.length
      ? pipeline.map((l: {id: string; lead_name: string; stage: string}) => `- ${l.lead_name} [${l.stage}] id:${l.id}`).join('\n')
      : 'None yet.'

    const lastMessage = messages[messages.length - 1]?.content ?? ''

    // Call OpenAI directly with JSON mode
    const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a pipeline assistant. Extract client info and return JSON only.

Current pipeline:
${pipelineList}

Return this exact JSON structure:
{
  "has_lead": true/false,
  "reply": "one sentence confirmation",
  "lead_name": "Full Name or null",
  "stage": "new_lead|contacted|appointment_set|under_contract|closed or null",
  "notes": "any details or null",
  "update_lead_id": "existing lead id if updating, otherwise null"
}

Rules:
- has_lead = true if a client name is mentioned
- stage defaults to "new_lead" if not specified
- reply should confirm what was captured in 1 sentence
- if no client name, set has_lead=false and reply asking for the name`
          },
          { role: 'user', content: lastMessage }
        ],
      }),
    })

    if (!oaiRes.ok) {
      const err = await oaiRes.text()
      console.error('[pipeline-chat] OpenAI error:', err.slice(0, 200))
      return NextResponse.json({ error: 'ai_error' }, { status: 500 })
    }

    const oaiData = await oaiRes.json()
    const raw = oaiData.choices?.[0]?.message?.content ?? '{}'
    
    let extracted: {
      has_lead?: boolean
      reply?: string
      lead_name?: string
      stage?: string
      notes?: string
      update_lead_id?: string
    } = {}

    try {
      extracted = JSON.parse(raw)
    } catch {
      console.error('[pipeline-chat] JSON parse error:', raw.slice(0, 100))
      return NextResponse.json({ reply: 'Something went wrong. Try again.', action: null })
    }

    console.log('[pipeline-chat] extracted:', JSON.stringify(extracted).slice(0, 200))

    let actionResult = null

    if (extracted.has_lead && extracted.lead_name) {
      const stage = VALID_STAGES.includes(extracted.stage ?? '') ? extracted.stage! : 'new_lead'

      if (extracted.update_lead_id) {
        const updates: Record<string, string> = { last_contact: new Date().toISOString() }
        if (stage) updates.stage = stage
        if (extracted.notes) updates.notes = extracted.notes

        const { data, error } = await supabase
          .from('pipeline')
          .update(updates)
          .eq('id', extracted.update_lead_id)
          .eq('agent_id', agentId)
          .select()
          .single()

        if (!error && data) actionResult = { type: 'updated', lead: data }
        else console.error('[pipeline-chat] update error:', error?.message)
      } else {
        const { data, error } = await supabase
          .from('pipeline')
          .insert({
            agent_id: agentId,
            lead_name: extracted.lead_name,
            stage,
            notes: extracted.notes || '',
            last_contact: new Date().toISOString(),
          })
          .select()
          .single()

        if (!error && data) {
          actionResult = { type: 'created', lead: data }
          console.log('[pipeline-chat] created lead:', extracted.lead_name)
        } else {
          console.error('[pipeline-chat] insert error:', error?.message)
        }
      }
    }

    return NextResponse.json({ reply: extracted.reply ?? 'Got it.', action: actionResult })
  } catch (err) {
    console.error('[pipeline-chat] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
