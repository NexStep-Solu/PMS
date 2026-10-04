import { useMemo, useState } from 'react'
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'

import { MonthGrid, toDateKey } from '@/components/shared/date-picker'
import { StatusBadge } from '@/components/shared/badges'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/features/organizations/workspace-context'

import type { TaskWithMeta } from '../utils'
import { useTaskDialog } from '../task-dialog-context'
import type { TaskStatus } from '@/types/database'

type View = 'month' | 'week' | 'day'

/**
 * Calendar view. Month / week / day over task due dates, with milestones
 * pinned to the header of the month they fall in.
 */
export function TaskCalendarView({
  tasks,
  statuses,
  milestones,
  projectId,
}: {
  tasks: TaskWithMeta[]
  statuses: TaskStatus[]
  milestones: { id: string; name: string; due_date: string; status: string }[]
  /** Keeps "New task" scoped to the project being viewed. */
  projectId?: string
}) {
  const { organizationName, can } = useWorkspace()
  const { openTask, openCreate } = useTaskDialog()
  const [view, setView] = useState<View>('month')
  const [anchor, setAnchor] = useState(() => new Date())

  const statusById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses],
  )

  const byDay = useMemo(() => {
    const map = new Map<string, TaskWithMeta[]>()
    for (const task of tasks) {
      if (!task.due_date) continue
      const list = map.get(task.due_date)
      if (list) list.push(task)
      else map.set(task.due_date, [task])
    }
    for (const list of map.values()) list.sort((a, b) => a.title.localeCompare(b.title))
    return map
  }, [tasks])

  const step = (direction: -1 | 1) => {
    setAnchor((current) => {
      const days = view === 'day' ? 1 : view === 'week' ? 7 : 30
      return addDays(current, days * direction)
    })
  }

  const title =
    view === 'month'
      ? format(anchor, 'MMMM yyyy')
      : view === 'week'
        ? `${format(startOfWeek(anchor, { weekStartsOn: 1 }), 'd MMM')} – ${format(endOfWeek(anchor, { weekStartsOn: 1 }), 'd MMM yyyy')}`
        : format(anchor, 'd MMMM yyyy')

  const renderDay = (_day: Date, key: string) => {
    const items = byDay.get(key) ?? []
    if (items.length === 0) return null
    const limit = view === 'day' ? items.length : 3

    return (
      <ul className="space-y-1">
        {items.slice(0, limit).map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => openTask(task.id)}
              className={cn(
                'flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] transition-colors hover:bg-accent',
                task.status.is_completed && 'text-muted-foreground line-through',
              )}
              title={`${task.title} · ${task.status.name}`}
            >
              <span
                aria-hidden
                className={cn('size-1.5 shrink-0 rounded-full', dotClass(task, statusById))}
              />
              <span className="truncate">{task.title}</span>
            </button>
          </li>
        ))}
        {items.length > limit ? (
          <li className="px-1 text-[11px] text-muted-foreground">+{items.length - limit} more</li>
        ) : null}
      </ul>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(value) => value && setView(value as View)}
          variant="outline"
          size="sm"
          aria-label="Calendar view"
        >
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="day">Day</ToggleGroupItem>
        </ToggleGroup>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous period" onClick={() => step(-1)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-40 text-center text-sm font-medium">{title}</span>
          <Button variant="outline" size="icon-sm" aria-label="Next period" onClick={() => step(1)}>
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchor(new Date())}>
            Today
          </Button>
          <Button size="sm" onClick={() => openCreate({ projectId })}>
            <Plus aria-hidden />
            New task
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing due dates for {organizationName ?? 'this workspace'}. {tasks.length} scheduled tasks.
      </p>

      {view === 'month' ? (
        <div className="rounded-xl border">
          <MonthGrid month={anchor} renderDay={renderDay} />
        </div>
      ) : (
        <AgendaView
          anchor={anchor}
          days={view === 'week' ? 7 : 1}
          byDay={byDay}
          canCreate={can('tasks.create')}
          onOpenTask={openTask}
          onCreate={() => openCreate({ projectId })}
          statusById={statusById}
        />
      )}

      <MilestoneStrip milestones={milestones} anchor={anchor} />
    </div>
  )
}

function dotClass(
  task: TaskWithMeta,
  statusById: Map<string, TaskStatus>,
): string {
  const category = statusById.get(task.status_id)?.category ?? task.status.category
  switch (category) {
    case 'done':
      return 'bg-status-done'
    case 'in_progress':
      return 'bg-status-progress'
    case 'review':
      return 'bg-status-review'
    case 'cancelled':
      return 'bg-status-cancelled'
    default:
      return 'bg-status-todo'
  }
}

function AgendaView({
  anchor,
  days,
  byDay,
  canCreate,
  onOpenTask,
  onCreate,
  statusById,
}: {
  anchor: Date
  days: number
  byDay: Map<string, TaskWithMeta[]>
  canCreate: boolean
  onOpenTask: (taskId: string) => void
  onCreate: () => void
  statusById: Map<string, TaskStatus>
}) {
  const start = days === 1 ? anchor : startOfWeek(anchor, { weekStartsOn: 1 })
  const range = eachDayOfInterval({
    start,
    end: days === 1 ? anchor : addDays(start, 6),
  })

  return (
    <ul className="divide-y rounded-xl border">
      {range.map((day) => {
        const key = toDateKey(day)
        const items = byDay.get(key) ?? []
        return (
          <li key={key} className="flex gap-4 px-4 py-3">
            <div className="w-16 shrink-0">
              <p className={cn('text-sm font-medium', isToday(day) && 'text-primary')}>
                {format(day, 'EEE')}
              </p>
              <p className="text-xs text-muted-foreground tabular">{format(day, 'd MMM')}</p>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing scheduled</p>
              ) : (
                items.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpenTask(task.id)}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', dotClass(task, statusById))} />
                    <span className={cn('truncate', task.status.is_completed && 'text-muted-foreground line-through')}>
                      {task.title}
                    </span>
                    <StatusBadge status={task.status} size="sm" className="ml-auto" />
                  </button>
                ))
              )}
              {canCreate ? (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCreate}>
                  <Plus aria-hidden />
                  Add task
                </Button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function MilestoneStrip({
  milestones,
  anchor,
}: {
  milestones: { id: string; name: string; due_date: string; status: string }[]
  anchor: Date
}) {
  const range = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
    return { start, end }
  }, [anchor])

  const visible = milestones.filter((milestone) => {
    const date = new Date(milestone.due_date)
    return date >= range.start && date <= range.end
  })

  if (visible.length === 0) return null

  return (
    <section className="rounded-xl border p-3">
      <h3 className="mb-2 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
        Milestones this month
      </h3>
      <ul className="flex flex-wrap gap-2">
        {visible.map((milestone) => (
          <li key={milestone.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
                    milestone.status === 'completed' && 'text-muted-foreground line-through',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-1.5 rounded-full',
                      milestone.status === 'completed' ? 'bg-status-done' : 'bg-status-progress',
                    )}
                  />
                  {milestone.name}
                  <span className="text-muted-foreground tabular">{format(new Date(milestone.due_date), 'd MMM')}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {isSameDay(new Date(milestone.due_date), new Date()) ? 'Due today' : milestone.status}
              </TooltipContent>
            </Tooltip>
          </li>
        ))}
      </ul>
    </section>
  )
}
