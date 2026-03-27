export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SYSTEM_PROMPT = `You are a pipeline assistant for a real estate agent. Help the agent log and manage client leads through natural conversation.

When the agent mentions a client, extract:
- lead_name: full name
- stage: one of "new_lead", "contacted", "appointment_set", "under_contract", "closed" (default: "new_lead")
- notes: useful context (property type, area, budget, timeline, etc.)

After extracting info, confirm what you captured in 1-2 sentences.

If no client info is given, ask: "Who's the new client? Tell me their name and where they're at."

When you have enough info to create or update a lead, include this exact block at the END of your response:
<action>{"type":"create_lead","lead_name":"...","stage":"...","notes":"..."}</action>

For updates include lead_id:
<action>{"type":"update_lead","lead_id":"...","stage":"...","notes":"..."}</action>

Keep responses to 1-3 sentences. Be direct.`

export async function POST(req: Request) {
  try {
    const { messages, agentId } = await req.json()

    if (!agentId || !messages?.length) {
      return NextResponse.json({ error: 'missing_params' }, { status: 400 })
    }

    // Get existing pipeline for context
    const { data: pipeline } = await supabase
      .from('pipeline')
      .select('id, lead_name, stage, notes')
      .eq('agent_id', agentId)
      .order('last_contact', { ascending: false })
      .limit(20)

    const pipelineContext = pipeline?.length
      ? `\nCurrent pipeline (${pipeline.length} leads):\n` +
        pipeline.map((l: {id: string; lead_name: string; stage: string}) => `- ${l.lead_name} [${l.stage}] id:${l.id}`).join('\n')
      : '\nNo leads in pipeline yet.'

    const systemWithContext = SYSTEM_PROMPT + pipelineContext

    const { text: reply } = await generateText({
      model: openai('gpt-4o-mini'),
      messages: [
        { role: 'system', content: systemWithContext },
        ...messages,
      ],
      maxTokens: 300,
    })

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

          if (!error && data) actionResult = { type: 'created', lead: data }
          else if (error) console.error('[pipeline-chat] insert error:', error.message)

        } else if (action.type === 'update_lead' && action.lead_id) {
          const updates: Record<string, string> = { last_contact: new Date().toISOString() }
          if (action.stage) updates.stage = action.stage
          if (action.notes) updates.notes = action.notes

          const { data, error } = await supabase
            .from('pipeline')
            .update(updates)
            .eq('id', action.lead_id)
            .eq('agent_id', agentId)
            .select()
            .single()

          if (!error && data) actionResult = { type: 'updated', lead: data }
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
