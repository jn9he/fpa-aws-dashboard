import { memo, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/lib/theme-context'
import { fetchApi } from '@/lib/api'
import { Moon, Sun, User } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Summary', prefetch: ['summary', 'sankey', 'projects'] },
  { to: '/resources', label: 'Resources', prefetch: ['labor', 'roster'] },
  { to: '/aws', label: 'AWS', prefetch: ['aws', 'roster'] },
  { to: '/scenarios', label: 'Scenarios', prefetch: ['roster', 'labor'] },
  { to: '/ai', label: 'AI Insights', prefetch: ['insights'] },
] as const

const prefetchMap: Record<string, () => Promise<any>> = {
  summary: () => fetchApi('/data/summary'),
  sankey: () => fetchApi('/data/sankey'),
  projects: () => fetchApi('/data/projects'),
  roster: () => fetchApi('/data/roster'),
  labor: () => fetchApi('/data/labor?'),
  aws: () => fetchApi('/data/aws?'),
  insights: () => fetchApi('/ai/insights'),
}

const Navbar = memo(function Navbar() {
  const { theme, toggle } = useTheme()
  const qc = useQueryClient()

  const handlePrefetch = useCallback((keys: readonly string[]) => {
    keys.forEach(k => {
      qc.prefetchQuery({ queryKey: [k], queryFn: prefetchMap[k], staleTime: 5 * 60 * 1000 })
    })
  }, [qc])

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-4 py-2 rounded-full bg-card border border-border shadow-pill">
      {/* Branding */}
      <div className="font-serif text-primary text-base leading-tight pr-3 border-r border-border mr-2">
        <span className="block text-sm">FP&A</span>
        <span className="block text-sm">Dashboard</span>
      </div>

      {/* Nav Items */}
      <div className="flex items-center gap-1">
        {navItems.map(({ to, label, prefetch }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onMouseEnter={() => handlePrefetch(prefetch)}
            onFocus={() => handlePrefetch(prefetch)}
            className={({ isActive }) =>
              `px-3 py-2 text-sm font-medium transition-all border-b-2 ${
                isActive
                  ? 'border-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* Right side: theme toggle + avatar */}
      <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border">
        <button
          onClick={toggle}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
          <User size={14} className="text-muted-foreground" />
        </div>
      </div>
    </nav>
  )
})

export default Navbar
