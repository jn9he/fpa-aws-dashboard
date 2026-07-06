import { memo, useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchApi } from '../lib/api'
import LazyPlot from '../components/LazyPlot'
import { useThemeValue } from '@/lib/theme-context'
import { chartLayout, actualForecastDivider } from '@/lib/chart-config'
import PageHeader from '@/components/ui/PageHeader'
import KpiCard from '@/components/ui/KpiCard'
import DataTable from '@/components/ui/DataTable'
import CardSection from '@/components/ui/CardSection'
import VarianceChip from '@/components/ui/VarianceChip'
import InsightBanner from '@/components/ui/InsightBanner'
import BvATreeTable from '@/components/ui/BvATreeTable'
import { Download, Calendar, Sparkles, AlertTriangle, Lightbulb, Send } from 'lucide-react'

interface KpiData {
  total_fy: number; total_labor: number; total_aws: number
  delta_total: number; delta_labor: number; delta_aws: number
  aws_variance_to_cap: number; aws_over_cap: boolean
}
interface SummaryResponse { kpis: KpiData; labor_monthly: { month: string; cost: number }[]; aws_monthly: { month: string; cost: number }[]; months: string[]; actual_months: string[] }
interface SankeyResponse { nodes: string[]; node_colors: string[]; sources: number[]; targets: number[]; values: number[]; link_colors: string[] }
interface ProjectItem { "Project Number": string; "Project Name": string; Owner: string; Forecast: number; "Actual YTD": number; Delta: number }
interface ProjectResponse { top5: ProjectItem[]; all: ProjectItem[] }

