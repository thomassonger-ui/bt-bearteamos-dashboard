import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const token = req.cookies.get('bt_session')?.value
  const expected = process.env.SESSION_TOKEN

  if (!token || !expected || token !== expected) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/broker/:path*', '/pipeline/:path*', '/tasks/:path*', '/crm/:path*'],
}
