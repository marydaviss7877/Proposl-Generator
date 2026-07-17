import { NextResponse } from 'next/server'
import { isConnected } from '@/lib/upwork/tokens'

export const runtime = 'nodejs'

export async function GET() {
  const connected = await isConnected()
  return NextResponse.json({ connected })
}
