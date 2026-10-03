import { useMemo, useState } from 'react'
import { CheckSquare, Plus } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/badges'
import { EmptyState, ErrorState, SkeletonList } from '@/components/shared/states'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useCurrentUser } from '@/features/auth/queries'
import { usePermission, useWorkspace } from '@/features/organizations/workspace-context'
import { useTaskDialog } from '@/features/tasks/task-dialog-context'
import { useTasksByOrganization, useUpdateTask, useWorkspaceTaskMeta } from '@/features/tasks/queries'
import { dueLabel, dueState } from '@/features/tasks/utils'

type Scope = 'open' | 'overdue' | 'today' | 'done'

export function MyTasksPage() {
  const user = useCurrentUser()
  const { organizationId, organizationName } = useWorkspace()
  const { can } = usePermission()
  const { openTask, openCreate } = useTaskDialog()
  const { data: tasks, isPending, isError, refetch } = useTasksByOrganization(organizationId ?? undefined)
  const { statuses } = useWorkspaceTaskMeta()
  const updateTask = useUpdateTask()

  const [scope, setScope] = useState<Scope>('open')

  const mine = useMemo(
    () => (tasks ?? []).filter((task) => task.assignee_id === user?.id),
    [tasks, user?.id],
  )

  const buckets = useMemo(
    () => ({
      open: mine.filter((task) => !task.status.is_completed && task.status.category !== 'cancelled'),
      overdue: mine.filter((task) => dueState(task, task.status) === 'overdue'),
      today: mine.filter((task) => dueState(task, task.status) === 'today'),
      done: mine.filter((task) => task.status.is_completed),
    }),
    [mine],
  )

  const visible = useMemo(() => {
    const list = buckets[scope]
    return [...list].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  }, [buckets, scope])

  const statusById = useMemo(() => new Map(statuses.map((status) => [status.id, status])), [statuses])

  const complete = (task: (typeof visible)[number]) => {
    const target = statuses.find((status) => status.is_completed && status.category !== 'cancelled')
    if (!target) return
    updateTask.mutate(
      { statusId: target.id, task },
      { onError: () => toast.error("Couldn't update that task.") },
    )
  }

  const reopen = (task: (typeof visible)[number]) => {
    const target = statuses.find((status) => status.is_default) ?? statuses[0]
    if (!target) return
    updateTask.mutate(
      { statusId: target.id, task },
      { onError: () => toast.error("Couldn't reopen that task.") },
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="My tasks"
        description={`Everything assigned to you in ${organizationName ?? 'this workspace'}.`}
        actions={
          can('tasks.create') ? (
            <Button size="sm" onClick={() => openCreate()}>
              <Plus aria-hidden />
              New task
            </Button>
          ) : null
        }
      >
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(value) => value && setScope(value as Scope)}
          variant="outline"
          size="sm"
          aria-label="Task scope"
        >
          <ToggleGroupItem value="open">Open ({buckets.open.length})</ToggleGroupItem>
          <ToggleGroupItem value="today">Today ({buckets.today.length})</ToggleGroupItem>
          <ToggleGroupItem value="overdue">Overdue ({buckets.overdue.length})</ToggleGroupItem>
          <ToggleGroupItem value="done">Done ({buckets.done.length})</ToggleGroupItem>
        </ToggleGroup>
      </PageHeader>

      {isPending ? (
        <SkeletonList rows={6} />
      ) : isError ? (
        <ErrorState title="Couldn't load your tasks" onRetry={() => void refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="size-5" aria-hidden />}
          title={scope === 'done' ? 'Nothing completed yet' : 'Nothing here'}
          description={
            scope === 'done'
              ? 'Tasks you complete will be listed here.'
              : 'You have no tasks in this view. Enjoy the quiet, or pick something up.'
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {visible.map((task) => {
            const state = dueState(task, task.status)
            const done = task.status.is_completed
            return (
              <li key={task.id} className="group flex items-center gap-3 px-3 py-2.5">
                <Checkbox
                  checked={done}
                  disabled={!can('tasks.update')}
                  aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  onCheckedChange={(value) => (value === true ? complete(task) : reopen(task))}
                />

                <button
                  type="button"
                  onClick={() => openTask(task.id)}
                  className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                >
                  <span className={cn('truncate text-sm', done && 'text-muted-foreground line-through')}>
                    {task.title}
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    <StatusBadge status={task.status} size="sm" />
                    {task.due_date ? (
                      <span
                        className={cn(
                          'tabular',
                          state === 'overdue' && 'font-medium text-destructive',
                        )}
                      >
                        {dueLabel(task.due_date)}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground">{statusById.get(task.status_id)?.name}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}