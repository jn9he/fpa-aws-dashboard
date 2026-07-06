import { memo, useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { AlertTriangle, Info, Lightbulb, X } from 'lucide-react'

interface Alert {
  severity: 'critical' | 'warning' | 'info'
  message: string
  page: 'executive' | 'aws' | 'resources'
}

interface AlertsResponse {
  alerts: Alert[]
  fallback: boolean
}

interface InsightBannerProps {
  page: 'executive' | 'aws' | 'resources'
}

const severityConfig = {
  critical: {
    border: 'border-l-negative',
    bg: 'bg-red-50 dark:bg-red-950/20',
    icon: AlertTriangle,
    iconColor: 'text-red-600 dark:text-red-400',
    textColor: 'text-red-800 dark:text-red-300',
  },
  warning: {
    border: 'border-l-accent',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    icon: Info,
    iconColor: 'text-accent',
    textColor: 'text-blue-800 dark:text-blue-300',
  },
  info: {
    border: 'border-l-positive',
    bg: 'bg-green-50 dark:bg-green-950/20',
    icon: Lightbulb,
    iconColor: 'text-green-600 dark:text-green-400',
    textColor: 'text-green-800 dark:text-green-300',
  },
}

const InsightBanner = memo(function InsightBanner({ page }: InsightBannerProps) {
  const storageKey = `dismissed-alerts-${page}`

  const [dismissed, setDismissed] = useState<Set<number>>(() => {
    try {
      const stored = sessionStorage.getItem(storageKey)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  const { data } = useQuery<AlertsResponse>({
    queryKey: ['ai-alerts'],
    queryFn: () => fetchApi('/ai/alerts'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const dismiss = useCallback((index: number) => {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(index)
      sessionStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
  }, [storageKey])

  const visibleAlerts = useMemo(() => {
    if (!data?.alerts) return []
    return data.alerts
      .map((alert, i) => ({ ...alert, _idx: i }))
      .filter(a => a.page === page && !dismissed.has(a._idx))
  }, [data, page, dismissed])

  if (!visibleAlerts.length) return null

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => {
        const cfg = severityConfig[alert.severity]
        const Icon = cfg.icon
        return (
          <div
            key={alert._idx}
            className={`flex items-center gap-3 px-4 py-3 border border-border border-l-4 ${cfg.border} ${cfg.bg} rounded-[6px]`}
          >
            <Icon size={16} className={`flex-shrink-0 ${cfg.iconColor}`} />
            <p className={`flex-1 text-sm font-medium ${cfg.textColor}`}>
              {alert.message}
            </p>
            <button
              onClick={() => dismiss(alert._idx)}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition"
              aria-label="Dismiss alert"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
})

export default InsightBanner
