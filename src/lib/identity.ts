import { getSupabase } from './getSupabase()'
import type { Pipeline } from '@/types'

// ─── DEFAULT AGENT ────────────────────────────────────────────────────────────
// Used when a Scout session has no authenticated agent context.
// Must match the seeded agent ID in the agents table.

export const DEFAULT_AGENT_ID = 'e53282c8-8b69-437d-9c32-503b5e87b7f0'

// ─── RESOLVE LEAD FROM SESSION ────────────────────────────────────────────────
// Looks up the pipeline row bound to this session_id.
// If none exists, creates a new pipeline row as 'new' stage.
// Returns the lead row either way — caller is guaranteed a valid lead.

export async function resolveLeadFromSession(sessionId: string): Promise<Pipeline> {
  // 1. Find existing row
  const { data: existing, error: findError } = await getSupabase()
    .from('pipeline')
    .select('*')
    .eq('scout_session_id', sessionId)
    .limit(1)
    .single()

  if (!findError && existing) {
    return existing as Pipeline
  }

  // 2. Not found — create new pipeline row for this session
  const now = new Date().toISOString()
  const { data: created, error: createError } = await getSupabase()
    .from('pipeline')
    .insert({
      agent_id: DEFAULT_AGENT_ID,
      lead_name: 'Unknown Lead',
      stage: 'new',
      last_contact: now,
      scout_session_id: sessionId,
      scout_last_interaction: now,
    })
    .select()
    .single()

  if (createError || !created) {
    console.error('[identity] resolveLeadFromSession create failed:', createError?.message)
    // Return a minimal stub so the rest of the request doesn't break
    return {
      id: '',
      agent_id: DEFAULT_AGENT_ID,
      lead_name: 'Unknown Lead',
      stage: 'new',
      last_contact: now,
      created_at: now,
      scout_session_id: sessionId,
    }
  }

  return created as Pipeline
}

// ─── UPDATE LEAD IDENTITY ─────────────────────────────────────────────────────
// Persists extracted identity fields to the pipeline row.
// Only updates fields that are provided — does not overwrite others.

export async function updateLeadIdentity(
  leadId: string,
  fields: {
    scout_name?: string
    scout_email?: string
    scout_phone?: string
    lead_name?: string
  }
): Promise<void> {
  if (!leadId || Object.keys(fields).length === 0) return

  const { error } = await getSupabase()
    .from('pipeline')
    .update(fields)
    .eq('id', leadId)

  if (error) console.error('[identity] updateLeadIdentity:', error.message)
}

// ─── UPDATE PIPELINE STAGE ────────────────────────────────────────────────────
// Updates the stage of a pipeline row.

export async function updateLeadStage(leadId: string, stage: string): Promise<void> {
  if (!leadId) return

  const { error } = await getSupabase()
    .from('pipeline')
    .update({ stage })
    .eq('id', leadId)

  if (error) console.error('[identity] updateLeadStage:', error.message)
}

// ─── TOUCH LEAD ───────────────────────────────────────────────────────────────
// Updates scout_last_interaction and last_contact to now.
// Called on every Scout request to keep the lead fresh.

export async function touchLead(leadId: string): Promise<void> {
  if (!leadId) return

  const now = new Date().toISOString()
  const { error } = await getSupabase()
    .from('pipeline')
    .update({ scout_last_interaction: now, last_contact: now })
    .eq('id', leadId)

  if (error) console.error('[identity] touchLead:', error.message)
}