function fmtM(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}
function fmt(n: number) { return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

export default function ExecutiveSummary() {
  const theme = useThemeValue()
  const cfg = useMemo(() => chartLayout(theme), [theme])

  const { data: summary, isLoading: l1 } = useQuery<SummaryResponse>({ queryKey: ['summary'], queryFn: () => fetchApi('/data/summary') })
  const { data: sankey, isLoading: l2 } = useQuery<SankeyResponse>({ queryKey: ['sankey'], queryFn: () => fetchApi('/data/sankey') })
  const { data: projects, isLoading: l3 } = useQuery<ProjectResponse>({ queryKey: ['projects'], queryFn: () => fetchApi('/data/projects') })

  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const sendChatMessage = useCallback(async (msg: string) => {
    if (!msg.trim()) return
    const newMessages = [...chatMessages, { role: 'user', content: msg }]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    try {
      const resp: any = await fetchApi('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: newMessages.slice(-6) }),
      })
      setChatMessages([...newMessages, { role: 'assistant', content: resp.response }])
    } catch (e: any) {
      setChatMessages([...newMessages, { role: 'assistant', content: `⚠️ Error: ${e.message}` }])
    }
    setChatLoading(false)
  }, [chatMessages])

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight) }, [chatMessages])

  const handleExportPdf = useCallback(async () => {
    try {
      const resp = await fetch('/api/export/pdf')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'FPA_Executive_Summary.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF export failed:', e)
    }
  }, [])

  const sankeyLinkColors = useMemo(() => {
    if (!sankey) return []
    return sankey.link_colors.map(c => {
      const hex = c.replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      return `rgba(${r},${g},${b},0.4)`
    })
  }, [sankey])

  if (l1 || l2 || l3 || !summary || !sankey || !projects) return <div className="text-muted-foreground">Loading...</div>

  const { kpis, labor_monthly, aws_monthly, months } = summary
  const laborCosts = labor_monthly.map(m => m.cost)
  const awsCosts = aws_monthly.map(m => m.cost)

  // KPI percentages - compute from deltas
  const laborPct = kpis.total_labor > 0 ? ((kpis.delta_labor / (kpis.total_labor / 12)) * 100).toFixed(1) : '0'
  const awsPct = kpis.total_aws > 0 ? ((kpis.delta_aws / (kpis.total_aws / 12)) * 100).toFixed(1) : '0'
  const totalPct = kpis.total_fy > 0 ? ((kpis.delta_total / (kpis.total_fy / 12)) * 100).toFixed(1) : '0'

  const projectColumns = [
    { key: 'Project Name', header: 'PROJECT NAME' },
    { key: 'Owner', header: 'OWNER' },
    { key: 'Forecast', header: 'FORECAST', align: 'right' as const, render: (row: ProjectItem) => <span className="ticker-mono">{fmt(row.Forecast)}</span> },
    { key: 'Actual YTD', header: 'ACTUAL YTD', align: 'right' as const, render: (row: ProjectItem) => <span className="ticker-mono">{fmt(row["Actual YTD"])}</span> },
    { key: 'Delta', header: 'DELTA', align: 'right' as const, render: (row: ProjectItem) => {
      const isPositive = row.Delta >= 0
      return <span className={`ticker-mono ${isPositive ? 'text-positive' : 'text-negative'}`}>{isPositive ? '+' : '-'}{fmt(Math.abs(row.Delta))}</span>
    }},
  ]

  return (
    <div className="space-y-6">
      {/* AI Insight Banners */}
      <InsightBanner page="executive" />

      {/* Page Header */}
      <PageHeader
        title="Executive Summary"
        subtitle="Financial Performance Overview & Cloud Infrastructure Variance"
      >
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 border border-border rounded-[6px] text-sm text-foreground bg-card hover:bg-muted/30 transition">
            <Calendar size={14} />
            <span>FY 2024</span>
          </button>
          <button onClick={handleExportPdf} className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-[6px] text-sm font-medium hover:opacity-90 transition">
            <Download size={14} />
            <span>Export PDF</span>
          </button>
        </div>
      </PageHeader>

      {/* Run Rate — Total Spend vs Annual Plan */}
      <RunRateChart months={months} laborCosts={laborCosts} awsCosts={awsCosts} totalFy={kpis.total_fy} cfg={cfg} theme={theme} />

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="FULL YEAR FORECAST"
          value={fmtM(kpis.total_fy)}
          chip={{ text: `↑${Math.abs(+totalPct)}%`, variant: +totalPct >= 0 ? 'positive' : 'negative' }}
          progressColor="#115FA0"
        />
        <KpiCard
          label="LABOR FORECAST"
          value={fmtM(kpis.total_labor)}
          chip={{ text: `↓${Math.abs(+laborPct)}%`, variant: +laborPct >= 0 ? 'positive' : 'negative' }}
        />
        <KpiCard
          label="AWS FORECAST"
          value={fmtM(kpis.total_aws)}
          chip={{ text: 'On Track', variant: 'neutral' }}
        />
        <KpiCard
          label="AWS VARIANCE TO CAP"
          value={`-${fmtM(Math.abs(kpis.aws_variance_to_cap))}`}
          chip={{ text: kpis.aws_over_cap ? 'OVER CAP' : 'OPTIMIZED', variant: kpis.aws_over_cap ? 'negative' : 'positive' }}
        />
      </div>

      {/* Trend Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSection
          title="LABOR COST TREND"
          subtitle="Monthly spend across all BU segments"
          headerRight={<VarianceChip text="+3.2% vs Plan" variant="positive" />}
        >
          <div className="p-3">
            <TrendSparkline months={months} values={laborCosts} color="#115fa0" cfg={cfg} />
          </div>
        </CardSection>
        <CardSection
          title="AWS COST TREND"
          subtitle="RI vs. On-Demand vs. Savings Plans"
          headerRight={<VarianceChip text="-1.8% Efficiency" variant="negative" />}
        >
          <div className="p-3">
            <TrendSparkline months={months} values={awsCosts} color={theme === 'dark' ? '#60A5DC' : '#115fa0'} cfg={cfg} />
          </div>
        </CardSection>
      </div>

      {/* Top 5 Project Cost Drivers */}
      <DataTable<ProjectItem>
        title="TOP 5 PROJECT COST DRIVERS"
        headerRight={<Link to="/projects" className="text-sm text-accent hover:underline">View All Projects</Link>}
        columns={projectColumns}
        data={projects.top5}
      />

      {/* Budget vs Actual — Drill Down Tree Table */}
      <BvATreeTable />

      {/* Sankey Diagram */}
      <CardSection
        title="BUDGET FLOW — FUNDING BU → PROJECT → EMPLOYEE TYPE"
        subtitle="Visualizing capital allocation and labor distribution"
      >
        <div className="p-4">
          <LazyPlot
            data={[{
              type: 'sankey',
              node: { pad: 20, thickness: 20, label: sankey.nodes, color: sankey.node_colors },
              link: { source: sankey.sources, target: sankey.targets, value: sankey.values, color: sankeyLinkColors },
            }]}
            layout={{
              font: cfg.font,
              height: 420,
              margin: { l: 20, r: 20, t: 10, b: 20 },
              paper_bgcolor: cfg.paperBgColor,
            }}
            config={{ responsive: true, displayModeBar: false }}
            className="w-full"
          />
        </div>
      </CardSection>

      {/* AI Financial Insights */}
      <CardSection
        title="AI FINANCIAL INSIGHTS"
      >
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: Alerts */}
          <div className="space-y-3">
            <div className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20 rounded-r-[6px] p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-600" />
                <span className="text-sm font-medium text-red-700 dark:text-red-400">Budget Risk Alert</span>
              </div>
              <p className="text-sm text-muted-foreground">GenAI R&D project is 12.5% over forecast due to unexpected token consumption in Q3.</p>
            </div>
            <div className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20 rounded-r-[6px] p-3">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb size={14} className="text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Savings Opportunity</span>
              </div>
              <p className="text-sm text-muted-foreground">Switching 40% of on-demand instances to Reserved Instances could save $140k/month.</p>
            </div>
          </div>

          {/* Right: Mini Chat */}
          <div className="border border-border rounded-[6px] flex flex-col">
            <div className="px-4 py-2 border-b border-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-foreground">FP&A AI Assistant</span>
              </div>
              <span className="label-mono text-positive">ONLINE</span>
            </div>
            <div ref={chatRef} className="flex-1 p-3 space-y-3 min-h-[120px] max-h-[200px] overflow-y-auto">
              {chatMessages.length === 0 && (
                <>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                      <Sparkles size={12} className="text-white" />
                    </div>
                    <div className="bg-muted/30 border border-border rounded-[6px] px-3 py-2 text-sm text-foreground">
                      Hello. I can help analyze your FY2024 variances. What would you like to explore?
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['Analyze labor variance', 'AWS RI coverage gap', 'Forecast Q4 risk'].map(chip => (
                      <button key={chip} onClick={() => sendChatMessage(chip)} className="px-3 py-1 border border-border rounded-full text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition">
                        {chip}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                      <Sparkles size={12} className="text-white" />
                    </div>
                  )}
                  <div className={`rounded-[6px] px-3 py-2 text-sm max-w-[85%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/30 border border-border text-foreground'}`}>
                    <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <Sparkles size={12} className="text-white" />
                  </div>
                  <div className="bg-muted/30 border border-border rounded-[6px] px-3 py-2 text-sm text-muted-foreground animate-pulse">
                    Analyzing...
                  </div>
                </div>
              )}
            </div>
            <div className="px-3 pb-3">
              <form onSubmit={e => { e.preventDefault(); sendChatMessage(chatInput) }} className="flex items-center gap-2 border border-border rounded-[6px] px-3 py-2">
                <input
                  type="text"
                  placeholder="Ask a financial question..."
                  className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={chatLoading}
                />
                <button type="submit" disabled={chatLoading || !chatInput.trim()} className="text-accent hover:text-accent/80 transition disabled:opacity-50">
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </CardSection>
    </div>
  )
}

