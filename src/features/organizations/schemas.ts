import { z } from 'zod'
import { ROLES } from '@/types/database'

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, 'Give the workspace a name').max(80, 'That name is too long'),
})
export type WorkspaceValues = z.infer<typeof workspaceSchema>

export const inviteMemberSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  role: z.enum(ROLES).default('member'),
})
export type InviteMemberValues = z.infer<typeof inviteMemberSchema>

export const teamSchema = z.object({
  name: z.string().trim().min(2, 'Give the team a name').max(80, 'That name is too long'),
  description: z.string().trim().max(500).optional(),
})
export type TeamValues = z.infer<typeof teamSchema>
