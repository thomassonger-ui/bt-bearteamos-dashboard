import { getSupabase } from '@/lib/supabase'

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface ScoringInput {
  messages: Array<{ role: string; content: string }>
  stage: string
  lastInteraction: string | null | undefined
}

// ─── INTENT WORD SETS ─────────────────────────────────────────────────────────

const INTENT_WORDS = [
  'interested',
  'tell me more',
  'how do i join',
  'sounds good',
  'this sounds great',
  'how does this work',
  'i want to',
  'let me know more',
  'sign me up',
  'where do i start',
]

const IDENTITY_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, // email
  /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/, // phone
  /^my name is/i, // name
]

// ─── CALCULATE ENGAGEMENT SCORE ───────────────────────────────────────────────

export function calculateEngagementScore({
  messages,
  stage,
  lastInteraction,
}: ScoringInput): number {
  let score = 0

  const userMessages = messages.filter((m) => m.role === 'user')
  const lastUserMessage = userMessages[userMessages.length - 1]?.content?.toLowerCase() ?? ''
  const rawLastMessage = userMessages[userMessages.length - 1]?.content ?? ''

  // ── Positive signals ────────────────────────────────────────────────────────

  // User responded in session → +2 (per user message, max 3 counted = +6 max)
  const responseCount = Math.min(userMessages.length, 3)
  score += responseCount * 2

  // Message contains intent words → +5
  const hasIntent = INTENT_WORDS.some((word) => lastUserMessage.includes(word))
  if (hasIntent) score += 5

  // Message contains identity info → +5
  const hasIdentity = IDENTITY_PATTERNS.some((pattern) => pattern.test(rawLastMessage))
  if (hasIdentity) score += 5

  // Stage bonuses
  if (stage === 'engaged') score += 10
  if (stage === 'qualified') score += 20

  // ── Negative signals ────────────────────────────────────────────────────────

  // No response after CLOSE stage → -10
  // Proxy: stage is CLOSE and last user message is empty or very short
  const isNonResponse = lastUserMessage.trim().length < 4
  if (stage === 'qualified' && isNonResponse) score -= 10

  // Inactivity > 48h → -5
  if (lastInteraction) {
    const hoursSince =
      (Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60)
    if (hoursSince > 48) score -= 5
  }

  // ── Clamp 0–100 ─────────────────────────────────────────────────────────────
  return Math.max(0, Math.min(100, score))
}

// ─── UPDATE ENGAGEMENT SCORE IN DB ───────────────────────────────────────────

export async function updateEngagementScore(
  leadId: string,
  score: number
): Promise<void> {
  const { error } = await getSupabase()
    .from('pipeline')
    .update({
      engagement_score: score,
      last_engagement_update: new Date().toISOString(),
    })
    .eq('id', leadId)

  if (error) {
    console.error('[performance] updateEngagementScore failed:', error.message)
  }
}

// ─── PERFORMANCE CONTEXT FOR PROMPT ──────────────────────────────────────────

export function buildPerformanceContext(score: number): string {
  let behavior: string
  if (score <= 30) {
    behavior = 'low engagement → simplify language, re-engage with a single easy question, do NOT hard close'
  } else if (score <= 70) {
    behavior = 'moderate engagement → educate clearly, guide through value, build toward close'
  } else {
    behavior = 'high engagement → move directly to close, present booking link, remove friction'
  }

  return `
LEAD ENGAGEMENT SCORE: ${score}/100
${behavior}
`.trim()
}
