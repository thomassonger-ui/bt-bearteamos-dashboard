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
  "action_type": "create_lead|update_lead|delete_lead|none",
  "reply": "one sentence confirmation",
  "lead_name": "Full Name or null",
  "stage": "new_lead|contacted|appointment_set|under_contract|closed or null",
  "notes": "any details or null",
  "target_lead_id": "existing lead id if updating or deleting, otherwise null"
}

Rules:
- action_type = "delete_lead" if user says remove/delete/take off/get rid of a client name
- action_type = "update_lead" if updating an existing client already in the pipeline list
- action_type = "create_lead" if adding a new client
- action_type = "none" if no client action is needed
- stage defaults to "new_lead" if not specified for create
- reply should confirm what was done in 1 sentence
- for delete_lead: match the name in the pipeline list to get the correct target_lead_id
- if action is delete but name not found, set action_type="none" and explain in reply`
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
      action_type?: string
      reply?: string
      lead_name?: string
      stage?: string
      notes?: string
      target_lead_id?: string
    } = {}

    try {
      extracted = JSON.parse(raw)
    } catch {
      console.error('[pipeline-chat] JSON parse error:', raw.slice(0, 100))
      return NextResponse.json({ reply: 'Something went wrong. Try again.', action: null })
    }

    console.log('[pipeline-chat] extracted:', JSON.stringify(extracted).slice(0, 200))

    let actionResult = null

    if (extracted.action_type === 'delete_lead' && extracted.target_lead_id) {
      const { error } = await supabase
        .from('pipeline')
        .delete()
        .eq('id', extracted.target_lead_id)
        .eq('agent_id', agentId)

      if (!error) {
        actionResult = { type: 'deleted', lead_id: extracted.target_lead_id, lead_name: extracted.lead_name }
        console.log('[pipeline-chat] deleted lead:', extracted.lead_name)
      } else {
        console.error('[pipeline-chat] delete error:', error?.message)
      }
    } else if (extracted.action_type === 'update_lead' && extracted.target_lead_id) {
      const stage = VALID_STAGES.includes(extracted.stage ?? '') ? extracted.stage! : undefined
      const updates: Record<string, string> = { last_contact: new Date().toISOString() }
      if (stage) updates.stage = stage
      if (extracted.notes) updates.notes = extracted.notes

      const { data, error } = await supabase
        .from('pipeline')
        .update(updates)
        .eq('id', extracted.target_lead_id)
        .eq('agent_id', agentId)
        .select()
        .single()

      if (!error && data) actionResult = { type: 'updated', lead: data }
      else console.error('[pipeline-chat] update error:', error?.message)
    } else if (extracted.action_type === 'create_lead' && extracted.lead_name) {
      const stage = VALID_STAGES.includes(extracted.stage ?? '') ? extracted.stage! : 'new_lead'

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

    return NextResponse.json({ reply: extracted.reply ?? 'Got it.', action: actionResult })
  } catch (err) {
    console.error('[pipeline-chat] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
