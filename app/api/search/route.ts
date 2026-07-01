import { NextRequest, NextResponse } from 'next/server'
import { search } from '@/lib/search'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const query: string   = body.query ?? ''
  const styleId: string = body.styleId ?? ''

  if (!query.trim()) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  const response = await search(query.trim(), styleId || undefined)
  return NextResponse.json(response)
}
