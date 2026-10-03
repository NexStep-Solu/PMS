import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { friendlyMessage } from '@/lib/db/errors'

import { resetPasswordSchema, type ResetPasswordValues } from '../schemas'
import { useAuthActions } from '../queries'

export function ResetPasswordForm() {
  const navigate = useNavigate()
  const { changePassword } = useAuthActions()
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync(values.password)
      toast.success('Password updated', { description: 'Use it the next time you sign in.' })
      navigate('/app/dashboard', { replace: true })
    } catch (error) {
      form.setError('root', { message: friendlyMessage(error as never) })
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {form.formState.errors.root?.message ? (
          <InlineError message={form.formState.errors.root.message} />
        ) : null}

        <FormField name="password">
          <FormItem>
            <FormLabel>New password</FormLabel>
            <FormControl>
              {(props) => (
                <Input {...props} type="password" autoComplete="new-password" className="h-10" />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField name="confirmPassword">
          <FormItem>
            <FormLabel>Confirm password</FormLabel>
            <FormControl>
              {(props) => (
                <Input {...props} type="password" autoComplete="new-password" className="h-10" />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <Button type="submit" className="h-10 w-full" loading={form.formState.isSubmitting}>
          Update password
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
