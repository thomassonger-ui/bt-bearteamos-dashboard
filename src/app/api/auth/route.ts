export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()

    const agentsRaw = process.env.AGENTS
    if (!agentsRaw) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
    }

    let agents: { username: string; password: string; role?: string }[]
    try {
      agents = JSON.parse(agentsRaw)
    } catch {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
    }

    const match = agents.find(
      (a) =>
        a.username?.toLowerCase().trim() === username?.toLowerCase().trim() &&
        a.password === password
    )

    if (!match) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
    }

    const token = process.env.SESSION_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
    }

    const is_admin = match.role === 'admin'

    const res = NextResponse.json({ ok: true, is_admin })
    res.cookies.set('bt_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
