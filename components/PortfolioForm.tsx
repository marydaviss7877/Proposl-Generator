'use client'

import { useState } from 'react'

interface FormData {
  title: string
  department: string
  service: string
  clientNiche: string
  platform: string
  problem: string
  solution: string
  results: string
  tags: string
  assets: string[]
  caseStudyLink: string
  loomLink: string
}

const EMPTY: FormData = {
  title: '', department: 'creative', service: '', clientNiche: '',
  platform: 'Upwork', problem: '', solution: '', results: '',
  tags: '', assets: [], caseStudyLink: '', loomLink: '',
}

const ASSET_OPTIONS = [
  { value: 'case_study', label: 'Case Study PDF', icon: '📄' },
  { value: 'loom',       label: 'Loom Recording', icon: '🎥' },
  { value: 'images',     label: 'Images',         icon: '🖼️' },
  { value: 'slides',     label: 'Slides / PPT',   icon: '📊' },
]

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1'
const sectionHd = 'text-xs font-bold text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100 mb-4'

export default function PortfolioForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState<FormData>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field: keyof FormData, value: string | string[]) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const toggleAsset = (asset: string) =>
    set('assets', form.assets.includes(asset)
      ? form.assets.filter((a) => a !== asset)
      : [...form.assets, asset])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setForm(EMPTY)
      onSaved()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">

      {/* Section: Basic Info */}
      <p className={sectionHd}>Basic Info</p>

      <div>
        <label className={labelCls}>Project Title *</label>
        <input
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. E-commerce Brand Identity for Shopify Store"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Department *</label>
          <select value={form.department} onChange={(e) => set('department', e.target.value)} className={inputCls}>
            <option value="creative">🎨 Creative</option>
            <option value="development">💻 Development</option>
            <option value="marketing">📈 Marketing</option>
            <option value="saas">⚡ SaaS</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Platform</label>
          <select value={form.platform} onChange={(e) => set('platform', e.target.value)} className={inputCls}>
            <option>Upwork</option>
            <option>Fiverr</option>
            <option>Facebook</option>
            <option>Direct</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Service Type</label>
          <input
            value={form.service}
            onChange={(e) => set('service', e.target.value)}
            placeholder="e.g. Logo Design, Web App, SEO"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Client Niche</label>
          <input
            value={form.clientNiche}
            onChange={(e) => set('clientNiche', e.target.value)}
            placeholder="e.g. E-commerce, Real Estate"
            className={inputCls}
          />
        </div>
      </div>

      {/* Section: Project Story */}
      <p className={sectionHd}>Project Story</p>

      <div>
        <label className={labelCls}>Problem</label>
        <textarea
          value={form.problem}
          onChange={(e) => set('problem', e.target.value)}
          placeholder="What challenge did the client come with?"
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>
      <div>
        <label className={labelCls}>Solution</label>
        <textarea
          value={form.solution}
          onChange={(e) => set('solution', e.target.value)}
          placeholder="What did TWS deliver?"
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>
      <div>
        <label className={labelCls}>Results</label>
        <textarea
          value={form.results}
          onChange={(e) => set('results', e.target.value)}
          placeholder="Metrics, outcomes, client feedback…"
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Section: Assets & Links */}
      <p className={sectionHd}>Assets & Links</p>

      <div>
        <label className={labelCls}>Tags</label>
        <input
          value={form.tags}
          onChange={(e) => set('tags', e.target.value)}
          placeholder="branding, logo, identity (comma separated)"
          className={inputCls}
        />
        <p className="text-xs text-slate-400 mt-1">Specific tags improve proposal matching accuracy.</p>
      </div>

      <div>
        <label className={labelCls}>Available Assets</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {ASSET_OPTIONS.map((a) => (
            <button
              type="button"
              key={a.value}
              onClick={() => toggleAsset(a.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                form.assets.includes(a.value)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Case Study Link</label>
          <input
            value={form.caseStudyLink}
            onChange={(e) => set('caseStudyLink', e.target.value)}
            placeholder="https://drive.google.com/…"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Loom Link</label>
          <input
            value={form.loomLink}
            onChange={(e) => set('loomLink', e.target.value)}
            placeholder="https://loom.com/share/…"
            className={inputCls}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save Case Study'}
      </button>
    </form>
  )
}
