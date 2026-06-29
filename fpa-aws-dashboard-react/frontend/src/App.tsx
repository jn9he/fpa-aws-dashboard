import { useEffect } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Navbar from './components/Navbar'
import { prefetchAll } from './lib/prefetch'
import ExecutiveSummary from './pages/ExecutiveSummary'
import ResourceForecasting from './pages/ResourceForecasting'
import AWSForecasting from './pages/AWSForecasting'
import ScenarioPlanner from './pages/ScenarioPlanner'
import AIInsights from './pages/AIInsights'

function Layout() {
  const qc = useQueryClient()
  useEffect(() => { prefetchAll(qc) }, [qc])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-8">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ExecutiveSummary />} />
        <Route path="/resources" element={<ResourceForecasting />} />
        <Route path="/aws" element={<AWSForecasting />} />
        <Route path="/scenarios" element={<ScenarioPlanner />} />
        <Route path="/ai" element={<AIInsights />} />
      </Route>
    </Routes>
  )
}
