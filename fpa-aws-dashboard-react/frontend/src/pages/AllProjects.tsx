import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchApi } from '../lib/api'
import PageHeader from '@/components/ui/PageHeader'
import CardSection from '@/components/ui/CardSection'
import { ArrowLeft, Search, ArrowUpDown } from 'lucide-react'

interface ProjectItem {
  'Project Number': string
  'Project Name': string
  Owner: string
  Forecast: number
  'Actual YTD': number
  Delta: number
}

interface ProjectsResponse {
  top5: ProjectItem[]
  all: ProjectItem[]
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

type SortKey = 'Project Name' | 'Owner' | 'Forecast' | 'Actual YTD' | 'Delta'

export default function AllProjects() {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('Forecast')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const { data, isLoading, isError } = useQuery<ProjectsResponse>({
    queryKey: ['projects'],
    queryFn: () => fetchApi('/data/projects'),
  })

  const allProjects = data?.all ?? []

  const filteredAndSorted = useMemo(() => {
    const query = searchQuery.toLowerCase()
    const filtered = allProjects.filter(
      (p) =>
        p['Project Name'].toLowerCase().includes(query) ||
        p.Owner.toLowerCase().includes(query)
    )

    filtered.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal)
        return sortDir === 'asc' ? cmp : -cmp
      }

      const cmp = (aVal as number) - (bVal as number)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return filtered
  }, [allProjects, searchQuery, sortKey, sortDir])

  const totals = useMemo(() => {
    return filteredAndSorted.reduce(
      (acc, p) => ({
        Forecast: acc.Forecast + p.Forecast,
        'Actual YTD': acc['Actual YTD'] + p['Actual YTD'],
        Delta: acc.Delta + p.Delta,
      }),
      { Forecast: 0, 'Actual YTD': 0, Delta: 0 }
    )
  }, [filteredAndSorted])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const columns: { label: string; key: SortKey; align: 'left' | 'right' }[] = [
    { label: 'PROJECT NAME', key: 'Project Name', align: 'left' },
    { label: 'OWNER', key: 'Owner', align: 'left' },
    { label: 'FORECAST', key: 'Forecast', align: 'right' },
    { label: 'ACTUAL YTD', key: 'Actual YTD', align: 'right' },
    { label: 'DELTA', key: 'Delta', align: 'right' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Projects"
        subtitle="Complete project cost breakdown with year-to-date actuals and variance."
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft size={16} />
          Back to Summary
        </Link>
      </PageHeader>

      <CardSection>
        <div className="space-y-4">
          {/* Search Input */}
          <div className="relative w-full max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Search by project name or owner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-border rounded-[6px] px-4 py-2 pl-9 w-full max-w-sm bg-transparent text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-muted-foreground text-sm py-8 text-center">
              Loading projects...
            </div>
          ) : isError ? (
            <div className="text-destructive text-sm py-8 text-center">
              Failed to load projects.
            </div>
          ) : (
            <>
              <div className="bg-card border border-border rounded-[6px] overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className={`px-4 py-3 label-mono text-muted-foreground cursor-pointer hover:text-foreground transition text-${col.align}`}
                        >
                          <span
                            className={`inline-flex items-center gap-1 ${
                              col.align === 'right' ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {col.label}
                            <ArrowUpDown size={10} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.map((project, idx) => (
                      <tr
                        key={project['Project Number']}
                        className={`border-b border-border last:border-0 ${
                          idx % 2 === 1 ? 'bg-[#F9FAFB] dark:bg-muted/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-[13px] text-foreground text-left">
                          {project['Project Name']}
                        </td>
                        <td className="px-4 py-3 font-mono text-[13px] text-foreground text-left">
                          {project.Owner}
                        </td>
                        <td className="px-4 py-3 font-mono text-[13px] text-foreground text-right">
                          {fmt(project.Forecast)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[13px] text-foreground text-right">
                          {fmt(project['Actual YTD'])}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono text-[13px] text-right ${
                            project.Delta >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {fmt(project.Delta)}
                        </td>
                      </tr>
                    ))}
                    {/* Summary Row */}
                    <tr className="border-t border-border font-bold">
                      <td className="px-4 py-3 font-mono text-[13px] text-foreground text-left">
                        Total
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] text-foreground text-left" />
                      <td className="px-4 py-3 font-mono text-[13px] text-foreground text-right">
                        {fmt(totals.Forecast)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[13px] text-foreground text-right">
                        {fmt(totals['Actual YTD'])}
                      </td>
                      <td
                        className={`px-4 py-3 font-mono text-[13px] text-right ${
                          totals.Delta >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {fmt(totals.Delta)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Count Indicator */}
              <p className="text-sm text-muted-foreground">
                Showing {filteredAndSorted.length} of {allProjects.length} projects
              </p>
            </>
          )}
        </div>
      </CardSection>
    </div>
  )
}
