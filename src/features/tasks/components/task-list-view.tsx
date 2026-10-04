import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus, SlidersHorizontal } from 'lucide-react'

import { DataTable } from '@/components/data-table/data-table'
import { LabelBadge, PriorityBadge, StatusBadge } from '@/components/shared/badges'
import { UserAvatar } from '@/components/shared/user-avatar'
import { EmptyState } from '@/components/shared/states'
import { PaginationBar } from '@/components/shared/pagination-bar'
import { usePagination } from '@/hooks/use-pagination'
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
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

import { useMemberOptions } from '@/features/organizations/queries'

import { dueLabel, dueState } from '../utils'
import type { TaskWithMeta } from '../utils'
import type { TaskStatus } from '@/types/database'
import { useTaskDialog } from '../task-dialog-context'

const TOGGLEABLE = {
  priority: 'Priority',
  project: 'Project',
  due: 'Due date',
  labels: 'Labels',
  assignee: 'Assignee',
}

export function TaskListView({
  tasks,
  statuses,
  projectNames,
  canUpdate,
  projectId,
}: {
  tasks: TaskWithMeta[]
  statuses: TaskStatus[]
  projectNames: Record<string, string>
  canUpdate: boolean
  /**
   * The project this list belongs to. Passing it keeps "New task" scoped here;
   * without it the dialog falls back to the first project in the workspace and
   * the task silently lands somewhere else.
   */
  projectId?: string
}) {
  const { openTask, openCreate } = useTaskDialog()
  const members = useMemberOptions()
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search, 200)
  const [statusIds, setStatusIds] = useState<string[]>([])
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [overdueOnly, setOverdueOnly] = useState(false)
  const pager = usePagination(25)

  // Any filter change invalidates the current page number, otherwise page 4 of an
  // old result set shows an empty table.
  const filterKey = `${term}|${statusIds.join(',')}|${assigneeIds.join(',')}|${overdueOnly}`
  const lastFilterKey = useRef(filterKey)
  useEffect(() => {
    if (lastFilterKey.current !== filterKey) {
      lastFilterKey.current = filterKey
      pager.reset()
    }
  }, [filterKey, pager])

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return tasks.filter((task) => {
      if (needle && !task.title.toLowerCase().includes(needle)) return false
      if (statusIds.length > 0 && !statusIds.includes(task.status_id)) return false
      if (assigneeIds.length > 0 && (!task.assignee_id || !assigneeIds.includes(task.assignee_id))) return false
      if (overdueOnly && dueState(task, task.status) !== 'overdue') return false
      return true
    })
  }, [tasks, term, statusIds, assigneeIds, overdueOnly])

  const columns = useMemo<ColumnDef<TaskWithMeta, unknown>[]>(
    () => [
      {
        id: 'title',
        accessorFn: (task) => task.title,
        header: 'Task',
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{row.original.title}</span>
            {row.original.parent_task_id ? (
              <Badge variant="muted" className="shrink-0">
                Subtask
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: 'status',
        accessorFn: (task) => task.status.position,
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
      },
      {
        id: 'priority',
        accessorFn: (task) => task.priority?.level ?? 99,
        header: 'Priority',
        cell: ({ row }) =>
          row.original.priority ? (
            <PriorityBadge priority={row.original.priority} size="sm" />
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'assignee',
        accessorFn: (task) => task.assignee?.full_name ?? '',
        header: 'Assignee',
        cell: ({ row }) =>
          row.original.assignee ? (
            <span className="inline-flex items-center gap-1.5">
              <UserAvatar person={row.original.assignee} size={20} />
              <span className="truncate">{row.original.assignee.full_name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          ),
      },
      {
        id: 'project',
        accessorFn: (task) => projectNames[task.project_id] ?? task.project?.name ?? '',
        header: 'Project',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {projectNames[row.original.project_id] ?? row.original.project?.name ?? '—'}
          </span>
        ),
      },
      {
        id: 'due',
        accessorFn: (task) => task.due_date ?? 'zzzz',
        header: 'Due',
        cell: ({ row }) => {
          const state = dueState(row.original, row.original.status)
          if (state === 'none') return <span className="text-muted-foreground">—</span>
          return (
            <span
              className={cn(
                'tabular',
                state === 'overdue' && 'font-medium text-destructive',
                state === 'today' && 'text-priority-high',
              )}
            >
              {dueLabel(row.original.due_date)}
            </span>
          )
        },
      },
      {
        id: 'labels',
        enableSorting: false,
        header: 'Labels',
        cell: ({ row }) => {
          const labels = row.original.labels.filter((link) => link.label)
          if (labels.length === 0) return <span className="text-muted-foreground">—</span>
          return (
            <span className="flex gap-1">
              {labels.slice(0, 2).map((link) => (
                <LabelBadge key={link.label_id} label={link.label as { name: string; color: string }} />
              ))}
              {labels.length > 2 ? (
                <span className="text-xs text-muted-foreground">+{labels.length - 2}</span>
              ) : null}
            </span>
          )
        },
      },
    ],
    [projectNames],
  )

  const activeFilters = statusIds.length + assigneeIds.length + (overdueOnly ? 1 : 0) + (term.trim() ? 1 : 0)

  const clearFilters = () => {
    setStatusIds([])
    setAssigneeIds([])
    setOverdueOnly(false)
    setSearch('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter tasks…"
          className="h-9 w-full max-w-xs"
          aria-label="Filter tasks"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SlidersHorizontal aria-hidden />
              Filters
              {activeFilters > 0 ? (
                <Badge variant="default" className="ml-1">
                  {activeFilters}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            {statuses.map((status) => (
              <DropdownMenuCheckboxItem
                key={status.id}
                checked={statusIds.includes(status.id)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(value) =>
                  setStatusIds((current) =>
                    value === true
                      ? [...current, status.id]
                      : current.filter((id) => id !== status.id),
                  )
                }
              >
                {status.name}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Assignee</DropdownMenuLabel>
            {members.slice(0, 8).map((member) => (
              <DropdownMenuCheckboxItem
                key={member.id}
                checked={assigneeIds.includes(member.id)}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(value) =>
                  setAssigneeIds((current) =>
                    value === true ? [...current, member.id] : current.filter((id) => id !== member.id),
                  )
                }
              >
                {member.full_name ?? 'Unknown'}
              </DropdownMenuCheckboxItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={overdueOnly}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(value) => setOverdueOnly(value === true)}
            >
              Overdue only
            </DropdownMenuCheckboxItem>

            {activeFilters > 0 ? (
              <>
                <DropdownMenuSeparator />
                <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-sm text-muted-foreground tabular">
          {filtered.length} of {tasks.length}
        </span>

        {canUpdate ? (
          <Button size="sm" className="ml-auto" onClick={() => openCreate({ projectId })}>
            <Plus aria-hidden />
            New task
          </Button>
        ) : null}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create the first task for this project and it will appear here."
          action={
            canUpdate ? (
              <Button size="sm" onClick={() => openCreate({ projectId })}>
                <Plus aria-hidden />
                New task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
        <DataTable
          data={filtered.slice(pager.from, pager.to + 1)}
          columns={columns}
          togglableColumns={TOGGLEABLE}
          rowKey={(task) => task.id}
          onRowClick={(task) => openTask(task.id)}
          emptyMessage="No tasks match these filters."
        />
        <PaginationBar
          total={filtered.length}
          rowCount={Math.min(pager.pageSize, Math.max(0, filtered.length - pager.from))}
          page={pager.page}
          pageSize={pager.pageSize}
          onPageChange={pager.setPage}
          onPageSizeChange={pager.setPageSize}
          label="tasks"
          className="mt-3"
        />
        </>
      )}
    </div>
  )
}