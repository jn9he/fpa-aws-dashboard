import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react'
import MarkdownMessage from '@/components/ui/MarkdownMessage'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'
import {
  Bell,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  DollarSign,
  Building2,
  PieChart,
  FileText,
  Users,
  Sparkles,
  Clock,
  Settings,
  Send,
  Paperclip,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'

interface Alert {
  severity: string
  category: string
  title: string
  message: string
}

const PRESETS = [
  { label: "Recommended Changes & Forecasts", prompt: "Based on the 2026 budget data, what are the top 3-5 changes leadership should approve? For each, state the recommended action, rationale, and forecasted financial impact." },
  { label: "Capital vs. OpEx Breakdown", prompt: "Break down total 2026 labor spend by Accounting Classification (Capital Expense vs. Operating Expense) and show the monthly trend." },
  { label: "Staffing & Capacity Risks", prompt: "Identify the top staffing and capacity risks for the remainder of 2026. Include employees near PTO caps and teams with uneven utilization." },
  { label: "AWS Cost Forecast", prompt: "Summarize the AWS spend trajectory for 2026. Are we on track to stay under the $2.1M cap? Which accounts are driving growth?" },
  { label: "Project Investment Mix", prompt: "Rank all active projects by total 2026 cost and show the investment mix across Funding Business Units." },
  { label: "Year-End Budget Summary", prompt: "Provide a year-end budget summary for 2026. Show projected total spend vs. plan for both labor and AWS." },
]

const INQUIRY_CARDS = [
  { icon: TrendingUp, title: 'Revenue Forecast', subtitle: 'Q4 Projections' },
  { icon: DollarSign, title: 'Burn Rate', subtitle: 'Monthly average' },
  { icon: Building2, title: 'Cash Position', subtitle: 'Liquid assets' },
  { icon: PieChart, title: 'Cost Analysis', subtitle: 'By department' },
  { icon: FileText, title: 'Var. Report', subtitle: 'Actual vs Budget' },
  { icon: Users, title: 'Headcount', subtitle: 'Growth trends' },
]

function formatTime(): string {
  const now = new Date()
  let hours = now.getHours()
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

// --- Alert Priority Group ---
const AlertGroup = memo(function AlertGroup({
  label,
  dotColor,
  alerts,
  borderColor,
  bgColor,
  titleColor,
  isExpanded,
  onToggle,
}: {
  label: string
  dotColor: string
  alerts: Alert[]
  borderColor: string
  bgColor: string
  titleColor: string
  isExpanded: boolean
  onToggle: () => void
}) {
  if (alerts.length === 0) return null
  return (
    <div className="px-4 py-2">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="flex items-center gap-2 font-medium text-sm">
          <span className={dotColor}>●</span>
          {label}
          <span className="text-xs text-muted-foreground">({alerts.length})</span>
        </span>
        {isExpanded ? (
          <ChevronUp size={14} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground" />
        )}
      </button>
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`border-l-4 ${borderColor} ${bgColor} p-3 rounded-r-[6px]`}
            >
              <p className={`text-sm font-medium ${titleColor}`}>{alert.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
              <span className="text-[10px] font-mono text-muted-foreground uppercase mt-1 inline-block">
                {alert.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

// --- Chat Message ---
const ChatMessage = memo(function ChatMessage({ message }: { message: { role: string; content: string } }) {
  const timestamp = useMemo(() => formatTime(), [])

  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <div className="flex gap-3 items-start justify-end">
          <div className="bg-primary text-primary-foreground rounded-[6px] rounded-tr-none px-4 py-3 text-sm max-w-[80%] whitespace-pre-wrap">
            {message.content}
          </div>
          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <Users size={12} />
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1 mr-10">
          CHIEF FINANCIAL OFFICER • {timestamp}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start">
      <div className="flex gap-3 items-start">
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <Sparkles size={12} className="text-white" />
        </div>
        <div className="border-l-2 border-border pl-3">
          <MarkdownMessage content={message.content} />
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              AI ASSISTANT • {timestamp}
            </span>
            <button className="text-muted-foreground hover:text-foreground transition">
              <ThumbsUp size={12} />
            </button>
            <button className="text-muted-foreground hover:text-foreground transition">
              <ThumbsDown size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default function AIInsights() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedPriority, setExpandedPriority] = useState<string | null>('critical')
  const chatRef = useRef<HTMLDivElement>(null)

  const { data: insightsResp } = useQuery<{ insights: Alert[] }>({
    queryKey: ['insights'],
    queryFn: () => fetchApi('/ai/insights'),
  })

  const alerts = insightsResp?.insights || []

  const alertsByPriority = useMemo(() => ({
    critical: alerts.filter(a => a.severity === 'critical'),
    warning: alerts.filter(a => a.severity === 'warning'),
    info: alerts.filter(a => a.severity === 'info'),
  }), [alerts])

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight)
  }, [messages])

  const sendMessage = useCallback(async (msg: string) => {
    const newMessages = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const resp: any = await fetchApi('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: newMessages.slice(-6) }),
      })
      setMessages([...newMessages, { role: 'assistant', content: resp.response }])
    } catch (e: any) {
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ Error: ${e.message}` }])
    }
    setLoading(false)
  }, [messages])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim()) {
      sendMessage(input.trim())
      setInput('')
    }
  }, [input, sendMessage])

  const togglePriority = useCallback((priority: string) => {
    setExpandedPriority(prev => prev === priority ? null : priority)
  }, [])

  return (
    <div>
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-accent italic">AI Insights &amp; Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Intelligent financial monitoring and conversational reporting.
        </p>
      </div>

      {/* Two Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT PANEL */}
        <div className="col-span-1">
          {/* Critical Alerts Card */}
          <div className="bg-card border border-border rounded-[6px]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-foreground" />
                <span className="font-medium text-foreground">Critical Alerts</span>
              </div>
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                {alertsByPriority.critical.length} NEW
              </span>
            </div>

            {/* Priority Groups */}
            <div className="py-2 divide-y divide-border">
              <AlertGroup
                label="High Priority"
                dotColor="text-red-500"
                alerts={alertsByPriority.critical}
                borderColor="border-l-red-500"
                bgColor="bg-red-50/50 dark:bg-red-950/20"
                titleColor="text-red-700 dark:text-red-400"
                isExpanded={expandedPriority === 'critical'}
                onToggle={() => togglePriority('critical')}
              />
              <AlertGroup
                label="Medium Priority"
                dotColor="text-amber-500"
                alerts={alertsByPriority.warning}
                borderColor="border-l-amber-500"
                bgColor="bg-amber-50/50 dark:bg-amber-950/20"
                titleColor="text-amber-700 dark:text-amber-400"
                isExpanded={expandedPriority === 'warning'}
                onToggle={() => togglePriority('warning')}
              />
              <AlertGroup
                label="Information"
                dotColor="text-blue-500"
                alerts={alertsByPriority.info}
                borderColor="border-l-blue-500"
                bgColor="bg-blue-50/50 dark:bg-blue-950/20"
                titleColor="text-blue-700 dark:text-blue-400"
                isExpanded={expandedPriority === 'info'}
                onToggle={() => togglePriority('info')}
              />
            </div>
          </div>

          {/* Suggested Inquiries */}
          <div className="mt-6">
            <h2 className="font-serif text-xl text-foreground">Suggested Inquiries</h2>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {INQUIRY_CARDS.map((card, i) => {
                const Icon = card.icon
                return (
                  <button
                    key={i}
                    onClick={() => sendMessage(PRESETS[i].prompt)}
                    disabled={loading}
                    className="text-left bg-card border border-border rounded-[6px] p-3 cursor-pointer hover:border-accent/50 transition disabled:opacity-50"
                  >
                    <Icon size={16} className="text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-foreground">{card.title}</p>
                    <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-card border border-border rounded-[6px] flex flex-col h-[700px]">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-border flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-medium text-foreground">FP&amp;A Analyst AI</p>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-green-600 dark:text-green-400 flex items-center gap-1">
                    <span className="text-green-500">●</span> ACTIVE
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-muted-foreground hover:text-foreground transition p-1">
                  <Clock size={16} />
                </button>
                <button className="text-muted-foreground hover:text-foreground transition p-1">
                  <Settings size={16} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Start a conversation...</p>
                </div>
              )}
              {messages.map((m, i) => (
                <ChatMessage key={i} message={m} />
              ))}
              {loading && (
                <div className="flex flex-col items-start">
                  <div className="flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Sparkles size={12} className="text-white" />
                    </div>
                    <div className="border-l-2 border-border pl-3">
                      <p className="text-sm text-muted-foreground animate-pulse">Analyzing...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-border p-3">
              <form onSubmit={handleSubmit}>
                <div className="flex items-center gap-2 border border-border rounded-[6px] px-3 py-2">
                  <input
                    className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                    placeholder="Ask a question about your financial data..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition"
                  >
                    <Paperclip size={16} />
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-50 transition"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </form>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-muted-foreground">
                  ✓ Connected to ERP: NetSuite Oracle
                </span>
                <div className="flex gap-3">
                  <button type="button" className="label-mono text-muted-foreground hover:text-foreground transition">
                    SUMMARIZE DOCUMENT
                  </button>
                  <button type="button" className="label-mono text-muted-foreground hover:text-foreground transition">
                    GENERATE CHART
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
