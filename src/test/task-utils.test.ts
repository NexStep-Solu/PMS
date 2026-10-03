import { describe, expect, it } from 'vitest'
import { format, parseISO } from 'date-fns'

import { dueLabel, dueState, groupByStatus, positionBetween, summariseProgress, topLevelTasks, type TaskWithMeta } from '@/features/tasks/utils'
import { toDateKey, parseDateKey } from '@/components/shared/date-picker'
import { formatBytes, initials, sum, clamp, stringHash } from '@/lib/utils'
import { AppError, friendlyMessage, toAppError } from '@/lib/db/errors'
import { createTaskSchema, countActiveFilters, EMPTY_TASK_FILTERS } from '@/features/tasks/schemas'
import type { TaskStatus } from '@/types/database'

const status = (id: string, category: TaskStatus['category'], isCompleted = false, position = 1): TaskStatus => ({
  id,
  organization_id: 'org',
  project_id: null,
  name: id,
  key: id,
  category,
  color: null,
  position,
  is_default: false,
  is_completed: isCompleted,
})

const task = (overrides: Partial<TaskWithMeta>): TaskWithMeta =>
  ({
    id: 't',
    organization_id: 'org',
    project_id: 'p',
    parent_task_id: null,
    title: 'Task',
    description: null,
    status_id: 'todo',
    priority_id: null,
    assignee_id: null,
    reporter_id: 'u',
    start_date: null,
    due_date: null,
    estimated_minutes: null,
    position: 1,
    completed_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    status: status('todo', 'todo'),
    priority: null,
    assignee: null,
    labels: [],
    ...overrides,
  }) as TaskWithMeta

describe('dueState', () => {
  const today = new Date()
  const key = (offset: number) => {
    const date = new Date(today)
    date.setDate(date.getDate() + offset)
    return toDateKey(date)
  }

  it('treats a completed task as done even with a past due date', () => {
    expect(dueState({ due_date: '2020-01-01', completed_at: null }, status('done', 'done', true))).toBe(
      'done',
    )
  })

  it('detects overdue, today and upcoming', () => {
    expect(dueState({ due_date: key(-1), completed_at: null })).toBe('overdue')
    expect(dueState({ due_date: key(0), completed_at: null })).toBe('today')
    expect(dueState({ due_date: key(5), completed_at: null })).toBe('upcoming')
    expect(dueState({ due_date: null, completed_at: null })).toBe('none')
    expect(dueState({ due_date: 'not-a-date', completed_at: null })).toBe('none')
  })

  it('produces a human label relative to today', () => {
    expect(dueLabel(key(0), today)).toBe('Today')
    expect(dueLabel(key(1), today)).toBe('Tomorrow')
    expect(dueLabel(key(-1), today)).toBe('Yesterday')
    expect(dueLabel(key(3), today)).toBe('In 3 days')
    expect(dueLabel(key(-4), today)).toBe('4 days ago')
    expect(dueLabel(null, today)).toBe('No due date')
  })
})

describe('summariseProgress', () => {
  it('ignores cancelled work when measuring completion', () => {
    const summary = summariseProgress([
      task({ id: '1', status: status('done', 'done', true) }),
      task({ id: '2', status: status('doing', 'in_progress') }),
      task({ id: '3', status: status('nope', 'cancelled', true) }),
    ])
    expect(summary.total).toBe(3)
    expect(summary.done).toBe(1)
    expect(summary.inProgress).toBe(1)
    expect(summary.percent).toBe(33)
  })

  it('does not divide by zero', () => {
    expect(summariseProgress([])).toEqual({ total: 0, done: 0, inProgress: 0, overdue: 0, percent: 0 })
  })
})

