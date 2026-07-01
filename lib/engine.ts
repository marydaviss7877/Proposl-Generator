import fs from 'fs'
import path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NicheRule {
  id: string
  name: string   // "Dental"
  regex: string  // "dental|dentist"
}

export interface IntentLabelRule {
  id: string
  label: string   // "CRM setup"
  regex: string   // "(set\\s*up|configure).{0,20}(gohighlevel|ghl|crm)"
  priority: number
}

export interface CTAVariants {
  default: string
  proofSeeking: string
  urgency: string
  budgetConscious: string
}

export interface ProposalStyle {
  id: string
  name: string
  description: string
  wordMin: number
  wordMax: number
  maxProofBlocks: number      // 0 = no proof blocks (Cold Outreach)
  hookTemplate: string        // vars: {label} {niche} {intent_count}
  hookFallback: string        // used when no niche detected
  proofBlockTemplate: string  // vars: {label} {solution} {results} {client_niche} {niche_ref}
  ctaVariants: CTAVariants
  includeAssets: boolean
  enabled: boolean
}

export interface ScoringConfig {
  avgScoreWeight: number       // weight for average cosine similarity
  maxScoreWeight: number       // weight for peak cosine similarity
  frequencyBonusWeight: number // weight for multi-intent frequency bonus
  frequencyBonusCap: number    // max value of the raw frequency bonus (0-1)
  minScore: number             // minimum final score (0-100) to show a result
}

export interface EngineConfig {
  niches: NicheRule[]
  intentLabels: IntentLabelRule[]
  styles: ProposalStyle[]
  scoring: ScoringConfig
  defaultStyleId: string
}

// ─── Load / Save ─────────────────────────────────────────────────────────────

const ENGINE_PATH = path.resolve(process.env.ENGINE_PATH ?? './data/engine.json')

let _cache: EngineConfig | null = null
let _cachedAt = 0
const CACHE_TTL = 30_000 // 30 seconds

export function loadEngineConfig(): EngineConfig {
  if (_cache && Date.now() - _cachedAt < CACHE_TTL) return _cache
  try {
    const raw = fs.readFileSync(ENGINE_PATH, 'utf-8')
    _cache = JSON.parse(raw) as EngineConfig
    _cachedAt = Date.now()
    return _cache
  } catch {
    throw new Error(
      `Engine config not found at ${ENGINE_PATH}. Make sure data/engine.json exists.`
    )
  }
}

export function saveEngineConfig(config: EngineConfig): void {
  fs.mkdirSync(path.dirname(ENGINE_PATH), { recursive: true })
  fs.writeFileSync(ENGINE_PATH, JSON.stringify(config, null, 2), 'utf-8')
  _cache = config
  _cachedAt = Date.now()
}

export function invalidateEngineCache(): void {
  _cache = null
  _cachedAt = 0
}

export function getStyleById(config: EngineConfig, styleId?: string): ProposalStyle {
  const id = styleId ?? config.defaultStyleId
  return config.styles.find(s => s.id === id && s.enabled)
    ?? config.styles.find(s => s.enabled)
    ?? config.styles[0]
}
