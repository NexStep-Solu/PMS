import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { db } from '@/lib/client'
import { friendlyMessage } from '@/lib/db/errors'
import { queryClient } from '@/app/query-client'
import { safeRedirectPath } from '@/lib/redirects'

import { loginSchema, type LoginValues } from '../schemas'

export function LoginForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [unreachable, setUnreachable] = useState(false)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
  })

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await db().auth.signInWithPassword(values)
    if (error) {
      setUnreachable(error.kind === 'network')
      form.setError('root', { message: friendlyMessage(error) })
      return
    }
    setUnreachable(false)
    await queryClient.invalidateQueries()
    toast.success('Signed in')
    // Return the user to whatever they were trying to reach before the
    // redirect to /login, rather than always dropping them on the dashboard.
    navigate(safeRedirectPath(params.get('next')), { replace: true })
  })

  const rootError = form.formState.errors.root?.message

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {unreachable ? <NetworkHint host={supabaseUrl} /> : null}
        {rootError && !unreachable ? <InlineError message={rootError} /> : null}

        <FormField name="email">
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              {(props) => (
                <Input
                  {...props}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@company.com"
                  className="h-10"
                />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField name="password">
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Password</FormLabel>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <FormControl>
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="current-password"
                  className="h-10"
                />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <Button type="submit" className="h-10 w-full" loading={form.formState.isSubmitting}>
          Sign in
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </Form>
  )
}