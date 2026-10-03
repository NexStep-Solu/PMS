import { useWorkspace } from '@/features/organizations/workspace-context'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState, SkeletonList } from '@/components/shared/states'
import { TaskCalendarView } from '@/features/tasks/components/task-calendar-view'
import { useOrgMilestones } from '@/features/milestones/queries'
import { useTasksByOrganization, useWorkspaceTaskMeta } from '@/features/tasks/queries'

export function WorkspaceCalendarPage() {
  const { organizationId, organizationName } = useWorkspace()
  const { data: tasks, isPending, isError, refetch } = useTasksByOrganization(organizationId ?? undefined)
  const { statuses } = useWorkspaceTaskMeta()
  const { data: milestones } = useOrgMilestones(organizationId ?? undefined)

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Calendar"
        description={`Every due date and milestone in ${organizationName ?? 'this workspace'}.`}
      />

      {isPending ? (
        <SkeletonList rows={8} />
      ) : isError ? (
        <ErrorState title="Couldn't load the calendar" onRetry={() => void refetch()} />
      ) : (
        <TaskCalendarView
          tasks={tasks ?? []}
          statuses={statuses}
          milestones={(milestones ?? []).map((milestone) => ({
            id: milestone.id,
            name: milestone.name,
            due_date: milestone.due_date,
            status: milestone.status,
          }))}
        />
      )}
    </div>
  )
}