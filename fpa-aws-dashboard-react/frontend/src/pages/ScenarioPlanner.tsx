import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'
import Plot from 'react-plotly.js'
import { useTheme } from '@/lib/theme-context'

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const FORECAST_MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const ACTUAL_MONTHS = ["Jan","Feb","Mar"]

function fmt(n: number) { return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

export default function ScenarioPlanner() {
  const [tab, setTab] = useState<'employees' | 'whatif' | 'editor' | 'scenarios'>('employees')

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border pb-2">
        {(['employees', 'whatif', 'editor', 'scenarios'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-t text-sm font-medium transition-all ${tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'}`}>
            {t === 'employees' ? 'Employee View' : t === 'whatif' ? 'What-If Analysis' : t === 'editor' ? 'Hour Editor' : 'Scenarios'}
          </button>
        ))}
      </div>
      {tab === 'employees' && <EmployeeTab />}
      {tab === 'whatif' && <WhatIfTab />}
      {tab === 'editor' && <EditorTab />}
      {tab === 'scenarios' && <ScenarioTab />}
    </div>
  )
}

function EmployeeTab() {
  const { theme } = useTheme()
  const fontColor = theme === 'dark' ? '#fbf9ff' : '#000807'

  const [svp, setSvp] = useState('All')
  const [empType, setEmpType] = useState('All')
  const [selectedEmp, setSelectedEmp] = useState('')

  const { data: roster } = useQuery<any>({ queryKey: ['roster'], queryFn: () => fetchApi('/data/roster') })
  const { data: laborResp } = useQuery<any>({ queryKey: ['labor', svp, empType], queryFn: () => fetchApi(`/data/labor?leader=${svp}&type=${empType}`) })

  const records = laborResp?.data || []
  const employees = [...new Set(records.map((r: any) => r["Employee Name"]))].sort() as string[]
  const emp = selectedEmp || employees[0] || ''
  const empData = records.filter((r: any) => r["Employee Name"] === emp)

  if (!empData.length) return <div className="text-muted-foreground">Select filters to view employees.</div>

  const rate = empData[0]["Hourly Rate"]
  const type = empData[0]["Type"]
  const costCols = MONTHS.map(m => `${m}_Cost`)
  const monthlyCosts = MONTHS.map(m => empData.reduce((s: number, r: any) => s + (r[`${m}_Cost`] || 0), 0))
  const fyCost = monthlyCosts.reduce((a, b) => a + b, 0)
  const topProjCost = empData.reduce((max: number, r: any) => Math.max(max, costCols.reduce((s, c) => s + (r[c] || 0), 0)), 0)
  const topProjPct = fyCost > 0 ? (topProjCost / fyCost * 100) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Sel label="SVP Group" value={svp} options={['All', ...(roster?.svp_groups || [])]} onChange={setSvp} />
        <Sel label="Employee Type" value={empType} options={['All', ...(roster?.types || [])]} onChange={setEmpType} />
        <Sel label="Employee" value={emp} options={employees} onChange={setSelectedEmp} />
      </div>
      <p className="text-sm text-muted-foreground"><strong className="text-foreground">{emp}</strong> — {type} — ${rate}/hr</p>
      <div className="grid grid-cols-4 gap-3">
        <Kpi label="Full Year Cost" value={fmt(fyCost)} />
        <Kpi label="Avg Hrs/Project" value={`${(empData.reduce((s: number, r: any) => s + MONTHS.reduce((ms, m) => ms + (r[m] || 0), 0), 0) / empData.length).toFixed(0)}`} />
        <Kpi label="Hourly Rate" value={`$${rate}/hr`} />
        <Kpi label="Top Project %" value={`${topProjPct.toFixed(0)}%`} />
      </div>
      <div className="bg-card border border-border rounded-lg p-4">
        <Plot
          data={[{ x: MONTHS, y: monthlyCosts, type: 'bar', marker: { color: MONTHS.map(m => ACTUAL_MONTHS.includes(m) ? '#a2a3bb' : '#115fa0') } }]}
          layout={{ height: 280, yaxis: { title: 'Cost ($)', tickformat: ',', color: fontColor }, xaxis: { color: fontColor }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 50, r: 10, t: 10, b: 30 }, font: { color: fontColor } }}
          config={{ responsive: true }}
          className="w-full"
        />
      </div>
    </div>
  )
}

