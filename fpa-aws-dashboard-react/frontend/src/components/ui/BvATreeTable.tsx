import { memo, useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api'
import { useThemeValue } from '@/lib/theme-context'
import CardSection from './CardSection'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface BvaNode {
  name: string
  type: 'fbu' | 'project' | 'employee'
  budget: number
  actual: number
  variance: number
  variance_pct: number
  pct_of_total: number
  classification: string
  children?: BvaNode[]
}

interface BvaResponse {
  tree: BvaNode[]
  total_budget: number
}

function fmtCurrency(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function getRowBg(pctOfTotal: number, theme: 'light' | 'dark'): string {
  // Gradient intensity based on proportion of total budget
  const intensity = Math.min(pctOfTotal / 40, 1) // normalize: 40% = max saturation
  if (theme === 'dark') {
    return `rgba(96, 165, 220, ${0.03 + intensity * 0.12})`
  }
  return `rgba(17, 95, 160, ${0.03 + intensity * 0.12})`
}

const BvATreeTable = memo(function BvATreeTable() {
  const theme = useThemeValue()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'Capital Expense' | 'Operating Expense'>('Capital Expense')

  const { data, isLoading } = useQuery<BvaResponse>({
    queryKey: ['bva'],
    queryFn: () => fetchApi('/data/bva'),
    staleTime: 5 * 60 * 1000,
  })

  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Filter tree by classification
  const filteredTree = useMemo(() => {
    if (!data?.tree) return []
    return data.tree.map(fbu => {
      const filteredChildren = (fbu.children || []).filter(
        proj => proj.classification === activeTab
      )
      if (filteredChildren.length === 0) return null
      // Recalculate FBU totals for this classification
      const budget = filteredChildren.reduce((s, p) => s + p.budget, 0)
      const actual = filteredChildren.reduce((s, p) => s + p.actual, 0)
      const prorated = budget * (3 / 12)
      const variance = prorated - actual
      const variance_pct = prorated ? (variance / prorated) * 100 : 0
      const pct_of_total = data.total_budget ? (budget / data.total_budget) * 100 : 0
      return {
        ...fbu,
        budget,
        actual,
        variance,
        variance_pct,
        pct_of_total,
        children: filteredChildren,
      }
    }).filter(Boolean) as BvaNode[]
  }, [data, activeTab])

  if (isLoading || !data) return null

  const renderRow = (node: BvaNode, depth: number, key: string) => {
    const isLeaf = node.type === 'employee'
    const isOpen = expanded.has(key)
    const paddingLeft = depth * 24 + 12
    const bg = getRowBg(node.pct_of_total, theme)
    const varianceColor = node.variance >= 0 ? 'text-positive' : 'text-negative'

    const rows: JSX.Element[] = []

    rows.push(
      <tr
        key={key}
        style={{ backgroundColor: bg }}
        className="border-b border-border/50 hover:opacity-90 transition-opacity"
      >
        <td className="py-2.5 pr-3" style={{ paddingLeft }}>
          <div className="flex items-center gap-2">
            {!isLeaf ? (
              <button
                onClick={() => toggle(key)}
                className="text-muted-foreground hover:text-foreground transition w-4 h-4 flex items-center justify-center"
                aria-label={isOpen ? 'Collapse' : 'Expand'}
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-4 h-4 flex items-center justify-center text-muted-foreground text-xs">•</span>
            )}
            <span className={`text-sm ${depth === 0 ? 'font-semibold' : depth === 1 ? 'font-medium' : ''} text-foreground`}>
              {node.name}
            </span>
          </div>
        </td>
        <td className="py-2.5 px-3 text-right ticker-mono text-foreground">
          {fmtCurrency(node.budget)}
        </td>
        <td className="py-2.5 px-3 text-right ticker-mono text-foreground">
          {fmtCurrency(node.actual)}
        </td>
        <td className={`py-2.5 px-3 text-right ticker-mono ${varianceColor}`}>
          {node.variance >= 0 ? '+' : '-'}{fmtCurrency(Math.abs(node.variance))}
        </td>
        <td className={`py-2.5 px-3 text-right ticker-mono ${varianceColor}`}>
          {node.variance_pct >= 0 ? '+' : ''}{node.variance_pct.toFixed(1)}%
        </td>
        <td className="py-2.5 px-3 text-right">
          <span className="text-xs text-muted-foreground font-mono">
            {node.pct_of_total.toFixed(1)}%
          </span>
        </td>
      </tr>
    )

    if (!isLeaf && isOpen && node.children) {
      node.children.forEach((child, i) => {
        rows.push(...renderRow(child, depth + 1, `${key}/${child.name}-${i}`))
      })
    }

    return rows
  }

  return (
    <CardSection
      title="BUDGET VS ACTUAL — DRILL DOWN"
      subtitle="Expand rows to drill from Business Unit → Project → Employee"
      headerRight={
        <div className="flex items-center gap-1 p-0.5 border border-border rounded-[6px] bg-muted/30">
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition ${
              activeTab === 'Capital Expense'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('Capital Expense')}
          >
            CapEx
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition ${
              activeTab === 'Operating Expense'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('Operating Expense')}
          >
            OpEx
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2.5 px-3 text-left label-mono text-muted-foreground">NAME</th>
              <th className="py-2.5 px-3 text-right label-mono text-muted-foreground">BUDGET (FY)</th>
              <th className="py-2.5 px-3 text-right label-mono text-muted-foreground">ACTUAL (YTD)</th>
              <th className="py-2.5 px-3 text-right label-mono text-muted-foreground">VARIANCE ($)</th>
              <th className="py-2.5 px-3 text-right label-mono text-muted-foreground">VARIANCE (%)</th>
              <th className="py-2.5 px-3 text-right label-mono text-muted-foreground">% OF TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredTree.map((fbu, i) => renderRow(fbu, 0, `fbu-${fbu.name}-${i}`))}
            {filteredTree.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                  No {activeTab.toLowerCase()} data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </CardSection>
  )
})

export default BvATreeTable
