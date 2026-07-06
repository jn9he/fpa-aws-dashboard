import React, { memo } from 'react'
import clsx from 'clsx'

interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  render?: (row: T, index: number) => React.ReactNode
}

interface DataTableProps<T> {
  title?: string
  headerRight?: React.ReactNode
  columns: Column<T>[]
  data: T[]
}

function DataTableInner<T>({ title, headerRight, columns, data }: DataTableProps<T>) {
  return (
    <div className="bg-card border border-border rounded-[6px] overflow-hidden">
      {title && (
        <div className="px-4 py-3 flex justify-between items-center border-b border-border">
          <span className="label-mono text-muted-foreground">{title}</span>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <table className="w-full font-mono text-[13px]">
        <thead className="border-b border-border">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'px-4 py-2 label-mono text-muted-foreground',
                  col.align === 'right' ? 'text-right' : 'text-left'
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={clsx(
                'border-b border-border last:border-0',
                rowIndex % 2 === 1 && 'bg-[#F9FAFB] dark:bg-muted/10'
              )}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx(
                    'px-4 py-3 text-foreground',
                    col.align === 'right' && 'text-right'
                  )}
                >
                  {col.render
                    ? col.render(row, rowIndex)
                    : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const DataTable = memo(DataTableInner) as typeof DataTableInner

export default DataTable
