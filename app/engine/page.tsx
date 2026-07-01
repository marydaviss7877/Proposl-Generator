'use client'

import { useState, useEffect, useCallback } from 'react'
import type { EngineConfig, NicheRule, IntentLabelRule, ProposalStyle } from '@/lib/engine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function testRegex(pattern: string, phrase: string): boolean {
  try { return new RegExp(pattern, 'i').test(phrase) }
  catch { return false }
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inp = 'w-full px-2.5 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500'
const inpDark = `${inp} bg-[#0d1117] border border-[#30363d] text-slate-300`
const inpLight = `${inp} bg-white border border-slate-200 text-slate-700`
const labelCls = 'text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block'
const TABS = ['niches', 'labels', 'styles', 'scoring'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = { niches: 'Niches', labels: 'Intent Labels', styles: 'Styles', scoring: 'Scoring' }

// ─── Niche row ────────────────────────────────────────────────────────────────

function NicheRow({ rule, onChange, onDelete, testPhrase }: {
  rule: NicheRule
  onChange: (r: NicheRule) => void
  onDelete: () => void
  testPhrase: string
}) {
  const matches = testPhrase.trim() ? testRegex(rule.regex, testPhrase) : null
  return (
    <div className="grid gap-2 items-center py-2.5 px-3 rounded-lg hover:bg-[#1c2128]"
      style={{ gridTemplateColumns: '1fr 2fr auto auto', borderBottom: '1px solid #21262d' }}>
      <input value={rule.name} onChange={e => onChange({ ...rule, name: e.target.value })}
        placeholder="Name" className={inpDark} />
      <input value={rule.regex} onChange={e => onChange({ ...rule, regex: e.target.value })}
        placeholder="Regex pattern" className={`${inpDark} font-mono text-[11px]`} />
      {testPhrase.trim() ? (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${matches ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
          {matches ? '✓ match' : '✗'}
        </span>
      ) : <span />}
      <button onClick={onDelete} className="text-slate-600 hover:text-red-400 text-xs px-1 transition-colors">✕</button>
    </div>
  )
}

// ─── Intent label row ─────────────────────────────────────────────────────────

function LabelRow({ rule, onChange, onDelete, testPhrase }: {
  rule: IntentLabelRule
  onChange: (r: IntentLabelRule) => void
  onDelete: () => void
  testPhrase: string
}) {
  const matches = testPhrase.trim() ? testRegex(rule.regex, testPhrase) : null
  return (
    <div className="grid gap-2 items-center py-2.5 px-3 rounded-lg hover:bg-[#1c2128]"
      style={{ gridTemplateColumns: '1fr 2fr 3rem auto auto', borderBottom: '1px solid #21262d' }}>
      <input value={rule.label} onChange={e => onChange({ ...rule, label: e.target.value })}
        placeholder="Label" className={inpDark} />
      <input value={rule.regex} onChange={e => onChange({ ...rule, regex: e.target.value })}
        placeholder="Regex pattern" className={`${inpDark} font-mono text-[11px]`} />
      <input type="number" value={rule.priority} onChange={e => onChange({ ...rule, priority: Number(e.target.value) })}
        className={`${inpDark} text-center`} min={1} max={99} />
      {testPhrase.trim() ? (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${matches ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-600'}`}>
          {matches ? '✓' : '✗'}
        </span>
      ) : <span />}
      <button onClick={onDelete} className="text-slate-600 hover:text-red-400 text-xs px-1 transition-colors">✕</button>
    </div>
  )
}

// ─── Style card ───────────────────────────────────────────────────────────────

const VARS = ['{label}', '{niche}', '{intent_count}', '{solution}', '{results}', '{client_niche}', '{niche_ref}']

function StyleCard({ style, onChange }: { style: ProposalStyle; onChange: (s: ProposalStyle) => void }) {
  const [open, setOpen] = useState(false)

  const set = (field: keyof ProposalStyle, val: unknown) =>
    onChange({ ...style, [field]: val })
  const setCTA = (key: keyof ProposalStyle['ctaVariants'], val: string) =>
    onChange({ ...style, ctaVariants: { ...style.ctaVariants, [key]: val } })

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #30363d', background: '#161b22' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200 text-sm">{style.name}</span>
            <span className="text-[10px] text-slate-500">{style.description}</span>
          </div>
          <div className="flex gap-3 mt-1 text-[10px] text-slate-600">
            <span>{style.wordMin}–{style.wordMax} words</span>
            <span>·</span>
            <span>{style.maxProofBlocks} proof block{style.maxProofBlocks !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{style.includeAssets ? 'assets on' : 'no assets'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => set('enabled', !style.enabled)}
            className={`text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
              style.enabled ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-500'
            }`}
          >
            {style.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button onClick={() => setOpen(!open)}
            className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded hover:bg-slate-800 transition-colors">
            {open ? 'Close ▲' : 'Edit ▼'}
          </button>
        </div>
      </div>

      {/* Editor */}
      {open && (
        <div className="px-4 pb-4 space-y-4" style={{ borderTop: '1px solid #21262d' }}>
          <div className="pt-3">
            {/* Variables reference */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className="text-[10px] text-slate-600 self-center">Variables:</span>
              {VARS.map(v => (
                <span key={v} className="text-[10px] font-mono bg-[#0d1117] text-blue-400 px-1.5 py-0.5 rounded border border-[#30363d]">{v}</span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Word limits */}
              <div>
                <label className={labelCls}>Word min</label>
                <input type="number" value={style.wordMin}
                  onChange={e => set('wordMin', Number(e.target.value))}
                  className={inpDark} min={40} max={500} />
              </div>
              <div>
                <label className={labelCls}>Word max</label>
                <input type="number" value={style.wordMax}
                  onChange={e => set('wordMax', Number(e.target.value))}
                  className={inpDark} min={40} max={500} />
              </div>

              {/* Max proof blocks */}
              <div>
                <label className={labelCls}>Max proof blocks (0–5)</label>
                <input type="number" value={style.maxProofBlocks}
                  onChange={e => set('maxProofBlocks', Number(e.target.value))}
                  className={inpDark} min={0} max={5} />
              </div>

              {/* Include assets toggle */}
              <div className="flex flex-col justify-end">
                <label className={labelCls}>Include asset links</label>
                <button onClick={() => set('includeAssets', !style.includeAssets)}
                  className={`w-fit text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                    style.includeAssets ? 'bg-blue-700 text-white' : 'bg-[#0d1117] text-slate-500 border border-[#30363d]'
                  }`}>
                  {style.includeAssets ? '✓ Yes' : '✗ No'}
                </button>
              </div>
            </div>

            {/* Hook template */}
            <div className="mt-4">
              <label className={labelCls}>Hook template (when niche detected)</label>
              <textarea rows={2} value={style.hookTemplate}
                onChange={e => set('hookTemplate', e.target.value)}
                className={`${inpDark} resize-none font-mono text-[11px] leading-relaxed`} />
            </div>

            <div>
              <label className={labelCls}>Hook fallback (no niche detected)</label>
              <textarea rows={2} value={style.hookFallback}
                onChange={e => set('hookFallback', e.target.value)}
                className={`${inpDark} resize-none font-mono text-[11px] leading-relaxed`} />
            </div>

            {/* Proof block template */}
            <div>
              <label className={labelCls}>Proof block template (one per result)</label>
              <textarea rows={2} value={style.proofBlockTemplate}
                onChange={e => set('proofBlockTemplate', e.target.value)}
                placeholder="Leave empty for no proof blocks"
                className={`${inpDark} resize-none font-mono text-[11px] leading-relaxed`} />
            </div>

            {/* CTA variants */}
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-4 mb-2">CTA Variants</p>
            <div className="grid grid-cols-2 gap-3">
              {(['default', 'proofSeeking', 'urgency', 'budgetConscious'] as const).map(key => (
                <div key={key}>
                  <label className={labelCls}>{key === 'proofSeeking' ? 'Proof-seeking' : key.charAt(0).toUpperCase() + key.slice(1)}</label>
                  <textarea rows={2} value={style.ctaVariants[key]}
                    onChange={e => setCTA(key, e.target.value)}
                    className={`${inpDark} resize-none text-[11px] leading-relaxed`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Scoring panel ────────────────────────────────────────────────────────────

function ScoringPanel({ scoring, onChange }: {
  scoring: EngineConfig['scoring']
  onChange: (s: EngineConfig['scoring']) => void
}) {
  const set = (field: keyof EngineConfig['scoring'], val: number) =>
    onChange({ ...scoring, [field]: val })

  const weightSum = Math.round((scoring.avgScoreWeight + scoring.maxScoreWeight + scoring.frequencyBonusWeight) * 100)
  const sumOk = weightSum === 100

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Score formula
        </p>
        <p className="text-xs text-slate-500 leading-relaxed mb-3">
          Final score = (avg cosine × <strong className="text-slate-300">A</strong>) + (max cosine × <strong className="text-slate-300">B</strong>) + (frequency bonus × <strong className="text-slate-300">C</strong>)
          &ensp;→&ensp; All as percentage points, sum A+B+C must equal 100%.
        </p>
        <div className={`text-xs font-bold mb-4 ${sumOk ? 'text-emerald-400' : 'text-red-400'}`}>
          Current sum: {weightSum}% {sumOk ? '✓' : '— must equal 100%'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { key: 'avgScoreWeight' as const,       label: 'A — Avg score weight' },
          { key: 'maxScoreWeight' as const,        label: 'B — Max score weight' },
          { key: 'frequencyBonusWeight' as const,  label: 'C — Frequency bonus weight' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className={labelCls}>{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="number" step="0.01" min="0" max="1"
                value={scoring[key]}
                onChange={e => set(key, parseFloat(e.target.value) || 0)}
                className={`${inpDark} w-20`}
              />
              <span className="text-xs text-slate-500">{Math.round(scoring[key] * 100)}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Frequency bonus cap (0–1)</label>
          <p className="text-[10px] text-slate-600 mb-1">Max raw frequency bonus before weighting. Lower = less reward for multi-intent matches.</p>
          <input
            type="number" step="0.01" min="0" max="1"
            value={scoring.frequencyBonusCap}
            onChange={e => set('frequencyBonusCap', parseFloat(e.target.value) || 0)}
            className={`${inpDark} w-24`}
          />
        </div>
        <div>
          <label className={labelCls}>Minimum score to show (0–100)</label>
          <p className="text-[10px] text-slate-600 mb-1">Results below this score are hidden from output. Raise to reduce noise.</p>
          <input
            type="number" step="1" min="0" max="99"
            value={scoring.minScore}
            onChange={e => set('minScore', parseInt(e.target.value) || 0)}
            className={`${inpDark} w-24`}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EnginePage() {
  const [config, setConfig]   = useState<EngineConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [tab, setTab]         = useState<Tab>('niches')
  const [testPhrase, setTestPhrase] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/engine')
      if (!res.ok) throw new Error(await res.text())
      setConfig(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!config) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/engine', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const updateNiche  = (i: number, r: NicheRule)       => setConfig(c => c ? { ...c, niches:       c.niches.map((x, idx) => idx === i ? r : x) } : c)
  const deleteNiche  = (i: number)                     => setConfig(c => c ? { ...c, niches:       c.niches.filter((_, idx) => idx !== i) } : c)
  const addNiche     = ()                               => setConfig(c => c ? { ...c, niches:       [...c.niches, { id: uid(), name: '', regex: '' }] } : c)

  const updateLabel  = (i: number, r: IntentLabelRule) => setConfig(c => c ? { ...c, intentLabels: c.intentLabels.map((x, idx) => idx === i ? r : x) } : c)
  const deleteLabel  = (i: number)                     => setConfig(c => c ? { ...c, intentLabels: c.intentLabels.filter((_, idx) => idx !== i) } : c)
  const addLabel     = ()                               => setConfig(c => c ? { ...c, intentLabels: [...c.intentLabels, { id: uid(), label: '', regex: '', priority: c.intentLabels.length + 1 }] } : c)

  const updateStyle  = (i: number, s: ProposalStyle)   => setConfig(c => c ? { ...c, styles:       c.styles.map((x, idx) => idx === i ? s : x) } : c)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1117' }}>
      <p className="text-slate-500 text-sm">Loading engine config…</p>
    </div>
  )

  if (error && !config) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1117' }}>
      <div className="text-center">
        <p className="text-red-400 text-sm mb-2">{error}</p>
        <button onClick={load} className="text-xs text-blue-400 hover:underline">Retry</button>
      </div>
    </div>
  )

  if (!config) return null

  // Determine which rule matches the test phrase (for niches and labels)
  const matchedNiche = testPhrase.trim()
    ? config.niches.find(n => testRegex(n.regex, testPhrase))
    : null
  const matchedLabel = testPhrase.trim()
    ? [...config.intentLabels].sort((a, b) => a.priority - b.priority).find(l => testRegex(l.regex, testPhrase))
    : null

  return (
    <div className="min-h-screen" style={{ background: '#0d1117' }}>
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-100 tracking-tight">Proposal Engine</h1>
            <p className="text-slate-500 text-xs mt-1">Configure how the engine detects niches, labels intents, scores matches, and builds proposals.</p>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              saved    ? 'bg-emerald-700 text-white' :
              saving   ? 'bg-blue-800 text-blue-300 opacity-70' :
                         'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg text-xs text-red-400 bg-red-950 border border-red-800">
            {error}
          </div>
        )}

        {/* ── Test phrase bar ── */}
        <div className="mb-4 flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: '#161b22', border: '1px solid #30363d' }}>
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider shrink-0">Test phrase</span>
          <input
            value={testPhrase}
            onChange={e => setTestPhrase(e.target.value)}
            placeholder="Type anything to see which niche / label rules match live…"
            className="flex-1 bg-transparent text-xs text-slate-300 focus:outline-none placeholder-slate-600"
          />
          {testPhrase.trim() && (
            <div className="flex gap-2 text-[10px] shrink-0">
              <span className="px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d]">
                <span className="text-slate-600">Niche: </span>
                <span className={matchedNiche ? 'text-emerald-400 font-semibold' : 'text-slate-600'}>
                  {matchedNiche ? matchedNiche.name : '—'}
                </span>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d]">
                <span className="text-slate-600">Label: </span>
                <span className={matchedLabel ? 'text-blue-400 font-semibold' : 'text-slate-600'}>
                  {matchedLabel ? matchedLabel.label : '—'}
                </span>
              </span>
            </div>
          )}
          {testPhrase && (
            <button onClick={() => setTestPhrase('')} className="text-slate-600 hover:text-slate-400 text-xs shrink-0">✕</button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-0.5 mb-4" style={{ background: '#161b22', borderRadius: '10px', padding: '3px', border: '1px solid #21262d' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                tab === t ? 'bg-[#0d1117] text-slate-200 shadow' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {TAB_LABELS[t]}
              {t === 'niches'  && <span className="ml-1 text-[10px] text-slate-600">({config.niches.length})</span>}
              {t === 'labels'  && <span className="ml-1 text-[10px] text-slate-600">({config.intentLabels.length})</span>}
              {t === 'styles'  && <span className="ml-1 text-[10px] text-slate-600">({config.styles.filter(s => s.enabled).length}/{config.styles.length})</span>}
            </button>
          ))}
        </div>

        {/* ── Tab: Niches ── */}
        {tab === 'niches' && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px' }} className="overflow-hidden">
            <div className="px-3 py-2.5 flex items-center" style={{ borderBottom: '1px solid #21262d', background: '#0d1117' }}>
              <div className="grid flex-1 gap-2 text-[9px] font-semibold text-slate-600 uppercase tracking-wider"
                style={{ gridTemplateColumns: '1fr 2fr auto auto' }}>
                <span className="px-3">Name</span>
                <span className="px-3">Regex (case-insensitive)</span>
                <span>Test</span>
                <span />
              </div>
            </div>
            <div>
              {config.niches.map((n, i) => (
                <NicheRow key={n.id} rule={n} onChange={r => updateNiche(i, r)} onDelete={() => deleteNiche(i)} testPhrase={testPhrase} />
              ))}
            </div>
            <div className="px-3 py-2.5" style={{ borderTop: '1px solid #21262d' }}>
              <button onClick={addNiche}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                + Add niche rule
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Intent Labels ── */}
        {tab === 'labels' && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px' }} className="overflow-hidden">
            <div className="px-3 py-2.5 flex items-center" style={{ borderBottom: '1px solid #21262d', background: '#0d1117' }}>
              <div className="grid flex-1 gap-2 text-[9px] font-semibold text-slate-600 uppercase tracking-wider"
                style={{ gridTemplateColumns: '1fr 2fr 3rem auto auto' }}>
                <span className="px-3">Label</span>
                <span className="px-3">Regex (case-insensitive)</span>
                <span className="text-center">Pri.</span>
                <span>Test</span>
                <span />
              </div>
            </div>
            <div>
              {[...config.intentLabels]
                .map((l, origIdx) => ({ l, origIdx }))
                .sort((a, b) => a.l.priority - b.l.priority)
                .map(({ l, origIdx }) => (
                  <LabelRow key={l.id} rule={l} onChange={r => updateLabel(origIdx, r)} onDelete={() => deleteLabel(origIdx)} testPhrase={testPhrase} />
                ))}
            </div>
            <div className="px-3 py-2.5" style={{ borderTop: '1px solid #21262d' }}>
              <button onClick={addLabel}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                + Add intent label rule
              </button>
              <span className="ml-3 text-[10px] text-slate-600">Lower priority number = checked first</span>
            </div>
          </div>
        )}

        {/* ── Tab: Styles ── */}
        {tab === 'styles' && (
          <div className="space-y-3">
            <p className="text-[10px] text-slate-600 px-1">
              Each style has its own word limit, proof block count, and templates. Variables like <span className="font-mono text-blue-400">{'{label}'}</span>, <span className="font-mono text-blue-400">{'{niche}'}</span>, <span className="font-mono text-blue-400">{'{solution}'}</span> are filled in at search time.
            </p>
            {config.styles.map((s, i) => (
              <StyleCard key={s.id} style={s} onChange={updated => updateStyle(i, updated)} />
            ))}
          </div>
        )}

        {/* ── Tab: Scoring ── */}
        {tab === 'scoring' && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '12px' }} className="p-5">
            <ScoringPanel
              scoring={config.scoring}
              onChange={scoring => setConfig(c => c ? { ...c, scoring } : c)}
            />
          </div>
        )}

        {/* ── Default style picker ── */}
        {tab === 'styles' && (
          <div className="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: '#161b22', border: '1px solid #30363d' }}>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Default style</span>
            <div className="flex gap-1.5">
              {config.styles.filter(s => s.enabled).map(s => (
                <button key={s.id}
                  onClick={() => setConfig(c => c ? { ...c, defaultStyleId: s.id } : c)}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                    config.defaultStyleId === s.id
                      ? 'bg-blue-700 text-white'
                      : 'bg-[#0d1117] text-slate-400 border border-[#30363d] hover:border-slate-500'
                  }`}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              saved  ? 'bg-emerald-700 text-white' :
              saving ? 'bg-blue-800 text-blue-300 opacity-70' :
                       'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
