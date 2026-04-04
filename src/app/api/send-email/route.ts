export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { to, subject, body, fromName, fromEmail } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
    }

    const senderName = fromName || 'Tom Songer'
    const senderEmail = fromEmail || 'tom@bearteamrealestate.com'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [to],
        subject,
        text: body,
        reply_to: senderEmail,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[send-email] Resend error:', err.slice(0, 300))
      return NextResponse.json({ error: 'send_failed', details: err.slice(0, 200) }, { status: 500 })
    }

    const data = await res.json()
    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[send-email] unexpected:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
