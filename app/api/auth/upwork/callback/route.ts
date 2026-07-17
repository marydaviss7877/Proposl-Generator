import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/lib/upwork/client'
import { storeTokenResponse } from '@/lib/upwork/tokens'
import { STATE_COOKIE } from '@/lib/upwork/constants'

export const runtime = 'nodejs'

function redirectHome(origin: string, status: 'connected' | 'error', msg?: string) {
  const dest = new URL('/', origin)
  dest.searchParams.set('upwork', status)
  if (msg) dest.searchParams.set('msg', msg)
  const res = NextResponse.redirect(dest)
  res.cookies.delete(STATE_COOKIE)
  return res
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const cookieState = req.cookies.get(STATE_COOKIE)?.value

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectHome(req.nextUrl.origin, 'error', 'Invalid or expired authorization request — please try connecting again.')
  }

  try {
    const tokenResponse = await exchangeCodeForToken(code)
    await storeTokenResponse(tokenResponse)
    return redirectHome(req.nextUrl.origin, 'connected')
  } catch (err) {
    console.error('[api/auth/upwork/callback] token exchange failed:', err)
    return redirectHome(req.nextUrl.origin, 'error', 'Failed to connect to Upwork — check server logs.')
  }
}
