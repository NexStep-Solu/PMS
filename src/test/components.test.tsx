import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'

import { AppProviders } from '@/app/providers'
import { TaskDialogProvider } from '@/features/tasks/task-dialog-context'
import { LoginForm } from '@/features/auth/components/login-form'
import { StatusBadge, PriorityBadge } from '@/components/shared/badges'
import { EmptyState, ErrorState } from '@/components/shared/states'
import { TaskCard } from '@/features/tasks/components/kanban-board'
import { KanbanBoard } from '@/features/tasks/components/kanban-board'
import { DataTable } from '@/components/data-table/data-table'
import type { TaskStatus } from '@/types/database'
import type { TaskWithMeta } from '@/features/tasks/utils'

/**
 * Smoke tests. These are not exhaustive behaviour tests — they exist to catch
 * runtime errors (bad hooks, undefined imports, provider mistakes) that a type
 * check cannot see.
 */

function renderWithProviders(ui: ReactElement) {
  return render(
    <AppProviders>
      <TaskDialogProvider>{ui}</TaskDialogProvider>
    </AppProviders>,
  )
}

const STATUS_NAMES: Record<TaskStatus['category'], string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
}

const status = (category: TaskStatus['category'], isCompleted = false): TaskStatus => ({
  id: category,
  organization_id: 'org',
  project_id: null,
  name: STATUS_NAMES[category],
  key: category,
  category,
  color: null,
  position: 1,
  is_default: true,
  is_completed: isCompleted,
})

const makeTask = (overrides: Partial<TaskWithMeta> = {}): TaskWithMeta =>
  ({
    id: 'task-1',
    organization_id: 'org',
    project_id: 'prj-1',
    parent_task_id: null,
    title: 'Implement authentication',
    description: null,
    status_id: 'todo',
    priority_id: 'pr-high',
    assignee_id: 'user-1',
    reporter_id: 'user-2',
    start_date: null,
    due_date: null,
    estimated_minutes: null,
    position: 1,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: status('todo'),
    priority: { id: 'pr-high', organization_id: 'org', name: 'High', key: 'high', level: 2, position: 2 },
    assignee: { id: 'user-1', full_name: 'Arkar Min', avatar_url: null },
    labels: [],
    ...overrides,
  }) as TaskWithMeta

describe('badges', () => {
  it('shows status as text, not colour alone', () => {
    render(<StatusBadge status={status('in_progress')} />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('falls back gracefully without a status', () => {
    render(<StatusBadge status={null} />)
    expect(screen.getByText('No status')).toBeInTheDocument()
  })

  it('shows the priority name', () => {
    render(<PriorityBadge priority={{ name: 'Urgent', key: 'urgent', level: 1 } as never} />)
    expect(screen.getByText('Urgent')).toBeInTheDocument()
  })
})

describe('states', () => {
  it('renders an actionable empty state', () => {
    render(<EmptyState title="No projects yet" description="Create your first project." />)
    expect(screen.getByText('No projects yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first project.')).toBeInTheDocument()
  })

  it('renders a retryable error state', () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})

describe('login form', () => {
  it('reports invalid credentials without leaking internals', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'arkarmin@pms.dev')
    await user.type(screen.getByLabelText('Password'), 'definitely-wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(
      () => expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument(),
      { timeout: 4000 },
    )
    expect(screen.queryByText(/supabase|postgres/i)).not.toBeInTheDocument()
  })

  it('signs in with valid credentials', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'arkarmin@pms.dev')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(
      () => expect(screen.queryByText(/incorrect email or password/i)).not.toBeInTheDocument(),
      { timeout: 4000 },
    )
  })

  it('validates before hitting the network', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument()
  })
})

describe('task card', () => {
  it('renders title, priority and assignee', () => {
    render(<TaskCard task={makeTask()} />)
    expect(screen.getByText('Implement authentication')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('flags an overdue task for assistive tech', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    render(<TaskCard task={makeTask({ due_date: yesterday.toISOString().slice(0, 10) })} />)
    expect(screen.getByRole('article', { name: /overdue/i })).toBeInTheDocument()
  })
})

describe('kanban board', () => {
  it('renders a column per status with counts', () => {
    renderWithProviders(
      <KanbanBoard
        tasks={[makeTask()]}
        statuses={[status('todo'), status('in_progress'), status('done', true)]}
        canUpdate
      />,
    )

    const board = screen.getByRole('list', { name: /task board/i })
    expect(within(board).getByText('Todo')).toBeInTheDocument()
    expect(within(board).getByText('In Progress')).toBeInTheDocument()
    expect(within(board).getByLabelText('Done, 0 tasks')).toBeInTheDocument()
    expect(within(board).getByText('Implement authentication')).toBeInTheDocument()
  })
})

describe('data table', () => {
  it('renders headers and rows, and calls back on click', async () => {
    const user = userEvent.setup()
    const onRowClick = vi.fn()
    const rows: { name: string }[] = [{ name: 'First' }, { name: 'Second' }]

    render(
      <DataTable
        data={rows}
        columns={[{ accessorKey: 'name', header: 'Name' }]}
        rowKey={(row) => row.name}
        onRowClick={onRowClick}
      />,
    )

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    await user.click(screen.getByText('First'))
    expect(onRowClick).toHaveBeenCalledWith({ name: 'First' })
  })

  it('shows the empty message when there is nothing to show', () => {
    render(
      <DataTable
        data={[] as { name: string }[]}
        columns={[{ accessorKey: 'name', header: 'Name' }]}
        rowKey={(row: { name: string }) => row.name}
        emptyMessage="No tasks match these filters."
      />,
    )
    expect(screen.getByText('No tasks match these filters.')).toBeInTheDocument()
  })
})