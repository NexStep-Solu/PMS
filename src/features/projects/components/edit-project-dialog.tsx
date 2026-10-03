import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/shared/date-picker'
import { MemberSelect } from '@/components/shared/member-select'
import { ProjectPrioritySelect, ProjectStatusSelect } from '@/components/shared/project-selects'
import { friendlyMessage } from '@/lib/db/errors'
import { useMemberOptions } from '@/features/organizations/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'
import type { Project } from '@/types/database'

import { useUpdateProject, type ProjectWithMeta } from '../queries'
import { updateProjectSchema, type UpdateProjectValues } from '../schemas'

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectWithMeta | undefined
}) {
  const memberOptions = useMemberOptions()
  const { organizationName } = useWorkspace()
  const updateProject = useUpdateProject(project?.id ?? '')
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<UpdateProjectValues>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: {},
  })

  useEffect(() => {
    if (!open || !project) return
    setServerError(null)
    form.reset({
      name: project.name,
      key: project.key,
      description: project.description ?? '',
      status: project.status,
      priority: project.priority,
      startDate: project.start_date ?? undefined,
      dueDate: project.due_date ?? undefined,
      ownerId: project.owner_id ?? null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project])

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    try {
      await updateProject.mutateAsync(values)
      toast.success('Project updated')
      onOpenChange(false)
    } catch (error) {
      setServerError(friendlyMessage(error as never))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Changes apply to everyone in {organizationName ?? 'this workspace'}.
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
                  <FormControl>{(props) => <Input {...props} maxLength={10} className="font-mono uppercase" />}</FormControl>
                  <FormDescription>Used as the task prefix.</FormDescription>
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
                        value={form.watch('status') ?? 'planned'}
                        onChange={(value) => form.setValue('status', value)}
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
                <FormControl>{(props) => <Textarea {...props} rows={3} />}</FormControl>
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
                        value={form.watch('priority') ?? 'medium'}
                        onChange={(value) => form.setValue('priority', value)}
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
                        onChange={(value) => form.setValue('ownerId', value, { shouldValidate: true })}
                        aria-label="Project owner"
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export type { Project }