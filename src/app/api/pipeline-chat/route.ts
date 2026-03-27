export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { generateText, generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Schema for structured lead extraction
const LeadSchema = z.object({
  has_lead: z.boolean().describe('true if a client name was mentioned'),
  reply: z.string().describe('1-sentence confirmation to show the agent'),
  lead_name: z.string().optional().describe('Full name of the client'),
  stage: z.enum(['new_lead', 'contacted', 'appointment_set', 'under_contract', 'closed']).optional(),
  notes: z.string().optional().describe('Any details: area, budget, property type, timeline'),
  update_lead_id: z.string().optional().describe('ID of existing lead to update instead of creating new'),
})

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
      ? `Current pipeline:\n` + pipeline.map((l: {id: string; lead_name: string; stage: string}) => `- ${l.lead_name} [${l.stage}] id:${l.id}`).join('\n')
      : 'No leads yet.'

    const lastMessage = messages[messages.length - 1]?.content ?? ''

    // Use generateObject to force structured output — no parsing needed
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: LeadSchema,
      prompt: `You are a pipeline assistant for a real estate agent.

${pipelineContext}

Agent said: "${lastMessage}"

Instructions:
- If agent mentions a client name, set has_lead=true and extract lead_name, stage (default: new_lead), notes
- If agent wants to update an existing lead, set update_lead_id to the matching id from the pipeline list
- Write a short 1-sentence reply confirming what you did
- If no client info, set has_lead=false and reply asking for the client's name`,
    })

    let actionResult = null

    if (object.has_lead && object.lead_name) {
      if (object.update_lead_id) {
        // Update existing lead
        const updates: Record<string, string> = { last_contact: new Date().toISOString() }
        if (object.stage) updates.stage = object.stage
        if (object.notes) updates.notes = object.notes

        const { data, error } = await supabase
          .from('pipeline')
          .update(updates)
          .eq('id', object.update_lead_id)
          .eq('agent_id', agentId)
          .select()
          .single()

        if (!error && data) actionResult = { type: 'updated', lead: data }
        else console.error('[pipeline-chat] update error:', error?.message)
      } else {
        // Create new lead
        const { data, error } = await supabase
          .from('pipeline')
          .insert({
            agent_id: agentId,
            lead_name: object.lead_name,
            stage: object.stage || 'new_lead',
            notes: object.notes || '',
            last_contact: new Date().toISOString(),
          })
          .select()
          .single()

        if (!error && data) actionResult = { type: 'created', lead: data }
        else console.error('[pipeline-chat] insert error:', error?.message)
      }
    }

    console.log('[pipeline-chat] has_lead:', object.has_lead, 'action:', actionResult?.type ?? 'none')

    return NextResponse.json({ reply: object.reply, action: actionResult })
  } catch (err) {
    console.error('[pipeline-chat]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
