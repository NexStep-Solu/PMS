import { describe, expect, it } from 'vitest'

import { nullable, optionalNullable } from '@/lib/utils'
import { projectChanges, projectPatch } from '@/features/projects/patch'
import { taskChanges, taskPatch } from '@/features/tasks/patch'
import { AppError, friendlyMessage, toAppError } from '@/lib/db/errors'
import { mapError } from '@/lib/db/supabase-adapter'

/**
 * `invalid input syntax for type uuid: ""` reached a real user because a
 * project's owner select can hand back an empty string, and the write path used
 * `value ?? null` — which keeps `''`. These tests pin the rule: a nullable
 * column is never written as an empty string.
 */

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Anything written to a nullable column must be null or a usable value. */
function assertNoEmptyStrings(row: Record<string, unknown>, label: string) {
  for (const [column, value] of Object.entries(row)) {
    expect(value, `${label}.${column} must not be an empty string`).not.toBe('')
  }
}

describe('nullable()', () => {
  it('turns empty and whitespace-only strings into null', () => {
    expect(nullable('')).toBeNull()
    expect(nullable('   ')).toBeNull()
    expect(nullable(null)).toBeNull()
    expect(nullable(undefined)).toBeNull()
  })

  it('keeps real values', () => {
    expect(nullable('abc')).toBe('abc')
    expect(nullable(0)).toBe(0)
    expect(nullable(false)).toBe(false)
    expect(nullable('2f1c9a44-1111-4222-8333-444444444444')).toBe(
      '2f1c9a44-1111-4222-8333-444444444444',
    )
  })

  it('optionalNullable preserves undefined so a key can be omitted', () => {
    expect(optionalNullable(undefined)).toBeUndefined()
    expect(optionalNullable('')).toBeNull()
    expect(optionalNullable('x')).toBe('x')
  })
})

describe('project writes', () => {
  const base = {
    name: 'Website',
    key: 'WEB',
    status: 'planned' as const,
    priority: 'medium' as const,
  }

  it('never writes an empty string, whatever the form returns', () => {
    const cases = [
      { ...base, ownerId: '' },
      { ...base, startDate: '', dueDate: '' },
      { ...base, description: '' },
      { ...base, ownerId: '', startDate: '', dueDate: '', description: '' },
    ]

    for (const values of cases) {
      const row = projectPatch(values)
      assertNoEmptyStrings(row, 'projectPatch')
    }
  })

  it('nulls an unassigned owner instead of sending ""', () => {
    expect(projectPatch({ ...base, ownerId: '' }).owner_id).toBeNull()
    expect(projectPatch({ ...base, ownerId: undefined }).owner_id).toBeNull()
    expect(projectPatch({ ...base, ownerId: 'u-1' }).owner_id).toBe('u-1')
  })

  it('nulls empty dates and descriptions', () => {
    const row = projectPatch({ ...base, startDate: '', dueDate: '', description: '' })
    expect(row.start_date).toBeNull()
    expect(row.due_date).toBeNull()
    expect(row.description).toBeNull()
  })

  it('omits keys that were not provided on update', () => {
    const changes = projectChanges({ name: 'Renamed' })
    expect(Object.keys(changes)).toEqual(['name'])

    assertNoEmptyStrings(projectChanges({ ownerId: '' }), 'projectChanges')
    expect(projectChanges({ ownerId: '' }).owner_id).toBeNull()
    expect(projectChanges({ dueDate: undefined })).toEqual({})
  })

  it('keeps the required columns intact', () => {
    const row = projectPatch({ ...base, ownerId: '' })
    expect(row.name).toBe('Website')
    expect(row.key).toBe('WEB')
    expect(row.status).toBe('planned')
    expect(row.priority).toBe('medium')
  })
})

describe('task writes', () => {
  const base = {
    title: 'Ship it',
    projectId: 'p1',
    statusId: 's1',
  }

  it('never writes an empty string', () => {
    const cases = [
      { ...base, assigneeId: '', priorityId: '' },
      { ...base, parentTaskId: '', startDate: '', dueDate: '' },
      { ...base, assigneeId: '', priorityId: '', parentTaskId: '', description: '' },
    ]

    for (const values of cases) {
      assertNoEmptyStrings(taskPatch({ ...values, userId: 'u-1' }, 'org-1'), 'taskPatch')
    }
  })

  it('nulls empty ids rather than sending ""', () => {
    const row = taskPatch({ ...base, assigneeId: '', priorityId: '', userId: 'u-1' }, 'org-1')
    expect(row.assignee_id).toBeNull()
    expect(row.priority_id).toBeNull()
    expect(row.organization_id).toBe('org-1')
    expect(row.reporter_id).toBe('u-1')
  })

  it('keeps a real uuid when one is given', () => {
    const id = '2f1c9a44-1111-4222-8333-444444444444'
    expect(taskPatch({ ...base, assigneeId: id, userId: 'u-1' }, 'org-1').assignee_id).toMatch(UUID_LIKE)
  })

  it('nulls empty values on update', () => {
    assertNoEmptyStrings(taskChanges({ assigneeId: '', dueDate: '' }), 'taskChanges')
    expect(taskChanges({ assigneeId: '' }).assignee_id).toBeNull()
    expect(taskChanges({ position: 500 })).toEqual({ position: 500 })
  })
})

describe('database errors never leak SQL text', () => {
  it('hides an invalid_text_representation message behind a plain sentence', () => {
    const error = toAppError({
      message: 'invalid input syntax for type uuid: ""',
      code: '22P02',
      details: null,
    })

    const message = friendlyMessage(error)
    expect(message).not.toContain('uuid')
    expect(message).not.toContain('syntax')
    expect(message).toMatch(/format/i)
    // The technical detail is still available for the console.
    expect(error.message).toContain('invalid input syntax')
  })

  it('hides a missing-relation error too', () => {
    const error = toAppError({ message: 'relation "tasks" does not exist', code: '42P01' })
    expect(friendlyMessage(error)).not.toContain('relation')
  })

  it('still echoes our own validation messages', () => {
    const error = new AppError('validation', 'Give the project a name')
    expect(friendlyMessage(error)).toBe('Give the project a name')
  })

  it('still echoes auth messages, which are written for humans', () => {
    // The adapter tags these `source: 'auth'`; they are already user-facing.
    const error = new AppError('validation', 'Incorrect email or password.', {
      code: 'invalid_credentials',
      source: 'auth',
    })
    expect(friendlyMessage(error)).toBe('Incorrect email or password.')
  })

  it('a database error with no curated hint falls back to the generic copy', () => {
    const error = mapError({ message: 'something internal', code: '42601' })
    expect(error.source).toBe('database')
    expect(friendlyMessage(error)).not.toContain('internal')
  })

  it('survives the adapter retag without losing the curated hint', () => {
    // Regression: mapError used to rebuild the error and drop `userMessage`,
    // so the user got a vague message instead of the explanation.
    const error = mapError({ message: 'invalid input syntax for type uuid: ""', code: '22P02' })
    expect(error.source).toBe('database')
    expect(friendlyMessage(error)).toMatch(/format/i)
  })
})