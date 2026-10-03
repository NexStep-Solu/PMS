import type { ReactNode } from 'react'
import { NavLink, Outlet, useParams } from 'react-router-dom'
import { MoreHorizontal, Pencil, Plus, Star } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { ProjectPriorityBadge, ProjectStatusBadge } from '@/components/shared/badges'
import { UserAvatar, UserAvatarGroup } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { usePermission, useWorkspace } from '@/features/organizations/workspace-context'
import { useTaskDialog } from '@/features/tasks/task-dialog-context'

import { useProject, useUpdateProject } from './queries'
import { ProjectHeaderProvider } from './project-header'
import { EditProjectDialog } from './components/edit-project-dialog'
import { ProjectMembersDialog } from './components/project-members-dialog'

const TABS = [
  { to: 'overview', label: 'Overview' },
  { to: 'board', label: 'Board' },
  { to: 'list', label: 'List' },
  { to: 'calendar', label: 'Calendar' },
  { to: 'timeline', label: 'Timeline' },
  { to: 'milestones', label: 'Milestones' },
  { to: 'files', label: 'Files' },
]

export function ProjectLayout({ children }: { children?: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: project, isPending } = useProject(projectId)
  const { can } = usePermission()
  const { organizationName } = useWorkspace()
  const { openCreate } = useTaskDialog()
  const updateProject = useUpdateProject(projectId ?? '')

  const [editOpen, setEditOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)

  const base = `/app/projects/${projectId ?? ''}`
  const people =
    project?.members
      .map((member) => member.profiles)
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile)) ?? []

  const crumbs = [
    { label: 'Projects', to: '/app/projects' },
    { label: project?.name ?? 'Project' },
  ]

  return (
    <ProjectHeaderProvider crumbs={crumbs}>
      <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          breadcrumbs={crumbs}
          title={
            isPending ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <span className="flex items-center gap-2">
                {project?.name}
                {project ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {project.key}
                  </span>
                ) : null}
              </span>
            )
          }
          description={project?.description ?? `Project in ${organizationName ?? 'this workspace'}`}
          actions={
            <div className="flex items-center gap-2">
              {project ? (
                <button
                  type="button"
                  onClick={() => setMembersOpen(true)}
                  className="rounded-md"
                  aria-label="Manage project members"
                >
                  <UserAvatarGroup people={people} max={4} size={26} />
                </button>
              ) : null}

              {can('tasks.create') ? (
                <Button size="sm" onClick={() => openCreate({ projectId })}>
                  <Plus aria-hidden />
                  New task
                </Button>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon-sm" aria-label="Project actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      setEditOpen(true)
                    }}
                    disabled={!can('projects.update')}
                  >
                    <Pencil aria-hidden />
                    Edit project
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      setMembersOpen(true)
                    }}
                  >
                    <Star aria-hidden />
                    Manage members
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={!can('projects.update') || project?.status === 'archived'}
                    onSelect={() => {
                      if (!project) return
                      updateProject.mutate(
                        { status: 'archived' },
                        { onError: () => toast.error("Couldn't archive the project.") },
                      )
                    }}
                  >
                    Archive project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        >
          {project ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <ProjectStatusBadge status={project.status} />
              <ProjectPriorityBadge priority={project.priority} />
              {project.start_date || project.due_date ? (
                <span className="tabular">
                  {project.start_date ?? '—'} → {project.due_date ?? '—'}
                </span>
              ) : null}
              {project.owner ? (
                <span className="inline-flex items-center gap-1.5">
                  <UserAvatar person={project.owner} size={20} />
                  {project.owner.full_name}
                </span>
              ) : null}
            </div>
          ) : null}

          <nav aria-label="Project sections" className="-mb-px overflow-x-auto scrollbar-thin">
            <ul className="flex min-w-max gap-1 border-b">
              {TABS.map((tab) => (
                <li key={tab.to}>
                  <NavLink
                    to={`${base}/${tab.to}`}
                    className={({ isActive }) =>
                      cn(
                        '-mb-px inline-block border-b-2 px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'border-primary font-medium text-foreground'
                          : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                      )
                    }
                  >
                    {tab.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </PageHeader>

        {children ?? <Outlet />}
      </div>

      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
      <ProjectMembersDialog open={membersOpen} onOpenChange={setMembersOpen} />
    </ProjectHeaderProvider>
  )
}
