import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Boxes,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Plus,
  Settings,
  Users,
  UsersRound,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/database'

import { useProjectsSidebar } from '@/features/projects/queries'
import { usePermission } from '@/features/organizations/workspace-context'

import { WorkspaceSwitcher } from './workspace-switcher'
import { CreateProjectDialog } from '@/features/projects/components/create-project-dialog'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const PRIMARY: NavItem[] = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/my-tasks', label: 'My tasks', icon: CheckSquare },
  { to: '/app/inbox', label: 'Inbox', icon: Inbox },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
]

const WORKSPACE: NavItem[] = [
  { to: '/app/projects', label: 'Projects', icon: FolderKanban, end: true },
  { to: '/app/teams', label: 'Teams', icon: UsersRound },
  { to: '/app/members', label: 'Members', icon: Users },
  { to: '/app/reports', label: 'Reports', icon: BarChart3 },
]

export function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const { can } = usePermission()
  const { data: projects } = useProjectsSidebar()
  const [createOpen, setCreateOpen] = useState(false)
  const location = useLocation()

  const canCreateProject = can('projects.create')

  return (
    <div className="flex h-full flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 px-3">
        <WorkspaceSwitcher collapsed={collapsed} />
      </div>

      <ScrollArea className="flex-1">
        <nav aria-label="Main" className="flex flex-col gap-5 px-2 py-3">
          <NavGroup items={PRIMARY} collapsed={collapsed} />

          <NavGroup
            label="Projects"
            collapsed={collapsed}
            items={[{ to: '/app/projects', label: 'All projects', icon: Boxes, end: true }]}
            action={
              canCreateProject ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="New project"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus />
                </Button>
              ) : null
            }
          >
            <ul className="mt-0.5 space-y-0.5">
              {(projects ?? []).map((project) => (
                <li key={project.id}>
                  <ProjectLink project={project} collapsed={collapsed} />
                </li>
              ))}
              {projects && projects.length === 0 ? (
                <li className={cn('px-2 py-1 text-xs text-muted-foreground', collapsed && 'hidden')}>
                  No projects yet
                </li>
              ) : null}
            </ul>
          </NavGroup>

          <NavGroup label="Workspace" collapsed={collapsed} items={WORKSPACE} />

          <div className="border-t pt-2">
            <NavItemLink to="/app/settings" label="Settings" icon={Settings} collapsed={collapsed} />
          </div>
        </nav>
      </ScrollArea>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full justify-start gap-2 text-muted-foreground', collapsed && 'justify-center px-0')}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed ? <span className="text-xs">Collapse</span> : null}
        </Button>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />

      <span className="sr-only" aria-live="polite">
        {location.pathname}
      </span>
    </div>
  )
}

function NavGroup({
  label,
  items,
  collapsed,
  action,
  children,
}: {
  label?: string
  items: NavItem[]
  collapsed: boolean
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div>
      {label && !collapsed ? (
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {label}
          </span>
          {action}
        </div>
      ) : (
        action && <div className="flex justify-center pb-1">{action}</div>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavItemLink {...item} collapsed={collapsed} />
          </li>
        ))}
      </ul>
      {children}
    </div>
  )
}

function NavItemLink({
  to,
  label,
  icon: Icon,
  collapsed,
  end,
}: NavItem & { collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed ? <span className="truncate">{label}</span> : <span className="sr-only">{label}</span>}
    </NavLink>
  )
}

function ProjectLink({ project, collapsed }: { project: Project; collapsed: boolean }) {
  const to = `/app/projects/${project.id}/board`

  if (collapsed) {
    return (
      <NavLink
        to={to}
        title={project.name}
        className={({ isActive }) =>
          cn(
            'flex items-center justify-center rounded-md py-1.5 text-xs font-semibold transition-colors',
            isActive
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-muted-foreground hover:bg-sidebar-accent/60',
          )
        }
      >
        {project.key.slice(0, 2)}
        <span className="sr-only">{project.name}</span>
      </NavLink>
    )
  }

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
        )
      }
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] font-semibold text-muted-foreground">
        {project.key.slice(0, 2)}
      </span>
      <span className="truncate">{project.name}</span>
    </NavLink>
  )
}