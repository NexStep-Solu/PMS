import { useMemo, useState } from 'react'
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { PriorityBadge, StatusBadge } from '@/components/shared/badges'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { STATUS_META } from '@/lib/constants'
import { cn } from '@/lib/utils'

import { useTaskDialog } from '../task-dialog-context'
import { parseDay } from '../utils'
import type { TaskWithMeta } from '../utils'
import type { TaskStatus } from '@/types/database'

/**
 * Month grid with one row per task. Bars take their colour from the task's status
 * category so the chart reads at a glance, single-day tasks render as milestone
 * diamonds, and every row opens the detail drawer. Dependency arrows are out of
 * scope for the first release — see PMS_START.md §10.
 */
export function TaskTimelineView({ tasks, statuses }: { tasks: TaskWithMeta[]; statuses: TaskStatus[] }) {
  const [anchor, setAnchor] = useState(() => new Date())
  const { openTask } = useTaskDialog()

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

  const today = new Date()
  const showToday = today >= range.start && today <= range.end
  const todayPosition = showToday ? position(today) : 0

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

      <div className="overflow-x-auto rounded-xl border">
        <div className="min-w-[880px]">
          <div className="flex border-b bg-muted/40">
            <div className="sticky left-0 z-10 w-56 shrink-0 bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
              Task
            </div>
            <div className="relative flex-1">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
                {days.map((day, index) => {
                  const weekend = day.getDay() === 0 || day.getDay() === 6
                  const today = isToday(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'border-l px-1 py-2 text-center text-[10px] text-muted-foreground first:border-l-0',
                        !isSameMonth(day, anchor) && 'opacity-40',
                        weekend && 'bg-muted/60',
                        today && 'bg-primary/10 font-semibold text-primary opacity-100',
                      )}
                      style={{ gridColumnStart: index + 1 }}
                    >
                      {format(day, 'd')}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <ul className="divide-y">
            {scheduled.map(({ task, start, end }) => {
              const status = statusById.get(task.status_id)
              const category = status?.category ?? task.status.category
              const colours = STATUS_META[category].classes
              const milestone = start.getTime() === end.getTime()
              const centre = (position(start) + position(addDays(end, 1))) / 2
              const left = Math.max(position(start), 0)
              const right = Math.min(position(addDays(end, 1)), 100)
              const width = Math.max(right - left, 1.5)
              const detail = `${task.title} · ${status?.name ?? task.status.name}${task.assignee?.full_name ? ` · ${task.assignee.full_name}` : ''}: ${format(start, 'd MMM')} – ${format(end, 'd MMM')}`

              return (
                <li key={task.id} className="group flex items-stretch hover:bg-accent/40">
                  <div className="sticky left-0 z-10 flex w-56 shrink-0 items-center gap-2 bg-background px-3 py-2 group-hover:bg-accent/40">
                    <button
                      type="button"
                      onClick={() => openTask(task.id)}
                      className="min-w-0 flex-1 truncate rounded text-left text-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      title={detail}
                    >
                      {task.title}
                    </button>
                    <UserAvatar person={task.assignee} size={18} />
                  </div>
                  <div className="relative flex-1 bg-grid-lines bg-[length:100%_100%] py-2.5">
                    {showToday ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-0 w-px bg-primary/50"
                        style={{ left: `${todayPosition}%` }}
                      />
                    ) : null}
                    {milestone ? (
                      <button
                        type="button"
                        onClick={() => openTask(task.id)}
                        aria-label={detail}
                        title={detail}
                        className={cn(
                          'absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] ring-2 ring-background transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          colours,
                        )}
                        style={{ left: `${centre}%` }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openTask(task.id)}
                        className={cn(
                          'absolute top-1/2 flex h-6 max-w-full -translate-y-1/2 items-center gap-1 rounded-md px-1.5 text-[11px] whitespace-nowrap transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          colours,
                          status?.is_completed && 'opacity-80',
                        )}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={detail}
                      >
                        <span className="truncate">
                          {format(start, 'd MMM')} – {format(end, 'd MMM')}
                        </span>
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
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