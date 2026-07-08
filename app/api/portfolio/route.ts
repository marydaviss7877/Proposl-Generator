import { NextRequest, NextResponse } from 'next/server'
import { getAllCaseStudies, saveCaseStudy, ValidationError } from '@/lib/portfolio'
import { buildIndex } from '@/lib/search'

export const runtime = 'nodejs'

export async function GET() {
  const studies = await getAllCaseStudies()
  return NextResponse.json({ studies })
}

export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => null)
  if (!data?.title || !data?.department) {
    return NextResponse.json({ error: 'title and department are required' }, { status: 400 })
  }

  try {
    const id = await saveCaseStudy(data)
    // Rebuild search index so new entry is immediately searchable
    await buildIndex()
    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    // Invalid department, empty slug, or duplicate title → 400, not a 500.
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[api/portfolio] save failed:', err)
    return NextResponse.json({ error: 'Failed to save case study' }, { status: 500 })
  }
}
