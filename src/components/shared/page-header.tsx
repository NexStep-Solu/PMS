import { ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to?: string
}

/**
 * Also mirrors the trail into the document title so the browser tab and the
 * header always agree about where the user is.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const location = useLocation()
  const trail = items.filter((item) => item.label)

  if (trail.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {trail.map((item, index) => {
          const last = index === trail.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-60" aria-hidden /> : null}
              {item.to && !last ? (
                <Link
                  to={item.to}
                  className="max-w-40 truncate rounded transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={cn('max-w-48 truncate', last && 'font-medium text-foreground')}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <span className="sr-only" aria-live="polite">
        {`Current page: ${location.pathname}`}
      </span>
    </nav>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  className,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  breadcrumbs?: Crumb[]
  className?: string
  children?: ReactNode
}) {
  return (
    <header className={cn('flex flex-col gap-3', className)}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground text-balance">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  )
}

/** Compact section heading used inside dense panels. */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 pb-2', className)}>
      <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
        {children}
      </h2>
      {action}
    </div>
  )
}