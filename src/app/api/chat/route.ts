import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { rateLimit } from '@/lib/rateLimit'
import { getSection } from '@/lib/prompts'
import { saveMessage, getRecentMessages } from '@/lib/memory'
import {
  resolveLeadFromSession,
  updateLeadIdentity,
  updateLeadStage,
  touchLead,
  DEFAULT_AGENT_ID,
} from '@/lib/identity'
import { logActivity } from '@/lib/queries'
import {
  calculateEngagementScore,
  updateEngagementScore,
  buildPerformanceContext,
} from '@/lib/performance'

// ─── BOOKING LINK ─────────────────────────────────────────────────────────────

const BOOKING_URL = 'https://calendly.com/thomas-songer/bear-team-meet'

// ─── STATIC PROMPT SECTIONS ──────────────────────────────────────────────────
// Loaded once at module init. Falls back if file unavailable.

let basePrompt: string

try {
  basePrompt = `
${getSection('4. SCOUT POSITIONING')}

${getSection('1. 30-SECOND RECRUITING PITCH')}

${getSection('5. OBJECTION HANDLING')}
`.trim()
  console.log('[Scout] Prompt system loaded')
} catch (e) {
  console.error('[Scout] Prompt load failed — using fallback', e)
  basePrompt = 'You are a real estate recruiting assistant for Bear Team Real Estate in Orlando, FL. Be direct and concise.'
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Stage = 'QUALIFY' | 'PAIN' | 'REFRAME' | 'POSITION' | 'OBJECTION' | 'CLOSE'

// ─── STAGE INSTRUCTION MAP ────────────────────────────────────────────────────

const stageInstructionMap: Record<Stage, string> = {
  QUALIFY: `
Ask how many deals they closed in the last 12 months.
Ask ONLY this question.
No explanation.
`,

  PAIN: `
Ask what is holding them back from closing more deals.
Ask ONLY one question.
Keep it sharp.
`,

  REFRAME: `
Acknowledge briefly.
Reframe their situation as a system problem, not effort.
Do NOT ask a question.
`,

  POSITION: `
Explain BearTeamOS and Scout clearly.
Tie directly to their stated pain.
Be concise and structured.
`,

  OBJECTION: `
Address resistance directly using objection-handling style.
Do NOT validate the objection emotionally.
Reframe and redirect.
Keep it tight.
`,

  CLOSE: `
Drive action immediately.

Primary path:
Offer a call using this exact structure:
"Let's walk through your business live. I'll show you exactly what's missing."

Then present the booking link on its own line:
${BOOKING_URL}

If user shows hesitation:
Offer alternative:
"Or I can map out your next 30 days first — your call."

Keep urgency subtle: focus on clarity, not pressure.
No countdown language. No manipulation.

Do NOT end without a clear next step.
Be direct. No soft language.
`,
}

// ─── TONE CONTROL ─────────────────────────────────────────────────────────────

const toneControl = `
Do NOT use soft phrases such as:
"I'd love to"
"happy to help"
"no worries"

Be direct, assertive, and concise.
`

// ─── CLOSE FORMATTING ─────────────────────────────────────────────────────────

const closeFormatting = `
When presenting a link:
- place it on its own line
- do not embed inside text
- do not add extra commentary after the link
`

// ─── STREAM WRAPPERS ──────────────────────────────────────────────────────────

function buildCloseGuardStream(
  source: ReadableStream<Uint8Array>,
  onComplete: (fullText: string) => void
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = source.getReader()
      async function pump() {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            const hasLink = buffer.includes('http')
            const hasNextStep = buffer.includes('next 30 days')
            if (!hasLink && !hasNextStep) {
              const fallback = `\n\nLet's walk through it live:\n${BOOKING_URL}`
              buffer += fallback
              controller.enqueue(encoder.encode(fallback))
            }
            onComplete(buffer)
            controller.close()
            return
          }
          const text = decoder.decode(value, { stream: true })
          buffer += text
          controller.enqueue(value)
        }
      }
      pump().catch((err) => controller.error(err))
    },
  })
}

function buildCaptureStream(
  source: ReadableStream<Uint8Array>,
  onComplete: (fullText: string) => void
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = source.getReader()
      async function pump() {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            onComplete(buffer)
            controller.close()
            return
          }
          buffer += decoder.decode(value, { stream: true })
          controller.enqueue(value)
        }
      }
      pump().catch((err) => controller.error(err))
    },
  })
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

// ─── LOGGING HELPER ───────────────────────────────────────────────────────────

