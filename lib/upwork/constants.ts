import type { NextRequest } from 'next/server'

export const STATE_COOKIE = 'upwork_oauth_state'

// Railway's proxy terminates the public request and forwards it to this
// container's own internal bind address (e.g. localhost:8080), so
// req.nextUrl.origin reflects that internal address, not the public URL the
// user actually hit. Reverse proxies (Railway included) pass the original
// host/protocol via these standard forwarded headers instead.
export function getPublicOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto')
  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`
  }
  return req.nextUrl.origin
}
