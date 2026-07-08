import { NextResponse } from 'next/server'
import { loadEngineConfig, saveEngineConfig, validateEngineConfig } from '@/lib/engine'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const config = loadEngineConfig()
    return NextResponse.json(config)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Full structural + regex-safety validation. A bad config here would otherwise
  // be written to the persistent volume and 500 every subsequent search.
  try {
    validateEngineConfig(body)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid config' }, { status: 400 })
  }

  try {
    saveEngineConfig(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
