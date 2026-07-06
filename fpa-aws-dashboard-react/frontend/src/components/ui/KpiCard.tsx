import React, { memo } from 'react'
import VarianceChip from './VarianceChip'

interface KpiCardProps {
  label: string
  value: string
  chip?: { text: string; variant: 'positive' | 'negative' | 'neutral' }
  subtitle?: string
  progressColor?: string
}

const KpiCard = memo(function KpiCard({ label, value, chip, subtitle, progressColor }: KpiCardProps) {
  return (
    <div className="relative bg-card border border-border rounded-[6px] p-4 overflow-hidden">
      <p className="label-mono text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="font-serif text-3xl text-foreground">{value}</span>
        {chip && <VarianceChip text={chip.text} variant={chip.variant} />}
      </div>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      )}
      {progressColor && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ backgroundColor: progressColor }}
        />
      )}
    </div>
  )
})

export default KpiCard
