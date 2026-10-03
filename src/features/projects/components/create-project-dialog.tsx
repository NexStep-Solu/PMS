import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useState } from 'react'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/forms/form'
import { InlineError } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DatePicker } from '@/components/shared/date-picker'
import { MemberSelect } from '@/components/shared/member-select'
import { ProjectPrioritySelect, ProjectStatusSelect } from '@/components/shared/project-selects'
import { friendlyMessage } from '@/lib/db/errors'
import { useCurrentUser } from '@/features/auth/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'
import { useMemberOptions } from '@/features/organizations/queries'

import { useCreateProject } from '../queries'
import { createProjectSchema, type CreateProjectValues } from '../schemas'

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const userId = useCurrentUser()?.id
  const { organizationName } = useWorkspace()
  const createProject = useCreateProject()
  const memberOptions = useMemberOptions()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CreateProjectValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      key: '',
      status: 'planned',
      priority: 'medium',
      startDate: undefined,
      dueDate: undefined,
    },
  })

  const close = () => {
    setServerError(null)
    form.reset()
    onOpenChange(false)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    if (!userId) {
      setServerError('You must be signed in to create a project.')
      return
    }
    try {
      await createProject.mutateAsync({ ...values, userId })
      close()
    } catch (error) {
      setServerError(friendlyMessage(error as never))
    }
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Projects live in {organizationName ?? 'this workspace'} and own their own task board.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {serverError ? <InlineError message={serverError} /> : null}

            <FormField name="name">
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>{(props) => <Input {...props} />}</FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
              <FormField name="key">
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    {(props) => (
                      <Input {...props} placeholder="WEB" maxLength={10} className="font-mono uppercase" />
                    )}
                  </FormControl>
                  <FormDescription>2–10 characters, used as the task prefix.</FormDescription>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField name="status">
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    {(props) => (
                      <ProjectStatusSelect
                        {...props}
                        value={form.watch('status')}
                        onChange={(value) =>
                          form.setValue('status', value, { shouldValidate: true })
                        }
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <FormField name="description">
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  {(props) => <Textarea {...props} rows={3} />}
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="startDate">
                <FormItem>
                  <FormLabel>Start date</FormLabel>
                  <FormControl>
                    {(props) => (
                      <DatePicker
                        {...props}
                        value={form.watch('startDate') ?? null}
                        onChange={(value) => form.setValue('startDate', value ?? undefined, { shouldValidate: true })}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField name="dueDate">
                <FormItem>
                  <FormLabel>Due date</FormLabel>
                  <FormControl>
                    {(props) => (
                      <DatePicker
                        {...props}
                        value={form.watch('dueDate') ?? null}
                        onChange={(value) => form.setValue('dueDate', value ?? undefined, { shouldValidate: true })}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="priority">
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    {(props) => (
                      <ProjectPrioritySelect
                        {...props}
                        value={form.watch('priority')}
                        onChange={(value) =>
                          form.setValue('priority', value, { shouldValidate: true })
                        }
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField name="ownerId">
                <FormItem>
                  <FormLabel>Owner</FormLabel>
                  <FormControl>
                    {(props) => (
                      <MemberSelect
                        {...props}
                        members={memberOptions}
                        value={form.watch('ownerId') ?? null}
                        onChange={(value) => form.setValue('ownerId', value ?? undefined)}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Create project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}