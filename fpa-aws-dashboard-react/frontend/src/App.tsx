import { lazy, Suspense, memo, useEffect } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Navbar from './components/Navbar'
import { prefetchAll } from './lib/prefetch'

const ExecutiveSummary = lazy(() => import('./pages/ExecutiveSummary'))
const ResourceForecasting = lazy(() => import('./pages/ResourceForecasting'))
const AWSForecasting = lazy(() => import('./pages/AWSForecasting'))
const ScenarioPlanner = lazy(() => import('./pages/ScenarioPlanner'))
const AIInsights = lazy(() => import('./pages/AIInsights'))
const AllProjects = lazy(() => import('./pages/AllProjects'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm animate-pulse">
      Loading…
    </div>
  )
}

const Layout = memo(function Layout() {
  const qc = useQueryClient()
  useEffect(() => { prefetchAll(qc) }, [qc])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="max-w-dashboard mx-auto px-8 pt-24 pb-12">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
})

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ExecutiveSummary />} />
        <Route path="/projects" element={<AllProjects />} />
        <Route path="/resources" element={<ResourceForecasting />} />
        <Route path="/aws" element={<AWSForecasting />} />
        <Route path="/scenarios" element={<ScenarioPlanner />} />
        <Route path="/ai" element={<AIInsights />} />
      </Route>
    </Routes>
  )
}
