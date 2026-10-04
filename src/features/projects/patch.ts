/**
 * Turns validated form values into a Postgres row.
 *
 * Kept separate from the mutation so the shaping rules are reviewable and
 * testable on their own. The one rule that matters: a nullable column is
 * written with `nullable()`, never `??`. Selects and date pickers hand back
 * empty strings surprisingly often, and `'' ?? null` is still `''` — which
 * Postgres rejects with `invalid input syntax for type uuid: ""`.
 */

import { nullable } from '@/lib/utils'

import type { CreateProjectValues, UpdateProjectValues } from './schemas'

export function projectPatch(values: CreateProjectValues): Record<string, unknown> {
  return {
    name: values.name,
    key: values.key,
    description: nullable(values.description),
    status: values.status,
    priority: values.priority,
    start_date: nullable(values.startDate),
    due_date: nullable(values.dueDate),
    owner_id: nullable(values.ownerId),
  }
}

/** Partial update: only the keys the caller actually provided are sent. */
export function projectChanges(values: UpdateProjectValues): Record<string, unknown> {
  const changes: Record<string, unknown> = {}

  if (values.name !== undefined) changes.name = values.name
  if (values.key !== undefined) changes.key = values.key
  if (values.description !== undefined) changes.description = nullable(values.description)
  if (values.status !== undefined) changes.status = values.status
  if (values.priority !== undefined) changes.priority = values.priority
  if (values.startDate !== undefined) changes.start_date = nullable(values.startDate)
  if (values.dueDate !== undefined) changes.due_date = nullable(values.dueDate)
  if (values.ownerId !== undefined) changes.owner_id = nullable(values.ownerId)

  return changes
}