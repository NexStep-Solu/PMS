import { format, parseISO } from 'date-fns'
import { AlertTriangle, FolderKanban } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ProjectPriorityBadge, ProjectStatusBadge } from '@/components/shared/badges'
import { UserAvatarGroup } from '@/components/shared/user-avatar'
import { Progress } from '@/components/ui/progress'

import { summariseProgress } from '@/features/tasks/utils'
import type { TaskWithMeta } from '@/features/tasks/utils'

export function ProjectCard({
  projectId,
  name,
  projectKey,
  description,
  status,
  priority,
  startDate,
  dueDate,
  members,
  tasks,
}: {
  projectId: string
  name: string
  projectKey: string
  description: string | null
  status: React.ComponentProps<typeof ProjectStatusBadge>['status']
  priority: React.ComponentProps<typeof ProjectPriorityBadge>['priority']
  startDate: string | null
  dueDate: string | null
  members: { id: string; full_name: string | null; avatar_url: string | null }[]
  tasks: TaskWithMeta[]
}) {
  const progress = summariseProgress(tasks)

  return (
    <Link
      to={`/app/projects/${projectId}/overview`}
      className="group flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:border-ring/40 focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
    >
      <div className="flex items-start gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[11px] font-semibold text-muted-foreground">
          {projectKey.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold">{name}</h3>
          {description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <FolderKanban className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Progress value={progress.percent} className="h-1.5 flex-1" aria-label={`${progress.percent}% complete`} />
          <span className="text-xs text-muted-foreground tabular">{progress.percent}%</span>
        </div>
        <p className="text-xs text-muted-foreground tabular">
          {progress.done}/{progress.total} tasks
          {progress.overdue > 0 ? (
            <span className="ml-2 inline-flex items-center gap-1 font-medium text-destructive">
              <AlertTriangle className="size-3" aria-hidden />
              {progress.overdue} overdue
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={status} />
        <ProjectPriorityBadge priority={priority} />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular">
          {startDate ? format(parseISO(startDate), 'd MMM') : '—'} —{' '}
          {dueDate ? format(parseISO(dueDate), 'd MMM') : '—'}
        </span>
        <UserAvatarGroup people={members} max={4} size={22} />
      </div>
    </Link>
  )
}