function WhatIfTab() {
  const [action, setAction] = useState<'transfer' | 'sunset' | 'layoff'>('transfer')
  const { data: roster } = useQuery<any>({ queryKey: ['roster'], queryFn: () => fetchApi('/data/roster') })
  const employees = roster?.employees || []
  const projects = roster?.projects || []

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Sel label="Employee" value={emp} options={employees} onChange={setEmp} />
        <Sel label="Source Project" value={src} options={projects} onChange={setSrc} />
        <Sel label="Destination Project" value={dst} options={projects.filter(p => p !== src)} onChange={setDst} />
        <Sel label="Mode" value={mode} options={['full', 'partial']} onChange={v => setMode(v as any)} />
      </div>
      {mode === 'partial' && <div><label className="text-xs text-muted-foreground">Hours/month</label><input type="number" className="w-32 px-2 py-1 border border-border rounded-lg text-sm bg-background text-foreground" value={hours} onChange={e => setHours(+e.target.value)} /></div>}
      <button onClick={() => mutation.mutate()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Run Analysis</button>
      {result && <WhatIfResult data={result} />}
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Sel label="Project" value={proj} options={projects} onChange={setProj} />
        <Sel label="Last Active Month" value={month} options={FORECAST_MONTHS} onChange={setMonth} />
      </div>
      <button onClick={() => mutation.mutate()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Run Analysis</button>
      {result && (
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-medium text-foreground mb-2">Affected: {result.affected_employees?.length || 0} employees — Total hours freed: {result.total_hours_freed?.toFixed(0)}</p>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Employee</th><th>Hours Freed</th><th>Cost Freed</th><th>Redistributed To</th></tr></thead>
            <tbody>{(result.affected_employees || []).map((r: any, i: number) => (
              <tr key={i} className="border-t border-border"><td className="py-1">{r.employee}</td><td>{r.hours_freed?.toFixed(0)}</td><td>{fmt(r.cost_freed)}</td><td>{r.redistributed_to}</td></tr>
            ))}</tbody>
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
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Sel label="Employee" value={emp} options={employees} onChange={setEmp} />
        <Sel label="Effective Month" value={month} options={FORECAST_MONTHS} onChange={setMonth} />
        <Sel label="View" value={mode} options={['savings', 'redistribute']} onChange={v => setMode(v as any)} />
      </div>
      <button onClick={() => mutation.mutate()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">Run Analysis</button>
      {result && (
        <div className="bg-card border border-border rounded-lg p-4 text-sm">
          {result.monthly ? (
            <><p className="font-medium mb-2 text-foreground">Total Savings: {fmt(result.total_saved)}</p>
            <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Month</th><th>Hours Saved</th><th>Cost Saved</th></tr></thead>
              <tbody>{result.monthly.map((r: any, i: number) => <tr key={i} className="border-t border-border"><td className="py-1">{r.month}</td><td>{r.hours_saved?.toFixed(0)}</td><td>{fmt(r.cost_saved)}</td></tr>)}</tbody>
            </table></>
          ) : (
            <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Project</th><th>Hours</th><th>Receiving</th><th>Hrs/Mo</th><th>Risk</th></tr></thead>
              <tbody>{(result.redistribution || []).map((r: any, i: number) => <tr key={i} className="border-t border-border"><td className="py-1">{r.project}</td><td>{r.hours?.toFixed(0)}</td><td>{r.receiving}</td><td>{r.hrs_per_month?.toFixed(1)}</td><td className={r.risk === 'Over 160' ? 'text-red-500' : ''}>{r.risk}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function EditorTab() {
  const { theme } = useTheme()
  const fontColor = theme === 'dark' ? '#fbf9ff' : '#000807'

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
      <Sel label="Employee" value={emp} options={employees} onChange={setSelectedEmp} />
      <p className="text-sm text-muted-foreground">{emp} — ${rate}/hr</p>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead><tr className="bg-primary text-primary-foreground"><th className="px-2 py-1 text-left">Project</th>{FORECAST_MONTHS.map(m => <th key={m} className="px-2 py-1">{m}</th>)}</tr></thead>
          <tbody>
            {projects.map((proj: string, i: number) => (
              <tr key={i} className="border-t border-border">
                <td className="px-2 py-1 text-sm text-foreground">{proj}</td>
                {FORECAST_MONTHS.map(m => (
                  <td key={m} className="px-1 py-1"><input type="number" className="w-14 px-1 py-0.5 border border-border rounded-lg text-xs bg-background text-foreground" value={getVal(proj, m).toFixed(1)} onChange={e => setVal(proj, m, +e.target.value)} /></td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground font-bold">
              <td className="px-2 py-1 text-foreground">Total</td>
              {monthTotals.map((t, i) => <td key={i} className={`px-2 py-1 ${Math.abs(t - 160) > 0.01 ? 'text-red-500' : 'text-emerald-500'}`}>{t.toFixed(1)}</td>)}
            </tr>
          </tfoot>
        </table>
      </div>
      {monthTotals.some(t => Math.abs(t - 160) > 0.01) && <p className="text-sm text-red-500 font-medium">⚠ Hour constraint violated — months must sum to 160.</p>}
      <div className="bg-card border border-border rounded-lg p-3">
        <p className="text-sm font-medium text-foreground">Cost Impact: {fmt(monthTotals.reduce((s, t) => s + t, 0) * rate)}</p>
      </div>
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
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h4 className="font-medium text-foreground">Save New Scenario</h4>
        <input className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" placeholder="Scenario name" value={name} onChange={e => setName(e.target.value)} />
        <input className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
        <button onClick={() => createMut.mutate()} disabled={!name} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">Save Scenario</button>
      </div>
      {scenarios && scenarios.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-2">Saved Scenarios</h4>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Name</th><th>Description</th><th>Created</th><th></th></tr></thead>
            <tbody>{scenarios.map(s => (
              <tr key={s.id} className="border-t border-border">
                <td className="py-2 font-medium text-foreground">{s.name}</td>
                <td className="text-muted-foreground">{s.description}</td>
                <td className="text-xs text-muted-foreground">{s.created_at?.slice(0, 10)}</td>
                <td><button onClick={() => deleteMut.mutate(s.id)} className="text-red-500 text-xs">Delete</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function WhatIfResult({ data }: { data: any }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <p className="text-sm font-medium text-foreground">Total Hours Transferred: {data.total_hours_moved?.toFixed(0)} — Cost Impact: {fmt(data.cost_impact)}</p>
      {data.violations?.length > 0 && <p className="text-sm text-red-500">⚠ Source hours go negative in: {data.violations.join(', ')}</p>}
      <table className="w-full text-xs">
        <thead><tr className="text-left text-muted-foreground"><th>Month</th><th>Src Before</th><th>Src After</th><th>Dst Before</th><th>Dst After</th><th>Moved</th></tr></thead>
        <tbody>{data.results?.map((r: any, i: number) => (
          <tr key={i} className="border-t border-border"><td className="py-1">{r.month}</td><td>{r.source_before?.toFixed(1)}</td><td>{r.source_after?.toFixed(1)}</td><td>{r.dest_before?.toFixed(1)}</td><td>{r.dest_after?.toFixed(1)}</td><td>{r.hrs_moved?.toFixed(1)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="bg-card border border-border rounded-lg p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold text-foreground">{value}</p></div>
}

function Sel({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return <div><label className="text-xs font-medium text-muted-foreground">{label}</label><select className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground" value={value} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
}
