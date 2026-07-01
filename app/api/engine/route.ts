import { NextResponse } from 'next/server'
import { loadEngineConfig, saveEngineConfig, type EngineConfig } from '@/lib/engine'

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
  try {
    const body = await req.json() as EngineConfig
    if (!body.niches || !body.intentLabels || !body.styles || !body.scoring) {
      return NextResponse.json({ error: 'Invalid config shape' }, { status: 400 })
    }
    saveEngineConfig(body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
