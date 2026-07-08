'use client'

import { useState } from 'react'
import ResultCard from '@/components/ResultCard'
import type { SearchResult, TraceStep } from '@/lib/search'

type State = 'idle' | 'loading' | 'done' | 'error'

interface SearchData {
  intents: string[]
  results: SearchResult[]
  synthesizedProposal: string
  styleId: string
  total: number
  trace?: TraceStep[]
}

interface Diagnostics {
  status?: number
  statusText?: string
  elapsedMs: number
  trace?: TraceStep[]
  rawBody?: string
}

const STYLES = [
  { id: 'detailed',      label: 'Detailed',  desc: '180–220 words' },
  { id: 'short_pitch',   label: 'Short',     desc: '100–130 words' },
  { id: 'cover_letter',  label: 'Cover Letter', desc: '150–180 words' },
  { id: 'cold_outreach', label: 'Cold DM',   desc: '80–100 words' },
]

const LOAD_STEPS = [
  'Reading job post…',
  'Extracting requirements…',
  'Running semantic search…',
  'Ranking matches…',
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [data, setData] = useState<SearchData | null>(null)
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [proposalCopied, setProposalCopied] = useState(false)
  const [loadStep, setLoadStep] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [inputExpanded, setInputExpanded] = useState(true)
  const [selectedStyle, setSelectedStyle] = useState('detailed')

  const runSearch = async () => {
    if (!query.trim()) return
    setState('loading')
    setLoadStep(0)
    setElapsedMs(0)
    setErrorMsg('')
    setDiagnostics(null)
    setShowDiagnostics(false)
    setInputExpanded(false)
    const startedAt = Date.now()
    const stepInterval = setInterval(() => {
      setLoadStep((s) => (s < LOAD_STEPS.length - 1 ? s + 1 : s))
    }, 900)
    const elapsedInterval = setInterval(() => setElapsedMs(Date.now() - startedAt), 250)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, styleId: selectedStyle }),
      })
      const elapsed = Date.now() - startedAt
      // Read as text first — a proxy/crash error page (like Railway's 502) isn't
      // valid JSON, and res.json() would throw before we ever see the status.
      const rawText = await res.text()
      let json: (SearchData & { error?: string; trace?: TraceStep[] }) | null = null
      try { json = JSON.parse(rawText) } catch { /* backend returned a non-JSON error page */ }

      if (!res.ok || !json) {
        setDiagnostics({
          status: res.status,
          statusText: res.statusText,
          elapsedMs: elapsed,
          trace: json?.trace,
          rawBody: json ? undefined : rawText.slice(0, 500),
        })
        setErrorMsg(json?.error || `Search failed (${res.status} ${res.statusText || ''}).`)
        setState('error')
        setInputExpanded(true)
        return
      }
      setDiagnostics({ status: res.status, statusText: res.statusText, elapsedMs: elapsed, trace: json.trace })
      setData(json)
      setState('done')
    } catch (err) {
      setDiagnostics({ elapsedMs: Date.now() - startedAt, rawBody: err instanceof Error ? err.message : String(err) })
      setErrorMsg('Search failed — the request never got a response (network error or server unreachable).')
      setState('error')
      setInputExpanded(true)
    } finally {
      clearInterval(stepInterval)
      clearInterval(elapsedInterval)
    }
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runSearch()
  }

  const copyProposal = () => {
    if (!data?.synthesizedProposal) return
    navigator.clipboard.writeText(data.synthesizedProposal)
    setProposalCopied(true)
    setTimeout(() => setProposalCopied(false), 2000)
  }

  const reset = () => {
    setState('idle')
    setData(null)
    setInputExpanded(true)
  }

  const isDone = state === 'done' && data
  const isLoading = state === 'loading'

  return (
    <div className="min-h-screen" style={{ background: '#0d1117' }}>
      <div className={`mx-auto px-4 py-8 transition-all duration-300 ${isDone ? 'max-w-7xl' : 'max-w-2xl'}`}>

        {/* ── Header (idle only) ── */}
        {!isDone && !isLoading && (
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">BidFlow</h1>
            <p className="text-slate-400 mt-1.5 text-sm">From query to bid — in one flow.</p>
            <p className="text-slate-600 mt-1 text-xs">
              Every bid, backed by proof.
            </p>
            {/* Style picker */}
            <div className="flex justify-center gap-1.5 mt-4">
              {STYLES.map(s => (
                <button key={s.id} onClick={() => setSelectedStyle(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedStyle === s.id
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                  style={{ border: selectedStyle === s.id ? '1px solid #1d4ed8' : '1px solid #21262d' }}
                  title={s.desc}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══ DONE — sidebar + main ══ */}
        {isDone ? (
          <div className="flex gap-4 items-start">

            {/* ── Sidebar ── */}
            <div className="w-60 shrink-0 sticky top-4 space-y-3">

              {/* Collapsed input */}
              <div style={{ background: '#161b22', border: '1px solid #30363d' }} className="rounded-xl overflow-hidden">
                <div style={{ background: '#0d1117', borderBottom: '1px solid #30363d' }} className="px-3 py-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  <span className="text-slate-600 text-xs font-mono truncate flex-1">{query.slice(0, 22)}…</span>
                </div>
                {inputExpanded ? (
                  <>
                    <textarea
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={onKey}
                      rows={5}
                      className="w-full px-3 py-2.5 text-xs text-slate-400 resize-none focus:outline-none font-mono leading-relaxed"
                      style={{ background: '#161b22' }}
                    />
                    <div style={{ borderTop: '1px solid #30363d', background: '#0d1117' }} className="px-3 py-2 flex gap-2">
                      <button onClick={runSearch} disabled={!query.trim()}
                        className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-colors">
                        Re-search
                      </button>
                      <button onClick={() => setInputExpanded(false)}
                        className="px-2 text-xs text-slate-600 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors">
                        ✕
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="px-3 py-2.5">
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{query}</p>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => setInputExpanded(true)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                      <span className="text-slate-700">·</span>
                      <button onClick={reset} className="text-xs text-slate-600 hover:text-slate-300">New search</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Intents */}
              {data.intents.length > 0 && (
                <div style={{ background: '#161b22', border: '1px solid #30363d' }} className="rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2.5">
                    {data.intents.length} Requirement{data.intents.length !== 1 ? 's' : ''} Detected
                  </p>
                  <ol className="space-y-2">
                    {data.intents.map((intent, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="shrink-0 text-[10px] font-bold text-slate-600 w-4 pt-px">{i + 1}.</span>
                        <span className="text-[11px] text-slate-400 leading-relaxed">
                          {intent.length > 70 ? intent.slice(0, 67) + '…' : intent}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Stats */}
              <div style={{ background: '#161b22', border: '1px solid #30363d' }} className="rounded-xl p-3">
                <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2.5">Stats</p>
                <div className="space-y-2">
                  {[
                    ['Matches found', data.results.length],
                    ['Case studies', data.total],
                    ['Top score', `${data.results[0]?.score ?? 0}%`],
                  ].map(([label, val]) => (
                    <div key={String(label)} className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className="text-xs font-semibold text-slate-300">{val}</span>
                    </div>
                  ))}
                </div>
                {diagnostics?.trace && diagnostics.trace.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowDiagnostics(v => !v)}
                      className="text-xs text-blue-400 hover:text-blue-300 mt-3"
                    >
                      {showDiagnostics ? 'Hide performance trace ▲' : 'Show performance trace ▼'}
                    </button>
                    {showDiagnostics && (
                      <div className="mt-2 p-2.5 rounded-lg bg-black/30 font-mono text-[10px] text-slate-500 space-y-1 overflow-x-auto">
                        <div>Total: {(diagnostics.elapsedMs / 1000).toFixed(2)}s</div>
                        {diagnostics.trace.map((t, i) => (
                          <div key={i}>· {t.label} — {t.ms}ms (rss {t.memMB}MB)</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Main content ── */}
            <div className="flex-1 min-w-0 space-y-3">

              {/* Proposal */}
              {data.results.length > 0 && (
                <div style={{ background: '#161b22', border: '1px solid #30363d' }} className="rounded-xl overflow-hidden">
                  <div style={{ borderBottom: '1px solid #30363d', background: '#0d1117' }} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-slate-200 font-semibold text-sm">Synthesized Proposal</p>
                      <p className="text-slate-600 text-xs mt-0.5">
                        {data.intents.length} req · {data.results.length} case {data.results.length !== 1 ? 'studies' : 'study'}
                        {data.styleId && (
                          <span className="ml-2 text-blue-500">
                            · {STYLES.find(s => s.id === data.styleId)?.label ?? data.styleId}
                          </span>
                        )}
                      </p>
                    </div>
                    <button onClick={copyProposal}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        proposalCopied
                          ? 'bg-emerald-700 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-500'
                      }`}
                    >
                      {proposalCopied ? '✓ Copied' : '📋 Copy Proposal'}
                    </button>
                  </div>
                  <div className="px-4 py-4">
                    <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {data.synthesizedProposal}
                    </pre>
                  </div>
                </div>
              )}

              {/* No results */}
              {data.results.length === 0 && (
                <div style={{ background: '#161b22', border: '1px solid #30363d' }} className="rounded-xl text-center py-14">
                  <p className="text-3xl mb-2">🔍</p>
                  <p className="font-semibold text-slate-300 mb-1">No matches found</p>
                  {data.total === 0
                    ? <p className="text-sm text-slate-500">No case studies yet. <a href="/portfolio" className="text-blue-400 hover:underline">Add one →</a></p>
                    : <p className="text-sm text-slate-500">Try a more detailed job description.</p>
                  }
                </div>
              )}

              {/* Cards label */}
              {data.results.length > 0 && (
                <div className="flex items-center gap-3 pt-1">
                  <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider whitespace-nowrap">
                    {data.results.length} match{data.results.length !== 1 ? 'es' : ''} · by relevance
                  </p>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
              )}

              <div className="space-y-2">
                {data.results.map((r, i) => (
                  <ResultCard key={r.study.id} result={r} rank={i + 1} />
                ))}
              </div>
            </div>
          </div>

        ) : (
          /* ══ IDLE / LOADING / ERROR ══ */
          <div className="space-y-3">
            <div style={{ background: '#161b22', border: '1px solid #30363d' }} className="rounded-xl overflow-hidden">
              <div style={{ background: '#0d1117', borderBottom: '1px solid #30363d' }} className="px-4 py-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-700" />
                <span className="w-2 h-2 rounded-full bg-slate-700" />
                <span className="w-2 h-2 rounded-full bg-slate-700" />
                <span className="ml-3 text-slate-700 text-xs font-mono">job-post.txt</span>
              </div>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKey}
                placeholder={`Paste the full client job post here…\n\nExample:\n"Looking for a branding agency to redesign our Shopify store. Need logo, color system, and packaging design."`}
                rows={9}
                className="w-full px-5 py-4 text-sm text-slate-300 resize-none focus:outline-none leading-relaxed font-mono"
                style={{ background: '#161b22', caretColor: '#60a5fa' }}
              />
              <div style={{ borderTop: '1px solid #30363d', background: '#0d1117' }} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span>Ctrl + Enter to search</span>
                  {query.trim() && <><span>·</span><span>{query.trim().split(/\s+/).length} words</span></>}
                </div>
                <button
                  onClick={runSearch}
                  disabled={isLoading || !query.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-colors"
                >
                  {isLoading
                    ? <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Analysing…</>
                    : <>Find Matches</>
                  }
                </button>
              </div>
            </div>

            {isLoading && (
              <div style={{ background: '#161b22', border: '1px solid #30363d' }} className="rounded-xl p-5">
                <div className="space-y-2.5">
                  {LOAD_STEPS.map((step, i) => (
                    <div key={i} className={`flex items-center gap-3 transition-opacity duration-500 ${i <= loadStep ? 'opacity-100' : 'opacity-20'}`}>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        i < loadStep ? 'bg-emerald-600' : i === loadStep ? 'bg-blue-600' : 'bg-slate-800'
                      }`}>
                        {i < loadStep ? (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : i === loadStep ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        ) : null}
                      </div>
                      <span className={`text-sm ${
                        i === loadStep ? 'text-slate-200 font-medium'
                        : i < loadStep ? 'text-slate-700 line-through'
                        : 'text-slate-700'
                      }`}>{step}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-700 mt-4 pl-7">
                  {elapsedMs > 5000
                    ? `Still working… ${(elapsedMs / 1000).toFixed(0)}s elapsed — this is longer than usual`
                    : `Waiting on server… ${(elapsedMs / 1000).toFixed(1)}s`}
                </p>
              </div>
            )}

            {state === 'error' && (
              <div style={{ background: '#1c1217', border: '1px solid #4a2030' }} className="rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-red-500 shrink-0">⚠</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-400">Search failed</p>
                    <p className="text-xs text-slate-500 mt-0.5">{errorMsg}</p>
                    {diagnostics && (
                      <button
                        onClick={() => setShowDiagnostics(v => !v)}
                        className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                      >
                        {showDiagnostics ? 'Hide details ▲' : 'Show details ▼'}
                      </button>
                    )}
                  </div>
                </div>
                {diagnostics && showDiagnostics && (
                  <div className="mt-3 p-3 rounded-lg bg-black/30 font-mono text-[11px] text-slate-400 space-y-1 overflow-x-auto">
                    <div>HTTP status: {diagnostics.status ?? '—'} {diagnostics.statusText ?? ''}</div>
                    <div>Elapsed: {(diagnostics.elapsedMs / 1000).toFixed(2)}s</div>
                    {diagnostics.trace && diagnostics.trace.length > 0 && (
                      <div className="pt-1 mt-1 border-t border-slate-800">
                        {diagnostics.trace.map((t, i) => (
                          <div key={i}>· {t.label} — {t.ms}ms (rss {t.memMB}MB)</div>
                        ))}
                      </div>
                    )}
                    {diagnostics.rawBody && (
                      <div className="pt-1 mt-1 border-t border-slate-800 whitespace-pre-wrap break-all">
                        Raw response: {diagnostics.rawBody}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
