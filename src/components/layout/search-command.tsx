import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  Plus,
  Search,
  Tag,
  CheckSquare,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { CreateProjectDialog } from '@/features/projects/components/create-project-dialog'
import { useSearchTasks } from '@/features/tasks/queries'
import { useProjectsSidebar } from '@/features/projects/queries'
import { usePermission, useWorkspace } from '@/features/organizations/workspace-context'
import { useSetTaskDialog } from '@/features/tasks/task-dialog-context'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

/**
 * Global search and navigation. Kept deliberately simple: projects, tasks and
 * a handful of static destinations. Advanced command behaviour comes later.
 */
export function SearchCommand({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { organizationId, organizationName } = useWorkspace()
  const { can } = usePermission()
  const openTaskDialog = useSetTaskDialog()

  const [rawTerm, setRawTerm] = useState('')
  const term = useDebouncedValue(rawTerm, 180)
  const { data: projects } = useProjectsSidebar()
  const { data: tasks } = useSearchTasks(organizationId, term)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)

  const showProjectAction = can('projects.create')

  const grouped = useMemo(() => {
    const matchesTerm = term.trim().length > 1
    return {
      tasks: matchesTerm ? (tasks ?? []).slice(0, 6) : [],
      projects: matchesTerm ? [] : (projects ?? []).slice(0, 8),
    }
  }, [tasks, projects, term])

  const close = () => onOpenChange(false)

  const go = (path: string) => {
    close()
    navigate(path)
  }

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Search and commands"
        description="Jump to a page, project or task."
      >
        <CommandInput
          value={rawTerm}
          onValueChange={(next) => setRawTerm(next)}
          placeholder="Search projects and tasks…"
        />

        <CommandList>
          <CommandEmpty>No results for “{term}”.</CommandEmpty>

          {term.trim().length <= 1 ? (
            <CommandGroup heading="Go to">
              <CommandItem onSelect={() => go('/app/dashboard')}>
                <LayoutDashboard aria-hidden />
                Dashboard
              </CommandItem>
              <CommandItem onSelect={() => go('/app/my-tasks')}>
                <CheckSquare aria-hidden />
                My tasks
              </CommandItem>
              <CommandItem onSelect={() => go('/app/calendar')}>
                <CalendarDays aria-hidden />
                Calendar
              </CommandItem>
              <CommandItem onSelect={() => go('/app/reports')}>
                <Tag aria-hidden />
                Reports
              </CommandItem>
            </CommandGroup>
          ) : null}

          {showProjectAction ? (
            <CommandGroup heading="Create">
              <CommandItem
                onSelect={() => {
                  close()
                  openTaskDialog({ projectId: params.get('project') ?? undefined })
                }}
              >
                <Plus aria-hidden />
                New task
                <CommandShortcut>C</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  close()
                  setCreateProjectOpen(true)
                }}
              >
                <Plus aria-hidden />
                New project
              </CommandItem>
            </CommandGroup>
          ) : null}

          {grouped.projects.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading={`Projects · ${organizationName ?? ''}`}>
                {grouped.projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={`project ${project.name} ${project.key}`}
                    onSelect={() => go(`/app/projects/${project.id}/board`)}
                  >
                    <FolderKanban aria-hidden />
                    <span className="truncate">{project.name}</span>
                    <Badge variant="muted" className="ml-auto font-mono">
                      {project.key}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}

          {grouped.tasks.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Tasks">
                {grouped.tasks.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`task ${task.title}`}
                    onSelect={() => {
                      close()
                      navigate(`/app/projects/${task.project_id}/board?task=${task.id}`)
                    }}
                  >
                    <Search aria-hidden />
                    <span className="truncate">{task.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>

      <CreateProjectDialog open={createProjectOpen} onOpenChange={setCreateProjectOpen} />
    </>
  )
}
