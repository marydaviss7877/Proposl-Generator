import { pipeline, cos_sim, env } from '@xenova/transformers'
import { getAllCaseStudies, type CaseStudy } from './portfolio'
import { loadEngineConfig, getStyleById, type EngineConfig, type ProposalStyle } from './engine'

if (process.env.MODEL_CACHE_PATH) {
  env.cacheDir = process.env.MODEL_CACHE_PATH
} else {
  env.cacheDir = './.cache/models'
}

// ─── Embedding pipeline singleton ────────────────────────────────────────────

type Extractor = Awaited<ReturnType<typeof pipeline>>

class EmbeddingPipeline {
  static instance: Extractor | null = null
  static async get(): Promise<Extractor> {
    if (!this.instance) {
      this.instance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
      })
    }
    return this.instance
  }
}

interface IndexedStudy {
  study: CaseStudy
  embedding: number[]
}

let index: IndexedStudy[] = []
let indexedAt = 0

async function embed(text: string): Promise<number[]> {
  const extractor = await EmbeddingPipeline.get()
  const out = await extractor(text, { pooling: 'mean', normalize: true })
  return Array.from(out.data as Float32Array)
}

function studyToText(s: CaseStudy): string {
  return [s.title, s.service, s.clientNiche, s.department, s.problem, s.solution, s.results, s.tags.join(' ')]
    .filter(Boolean)
    .join(' ')
}

export async function buildIndex(): Promise<void> {
  const studies = await getAllCaseStudies()
  index = await Promise.all(
    studies.map(async (study) => ({ study, embedding: await embed(studyToText(study)) }))
  )
  indexedAt = Date.now()
}

export function getIndexSize(): number {
  return index.length
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntentMatch {
  intentText: string
  score: number
}

export interface SearchResult {
  study: CaseStudy
  score: number
  frequency: number
  matchedIntents: IntentMatch[]
  whyItMatches: string
  whatToHighlight: string[]
  proposalSnippet: string
}

export interface SearchResponse {
  intents: string[]
  results: SearchResult[]
  synthesizedProposal: string
  styleId: string
  total: number
}

// ─── Layer 1: Intent Extraction ───────────────────────────────────────────────

export function extractIntents(text: string): string[] {
  const normalised = text.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').trim()

  const sentences = normalised
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)

  const chunks: string[] = []
  for (const sentence of sentences) {
    const parts = sentence.split(
      /\s*,?\s*(?:and also|as well as|along with|additionally|also|plus|,)\s+(?=[a-z])/gi
    )
    chunks.push(...parts)
  }

  return chunks
    .map(c => c.trim().replace(/^[-–•*\d.]+\s*/, ''))
    .filter(c => {
      const words = c.split(/\s+/)
      return words.length >= 4 && words.length <= 50
    })
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .slice(0, 10)
}

// ─── Layer 2: Per-Intent Search ───────────────────────────────────────────────

