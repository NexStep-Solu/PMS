import { z } from 'zod'

export const projectKeyRegex = /^[A-Z][A-Z0-9]{1,9}$/

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the project a name').max(120, 'That name is too long'),
    key: z
      .string()
      .trim()
      .toUpperCase()
      .regex(projectKeyRegex, 'Use 2–10 uppercase letters or digits, starting with a letter'),
    description: z.string().trim().max(1000, 'Keep the description short').optional(),
    status: z.enum(['planned', 'active', 'on_hold', 'completed', 'archived']),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    ownerId: z.string().optional(),
  })
  .refine(
    (values) => !values.startDate || !values.dueDate || values.dueDate >= values.startDate,
    { path: ['dueDate'], message: 'The due date must be after the start date' },
  )
export type CreateProjectValues = z.infer<typeof createProjectSchema>

const projectShape = {
  name: z.string().trim().min(2).max(120),
  key: z.string().trim().toUpperCase().regex(projectKeyRegex),
  description: z.string().trim().max(1000).optional(),
  status: z.enum(['planned', 'active', 'on_hold', 'completed', 'archived']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  ownerId: z.string().nullable().optional(),
}

export const updateProjectSchema = z
  .object(projectShape)
  .partial()
  .refine(
    (values) => !values.startDate || !values.dueDate || values.dueDate >= values.startDate,
    { path: ['dueDate'], message: 'The due date must be after the start date' },
  )
export type UpdateProjectValues = z.infer<typeof updateProjectSchema>

export const projectMemberSchema = z.object({
  userId: z.string().min(1, 'Choose a member'),
  role: z.enum(['owner', 'manager', 'member', 'viewer']),
})
export type ProjectMemberValues = z.infer<typeof projectMemberSchema>