const MONTHS_LIST = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const RunRateChart = memo(function RunRateChart({
  months, laborCosts, awsCosts, totalFy, cfg, theme,
}: {
  months: string[]; laborCosts: number[]; awsCosts: number[]; totalFy: number
  cfg: ReturnType<typeof chartLayout>; theme: 'light' | 'dark'
}) {
  const combined = laborCosts.map((l, i) => l + (awsCosts[i] || 0))
  const budgetRate = totalFy / 12
  const divider = actualForecastDivider(theme)

  // Trajectory annotation
  const cumulative = combined.reduce<number[]>((acc, v) => [...acc, (acc.length ? acc[acc.length - 1] : 0) + v], [])
  const isOverPlan = cumulative[cumulative.length - 1] > totalFy
  const underOverAmount = Math.abs(cumulative[cumulative.length - 1] - totalFy)
  let trajectoryText = ''
  if (isOverPlan) {
    // Find the month where cumulative exceeds total FY
    const crossMonth = cumulative.findIndex(c => c > totalFy)
    trajectoryText = crossMonth >= 0
      ? `Projected to exceed plan in ${MONTHS_LIST[crossMonth]}`
      : `Projected ${fmtM(underOverAmount)} over annual plan`
  } else {
    trajectoryText = `On pace: ${fmtM(underOverAmount)} under annual plan`
  }

  return (
    <CardSection
      title="RUN RATE — TOTAL SPEND VS ANNUAL PLAN"
      subtitle="Combined labor + AWS monthly spend with annual budget reference"
      headerRight={
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#00477C] inline-block rounded" />
            <span className="text-muted-foreground">Actual</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-accent inline-block rounded" style={{ opacity: 0.7 }} />
            <span className="text-muted-foreground">Forecast</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-red-500 inline-block" />
            <span className="text-muted-foreground">Budget Rate</span>
          </span>
        </div>
      }
    >
      <LazyPlot
        data={[
          {
            x: months.slice(0, 3),
            y: combined.slice(0, 3),
            mode: 'lines+markers' as const,
            line: { color: '#00477C', width: 3 },
            marker: { size: 6, color: '#00477C' },
            name: 'Actual',
            showlegend: false,
          },
          {
            x: months.slice(2),
            y: combined.slice(2),
            mode: 'lines+markers' as const,
            line: { color: '#115FA0', width: 2.5, dash: 'dash' as const },
            marker: { size: 5, color: '#115FA0' },
            name: 'Forecast',
            fill: 'tonexty' as const,
            fillcolor: isOverPlan ? 'rgba(185,28,28,0.06)' : 'rgba(15,81,50,0.06)',
            showlegend: false,
          },
        ]}
        layout={{
          height: 300,
          xaxis: {
            categoryorder: 'array' as const,
            categoryarray: months,
            tickfont: cfg.axisFont,
            gridcolor: cfg.gridColor,
          },
          yaxis: {
            tickformat: '$,.0f',
            tickfont: cfg.axisFont,
            gridcolor: cfg.gridColor,
          },
          shapes: [
            // Budget rate horizontal line
            {
              type: 'line' as const,
              x0: 0, x1: 1, xref: 'paper' as const,
              y0: budgetRate, y1: budgetRate, yref: 'y' as const,
              line: { dash: 'dash' as const, color: '#dc2626', width: 1.5 },
            },
            ...divider.shapes,
          ],
          annotations: [
            ...divider.annotations,
            {
              x: months[months.length - 1],
              y: combined[combined.length - 1],
              text: trajectoryText,
              showarrow: true,
              arrowhead: 2,
              arrowcolor: isOverPlan ? '#dc2626' : '#0f5132',
              font: { size: 11, color: isOverPlan ? '#dc2626' : '#0f5132', family: 'DM Mono, monospace' },
              ax: -80,
              ay: -30,
            },
            {
              x: months[0],
              y: budgetRate,
              xanchor: 'left' as const,
              text: `Budget: ${fmtM(budgetRate)}/mo`,
              showarrow: false,
              font: { size: 10, color: '#dc2626', family: 'DM Mono, monospace' },
              yshift: 10,
            },
          ],
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: { l: 60, r: 20, t: 30, b: 40 },
          font: cfg.font,
          showlegend: false,
        }}
        config={{ responsive: true, displayModeBar: false }}
        className="w-full"
      />
    </CardSection>
  )
})

const TrendSparkline = memo(function TrendSparkline({ months, values, color, cfg }: { months: string[]; values: number[]; color: string; cfg: ReturnType<typeof chartLayout> }) {
  const theme = useThemeValue()
  const divider = actualForecastDivider(theme, { showAnnotation: false })
  return (
    <LazyPlot
      data={[
        { x: months.slice(0, 3), y: values.slice(0, 3), mode: 'lines' as const, line: { color: cfg.muted, width: 2 }, name: 'Actual', showlegend: false },
        { x: months.slice(2), y: values.slice(2), mode: 'lines' as const, line: { color, width: 2 }, name: 'Forecast', showlegend: false },
      ]}
      layout={{
        height: 80,
        margin: { l: 0, r: 0, t: 5, b: 5 },
        xaxis: { visible: false },
        yaxis: { visible: false },
        shapes: divider.shapes,
        paper_bgcolor: cfg.paperBgColor,
        plot_bgcolor: cfg.plotBgColor,
        font: cfg.font,
      }}
      config={{ responsive: true, displayModeBar: false }}
      className="w-full"
    />
  )
})
