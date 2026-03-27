export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const SYSTEM_PROMPT = `You are a pipeline assistant for a real estate agent. Your ONLY job is to log client leads.

RULES:
1. The moment you have a client name, IMMEDIATELY create the lead — do not ask follow-up questions first.
2. Always end your response with an <action> block when creating or updating a lead.
3. Keep your text reply to 1 sentence max.
4. Default stage is always "new_lead" unless the agent specifies otherwise.

STAGE VALUES (use exactly): new_lead, contacted, appointment_set, under_contract, closed

ACTION BLOCK FORMAT — always place at the very end of your response:
<action>{"type":"create_lead","lead_name":"Full Name","stage":"new_lead","notes":"any details mentioned"}</action>

EXAMPLE:
Agent: "Sarah Johnson, buyer, looking for 3-bed in Winter Park, budget $450K"
You: "Got it — Sarah Johnson added as a new buyer lead."
<action>{"type":"create_lead","lead_name":"Sarah Johnson","stage":"new_lead","notes":"Buyer, 3-bed in Winter Park, budget $450K"}</action>

For updates:
<action>{"type":"update_lead","lead_id":"<id>","stage":"contacted","notes":"updated notes"}</action>

If the agent says something with no client name at all, ask: "What's the client's name?"`

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

          if (!error && data) {
            actionResult = { type: 'created', lead: data }
          } else if (error) {
            console.error('[pipeline-chat] insert error:', error.message)
          }

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

          if (!error && data) {
            actionResult = { type: 'updated', lead: data }
          }
        }
      } catch (e) {
        console.error('[pipeline-chat] action parse error:', e)
      }
    } else {
      console.log('[pipeline-chat] no action block in reply:', reply.slice(0, 200))
    }

    // Strip action block from reply shown to user
    const cleanReply = reply.replace(/<action>[\s\S]*?<\/action>/gi, '').trim()

    return NextResponse.json({ reply: cleanReply, action: actionResult })
  } catch (err) {
    console.error('[pipeline-chat]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
