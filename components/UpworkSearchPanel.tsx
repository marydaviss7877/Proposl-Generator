'use client'

import { useEffect, useState } from 'react'
import type { UpworkJobPosting } from '@/lib/upwork/jobs'

type Status = 'checking' | 'disconnected' | 'connected'

export default function UpworkSearchPanel({ onSelectJob }: { onSelectJob: (text: string) => void }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>('checking')
  const [keywords, setKeywords] = useState('')
  const [jobs, setJobs] = useState<UpworkJobPosting[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/upwork/status')
      .then(res => res.json())
      .then((data: { connected: boolean }) => setStatus(data.connected ? 'connected' : 'disconnected'))
      .catch(() => setStatus('disconnected'))
  }, [])

  const runSearch = async () => {
    if (!keywords.trim()) return
    setLoading(true)
    setError('')
    setJobs(null)
    try {
      const res = await fetch(`/api/upwork/jobs?q=${encodeURIComponent(keywords.trim())}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || `Search failed (${res.status})`)
        return
      }
      setJobs(json.jobs)
    } catch {
      setError('Search failed — network error or server unreachable.')
    } finally {
      setLoading(false)
    }
  }

  const pickJob = (job: UpworkJobPosting) => {
    onSelectJob(`${job.title}\n\n${job.description}`)
    setOpen(false)
    setJobs(null)
    setKeywords('')
  }

  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d' }} className="rounded-xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-black/10 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <svg className={`w-3 h-3 transition-transform text-slate-600 ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Search Upwork for a job post
        </span>
        {status === 'disconnected' && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded text-amber-400" style={{ background: '#2a1f0d', border: '1px solid #4a3a1a' }}>
            Not connected
          </span>
        )}
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #30363d' }} className="px-4 py-3">
          {status === 'checking' && (
            <p className="text-xs text-slate-600">Checking Upwork connection…</p>
          )}

          {status === 'disconnected' && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Connect your Upwork account to search job postings directly.</p>
              <a
                href="/api/auth/upwork"
                className="shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-500 transition-colors"
              >
                Connect Upwork
              </a>
            </div>
          )}

          {status === 'connected' && (
            <>
              <div className="flex gap-2">
                <input
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runSearch()}
                  placeholder="e.g. Shopify branding, CRM setup…"
                  className="flex-1 px-3 py-1.5 text-xs text-slate-300 rounded-lg focus:outline-none"
                  style={{ background: '#0d1117', border: '1px solid #30363d' }}
                />
                <button
                  onClick={runSearch}
                  disabled={loading || !keywords.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-500 disabled:opacity-40 transition-colors"
                >
                  {loading ? 'Searching…' : 'Search Upwork'}
                </button>
              </div>

              {error && <p className="text-xs text-red-400 mt-2.5">{error}</p>}

              {jobs && jobs.length === 0 && !error && (
                <p className="text-xs text-slate-600 mt-2.5">No matching job postings found.</p>
              )}

              {jobs && jobs.length > 0 && (
                <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
                  {jobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => pickJob(job)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-black/20 transition-colors"
                      style={{ background: '#0d1117', border: '1px solid #21262d' }}
                    >
                      <p className="text-xs font-semibold text-slate-200 truncate">{job.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{job.description}</p>
                      {(job.budget || job.postedAt) && (
                        <p className="text-[10px] text-slate-600 mt-1">
                          {[job.budget, job.postedAt].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
