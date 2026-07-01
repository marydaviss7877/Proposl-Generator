'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import PortfolioForm from '@/components/PortfolioForm'
import type { CaseStudy } from '@/lib/portfolio'

const DEPT: Record<string, { pill: string; bg: string; dot: string; icon: string; borderColor: string }> = {
  creative:    { pill: 'bg-purple-100 text-purple-700', bg: 'bg-purple-50',  dot: 'bg-purple-500',  icon: '🎨', borderColor: '#a855f7' },
  development: { pill: 'bg-blue-100 text-blue-700',     bg: 'bg-blue-50',    dot: 'bg-blue-500',    icon: '💻', borderColor: '#3b82f6' },
  marketing:   { pill: 'bg-green-100 text-green-700',   bg: 'bg-green-50',   dot: 'bg-green-500',   icon: '📈', borderColor: '#22c55e' },
  saas:        { pill: 'bg-orange-100 text-orange-700', bg: 'bg-orange-50',  dot: 'bg-orange-500',  icon: '⚡', borderColor: '#f97316' },
}

const ASSET_META: Record<string, { icon: string; label: string; cls: string }> = {
  case_study: { icon: '📄', label: 'Case Study', cls: 'text-blue-600 hover:text-blue-700' },
  loom:       { icon: '🎥', label: 'Loom',       cls: 'text-violet-600 hover:text-violet-700' },
  images:     { icon: '🖼️', label: 'Images',     cls: 'text-emerald-600' },
  slides:     { icon: '📊', label: 'Slides',     cls: 'text-amber-600' },
}

function CardSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-slate-200" />
        <div className="h-4 bg-slate-200 rounded w-2/5" />
        <div className="h-5 bg-slate-100 rounded-full w-20" />
      </div>
      <div className="h-3 bg-slate-100 rounded w-1/3 mb-2" />
      <div className="flex gap-1">
        <div className="h-5 bg-slate-100 rounded-full w-14" />
        <div className="h-5 bg-slate-100 rounded-full w-16" />
      </div>
    </div>
  )
}

