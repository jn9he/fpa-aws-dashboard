/**
 * Shared treemap data builder for budget composition visualizations.
 * Produces labels/parents/values arrays compatible with Plotly treemap
 * using branchvalues: 'remainder' (intermediates have value 0).
 */
export function buildTreemapData(
  records: any[],
  costCols: string[]
): { labels: string[]; parents: string[]; values: number[] } {
  const labels: string[] = []
  const parents: string[] = []
  const values: number[] = []

  const fbuTotals: Record<string, number> = {}
  const projTotals: Record<string, number> = {}

  // Build leaf nodes
  for (const r of records) {
    const fbu = r['Funding Business Unit'] || 'Unknown'
    const proj = r['Project Name'] || 'Unknown'
    const emp = r['Employee Name'] || 'Unknown'

    const cost = costCols.reduce((sum, col) => sum + (r[col] || 0), 0)
    if (cost <= 0) continue

    const leaf = `${emp} (${proj})`
    const intermediate = `${proj} - ${fbu}`

    labels.push(leaf)
    parents.push(intermediate)
    values.push(cost)

    fbuTotals[fbu] = (fbuTotals[fbu] || 0) + cost
    projTotals[intermediate] = (projTotals[intermediate] || 0) + cost
  }

  // Add intermediate nodes (project - fbu)
  for (const key of Object.keys(projTotals)) {
    const fbu = key.split(' - ').slice(1).join(' - ') // handle FBU names with dashes
    labels.push(key)
    parents.push(fbu)
    values.push(0)
  }

  // Add root nodes (fbu)
  for (const fbu of Object.keys(fbuTotals)) {
    labels.push(fbu)
    parents.push('')
    values.push(0)
  }

  return { labels, parents, values }
}
