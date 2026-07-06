import { lazy, Suspense, memo, ComponentProps } from 'react'

const ReactPlotly = lazy(() => import('react-plotly.js'))

type PlotProps = ComponentProps<typeof ReactPlotly>

function PlotFallback() {
  return (
    <div className="w-full h-[220px] flex items-center justify-center text-muted-foreground text-sm animate-pulse">
      Loading chart…
    </div>
  )
}

const LazyPlot = memo(function LazyPlot(props: PlotProps) {
  return (
    <Suspense fallback={<PlotFallback />}>
      <ReactPlotly {...props} />
    </Suspense>
  )
})

export default LazyPlot
