import {
  Check,
  CircleDashed,
  Eye,
  Loader2,
  OctagonX,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PRIORITY_META, STATUS_META } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Priority, ProjectPriority, ProjectStatus, StatusCategory, TaskStatus } from '@/types/database'
import { PROJECT_PRIORITY_META, PROJECT_STATUS_META } from '@/lib/constants'

const STATUS_ICON: Record<StatusCategory, LucideIcon> = {
  backlog: CircleDashed,
  todo: CircleDashed,
  in_progress: Loader2,
  review: Eye,
  done: Check,
  cancelled: OctagonX,
}

/**
 * Status always renders as icon + text so the meaning never depends on colour.
 */
export function StatusBadge({
  status,
  size = 'default',
  className,
}: {
  status: TaskStatus | { name: string; category: StatusCategory } | undefined | null
  size?: 'sm' | 'default'
  className?: string
}) {
  if (!status) return <Badge variant="muted">No status</Badge>
  const meta = STATUS_META[status.category]
  const Icon = STATUS_ICON[status.category]

  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent font-medium',
        meta.classes,
        size === 'sm' && 'px-1.5 py-0 text-[11px]',
        className,
      )}
    >
      <Icon className={cn(status.category === 'in_progress' && 'animate-spin')} aria-hidden />
      {status.name}
    </Badge>
  )
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status]
  const Icon = STATUS_ICON[status === 'planned' ? 'todo' : status === 'active' ? 'in_progress' : status === 'completed' ? 'done' : status === 'archived' ? 'cancelled' : 'review']
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', meta.classes)}>
      <Icon className={cn(status === 'active' && 'animate-spin')} aria-hidden />
      {meta.label}
    </Badge>
  )
}

/** Four ascending bars — the shape carries the level, not just the hue. */
function PriorityIcon({ level, className }: { level: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      aria-hidden
      className={cn('size-3', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M1 8.5h1.6" opacity={level >= 1 ? 1 : 0.25} />
      <path d="M4.2 8.5V5.5" opacity={level >= 2 ? 1 : 0.25} />
      <path d="M7.4 8.5V2.5" opacity={level >= 3 ? 1 : 0.25} />
    </svg>
  )
}

export function PriorityBadge({
  priority,
  level,
  size = 'default',
  className,
}: {
  priority?: Priority | null
  /** 1 = highest. Used when only the numeric level is available. */
  level?: number
  size?: 'sm' | 'default'
  className?: string
}) {
  const key = priority ? priority.key : priorityKeyByLevel(level)
  if (key === 'none') return null

  const meta = PRIORITY_META[keyToProjectPriority(key)]
  const label = priority ? priority.name : meta.label

  return (
    <Badge
      variant="outline"
      className={cn(
        'border-transparent font-medium',
        meta.classes,
        size === 'sm' && 'px-1.5 py-0 text-[11px]',
        className,
      )}
    >
      <PriorityIcon level={meta.bars} />
      {label}
    </Badge>
  )
}

export function ProjectPriorityBadge({ priority }: { priority: ProjectPriority }) {
  const meta = PROJECT_PRIORITY_META[priority]
  return (
    <Badge variant="outline" className={cn('border-transparent font-medium', meta.classes)}>
      <PriorityIcon level={meta.bars} />
      {meta.label}
    </Badge>
  )
}

function priorityKeyByLevel(level: number | undefined): string {
  if (level === undefined || level === null) return 'none'
  if (level <= 1) return 'urgent'
  if (level <= 2) return 'high'
  if (level <= 3) return 'medium'
  return 'low'
}

export function keyToProjectPriority(key: string): ProjectPriority {
  switch (key) {
    case 'urgent':
    case 'critical':
    case 'highest':
      return 'urgent'
    case 'high':
      return 'high'
    case 'low':
    case 'lowest':
      return 'low'
    default:
      return 'medium'
  }
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export function LabelBadge({
  label,
  className,
}: {
  label: { name: string; color: string }
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex max-w-32 items-center gap-1.5 truncate rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
            className,
          )}
          style={{
            // Tinted surface + readable text keeps light and dark legible.
            backgroundColor: `color-mix(in oklab, ${label.color} 14%, transparent)`,
            borderColor: `color-mix(in oklab, ${label.color} 32%, transparent)`,
            color: `color-mix(in oklab, ${label.color} 72%, var(--foreground))`,
          }}
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: label.color }}
            aria-hidden
          />
          <span className="truncate">{label.name}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label.name}</TooltipContent>
    </Tooltip>
  )
}

export function LabelPill({ label }: { label: { name: string; color: string } }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-2 rounded-full" style={{ backgroundColor: label.color }} aria-hidden />
      {label.name}
    </span>
  )
}