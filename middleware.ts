import { NextRequest, NextResponse } from 'next/server'

// ─── Basic-auth gate ──────────────────────────────────────────────────────────
//
// BidFlow's portfolio holds client names, results and Drive links, and every API
// route can read/write/delete them. On a public Railway URL that is wide open.
//
// If BASIC_AUTH_USER and BASIC_AUTH_PASS are set, EVERY page and API route
// requires those credentials. If they are NOT set (e.g. local dev), the app runs
// open — so set them in the Railway environment for the deployed instance.

const USER = process.env.BASIC_AUTH_USER
const PASS = process.env.BASIC_AUTH_PASS

// Constant-time-ish string compare to avoid trivial timing leaks.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function middleware(req: NextRequest) {
  // Auth disabled when no credentials are configured.
  if (!USER || !PASS) return NextResponse.next()

  const header = req.headers.get('authorization') ?? ''
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6))
      const idx = decoded.indexOf(':')
      const u = decoded.slice(0, idx)
      const p = decoded.slice(idx + 1)
      if (safeEqual(u, USER) && safeEqual(p, PASS)) return NextResponse.next()
    } catch { /* malformed header → fall through to 401 */ }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="BidFlow", charset="UTF-8"' },
  })
}

// Protect everything except Next internals and static assets.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)'],
}
