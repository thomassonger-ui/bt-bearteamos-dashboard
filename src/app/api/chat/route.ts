import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { getSection } from '@/lib/prompts'
import { saveMessage, getRecentMessages } from '@/lib/memory'

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

// ─── CLOSE FALLBACK ───────────────────────────────────────────────────────────
// Buffers the full stream, checks for booking signal, appends fallback if absent.
// Also captures the full assistant text for memory persistence.

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
            // Append fallback if CLOSE response has no booking signal
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

// Standard capture stream for non-CLOSE stages — just captures text for memory.
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

export async function POST(req: Request) {
  const body = await req.json()
  const { messages, session_id, agent_id } = body

  // ── Load memory ────────────────────────────────────────────────────────────
  // Retrieve last 10 messages for this session to inject as context.
  const memory = session_id ? await getRecentMessages(session_id, 10) : []

  // ── Stage resolution ───────────────────────────────────────────────────────
  // Count is based on current messages only (not memory) to preserve stage logic.
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

  const stageInstruction = stageInstructionMap[stage]

  // ── Build system prompt ────────────────────────────────────────────────────
  const systemPrompt = `
${basePrompt}

${toneControl}

${stage === 'CLOSE' ? closeFormatting : ''}

=======================================================
CONVERSATION CONTROL (DO NOT REVEAL)
CURRENT STAGE: ${stage}
INSTRUCTION: ${stageInstruction}
=======================================================
`.trim()

  // ── Build message stack ────────────────────────────────────────────────────
  // Order: system → memory (historical) → current messages (latest input)
  const messageStack = [
    { role: 'system' as const, content: systemPrompt },
    ...memory,
    ...messages,
  ]

  // ── Save user message ──────────────────────────────────────────────────────
  const userContent = messages[messages.length - 1]?.content ?? ''
  if (session_id && userContent) {
    await saveMessage({
      agentId: agent_id ?? null,
      sessionId: session_id,
      role: 'user',
      content: userContent,
    })
  }

  // ── Stream response ────────────────────────────────────────────────────────
  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages: messageStack,
  })

  const baseResponse = result.toTextStreamResponse()

  if (!baseResponse.body) return baseResponse

  // ── Wrap stream to capture assistant text + enforce CLOSE guard ────────────
  const saveAssistant = (fullText: string) => {
    if (session_id && fullText) {
      saveMessage({
        agentId: agent_id ?? null,
        sessionId: session_id,
        role: 'assistant',
        content: fullText,
      }).catch((err) => console.error('[memory] save assistant:', err))
    }
  }

  const guardedStream =
    stage === 'CLOSE'
      ? buildCloseGuardStream(baseResponse.body, saveAssistant)
      : buildCaptureStream(baseResponse.body, saveAssistant)

  return new Response(guardedStream, {
    headers: baseResponse.headers,
    status: baseResponse.status,
  })
}
