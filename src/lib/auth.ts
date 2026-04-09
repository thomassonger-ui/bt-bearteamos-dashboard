import { NextRequest, NextResponse } from "next/server"

export function requireAuth(req: NextRequest): NextResponse | null {
  const token = process.env.INTERNAL_API_TOKEN
  if (!token) {
    console.error("[auth] INTERNAL_API_TOKEN is not configured")
    return NextResponse.json({ success: false, error: "Server misconfiguration." }, { status: 500 })
  }
  const header = req.headers.get("authorization") ?? ""
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : ""
  if (provided !== token) {
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown"
    console.warn("[auth] Unauthorized request from", ip)
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 })
  }
  return null
}
