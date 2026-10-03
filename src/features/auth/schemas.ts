import { z } from 'zod'

const email = z.string().trim().min(1, 'Email is required').email('Enter a valid email address')
const password = z.string().min(8, 'Use at least 8 characters')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Tell us your name').max(80, 'That name is too long'),
    email,
    password,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    workspaceName: z
      .string()
      .trim()
      .min(2, 'Name your workspace')
      .max(80, 'That name is too long')
      .optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
export type RegisterValues = z.infer<typeof registerSchema>

export const forgotPasswordSchema = z.object({ email })
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Name is required').max(80, 'That name is too long'),
  timezone: z.string().trim().min(1, 'Select a timezone'),
  avatarUrl: z.string().trim().url('Enter a valid URL').max(500).or(z.literal('')).optional(),
})
export type ProfileValues = z.infer<typeof profileSchema>

export const passwordChangeSchema = z
  .object({ newPassword: password, confirmPassword: z.string().min(1, 'Confirm your password') })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>