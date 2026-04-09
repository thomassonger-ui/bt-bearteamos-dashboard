export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import sgMail from "@sendgrid/mail"

export async function POST(req: Request) {
  try {
    const { to, subject, body, fromName, fromEmail, sendAt } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 })
    }

    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) {
      console.error("[send-email] SENDGRID_API_KEY is not set")
      return NextResponse.json({ error: "server_misconfiguration" }, { status: 500 })
    }

    sgMail.setApiKey(apiKey)

    const senderName = fromName || "Tom Songer"
    const senderEmail = fromEmail || "tom@bearteamrealestate.com"

    const msg: sgMail.MailDataRequired = {
      to,
      from: { name: senderName, email: senderEmail },
      subject,
      text: body,
      html: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
      ...(sendAt ? { sendAt: Math.floor(new Date(sendAt).getTime() / 1000) } : {}),
    }

    await sgMail.send(msg)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[send-email] error:", err)
    return NextResponse.json({ error: "send_failed" }, { status: 500 })
  }
}