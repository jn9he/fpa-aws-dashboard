import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchApi } from '../lib/api'
import LazyPlot from '../components/LazyPlot'
import { useThemeValue } from '@/lib/theme-context'
import { chartLayout, actualForecastDivider } from '@/lib/chart-config'
import { useDebouncedValue } from '@/lib/use-debounce'
import PageHeader from '@/components/ui/PageHeader'
import KpiCard from '@/components/ui/KpiCard'
import CardSection from '@/components/ui/CardSection'
import InsightBanner from '@/components/ui/InsightBanner'

interface RosterResponse {
  leaders: string[]
  types: string[]
  locations: string[]
  fbus: string[]
  projects: string[]
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const ENDED_PROJECTS = ["P00010","P00014"]
const FBU_COLORS = ['#115fa0','#b3b7ee','#a2a3bb','#3c82be','#6470a0','#1a8060','#d97706','#7c3aed','#dc2626','#0891b2']
const LINE_COLORS = ['#115fa0', '#d97706', '#7c3aed', '#0891b2']

function fmtMillions(n: number) {
  const m = n / 1_000_000
  if (m >= 1) return `$${m.toFixed(1)}M`
  return `$${m.toFixed(3)}M`
}

function fmtMillionsShort(n: number) {
  const m = n / 1_000_000
  return `$${m.toFixed(2)}M`
}

export default function ResourceForecasting() {
  const theme = useThemeValue()
  const cfg = useMemo(() => chartLayout(theme), [theme])

  const [filters, setFilters] = useState({ leader: 'All', type: 'All', location: 'All', fbu: 'All', project: 'All' })
  const debouncedFilters = useDebouncedValue(filters, 300)

  const { data: roster } = useQuery<RosterResponse>({ queryKey: ['roster'], queryFn: () => fetchApi('/data/roster') })

  const queryParams = new URLSearchParams(Object.entries(debouncedFilters).filter(([, v]) => v !== 'All')).toString()
  const { data: laborResp, isLoading } = useQuery<{ data: Record<string, any>[]; count: number }>({
    queryKey: ['labor', debouncedFilters],
    queryFn: () => fetchApi(`/data/labor?${queryParams}`),
  })

  const setFilter = useCallback((key: string, val: string) => setFilters(f => ({ ...f, [key]: val })), [])
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== 'All')

  // Computed values
  const { monthlyCosts, actualVals, forecastVals, totalCost, avgActual, avgForecast, records, costCols } = useMemo(() => {
    if (!laborResp) return { monthlyCosts: [], actualVals: [], forecastVals: [], totalCost: 0, avgActual: 0, avgForecast: 0, records: [], costCols: [] }
    const recs = laborResp.data
    const cCols = MONTHS.map(m => `${m}_Cost`)
    const mCosts = MONTHS.map(m => recs.reduce((sum, r) => sum + (r[`${m}_Cost`] || 0), 0))
    const aVals = mCosts.slice(0, 3)
    const fVals = mCosts.slice(3)
    const tCost = mCosts.reduce((a, b) => a + b, 0)
    const aAvg = aVals.reduce((a, b) => a + b, 0) / 3
    const fAvg = fVals.reduce((a, b) => a + b, 0) / 9
    return { monthlyCosts: mCosts, actualVals: aVals, forecastVals: fVals, totalCost: tCost, avgActual: aAvg, avgForecast: fAvg, records: recs, costCols: cCols }
  }, [laborResp])

  // Gantt data
  const ganttComputed = useMemo(() => {
    if (!records.length) return { ganttData: [], fbuList: [], fbuColorMap: {}, ganttTraces: [], projectLines: [] }

    const projectGroups: Record<string, { name: string; pnum: string; fbu: string; monthlyHrs: number[] }> = {}
    records.forEach(r => {
      const key = `${r["Project Number"]}|${r["Project Name"]}|${r["Funding Business Unit"]}`
      if (!projectGroups[key]) {
        projectGroups[key] = { name: r["Project Name"], pnum: r["Project Number"], fbu: r["Funding Business Unit"], monthlyHrs: Array(12).fill(0) }
      }
      MONTHS.forEach((m, i) => { projectGroups[key].monthlyHrs[i] += (r[m] || 0) })
    })

    const ganttData: { project: string; start: string; end: string; fbu: string }[] = []
    Object.values(projectGroups).forEach(({ name, pnum, fbu, monthlyHrs }) => {
      const active = monthlyHrs.map((h, i) => h > 0 ? i : -1).filter(i => i >= 0)
      if (active.length > 0) {
        const startIdx = active[0]
        const endIdx = ENDED_PROJECTS.includes(pnum) ? Math.min(active[active.length - 1], 7) : active[active.length - 1]
        ganttData.push({ project: name, start: `2026-${String(startIdx + 1).padStart(2, '0')}-01`, end: `2026-${String(endIdx + 2).padStart(2, '0')}-01`, fbu })
      }
    })

    const fbuList = [...new Set(ganttData.map(g => g.fbu))]
    const fbuColorMap: Record<string, string> = {}
    fbuList.forEach((fbu, i) => { fbuColorMap[fbu] = FBU_COLORS[i % FBU_COLORS.length] })

    const ganttTraces = fbuList.map((fbu) => {
      const items = ganttData.filter(g => g.fbu === fbu)
      return items.map((g, j) => ({
        x: [new Date(g.start), new Date(g.end)],
        y: [g.project, g.project],
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { width: 20, color: fbuColorMap[fbu] },
        name: fbu,
        legendgroup: fbu,
        showlegend: j === 0,
        hoverinfo: 'x+y+name' as const,
      }))
    }).flat()

    // Project lines for the allocation timeline chart (top 4 projects by total hours)
    const sortedProjects = Object.values(projectGroups)
      .sort((a, b) => b.monthlyHrs.reduce((s, v) => s + v, 0) - a.monthlyHrs.reduce((s, v) => s + v, 0))
      .slice(0, 4)

    const projectLines = sortedProjects.map((proj, i) => ({
      x: MONTHS,
      y: proj.monthlyHrs,
      type: 'scatter' as const,
      mode: 'lines+markers' as const,
      name: proj.name,
      line: { color: LINE_COLORS[i % LINE_COLORS.length], width: 2 },
      marker: { size: 5, color: LINE_COLORS[i % LINE_COLORS.length] },
    }))

    return { ganttData, fbuList, fbuColorMap, ganttTraces, projectLines }
  }, [records])

