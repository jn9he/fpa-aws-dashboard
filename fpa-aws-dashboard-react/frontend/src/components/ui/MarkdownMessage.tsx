import { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import LazyPlot from '../LazyPlot'

interface MarkdownMessageProps {
  content: string
}

const MarkdownMessage = memo(function MarkdownMessage({ content }: MarkdownMessageProps) {
  // Separate chart blocks from markdown content
  const { markdown, charts } = useMemo(() => {
    const charts: any[] = []
    // Handle ```chart code blocks
    let processed = content.replace(/```chart\n([\s\S]*?)```/g, (_, json) => {
      try {
        const spec = JSON.parse(json)
        charts.push(spec)
        return `\n\n[CHART_${charts.length - 1}]\n\n`
      } catch {
        return '```\n' + json + '\n```'
      }
    })
    // Handle [PLOTLY_CHART]...[/PLOTLY_CHART] markers from the agent
    processed = processed.replace(/\[PLOTLY_CHART\]([\s\S]*?)\[\/PLOTLY_CHART\]/g, (_, json) => {
      try {
        const spec = JSON.parse(json.trim())
        charts.push(spec)
        return `\n\n[CHART_${charts.length - 1}]\n\n`
      } catch {
        return ''
      }
    })
    return { markdown: processed, charts }
  }, [content])

  const components: Components = {
    table: ({ children }) => (
      <div className="my-3 overflow-x-auto border border-border rounded-[6px]">
        <table className="w-full font-mono text-[13px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="border-b border-border bg-muted/30">{children}</thead>,
    th: ({ children }) => <th className="px-3 py-2 text-left label-mono text-muted-foreground">{children}</th>,
    td: ({ children }) => <td className="px-3 py-2 text-sm border-t border-border">{children}</td>,
    tr: ({ children }) => <tr className="even:bg-muted/5">{children}</tr>,
    strong: ({ children }) => <strong className="text-foreground font-semibold bg-accent/10 px-1 rounded">{children}</strong>,
    p: ({ children }) => {
      // Check if this is a chart placeholder
      const text = String(children)
      const chartMatch = text.match(/\[CHART_(\d+)\]/)
      if (chartMatch) {
        const idx = parseInt(chartMatch[1])
        const chart = charts[idx]
        if (chart) {
          return (
            <div className="my-3">
              <LazyPlot
                data={chart.data || []}
                layout={{
                  ...(chart.layout || {}),
                  height: 220,
                  margin: { l: 40, r: 20, t: 30, b: 30 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { family: 'DM Sans, sans-serif', size: 11 },
                }}
                config={{ responsive: true, displayModeBar: false }}
                className="w-full"
              />
            </div>
          )
        }
      }
      return <p className="text-sm text-foreground leading-relaxed mb-2">{children}</p>
    },
    ul: ({ children }) => <ul className="list-disc pl-4 text-sm space-y-1 mb-2">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-4 text-sm space-y-1 mb-2">{children}</ol>,
    li: ({ children }) => <li className="text-foreground">{children}</li>,
    h1: ({ children }) => <h1 className="font-serif text-xl text-foreground mb-2">{children}</h1>,
    h2: ({ children }) => <h2 className="font-serif text-lg text-foreground mb-2">{children}</h2>,
    h3: ({ children }) => <h3 className="font-serif text-base text-foreground mb-1">{children}</h3>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-accent pl-3 my-2 text-sm text-muted-foreground italic">
        {children}
      </blockquote>
    ),
    code: ({ className, children }) => {
      // Inline code (no className means no language was specified)
      if (!className) {
        return <code className="bg-muted/40 px-1.5 py-0.5 rounded text-xs font-mono text-foreground">{children}</code>
      }
      // Code block (has className like "language-js")
      return (
        <pre className="bg-muted/30 p-3 rounded-[6px] text-xs font-mono overflow-x-auto my-2">
          <code>{children}</code>
        </pre>
      )
    },
    pre: ({ children }) => <>{children}</>,
  }

  return (
    <div className="markdown-message">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
})

export default MarkdownMessage
