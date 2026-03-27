export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VALID_STAGES = ['new_lead','contacted','appointment_set','under_contract','closed']
const VALID_TYPES  = ['buyer','seller','rental']

export async function POST(req: Request) {
  try {
    const { messages, agentId } = await req.json()
    if (!agentId || !messages?.length) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 })
    }

    const { data: pipeline } = await supabase
      .from('pipeline')
      .select('id, lead_name, stage, lead_type')
      .eq('agent_id', agentId)
      .order('last_contact', { ascending: false })
      .limit(20)

    const pipelineList = pipeline?.length
      ? pipeline.map((l: {id: string; lead_name: string; stage: string; lead_type?: string}) =>
          `- ${l.lead_name} [${l.stage}${l.lead_type ? `, ${l.lead_type}` : ''}] id:${l.id}`
        ).join('\n')
      : 'None yet.'

    const lastMessage = messages[messages.length - 1]?.content ?? ''

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
            content: `You are a real estate pipeline assistant for a busy agent. Extract client actions and return JSON only.

Current pipeline:
${pipelineList}

Return this exact JSON structure:
{
  "action_type": "create_lead|update_lead|delete_lead|ask_type|none",
  "reply": "one sentence response",
  "lead_name": "Full Name or null",
  "lead_type": "buyer|seller|rental or null",
  "stage": "new_lead|contacted|appointment_set|under_contract|closed or null",
  "notes": "any details or null",
  "target_lead_id": "existing lead id if updating or deleting, otherwise null"
}

Lead type rules (CRITICAL):
- Every new lead MUST have a lead_type: buyer, seller, or rental
- If a name is given but no type is mentioned and it's a new lead → set action_type="ask_type" and reply asking "Is [name] a buyer, seller, or rental lead?"
- If the message contains words like "buyer", "buying", "looking to buy", "wants to buy" → lead_type = "buyer"
- If it contains "seller", "selling", "listing", "wants to sell" → lead_type = "seller"
- If it contains "rental", "renting", "tenant", "looking to rent" → lead_type = "rental"

Stage mapping rules:
- "set appointment", "scheduled a showing", "meeting set", "appointment for" → stage = "appointment_set", notes = date/time
- "called", "texted", "reached out", "sent email", "followed up" → stage = "contacted"
- "under contract", "in contract", "signed" → stage = "under_contract"
- "closed", "closing", "settlement" → stage = "closed"
- new name with no other context → stage = "new_lead"

Action type rules:
- action_type = "delete_lead" if user says remove/delete/take off a client
- action_type = "update_lead" if updating an existing client already in the pipeline list (appointments count as updates)
- action_type = "create_lead" if adding a brand new client with a known lead_type
- action_type = "ask_type" if name is given but lead_type is unknown for a new lead
- action_type = "none" only if there is truly no client action at all

For delete: match the name in the pipeline list to get target_lead_id.
reply must be one sentence confirming what was done or asking the clarifying question.`
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
      lead_type?: string
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

    if (extracted.action_type === 'ask_type') {
      // Just return the clarifying question — no DB action
      return NextResponse.json({ reply: extracted.reply ?? `Is ${extracted.lead_name} a buyer, seller, or rental lead?`, action: null })
    }

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
      if (extracted.lead_type && VALID_TYPES.includes(extracted.lead_type)) updates.lead_type = extracted.lead_type

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
      const lead_type = VALID_TYPES.includes(extracted.lead_type ?? '') ? extracted.lead_type! : null

      const { data, error } = await supabase
        .from('pipeline')
        .insert({
          agent_id: agentId,
          lead_name: extracted.lead_name,
          stage,
          lead_type,
          notes: extracted.notes || '',
          last_contact: new Date().toISOString(),
        })
        .select()
        .single()

      if (!error && data) {
        actionResult = { type: 'created', lead: data }
        console.log('[pipeline-chat] created lead:', extracted.lead_name, lead_type)
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