  // Treemap data
  const treemapComputed = useMemo(() => {
    if (!records.length) return { treemapLabels: [], treemapParents: [], treemapValues: [] }

    const treemapLabels: string[] = []
    const treemapParents: string[] = []
    const treemapValues: number[] = []
    const fbuTotals: Record<string, number> = {}
    const projTotals: Record<string, Record<string, number>> = {}

    records.forEach(r => {
      const fbu = r["Funding Business Unit"] || "Unknown"
      const proj = r["Project Name"] || "Unknown"
      const emp = r["Employee Name"] || "Unknown"
      const cost = costCols.reduce((sum, c) => sum + (r[c] || 0), 0)
      if (cost <= 0) return
      fbuTotals[fbu] = (fbuTotals[fbu] || 0) + cost
      if (!projTotals[fbu]) projTotals[fbu] = {}
      projTotals[fbu][proj] = (projTotals[fbu][proj] || 0) + cost
      treemapLabels.push(`${emp} (${proj})`)
      treemapParents.push(`${proj} - ${fbu}`)
      treemapValues.push(cost)
    })

    Object.entries(projTotals).forEach(([fbu, projs]) => {
      Object.entries(projs).forEach(([proj]) => {
        treemapLabels.push(`${proj} - ${fbu}`)
        treemapParents.push(fbu)
        treemapValues.push(0)
      })
    })

    Object.keys(fbuTotals).forEach(fbu => {
      treemapLabels.push(fbu)
      treemapParents.push('')
      treemapValues.push(0)
    })

    return { treemapLabels, treemapParents, treemapValues }
  }, [records, costCols])

  const { projectLines } = ganttComputed
  const { treemapLabels, treemapParents, treemapValues } = treemapComputed

  if (isLoading || !laborResp) return <div className="text-muted-foreground p-8">Loading...</div>

  const filterLabels: Record<string, string> = { leader: 'LEADER', type: 'TYPE', location: 'LOCATION', fbu: 'FUNDING BU', project: 'PROJECT' }

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="Resource Forecasting"
        subtitle="Projected labor costs and AWS capacity allocation across 24-month horizon."
      />

