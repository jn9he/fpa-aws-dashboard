import React, { memo } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

const PageHeader = memo(function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="font-serif text-4xl text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center">{children}</div>
      )}
    </div>
  )
})

export default PageHeader
