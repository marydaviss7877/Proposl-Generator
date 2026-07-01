'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const path = usePathname()

  const links = [
    { href: '/', label: 'Search' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/engine', label: 'Engine' },
  ]

  return (
    <nav style={{ background: '#0d1117', borderBottom: '1px solid #21262d' }} className="px-6 py-2.5 flex items-center gap-8">
      <span className="font-bold text-sm tracking-tight text-slate-200">
        TWS <span className="text-slate-400 font-normal">Proposals</span>
      </span>
      <div className="flex gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              path === link.href
                ? 'text-slate-100 bg-slate-800'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
