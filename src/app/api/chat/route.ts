import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { getSection } from '@/lib/prompts'

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
// Built once from /prompts/recruiting-positioning.md via cached section parser.
// Falls back to a bare-minimum prompt if the file is unavailable.

let systemPrompt: string

try {
  systemPrompt = `
${getSection('4. SCOUT POSITIONING')}

${getSection('1. 30-SECOND RECRUITING PITCH')}

${getSection('5. OBJECTION HANDLING')}
`.trim()
  console.log('[Scout] Prompt system loaded')
} catch (e) {
  console.error('[Scout] Prompt load failed — using fallback', e)
  systemPrompt = 'You are a real estate recruiting assistant for Bear Team Real Estate in Orlando, FL. Be direct and concise.'
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...messages,
    ],
  })

  return result.toDataStreamResponse()
}