      {/* 2. Filter Card */}
      <CardSection>
        <div className="p-4 pb-4 space-y-0">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="label-mono">LEADER</label>
            <select
              className="w-full border border-border rounded-[6px] px-3 py-2 text-sm bg-card text-foreground"
              value={filters.leader}
              onChange={e => setFilter('leader', e.target.value)}
            >
              <option value="All">All</option>
              {(roster?.leaders || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label-mono">TYPE</label>
            <select
              className="w-full border border-border rounded-[6px] px-3 py-2 text-sm bg-card text-foreground"
              value={filters.type}
              onChange={e => setFilter('type', e.target.value)}
            >
              <option value="All">All</option>
              {(roster?.types || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label-mono">LOCATION</label>
            <select
              className="w-full border border-border rounded-[6px] px-3 py-2 text-sm bg-card text-foreground"
              value={filters.location}
              onChange={e => setFilter('location', e.target.value)}
            >
              <option value="All">All</option>
              {(roster?.locations || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label-mono">FUNDING BU</label>
            <select
              className="w-full border border-border rounded-[6px] px-3 py-2 text-sm bg-card text-foreground"
              value={filters.fbu}
              onChange={e => setFilter('fbu', e.target.value)}
            >
              <option value="All">All</option>
              {(roster?.fbus || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="label-mono">PROJECT</label>
            <select
              className="w-full border border-border rounded-[6px] px-3 py-2 text-sm bg-card text-foreground"
              value={filters.project}
              onChange={e => setFilter('project', e.target.value)}
            >
              <option value="All">All</option>
              {(roster?.projects || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
            <span className="label-mono text-muted-foreground">ACTIVE FILTERS:</span>
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map(([key, val]) => (
                <span
                  key={key}
                  className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1"
                >
                  {filterLabels[key]}: {val}
                  <X size={12} className="cursor-pointer" onClick={() => setFilter(key, 'All')} />
                </span>
              ))}
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setFilters({ leader: 'All', type: 'All', location: 'All', fbu: 'All', project: 'All' })}
              >
                Clear All
              </button>
            </div>
          </div>
        )}
        </div>
      </CardSection>

      {/* AI Insight Banners */}
      <InsightBanner page="resources" />

      {/* 3. KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="TOTAL FORECASTED COST"
          value={fmtMillions(totalCost)}
          chip={{ text: '+2.4% vs LY', variant: 'positive' }}
          progressColor="#115FA0"
        />
        <KpiCard
          label="AVG HISTORICAL / MONTH"
          value={fmtMillionsShort(avgActual)}
          subtitle="Last 12mo"
        />
        <KpiCard
          label="AVG FORECASTED / MONTH"
          value={fmtMillionsShort(avgForecast)}
          chip={{ text: '+5.9% Trend', variant: 'negative' }}
        />
      </div>

      {/* 4. Cost & Usage Projection */}
      <CardSection
        title="COST & USAGE PROJECTION"
        subtitle="Comparison of historical actuals vs estimated labor burn."
        headerRight={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-[#00477C]" />
              Actuals
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-sm border-2 border-[#115FA0] bg-transparent" />
              Forecast
            </div>
          </div>
        }
      >
        <LazyPlot
          data={[
            {
              x: MONTHS.slice(0, 3),
              y: actualVals,
              type: 'bar',
              name: 'Actuals',
              marker: { color: '#00477C' },
              showlegend: false,
            },
            {
              x: MONTHS.slice(3),
              y: forecastVals,
              type: 'bar',
              name: 'Forecast',
              marker: { color: 'rgba(17,95,160,0.3)', line: { color: '#115FA0', width: 1.5 } },
              showlegend: false,
            },
          ]}
          layout={{
            height: 380,
            xaxis: { categoryorder: 'array', categoryarray: MONTHS, tickfont: cfg.axisFont, gridcolor: cfg.gridColor },
            yaxis: { title: { text: 'Costs ($)', font: cfg.axisFont }, tickformat: ',', tickfont: cfg.axisFont, gridcolor: cfg.gridColor },
            barmode: 'group',
            showlegend: false,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 60, r: 20, t: 30, b: 40 },
            font: cfg.font,
            shapes: actualForecastDivider(theme).shapes,
            annotations: [
              ...actualForecastDivider(theme).annotations,
              {
                x: 'Sep',
                y: Math.max(...forecastVals) * 0.85,
                text: 'Sunset: Legacy ERP',
                showarrow: true,
                arrowhead: 2,
                arrowsize: 1,
                arrowcolor: '#dc2626',
                font: { size: 11, color: '#dc2626' },
                ax: 40,
                ay: -30,
              },
            ],
          }}
          config={{ responsive: true, displayModeBar: false }}
          className="w-full"
        />
      </CardSection>

      {/* 5. Bottom two cards side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left - Project Allocation Timeline */}
        <CardSection title="PROJECT ALLOCATION TIMELINE">
          <LazyPlot
            data={projectLines}
            layout={{
              height: 350,
              xaxis: { categoryorder: 'array', categoryarray: MONTHS, tickfont: cfg.axisFont, gridcolor: cfg.gridColor },
              yaxis: { title: { text: 'Hours', font: cfg.axisFont }, tickfont: cfg.axisFont, gridcolor: cfg.gridColor },
              legend: { orientation: 'h', y: -0.25, xanchor: 'center', x: 0.5, font: cfg.legendFont },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              margin: { l: 50, r: 20, t: 10, b: 60 },
              font: cfg.font,
            }}
            config={{ responsive: true, displayModeBar: false }}
            className="w-full"
          />
        </CardSection>

        {/* Right - Budget Composition */}
        <CardSection title="BUDGET COMPOSITION" headerRight={<Link to="/scenarios" className="text-xs text-accent hover:underline">Edit Budget →</Link>}>
          <LazyPlot
            data={[{
              type: 'treemap',
              labels: treemapLabels,
              parents: treemapParents,
              values: treemapValues,
              textinfo: 'label+percent parent',
              branchvalues: 'remainder' as const,
              hovertemplate: '<b>%{label}</b><br>Cost: $%{value:,.0f}<extra></extra>',
              marker: { colorscale: [[0, '#115fa0'], [0.5, '#60A5DC'], [1, '#9C9EA8']] },
            }]}
            layout={{
              height: 350,
              margin: { t: 10, l: 10, r: 10, b: 10 },
              paper_bgcolor: 'transparent',
              font: cfg.font,
            }}
            config={{ responsive: true, displayModeBar: false }}
            className="w-full"
          />
        </CardSection>
      </div>
    </div>
  )
}
