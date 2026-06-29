import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'
import Plot from 'react-plotly.js'
import { useTheme } from '@/lib/theme-context'

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

function fmt(n: number) { return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

export default function ResourceForecasting() {
  const { theme } = useTheme()
  const fontColor = theme === 'dark' ? '#fbf9ff' : '#000807'
  const gridColor = theme === 'dark' ? 'rgba(162,163,187,0.2)' : 'rgba(0,8,7,0.08)'

  const [filters, setFilters] = useState({ leader: 'All', type: 'All', location: 'All', fbu: 'All', project: 'All' })

  const { data: roster } = useQuery<RosterResponse>({ queryKey: ['roster'], queryFn: () => fetchApi('/data/roster') })

  const queryParams = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== 'All')).toString()
  const { data: laborResp, isLoading } = useQuery<{ data: Record<string, any>[]; count: number }>({
    queryKey: ['labor', filters],
    queryFn: () => fetchApi(`/data/labor?${queryParams}`),
  })

  if (isLoading || !laborResp) return <div className="text-muted-foreground">Loading...</div>

  const records = laborResp.data
  const costCols = MONTHS.map(m => `${m}_Cost`)

  // Monthly summaries
  const monthlyCosts = MONTHS.map(m => records.reduce((sum, r) => sum + (r[`${m}_Cost`] || 0), 0))
  const actualVals = monthlyCosts.slice(0, 3)
  const forecastVals = monthlyCosts.slice(3)
  const totalCost = monthlyCosts.reduce((a, b) => a + b, 0)
  const avgActual = actualVals.reduce((a, b) => a + b, 0) / 3
  const avgForecast = forecastVals.reduce((a, b) => a + b, 0) / 9

  // Gantt data
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

  // Group Gantt by FBU for color coding + legend
  const fbuList = [...new Set(ganttData.map(g => g.fbu))]
  const fbuColorMap: Record<string, string> = {}
  fbuList.forEach((fbu, i) => { fbuColorMap[fbu] = FBU_COLORS[i % FBU_COLORS.length] })

  const ganttTraces = fbuList.map((fbu, i) => {
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

  // Treemap data — use branchvalues: 'remainder'
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
      treemapValues.push(0) // remainder mode: parent size inferred from children
    })
  })

  Object.keys(fbuTotals).forEach(fbu => {
    treemapLabels.push(fbu)
    treemapParents.push('')
    treemapValues.push(0)
  })

  const setFilter = (key: string, val: string) => setFilters(f => ({ ...f, [key]: val }))
  const activeFilters = Object.entries(filters).filter(([, v]) => v !== 'All')

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4">
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {activeFilters.map(([key, val]) => (
              <span key={key} className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full cursor-pointer" onClick={() => setFilter(key, 'All')}>
                {key}: {val} ✕
              </span>
            ))}
            <button className="text-xs text-muted-foreground underline" onClick={() => setFilters({ leader: 'All', type: 'All', location: 'All', fbu: 'All', project: 'All' })}>Reset All</button>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Select label="Leader" value={filters.leader} options={roster?.leaders || []} onChange={v => setFilter('leader', v)} />
          <Select label="Type" value={filters.type} options={roster?.types || []} onChange={v => setFilter('type', v)} />
          <Select label="Location" value={filters.location} options={roster?.locations || []} onChange={v => setFilter('location', v)} />
          <Select label="Funding BU" value={filters.fbu} options={roster?.fbus || []} onChange={v => setFilter('fbu', v)} />
          <Select label="Project" value={filters.project} options={roster?.projects || []} onChange={v => setFilter('project', v)} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Total Cost" value={fmt(totalCost)} />
        <Kpi label="Avg Historical / Month" value={fmt(avgActual)} />
        <Kpi label="Avg Forecasted / Month" value={fmt(avgForecast)} />
      </div>

      {/* Cost Bar Chart */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">Cost and Usage Graph</h3>
        <p className="text-xs text-muted-foreground mb-2">Jan–Mar: Actuals | Apr–Dec: Forecasted</p>
        <Plot
          data={[
            { x: MONTHS.slice(0, 3), y: actualVals, type: 'bar', name: 'Actuals', marker: { color: '#115fa0' } },
            { x: MONTHS.slice(3), y: forecastVals, type: 'bar', name: 'Forecast', marker: { color: 'rgba(179,183,238,0.4)', line: { color: '#b3b7ee', width: 2 } } },
          ]}
          layout={{
            height: 380,
            xaxis: { categoryorder: 'array', categoryarray: MONTHS, color: fontColor, gridcolor: gridColor },
            yaxis: { title: 'Costs ($)', tickformat: ',', color: fontColor, gridcolor: gridColor },
            barmode: 'group',
            legend: { orientation: 'h', y: -0.2, xanchor: 'center', x: 0.5, font: { color: fontColor } },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { l: 60, r: 20, t: 20, b: 60 },
            font: { color: fontColor },
            shapes: [{ type: 'line', x0: 'Sep', x1: 'Sep', y0: 0, y1: 1, yref: 'paper', line: { dash: 'dash', color: '#dc2626', width: 1 } }],
            annotations: [{ x: 'Sep', y: 1.05, yref: 'paper', text: 'P10/P14 sunset', showarrow: false, font: { size: 10, color: '#dc2626' } }],
          }}
          config={{ responsive: true }}
          className="w-full"
        />
      </div>

      {/* Gantt */}
      {ganttData.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-2">Resource Gantt Chart</h3>
          <div className="flex flex-wrap gap-3 mb-3">
            {fbuList.map(fbu => (
              <div key={fbu} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: fbuColorMap[fbu] }} />
                {fbu}
              </div>
            ))}
          </div>
          <Plot
            data={ganttTraces}
            layout={{
              height: Math.max(400, ganttData.length * 32),
              showlegend: false,
              paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
              margin: { l: 180, r: 20, t: 10, b: 40 },
              xaxis: { type: 'date', color: fontColor, gridcolor: gridColor },
              yaxis: { color: fontColor, automargin: true },
              font: { color: fontColor },
            }}
            config={{ responsive: true }}
            className="w-full"
          />
        </div>
      )}

      {/* Treemap */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">Budget Composition — Treemap</h3>
        <Plot
          data={[{
            type: 'treemap',
            labels: treemapLabels,
            parents: treemapParents,
            values: treemapValues,
            textinfo: 'label+percent parent',
            branchvalues: 'remainder' as const,
            hovertemplate: '<b>%{label}</b><br>Cost: $%{value:,.0f}<extra></extra>',
            marker: { colorscale: [[0, '#115fa0'], [0.5, '#b3b7ee'], [1, '#a2a3bb']] },
          }]}
          layout={{
            height: 500,
            margin: { t: 10, l: 10, r: 10, b: 10 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            font: { color: fontColor },
          }}
          config={{ responsive: true }}
          className="w-full"
        />
      </div>
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground" value={value} onChange={e => onChange(e.target.value)}>
        <option value="All">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  )
}