describe('groupByStatus', () => {
  it('keeps every column present even when empty, ordered by position', () => {
    const statuses = [status('done', 'done', true, 3), status('todo', 'todo', false, 1), status('doing', 'in_progress', false, 2)]
    const grouped = groupByStatus([task({ status_id: 'todo' })], statuses)

    expect([...grouped.keys()]).toEqual(['todo', 'doing', 'done'])
    expect(grouped.get('todo')).toHaveLength(1)
    expect(grouped.get('done')).toHaveLength(0)
  })
})

describe('positionBetween', () => {
  it('appends, prepends and inserts between neighbours', () => {
    expect(positionBetween(null, null)).toBe(1000)
    expect(positionBetween(null, 1000)).toBe(500)
    expect(positionBetween(1000, null)).toBe(1500)
    expect(positionBetween(1000, 2000)).toBe(1500)
  })
})

describe('topLevelTasks', () => {
  it('excludes subtasks', () => {
    const parent = task({ id: 'parent', parent_task_id: null })
    const child = task({ id: 'child', parent_task_id: 'parent' })
    expect(topLevelTasks([parent, child]).map((entry) => entry.id)).toEqual(['parent'])
  })
})

describe('date keys', () => {
  it('round-trips without a UTC shift', () => {
    const date = new Date(2026, 0, 1, 23, 30)
    const value = toDateKey(date)
    expect(value).toBe('2026-01-01')
    expect(toDateKey(parseDateKey(value) as Date)).toBe(value)
  })

  it('returns null for unparseable input', () => {
    expect(parseDateKey(undefined)).toBeNull()
    expect(parseDateKey('nonsense')).toBeNull()
  })
})

describe('utils', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('builds initials', () => {
    expect(initials('Arkar Min')).toBe('AM')
    expect(initials('cher')).toBe('C')
    expect(initials(null)).toBe('?')
  })

  it('hashes strings deterministically', () => {
    expect(stringHash('pms')).toBe(stringHash('pms'))
    expect(stringHash('pms')).not.toBe(stringHash('other'))
  })

  it('sums and clamps', () => {
    expect(sum([1, 2, 3])).toBe(6)
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
  })
})

describe('errors', () => {
  it('classifies postgrest codes', () => {
    expect(toAppError({ message: 'nope', code: 'PGRST116' }).kind).toBe('not_found')
    expect(toAppError({ message: 'nope', code: '42501' }).kind).toBe('forbidden')
    expect(toAppError({ message: 'dup', code: '23505' }).kind).toBe('conflict')
  })

  it('never leaks raw database text to the user', () => {
    const error = new AppError('database', 'relation "tasks" does not exist')
    expect(friendlyMessage(error)).not.toContain('relation')
  })

  it('keeps validation messages verbatim', () => {
    expect(friendlyMessage(new AppError('validation', 'Enter a valid email address'))).toBe(
      'Enter a valid email address',
    )
  })

  it('detects network failures', () => {
    expect(toAppError(new Error('Failed to fetch')).kind).toBe('network')
  })
})

describe('task schema', () => {
  const valid = {
    title: 'Ship it',
    projectId: 'p1',
    statusId: 's1',
    labelIds: [],
  }

  it('accepts a minimal task', () => {
    expect(createTaskSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a short title', () => {
    const result = createTaskSchema.safeParse({ ...valid, title: 'a' })
    expect(result.success).toBe(false)
  })

  it('rejects a due date before the start date', () => {
    const result = createTaskSchema.safeParse({
      ...valid,
      startDate: '2026-05-10',
      dueDate: '2026-05-01',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['dueDate'])
    }
  })

  it('counts active filters for the filter badge', () => {
    expect(countActiveFilters(EMPTY_TASK_FILTERS)).toBe(0)
    expect(
      countActiveFilters({ ...EMPTY_TASK_FILTERS, search: 'x', statusIds: ['a', 'b'], overdue: true }),
    ).toBe(4)
  })
})

describe('activity metadata', () => {
  it('parses a date column back into a Date', () => {
    expect(format(parseISO('2026-04-01'), 'd MMM yyyy')).toBe('1 Apr 2026')
  })
})