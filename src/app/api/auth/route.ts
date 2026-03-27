import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  const correctPassword = process.env.DASHBOARD_PASSWORD;
  const sessionToken = process.env.SESSION_TOKEN;

  if (!correctPassword || !sessionToken) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (password !== correctPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set('bt_os_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return response;
}
