import { NextRequest, NextResponse } from 'next/server'
import { getCaseStudyById, deleteCaseStudy } from '@/lib/portfolio'
import { buildIndex } from '@/lib/search'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = decodeURIComponent(rawId)
  const study = await getCaseStudyById(id)
  if (!study) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ study })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = decodeURIComponent(rawId)
  const ok = await deleteCaseStudy(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await buildIndex()
  return NextResponse.json({ success: true })
}
