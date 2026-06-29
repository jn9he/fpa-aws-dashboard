import { NavLink } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '@/lib/theme-context'
import { fetchApi } from '@/lib/api'
import DashboardRounded from '@mui/icons-material/DashboardRounded'
import GroupsRounded from '@mui/icons-material/GroupsRounded'
import CloudRounded from '@mui/icons-material/CloudRounded'
import TuneRounded from '@mui/icons-material/TuneRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import LightModeRounded from '@mui/icons-material/LightModeRounded'
import DarkModeRounded from '@mui/icons-material/DarkModeRounded'

const navItems = [
  { to: '/', label: 'Summary', icon: DashboardRounded, prefetch: ['summary', 'sankey', 'projects'] },
  { to: '/resources', label: 'Resources', icon: GroupsRounded, prefetch: ['labor', 'roster'] },
  { to: '/aws', label: 'AWS', icon: CloudRounded, prefetch: ['aws', 'roster'] },
  { to: '/scenarios', label: 'Scenarios', icon: TuneRounded, prefetch: ['roster', 'labor'] },
  { to: '/ai', label: 'AI Insights', icon: AutoAwesomeRounded, prefetch: ['insights'] },
]

const prefetchMap: Record<string, () => Promise<any>> = {
  summary: () => fetchApi('/data/summary'),
  sankey: () => fetchApi('/data/sankey'),
  projects: () => fetchApi('/data/projects'),
  roster: () => fetchApi('/data/roster'),
  labor: () => fetchApi('/data/labor?'),
  aws: () => fetchApi('/data/aws?'),
  insights: () => fetchApi('/ai/insights'),
}

export default function Navbar() {
  const { theme, toggle } = useTheme()
  const qc = useQueryClient()

  const handlePrefetch = (keys: string[]) => {
    keys.forEach(k => {
      qc.prefetchQuery({ queryKey: [k], queryFn: prefetchMap[k], staleTime: 5 * 60 * 1000 })
    })
  }

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-2 rounded-2xl bg-card/80 backdrop-blur-xl border border-border shadow-lg shadow-black/10">
      {navItems.map(({ to, label, icon: Icon, prefetch }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onMouseEnter={() => handlePrefetch(prefetch)}
          onFocus={() => handlePrefetch(prefetch)}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'
            }`
          }
        >
          <Icon sx={{ fontSize: 18 }} />
          <span className="hidden md:inline">{label}</span>
        </NavLink>
      ))}
      <div className="w-px h-6 bg-border mx-1" />
      <button
        onClick={toggle}
        className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <DarkModeRounded sx={{ fontSize: 18 }} /> : <LightModeRounded sx={{ fontSize: 18 }} />}
      </button>
    </nav>
  )
}