async function matchIntent(
  intentText: string,
  topK = 3
): Promise<Array<{ study: CaseStudy; score: number }>> {
  const queryVec = await embed(intentText)
  return index
    .map(({ study, embedding }) => ({ study, score: cos_sim(queryVec, embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(r => r.score > 0.2)
}

// ─── Engine helpers ───────────────────────────────────────────────────────────

function intentToLabel(intent: string, cfg: EngineConfig): string {
  const sorted = [...cfg.intentLabels].sort((a, b) => a.priority - b.priority)
  for (const rule of sorted) {
    try {
      if (new RegExp(rule.regex, 'i').test(intent)) return rule.label
    } catch { /* skip invalid regex */ }
  }
  const stripped = intent
    .replace(/^(i need|we need|looking for|need someone to|help (me |us )?with|i want|we want)\s*/i, '')
    .split(/\s+/).slice(0, 5).join(' ')
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

interface ClientContext {
  niche: string
  urgency: boolean
  proofSeeking: boolean
  budgetConscious: boolean
}

function extractClientContext(query: string, cfg: EngineConfig): ClientContext {
  let niche = ''
  for (const rule of cfg.niches) {
    try {
      if (new RegExp(rule.regex, 'i').test(query)) { niche = rule.name; break }
    } catch { /* skip */ }
  }
  return {
    niche,
    urgency:         /(asap|urgent|fast|quick|deadline|rush|immediately|right away)/i.test(query),
    proofSeeking:    /(portfolio|example|sample|proof|past work|show me|case study|previous work)/i.test(query),
    budgetConscious: /(budget|cheap|affordable|cost|rate|price|low.?cost)/i.test(query),
  }
}

// ─── Protocol 3: Cut text at a sentence boundary ─────────────────────────────

function cutAtSentence(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean

  const w = clean.slice(0, maxChars)
  const lastEnd = Math.max(w.lastIndexOf('. '), w.lastIndexOf('! '), w.lastIndexOf('? '))

  if (lastEnd > maxChars * 0.35) return w.slice(0, lastEnd + 1).trim()

  const lastSpace = w.lastIndexOf(' ')
  return (lastSpace > 0 ? w.slice(0, lastSpace) : w).replace(/[,;:]$/, '') + '.'
}

// ─── Template renderer ────────────────────────────────────────────────────────

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match))
}

// ─── Layer 3: Score Aggregation ───────────────────────────────────────────────

function aggregateResults(
  intentResults: Array<{ intent: string; matches: Array<{ study: CaseStudy; score: number }> }>,
  cfg: EngineConfig,
  fullQuery: string,
  style: ProposalStyle
): SearchResult[] {
  const { avgScoreWeight, maxScoreWeight, frequencyBonusWeight, frequencyBonusCap, minScore } = cfg.scoring

  const map = new Map<string, { study: CaseStudy; scores: number[]; intents: IntentMatch[] }>()

  for (const { intent, matches } of intentResults) {
    for (const { study, score } of matches) {
      const existing = map.get(study.id)
      if (existing) {
        existing.scores.push(score)
        existing.intents.push({ intentText: intent, score })
      } else {
        map.set(study.id, { study, scores: [score], intents: [{ intentText: intent, score }] })
      }
    }
  }

  return Array.from(map.values())
    .map(({ study, scores, intents }) => {
      const frequency = intents.length
      const maxRaw    = Math.max(...scores)
      const avgRaw    = scores.reduce((a, b) => a + b, 0) / scores.length
      const freqBonus = Math.min(frequency / 4, frequencyBonusCap)
      const finalScore = Math.round(
        (avgRaw * avgScoreWeight + maxRaw * maxScoreWeight + freqBonus * frequencyBonusWeight) * 100
      )

      const sortedIntents = [...intents].sort((a, b) => b.score - a.score)

      return {
        study,
        score: Math.min(finalScore, 99),
        frequency,
        matchedIntents: sortedIntents,
        whyItMatches:   buildWhyItMatches(sortedIntents, study, frequency, cfg),
        whatToHighlight: buildHighlights(intents.map(i => i.intentText).join(' '), study),
        proposalSnippet: buildProposalSnippet(study, sortedIntents[0]?.intentText ?? '', cfg, style),
      }
    })
    .filter(r => r.score >= (minScore ?? 0))
    .sort((a, b) => b.score - a.score || b.frequency - a.frequency)
    .slice(0, 6)
}

// ─── Layer 4: Proposal Synthesis ─────────────────────────────────────────────

function synthesizeProposal(
  results: SearchResult[],
  intents: string[],
  query: string,
  cfg: EngineConfig,
  style: ProposalStyle
): string {
  if (results.length === 0) return ''

  const ctx   = extractClientContext(query, cfg)
  const parts: string[] = []
  const usedStudyIds    = new Set<string>()
  const usedSolutionKeys = new Set<string>()
  const allAssets: string[] = []

  // ── Hook ──────────────────────────────────────────────────────────────────
  const topIntentText = results[0].matchedIntents[0]?.intentText ?? intents[0] ?? ''
  const topLabel      = intentToLabel(topIntentText, cfg)
  const hookVars      = { label: topLabel, niche: ctx.niche, intent_count: String(intents.length) }
  const hookTpl       = ctx.niche ? style.hookTemplate : style.hookFallback
  parts.push(render(hookTpl, hookVars))

  // ── Proof blocks ──────────────────────────────────────────────────────────
  for (const result of results) {
    if (usedStudyIds.size >= style.maxProofBlocks) break
    if (usedStudyIds.has(result.study.id)) continue
    if (!style.proofBlockTemplate) continue

    const intentText = result.matchedIntents[0]?.intentText ?? ''
    const label      = intentToLabel(intentText, cfg)
    const solution   = cutAtSentence(result.study.solution, 130)
    const outcome    = cutAtSentence(result.study.results,  100)

    // Skip identical placeholder content
    const solutionKey = solution.slice(0, 60).toLowerCase().replace(/\s+/g, ' ')
    if (usedSolutionKeys.has(solutionKey)) continue
    usedSolutionKeys.add(solutionKey)
    usedStudyIds.add(result.study.id)

    // Normalise: lowercase first char, remove double "We we"
    let solText = solution.charAt(0).toLowerCase() + solution.slice(1)
    solText = solText.replace(/^we\s+we\s+/i, 'we ')

    const nRef   = result.study.clientNiche ? ` for a ${result.study.clientNiche} client` : ''
    const block  = render(style.proofBlockTemplate, {
      label,
      solution:     solText,
      results:      outcome,
      client_niche: result.study.clientNiche ?? '',
      niche_ref:    nRef,
    })
    const trimmedBlock = block.replace(/\s+/g, ' ').trim()
    if (trimmedBlock) parts.push(trimmedBlock.endsWith('.') ? trimmedBlock : trimmedBlock + '.')

    if (style.includeAssets) {
      if (result.study.loomLink && !allAssets.some(a => a.includes(result.study.loomLink))) {
        allAssets.push(`🎥 Loom — ${result.study.loomLink}`)
      }
      if (result.study.caseStudyLink && !allAssets.some(a => a.includes(result.study.caseStudyLink))) {
        allAssets.push(`📄 Case Study — ${result.study.caseStudyLink}`)
      }
    }
  }

  // ── CTA ───────────────────────────────────────────────────────────────────
  const ctaKey = ctx.proofSeeking ? 'proofSeeking' : ctx.urgency ? 'urgency' : ctx.budgetConscious ? 'budgetConscious' : 'default'
  parts.push(style.ctaVariants[ctaKey])

  // ── Assets block at bottom ────────────────────────────────────────────────
  if (allAssets.length > 0) parts.push(allAssets.join('\n'))

  // ── Word limit — drop last proof block if over wordMax ────────────────────
  const draft = parts.join('\n\n')
  if (draft.split(/\s+/).length > style.wordMax && usedStudyIds.size > 1) {
    const trimmed = [...parts]
    // Remove the last proof block (index 1-based, after hook, before CTA/assets)
    const proofEnd = parts.length - (allAssets.length > 0 ? 2 : 1)
    if (proofEnd > 1) trimmed.splice(proofEnd - 1, 1)
    return trimmed.join('\n\n')
  }

  return draft
}

// ─── Explanation helpers ──────────────────────────────────────────────────────

function buildWhyItMatches(intents: IntentMatch[], s: CaseStudy, frequency: number, cfg: EngineConfig): string {
  const reasons: string[] = []
  if (frequency > 1) reasons.push(`Matched by ${frequency} separate requirements in this job`)
  const topIntent = intents[0]?.intentText ?? ''
  if (topIntent) reasons.push(`Strongest match: ${intentToLabel(topIntent, cfg)}`)
  if (s.clientNiche) reasons.push(`Delivered for ${s.clientNiche} clients before`)
  return reasons.join(' · ')
}

function buildHighlights(fullQuery: string, s: CaseStudy): string[] {
  const points: string[] = []
  if (s.results) points.push(`Lead with results — "${cutAtSentence(s.results, 90)}"`)
  if (s.clientNiche && fullQuery.toLowerCase().includes(s.clientNiche.toLowerCase())) {
    points.push(`Niche match — emphasise your ${s.clientNiche} experience specifically`)
  }
  if (/(fast|quick|urgent|asap|deadline|rush)/i.test(fullQuery)) points.push('Client is time-sensitive — mention turnaround speed')
  if (/(budget|cheap|affordable|cost|rate)/i.test(fullQuery))     points.push('Client is price-conscious — lead with ROI, not price')
  if (/(portfolio|example|proof|past work|show me)/i.test(fullQuery)) points.push('Client wants proof — lead with case study and Loom')
  if (s.loomLink)      points.push('Send the Loom — video builds trust faster than text')
  if (s.caseStudyLink) points.push('Attach the case study PDF to stand out from other bids')
  return points
}

function buildProposalSnippet(s: CaseStudy, intentText: string, cfg: EngineConfig, style: ProposalStyle): string {
  if (!style.proofBlockTemplate) return ''
  const label    = intentToLabel(intentText, cfg)
  const solution = cutAtSentence(s.solution, 130)
  const outcome  = cutAtSentence(s.results,  100)
  const nRef     = s.clientNiche ? ` for a ${s.clientNiche} client` : ''

  let solText = solution.charAt(0).toLowerCase() + solution.slice(1)
  solText = solText.replace(/^we\s+we\s+/i, 'we ')

  let snippet = render(style.proofBlockTemplate, {
    label,
    solution:     solText,
    results:      outcome,
    client_niche: s.clientNiche ?? '',
    niche_ref:    nRef,
  }).replace(/\s+/g, ' ').trim()

  if (snippet && !snippet.endsWith('.')) snippet += '.'

  const assets = [
    s.loomLink      ? `🎥 ${s.loomLink}`      : '',
    s.caseStudyLink ? `📄 ${s.caseStudyLink}` : '',
  ].filter(Boolean).join('  |  ')
  if (assets) snippet += `\n${assets}`

  return snippet
}

// ─── Main search entry point ──────────────────────────────────────────────────

export async function search(query: string, styleId?: string): Promise<SearchResponse> {
  const stale = index.length === 0 || Date.now() - indexedAt > 5 * 60 * 1000
  if (stale) await buildIndex()

  const cfg   = loadEngineConfig()
  const style = getStyleById(cfg, styleId)

  if (index.length === 0) {
    return { intents: [], results: [], synthesizedProposal: '', styleId: style.id, total: 0 }
  }

  const intents       = extractIntents(query)
  const searchTargets = intents.length > 0 ? intents : [query.trim()]

  const intentResults = await Promise.all(
    searchTargets.map(async (intent) => ({
      intent,
      matches: await matchIntent(intent, 3),
    }))
  )

  const results             = aggregateResults(intentResults, cfg, query, style)
  const synthesizedProposal = synthesizeProposal(results, searchTargets, query, cfg, style)

  return { intents: searchTargets, results, synthesizedProposal, styleId: style.id, total: index.length }
}
