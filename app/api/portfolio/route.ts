import { NextRequest, NextResponse } from 'next/server'
import { getAllCaseStudies, saveCaseStudy } from '@/lib/portfolio'
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

  const id = await saveCaseStudy(data)
  // Rebuild search index so new entry is immediately searchable
  await buildIndex()
  return NextResponse.json({ id }, { status: 201 })
}
