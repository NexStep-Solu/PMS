import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Kbd } from '@/components/shared/kbd'
import { PageHeader } from '@/components/shared/page-header'
import { CreateTaskDialog } from '@/features/tasks/components/create-task-dialog'
import { TaskDetailDrawer } from '@/features/tasks/components/task-detail-drawer'
import { TaskDialogProvider, useTaskDialog } from '@/features/tasks/task-dialog-context'
import { usePermission, useWorkspace } from '@/features/organizations/workspace-context'
import { Breadcrumbs } from '@/components/shared/page-header'
import { useProjectHeader } from '@/features/projects/project-header'
import { useRealtimeSync } from '@/features/realtime/use-realtime-sync'

import { NotificationBell } from './notification-bell'
import { SearchCommand } from './search-command'
import { Sidebar } from './sidebar'
import { UserMenu } from './user-menu'

const SIDEBAR_STORAGE_KEY = 'pms-sidebar-collapsed'

/**
 * The provider wraps the layout because the keyboard shortcut and the topbar
 * both need the task dialog, and the provider needs a router context for the
 * `?task=` search param.
 */
export function AppShell() {
  return (
    <TaskDialogProvider>
      <AppShellLayout />
    </TaskDialogProvider>
  )
}

function AppShellLayout() {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1',
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const { openCreate: openTaskCreate } = useTaskDialog()

  // One subscription per workspace, opened here rather than per component.
  useRealtimeSync()

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  // Global shortcuts: ⌘K / Ctrl+K opens search, `C` opens the quick-create
  // dialog, both only when the user is not typing somewhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((open) => !open)
        return
      }

      if (typing || event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault()
        openTaskCreate()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openTaskCreate])

  return (
    <>
      <div className="flex h-dvh overflow-hidden bg-background">
        {/* Persistent sidebar on desktop */}
        <aside className="hidden w-64 shrink-0 lg:block" style={collapsed ? { width: '4rem' } : undefined}>
          <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            {/* Drawer navigation on mobile */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 lg:hidden" showClose={false}>
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Sidebar collapsed={false} onToggleCollapsed={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <TopbarBreadcrumbs />

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden h-8 w-56 items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent sm:flex"
              >
                <Search className="size-3.5" aria-hidden />
                <span>Search…</span>
                <Kbd className="ml-auto">⌘K</Kbd>
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                aria-label="Search"
                onClick={() => setCommandOpen(true)}
              >
                <Search />
              </Button>

              <NotificationBell />
              <UserMenu />
            </div>
          </header>

          <main data-slot="app-main" className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>

      <SearchCommand open={commandOpen} onOpenChange={setCommandOpen} />
      <CreateTaskDialog />
      <TaskDetailDrawer />
    </>
  )
}

function TopbarBreadcrumbs() {
  const location = useLocation()
  const projectCrumbs = useProjectHeader()
  const { workspace } = useWorkspace()
  const { openCreate } = useTaskDialog()
  const { can } = usePermission()

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="min-w-0 flex-1 overflow-hidden">
        <Breadcrumbs
          items={
            projectCrumbs.length > 0
              ? projectCrumbs
              : [{ label: workspace?.organization.name ?? 'PMS' }]
          }
        />
      </div>

      {can('tasks.create') ? (
        <Button size="sm" className="hidden sm:inline-flex" onClick={() => openCreate()}>
          <Plus aria-hidden />
          New task
        </Button>
      ) : null}

      <span className="sr-only" aria-live="polite">
        {location.pathname}
      </span>
    </div>
  )
}

export { PageHeader }