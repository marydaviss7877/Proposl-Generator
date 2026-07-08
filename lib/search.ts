import { pipeline, cos_sim, env, type FeatureExtractionPipeline } from '@xenova/transformers'
import { getAllCaseStudies, type CaseStudy } from './portfolio'
import { loadEngineConfig, getStyleById, type EngineConfig, type ProposalStyle } from './engine'

if (process.env.MODEL_CACHE_PATH) {
  env.cacheDir = process.env.MODEL_CACHE_PATH
} else {
  env.cacheDir = './.cache/models'
}

// Keep peak memory low on the 500MB Railway box: single-threaded ORT so the
// quantized model doesn't spin up a thread pool that blows the RAM ceiling.
try {
  const onnx = (env as { backends?: { onnx?: { wasm?: { numThreads?: number } } } }).backends?.onnx
  if (onnx?.wasm) onnx.wasm.numThreads = 1
} catch { /* backend not present — ignore */ }

// ─── Embedding pipeline singleton ────────────────────────────────────────────

class EmbeddingPipeline {
  static instance: FeatureExtractionPipeline | null = null
  static async get(): Promise<FeatureExtractionPipeline> {
    if (!this.instance) {
      // `quantized: true` loads model_quantized.onnx (~23MB) instead of the
      // ~90MB fp32 weights — required to fit inference inside 500MB of RAM.
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
let building: Promise<void> | null = null

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

function rssMB(): number {
  return Math.round(process.memoryUsage().rss / 1024 / 1024)
}

export async function buildIndex(): Promise<void> {
  // Guard against concurrent/stale rebuilds re-embedding the whole corpus at once.
  if (building) return building
  building = (async () => {
    const studies = await getAllCaseStudies()
    // Embed one at a time (not Promise.all) — on the 500MB Railway box, running
    // ~26 transformer inference passes concurrently is the single riskiest spot
    // for an OOM kill. Sequential keeps peak memory to one inference at a time,
    // and the per-study log line pinpoints exactly which one it died on.
    const newIndex: IndexedStudy[] = []
    for (let i = 0; i < studies.length; i++) {
      const study = studies[i]
      const embedding = await embed(studyToText(study))
      newIndex.push({ study, embedding })
      console.log(`[buildIndex] embedded ${i + 1}/${studies.length} (${study.id}) — rss ${rssMB()}MB`)
    }
    index = newIndex
    indexedAt = Date.now()
  })()
  try {
    await building
  } finally {
    building = null
  }
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

export interface TraceStep {
  label: string
  ms: number
  memMB: number
}

export interface SearchResponse {
  intents: string[]
  results: SearchResult[]
  synthesizedProposal: string
  styleId: string
  total: number
  trace: TraceStep[]
}

// Carries whatever trace was collected up to the point of failure, so the API
// route can hand it back to the browser instead of just a bare error message.
export class SearchError extends Error {
  trace: TraceStep[]
  constructor(message: string, trace: TraceStep[]) {
    super(message)
    this.name = 'SearchError'
    this.trace = trace
  }
}

// ─── Layer 1: Intent Extraction ───────────────────────────────────────────────

const MAX_QUERY_CHARS = 20_000

export function extractIntents(text: string): string[] {
  // Hard cap so a giant paste can't drive the O(n) work (or the dedupe) wild.
  const capped = text.slice(0, MAX_QUERY_CHARS)

  // Split on line breaks and bullet glyphs FIRST — most Upwork posts enumerate
  // requirements as a bullet/newline list with no terminal punctuation, so
  // collapsing whitespace before splitting (the old bug) fused them into one blob.
  const lines = capped
    .split(/\r?\n+/)
    .flatMap(line => line.split(/\s*[•·▪‣◦]\s*/))

  const chunks: string[] = []
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trim()
    if (!line) continue

    const sentences = line
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean)

    for (const sentence of sentences) {
      const parts = sentence.split(
        /\s*,?\s*(?:and also|as well as|along with|additionally|also|plus|,)\s+(?=[a-z])/gi
      )
      chunks.push(...parts)
    }
  }

  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of chunks) {
    // Strip leading list markers: -, –, —, •, *, "1.", "2)", "3]" etc.
    const c = raw.trim().replace(/^[-–—•*]+\s*/, '').replace(/^\d+[.)\]]\s*/, '').trim()
    const words = c.split(/\s+/).filter(Boolean)
    if (words.length < 2 || words.length > 50) continue
    const key = c.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
    if (out.length >= 12) break
  }
  return out
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
    // \b guards prevent "breakfast"→fast, "integrate"→rate style false positives.
    urgency:         /\b(asap|urgent|fast|quick|deadline|rush|immediately|right away)\b/i.test(query),
    proofSeeking:    /\b(portfolio|example|sample|proof|past work|show me|case study|previous work)\b/i.test(query),
    budgetConscious: /\b(budget|cheap|affordable|cost|rate|price|low.?cost)\b/i.test(query),
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

