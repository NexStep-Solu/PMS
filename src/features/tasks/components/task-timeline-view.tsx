import { useMemo, useState } from 'react'
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { PriorityBadge, StatusBadge } from '@/components/shared/badges'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { parseDay } from '../utils'
import type { TaskWithMeta } from '../utils'
import type { TaskStatus } from '@/types/database'

/**
 * Deliberately simple timeline: rows are tasks, the horizontal axis is a month
 * grid, and each bar spans `start_date → due_date`. Dependency arrows are out
 * of scope for the first release — see PMS_START.md §10.
 */
export function TaskTimelineView({ tasks, statuses }: { tasks: TaskWithMeta[]; statuses: TaskStatus[] }) {
  const [anchor, setAnchor] = useState(() => new Date())

  const statusById = useMemo(() => new Map(statuses.map((status) => [status.id, status])), [statuses])

  const { days, range } = useMemo(() => {
    const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
    const end = endOfWeek(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0), { weekStartsOn: 1 })
    const interval = eachDayOfInterval({ start, end })
    return { days: interval, range: { start, end } }
  }, [anchor])

  const totalDays = days.length

  const scheduled = useMemo(
    () =>
      tasks
        .map((task) => {
          const start = parseDay(task.start_date) ?? parseDay(task.due_date)
          const end = parseDay(task.due_date) ?? start
          return start && end ? { task, start, end } : null
        })
        .filter((entry): entry is { task: TaskWithMeta; start: Date; end: Date } => entry !== null)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [tasks],
  )

  const unscheduled = tasks.length - scheduled.length

  const position = (date: Date) =>
    ((differenceInCalendarDays(date, range.start) / Math.max(totalDays - 1, 1)) * 100)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium">{format(anchor, 'MMMM yyyy')}</span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next month"
          onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
        >
          <ChevronRight />
        </Button>
        <span className="ml-2 text-sm text-muted-foreground">
          {scheduled.length} scheduled{unscheduled > 0 ? ` · ${unscheduled} without dates` : ''}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="flex border-b bg-muted/40">
          <div className="w-56 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground">
            Task
          </div>
          <div className="relative flex-1">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
              {days.map((day, index) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'border-l px-1 py-2 text-center text-[10px] text-muted-foreground first:border-l-0',
                    !isSameMonth(day, anchor) && 'opacity-40',
                  )}
                  style={{ gridColumnStart: index + 1 }}
                >
                  {format(day, 'd')}
                </div>
              ))}
            </div>
          </div>
        </div>

        <ul className="divide-y">
          {scheduled.map(({ task, start, end }) => {
            const status = statusById.get(task.status_id)
            const left = Math.max(position(start), 0)
            const right = Math.min(position(addDays(end, 1)), 100)
            const width = Math.max(right - left, 1.5)

            return (
              <li key={task.id} className="flex items-stretch">
                <div className="flex w-56 shrink-0 items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm" title={task.title}>
                    {task.title}
                  </span>
                  <UserAvatar person={task.assignee} size={18} />
                </div>
                <div className="relative flex-1 bg-grid-lines bg-[length:100%_100%] py-2">
                  <span
                    className={cn(
                      'absolute top-1/2 flex h-5 -translate-y-1/2 items-center gap-1 rounded px-1.5 text-[11px] whitespace-nowrap',
                      status?.is_completed
                        ? 'bg-status-done-bg text-status-done'
                        : 'bg-primary/12 text-primary',
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${task.title}: ${format(start, 'd MMM')} – ${format(end, 'd MMM')}`}
                  >
                    <span className="truncate">{format(start, 'd MMM')} – {format(end, 'd MMM')}</span>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {scheduled.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Add start and due dates to tasks to see them on the timeline.
        </p>
      ) : null}

      {unscheduled > 0 ? (
        <section className="space-y-2">
          <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
            Without dates
          </h3>
          <ul className="divide-y rounded-xl border">
            {tasks
              .filter((task) => !task.due_date && !task.start_date)
              .slice(0, 8)
              .map((task) => (
                <li key={task.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                  <StatusBadge status={task.status} size="sm" />
                  {task.priority ? <PriorityBadge priority={task.priority} size="sm" /> : null}
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}