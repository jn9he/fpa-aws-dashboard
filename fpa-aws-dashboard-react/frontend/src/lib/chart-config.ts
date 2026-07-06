/**
 * Shared Plotly chart configuration — theme-aware font and color helpers.
 *
 * Usage:
 *   import { chartLayout } from '@/lib/chart-config'
 *   const cfg = chartLayout(theme)
 *   <Plot layout={{ ...cfg.base, xaxis: { ...cfg.axis }, yaxis: { ...cfg.axis } }} />
 */

/**
 * Returns Plotly shapes + annotations for a vertical "Actual | Forecast" divider line.
 * Place between Mar (index 2) and Apr (index 3) on category axes.
 */
export function actualForecastDivider(theme: 'light' | 'dark', opts?: { showAnnotation?: boolean; yRef?: string }) {
  const muted = theme === 'dark' ? 'rgba(156,158,168,0.5)' : 'rgba(15,15,17,0.3)'
  const textColor = theme === 'dark' ? '#9C9EA8' : '#646770'
  const showAnnotation = opts?.showAnnotation ?? true

  const shapes = [
    {
      type: 'line' as const,
      x0: 2.5,
      x1: 2.5,
      y0: 0,
      y1: 1,
      xref: 'x' as const,
      yref: 'paper' as const,
      line: { dash: 'dot' as const, color: muted, width: 1.5 },
    },
  ]

  const annotations = showAnnotation
    ? [
        {
          x: 2.5,
          y: 1.05,
          xref: 'x' as const,
          yref: 'paper' as const,
          text: '← Actual | Forecast →',
          showarrow: false,
          font: { size: 10, color: textColor, family: 'DM Mono, monospace' },
        },
      ]
    : []

  return { shapes, annotations }
}

export function chartLayout(theme: 'light' | 'dark') {
  const foreground = theme === 'dark' ? '#EDEEF2' : '#0F0F11'
  const muted = theme === 'dark' ? '#9C9EA8' : '#646770'
  const gridColor = theme === 'dark' ? 'rgba(156,158,168,0.15)' : 'rgba(15,15,17,0.06)'

  return {
    /** Base font applied to entire chart */
    font: { family: 'DM Sans, sans-serif', color: foreground },
    /** Font for chart titles — Instrument Serif */
    titleFont: { family: 'Instrument Serif, serif', size: 14, color: foreground },
    /** Font for axis tick labels and legend — DM Mono */
    axisFont: { family: 'DM Mono, monospace', size: 11, color: muted },
    /** Font for legend items */
    legendFont: { family: 'DM Mono, monospace', size: 9, color: muted },
    /** Grid line color */
    gridColor,
    /** Transparent backgrounds */
    paperBgColor: 'rgba(0,0,0,0)' as const,
    plotBgColor: 'rgba(0,0,0,0)' as const,
    /** Foreground color for direct use */
    foreground,
    /** Muted color for secondary elements */
    muted,
  }
}
