import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRIORITY_META, PROJECT_STATUS_META } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Priority, ProjectPriority, ProjectStatus, TaskStatus, StatusCategory } from '@/types/database'

const NONE = '__none__'

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export function StatusSelect({
  statuses,
  value,
  onChange,
  placeholder = 'No status',
  className,
  disabled,
  id,
}: {
  statuses: TaskStatus[]
  value: string | null
  onChange: (statusId: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
}) {
  const grouped = new Map<StatusCategory, TaskStatus[]>()
  for (const status of statuses) {
    grouped.set(status.category, [...(grouped.get(status.category) ?? []), status])
  }

  return (
    <Select value={value ?? ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className={className} size="sm" aria-label="Status">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {[...grouped.entries()].map(([category, list]) => (
          <SelectGroup key={category}>
            {list.length > 1 ? (
              <SelectLabel>{category.replace('_', ' ')}</SelectLabel>
            ) : null}
            {list.map((status) => (
              <SelectItem key={status.id} value={status.id}>
                <StatusDot category={status.category} />
                {status.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

export function StatusDot({ category }: { category: StatusCategory }) {
  return (
    <span
      aria-hidden
      className={cn('size-2 shrink-0 rounded-full', STATUS_DOT_CLASS[category])}
    />
  )
}

const STATUS_DOT_CLASS: Record<StatusCategory, string> = {
  backlog: 'bg-muted-foreground/50',
  todo: 'bg-status-todo',
  in_progress: 'bg-status-progress',
  review: 'bg-status-review',
  done: 'bg-status-done',
  cancelled: 'bg-status-cancelled',
}

export function ProjectStatusSelect({
  value,
  onChange,
  className,
  disabled,
  id,
  includeArchived = true,
}: {
  value: ProjectStatus
  onChange: (status: ProjectStatus) => void
  className?: string
  disabled?: boolean
  id?: string
  includeArchived?: boolean
}) {
  const statuses = (Object.keys(PROJECT_STATUS_META) as ProjectStatus[]).filter(
    (status) => includeArchived || status !== 'archived',
  )

  return (
    <Select value={value} onValueChange={(next) => onChange(next as ProjectStatus)} disabled={disabled}>
      <SelectTrigger id={id} className={className} size="sm" aria-label="Project status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {statuses.map((status) => (
          <SelectItem key={status} value={status}>
            {PROJECT_STATUS_META[status].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/* ------------------------------------------------------------------ */
/* Priority                                                            */
/* ------------------------------------------------------------------ */

export function PrioritySelect({
  priorities,
  value,
  onChange,
  className,
  disabled,
  id,
  allowNone = true,
}: {
  priorities: Priority[]
  value: string | null
  onChange: (priorityId: string | null) => void
  className?: string
  disabled?: boolean
  id?: string
  allowNone?: boolean
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} size="sm" aria-label="Priority">
        <SelectValue placeholder="No priority" />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={NONE}>No priority</SelectItem> : null}
        {priorities.map((priority) => (
          <SelectItem key={priority.id} value={priority.id}>
            {priority.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ProjectPrioritySelect({
  value,
  onChange,
  className,
  disabled,
  id,
}: {
  value: ProjectPriority
  onChange: (priority: ProjectPriority) => void
  className?: string
  disabled?: boolean
  id?: string
}) {
  const levels = Object.keys(PRIORITY_META) as ProjectPriority[]

  return (
    <Select value={value} onValueChange={(next) => onChange(next as ProjectPriority)} disabled={disabled}>
      <SelectTrigger id={id} className={className} size="sm" aria-label="Project priority">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {levels.map((level) => (
          <SelectItem key={level} value={level}>
            {PRIORITY_META[level].label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}