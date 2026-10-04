import { useMemo, useState } from 'react'
import { FolderPlus, Plus, SlidersHorizontal } from 'lucide-react'

import { PageHeader } from '@/components/shared/page-header'
import { ProjectCard } from '@/features/projects/components/project-card'
import { CreateProjectDialog } from '@/features/projects/components/create-project-dialog'
import { EditProjectDialog } from '@/features/projects/components/edit-project-dialog'
import { ErrorState, EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SkeletonPanel } from '@/components/shared/states'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePagination } from '@/hooks/use-pagination'
import { usePermission, useWorkspace } from '@/features/organizations/workspace-context'
import { useTasksByOrganization } from '@/features/tasks/queries'

import { useProjects, type ProjectSort } from '../queries'
import type { ProjectStatus } from '@/types/database'

type StatusFilter = ProjectStatus | 'all'

export function ProjectsPage() {
  const { organizationName, organizationId } = useWorkspace()
  const { can: canDo } = usePermission()
  const [includeArchived, setIncludeArchived] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<ProjectSort>('updated')
  const pager = usePagination(25)

  const term = useDebouncedValue(search, 250)

  // Search, status and sort are applied in the database. Filtering a single page
  // in the browser would silently hide matches living on the other pages.
  const { data, isPending, isError, refetch } = useProjects({
    includeArchived,
    page: pager.page,
    pageSize: pager.pageSize,
    search: term,
    status,
    sort,
  })
  const projects = data?.rows
  const totalProjects = data?.total ?? 0

  const { data: tasks } = useTasksByOrganization(organizationId ?? undefined)
  const [createOpen, setCreateOpen] = useState(false)
  const [editProject, setEditProject] = useState<Parameters<
    typeof EditProjectDialog
  >[0]['project']>(undefined)

  const tasksByProject = useMemo(() => {
    const map = new Map<string, typeof tasks>()
    for (const task of tasks ?? []) {
      map.set(task.project_id, [...(map.get(task.project_id) ?? []), task])
    }
    return map
  }, [tasks])

  const canCreate = canDo('projects.create')

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Projects"
        description={`${projects?.length ?? 0} projects in ${organizationName ?? 'this workspace'}.`}
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              New project
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search projects…"
          className="h-9 w-full max-w-xs"
          aria-label="Search projects"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal aria-hidden />
              Filters
              {status !== 'all' || includeArchived ? (
                <Badge variant="default" className="ml-1">
                  {(status !== 'all' ? 1 : 0) + (includeArchived ? 1 : 0)}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            {(['all', 'planned', 'active', 'on_hold', 'completed', 'archived'] as StatusFilter[]).map(
              (entry) => (
                <DropdownMenuCheckboxItem
                  key={entry}
                  checked={status === entry}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() => setStatus(entry)}
                >
                  {entry === 'all' ? 'All statuses' : entry.replace('_', ' ')}
                </DropdownMenuCheckboxItem>
              ),
            )}
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={includeArchived}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(value) => setIncludeArchived(value === true)}
            >
              Include archived
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Sort: {sort}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(['updated', 'name', 'due'] as const).map((entry) => (
              <DropdownMenuCheckboxItem
                key={entry}
                checked={sort === entry}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={() => setSort(entry)}
              >
                {entry === 'updated' ? 'Recently updated' : entry === 'name' ? 'Name' : 'Due date'}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-sm text-muted-foreground tabular">
          {(projects?.length ?? 0).toLocaleString()} shown
        </span>
      </div>

      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <SkeletonPanel key={index} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Couldn't load projects"
          description="We couldn't fetch the projects for this workspace."
          onRetry={() => void refetch()}
        />
      ) : (projects?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<FolderPlus className="size-5" aria-hidden />}
          title={projects?.length ? 'No projects match these filters' : 'No projects yet'}
          description={
            projects?.length
              ? 'Try clearing the search or filters.'
              : 'Create your first project to start organising your team’s work.'
          }
          action={
            canCreate ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden />
                Create project
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(projects ?? []).map((project) => (
            <div key={project.id} className="group relative">
              <ProjectCard
                projectId={project.id}
                name={project.name}
                projectKey={project.key}
                description={project.description}
                status={project.status}
                priority={project.priority}
                startDate={project.start_date}
                dueDate={project.due_date}
                members={project.members
                  .map((member) => member.profiles)
                  .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))}
                tasks={tasksByProject.get(project.id) ?? []}
              />
              {canDo('projects.update') ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-3 right-3 hidden text-xs group-hover:inline-flex"
                  onClick={() => setEditProject(project)}
                >
                  Edit
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditProjectDialog open={Boolean(editProject)} onOpenChange={(open) => (open ? undefined : setEditProject(undefined))} project={editProject} />

      {isPending ? null : (
      <PaginationBar
        total={totalProjects}
        rowCount={projects?.length ?? 0}
        page={pager.page}
        pageSize={pager.pageSize}
        onPageChange={pager.setPage}
        onPageSizeChange={pager.setPageSize}
        label="projects"
      />
      )}

      <span className="sr-only" aria-live="polite">
        {(projects?.length ?? 0).toLocaleString()} projects shown
      </span>
    </div>
  )
}