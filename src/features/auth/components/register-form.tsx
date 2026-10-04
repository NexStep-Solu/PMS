import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { db } from '@/lib/client'
import { friendlyMessage } from '@/lib/db/errors'
import { queryClient } from '@/app/query-client'
import { safeRedirectPath } from '@/lib/redirects'

import { registerSchema, type RegisterValues } from '../schemas'

export function RegisterForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // With "Confirm email" enabled, Supabase returns no session until the user
  // clicks the link. Navigating anyway would bounce straight back to /login.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null)
  const [unreachable, setUnreachable] = useState(false)
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      workspaceName: '',
    },
  })

  /**
   * An invite link carries `?token=`. The token goes into signup metadata so
   * `handle_new_user` joins the existing workspace instead of minting a second,
   * empty one for the new user.
   */
  const inviteToken = params.get('token') ?? undefined
  const joining = Boolean(inviteToken)

  const onSubmit = form.handleSubmit(async (values) => {
    const { data, error } = await db().auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName,
          // Ignored when an invite token is present; the SQL branches on the token.
          organization_name: values.workspaceName || `${values.fullName}'s workspace`,
          ...(inviteToken ? { invite_token: inviteToken } : {}),
        },
        emailRedirectTo: `${window.location.origin}/app/dashboard`,
      },
    })

    if (error) {
      setUnreachable(error.kind === 'network')
      form.setError('root', { message: friendlyMessage(error) })
      return
    }
    setUnreachable(false)

    if (!data.session) {
      setAwaitingConfirmation(values.email)
      toast.success('Confirm your email', {
        description: joining
          ? 'We sent you a link. Click it to finish joining the workspace.'
          : 'We sent you a link. Click it to finish setting up your workspace.',
      })
      return
    }

    await queryClient.invalidateQueries()
    toast.success('Workspace created')
    navigate(safeRedirectPath(params.get('next')), { replace: true })
  })

  const rootError = form.formState.errors.root?.message

  if (awaitingConfirmation) {
    return (
      <div className="space-y-4 rounded-xl border p-5 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <MailCheck className="size-5" aria-hidden />
        </span>
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Check your inbox</h2>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to{' '}
            <span className="font-medium text-foreground">{awaitingConfirmation}</span>. Click it to
            activate your account and create your workspace.
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => setAwaitingConfirmation(null)}>
          Use a different email
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {unreachable ? <NetworkHint host={supabaseUrl} /> : null}
        {rootError && !unreachable ? <InlineError message={rootError} /> : null}

        <FormField name="fullName">
          <FormItem>
            <FormLabel>Full name</FormLabel>
            <FormControl>{(props) => <Input {...props} autoComplete="name" className="h-10" />}</FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField name="email">
          <FormItem>
            <FormLabel>Work email</FormLabel>
            <FormControl>
              {(props) => (
                <Input {...props} type="email" autoComplete="email" className="h-10" />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        {/* Asking for a workspace name during a join would be noise: the token
            already decides which workspace they land in. */}
        {joining ? null : (
          <FormField name="workspaceName">
            <FormItem>
              <FormLabel>Workspace name</FormLabel>
              <FormControl>
                {(props) => <Input {...props} placeholder="Acme Product Team" className="h-10" />}
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="password">
            <FormItem>
              <FormLabel>Password</FormLabel>
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
              <FormLabel>Confirm</FormLabel>
              <FormControl>
                {(props) => (
                  <Input {...props} type="password" autoComplete="new-password" className="h-10" />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>

        <Button type="submit" className="h-10 w-full" loading={form.formState.isSubmitting}>
          Create workspace
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </Form>
  )
}