import { useState, useMemo, memo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'
import LazyPlot from '../components/LazyPlot'
import { useThemeValue } from '@/lib/theme-context'
import { chartLayout } from '@/lib/chart-config'
import PageHeader from '@/components/ui/PageHeader'
import KpiCard from '@/components/ui/KpiCard'
import CardSection from '@/components/ui/CardSection'
import { Download, Save, Building2, Calendar, Users, Clock, Lightbulb } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buildTreemapData } from '@/lib/treemap-utils'

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const FORECAST_MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const ACTUAL_MONTHS = ["Jan","Feb","Mar"]

function fmt(n: number) { return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

export default function ScenarioPlanner() {
  const [tab, setTab] = useState<'employees' | 'whatif' | 'editor' | 'scenarios'>('employees')

  const tabs = [
    { key: 'employees' as const, label: 'Employee View' },
    { key: 'whatif' as const, label: 'What-If Analysis' },
    { key: 'editor' as const, label: 'Hour Editor' },
    { key: 'scenarios' as const, label: 'Saved Scenarios' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scenario Planner"
        subtitle="Create and validate workforce distribution models. Simulate cost impacts of departmental shifting and hour adjustments in real-time."
      >
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-[6px] text-foreground hover:bg-muted/20 transition mr-3">
          <Download className="w-4 h-4" />
          Export Model
        </button>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-[6px] hover:opacity-90 transition">
          <Save className="w-4 h-4" />
          Commit Scenario
        </button>
      </PageHeader>

      <div className="border-b border-border mb-6">
        <div className="flex">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                tab === t.key
                  ? 'border-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'employees' && <EmployeeTab />}
      {tab === 'whatif' && <WhatIfTab />}
      {tab === 'editor' && <EditorTab />}
      {tab === 'scenarios' && <ScenarioTab />}
    </div>
  )
}


function EmployeeTab() {
  const theme = useThemeValue()
  const cfg = useMemo(() => chartLayout(theme), [theme])

  const [svp, setSvp] = useState('All')
  const [empType, setEmpType] = useState('All')
  const [selectedEmp, setSelectedEmp] = useState('')

  const { data: roster } = useQuery<any>({ queryKey: ['roster'], queryFn: () => fetchApi('/data/roster') })
  const { data: laborResp } = useQuery<any>({ queryKey: ['labor', svp, empType], queryFn: () => fetchApi(`/data/labor?leader=${svp}&type=${empType}`) })

  const records = laborResp?.data || []
  const employees = [...new Set(records.map((r: any) => r["Employee Name"]))].sort() as string[]
  const emp = selectedEmp || employees[0] || ''
  const empData = records.filter((r: any) => r["Employee Name"] === emp)

  const empMetrics = useMemo(() => {
    if (!empData.length) return null
    const rate = empData[0]["Hourly Rate"]
    const type = empData[0]["Type"]
    const costCols = MONTHS.map(m => `${m}_Cost`)
    const monthlyCosts = MONTHS.map(m => empData.reduce((s: number, r: any) => s + (r[`${m}_Cost`] || 0), 0))
    const fyCost = monthlyCosts.reduce((a, b) => a + b, 0)
    const topProjCost = empData.reduce((max: number, r: any) => Math.max(max, costCols.reduce((s, c) => s + (r[c] || 0), 0)), 0)
    const topProjPct = fyCost > 0 ? (topProjCost / fyCost * 100) : 0
    const avgHrs = empData.reduce((s: number, r: any) => s + MONTHS.reduce((ms, m) => ms + (r[m] || 0), 0), 0) / empData.length
    return { rate, type, monthlyCosts, fyCost, topProjPct, avgHrs }
  }, [empData])

  const treemapData = useMemo(() => buildTreemapData(empData, MONTHS.map(m => `${m}_Cost`)), [empData])

  if (!empData.length) return <div className="text-muted-foreground">Select filters to view employees.</div>
  if (!empMetrics) return null

  const { rate, type, monthlyCosts, fyCost, topProjPct, avgHrs } = empMetrics
  const monthlyOpex = fyCost / 12
  const now = new Date()
  const syncTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')} UTC`

  return (
    <div className="space-y-6">
      {/* Filter row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 border border-border rounded-[6px] px-3 py-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <select
            className="text-sm bg-transparent text-foreground outline-none cursor-pointer"
            value={svp}
            onChange={e => setSvp(e.target.value)}
          >
            {['All', ...(roster?.svp_groups || [])].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 border border-border rounded-[6px] px-3 py-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-foreground">FY 2024 (Current)</span>
        </div>
        <div className="flex items-center gap-2 border border-border rounded-[6px] px-3 py-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <select
            className="text-sm bg-transparent text-foreground outline-none cursor-pointer"
            value={empType}
            onChange={e => setEmpType(e.target.value)}
          >
            {['All', ...(roster?.types || [])].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="label-mono text-muted-foreground">Last synced: {syncTime}</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="TOTAL HEADCOUNT"
          value={employees.length.toLocaleString()}
          chip={{ text: '+12%', variant: 'positive' }}
        />
        <KpiCard
          label="MONTHLY OPEX"
          value={fmt(monthlyOpex)}
          chip={{ text: '+4.2%', variant: 'positive' }}
        />
        <KpiCard
          label="AVG RATE / HOUR"
          value={`$${rate}`}
          chip={{ text: '--', variant: 'neutral' }}
        />
        <KpiCard
          label="UTILIZATION"
          value="94.2%"
          chip={{ text: '+1.4%', variant: 'positive' }}
        />
      </div>

      {/* Bottom section: chart + variance */}
      <div className="grid grid-cols-3 gap-4">
        <CardSection
          title="MONTHLY COST PROJECTION"
          className="col-span-2"
          headerRight={
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#00477C' }} />
                Base
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#115FA0' }} />
                Projected
              </span>
            </div>
          }
        >
          <div className="p-4">
            <LazyPlot
              data={[{
                x: MONTHS,
                y: monthlyCosts,
                type: 'bar',
                marker: { color: MONTHS.map(m => ACTUAL_MONTHS.includes(m) ? '#00477C' : '#115FA0') }
              }]}
              layout={{
                height: 320,
                yaxis: { title: { text: 'Cost ($)', font: cfg.axisFont }, tickformat: ',', tickfont: cfg.axisFont, gridcolor: cfg.gridColor },
                xaxis: { tickfont: cfg.axisFont, gridcolor: cfg.gridColor },
                paper_bgcolor: cfg.paperBgColor,
                plot_bgcolor: cfg.plotBgColor,
                margin: { l: 50, r: 10, t: 10, b: 30 },
                font: cfg.font
              }}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full"
            />
          </div>
        </CardSection>

        <CardSection title="VARIANCE SUMMARY">
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Labor Variance</span>
              <span className="text-sm font-mono text-negative">-$12,400</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Resource Drift</span>
              <span className="text-sm font-mono text-positive">+$3,200</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Target Delta</span>
              <span className="text-sm font-mono text-foreground">$0</span>
            </div>
            <div className="mt-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-[6px] p-3 flex gap-2">
              <Lightbulb className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Current trajectory shows a potential budget overrun of $9,200 by Q4. Consider reallocating underutilized resources.
              </p>
            </div>
          </div>
        </CardSection>
      </div>

      {/* Live Budget Treemap */}
      <CardSection
        title="BUDGET COMPOSITION — LIVE PREVIEW"
        headerRight={
          <Link to="/scenarios" className="text-xs text-accent hover:underline">Edit Budget →</Link>
        }
      >
        <div className="p-4">
          <LazyPlot
            data={[{
              type: 'treemap',
              labels: treemapData.labels,
              parents: treemapData.parents,
              values: treemapData.values,
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
        </div>
      </CardSection>
    </div>
  )
}


function WhatIfTab() {
  const { data: roster } = useQuery<any>({ queryKey: ['roster'], queryFn: () => fetchApi('/data/roster') })
  const employees = roster?.employees || []
  const projects = roster?.projects || []
  const [action, setAction] = useState<'transfer' | 'sunset' | 'layoff'>('transfer')

  return (
    <div className="space-y-6">
      <div className="flex gap-6 items-center">
        {(['transfer', 'sunset', 'layoff'] as const).map(a => (
          <label key={a} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="radio" name="whatif" checked={action === a} onChange={() => setAction(a)} className="accent-primary" />
            {a === 'transfer' ? 'Transfer Employee' : a === 'sunset' ? 'Project Sunset' : 'Employee Layoff'}
          </label>
        ))}
      </div>
      {action === 'transfer' && <TransferForm employees={employees} projects={projects} />}
      {action === 'sunset' && <SunsetForm projects={projects} />}
      {action === 'layoff' && <LayoffForm employees={employees} />}
    </div>
  )
}


function TransferForm({ employees, projects }: { employees: string[]; projects: string[] }) {
  const [emp, setEmp] = useState(employees[0] || '')
  const [src, setSrc] = useState(projects[0] || '')
  const [dst, setDst] = useState(projects[1] || '')
  const [months, setMonths] = useState(FORECAST_MONTHS)
  const [mode, setMode] = useState<'full' | 'partial'>('full')
  const [hours, setHours] = useState(20)
  const [result, setResult] = useState<any>(null)

  const mutation = useMutation({
    mutationFn: () => fetchApi('/scenarios/what-if/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee: emp, source_project: src, dest_project: dst, months, mode, hours }) }),
    onSuccess: setResult,
  })

  return (
    <div className="bg-card border border-border rounded-[6px] p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Sel label="Employee" value={emp} options={employees} onChange={setEmp} />
        <Sel label="Source Project" value={src} options={projects} onChange={setSrc} />
        <Sel label="Destination Project" value={dst} options={projects.filter(p => p !== src)} onChange={setDst} />
        <Sel label="Mode" value={mode} options={['full', 'partial']} onChange={v => setMode(v as any)} />
      </div>
      {mode === 'partial' && (
        <div>
          <label className="text-xs font-mono text-muted-foreground">Hours/month</label>
          <input type="number" className="w-32 px-2 py-1 border border-border rounded-[6px] text-sm bg-card text-foreground mt-1" value={hours} onChange={e => setHours(+e.target.value)} />
        </div>
      )}
      <button onClick={() => mutation.mutate()} className="bg-primary text-primary-foreground rounded-[6px] px-4 py-2 text-sm font-medium hover:opacity-90 transition">
        Run Analysis
      </button>
      {result && <WhatIfResult data={result} />}
      {result && (
        <div className="mt-4">
          <p className="text-xs font-mono text-muted-foreground mb-2">Budget Impact Preview</p>
          <LazyPlot
            data={[{
              type: 'treemap',
              labels: [emp, result.source_project || 'Source', result.dest_project || 'Dest'],
              parents: ['', emp, emp],
              values: [0, Math.abs(result.cost_impact || 0), Math.abs(result.cost_impact || 0)],
              textinfo: 'label+value',
              branchvalues: 'remainder' as const,
              hovertemplate: '<b>%{label}</b><br>Cost: $%{value:,.0f}<extra></extra>',
              marker: { colorscale: [[0, '#115fa0'], [0.5, '#60A5DC'], [1, '#9C9EA8']] },
            }]}
            layout={{
              height: 250,
              margin: { t: 10, l: 10, r: 10, b: 10 },
              paper_bgcolor: 'transparent',
            }}
            config={{ responsive: true, displayModeBar: false }}
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}


function SunsetForm({ projects }: { projects: string[] }) {
  const [proj, setProj] = useState(projects[0] || '')
  const [month, setMonth] = useState(FORECAST_MONTHS[0])
  const [result, setResult] = useState<any>(null)
  const mutation = useMutation({
    mutationFn: () => fetchApi('/scenarios/what-if/sunset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project: proj, last_active_month: month }) }),
    onSuccess: setResult,
  })
  return (
    <div className="bg-card border border-border rounded-[6px] p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Sel label="Project" value={proj} options={projects} onChange={setProj} />
        <Sel label="Last Active Month" value={month} options={FORECAST_MONTHS} onChange={setMonth} />
      </div>
      <button onClick={() => mutation.mutate()} className="bg-primary text-primary-foreground rounded-[6px] px-4 py-2 text-sm font-medium hover:opacity-90 transition">
        Run Analysis
      </button>
      {result && (
        <div className="border-t border-border pt-4 mt-4">
          <p className="text-sm font-medium text-foreground mb-3">
            Affected: <span className="font-mono">{result.affected_employees?.length || 0}</span> employees — Total hours freed: <span className="font-mono">{result.total_hours_freed?.toFixed(0)}</span>
          </p>
          <table className="w-full font-mono text-[13px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Employee</th>
                <th className="py-2 pr-3">Hours Freed</th>
                <th className="py-2 pr-3">Cost Freed</th>
                <th className="py-2">Redistributed To</th>
              </tr>
            </thead>
            <tbody>
              {(result.affected_employees || []).map((r: any, i: number) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2 pr-3">{r.employee}</td>
                  <td className="py-2 pr-3">{r.hours_freed?.toFixed(0)}</td>
                  <td className="py-2 pr-3">{fmt(r.cost_freed)}</td>
                  <td className="py-2">{r.redistributed_to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


function LayoffForm({ employees }: { employees: string[] }) {
  const [emp, setEmp] = useState(employees[0] || '')
  const [month, setMonth] = useState(FORECAST_MONTHS[0])
  const [mode, setMode] = useState<'savings' | 'redistribute'>('savings')
  const [result, setResult] = useState<any>(null)
  const mutation = useMutation({
    mutationFn: () => fetchApi('/scenarios/what-if/layoff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee: emp, effective_month: month, mode }) }),
    onSuccess: setResult,
  })
  return (
    <div className="bg-card border border-border rounded-[6px] p-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Sel label="Employee" value={emp} options={employees} onChange={setEmp} />
        <Sel label="Effective Month" value={month} options={FORECAST_MONTHS} onChange={setMonth} />
        <Sel label="View" value={mode} options={['savings', 'redistribute']} onChange={v => setMode(v as any)} />
      </div>
      <button onClick={() => mutation.mutate()} className="bg-primary text-primary-foreground rounded-[6px] px-4 py-2 text-sm font-medium hover:opacity-90 transition">
        Run Analysis
      </button>
      {result && (
        <div className="border-t border-border pt-4 mt-4">
          {result.monthly ? (
            <>
              <p className="font-medium mb-3 text-foreground">Total Savings: <span className="font-serif">{fmt(result.total_saved)}</span></p>
              <table className="w-full font-mono text-[13px]">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Month</th>
                    <th className="py-2 pr-3">Hours Saved</th>
                    <th className="py-2">Cost Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {result.monthly.map((r: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="py-2 pr-3">{r.month}</td>
                      <td className="py-2 pr-3">{r.hours_saved?.toFixed(0)}</td>
                      <td className="py-2">{fmt(r.cost_saved)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <table className="w-full font-mono text-[13px]">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Project</th>
                  <th className="py-2 pr-3">Hours</th>
                  <th className="py-2 pr-3">Receiving</th>
                  <th className="py-2 pr-3">Hrs/Mo</th>
                  <th className="py-2">Risk</th>
                </tr>
              </thead>
              <tbody>
                {(result.redistribution || []).map((r: any, i: number) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-2 pr-3">{r.project}</td>
                    <td className="py-2 pr-3">{r.hours?.toFixed(0)}</td>
                    <td className="py-2 pr-3">{r.receiving}</td>
                    <td className="py-2 pr-3">{r.hrs_per_month?.toFixed(1)}</td>
                    <td className={`py-2 ${r.risk === 'Over 160' ? 'text-negative' : ''}`}>{r.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}


function EditorTab() {
  const theme = useThemeValue()
  const cfg = useMemo(() => chartLayout(theme), [theme])

  const [selectedEmp, setSelectedEmp] = useState('')
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({})
  const { data: roster } = useQuery<any>({ queryKey: ['roster'], queryFn: () => fetchApi('/data/roster') })
  const { data: laborResp } = useQuery<any>({ queryKey: ['labor'], queryFn: () => fetchApi('/data/labor') })

  const records = laborResp?.data || []
  const employees = roster?.employees || []
  const emp = selectedEmp || employees[0] || ''
  const empData = records.filter((r: any) => r["Employee Name"] === emp)
  const rate = empData[0]?.["Hourly Rate"] || 0

  const getVal = (proj: string, month: string) => overrides[proj]?.[month] ?? empData.find((r: any) => r["Project Name"] === proj)?.[month] ?? 0
  const setVal = (proj: string, month: string, val: number) => setOverrides(prev => ({ ...prev, [proj]: { ...prev[proj], [month]: val } }))

  const monthTotals = FORECAST_MONTHS.map(m => empData.reduce((s: number, r: any) => s + getVal(r["Project Name"], m), 0))
  const projects = empData.map((r: any) => r["Project Name"])

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Sel label="Employee" value={emp} options={employees} onChange={setSelectedEmp} />
      </div>
      <p className="text-sm text-muted-foreground font-mono">{emp} — ${rate}/hr</p>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="bg-muted/30 text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Project</th>
              {FORECAST_MONTHS.map(m => <th key={m} className="px-2 py-2 font-medium text-center">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {projects.map((proj: string, i: number) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2 text-sm text-foreground font-sans">{proj}</td>
                {FORECAST_MONTHS.map(m => (
                  <td key={m} className="px-1 py-1 text-center">
                    <input
                      type="number"
                      className="border border-border rounded-[6px] px-2 py-1 text-xs w-14 bg-card text-foreground text-center"
                      value={getVal(proj, m).toFixed(1)}
                      onChange={e => setVal(proj, m, +e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground font-bold">
              <td className="px-3 py-2 text-foreground font-sans">Total</td>
              {monthTotals.map((t, i) => (
                <td key={i} className={`px-2 py-2 text-center ${Math.abs(t - 160) > 0.01 ? 'text-negative' : 'text-positive'}`}>
                  {t.toFixed(1)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {monthTotals.some(t => Math.abs(t - 160) > 0.01) && (
        <p className="text-sm text-negative flex items-center gap-2">
          <span>⚠</span> Hour constraint violated — months must sum to 160.
        </p>
      )}
      <CardSection title="COST IMPACT">
        <div className="p-4">
          <p className="text-sm font-medium text-foreground">
            Projected Period Cost: <span className="font-serif text-lg">{fmt(monthTotals.reduce((s, t) => s + t, 0) * rate)}</span>
          </p>
        </div>
      </CardSection>
    </div>
  )
}


function ScenarioTab() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const { data: scenarios } = useQuery<any[]>({ queryKey: ['scenarios'], queryFn: () => fetchApi('/scenarios') })

  const createMut = useMutation({
    mutationFn: () => fetchApi('/scenarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: desc, overrides: {}, project_targets: {} }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['scenarios'] }); setName(''); setDesc('') },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => fetchApi(`/scenarios/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scenarios'] }),
  })

  return (
    <div className="space-y-6">
      <CardSection title="SAVE NEW SCENARIO">
        <div className="p-4 space-y-3">
          <input
            className="w-full px-3 py-2 border border-border rounded-[6px] text-sm bg-card text-foreground placeholder:text-muted-foreground"
            placeholder="Scenario name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            className="w-full px-3 py-2 border border-border rounded-[6px] text-sm bg-card text-foreground placeholder:text-muted-foreground"
            placeholder="Description"
            value={desc}
            onChange={e => setDesc(e.target.value)}
          />
          <button
            onClick={() => createMut.mutate()}
            disabled={!name}
            className="bg-primary text-primary-foreground rounded-[6px] px-4 py-2 text-sm font-medium disabled:opacity-50 hover:opacity-90 transition"
          >
            Save Scenario
          </button>
        </div>
      </CardSection>

      {scenarios && scenarios.length > 0 && (
        <CardSection title="SAVED SCENARIOS">
          <div className="p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium">Created</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map(s => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-3 pr-3 font-medium text-foreground">{s.name}</td>
                    <td className="py-3 pr-3 text-muted-foreground">{s.description}</td>
                    <td className="py-3 pr-3 text-xs font-mono text-muted-foreground">{s.created_at?.slice(0, 10)}</td>
                    <td className="py-3">
                      <button onClick={() => deleteMut.mutate(s.id)} className="text-negative text-xs font-medium hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardSection>
      )}
    </div>
  )
}


const WhatIfResult = memo(function WhatIfResult({ data }: { data: any }) {
  return (
    <div className="border-t border-border pt-4 mt-4 space-y-3">
      <p className="text-sm font-medium text-foreground">
        Total Hours Transferred: <span className="font-mono">{data.total_hours_moved?.toFixed(0)}</span> — Cost Impact: <span className="font-serif">{fmt(data.cost_impact)}</span>
      </p>
      {data.violations?.length > 0 && (
        <p className="text-sm text-negative flex items-center gap-2">
          <span>⚠</span> Source hours go negative in: {data.violations.join(', ')}
        </p>
      )}
      <table className="w-full font-mono text-[13px]">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-border">
            <th className="py-2 pr-3">Month</th>
            <th className="py-2 pr-3">Src Before</th>
            <th className="py-2 pr-3">Src After</th>
            <th className="py-2 pr-3">Dst Before</th>
            <th className="py-2 pr-3">Dst After</th>
            <th className="py-2">Moved</th>
          </tr>
        </thead>
        <tbody>
          {data.results?.map((r: any, i: number) => (
            <tr key={i} className="border-t border-border">
              <td className="py-2 pr-3">{r.month}</td>
              <td className="py-2 pr-3">{r.source_before?.toFixed(1)}</td>
              <td className="py-2 pr-3">{r.source_after?.toFixed(1)}</td>
              <td className="py-2 pr-3">{r.dest_before?.toFixed(1)}</td>
              <td className="py-2 pr-3">{r.dest_after?.toFixed(1)}</td>
              <td className="py-2">{r.hrs_moved?.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})

const Sel = memo(function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-mono text-muted-foreground">{label}</label>
      <select
        className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-[6px] text-foreground"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
})
