import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { toast } from 'sonner'

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/forms/form'
import { InlineError } from '@/components/shared/states'
import { NetworkHint } from '@/components/shared/network-hint'
import { supabaseUrl } from '@/lib/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { friendlyMessage } from '@/lib/db/errors'
import type { AppError } from '@/lib/db/errors'

import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas'
import { useAuthActions } from '../queries'

export function ForgotPasswordForm() {
  const { resetPassword } = useAuthActions()
  const [unreachable, setUnreachable] = useState(false)
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await resetPassword.mutateAsync(values.email)
      toast.success('Check your inbox', {
        description: 'If an account exists, a reset link is on its way.',
      })
      form.reset()
    } catch (error) {
      const appError = error as AppError
      setUnreachable(appError.kind === 'network')
      form.setError('root', {
        message: friendlyMessage(appError) || 'Could not send the reset email.',
      })
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {unreachable ? <NetworkHint host={supabaseUrl} /> : null}
        {form.formState.errors.root?.message && !unreachable ? (
          <InlineError message={form.formState.errors.root.message} />
        ) : null}

        <p className="text-sm text-muted-foreground">
          Enter the email you use for PMS and we&apos;ll send a link to reset your password.
        </p>

        <FormField name="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              {(props) => (
                <Input {...props} type="email" autoComplete="email" className="h-10" />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <Button type="submit" className="h-10 w-full" loading={form.formState.isSubmitting}>
          <MailCheck aria-hidden />
          Send reset link
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </Form>
  )
}