// Drop trailing sentence punctuation so templates that append their own "." don't
// produce doubles ("...visibility..").
function stripTail(text: string): string {
  return text.replace(/[.!?]+\s*$/, '').trim()
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

  // Normalise the final score against the best achievable raw value so the
  // displayed "%" is meaningful (a perfect match lands near 100, not 79).
  const maxPossible = maxScoreWeight + avgScoreWeight + frequencyBonusCap * frequencyBonusWeight || 1

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
      // (frequency - 1) so a single-intent match earns ZERO bonus (the old
      // `frequency/4` saturated the cap at freq=1, making the term a constant).
      const freqBonus = Math.min((frequency - 1) / 3, frequencyBonusCap)
      const raw       = avgRaw * avgScoreWeight + maxRaw * maxScoreWeight + freqBonus * frequencyBonusWeight
      const finalScore = Math.round((raw / maxPossible) * 100)

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

function buildProofText(
  result: SearchResult,
  cfg: EngineConfig,
  style: ProposalStyle
): string {
  if (!style.proofBlockTemplate) return ''

  const intentText = result.matchedIntents[0]?.intentText ?? ''
  const label      = intentToLabel(intentText, cfg)
  const solution   = stripTail(cutAtSentence(result.study.solution, 130))
  const outcome    = stripTail(cutAtSentence(result.study.results, 100))
  if (!solution) return ''

  let solText = solution.charAt(0).toLowerCase() + solution.slice(1)
  solText = solText.replace(/^we\s+we\s+/i, 'we ')

  const nRef  = result.study.clientNiche ? ` for a ${result.study.clientNiche} client` : ''
  const block = render(style.proofBlockTemplate, {
    label,
    solution:     solText,
    results:      outcome,
    client_niche: result.study.clientNiche ?? '',
    niche_ref:    nRef,
  }).replace(/\s+/g, ' ').trim()

  if (!block) return ''
  return block.endsWith('.') ? block : block + '.'
}

function assetsFor(study: CaseStudy): string[] {
  const out: string[] = []
  if (study.loomLink)      out.push(`🎥 Loom — ${study.loomLink}`)
  if (study.caseStudyLink) out.push(`📄 Case Study — ${study.caseStudyLink}`)
  return out
}

function synthesizeProposal(
  results: SearchResult[],
  intents: string[],
  query: string,
  cfg: EngineConfig,
  style: ProposalStyle
): string {
  if (results.length === 0) return ''

  const ctx = extractClientContext(query, cfg)

  // ── Hook ──────────────────────────────────────────────────────────────────
  const topIntentText = results[0].matchedIntents[0]?.intentText ?? intents[0] ?? ''
  const topLabel      = intentToLabel(topIntentText, cfg)
  const hookVars      = { label: topLabel, niche: ctx.niche, intent_count: String(intents.length) }
  const hookTpl       = ctx.niche ? style.hookTemplate : style.hookFallback
  const hook          = render(hookTpl, hookVars).replace(/\s+/g, ' ').trim()

  // ── Proof blocks (each carries its own assets, so dropping a block drops its links too) ──
  const usedStudyIds     = new Set<string>()
  const usedSolutionKeys = new Set<string>()
  const proofBlocks: Array<{ text: string; assets: string[] }> = []

  for (const result of results) {
    if (proofBlocks.length >= style.maxProofBlocks) break
    if (usedStudyIds.has(result.study.id)) continue

    const text = buildProofText(result, cfg, style)
    if (!text) continue

    const solutionKey = text.slice(0, 60).toLowerCase().replace(/\s+/g, ' ')
    if (usedSolutionKeys.has(solutionKey)) continue
    usedSolutionKeys.add(solutionKey)
    usedStudyIds.add(result.study.id)

    proofBlocks.push({ text, assets: style.includeAssets ? assetsFor(result.study) : [] })
  }

  // ── CTA ───────────────────────────────────────────────────────────────────
  const ctaKey = ctx.proofSeeking ? 'proofSeeking' : ctx.urgency ? 'urgency' : ctx.budgetConscious ? 'budgetConscious' : 'default'
  const cta    = style.ctaVariants[ctaKey]

  const assemble = (blocks: Array<{ text: string; assets: string[] }>): string => {
    const parts = [hook, ...blocks.map(b => b.text), cta]
    const seen = new Set<string>()
    const assets: string[] = []
    for (const b of blocks) {
      for (const a of b.assets) {
        if (!seen.has(a)) { seen.add(a); assets.push(a) }
      }
    }
    if (assets.length > 0) parts.push(assets.join('\n'))
    return parts.filter(Boolean).join('\n\n')
  }

  // ── Word cap — keep dropping the lowest-priority proof block until under wordMax ──
  let blocks = proofBlocks
  let draft = assemble(blocks)
  while (draft.split(/\s+/).filter(Boolean).length > style.wordMax && blocks.length > 1) {
    blocks = blocks.slice(0, -1)
    draft = assemble(blocks)
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
  if (/\b(fast|quick|urgent|asap|deadline|rush)\b/i.test(fullQuery)) points.push('Client is time-sensitive — mention turnaround speed')
  if (/\b(budget|cheap|affordable|cost|rate)\b/i.test(fullQuery))     points.push('Client is price-conscious — lead with ROI, not price')
  if (/\b(portfolio|example|proof|past work|show me)\b/i.test(fullQuery)) points.push('Client wants proof — lead with case study and Loom')
  if (s.loomLink)      points.push('Send the Loom — video builds trust faster than text')
  if (s.caseStudyLink) points.push('Attach the case study PDF to stand out from other bids')
  return points
}

function buildProposalSnippet(s: CaseStudy, intentText: string, cfg: EngineConfig, style: ProposalStyle): string {
  const label    = intentToLabel(intentText, cfg)
  const solution = stripTail(cutAtSentence(s.solution, 130))
  const outcome  = stripTail(cutAtSentence(s.results, 100))
  const nRef     = s.clientNiche ? ` for a ${s.clientNiche} client` : ''

  let solText = solution.charAt(0).toLowerCase() + solution.slice(1)
  solText = solText.replace(/^we\s+we\s+/i, 'we ')

  // Styles with no proof template (Cold Outreach) still get a usable snippet
  // instead of an empty clipboard copy.
  const template = style.proofBlockTemplate || '{label}: We {solution}. Result{niche_ref}: {results}.'

  let snippet = render(template, {
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
  const trace: TraceStep[] = []
  const mark = (label: string, since: number) => {
    const ms = Date.now() - since
    trace.push({ label, ms, memMB: rssMB() })
    console.log(`[search] ${label} — ${ms}ms, rss ${rssMB()}MB`)
  }

  try {
    let t = Date.now()
    const stale = index.length === 0 || Date.now() - indexedAt > 5 * 60 * 1000
    if (stale) {
      await buildIndex()
      mark(`Built search index (${index.length} case studies)`, t)
    } else {
      mark('Reused cached search index', t)
    }

    t = Date.now()
    const cfg   = loadEngineConfig()
    const style = getStyleById(cfg, styleId)
    mark('Loaded engine config', t)

    if (index.length === 0) {
      return { intents: [], results: [], synthesizedProposal: '', styleId: style.id, total: 0, trace }
    }

    t = Date.now()
    const intents       = extractIntents(query)
    const searchTargets = intents.length > 0 ? intents : [query.trim().slice(0, MAX_QUERY_CHARS)]
    mark(`Extracted ${searchTargets.length} requirement(s)`, t)

    t = Date.now()
    const intentResults = await Promise.all(
      searchTargets.map(async (intent) => ({
        intent,
        matches: await matchIntent(intent, 3),
      }))
    )
    mark('Ran semantic search', t)

    t = Date.now()
    const results = aggregateResults(intentResults, cfg, query, style)
    mark(`Ranked ${results.length} match(es)`, t)

    t = Date.now()
    const synthesizedProposal = synthesizeProposal(results, searchTargets, query, cfg, style)
    mark('Synthesized proposal', t)

    return { intents: searchTargets, results, synthesizedProposal, styleId: style.id, total: index.length, trace }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[search] failed:', err)
    throw new SearchError(message, trace)
  }
}
