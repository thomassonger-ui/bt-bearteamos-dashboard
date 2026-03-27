import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { password } = await req.json()

    if (!password || password !== process.env.DASHBOARD_PASSWORD) {
      return NextResponse.json({ error: 'invalid_password' }, { status: 401 })
    }

    const token = process.env.SESSION_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set('bt_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    return res
  } catch {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
