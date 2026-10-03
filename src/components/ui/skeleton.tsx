import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('relative overflow-hidden rounded-md bg-muted', className)}
      {...props}
    >
      <span className="absolute inset-0 animate-pms-shimmer-sweep bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent motion-reduce:hidden" />
    </div>
  )
}

export { Skeleton }
