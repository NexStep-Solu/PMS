import * as AvatarPrimitive from '@radix-ui/react-avatar'
import type { ComponentProps } from 'react'

import { cn, initials, stringHash } from '@/lib/utils'

const TONES = [
  'bg-primary/12 text-primary',
  'bg-status-progress-bg text-status-progress',
  'bg-status-review-bg text-status-review',
  'bg-status-done-bg text-status-done',
  'bg-priority-high-bg text-priority-high',
  'bg-priority-medium-bg text-priority-medium',
  'bg-primary/12 text-primary',
] as const

function Avatar({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  )
}

interface AvatarFallbackProps extends ComponentProps<typeof AvatarPrimitive.Fallback> {
  name?: string | null
}

function AvatarFallback({ className, name, children, ...props }: AvatarFallbackProps) {
  const tone = TONES[stringHash(name ?? 'pms') % TONES.length] ?? TONES[0]
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full text-[11px] font-semibold',
        tone,
        className,
      )}
      {...props}
    >
      {children ?? initials(name)}
    </AvatarPrimitive.Fallback>
  )
}

export { Avatar, AvatarFallback, AvatarImage }
