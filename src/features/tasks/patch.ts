/**
 * Task write shaping. Same rule as `features/projects/patch.ts`: every
 * nullable column goes through `nullable()` so an empty string from a select
 * or date picker can never reach Postgres as `''`.
 */

import { nullable } from '@/lib/utils'

import type { CreateTaskValues, UpdateTaskValues } from './schemas'

export function taskPatch(
  values: CreateTaskValues & { userId: string; position?: number },
  organizationId: string,
): Record<string, unknown> {
  return {
    organization_id: organizationId,
    project_id: nullable(values.projectId),
    parent_task_id: nullable(values.parentTaskId),
    title: values.title,
    description: nullable(values.description),
    status_id: nullable(values.statusId),
    priority_id: nullable(values.priorityId),
    assignee_id: nullable(values.assigneeId),
    reporter_id: values.userId,
    start_date: nullable(values.startDate),
    due_date: nullable(values.dueDate),
    estimated_minutes: nullable(values.estimatedMinutes),
    position: values.position ?? 1000,
  }
}

/** Partial update: only the keys the caller actually provided are sent. */
export function taskChanges(values: UpdateTaskValues): Record<string, unknown> {
  const patch: Record<string, unknown> = {}

  if (values.title !== undefined) patch.title = values.title
  if (values.description !== undefined) patch.description = nullable(values.description)
  if (values.statusId !== undefined) patch.status_id = nullable(values.statusId)
  if (values.priorityId !== undefined) patch.priority_id = nullable(values.priorityId)
  if (values.assigneeId !== undefined) patch.assignee_id = nullable(values.assigneeId)
  if (values.startDate !== undefined) patch.start_date = nullable(values.startDate)
  if (values.dueDate !== undefined) patch.due_date = nullable(values.dueDate)
  if (values.estimatedMinutes !== undefined) patch.estimated_minutes = nullable(values.estimatedMinutes)
  if (values.position !== undefined) patch.position = values.position
  if (values.parentTaskId !== undefined) patch.parent_task_id = nullable(values.parentTaskId)
  if (values.projectId !== undefined) patch.project_id = nullable(values.projectId)

  return patch
}