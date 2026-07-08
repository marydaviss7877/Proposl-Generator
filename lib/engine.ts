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

// ─── Validation ──────────────────────────────────────────────────────────────

const MAX_REGEX_LEN = 200

// Heuristic ReDoS guard: reject a quantified group whose body already contains a
// quantifier (e.g. "(a+)+", "(a*)*", "(\d+)+"). These are the classic
// catastrophic-backtracking shapes. Not exhaustive, but blocks the easy footguns.
function isDangerousRegex(src: string): boolean {
  return /\([^)]*[+*][^)]*\)\s*[+*]/.test(src) || /\(\?:[^)]*[+*][^)]*\)\s*[+*]/.test(src)
}

function assertUsableRegex(src: string, where: string): void {
  if (typeof src !== 'string') throw new Error(`${where}: regex must be a string`)
  if (src.length > MAX_REGEX_LEN) throw new Error(`${where}: regex exceeds ${MAX_REGEX_LEN} chars`)
  if (isDangerousRegex(src)) throw new Error(`${where}: regex has nested quantifiers (ReDoS risk)`)
  try {
    new RegExp(src, 'i')
  } catch (e) {
    throw new Error(`${where}: invalid regex — ${(e as Error).message}`)
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// Throws a descriptive Error if the config is structurally unsound or carries a
// dangerous/invalid regex. Callers surface the message to the client.
export function validateEngineConfig(config: unknown): asserts config is EngineConfig {
  if (!config || typeof config !== 'object') throw new Error('Config must be an object')
  const c = config as Record<string, unknown>

  if (!Array.isArray(c.niches) || c.niches.length === 0) throw new Error('niches must be a non-empty array')
  if (!Array.isArray(c.intentLabels) || c.intentLabels.length === 0) throw new Error('intentLabels must be a non-empty array')
  if (!Array.isArray(c.styles) || c.styles.length === 0) throw new Error('styles must be a non-empty array')
  if (!c.scoring || typeof c.scoring !== 'object') throw new Error('scoring must be an object')

  if (c.niches.length > 100 || c.intentLabels.length > 100) throw new Error('too many rules (max 100 each)')

  for (const [i, n] of (c.niches as Array<Record<string, unknown>>).entries()) {
    if (typeof n?.name !== 'string' || !n.name) throw new Error(`niches[${i}].name required`)
    assertUsableRegex(n?.regex as string, `niches[${i}].regex`)
  }
  for (const [i, l] of (c.intentLabels as Array<Record<string, unknown>>).entries()) {
    if (typeof l?.label !== 'string' || !l.label) throw new Error(`intentLabels[${i}].label required`)
    if (!isNum(l?.priority)) throw new Error(`intentLabels[${i}].priority must be a number`)
    assertUsableRegex(l?.regex as string, `intentLabels[${i}].regex`)
  }
  for (const [i, s] of (c.styles as Array<Record<string, unknown>>).entries()) {
    if (typeof s?.id !== 'string' || !s.id) throw new Error(`styles[${i}].id required`)
    if (!isNum(s?.wordMax) || (s.wordMax as number) <= 0) throw new Error(`styles[${i}].wordMax must be positive`)
    if (!isNum(s?.maxProofBlocks) || (s.maxProofBlocks as number) < 0) throw new Error(`styles[${i}].maxProofBlocks must be >= 0`)
    if (typeof s?.ctaVariants !== 'object' || !s.ctaVariants) throw new Error(`styles[${i}].ctaVariants required`)
  }

  const sc = c.scoring as Record<string, unknown>
  for (const key of ['avgScoreWeight', 'maxScoreWeight', 'frequencyBonusWeight', 'frequencyBonusCap', 'minScore'] as const) {
    if (!isNum(sc[key])) throw new Error(`scoring.${key} must be a number`)
  }
  for (const key of ['avgScoreWeight', 'maxScoreWeight', 'frequencyBonusWeight', 'frequencyBonusCap'] as const) {
    if ((sc[key] as number) < 0 || (sc[key] as number) > 1) throw new Error(`scoring.${key} must be between 0 and 1`)
  }
  if ((sc.minScore as number) < 0 || (sc.minScore as number) > 100) throw new Error('scoring.minScore must be between 0 and 100')
}

export function saveEngineConfig(config: EngineConfig): void {
  validateEngineConfig(config)
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
