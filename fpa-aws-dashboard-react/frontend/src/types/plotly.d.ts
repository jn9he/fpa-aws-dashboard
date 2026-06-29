declare module 'react-plotly.js' {
  import { Component } from 'react'
  import Plotly from 'plotly.js'

  interface PlotParams {
    data: Partial<Plotly.Data>[]
    layout?: Partial<Plotly.Layout>
    config?: Partial<Plotly.Config>
    style?: React.CSSProperties
    className?: string
    useResizeHandler?: boolean
    onInitialized?: (figure: any) => void
    onUpdate?: (figure: any) => void
  }

  class Plot extends Component<PlotParams> {}
  export default Plot
}
