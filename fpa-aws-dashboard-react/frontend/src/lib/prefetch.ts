import { QueryClient } from '@tanstack/react-query'
import { fetchApi } from './api'

const STALE = 5 * 60 * 1000

export function prefetchAll(qc: QueryClient) {
  // Immediate: Executive Summary data
  qc.prefetchQuery({ queryKey: ['summary'], queryFn: () => fetchApi('/data/summary'), staleTime: STALE })
  qc.prefetchQuery({ queryKey: ['sankey'], queryFn: () => fetchApi('/data/sankey'), staleTime: STALE })
  qc.prefetchQuery({ queryKey: ['projects'], queryFn: () => fetchApi('/data/projects'), staleTime: STALE })
  qc.prefetchQuery({ queryKey: ['roster'], queryFn: () => fetchApi('/data/roster'), staleTime: STALE })

  // Deferred: other routes
  const deferred = () => {
    qc.prefetchQuery({ queryKey: ['labor', { leader: 'All', type: 'All', location: 'All', fbu: 'All', project: 'All' }], queryFn: () => fetchApi('/data/labor?'), staleTime: STALE })
    qc.prefetchQuery({ queryKey: ['aws', 'All', []], queryFn: () => fetchApi('/data/aws?'), staleTime: STALE })
    qc.prefetchQuery({ queryKey: ['insights'], queryFn: () => fetchApi('/ai/insights'), staleTime: STALE })
    qc.prefetchQuery({ queryKey: ['ai-alerts'], queryFn: () => fetchApi('/ai/alerts'), staleTime: STALE })
    qc.prefetchQuery({ queryKey: ['bva'], queryFn: () => fetchApi('/data/bva'), staleTime: STALE })
  }

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(deferred)
  } else {
    setTimeout(deferred, 1500)
  }
}
