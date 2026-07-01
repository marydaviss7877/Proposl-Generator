'use client'

import { useState } from 'react'
import type { SearchResult } from '@/lib/search'

const DEPT: Record<string, { label: string; color: string; border: string }> = {
  creative:    { label: '🎨 Creative',    color: '#c084fc', border: '#7e22ce' },
  development: { label: '💻 Development', color: '#60a5fa', border: '#1d4ed8' },
  marketing:   { label: '📈 Marketing',   color: '#34d399', border: '#047857' },
  saas:        { label: '⚡ SaaS',        color: '#fb923c', border: '#c2410c' },
}

function ScoreBadge({ score, frequency }: { score: number; frequency: number }) {
  const color =
    score >= 80 ? '#34d399' :
    score >= 60 ? '#fbbf24' :
                  '#f87171'
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-sm font-bold tabular-nums" style={{ color }}>
        {score}%
      </span>
      {frequency > 1 && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded text-slate-400"
          style={{ background: '#1e293b', border: '1px solid #334155' }}>
          {frequency} intents
        </span>
      )}
    </div>
  )
}

export default function ResultCard({ result, rank }: { result: SearchResult; rank?: number }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(result.proposalSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dept = DEPT[result.study.department] ?? { label: result.study.department, color: '#94a3b8', border: '#475569' }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: '#161b22',
        border: '1px solid #30363d',
        borderLeft: `3px solid ${dept.border}`,
      }}
    >
      {/* ── Header row ── */}
      <div className="px-3 py-2.5 flex items-center gap-3">

        {/* Rank */}
        {rank && (
          <span className="text-xs font-semibold text-slate-600 w-4 text-right shrink-0">{rank}.</span>
        )}

        {/* Score */}
        <ScoreBadge score={result.score} frequency={result.frequency} />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold text-slate-200 text-sm leading-tight">{result.study.title}</span>
            <span className="text-[10px] font-semibold shrink-0" style={{ color: dept.color }}>
              {dept.label}
            </span>
          </div>
          {(result.study.service || result.study.clientNiche) && (
            <p className="text-[11px] text-slate-600 mt-0.5 truncate">
              {[result.study.service, result.study.clientNiche].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {result.study.caseStudyLink && (
            <a href={result.study.caseStudyLink} target="_blank" rel="noopener noreferrer"
              className="text-[11px] px-2 py-1 rounded-lg font-medium text-slate-400 hover:text-slate-200 transition-colors"
              style={{ background: '#0d1117', border: '1px solid #30363d' }}>
              📄 PDF
            </a>
          )}
          {result.study.loomLink && (
            <a href={result.study.loomLink} target="_blank" rel="noopener noreferrer"
              className="text-[11px] px-2 py-1 rounded-lg font-medium text-slate-400 hover:text-slate-200 transition-colors"
              style={{ background: '#0d1117', border: '1px solid #30363d' }}>
              🎥 Loom
            </a>
          )}
          <button onClick={copy}
            className="text-[11px] px-2 py-1 rounded-lg font-medium transition-colors"
            style={{
              background: copied ? '#052e16' : '#0d1117',
              border: `1px solid ${copied ? '#166534' : '#30363d'}`,
              color: copied ? '#4ade80' : '#94a3b8',
            }}
          >
            {copied ? '✓ Copied' : '📋 Snippet'}
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="text-slate-600 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800">
            <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Why it matches ── */}
      <div className="px-3 pb-2.5" style={{ borderTop: '1px solid #21262d' }}>
        <p className="text-[11px] text-slate-500 leading-relaxed pt-2">
          <span className="text-slate-700 font-semibold uppercase tracking-wide text-[9px] mr-1.5">Why</span>
          {result.whyItMatches}
        </p>
      </div>

      {/* ── Expanded ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid #21262d' }}>
          <div className="grid grid-cols-2" style={{ borderBottom: '1px solid #21262d' }}>

            {/* Matched intents */}
            <div className="px-3 py-3" style={{ borderRight: '1px solid #21262d' }}>
              <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Matched Requirements
              </p>
              <div className="space-y-1.5">
                {result.matchedIntents.map((im, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-slate-500 shrink-0 w-6 text-right pt-px">
                      {Math.round(im.score * 100)}%
                    </span>
                    <span className="text-[11px] text-slate-500 leading-relaxed">
                      {im.intentText.length > 68 ? im.intentText.slice(0, 65) + '…' : im.intentText}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Highlights */}
            <div className="px-3 py-3">
              <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                What to Highlight
              </p>
              <ul className="space-y-1.5">
                {result.whatToHighlight.map((point, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                    <span className="text-blue-500 font-bold shrink-0 mt-px">›</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Proposal snippet */}
          <div className="px-3 py-3" style={{ background: '#0d1117' }}>
            <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Proposal Snippet</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">{result.proposalSnippet}</p>
          </div>
        </div>
      )}
    </div>
  )
}
