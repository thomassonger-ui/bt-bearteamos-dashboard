import { getSupabase } from './supabase'

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface MemoryMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── SAVE MESSAGE ─────────────────────────────────────────────────────────────
// Inserts a single message (user or assistant) into scout_memory.
// agent_id is optional — sessions without an authenticated agent pass null.

export async function saveMessage({
  agentId,
  sessionId,
  role,
  content,
}: {
  agentId: string | null
  sessionId: string
  role: 'user' | 'assistant'
  content: string
}): Promise<void> {
  const { error } = await getSupabase().from('scout_memory').insert({
    agent_id: agentId ?? null,
    session_id: sessionId,
    role,
    content,
  })
  if (error) console.error('[memory] saveMessage:', error.message)
}

// ─── GET RECENT MESSAGES ──────────────────────────────────────────────────────
// Returns the last N messages for a session, ordered oldest → newest.
// Used to build the memory context injected before current messages.

export async function getRecentMessages(
  sessionId: string,
  limit = 10
): Promise<MemoryMessage[]> {
  const { data, error } = await getSupabase()
    .from('scout_memory')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[memory] getRecentMessages:', error.message)
    return []
  }

  // Reverse so oldest message is first (correct chronological order for LLM)
  return ((data ?? []) as MemoryMessage[]).reverse()
}
