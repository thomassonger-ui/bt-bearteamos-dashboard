export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SYSTEM_PROMPT = `You are a pipeline assistant for a real estate agent. Your job is to help the agent log and manage their client leads through natural conversation.

When the agent tells you about a client, extract:
- lead_name: full name of the client
- stage: one of "new_lead", "contacted", "appointment_set", "under_contract", "closed" (default: "new_lead")
- notes: any useful context (property type, budget, area, timeline, etc.)

After extracting info, confirm what you captured and ask if anything else should be noted.

If the agent asks to update an existing lead (move stage, add notes), confirm the change.

If no client info is given, ask: "Who's the new client? Tell me their name and where they're at."

Always be brief — 1-3 sentences max. You're a tool, not a conversationalist.

Return a JSON action block when you have enough info to create or update a lead. Format:
<action>
{
  "type": "create_lead" | "update_lead",
  "lead_name": "...",
  "stage": "...",
  "notes": "...",
  "lead_id": "..." (only for update_lead)
}
</action>

Always include the action block when creating or updating — it will be parsed by the system.`

export async function POST(req: Request) {
  try {
    const { messages, agentId } = await req.json()

    if (!agentId || !messages?.length) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 })
    }

    // Get existing pipeline for context
    const { data: pipeline } = await supabase
      .from('pipeline')
      .select('id, lead_name, stage, notes, last_contact')
      .eq('agent_id', agentId)
      .order('last_contact', { ascending: false })
      .limit(20)

    const pipelineContext = pipeline?.length
      ? `\nCurrent pipeline (${pipeline.length} leads):\n` +
        pipeline.map(l => `- ${l.lead_name} [${l.stage}] id:${l.id}`).join('\n')
      : '\nNo leads in pipeline yet.'

    const systemWithContext = SYSTEM_PROMPT + pipelineContext

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemWithContext },
        ...messages,
      ],
      max_tokens: 400,
    })

    const reply = completion.choices[0]?.message?.content ?? ''

    // Parse action block
    const actionMatch = reply.match(/<action>([\s\S]*?)<\/action>/i)
    let actionResult = null

    if (actionMatch) {
      try {
        const action = JSON.parse(actionMatch[1].trim())

        if (action.type === 'create_lead' && action.lead_name) {
          const { data, error } = await supabase
            .from('pipeline')
            .insert({
              agent_id: agentId,
              lead_name: action.lead_name,
              stage: action.stage || 'new_lead',
              notes: action.notes || '',
              last_contact: new Date().toISOString(),
            })
            .select()
            .single()

          if (!error && data) {
            actionResult = { type: 'created', lead: data }
          }
        } else if (action.type === 'update_lead' && action.lead_id) {
          const updates: Record<string, string> = {
            last_contact: new Date().toISOString(),
          }
          if (action.stage) updates.stage = action.stage
          if (action.notes) updates.notes = action.notes

          const { data, error } = await supabase
            .from('pipeline')
            .update(updates)
            .eq('id', action.lead_id)
            .eq('agent_id', agentId)
            .select()
            .single()

          if (!error && data) {
            actionResult = { type: 'updated', lead: data }
          }
        }
      } catch (e) {
        console.error('[pipeline-chat] action parse error:', e)
      }
    }

    // Strip action block from reply shown to user
    const cleanReply = reply.replace(/<action>[\s\S]*?<\/action>/gi, '').trim()

    return NextResponse.json({ reply: cleanReply, action: actionResult })
  } catch (err) {
    console.error('[pipeline-chat]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
