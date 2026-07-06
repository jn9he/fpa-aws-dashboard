import React, { memo } from 'react'
import clsx from 'clsx'

interface VarianceChipProps {
  text: string
  variant: 'positive' | 'negative' | 'neutral'
}

const variantStyles: Record<VarianceChipProps['variant'], string> = {
  positive: 'bg-emerald-50 text-[#0F5132] dark:bg-emerald-950/30 dark:text-emerald-400',
  negative: 'bg-red-50 text-[#B91C1C] dark:bg-red-950/30 dark:text-red-400',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const VarianceChip = memo(function VarianceChip({ text, variant }: VarianceChipProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium',
        variantStyles[variant]
      )}
    >
      {text}
    </span>
  )
})

export default VarianceChip
