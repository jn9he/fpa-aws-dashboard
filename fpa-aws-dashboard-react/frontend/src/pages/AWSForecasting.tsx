import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'
import Plot from 'react-plotly.js'
import { useTheme } from '@/lib/theme-context'

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const AWS_GROWTH_ACCOUNTS = ["AWS00008","AWS00011","AWS00027"]

interface AWSResponse {
  data: Record<string, any>[]
  validation: { "Total AWS Forecast": number; "AWS Cap": number; "Variance to Cap": number; "Over Cap": boolean }
  monthly: { month: string; cost: number }[]
  aws_cap: number
  growth_accounts: string[]
}

function fmt(n: number) { return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` }

export default function AWSForecasting() {
  const { theme } = useTheme()
  const fontColor = theme === 'dark' ? '#fbf9ff' : '#000807'
  const gridColor = theme === 'dark' ? 'rgba(162,163,187,0.2)' : 'rgba(0,8,7,0.08)'

  const [svp, setSvp] = useState('All')
  const [selEmps, setSelEmps] = useState<string[]>([])

  const { data: roster } = useQuery<{ svp_groups: string[]; employees: string[] }>({ queryKey: ['roster'], queryFn: () => fetchApi('/data/roster') })

  const params = new URLSearchParams()
  if (svp !== 'All') params.set('svp', svp)
  if (selEmps.length) params.set('employees', selEmps.join(','))

  const { data: awsResp, isLoading } = useQuery<AWSResponse>({ queryKey: ['aws', svp, selEmps], queryFn: () => fetchApi(`/data/aws?${params.toString()}`) })

  if (isLoading || !awsResp) return <div className="text-muted-foreground">Loading...</div>

  const { validation, monthly, aws_cap, data: records } = awsResp
  const cumulative = monthly.reduce<number[]>((acc, m) => [...acc, (acc.length ? acc[acc.length - 1] : 0) + m.cost], [])

  const acctTotals: Record<string, { account: string; employee: string; total: number }> = {}
  records.forEach(r => {
    const key = `${r["Account Number"]}|${r["Employee Name"]}`
    if (!acctTotals[key]) acctTotals[key] = { account: r["Account Number"], employee: r["Employee Name"], total: 0 }
    acctTotals[key].total += r["Full Year Forecast"] || 0
  })
  const top5 = Object.values(acctTotals).sort((a, b) => b.total - a.total).slice(0, 5)
  const totalAll = Object.values(acctTotals).reduce((s, a) => s + a.total, 0)

  const acctMonthly: Record<string, number[]> = {}
  records.forEach(r => {
    const acct = r["Account Number"]
    if (!acctMonthly[acct]) acctMonthly[acct] = Array(12).fill(0)
    MONTHS.forEach((m, i) => { acctMonthly[acct][i] += r[m] || 0 })
  })

  const empPool = svp === 'All' ? (roster?.employees || []) : records.map(r => r["Employee Name"]).filter((v, i, a) => a.indexOf(v) === i).sort()

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground">SVP Group</label>
          <select className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground" value={svp} onChange={e => { setSvp(e.target.value); setSelEmps([]) }}>
            <option value="All">All</option>
            {(roster?.svp_groups || []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Employees</label>
          <select multiple className="w-full mt-1 px-2 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground h-20" value={selEmps} onChange={e => setSelEmps(Array.from(e.target.selectedOptions, o => o.value))}>
            {empPool.map(emp => <option key={emp} value={emp}>{emp}</option>)}
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">AWS Full Year Forecast</p>
          <p className="text-2xl font-bold text-foreground">{fmt(validation["Total AWS Forecast"])}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Annual Cap</p>
          <p className="text-2xl font-bold text-foreground">{fmt(aws_cap)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Variance to Cap</p>
          <p className="text-2xl font-bold text-foreground">{fmt(validation["Variance to Cap"])}</p>
          <p className={`text-sm font-medium ${validation["Over Cap"] ? 'text-red-500' : 'text-emerald-500'}`}>{validation["Over Cap"] ? 'OVER' : 'Under'}</p>
        </div>
      </div>

      {/* Cumulative Chart */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">Cumulative AWS Spend vs Cap</h3>
        <Plot
          data={[{ x: MONTHS, y: cumulative, mode: 'lines+markers', fill: 'tozeroy', line: { color: '#115fa0', width: 2 }, fillcolor: 'rgba(17,95,160,0.15)', name: 'Cumulative Spend' }]}
          layout={{
            height: 380,
            xaxis: { categoryorder: 'array', categoryarray: MONTHS, color: fontColor, gridcolor: gridColor },
            yaxis: { title: 'Cumulative Cost ($)', tickformat: ',', color: fontColor, gridcolor: gridColor },
            shapes: [{ type: 'line', x0: 0, x1: 1, xref: 'paper', y0: aws_cap, y1: aws_cap, line: { dash: 'dash', color: '#dc2626' } }],
            annotations: [{ x: 0.02, xref: 'paper', y: aws_cap, text: `Cap: ${fmt(aws_cap)}`, showarrow: false, yshift: 10, font: { color: '#dc2626' } }],
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            margin: { l: 60, r: 20, t: 20, b: 40 }, font: { color: fontColor },
          }}
          config={{ responsive: true }}
          className="w-full"
        />
      </div>

      {/* Top 5 */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Top 5 Cost-Driving Accounts</h3>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr><th className="text-left px-4 py-2">Account</th><th className="text-left px-4 py-2">Employee</th><th className="text-right px-4 py-2">Forecast</th><th className="text-right px-4 py-2">% of Total</th></tr>
            </thead>
            <tbody>
              {top5.map((a, i) => (
                <tr key={i} className="border-t border-border"><td className="px-4 py-2">{a.account}</td><td className="px-4 py-2">{a.employee}</td><td className="px-4 py-2 text-right">{fmt(a.total)}</td><td className="px-4 py-2 text-right">{totalAll > 0 ? ((a.total / totalAll) * 100).toFixed(1) : 0}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-2">Account Monthly Trends</h3>
          <Plot
            data={Object.entries(acctMonthly).map(([acct, vals]) => ({ x: MONTHS, y: vals, type: 'scatter' as const, mode: 'lines' as const, name: acct, line: { dash: AWS_GROWTH_ACCOUNTS.includes(acct) ? 'solid' : 'dot' } }))}
            layout={{ height: 300, legend: { font: { size: 8, color: fontColor } }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 40, r: 10, t: 10, b: 40 }, font: { color: fontColor }, xaxis: { color: fontColor, gridcolor: gridColor }, yaxis: { color: fontColor, gridcolor: gridColor } }}
            config={{ responsive: true }}
            className="w-full"
          />
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-lg font-semibold text-foreground mb-2">Monthly Cost by Account (Stacked)</h3>
          <Plot
            data={Object.entries(acctMonthly).map(([acct, vals]) => ({ x: MONTHS, y: vals, type: 'bar' as const, name: acct }))}
            layout={{ height: 300, barmode: 'stack', legend: { font: { size: 8, color: fontColor } }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', margin: { l: 40, r: 10, t: 10, b: 40 }, font: { color: fontColor }, xaxis: { color: fontColor, gridcolor: gridColor }, yaxis: { color: fontColor, gridcolor: gridColor } }}
            config={{ responsive: true }}
            className="w-full"
          />
        </div>
      </div>

      {/* Assumptions */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">Forecast Assumptions</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li><strong>Growth accounts</strong> ({AWS_GROWTH_ACCOUNTS.join(', ')}): 5% month-over-month from March.</li>
          <li><strong>All other accounts</strong>: Jan–Mar weighted average applied to Apr–Dec.</li>
          <li>Annual cap monitored at <strong>{fmt(aws_cap)}</strong>.</li>
        </ul>
      </div>
    </div>
  )
}
