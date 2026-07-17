import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizeUrl } from '@/lib/upwork/client'
import { STATE_COOKIE, getPublicOrigin } from '@/lib/upwork/constants'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  let authorizeUrl: string
  try {
    authorizeUrl = getAuthorizeUrl(crypto.randomBytes(24).toString('hex'))
  } catch (err) {
    console.error('[api/auth/upwork] not configured:', err)
    const dest = new URL('/', getPublicOrigin(req))
    dest.searchParams.set('upwork', 'error')
    dest.searchParams.set('msg', 'Upwork integration is not configured yet (missing client credentials).')
    return NextResponse.redirect(dest)
  }

  const state = new URL(authorizeUrl).searchParams.get('state')!
  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60,
    path: '/',
  })
  return res
}