function CaseStudyCard({ s, onDelete, deleting }: {
  s: CaseStudy
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cfg = DEPT[s.department] ?? { pill: 'bg-slate-100 text-slate-600', bg: 'bg-slate-50', dot: 'bg-slate-400', icon: '📁', borderColor: '#94a3b8' }
  const hasBody = !!(s.problem || s.solution || s.results)

  const meta = [s.service, s.clientNiche, s.platform, s.dateAdded].filter(Boolean).join(' · ')

  return (
    <div
      className="bg-white rounded-xl overflow-hidden transition-shadow hover:shadow-md"
      style={{
        border: '1px solid #e2e8f0',
        borderLeft: expanded ? `4px solid ${cfg.borderColor}` : '1px solid #e2e8f0',
      }}
    >
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
              <span className="font-semibold text-slate-800 text-sm leading-snug">{s.title}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${cfg.pill}`}>
                {cfg.icon} {s.department}
              </span>
            </div>

            {/* Meta */}
            {meta && <p className="text-xs text-slate-400 mt-0.5">{meta}</p>}

            {/* Tags */}
            {s.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {s.tags.slice(0, 6).map((t) => (
                  <span key={t} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>
                ))}
                {s.tags.length > 6 && (
                  <span className="text-xs text-slate-400 self-center">+{s.tags.length - 6} more</span>
                )}
              </div>
            )}

            {/* Asset links */}
            {s.assets.length > 0 && (
              <div className="flex gap-3 mt-2.5 flex-wrap">
                {s.assets.map((a) => {
                  const m = ASSET_META[a]
                  if (!m) return null
                  const href = a === 'case_study' ? s.caseStudyLink : a === 'loom' ? s.loomLink : null
                  return href ? (
                    <a key={a} href={href} target="_blank" rel="noopener noreferrer"
                      className={`text-xs font-medium flex items-center gap-1 underline-offset-2 hover:underline ${m.cls}`}>
                      {m.icon} {m.label}
                    </a>
                  ) : (
                    <span key={a} className={`text-xs flex items-center gap-1 opacity-50 ${m.cls}`}>
                      {m.icon} {m.label}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            {hasBody && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
              >
                {expanded ? '▲ Less' : '▼ More'}
              </button>
            )}
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { onDelete(s.id); setConfirmDelete(false) }}
                  disabled={deleting}
                  className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? '…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-slate-300 hover:text-red-400 px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable body */}
      {expanded && hasBody && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4 bg-slate-50">
          {s.problem && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Problem</p>
              <p className="text-sm text-slate-700 leading-relaxed">{s.problem}</p>
            </div>
          )}
          {s.solution && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Solution</p>
              <p className="text-sm text-slate-700 leading-relaxed">{s.solution}</p>
            </div>
          )}
          {s.results && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Results</p>
              <p className="text-sm text-slate-700 leading-relaxed">{s.results}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PortfolioPage() {
  const [studies, setStudies] = useState<CaseStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [filterDept, setFilterDept] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/portfolio')
      const data = await res.json()
      setStudies(data.studies ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const deleteStudy = async (id: string) => {
    setDeleting(id)
    await fetch(`/api/portfolio/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await load()
    setDeleting(null)
  }

  const onSaved = () => {
    setShowForm(false)
    load()
  }

  const deptCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of studies) c[s.department] = (c[s.department] ?? 0) + 1
    return c
  }, [studies])

  const filtered = useMemo(() => {
    let list = filterDept === 'all' ? studies : studies.filter((s) => s.department === filterDept)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.service.toLowerCase().includes(q) ||
        s.clientNiche.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [studies, filterDept, search])

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Portfolio</h1>
          <p className="text-sm text-slate-500 mt-1">
            {loading
              ? 'Loading…'
              : `${studies.length} case ${studies.length !== 1 ? 'studies' : 'study'} indexed`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            showForm
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {showForm ? '✕ Cancel' : '+ Add Case Study'}
        </button>
      </div>

      {/* Dept stat cards — clickable filters */}
      {!loading && studies.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {Object.entries(DEPT).map(([d, cfg]) => (
            <button
              key={d}
              onClick={() => setFilterDept(filterDept === d ? 'all' : d)}
              className={`rounded-xl border p-3 text-center transition-all hover:shadow-sm ${
                filterDept === d
                  ? `${cfg.bg} shadow-sm`
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
              style={filterDept === d ? { borderColor: cfg.borderColor } : {}}
            >
              <p className="text-2xl mb-0.5">{cfg.icon}</p>
              <p className="text-xl font-bold text-slate-800">{deptCounts[d] ?? 0}</p>
              <p className="text-xs text-slate-500 capitalize">{d}</p>
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-base font-semibold text-slate-700 mb-5">New Case Study</h2>
          <PortfolioForm onSaved={onSaved} />
        </div>
      )}

      {/* Search + filter pills */}
      {!loading && studies.length > 0 && (
        <div className="mb-5 space-y-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
            <input
              type="search"
              placeholder="Search by title, service, niche, or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterDept('all')}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                filterDept === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              All ({studies.length})
            </button>
            {Object.entries(DEPT).map(([d, cfg]) => (
              <button
                key={d}
                onClick={() => setFilterDept(filterDept === d ? 'all' : d)}
                className={`px-3 py-1 text-xs font-medium rounded-full capitalize transition-colors ${
                  filterDept === d ? cfg.pill : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {cfg.icon} {d} ({deptCounts[d] ?? 0})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : studies.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-xl">
          <p className="text-5xl mb-3">📁</p>
          <p className="font-semibold text-slate-700 mb-1">No case studies yet</p>
          <p className="text-sm text-slate-400 mb-5">Add your first one to start matching proposals.</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Add Case Study
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 text-slate-500">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm">No results match your filter.</p>
          <button
            onClick={() => { setSearch(''); setFilterDept('all') }}
            className="mt-3 text-sm text-blue-500 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <CaseStudyCard
              key={s.id}
              s={s}
              onDelete={deleteStudy}
              deleting={deleting === s.id}
            />
          ))}
          {(search || filterDept !== 'all') && (
            <p className="text-center text-xs text-slate-400 pt-2">
              Showing {filtered.length} of {studies.length} case {studies.length !== 1 ? 'studies' : 'study'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
