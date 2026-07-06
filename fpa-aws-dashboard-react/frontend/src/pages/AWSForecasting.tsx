import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'
import LazyPlot from '../components/LazyPlot'
import { useThemeValue } from '@/lib/theme-context'
import { chartLayout, actualForecastDivider } from '@/lib/chart-config'
import { useDebouncedValue } from '@/lib/use-debounce'
import { RefreshCw, Info } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import KpiCard from '@/components/ui/KpiCard'
import DataTable from '@/components/ui/DataTable'
import CardSection from '@/components/ui/CardSection'
import VarianceChip from '@/components/ui/VarianceChip'
import InsightBanner from '@/components/ui/InsightBanner'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface AWSResponse {
  data: Record<string, any>[]
  validation: {
    'Total AWS Forecast': number
    'AWS Cap': number
    'Variance to Cap': number
    'Over Cap': boolean
  }
  monthly: { month: string; cost: number }[]
  aws_cap: number
  growth_accounts: string[]
}

function fmtFull(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtMillions(n: number): string {
  return `$${(n / 1_000_000).toFixed(1)}M`
}

function fmtThousands(n: number): string {
  return `$${Math.round(n / 1_000)}k`
}

function fmtSmart(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return fmtMillions(n)
  if (abs >= 10_000) return fmtThousands(n)
  return fmtFull(n)
}

export default function AWSForecasting() {
  const theme = useThemeValue()
  const cfg = useMemo(() => chartLayout(theme), [theme])

  const [svp, setSvp] = useState('All')
  const [selEmps, setSelEmps] = useState<string[]>([])

  const debouncedSvp = useDebouncedValue(svp)
  const debouncedSelEmps = useDebouncedValue(selEmps)

  const { data: roster } = useQuery<{ svp_groups: string[]; employees: string[] }>({
    queryKey: ['roster'],
    queryFn: () => fetchApi('/data/roster'),
  })

  const params = useMemo(() => {
    const p = new URLSearchParams()
    if (debouncedSvp !== 'All') p.set('svp', debouncedSvp)
    if (debouncedSelEmps.length) p.set('employees', debouncedSelEmps.join(','))
    return p.toString()
  }, [debouncedSvp, debouncedSelEmps])

  const { data: awsResp, isLoading, refetch } = useQuery<AWSResponse>({
    queryKey: ['aws', debouncedSvp, debouncedSelEmps],
    queryFn: () => fetchApi(`/data/aws?${params}`),
  })

  const computedData = useMemo(() => {
    if (!awsResp) return null
    const { validation, monthly, aws_cap, data: records } = awsResp
    const cumulative = monthly.reduce<number[]>(
      (acc, m) => [...acc, (acc.length ? acc[acc.length - 1] : 0) + m.cost],
      []
    )

    const acctTotals: Record<string, { account: string; employee: string; total: number }> = {}
    records.forEach((r) => {
      const key = `${r['Account Number']}|${r['Employee Name']}`
      if (!acctTotals[key])
        acctTotals[key] = { account: r['Account Number'], employee: r['Employee Name'], total: 0 }
      acctTotals[key].total += r['Full Year Forecast'] || 0
    })
    const top5 = Object.values(acctTotals)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
    const totalAll = Object.values(acctTotals).reduce((s, a) => s + a.total, 0)

    const acctMonthly: Record<string, number[]> = {}
    records.forEach((r) => {
      const acct = r['Account Number']
      if (!acctMonthly[acct]) acctMonthly[acct] = Array(12).fill(0)
      MONTHS.forEach((m, i) => {
        acctMonthly[acct][i] += r[m] || 0
      })
    })

    const empPool =
      svp === 'All'
        ? undefined
        : records
            .map((r) => r['Employee Name'])
            .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
            .sort()

    return { validation, monthly, aws_cap, cumulative, top5, totalAll, acctMonthly, empPool }
  }, [awsResp, svp])

  if (isLoading || !awsResp || !computedData)
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading forecast data...
      </div>
    )

  const { validation, aws_cap, cumulative, top5, totalAll, acctMonthly } = computedData
  const empPool = computedData.empPool || roster?.employees || []

  // Derived values
  const runRate = totalAll / 12
  const varianceValue = validation['Variance to Cap']
  const isOverCap = validation['Over Cap']
  const top5Coverage = totalAll > 0 ? top5.reduce((s, a) => s + a.total, 0) / totalAll * 100 : 0

  // Top 3 accounts for the trends chart
  const top3Accounts = top5.slice(0, 3).map((a) => a.account)

  // Last 5 months data for stacked bar
  const barMonths = MONTHS.slice(-5)
  const barMonthIndices = [7, 8, 9, 10, 11]

  // Status chip logic for top 5 table
  const statusMap: { text: string; variant: 'positive' | 'negative' | 'neutral' }[] = [
    { text: 'STABLE', variant: 'neutral' },
    { text: 'TRENDING UP', variant: 'negative' },
    { text: 'OPTIMIZED', variant: 'positive' },
    { text: 'STABLE', variant: 'neutral' },
    { text: 'ATTENTION', variant: 'negative' },
  ]

  type Top5Row = { account: string; employee: string; total: number }

  return (
    <div className="space-y-6">
      {/* 1. Page Header with controls */}
      <PageHeader title="AWS Forecast Analysis" subtitle="FY24 Q3 Strategic Infrastructure Planning">
        <div className="flex items-center gap-3">
          <select
            className="border border-border rounded-[6px] px-3 py-2 text-sm bg-card text-foreground"
            value={svp}
            onChange={(e) => {
              setSvp(e.target.value)
              setSelEmps([])
            }}
          >
            <option value="All">All SVP Groups</option>
            {(roster?.svp_groups || []).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="border border-border rounded-[6px] px-3 py-2 text-sm bg-card text-foreground min-w-[180px]"
            multiple
            value={selEmps}
            onChange={(e) => setSelEmps(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {empPool.map((emp: string) => (
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </select>

          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-[6px] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Recalculate
          </button>
        </div>
      </PageHeader>

      {/* AI Insight Banners */}
      <InsightBanner page="aws" />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="AWS FY FORECAST"
          value={fmtFull(validation['Total AWS Forecast'])}
          subtitle="~-2.4% vs Prev. Month"
        />
        <KpiCard
          label="ANNUAL CAP"
          value={fmtFull(aws_cap)}
          subtitle="Set by Finance (Jan 1)"
        />
        <KpiCard
          label="VARIANCE TO CAP"
          value={`+${fmtFull(varianceValue)}`}
          chip={{
            text: isOverCap ? 'OVER CAP' : 'UNDER CAP',
            variant: isOverCap ? 'negative' : 'positive',
          }}
        />
        <KpiCard
          label="RUN RATE EST."
          value={fmtSmart(runRate)}
          chip={{ text: '⚠ +12% Efficiency Target', variant: 'neutral' }}
        />
      </div>

      {/* 3. Cumulative Spend Chart */}
      <CardSection
        title="CUMULATIVE AWS SPEND VS CAP"
        subtitle="Projected trajectory through Dec 2024"
        headerRight={
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-blue-600 inline-block rounded" />
              <span className="text-muted-foreground">Forecast</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-red-500 inline-block" />
              <span className="text-muted-foreground">Budget Cap ({fmtMillions(aws_cap)})</span>
            </span>
          </div>
        }
      >
        <LazyPlot
          data={[
            {
              x: MONTHS.map((m) => m.toUpperCase()),
              y: cumulative,
              mode: 'lines' as const,
              fill: 'tozeroy',
              line: { color: '#2563eb', width: 2.5 },
              fillcolor: 'rgba(37,99,235,0.08)',
              name: 'Cumulative Spend',
              hovertemplate: '%{x}: $%{y:,.0f}<extra></extra>',
            },
          ]}
          layout={{
            height: 360,
            xaxis: {
              categoryorder: 'array' as const,
              categoryarray: MONTHS.map((m) => m.toUpperCase()),
              tickfont: cfg.axisFont,
              gridcolor: cfg.gridColor,
            },
            yaxis: {
              tickformat: '$,.0f',
              tickfont: cfg.axisFont,
              gridcolor: cfg.gridColor,
            },
            shapes: [
              {
                type: 'line',
                x0: 0,
                x1: 1,
                xref: 'paper',
                y0: aws_cap,
                y1: aws_cap,
                line: { dash: 'dash', color: '#dc2626', width: 2 },
              },
              ...actualForecastDivider(theme, { showAnnotation: false }).shapes,
            ],
            annotations: actualForecastDivider(theme).annotations,
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

      {/* 4. Two side-by-side charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardSection title="ACCOUNT MONTHLY TRENDS">
          <LazyPlot
            data={top3Accounts.map((acct) => ({
              x: MONTHS,
              y: acctMonthly[acct] || Array(12).fill(0),
              type: 'scatter' as const,
              mode: 'lines+markers' as const,
              name: acct,
              line: { width: 2 },
              marker: { size: 4 },
            }))}
            layout={{
              height: 280,
              legend: { font: cfg.legendFont, orientation: 'h' as const, y: -0.2 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              margin: { l: 40, r: 10, t: 10, b: 30 },
              font: cfg.font,
              xaxis: { tickfont: cfg.axisFont, gridcolor: cfg.gridColor },
              yaxis: { tickfont: cfg.axisFont, gridcolor: cfg.gridColor, tickformat: '$,.0f' },
            }}
            config={{ responsive: true, displayModeBar: false }}
            className="w-full"
          />
        </CardSection>

        <CardSection title="MONTHLY COST ALLOCATION">
          <LazyPlot
            data={Object.entries(acctMonthly)
              .slice(0, 5)
              .map(([acct, vals]) => ({
                x: barMonths,
                y: barMonthIndices.map((i) => vals[i] || 0),
                type: 'bar' as const,
                name: acct,
              }))}
            layout={{
              height: 280,
              barmode: 'stack' as const,
              legend: { font: cfg.legendFont, orientation: 'h' as const, y: -0.2 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              margin: { l: 40, r: 10, t: 10, b: 30 },
              font: cfg.font,
              xaxis: { tickfont: cfg.axisFont, gridcolor: cfg.gridColor },
              yaxis: { tickfont: cfg.axisFont, gridcolor: cfg.gridColor, tickformat: '$,.0f' },
            }}
            config={{ responsive: true, displayModeBar: false }}
            className="w-full"
          />
        </CardSection>
      </div>

      {/* 5. Data Table - Top 5 Resource Consumers */}
      <DataTable<Top5Row>
        title="TOP 5 RESOURCE CONSUMERS"
        headerRight={
          <span className="font-mono text-sm text-muted-foreground">
            Total Coverage: {top5Coverage.toFixed(1)}%
          </span>
        }
        columns={[
          {
            key: 'account',
            header: 'ACCOUNT ID',
            render: (row: Top5Row) => <span className="font-bold">{row.account}</span>,
          },
          {
            key: 'employee',
            header: 'OWNER',
          },
          {
            key: 'forecast',
            header: 'FY FORECAST',
            align: 'right',
            render: (row: Top5Row) => fmtFull(row.total),
          },
          {
            key: 'pct',
            header: '% OF TOTAL',
            align: 'right',
            render: (row: Top5Row) =>
              totalAll > 0 ? `${((row.total / totalAll) * 100).toFixed(1)}%` : '0%',
          },
          {
            key: 'status',
            header: 'STATUS',
            align: 'right',
            render: (_row: Top5Row, index: number) => {
              const status = statusMap[index] || { text: 'STABLE', variant: 'neutral' as const }
              return <VarianceChip text={status.text} variant={status.variant} />
            },
          },
        ]}
        data={top5}
      />

      {/* 6. Forecast Assumptions & Logic */}
      <CardSection
        title="FORECAST ASSUMPTIONS & LOGIC"
        headerRight={<Info className="w-4 h-4 text-muted-foreground" />}
      >
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm" style={{ fontFamily: 'DM Sans, sans-serif' }}>
          <div>
            <h4 className="font-semibold text-foreground mb-2">Growth Multipliers</h4>
            <p className="text-muted-foreground leading-relaxed">
              Accounts flagged as growth ({awsResp.growth_accounts?.join(', ') || 'N/A'}) receive a
              compounding 5% monthly increase from March onward, reflecting anticipated scaling of
              production workloads and new service deployments.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-2">SLA Adjustments</h4>
            <p className="text-muted-foreground leading-relaxed">
              Multi-AZ redundancy requirements add 15–20% overhead to baseline compute costs.
              Dev/test environments are capped at 40% of production equivalent spend with automatic
              teardown policies enforced nightly.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-foreground mb-2">Reserved Instances</h4>
            <p className="text-muted-foreground leading-relaxed">
              RI coverage currently at 68% for steady-state workloads. Savings plans applied to
              predictable compute, with on-demand retained for burst capacity and new service
              experimentation phases.
            </p>
          </div>
        </div>
      </CardSection>
    </div>
  )
}
