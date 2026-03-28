export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const VALID_STAGES = [
  'new_lead', 'attempting_contact', 'contacted', 'appointment_set',
  'active_client', 'under_contract', 'closed', 'stalled',
]
const VALID_TYPES = ['buyer', 'seller', 'rental']

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
      ? pipeline.map((l: { id: string; lead_name: string; stage: string; lead_type?: string }) =>
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
            content: `You are a real estate pipeline assistant. Extract client actions and return JSON only.

Current pipeline:
${pipelineList}

Valid stages (in order): new_lead, attempting_contact, contacted, appointment_set, active_client, under_contract, closed, stalled

Return this exact JSON structure:
{
  "action_type": "create_lead|update_lead|delete_lead|ask_type|none",
  "reply": "one sentence response",
  "lead_name": "Full Name or null",
  "lead_type": "buyer|seller|rental or null",
  "stage": "one of the valid stages above, or null",
  "notes": "any details or null",
  "phone": "phone number as string or null",
  "email": "email address or null",
  "address": "property or home address or null",
  "target_lead_id": "existing lead id if updating or deleting, otherwise null"
}

Lead type rules (CRITICAL):
- Every new lead MUST have a lead_type: buyer, seller, or rental
- If a name is given but no type is mentioned for a new lead → set action_type="ask_type", reply asking "Is [name] a buyer, seller, or rental lead?"
- "buyer", "buying", "looking to buy", "wants to buy" → lead_type = "buyer"
- "seller", "selling", "listing", "wants to sell" → lead_type = "seller"
- "rental", "renting", "tenant", "looking to rent" → lead_type = "rental"

Contact info extraction:
- Extract any phone number mentioned (e.g. "407-555-1234", "his number is 321 555 9876") → phone
- Extract any email address mentioned → email
- Extract any property address or neighborhood/city mentioned as where they live or are listing → address
- For buyers: address = area they are searching (e.g. "looking in Winter Park") is fine as notes, not address
- For sellers: address = the property address they are listing

Stage mapping rules:
- "new lead", "just got a lead", "intake" → stage = "new_lead"
- "trying to reach", "attempting contact", "can't get through", "no answer", "left voicemail" → stage = "attempting_contact"
- "called", "texted", "reached out", "sent email", "followed up", "got a response", "met with", "spoke with" → stage = "contacted"
- "set appointment", "scheduled a showing", "meeting set", "appointment for" → stage = "appointment_set", notes = date/time
- "working with", "active buyer", "active seller", "buyer active", "seller active", "actively looking", "touring homes" → stage = "active_client"
- "under contract", "in contract", "signed", "went under contract" → stage = "under_contract"
- "closed", "closing", "settlement", "funded" → stage = "closed"
- "stalled", "cold", "no response", "went dark", "ghosting", "paused" → stage = "stalled"
- new name with no other context → stage = "new_lead"

Action type rules:
- action_type = "delete_lead" if user says remove/delete/take off a client
- action_type = "update_lead" if updating an existing client in the pipeline (use target_lead_id)
- action_type = "create_lead" if adding a brand new client with a known lead_type
- action_type = "ask_type" if name given but lead_type unknown for a new lead
- action_type = "none" only if truly no client action at all

For delete: match name in pipeline list to get target_lead_id.
reply must confirm what was done in 1 sentence.`,
          },
          { role: 'user', content: lastMessage },
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
      phone?: string
      email?: string
      address?: string
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
      return NextResponse.json({
        reply: extracted.reply ?? `Is ${extracted.lead_name} a buyer, seller, or rental lead?`,
        action: null,
      })
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
      if (extracted.notes)   updates.notes   = extracted.notes
      if (extracted.phone)   updates.phone   = extracted.phone
      if (extracted.email)   updates.email   = extracted.email
      if (extracted.address) updates.address = extracted.address
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
      // lead_type must be resolved (buyer|seller|rental) before insert.
      // If missing, the AI should have returned action_type='ask_type' upstream — this is a safety fallback.
      const stage = VALID_STAGES.includes(extracted.stage ?? '') ? extracted.stage! : 'new_lead'
      const lead_type = VALID_TYPES.includes(extracted.lead_type ?? '') ? extracted.lead_type! : null

      const { data, error } = await supabase
        .from('pipeline')
        .insert({
          agent_id:  agentId,
          lead_name: extracted.lead_name,
          stage,
          lead_type,
          notes:   extracted.notes   || '',
          phone:   extracted.phone   || null,
          email:   extracted.email   || null,
          address: extracted.address || null,
          last_contact: new Date().toISOString(),
        })
        .select()
        .single()
      if (!error && data) {
        actionResult = { type: 'created', lead: data }
        console.log('[pipeline-chat] created lead:', extracted.lead_name, stage, lead_type)
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
