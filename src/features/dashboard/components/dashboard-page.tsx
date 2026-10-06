import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  FolderKanban,
  ListTodo,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'

import { PageHeader, SectionTitle } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/badges'
import { ActivityFeed } from '@/features/activity/components/activity-feed'
import { MilestoneStrip } from '@/features/milestones/components/milestone-strip'
import { EmptyState, ErrorState, SkeletonPanel } from '@/components/shared/states'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  const projectKeyById = useMemo(
    () => new Map((projects ?? []).map((project) => [project.id, project.key])),
    [projects],
  )
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

      {/* Glanceable stat cards. Colour is functional: neutral for counts, amber
          for due-soon, red for overdue — and cards that lead somewhere lift on hover. */}
      <section
        aria-label="Workspace summary"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <Stat
          label="My open tasks"
          value={summary.mine.length}
          hint={summary.mine.length === 0 ? 'All clear' : 'Assigned to you'}
          to="/app/my-tasks"
          icon={ListTodo}
          tile="bg-primary/12 text-primary"
        />
        <Stat
          label="Due today"
          value={summary.today.length}
          hint={summary.today.length === 0 ? 'Nothing due' : 'Needs attention today'}
          to="/app/my-tasks"
          icon={CalendarClock}
          tile="bg-priority-medium-bg text-priority-medium"
        />
        <Stat
          label="Overdue"
          value={summary.overdue.length}
          hint={summary.overdue.length === 0 ? 'Nothing late' : 'Act on these first'}
          to="/app/my-tasks?filter=overdue"
          icon={TriangleAlert}
          tile="bg-destructive/12 text-destructive"
          valueTone={summary.overdue.length > 0 ? 'text-destructive' : undefined}
        />
        <Stat
          label="Projects"
          value={projects?.length ?? 0}
          hint="Across the workspace"
          to="/app/projects"
          icon={FolderKanban}
          tile="bg-muted text-muted-foreground"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-6">
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
              Up next
              {upcoming.length > 0 ? (
                <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular">
                  {upcoming.length}
                </span>
              ) : null}
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
                  const projectKey = projectKeyById.get(task.project_id)
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => openTask(task.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                      >
                        <StatusBadge status={task.status} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                        {projectKey ? (
                          <span className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline">
                            {projectKey}
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'shrink-0 text-xs tabular',
                            state === 'overdue' && 'font-medium text-destructive',
                            state === 'today' && 'font-medium text-priority-high',
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
              <ul className="grid gap-3 sm:grid-cols-2">
                {recentProjects.map((project) => {
                  const projectTasks = (tasks ?? []).filter((task) => task.project_id === project.id)
                  const progress = summariseProgress(projectTasks)
                  return (
                    <li key={project.id}>
                      <Link
                        to={`/app/projects/${project.id}/overview`}
                        className="block rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {project.name}
                          </span>
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                            {project.key}
                          </span>
                        </span>
                        <span className="mt-3 flex items-center gap-2.5">
                          <Progress
                            value={progress.percent}
                            className="h-2 flex-1"
                            aria-label={`${project.name}: ${progress.percent}% complete`}
                          />
                          <span className="shrink-0 text-xs font-medium tabular">
                            {progress.percent}%
                          </span>
                        </span>
                        <span className="mt-1.5 block text-xs text-muted-foreground tabular">
                          {progress.done} of {tasksByProject.get(project.id) ?? 0} tasks done
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                Upcoming milestones
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link to="/app/calendar">
                  Calendar <CalendarDays aria-hidden />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <MilestoneStrip milestones={(milestones ?? []).slice(0, 5)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ActivityFeed entries={activity ?? []} emptyMessage="No activity in this workspace yet." />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  to,
  icon: Icon,
  tile,
  valueTone,
}: {
  label: string
  value: number
  hint: string
  to?: string
  icon: LucideIcon
  /** Tinted tile behind the icon, from the semantic tokens. */
  tile: string
  valueTone?: string
}) {
  const body = (
    <>
      <span className={cn('flex size-9 items-center justify-center rounded-lg', tile)}>
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className={cn('block text-2xl leading-8 font-semibold tabular', valueTone)}>
          {value}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/70">{hint}</span>
      </span>
      {to ? (
        <ArrowRight
          className="ml-auto size-4 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      ) : null}
    </>
  )

  const classes =
    'group flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:shadow-sm'

  if (!to) {
    return (
      <div className={classes} aria-label={`${label}: ${value}`}>
        {body}
      </div>
    )
  }

  return (
    <Link to={to} className={cn(classes, 'hover:border-primary/30')} aria-label={`${label}: ${value}`}>
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
