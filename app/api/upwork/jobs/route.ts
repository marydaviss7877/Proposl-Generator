import { NextRequest, NextResponse } from 'next/server'
import { searchJobPostings } from '@/lib/upwork/jobs'
import { UpworkNotConnectedError } from '@/lib/upwork/tokens'
import { UpworkApiError } from '@/lib/upwork/client'

export const runtime = 'nodejs'

// Pure passthrough — nothing fetched here is ever written to disk, so there's
// no "Upwork Content" retention window to manage (Upwork ToS §7's 24h cache
// limit only bites once something is actually stored).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  try {
    const jobs = await searchJobPostings(q)
    return NextResponse.json({ jobs })
  } catch (err) {
    if (err instanceof UpworkNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    if (err instanceof UpworkApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status === 429 ? 429 : 502 })
    }
    console.error('[api/upwork/jobs] failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
