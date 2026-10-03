import { Building2, Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ROLE_LABELS } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { Workspace } from '@/features/auth/queries'

import { useWorkspace } from '@/features/organizations/workspace-context'
import { CreateWorkspaceDialog } from '@/features/organizations/components/create-workspace-dialog'

export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { workspaces, workspace, setActiveOrganization } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const current = workspace?.organization
  const label = current?.name ?? 'Select workspace'

  if (workspaces.length <= 1) {
    return (
      <div className={cn('flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5', collapsed && 'justify-center px-0')}>
        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-primary/12 text-primary">
          <Building2 className="size-3.5" aria-hidden />
        </span>
        {!collapsed ? <span className="truncate text-sm font-medium">{label}</span> : null}
        {collapsed ? <span className="sr-only">{label}</span> : null}
      </div>
    )
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn('h-9 w-full justify-start gap-2 px-2', collapsed && 'justify-center px-0')}
            aria-label={`Workspace: ${label}`}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded bg-primary/12 text-primary">
              <Building2 className="size-3.5" aria-hidden />
            </span>
            {!collapsed ? (
              <>
                <span className="truncate text-sm font-medium">{label}</span>
                <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </>
            ) : null}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((item) => (
            <WorkspaceOption
              key={item.organization.id}
              item={item}
              selected={item.organization.id === current?.id}
              onSelect={() => {
                setActiveOrganization(item.organization.id)
                setOpen(false)
              }}
            />
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              setCreateOpen(true)
            }}
          >
            <Plus aria-hidden />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setActiveOrganization(id)
          setCreateOpen(false)
        }}
      />
    </>
  )
}

function WorkspaceOption({
  item,
  selected,
  onSelect,
}: {
  item: Workspace
  selected: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold uppercase">
        {item.organization.name.slice(0, 2)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{item.organization.name}</span>
        <span className="block text-xs text-muted-foreground">{ROLE_LABELS[item.role]}</span>
      </span>
      {selected ? <Check className="size-4 text-primary" aria-hidden /> : null}
    </DropdownMenuItem>
  )
}