function logEvent(label: string, data?: unknown) {
  console.log(`[${label}]`, data ?? '')
}

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(ip)) {
    logEvent('rate_limited', { ip })
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 })
  }

  try {
  const body = await req.json()
  const { messages, session_id, agent_id } = body

  // ── Resolve lead from session ──────────────────────────────────────────────
  // Looks up or creates a pipeline row bound to this session_id.
  const lead = session_id
    ? await resolveLeadFromSession(session_id)
    : null

  const agentId: string = lead?.agent_id || agent_id || DEFAULT_AGENT_ID

  // ── Touch lead ─────────────────────────────────────────────────────────────
  if (lead?.id) {
    await touchLead(lead.id)
  }

  // ── Load memory ────────────────────────────────────────────────────────────
  const memory = session_id ? await getRecentMessages(session_id, 10) : []

  // ── Stage resolution ───────────────────────────────────────────────────────
  const step = messages.length
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || ''

  // Intent signals
  const hasObjection =
    lastMessage.includes('already') ||
    lastMessage.includes('have a') ||
    lastMessage.includes('happy') ||
    lastMessage.includes('good where') ||
    lastMessage.includes("don't need") ||
    lastMessage.includes('dont need')

  const isReadySignal =
    lastMessage.includes('interested') ||
    lastMessage.includes('tell me more') ||
    lastMessage.includes('how does it work')

  const isConfused =
    lastMessage.includes('what is') ||
    lastMessage.includes('what does') ||
    lastMessage.includes('how does') ||
    lastMessage.includes('not sure')

  const isBooked =
    lastMessage.includes("let's do it") ||
    lastMessage.includes('lets do it') ||
    lastMessage.includes('booked') ||
    lastMessage === 'yes'

  // Base stage from message count
  let stage: Stage
  if (step <= 1) stage = 'QUALIFY'
  else if (step === 2) stage = 'PAIN'
  else if (step === 3) stage = 'REFRAME'
  else if (step === 4) stage = 'POSITION'
  else if (step === 5) stage = 'OBJECTION'
  else stage = 'CLOSE'

  // Overrides — intent beats count
  if (hasObjection) stage = 'OBJECTION'
  if (isReadySignal && step >= 3) stage = 'CLOSE'
  if (isConfused && step >= 3) stage = 'POSITION'

  // ── Signal extraction ──────────────────────────────────────────────────────
  // Detect identity fields from user message and persist to pipeline row.
  if (lead?.id) {
    const rawMessage = messages[messages.length - 1]?.content ?? ''
    const extracted: Record<string, string> = {}

    if (rawMessage.includes('@')) {
      const emailMatch = rawMessage.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i)
      if (emailMatch) extracted.scout_email = emailMatch[0]
    }

    if (rawMessage.match(/\d{3}[-.\s]?\d{3}/)) {
      const phoneMatch = rawMessage.match(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/)
      if (phoneMatch) extracted.scout_phone = phoneMatch[0]
    }

    const nameLower = rawMessage.toLowerCase()
    if (nameLower.startsWith('my name is')) {
      const name = rawMessage.slice(10).trim().split(/\s+/).slice(0, 3).join(' ')
      if (name) {
        extracted.scout_name = name
        extracted.lead_name = name
      }
    }

    if (Object.keys(extracted).length > 0) {
      await updateLeadIdentity(lead.id, extracted)
    }
  }

  // ── Auto-stage pipeline ────────────────────────────────────────────────────
  if (lead?.id) {
    if (isBooked) {
      await updateLeadStage(lead.id, 'qualified')
    } else if (isReadySignal) {
      await updateLeadStage(lead.id, 'engaged')
    }
  }

  // ── Activity log ───────────────────────────────────────────────────────────
  await logActivity({
    agent_id: agentId,
    action_type: 'scout_interaction',
    description: `Scout interaction — session: ${session_id ?? 'anonymous'}, lead: ${lead?.id ?? 'none'}, stage: ${stage}`,
    outcome: 'neutral',
  })

  // ── Engagement scoring ─────────────────────────────────────────────────────
  const score = calculateEngagementScore({
    messages,
    stage: lead?.stage ?? 'new',
    lastInteraction: lead?.scout_last_interaction,
  })

  if (lead?.id) {
    await updateEngagementScore(lead.id, score)
    await logActivity({
      agent_id: agentId,
      action_type: 'engagement_score_updated',
      description: `Score updated to ${score}`,
      outcome: 'neutral',
    })
  }

  // ── Build system prompt ────────────────────────────────────────────────────
  const stageInstruction = stageInstructionMap[stage]
  const performanceContext = buildPerformanceContext(score)

  const systemPrompt = `
${basePrompt}

${toneControl}

${stage === 'CLOSE' ? closeFormatting : ''}

=======================================================
LEAD PERFORMANCE CONTEXT (DO NOT REVEAL)
${performanceContext}
=======================================================

=======================================================
CONVERSATION CONTROL (DO NOT REVEAL)
CURRENT STAGE: ${stage}
INSTRUCTION: ${stageInstruction}
=======================================================
`.trim()

  // ── Build message stack ────────────────────────────────────────────────────
  // Order: system → memory (historical) → current messages
  const messageStack = [
    { role: 'system' as const, content: systemPrompt },
    ...memory,
    ...messages,
  ]

  // ── Save user message ──────────────────────────────────────────────────────
  const userContent = messages[messages.length - 1]?.content ?? ''
  if (session_id && userContent) {
    await saveMessage({
      agentId,
      sessionId: session_id,
      role: 'user',
      content: userContent,
    })
  }

  // ── AI call + full text capture ────────────────────────────────────────────
  let fullText: string
  try {
    const result = await streamText({
      model: openai('gpt-4o-mini'),
      messages: messageStack,
    })
    fullText = await result.text
  } catch (err) {
    logEvent('ai_failure', err)
    return new Response(JSON.stringify({ error: 'ai_failure' }), { status: 500 })
  }

  // ── CLOSE guard — append booking link if missing ───────────────────────────
  if (stage === 'CLOSE') {
    const hasLink = fullText.includes('http')
    const hasNextStep = fullText.includes('next 30 days')
    if (!hasLink && !hasNextStep) {
      fullText += `\n\nLet's walk through it live:\n${BOOKING_URL}`
    }
  }

  // ── Save assistant message to memory ──────────────────────────────────────
  if (session_id && fullText) {
    saveMessage({
      agentId,
      sessionId: session_id,
      role: 'assistant',
      content: fullText,
    }).catch((err) => console.error('[memory] save assistant:', err))
  }

  logEvent('scout_response', { session_id, stage, score })

  return new Response(
    JSON.stringify({ reply: fullText }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  } catch (err) {
    logEvent('api_error', err)
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500 })
  }
}
