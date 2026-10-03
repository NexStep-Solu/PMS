import { z } from 'zod'

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date')

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(2, 'Give the task a title').max(200, 'That title is too long'),
    description: z.string().trim().max(5000).optional(),
    projectId: z.string().min(1, 'Choose a project'),
    statusId: z.string().min(1, 'Choose a status'),
    priorityId: z.string().optional(),
    assigneeId: z.string().optional(),
    parentTaskId: z.string().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    estimatedMinutes: z.coerce.number().int().min(0).max(100000).optional(),
    labelIds: z.array(z.string()).optional(),
  })
  .refine((values) => !values.startDate || !values.dueDate || values.dueDate >= values.startDate, {
    path: ['dueDate'],
    message: 'The due date must be after the start date',
  })
export type CreateTaskValues = z.infer<typeof createTaskSchema>

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    statusId: z.string().min(1).optional(),
    priorityId: z.string().nullable().optional(),
    assigneeId: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    estimatedMinutes: z.coerce.number().int().min(0).max(100000).nullable().optional(),
    labelIds: z.array(z.string()).optional(),
    position: z.number().optional(),
    parentTaskId: z.string().nullable().optional(),
    projectId: z.string().min(1).optional(),
  })
  .refine((values) => !values.startDate || !values.dueDate || values.dueDate >= values.startDate, {
    path: ['dueDate'],
    message: 'The due date must be after the start date',
  })
export type UpdateTaskValues = z.infer<typeof updateTaskSchema>

export const commentSchema = z.object({
  content: z.string().trim().min(1, 'Write something first').max(5000, 'That comment is too long'),
})
export type CommentValues = z.infer<typeof commentSchema>

export const checklistItemSchema = z.object({
  title: z.string().trim().min(1, 'Add a title').max(200),
})
export type ChecklistItemValues = z.infer<typeof checklistItemSchema>

export const timeEntrySchema = z
  .object({
    projectId: z.string().min(1, 'Choose a project'),
    taskId: z.string().optional(),
    startedAt: z.string().min(1, 'Start time is required'),
    endedAt: z.string().optional(),
    durationMinutes: z.coerce.number().int().min(0).max(100000).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((values) => !values.endedAt || values.endedAt >= values.startedAt, {
    path: ['endedAt'],
    message: 'The end time must be after the start time',
  })
export type TimeEntryValues = z.infer<typeof timeEntrySchema>

export const milestoneSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the milestone a name').max(120),
    description: z.string().trim().max(1000).optional(),
    dueDate: dateKey,
    status: z.enum(['planned', 'in_progress', 'completed']),
  })
  .refine((values) => dateKey.safeParse(values.dueDate).success, {
    path: ['dueDate'],
    message: 'Choose a due date',
  })
export type MilestoneValues = z.infer<typeof milestoneSchema>

export const taskFilterSchema = z.object({
  search: z.string().default(''),
  statusIds: z.array(z.string()).default([]),
  priorityIds: z.array(z.string()).default([]),
  assigneeIds: z.array(z.string()).default([]),
  labelIds: z.array(z.string()).default([]),
  dueWithinDays: z.number().int().min(0).max(365).nullable().default(null),
  overdue: z.boolean().default(false),
  includeSubtasks: z.boolean().default(false),
})
export type TaskFilterValues = z.infer<typeof taskFilterSchema>

export const EMPTY_TASK_FILTERS: TaskFilterValues = {
  search: '',
  statusIds: [],
  priorityIds: [],
  assigneeIds: [],
  labelIds: [],
  dueWithinDays: null,
  overdue: false,
  includeSubtasks: false,
}

export function countActiveFilters(filters: TaskFilterValues): number {
  let count = 0
  if (filters.search.trim()) count += 1
  count += filters.statusIds.length
  count += filters.priorityIds.length
  count += filters.assigneeIds.length
  count += filters.labelIds.length
  if (filters.dueWithinDays !== null) count += 1
  if (filters.overdue) count += 1
  return count
}