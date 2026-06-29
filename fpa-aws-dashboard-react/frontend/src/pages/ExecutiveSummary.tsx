import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'
import Plot from 'react-plotly.js'
import { useTheme } from '@/lib/theme-context'

interface KpiData {
  total_fy: number; total_labor: number; total_aws: number
  delta_total: number; delta_labor: number; delta_aws: number
  aws_variance_to_cap: number; aws_over_cap: boolean
}
interface SummaryResponse { kpis: KpiData; labor_monthly: { month: string; cost: number }[]; aws_monthly: { month: string; cost: number }[]; months: string[]; actual_months: string[] }
interface SankeyResponse { nodes: string[]; node_colors: string[]; sources: number[]; targets: number[]; values: number[]; link_colors: string[] }
interface ProjectResponse { top5: { "Project Number": string; "Project Name": string; "Full Year Cost": number }[] }

function fmt(n: number) { return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

export default function ExecutiveSummary() {
  const { theme } = useTheme()
  const fontColor = theme === 'dark' ? '#fbf9ff' : '#000807'
  const gridColor = theme === 'dark' ? 'rgba(162,163,187,0.2)' : 'rgba(0,8,7,0.08)'

  const { data: summary, isLoading: l1 } = useQuery<SummaryResponse>({ queryKey: ['summary'], queryFn: () => fetchApi('/data/summary') })
  const { data: sankey, isLoading: l2 } = useQuery<SankeyResponse>({ queryKey: ['sankey'], queryFn: () => fetchApi('/data/sankey') })
  const { data: projects, isLoading: l3 } = useQuery<ProjectResponse>({ queryKey: ['projects'], queryFn: () => fetchApi('/data/projects') })

  if (l1 || l2 || l3 || !summary || !sankey || !projects) return <div className="text-muted-foreground">Loading...</div>

  const { kpis, labor_monthly, aws_monthly, months } = summary
  const laborCosts = labor_monthly.map(m => m.cost)
  const awsCosts = aws_monthly.map(m => m.cost)

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Full Year Forecast" value={fmt(kpis.total_fy)} delta={`${kpis.delta_total >= 0 ? '+' : ''}${fmt(Math.abs(kpis.delta_total))}/mo`} deltaLabel="vs actuals" />
        <KpiCard title="Labor Forecast" value={fmt(kpis.total_labor)} delta={`${kpis.delta_labor >= 0 ? '+' : ''}${fmt(Math.abs(kpis.delta_labor))}/mo`} deltaLabel="vs actuals" />
        <KpiCard title="AWS Forecast" value={fmt(kpis.total_aws)} delta={`${kpis.delta_aws >= 0 ? '+' : ''}${fmt(Math.abs(kpis.delta_aws))}/mo`} deltaLabel="vs actuals" />
        <KpiCard title="AWS Variance to Cap" value={fmt(kpis.aws_variance_to_cap)} delta={kpis.aws_over_cap ? 'OVER CAP' : 'Under'} invertColor={kpis.aws_over_cap} />
      </div>

      {/* Sparklines */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Trends</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Sparkline months={months} values={laborCosts} title="Labor Cost ($)" color="#115fa0" fontColor={fontColor} gridColor={gridColor} />
          <Sparkline months={months} values={awsCosts} title="AWS Cost ($)" color="#b3b7ee" fontColor={fontColor} gridColor={gridColor} />
        </div>
      </div>

      {/* Top 5 */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Top 5 Project Cost Drivers</h3>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr><th className="text-left px-4 py-2">Project Number</th><th className="text-left px-4 py-2">Project Name</th><th className="text-right px-4 py-2">Full Year Cost</th></tr>
            </thead>
            <tbody>
              {projects.top5.map((p, i) => (
                <tr key={i} className="border-t border-border"><td className="px-4 py-2">{p["Project Number"]}</td><td className="px-4 py-2">{p["Project Name"]}</td><td className="px-4 py-2 text-right font-medium">{fmt(p["Full Year Cost"])}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sankey */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Budget Flow — Funding BU → Project → Employee Type</h3>
        <div className="bg-card border border-border rounded-lg p-4">
          <Plot
            data={[{
              type: 'sankey',
              node: { pad: 20, thickness: 20, label: sankey.nodes, color: sankey.node_colors },
              link: { source: sankey.sources, target: sankey.targets, value: sankey.values, color: sankey.link_colors.map(c => { const hex = c.replace('#', ''); const r = parseInt(hex.substring(0, 2), 16); const g = parseInt(hex.substring(2, 4), 16); const b = parseInt(hex.substring(4, 6), 16); return `rgba(${r},${g},${b},0.4)` }) },
            }]}
            layout={{ font: { size: 13, color: fontColor }, height: 500, margin: { l: 20, r: 20, t: 10, b: 20 }, paper_bgcolor: 'rgba(0,0,0,0)' }}
            config={{ responsive: true }}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}

function KpiCard({ title, value, delta, deltaLabel, invertColor }: { title: string; value: string; delta?: string; deltaLabel?: string; invertColor?: boolean }) {
  const isPositive = delta && !delta.startsWith('-')
  const color = invertColor ? (isPositive ? 'text-red-500' : 'text-emerald-500') : (isPositive ? 'text-emerald-500' : 'text-red-500')
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {delta && <p className={`text-sm font-medium ${color}`}>{delta} {deltaLabel}</p>}
    </div>
  )
}

function Sparkline({ months, values, title, color, fontColor, gridColor }: { months: string[]; values: number[]; title: string; color: string; fontColor: string; gridColor: string }) {
  const yMin = Math.min(...values); const yMax = Math.max(...values); const pad = Math.max((yMax - yMin) * 0.3, yMax * 0.05)
  return (
    <div className="bg-card border border-border rounded-lg p-2">
      <Plot
        data={[
          { x: months.slice(0, 3), y: values.slice(0, 3), mode: 'lines+markers' as const, line: { color: '#a2a3bb', width: 2 }, marker: { size: 5 }, name: 'Actual' },
          { x: months.slice(2), y: values.slice(2), mode: 'lines+markers' as const, line: { color, width: 2, dash: 'dot' }, marker: { size: 5 }, name: 'Forecast' },
        ]}
        layout={{
          height: 220, margin: { l: 50, r: 10, t: 30, b: 60 },
          xaxis: { tickmode: 'array' as const, tickvals: months, color: fontColor, gridcolor: gridColor },
          yaxis: { tickformat: ',', range: [yMin - pad, yMax + pad], color: fontColor, gridcolor: gridColor },
          title: { text: title, font: { size: 12, color: fontColor } },
          legend: { orientation: 'h' as const, y: -0.55, xanchor: 'center', x: 0.5, font: { size: 9, color: fontColor } },
          showlegend: true, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
          font: { color: fontColor },
        }}
        config={{ responsive: true }}
        className="w-full"
      />
    </div>
  )
}
