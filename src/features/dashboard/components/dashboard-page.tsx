import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { ArrowRight, CalendarDays, FolderKanban } from 'lucide-react'

import { PageHeader, SectionTitle } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/badges'
import { ActivityFeed } from '@/features/activity/components/activity-feed'
import { MilestoneStrip } from '@/features/milestones/components/milestone-strip'
import { EmptyState, ErrorState, SkeletonPanel } from '@/components/shared/states'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/features/auth/queries'
import { useActivity } from '@/features/activity/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'
import { useProjects } from '@/features/projects/queries'
import { useTaskDialog } from '@/features/tasks/task-dialog-context'
import { useOrgMilestones } from '@/features/milestones/queries'
import { useTasksByOrganization } from '@/features/tasks/queries'
import { dueState, summariseProgress } from '@/features/tasks/utils'

export function DashboardPage() {
  const user = useCurrentUser()
  const { organizationName, organizationId, can } = useWorkspace()
  const { openTask, openCreate } = useTaskDialog()
  const { data: tasks, isPending, isError, refetch } = useTasksByOrganization(organizationId ?? undefined)
  const { data: projectPage } = useProjects()
  const projects = projectPage?.rows
  const { data: activity } = useActivity(10)
  const { data: milestones } = useOrgMilestones(organizationId ?? undefined)

  const firstName = (user?.userMetadata.full_name as string | undefined)?.split(' ')[0] ?? 'there'

  const summary = useMemo(() => {
    const list = tasks ?? []
    const mine = list.filter((task) => task.assignee_id === user?.id)
    const open = mine.filter((task) => !task.status.is_completed && task.status.category !== 'cancelled')
    const today = list.filter((task) => dueState(task, task.status) === 'today')
    const overdue = list.filter((task) => dueState(task, task.status) === 'overdue')
    return { mine: open, today, overdue, total: list.length }
  }, [tasks, user?.id])

  const upcoming = useMemo(
    () =>
      [...(summary.mine ?? [])]
        .filter((task) => task.due_date)
        .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
        .slice(0, 8),
    [summary.mine],
  )

  const recentProjects = useMemo(() => (projects ?? []).slice(0, 4), [projects])
  const tasksByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const task of tasks ?? []) map.set(task.project_id, (map.get(task.project_id) ?? 0) + 1)
    return map
  }, [tasks])

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState
          title="Couldn't load your dashboard"
          description="We couldn't fetch the data for this workspace."
          onRetry={() => void refetch()}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title={`Good ${dayPart()}, ${firstName}`}
        description={`Here's what's happening across ${organizationName ?? 'your workspace'}.`}
        actions={
          can('tasks.create') ? (
            <Button size="sm" onClick={() => openCreate()}>
              New task
            </Button>
          ) : null
        }
      />

      {/* Compact summary strip — numbers, not cards */}
      <section
        aria-label="Workspace summary"
        className="grid grid-cols-2 divide-x divide-y rounded-xl border sm:grid-cols-4 sm:divide-y-0"
      >
        <Stat label="My open tasks" value={summary.mine.length} to="/app/my-tasks" />
        <Stat label="Due today" value={summary.today.length} tone={summary.today.length > 0 ? 'warn' : undefined} />
        <Stat
          label="Overdue"
          value={summary.overdue.length}
          tone={summary.overdue.length > 0 ? 'danger' : undefined}
          to="/app/my-tasks?filter=overdue"
        />
        <Stat label="Projects" value={projects?.length ?? 0} to="/app/projects" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <section>
            <SectionTitle
              action={
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                  <Link to="/app/my-tasks">
                    View all <ArrowRight aria-hidden />
                  </Link>
                </Button>
              }
            >
              My tasks
            </SectionTitle>

            {isPending ? (
              <div className="space-y-2">
                <SkeletonPanel />
                <SkeletonPanel />
              </div>
            ) : upcoming.length === 0 ? (
              <EmptyState
                title="Nothing assigned to you"
                description="When someone assigns you a task it will show up here."
                action={
                  <Button size="sm" onClick={() => openCreate()}>
                    Create a task
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y rounded-xl border">
                {upcoming.map((task) => {
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
                            'shrink-0 text-xs tabular',
                            state === 'overdue' && 'font-medium text-destructive',
                            state === 'today' && 'text-priority-high',
                            state === 'upcoming' && 'text-muted-foreground',
                          )}
                        >
                          {task.due_date ? relativeDue(task.due_date) : '—'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle
              action={
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                  <Link to="/app/projects">
                    All projects <ArrowRight aria-hidden />
                  </Link>
                </Button>
              }
            >
              Project progress
            </SectionTitle>

            {isPending ? (
              <SkeletonPanel />
            ) : recentProjects.length === 0 ? (
              <EmptyState
                icon={<FolderKanban className="size-5" aria-hidden />}
                title="No projects yet"
                description="Create a project to start tracking work."
              />
            ) : (
              <ul className="divide-y rounded-xl border">
                {recentProjects.map((project) => {
                  const projectTasks = (tasks ?? []).filter((task) => task.project_id === project.id)
                  const progress = summariseProgress(projectTasks)
                  return (
                    <li key={project.id}>
                      <Link
                        to={`/app/projects/${project.id}/overview`}
                        className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] font-semibold text-muted-foreground">
                          {project.key.slice(0, 2)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{project.name}</span>
                          <Progress value={progress.percent} className="mt-1 h-1" aria-label={`${progress.percent}% complete`} />
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular">
                          {progress.done}/{tasksByProject.get(project.id) ?? 0}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section>
            <SectionTitle
              action={
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                  <Link to="/app/calendar">
                    Calendar <CalendarDays aria-hidden />
                  </Link>
                </Button>
              }
            >
              Upcoming milestones
            </SectionTitle>
            <MilestoneStrip milestones={(milestones ?? []).slice(0, 5)} />
          </section>

          <section>
            <SectionTitle>Recent activity</SectionTitle>
            <ActivityFeed entries={activity ?? []} emptyMessage="No activity in this workspace yet." />
          </section>
        </aside>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
  to,
}: {
  label: string
  value: number
  tone?: 'warn' | 'danger'
  to?: string
}) {
  const body = (
    <div className="px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-2xl font-semibold tabular',
          tone === 'danger' && value > 0 && 'text-destructive',
          tone === 'warn' && value > 0 && 'text-priority-high',
        )}
      >
        {value}
      </p>
    </div>
  )

  if (!to) return <div>{body}</div>

  return (
    <Link to={to} className="transition-colors hover:bg-accent/40">
      {body}
    </Link>
  )
}

function dayPart(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function relativeDue(dueDate: string): string {
  const days = differenceInCalendarDays(startOfDay(parseISO(dueDate)), startOfDay(new Date()))
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 0) return `${Math.abs(days)}d late`
  if (days <= 6) return `${days}d`
  return format(parseISO(dueDate), 'd MMM')
}
