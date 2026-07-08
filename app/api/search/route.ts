import { NextRequest, NextResponse } from 'next/server'
import { search, SearchError } from '@/lib/search'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const rawQuery: string = typeof body.query === 'string' ? body.query : ''
  const styleId: string  = typeof body.styleId === 'string' ? body.styleId : ''

  if (!rawQuery.trim()) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }
  // Bound the input so a multi-MB paste can't pin the event loop.
  if (rawQuery.length > 50_000) {
    return NextResponse.json({ error: 'Query too long (max 50,000 characters)' }, { status: 413 })
  }

  try {
    const response = await search(rawQuery.trim(), styleId || undefined)
    return NextResponse.json(response)
  } catch (err) {
    console.error('[api/search] failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    const trace = err instanceof SearchError ? err.trace : undefined
    return NextResponse.json({ error: message, trace }, { status: 500 })
  }
}
