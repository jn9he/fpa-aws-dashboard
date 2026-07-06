import React, { memo } from 'react'
import clsx from 'clsx'

interface CardSectionProps {
  title?: string
  subtitle?: string
  headerRight?: React.ReactNode
  children: React.ReactNode
  className?: string
}

const CardSection = memo(function CardSection({
  title,
  subtitle,
  headerRight,
  children,
  className,
}: CardSectionProps) {
  return (
    <div className={clsx('bg-card border border-border rounded-[6px]', className)}>
      {title && (
        <div className="px-4 py-3 border-b border-border flex justify-between items-center">
          <div>
            <span className="label-mono text-foreground">{title}</span>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  )
})

export default CardSection
