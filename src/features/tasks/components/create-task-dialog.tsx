import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useEffect, useState } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/shared/date-picker'
import { LabelBadge } from '@/components/shared/badges'
import { MemberSelect } from '@/components/shared/member-select'
import { PrioritySelect, ProjectSelect, StatusSelect } from '@/components/shared/task-form-fields'
import { friendlyMessage } from '@/lib/db/errors'
import { useCurrentUser } from '@/features/auth/queries'
import { useMemberOptions } from '@/features/organizations/queries'

import { useCreateTask, useWorkspaceTaskMeta } from '../queries'
import { createTaskSchema, type CreateTaskValues } from '../schemas'
import { useTaskDialog } from '../task-dialog-context'
import { useProjectsSidebar } from '@/features/projects/queries'

export function CreateTaskDialog() {
  const { createOpen, createProjectId, closeCreate } = useTaskDialog()
  const { data: projects } = useProjectsSidebar()
  const { statuses, priorities, labels, loading } = useWorkspaceTaskMeta()
  const memberOptions = useMemberOptions()
  const userId = useCurrentUser()?.id
  const createTask = useCreateTask()
  const [serverError, setServerError] = useState<string | null>(null)

  const defaultStatus = statuses.find((status) => status.is_default) ?? statuses[0]
  const defaultPriority = priorities.find((priority) => priority.level === 3) ?? priorities[0]

  /**
   * Projects, statuses and members arrive as separate queries. Opening the dialog
   * before they land used to show an empty Project box, a disabled Assignee box
   * and a submit button that could never fire, with no hint that data was still
   * arriving.
   */
  const metaLoading = projects === undefined || statuses === undefined || loading

  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      projectId: '',
      statusId: '',
      priorityId: undefined,
      assigneeId: undefined,
      startDate: undefined,
      dueDate: undefined,
      estimatedMinutes: undefined,
      labelIds: [],
    },
  })

  const projectId = form.watch('projectId')

  useEffect(() => {
    if (!createOpen) return
    setServerError(null)
    form.reset({
      title: '',
      description: '',
      projectId: createProjectId ?? projects?.[0]?.id ?? '',
      statusId: defaultStatus?.id ?? '',
      priorityId: defaultPriority?.id,
      assigneeId: userId,
      startDate: undefined,
      dueDate: undefined,
      estimatedMinutes: undefined,
      labelIds: [],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen, createProjectId, projects, defaultStatus, defaultPriority, userId])

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null)
    if (!userId) {
      setServerError('You must be signed in to create a task.')
      return
    }
    try {
      await createTask.mutateAsync({ ...values, userId })
      toast.success('Task created')
      closeCreate()
    } catch (error) {
      setServerError(friendlyMessage(error as never))
    }
  })

  const toggleLabel = (labelId: string, checked: boolean) => {
    const current = form.getValues('labelIds') ?? []
    form.setValue(
      'labelIds',
      checked ? [...current, labelId] : current.filter((id) => id !== labelId),
      { shouldDirty: true },
    )
  }

  return (
    <Dialog open={createOpen} onOpenChange={(open) => (open ? undefined : closeCreate())}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Press <kbd className="rounded border px-1 font-mono text-xs">Enter</kbd> to create.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {serverError ? <InlineError message={serverError} /> : null}
            {metaLoading ? (
              <p className="text-sm text-muted-foreground" role="status">
                Loading projects and members…
              </p>
            ) : null}

            <FormField name="title">
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  {(props) => (
                    <Input
                      {...props}
                      autoFocus
                      placeholder="What needs to happen?"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          event.currentTarget.form?.requestSubmit()
                        }
                      }}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField name="description">
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>{(props) => <Textarea {...props} rows={3} placeholder="Optional context" />}</FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField name="projectId">
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <FormControl>
                    {(props) => (
                      <ProjectSelect
                        {...props}
                        projects={projects ?? []}
                        value={form.watch('projectId')}
                        onChange={(value) => form.setValue('projectId', value, { shouldValidate: true })}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField name="statusId">
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    {(props) => (
                      <StatusSelect
                        {...props}
                        statuses={statuses}
                        value={form.watch('statusId')}
                        onChange={(value) => form.setValue('statusId', value, { shouldValidate: true })}
                        disabled={loading}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField name="assigneeId">
                <FormItem>
                  <FormLabel>Assignee</FormLabel>
                  <FormControl>
                    {(props) => (
                      <MemberSelect
                        {...props}
                        members={memberOptions}
                        value={form.watch('assigneeId') ?? null}
                        onChange={(value) => form.setValue('assigneeId', value ?? undefined)}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField name="priorityId">
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    {(props) => (
                      <PrioritySelect
                        {...props}
                        priorities={priorities}
                        value={form.watch('priorityId') ?? null}
                        onChange={(value) => form.setValue('priorityId', value ?? undefined)}
                      />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

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

            {labels.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Labels</legend>
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => {
                    const checked = (form.watch('labelIds') ?? []).includes(label.id)
                    return (
                      <label key={label.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleLabel(label.id, value === true)}
                        />
                        <LabelBadge label={label} />
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeCreate}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={form.formState.isSubmitting}
                disabled={metaLoading || projectId.length === 0}
              >
                Create task
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}