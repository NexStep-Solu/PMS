import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { Flag } from 'lucide-react'

import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/states'
import type { Milestone } from '@/types/database'

/** Compact milestone list used on the dashboard. */
export function MilestoneStrip({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <EmptyState
        icon={<Flag className="size-5" aria-hidden />}
        title="No upcoming milestones"
        description="Add milestones to a project to track launches and reviews."
      />
    )
  }

  return (
    <ul className="divide-y rounded-xl border">
      {milestones.map((milestone) => {
        const days = differenceInCalendarDays(
          startOfDay(parseISO(milestone.due_date)),
          startOfDay(new Date()),
        )
        const complete = milestone.status === 'completed'
        const late = !complete && days < 0

        return (
          <li key={milestone.id} className="flex items-center gap-3 px-3 py-2.5">
            <span
              aria-hidden
              className={cn(
                'size-2 shrink-0 rounded-full',
                complete ? 'bg-status-done' : late ? 'bg-destructive' : 'bg-status-progress',
              )}
            />
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm',
                complete && 'text-muted-foreground line-through',
              )}
            >
              {milestone.name}
            </span>
            <span
              className={cn(
                'shrink-0 text-xs tabular',
                late ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              {complete
                ? 'Done'
                : late
                  ? `${Math.abs(days)}d late`
                  : days === 0
                    ? 'Today'
                    : `${days}d`}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
