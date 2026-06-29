import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '../lib/api'

interface Alert {
  severity: string
  category: string
  title: string
  message: string
}

const PRESETS = [
  { label: "🔄 Recommended Changes & Forecasts", prompt: "Based on the 2026 budget data, what are the top 3-5 changes leadership should approve? For each, state the recommended action, rationale, and forecasted financial impact." },
  { label: "💰 Capital vs. OpEx Breakdown", prompt: "Break down total 2026 labor spend by Accounting Classification (Capital Expense vs. Operating Expense) and show the monthly trend." },
  { label: "👥 Staffing & Capacity Risks", prompt: "Identify the top staffing and capacity risks for the remainder of 2026. Include employees near PTO caps and teams with uneven utilization." },
  { label: "☁️ AWS Cost Forecast", prompt: "Summarize the AWS spend trajectory for 2026. Are we on track to stay under the $2.1M cap? Which accounts are driving growth?" },
  { label: "📈 Project Investment Mix", prompt: "Rank all active projects by total 2026 cost and show the investment mix across Funding Business Units." },
  { label: "📊 Year-End Budget Summary", prompt: "Provide a year-end budget summary for 2026. Show projected total spend vs. plan for both labor and AWS." },
]

const SEVERITY_CONFIG: Record<string, { badge: string; border: string }> = {
  critical: { badge: 'bg-red-500/20 text-red-400', border: 'border-l-red-500' },
  warning: { badge: 'bg-amber-500/20 text-amber-400', border: 'border-l-amber-500' },
  info: { badge: 'bg-blue-500/20 text-blue-400', border: 'border-l-blue-500' },
}

export default function AIInsights() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [alertFilter, setAlertFilter] = useState('All')
  const [alertsOpen, setAlertsOpen] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const { data: insightsResp } = useQuery<{ insights: Alert[] }>({ queryKey: ['insights'], queryFn: () => fetchApi('/ai/insights') })

  const alerts = insightsResp?.insights || []
  const filteredAlerts = alertFilter === 'All' ? alerts : alerts.filter(a => a.severity === alertFilter)
  const counts = { critical: alerts.filter(a => a.severity === 'critical').length, warning: alerts.filter(a => a.severity === 'warning').length, info: alerts.filter(a => a.severity === 'info').length }

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight) }, [messages])

  const sendMessage = async (msg: string) => {
    const newMessages = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const resp: any = await fetchApi('/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, history: newMessages.slice(-6) }) })
      setMessages([...newMessages, { role: 'assistant', content: resp.response }])
    } catch (e: any) {
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ Error: ${e.message}` }])
    }
    setLoading(false)
  }

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (input.trim()) { sendMessage(input.trim()); setInput('') } }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      <div className="bg-card border border-border rounded-lg">
        <button onClick={() => setAlertsOpen(!alertsOpen)} className="w-full px-4 py-3 text-left font-medium text-foreground flex justify-between items-center">
          <span>Alerts: 🔴 {counts.critical} High · ⚠️ {counts.warning} Med · ℹ️ {counts.info} Low</span>
          <span className="text-muted-foreground">{alertsOpen ? '▼' : '▶'}</span>
        </button>
        {alertsOpen && (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex gap-3">
              {['All', 'critical', 'warning', 'info'].map(f => (
                <label key={f} className="flex items-center gap-1 text-xs text-foreground cursor-pointer">
                  <input type="radio" name="alertFilter" checked={alertFilter === f} onChange={() => setAlertFilter(f)} className="accent-primary" />
                  {f === 'All' ? 'All' : f === 'critical' ? 'High' : f === 'warning' ? 'Medium' : 'Low'}
                </label>
              ))}
            </div>
            {filteredAlerts.map((a, i) => {
              const cfg = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.info
              return (
                <div key={i} className={`border-l-4 ${cfg.border} bg-card p-3 rounded-r`}>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase mr-2 ${cfg.badge}`}>
                    {a.severity === 'critical' ? 'High' : a.severity === 'warning' ? 'Med' : 'Low'}
                  </span>
                  <strong className="text-sm text-foreground">{a.title}</strong>
                  <span className="text-xs text-muted-foreground ml-2">({a.category})</span>
                  <p className="text-sm text-muted-foreground mt-1">{a.message}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Preset Prompts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PRESETS.map((p, i) => (
          <button key={i} onClick={() => sendMessage(p.prompt)} disabled={loading}
            className="text-left bg-card border border-border rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:border-primary transition disabled:opacity-50">
            {p.label}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div ref={chatRef} className="h-[500px] overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && <p className="text-center text-muted-foreground pt-20">💬 Ask a question using the presets above or type below.</p>}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/20 border border-border text-foreground'}`}>
                <pre className="whitespace-pre-wrap font-sans">{m.content}</pre>
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="bg-muted/20 border border-border rounded-lg px-4 py-2 text-sm text-muted-foreground animate-pulse">Analyzing...</div></div>}
        </div>
        <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2">
          <input className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground" placeholder="Ask a question about your data..." value={input} onChange={e => setInput(e.target.value)} disabled={loading} />
          <button type="submit" disabled={loading || !input.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">Send</button>
        </form>
      </div>
    </div>
  )
}
