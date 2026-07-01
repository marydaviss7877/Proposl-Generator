import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'

export type Department = 'creative' | 'development' | 'marketing' | 'saas'

export interface CaseStudy {
  id: string
  title: string
  department: Department
  service: string
  clientNiche: string
  platform: string
  problem: string
  solution: string
  results: string
  tags: string[]
  assets: string[]
  caseStudyLink: string
  loomLink: string
  dateAdded: string
}

const DEPARTMENTS: Department[] = ['creative', 'development', 'marketing', 'saas']

function getPortfolioPath(): string {
  return process.env.PORTFOLIO_PATH || path.join(process.cwd(), 'data', 'portfolio')
}

export async function ensureDirectories(): Promise<void> {
  const base = getPortfolioPath()
  for (const dept of DEPARTMENTS) {
    await fs.mkdir(path.join(base, dept), { recursive: true })
  }
}

export async function getAllCaseStudies(): Promise<CaseStudy[]> {
  await ensureDirectories()
  const base = getPortfolioPath()
  const studies: CaseStudy[] = []

  for (const dept of DEPARTMENTS) {
    const deptPath = path.join(base, dept)
    let files: string[]
    try {
      files = await fs.readdir(deptPath)
    } catch {
      continue
    }

    for (const file of files) {
      if (!file.endsWith('.md')) continue
      try {
        const raw = await fs.readFile(path.join(deptPath, file), 'utf-8')
        const { data, content } = matter(raw)
        studies.push({
          id: `${dept}/${file.replace('.md', '')}`,
          title: data.title ?? '',
          department: dept,
          service: data.service ?? '',
          clientNiche: data.client_niche ?? '',
          platform: data.platform ?? '',
          problem: extractSection(content, 'Problem'),
          solution: extractSection(content, 'Solution'),
          results: extractSection(content, 'Results'),
          tags: Array.isArray(data.tags) ? data.tags : [],
          assets: Array.isArray(data.assets) ? data.assets : [],
          caseStudyLink: data.case_study_link ?? '',
          loomLink: data.loom_link ?? '',
          dateAdded: data.date_added ?? '',
        })
      } catch {
        // skip malformed files
      }
    }
  }

  return studies
}

export async function getCaseStudyById(id: string): Promise<CaseStudy | null> {
  const all = await getAllCaseStudies()
  return all.find((s) => s.id === id) ?? null
}

export async function saveCaseStudy(
  data: Omit<CaseStudy, 'id' | 'dateAdded'>
): Promise<string> {
  await ensureDirectories()
  const slug = slugify(data.title)
  const filePath = path.join(getPortfolioPath(), data.department, `${slug}.md`)

  const frontmatter = {
    title: data.title,
    department: data.department,
    service: data.service,
    client_niche: data.clientNiche,
    platform: data.platform,
    tags: data.tags,
    assets: data.assets,
    case_study_link: data.caseStudyLink,
    loom_link: data.loomLink,
    date_added: new Date().toISOString().split('T')[0],
  }

  const body = `## Problem\n${data.problem}\n\n## Solution\n${data.solution}\n\n## Results\n${data.results}\n`
  const fileContent = matter.stringify(body, frontmatter)

  await fs.writeFile(filePath, fileContent, 'utf-8')
  return `${data.department}/${slug}`
}

export async function deleteCaseStudy(id: string): Promise<boolean> {
  const [dept, slug] = id.split('/')
  if (!dept || !slug) return false
  const filePath = path.join(getPortfolioPath(), dept, `${slug}.md`)
  try {
    await fs.unlink(filePath)
    return true
  } catch {
    return false
  }
}

function extractSection(body: string, section: string): string {
  const regex = new RegExp(`## ${section}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`)
  const match = body.match(regex)
  return match ? match[1].trim() : ''
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}
