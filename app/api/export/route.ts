import { NextResponse } from 'next/server'
import { getAllCaseStudies } from '@/lib/portfolio'
import { loadEngineConfig } from '@/lib/engine'

export const runtime = 'nodejs'

// Backup endpoint. The Railway volume is the ONLY copy of everything added
// through the app since launch (git holds just the seed snapshot). This returns
// the full portfolio + engine config as one JSON blob so it can be saved off-box.
// GET /api/export  →  downloads bidflow-backup-<date>.json
export async function GET() {
  try {
    const [studies, engine] = await Promise.all([
      getAllCaseStudies(),
      Promise.resolve(loadEngineConfig()),
    ])

    const payload = {
      exportedAt: new Date().toISOString(),
      count: studies.length,
      studies,
      engine,
    }

    const date = new Date().toISOString().split('T')[0]
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="bidflow-backup-${date}.json"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
