import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useState } from 'react'

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { friendlyMessage } from '@/lib/db/errors'
import { useCreateWorkspace, useCurrentUser } from '@/features/auth/queries'

import { workspaceSchema, type WorkspaceValues } from '../schemas'

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (organizationId: string) => void
}) {
  const userId = useCurrentUser()?.id
  const createWorkspace = useCreateWorkspace()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: '' },
  })

  const close = () => {
    setServerError(null)
    form.reset()
    onOpenChange(false)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    if (!userId) {
      setServerError('You must be signed in.')
      return
    }
    try {
      const created = await createWorkspace.mutateAsync({ name: values.name, userId })
      close()
      onCreated?.(created.id)
    } catch (error) {
      setServerError(friendlyMessage(error as never))
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>New workspace</DialogTitle>
          <DialogDescription>
            A workspace has its own members, projects and tasks. You will be its owner.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {serverError ? <InlineError message={serverError} /> : null}

            <FormField name="name">
              <FormItem>
                <FormLabel>Workspace name</FormLabel>
                <FormControl>{(props) => <Input {...props} autoFocus placeholder="Product Team" />}</FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Create workspace
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
