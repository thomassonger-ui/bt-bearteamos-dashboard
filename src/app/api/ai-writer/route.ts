export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const prompt = body.prompt
    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'missing_prompt' }, { status: 400 })
    }

    const agentName = typeof body.agentName === 'string' ? body.agentName : 'Tom Songer'
    const agentPhone = typeof body.agentPhone === 'string' ? body.agentPhone : '407-758-8102'
    const clientName = typeof body.clientName === 'string' && body.clientName ? body.clientName : null

    const systemPrompt = `You are an expert real estate email copywriter for Bear Team Real Estate in Orlando, FL.
Bear Team is a boutique brokerage led by Bethanne Baer (Broker/Owner) with a warm, professional brand.
The agent's name is ${agentName}. Their phone is ${agentPhone}.

Your emails:
- Are short, warm, and professional — never salesy or pushy
- Sound like a real person wrote them, not a template
- Always end with a clear, low-pressure call to action
- Use the agent's real name "${agentName}" and real phone "${agentPhone}" — NEVER use [AGENT NAME] or [PHONE] placeholders
- ${clientName ? `The client's name is "${clientName}" — use their real name, never [CLIENT NAME]` : 'Use [CLIENT NAME] for the client\'s name since we don\'t know it yet'}
- Start with "Subject: ..." on its own line, then a blank line, then the body
- Include a signature block: ${agentName} | Bear Team Real Estate | ${agentPhone}

Write only the email — no commentary or explanation.`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[ai-writer] OpenAI error:', err.slice(0, 200))
      return NextResponse.json({ error: 'ai_error' }, { status: 500 })
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content ?? 'Could not generate email.'

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[ai-writer] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
