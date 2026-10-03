import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, ListTodo, Users } from 'lucide-react'
import { format, parseISO } from 'date-fns'

import { MilestoneList } from '@/features/milestones/components/milestone-list'
import { ActivityFeed } from '@/features/activity/components/activity-feed'
import { SectionTitle } from '@/components/shared/page-header'
import { UserAvatar, UserAvatarGroup } from '@/components/shared/user-avatar'
import { ErrorState, SkeletonPanel, EmptyState } from '@/components/shared/states'
import { StatusBadge } from '@/components/shared/badges'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

import { useProject, useProjectActivity } from '../queries'
import { useMilestones } from '@/features/milestones/queries'
import { useTasksByProject } from '@/features/tasks/queries'
import { useTaskDialog } from '@/features/tasks/task-dialog-context'
import { dueState, summariseProgress } from '@/features/tasks/utils'

export function ProjectOverview() {
  const { projectId } = useParams<{ projectId: string }>()
  const { openTask } = useTaskDialog()
  const { data: project, isPending, isError, refetch } = useProject(projectId)
  const { data: tasks } = useTasksByProject(projectId)
  const { data: milestones } = useMilestones(projectId)
  const { data: activity } = useProjectActivity(projectId, 8)

  const progress = useMemo(() => summariseProgress(tasks ?? []), [tasks])

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    for (const task of tasks ?? []) {
      map.set(task.status.name, (map.get(task.status.name) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [tasks])

  const nextUp = useMemo(
    () =>
      (tasks ?? [])
        .filter((task) => dueState(task, task.status) === 'overdue' || (task.due_date && !task.status.is_completed))
        .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
        .slice(0, 6),
    [tasks],
  )

  if (isPending) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonPanel key={index} />
        ))}
      </div>
    )
  }

  if (isError || !project) {
    return (
      <ErrorState
        title="Couldn't load this project"
        description="It may have been archived, or you may not have access to it."
        onRetry={() => void refetch()}
      />
    )
  }

  const people = project.members
    .map((member) => member.profiles)
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className="rounded-xl border p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold">Progress</h2>
            <span className="text-2xl font-semibold tabular">{progress.percent}%</span>
          </div>
          <Progress value={progress.percent} className="mt-2 h-2" aria-label={`${progress.percent}% complete`} />
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Tasks" value={String(progress.total)} />
            <Stat label="Done" value={String(progress.done)} />
            <Stat label="In progress" value={String(progress.inProgress)} />
            <Stat
              label="Overdue"
              value={String(progress.overdue)}
              tone={progress.overdue > 0 ? 'danger' : undefined}
            />
          </dl>
        </section>

        <section>
          <SectionTitle>Task summary</SectionTitle>
          <div className="rounded-xl border">
            <ul className="divide-y">
              {statusBreakdown.map(([name, count]) => (
                <li key={name} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-24 text-sm">{name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{
                        width: `${progress.total === 0 ? 0 : (count / progress.total) * 100}%`,
                      }}
                    />
                  </span>
                  <span className="w-8 text-right text-sm text-muted-foreground tabular">{count}</span>
                </li>
              ))}
              {statusBreakdown.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No tasks in this project yet.
                </li>
              ) : null}
            </ul>
          </div>
        </section>

        <section>
          <SectionTitle>Next up</SectionTitle>
          {nextUp.length === 0 ? (
            <EmptyState
              title="Nothing scheduled"
              description="Tasks with a due date will show up here."
            />
          ) : (
            <ul className="divide-y rounded-xl border">
              {nextUp.map((task) => {
                const state = dueState(task, task.status)
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => openTask(task.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                    >
                      <StatusBadge status={task.status} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                      <span
                        className={cn(
                          'flex shrink-0 items-center gap-1 text-xs tabular',
                          state === 'overdue' && 'font-medium text-destructive',
                        )}
                      >
                        {state === 'overdue' ? <AlertTriangle className="size-3" aria-hidden /> : null}
                        {task.due_date ? format(parseISO(task.due_date), 'd MMM') : 'No date'}
                      </span>
                      <UserAvatar person={task.assignee} size={20} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>Milestones</SectionTitle>
          <MilestoneList projectId={project.id} milestones={milestones ?? []} compact />
        </section>
      </div>

      <aside className="space-y-6">
        <section className="rounded-xl border p-4">
          <SectionTitle>Details</SectionTitle>
          <dl className="space-y-3 text-sm">
            <Detail icon={Clock} label="Dates">
              {project.start_date || project.due_date ? (
                <span className="tabular">
                  {project.start_date ? format(parseISO(project.start_date), 'd MMM yyyy') : '—'} →{' '}
                  {project.due_date ? format(parseISO(project.due_date), 'd MMM yyyy') : '—'}
                </span>
              ) : (
                <span className="text-muted-foreground">Not scheduled</span>
              )}
            </Detail>
            <Detail icon={Users} label="Owner">
              {project.owner ? (
                <span className="inline-flex items-center gap-1.5">
                  <UserAvatar person={project.owner} size={18} />
                  {project.owner.full_name}
                </span>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </Detail>
            <Detail icon={Users} label="Members">
              <UserAvatarGroup people={people} max={6} size={24} />
            </Detail>
            <Detail icon={ListTodo} label="Created">
              <span className="tabular">{format(parseISO(project.created_at), 'd MMM yyyy')}</span>
            </Detail>
          </dl>
        </section>

        <section>
          <SectionTitle>Recent activity</SectionTitle>
          <ActivityFeed entries={activity ?? []} emptyMessage="Nothing has happened yet." />
        </section>

        {nextUp[0] ? (
          <Button variant="outline" size="sm" className="w-full" onClick={() => openTask(nextUp[0]?.id ?? '')}>
            <CheckCircle2 aria-hidden />
            Review next task
          </Button>
        ) : null}
      </aside>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('text-lg font-semibold tabular', tone === 'danger' && 'text-destructive')}>{value}</dd>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}